import type { PositionIdentity } from "../positions/model.js";
import type { QualityStatus } from "../domain/types.js";
import type { OracleAssurance } from "../oracle-assurance/model.js";
/** Bounded chain-progression vocabulary. Only a supplied, independently evaluated state can be ADVANCING;
 * absent progression evidence is UNKNOWN and always blocks recovery estimates (fail closed). */
export declare const CHAIN_PROGRESSION_STATES: readonly ["UNKNOWN", "ADVANCING", "UNCHANGED_WITHIN_WINDOW", "STALLED", "REGRESSED", "CONFLICT"];
export type ChainProgressionState = typeof CHAIN_PROGRESSION_STATES[number];
export interface ProgressionEvidence {
    readonly state: ChainProgressionState;
}
export declare const RECOVERY_ELIGIBILITY_REASONS: readonly ["RECOVERY_POSITION_DATA_BLOCKED", "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH", "RECOVERY_CHAIN_PROGRESSION_UNKNOWN", "RECOVERY_CHAIN_PROGRESSION_STALLED", "RECOVERY_CHAIN_PROGRESSION_REGRESSED", "RECOVERY_CHAIN_PROGRESSION_CONFLICT", "RECOVERY_CHAIN_PROGRESSION_UNCHANGED", "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED", "RECOVERY_ASSURANCE_GATE_NOT_MET", "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED", "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED", "RECOVERY_EVIDENCE_INVALIDATED", "RECOVERY_TIMESTAMP_ANOMALY", "RECOVERY_CONFIGURATION_MISMATCH"];
export type RecoveryEligibilityReason = typeof RECOVERY_ELIGIBILITY_REASONS[number];
export interface RecoveryEligibility {
    readonly eligible: boolean;
    readonly status: "ELIGIBLE" | "BLOCKED";
    readonly reasonCodes: readonly RecoveryEligibilityReason[];
}
export interface SnapshotIdentityEvidence {
    readonly chainId: number;
    readonly account: string;
    readonly marketId: string;
    readonly snapshotIdentifier: string | null;
}
/** A statically blocked eligibility for paths that never reach full evaluation. */
export declare function blockedRecoveryEligibility(reasonCodes: readonly RecoveryEligibilityReason[]): RecoveryEligibility;
/**
 * Strict, all-or-nothing recovery-estimate eligibility. Every condition must independently pass; all failing
 * reason codes are collected. Retrieval age is never an input. With no assurance object, only base conditions
 * and the missing-assurance reason are reported (the assurance sub-conditions cannot be evaluated).
 */
export declare function evaluateRecoveryEligibility(input: {
    phase2QualityOverall: QualityStatus;
    positionComplete: boolean;
    mathematicalRiskState: unknown;
    identity: SnapshotIdentityEvidence;
    expectedSnapshotIdentifier?: string | undefined;
    expectedIdentity?: PositionIdentity | undefined;
    assurance: OracleAssurance | null;
    progression?: ProgressionEvidence | undefined;
}): RecoveryEligibility;
