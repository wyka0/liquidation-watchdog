import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMonitoringConfiguration } from "../../src/config/monitoring.js";
import { parseThresholds } from "../../src/config/risk.js";
import { MonitorStore } from "../../src/storage/store.js";
import type { RuntimeOptions } from "../../src/runtime/service.js";
import { demoPositionConfiguration } from "../../src/config/position.js";
import { temporaryMonitorDirectory } from "./phase4.js";

export const RELEASE_ROOT = fileURLToPath(new URL("../..", import.meta.url));
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
export function runtimeFixture(enabled = false, initialized = false): { directory: string; options: RuntimeOptions; credential: string } {
  const directory = temporaryMonitorDirectory(), database = join(directory, "storage/watchdog.sqlite");
  mkdirSync(join(directory, "storage"));
  if (initialized) new MonitorStore(database).close(); // Explicit fixture initialization; never production startup.
  const credential = randomBytes(32).toString("base64url"); // Synthetic, in-memory and never printed or saved.
  const configuration = parseMonitoringConfiguration({ monitoring: { enabled }, storage: { path: database },
    operations: { profile: "local", shutdownTimeoutSeconds: 1 }, notifications: { timeoutSeconds: 1 } });
  const thresholds = parseThresholds();
  return { directory, credential, options: { runtimeRoot: join(directory, "runtime"), database, releaseRoot: RELEASE_ROOT,
    configuration, thresholds, position: demoPositionConfiguration(thresholds), credential, port: 0, host: "127.0.0.1" } };
}
