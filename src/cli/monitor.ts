import type { MonitoringConfiguration } from "../config/monitoring.js";
import { DataError } from "../domain/errors.js";
import { stringify } from "../domain/serialize.js";
import { structuredLogger } from "../monitoring/logs.js";
import { monitoringScope } from "../monitoring/model.js";
import { MonitoringService } from "../monitoring/service.js";
import { notificationAdapters } from "../notifications/adapters.js";
import { renderAlert } from "../notifications/format.js";
import type { NotificationAdapter } from "../notifications/types.js";
import { MonitorStore } from "../storage/store.js";
import type { MonitorCommandOptions } from "./monitor-options.js";
import { requireStartupConfiguration } from "../config/production.js";
import { initialState } from "../monitoring/model.js";
import { loadRuntimeConfiguration } from "../config/runtime.js";

export interface MonitoringCliDependencies {
  read?: (block?: bigint, signal?: AbortSignal) => Promise<unknown>;
  openStore?: (path: string) => MonitorStore;
  adapters?: (configuration: MonitoringConfiguration, write: (text: string) => void) => NotificationAdapter[];
  onSignal?: (callback: () => void) => () => void;
  allowFixture?: boolean;
}
function signals(callback: () => void): () => void {
  process.on("SIGINT", callback); process.on("SIGTERM", callback);
  return () => { process.off("SIGINT", callback); process.off("SIGTERM", callback); };
}
export async function runMonitoringCli(options: MonitorCommandOptions, write: (text: string) => void, now: () => Date,
  dependencies: MonitoringCliDependencies = {}): Promise<number> {
  const resolved = await loadRuntimeConfiguration({ monitoringPath: options.configPath, monitoringOverrides: options.monitoringOverrides,
    thresholdPath: options.riskConfigPath, thresholdOverrides: options.thresholdOverrides, positionPath: options.positionConfigPath });
  const { monitoring: configuration, thresholds, position } = resolved;
  if (options.command === "monitor" && !options.once && !configuration.monitoring.enabled) {
    throw new DataError("MONITOR_DISABLED", "Continuous monitoring is opt-in; use --enable or monitoring.enabled=true. --once explicitly requests one cycle.");
  }
  // Provider configuration is checked before opening a writable store. status/alerts never read provider credentials.
  if (options.command === "monitor") requireStartupConfiguration(configuration, { thresholds, position });
  const adapters = options.command === "monitor" ? (dependencies.adapters ?? notificationAdapters)(configuration, write) : [];
  let store: MonitorStore;
  try { store = (dependencies.openStore ?? (path => new MonitorStore(path, { readOnly: options.command !== "monitor", limits: configuration.resources })))(configuration.storage.path); }
  catch (error) {
    if (options.command === "monitor" || !(error instanceof DataError) || error.code !== "STORE_NOT_FOUND") throw error;
    write("No monitoring database is initialized. Oracle verification: UNVERIFIED; heartbeat: UNKNOWN; actionable: false.\n");
    write(`${stringify({ schemaVersion: null, state: initialState(), database: "UNAVAILABLE" })}\n`); return 0;
  }
  if (options.command !== "monitor") {
    try {
      if (options.command === "alerts") {
        const alerts = store.alerts(options.limit, monitoringScope(thresholds, undefined, position)), deliveries = store.deliveriesForAlerts(alerts.map(alert => alert.id));
        if (!alerts.length) write("No persistent alerts. This does not establish a current risk state.\n");
        for (const alert of alerts) {
          write(renderAlert(alert));
          write(`Delivery: ${deliveries.filter(delivery => delivery.alert_id === alert.id).map(delivery => `${delivery.channel}=${delivery.status} (${delivery.attempts} attempts)`).join(", ")}\n`);
        }
      } else {
        write("Stored monitoring status (as of recorded snapshots). Oracle verification: UNVERIFIED; heartbeat: UNKNOWN; actionable: false.\n");
        const summary = store.summary(monitoringScope(thresholds, options.block, position));
        if (!summary.state.latest?.accepted) write("Current risk cannot be determined from the latest recorded read.\n");
        write(`${stringify(summary)}\n`);
      }
      return 0;
    } finally { store.close(); }
  }
  const service = new MonitoringService({ configuration, thresholds, position, store, adapters, log: structuredLogger(write), now,
    ...(dependencies.read ? { read: dependencies.read } : {}), ...(dependencies.allowFixture ? { allowFixture: true } : {}),
    ...(options.block === undefined ? {} : { block: options.block }) });
  let rejectSignal: (error: unknown) => void = () => {};
  const signalFailure = new Promise<never>((_resolve, reject) => { rejectSignal = reject; });
  const removeSignals = (dependencies.onSignal ?? signals)(() => { void service.shutdown().catch(rejectSignal); });
  structuredLogger(write)({ timestamp: now().toISOString(), event: "startup_validated" });
  try {
    if (options.once) {
      const cycle = await Promise.race([service.runOnce(), signalFailure]);
      return "observation" in cycle && cycle.observation.accepted ? 0 : 2;
    }
    await Promise.race([service.runContinuous(), signalFailure]); return 0;
  } finally { removeSignals(); await service.shutdown(); }
}
