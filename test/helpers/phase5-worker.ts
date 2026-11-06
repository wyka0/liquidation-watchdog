import { setTimeout as sleep } from "node:timers/promises";
import { parseMonitoringConfiguration } from "../../src/config/monitoring.js";
import { MonitoringService } from "../../src/monitoring/service.js";
import { MonitorStore } from "../../src/storage/store.js";
import { MONITOR_POSITION, MONITOR_THRESHOLDS, riskFixture, testClock } from "../fixtures/phase4.js";

// Child-process fault fixture: all reads and notifications are local fakes, with no HTTP clients.
const [file, mode] = process.argv.slice(2);
if (!file || !["read", "send", "idle"].includes(mode ?? "")) throw new Error("Fixture arguments required");
const snapshot = await riskFixture();
let release: () => void = () => {}, sends = 0;
const ready = () => { process.send?.({ fixture: true, event: "ready", mode }); };
const service = new MonitoringService({
  store: new MonitorStore(file), thresholds: MONITOR_THRESHOLDS, position: MONITOR_POSITION, now: testClock, allowFixture: true, id: () => "child_fixture_cycle",
  configuration: parseMonitoringConfiguration({ monitoring: { enabled: true }, operations: { shutdownTimeoutSeconds: 2, cycleTimeoutSeconds: 30 },
    notifications: { timeoutSeconds: 20 } }, { database: file }),
  read: async () => {
    if (mode === "read") { ready(); await new Promise<void>(resolve => { release = resolve; }); }
    return snapshot;
  },
  adapters: [{ channel: "console", send: async () => {
    if (mode === "send" && ++sends === 2) { ready(); await new Promise<void>(() => {}); }
    return { delivered: true };
  } }],
  pause: async (milliseconds, signal) => { ready(); await sleep(milliseconds, undefined, { signal }); }
});
const stop = () => {
  process.send?.({ fixture: true, event: "shutdown-requested" });
  void service.shutdown().then(() => { process.exitCode = 0; process.disconnect(); }, () => { process.exitCode = 1; process.disconnect(); });
};
process.on("SIGINT", stop); process.on("SIGTERM", stop);
process.on("message", (message: unknown) => {
  if (message === "release") release();
  // Windows cannot deliver a POSIX graceful signal through child.kill; explicitly label handler simulation.
  if (message === "simulate-SIGINT") process.emit("SIGINT");
  if (message === "simulate-SIGTERM") process.emit("SIGTERM");
});
try { if (mode === "idle") await service.runContinuous(); else await service.runOnce(); }
catch { process.exitCode = 1; }
