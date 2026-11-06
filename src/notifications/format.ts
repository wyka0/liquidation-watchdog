import { formatAmount } from "../validation/decimals.js";
import { alertSchema } from "../monitoring/model.js";
import type { Alert } from "../monitoring/model.js";

const reasons: Record<Alert["code"], string> = {
  INITIAL_RISK: "Initial indicative mathematical assessment at the identified block.",
  RISK_WORSENED: "Indicative mathematical risk crossed a more severe configured threshold.",
  RISK_IMPROVED: "Indicative mathematical risk improved relative to the last accepted snapshot.",
  RISK_RECOVERY: "Indicative mathematics returned above the warning threshold; this does not establish safety.",
  NO_DEBT_OBSERVED: "A complete validated position read reports NO_DEBT; this is not a generic safe state.",
  DEBT_OBSERVED: "Debt is present in a complete snapshot following a NO_DEBT observation.",
  CRITICAL_REMINDER: "Configured reminder: indicative mathematical risk remains critical or at the boundary.",
  DATA_QUALITY_CHANGED: "Effective data quality changed independently of mathematical risk.",
  DATA_RESTORED: "Read validation was restored. Oracle verification remains UNVERIFIED.",
  ORACLE_QUALITY_CHANGED: "Oracle data quality changed; successful reads do not verify its economic source or heartbeat.",
  PERSISTENT_READ_FAILURE: "The consecutive read-failure threshold was reached. Current risk cannot be determined.",
  ORACLE_CONFIGURATION_CHANGED: "Observed oracle dependency or configuration changed; assurance evidence is invalidated.",
  PROXY_IMPLEMENTATION_CHANGED: "Observed proxy implementation or beacon changed; source behavior must be re-evaluated.",
  ORACLE_OWNER_CHANGED: "An oracle owner, administrator or workflow-owner control changed.",
  ORACLE_FEED_ID_CHANGED: "The selected feed identifier changed; previous economic-source claims no longer bind.",
  ORACLE_SIGNER_CONFIGURATION_CHANGED: "A sampled signer configuration or authorized forwarding entry changed.",
  ORACLE_DENOMINATION_CHANGED: "Observed token units or denomination-related metadata changed; economic quote requires re-evaluation.",
  ORACLE_TIMESTAMP_ANOMALY: "An observation timestamp is zero, future, inconsistent or regressed.",
  INDEPENDENT_PRICE_DISAGREEMENT: "An eligible normalized independent price exceeded the explicit comparison tolerance; estimates are blocked.",
  ORACLE_ASSURANCE_DETERIORATED: "One or more assurance dimensions deteriorated; independent dimensions remain visible.",
  ORACLE_ASSURANCE_IMPROVED: "Evidence availability or a dimension improved; this does not establish safety or actionability.",
  ORACLE_ASSURANCE_INVALIDATED: "Configuration changed or observability was lost; prior assurance cannot be automatically restored."
};

export function renderAlert(input: Alert): string {
  const alert = alertSchema.parse(input), { current, previous } = alert, r = current.risk;
  const lines = [
    `[${alert.createdAt}] ${alert.severity} | ${alert.id}`,
    `Position: ${r.account}`, `Market: ${r.marketId}`,
    `State: ${previous?.risk.mathematicalRiskState ?? "UNKNOWN"} -> ${r.mathematicalRiskState ?? "UNKNOWN"}${current.accepted ? "" : " (unaccepted diagnostic)"}`,
    `Safety ratio: ${r.safetyRatio === null ? "UNAVAILABLE" : formatAmount(BigInt(r.safetyRatio), 18)}`,
    `Data quality: ${previous?.risk.dataQuality ?? "UNKNOWN"} -> ${r.dataQuality}; effective state: ${r.effectiveRiskState}`,
    `Oracle data: ${r.oracleQuality}; oracle verification: UNVERIFIED; heartbeat: UNKNOWN`,
    `Actionability: false (${r.actionability})`,
    `Snapshot: block ${r.blockNumber ?? "UNKNOWN"}; hash ${r.blockHash ?? "UNKNOWN"}`,
    `Snapshot ID: ${r.snapshotIdentifier ?? "UNKNOWN"}; context: ${r.temporalContext}`,
    `Reason: ${reasons[alert.code]}`,
    `Action: ${alert.suggestedAction.instruction}`,
    `Action evidence: ${alert.suggestedAction.evidence.status}; rationale: ${alert.suggestedAction.rationale}; origin: ${alert.suggestedAction.origin}; actionable: false`
  ];
  if (!current.accepted) lines.push("Current risk cannot be determined. Last accepted mathematics is not a substitute for current data.");
  if (current.assurance) lines.push(`Oracle assurance: ${current.assurance.overall}; freshness: ${current.assurance.freshness.state}; evidence invalidated: ${current.assurance.evidenceInvalidated}.`);
  if (r.temporalContext === "HISTORICAL") lines.push("HISTORICAL observation; not a current position assessment.");
  if (r.temporalContext === "FIXTURE") lines.push("FIXTURE: synthetic test observation, not live evidence.");
  for (const option of alert.suggestedAction.financialOptions) {
    lines.push(`Action option: ${option.type} ${option.amountFormatted} (raw ${option.amountRaw}; token ${option.assetAddress}; decimals ${option.assetDecimals}); block ${option.blockNumber}; snapshot ${option.snapshotIdentifier}; freshness ${option.freshness}; actionable: false.`);
  }
  lines.push("Recovery estimates are snapshot-bound, indicative and non-actionable. RPC/MCP share an upstream; agreement is not independent consensus.");
  return `${lines.join("\n")}\n`;
}
