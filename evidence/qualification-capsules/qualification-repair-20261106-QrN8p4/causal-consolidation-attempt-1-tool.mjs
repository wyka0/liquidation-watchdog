// Evidence-only causal consolidation. Retains the original failures and explicitly distinguishes controls from qualification.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const audit = dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash("sha256").update(bytes).digest("hex"), load = path => JSON.parse(readFileSync(path));
const lines = path => readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const before = load(join(audit, "original-failure-inspection.json")), timing = load(join(audit, "timing-analysis-unmodified-independent-v2-unmodified-loaded-v2.json"));
const osNegative = load(join(audit, "negative-control-independent-process-verification.json"));
const names = ["ipc-v1-negative-control", "unmodified-independent-v2", "unmodified-loaded-v2", "original-budget-latency-negative-control",
  "corrected-budget-latency-control", "corrected-teardown-deadline-negative-control"];
const controls = names.map(name => {
  const root = join(audit, name), summary = load(join(root, "summary.json")), tests = load(join(root, "tests.json"));
  const log = lines(join(root, "process-lifecycle.jsonl")), failure = tests.testResults.flatMap(file => file.assertionResults)
    .find(test => test.title.startsWith("fences a second process"));
  const removals = log.filter(record => record.event.startsWith("fixture_remove_"));
  const created = log.filter(record => record.event === "child_created");
  const children = created.map(record => ({ pid: record.childPid,
    openedSqliteConnections: log.filter(item => item.pid === record.childPid && item.event === "sqlite_open_done").length,
    explicitSqliteCloses: log.filter(item => item.pid === record.childPid && item.event === "sqlite_close_done").length,
    lastWorkspace: log.filter(item => item.pid === record.childPid && item.event === "chdir_done").at(-1)?.directory ?? null,
    exitAt: log.find(item => item.childPid === record.childPid && item.event === "child_exit")?.at ?? null,
    closeAt: log.find(item => item.childPid === record.childPid && item.event === "child_close")?.at ?? null,
    statusAtFirstRemoval: (() => { const removal = removals.find(item => item.event === "fixture_remove_call");
      const last = log.filter(item => item.childPid === record.childPid && typeof item.connected === "boolean"
        && (!removal || BigInt(item.hrNs) <= BigInt(removal.hrNs))).at(-1);
      return last ? { event: last.event, at: last.at, exitCode: last.exitCode ?? null, signalCode: last.signalCode ?? null, connected: last.connected ?? null } : null; })() }));
  return { name, role: "DIAGNOSTIC_CONTROL_NOT_FRESH_QUALIFICATION", status: summary.status,
    selectedAssertion: { title: failure.title, status: failure.status, durationMs: failure.duration, failureMessages: failure.failureMessages },
    accounting: { passed: tests.numPassedTests, failed: tests.numFailedTests, intentionallyUnselected: tests.numPendingTests },
    guard: summary.networkGuard, children, removalTimeline: removals, retainedFixtureRemnants: summary.cleanup.remainingFixtureDirectories,
    summarySha256: hash(readFileSync(join(root, "summary.json"))), lifecycleSha256: hash(readFileSync(join(root, "process-lifecycle.jsonl"))),
    sourceSha256: summary.tooling.testSource.sha256, tooling: summary.tooling,
    controlFlags: { boundedReadinessLatency: summary.safety.readinessMessagesIntentionallyDelayedForControl ?? false,
      originalAggregateDeadlineRestoredExternally: summary.safety.aggregateDeadlineIntentionallyLoweredForControl ?? false },
    allFailedArtifactsRetained: true };
});
const find = name => controls.find(control => control.name === name);
assert.equal(find("ipc-v1-negative-control").status, "FAIL"); assert.equal(find("ipc-v1-negative-control").selectedAssertion.status, "passed");
assert.equal(find("ipc-v1-negative-control").guard.blockedLocalIPC, 4);
const negative = find("original-budget-latency-negative-control"), positive = find("corrected-budget-latency-control"), deadline = find("corrected-teardown-deadline-negative-control");
assert.equal(negative.accounting.failed, 1); assert.equal(negative.status, "FAIL");
assert.ok(negative.selectedAssertion.failureMessages.some(message => message.includes("Test timed out in 40000ms.")));
assert.ok(negative.selectedAssertion.failureMessages.some(message => message.includes("EPERM")));
assert.ok(negative.removalTimeline.some(record => record.event === "fixture_remove_error" && record.code === "EPERM"));
assert.equal(negative.children[1].statusAtFirstRemoval.connected, true); assert.equal(negative.children[1].openedSqliteConnections, 5);
assert.equal(positive.status, "PASS"); assert.equal(positive.accounting.failed, 0); assert.ok(positive.selectedAssertion.durationMs > 40000);
assert.equal(deadline.status, "FAIL"); assert.equal(deadline.accounting.failed, 1);
assert.equal(deadline.selectedAssertion.failureMessages.length, 1); assert.ok(deadline.selectedAssertion.failureMessages[0].includes("Test timed out in 40000ms."));
assert.ok(!deadline.selectedAssertion.failureMessages.some(message => message.includes("EPERM")));
assert.ok(!deadline.removalTimeline.some(record => record.event === "fixture_remove_error"));
assert.ok(deadline.children.every(child => child.closeAt !== null)); assert.equal(deadline.retainedFixtureRemnants.length, 0);
assert.equal(osNegative.status, "PASS");
assert.ok([negative, positive, deadline].every(control => control.guard.sha256 === "c20447118ed79039c832d6fdd171794659fcd905654e805adcd48ab67c614da6"
  && control.guard.demonstratedRemoteAttempts === 0 && control.guard.blockedRecords === 0));

const result = { schemaVersion: 1, status: "REPRODUCED_CAUSAL_MECHANISM_WITH_EXPLICIT_HISTORICAL_LIMITS", analyzedAt: new Date().toISOString(),
  rootCause: ["The forced-recovery test budgets one aggregate 40000ms deadline for two sequential child startup/readiness lifecycles, despite each existing child having its own 30000ms bound and substantial import/workspace startup cost.",
    "Vitest's timeout rejects the test promise without waiting for its asynchronous body/finally to settle. Original synchronous afterEach removes the fixture immediately; it does not independently stop and await every child.",
    "A live resumed child changes cwd into the fixture workspace and keeps SQLite ownership/database handles. Deleting that Windows child-owned directory before close produces EPERM.",
    "Original stop() also returns on exitCode/signalCode, although exit can precede stdio/IPC close; this is a structurally unsafe cleanup shortcut, not a separately proven historical trigger."],
  historicalEvidence: { full: before.originalFull, focused: before.originalFocused,
    originalFailureDatabase: { sourceSha256: before.retainedLeftover.files.find(file => file.path === "storage/watchdog.sqlite").sha256,
      lastWriteAt: before.retainedLeftover.files.find(file => file.path === "storage/watchdog.sqlite").modifiedAt,
      copiedReadOnlyInspection: before.retainedLeftover.databases.find(file => file.path === "storage/watchdog.sqlite"), preserved: true },
    originalGuard: { records: before.originalGuard.records, blockedRecords: before.originalGuard.blockedRecords,
      blockedLocalIPC: before.originalGuard.blockedLocalIPC.length, demonstratedNonIpcBlocks: 0,
      limitation: before.originalGuard.limitation }, timingAnalysisSha256: hash(readFileSync(join(audit, "timing-analysis-unmodified-independent-v2-unmodified-loaded-v2.json"))) },
  measuredUnmodifiedTimingControls: timing.controls ?? timing.runs ?? timing,
  controls, negativeControlIndependentOsObservation: { status: osNegative.status, observedAt: osNegative.inspectedAt,
    recordedChildPids: osNegative.recordedChildPids, noPhase8FixtureRemains: osNegative.conclusions.noPhase8FixtureRemains },
  pairedControlConclusions: { originalBudgetAndTeardownReproduceTimeoutAndEPERM: true,
    sameGuardAndPermittedChildHorizonsWithCorrectedBudgetCompleteAbove40000ms: true,
    restored40000msDeadlineStillFailsWithoutEPERMWithCorrectedTeardown: true,
    noSuppressedFailureOrCleanupAssertion: true, readinessControlsDoNotQualifyProductionOrRuntimeSuite: true },
  smallestCorrection: { onlyRepositoryFile: "test/runtime-process.test.ts", aggregateBudgetMs: 70000,
    budgetProof: "2 * unchanged 30000ms child bounds + existing normal 10000ms assertion allowance; supported by original 40153.113ms failure, 36628.4016ms focused pass, startup slowdown under controlled load, and paired bounded-latency control.",
    cleanup: "Track spawn-time close promises for every child; await close even after exit; independently reap in afterEach; remove directory registrations before awaiting cleanup to prohibit late child creation; surface child errors after close; assert directory removal.",
    unchanged: ["four original tests/titles", "12 original assertion chains", "3000ms graceful signal assertion", "30000ms runtime child limit",
      "20000ms import child limit", "25000ms helper hard limit after import", "application/helper/assurance code", "V2 local-IPC guard", "default maxWorkers=2"] },
  limits: ["Original full-run logs have no parent child-lifecycle timestamps or exact host scheduling metrics. The original per-child timeline, precise resource-handle inventory and quantitative V1 IPC effect cannot be reconstructed.",
    "Controlled compiler/load runs demonstrate startup sensitivity, not the exact original host load. Their later green selected result does not replace the original failed full suite.",
    "The negative-control worker lost later resumed-child exit/close events. Their absence is not invented; independent CIM observation proves recorded PIDs absent afterward, without assigning the lost exit reason/time.",
    "Windows file ownership is inferred from observed cwd, open SQLite connections, live connected child, removal timing and paired cleanup controls; no exhaustive OS handle debugger was used."],
  decision: { testMechanismCorrectedAndFreshQualificationReportedSeparately: true, production: "NOT_ACCEPTED_NO_GO", realMonitor: "STOPPED", furtherOperationsAuthorized: false } };
writeFileSync(join(audit, "causal-analysis.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: result.status, rootCause: result.rootCause, controls: controls.map(control => ({ name: control.name,
  status: control.status, selectedAssertion: control.selectedAssertion.status, durationMs: control.selectedAssertion.durationMs,
  failures: control.selectedAssertion.failureMessages.length, falseLocalIpcBlocks: control.guard.blockedLocalIPC })),
  pairedControlConclusions: result.pairedControlConclusions, smallestCorrection: result.smallestCorrection, limits: result.limits }, null, 2));
