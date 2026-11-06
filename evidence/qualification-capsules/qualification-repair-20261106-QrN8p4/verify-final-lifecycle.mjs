// Post-qualification evidence/OS inspection only. Does not run tests, import application code or start monitoring.
// The Stage 2 SQLite source is never opened: inspect a byte-identical separate read-only copy instead.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const audit = dirname(fileURLToPath(import.meta.url)), repo = "C:/liquidation-watchdog";
const stage2 = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/live-stage2-SGNCxp";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const load = path => JSON.parse(readFileSync(path)), lines = path => readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const norm = path => resolve(path).replaceAll("\\", "/").toLowerCase();
const within = (path, directory) => norm(path).startsWith(`${norm(directory)}/`);
const atOrBefore = (record, time) => BigInt(record.hrNs) <= BigInt(time.hrNs);
const differenceMs = (a, b) => a && b ? Number(BigInt(b.hrNs) - BigInt(a.hrNs)) / 1e6 : null;
const startedAt = new Date().toISOString(), checks = [];
const check = (id, pass, detail) => { checks.push({ id, status: pass ? "PASS" : "FAIL", detail }); return pass; };
const batch = load(join(audit, "qualification-batch/summary.json"));
const original = load(join(stage2, "unit-tests.json"));
const inventory = results => results.testResults.flatMap(file => file.assertionResults.map(test =>
  `${norm(file.name)}|${test.fullName ?? [...(test.ancestorTitles ?? []), test.title].join(" ")}`)).sort();
check("BATCH_ALL_PHASES_PASS", batch.status === "PASS" && batch.results.length === 5 && batch.results.every(phase => phase.exitCode === 0 && phase.status === "PASS"), batch.results.map(phase => phase.name));

const phases = [], allRecordedPids = new Set();
for (const phase of batch.results) {
  const root = join(audit, phase.name), summaryBytes = readFileSync(join(root, "summary.json")), summary = JSON.parse(summaryBytes);
  const log = lines(join(root, "process-lifecycle.jsonl")), network = lines(join(root, "network-guard.jsonl"));
  const fixtureDirectories = readdirSync(join(root, "temp/opencode"));
  check(`${phase.name}_SUMMARY_HASH`, hash(summaryBytes) === phase.summarySha256, phase.summarySha256);
  for (const item of [...summary.results.flatMap(result => [result.stdout, result.stderr]), ...Object.values(summary.logs), ...Object.values(summary.tooling)]) {
    check(`${phase.name}_ARTIFACT_${item.file.split(/[\\/]/).at(-1)}`, hash(readFileSync(item.file)) === item.sha256, item.sha256);
  }
  for (const result of summary.results) allRecordedPids.add(result.pid);
  for (const record of log) allRecordedPids.add(record.pid);
  const children = [];
  for (const created of log.filter(record => record.event === "child_created")) {
    allRecordedPids.add(created.childPid);
    const spawn = log.filter(record => record.pid === created.pid && record.event === "child_spawn_call" && atOrBefore(record, created)).at(-1);
    const kind = spawn?.args.some(arg => arg.endsWith("phase8-runtime.ts")) ? "RUNTIME_WITH_IPC" : "IMPORT_WITHOUT_IPC";
    const helperIndex = spawn?.args.findIndex(arg => /phase8-(runtime|import)\.ts$/.test(arg)) ?? -1;
    const directory = kind === "RUNTIME_WITH_IPC" ? spawn?.args[helperIndex + 1] : null;
    const own = log.filter(record => record.pid === created.childPid);
    const exit = log.find(record => record.event === "child_exit" && record.childPid === created.childPid);
    const close = log.find(record => record.event === "child_close" && record.childPid === created.childPid);
    const disconnect = log.find(record => record.event === "child_disconnected" && record.childPid === created.childPid);
    const errors = log.filter(record => record.event === "child_error" && record.childPid === created.childPid);
    const signal = log.find(record => record.event === "parent_ipc_send" && record.childPid === created.childPid && /^SIG(?:INT|TERM)$/.test(record.value));
    const ready = log.find(record => record.event === "parent_ipc_message" && record.childPid === created.childPid && ["idle", "reading"].includes(record.value));
    const opens = own.filter(record => record.event === "sqlite_open_done"), closes = own.filter(record => record.event === "sqlite_close_done");
    const forced = close?.signal === "SIGKILL", probes = own.filter(record => record.event === "workspace_probe_open");
    const sqlBalance = new Map();
    for (const record of own.filter(record => ["sqlite_open_done", "sqlite_close_done"].includes(record.event))) {
      const key = norm(record.path); sqlBalance.set(key, (sqlBalance.get(key) ?? 0) + (record.event === "sqlite_open_done" ? 1 : -1));
    }
    const outstandingAtDeath = [...sqlBalance].filter(([, count]) => count > 0).map(([path, count]) => ({ path, count }));
    const processExit = own.filter(record => record.event === "process_exit").at(-1);
    const childPass = check(`${phase.name}_CHILD_${created.childPid}`, Boolean(spawn && exit && close && atOrBefore(exit, close)
      && close.connected === false && close.stdoutDestroyed === true && close.stderrDestroyed === true && errors.length === 0
      && (kind === "IMPORT_WITHOUT_IPC" || (disconnect && atOrBefore(disconnect, close)))
      && (forced || (close.code === 0 && opens.length === closes.length && outstandingAtDeath.length === 0))
      && probes.every(probe => own.some(record => record.event === "workspace_probe_closed" && record.path === probe.path))
      && (kind !== "RUNTIME_WITH_IPC" || forced || own.some(record => record.event === "chdir_done" && norm(record.directory) === norm(repo)))),
    { kind, openedDatabases: opens.length, explicitCloses: closes.length, forcedOSDeath: forced, ipcStateAtClose: close?.connected ?? null });
    children.push({ pid: created.childPid, parentPid: created.pid, status: childPass ? "PASS" : "FAIL", kind, directory,
      mode: kind === "RUNTIME_WITH_IPC" ? spawn.args[helperIndex + 2] : null, unchangedSpawnTimeoutMs: spawn?.timeout ?? null,
      spawnAt: spawn?.at ?? null, readinessAt: ready?.at ?? null, readinessEvent: ready?.value ?? null,
      spawnToReadinessMs: differenceMs(spawn, ready), signal: signal?.value ?? null, signalToCloseMs: differenceMs(signal, close),
      exitAt: exit?.at ?? null, closeAt: close?.at ?? null, exitBeforeClose: Boolean(exit && close && atOrBefore(exit, close)),
      ipc: { expected: kind === "RUNTIME_WITH_IPC", disconnectEventObserved: Boolean(disconnect), disconnectedAtClose: close?.connected === false,
        limitation: kind === "IMPORT_WITHOUT_IPC" ? "Import child has no IPC channel; no disconnect event is expected." : null },
      stdio: { stdoutDestroyedAtClose: close?.stdoutDestroyed === true, stderrDestroyedAtClose: close?.stderrDestroyed === true },
      databaseResources: { openedConnections: opens.length, explicitCloseCallsCompleted: closes.length, outstandingAtDeath,
        release: forced ? "OS_RELEASE_AFTER_ACTUAL_SIGKILL_CONFIRMED_BY_CLOSE_REOPEN_AND_REMOVAL" : "ALL_OBSERVED_CONNECTIONS_EXPLICITLY_CLOSED",
        paths: [...new Set(opens.map(record => record.path))] },
      workspaceProbes: { opened: probes.length, closed: own.filter(record => record.event === "workspace_probe_closed").length },
      processExitHandleClasses: processExit?.handles ?? null, closeCallbackParentHandles: close?.handles ?? null,
      childErrors: errors, forcedOSDeath: forced });
  }
  const removals = [];
  for (const removal of log.filter(record => record.event === "fixture_remove_call")) {
    const related = children.filter(child => child.directory && norm(child.directory) === norm(removal.path));
    if (!related.length) continue; // Other full-suite fixture cleanup is retained in the raw trace and checked by its tests.
    const removed = log.find(record => record.event === "fixture_remove_done" && record.path === removal.path && atOrBefore(removal, record));
    const activeSql = new Map();
    for (const record of log.filter(record => ["sqlite_open_done", "sqlite_close_done"].includes(record.event) && within(record.path, removal.path) && atOrBefore(record, removal))) {
      const key = `${record.pid}|${norm(record.path)}`, current = activeSql.get(key) ?? { pid: record.pid, path: record.path, count: 0 };
      current.count += record.event === "sqlite_open_done" ? 1 : -1; activeSql.set(key, current);
    }
    const unreleased = [...activeSql.values()].filter(item => item.count > 0 && !log.some(record =>
      ((record.event === "child_close" && record.childPid === item.pid) || (record.event === "process_exit" && record.pid === item.pid)) && atOrBefore(record, removal)));
    const closedBefore = related.every(child => log.some(record => record.event === "child_close" && record.childPid === child.pid && atOrBefore(record, removal)));
    const pass = check(`${phase.name}_REMOVE_${removal.path.split(/[\\/]/).at(-1)}`, Boolean(removed && removed.exists === false && closedBefore && unreleased.length === 0 && !existsSync(removal.path)),
      { childPids: related.map(child => child.pid), childrenClosedBeforeRemoval: closedBefore, unreleasedObservedSqliteConnections: unreleased });
    removals.push({ path: removal.path, status: pass ? "PASS" : "FAIL", removalAt: removal.at, removedAt: removed?.at ?? null,
      childrenClosedBeforeRemoval: closedBefore, childPids: related.map(child => child.pid), unreleasedObservedSqliteConnections: unreleased,
      closeToRemovalMs: related.map(child => ({ pid: child.pid, ms: differenceMs(log.find(record => record.event === "child_close" && record.childPid === child.pid), removal) })),
      pathStillExists: existsSync(removal.path) });
  }
  check(`${phase.name}_NO_FIXTURE_REMNANTS_OR_CLEANUP_ERRORS`, fixtureDirectories.length === 0 && summary.cleanup.removalErrors.length === 0
    && summary.cleanup.pathsStillExist.length === 0 && log.every(record => record.event !== "fixture_remove_error"), fixtureDirectories);
  check(`${phase.name}_NO_REMOTE_ATTEMPTS`, network.every(record => record.outcome !== "EXTERNAL_BLOCKED") && summary.networkGuard.demonstratedRemoteAttempts === 0,
    { records: network.length, allowedLocalNamedPipes: summary.networkGuard.allowedLocalNamedPipes });
  if (phase.mode !== "checks") {
    const tests = load(join(root, "tests.json")), statuses = tests.testResults.flatMap(file => file.assertionResults.map(test => test.status));
    const intentionallyUnselected = statuses.filter(status => status !== "passed").length;
    check(`${phase.name}_EXACT_TEST_ACCOUNTING`, phase.mode === "independent" ? statuses.filter(status => status === "passed").length === 1 && intentionallyUnselected === 3
      : statuses.every(status => status === "passed"), { total: statuses.length, intentionallyUnselected });
    if (phase.mode === "full") check("FULL_ORIGINAL_1007_TEST_INVENTORY_PRESERVED", JSON.stringify(inventory(tests)) === JSON.stringify(inventory(original)),
      { oldFiles: original.testResults.length, newFiles: tests.testResults.length, oldTests: original.numTotalTests, newTests: tests.numTotalTests });
  }
  phases.push({ name: phase.name, status: summary.status, network: summary.networkGuard, children, runtimeFixtureRemovals: removals,
    allLoggedFixtureRemovalAttempts: summary.cleanup.removalAttempts, finalFixtureDirectories: fixtureDirectories,
    retainedTemporaryTopLevelEntries: readdirSync(join(root, "temp")), rawLifecycleSha256: summary.logs.lifecycle.sha256 });
}

const pidNumbers = [...allRecordedPids].filter(Number.isInteger).sort((a, b) => a - b);
const ps = `$recorded = @(${pidNumbers.join(",")}); $self = ${process.pid}; $all = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"); `
  + `$relevant = @($all | Where-Object { $_.ProcessId -ne $self -and $_.CommandLine -match 'phase8-runtime|phase8-import|phase5-child|live-monitor\\.m[tj]s|live-stage2-SGNCxp|liquidation-watchdog|qualification-repair-20261106-QrN8p4|(?:dist|src)[/\\\\](?:postgres-service|service|cli)\\.[tj]s' } `
  + `| Select-Object ProcessId,ParentProcessId,CreationDate,@{Name='Class';Expression={if ($_.CommandLine -match 'phase8-') {'PHASE8_FIXTURE'} elseif ($_.CommandLine -match 'vitest') {'VITEST'} else {'RELEVANT_NODE_REQUIRES_REVIEW_DO_NOT_TOUCH'}}}); `
  + `$present = @($all | Where-Object { $recorded -contains $_.ProcessId } | Select-Object ProcessId,ParentProcessId,CreationDate,@{Name='RelatedCommand';Expression={ $_.CommandLine -match 'phase8-runtime|phase8-import|liquidation-watchdog|qualification-repair-20261106-QrN8p4|vitest' }}); `
  + `ConvertTo-Json -InputObject @{ observedAtUtc=[DateTime]::UtcNow.ToString('o'); relevantNodeProcesses=$relevant; recordedPidsPresent=$present; totalNodeProcesses=$all.Count; inspectorPid=$self } -Depth 5`;
const osCommand = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8", windowsHide: true });
assert.equal(osCommand.status, 0);
const os = JSON.parse(osCommand.stdout);
check("FINAL_OS_NO_RELEVANT_FIXTURE_TEST_OR_REAL_MONITOR_PROCESS", os.relevantNodeProcesses.length === 0
  && os.recordedPidsPresent.every(item => !item.RelatedCommand), os);

const baseline = load(join(audit, "baseline.json")), source = join(stage2, "watchdog.sqlite");
const expected = baseline.priorStage2.files.find(file => file.path === "watchdog.sqlite"), sourceBytes = readFileSync(source);
assert.ok(expected); check("STAGE2_SOURCE_DATABASE_HASH_BEFORE", hash(sourceBytes) === expected.sha256, expected.sha256);
const copies = join(audit, "final-read-only-store-copies"); mkdirSync(copies);
const copy = join(copies, "stage2-watchdog.sqlite"); copyFileSync(source, copy);
const copiedHash = hash(readFileSync(copy)); check("STAGE2_DATABASE_COPY_IDENTICAL", copiedHash === expected.sha256, copiedHash);
let stored;
const db = new DatabaseSync(copy, { readOnly: true, allowExtension: false });
try {
  db.exec("PRAGMA query_only=ON");
  stored = { quickCheck: db.prepare("PRAGMA quick_check").all(), schemaVersion: db.prepare("PRAGMA user_version").get().user_version,
    cycles: db.prepare("SELECT id,status,accepted,block_number,block_hash FROM cycles").all(),
    runtimes: db.prepare("SELECT json_extract(runtime_json,'$.status') AS status FROM worker_runtime").all(),
    deliveries: db.prepare("SELECT channel,status,attempts,ambiguous FROM deliveries ORDER BY id").all(),
    actions: db.prepare("SELECT json_extract(alert_json,'$.code') AS code,json_extract(alert_json,'$.suggestedAction.type') AS type,json_extract(alert_json,'$.suggestedAction.actionable') AS actionable,json_array_length(json_extract(alert_json,'$.suggestedAction.financialOptions')) AS financialOptions FROM alerts ORDER BY id").all(),
    unfinishedCycles: db.prepare("SELECT count(*) AS count FROM cycles WHERE status IN ('RUNNING','PERSISTED')").get().count,
    observations: db.prepare("SELECT count(*) AS count FROM cycles WHERE observation_json IS NOT NULL").get().count };
} finally { db.close(); }
check("STAGE2_STORED_HISTORY_STILL_STOPPED_NO_NEW_CYCLE_OR_DELIVERY", stored.quickCheck.every(row => row.quick_check === "ok")
  && stored.cycles.length === 1 && stored.cycles[0].status === "COMPLETED" && stored.observations === 1
  && stored.runtimes.length === 1 && stored.runtimes[0].status === "STOPPED" && stored.unfinishedCycles === 0
  && stored.deliveries.length === 3 && stored.deliveries.every(item => item.channel === "console" && item.status === "DELIVERED" && item.attempts === 1 && item.ambiguous === 0)
  && stored.actions.length === 3 && stored.actions.every(item => item.type === "NON_FINANCIAL" && item.actionable === 0 && item.financialOptions === 0), stored);
check("STAGE2_SOURCE_AND_READONLY_COPY_UNCHANGED_AFTER_INSPECTION", hash(readFileSync(source)) === expected.sha256 && hash(readFileSync(copy)) === copiedHash,
  { sourceHash: expected.sha256, copyHash: copiedHash });

const result = { schemaVersion: 1, status: checks.every(item => item.status === "PASS") ? "PASS" : "FAIL", startedAt, completedAt: new Date().toISOString(),
  checks, phases, osObservation: os, recordedPids: pidNumbers,
  realStage2StoreInspection: { source, sourceSha256: expected.sha256, readOnlyCopy: copy, copiedSha256: copiedHash, closeCompleted: true, stored },
  limits: ["Observed _getActiveHandles classes are diagnostics, not an exhaustive OS handle inventory; the close callback may still display a retiring parent ChildProcess handle.",
    "No IPC disconnect event is expected for the import-only child. Each runtime child has an observed disconnect plus destroyed stdout/stderr at close.",
    "SIGKILL does not execute application finally or SQLite close; resource release is established by actual process close, successful original lock/recovery assertions, directory removal and final OS absence.",
    "The OS observation is point-in-time. Unrelated user/harness processes are not terminated or modified, and no command line or credential is printed.",
    "Evidence/output directories and tool caches are deliberately retained; qualified runtime fixture directories are removed, while historical failure remnants stay preserved."],
  safety: { noApplicationImportsOrMonitoringCycle: true, noNetworkRequest: true, noOriginalDatabaseOpened: true, readOnlyCopiedDatabaseExplicitlyClosed: true,
    noProcessTermination: true, noRepositoryWrite: true, noExternalNotificationTransactionOrWalletOperation: true, realMonitor: "STOPPED" } };
writeFileSync(join(audit, "final-lifecycle-verification.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: result.status, checkedGroups: checks.length, failures: checks.filter(item => item.status === "FAIL"),
  phases: phases.map(phase => ({ name: phase.name, children: phase.children.length, runtimeFixtureRemovals: phase.runtimeFixtureRemovals.length,
    gracefulSignalToCloseMs: phase.children.filter(child => child.signal).map(child => ({ pid: child.pid, signal: child.signal, ms: child.signalToCloseMs })),
    externalAttempts: phase.network.demonstratedRemoteAttempts, fixtureRemnants: phase.finalFixtureDirectories.length })),
  osObservation: os, storedRuntime: stored.runtimes, storedCycles: stored.cycles.length, storedDelivered: stored.deliveries.length }, null, 2));
if (result.status !== "PASS") process.exitCode = 1;
