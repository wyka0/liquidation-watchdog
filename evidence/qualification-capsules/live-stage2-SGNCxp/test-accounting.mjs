// Offline accounting of the original full-suite run and the separately retained focused rerun.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const audit = dirname(fileURLToPath(import.meta.url));
const bytes = name => readFileSync(join(audit, name));
const json = name => JSON.parse(bytes(name).toString("utf8"));
const hash = content => createHash("sha256").update(content).digest("hex");
const records = name => bytes(name).toString("utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
const full = json("offline-test-results.json"), unit = json("unit-tests.json"), targeted = json("targeted-runtime-test-results.json");
for (const command of [...full.checks, targeted.command]) {
  for (const stream of [command.stdout, command.stderr]) {
    assert.equal(bytes(stream.file).length, stream.bytes); assert.equal(hash(bytes(stream.file)), stream.sha256);
  }
}
const assertions = unit.testResults.flatMap(file => file.assertionResults.map(test => ({ file: file.name, ...test })));
const passed = assertions.filter(test => test.status === "passed"), failed = assertions.filter(test => test.status === "failed");
assert.equal(assertions.length, unit.numTotalTests); assert.equal(passed.length, unit.numPassedTests); assert.equal(failed.length, unit.numFailedTests);
assert.equal(unit.testResults.length, full.unit.files); assert.equal(unit.numTotalTests, full.unit.total);
assert.equal(full.unit.passed, 1006); assert.equal(full.unit.failed, 1); assert.equal(full.unit.pending, 0); assert.equal(full.unit.todo, 0);
assert.equal(full.status, "FAIL"); assert.equal(full.checks.find(command => command.name === "unit-tests").exitCode, 1);
for (const name of ["typecheck", "lint", "build"]) assert.equal(full.checks.find(command => command.name === name).exitCode, 0);
const originalRequests = records("unit-network-guard.jsonl");
const blocked = originalRequests.filter(record => record.outcome === "EXTERNAL_BLOCKED");
const blockedIpc = blocked.filter(record => record.host === "LOCAL_IPC");
const blockedNonIpc = blocked.filter(record => record.host !== "LOCAL_IPC");
assert.equal(originalRequests.length, full.networkGuard.records); assert.equal(blocked.length, full.networkGuard.actualExternalAttempts);
assert.equal(blockedIpc.length, 18); assert.equal(blockedNonIpc.length, 0);
const rerunRequests = records("runtime-rerun-network-guard.jsonl");
assert.equal(rerunRequests.length, targeted.networkGuard.records);
assert.equal(rerunRequests.filter(record => record.outcome === "EXTERNAL_BLOCKED").length, targeted.networkGuard.actualExternalAttempts);
const result = { schemaVersion: 1, status: "PASS_ACCURATE_ACCOUNTING_FULL_SUITE_STILL_FAILED", completedAt: new Date().toISOString(),
  originalFullSuite: { status: "FAIL", files: unit.testResults.length, total: assertions.length, passed: passed.length, failed: failed.length,
    pending: unit.numPendingTests, todo: unit.numTodoTests, exitCode: 1, unitJsonSha256: hash(bytes("unit-tests.json")),
    failures: failed.map(test => ({ file: test.file, fullName: test.fullName, failureMessages: test.failureMessages })) },
  checks: full.checks.map(command => ({ name: command.name, exitCode: command.exitCode, status: command.exitCode === 0 ? "PASS" : "FAIL" })),
  perFile: unit.testResults.map(file => ({ file: file.name, status: file.status, total: file.assertionResults.length,
    passed: file.assertionResults.filter(test => test.status === "passed").length,
    failed: file.assertionResults.filter(test => test.status === "failed").length })),
  originalGuard: { records: originalRequests.length, blockedRecords: blocked.length, blockedIpcPathRecords: blockedIpc.length,
    blockedNonIpcHostOrFetchRecords: blockedNonIpc.length, remoteAccessPermitted: false,
    misleadingOriginalField: "offline-test-results.json networkGuard.actualExternalAttempts=18 counts blocked LOCAL_IPC paths, not 18 demonstrated external requests.",
    limitation: "V1 omitted IPC paths and rejected all UNC-looking prefixes, including local Windows named pipes. Exact original paths cannot be recovered from this log; tsx source uses local named pipes. No causal claim is made that this alone explains the test timeout or EPERM." },
  focusedRerun: { status: targeted.status, ...targeted.unit, guard: targeted.networkGuard, evidenceClass: targeted.evidenceClass,
    resultSha256: hash(bytes("targeted-runtime-test-results.json")), doesNotReplaceFailedFullSuite: true },
  currentAllGreenFullSuiteQualified: false,
  historicalResultsNotReusedAsFresh: ["1007/1007 prior submission", "61/61 native PostgreSQL", "5/5 prior focused", "1340-file prior secret scan", "547-link prior documentation check"],
  scope: "Offline unit/mocks/loopback and process fixtures only; no live chain, external notifications, Neon, deployment or scheduler activation." };
writeFileSync(join(audit, "test-accounting.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: result.status, originalFullSuite: { ...result.originalFullSuite, failures: result.originalFullSuite.failures.map(failure => ({ file: failure.file, fullName: failure.fullName })) },
  originalGuard: result.originalGuard, focusedRerun: result.focusedRerun, currentAllGreenFullSuiteQualified: false }, null, 2));
