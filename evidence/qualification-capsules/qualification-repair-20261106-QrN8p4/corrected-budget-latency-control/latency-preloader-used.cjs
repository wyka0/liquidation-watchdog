// EXPLICIT SYNTHETIC NEGATIVE/POSITIVE CONTROL, not qualification. No source or timeout is changed.
// Hold each readiness IPC event until 20s of child life: both horizons remain below the existing 30s child bound.
// Historical normal single-child assertions already took 22.38s / 22.87s. This models that permitted latency,
// not an assertion about the original host's exact scheduling or a real oracle/monitor execution.
const fs = require("node:fs");
if (process.argv.some(arg => /phase8-runtime\.ts$/.test(arg)) && process.send) {
  const started = performance.now(), delayMs = Number(process.env.WATCHDOG_BOUNDED_LIFECYCLE_EVENT_LATENCY_MS);
  if (!Number.isFinite(delayMs) || delayMs <= 0 || delayMs >= 25000) throw new Error("Invalid bounded lifecycle latency control");
  const send = process.send;
  process.send = function (value) {
    if (value?.event !== "reading" && value?.event !== "idle") return Reflect.apply(send, this, arguments);
    const args = [...arguments], remainingMs = Math.max(0, delayMs - (performance.now() - started));
    fs.appendFileSync(process.env.WATCHDOG_REPAIR_PROCESS_LOG, JSON.stringify({ at: new Date().toISOString(), hrNs: process.hrtime.bigint().toString(),
      pid: process.pid, ppid: process.ppid, event: "bounded_readiness_latency_control", value: value.event, readinessHorizonMs: delayMs, remainingMs }) + "\n");
    setTimeout(() => { Reflect.apply(send, this, args); }, remainingMs);
    return true;
  };
}
