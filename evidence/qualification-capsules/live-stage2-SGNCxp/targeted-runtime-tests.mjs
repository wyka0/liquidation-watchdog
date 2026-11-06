// One bounded rerun of the existing affected unit file. Never a new live monitoring cycle.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = "C:/liquidation-watchdog", audit = dirname(fileURLToPath(import.meta.url));
const temporary = join(audit, "runtime-rerun-tmp"), guard = join(audit, "test-network-guard-v2.cjs");
mkdirSync(join(temporary, "opencode"), { recursive: true });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const require = createRequire(import.meta.url), { classify } = require(guard);
const guardCases = [
  [{ host: "127.0.0.1", port: 1 }, true], [{ host: "::1", port: 1 }, true], [{ host: "localhost", port: 1 }, true],
  [{ host: "rpc.pharos.xyz", port: 443 }, false], [{ path: "\\\\?\\pipe\\C:\\local\\fixture.pipe" }, true],
  [{ path: "\\\\.\\pipe\\fixture" }, true], [{ path: "\\\\remote-host\\pipe\\fixture" }, false]
].map(([options, expected]) => {
  const result = classify(options); assert.equal(result.allowed, expected);
  return { options, expectedAllowed: expected, result, status: "PASS", checkIsPureClassificationNotAConnection: true };
});
const networkLog = join(audit, "runtime-rerun-network-guard.jsonl"), stdoutFile = "runtime-rerun.stdout.txt", stderrFile = "runtime-rerun.stderr.txt";
for (const file of [networkLog, join(audit, stdoutFile), join(audit, stderrFile)]) writeFileSync(file, "", { flag: "wx" });
const args = ["node_modules/vitest/vitest.mjs", "run", "test/runtime-process.test.ts", "--configLoader=native", "--no-cache", "--no-fsModuleCache",
  "--maxWorkers=1", "--reporter=default", "--reporter=json", `--outputFile.json=${join(audit, "runtime-rerun-tests.json")}`];
const startedAt = new Date().toISOString();
const child = spawn(process.execPath, args, { cwd: repo, windowsHide: true, timeout: 180_000, killSignal: "SIGKILL",
  env: { ...process.env, TEMP: temporary, TMP: temporary, NODE_DISABLE_COMPILE_CACHE: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0",
    WATCHDOG_QUALIFICATION_NETWORK_LOG: networkLog, NODE_OPTIONS: `--require=${guard.replaceAll("\\", "/")}` } });
child.stdout.on("data", content => appendFileSync(join(audit, stdoutFile), content));
child.stderr.on("data", content => appendFileSync(join(audit, stderrFile), content));
const exit = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", (code, signal) => resolve({ code, signal })); });
const unit = JSON.parse(readFileSync(join(audit, "runtime-rerun-tests.json"), "utf8"));
const requests = readFileSync(networkLog, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
const blocked = requests.filter(request => request.outcome === "EXTERNAL_BLOCKED");
const command = { name: "AFFECTED_EXISTING_UNIT_FILE_RERUN", command: [process.execPath, ...args], cwd: repo, startedAt, completedAt: new Date().toISOString(),
  exitCode: exit.code, signal: exit.signal, guardFile: "test-network-guard-v2.cjs", guardSha256: hash(readFileSync(guard)),
  stdout: { file: stdoutFile, bytes: readFileSync(join(audit, stdoutFile)).length, sha256: hash(readFileSync(join(audit, stdoutFile))) },
  stderr: { file: stderrFile, bytes: readFileSync(join(audit, stderrFile)).length, sha256: hash(readFileSync(join(audit, stderrFile))) } };
writeFileSync(join(audit, "runtime-rerun-command.json"), JSON.stringify(command, null, 2) + "\n", { flag: "wx" });
const result = { schemaVersion: 1, status: exit.code === 0 && unit.numFailedTests === 0 && blocked.length === 0 ? "PASS" : "FAIL",
  evidenceClass: "EXISTING_UNIT_FIXTURES_WITH_LOCAL_WINDOWS_IPC_ONLY_NOT_LIVE_CHAIN_OR_PRODUCTION_RESTART", command,
  unit: { files: unit.testResults.length, total: unit.numTotalTests, passed: unit.numPassedTests, failed: unit.numFailedTests,
    pending: unit.numPendingTests, todo: unit.numTodoTests }, guardCases,
  networkGuard: { records: requests.length, actualExternalAttempts: blocked.length,
    localNamedPipeRecords: requests.filter(request => request.ipcClass === "WINDOWS_LOCAL_NAMED_PIPE").length, remoteNetworkPermitted: false },
  qualificationLimitation: "The original full-suite failure and logs are retained. This focused rerun does not replace them or establish a fresh all-green full suite.",
  productionCodeChanges: 0, liveMonitoringCycles: 0 };
writeFileSync(join(audit, "targeted-runtime-test-results.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(result, null, 2));
if (result.status !== "PASS") process.exitCode = 1;
