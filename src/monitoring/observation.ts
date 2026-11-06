import type { ThresholdConfiguration } from "../config/risk.js";
import { evaluateObservedProgression, persistedProgression } from "../chain/progression.js";
import { calculateAssuredRisk } from "../risk/assured.js";
import { evaluateAssurance } from "../oracle-assurance/evaluate.js";
import type { OracleAssurance } from "../oracle-assurance/model.js";
import type { SupplementalResult } from "../oracle-assurance/supplemental.js";
import { riskSnapshotSchema } from "../risk/snapshot-schema.js";
import { canCalculate } from "../validation/quality.js";
import { diagnosticSchema, observationSchema, riskView } from "./model.js";
import type { Diagnostic, Observation } from "./model.js";
import type { PositionConfiguration } from "../config/position.js";

/** Phase 2 owns all validation and financial arithmetic. This gate owns only monitoring context. */
export function observe(raw: unknown, cycleId: string, now: Date, thresholds: ThresholdConfiguration,
  options: { block?: bigint; diagnostic?: Diagnostic; previous?: Observation | null; allowFixture?: boolean;
    previousAssurance?: OracleAssurance; supplemental?: SupplementalResult; localMaxAgeSeconds?: bigint;
    position?: PositionConfiguration } = {}): Observation {
  const assurance = evaluateAssurance(raw, { now, previous: options.previousAssurance ?? options.previous?.assurance ?? null,
    ...(options.position ? { position: options.position } : {}),
    ...(options.supplemental ? { supplemental: options.supplemental } : {}),
    ...(options.block === undefined ? {} : { block: options.block }),
    ...(options.localMaxAgeSeconds === undefined ? {} : { localMaxAgeSeconds: options.localMaxAgeSeconds }) });
  // Chain progression comes from validated snapshot evidence against the last accepted baseline. It is computed
  // before risk so the strict recovery-estimate gate receives the real state; absence stays UNKNOWN (fail closed).
  const progression = evaluateObservedProgression({ baseline: acceptedBaseline(options.previous), observed: snapshotProgressionEvidence(raw) });
  const result = calculateAssuredRisk(raw, assurance, thresholds, { calculatedAt: now, progression: { state: progression.state },
    ...(options.position ? { position: options.position } : {}) });
  const risk = riskView(result);
  risk.phase2DataQuality = result.phase2DataQuality.overall;
  risk.phase2OracleQuality = result.phase2DataQuality.oracle;
  const diagnostics = new Set<Diagnostic>(["ORACLE_UNVERIFIED", "ORACLE_FRESHNESS_UNKNOWN"]);
  if (options.diagnostic) diagnostics.add(options.diagnostic);
  for (const finding of result.dataQuality.findings) {
    const known = diagnosticSchema.safeParse(finding.code);
    if (known.success) diagnostics.add(known.data);
  }
  let accepted = canCalculate(result.dataQuality.overall) && result.mathematicalRiskState !== null;
  const reject = (diagnostic: Diagnostic) => {
    accepted = false;
    diagnostics.add(diagnostic);
    risk.dataQuality = "INVALID";
    risk.effectiveRiskState = "DATA_INVALID";
    risk.actionability = "BLOCKED";
    risk.repayment = null;
    risk.additionalCollateral = null;
  };
  if (risk.temporalContext !== "UNAVAILABLE" && !(risk.temporalContext === "FIXTURE" && options.allowFixture)
    && (options.block === undefined ? risk.temporalContext !== "LIVE_AS_OF_BLOCK"
      : risk.temporalContext !== "HISTORICAL" || risk.blockNumber !== options.block.toString())) reject("MONITOR_MODE_MISMATCH");
  if (result.phase2DataQuality.overall === "STALE" && !(result.oraclePolicy?.heartbeatVerified
    && result.oraclePolicy.heartbeatSeconds !== null && result.oraclePolicy.timestampSemanticsVerified)) {
    reject("FRESHNESS_UNDETERMINED");
    if (risk.oracleQuality === "STALE" || risk.phase2OracleQuality === "STALE") risk.oracleQuality = "UNVERIFIED";
  }
  // Refuse a backwards head or a different hash or timestamp at an already accepted height. Same full header is permitted.
  const before = options.previous?.risk;
  if (options.block === undefined && before?.blockNumber && risk.blockNumber) {
    if (BigInt(risk.blockNumber) < BigInt(before.blockNumber)
      || (risk.blockNumber === before.blockNumber && risk.blockHash !== before.blockHash)) reject("BLOCK_REGRESSION");
    else if (before.blockTimestamp && risk.blockTimestamp && BigInt(risk.blockTimestamp) < BigInt(before.blockTimestamp)) {
      // A strictly lower timestamp can never advance the chain; the accepted baseline must survive unchanged.
      reject("BLOCK_TIMESTAMP_REGRESSION");
    }
  }
  if (!accepted) diagnostics.add(risk.dataQuality === "INVALID" ? "SNAPSHOT_INVALID" : "SNAPSHOT_UNAVAILABLE");
  if (risk.oracleQuality === "UNAVAILABLE") diagnostics.add("ORACLE_DATA_UNAVAILABLE");
  if (risk.oracleQuality === "INVALID") diagnostics.add("ORACLE_DATA_INVALID");
  return observationSchema.parse({ cycleId, observedAt: now.toISOString(), accepted, risk, diagnostics: [...diagnostics],
    progression: persistedProgression(progression, now), assurance });
}

/** Baselines come only from accepted observations; a missing/incomplete provenance record yields no baseline. */
function acceptedBaseline(previous: Observation | null | undefined) {
  const risk = previous && previous.accepted ? previous.risk : null;
  return risk && risk.blockNumber !== null && risk.blockHash !== null && risk.blockTimestamp !== null
    ? { blockNumber: BigInt(risk.blockNumber), blockHash: risk.blockHash, blockTimestamp: BigInt(risk.blockTimestamp),
      sameBlockStreak: previous!.progression?.sameBlockStreak ?? 0 } : null;
}

/** Extracts the cross-checked snapshot fields progression evaluates; malformed input yields null evidence. */
function snapshotProgressionEvidence(raw: unknown): Parameters<typeof evaluateObservedProgression>[0]["observed"] {
  const parsed = riskSnapshotSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.block) return null;
  const { block, heads, observedChainIds } = parsed.data;
  if (!block) return null;
  return { blockNumber: block.number, blockHash: block.hash, blockTimestamp: block.timestamp,
    headRpc: heads.rpc, headMcp: heads.mcp, chainIdRpc: observedChainIds.rpc, chainIdMcp: observedChainIds.mcp };
}
