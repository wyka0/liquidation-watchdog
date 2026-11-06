import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { calculateRisk } from "../src/risk/engine.js";
import { snapshotIdentifier } from "../src/risk/provenance.js";
import { riskSnapshotSchema } from "../src/risk/snapshot-schema.js";
import { parseThresholds } from "../src/config/risk.js";
import { stringify } from "../src/domain/serialize.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";
import { baseline, projectFiles, root, sha256 } from "./phase3-files.js";

const original = await baseline(), files = await projectFiles();
const archiveFiles = original.baseline.files.filter(file => /^evidence\/phase[12]\//.test(file.path));
const checks = await Promise.all(archiveFiles.map(async file => {
  if (!files.has(file.path)) return { path: file.path, unchanged: false };
  const bytes = await readFile(join(root, file.path));
  return { path: file.path, unchanged: bytes.length === file.bytes && sha256(bytes) === file.sha256 };
}));
const expected = new Set(archiveFiles.map(file => file.path));
const unexpected = [...files].filter(path => /^evidence\/phase[12]\//.test(path) && !expected.has(path));
const artifactChecks: { path: string; matches: boolean }[] = [];
const replays = [];
for (const directory of ["risk/live", "risk/historical-21853902", "risk-integration"]) {
  const path = join(root, "evidence/phase2", directory);
  const manifest = z.object({ inputSnapshotIdentifier: z.string(), files: z.array(z.object({ file: z.string().regex(/^[a-z-]+\.(?:json|txt)$/), sha256: z.string() })) })
    .parse(JSON.parse(await readFile(join(path, "manifest.json"), "utf8")));
  for (const file of manifest.files) artifactChecks.push({ path: `evidence/phase2/${directory}/${file.file}`, matches: sha256(await readFile(join(path, file.file))) === file.sha256 });
  // The identifier equality below proves the bigint revival reproduced the exact typed Phase 2 input.
  const inputText = await readFile(join(path, "input-snapshot.json"), "utf8");
  const jsonInput = z.object({ reads: z.array(z.object({ params: z.unknown(), result: z.unknown() })) }).parse(JSON.parse(inputText));
  const revived = riskSnapshotSchema.parse(JSON.parse(inputText,
    (_key, value: unknown) => typeof value === "string" && /^(?:0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : value));
  // Real RPC/MCP params/results are JSON wire values, not decoded bigint accounting fields.
  for (const [index, read] of revived.reads.entries()) { read.params = jsonInput.reads[index]!.params; read.result = jsonInput.reads[index]!.result; }
  const snapshot = riskSnapshotSchema.parse(revived);
  const previousText = await readFile(join(path, "risk-result.json"), "utf8");
  const previous = z.object({ calculatedAt: z.string(), thresholdConfiguration: z.object({ decimal: z.object({
    warningRatio: z.string(), criticalRatio: z.string(), targetRatio: z.string(), liquidationBoundary: z.string()
  }) }) }).passthrough().parse(JSON.parse(previousText)) as Record<string, unknown>;
  const result = calculateRisk(snapshot, parseThresholds((previous.thresholdConfiguration as { decimal: Record<string, string> }).decimal), {
    calculatedAt: new Date(previous.calculatedAt as string), expectedSnapshotIdentifier: manifest.inputSnapshotIdentifier
  });
  const exactInput = snapshotIdentifier(snapshot) === manifest.inputSnapshotIdentifier;
  // Recovery estimates are eligibility-gated since Phase 12B: archived amounts are historical records and are
  // no longer reproduced. Exact replay covers the unchanged base-risk projection only.
  const baseKeys = ["schemaVersion", "calculationVersion", "calculatedAt", "ratioScale", "chainId", "protocol", "morphoAddress",
    "marketId", "account", "accountRole", "blockNumber", "blockHash", "blockTimestamp", "evidenceKind", "temporalContext",
    "snapshotRetrievedAt", "inputSnapshotIdentifier", "collateralAmount", "collateralValue", "debtAmount", "liquidationCapacity",
    "ltv", "safetyRatio", "capacityRelation", "mathematicalRiskState", "riskState", "dataQuality", "actionability", "actionable",
    "indicative", "oracleAddress", "oraclePrice", "oracleTimestamp", "tokens", "thresholdConfiguration", "warnings"] as const;
  const baseProjection = (value: Record<string, unknown>) => Object.fromEntries(baseKeys.map(key => [key, value[key] ?? null]));
  const exactResult = stringify(baseProjection(previous)) === stringify(baseProjection(result as unknown as Record<string, unknown>));
  replays.push({ directory, exactInput, exactResult, blockNumber: result.blockNumber?.toString(), blockHash: result.blockHash,
    debt: result.debtAmount?.toString(), capacity: result.liquidationCapacity?.toString(), ltv: result.ltv?.toString(), safetyRatio: result.safetyRatio?.toString(),
    recoveryEstimates: result.recoveryEligibility.status, recoveryReasonCodes: [...result.recoveryEligibility.reasonCodes],
    oracle: result.dataQuality.oracle, actionable: result.actionable });
}
const passed = checks.every(check => check.unchanged) && !unexpected.length && artifactChecks.every(check => check.matches)
  && replays.every(replay => replay.exactInput && replay.exactResult);
await writeFile(join(root, CURRENT_EVIDENCE, "phase2-exact-replays.json"), `${JSON.stringify({
  evidenceKind: "ARCHIVE_INTEGRITY_AND_EXACT_TYPED_REPLAY", checkedAt: new Date().toISOString(), baselineSha256: original.sha256,
  passed, phase1Count: checks.filter(check => check.path.startsWith("evidence/phase1/")).length,
  phase2Count: checks.filter(check => check.path.startsWith("evidence/phase2/")).length, checks, unexpected, artifactChecks, replays
}, null, 2)}\n`);
console.log(`Prior evidence: ${checks.filter(check => check.unchanged).length}/${checks.length} unchanged; ${unexpected.length} unexpected archive files.`);
console.log(`Phase 2 artifact hashes: ${artifactChecks.filter(check => check.matches).length}/${artifactChecks.length}; exact input/result replays: ${replays.filter(replay => replay.exactInput && replay.exactResult).length}/${replays.length}.`);
if (!passed) process.exitCode = 1;
