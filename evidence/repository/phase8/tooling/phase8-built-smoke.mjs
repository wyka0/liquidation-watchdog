import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = "C:/liquidation-watchdog", temp = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode", directory = mkdtempSync(join(temp, "phase8-built-"));
const database = join(directory, "storage/watchdog.sqlite"), runtimeRoot = join(directory, "runtime"), config = join(directory, "runtime.json");
const credential = randomBytes(32).toString("base64url"), startedAt = new Date().toISOString(), cases = [];
let child;
function launch(args, port, ipc) {
  const started = performance.now();
  const process = spawn(globalThis.process.execPath, args, { cwd: root, windowsHide: true, timeout: 30_000, killSignal: "SIGKILL",
    stdio: ipc ? ["ignore", "pipe", "pipe", "ipc"] : ["ignore", "pipe", "pipe"],
    env: { PORT: String(port), WATCHDOG_READ_API_TOKEN: credential, SystemRoot: globalThis.process.env.SystemRoot ?? "C:/Windows" } });
  let stdout = "", stderr = "", ready;
  const listening = new Promise(resolve => { ready = resolve; });
  process.stdout.on("data", buffer => { stdout += buffer.toString(); if (stdout.includes('"event":"runtime_started"')) ready(); });
  process.stderr.on("data", buffer => { stderr += buffer.toString(); });
  const closed = new Promise((resolve, reject) => { process.once("error", reject); process.once("close", code => resolve(code)); });
  return { process, closed, waitForListening: () => Promise.race([listening, closed.then(code => {
    const nodeError = stderr.match(/\[(ERR_[A-Z_]+)\]/)?.[1] ?? "NO_NODE_ERROR_CODE";
    throw new Error(`Built service did not reach started state; exit=${code}; ${nodeError}`);
  })]), started,
    logs: () => {
      assert.equal(stdout.includes(credential) || stderr.includes(credential), false, "Synthetic credential must not appear in output");
      return stdout.split(/\r?\n/).filter(Boolean).map(line => {
        const event = JSON.parse(line); return Object.fromEntries(["event", "lifecycle", "error"].filter(key => typeof event[key] === "string").map(key => [key, event[key]]));
      });
    } };
}
function configuration(enabled) {
  writeFileSync(config, JSON.stringify({ monitoring: { enabled }, storage: { path: database }, operations: { profile: "local", shutdownTimeoutSeconds: 1 },
    notifications: { telegram: false, discord: false } }) + "\n");
}
try {
  const reservation = createServer(); await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  configuration(false);
  const cli = ["dist/service.js", "--config", config, "--runtime-root", runtimeRoot, "--database", database];
  const hook = join(temp, "phase8-signal-hook.mjs");
  let preloadFormatCheck = null;
  if (process.platform === "win32") {
    const format = spawnSync(process.execPath, ["--import", hook, "-e", ""], { cwd: root, encoding: "utf8", timeout: 5_000, windowsHide: true });
    const code = format.stderr.match(/\[(ERR_[A-Z_]+)\]/)?.[1]; assert.equal(format.status, 1); assert.equal(code, "ERR_UNSUPPORTED_ESM_URL_SCHEME");
    preloadFormatCheck = { nativeWindowsPathExitCode: format.status, nodeErrorCode: code, resolution: "FILE_URL_FOR_ESM_PRELOAD" };
  }
  const first = launch(process.platform === "win32" ? ["--import", pathToFileURL(hook).href, ...cli] : cli, port, process.platform === "win32");
  child = first.process; await first.waitForListening();
  const startupMs = performance.now() - first.started, url = `http://127.0.0.1:${port}`, statuses = {};
  for (const [name, route, authenticated, expected] of [["health", "/api/health", false, 200], ["refused", "/api/positions", false, 401],
    ["status", "/api/monitoring/status", true, 200], ["missingData", "/api/positions", true, 503], ["dashboard", "/", true, 200]]) {
    const response = await fetch(url + route, { headers: authenticated ? { Authorization: `Bearer ${credential}` } : {}, signal: AbortSignal.timeout(5_000) });
    const body = await response.text(); assert.equal(response.status, expected); assert.equal(body.includes(credential), false);
    if (name === "health") assert.deepEqual(JSON.parse(body), { status: "DISABLED" });
    statuses[name] = response.status;
  }
  assert.equal(existsSync(database), false); const shutdown = performance.now();
  if (process.platform === "win32") child.send("SIGTERM"); else child.kill("SIGTERM");
  assert.equal(await first.closed, 0); child = undefined;
  const shutdownMs = performance.now() - shutdown; assert.ok(shutdownMs < 5_000); assert.equal(existsSync(database), false);
  cases.push({ name: "BUILT_EXECUTABLE_DISABLED_START_AUTH_HTTP_AND_SIGNAL_SHUTDOWN", passed: true, startupMs, shutdownMs, statuses,
    signalMode: process.platform === "win32" ? "TEST_PRELOAD_IPC_DISPATCH_TO_REAL_SIGTERM_HANDLER" : "OS_SIGTERM", logs: first.logs() });
  configuration(true);
  const second = launch(cli, port, false); child = second.process; assert.equal(await second.closed, 1); child = undefined;
  assert.equal(existsSync(database), false);
  cases.push({ name: "BUILT_EXECUTABLE_ENABLED_MISSING_DATABASE_REFUSAL", passed: true, elapsedMs: performance.now() - second.started, exitCode: 1, logs: second.logs() });
  const result = { kind: "PHASE8_BOUNDED_BUILT_EXECUTABLE_SMOKE", startedAt, finishedAt: new Date().toISOString(), passed: true,
    command: "node [REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/phase8-built-smoke.mjs", childEntrypoint: "dist/service.js", platform: process.platform,
    profile: "local", cases, preloadFormatCheck, syntheticCredentials: "IN_MEMORY_ONLY_NOT_SAVED_OR_PRINTED", applicationDatabaseCreated: false,
    chainRequests: 0, externalProviderRequests: 0, transactions: 0, productionAcceptance: false };
  writeFileSync(`${root}/evidence/phase8/built-service-smoke.json`, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ passed: true, cases: cases.length, startupMs, shutdownMs, applicationDatabaseCreated: false, platform: process.platform }));
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const stopped = new Promise(resolve => child.once("close", resolve)); child.kill("SIGKILL"); await stopped;
  }
  rmSync(directory, { recursive: true, force: true });
}
