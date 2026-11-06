import { parseThresholds, validateThresholds } from "../config/risk.js";
import type { ThresholdConfiguration } from "../config/risk.js";
import { DataError } from "../domain/errors.js";
import type { Finding, Snapshot } from "../domain/types.js";
import { WAD } from "../morpho/math.js";
import { canCalculate } from "../validation/quality.js";
import { freezeResult, riskProvenance, snapshotIdentifier } from "./provenance.js";
import { riskSnapshotSchema } from "./snapshot-schema.js";
import { blockedRecoveryEligibility, evaluateRecoveryEligibility } from "./eligibility.js";
import type { RecoveryEligibilityReason } from "./eligibility.js";
import { classifyMathematicalRisk, effectiveRiskState } from "./thresholds.js";
import type { Actionability, RiskDataQuality, RiskResult } from "./types.js";
import { validateRiskSnapshot } from "./validate.js";
import { demoPositionConfiguration } from "../config/position.js";
import type { PositionConfiguration } from "../config/position.js";

export const ORACLE_LIMITATION = "The selected oracle's economic source, operator identities and heartbeat remain UNVERIFIED. All derived calculations are indicative and non-actionable.";

export interface RiskOptions {
  calculatedAt?: Date;
  expectedSnapshotIdentifier?: string;
  position?: PositionConfiguration;
}

function actionability(quality: RiskDataQuality, hasMath: boolean): Actionability {
  return {
    actionable: false, status: hasMath && canCalculate(quality.overall) ? "INDICATIVE_ONLY" : "BLOCKED",
    reasons: [ORACLE_LIMITATION, "Phase 2 produces snapshot-bound calculations only; mathematical bands do not establish liquidation eligibility or protection.",
      ...(!canCalculate(quality.overall) ? [`Data quality ${quality.overall} blocks recovery estimates.`] : [])]
  };
}

const BASE_BLOCKED_REASONS: readonly RecoveryEligibilityReason[] = ["RECOVERY_POSITION_DATA_BLOCKED", "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH",
  "RECOVERY_CHAIN_PROGRESSION_UNKNOWN", "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED"];

function emptyResult(raw: unknown, thresholds: ThresholdConfiguration, calculatedAt: string, unavailable: boolean,
  position: PositionConfiguration): RiskResult {
  const status = unavailable ? "UNAVAILABLE" : "INVALID";
  const findings: Finding[] = [{
    scope: "snapshot", status, code: unavailable ? "SNAPSHOT_UNAVAILABLE" : "SNAPSHOT_SHAPE_INVALID",
    message: unavailable ? "No input snapshot was supplied." : "Snapshot fields are malformed, out of range, or are not typed bigint data."
  }];
  const dataQuality: RiskDataQuality = { overall: status, oracle: "UNVERIFIED", sourceSnapshot: status, findings };
  return {
    ...riskProvenance(raw, null, position), schemaVersion: 1, calculationVersion: "1.0.0", calculatedAt, ratioScale: WAD,
    collateralAmount: null, collateralValue: null, debtAmount: null, liquidationCapacity: null, ltv: null, safetyRatio: null,
    capacityRelation: null, mathematicalRiskState: null, riskState: unavailable ? "DATA_UNAVAILABLE" : "DATA_INVALID",
    dataQuality, actionability: actionability(dataQuality, false), actionable: false, indicative: true,
    oracleAddress: position.identity.oracleAddress, oraclePrice: null, oracleTimestamp: null, oraclePolicy: null,
    tokens: { loan: null, collateral: null }, thresholdConfiguration: thresholds,
    recoveryEligibility: blockedRecoveryEligibility(BASE_BLOCKED_REASONS),
    repayment: null, additionalCollateral: null,
    warnings: [ORACLE_LIMITATION, ...findings.map(finding => `${finding.code}: ${finding.message}`)]
  };
}

/** Base-only eligibility: records why estimates are absent. Assurance and progression are evaluated by
 * calculateAssuredRisk; direct calculateRisk callers always see the assurance/progression reasons. */
function withBaseEligibility(result: RiskResult, snapshot: Snapshot | null, position: PositionConfiguration, expected?: string): RiskResult {
  const positionComplete = Boolean(snapshot?.position && snapshot.accounting && snapshot.valuation && snapshot.params
    && snapshot.block && snapshot.tokens.loan && snapshot.tokens.collateral && snapshot.oracle.price !== null && snapshot.oracle.round);
  result.recoveryEligibility = evaluateRecoveryEligibility({
    phase2QualityOverall: result.dataQuality.overall, positionComplete, mathematicalRiskState: result.mathematicalRiskState,
    identity: { chainId: result.chainId, account: result.account, marketId: result.marketId, snapshotIdentifier: result.inputSnapshotIdentifier },
    expectedSnapshotIdentifier: expected, expectedIdentity: position.identity, assurance: null, progression: undefined
  });
  return result;
}

/** Public base-risk API. Pure, read-only, schema-validated, and always non-actionable.
 * It never computes recovery estimates: repayment and additionalCollateral are null here by design. */
export function calculateRisk(raw: unknown, thresholds: ThresholdConfiguration = parseThresholds(), options: RiskOptions = {}): RiskResult {
  validateThresholds(thresholds);
  const selectedPosition = options.position ?? demoPositionConfiguration(thresholds);
  const now = options.calculatedAt ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new DataError("CALCULATION_CLOCK", "A valid calculation timestamp is required.");
  const result = emptyResult(raw, thresholds, now.toISOString(), raw === null || raw === undefined, selectedPosition);
  if (raw === null || raw === undefined) return freezeResult(result);
  const parsed = riskSnapshotSchema.safeParse(raw);
  if (!parsed.success) return freezeResult(result);
  const snapshot = parsed.data; // Zod's parsed copy prevents validation from mutating Phase 1 input.
  let identifier: string;
  try { identifier = snapshotIdentifier(snapshot); } catch { return freezeResult(result); }
  Object.assign(result, riskProvenance(snapshot, identifier, selectedPosition));
  result.dataQuality = validateRiskSnapshot(snapshot, now, selectedPosition);
  result.oracleAddress = snapshot.oracle.address;
  result.oraclePrice = snapshot.oracle.price;
  result.oracleTimestamp = snapshot.oracle.round?.updatedAt ?? null;
  result.oraclePolicy = snapshot.oracle.policy;
  result.collateralAmount = snapshot.position?.collateral ?? null;
  result.tokens = snapshot.tokens;
  if (options.expectedSnapshotIdentifier !== undefined && options.expectedSnapshotIdentifier !== identifier) {
    result.dataQuality.overall = "INVALID";
    result.dataQuality.findings.push({ scope: "consistency", status: "INVALID", code: "SNAPSHOT_IDENTIFIER_MISMATCH", message: "The input differs from the explicitly bound snapshot identifier." });
  }
  result.warnings = [ORACLE_LIMITATION, ...new Set(result.dataQuality.findings.map(finding => `${finding.code}: ${finding.message}`))];
  if (result.temporalContext === "HISTORICAL") result.warnings.push("HISTORICAL calculation: this explicitly requested block is not a current position assessment.");
  if (result.temporalContext === "FIXTURE") result.warnings.push("FIXTURE: deterministic test inputs, not live-chain evidence.");
  result.riskState = effectiveRiskState(result.dataQuality.overall, null);
  result.actionability = actionability(result.dataQuality, false);
  if (["INVALID", "UNAVAILABLE"].includes(result.dataQuality.overall)) return freezeResult(withBaseEligibility(result, null, selectedPosition, options.expectedSnapshotIdentifier));
  const { accounting, valuation, position, params, block, tokens } = snapshot;
  if (!accounting || !valuation || !position || !params || !block || !tokens.loan || !tokens.collateral || snapshot.oracle.price === null || !snapshot.oracle.round) {
    return freezeResult(withBaseEligibility(result, snapshot, selectedPosition, options.expectedSnapshotIdentifier));
  }
  try {
    result.mathematicalRiskState = classifyMathematicalRisk(valuation.maxBorrow, accounting.debt, thresholds);
  } catch (error) {
    result.dataQuality.overall = "INVALID";
    const message = error instanceof DataError ? `${error.code}: ${error.message}` : "Risk threshold arithmetic failed.";
    result.dataQuality.findings.push({ scope: "accounting", status: "INVALID", code: "RISK_ARITHMETIC_INVALID", message });
    result.warnings.push(message);
    result.riskState = "DATA_INVALID";
    result.actionability = actionability(result.dataQuality, false);
    return freezeResult(withBaseEligibility(result, snapshot, selectedPosition, options.expectedSnapshotIdentifier));
  }
  result.collateralValue = valuation.collateralValue;
  result.debtAmount = accounting.debt;
  result.liquidationCapacity = valuation.maxBorrow;
  result.ltv = valuation.ltvWad;
  result.safetyRatio = valuation.safetyRatioWad;
  result.capacityRelation = accounting.debt === 0n ? "NO_DEBT" : valuation.maxBorrow < accounting.debt ? "BELOW_DEBT"
    : valuation.maxBorrow === accounting.debt ? "EQUAL_TO_DEBT" : "ABOVE_DEBT";
  result.riskState = effectiveRiskState(result.dataQuality.overall, result.mathematicalRiskState);
  result.actionability = actionability(result.dataQuality, true);
  return freezeResult(withBaseEligibility(result, snapshot, selectedPosition, options.expectedSnapshotIdentifier));
}
