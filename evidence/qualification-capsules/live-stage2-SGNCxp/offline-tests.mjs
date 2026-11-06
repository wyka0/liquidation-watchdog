import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = "C:/liquidation-watchdog";
const audit = dirname(fileURLToPath(import.meta.url));
const temporary = join(audit, "unit-tmp");
mkdirSync(join(temporary, "opencode"), { recursive: true });
const networkLog = join(audit, "unit-network-guard.jsonl");
writeFileSync(networkLog, "", { flag: "wx" });
const environment = { ...process.env, TEMP: temporary, TMP: temporary, NODE_DISABLE_COMPILE_CACHE: "1",
  GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", WATCHDOG_QUALIFICATION_NETWORK_LOG: networkLog,
  NODE_OPTIONS: `--require=${join(audit, "test-network-guard.cjs").replaceAll("\\", "/")}` };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const run = (name, args) => new Promise((resolve, reject) => {
  const stdout = join(audit, `${name}.stdout.txt`), stderr = join(audit, `${name}.stderr.txt`);
  writeFileSync(stdout, "", { flag: "wx" }); writeFileSync(stderr, "", { flag: "wx" });
  const startedAt = new Date().toISOString();
  const child = spawn(process.execPath, args, { cwd: repo, env: environment, windowsHide: true });
  child.stdout.on("data", bytes => appendFileSync(stdout, bytes)); child.stderr.on("data", bytes => appendFileSync(stderr, bytes));
  child.once("error", reject);
  child.once("close", (exitCode, signal) => {
    const result = { name, command: [process.execPath, ...args], cwd: repo, startedAt, completedAt: new Date().toISOString(), exitCode, signal,
      stdout: { file: `${name}.stdout.txt`, bytes: readFileSync(stdout).length, sha256: hash(readFileSync(stdout)) },
      stderr: { file: `${name}.stderr.txt`, bytes: readFileSync(stderr).length, sha256: hash(readFileSync(stderr)) },
      safeguards: { noCache: true, externalOutputsOnly: true, network: "LOOPBACK_FIXTURES_ONLY", temporaryDirectory: temporary, noIntegrationTests: true } };
    writeFileSync(join(audit, `${name}-command.json`), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    resolve(result);
  });
});
const results = await Promise.all([
  run("unit-tests", ["node_modules/vitest/vitest.mjs", "run", "--configLoader=native", "--no-cache", "--no-fsModuleCache",
    "--reporter=default", "--reporter=json", `--outputFile.json=${join(audit, "unit-tests.json")}`]),
  run("typecheck", ["node_modules/typescript/bin/tsc", "--noEmit"]),
  run("lint", ["node_modules/eslint/bin/eslint.js", "src", "test", "scripts", "*.config.*", "--no-cache"]),
  run("build", ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json", "--outDir", join(audit, "build")])
]);
const unit = JSON.parse(readFileSync(join(audit, "unit-tests.json"), "utf8"));
const requests = readFileSync(networkLog, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
const blocked = requests.filter(request => request.outcome === "EXTERNAL_BLOCKED");
const pass = results.every(result => result.exitCode === 0) && unit.numFailedTests === 0 && blocked.length === 0;
const summary = { status: pass ? "PASS" : "FAIL", completedAt: new Date().toISOString(), checks: results,
  unit: { files: unit.testResults.length, total: unit.numTotalTests, passed: unit.numPassedTests, failed: unit.numFailedTests,
    pending: unit.numPendingTests, todo: unit.numTodoTests },
  networkGuard: { records: requests.length, actualExternalAttempts: blocked.length, remoteNetworkPermitted: false,
    loopbackFixtureTrafficPermitted: true },
  notRun: ["Native PostgreSQL integration", "Live integration suites", "Neon qualification", "Deployment", "Scheduler activation"],
  evidenceClass: "UNIT_FIXTURES_MOCKS_AND_LOCAL_LOOPBACK_ONLY_NOT_LIVE_CHAIN_EVIDENCE" };
writeFileSync(join(audit, "offline-test-results.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(summary, null, 2));
if (!pass) process.exitCode = 1;
