// All commands/output/cache/temp files stay outside the repository. Offline synthetic tests only.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = "C:/liquidation-watchdog", audit = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2], mode = process.argv[3] ?? "independent", guardVersion = process.argv[4] ?? "v2";
assert.match(name ?? "", /^[a-z0-9-]+$/); assert.ok(["independent", "focused", "full", "loaded-independent", "latency-independent", "checks"].includes(mode));
const runRoot = join(audit, name); mkdirSync(runRoot); const temporary = join(runRoot, "temp"); mkdirSync(join(temporary, "opencode"), { recursive: true });
const networkLog = join(runRoot, "network-guard.jsonl"), processLog = join(runRoot, "process-lifecycle.jsonl");
writeFileSync(networkLog, "", { flag: "wx" }); writeFileSync(processLog, "", { flag: "wx" });
copyFileSync(join(audit, "process-diagnostics.cjs"), join(runRoot, "diagnostic-preloader-used.cjs"));
copyFileSync(fileURLToPath(import.meta.url), join(runRoot, "test-runner-used.mjs"));
copyFileSync(join(repo, "test/runtime-process.test.ts"), join(runRoot, "runtime-process-test-used.ts"));
copyFileSync(join(repo, "test/helpers/phase8-runtime.ts"), join(runRoot, "runtime-helper-used.ts"));
if (mode === "latency-independent") copyFileSync(join(audit, "bounded-lifecycle-latency-control.cjs"), join(runRoot, "latency-preloader-used.cjs"));
const guard = join(audit, guardVersion === "v1" ? "negative-control-network-guard-v1.cjs" : "test-network-guard-v2.cjs");
const guardHash = createHash("sha256").update(readFileSync(guard)).digest("hex");
if (guardVersion === "v2") assert.equal(guardHash, "c20447118ed79039c832d6fdd171794659fcd905654e805adcd48ab67c614da6");
const env = { ...process.env, TEMP: temporary, TMP: temporary, NODE_DISABLE_COMPILE_CACHE: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0",
  WATCHDOG_QUALIFICATION_NETWORK_LOG: networkLog, WATCHDOG_REPAIR_PROCESS_LOG: processLog,
  ...(mode === "latency-independent" ? { WATCHDOG_BOUNDED_LIFECYCLE_EVENT_LATENCY_MS: "20000" } : {}),
  NODE_OPTIONS: `--require=${guard.replaceAll("\\", "/")} --require=${join(audit, "process-diagnostics.cjs").replaceAll("\\", "/")}`
    + (mode === "latency-independent" ? ` --require=${join(audit, "bounded-lifecycle-latency-control.cjs").replaceAll("\\", "/")}` : "") };
const hashFile = path => { const bytes = readFileSync(path); return { file: path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; };
const run = (label, args) => new Promise((resolve, reject) => {
  const stdout = join(runRoot, `${label}.stdout.txt`), stderr = join(runRoot, `${label}.stderr.txt`);
  writeFileSync(stdout, "", { flag: "wx" }); writeFileSync(stderr, "", { flag: "wx" });
  const startedAt = new Date().toISOString(), started = performance.now(), child = spawn(process.execPath, args, { cwd: repo, env, windowsHide: true });
  child.stdout.on("data", bytes => appendFileSync(stdout, bytes)); child.stderr.on("data", bytes => appendFileSync(stderr, bytes));
  child.once("error", reject); child.once("close", (exitCode, signal) => {
    const result = { label, command: [process.execPath, ...args], cwd: repo, pid: child.pid, startedAt, completedAt: new Date().toISOString(),
      durationMs: performance.now() - started, exitCode, signal, guardSha256: guardHash, stdout: hashFile(stdout), stderr: hashFile(stderr) };
    writeFileSync(join(runRoot, `${label}-command.json`), JSON.stringify(result, null, 2) + "\n", { flag: "wx" }); resolve(result);
  });
});
const testArgs = ["node_modules/vitest/vitest.mjs", "run", ...(mode.includes("independent") ? ["test/runtime-process.test.ts", "-t", "fences a second process"]
  : mode === "focused" ? ["test/runtime-process.test.ts", "test/runtime-lifecycle.test.ts", "test/runtime-storage.test.ts"] : []),
  "--configLoader=native", "--no-cache", "--no-fsModuleCache", "--reporter=default", "--reporter=json", `--outputFile.json=${join(runRoot, "tests.json")}`];
const checkArgs = [
  ["typecheck", ["node_modules/typescript/bin/tsc", "--noEmit"]],
  ["lint", ["node_modules/eslint/bin/eslint.js", "src", "test", "scripts", "*.config.*", "--no-cache"]],
  ["build", ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json", "--outDir", join(runRoot, "build")]]
];
let results;
if (mode === "loaded-independent") results = await Promise.all([run("tests", testArgs), ...checkArgs.map(([label, args]) => run(label, args))]);
else if (mode === "checks") { results = []; for (const [label, args] of checkArgs) results.push(await run(label, args)); }
else results = [await run("tests", testArgs)];
const unit = existsSync(join(runRoot, "tests.json")) ? JSON.parse(readFileSync(join(runRoot, "tests.json"))) : null;
const requests = readFileSync(networkLog, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const lifecycle = readFileSync(processLog, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const removed = lifecycle.filter(record => record.event === "fixture_remove_call").map(record => record.path);
const children = lifecycle.filter(record => record.event === "child_created").map(record => record.childPid);
const powershell = spawnSync("powershell", ["-NoProfile", "-Command", "$p = @(Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -match 'phase8-runtime|phase8-import' } | Select-Object ProcessId,ParentProcessId,@{Name='FixtureKind';Expression={ if ($_.CommandLine -match 'phase8-runtime') { 'PHASE8_RUNTIME' } else { 'PHASE8_IMPORT' } }}); ConvertTo-Json -InputObject $p -Depth 3"], { encoding: "utf8", windowsHide: true });
assert.equal(powershell.status, 0);
const remainingFixtures = readdirSync(join(temporary, "opencode")), relevantProcesses = JSON.parse(powershell.stdout);
const blocked = requests.filter(request => request.outcome === "EXTERNAL_BLOCKED");
const cleanup = { remainingFixtureDirectories: remainingFixtures, removalAttempts: removed.length,
  removalErrors: lifecycle.filter(record => record.event === "fixture_remove_error"), pathsStillExist: [...new Set(removed)].filter(path => existsSync(path)),
  children: children.map(pid => ({ pid, exited: lifecycle.some(record => record.event === "child_exit" && record.childPid === pid),
    closed: lifecycle.some(record => record.event === "child_close" && record.childPid === pid),
    disconnected: lifecycle.some(record => record.event === "child_disconnected" && record.childPid === pid) })),
  relevantFixtureProcessesAfterRun: relevantProcesses, noObservedOrphanProcesses: relevantProcesses.length === 0 };
const status = results.every(result => result.exitCode === 0) && (!unit || (unit.success && unit.numFailedTests === 0))
  && blocked.length === 0 && remainingFixtures.length === 0 && cleanup.pathsStillExist.length === 0 && cleanup.removalErrors.length === 0
  && relevantProcesses.length === 0 && cleanup.children.every(child => child.closed) ? "PASS" : "FAIL";
const summary = { schemaVersion: 1, name, mode, status, completedAt: new Date().toISOString(), results,
  evidenceClass: mode === "latency-independent" || guardVersion === "v1" ? "EXPLICIT_DIAGNOSTIC_CONTROL_NOT_QUALIFICATION" : "OFFLINE_FIXTURE_QUALIFICATION_OR_UNMODIFIED_DIAGNOSTIC",
  tooling: { diagnostics: hashFile(join(runRoot, "diagnostic-preloader-used.cjs")), runner: hashFile(join(runRoot, "test-runner-used.mjs")),
    testSource: hashFile(join(runRoot, "runtime-process-test-used.ts")), runtimeHelper: hashFile(join(runRoot, "runtime-helper-used.ts")),
    ...(mode === "latency-independent" ? { boundedLatencyControl: hashFile(join(runRoot, "latency-preloader-used.cjs")) } : {}) },
  ...(unit ? { tests: { success: unit.success, files: unit.testResults.length, total: unit.numTotalTests, passed: unit.numPassedTests,
    failed: unit.numFailedTests, pending: unit.numPendingTests, todo: unit.numTodoTests,
    assertions: unit.testResults.flatMap(file => file.assertionResults.filter(test => test.status !== "pending").map(test => ({ file: file.name,
      title: test.title, status: test.status, durationMs: test.duration, failureMessages: test.failureMessages }))) } } : {}),
  networkGuard: { version: guardVersion, sha256: guardHash, records: requests.length, blockedRecords: blocked.length,
    blockedLocalIPC: blocked.filter(record => record.host === "LOCAL_IPC").length,
    demonstratedRemoteAttempts: blocked.filter(record => record.host !== "LOCAL_IPC").length,
    allowedLocalNamedPipes: requests.filter(record => record.ipcClass === "WINDOWS_LOCAL_NAMED_PIPE" && record.allowed).length,
    caveat: guardVersion === "v1" ? "Explicit v1 negative control; false LOCAL_IPC rejections are not remote requests. This run cannot qualify with v1." : null },
  cleanup, logs: { network: hashFile(networkLog), lifecycle: hashFile(processLog) },
  safety: { realMonitorStopped: true, syntheticRuntimeFixturesOnly: true, externalNotifications: false, transactionsOrWalletOperations: false,
    noIntegrationTests: true, timeoutsOrAssertionsChangedByDiagnosticPreloader: false,
    readinessMessagesIntentionallyDelayedForControl: mode === "latency-independent", externalOutputsAndTemporaryFilesOnly: true } };
writeFileSync(join(runRoot, "summary.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ name, mode, status, tests: summary.tests ? { ...summary.tests, assertions: undefined } : null,
  checks: results.map(({ label, exitCode, durationMs }) => ({ label, exitCode, durationMs })), networkGuard: summary.networkGuard, cleanup }, null, 2));
if (status !== "PASS") process.exitCode = 1;
