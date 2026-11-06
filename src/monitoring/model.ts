import { createHash } from "node:crypto";
import { z } from "zod";
import { DEPLOYMENT, NETWORK } from "../config/deployment.js";
import type { ThresholdConfiguration } from "../config/risk.js";
import type { RiskResult } from "../risk/types.js";
import { progressionSchema } from "../chain/progression.js";
import type { PersistedProgression } from "../chain/progression.js";
import { assuranceSchema } from "../oracle-assurance/model.js";
import { RECOVERY_ELIGIBILITY_REASONS } from "../risk/eligibility.js";
import { legacySuggestedAction, suggestedActionSchema } from "../actions/model.js";
import { addressSchema } from "../validation/schemas.js";
import { demoPositionConfiguration } from "../config/position.js";
import type { PositionConfiguration } from "../config/position.js";
import { positionAccountRoleSchema } from "../positions/model.js";

export const qualitySchema = z.enum(["VALID", "UNVERIFIED", "STALE", "UNAVAILABLE", "INVALID"]);
export const mathSchema = z.enum(["ABOVE_WARNING", "WARNING", "CRITICAL", "LIQUIDATION_BOUNDARY", "NO_DEBT"]);
export const utcSchema = z.iso.datetime();
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const unsigned = z.string().regex(/^(?:0|[1-9][0-9]{0,77})$/);
const hash = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const snapshotId = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const recoveryEligibilitySchema = z.object({ eligible: z.boolean(), status: z.enum(["ELIGIBLE", "BLOCKED"]),
  reasonCodes: z.array(z.enum(RECOVERY_ELIGIBILITY_REASONS)).max(14) }).strict()
  .refine(value => value.eligible === (value.status === "ELIGIBLE" && value.reasonCodes.length === 0), "Recovery eligibility status must match its reasons.");
const amountSchema = z.object({
  raw: unsigned, formatted: z.string().regex(/^[0-9]+(?:\.[0-9]+)?$/),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/), decimals: z.number().int().min(0).max(77),
  targetRatio: unsigned, calculationMethod: z.enum([
    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint", "morpho-v1.0.0/nested-ceilings/forward-minimality-proof"
  ]), actionable: z.literal(false), indicative: z.literal(true), inputSnapshotIdentifier: snapshotId,
  blockNumber: unsigned, blockHash: hash, calculatedAt: utcSchema
}).strict();

// Persist only validated public fields; no raw transport responses, messages or token metadata text.
export const riskViewSchema = z.object({
  chainId: z.literal(NETWORK.chainId), account: addressSchema, marketId: z.literal(DEPLOYMENT.marketId),
  protocol: z.literal("Morpho Blue"), morphoAddress: z.literal(DEPLOYMENT.morpho), oracleAddress: z.literal(DEPLOYMENT.oracle),
  accountRole: positionAccountRoleSchema, calculationVersion: z.literal("1.0.0"),
  evidenceKind: z.enum(["LIVE_CHAIN_READ", "HISTORICAL_SNAPSHOT", "FIXTURE"]).nullable(),
  mathematicalRiskState: mathSchema.nullable(),
  effectiveRiskState: z.enum(["ABOVE_WARNING", "WARNING", "CRITICAL", "LIQUIDATION_BOUNDARY", "NO_DEBT", "DATA_UNVERIFIED", "DATA_UNAVAILABLE", "DATA_INVALID"]),
  dataQuality: qualitySchema, phase2DataQuality: qualitySchema, oracleQuality: qualitySchema, phase2OracleQuality: qualitySchema,
  oracleVerification: z.literal("UNVERIFIED"), heartbeat: z.literal("UNKNOWN"),
  actionable: z.literal(false), actionability: z.enum(["INDICATIVE_ONLY", "BLOCKED"]),
  safetyRatio: unsigned.nullable(), ltv: unsigned.nullable(), ratioScale: unsigned,
  debtAmount: unsigned.nullable(), collateralAmount: unsigned.nullable(),
  blockNumber: unsigned.nullable(), blockHash: hash.nullable(), blockTimestamp: unsigned.nullable(),
  snapshotIdentifier: snapshotId.nullable(), snapshotRetrievedAt: utcSchema.nullable(), calculatedAt: utcSchema,
  temporalContext: z.enum(["LIVE_AS_OF_BLOCK", "HISTORICAL", "FIXTURE", "UNAVAILABLE"]),
  thresholds: z.object({ warningRatio: z.string().regex(/^[0-9.]+$/), criticalRatio: z.string().regex(/^[0-9.]+$/),
    targetRatio: z.string().regex(/^[0-9.]+$/), liquidationBoundary: z.string().regex(/^[0-9.]+$/) }).strict(),
  repayment: amountSchema.nullable(), additionalCollateral: amountSchema.nullable(), recoveryEligibility: recoveryEligibilitySchema.optional()
}).strict().refine(risk => [risk.repayment, risk.additionalCollateral].every(estimate => estimate === null
  || (estimate.inputSnapshotIdentifier === risk.snapshotIdentifier && estimate.blockNumber === risk.blockNumber
    && estimate.blockHash === risk.blockHash && estimate.calculatedAt === risk.calculatedAt)), "Recovery estimates must match their risk-view provenance.");

export const diagnosticSchema = z.enum([
  "RPC_UNAVAILABLE", "MCP_UNAVAILABLE", "RPC_INVALID", "MCP_INVALID", "SNAPSHOT_INVALID", "SNAPSHOT_UNAVAILABLE",
  "ORACLE_UNVERIFIED", "ORACLE_DATA_UNAVAILABLE", "ORACLE_DATA_INVALID", "ORACLE_FRESHNESS_UNKNOWN",
  "FRESHNESS_UNDETERMINED", "MONITOR_MODE_MISMATCH", "PROCESS_INTERRUPTED", "RISK_CALCULATION_FAILED",
  "BLOCK_REGRESSION", "BLOCK_TIMESTAMP_REGRESSION"
]);
export const observationSchema = z.object({
  cycleId: idSchema, observedAt: utcSchema, accepted: z.boolean(), risk: riskViewSchema, diagnostics: z.array(diagnosticSchema),
  progression: progressionSchema.optional(), assurance: assuranceSchema.optional()
}).strict().refine(observation => !observation.accepted || (observation.risk.mathematicalRiskState !== null
  && ["VALID", "UNVERIFIED"].includes(observation.risk.dataQuality) && observation.risk.snapshotIdentifier !== null
  && observation.risk.blockNumber !== null && observation.risk.blockHash !== null && observation.risk.blockTimestamp !== null
  && observation.risk.snapshotRetrievedAt !== null && observation.risk.evidenceKind !== null), "An accepted observation requires complete calculation provenance.")
  .refine(({ assurance, risk }) => !assurance || (assurance.snapshotIdentifier === risk.snapshotIdentifier
    && (assurance.block?.number ?? null) === risk.blockNumber && (assurance.block?.hash ?? null) === risk.blockHash
    && (assurance.block?.timestamp ?? null) === risk.blockTimestamp && assurance.retrievedAt === risk.snapshotRetrievedAt
    && (!["DATA_INVALID", "DATA_UNAVAILABLE"].includes(assurance.gate) || (risk.actionability === "BLOCKED" && risk.repayment === null && risk.additionalCollateral === null
      && ["INVALID", "UNAVAILABLE"].includes(risk.dataQuality)))), "Oracle assurance and monitored risk must describe the same gated snapshot.");
export const stateSchema = z.object({
  revision: z.number().int().nonnegative(), latest: observationSchema.nullable(), lastAccepted: observationSchema.nullable(),
  consecutiveFailures: z.number().int().nonnegative(),
  episodes: z.object({ risk: z.number().int().nonnegative(), data: z.number().int().nonnegative(), oracle: z.number().int().nonnegative(), failures: z.number().int().nonnegative(), assurance: z.number().int().nonnegative().optional() }).strict(),
  lastCriticalAlertAt: utcSchema.nullable(), assuranceBaseline: assuranceSchema.optional()
}).strict().refine(state => {
  if (state.latest?.assurance && JSON.stringify(state.assuranceBaseline) !== JSON.stringify(state.latest.assurance)) return false;
  if (state.lastAccepted !== null && !state.lastAccepted.accepted) return false;
  if (state.consecutiveFailures > state.revision || Object.values(state.episodes).some(episode => episode !== undefined && episode > state.revision)) return false;
  if (state.revision === 0) return state.latest === null && state.lastAccepted === null && state.lastCriticalAlertAt === null;
  if (state.latest === null) return false;
  if (state.latest.accepted) return state.consecutiveFailures === 0 && JSON.stringify(state.latest) === JSON.stringify(state.lastAccepted);
  return state.consecutiveFailures > 0 && state.latest.cycleId !== state.lastAccepted?.cycleId;
}, "Stored monitoring state must preserve an accepted baseline and consistent latest observation.");
export const alertCodeSchema = z.enum([
  "INITIAL_RISK", "RISK_WORSENED", "RISK_IMPROVED", "RISK_RECOVERY", "NO_DEBT_OBSERVED", "DEBT_OBSERVED", "CRITICAL_REMINDER",
   "DATA_QUALITY_CHANGED", "DATA_RESTORED", "ORACLE_QUALITY_CHANGED", "PERSISTENT_READ_FAILURE",
   "ORACLE_CONFIGURATION_CHANGED", "PROXY_IMPLEMENTATION_CHANGED", "ORACLE_OWNER_CHANGED", "ORACLE_FEED_ID_CHANGED",
   "ORACLE_SIGNER_CONFIGURATION_CHANGED", "ORACLE_DENOMINATION_CHANGED", "ORACLE_TIMESTAMP_ANOMALY", "INDEPENDENT_PRICE_DISAGREEMENT",
   "ORACLE_ASSURANCE_DETERIORATED", "ORACLE_ASSURANCE_IMPROVED", "ORACLE_ASSURANCE_INVALIDATED"
]);
const legacyAlertSchema = z.object({
  id: idSchema, fingerprint: digest, scope: digest, cycleId: idSchema, createdAt: utcSchema,
  severity: z.enum(["INFO", "WARNING", "CRITICAL", "BOUNDARY"]), category: z.enum(["RISK", "DATA_QUALITY", "ORACLE", "MONITOR_HEALTH"]),
  code: alertCodeSchema, previous: observationSchema.nullable(), current: observationSchema
}).strict();
export const alertSchema = legacyAlertSchema.extend({ suggestedAction: suggestedActionSchema }).strict();
/** Parse historical bytes only after their storage hash/integrity check, then add a visibly legacy non-financial action in memory. */
export const storedAlertSchema = z.union([alertSchema, legacyAlertSchema]).transform(alert =>
  "suggestedAction" in alert ? alert : { ...alert, suggestedAction: legacySuggestedAction(alert.createdAt) });

export type RiskView = z.infer<typeof riskViewSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type MonitorState = z.infer<typeof stateSchema>;
export type Alert = z.infer<typeof alertSchema>;
export type Diagnostic = z.infer<typeof diagnosticSchema>;
export type Progression = PersistedProgression;
export type Channel = "console" | "telegram" | "discord";
export const channelSchema = z.enum(["console", "telegram", "discord"]);

export const hashParts = (parts: unknown): string => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
export function monitoringScope(thresholds: ThresholdConfiguration, block?: bigint,
  position: PositionConfiguration = demoPositionConfiguration(thresholds)): string {
  const context = block === undefined ? "LIVE" : `HISTORICAL-${block}`;
  // Preserve the exact historical demo stream. Explicitly configured identities use the canonical v2 identity digest.
  return position.mode === "DEMO"
    ? hashParts(["monitor-v1", NETWORK.chainId, DEPLOYMENT.marketId, DEPLOYMENT.account, thresholds.decimal, context])
    : hashParts(["monitor-v2", position.identity.positionId, thresholds.decimal, context]);
}
export function initialState(): MonitorState {
  return { revision: 0, latest: null, lastAccepted: null, consecutiveFailures: 0, episodes: { risk: 0, data: 0, oracle: 0, failures: 0 }, lastCriticalAlertAt: null };
}

export function riskView(result: RiskResult): RiskView {
  const amount = (estimate: RiskResult["repayment"] | RiskResult["additionalCollateral"]): z.infer<typeof amountSchema> | null => {
    if (estimate?.status !== "CALCULATED" || !estimate.amount) return null;
    return amountSchema.parse({
      raw: estimate.amount.raw.toString(), formatted: estimate.amount.formatted, tokenAddress: estimate.amount.tokenAddress,
      decimals: estimate.amount.decimals, targetRatio: estimate.targetRatio.toString(), calculationMethod: estimate.calculationMethod,
      actionable: false, indicative: true, inputSnapshotIdentifier: estimate.inputSnapshotIdentifier,
      blockNumber: estimate.blockNumber.toString(), blockHash: estimate.blockHash, calculatedAt: estimate.calculatedAt
    });
  };
  return riskViewSchema.parse({
    chainId: result.chainId, account: result.account, marketId: result.marketId,
    protocol: result.protocol, morphoAddress: result.morphoAddress, oracleAddress: result.oracleAddress,
    accountRole: result.accountRole, calculationVersion: result.calculationVersion, evidenceKind: result.evidenceKind,
    mathematicalRiskState: result.mathematicalRiskState, effectiveRiskState: result.riskState,
    dataQuality: result.dataQuality.overall, phase2DataQuality: result.dataQuality.overall,
    oracleQuality: result.dataQuality.oracle, phase2OracleQuality: result.dataQuality.oracle,
    oracleVerification: "UNVERIFIED", heartbeat: "UNKNOWN", actionable: false, actionability: result.actionability.status,
    safetyRatio: result.safetyRatio?.toString() ?? null, ltv: result.ltv?.toString() ?? null, ratioScale: result.ratioScale.toString(),
    debtAmount: result.debtAmount?.toString() ?? null, collateralAmount: result.collateralAmount?.toString() ?? null,
    blockNumber: result.blockNumber?.toString() ?? null, blockHash: result.blockHash, blockTimestamp: result.blockTimestamp?.toString() ?? null,
    snapshotIdentifier: result.inputSnapshotIdentifier, snapshotRetrievedAt: result.snapshotRetrievedAt, calculatedAt: result.calculatedAt,
    temporalContext: result.temporalContext, thresholds: result.thresholdConfiguration.decimal,
    repayment: amount(result.repayment), additionalCollateral: amount(result.additionalCollateral), recoveryEligibility: result.recoveryEligibility
  });
}
