import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "../src/domain/serialize.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";
import { assertSourceInputs, buildInputs, documentationInputs, FINAL_CHECKS, sourceInputs, VERIFICATION_CHECKS } from "./release-inputs.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDirectory = join(root, CURRENT_EVIDENCE);
await mkdir(outputDirectory, { recursive: true });
await mkdir(join(root, "docs"), { recursive: true });
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this script using npm run verify.");
const startedAt = new Date().toISOString();
const finalize = process.argv.slice(2).includes("--finalize");
if (process.argv.slice(2).some(arg => arg !== "--finalize")) throw new Error("Supported verification option: --finalize.");
const attempt = `verification-runs/${randomUUID()}`;
await mkdir(join(outputDirectory, attempt), { recursive: true });
const results: { check: string; command: string; exitCode: number; startedAt: string; finishedAt: string; outputFile: string }[] = [];

async function run(check: string, command: string, args: string[], timeout = 300_000): Promise<boolean> {
  const started = new Date().toISOString();
  const chunks: string[] = [];
  console.log(`\n[${check}]`);
  const code = await new Promise<number>(resolve => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout, killSignal: "SIGKILL" });
    child.stdout.on("data", (data: Buffer) => { const text = data.toString(); chunks.push(text); process.stdout.write(text); });
    child.stderr.on("data", (data: Buffer) => { const text = data.toString(); chunks.push(text); process.stderr.write(text); });
    child.on("error", () => resolve(1));
    child.on("close", code => resolve(code ?? 1));
  });
  const file = `${check}.txt`;
  // Fixed commands operate only on this public, read-only project; no environment dump.
  const output = chunks.join("").replaceAll("\r\n", "\n").trimEnd();
  await writeFile(join(outputDirectory, file), output ? `${output}\n` : "", "utf8");
  const outputFile = `${attempt}/${file}`;
  await writeFile(join(outputDirectory, outputFile), output ? `${output}\n` : "", "utf8");
  results.push({ check, command: [command === process.execPath ? "node" : command, ...args.map(arg => arg === npmCli ? "npm-cli.js" : arg)].join(" "), exitCode: code, startedAt: started, finishedAt: new Date().toISOString(), outputFile });
  const generated = ({ "test-unit": "unit-tests.json", "test-operations": "operations-tests.json", "test-integration": "integration-tests.json", "test-stability": "stability-results.json" } as Record<string, string>)[check];
  if (generated) {
    try { await writeFile(join(outputDirectory, attempt, generated), await readFile(join(outputDirectory, generated))); }
    catch { /* A failed tool may not have produced its machine-readable report; its exit remains failed. */ }
  }
  return code === 0;
}

// Reserve the remaining report paths before inventory generation, including their command transcripts.
for (const file of [...FINAL_CHECKS.map(check => `${check}.txt`), "documentation-links.json", "secret-scan.json", "project-whitespace.json",
  "finalization-results.json", "release-manifest.json", "release-manifest.sha256", "release-manifest-check.json"]) {
  try { await writeFile(join(outputDirectory, file), "", { flag: "wx" }); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error; }
}
for (const check of FINAL_CHECKS) await writeFile(join(outputDirectory, attempt, `${check}.txt`), "");
const reportName = finalize ? "finalization-results.json" : "verification-results.json";
await writeFile(join(outputDirectory, attempt, reportName), "");
if (finalize) await assertSourceInputs();
else await writeFile(join(outputDirectory, "verification-inputs.json"), stringify({ recordedAt: startedAt, ...await sourceInputs() }) + "\n");
await writeFile(join(outputDirectory, attempt, "verification-inputs.json"), await readFile(join(outputDirectory, "verification-inputs.json")));
await writeFile(join(outputDirectory, reportName), `${stringify({ status: "RUNNING", startedAt })}\n`, "utf8");
let passed = true;
if (!finalize) {
  for (const script of ["typecheck", "lint", "test:unit", "test:operations", "test:integration", "test:stability", "build"]) {
    if (!await run(script.replaceAll(":", "-"), process.execPath, [npmCli, "run", script])) { passed = false; break; }
    if (script === "build") {
      const build = stringify({ recordedAt: new Date().toISOString(), ...await buildInputs() }) + "\n";
      await writeFile(join(outputDirectory, "build-artifacts.json"), build);
      await writeFile(join(outputDirectory, attempt, "build-artifacts.json"), build);
    }
  }
  if (passed) passed = await run("built-cli-smoke", process.execPath, ["dist/cli.js", "--help"]);
  if (passed) passed = await run("cli-inspect-smoke", process.execPath, ["--import", "tsx", "src/cli.ts", "inspect", "--save-evidence"]);
  if (passed) passed = await run("built-cli-risk-smoke", process.execPath, ["dist/cli.js", "risk", "--save-evidence"]);
  if (passed) passed = await run("built-cli-historical-risk-smoke", process.execPath, [
  "dist/cli.js", "risk", "--block", "21853902", "--warning", "1.30", "--critical", "1.10", "--target", "1.25", "--save-evidence"
  ]);
  if (passed) passed = await run("historical-phase2-regression", process.execPath, ["--import", "tsx", "scripts/phase3-live-regression.ts"]);
  if (passed) passed = await run("bounded-monitoring-restart-smoke", process.execPath, ["--import", "tsx", "scripts/monitoring-smoke.ts"], 540_000);
  // This must immediately follow monitoring so the accepted snapshot remains inside the readiness age budget.
  if (passed) passed = await run("operational-cli-smoke", process.execPath, [npmCli, "run", "smoke:operations"], 540_000);
  if (passed) passed = await run("bounded-oracle-cli-smoke", process.execPath, ["--import", "tsx", "scripts/oracle-smoke.ts"], 780_000);
  if (passed) passed = await run("source-runtime-links", process.execPath, ["--import", "tsx", "scripts/link-source-evidence.ts"]);
  if (passed) {
    passed = await run("dependency-audit", process.execPath, [npmCli, "audit", "--json"]);
    const auditText = await readFile(join(outputDirectory, "dependency-audit.txt"), "utf8");
    try { await writeFile(join(outputDirectory, "dependency-audit.json"), `${stringify(JSON.parse(auditText) as unknown)}\n`, "utf8"); }
    catch { passed = false; }
  }
  // Archive/evidence checks run even if another check failed.
  passed = await run("phase1-evidence-integrity", process.execPath, ["--import", "tsx", "scripts/phase1-integrity.ts", "--check"]) && passed;
  passed = await run("prior-phases-integrity", process.execPath, ["--import", "tsx", "scripts/phase5-preservation.ts"]) && passed;
  passed = await run("phase2-exact-replays", process.execPath, ["--import", "tsx", "scripts/phase3-preservation.ts"]) && passed;
  passed = await run("oracle-evidence-verification", process.execPath, ["--import", "tsx", "scripts/check-oracle-evidence.ts"]) && passed;
}
passed = await run("phase5-inventory", process.execPath, ["--import", "tsx", "scripts/phase5-inventory.ts"]) && passed;
const checkedDocumentation = await documentationInputs();
passed = await run("documentation-links", process.execPath, ["--import", "tsx", "scripts/check-doc-links.ts"]) && passed;
passed = await run("secrets-check", process.execPath, [npmCli, "run", "secrets:check"]) && passed;
passed = await run("project-whitespace-check", process.execPath, ["--import", "tsx", "scripts/check-whitespace.ts"], 300_000) && passed;
passed = await run("git-diff-check", "git", ["diff", "--check"]) && passed;
let sourceInputsUnchanged = true;
try { await assertSourceInputs(); } catch { sourceInputsUnchanged = false; passed = false; }
const documentationInputsUnchanged = checkedDocumentation.sha256 === (await documentationInputs()).sha256;
const planned = finalize ? FINAL_CHECKS : VERIFICATION_CHECKS;
passed = passed && documentationInputsUnchanged && results.length === planned.length && planned.every(check => results.some(result => result.check === check && result.exitCode === 0));

const report = stringify({
  evidenceKind: finalize ? "PHASE5_LOCAL_FINALIZATION" : "PHASE5_LOCAL_VERIFICATION_WITH_BOUNDED_LIVE_READS", startedAt, finishedAt: new Date().toISOString(),
  passed, nodeVersion: process.version, sqliteVersion: process.versions.sqlite, platform: process.platform, plannedChecks: planned.length, results, sourceInputsUnchanged,
  documentationInputsUnchanged, documentationInputsSha256: checkedDocumentation.sha256,
  testEvidence: { unit: "unit-tests.json (FIXTURE including local OS/SQLite faults)", operations: "operations-tests.json (repeated operational subset)",
    integration: "integration-tests.json (LIVE_CHAIN_READ)", stability: "stability-results.json (SYNTHETIC_TIME_FIXTURE)" },
  gitNote: "Existing Phase 1-4 intent-to-add entries were retained. Read-only Git checks include separate no-index checks for new files. No index modification, commit, push or tag was performed.",
  archiveNote: "All 391 Phase 1-4 evidence files and the pre-implementation gap register are sealed. New captures are under evidence/phase5.",
  realExternalNotifications: 0, transactions: 0, productionMonitoringStarted: false, productionReleaseReady: false
}) + "\n";
await writeFile(join(outputDirectory, reportName), report, "utf8");
await writeFile(join(outputDirectory, attempt, reportName), report, "utf8");
console.log(`\nPhase 5 ${finalize ? "finalization" : "verification"}: ${passed ? "PASS" : "FAIL"}; ${results.filter(result => result.exitCode === 0).length}/${planned.length} checks.`);
if (!passed) process.exitCode = 1;
