import { z } from "zod";
import { DEPLOYMENT, NETWORK } from "../config/deployment.js";
import type { MonitoringConfiguration } from "../config/monitoring.js";
import { validateThresholds } from "../config/risk.js";
import type { ThresholdConfiguration } from "../config/risk.js";
import { DataError } from "../domain/errors.js";
import { alertCodeSchema, alertSchema, diagnosticSchema, idSchema, monitoringScope, riskViewSchema, utcSchema } from "../monitoring/model.js";
import type { Observation, RiskView } from "../monitoring/model.js";
import { progressionReasonSchema, progressionStateSchema } from "../chain/progression.js";
import { assuranceStateSchema, changeCodeSchema, DIMENSIONS, timestampAnomalySchema } from "../oracle-assurance/model.js";
import { operationalCodeSchema, runtimeSchema } from "../operations/model.js";
import { deliverySchema } from "../storage/store.js";
import type { MonitorStore } from "../storage/store.js";
import type { Awaitable, ReadSnapshot, SnapshotReader } from "../storage/persistence.js";
import { sequence } from "../storage/postgres/codec.js";
import { slotUtcMinutes } from "./scheduler-contract.js";
import type { PositionConfiguration } from "../config/position.js";
import { validatePositionConfiguration } from "../config/position.js";
import { addressSchema, hashSchema } from "../validation/schemas.js";
import { positionAccountRoleSchema, positionModeSchema } from "../positions/model.js";

export const lifecycleSchema = z.enum(["STARTING", "RUNNING", "DISABLED", "STOPPING", "STOPPED", "FAILED"]);
export type Lifecycle = z.infer<typeof lifecycleSchema>;
export const READ_ROUTES = ["/api/readiness", "/api/monitoring/status", "/api/positions", "/api/risk", "/api/observations", "/api/alerts"] as const;
export type ReadRoute = typeof READ_ROUTES[number];
export interface Page { limit: number; before?: number | string }
export interface ReadReply { status: number; body: unknown }
export interface ReadApi { readonly cursorKind?: "bigint"; read(route: ReadRoute, page?: Page): Awaitable<ReadReply> }

const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const identitySchema = z.object({ positionId: z.string().regex(/^[a-f0-9]{64}$/), mode: positionModeSchema, enabled: z.boolean(),
  chainId: z.literal(NETWORK.chainId), account: addressSchema, marketId: hashSchema,
  protocol: z.literal("MORPHO_BLUE"), protocolAddress: z.literal(DEPLOYMENT.morpho), accountRole: positionAccountRoleSchema,
  loanToken: z.literal(DEPLOYMENT.loanToken), collateralToken: z.literal(DEPLOYMENT.collateralToken),
  loanDecimals: z.literal(DEPLOYMENT.loanDecimals), collateralDecimals: z.literal(DEPLOYMENT.collateralDecimals) }).strict();
const publicIdentity = (position: PositionConfiguration) => identitySchema.parse({ positionId: position.identity.positionId,
  mode: position.mode, enabled: position.enabled, chainId: position.identity.chainId, account: position.identity.account,
  marketId: position.identity.marketId, protocol: position.identity.protocol, protocolAddress: position.identity.protocolAddress,
  accountRole: position.accountRole, loanToken: position.identity.loanToken, collateralToken: position.identity.collateralToken,
  loanDecimals: DEPLOYMENT.loanDecimals, collateralDecimals: DEPLOYMENT.collateralDecimals });
const safetySchema = z.object({ oracleAssurance: z.literal("UNVERIFIED"), freshness: z.literal("UNKNOWN"), actionable: z.literal(false),
  estimates: z.literal("INDICATIVE_ONLY"), providerIndependence: z.literal("RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT") }).strict();
const safety = safetySchema.parse({ oracleAssurance: "UNVERIFIED", freshness: "UNKNOWN", actionable: false,
  estimates: "INDICATIVE_ONLY", providerIndependence: "RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT" });
const metadataSchema = z.object({ asOf: utcSchema, cacheExpiresAt: utcSchema, history: z.boolean(), stale: z.boolean(),
  lastAcceptedAgeSeconds: integer.nullable(), safety: safetySchema }).strict();
const r = riskViewSchema.shape;
const publicRiskSchema = z.object({ mathematicalRiskState: r.mathematicalRiskState, effectiveRiskState: r.effectiveRiskState,
  dataQuality: r.dataQuality, oracleQuality: r.oracleQuality, actionability: r.actionability, actionable: z.literal(false),
  safetyRatio: r.safetyRatio, ltv: r.ltv, ratioScale: r.ratioScale, debtAmount: r.debtAmount, collateralAmount: r.collateralAmount,
  evidenceKind: r.evidenceKind, temporalContext: r.temporalContext, blockNumber: r.blockNumber, blockHash: r.blockHash,
  blockTimestamp: r.blockTimestamp, snapshotIdentifier: r.snapshotIdentifier, snapshotRetrievedAt: r.snapshotRetrievedAt,
  calculatedAt: r.calculatedAt, calculationVersion: r.calculationVersion, thresholds: r.thresholds,
  repayment: r.repayment, additionalCollateral: r.additionalCollateral }).strict();
const assuranceSummarySchema = z.object({ overall: assuranceStateSchema, gate: z.enum(["DATA_UNVERIFIED", "DATA_INVALID", "DATA_UNAVAILABLE", "ASSURANCE_REQUIREMENTS_MET"]),
  dimensions: z.record(z.enum(DIMENSIONS), assuranceStateSchema), changes: z.array(changeCodeSchema).max(6),
  timestampAnomalies: z.array(timestampAnomalySchema).max(4), evidenceInvalidated: z.boolean() }).strict();
const observationSchema = z.object({ cycleId: idSchema, observedAt: utcSchema, accepted: z.boolean(), risk: publicRiskSchema,
  diagnostics: z.array(diagnosticSchema).max(32), assurance: assuranceSummarySchema.nullable() }).strict();
const publicDeliverySchema = z.object({ channel: deliverySchema.shape.channel, status: deliverySchema.shape.status, attempts: integer,
  outcome: z.enum(["PENDING", "DELIVERED", "FAILED", "UNKNOWN"]),
  nextAttemptAt: utcSchema.nullable(), errorCode: deliverySchema.shape.last_error, ambiguous: z.boolean() }).strict();
const historyAlertSchema = z.object({ id: idSchema, cycleId: idSchema, createdAt: utcSchema, severity: alertSchema.shape.severity,
  category: alertSchema.shape.category, code: alertCodeSchema, previous: observationSchema.nullable(), current: observationSchema,
  suggestedAction: alertSchema.shape.suggestedAction, deliveries: z.array(publicDeliverySchema).max(3) }).strict();
const cycleSchema = z.object({ id: idSchema, startedAt: utcSchema, completedAt: utcSchema.nullable(),
  status: z.enum(["RUNNING", "PERSISTED", "COMPLETED", "INTERRUPTED"]) }).strict();
const reasonSchema = z.enum(["MONITOR_DISABLED", "RUNTIME_NOT_RUNNING", "DATABASE_UNAVAILABLE", "NO_ACCEPTED_OBSERVATION",
  "LATEST_OBSERVATION_REJECTED", "OBSERVATION_STALE", "NON_LIVE_OBSERVATION", "CHAIN_PROGRESS_UNKNOWN",
  "CHAIN_STALLED", "CHAIN_REGRESSED", "CHAIN_CONFLICT", "BLOCK_TOO_OLD", "ORACLE_ASSURANCE_UNVERIFIED",
  "ORACLE_FRESHNESS_UNKNOWN"]);
const readinessProgressionSchema = z.object({ state: progressionStateSchema, reason: progressionReasonSchema }).strict();
const readinessAgesSchema = z.object({ retrievalAgeSeconds: integer.nullable(), blockAgeSeconds: integer.nullable() }).strict();
const envelope = { schemaVersion: z.literal(1), identity: identitySchema, meta: metadataSchema };
const positionsSchema = z.object({ ...envelope, latest: observationSchema.nullable(), lastAccepted: observationSchema.nullable() }).strict();
const statusSchema = z.object({ ...envelope, lifecycle: lifecycleSchema, monitoringEnabled: z.boolean(), revision: integer,
  workerStatus: runtimeSchema.shape.status.nullable(), workerError: operationalCodeSchema.nullable(), latestCycle: cycleSchema.nullable(),
  latestObservedAt: utcSchema.nullable(), lastAcceptedObservedAt: utcSchema.nullable(), consecutiveFailures: integer,
   backoffActive: z.boolean(), cadence: z.object({ minimumSecondsAfterCompletion: integer, maximumSecondsAfterCompletion: integer }).strict().nullable(),
   schedule: z.object({ mode: z.literal("EXTERNAL_UTC_SLOTS"), periodSeconds: z.number().int().min(60).max(3_600),
     utcMinutes: z.array(z.number().int().min(0).max(55)).min(1).max(60).refine(minutes => minutes.every((minute, index) => index === 0 || minute > minutes[index - 1]!)) }).strict().optional() }).strict();
const readinessSchema = z.object({ ...envelope, ready: z.boolean(), reasons: z.array(reasonSchema).max(14),
  ages: readinessAgesSchema, progression: readinessProgressionSchema,
  oracleAssurance: assuranceStateSchema, oracleFreshness: assuranceStateSchema }).strict();
const pageFields = { ...envelope, limit: integer.min(1).max(100), nextCursor: z.string().regex(/^[1-9][0-9]{0,18}$/).refine(value => BigInt(value) <= 9_223_372_036_854_775_807n).nullable() };
const observationsSchema = z.object({ ...pageFields, items: z.array(observationSchema).max(100) }).strict();
const alertsSchema = z.object({ ...pageFields, items: z.array(historyAlertSchema).max(100) }).strict();

function publicRisk(risk: RiskView): z.infer<typeof publicRiskSchema> {
  // Select fields, never serialize full observations, assurance graphs or operator diagnostics.
  return publicRiskSchema.parse({ mathematicalRiskState: risk.mathematicalRiskState, effectiveRiskState: risk.effectiveRiskState,
    dataQuality: risk.dataQuality, oracleQuality: risk.oracleQuality, actionability: risk.actionability, actionable: risk.actionable,
    safetyRatio: risk.safetyRatio, ltv: risk.ltv, ratioScale: risk.ratioScale, debtAmount: risk.debtAmount, collateralAmount: risk.collateralAmount,
    evidenceKind: risk.evidenceKind, temporalContext: risk.temporalContext, blockNumber: risk.blockNumber, blockHash: risk.blockHash,
    blockTimestamp: risk.blockTimestamp, snapshotIdentifier: risk.snapshotIdentifier, snapshotRetrievedAt: risk.snapshotRetrievedAt,
    calculatedAt: risk.calculatedAt, calculationVersion: risk.calculationVersion, thresholds: risk.thresholds,
    repayment: risk.repayment, additionalCollateral: risk.additionalCollateral });
}
function observation(value: Observation | null): z.infer<typeof observationSchema> | null {
  if (!value) return null;
  const a = value.assurance;
  return observationSchema.parse({ cycleId: value.cycleId, observedAt: value.observedAt, accepted: value.accepted, risk: publicRisk(value.risk),
    diagnostics: value.diagnostics, assurance: a ? { overall: a.overall, gate: a.gate,
      dimensions: Object.fromEntries(DIMENSIONS.map(name => [name, a.dimensions[name].state])), changes: a.changes,
      timestampAnomalies: a.freshness.anomalies, evidenceInvalidated: a.evidenceInvalidated } : null });
}

export const CACHE_MILLISECONDS = 1_000;

/** Uses only the one existing read-only connection. No probes, provider calls, paths or mutations.
 * Thresholds are injected once at startup; the served scope is exactly the configured runtime scope. */
export class PersistedReadModel implements ReadApi {
  private readonly scope: string;
  private readonly identity: z.infer<typeof identitySchema>;
  constructor(private readonly store: Pick<MonitorStore, "readSnapshot"> | null, private readonly configuration: MonitoringConfiguration,
    private readonly lifecycle: () => Lifecycle, thresholds: ThresholdConfiguration, position: PositionConfiguration,
    private readonly now: () => Date = () => new Date()) {
    validateThresholds(thresholds);
    validatePositionConfiguration(position, thresholds);
    this.scope = monitoringScope(thresholds, undefined, position);
    this.identity = publicIdentity(position);
  }
  read(route: ReadRoute, page: Page = { limit: 20 }): ReadReply {
    if (!READ_ROUTES.includes(route)) throw new DataError("READ_ROUTE", "Unknown read route.");
    if (!Number.isSafeInteger(page.limit) || page.limit < 1 || page.limit > 100
      || (page.before !== undefined && (typeof page.before !== "number" || !Number.isSafeInteger(page.before) || page.before < 1))) throw new DataError("READ_PAGE", "Invalid history page.");
    const history = route === "/api/alerts" || route === "/api/observations";
    const snapshot = this.store?.readSnapshot(this.scope, history ? { kind: route === "/api/alerts" ? "alerts" : "observations", limit: page.limit,
      ...(page.before === undefined ? {} : { before: page.before }) } : undefined);
    return projectReadSnapshot(snapshot, this.configuration, this.lifecycle(), this.now(), route, page, this.identity);
  }
}

/** The PostgreSQL adapter shares every field-selection and safety projection with SQLite. */
export class AsyncPersistedReadModel implements ReadApi {
  readonly cursorKind = "bigint" as const;
  private readonly scope: string;
  private readonly identity: z.infer<typeof identitySchema>;
  constructor(private readonly store: SnapshotReader, private readonly configuration: MonitoringConfiguration,
    private readonly lifecycle: () => Lifecycle, thresholds: ThresholdConfiguration, position: PositionConfiguration, private readonly periodSeconds: number,
    private readonly now: () => Date = () => new Date()) {
    if (configuration.operations.chainStatusMaxAgeSeconds !== 600) throw new DataError("POSTGRES_CONFIG", "The observation-age limit must remain 600 seconds.");
    validateThresholds(thresholds);
    validatePositionConfiguration(position, thresholds);
    this.scope = monitoringScope(thresholds, undefined, position);
    this.identity = publicIdentity(position);
    slotUtcMinutes(this.periodSeconds); // validates the configured cadence once.
  }
  async read(route: ReadRoute, page: Page = { limit: 20 }): Promise<ReadReply> {
    if (!READ_ROUTES.includes(route)) throw new DataError("READ_ROUTE", "Unknown read route.");
    if (!Number.isSafeInteger(page.limit) || page.limit < 1 || page.limit > 100) throw new DataError("READ_PAGE", "Invalid history page.");
    if (typeof page.before === "number" && !Number.isSafeInteger(page.before)) throw new DataError("READ_PAGE", "Unsafe history cursor.");
    const before = page.before === undefined ? undefined : sequence(String(page.before));
    const history = route === "/api/alerts" || route === "/api/observations";
    const snapshot = await this.store.readSnapshot(this.scope, history ? { kind: route === "/api/alerts" ? "alerts" : "observations",
      limit: page.limit, ...(before === undefined ? {} : { before }) } : undefined);
    return projectReadSnapshot(snapshot, this.configuration, this.lifecycle(), this.now(), route, page, this.identity, true, this.periodSeconds);
  }
}

function projectReadSnapshot(snapshot: ReadSnapshot | undefined, configuration: MonitoringConfiguration, lifecycle: Lifecycle, now: Date,
  route: ReadRoute, page: Page, identity: z.infer<typeof identitySchema>, scheduled = false, periodSeconds?: number): ReadReply {
    const history = route === "/api/alerts" || route === "/api/observations", latest = snapshot?.state.latest ?? null, accepted = snapshot?.state.lastAccepted ?? null;
    const age = accepted?.risk.snapshotRetrievedAt ? Math.max(0, Math.floor((now.getTime() - Date.parse(accepted.risk.snapshotRetrievedAt)) / 1_000)) : null;
    const stale = age === null || age > configuration.operations.chainStatusMaxAgeSeconds || latest?.accepted !== true;
    const common = { schemaVersion: 1 as const, identity, meta: { asOf: now.toISOString(), cacheExpiresAt: new Date(now.getTime() + CACHE_MILLISECONDS).toISOString(),
      history, stale, lastAcceptedAgeSeconds: age, safety } };
    if (route === "/api/readiness") {
      // Separate evidence fields: retrieval age is informational; block age and progression are rejection-only
      // inputs. A recent successful retrieval never upgrades readiness or establishes chain progression.
      const progression = accepted?.progression ?? null;
      const progressionState = progression?.state ?? "UNKNOWN";
      const blockAgeSeconds = accepted?.risk.blockTimestamp
        ? Math.max(0, Math.floor((now.getTime() - Number(accepted.risk.blockTimestamp) * 1_000) / 1_000)) : null;
      const reasons: z.infer<typeof reasonSchema>[] = [];
      if (!configuration.monitoring.enabled) reasons.push("MONITOR_DISABLED");
      if (lifecycle !== "RUNNING") reasons.push("RUNTIME_NOT_RUNNING");
      if (!snapshot) reasons.push("DATABASE_UNAVAILABLE");
      if (!accepted) reasons.push("NO_ACCEPTED_OBSERVATION");
      if (latest && !latest.accepted) reasons.push("LATEST_OBSERVATION_REJECTED");
      if (stale) reasons.push("OBSERVATION_STALE");
      if (accepted && accepted.risk.evidenceKind !== "LIVE_CHAIN_READ") reasons.push("NON_LIVE_OBSERVATION");
      if (progressionState === "UNKNOWN") reasons.push("CHAIN_PROGRESS_UNKNOWN");
      else if (progressionState === "STALLED") reasons.push("CHAIN_STALLED");
      else if (progressionState === "REGRESSED") reasons.push("CHAIN_REGRESSED");
      else if (progressionState === "CONFLICT") reasons.push("CHAIN_CONFLICT");
      if (blockAgeSeconds !== null && blockAgeSeconds > configuration.operations.chainStatusMaxAgeSeconds) reasons.push("BLOCK_TOO_OLD");
      const oracleAssurance = accepted?.assurance?.overall ?? "UNVERIFIED";
      const oracleFreshness = accepted?.assurance?.freshness.state ?? "UNKNOWN";
      if (oracleAssurance !== "VERIFIED") reasons.push("ORACLE_ASSURANCE_UNVERIFIED");
      if (oracleFreshness !== "VERIFIED") reasons.push("ORACLE_FRESHNESS_UNKNOWN");
      return { status: reasons.length ? 503 : 200, body: readinessSchema.parse({ ...common, ready: !reasons.length, reasons,
        ages: { retrievalAgeSeconds: age, blockAgeSeconds }, progression: { state: progressionState, reason: progression?.reason ?? null },
        oracleAssurance, oracleFreshness }) };
    }
    if (route === "/api/monitoring/status") {
      const failures = snapshot?.state.consecutiveFailures ?? 0, base = configuration.monitoring.intervalSeconds;
      const maximum = Math.max(base, configuration.operations.failureBackoffMaxSeconds), backoffActive = !scheduled && failures >= configuration.monitoring.maxConsecutiveFailures;
      const delay = backoffActive ? Math.min(maximum, base * 2 ** Math.min(failures, 10)) : base;
      const cycle = snapshot?.latestCycle;
      return { status: 200, body: statusSchema.parse({ ...common, lifecycle, monitoringEnabled: configuration.monitoring.enabled,
        revision: snapshot?.state.revision ?? 0, workerStatus: snapshot?.runtime?.status ?? null, workerError: snapshot?.runtime?.error ?? null,
        latestCycle: cycle ? { id: cycle.id, startedAt: cycle.started_at, completedAt: cycle.completed_at, status: cycle.status } : null,
        latestObservedAt: latest?.observedAt ?? null, lastAcceptedObservedAt: accepted?.observedAt ?? null, consecutiveFailures: failures, backoffActive,
        cadence: scheduled ? null : { minimumSecondsAfterCompletion: delay, maximumSecondsAfterCompletion: Math.ceil(Math.min(maximum, delay * 1.2)) },
        ...(scheduled && periodSeconds !== undefined ? { schedule: { mode: "EXTERNAL_UTC_SLOTS" as const, periodSeconds, utcMinutes: slotUtcMinutes(periodSeconds) } } : {}) }) };
    }
    if (!snapshot) return { status: 503, body: { error: "DATA_UNAVAILABLE" } };
    if (route === "/api/positions" || route === "/api/risk") {
      return { status: 200, body: positionsSchema.parse({ ...common, latest: observation(latest), lastAccepted: observation(accepted) }) };
    }
    const pagination = { ...common, limit: page.limit, nextCursor: snapshot.nextCursor };
    if (route === "/api/observations") return { status: 200, body: observationsSchema.parse({ ...pagination, items: snapshot.observations.map(observation) }) };
    return { status: 200, body: alertsSchema.parse({ ...pagination, items: snapshot.alerts.map(alert => ({ id: alert.id, cycleId: alert.cycleId,
      createdAt: alert.createdAt, severity: alert.severity, category: alert.category, code: alert.code, previous: observation(alert.previous), current: observation(alert.current),
      suggestedAction: alert.suggestedAction,
      deliveries: snapshot.deliveries.filter(delivery => delivery.alert_id === alert.id).map(delivery => ({ channel: delivery.channel, status: delivery.status,
        attempts: delivery.attempts,
        outcome: delivery.status === "DELIVERED" ? "DELIVERED" : delivery.ambiguous === 1 ? "UNKNOWN"
          : ["PENDING", "IN_FLIGHT", "RETRY_SCHEDULED"].includes(delivery.status) ? "PENDING" : "FAILED",
        nextAttemptAt: ["PENDING", "FAILED", "RETRY_SCHEDULED"].includes(delivery.status) ? delivery.next_at : null,
        errorCode: delivery.last_error, ambiguous: delivery.ambiguous === 1 })) })) }) };
}
