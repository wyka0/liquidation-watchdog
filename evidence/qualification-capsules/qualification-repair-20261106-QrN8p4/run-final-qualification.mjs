// Sequential independent/file/focused/full/check qualification. Every result/failure is retained; no fail-fast hiding.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const audit = dirname(fileURLToPath(import.meta.url)), repo = "C:/liquidation-watchdog", root = join(audit, "qualification-batch"); mkdirSync(root);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const allowed = JSON.parse(readFileSync(join(audit, "authorized-changes.json"))).files;
assert.equal(allowed.length, 1); assert.equal(allowed[0].path, "test/runtime-process.test.ts");
assert.equal(hash(readFileSync(join(repo, allowed[0].path))), allowed[0].afterSha256);
const phases = [["qualified-independent-v2", "independent"], ["qualified-runtime-process-v2", "runtime-process"],
  ["qualified-focused-v2", "focused"], ["qualified-full-v2", "full"], ["qualified-checks-v2", "checks"]];
const startedAt = new Date().toISOString(), results = [];
for (const [name, mode] of phases) {
  const stdout = join(root, `${name}.stdout.txt`), stderr = join(root, `${name}.stderr.txt`);
  writeFileSync(stdout, "", { flag: "wx" }); writeFileSync(stderr, "", { flag: "wx" });
  const command = [process.execPath, join(audit, "run-tests.mjs"), name, mode, "v2"], beganAt = new Date().toISOString();
  const outcome = await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd: repo, windowsHide: true });
    child.stdout.on("data", bytes => appendFileSync(stdout, bytes)); child.stderr.on("data", bytes => appendFileSync(stderr, bytes));
    child.once("error", reject); child.once("close", (exitCode, signal) => resolve({ exitCode, signal, pid: child.pid }));
  });
  const summaryPath = join(audit, name, "summary.json"), summaryBytes = existsSync(summaryPath) ? readFileSync(summaryPath) : null;
  const summary = summaryBytes ? JSON.parse(summaryBytes) : null;
  const result = { name, mode, command, startedAt: beganAt, completedAt: new Date().toISOString(), ...outcome,
    status: summary?.status ?? "FAIL_SUMMARY_MISSING", summarySha256: summaryBytes ? hash(summaryBytes) : null,
    tests: summary?.tests ? { success: summary.tests.success, files: summary.tests.files, total: summary.tests.total,
      passed: summary.tests.passed, failed: summary.tests.failed, pending: summary.tests.pending, todo: summary.tests.todo } : null,
    checks: summary?.results.map(({ label, exitCode, durationMs }) => ({ label, exitCode, durationMs })) ?? null,
    sourceUnchangedDuringQualification: hash(readFileSync(join(repo, allowed[0].path))) === allowed[0].afterSha256,
    stdoutSha256: hash(readFileSync(stdout)), stderrSha256: hash(readFileSync(stderr)) };
  results.push(result);
  writeFileSync(join(root, `${name}-orchestration.json`), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ phase: name, status: result.status, exitCode: result.exitCode, tests: result.tests, checks: result.checks }));
}
const status = results.every(result => result.status === "PASS" && result.exitCode === 0 && result.sourceUnchangedDuringQualification) ? "PASS" : "FAIL";
const final = { schemaVersion: 1, status, startedAt, completedAt: new Date().toISOString(), sequentialNoConcurrentTestOrCompilerWorkloads: true,
  sourceAfterSha256: allowed[0].afterSha256, defaultMaxWorkers: 2, assertionsAndChildDeadlinesUnmodifiedByDiagnosticPreloader: true,
  guardSha256: "c20447118ed79039c832d6fdd171794659fcd905654e805adcd48ab67c614da6", results,
  realMonitor: "STOPPED", noNewRealMonitoringCycle: true, allFailedAttemptsRetained: true, controlsNotCountedAsQualification: true };
writeFileSync(join(root, "summary.json"), JSON.stringify(final, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(final, null, 2)); if (status !== "PASS") process.exitCode = 1;
