import type { AddressInfo } from "node:net";
import { parseMonitoringConfiguration } from "../config/monitoring.js";
import type { PostgresConfiguration } from "../config/postgres.js";
import { validateThresholds } from "../config/risk.js";
import type { ThresholdConfiguration } from "../config/risk.js";
import type { MonitoringConfiguration } from "../config/monitoring.js";
import { DataError } from "../domain/errors.js";
import { monitoringScope } from "../monitoring/model.js";
import { MonitoringService } from "../monitoring/service.js";
import type { AsyncServiceOptions } from "../monitoring/service.js";
import { PgConnection } from "../storage/postgres/connection.js";
import { PostgresDatabase } from "../storage/postgres/database.js";
import { PostgresSchedulerStore } from "../storage/postgres/scheduler-store.js";
import { PostgresMonitorStore } from "../storage/postgres/store.js";
import { readAuthenticator } from "./auth.js";
import { ReadHttpServer } from "./http.js";
import { AsyncPersistedReadModel } from "./read-model.js";
import type { Lifecycle } from "./read-model.js";
import { schedulerAuthenticator } from "./scheduler-contract.js";
import { SchedulerRunner } from "./scheduler.js";
import type { NotificationAdapter } from "../notifications/types.js";
import type { MonitorLogger } from "../monitoring/logs.js";
import type { PositionConfiguration } from "../config/position.js";
import { validatePositionConfiguration } from "../config/position.js";

export interface PostgresRuntimeOptions {
  configuration: PostgresConfiguration; /** Resolved once at startup by config/runtime.ts; the runtime never reconstructs defaults. */
  monitoring: MonitoringConfiguration; thresholds: ThresholdConfiguration;
  position: PositionConfiguration;
  adapters: readonly NotificationAdapter[]; log?: MonitorLogger;
  readCredential: string | undefined; schedulerCredential: string | undefined;
  host?: "127.0.0.1" | "0.0.0.0"; port: number;
}
/** Inert construction and lazy pools; no migration, SQLite open or cycle at startup. */
export class PostgresRuntime {
  private lifecycle: Lifecycle = "STOPPED";
  private database: PostgresDatabase | null = null;
  private runner: SchedulerRunner | null = null;
  private http: ReadHttpServer | null = null;
  private started = false;
  private closing: Promise<void> | null = null;
  private finish!: (code: number) => void;
  readonly done = new Promise<number>(resolve => { this.finish = resolve; });
  readonly notificationChannels: readonly NotificationAdapter["channel"][];
  constructor(private readonly options: PostgresRuntimeOptions) {
    this.notificationChannels = Object.freeze(options.adapters.map(adapter => adapter.channel));
  }
  status(): Lifecycle { return this.lifecycle; }
  async start(): Promise<AddressInfo> {
    if (this.started || this.closing) throw new DataError("RUNTIME_ALREADY_RUNNING", "This PostgreSQL runtime was already started or stopped.");
    this.started = true; this.lifecycle = "STARTING";
    try {
      const options = this.options;
      if (options.configuration.backend !== "postgres") throw new DataError("POSTGRES_CONFIG", "PostgreSQL must be explicitly selected.");
      // Fail closed on the injected thresholds before any pool, listener or database work.
      validateThresholds(options.thresholds);
      validatePositionConfiguration(options.position, options.thresholds);
      if (!options.position.enabled && options.configuration.schedulerEnabled) throw new DataError("POSITION_DISABLED", "The selected position is disabled; scheduler monitoring cannot start.");
      const authenticate = readAuthenticator(options.readCredential);
      const schedulerAuth = schedulerAuthenticator(options.schedulerCredential, options.readCredential);
      // The A2 cadence remains authoritative while all other reviewed policy, notification and resource values
      // come from the one resolved non-secret monitoring configuration.
      const base = parseMonitoringConfiguration(options.monitoring);
      const configuration = parseMonitoringConfiguration({ ...base,
        monitoring: { ...base.monitoring, enabled: options.configuration.schedulerEnabled,
          intervalSeconds: options.configuration.slotPeriodSeconds },
        operations: { ...base.operations, cycleTimeoutSeconds: 240, chainStatusMaxAgeSeconds: 600, shutdownTimeoutSeconds: 10 } });
      const expected = ["console", ...(configuration.notifications.telegram ? ["telegram"] as const : []),
        ...(configuration.notifications.discord ? ["discord"] as const : [])];
      if (new Set(this.notificationChannels).size !== this.notificationChannels.length
        || JSON.stringify([...this.notificationChannels].sort()) !== JSON.stringify([...expected].sort())) {
        throw new DataError("POSTGRES_CONFIG", "Notification adapters must exactly match the explicitly enabled channels.");
      }
      this.database = new PostgresDatabase(new PgConnection(options.configuration.writer, "writer"), new PgConnection(options.configuration.reader, "reader"), options.configuration.namespace);
      const db = this.database, thresholds = options.thresholds, period = options.configuration.slotPeriodSeconds;
      this.runner = new SchedulerRunner({ enabled: options.configuration.schedulerEnabled, periodSeconds: period,
        store: new PostgresSchedulerStore(db, monitoringScope(thresholds, undefined, options.position), period), createJob: (fence, signal) => {
          const store = new PostgresMonitorStore(db, fence, configuration.resources, signal);
          const service: AsyncServiceOptions = { configuration, thresholds, position: options.position, store, adapters: options.adapters,
            ...(options.log ? { log: options.log } : {}), id: () => fence.cycleId };
          return new MonitoringService(service);
        } });
      this.http = new ReadHttpServer({ api: new AsyncPersistedReadModel(db, configuration, () => this.lifecycle, thresholds, options.position, period), authenticate,
        lifecycle: () => this.lifecycle, scheduler: { authenticate: schedulerAuth, periodSeconds: period, run: (slot, signal) => this.runner!.run(slot, signal) } });
      const address = await this.http.listen(options.host ?? "127.0.0.1", options.port);
      this.lifecycle = options.configuration.schedulerEnabled ? "RUNNING" : "DISABLED";
      return address;
    } catch {
      this.lifecycle = "FAILED"; await this.stop();
      throw new DataError("RUNTIME_STARTUP", "PostgreSQL runtime startup failed; no initialization or fallback was attempted.");
    }
  }
  stop(): Promise<void> {
    if (this.closing) return this.closing;
    const failed = this.lifecycle === "FAILED";
    this.lifecycle = failed ? "FAILED" : "STOPPING";
    this.closing = (async () => {
      const jobs = await Promise.allSettled([this.runner?.stop(), this.http?.close()]);
      const pools = await Promise.allSettled([this.database?.close()]);
      const error = failed || [...jobs, ...pools].some(result => result.status === "rejected");
      this.lifecycle = error ? "FAILED" : "STOPPED"; this.finish(error ? 1 : 0);
    })();
    return this.closing;
  }
}
