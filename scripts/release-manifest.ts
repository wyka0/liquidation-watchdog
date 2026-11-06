import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { DEPLOYMENT, NETWORK } from "../src/config/deployment.js";
import { parseMonitoringConfiguration } from "../src/config/monitoring.js";
import { VERIFIED_RUNTIME } from "../src/config/production.js";
import { stringify } from "../src/domain/serialize.js";
import { hashParts } from "../src/monitoring/model.js";
import { SAFETY_STATUS } from "../src/operations/diagnostics.js";
import { APPLICATION_ID, MIGRATIONS } from "../src/storage/migrations.js";
import { baseline, projectFiles, root, sha256 } from "./phase5-files.js";
import { assertSourceInputs, bindingHash, bindings, buildInputs, documentationInputs, FINAL_CHECKS, gitRevision, PHASE5_DOCUMENTS, VERIFICATION_CHECKS } from "./release-inputs.js";

const evidence = "evidence/phase5", manifestPath = `${evidence}/release-manifest.json`, checksumPath = `${evidence}/release-manifest.sha256`;
// These are the only intentionally unbound self/check outputs; all other Phase 5 evidence is bound.
const selfOutputs = new Set([manifestPath, checksumPath, `${evidence}/release-manifest-check.json`]);
const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(join(root, path), "utf8")) as unknown;
const resultSchema = z.object({ passed: z.literal(true), sourceInputsUnchanged: z.literal(true), documentationInputsUnchanged: z.literal(true),
  documentationInputsSha256: z.string().regex(/^[a-f0-9]{64}$/), nodeVersion: z.literal(VERIFIED_RUNTIME.node),
  sqliteVersion: z.literal(VERIFIED_RUNTIME.sqlite), startedAt: z.iso.datetime(), finishedAt: z.iso.datetime(), plannedChecks: z.number().int().positive(),
  results: z.array(z.object({ check: z.string(), command: z.string(), exitCode: z.literal(0), startedAt: z.iso.datetime(), finishedAt: z.iso.datetime(),
    outputFile: z.string().regex(/^verification-runs\/[a-f0-9-]{36}\/[a-z0-9-]+\.txt$/) })) });
const testSchema = z.object({ success: z.literal(true), numTotalTests: z.number().int().positive(), numPassedTests: z.number().int().positive(),
  numFailedTests: z.literal(0), numPendingTests: z.literal(0), numTodoTests: z.literal(0), testResults: z.array(z.object({ status: z.literal("passed") })).min(1) });
const passed = z.object({ passed: z.literal(true) });

async function collect() {
  assert.equal(process.version, VERIFIED_RUNTIME.node); assert.equal(process.versions.sqlite, VERIFIED_RUNTIME.sqlite);
  const inputs = await assertSourceInputs(), build = await buildInputs(), recordedBuild = z.object({ sha256: z.string() }).parse(await json(`${evidence}/build-artifacts.json`));
  assert.equal(build.sha256, recordedBuild.sha256, "Build changed after the verified build command.");
  const verification = resultSchema.parse(await json(`${evidence}/verification-results.json`)), finalization = resultSchema.parse(await json(`${evidence}/finalization-results.json`));
  assert.deepEqual(verification.results.map(result => result.check), VERIFICATION_CHECKS);
  assert.deepEqual(finalization.results.map(result => result.check), FINAL_CHECKS);
  assert.equal(verification.plannedChecks, VERIFICATION_CHECKS.length); assert.equal(finalization.plannedChecks, FINAL_CHECKS.length);
  assert.ok(finalization.startedAt >= verification.finishedAt, "Finalization must follow the completed full verification.");
  const pkg = z.object({ name: z.string(), version: z.string(), private: z.literal(true), engines: z.object({ node: z.string() }) }).parse(await json("package.json"));
  const tests = {} as Record<string, { passed: number; total: number; files: number; kind: string }>;
  for (const [name, kind] of [["unit", "FIXTURE_AND_LOCAL_OS_SQLITE_FAULTS"], ["operations", "REPEATED_OPERATIONAL_SUBSET"], ["integration", "LIVE_READ_ONLY_CHAIN"]]) {
    const command = verification.results.find(result => result.check === `test-${name}`)!;
    assert.equal(sha256(await readFile(join(root, evidence, `${name}-tests.json`))),
      sha256(await readFile(join(root, evidence, dirname(command.outputFile), `${name}-tests.json`))), "Test report differs from its verified attempt.");
    const result = testSchema.parse(await json(`${evidence}/${name}-tests.json`)); assert.equal(result.numTotalTests, result.numPassedTests);
    tests[name!] = { passed: result.numPassedTests, total: result.numTotalTests, files: result.testResults.length, kind: kind! };
  }
  const stability = z.object({ passed: z.literal(true), cyclesRequested: z.number(), cyclesCompleted: z.number(), restarts: z.number(), virtualElapsedDays: z.number(),
    realElapsedMs: z.number(), peakRssBytes: z.number(), externalCalls: z.literal(0), productionSoakCompleted: z.literal(false) }).parse(await json(`${evidence}/stability-results.json`));
  assert.equal(stability.cyclesCompleted, stability.cyclesRequested);
  const stabilityCommand = verification.results.find(result => result.check === "test-stability")!;
  assert.equal(sha256(await readFile(join(root, evidence, "stability-results.json"))),
    sha256(await readFile(join(root, evidence, dirname(stabilityCommand.outputFile), "stability-results.json"))));
  const audit = z.object({ metadata: z.object({ vulnerabilities: z.object({ info: z.literal(0), low: z.literal(0), moderate: z.literal(0), high: z.literal(0), critical: z.literal(0), total: z.literal(0) }) }) })
    .parse(await json(`${evidence}/dependency-audit.json`));
  const preservation = z.object({ passed: z.literal(true), gapRegisterUnchanged: z.literal(true), counts: z.array(z.object({ phase: z.number(), files: z.number() })),
    checks: z.array(z.object({ unchanged: z.literal(true) })), unexpected: z.array(z.never()) }).parse(await json(`${evidence}/prior-phases-integrity.json`));
  assert.deepEqual(preservation.counts, [{ phase: 1, files: 54 }, { phase: 2, files: 73 }, { phase: 3, files: 77 }, { phase: 4, files: 187 }]);
  assert.equal(preservation.checks.length, 391);
  const originals = await baseline(), gap = z.object({ sha256: z.string() }).parse(await json(`${evidence}/gap-register-record.json`));
  assert.equal(sha256(await readFile(join(root, "docs/production-readiness-gaps.md"))), gap.sha256);
  const archivePaths = originals.baseline.files.filter(file => /^evidence\/phase[1-4]\//.test(file.path));
  assert.deepEqual(await bindings(archivePaths.map(file => file.path)), [...archivePaths].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const sources = z.object({ allMatch: z.literal(true), oracleLibraryExactTextMatch: z.literal(true), matches: z.array(z.unknown()), sourceFileHashes: z.array(z.object({ matches: z.literal(true) })) })
    .parse(await json(`${evidence}/source-runtime-matches.json`));
  const oracle = z.object({ passed: z.literal(true), bundles: z.array(z.unknown()), reviewedReferenceCount: z.number(), reproductions: z.array(z.object({ fullRuntimeMatch: z.literal(true) })), audits: z.array(z.unknown()) })
    .parse(await json(`${evidence}/oracle-evidence-verification.json`));
  const replays = z.object({ passed: z.literal(true), replays: z.array(z.object({ exactInput: z.literal(true), exactResult: z.literal(true), actionable: z.literal(false) })),
    artifactChecks: z.array(z.object({ matches: z.literal(true) })) }).parse(await json(`${evidence}/phase2-exact-replays.json`));
  assert.equal(replays.replays.length, 3); assert.equal(oracle.reproductions.length, 6);
  const secretScan = z.object({ passed: z.literal(true), placeholderTemplateVerified: z.literal(true), filesScanned: z.number(), findings: z.array(z.never()) }).parse(await json(`${evidence}/secret-scan.json`));
  const links = z.object({ passed: z.literal(true), checks: z.array(z.object({ exists: z.literal(true) })) }).parse(await json(`${evidence}/documentation-links.json`));
  for (const name of ["phase1-evidence-integrity", "historical-regression", "monitoring-smoke", "oracle-smoke", "operations-smoke", "file-changes", "project-whitespace"]) passed.parse(await json(`${evidence}/${name}.json`));
  const smoke = z.object({ passed: z.literal(true), commandCount: z.literal(15), commands: z.array(z.object({ exitCode: z.number(), expectedExitCode: z.number() })) }).parse(await json(`${evidence}/operations-smoke.json`));
  assert.ok(smoke.commands.every(command => command.exitCode === command.expectedExitCode));
  const allFiles = [...await projectFiles()];
  assert.equal(allFiles.filter(path => /^evidence\/phase[1-4]\//.test(path)).length, 391);
  const documents = await documentationInputs(), documentation = documents.files;
  assert.equal(documents.sha256, finalization.documentationInputsSha256, "Documentation changed after finalization; repeat the local final checks.");
  for (const path of PHASE5_DOCUMENTS) assert.ok(documentation.some(file => file.path === path));
  const evidenceFiles = await bindings(allFiles.filter(path => path.startsWith(`${evidence}/`) && !selfOutputs.has(path)));
  return {
    format: 1, kind: "LOCAL_PHASE5_RELEASE_CANDIDATE", application: pkg, git: gitRevision(),
    runtime: { verified: VERIFIED_RUNTIME, actual: { node: process.version, sqlite: process.versions.sqlite, platform: process.platform, architecture: process.arch },
      compatibilityNote: "Package engines describe a broader compatibility range; only Node 24.14.1 / SQLite 3.51.2 was verified here." },
    schema: { current: MIGRATIONS.length, applicationId: APPLICATION_ID, migrationChecksums: MIGRATIONS.map((migration, index) => ({ version: index + 1, checksum: hashParts(migration) })),
      downgradeSupported: false, restorePolicy: "VERIFY_ISOLATED_COPY_THEN_SEPARATE_OPERATOR_APPROVAL" },
    configuration: { network: NETWORK, deployment: JSON.parse(stringify(DEPLOYMENT)) as unknown, defaults: parseMonitoringConfiguration(), secretValues: "OMITTED",
      environmentTemplate: ".env.example", allowedEnvironmentNames: ["WATCHDOG_TELEGRAM_BOT_TOKEN", "WATCHDOG_TELEGRAM_CHAT_ID", "WATCHDOG_DISCORD_WEBHOOK_URL"] },
    sourceInputs: inputs, build, documentation: { ...documents, requiredPhase5Documents: PHASE5_DOCUMENTS },
    verification: { startedAt: verification.startedAt, finishedAt: verification.finishedAt, commandsPassed: verification.results.length, commandsRequired: VERIFICATION_CHECKS.length,
      finalizationFinishedAt: finalization.finishedAt, finalizationCommandsPassed: finalization.results.length, tests, stability, operationalSmokeCommands: smoke.commandCount,
      dependencyVulnerabilities: audit.metadata.vulnerabilities, secrets: { filesScanned: secretScan.filesScanned, findings: 0, placeholderTemplateVerified: true }, documentationLinks: links.checks.length },
    preservation: { baselineSha256: originals.sha256, gapRegisterSha256: gap.sha256, archivedFiles: preservation.checks.length, phases: preservation.counts,
      exactPhase2Replays: replays.replays.length, phase2ArtifactHashes: replays.artifactChecks.length,
      sourceRuntimeLinks: sources.matches.length, archivedSourceHashes: sources.sourceFileHashes.length, oracleBundles: oracle.bundles.length,
      independentlyReconstructedRuntimes: oracle.reproductions.length, reviewedReferences: oracle.reviewedReferenceCount, oracleAuditDispositions: oracle.audits.length },
    evidence: { sha256: bindingHash(evidenceFiles), files: evidenceFiles, selfExcludedOutputs: [...selfOutputs].sort() },
    releaseDecision: { localVerificationPassed: true, productionApproval: false, deploymentPerformed: false, productionMonitoringStarted: false,
      realExternalNotifications: 0, signingOrBroadcasting: false, ...SAFETY_STATUS,
      hostAcceptanceOutstanding: ["TARGET_OS_AND_SUPERVISOR", "LOCAL_DURABLE_FILESYSTEM_AND_POWER_LOSS", "PERMISSIONS_AND_SECRET_INJECTION", "RESOURCE_LIMITS_AND_LOG_ROTATION",
        "REAL_NOTIFICATION_DELIVERY_WITH_SEPARATE_APPROVAL", "OFF_HOST_RESTORE_RPO_RTO", "REAL_DURATION_SOAK"] }
  };
}

const checkOnly = process.argv.slice(2).includes("--check");
if (process.argv.slice(2).some(arg => arg !== "--check")) throw new Error("Supported release option: --check.");
try {
  const collected = await collect();
  if (!checkOnly) {
    const text = stringify({ createdAt: new Date().toISOString(), ...collected }) + "\n";
    await writeFile(join(root, manifestPath), text);
    await writeFile(join(root, checksumPath), `${sha256(text)}  release-manifest.json\n`);
    console.log(`Local release manifest generated; ${collected.verification.commandsPassed} verified checks; production approval absent.`);
  } else {
    const bytes = await readFile(join(root, manifestPath)), manifest = z.object({ createdAt: z.iso.datetime() }).passthrough().parse(JSON.parse(bytes.toString("utf8")));
    const { createdAt, ...recorded } = manifest;
    assert.deepEqual(recorded, collected); assert.ok(createdAt >= collected.verification.finalizationFinishedAt);
    const manifestSha256 = sha256(bytes);
    assert.equal(await readFile(join(root, checksumPath), "utf8"), `${manifestSha256}  release-manifest.json\n`);
    const finalSecretScan = z.object({ passed: z.literal(true), filesScanned: z.number().int().positive(), ruleCount: z.number().int().positive(),
      placeholderTemplateVerified: z.literal(true), findings: z.array(z.never()) }).parse(JSON.parse(execFileSync(process.execPath,
      ["--import", "tsx", "scripts/check-secrets.ts", "--read-only"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 })));
    await writeFile(join(root, `${evidence}/release-manifest-check.json`), stringify({ checkedAt: new Date().toISOString(), passed: true, manifestSha256,
      sourceInputsSha256: collected.sourceInputs.sha256, buildSha256: collected.build.sha256, documentationSha256: collected.documentation.sha256,
      evidenceSha256: collected.evidence.sha256, boundEvidenceFiles: collected.evidence.files.length, requiredDocuments: PHASE5_DOCUMENTS.length,
      finalSecretScan: { command: "node --import tsx scripts/check-secrets.ts --read-only", ...finalSecretScan },
      productionApproval: false, productionReleaseReady: false, actionable: false }) + "\n");
    console.log(`Release manifest: PASS; source, build, documentation and ${collected.evidence.files.length} evidence files match; production release remains unapproved.`);
  }
} catch {
  if (checkOnly) await writeFile(join(root, `${evidence}/release-manifest-check.json`), stringify({ checkedAt: new Date().toISOString(), passed: false,
    error: "RELEASE_BINDING_OR_PREREQUISITE_FAILED", productionApproval: false, productionReleaseReady: false, actionable: false }) + "\n");
  console.error("Release manifest prerequisites or bindings failed. Re-run completed checks for the current inputs and inspect their sanitized reports.");
  process.exitCode = 1;
}
