// Read/observe fixture lifecycle. No delays, retries, timeout changes or suppressed errors.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const cp = require("node:child_process");
const sqlite = require("node:sqlite");
const { syncBuiltinESMExports } = require("node:module");
const file = process.env.WATCHDOG_REPAIR_PROCESS_LOG;
const append = fs.appendFileSync;
let sequence = 0;
const handles = () => Object.fromEntries([...new Set(process._getActiveHandles().map(handle => handle.constructor.name))]
  .map(name => [name, process._getActiveHandles().filter(handle => handle.constructor.name === name).length]));
const log = (event, detail = {}) => {
  if (!file) return;
  append(file, JSON.stringify({ at: new Date().toISOString(), hrNs: process.hrtime.bigint().toString(), pid: process.pid,
    ppid: process.ppid, sequence: ++sequence, event, ...detail }) + "\n");
};
const fixturePath = value => typeof value === "string" && /watchdog-phase3-fixture-/i.test(value);
log("preloader_loaded", { role: process.argv.some(arg => /phase8-runtime/.test(arg)) ? "runtime_fixture"
  : process.argv.some(arg => /phase8-import/.test(arg)) ? "import_fixture" : "test_or_orchestrator", handles: handles() });
const originalSpawn = cp.spawn;
cp.spawn = function (...args) {
  const observed = Array.isArray(args[1]) && args[1].some(arg => /phase8-(runtime|import)\.ts/.test(arg));
  if (!observed) return Reflect.apply(originalSpawn, this, args);
  log("child_spawn_call", { args: args[1], timeout: args[2]?.timeout ?? null });
  const child = Reflect.apply(originalSpawn, this, args), childPid = child.pid;
  log("child_created", { childPid });
  const state = () => ({ childPid, exitCode: child.exitCode, signalCode: child.signalCode, connected: child.connected,
    stdoutDestroyed: child.stdout?.destroyed, stderrDestroyed: child.stderr?.destroyed });
  const kill = child.kill;
  child.kill = function (signal) { log("child_kill_call", { ...state(), signal });
    const killed = Reflect.apply(kill, this, arguments); log("child_kill_return", { ...state(), signal, killed }); return killed; };
  if (child.send) { const send = child.send; child.send = function (value) {
    log("parent_ipc_send", { ...state(), value: typeof value === "string" ? value : value?.event ?? "OTHER" });
    return Reflect.apply(send, this, arguments);
  }; }
  child.on("spawn", () => log("child_spawned", state()));
  child.on("message", value => log("parent_ipc_message", { ...state(), value: value?.event ?? "OTHER" }));
  child.on("disconnect", () => log("child_disconnected", state()));
  child.on("exit", (code, signal) => log("child_exit", { ...state(), code, signal }));
  child.on("close", (code, signal) => log("child_close", { ...state(), code, signal, handles: handles() }));
  child.on("error", error => log("child_error", { ...state(), code: error.code ?? null, message: error.message }));
  // Observe bounded stderr only; no stream pause/resume changes. Runtime fixture output is intentionally empty.
  let stderrBytes = 0;
  child.stderr?.on("data", bytes => { if (stderrBytes < 4096) log("child_stderr", { childPid, text: bytes.toString().slice(0, 4096 - stderrBytes) }); stderrBytes += bytes.length; });
  return child;
};
if (process.send) { const send = process.send; process.send = function (value) {
  log("child_ipc_send", { value: value?.event ?? (typeof value === "string" ? value : "OTHER") }); return Reflect.apply(send, this, arguments);
}; }
const chdir = process.chdir;
process.chdir = function (directory) { log("chdir_call", { directory }); const result = Reflect.apply(chdir, this, arguments);
  log("chdir_done", { directory: process.cwd() }); return result; };
const emit = process.emit;
process.emit = function (event) { if (event === "SIGINT" || event === "SIGTERM") log("signal_emitted", { signal: event });
  return Reflect.apply(emit, this, arguments); };
const rm = fs.rmSync;
fs.rmSync = function (path) {
  if (!fixturePath(path)) return Reflect.apply(rm, this, arguments);
  log("fixture_remove_call", { path, handles: handles() });
  try { const result = Reflect.apply(rm, this, arguments); log("fixture_remove_done", { path, exists: fs.existsSync(path) }); return result; }
  catch (error) { log("fixture_remove_error", { path, code: error.code, message: error.message, handles: handles() }); throw error; }
};
const OriginalDatabase = sqlite.DatabaseSync;
sqlite.DatabaseSync = new Proxy(OriginalDatabase, { construct(target, args, newTarget) {
  const observed = fixturePath(args[0]); if (observed) log("sqlite_open_call", { path: args[0], readOnly: args[1]?.readOnly ?? false });
  try {
    const db = Reflect.construct(target, args, newTarget);
    if (observed) { log("sqlite_open_done", { path: args[0] }); const close = db.close;
      db.close = function () { log("sqlite_close_call", { path: args[0] });
        try { const result = Reflect.apply(close, this, arguments); log("sqlite_close_done", { path: args[0] }); return result; }
        catch (error) { log("sqlite_close_error", { path: args[0], code: error.code, message: error.message }); throw error; }
      }; }
    return db;
  } catch (error) { if (observed) log("sqlite_open_error", { path: args[0], code: error.code, message: error.message }); throw error; }
} });
const open = fsp.open;
let evidenceOpens = 0;
fsp.open = async function (path) {
  const observed = fixturePath(path), probe = observed && String(path).includes(".watchdog-probe-");
  if (probe) log("workspace_probe_open", { path });
  else if (observed) { evidenceOpens++; if (evidenceOpens === 1) log("workspace_evidence_first_open", { path }); }
  const handle = await Reflect.apply(open, this, arguments);
  if (probe) { const close = handle.close; handle.close = async function () {
    const result = await Reflect.apply(close, this, arguments); log("workspace_probe_closed", { path }); return result; }; }
  return handle;
};
process.on("beforeExit", code => log("before_exit", { code, handles: handles(), evidenceOpens }));
process.on("exit", code => log("process_exit", { code, handles: handles(), evidenceOpens }));
syncBuiltinESMExports();
