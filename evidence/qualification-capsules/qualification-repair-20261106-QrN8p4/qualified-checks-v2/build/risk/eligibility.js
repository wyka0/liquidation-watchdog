import { DEMO_POSITION_IDENTITY } from "../positions/model.js";
import { canCalculate } from "../validation/quality.js";
/** Bounded chain-progression vocabulary. Only a supplied, independently evaluated state can be ADVANCING;
 * absent progression evidence is UNKNOWN and always blocks recovery estimates (fail closed). */
export const CHAIN_PROGRESSION_STATES = ["UNKNOWN", "ADVANCING", "UNCHANGED_WITHIN_WINDOW", "STALLED", "REGRESSED", "CONFLICT"];
export const RECOVERY_ELIGIBILITY_REASONS = [
    "RECOVERY_POSITION_DATA_BLOCKED", "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH",
    "RECOVERY_CHAIN_PROGRESSION_UNKNOWN", "RECOVERY_CHAIN_PROGRESSION_STALLED", "RECOVERY_CHAIN_PROGRESSION_REGRESSED",
    "RECOVERY_CHAIN_PROGRESSION_CONFLICT", "RECOVERY_CHAIN_PROGRESSION_UNCHANGED",
    "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED", "RECOVERY_ASSURANCE_GATE_NOT_MET", "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED",
    "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED", "RECOVERY_EVIDENCE_INVALIDATED", "RECOVERY_TIMESTAMP_ANOMALY",
    "RECOVERY_CONFIGURATION_MISMATCH"
];
const blocked = (reasonCodes) => ({ eligible: false, status: "BLOCKED", reasonCodes: Object.freeze([...new Set(reasonCodes)]) });
/** A statically blocked eligibility for paths that never reach full evaluation. */
export function blockedRecoveryEligibility(reasonCodes) {
    return blocked(reasonCodes);
}
const PROGRESSION_REASON = {
    UNKNOWN: "RECOVERY_CHAIN_PROGRESSION_UNKNOWN",
    STALLED: "RECOVERY_CHAIN_PROGRESSION_STALLED", REGRESSED: "RECOVERY_CHAIN_PROGRESSION_REGRESSED",
    CONFLICT: "RECOVERY_CHAIN_PROGRESSION_CONFLICT", UNCHANGED_WITHIN_WINDOW: "RECOVERY_CHAIN_PROGRESSION_UNCHANGED"
};
/**
 * Strict, all-or-nothing recovery-estimate eligibility. Every condition must independently pass; all failing
 * reason codes are collected. Retrieval age is never an input. With no assurance object, only base conditions
 * and the missing-assurance reason are reported (the assurance sub-conditions cannot be evaluated).
 */
export function evaluateRecoveryEligibility(input) {
    const reasons = [];
    // 1. Position data complete and not stale/unavailable/invalid. Oracle epistemics are conditions 4-9, not this one.
    if (!input.positionComplete || !canCalculate(input.phase2QualityOverall) || input.mathematicalRiskState === null
        || input.mathematicalRiskState === undefined)
        reasons.push("RECOVERY_POSITION_DATA_BLOCKED");
    // 2. Snapshot identity binds exactly one configured position (protocol/chain/market/account pinned deployment).
    const expected = input.expectedIdentity ?? DEMO_POSITION_IDENTITY;
    const identityOk = input.identity.snapshotIdentifier !== null && input.identity.chainId === expected.chainId
        && input.identity.account.toLowerCase() === expected.account.toLowerCase()
        && input.identity.marketId.toLowerCase() === expected.marketId.toLowerCase()
        && (input.expectedSnapshotIdentifier === undefined || input.expectedSnapshotIdentifier === input.identity.snapshotIdentifier);
    if (!identityOk)
        reasons.push("RECOVERY_SNAPSHOT_IDENTITY_MISMATCH");
    // 3. Chain progression. Absent or non-advancing progression always blocks; it is never inferred from retrieval age.
    const progressionState = input.progression?.state ?? "UNKNOWN";
    if (progressionState !== "ADVANCING")
        reasons.push(progressionState === "UNKNOWN" ? "RECOVERY_CHAIN_PROGRESSION_UNKNOWN"
            : PROGRESSION_REASON[progressionState]);
    const assurance = input.assurance;
    if (assurance === null)
        return blocked([...reasons, "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED"]);
    // 4-7. Explicit verified oracle assurance, gate, freshness and independent validation.
    if (assurance.overall !== "VERIFIED")
        reasons.push("RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED");
    if (assurance.gate !== "ASSURANCE_REQUIREMENTS_MET")
        reasons.push("RECOVERY_ASSURANCE_GATE_NOT_MET");
    if (assurance.freshness.state !== "VERIFIED")
        reasons.push("RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED");
    if (assurance.independent.state !== "VERIFIED" || !assurance.independent.eligible)
        reasons.push("RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED");
    // 8. Evidence invalidated, configuration changes or a sticky invalidation latch.
    if (assurance.evidenceInvalidated || assurance.invalidatedAt !== null || assurance.invalidationReason !== null
        || assurance.changes.length > 0)
        reasons.push("RECOVERY_EVIDENCE_INVALIDATED");
    // 9. Timestamp anomalies and configuration-binding mismatch.
    if (assurance.freshness.anomalies.length > 0)
        reasons.push("RECOVERY_TIMESTAMP_ANOMALY");
    if (assurance.configuration === null || assurance.configurationFingerprint === null
        || assurance.freshness.timingConfigurationFingerprint !== assurance.configurationFingerprint)
        reasons.push("RECOVERY_CONFIGURATION_MISMATCH");
    return reasons.length ? blocked(reasons)
        : { eligible: true, status: "ELIGIBLE", reasonCodes: Object.freeze([]) };
}
//# sourceMappingURL=eligibility.js.map