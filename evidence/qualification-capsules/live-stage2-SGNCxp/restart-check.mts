// New-process SQLite/outbox restart qualification only: no MonitoringService or live reader invocation.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = "C:/liquidation-watchdog", audit = dirname(fileURLToPath(import.meta.url));
const load = async (file: string) => import(pathToFileURL(`${repo}/${file}`).href);
const { loadRuntimeConfiguration } = await load("src/config/runtime.ts");
const { monitoringScope } = await load("src/monitoring/model.ts");
const { MonitorStore } = await load("src/storage/store.ts");
const { NotificationDispatcher } = await load("src/notifications/dispatcher.ts");
const { notificationAdapters } = await load("src/notifications/adapters.ts");
const { runCli } = await load("src/cli/run.ts");
const { stringify } = await load("src/domain/serialize.ts");

const configuration = await loadRuntimeConfiguration({ positionPath: join(audit, "position.json"), monitoringPath: join(audit, "monitoring.json") });
const { position, thresholds, monitoring } = configuration;
const scope = monitoringScope(thresholds, undefined, position);
const baseline = JSON.parse(readFileSync(join(audit, "persisted-before-restart.json"), "utf8"));
const live = JSON.parse(readFileSync(join(audit, "live-stage2-evidence.json"), "utf8"));
assert.equal(live.status, "PASS_FINITE_LIVE_MONITOR_AND_CONSOLE_DELIVERY_ORACLE_UNVERIFIED");
assert.equal(live.execution.runOnceCalls, 1);
assert.equal(live.scope, scope);
assert.equal(monitoring.monitoring.enabled, false);
writeFileSync(join(audit, "offline-restart-authorized.json"), stringify({ startedAt: new Date().toISOString(), scope, liveCyclesPermitted: 0 }) + "\n", { flag: "wx" });
let fetchAttempts = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { fetchAttempts += 1; throw new Error("RESTART_CHECK_NETWORK_FORBIDDEN"); };
const startedAt = new Date().toISOString(), output: string[] = [], logs: unknown[] = [];
writeFileSync(join(audit, "restart-console.txt"), "", { flag: "wx" });
let store: any = null;
let result: any;
try {
  store = new MonitorStore(monitoring.storage.path, { existingOnly: true, limits: monitoring.resources });
  store.validateAll();
  assert.deepEqual(store.state(scope), baseline.state);
  assert.deepEqual(store.alerts(100, scope), baseline.alerts);
  assert.deepEqual(store.deliveries(), baseline.deliveries);
  assert.deepEqual(store.contentHashes(), baseline.contentHashes);
  store.acquireMonitor();
  const recoveredInFlight = store.recoverDeliveries(new Date().toISOString(), monitoring.notifications.maxAttempts);
  const adapters = notificationAdapters(monitoring, (text: string) => {
    output.push(text); appendFileSync(join(audit, "restart-console.txt"), text); process.stdout.write(text);
  });
  assert.deepEqual(adapters.map((adapter: any) => adapter.channel), ["console"]);
  const dispatcher = new NotificationDispatcher(store, adapters, monitoring.notifications, () => new Date(), (record: unknown) => logs.push(record));
  const attempts = await dispatcher.drain();
  dispatcher.abort();
  store.validateAll();
  assert.equal(recoveredInFlight, 0); assert.equal(attempts, 0); assert.equal(output.length, 0);
  assert.equal(store.knownDeliveredHash(), baseline.knownDeliveredHash);
  assert.deepEqual(store.contentHashes(), baseline.contentHashes);
  assert.deepEqual(store.state(scope), baseline.state);
  assert.equal(store.statistics().counts.cycles, 1);
  assert.equal(store.runtime().status, "STOPPED");
  result = { schemaVersion: 1, status: "PASS", processId: process.pid, startedAt, completedAt: new Date().toISOString(),
    scope, liveRunOnceCalls: 0, newObservations: 0, recoveredInFlight, outboxDrainAttempts: attempts,
    knownDeliveredResends: output.length, stateUnchanged: true, logicalDatabaseHashesUnchanged: true,
    deliveredHashUnchanged: true, knownDeliveredHash: store.knownDeliveredHash(),
    statistics: store.statistics(), runtime: store.runtime(), logs,
    limitation: "This proves clean store/outbox recovery in a new process. A second full MonitoringService worker cycle and crash-in-flight live delivery were not executed." };
  store.close(); store = null;
  const cli: any[] = [];
  for (const command of ["status", "alerts"]) {
    const text: string[] = [], args = [command, "--config", join(audit, "monitoring.json"), "--position-config", join(audit, "position.json")];
    const exitCode = await runCli(args, { write: (value: string) => text.push(value) });
    assert.equal(exitCode, 0);
    const bytes = Buffer.from(text.join(""));
    assert.ok(bytes.toString("utf8").includes(position.identity.account));
    assert.ok(bytes.toString("utf8").includes(live.block.hash));
    writeFileSync(join(audit, `restart-cli-${command}.txt`), bytes, { flag: "wx" });
    cli.push({ command: args, exitCode, outputFile: `restart-cli-${command}.txt`, bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"), networkAttempted: false, deliveryAdapterInvoked: false,
      evidenceMeaning: "READ_ONLY_PERSISTED_HISTORY_NOT_A_CURRENT_CHAIN_READ_OR_NOTIFICATION_RESEND" });
  }
  const reader = new MonitorStore(monitoring.storage.path, { readOnly: true });
  try { assert.deepEqual(reader.contentHashes(), baseline.contentHashes); reader.validateAll(); } finally { reader.close(); }
  assert.equal(fetchAttempts, 0);
  result.cli = cli; result.fetchAttempts = fetchAttempts; result.completedAt = new Date().toISOString();
} catch (error) {
  result = { schemaVersion: 1, status: "FAIL", startedAt, completedAt: new Date().toISOString(), fetchAttempts,
    error: error instanceof Error ? error.message : String(error) };
  process.exitCode = 1;
} finally {
  store?.close(); globalThis.fetch = originalFetch;
  writeFileSync(join(audit, "restart-verification.json"), stringify(result) + "\n", { flag: "wx" });
  console.log(stringify(result));
}
