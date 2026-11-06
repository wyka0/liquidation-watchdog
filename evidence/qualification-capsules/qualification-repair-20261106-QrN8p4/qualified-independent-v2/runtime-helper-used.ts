import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { parseMonitoringConfiguration } from "../../src/config/monitoring.js";
import { parseThresholds } from "../../src/config/risk.js";
import type { Snapshot } from "../../src/domain/types.js";
import { RenderRuntime, installSignals } from "../../src/runtime/service.js";
import { riskFixture, testClock } from "../fixtures/phase4.js";
import { demoPositionConfiguration } from "../../src/config/position.js";

const directory = process.argv[2]!, mode = process.argv[3]!, database = join(directory, "storage/watchdog.sqlite");
const snapshot = await riskFixture(); let releaseRead: ((value: Snapshot) => void) | undefined;
const configuration = parseMonitoringConfiguration({ monitoring: { enabled: true }, storage: { path: database },
  operations: { profile: "local", shutdownTimeoutSeconds: 1 }, notifications: { timeoutSeconds: 1 } });
const thresholds = parseThresholds();
const runtime = new RenderRuntime({ configuration, thresholds, position: demoPositionConfiguration(thresholds), database, releaseRoot: resolve("."),
  runtimeRoot: join(directory, "runtime"),
  credential: randomBytes(32).toString("base64url"), port: 0, host: "127.0.0.1", fixture: {
    now: testClock,
    read: async () => {
      if (mode === "read") { process.send?.({ event: "reading" }); return new Promise<Snapshot>(resolve => { releaseRead = resolve; }); }
      return snapshot;
    },
    pause: async (_milliseconds, signal) => {
      process.send?.({ event: "idle" });
      await new Promise<void>(resolve => { signal.addEventListener("abort", () => { resolve(); }, { once: true }); if (signal.aborted) resolve(); });
    }
  } });
const remove = installSignals(runtime);
const message = (value: unknown) => {
  if (value === "SIGINT" || value === "SIGTERM") process.emit(value);
  if (value === "release") releaseRead?.(snapshot);
};
process.on("message", message);
const hardLimit = setTimeout(() => { process.exit(2); }, 25_000);
try {
  const address = await runtime.start(); process.send?.({ event: "listening", port: address.port });
  process.exitCode = await runtime.done;
} catch { process.exitCode = 1; }
finally { await runtime.stop(); remove(); clearTimeout(hardLimit); process.removeListener("message", message); process.disconnect?.(); }
