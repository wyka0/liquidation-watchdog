import { parseMonitoringConfiguration } from "../config/monitoring.js";
import { validateThresholds } from "../config/risk.js";
import { DataError } from "../domain/errors.js";
import { monitoringScope } from "../monitoring/model.js";
import { MonitoringService } from "../monitoring/service.js";
import { PgConnection } from "../storage/postgres/connection.js";
import { PostgresDatabase } from "../storage/postgres/database.js";
import { PostgresSchedulerStore } from "../storage/postgres/scheduler-store.js";
import { PostgresMonitorStore } from "../storage/postgres/store.js";
import { readAuthenticator } from "./auth.js";
import { ReadHttpServer } from "./http.js";
import { AsyncPersistedReadModel } from "./read-model.js";
import { schedulerAuthenticator } from "./scheduler-contract.js";
import { SchedulerRunner } from "./scheduler.js";
import { validatePositionConfiguration } from "../config/position.js";
/** Inert construction and lazy pools; no migration, SQLite open or cycle at startup. */
export class PostgresRuntime {
    options;
    lifecycle = "STOPPED";
    database = null;
    runner = null;
    http = null;
    started = false;
    closing = null;
    finish;
    done = new Promise(resolve => { this.finish = resolve; });
    notificationChannels;
    constructor(options) {
        this.options = options;
        this.notificationChannels = Object.freeze(options.adapters.map(adapter => adapter.channel));
    }
    status() { return this.lifecycle; }
    async start() {
        if (this.started || this.closing)
            throw new DataError("RUNTIME_ALREADY_RUNNING", "This PostgreSQL runtime was already started or stopped.");
        this.started = true;
        this.lifecycle = "STARTING";
        try {
            const options = this.options;
            if (options.configuration.backend !== "postgres")
                throw new DataError("POSTGRES_CONFIG", "PostgreSQL must be explicitly selected.");
            // Fail closed on the injected thresholds before any pool, listener or database work.
            validateThresholds(options.thresholds);
            validatePositionConfiguration(options.position, options.thresholds);
            if (!options.position.enabled && options.configuration.schedulerEnabled)
                throw new DataError("POSITION_DISABLED", "The selected position is disabled; scheduler monitoring cannot start.");
            const authenticate = readAuthenticator(options.readCredential);
            const schedulerAuth = schedulerAuthenticator(options.schedulerCredential, options.readCredential);
            // The A2 cadence remains authoritative while all other reviewed policy, notification and resource values
            // come from the one resolved non-secret monitoring configuration.
            const base = parseMonitoringConfiguration(options.monitoring);
            const configuration = parseMonitoringConfiguration({ ...base,
                monitoring: { ...base.monitoring, enabled: options.configuration.schedulerEnabled,
                    intervalSeconds: options.configuration.slotPeriodSeconds },
                operations: { ...base.operations, cycleTimeoutSeconds: 240, chainStatusMaxAgeSeconds: 600, shutdownTimeoutSeconds: 10 } });
            const expected = ["console", ...(configuration.notifications.telegram ? ["telegram"] : []),
                ...(configuration.notifications.discord ? ["discord"] : [])];
            if (new Set(this.notificationChannels).size !== this.notificationChannels.length
                || JSON.stringify([...this.notificationChannels].sort()) !== JSON.stringify([...expected].sort())) {
                throw new DataError("POSTGRES_CONFIG", "Notification adapters must exactly match the explicitly enabled channels.");
            }
            this.database = new PostgresDatabase(new PgConnection(options.configuration.writer, "writer"), new PgConnection(options.configuration.reader, "reader"), options.configuration.namespace);
            const db = this.database, thresholds = options.thresholds, period = options.configuration.slotPeriodSeconds;
            this.runner = new SchedulerRunner({ enabled: options.configuration.schedulerEnabled, periodSeconds: period,
                store: new PostgresSchedulerStore(db, monitoringScope(thresholds, undefined, options.position), period), createJob: (fence, signal) => {
                    const store = new PostgresMonitorStore(db, fence, configuration.resources, signal);
                    const service = { configuration, thresholds, position: options.position, store, adapters: options.adapters,
                        ...(options.log ? { log: options.log } : {}), id: () => fence.cycleId };
                    return new MonitoringService(service);
                } });
            this.http = new ReadHttpServer({ api: new AsyncPersistedReadModel(db, configuration, () => this.lifecycle, thresholds, options.position, period), authenticate,
                lifecycle: () => this.lifecycle, scheduler: { authenticate: schedulerAuth, periodSeconds: period, run: (slot, signal) => this.runner.run(slot, signal) } });
            const address = await this.http.listen(options.host ?? "127.0.0.1", options.port);
            this.lifecycle = options.configuration.schedulerEnabled ? "RUNNING" : "DISABLED";
            return address;
        }
        catch {
            this.lifecycle = "FAILED";
            await this.stop();
            throw new DataError("RUNTIME_STARTUP", "PostgreSQL runtime startup failed; no initialization or fallback was attempted.");
        }
    }
    stop() {
        if (this.closing)
            return this.closing;
        const failed = this.lifecycle === "FAILED";
        this.lifecycle = failed ? "FAILED" : "STOPPING";
        this.closing = (async () => {
            const jobs = await Promise.allSettled([this.runner?.stop(), this.http?.close()]);
            const pools = await Promise.allSettled([this.database?.close()]);
            const error = failed || [...jobs, ...pools].some(result => result.status === "rejected");
            this.lifecycle = error ? "FAILED" : "STOPPED";
            this.finish(error ? 1 : 0);
        })();
        return this.closing;
    }
}
//# sourceMappingURL=postgres-runtime.js.map