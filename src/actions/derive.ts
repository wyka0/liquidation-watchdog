import { suggestedActionSchema } from "./model.js";
import type { SuggestedAction, SuggestedFinancialOption } from "./model.js";
import type { Alert, Observation } from "../monitoring/model.js";

type AlertCode = Alert["code"];
const financialCodes = new Set<AlertCode>(["INITIAL_RISK", "RISK_WORSENED", "DEBT_OBSERVED", "CRITICAL_REMINDER"]);
const instructions: Record<AlertCode, { instruction: string; rationale: SuggestedAction["rationale"] }> = {
  INITIAL_RISK: { instruction: "Review this position and independently refresh the current chain and oracle state before making any financial decision.", rationale: "POSITION_REQUIRES_REVIEW" },
  RISK_WORSENED: { instruction: "Review this position now; refresh and independently verify current chain and oracle state before considering debt reduction or additional collateral.", rationale: "POSITION_REQUIRES_REVIEW" },
  RISK_IMPROVED: { instruction: "Verify the improved state independently and continue monitoring; improvement does not establish safety.", rationale: "CONTINUE_MONITORING" },
  RISK_RECOVERY: { instruction: "Verify the apparent recovery independently and continue monitoring; do not treat this alert as proof of safety.", rationale: "CONTINUE_MONITORING" },
  NO_DEBT_OBSERVED: { instruction: "Verify the current no-debt position independently and continue monitoring for later debt or data changes.", rationale: "CONTINUE_MONITORING" },
  DEBT_OBSERVED: { instruction: "Review the newly observed debt and independently refresh the position and oracle before considering any financial change.", rationale: "POSITION_REQUIRES_REVIEW" },
  CRITICAL_REMINDER: { instruction: "Review this critical position immediately and independently refresh chain and oracle evidence before considering debt reduction or collateral.", rationale: "POSITION_REQUIRES_REVIEW" },
  DATA_QUALITY_CHANGED: { instruction: "Do not transact from this alert; refresh the position and restore complete valid data before making a decision.", rationale: "DATA_REQUIRES_REFRESH" },
  DATA_RESTORED: { instruction: "Recheck the restored data and independently verify oracle and chain readiness before relying on the position assessment.", rationale: "DATA_REQUIRES_REFRESH" },
  ORACLE_QUALITY_CHANGED: { instruction: "Do not rely on financial estimates; independently verify the oracle source, freshness and configuration.", rationale: "ORACLE_REQUIRES_VERIFICATION" },
  PERSISTENT_READ_FAILURE: { instruction: "Do not transact from this alert; restore provider access and obtain a fresh complete position read.", rationale: "DATA_REQUIRES_REFRESH" },
  ORACLE_CONFIGURATION_CHANGED: { instruction: "Stop financial interpretation and independently review the changed oracle configuration and evidence bindings.", rationale: "ORACLE_REQUIRES_VERIFICATION" },
  PROXY_IMPLEMENTATION_CHANGED: { instruction: "Stop financial interpretation and independently verify the proxy implementation and reviewed source identity.", rationale: "ORACLE_REQUIRES_VERIFICATION" },
  ORACLE_OWNER_CHANGED: { instruction: "Stop financial interpretation and independently verify the changed oracle ownership or workflow control.", rationale: "ORACLE_REQUIRES_VERIFICATION" },
  ORACLE_FEED_ID_CHANGED: { instruction: "Stop financial interpretation and independently verify the selected feed identity and denomination.", rationale: "ORACLE_REQUIRES_VERIFICATION" },
  ORACLE_SIGNER_CONFIGURATION_CHANGED: { instruction: "Stop financial interpretation and independently review the oracle signer and forwarding configuration.", rationale: "ORACLE_REQUIRES_VERIFICATION" },
  ORACLE_DENOMINATION_CHANGED: { instruction: "Stop financial interpretation and independently verify token units, denomination and oracle quote semantics.", rationale: "ORACLE_REQUIRES_VERIFICATION" },
  ORACLE_TIMESTAMP_ANOMALY: { instruction: "Do not transact from this alert; obtain a fresh oracle observation with valid, non-regressing timestamps.", rationale: "ORACLE_REQUIRES_VERIFICATION" },
  INDEPENDENT_PRICE_DISAGREEMENT: { instruction: "Do not transact from this alert; resolve the independent price disagreement and refresh all evidence.", rationale: "ORACLE_REQUIRES_VERIFICATION" },
  ORACLE_ASSURANCE_DETERIORATED: { instruction: "Do not rely on recovery estimates; review the deteriorated assurance dimensions and refresh evidence.", rationale: "ORACLE_REQUIRES_VERIFICATION" },
  ORACLE_ASSURANCE_IMPROVED: { instruction: "Review the improved assurance evidence and continue monitoring; improvement alone does not establish safety.", rationale: "CONTINUE_MONITORING" },
  ORACLE_ASSURANCE_INVALIDATED: { instruction: "Do not transact from this alert; replace and independently verify invalidated oracle evidence.", rationale: "ORACLE_REQUIRES_VERIFICATION" }
};

function evidence(current: Observation, qualified: boolean): SuggestedAction["evidence"] {
  const assurance = current.assurance, risk = current.risk;
  return {
    status: qualified ? "QUALIFIED_FINANCIAL" : "NOT_QUALIFIED", cycleId: current.cycleId,
    chainId: risk.chainId, account: risk.account, marketId: risk.marketId,
    snapshotIdentifier: risk.snapshotIdentifier, blockNumber: risk.blockNumber, blockHash: risk.blockHash, blockTimestamp: risk.blockTimestamp,
    progressionState: current.progression?.state ?? null, progressionReason: current.progression?.reason ?? null,
    oracleAssurance: assurance?.overall ?? null, oracleFreshness: assurance?.freshness.state ?? null,
    independentValidation: assurance?.independent.state ?? null, evidenceInvalidated: assurance?.evidenceInvalidated ?? null,
    oracleObservationTimestamp: assurance?.freshness.observationTimestamp ?? null,
    timestampAnomalies: assurance?.freshness.anomalies ?? [], configurationChanges: assurance?.changes ?? [],
    recoveryEligibility: risk.recoveryEligibility ?? null
  };
}

function qualified(current: Observation, code: AlertCode): boolean {
  const assurance = current.assurance, eligibility = current.risk.recoveryEligibility;
  return current.accepted && financialCodes.has(code)
    && ["WARNING", "CRITICAL", "LIQUIDATION_BOUNDARY"].includes(current.risk.mathematicalRiskState ?? "")
    && eligibility?.eligible === true && eligibility.status === "ELIGIBLE" && eligibility.reasonCodes.length === 0
    && current.progression?.state === "ADVANCING"
    && assurance?.overall === "VERIFIED" && assurance.gate === "ASSURANCE_REQUIREMENTS_MET"
    && assurance.freshness.state === "VERIFIED" && assurance.freshness.observationTimestamp !== null
    && assurance.independent.state === "VERIFIED" && assurance.independent.eligible
    && !assurance.evidenceInvalidated && assurance.invalidatedAt === null && assurance.invalidationReason === null
    && assurance.changes.length === 0 && assurance.freshness.anomalies.length === 0
    && assurance.configuration !== null && assurance.configurationFingerprint !== null
    && assurance.freshness.timingConfigurationFingerprint === assurance.configurationFingerprint;
}

function options(current: Observation): SuggestedFinancialOption[] {
  const risk = current.risk, timestamp = current.assurance!.freshness.observationTimestamp!;
  return [
    ["REPAY", risk.repayment] as const, ["ADD_COLLATERAL", risk.additionalCollateral] as const
  ].flatMap(([type, estimate]) => estimate ? [{ type, amountRaw: estimate.raw, amountFormatted: estimate.formatted,
    assetAddress: estimate.tokenAddress, assetDecimals: estimate.decimals, chainId: risk.chainId,
    account: risk.account, marketId: risk.marketId,
    targetRatio: estimate.targetRatio, calculationMethod: estimate.calculationMethod,
    snapshotIdentifier: estimate.inputSnapshotIdentifier, blockNumber: estimate.blockNumber,
    blockHash: estimate.blockHash, calculatedAt: estimate.calculatedAt,
    oracleObservationTimestamp: timestamp, freshness: "VERIFIED" as const,
    condition: "REFRESH_AND_SIMULATE_BEFORE_ANY_TRANSACTION" as const, actionable: false as const }] : []);
}

export function deriveSuggestedAction(code: AlertCode, current: Observation): SuggestedAction {
  const allowed = qualified(current, code), financialOptions = allowed ? options(current) : [];
  if (financialOptions.length) {
    return suggestedActionSchema.parse({ schemaVersion: 1, origin: "GENERATED", type: "FINANCIAL_OPTION",
      instruction: "After independently refreshing and simulating the bound state, review the listed recovery option or options; do not transact from this alert alone.",
      rationale: "STRICT_RECOVERY_ELIGIBILITY_PASSED", createdAt: current.observedAt,
      evidence: evidence(current, true), financialOptions, actionable: false });
  }
  const fallback = instructions[code];
  return suggestedActionSchema.parse({ schemaVersion: 1, origin: "GENERATED", type: "NON_FINANCIAL",
    instruction: fallback.instruction, rationale: fallback.rationale, createdAt: current.observedAt,
    evidence: evidence(current, false), financialOptions: [], actionable: false });
}
