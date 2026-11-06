import { existsSync } from "node:fs";
import { parseMonitoringConfiguration } from "../config/monitoring.js";
import { requireStartupConfiguration } from "../config/production.js";
import { validateThresholds } from "../config/risk.js";
import { DataError } from "../domain/errors.js";
import { structuredLogger } from "../monitoring/logs.js";
import { MonitoringService } from "../monitoring/service.js";
import { ConsoleAdapter } from "../notifications/adapters.js";
import { MonitorStore } from "../storage/store.js";
import { readAuthenticator } from "./auth.js";
import { ReadHttpServer } from "./http.js";
import { PersistedReadModel } from "./read-model.js";
import { ownWorkspace, prepareWorkspace, verifyWorkspaceReferences } from "./workspace.js";
import { validatePositionConfiguration } from "../config/position.js";
const ownerKey = Symbol.for("liquidation-watchdog.render-runtime-owner");
const processOwner = globalThis;
/** Construction is inert. Exactly one explicit runtime may own this process at a time. */
export class RenderRuntime {
    options;
    lifecycle = "STOPPED";
    started = false;
    stopping = false;
    starting = null;
    closing = null;
    service = null;
    writer = null;
    reader = null;
    http = null;
    releaseWorkspace = null;
    previousDirectory = null;
    failed = false;
    startupAbort = new AbortController();
    finish;
    done = new Promise(resolve => { this.finish = resolve; });
    constructor(options) {
        this.options = options;
    }
    status() { return this.lifecycle; }
    event(event) {
        try {
            this.options.write?.(JSON.stringify({ event: `runtime_${event}`, lifecycle: this.lifecycle }) + "\n");
        }
        catch { /* logging does not control lifecycle */ }
    }
    start() {
        if (this.started || this.stopping || processOwner[ownerKey])
            return Promise.reject(new DataError("RUNTIME_ALREADY_RUNNING", "Only one explicit runtime is permitted in this process."));
        this.started = true;
        processOwner[ownerKey] = this;
        this.lifecycle = "STARTING";
        this.starting = this.initialize().catch(async () => {
            this.failed = true;
            this.lifecycle = "FAILED";
            this.event("failed");
            await this.cleanup();
            this.finish(1);
            throw new DataError("RUNTIME_STARTUP", "Runtime startup failed; no fallback, database initialization or recovery was attempted.");
        });
        return this.starting;
    }
    async initialize() {
        const options = this.options, config = parseMonitoringConfiguration(options.configuration), authenticate = readAuthenticator(options.credential);
        validateThresholds(options.thresholds);
        validatePositionConfiguration(options.position, options.thresholds);
        if (!options.position.enabled && config.monitoring.enabled)
            throw new DataError("POSITION_DISABLED", "The selected position is disabled; monitoring cannot start.");
        if (config.notifications.telegram || config.notifications.discord || config.operations.shutdownTimeoutSeconds > 20
            || (config.operations.profile === "production" && options.fixture))
            throw new DataError("RUNTIME_CONFIG", "Runtime configuration is outside the reviewed local implementation contract.");
        requireStartupConfiguration(config, { thresholds: options.thresholds, position: options.position });
        const workspace = await prepareWorkspace(options, config, this.startupAbort.signal);
        this.releaseWorkspace = ownWorkspace(workspace);
        if (existsSync(workspace.database)) {
            this.reader = new MonitorStore(workspace.database, { readOnly: true, limits: config.resources });
            await verifyWorkspaceReferences(this.reader, workspace.runtimeRoot, this.startupAbort.signal);
            if (config.monitoring.enabled)
                this.writer = new MonitorStore(workspace.database, { existingOnly: true, limits: config.resources });
        }
        else if (config.monitoring.enabled)
            throw new DataError("RUNTIME_DATABASE_MISSING", "An explicitly initialized current-schema database is required.");
        if (this.stopping)
            throw new DataError("RUNTIME_STOPPING", "Startup was interrupted by shutdown.");
        this.previousDirectory = process.cwd();
        process.chdir(workspace.runtimeRoot);
        this.http = new ReadHttpServer({ api: new PersistedReadModel(this.reader, config, () => this.lifecycle, options.thresholds, options.position), authenticate, lifecycle: () => this.lifecycle });
        const address = await this.http.listen(options.host ?? "0.0.0.0", options.port);
        if (this.stopping)
            throw new DataError("RUNTIME_STOPPING", "Startup was interrupted by shutdown.");
        this.lifecycle = config.monitoring.enabled ? "RUNNING" : "DISABLED";
        if (this.writer) {
            this.service = new MonitoringService({ configuration: config, thresholds: options.thresholds, store: this.writer,
                position: options.position,
                adapters: [new ConsoleAdapter(line => { options.write?.(line); })],
                log: structuredLogger(line => { options.write?.(line); }),
                ...(options.fixture ? { ...options.fixture, allowFixture: true } : {}) });
            // Attach rejection handling immediately. A terminal monitor failure cannot hide behind healthy HTTP.
            void this.service.runContinuous().catch(() => { this.failed = true; this.lifecycle = "FAILED"; this.event("failed"); void this.stop(); });
        }
        this.event("started");
        return address;
    }
    stop() {
        if (this.closing)
            return this.closing;
        this.stopping = true;
        this.startupAbort.abort();
        if (!this.failed)
            this.lifecycle = "STOPPING";
        this.event("stopping");
        this.service?.requestStop();
        this.closing = (async () => {
            try {
                await this.starting;
            }
            catch { /* initialize has already cleaned a failed startup */ }
            await this.cleanup();
            this.lifecycle = this.failed ? "FAILED" : "STOPPED";
            this.event(this.failed ? "failed" : "stopped");
            this.finish(this.failed ? 1 : 0);
        })();
        return this.closing;
    }
    async cleanup() {
        try {
            const results = await Promise.allSettled([this.http?.close(), this.service?.shutdown()]);
            if (results.some(result => result.status === "rejected"))
                this.failed = true;
        }
        finally {
            try {
                this.reader?.close();
                if (!this.service)
                    this.writer?.close();
            }
            catch {
                this.failed = true;
            }
            finally {
                this.reader = null;
                this.writer = null;
                this.http = null;
                this.service = null;
                try {
                    this.releaseWorkspace?.();
                }
                catch {
                    this.failed = true;
                }
                this.releaseWorkspace = null;
                if (this.previousDirectory !== null) {
                    try {
                        process.chdir(this.previousDirectory);
                    }
                    catch {
                        this.failed = true;
                    }
                    this.previousDirectory = null;
                }
                if (processOwner[ownerKey] === this)
                    delete processOwner[ownerKey];
            }
        }
    }
}
/** Register only after an explicit invocation, and return exact listener cleanup. */
export function installSignals(runtime, onDeadline) {
    let timer;
    const clear = () => { if (timer) {
        clearTimeout(timer);
        timer = undefined;
    } };
    const stop = () => {
        if (!timer && onDeadline)
            timer = setTimeout(onDeadline, 25_000);
        void runtime.stop().finally(clear);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    return () => { clear(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); };
}
//# sourceMappingURL=service.js.map