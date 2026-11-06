import { z } from "zod";
export declare const suggestedActionRationaleSchema: z.ZodEnum<{
    STRICT_RECOVERY_ELIGIBILITY_PASSED: "STRICT_RECOVERY_ELIGIBILITY_PASSED";
    POSITION_REQUIRES_REVIEW: "POSITION_REQUIRES_REVIEW";
    DATA_REQUIRES_REFRESH: "DATA_REQUIRES_REFRESH";
    ORACLE_REQUIRES_VERIFICATION: "ORACLE_REQUIRES_VERIFICATION";
    CONTINUE_MONITORING: "CONTINUE_MONITORING";
    LEGACY_ALERT_WITHOUT_PERSISTED_ACTION: "LEGACY_ALERT_WITHOUT_PERSISTED_ACTION";
}>;
export declare const actionEvidenceSchema: z.ZodObject<{
    status: z.ZodEnum<{
        QUALIFIED_FINANCIAL: "QUALIFIED_FINANCIAL";
        NOT_QUALIFIED: "NOT_QUALIFIED";
        LEGACY_UNAVAILABLE: "LEGACY_UNAVAILABLE";
    }>;
    cycleId: z.ZodNullable<z.ZodString>;
    chainId: z.ZodNullable<z.ZodLiteral<1672>>;
    account: z.ZodNullable<z.ZodString>;
    marketId: z.ZodNullable<z.ZodString>;
    snapshotIdentifier: z.ZodNullable<z.ZodString>;
    blockNumber: z.ZodNullable<z.ZodString>;
    blockHash: z.ZodNullable<z.ZodString>;
    blockTimestamp: z.ZodNullable<z.ZodString>;
    progressionState: z.ZodNullable<z.ZodEnum<{
        UNKNOWN: "UNKNOWN";
        ADVANCING: "ADVANCING";
        UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
        STALLED: "STALLED";
        REGRESSED: "REGRESSED";
        CONFLICT: "CONFLICT";
    }>>;
    progressionReason: z.ZodNullable<z.ZodEnum<{
        FIRST_OBSERVATION: "FIRST_OBSERVATION";
        NO_SNAPSHOT_EVIDENCE: "NO_SNAPSHOT_EVIDENCE";
        MISSING_PROVIDER_HEAD: "MISSING_PROVIDER_HEAD";
        CHAIN_ID_MISMATCH: "CHAIN_ID_MISMATCH";
        PROVIDER_HEAD_BELOW_SELECTED_BLOCK: "PROVIDER_HEAD_BELOW_SELECTED_BLOCK";
        INVALID_BLOCK_EVIDENCE: "INVALID_BLOCK_EVIDENCE";
        PROVIDER_HEAD_REGRESSION: "PROVIDER_HEAD_REGRESSION";
        BLOCK_NUMBER_REGRESSION: "BLOCK_NUMBER_REGRESSION";
        BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
        SAME_HEIGHT_HASH_CONFLICT: "SAME_HEIGHT_HASH_CONFLICT";
        SAME_BLOCK_RE_READ: "SAME_BLOCK_RE_READ";
        STALL_WINDOW_EXCEEDED: "STALL_WINDOW_EXCEEDED";
        STRICT_ADVANCE: "STRICT_ADVANCE";
    }>>;
    oracleAssurance: z.ZodNullable<z.ZodEnum<{
        UNVERIFIED: "UNVERIFIED";
        VERIFIED: "VERIFIED";
        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
        UNKNOWN: "UNKNOWN";
        FAILED: "FAILED";
    }>>;
    oracleFreshness: z.ZodNullable<z.ZodEnum<{
        UNVERIFIED: "UNVERIFIED";
        VERIFIED: "VERIFIED";
        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
        UNKNOWN: "UNKNOWN";
        FAILED: "FAILED";
    }>>;
    independentValidation: z.ZodNullable<z.ZodEnum<{
        UNVERIFIED: "UNVERIFIED";
        VERIFIED: "VERIFIED";
        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
        UNKNOWN: "UNKNOWN";
        FAILED: "FAILED";
    }>>;
    evidenceInvalidated: z.ZodNullable<z.ZodBoolean>;
    oracleObservationTimestamp: z.ZodNullable<z.ZodString>;
    timestampAnomalies: z.ZodArray<z.ZodEnum<{
        ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
        FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
        TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
        TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
    }>>;
    configurationChanges: z.ZodArray<z.ZodEnum<{
        ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
        PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
        ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
        ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
        ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
        ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
    }>>;
    recoveryEligibility: z.ZodNullable<z.ZodObject<{
        eligible: z.ZodBoolean;
        status: z.ZodEnum<{
            ELIGIBLE: "ELIGIBLE";
            BLOCKED: "BLOCKED";
        }>;
        reasonCodes: z.ZodArray<z.ZodEnum<{
            RECOVERY_POSITION_DATA_BLOCKED: "RECOVERY_POSITION_DATA_BLOCKED";
            RECOVERY_SNAPSHOT_IDENTITY_MISMATCH: "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH";
            RECOVERY_CHAIN_PROGRESSION_UNKNOWN: "RECOVERY_CHAIN_PROGRESSION_UNKNOWN";
            RECOVERY_CHAIN_PROGRESSION_STALLED: "RECOVERY_CHAIN_PROGRESSION_STALLED";
            RECOVERY_CHAIN_PROGRESSION_REGRESSED: "RECOVERY_CHAIN_PROGRESSION_REGRESSED";
            RECOVERY_CHAIN_PROGRESSION_CONFLICT: "RECOVERY_CHAIN_PROGRESSION_CONFLICT";
            RECOVERY_CHAIN_PROGRESSION_UNCHANGED: "RECOVERY_CHAIN_PROGRESSION_UNCHANGED";
            RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED: "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED";
            RECOVERY_ASSURANCE_GATE_NOT_MET: "RECOVERY_ASSURANCE_GATE_NOT_MET";
            RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED: "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED";
            RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED: "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED";
            RECOVERY_EVIDENCE_INVALIDATED: "RECOVERY_EVIDENCE_INVALIDATED";
            RECOVERY_TIMESTAMP_ANOMALY: "RECOVERY_TIMESTAMP_ANOMALY";
            RECOVERY_CONFIGURATION_MISMATCH: "RECOVERY_CONFIGURATION_MISMATCH";
        }>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const suggestedFinancialOptionSchema: z.ZodObject<{
    type: z.ZodEnum<{
        REPAY: "REPAY";
        ADD_COLLATERAL: "ADD_COLLATERAL";
    }>;
    amountRaw: z.ZodString;
    amountFormatted: z.ZodString;
    assetAddress: z.ZodString;
    assetDecimals: z.ZodNumber;
    chainId: z.ZodLiteral<1672>;
    account: z.ZodString;
    marketId: z.ZodString;
    targetRatio: z.ZodString;
    calculationMethod: z.ZodEnum<{
        "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
        "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
    }>;
    snapshotIdentifier: z.ZodString;
    blockNumber: z.ZodString;
    blockHash: z.ZodString;
    calculatedAt: z.ZodISODateTime;
    oracleObservationTimestamp: z.ZodString;
    freshness: z.ZodLiteral<"VERIFIED">;
    condition: z.ZodLiteral<"REFRESH_AND_SIMULATE_BEFORE_ANY_TRANSACTION">;
    actionable: z.ZodLiteral<false>;
}, z.core.$strict>;
export declare const suggestedActionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"NON_FINANCIAL">;
    financialOptions: z.ZodTuple<[], null>;
    schemaVersion: z.ZodLiteral<1>;
    origin: z.ZodEnum<{
        GENERATED: "GENERATED";
        LEGACY_DERIVED: "LEGACY_DERIVED";
    }>;
    instruction: z.ZodString;
    rationale: z.ZodEnum<{
        STRICT_RECOVERY_ELIGIBILITY_PASSED: "STRICT_RECOVERY_ELIGIBILITY_PASSED";
        POSITION_REQUIRES_REVIEW: "POSITION_REQUIRES_REVIEW";
        DATA_REQUIRES_REFRESH: "DATA_REQUIRES_REFRESH";
        ORACLE_REQUIRES_VERIFICATION: "ORACLE_REQUIRES_VERIFICATION";
        CONTINUE_MONITORING: "CONTINUE_MONITORING";
        LEGACY_ALERT_WITHOUT_PERSISTED_ACTION: "LEGACY_ALERT_WITHOUT_PERSISTED_ACTION";
    }>;
    createdAt: z.ZodISODateTime;
    evidence: z.ZodObject<{
        status: z.ZodEnum<{
            QUALIFIED_FINANCIAL: "QUALIFIED_FINANCIAL";
            NOT_QUALIFIED: "NOT_QUALIFIED";
            LEGACY_UNAVAILABLE: "LEGACY_UNAVAILABLE";
        }>;
        cycleId: z.ZodNullable<z.ZodString>;
        chainId: z.ZodNullable<z.ZodLiteral<1672>>;
        account: z.ZodNullable<z.ZodString>;
        marketId: z.ZodNullable<z.ZodString>;
        snapshotIdentifier: z.ZodNullable<z.ZodString>;
        blockNumber: z.ZodNullable<z.ZodString>;
        blockHash: z.ZodNullable<z.ZodString>;
        blockTimestamp: z.ZodNullable<z.ZodString>;
        progressionState: z.ZodNullable<z.ZodEnum<{
            UNKNOWN: "UNKNOWN";
            ADVANCING: "ADVANCING";
            UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
            STALLED: "STALLED";
            REGRESSED: "REGRESSED";
            CONFLICT: "CONFLICT";
        }>>;
        progressionReason: z.ZodNullable<z.ZodEnum<{
            FIRST_OBSERVATION: "FIRST_OBSERVATION";
            NO_SNAPSHOT_EVIDENCE: "NO_SNAPSHOT_EVIDENCE";
            MISSING_PROVIDER_HEAD: "MISSING_PROVIDER_HEAD";
            CHAIN_ID_MISMATCH: "CHAIN_ID_MISMATCH";
            PROVIDER_HEAD_BELOW_SELECTED_BLOCK: "PROVIDER_HEAD_BELOW_SELECTED_BLOCK";
            INVALID_BLOCK_EVIDENCE: "INVALID_BLOCK_EVIDENCE";
            PROVIDER_HEAD_REGRESSION: "PROVIDER_HEAD_REGRESSION";
            BLOCK_NUMBER_REGRESSION: "BLOCK_NUMBER_REGRESSION";
            BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
            SAME_HEIGHT_HASH_CONFLICT: "SAME_HEIGHT_HASH_CONFLICT";
            SAME_BLOCK_RE_READ: "SAME_BLOCK_RE_READ";
            STALL_WINDOW_EXCEEDED: "STALL_WINDOW_EXCEEDED";
            STRICT_ADVANCE: "STRICT_ADVANCE";
        }>>;
        oracleAssurance: z.ZodNullable<z.ZodEnum<{
            UNVERIFIED: "UNVERIFIED";
            VERIFIED: "VERIFIED";
            PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
            UNKNOWN: "UNKNOWN";
            FAILED: "FAILED";
        }>>;
        oracleFreshness: z.ZodNullable<z.ZodEnum<{
            UNVERIFIED: "UNVERIFIED";
            VERIFIED: "VERIFIED";
            PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
            UNKNOWN: "UNKNOWN";
            FAILED: "FAILED";
        }>>;
        independentValidation: z.ZodNullable<z.ZodEnum<{
            UNVERIFIED: "UNVERIFIED";
            VERIFIED: "VERIFIED";
            PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
            UNKNOWN: "UNKNOWN";
            FAILED: "FAILED";
        }>>;
        evidenceInvalidated: z.ZodNullable<z.ZodBoolean>;
        oracleObservationTimestamp: z.ZodNullable<z.ZodString>;
        timestampAnomalies: z.ZodArray<z.ZodEnum<{
            ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
            FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
            TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
            TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
        }>>;
        configurationChanges: z.ZodArray<z.ZodEnum<{
            ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
            PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
            ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
            ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
            ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
            ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
        }>>;
        recoveryEligibility: z.ZodNullable<z.ZodObject<{
            eligible: z.ZodBoolean;
            status: z.ZodEnum<{
                ELIGIBLE: "ELIGIBLE";
                BLOCKED: "BLOCKED";
            }>;
            reasonCodes: z.ZodArray<z.ZodEnum<{
                RECOVERY_POSITION_DATA_BLOCKED: "RECOVERY_POSITION_DATA_BLOCKED";
                RECOVERY_SNAPSHOT_IDENTITY_MISMATCH: "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH";
                RECOVERY_CHAIN_PROGRESSION_UNKNOWN: "RECOVERY_CHAIN_PROGRESSION_UNKNOWN";
                RECOVERY_CHAIN_PROGRESSION_STALLED: "RECOVERY_CHAIN_PROGRESSION_STALLED";
                RECOVERY_CHAIN_PROGRESSION_REGRESSED: "RECOVERY_CHAIN_PROGRESSION_REGRESSED";
                RECOVERY_CHAIN_PROGRESSION_CONFLICT: "RECOVERY_CHAIN_PROGRESSION_CONFLICT";
                RECOVERY_CHAIN_PROGRESSION_UNCHANGED: "RECOVERY_CHAIN_PROGRESSION_UNCHANGED";
                RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED: "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED";
                RECOVERY_ASSURANCE_GATE_NOT_MET: "RECOVERY_ASSURANCE_GATE_NOT_MET";
                RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED: "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED";
                RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED: "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED";
                RECOVERY_EVIDENCE_INVALIDATED: "RECOVERY_EVIDENCE_INVALIDATED";
                RECOVERY_TIMESTAMP_ANOMALY: "RECOVERY_TIMESTAMP_ANOMALY";
                RECOVERY_CONFIGURATION_MISMATCH: "RECOVERY_CONFIGURATION_MISMATCH";
            }>>;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    actionable: z.ZodLiteral<false>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"FINANCIAL_OPTION">;
    financialOptions: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            REPAY: "REPAY";
            ADD_COLLATERAL: "ADD_COLLATERAL";
        }>;
        amountRaw: z.ZodString;
        amountFormatted: z.ZodString;
        assetAddress: z.ZodString;
        assetDecimals: z.ZodNumber;
        chainId: z.ZodLiteral<1672>;
        account: z.ZodString;
        marketId: z.ZodString;
        targetRatio: z.ZodString;
        calculationMethod: z.ZodEnum<{
            "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
            "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
        }>;
        snapshotIdentifier: z.ZodString;
        blockNumber: z.ZodString;
        blockHash: z.ZodString;
        calculatedAt: z.ZodISODateTime;
        oracleObservationTimestamp: z.ZodString;
        freshness: z.ZodLiteral<"VERIFIED">;
        condition: z.ZodLiteral<"REFRESH_AND_SIMULATE_BEFORE_ANY_TRANSACTION">;
        actionable: z.ZodLiteral<false>;
    }, z.core.$strict>>;
    schemaVersion: z.ZodLiteral<1>;
    origin: z.ZodEnum<{
        GENERATED: "GENERATED";
        LEGACY_DERIVED: "LEGACY_DERIVED";
    }>;
    instruction: z.ZodString;
    rationale: z.ZodEnum<{
        STRICT_RECOVERY_ELIGIBILITY_PASSED: "STRICT_RECOVERY_ELIGIBILITY_PASSED";
        POSITION_REQUIRES_REVIEW: "POSITION_REQUIRES_REVIEW";
        DATA_REQUIRES_REFRESH: "DATA_REQUIRES_REFRESH";
        ORACLE_REQUIRES_VERIFICATION: "ORACLE_REQUIRES_VERIFICATION";
        CONTINUE_MONITORING: "CONTINUE_MONITORING";
        LEGACY_ALERT_WITHOUT_PERSISTED_ACTION: "LEGACY_ALERT_WITHOUT_PERSISTED_ACTION";
    }>;
    createdAt: z.ZodISODateTime;
    evidence: z.ZodObject<{
        status: z.ZodEnum<{
            QUALIFIED_FINANCIAL: "QUALIFIED_FINANCIAL";
            NOT_QUALIFIED: "NOT_QUALIFIED";
            LEGACY_UNAVAILABLE: "LEGACY_UNAVAILABLE";
        }>;
        cycleId: z.ZodNullable<z.ZodString>;
        chainId: z.ZodNullable<z.ZodLiteral<1672>>;
        account: z.ZodNullable<z.ZodString>;
        marketId: z.ZodNullable<z.ZodString>;
        snapshotIdentifier: z.ZodNullable<z.ZodString>;
        blockNumber: z.ZodNullable<z.ZodString>;
        blockHash: z.ZodNullable<z.ZodString>;
        blockTimestamp: z.ZodNullable<z.ZodString>;
        progressionState: z.ZodNullable<z.ZodEnum<{
            UNKNOWN: "UNKNOWN";
            ADVANCING: "ADVANCING";
            UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
            STALLED: "STALLED";
            REGRESSED: "REGRESSED";
            CONFLICT: "CONFLICT";
        }>>;
        progressionReason: z.ZodNullable<z.ZodEnum<{
            FIRST_OBSERVATION: "FIRST_OBSERVATION";
            NO_SNAPSHOT_EVIDENCE: "NO_SNAPSHOT_EVIDENCE";
            MISSING_PROVIDER_HEAD: "MISSING_PROVIDER_HEAD";
            CHAIN_ID_MISMATCH: "CHAIN_ID_MISMATCH";
            PROVIDER_HEAD_BELOW_SELECTED_BLOCK: "PROVIDER_HEAD_BELOW_SELECTED_BLOCK";
            INVALID_BLOCK_EVIDENCE: "INVALID_BLOCK_EVIDENCE";
            PROVIDER_HEAD_REGRESSION: "PROVIDER_HEAD_REGRESSION";
            BLOCK_NUMBER_REGRESSION: "BLOCK_NUMBER_REGRESSION";
            BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
            SAME_HEIGHT_HASH_CONFLICT: "SAME_HEIGHT_HASH_CONFLICT";
            SAME_BLOCK_RE_READ: "SAME_BLOCK_RE_READ";
            STALL_WINDOW_EXCEEDED: "STALL_WINDOW_EXCEEDED";
            STRICT_ADVANCE: "STRICT_ADVANCE";
        }>>;
        oracleAssurance: z.ZodNullable<z.ZodEnum<{
            UNVERIFIED: "UNVERIFIED";
            VERIFIED: "VERIFIED";
            PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
            UNKNOWN: "UNKNOWN";
            FAILED: "FAILED";
        }>>;
        oracleFreshness: z.ZodNullable<z.ZodEnum<{
            UNVERIFIED: "UNVERIFIED";
            VERIFIED: "VERIFIED";
            PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
            UNKNOWN: "UNKNOWN";
            FAILED: "FAILED";
        }>>;
        independentValidation: z.ZodNullable<z.ZodEnum<{
            UNVERIFIED: "UNVERIFIED";
            VERIFIED: "VERIFIED";
            PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
            UNKNOWN: "UNKNOWN";
            FAILED: "FAILED";
        }>>;
        evidenceInvalidated: z.ZodNullable<z.ZodBoolean>;
        oracleObservationTimestamp: z.ZodNullable<z.ZodString>;
        timestampAnomalies: z.ZodArray<z.ZodEnum<{
            ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
            FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
            TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
            TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
        }>>;
        configurationChanges: z.ZodArray<z.ZodEnum<{
            ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
            PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
            ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
            ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
            ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
            ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
        }>>;
        recoveryEligibility: z.ZodNullable<z.ZodObject<{
            eligible: z.ZodBoolean;
            status: z.ZodEnum<{
                ELIGIBLE: "ELIGIBLE";
                BLOCKED: "BLOCKED";
            }>;
            reasonCodes: z.ZodArray<z.ZodEnum<{
                RECOVERY_POSITION_DATA_BLOCKED: "RECOVERY_POSITION_DATA_BLOCKED";
                RECOVERY_SNAPSHOT_IDENTITY_MISMATCH: "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH";
                RECOVERY_CHAIN_PROGRESSION_UNKNOWN: "RECOVERY_CHAIN_PROGRESSION_UNKNOWN";
                RECOVERY_CHAIN_PROGRESSION_STALLED: "RECOVERY_CHAIN_PROGRESSION_STALLED";
                RECOVERY_CHAIN_PROGRESSION_REGRESSED: "RECOVERY_CHAIN_PROGRESSION_REGRESSED";
                RECOVERY_CHAIN_PROGRESSION_CONFLICT: "RECOVERY_CHAIN_PROGRESSION_CONFLICT";
                RECOVERY_CHAIN_PROGRESSION_UNCHANGED: "RECOVERY_CHAIN_PROGRESSION_UNCHANGED";
                RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED: "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED";
                RECOVERY_ASSURANCE_GATE_NOT_MET: "RECOVERY_ASSURANCE_GATE_NOT_MET";
                RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED: "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED";
                RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED: "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED";
                RECOVERY_EVIDENCE_INVALIDATED: "RECOVERY_EVIDENCE_INVALIDATED";
                RECOVERY_TIMESTAMP_ANOMALY: "RECOVERY_TIMESTAMP_ANOMALY";
                RECOVERY_CONFIGURATION_MISMATCH: "RECOVERY_CONFIGURATION_MISMATCH";
            }>>;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    actionable: z.ZodLiteral<false>;
}, z.core.$strict>], "type">;
export type SuggestedAction = z.infer<typeof suggestedActionSchema>;
export type SuggestedFinancialOption = z.infer<typeof suggestedFinancialOptionSchema>;
/** Legacy rows are upgraded only after their original bytes/integrity bindings are checked. Never infer an amount. */
export declare function legacySuggestedAction(createdAt: string): SuggestedAction;
