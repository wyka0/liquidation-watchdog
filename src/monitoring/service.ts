import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { MonitoringConfiguration } from "../config/monitoring.js";
import { parseMonitoringConfiguration } from "../config/monitoring.js";
import type { ThresholdConfiguration } from "../config/risk.js";
import { validateThresholds } from "../config/risk.js";
import { DataError } from "../domain/errors.js";
import { NotificationDispatcher } from "../notifications/dispatcher.js";
import type { NotificationAdapter } from "../notifications/types.js";
import type { MonitorStore } from "../storage/store.js";
import { monitoringPersistence } from "../storage/persistence.js";
import type { MonitoringPersistence } from "../storage/persistence.js";
import type { MonitorLogger } from "./logs.js";
import { diagnosticSchema, monitoringScope } from "./model.js";
import type { Alert, Diagnostic, Observation } from "./model.js";
import { observe } from "./observation.js";
import { inspectMonitored } from "./reader.js";
import { transition } from "./transitions.js";
import { riskSnapshotSchema } from "../risk/snapshot-schema.js";
import { inspectSupplemental } from "../oracle-assurance/supplemental.js";
import type { SupplementalResult } from "../oracle-assurance/supplemental.js";
import { oracleContinuityScope } from "../oracle-assurance/evaluate.js";
import { AuditRpc } from "../oracle-assurance/audit-rpc.js";
import { RequestPacer } from "../chain/transport.js";
import { bounded } from "../operations/deadline.js";
import { operationalCodeSchema } from "../operations/model.js";
import type { WorkerRuntime } from "../operations/model.js";
import type { PositionConfiguration } from "../config/position.js";
import { validatePositionConfiguration } from "../config/position.js";

export interface ServiceOptions {
  configuration: MonitoringConfiguration; thresholds: ThresholdConfiguration; store: MonitorStore;
  position: PositionConfiguration;
  adapters: readonly NotificationAdapter[]; log?: MonitorLogger; now?: () => Date; id?: () => string;
  read?: (block?: bigint, signal?: AbortSignal) => Promise<unknown>; block?: bigint; allowFixture?: boolean;
  supplemental?: (snapshot: unknown) => Promise<SupplementalResult>;
  pause?: (milliseconds: number, signal: AbortSignal) => Promise<void>; random?: () => number;
}
export type AsyncServiceOptions = Omit<ServiceOptions, "store"> & { store: MonitoringPersistence };
export type CycleResult = { skipped: "OVERLAP" | "STOPPED" } | { observation: Observation; alerts: Alert[] };

export class MonitoringService {
  readonly scope: string;
  private readonly dispatcher: NotificationDispatcher;
  private readonly now: () => Date;
  private readonly log: MonitorLogger;
  private readonly configuration: MonitoringConfiguration;
  private active: Promise<CycleResult> | null = null;
  private initialized = false;
  private stopped = false;
  private readonly wake = new AbortController();
  private loop: Promise<void> | null = null;
  private closing: Promise<void> | null = null;
  private readonly abortReads = new AbortController();
  private runtime: WorkerRuntime | null = null;
  private closed = false;
  private readonly store: MonitoringPersistence;

  constructor(private readonly options: ServiceOptions | AsyncServiceOptions) {
    this.configuration = parseMonitoringConfiguration(options.configuration);
    this.store = monitoringPersistence(options.store);
    validateThresholds(options.thresholds);
    validatePositionConfiguration(options.position, options.thresholds);
    if (!options.position.enabled) throw new DataError("POSITION_DISABLED", "The explicitly selected position is disabled; monitoring was not started.");
    this.scope = monitoringScope(options.thresholds, options.block, options.position);
    this.now = options.now ?? (() => new Date());
    this.log = record => { try { options.log?.(record); } catch { /* log sink failure must not rewrite risk state */ } };
    this.dispatcher = new NotificationDispatcher(this.store, options.adapters, this.configuration.notifications, this.now, this.log, options.random);
  }

  private async initialize(signal: AbortSignal): Promise<void> {
    if (this.initialized) return;
    const { thresholds, block } = this.options, store = this.store;
    await store.acquireMonitor();
    this.initialized = true;
    const now = this.now();
    this.runtime = { runId: randomUUID(), scope: this.scope, pid: process.pid, startedAt: now.toISOString(), updatedAt: now.toISOString(), status: "STARTING", error: null, rssBytes: process.memoryUsage().rss };
    await this.updateRuntime("STARTING");
    await store.requireResources(this.configuration.resources);
    for (;;) {
      const unfinished = await store.unfinishedCycles(this.scope);
      if (!unfinished.length) break;
      for (const cycle of unfinished) {
        if (cycle.status === "RUNNING") {
          const previous = await store.state(this.scope);
          const context = block === undefined ? previous.assuranceBaseline?.continuityScope ?? "LIVE" : `HISTORICAL-${block}`;
          const previousAssurance = (await store.latestOracleAssurance(context))?.assurance ?? previous.assuranceBaseline;
          const observation = observe(null, cycle.id, now, thresholds, { diagnostic: "PROCESS_INTERRUPTED", position: this.options.position,
            ...(block === undefined ? {} : { block }),
            ...(previousAssurance ? { previousAssurance } : {}) });
          const next = transition(previous, observation, this.configuration.monitoring, this.scope);
          await store.commitObservation(this.scope, observation, previous.revision, next.state, next.alerts, this.dispatcher.channels);
        }
        await store.finishCycle(cycle.id, now.toISOString(), true);
      }
      // Yield between bounded batches so cycle/shutdown deadlines can cancel a large restart backlog.
      await sleep(0, undefined, { signal });
    }
    await store.recoverDeliveries(now.toISOString(), this.configuration.notifications.maxAttempts);
    await this.updateRuntime("IDLE");
    this.log({ timestamp: now.toISOString(), event: "restart_recovery" });
  }

  runOnce(): Promise<CycleResult> {
    if (this.stopped) return Promise.resolve({ skipped: "STOPPED" });
    if (this.active) return Promise.resolve({ skipped: "OVERLAP" });
    this.active = bounded(async signal => {
      const cancel = () => this.store.cancel?.();
      signal.addEventListener("abort", cancel, { once: true });
      try { return await this.cycle(signal); } finally { signal.removeEventListener("abort", cancel); }
    }, this.configuration.operations.cycleTimeoutSeconds * 1_000, "CYCLE_TIMEOUT", this.abortReads.signal)
      .catch(async (error: unknown) => { await this.fail(error); throw error; }).finally(() => { this.active = null; });
    return this.active;
  }
  private async cycle(signal: AbortSignal): Promise<CycleResult> {
    await this.initialize(signal);
    if (this.stopped) return { skipped: "STOPPED" };
    const { thresholds, block } = this.options, store = this.store;
    await store.requireResources(this.configuration.resources);
    const started = this.now(), cycleId = (this.options.id ?? randomUUID)();
    await store.beginCycle(cycleId, this.scope, started.toISOString());
    await this.updateRuntime("READING");
    this.log({ timestamp: started.toISOString(), event: "cycle_started", cycleId });
    const previous = await store.state(this.scope);
    let raw: unknown = null, diagnostic: Diagnostic | undefined;
    let supplemental: SupplementalResult | undefined;
    try { raw = await (this.options.read ? this.options.read(block, signal) : inspectMonitored(block, signal, this.options.position)); } catch (error) {
      const parsed = diagnosticSchema.safeParse(error instanceof DataError ? error.code : null);
      diagnostic = parsed.success ? parsed.data : "SNAPSHOT_UNAVAILABLE";
    }
    if (signal.aborted) throw new DataError("READ_CANCELLED", "Cycle read was cancelled.");
    const candidate = riskSnapshotSchema.safeParse(raw);
    if (candidate.success && candidate.data.block && ((!this.options.read && candidate.data.evidenceKind !== "FIXTURE") || this.options.supplemental)) {
      try { supplemental = await (this.options.supplemental ? this.options.supplemental(raw) : inspectSupplemental(candidate.data, new AuditRpc(fetch, new RequestPacer(), signal))); }
      catch { raw = null; diagnostic = "SNAPSHOT_UNAVAILABLE"; }
    }
    if (signal.aborted) throw new DataError("READ_CANCELLED", "Cycle was cancelled before persistence.");
    const parsed = riskSnapshotSchema.safeParse(raw);
    let observation: Observation;
    const continuityScope = block === undefined ? parsed.success ? oracleContinuityScope(parsed.data.evidenceKind) : previous.assuranceBaseline?.continuityScope ?? "LIVE" : `HISTORICAL-${block}`;
    const previousAssurance = (await store.latestOracleAssurance(continuityScope))?.assurance ?? previous.assuranceBaseline;
    try {
      observation = observe(raw, cycleId, this.now(), thresholds, {
        position: this.options.position,
        previous: previous.lastAccepted, ...(diagnostic ? { diagnostic } : {}),
        ...(previousAssurance ? { previousAssurance } : {}),
        ...(supplemental ? { supplemental } : {}),
        ...(this.configuration.monitoring.oracleLocalMaxAgeSeconds === undefined ? {} : { localMaxAgeSeconds: BigInt(this.configuration.monitoring.oracleLocalMaxAgeSeconds) }),
        ...(block === undefined ? {} : { block }), ...(this.options.allowFixture ? { allowFixture: true } : {})
      });
    } catch {
      observation = observe(null, cycleId, this.now(), thresholds, { diagnostic: "RISK_CALCULATION_FAILED", position: this.options.position,
        ...(previousAssurance ? { previousAssurance } : {}), ...(block === undefined ? {} : { block }) });
    }
    const next = transition(previous, observation, this.configuration.monitoring, this.scope);
    await store.requireResources(this.configuration.resources);
    if (signal.aborted || this.closed) throw new DataError("READ_CANCELLED", "Cycle was cancelled before persistence.");
    const alerts = await store.commitObservation(this.scope, observation, previous.revision, next.state, next.alerts, this.dispatcher.channels);
    await this.updateRuntime("DELIVERING");
    this.log({ timestamp: observation.observedAt, event: "cycle_observed", cycleId, accepted: observation.accepted,
      blockNumber: observation.risk.blockNumber, blockHash: observation.risk.blockHash,
      mathematicalRiskState: observation.risk.mathematicalRiskState, dataQuality: observation.risk.dataQuality,
      oracleQuality: observation.risk.oracleQuality, diagnostics: observation.diagnostics });
    for (const alert of alerts) this.log({ timestamp: alert.createdAt, event: "alert_created", cycleId, alertId: alert.id });
    await this.dispatcher.drain();
    if (signal.aborted || this.closed) throw new DataError("READ_CANCELLED", "Cycle was cancelled before completion.");
    const completed = this.now();
    await store.finishCycle(cycleId, completed.toISOString());
    await store.prune(completed.toISOString(), this.configuration.storage.cycleRetentionDays, this.configuration.storage.alertRetentionDays);
    await this.updateRuntime("IDLE");
    this.log({ timestamp: completed.toISOString(), event: "cycle_completed", cycleId, durationMs: Math.max(0, completed.getTime() - started.getTime()), accepted: observation.accepted });
    return { observation, alerts };
  }

  runContinuous(): Promise<void> {
    if (!this.configuration.monitoring.enabled) throw new DataError("MONITOR_DISABLED", "Continuous monitoring is opt-in; use --enable or monitoring.enabled=true. --once explicitly requests one cycle.");
    if (this.options.block !== undefined) throw new DataError("MONITOR_HISTORICAL", "Historical monitoring is limited to an explicitly requested --once cycle.");
    if (this.loop) throw new DataError("MONITOR_ALREADY_RUNNING", "The monitoring scheduler is already running.");
    this.loop = this.schedule().catch(async (error: unknown) => { await this.fail(error); throw error; }).finally(() => { this.loop = null; });
    return this.loop;
  }
  private async schedule(): Promise<void> {
    let nextCycle = this.now().getTime();
    while (!this.stopped) {
      if (this.now().getTime() >= nextCycle) {
        await this.runOnce();
        if (this.stopped) break;
        const failures = (await this.store.state(this.scope)).consecutiveFailures;
        const base = this.configuration.monitoring.intervalSeconds;
        const backoff = failures < this.configuration.monitoring.maxConsecutiveFailures ? base
          : Math.min(Math.max(base, this.configuration.operations.failureBackoffMaxSeconds), base * 2 ** Math.min(failures, 10));
        const sample = (this.options.random ?? Math.random)(), jitter = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5;
        nextCycle = this.now().getTime() + Math.ceil(Math.min(Math.max(base, this.configuration.operations.failureBackoffMaxSeconds), backoff * (1 + jitter * 0.2)) * 1_000);
      } else await this.dispatcher.drain();
      if (this.stopped) break;
      const due = await this.store.nextDeliveryAt(this.dispatcher.channels);
      const delay = Math.max(1, Math.min(nextCycle, due === null ? nextCycle : Date.parse(due)) - this.now().getTime());
      try {
        await (this.options.pause ?? (async (milliseconds, signal) => { await sleep(milliseconds, undefined, { signal }); }))(delay, this.wake.signal);
      } catch (error) { if (!this.stopped) throw error; }
    }
  }
  private async updateRuntime(status: WorkerRuntime["status"], error: WorkerRuntime["error"] = null): Promise<void> {
    if (!this.runtime || this.closed) return;
    this.runtime = { ...this.runtime, updatedAt: this.now().toISOString(), status, error, rssBytes: process.memoryUsage().rss };
    await this.store.saveRuntime(this.runtime);
  }
  private async fail(error: unknown): Promise<void> {
    this.requestStop(); this.abortReads.abort(); this.dispatcher.abort();
    if (this.closed || this.runtime?.status === "FAILED") return;
    const parsed = operationalCodeSchema.safeParse(error instanceof DataError ? error.code : null);
    const code = parsed.success ? parsed.data : "WORKER_FAILED";
    try { await this.updateRuntime("FAILED", code); } catch { /* persistence may itself be unavailable; never reset the database */ }
    this.log({ timestamp: this.now().toISOString(), event: "operational_failure", code });
  }
  requestStop(): void { this.stopped = true; this.wake.abort(); this.dispatcher.stop(); }
  /** Scheduler/job cancellation also fences the asynchronous persistence adapter. */
  abort(): void { this.requestStop(); this.abortReads.abort(); this.dispatcher.abort(); this.store.cancel?.(); }
  shutdown(): Promise<void> {
    if (this.closing) return this.closing;
    this.requestStop();
    this.closing = this.settleAndClose();
    return this.closing;
  }
  private async settleAndClose(): Promise<void> {
    try {
      const outcomes = await bounded(() => Promise.allSettled([this.active, this.loop]), this.configuration.operations.shutdownTimeoutSeconds * 1_000, "SHUTDOWN_TIMEOUT");
      const failed = outcomes.find(outcome => outcome.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    } catch (error) {
      this.dispatcher.abort(); await this.fail(error); throw error;
    } finally {
      this.abortReads.abort(); this.dispatcher.abort();
      try { if (this.runtime?.status !== "FAILED") await this.updateRuntime("STOPPED"); }
      finally { this.closed = true; await this.store.close(); this.log({ timestamp: this.now().toISOString(), event: "shutdown" }); }
    }
  }
}
