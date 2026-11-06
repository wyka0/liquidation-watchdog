import { z } from "zod";
import type { ThresholdConfiguration } from "../config/risk.js";
import type { RiskResult } from "../risk/types.js";
import type { PersistedProgression } from "../chain/progression.js";
import type { PositionConfiguration } from "../config/position.js";
export declare const qualitySchema: z.ZodEnum<{
    VALID: "VALID";
    STALE: "STALE";
    UNAVAILABLE: "UNAVAILABLE";
    INVALID: "INVALID";
    UNVERIFIED: "UNVERIFIED";
}>;
export declare const mathSchema: z.ZodEnum<{
    NO_DEBT: "NO_DEBT";
    ABOVE_WARNING: "ABOVE_WARNING";
    WARNING: "WARNING";
    CRITICAL: "CRITICAL";
    LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
}>;
export declare const utcSchema: z.ZodISODateTime;
export declare const idSchema: z.ZodString;
export declare const riskViewSchema: z.ZodObject<{
    chainId: z.ZodLiteral<1672>;
    account: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
    marketId: z.ZodLiteral<`0x${string}`>;
    protocol: z.ZodLiteral<"Morpho Blue">;
    morphoAddress: z.ZodLiteral<`0x${string}`>;
    oracleAddress: z.ZodLiteral<`0x${string}`>;
    accountRole: z.ZodEnum<{
        PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
        EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
    }>;
    calculationVersion: z.ZodLiteral<"1.0.0">;
    evidenceKind: z.ZodNullable<z.ZodEnum<{
        LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
        HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
        FIXTURE: "FIXTURE";
    }>>;
    mathematicalRiskState: z.ZodNullable<z.ZodEnum<{
        NO_DEBT: "NO_DEBT";
        ABOVE_WARNING: "ABOVE_WARNING";
        WARNING: "WARNING";
        CRITICAL: "CRITICAL";
        LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
    }>>;
    effectiveRiskState: z.ZodEnum<{
        NO_DEBT: "NO_DEBT";
        DATA_UNVERIFIED: "DATA_UNVERIFIED";
        DATA_INVALID: "DATA_INVALID";
        DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
        ABOVE_WARNING: "ABOVE_WARNING";
        WARNING: "WARNING";
        CRITICAL: "CRITICAL";
        LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
    }>;
    dataQuality: z.ZodEnum<{
        VALID: "VALID";
        STALE: "STALE";
        UNAVAILABLE: "UNAVAILABLE";
        INVALID: "INVALID";
        UNVERIFIED: "UNVERIFIED";
    }>;
    phase2DataQuality: z.ZodEnum<{
        VALID: "VALID";
        STALE: "STALE";
        UNAVAILABLE: "UNAVAILABLE";
        INVALID: "INVALID";
        UNVERIFIED: "UNVERIFIED";
    }>;
    oracleQuality: z.ZodEnum<{
        VALID: "VALID";
        STALE: "STALE";
        UNAVAILABLE: "UNAVAILABLE";
        INVALID: "INVALID";
        UNVERIFIED: "UNVERIFIED";
    }>;
    phase2OracleQuality: z.ZodEnum<{
        VALID: "VALID";
        STALE: "STALE";
        UNAVAILABLE: "UNAVAILABLE";
        INVALID: "INVALID";
        UNVERIFIED: "UNVERIFIED";
    }>;
    oracleVerification: z.ZodLiteral<"UNVERIFIED">;
    heartbeat: z.ZodLiteral<"UNKNOWN">;
    actionable: z.ZodLiteral<false>;
    actionability: z.ZodEnum<{
        BLOCKED: "BLOCKED";
        INDICATIVE_ONLY: "INDICATIVE_ONLY";
    }>;
    safetyRatio: z.ZodNullable<z.ZodString>;
    ltv: z.ZodNullable<z.ZodString>;
    ratioScale: z.ZodString;
    debtAmount: z.ZodNullable<z.ZodString>;
    collateralAmount: z.ZodNullable<z.ZodString>;
    blockNumber: z.ZodNullable<z.ZodString>;
    blockHash: z.ZodNullable<z.ZodString>;
    blockTimestamp: z.ZodNullable<z.ZodString>;
    snapshotIdentifier: z.ZodNullable<z.ZodString>;
    snapshotRetrievedAt: z.ZodNullable<z.ZodISODateTime>;
    calculatedAt: z.ZodISODateTime;
    temporalContext: z.ZodEnum<{
        UNAVAILABLE: "UNAVAILABLE";
        FIXTURE: "FIXTURE";
        LIVE_AS_OF_BLOCK: "LIVE_AS_OF_BLOCK";
        HISTORICAL: "HISTORICAL";
    }>;
    thresholds: z.ZodObject<{
        warningRatio: z.ZodString;
        criticalRatio: z.ZodString;
        targetRatio: z.ZodString;
        liquidationBoundary: z.ZodString;
    }, z.core.$strict>;
    repayment: z.ZodNullable<z.ZodObject<{
        raw: z.ZodString;
        formatted: z.ZodString;
        tokenAddress: z.ZodString;
        decimals: z.ZodNumber;
        targetRatio: z.ZodString;
        calculationMethod: z.ZodEnum<{
            "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
            "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
        }>;
        actionable: z.ZodLiteral<false>;
        indicative: z.ZodLiteral<true>;
        inputSnapshotIdentifier: z.ZodString;
        blockNumber: z.ZodString;
        blockHash: z.ZodString;
        calculatedAt: z.ZodISODateTime;
    }, z.core.$strict>>;
    additionalCollateral: z.ZodNullable<z.ZodObject<{
        raw: z.ZodString;
        formatted: z.ZodString;
        tokenAddress: z.ZodString;
        decimals: z.ZodNumber;
        targetRatio: z.ZodString;
        calculationMethod: z.ZodEnum<{
            "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
            "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
        }>;
        actionable: z.ZodLiteral<false>;
        indicative: z.ZodLiteral<true>;
        inputSnapshotIdentifier: z.ZodString;
        blockNumber: z.ZodString;
        blockHash: z.ZodString;
        calculatedAt: z.ZodISODateTime;
    }, z.core.$strict>>;
    recoveryEligibility: z.ZodOptional<z.ZodObject<{
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
export declare const diagnosticSchema: z.ZodEnum<{
    BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
    RPC_UNAVAILABLE: "RPC_UNAVAILABLE";
    MCP_UNAVAILABLE: "MCP_UNAVAILABLE";
    RPC_INVALID: "RPC_INVALID";
    MCP_INVALID: "MCP_INVALID";
    SNAPSHOT_INVALID: "SNAPSHOT_INVALID";
    SNAPSHOT_UNAVAILABLE: "SNAPSHOT_UNAVAILABLE";
    ORACLE_UNVERIFIED: "ORACLE_UNVERIFIED";
    ORACLE_DATA_UNAVAILABLE: "ORACLE_DATA_UNAVAILABLE";
    ORACLE_DATA_INVALID: "ORACLE_DATA_INVALID";
    ORACLE_FRESHNESS_UNKNOWN: "ORACLE_FRESHNESS_UNKNOWN";
    FRESHNESS_UNDETERMINED: "FRESHNESS_UNDETERMINED";
    MONITOR_MODE_MISMATCH: "MONITOR_MODE_MISMATCH";
    PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
    RISK_CALCULATION_FAILED: "RISK_CALCULATION_FAILED";
    BLOCK_REGRESSION: "BLOCK_REGRESSION";
}>;
export declare const observationSchema: z.ZodObject<{
    cycleId: z.ZodString;
    observedAt: z.ZodISODateTime;
    accepted: z.ZodBoolean;
    risk: z.ZodObject<{
        chainId: z.ZodLiteral<1672>;
        account: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
        marketId: z.ZodLiteral<`0x${string}`>;
        protocol: z.ZodLiteral<"Morpho Blue">;
        morphoAddress: z.ZodLiteral<`0x${string}`>;
        oracleAddress: z.ZodLiteral<`0x${string}`>;
        accountRole: z.ZodEnum<{
            PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
            EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
        }>;
        calculationVersion: z.ZodLiteral<"1.0.0">;
        evidenceKind: z.ZodNullable<z.ZodEnum<{
            LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
            HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
            FIXTURE: "FIXTURE";
        }>>;
        mathematicalRiskState: z.ZodNullable<z.ZodEnum<{
            NO_DEBT: "NO_DEBT";
            ABOVE_WARNING: "ABOVE_WARNING";
            WARNING: "WARNING";
            CRITICAL: "CRITICAL";
            LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
        }>>;
        effectiveRiskState: z.ZodEnum<{
            NO_DEBT: "NO_DEBT";
            DATA_UNVERIFIED: "DATA_UNVERIFIED";
            DATA_INVALID: "DATA_INVALID";
            DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
            ABOVE_WARNING: "ABOVE_WARNING";
            WARNING: "WARNING";
            CRITICAL: "CRITICAL";
            LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
        }>;
        dataQuality: z.ZodEnum<{
            VALID: "VALID";
            STALE: "STALE";
            UNAVAILABLE: "UNAVAILABLE";
            INVALID: "INVALID";
            UNVERIFIED: "UNVERIFIED";
        }>;
        phase2DataQuality: z.ZodEnum<{
            VALID: "VALID";
            STALE: "STALE";
            UNAVAILABLE: "UNAVAILABLE";
            INVALID: "INVALID";
            UNVERIFIED: "UNVERIFIED";
        }>;
        oracleQuality: z.ZodEnum<{
            VALID: "VALID";
            STALE: "STALE";
            UNAVAILABLE: "UNAVAILABLE";
            INVALID: "INVALID";
            UNVERIFIED: "UNVERIFIED";
        }>;
        phase2OracleQuality: z.ZodEnum<{
            VALID: "VALID";
            STALE: "STALE";
            UNAVAILABLE: "UNAVAILABLE";
            INVALID: "INVALID";
            UNVERIFIED: "UNVERIFIED";
        }>;
        oracleVerification: z.ZodLiteral<"UNVERIFIED">;
        heartbeat: z.ZodLiteral<"UNKNOWN">;
        actionable: z.ZodLiteral<false>;
        actionability: z.ZodEnum<{
            BLOCKED: "BLOCKED";
            INDICATIVE_ONLY: "INDICATIVE_ONLY";
        }>;
        safetyRatio: z.ZodNullable<z.ZodString>;
        ltv: z.ZodNullable<z.ZodString>;
        ratioScale: z.ZodString;
        debtAmount: z.ZodNullable<z.ZodString>;
        collateralAmount: z.ZodNullable<z.ZodString>;
        blockNumber: z.ZodNullable<z.ZodString>;
        blockHash: z.ZodNullable<z.ZodString>;
        blockTimestamp: z.ZodNullable<z.ZodString>;
        snapshotIdentifier: z.ZodNullable<z.ZodString>;
        snapshotRetrievedAt: z.ZodNullable<z.ZodISODateTime>;
        calculatedAt: z.ZodISODateTime;
        temporalContext: z.ZodEnum<{
            UNAVAILABLE: "UNAVAILABLE";
            FIXTURE: "FIXTURE";
            LIVE_AS_OF_BLOCK: "LIVE_AS_OF_BLOCK";
            HISTORICAL: "HISTORICAL";
        }>;
        thresholds: z.ZodObject<{
            warningRatio: z.ZodString;
            criticalRatio: z.ZodString;
            targetRatio: z.ZodString;
            liquidationBoundary: z.ZodString;
        }, z.core.$strict>;
        repayment: z.ZodNullable<z.ZodObject<{
            raw: z.ZodString;
            formatted: z.ZodString;
            tokenAddress: z.ZodString;
            decimals: z.ZodNumber;
            targetRatio: z.ZodString;
            calculationMethod: z.ZodEnum<{
                "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
            }>;
            actionable: z.ZodLiteral<false>;
            indicative: z.ZodLiteral<true>;
            inputSnapshotIdentifier: z.ZodString;
            blockNumber: z.ZodString;
            blockHash: z.ZodString;
            calculatedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        additionalCollateral: z.ZodNullable<z.ZodObject<{
            raw: z.ZodString;
            formatted: z.ZodString;
            tokenAddress: z.ZodString;
            decimals: z.ZodNumber;
            targetRatio: z.ZodString;
            calculationMethod: z.ZodEnum<{
                "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
            }>;
            actionable: z.ZodLiteral<false>;
            indicative: z.ZodLiteral<true>;
            inputSnapshotIdentifier: z.ZodString;
            blockNumber: z.ZodString;
            blockHash: z.ZodString;
            calculatedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        recoveryEligibility: z.ZodOptional<z.ZodObject<{
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
    diagnostics: z.ZodArray<z.ZodEnum<{
        BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
        RPC_UNAVAILABLE: "RPC_UNAVAILABLE";
        MCP_UNAVAILABLE: "MCP_UNAVAILABLE";
        RPC_INVALID: "RPC_INVALID";
        MCP_INVALID: "MCP_INVALID";
        SNAPSHOT_INVALID: "SNAPSHOT_INVALID";
        SNAPSHOT_UNAVAILABLE: "SNAPSHOT_UNAVAILABLE";
        ORACLE_UNVERIFIED: "ORACLE_UNVERIFIED";
        ORACLE_DATA_UNAVAILABLE: "ORACLE_DATA_UNAVAILABLE";
        ORACLE_DATA_INVALID: "ORACLE_DATA_INVALID";
        ORACLE_FRESHNESS_UNKNOWN: "ORACLE_FRESHNESS_UNKNOWN";
        FRESHNESS_UNDETERMINED: "FRESHNESS_UNDETERMINED";
        MONITOR_MODE_MISMATCH: "MONITOR_MODE_MISMATCH";
        PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
        RISK_CALCULATION_FAILED: "RISK_CALCULATION_FAILED";
        BLOCK_REGRESSION: "BLOCK_REGRESSION";
    }>>;
    progression: z.ZodOptional<z.ZodObject<{
        state: z.ZodEnum<{
            UNKNOWN: "UNKNOWN";
            ADVANCING: "ADVANCING";
            UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
            STALLED: "STALLED";
            REGRESSED: "REGRESSED";
            CONFLICT: "CONFLICT";
        }>;
        reason: z.ZodNullable<z.ZodEnum<{
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
        advancedBlocks: z.ZodNullable<z.ZodString>;
        blockNumber: z.ZodNullable<z.ZodString>;
        blockHash: z.ZodNullable<z.ZodString>;
        blockTimestamp: z.ZodNullable<z.ZodString>;
        headNumber: z.ZodNullable<z.ZodString>;
        baselineBlockNumber: z.ZodNullable<z.ZodString>;
        baselineBlockHash: z.ZodNullable<z.ZodString>;
        sameBlockStreak: z.ZodNumber;
        evaluatedAt: z.ZodISODateTime;
    }, z.core.$strict>>;
    assurance: z.ZodOptional<z.ZodObject<{
        schemaVersion: z.ZodLiteral<1>;
        policyVersion: z.ZodLiteral<"oracle-assurance-v1">;
        chainId: z.ZodLiteral<1672>;
        marketId: z.ZodLiteral<`0x${string}`>;
        oracleAddress: z.ZodLiteral<`0x${string}`>;
        evaluatedAt: z.ZodISODateTime;
        retrievedAt: z.ZodNullable<z.ZodISODateTime>;
        evidenceKind: z.ZodEnum<{
            UNAVAILABLE: "UNAVAILABLE";
            LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
            HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
            FIXTURE: "FIXTURE";
        }>;
        continuityScope: z.ZodString;
        baseline: z.ZodNullable<z.ZodObject<{
            block: z.ZodObject<{
                number: z.ZodString;
                hash: z.ZodString;
                timestamp: z.ZodString;
            }, z.core.$strict>;
            retrievedAt: z.ZodISODateTime;
            snapshotIdentifier: z.ZodString;
            configuration: z.ZodObject<{
                oracle: z.ZodString;
                feed: z.ZodString;
                cache: z.ZodNullable<z.ZodString>;
                forwarder: z.ZodNullable<z.ZodString>;
                feedId: z.ZodNullable<z.ZodString>;
                proxyOwner: z.ZodNullable<z.ZodString>;
                cacheOwner: z.ZodNullable<z.ZodString>;
                forwarderOwner: z.ZodNullable<z.ZodString>;
                allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                proxyImplementation: z.ZodNullable<z.ZodString>;
                proxyAdmin: z.ZodNullable<z.ZodString>;
                proxyBeacon: z.ZodNullable<z.ZodString>;
                oracleRuntime: z.ZodNullable<z.ZodString>;
                proxyRuntime: z.ZodNullable<z.ZodString>;
                cacheRuntime: z.ZodNullable<z.ZodString>;
                forwarderRuntime: z.ZodNullable<z.ZodString>;
                compositionHash: z.ZodNullable<z.ZodString>;
                signerConfigurationHash: z.ZodNullable<z.ZodString>;
                workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                collateralToken: z.ZodNullable<z.ZodString>;
                loanToken: z.ZodNullable<z.ZodString>;
                collateralDecimals: z.ZodNullable<z.ZodNumber>;
                loanDecimals: z.ZodNullable<z.ZodNumber>;
                feedDecimals: z.ZodNullable<z.ZodNumber>;
                denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                descriptionHash: z.ZodNullable<z.ZodString>;
                signerCoverage: z.ZodEnum<{
                    UNOBSERVED: "UNOBSERVED";
                    SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                    COMPLETE: "COMPLETE";
                }>;
            }, z.core.$strict>;
            configurationFingerprint: z.ZodString;
            observationTimestamp: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
        block: z.ZodNullable<z.ZodObject<{
            number: z.ZodString;
            hash: z.ZodString;
            timestamp: z.ZodString;
        }, z.core.$strict>>;
        snapshotIdentifier: z.ZodNullable<z.ZodString>;
        overall: z.ZodEnum<{
            UNVERIFIED: "UNVERIFIED";
            VERIFIED: "VERIFIED";
            PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
            UNKNOWN: "UNKNOWN";
            FAILED: "FAILED";
        }>;
        actionable: z.ZodLiteral<false>;
        gate: z.ZodEnum<{
            DATA_UNVERIFIED: "DATA_UNVERIFIED";
            DATA_INVALID: "DATA_INVALID";
            DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
            ASSURANCE_REQUIREMENTS_MET: "ASSURANCE_REQUIREMENTS_MET";
        }>;
        dimensions: z.ZodObject<{
            CONTRACT_IDENTITY: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            SOURCE_PROVENANCE: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            OPERATOR_PROVENANCE: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            PRICE_SEMANTICS: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            FRESHNESS: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            INDEPENDENT_VALIDATION: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            CONFIGURATION_CONTROL: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
        }, z.core.$strict>;
        configuration: z.ZodNullable<z.ZodObject<{
            oracle: z.ZodString;
            feed: z.ZodString;
            cache: z.ZodNullable<z.ZodString>;
            forwarder: z.ZodNullable<z.ZodString>;
            feedId: z.ZodNullable<z.ZodString>;
            proxyOwner: z.ZodNullable<z.ZodString>;
            cacheOwner: z.ZodNullable<z.ZodString>;
            forwarderOwner: z.ZodNullable<z.ZodString>;
            allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
            proxyImplementation: z.ZodNullable<z.ZodString>;
            proxyAdmin: z.ZodNullable<z.ZodString>;
            proxyBeacon: z.ZodNullable<z.ZodString>;
            oracleRuntime: z.ZodNullable<z.ZodString>;
            proxyRuntime: z.ZodNullable<z.ZodString>;
            cacheRuntime: z.ZodNullable<z.ZodString>;
            forwarderRuntime: z.ZodNullable<z.ZodString>;
            compositionHash: z.ZodNullable<z.ZodString>;
            signerConfigurationHash: z.ZodNullable<z.ZodString>;
            workflowConfigurationHash: z.ZodNullable<z.ZodString>;
            collateralToken: z.ZodNullable<z.ZodString>;
            loanToken: z.ZodNullable<z.ZodString>;
            collateralDecimals: z.ZodNullable<z.ZodNumber>;
            loanDecimals: z.ZodNullable<z.ZodNumber>;
            feedDecimals: z.ZodNullable<z.ZodNumber>;
            denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
            descriptionHash: z.ZodNullable<z.ZodString>;
            signerCoverage: z.ZodEnum<{
                UNOBSERVED: "UNOBSERVED";
                SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                COMPLETE: "COMPLETE";
            }>;
        }, z.core.$strict>>;
        configurationFingerprint: z.ZodNullable<z.ZodString>;
        changes: z.ZodArray<z.ZodEnum<{
            ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
            PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
            ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
            ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
            ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
            ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
        }>>;
        evidenceInvalidated: z.ZodBoolean;
        invalidatedAt: z.ZodNullable<z.ZodISODateTime>;
        invalidationReason: z.ZodNullable<z.ZodEnum<{
            CONFIGURATION_CHANGE: "CONFIGURATION_CHANGE";
            OBSERVABILITY_GAP: "OBSERVABILITY_GAP";
        }>>;
        freshness: z.ZodObject<{
            state: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            observationTimestamp: z.ZodNullable<z.ZodString>;
            observationAgeSeconds: z.ZodNullable<z.ZodString>;
            policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
            policyOrigin: z.ZodEnum<{
                NONE: "NONE";
                OPERATOR_DEFINED_LOCAL_REJECTION: "OPERATOR_DEFINED_LOCAL_REJECTION";
            }>;
            policyRejected: z.ZodBoolean;
            verifiedHeartbeatSeconds: z.ZodNullable<z.ZodString>;
            upstreamFreshnessGuaranteeSeconds: z.ZodNullable<z.ZodString>;
            timestampMeaning: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                WORKFLOW_SUPPLIED_OBSERVATION_TIME: "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
            }>;
            onchainExpiryEnforced: z.ZodNullable<z.ZodBoolean>;
            timingConfigurationFingerprint: z.ZodNullable<z.ZodString>;
            anomalies: z.ZodArray<z.ZodEnum<{
                ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
                FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
                TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
                TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
            }>>;
            evidence: z.ZodArray<z.ZodObject<{
                subjectAddress: z.ZodString;
                chainId: z.ZodNumber;
                source: z.ZodString;
                sourceKind: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    SNAPSHOT: "SNAPSHOT";
                    RPC: "RPC";
                    MCP: "MCP";
                    VERIFIED_SOURCE: "VERIFIED_SOURCE";
                    COMPILER: "COMPILER";
                    OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                    RESEARCH: "RESEARCH";
                    LOCAL_POLICY: "LOCAL_POLICY";
                }>;
                block: z.ZodNullable<z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>>;
                retrievedAt: z.ZodISODateTime;
                method: z.ZodString;
                artifactSha256: z.ZodNullable<z.ZodString>;
                confidence: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        independent: z.ZodObject<{
            state: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            availability: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                AVAILABLE: "AVAILABLE";
                NOT_CONFIGURED: "NOT_CONFIGURED";
            }>;
            sourceId: z.ZodNullable<z.ZodString>;
            eligible: z.ZodBoolean;
            reasons: z.ZodArray<z.ZodString>;
            toleranceBps: z.ZodNullable<z.ZodNumber>;
            morphoPrice: z.ZodNullable<z.ZodString>;
            independentPrice: z.ZodNullable<z.ZodString>;
            candidate: z.ZodNullable<z.ZodObject<{
                id: z.ZodString;
                availability: z.ZodEnum<{
                    UNAVAILABLE: "UNAVAILABLE";
                    AVAILABLE: "AVAILABLE";
                }>;
                base: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                quote: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                kind: z.ZodEnum<{
                    MARKET_PRICE: "MARKET_PRICE";
                    REDEMPTION_RATE: "REDEMPTION_RATE";
                }>;
                denomination: z.ZodEnum<{
                    WHOLE_QUOTE_PER_WHOLE_BASE: "WHOLE_QUOTE_PER_WHOLE_BASE";
                    QUOTE_BASE_UNITS_PER_BASE_UNIT: "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                }>;
                price: z.ZodNullable<z.ZodString>;
                decimals: z.ZodNumber;
                timestamp: z.ZodNullable<z.ZodString>;
                frequencySeconds: z.ZodNullable<z.ZodString>;
                operatorId: z.ZodNullable<z.ZodString>;
                upstreamId: z.ZodNullable<z.ZodString>;
                proofs: z.ZodArray<z.ZodObject<{
                    claim: z.ZodEnum<{
                        ASSET: "ASSET";
                        QUOTE: "QUOTE";
                        DENOMINATION: "DENOMINATION";
                        TIMESTAMP: "TIMESTAMP";
                        FREQUENCY: "FREQUENCY";
                        OPERATOR: "OPERATOR";
                        PROVENANCE: "PROVENANCE";
                        INDEPENDENCE: "INDEPENDENCE";
                    }>;
                    evidence: z.ZodObject<{
                        subjectAddress: z.ZodString;
                        chainId: z.ZodNumber;
                        source: z.ZodString;
                        sourceKind: z.ZodEnum<{
                            FIXTURE: "FIXTURE";
                            SNAPSHOT: "SNAPSHOT";
                            RPC: "RPC";
                            MCP: "MCP";
                            VERIFIED_SOURCE: "VERIFIED_SOURCE";
                            COMPILER: "COMPILER";
                            OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                            RESEARCH: "RESEARCH";
                            LOCAL_POLICY: "LOCAL_POLICY";
                        }>;
                        block: z.ZodNullable<z.ZodObject<{
                            number: z.ZodString;
                            hash: z.ZodString;
                            timestamp: z.ZodString;
                        }, z.core.$strict>>;
                        retrievedAt: z.ZodISODateTime;
                        method: z.ZodString;
                        artifactSha256: z.ZodNullable<z.ZodString>;
                        confidence: z.ZodEnum<{
                            UNKNOWN: "UNKNOWN";
                            PROVEN: "PROVEN";
                            INTERPRETATION: "INTERPRETATION";
                        }>;
                        unresolved: z.ZodArray<z.ZodString>;
                    }, z.core.$strict>;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
            selectedUpstreamId: z.ZodNullable<z.ZodString>;
            base: z.ZodObject<{
                chainId: z.ZodNumber;
                address: z.ZodString;
                decimals: z.ZodNumber;
            }, z.core.$strict>;
            quote: z.ZodObject<{
                chainId: z.ZodNumber;
                address: z.ZodString;
                decimals: z.ZodNumber;
            }, z.core.$strict>;
            evidenceMode: z.ZodEnum<{
                FIXTURE: "FIXTURE";
                PRODUCTION: "PRODUCTION";
            }>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            selectedTimestamp: z.ZodNullable<z.ZodString>;
            candidateAgeSeconds: z.ZodNullable<z.ZodString>;
            timestampSkewSeconds: z.ZodNullable<z.ZodString>;
            policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
            policyMaxSkewSeconds: z.ZodNullable<z.ZodString>;
            normalizedMorpho: z.ZodNullable<z.ZodObject<{
                numerator: z.ZodString;
                denominator: z.ZodString;
            }, z.core.$strict>>;
            normalizedIndependent: z.ZodNullable<z.ZodObject<{
                numerator: z.ZodString;
                denominator: z.ZodString;
            }, z.core.$strict>>;
            deviationBps: z.ZodNullable<z.ZodString>;
            disagrees: z.ZodBoolean;
            evidence: z.ZodArray<z.ZodObject<{
                subjectAddress: z.ZodString;
                chainId: z.ZodNumber;
                source: z.ZodString;
                sourceKind: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    SNAPSHOT: "SNAPSHOT";
                    RPC: "RPC";
                    MCP: "MCP";
                    VERIFIED_SOURCE: "VERIFIED_SOURCE";
                    COMPILER: "COMPILER";
                    OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                    RESEARCH: "RESEARCH";
                    LOCAL_POLICY: "LOCAL_POLICY";
                }>;
                block: z.ZodNullable<z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>>;
                retrievedAt: z.ZodISODateTime;
                method: z.ZodString;
                artifactSha256: z.ZodNullable<z.ZodString>;
                confidence: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        findings: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            subjectAddress: z.ZodString;
            statement: z.ZodString;
            classification: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                PROVEN: "PROVEN";
                INTERPRETATION: "INTERPRETATION";
            }>;
            evidence: z.ZodArray<z.ZodObject<{
                subjectAddress: z.ZodString;
                chainId: z.ZodNumber;
                source: z.ZodString;
                sourceKind: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    SNAPSHOT: "SNAPSHOT";
                    RPC: "RPC";
                    MCP: "MCP";
                    VERIFIED_SOURCE: "VERIFIED_SOURCE";
                    COMPILER: "COMPILER";
                    OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                    RESEARCH: "RESEARCH";
                    LOCAL_POLICY: "LOCAL_POLICY";
                }>;
                block: z.ZodNullable<z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>>;
                retrievedAt: z.ZodISODateTime;
                method: z.ZodString;
                artifactSha256: z.ZodNullable<z.ZodString>;
                confidence: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
            unresolved: z.ZodArray<z.ZodString>;
        }, z.core.$strict>>;
        limitations: z.ZodArray<z.ZodString>;
        providerIndependence: z.ZodLiteral<"RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT">;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const stateSchema: z.ZodObject<{
    revision: z.ZodNumber;
    latest: z.ZodNullable<z.ZodObject<{
        cycleId: z.ZodString;
        observedAt: z.ZodISODateTime;
        accepted: z.ZodBoolean;
        risk: z.ZodObject<{
            chainId: z.ZodLiteral<1672>;
            account: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
            marketId: z.ZodLiteral<`0x${string}`>;
            protocol: z.ZodLiteral<"Morpho Blue">;
            morphoAddress: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            accountRole: z.ZodEnum<{
                PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
                EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            }>;
            calculationVersion: z.ZodLiteral<"1.0.0">;
            evidenceKind: z.ZodNullable<z.ZodEnum<{
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>>;
            mathematicalRiskState: z.ZodNullable<z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>>;
            effectiveRiskState: z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>;
            dataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2DataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2OracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleVerification: z.ZodLiteral<"UNVERIFIED">;
            heartbeat: z.ZodLiteral<"UNKNOWN">;
            actionable: z.ZodLiteral<false>;
            actionability: z.ZodEnum<{
                BLOCKED: "BLOCKED";
                INDICATIVE_ONLY: "INDICATIVE_ONLY";
            }>;
            safetyRatio: z.ZodNullable<z.ZodString>;
            ltv: z.ZodNullable<z.ZodString>;
            ratioScale: z.ZodString;
            debtAmount: z.ZodNullable<z.ZodString>;
            collateralAmount: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            snapshotRetrievedAt: z.ZodNullable<z.ZodISODateTime>;
            calculatedAt: z.ZodISODateTime;
            temporalContext: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                FIXTURE: "FIXTURE";
                LIVE_AS_OF_BLOCK: "LIVE_AS_OF_BLOCK";
                HISTORICAL: "HISTORICAL";
            }>;
            thresholds: z.ZodObject<{
                warningRatio: z.ZodString;
                criticalRatio: z.ZodString;
                targetRatio: z.ZodString;
                liquidationBoundary: z.ZodString;
            }, z.core.$strict>;
            repayment: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            additionalCollateral: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            recoveryEligibility: z.ZodOptional<z.ZodObject<{
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
        diagnostics: z.ZodArray<z.ZodEnum<{
            BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
            RPC_UNAVAILABLE: "RPC_UNAVAILABLE";
            MCP_UNAVAILABLE: "MCP_UNAVAILABLE";
            RPC_INVALID: "RPC_INVALID";
            MCP_INVALID: "MCP_INVALID";
            SNAPSHOT_INVALID: "SNAPSHOT_INVALID";
            SNAPSHOT_UNAVAILABLE: "SNAPSHOT_UNAVAILABLE";
            ORACLE_UNVERIFIED: "ORACLE_UNVERIFIED";
            ORACLE_DATA_UNAVAILABLE: "ORACLE_DATA_UNAVAILABLE";
            ORACLE_DATA_INVALID: "ORACLE_DATA_INVALID";
            ORACLE_FRESHNESS_UNKNOWN: "ORACLE_FRESHNESS_UNKNOWN";
            FRESHNESS_UNDETERMINED: "FRESHNESS_UNDETERMINED";
            MONITOR_MODE_MISMATCH: "MONITOR_MODE_MISMATCH";
            PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
            RISK_CALCULATION_FAILED: "RISK_CALCULATION_FAILED";
            BLOCK_REGRESSION: "BLOCK_REGRESSION";
        }>>;
        progression: z.ZodOptional<z.ZodObject<{
            state: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                ADVANCING: "ADVANCING";
                UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
                STALLED: "STALLED";
                REGRESSED: "REGRESSED";
                CONFLICT: "CONFLICT";
            }>;
            reason: z.ZodNullable<z.ZodEnum<{
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
            advancedBlocks: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            headNumber: z.ZodNullable<z.ZodString>;
            baselineBlockNumber: z.ZodNullable<z.ZodString>;
            baselineBlockHash: z.ZodNullable<z.ZodString>;
            sameBlockStreak: z.ZodNumber;
            evaluatedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        assurance: z.ZodOptional<z.ZodObject<{
            schemaVersion: z.ZodLiteral<1>;
            policyVersion: z.ZodLiteral<"oracle-assurance-v1">;
            chainId: z.ZodLiteral<1672>;
            marketId: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            evaluatedAt: z.ZodISODateTime;
            retrievedAt: z.ZodNullable<z.ZodISODateTime>;
            evidenceKind: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>;
            continuityScope: z.ZodString;
            baseline: z.ZodNullable<z.ZodObject<{
                block: z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>;
                retrievedAt: z.ZodISODateTime;
                snapshotIdentifier: z.ZodString;
                configuration: z.ZodObject<{
                    oracle: z.ZodString;
                    feed: z.ZodString;
                    cache: z.ZodNullable<z.ZodString>;
                    forwarder: z.ZodNullable<z.ZodString>;
                    feedId: z.ZodNullable<z.ZodString>;
                    proxyOwner: z.ZodNullable<z.ZodString>;
                    cacheOwner: z.ZodNullable<z.ZodString>;
                    forwarderOwner: z.ZodNullable<z.ZodString>;
                    allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                    proxyImplementation: z.ZodNullable<z.ZodString>;
                    proxyAdmin: z.ZodNullable<z.ZodString>;
                    proxyBeacon: z.ZodNullable<z.ZodString>;
                    oracleRuntime: z.ZodNullable<z.ZodString>;
                    proxyRuntime: z.ZodNullable<z.ZodString>;
                    cacheRuntime: z.ZodNullable<z.ZodString>;
                    forwarderRuntime: z.ZodNullable<z.ZodString>;
                    compositionHash: z.ZodNullable<z.ZodString>;
                    signerConfigurationHash: z.ZodNullable<z.ZodString>;
                    workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                    collateralToken: z.ZodNullable<z.ZodString>;
                    loanToken: z.ZodNullable<z.ZodString>;
                    collateralDecimals: z.ZodNullable<z.ZodNumber>;
                    loanDecimals: z.ZodNullable<z.ZodNumber>;
                    feedDecimals: z.ZodNullable<z.ZodNumber>;
                    denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                    descriptionHash: z.ZodNullable<z.ZodString>;
                    signerCoverage: z.ZodEnum<{
                        UNOBSERVED: "UNOBSERVED";
                        SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                        COMPLETE: "COMPLETE";
                    }>;
                }, z.core.$strict>;
                configurationFingerprint: z.ZodString;
                observationTimestamp: z.ZodNullable<z.ZodString>;
            }, z.core.$strict>>;
            block: z.ZodNullable<z.ZodObject<{
                number: z.ZodString;
                hash: z.ZodString;
                timestamp: z.ZodString;
            }, z.core.$strict>>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            overall: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            actionable: z.ZodLiteral<false>;
            gate: z.ZodEnum<{
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ASSURANCE_REQUIREMENTS_MET: "ASSURANCE_REQUIREMENTS_MET";
            }>;
            dimensions: z.ZodObject<{
                CONTRACT_IDENTITY: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                SOURCE_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                OPERATOR_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                PRICE_SEMANTICS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                FRESHNESS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                INDEPENDENT_VALIDATION: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                CONFIGURATION_CONTROL: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
            }, z.core.$strict>;
            configuration: z.ZodNullable<z.ZodObject<{
                oracle: z.ZodString;
                feed: z.ZodString;
                cache: z.ZodNullable<z.ZodString>;
                forwarder: z.ZodNullable<z.ZodString>;
                feedId: z.ZodNullable<z.ZodString>;
                proxyOwner: z.ZodNullable<z.ZodString>;
                cacheOwner: z.ZodNullable<z.ZodString>;
                forwarderOwner: z.ZodNullable<z.ZodString>;
                allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                proxyImplementation: z.ZodNullable<z.ZodString>;
                proxyAdmin: z.ZodNullable<z.ZodString>;
                proxyBeacon: z.ZodNullable<z.ZodString>;
                oracleRuntime: z.ZodNullable<z.ZodString>;
                proxyRuntime: z.ZodNullable<z.ZodString>;
                cacheRuntime: z.ZodNullable<z.ZodString>;
                forwarderRuntime: z.ZodNullable<z.ZodString>;
                compositionHash: z.ZodNullable<z.ZodString>;
                signerConfigurationHash: z.ZodNullable<z.ZodString>;
                workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                collateralToken: z.ZodNullable<z.ZodString>;
                loanToken: z.ZodNullable<z.ZodString>;
                collateralDecimals: z.ZodNullable<z.ZodNumber>;
                loanDecimals: z.ZodNullable<z.ZodNumber>;
                feedDecimals: z.ZodNullable<z.ZodNumber>;
                denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                descriptionHash: z.ZodNullable<z.ZodString>;
                signerCoverage: z.ZodEnum<{
                    UNOBSERVED: "UNOBSERVED";
                    SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                    COMPLETE: "COMPLETE";
                }>;
            }, z.core.$strict>>;
            configurationFingerprint: z.ZodNullable<z.ZodString>;
            changes: z.ZodArray<z.ZodEnum<{
                ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
                PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
                ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
                ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
                ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
                ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
            }>>;
            evidenceInvalidated: z.ZodBoolean;
            invalidatedAt: z.ZodNullable<z.ZodISODateTime>;
            invalidationReason: z.ZodNullable<z.ZodEnum<{
                CONFIGURATION_CHANGE: "CONFIGURATION_CHANGE";
                OBSERVABILITY_GAP: "OBSERVABILITY_GAP";
            }>>;
            freshness: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                observationTimestamp: z.ZodNullable<z.ZodString>;
                observationAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyOrigin: z.ZodEnum<{
                    NONE: "NONE";
                    OPERATOR_DEFINED_LOCAL_REJECTION: "OPERATOR_DEFINED_LOCAL_REJECTION";
                }>;
                policyRejected: z.ZodBoolean;
                verifiedHeartbeatSeconds: z.ZodNullable<z.ZodString>;
                upstreamFreshnessGuaranteeSeconds: z.ZodNullable<z.ZodString>;
                timestampMeaning: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    WORKFLOW_SUPPLIED_OBSERVATION_TIME: "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                }>;
                onchainExpiryEnforced: z.ZodNullable<z.ZodBoolean>;
                timingConfigurationFingerprint: z.ZodNullable<z.ZodString>;
                anomalies: z.ZodArray<z.ZodEnum<{
                    ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
                    FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
                    TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
                    TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
                }>>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            independent: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                availability: z.ZodEnum<{
                    UNAVAILABLE: "UNAVAILABLE";
                    AVAILABLE: "AVAILABLE";
                    NOT_CONFIGURED: "NOT_CONFIGURED";
                }>;
                sourceId: z.ZodNullable<z.ZodString>;
                eligible: z.ZodBoolean;
                reasons: z.ZodArray<z.ZodString>;
                toleranceBps: z.ZodNullable<z.ZodNumber>;
                morphoPrice: z.ZodNullable<z.ZodString>;
                independentPrice: z.ZodNullable<z.ZodString>;
                candidate: z.ZodNullable<z.ZodObject<{
                    id: z.ZodString;
                    availability: z.ZodEnum<{
                        UNAVAILABLE: "UNAVAILABLE";
                        AVAILABLE: "AVAILABLE";
                    }>;
                    base: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    quote: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    kind: z.ZodEnum<{
                        MARKET_PRICE: "MARKET_PRICE";
                        REDEMPTION_RATE: "REDEMPTION_RATE";
                    }>;
                    denomination: z.ZodEnum<{
                        WHOLE_QUOTE_PER_WHOLE_BASE: "WHOLE_QUOTE_PER_WHOLE_BASE";
                        QUOTE_BASE_UNITS_PER_BASE_UNIT: "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    }>;
                    price: z.ZodNullable<z.ZodString>;
                    decimals: z.ZodNumber;
                    timestamp: z.ZodNullable<z.ZodString>;
                    frequencySeconds: z.ZodNullable<z.ZodString>;
                    operatorId: z.ZodNullable<z.ZodString>;
                    upstreamId: z.ZodNullable<z.ZodString>;
                    proofs: z.ZodArray<z.ZodObject<{
                        claim: z.ZodEnum<{
                            ASSET: "ASSET";
                            QUOTE: "QUOTE";
                            DENOMINATION: "DENOMINATION";
                            TIMESTAMP: "TIMESTAMP";
                            FREQUENCY: "FREQUENCY";
                            OPERATOR: "OPERATOR";
                            PROVENANCE: "PROVENANCE";
                            INDEPENDENCE: "INDEPENDENCE";
                        }>;
                        evidence: z.ZodObject<{
                            subjectAddress: z.ZodString;
                            chainId: z.ZodNumber;
                            source: z.ZodString;
                            sourceKind: z.ZodEnum<{
                                FIXTURE: "FIXTURE";
                                SNAPSHOT: "SNAPSHOT";
                                RPC: "RPC";
                                MCP: "MCP";
                                VERIFIED_SOURCE: "VERIFIED_SOURCE";
                                COMPILER: "COMPILER";
                                OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                                RESEARCH: "RESEARCH";
                                LOCAL_POLICY: "LOCAL_POLICY";
                            }>;
                            block: z.ZodNullable<z.ZodObject<{
                                number: z.ZodString;
                                hash: z.ZodString;
                                timestamp: z.ZodString;
                            }, z.core.$strict>>;
                            retrievedAt: z.ZodISODateTime;
                            method: z.ZodString;
                            artifactSha256: z.ZodNullable<z.ZodString>;
                            confidence: z.ZodEnum<{
                                UNKNOWN: "UNKNOWN";
                                PROVEN: "PROVEN";
                                INTERPRETATION: "INTERPRETATION";
                            }>;
                            unresolved: z.ZodArray<z.ZodString>;
                        }, z.core.$strict>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>;
                selectedUpstreamId: z.ZodNullable<z.ZodString>;
                base: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                quote: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                evidenceMode: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    PRODUCTION: "PRODUCTION";
                }>;
                blockTimestamp: z.ZodNullable<z.ZodString>;
                selectedTimestamp: z.ZodNullable<z.ZodString>;
                candidateAgeSeconds: z.ZodNullable<z.ZodString>;
                timestampSkewSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxSkewSeconds: z.ZodNullable<z.ZodString>;
                normalizedMorpho: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                normalizedIndependent: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                deviationBps: z.ZodNullable<z.ZodString>;
                disagrees: z.ZodBoolean;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            findings: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                subjectAddress: z.ZodString;
                statement: z.ZodString;
                classification: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
            limitations: z.ZodArray<z.ZodString>;
            providerIndependence: z.ZodLiteral<"RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT">;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    lastAccepted: z.ZodNullable<z.ZodObject<{
        cycleId: z.ZodString;
        observedAt: z.ZodISODateTime;
        accepted: z.ZodBoolean;
        risk: z.ZodObject<{
            chainId: z.ZodLiteral<1672>;
            account: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
            marketId: z.ZodLiteral<`0x${string}`>;
            protocol: z.ZodLiteral<"Morpho Blue">;
            morphoAddress: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            accountRole: z.ZodEnum<{
                PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
                EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            }>;
            calculationVersion: z.ZodLiteral<"1.0.0">;
            evidenceKind: z.ZodNullable<z.ZodEnum<{
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>>;
            mathematicalRiskState: z.ZodNullable<z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>>;
            effectiveRiskState: z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>;
            dataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2DataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2OracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleVerification: z.ZodLiteral<"UNVERIFIED">;
            heartbeat: z.ZodLiteral<"UNKNOWN">;
            actionable: z.ZodLiteral<false>;
            actionability: z.ZodEnum<{
                BLOCKED: "BLOCKED";
                INDICATIVE_ONLY: "INDICATIVE_ONLY";
            }>;
            safetyRatio: z.ZodNullable<z.ZodString>;
            ltv: z.ZodNullable<z.ZodString>;
            ratioScale: z.ZodString;
            debtAmount: z.ZodNullable<z.ZodString>;
            collateralAmount: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            snapshotRetrievedAt: z.ZodNullable<z.ZodISODateTime>;
            calculatedAt: z.ZodISODateTime;
            temporalContext: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                FIXTURE: "FIXTURE";
                LIVE_AS_OF_BLOCK: "LIVE_AS_OF_BLOCK";
                HISTORICAL: "HISTORICAL";
            }>;
            thresholds: z.ZodObject<{
                warningRatio: z.ZodString;
                criticalRatio: z.ZodString;
                targetRatio: z.ZodString;
                liquidationBoundary: z.ZodString;
            }, z.core.$strict>;
            repayment: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            additionalCollateral: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            recoveryEligibility: z.ZodOptional<z.ZodObject<{
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
        diagnostics: z.ZodArray<z.ZodEnum<{
            BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
            RPC_UNAVAILABLE: "RPC_UNAVAILABLE";
            MCP_UNAVAILABLE: "MCP_UNAVAILABLE";
            RPC_INVALID: "RPC_INVALID";
            MCP_INVALID: "MCP_INVALID";
            SNAPSHOT_INVALID: "SNAPSHOT_INVALID";
            SNAPSHOT_UNAVAILABLE: "SNAPSHOT_UNAVAILABLE";
            ORACLE_UNVERIFIED: "ORACLE_UNVERIFIED";
            ORACLE_DATA_UNAVAILABLE: "ORACLE_DATA_UNAVAILABLE";
            ORACLE_DATA_INVALID: "ORACLE_DATA_INVALID";
            ORACLE_FRESHNESS_UNKNOWN: "ORACLE_FRESHNESS_UNKNOWN";
            FRESHNESS_UNDETERMINED: "FRESHNESS_UNDETERMINED";
            MONITOR_MODE_MISMATCH: "MONITOR_MODE_MISMATCH";
            PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
            RISK_CALCULATION_FAILED: "RISK_CALCULATION_FAILED";
            BLOCK_REGRESSION: "BLOCK_REGRESSION";
        }>>;
        progression: z.ZodOptional<z.ZodObject<{
            state: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                ADVANCING: "ADVANCING";
                UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
                STALLED: "STALLED";
                REGRESSED: "REGRESSED";
                CONFLICT: "CONFLICT";
            }>;
            reason: z.ZodNullable<z.ZodEnum<{
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
            advancedBlocks: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            headNumber: z.ZodNullable<z.ZodString>;
            baselineBlockNumber: z.ZodNullable<z.ZodString>;
            baselineBlockHash: z.ZodNullable<z.ZodString>;
            sameBlockStreak: z.ZodNumber;
            evaluatedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        assurance: z.ZodOptional<z.ZodObject<{
            schemaVersion: z.ZodLiteral<1>;
            policyVersion: z.ZodLiteral<"oracle-assurance-v1">;
            chainId: z.ZodLiteral<1672>;
            marketId: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            evaluatedAt: z.ZodISODateTime;
            retrievedAt: z.ZodNullable<z.ZodISODateTime>;
            evidenceKind: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>;
            continuityScope: z.ZodString;
            baseline: z.ZodNullable<z.ZodObject<{
                block: z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>;
                retrievedAt: z.ZodISODateTime;
                snapshotIdentifier: z.ZodString;
                configuration: z.ZodObject<{
                    oracle: z.ZodString;
                    feed: z.ZodString;
                    cache: z.ZodNullable<z.ZodString>;
                    forwarder: z.ZodNullable<z.ZodString>;
                    feedId: z.ZodNullable<z.ZodString>;
                    proxyOwner: z.ZodNullable<z.ZodString>;
                    cacheOwner: z.ZodNullable<z.ZodString>;
                    forwarderOwner: z.ZodNullable<z.ZodString>;
                    allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                    proxyImplementation: z.ZodNullable<z.ZodString>;
                    proxyAdmin: z.ZodNullable<z.ZodString>;
                    proxyBeacon: z.ZodNullable<z.ZodString>;
                    oracleRuntime: z.ZodNullable<z.ZodString>;
                    proxyRuntime: z.ZodNullable<z.ZodString>;
                    cacheRuntime: z.ZodNullable<z.ZodString>;
                    forwarderRuntime: z.ZodNullable<z.ZodString>;
                    compositionHash: z.ZodNullable<z.ZodString>;
                    signerConfigurationHash: z.ZodNullable<z.ZodString>;
                    workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                    collateralToken: z.ZodNullable<z.ZodString>;
                    loanToken: z.ZodNullable<z.ZodString>;
                    collateralDecimals: z.ZodNullable<z.ZodNumber>;
                    loanDecimals: z.ZodNullable<z.ZodNumber>;
                    feedDecimals: z.ZodNullable<z.ZodNumber>;
                    denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                    descriptionHash: z.ZodNullable<z.ZodString>;
                    signerCoverage: z.ZodEnum<{
                        UNOBSERVED: "UNOBSERVED";
                        SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                        COMPLETE: "COMPLETE";
                    }>;
                }, z.core.$strict>;
                configurationFingerprint: z.ZodString;
                observationTimestamp: z.ZodNullable<z.ZodString>;
            }, z.core.$strict>>;
            block: z.ZodNullable<z.ZodObject<{
                number: z.ZodString;
                hash: z.ZodString;
                timestamp: z.ZodString;
            }, z.core.$strict>>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            overall: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            actionable: z.ZodLiteral<false>;
            gate: z.ZodEnum<{
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ASSURANCE_REQUIREMENTS_MET: "ASSURANCE_REQUIREMENTS_MET";
            }>;
            dimensions: z.ZodObject<{
                CONTRACT_IDENTITY: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                SOURCE_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                OPERATOR_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                PRICE_SEMANTICS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                FRESHNESS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                INDEPENDENT_VALIDATION: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                CONFIGURATION_CONTROL: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
            }, z.core.$strict>;
            configuration: z.ZodNullable<z.ZodObject<{
                oracle: z.ZodString;
                feed: z.ZodString;
                cache: z.ZodNullable<z.ZodString>;
                forwarder: z.ZodNullable<z.ZodString>;
                feedId: z.ZodNullable<z.ZodString>;
                proxyOwner: z.ZodNullable<z.ZodString>;
                cacheOwner: z.ZodNullable<z.ZodString>;
                forwarderOwner: z.ZodNullable<z.ZodString>;
                allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                proxyImplementation: z.ZodNullable<z.ZodString>;
                proxyAdmin: z.ZodNullable<z.ZodString>;
                proxyBeacon: z.ZodNullable<z.ZodString>;
                oracleRuntime: z.ZodNullable<z.ZodString>;
                proxyRuntime: z.ZodNullable<z.ZodString>;
                cacheRuntime: z.ZodNullable<z.ZodString>;
                forwarderRuntime: z.ZodNullable<z.ZodString>;
                compositionHash: z.ZodNullable<z.ZodString>;
                signerConfigurationHash: z.ZodNullable<z.ZodString>;
                workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                collateralToken: z.ZodNullable<z.ZodString>;
                loanToken: z.ZodNullable<z.ZodString>;
                collateralDecimals: z.ZodNullable<z.ZodNumber>;
                loanDecimals: z.ZodNullable<z.ZodNumber>;
                feedDecimals: z.ZodNullable<z.ZodNumber>;
                denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                descriptionHash: z.ZodNullable<z.ZodString>;
                signerCoverage: z.ZodEnum<{
                    UNOBSERVED: "UNOBSERVED";
                    SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                    COMPLETE: "COMPLETE";
                }>;
            }, z.core.$strict>>;
            configurationFingerprint: z.ZodNullable<z.ZodString>;
            changes: z.ZodArray<z.ZodEnum<{
                ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
                PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
                ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
                ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
                ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
                ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
            }>>;
            evidenceInvalidated: z.ZodBoolean;
            invalidatedAt: z.ZodNullable<z.ZodISODateTime>;
            invalidationReason: z.ZodNullable<z.ZodEnum<{
                CONFIGURATION_CHANGE: "CONFIGURATION_CHANGE";
                OBSERVABILITY_GAP: "OBSERVABILITY_GAP";
            }>>;
            freshness: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                observationTimestamp: z.ZodNullable<z.ZodString>;
                observationAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyOrigin: z.ZodEnum<{
                    NONE: "NONE";
                    OPERATOR_DEFINED_LOCAL_REJECTION: "OPERATOR_DEFINED_LOCAL_REJECTION";
                }>;
                policyRejected: z.ZodBoolean;
                verifiedHeartbeatSeconds: z.ZodNullable<z.ZodString>;
                upstreamFreshnessGuaranteeSeconds: z.ZodNullable<z.ZodString>;
                timestampMeaning: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    WORKFLOW_SUPPLIED_OBSERVATION_TIME: "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                }>;
                onchainExpiryEnforced: z.ZodNullable<z.ZodBoolean>;
                timingConfigurationFingerprint: z.ZodNullable<z.ZodString>;
                anomalies: z.ZodArray<z.ZodEnum<{
                    ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
                    FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
                    TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
                    TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
                }>>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            independent: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                availability: z.ZodEnum<{
                    UNAVAILABLE: "UNAVAILABLE";
                    AVAILABLE: "AVAILABLE";
                    NOT_CONFIGURED: "NOT_CONFIGURED";
                }>;
                sourceId: z.ZodNullable<z.ZodString>;
                eligible: z.ZodBoolean;
                reasons: z.ZodArray<z.ZodString>;
                toleranceBps: z.ZodNullable<z.ZodNumber>;
                morphoPrice: z.ZodNullable<z.ZodString>;
                independentPrice: z.ZodNullable<z.ZodString>;
                candidate: z.ZodNullable<z.ZodObject<{
                    id: z.ZodString;
                    availability: z.ZodEnum<{
                        UNAVAILABLE: "UNAVAILABLE";
                        AVAILABLE: "AVAILABLE";
                    }>;
                    base: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    quote: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    kind: z.ZodEnum<{
                        MARKET_PRICE: "MARKET_PRICE";
                        REDEMPTION_RATE: "REDEMPTION_RATE";
                    }>;
                    denomination: z.ZodEnum<{
                        WHOLE_QUOTE_PER_WHOLE_BASE: "WHOLE_QUOTE_PER_WHOLE_BASE";
                        QUOTE_BASE_UNITS_PER_BASE_UNIT: "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    }>;
                    price: z.ZodNullable<z.ZodString>;
                    decimals: z.ZodNumber;
                    timestamp: z.ZodNullable<z.ZodString>;
                    frequencySeconds: z.ZodNullable<z.ZodString>;
                    operatorId: z.ZodNullable<z.ZodString>;
                    upstreamId: z.ZodNullable<z.ZodString>;
                    proofs: z.ZodArray<z.ZodObject<{
                        claim: z.ZodEnum<{
                            ASSET: "ASSET";
                            QUOTE: "QUOTE";
                            DENOMINATION: "DENOMINATION";
                            TIMESTAMP: "TIMESTAMP";
                            FREQUENCY: "FREQUENCY";
                            OPERATOR: "OPERATOR";
                            PROVENANCE: "PROVENANCE";
                            INDEPENDENCE: "INDEPENDENCE";
                        }>;
                        evidence: z.ZodObject<{
                            subjectAddress: z.ZodString;
                            chainId: z.ZodNumber;
                            source: z.ZodString;
                            sourceKind: z.ZodEnum<{
                                FIXTURE: "FIXTURE";
                                SNAPSHOT: "SNAPSHOT";
                                RPC: "RPC";
                                MCP: "MCP";
                                VERIFIED_SOURCE: "VERIFIED_SOURCE";
                                COMPILER: "COMPILER";
                                OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                                RESEARCH: "RESEARCH";
                                LOCAL_POLICY: "LOCAL_POLICY";
                            }>;
                            block: z.ZodNullable<z.ZodObject<{
                                number: z.ZodString;
                                hash: z.ZodString;
                                timestamp: z.ZodString;
                            }, z.core.$strict>>;
                            retrievedAt: z.ZodISODateTime;
                            method: z.ZodString;
                            artifactSha256: z.ZodNullable<z.ZodString>;
                            confidence: z.ZodEnum<{
                                UNKNOWN: "UNKNOWN";
                                PROVEN: "PROVEN";
                                INTERPRETATION: "INTERPRETATION";
                            }>;
                            unresolved: z.ZodArray<z.ZodString>;
                        }, z.core.$strict>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>;
                selectedUpstreamId: z.ZodNullable<z.ZodString>;
                base: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                quote: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                evidenceMode: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    PRODUCTION: "PRODUCTION";
                }>;
                blockTimestamp: z.ZodNullable<z.ZodString>;
                selectedTimestamp: z.ZodNullable<z.ZodString>;
                candidateAgeSeconds: z.ZodNullable<z.ZodString>;
                timestampSkewSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxSkewSeconds: z.ZodNullable<z.ZodString>;
                normalizedMorpho: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                normalizedIndependent: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                deviationBps: z.ZodNullable<z.ZodString>;
                disagrees: z.ZodBoolean;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            findings: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                subjectAddress: z.ZodString;
                statement: z.ZodString;
                classification: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
            limitations: z.ZodArray<z.ZodString>;
            providerIndependence: z.ZodLiteral<"RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT">;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    consecutiveFailures: z.ZodNumber;
    episodes: z.ZodObject<{
        risk: z.ZodNumber;
        data: z.ZodNumber;
        oracle: z.ZodNumber;
        failures: z.ZodNumber;
        assurance: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>;
    lastCriticalAlertAt: z.ZodNullable<z.ZodISODateTime>;
    assuranceBaseline: z.ZodOptional<z.ZodObject<{
        schemaVersion: z.ZodLiteral<1>;
        policyVersion: z.ZodLiteral<"oracle-assurance-v1">;
        chainId: z.ZodLiteral<1672>;
        marketId: z.ZodLiteral<`0x${string}`>;
        oracleAddress: z.ZodLiteral<`0x${string}`>;
        evaluatedAt: z.ZodISODateTime;
        retrievedAt: z.ZodNullable<z.ZodISODateTime>;
        evidenceKind: z.ZodEnum<{
            UNAVAILABLE: "UNAVAILABLE";
            LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
            HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
            FIXTURE: "FIXTURE";
        }>;
        continuityScope: z.ZodString;
        baseline: z.ZodNullable<z.ZodObject<{
            block: z.ZodObject<{
                number: z.ZodString;
                hash: z.ZodString;
                timestamp: z.ZodString;
            }, z.core.$strict>;
            retrievedAt: z.ZodISODateTime;
            snapshotIdentifier: z.ZodString;
            configuration: z.ZodObject<{
                oracle: z.ZodString;
                feed: z.ZodString;
                cache: z.ZodNullable<z.ZodString>;
                forwarder: z.ZodNullable<z.ZodString>;
                feedId: z.ZodNullable<z.ZodString>;
                proxyOwner: z.ZodNullable<z.ZodString>;
                cacheOwner: z.ZodNullable<z.ZodString>;
                forwarderOwner: z.ZodNullable<z.ZodString>;
                allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                proxyImplementation: z.ZodNullable<z.ZodString>;
                proxyAdmin: z.ZodNullable<z.ZodString>;
                proxyBeacon: z.ZodNullable<z.ZodString>;
                oracleRuntime: z.ZodNullable<z.ZodString>;
                proxyRuntime: z.ZodNullable<z.ZodString>;
                cacheRuntime: z.ZodNullable<z.ZodString>;
                forwarderRuntime: z.ZodNullable<z.ZodString>;
                compositionHash: z.ZodNullable<z.ZodString>;
                signerConfigurationHash: z.ZodNullable<z.ZodString>;
                workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                collateralToken: z.ZodNullable<z.ZodString>;
                loanToken: z.ZodNullable<z.ZodString>;
                collateralDecimals: z.ZodNullable<z.ZodNumber>;
                loanDecimals: z.ZodNullable<z.ZodNumber>;
                feedDecimals: z.ZodNullable<z.ZodNumber>;
                denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                descriptionHash: z.ZodNullable<z.ZodString>;
                signerCoverage: z.ZodEnum<{
                    UNOBSERVED: "UNOBSERVED";
                    SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                    COMPLETE: "COMPLETE";
                }>;
            }, z.core.$strict>;
            configurationFingerprint: z.ZodString;
            observationTimestamp: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>;
        block: z.ZodNullable<z.ZodObject<{
            number: z.ZodString;
            hash: z.ZodString;
            timestamp: z.ZodString;
        }, z.core.$strict>>;
        snapshotIdentifier: z.ZodNullable<z.ZodString>;
        overall: z.ZodEnum<{
            UNVERIFIED: "UNVERIFIED";
            VERIFIED: "VERIFIED";
            PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
            UNKNOWN: "UNKNOWN";
            FAILED: "FAILED";
        }>;
        actionable: z.ZodLiteral<false>;
        gate: z.ZodEnum<{
            DATA_UNVERIFIED: "DATA_UNVERIFIED";
            DATA_INVALID: "DATA_INVALID";
            DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
            ASSURANCE_REQUIREMENTS_MET: "ASSURANCE_REQUIREMENTS_MET";
        }>;
        dimensions: z.ZodObject<{
            CONTRACT_IDENTITY: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            SOURCE_PROVENANCE: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            OPERATOR_PROVENANCE: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            PRICE_SEMANTICS: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            FRESHNESS: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            INDEPENDENT_VALIDATION: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
            CONFIGURATION_CONTROL: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                rule: z.ZodString;
                satisfied: z.ZodArray<z.ZodString>;
                missing: z.ZodArray<z.ZodString>;
                findingIds: z.ZodArray<z.ZodString>;
            }, z.core.$strict>;
        }, z.core.$strict>;
        configuration: z.ZodNullable<z.ZodObject<{
            oracle: z.ZodString;
            feed: z.ZodString;
            cache: z.ZodNullable<z.ZodString>;
            forwarder: z.ZodNullable<z.ZodString>;
            feedId: z.ZodNullable<z.ZodString>;
            proxyOwner: z.ZodNullable<z.ZodString>;
            cacheOwner: z.ZodNullable<z.ZodString>;
            forwarderOwner: z.ZodNullable<z.ZodString>;
            allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
            proxyImplementation: z.ZodNullable<z.ZodString>;
            proxyAdmin: z.ZodNullable<z.ZodString>;
            proxyBeacon: z.ZodNullable<z.ZodString>;
            oracleRuntime: z.ZodNullable<z.ZodString>;
            proxyRuntime: z.ZodNullable<z.ZodString>;
            cacheRuntime: z.ZodNullable<z.ZodString>;
            forwarderRuntime: z.ZodNullable<z.ZodString>;
            compositionHash: z.ZodNullable<z.ZodString>;
            signerConfigurationHash: z.ZodNullable<z.ZodString>;
            workflowConfigurationHash: z.ZodNullable<z.ZodString>;
            collateralToken: z.ZodNullable<z.ZodString>;
            loanToken: z.ZodNullable<z.ZodString>;
            collateralDecimals: z.ZodNullable<z.ZodNumber>;
            loanDecimals: z.ZodNullable<z.ZodNumber>;
            feedDecimals: z.ZodNullable<z.ZodNumber>;
            denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
            descriptionHash: z.ZodNullable<z.ZodString>;
            signerCoverage: z.ZodEnum<{
                UNOBSERVED: "UNOBSERVED";
                SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                COMPLETE: "COMPLETE";
            }>;
        }, z.core.$strict>>;
        configurationFingerprint: z.ZodNullable<z.ZodString>;
        changes: z.ZodArray<z.ZodEnum<{
            ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
            PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
            ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
            ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
            ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
            ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
        }>>;
        evidenceInvalidated: z.ZodBoolean;
        invalidatedAt: z.ZodNullable<z.ZodISODateTime>;
        invalidationReason: z.ZodNullable<z.ZodEnum<{
            CONFIGURATION_CHANGE: "CONFIGURATION_CHANGE";
            OBSERVABILITY_GAP: "OBSERVABILITY_GAP";
        }>>;
        freshness: z.ZodObject<{
            state: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            observationTimestamp: z.ZodNullable<z.ZodString>;
            observationAgeSeconds: z.ZodNullable<z.ZodString>;
            policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
            policyOrigin: z.ZodEnum<{
                NONE: "NONE";
                OPERATOR_DEFINED_LOCAL_REJECTION: "OPERATOR_DEFINED_LOCAL_REJECTION";
            }>;
            policyRejected: z.ZodBoolean;
            verifiedHeartbeatSeconds: z.ZodNullable<z.ZodString>;
            upstreamFreshnessGuaranteeSeconds: z.ZodNullable<z.ZodString>;
            timestampMeaning: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                WORKFLOW_SUPPLIED_OBSERVATION_TIME: "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
            }>;
            onchainExpiryEnforced: z.ZodNullable<z.ZodBoolean>;
            timingConfigurationFingerprint: z.ZodNullable<z.ZodString>;
            anomalies: z.ZodArray<z.ZodEnum<{
                ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
                FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
                TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
                TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
            }>>;
            evidence: z.ZodArray<z.ZodObject<{
                subjectAddress: z.ZodString;
                chainId: z.ZodNumber;
                source: z.ZodString;
                sourceKind: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    SNAPSHOT: "SNAPSHOT";
                    RPC: "RPC";
                    MCP: "MCP";
                    VERIFIED_SOURCE: "VERIFIED_SOURCE";
                    COMPILER: "COMPILER";
                    OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                    RESEARCH: "RESEARCH";
                    LOCAL_POLICY: "LOCAL_POLICY";
                }>;
                block: z.ZodNullable<z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>>;
                retrievedAt: z.ZodISODateTime;
                method: z.ZodString;
                artifactSha256: z.ZodNullable<z.ZodString>;
                confidence: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        independent: z.ZodObject<{
            state: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            availability: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                AVAILABLE: "AVAILABLE";
                NOT_CONFIGURED: "NOT_CONFIGURED";
            }>;
            sourceId: z.ZodNullable<z.ZodString>;
            eligible: z.ZodBoolean;
            reasons: z.ZodArray<z.ZodString>;
            toleranceBps: z.ZodNullable<z.ZodNumber>;
            morphoPrice: z.ZodNullable<z.ZodString>;
            independentPrice: z.ZodNullable<z.ZodString>;
            candidate: z.ZodNullable<z.ZodObject<{
                id: z.ZodString;
                availability: z.ZodEnum<{
                    UNAVAILABLE: "UNAVAILABLE";
                    AVAILABLE: "AVAILABLE";
                }>;
                base: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                quote: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                kind: z.ZodEnum<{
                    MARKET_PRICE: "MARKET_PRICE";
                    REDEMPTION_RATE: "REDEMPTION_RATE";
                }>;
                denomination: z.ZodEnum<{
                    WHOLE_QUOTE_PER_WHOLE_BASE: "WHOLE_QUOTE_PER_WHOLE_BASE";
                    QUOTE_BASE_UNITS_PER_BASE_UNIT: "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                }>;
                price: z.ZodNullable<z.ZodString>;
                decimals: z.ZodNumber;
                timestamp: z.ZodNullable<z.ZodString>;
                frequencySeconds: z.ZodNullable<z.ZodString>;
                operatorId: z.ZodNullable<z.ZodString>;
                upstreamId: z.ZodNullable<z.ZodString>;
                proofs: z.ZodArray<z.ZodObject<{
                    claim: z.ZodEnum<{
                        ASSET: "ASSET";
                        QUOTE: "QUOTE";
                        DENOMINATION: "DENOMINATION";
                        TIMESTAMP: "TIMESTAMP";
                        FREQUENCY: "FREQUENCY";
                        OPERATOR: "OPERATOR";
                        PROVENANCE: "PROVENANCE";
                        INDEPENDENCE: "INDEPENDENCE";
                    }>;
                    evidence: z.ZodObject<{
                        subjectAddress: z.ZodString;
                        chainId: z.ZodNumber;
                        source: z.ZodString;
                        sourceKind: z.ZodEnum<{
                            FIXTURE: "FIXTURE";
                            SNAPSHOT: "SNAPSHOT";
                            RPC: "RPC";
                            MCP: "MCP";
                            VERIFIED_SOURCE: "VERIFIED_SOURCE";
                            COMPILER: "COMPILER";
                            OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                            RESEARCH: "RESEARCH";
                            LOCAL_POLICY: "LOCAL_POLICY";
                        }>;
                        block: z.ZodNullable<z.ZodObject<{
                            number: z.ZodString;
                            hash: z.ZodString;
                            timestamp: z.ZodString;
                        }, z.core.$strict>>;
                        retrievedAt: z.ZodISODateTime;
                        method: z.ZodString;
                        artifactSha256: z.ZodNullable<z.ZodString>;
                        confidence: z.ZodEnum<{
                            UNKNOWN: "UNKNOWN";
                            PROVEN: "PROVEN";
                            INTERPRETATION: "INTERPRETATION";
                        }>;
                        unresolved: z.ZodArray<z.ZodString>;
                    }, z.core.$strict>;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
            selectedUpstreamId: z.ZodNullable<z.ZodString>;
            base: z.ZodObject<{
                chainId: z.ZodNumber;
                address: z.ZodString;
                decimals: z.ZodNumber;
            }, z.core.$strict>;
            quote: z.ZodObject<{
                chainId: z.ZodNumber;
                address: z.ZodString;
                decimals: z.ZodNumber;
            }, z.core.$strict>;
            evidenceMode: z.ZodEnum<{
                FIXTURE: "FIXTURE";
                PRODUCTION: "PRODUCTION";
            }>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            selectedTimestamp: z.ZodNullable<z.ZodString>;
            candidateAgeSeconds: z.ZodNullable<z.ZodString>;
            timestampSkewSeconds: z.ZodNullable<z.ZodString>;
            policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
            policyMaxSkewSeconds: z.ZodNullable<z.ZodString>;
            normalizedMorpho: z.ZodNullable<z.ZodObject<{
                numerator: z.ZodString;
                denominator: z.ZodString;
            }, z.core.$strict>>;
            normalizedIndependent: z.ZodNullable<z.ZodObject<{
                numerator: z.ZodString;
                denominator: z.ZodString;
            }, z.core.$strict>>;
            deviationBps: z.ZodNullable<z.ZodString>;
            disagrees: z.ZodBoolean;
            evidence: z.ZodArray<z.ZodObject<{
                subjectAddress: z.ZodString;
                chainId: z.ZodNumber;
                source: z.ZodString;
                sourceKind: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    SNAPSHOT: "SNAPSHOT";
                    RPC: "RPC";
                    MCP: "MCP";
                    VERIFIED_SOURCE: "VERIFIED_SOURCE";
                    COMPILER: "COMPILER";
                    OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                    RESEARCH: "RESEARCH";
                    LOCAL_POLICY: "LOCAL_POLICY";
                }>;
                block: z.ZodNullable<z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>>;
                retrievedAt: z.ZodISODateTime;
                method: z.ZodString;
                artifactSha256: z.ZodNullable<z.ZodString>;
                confidence: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        findings: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            subjectAddress: z.ZodString;
            statement: z.ZodString;
            classification: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                PROVEN: "PROVEN";
                INTERPRETATION: "INTERPRETATION";
            }>;
            evidence: z.ZodArray<z.ZodObject<{
                subjectAddress: z.ZodString;
                chainId: z.ZodNumber;
                source: z.ZodString;
                sourceKind: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    SNAPSHOT: "SNAPSHOT";
                    RPC: "RPC";
                    MCP: "MCP";
                    VERIFIED_SOURCE: "VERIFIED_SOURCE";
                    COMPILER: "COMPILER";
                    OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                    RESEARCH: "RESEARCH";
                    LOCAL_POLICY: "LOCAL_POLICY";
                }>;
                block: z.ZodNullable<z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>>;
                retrievedAt: z.ZodISODateTime;
                method: z.ZodString;
                artifactSha256: z.ZodNullable<z.ZodString>;
                confidence: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
            unresolved: z.ZodArray<z.ZodString>;
        }, z.core.$strict>>;
        limitations: z.ZodArray<z.ZodString>;
        providerIndependence: z.ZodLiteral<"RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT">;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const alertCodeSchema: z.ZodEnum<{
    ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
    PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
    ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
    ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
    ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
    ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
    INDEPENDENT_PRICE_DISAGREEMENT: "INDEPENDENT_PRICE_DISAGREEMENT";
    INITIAL_RISK: "INITIAL_RISK";
    RISK_WORSENED: "RISK_WORSENED";
    RISK_IMPROVED: "RISK_IMPROVED";
    RISK_RECOVERY: "RISK_RECOVERY";
    NO_DEBT_OBSERVED: "NO_DEBT_OBSERVED";
    DEBT_OBSERVED: "DEBT_OBSERVED";
    CRITICAL_REMINDER: "CRITICAL_REMINDER";
    DATA_QUALITY_CHANGED: "DATA_QUALITY_CHANGED";
    DATA_RESTORED: "DATA_RESTORED";
    ORACLE_QUALITY_CHANGED: "ORACLE_QUALITY_CHANGED";
    PERSISTENT_READ_FAILURE: "PERSISTENT_READ_FAILURE";
    ORACLE_TIMESTAMP_ANOMALY: "ORACLE_TIMESTAMP_ANOMALY";
    ORACLE_ASSURANCE_DETERIORATED: "ORACLE_ASSURANCE_DETERIORATED";
    ORACLE_ASSURANCE_IMPROVED: "ORACLE_ASSURANCE_IMPROVED";
    ORACLE_ASSURANCE_INVALIDATED: "ORACLE_ASSURANCE_INVALIDATED";
}>;
export declare const alertSchema: z.ZodObject<{
    id: z.ZodString;
    fingerprint: z.ZodString;
    scope: z.ZodString;
    cycleId: z.ZodString;
    createdAt: z.ZodISODateTime;
    severity: z.ZodEnum<{
        WARNING: "WARNING";
        CRITICAL: "CRITICAL";
        INFO: "INFO";
        BOUNDARY: "BOUNDARY";
    }>;
    category: z.ZodEnum<{
        RISK: "RISK";
        DATA_QUALITY: "DATA_QUALITY";
        ORACLE: "ORACLE";
        MONITOR_HEALTH: "MONITOR_HEALTH";
    }>;
    code: z.ZodEnum<{
        ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
        PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
        ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
        ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
        ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
        ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
        INDEPENDENT_PRICE_DISAGREEMENT: "INDEPENDENT_PRICE_DISAGREEMENT";
        INITIAL_RISK: "INITIAL_RISK";
        RISK_WORSENED: "RISK_WORSENED";
        RISK_IMPROVED: "RISK_IMPROVED";
        RISK_RECOVERY: "RISK_RECOVERY";
        NO_DEBT_OBSERVED: "NO_DEBT_OBSERVED";
        DEBT_OBSERVED: "DEBT_OBSERVED";
        CRITICAL_REMINDER: "CRITICAL_REMINDER";
        DATA_QUALITY_CHANGED: "DATA_QUALITY_CHANGED";
        DATA_RESTORED: "DATA_RESTORED";
        ORACLE_QUALITY_CHANGED: "ORACLE_QUALITY_CHANGED";
        PERSISTENT_READ_FAILURE: "PERSISTENT_READ_FAILURE";
        ORACLE_TIMESTAMP_ANOMALY: "ORACLE_TIMESTAMP_ANOMALY";
        ORACLE_ASSURANCE_DETERIORATED: "ORACLE_ASSURANCE_DETERIORATED";
        ORACLE_ASSURANCE_IMPROVED: "ORACLE_ASSURANCE_IMPROVED";
        ORACLE_ASSURANCE_INVALIDATED: "ORACLE_ASSURANCE_INVALIDATED";
    }>;
    previous: z.ZodNullable<z.ZodObject<{
        cycleId: z.ZodString;
        observedAt: z.ZodISODateTime;
        accepted: z.ZodBoolean;
        risk: z.ZodObject<{
            chainId: z.ZodLiteral<1672>;
            account: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
            marketId: z.ZodLiteral<`0x${string}`>;
            protocol: z.ZodLiteral<"Morpho Blue">;
            morphoAddress: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            accountRole: z.ZodEnum<{
                PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
                EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            }>;
            calculationVersion: z.ZodLiteral<"1.0.0">;
            evidenceKind: z.ZodNullable<z.ZodEnum<{
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>>;
            mathematicalRiskState: z.ZodNullable<z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>>;
            effectiveRiskState: z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>;
            dataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2DataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2OracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleVerification: z.ZodLiteral<"UNVERIFIED">;
            heartbeat: z.ZodLiteral<"UNKNOWN">;
            actionable: z.ZodLiteral<false>;
            actionability: z.ZodEnum<{
                BLOCKED: "BLOCKED";
                INDICATIVE_ONLY: "INDICATIVE_ONLY";
            }>;
            safetyRatio: z.ZodNullable<z.ZodString>;
            ltv: z.ZodNullable<z.ZodString>;
            ratioScale: z.ZodString;
            debtAmount: z.ZodNullable<z.ZodString>;
            collateralAmount: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            snapshotRetrievedAt: z.ZodNullable<z.ZodISODateTime>;
            calculatedAt: z.ZodISODateTime;
            temporalContext: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                FIXTURE: "FIXTURE";
                LIVE_AS_OF_BLOCK: "LIVE_AS_OF_BLOCK";
                HISTORICAL: "HISTORICAL";
            }>;
            thresholds: z.ZodObject<{
                warningRatio: z.ZodString;
                criticalRatio: z.ZodString;
                targetRatio: z.ZodString;
                liquidationBoundary: z.ZodString;
            }, z.core.$strict>;
            repayment: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            additionalCollateral: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            recoveryEligibility: z.ZodOptional<z.ZodObject<{
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
        diagnostics: z.ZodArray<z.ZodEnum<{
            BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
            RPC_UNAVAILABLE: "RPC_UNAVAILABLE";
            MCP_UNAVAILABLE: "MCP_UNAVAILABLE";
            RPC_INVALID: "RPC_INVALID";
            MCP_INVALID: "MCP_INVALID";
            SNAPSHOT_INVALID: "SNAPSHOT_INVALID";
            SNAPSHOT_UNAVAILABLE: "SNAPSHOT_UNAVAILABLE";
            ORACLE_UNVERIFIED: "ORACLE_UNVERIFIED";
            ORACLE_DATA_UNAVAILABLE: "ORACLE_DATA_UNAVAILABLE";
            ORACLE_DATA_INVALID: "ORACLE_DATA_INVALID";
            ORACLE_FRESHNESS_UNKNOWN: "ORACLE_FRESHNESS_UNKNOWN";
            FRESHNESS_UNDETERMINED: "FRESHNESS_UNDETERMINED";
            MONITOR_MODE_MISMATCH: "MONITOR_MODE_MISMATCH";
            PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
            RISK_CALCULATION_FAILED: "RISK_CALCULATION_FAILED";
            BLOCK_REGRESSION: "BLOCK_REGRESSION";
        }>>;
        progression: z.ZodOptional<z.ZodObject<{
            state: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                ADVANCING: "ADVANCING";
                UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
                STALLED: "STALLED";
                REGRESSED: "REGRESSED";
                CONFLICT: "CONFLICT";
            }>;
            reason: z.ZodNullable<z.ZodEnum<{
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
            advancedBlocks: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            headNumber: z.ZodNullable<z.ZodString>;
            baselineBlockNumber: z.ZodNullable<z.ZodString>;
            baselineBlockHash: z.ZodNullable<z.ZodString>;
            sameBlockStreak: z.ZodNumber;
            evaluatedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        assurance: z.ZodOptional<z.ZodObject<{
            schemaVersion: z.ZodLiteral<1>;
            policyVersion: z.ZodLiteral<"oracle-assurance-v1">;
            chainId: z.ZodLiteral<1672>;
            marketId: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            evaluatedAt: z.ZodISODateTime;
            retrievedAt: z.ZodNullable<z.ZodISODateTime>;
            evidenceKind: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>;
            continuityScope: z.ZodString;
            baseline: z.ZodNullable<z.ZodObject<{
                block: z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>;
                retrievedAt: z.ZodISODateTime;
                snapshotIdentifier: z.ZodString;
                configuration: z.ZodObject<{
                    oracle: z.ZodString;
                    feed: z.ZodString;
                    cache: z.ZodNullable<z.ZodString>;
                    forwarder: z.ZodNullable<z.ZodString>;
                    feedId: z.ZodNullable<z.ZodString>;
                    proxyOwner: z.ZodNullable<z.ZodString>;
                    cacheOwner: z.ZodNullable<z.ZodString>;
                    forwarderOwner: z.ZodNullable<z.ZodString>;
                    allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                    proxyImplementation: z.ZodNullable<z.ZodString>;
                    proxyAdmin: z.ZodNullable<z.ZodString>;
                    proxyBeacon: z.ZodNullable<z.ZodString>;
                    oracleRuntime: z.ZodNullable<z.ZodString>;
                    proxyRuntime: z.ZodNullable<z.ZodString>;
                    cacheRuntime: z.ZodNullable<z.ZodString>;
                    forwarderRuntime: z.ZodNullable<z.ZodString>;
                    compositionHash: z.ZodNullable<z.ZodString>;
                    signerConfigurationHash: z.ZodNullable<z.ZodString>;
                    workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                    collateralToken: z.ZodNullable<z.ZodString>;
                    loanToken: z.ZodNullable<z.ZodString>;
                    collateralDecimals: z.ZodNullable<z.ZodNumber>;
                    loanDecimals: z.ZodNullable<z.ZodNumber>;
                    feedDecimals: z.ZodNullable<z.ZodNumber>;
                    denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                    descriptionHash: z.ZodNullable<z.ZodString>;
                    signerCoverage: z.ZodEnum<{
                        UNOBSERVED: "UNOBSERVED";
                        SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                        COMPLETE: "COMPLETE";
                    }>;
                }, z.core.$strict>;
                configurationFingerprint: z.ZodString;
                observationTimestamp: z.ZodNullable<z.ZodString>;
            }, z.core.$strict>>;
            block: z.ZodNullable<z.ZodObject<{
                number: z.ZodString;
                hash: z.ZodString;
                timestamp: z.ZodString;
            }, z.core.$strict>>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            overall: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            actionable: z.ZodLiteral<false>;
            gate: z.ZodEnum<{
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ASSURANCE_REQUIREMENTS_MET: "ASSURANCE_REQUIREMENTS_MET";
            }>;
            dimensions: z.ZodObject<{
                CONTRACT_IDENTITY: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                SOURCE_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                OPERATOR_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                PRICE_SEMANTICS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                FRESHNESS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                INDEPENDENT_VALIDATION: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                CONFIGURATION_CONTROL: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
            }, z.core.$strict>;
            configuration: z.ZodNullable<z.ZodObject<{
                oracle: z.ZodString;
                feed: z.ZodString;
                cache: z.ZodNullable<z.ZodString>;
                forwarder: z.ZodNullable<z.ZodString>;
                feedId: z.ZodNullable<z.ZodString>;
                proxyOwner: z.ZodNullable<z.ZodString>;
                cacheOwner: z.ZodNullable<z.ZodString>;
                forwarderOwner: z.ZodNullable<z.ZodString>;
                allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                proxyImplementation: z.ZodNullable<z.ZodString>;
                proxyAdmin: z.ZodNullable<z.ZodString>;
                proxyBeacon: z.ZodNullable<z.ZodString>;
                oracleRuntime: z.ZodNullable<z.ZodString>;
                proxyRuntime: z.ZodNullable<z.ZodString>;
                cacheRuntime: z.ZodNullable<z.ZodString>;
                forwarderRuntime: z.ZodNullable<z.ZodString>;
                compositionHash: z.ZodNullable<z.ZodString>;
                signerConfigurationHash: z.ZodNullable<z.ZodString>;
                workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                collateralToken: z.ZodNullable<z.ZodString>;
                loanToken: z.ZodNullable<z.ZodString>;
                collateralDecimals: z.ZodNullable<z.ZodNumber>;
                loanDecimals: z.ZodNullable<z.ZodNumber>;
                feedDecimals: z.ZodNullable<z.ZodNumber>;
                denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                descriptionHash: z.ZodNullable<z.ZodString>;
                signerCoverage: z.ZodEnum<{
                    UNOBSERVED: "UNOBSERVED";
                    SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                    COMPLETE: "COMPLETE";
                }>;
            }, z.core.$strict>>;
            configurationFingerprint: z.ZodNullable<z.ZodString>;
            changes: z.ZodArray<z.ZodEnum<{
                ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
                PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
                ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
                ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
                ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
                ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
            }>>;
            evidenceInvalidated: z.ZodBoolean;
            invalidatedAt: z.ZodNullable<z.ZodISODateTime>;
            invalidationReason: z.ZodNullable<z.ZodEnum<{
                CONFIGURATION_CHANGE: "CONFIGURATION_CHANGE";
                OBSERVABILITY_GAP: "OBSERVABILITY_GAP";
            }>>;
            freshness: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                observationTimestamp: z.ZodNullable<z.ZodString>;
                observationAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyOrigin: z.ZodEnum<{
                    NONE: "NONE";
                    OPERATOR_DEFINED_LOCAL_REJECTION: "OPERATOR_DEFINED_LOCAL_REJECTION";
                }>;
                policyRejected: z.ZodBoolean;
                verifiedHeartbeatSeconds: z.ZodNullable<z.ZodString>;
                upstreamFreshnessGuaranteeSeconds: z.ZodNullable<z.ZodString>;
                timestampMeaning: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    WORKFLOW_SUPPLIED_OBSERVATION_TIME: "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                }>;
                onchainExpiryEnforced: z.ZodNullable<z.ZodBoolean>;
                timingConfigurationFingerprint: z.ZodNullable<z.ZodString>;
                anomalies: z.ZodArray<z.ZodEnum<{
                    ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
                    FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
                    TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
                    TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
                }>>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            independent: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                availability: z.ZodEnum<{
                    UNAVAILABLE: "UNAVAILABLE";
                    AVAILABLE: "AVAILABLE";
                    NOT_CONFIGURED: "NOT_CONFIGURED";
                }>;
                sourceId: z.ZodNullable<z.ZodString>;
                eligible: z.ZodBoolean;
                reasons: z.ZodArray<z.ZodString>;
                toleranceBps: z.ZodNullable<z.ZodNumber>;
                morphoPrice: z.ZodNullable<z.ZodString>;
                independentPrice: z.ZodNullable<z.ZodString>;
                candidate: z.ZodNullable<z.ZodObject<{
                    id: z.ZodString;
                    availability: z.ZodEnum<{
                        UNAVAILABLE: "UNAVAILABLE";
                        AVAILABLE: "AVAILABLE";
                    }>;
                    base: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    quote: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    kind: z.ZodEnum<{
                        MARKET_PRICE: "MARKET_PRICE";
                        REDEMPTION_RATE: "REDEMPTION_RATE";
                    }>;
                    denomination: z.ZodEnum<{
                        WHOLE_QUOTE_PER_WHOLE_BASE: "WHOLE_QUOTE_PER_WHOLE_BASE";
                        QUOTE_BASE_UNITS_PER_BASE_UNIT: "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    }>;
                    price: z.ZodNullable<z.ZodString>;
                    decimals: z.ZodNumber;
                    timestamp: z.ZodNullable<z.ZodString>;
                    frequencySeconds: z.ZodNullable<z.ZodString>;
                    operatorId: z.ZodNullable<z.ZodString>;
                    upstreamId: z.ZodNullable<z.ZodString>;
                    proofs: z.ZodArray<z.ZodObject<{
                        claim: z.ZodEnum<{
                            ASSET: "ASSET";
                            QUOTE: "QUOTE";
                            DENOMINATION: "DENOMINATION";
                            TIMESTAMP: "TIMESTAMP";
                            FREQUENCY: "FREQUENCY";
                            OPERATOR: "OPERATOR";
                            PROVENANCE: "PROVENANCE";
                            INDEPENDENCE: "INDEPENDENCE";
                        }>;
                        evidence: z.ZodObject<{
                            subjectAddress: z.ZodString;
                            chainId: z.ZodNumber;
                            source: z.ZodString;
                            sourceKind: z.ZodEnum<{
                                FIXTURE: "FIXTURE";
                                SNAPSHOT: "SNAPSHOT";
                                RPC: "RPC";
                                MCP: "MCP";
                                VERIFIED_SOURCE: "VERIFIED_SOURCE";
                                COMPILER: "COMPILER";
                                OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                                RESEARCH: "RESEARCH";
                                LOCAL_POLICY: "LOCAL_POLICY";
                            }>;
                            block: z.ZodNullable<z.ZodObject<{
                                number: z.ZodString;
                                hash: z.ZodString;
                                timestamp: z.ZodString;
                            }, z.core.$strict>>;
                            retrievedAt: z.ZodISODateTime;
                            method: z.ZodString;
                            artifactSha256: z.ZodNullable<z.ZodString>;
                            confidence: z.ZodEnum<{
                                UNKNOWN: "UNKNOWN";
                                PROVEN: "PROVEN";
                                INTERPRETATION: "INTERPRETATION";
                            }>;
                            unresolved: z.ZodArray<z.ZodString>;
                        }, z.core.$strict>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>;
                selectedUpstreamId: z.ZodNullable<z.ZodString>;
                base: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                quote: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                evidenceMode: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    PRODUCTION: "PRODUCTION";
                }>;
                blockTimestamp: z.ZodNullable<z.ZodString>;
                selectedTimestamp: z.ZodNullable<z.ZodString>;
                candidateAgeSeconds: z.ZodNullable<z.ZodString>;
                timestampSkewSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxSkewSeconds: z.ZodNullable<z.ZodString>;
                normalizedMorpho: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                normalizedIndependent: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                deviationBps: z.ZodNullable<z.ZodString>;
                disagrees: z.ZodBoolean;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            findings: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                subjectAddress: z.ZodString;
                statement: z.ZodString;
                classification: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
            limitations: z.ZodArray<z.ZodString>;
            providerIndependence: z.ZodLiteral<"RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT">;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    current: z.ZodObject<{
        cycleId: z.ZodString;
        observedAt: z.ZodISODateTime;
        accepted: z.ZodBoolean;
        risk: z.ZodObject<{
            chainId: z.ZodLiteral<1672>;
            account: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
            marketId: z.ZodLiteral<`0x${string}`>;
            protocol: z.ZodLiteral<"Morpho Blue">;
            morphoAddress: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            accountRole: z.ZodEnum<{
                PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
                EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            }>;
            calculationVersion: z.ZodLiteral<"1.0.0">;
            evidenceKind: z.ZodNullable<z.ZodEnum<{
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>>;
            mathematicalRiskState: z.ZodNullable<z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>>;
            effectiveRiskState: z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>;
            dataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2DataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2OracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleVerification: z.ZodLiteral<"UNVERIFIED">;
            heartbeat: z.ZodLiteral<"UNKNOWN">;
            actionable: z.ZodLiteral<false>;
            actionability: z.ZodEnum<{
                BLOCKED: "BLOCKED";
                INDICATIVE_ONLY: "INDICATIVE_ONLY";
            }>;
            safetyRatio: z.ZodNullable<z.ZodString>;
            ltv: z.ZodNullable<z.ZodString>;
            ratioScale: z.ZodString;
            debtAmount: z.ZodNullable<z.ZodString>;
            collateralAmount: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            snapshotRetrievedAt: z.ZodNullable<z.ZodISODateTime>;
            calculatedAt: z.ZodISODateTime;
            temporalContext: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                FIXTURE: "FIXTURE";
                LIVE_AS_OF_BLOCK: "LIVE_AS_OF_BLOCK";
                HISTORICAL: "HISTORICAL";
            }>;
            thresholds: z.ZodObject<{
                warningRatio: z.ZodString;
                criticalRatio: z.ZodString;
                targetRatio: z.ZodString;
                liquidationBoundary: z.ZodString;
            }, z.core.$strict>;
            repayment: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            additionalCollateral: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            recoveryEligibility: z.ZodOptional<z.ZodObject<{
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
        diagnostics: z.ZodArray<z.ZodEnum<{
            BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
            RPC_UNAVAILABLE: "RPC_UNAVAILABLE";
            MCP_UNAVAILABLE: "MCP_UNAVAILABLE";
            RPC_INVALID: "RPC_INVALID";
            MCP_INVALID: "MCP_INVALID";
            SNAPSHOT_INVALID: "SNAPSHOT_INVALID";
            SNAPSHOT_UNAVAILABLE: "SNAPSHOT_UNAVAILABLE";
            ORACLE_UNVERIFIED: "ORACLE_UNVERIFIED";
            ORACLE_DATA_UNAVAILABLE: "ORACLE_DATA_UNAVAILABLE";
            ORACLE_DATA_INVALID: "ORACLE_DATA_INVALID";
            ORACLE_FRESHNESS_UNKNOWN: "ORACLE_FRESHNESS_UNKNOWN";
            FRESHNESS_UNDETERMINED: "FRESHNESS_UNDETERMINED";
            MONITOR_MODE_MISMATCH: "MONITOR_MODE_MISMATCH";
            PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
            RISK_CALCULATION_FAILED: "RISK_CALCULATION_FAILED";
            BLOCK_REGRESSION: "BLOCK_REGRESSION";
        }>>;
        progression: z.ZodOptional<z.ZodObject<{
            state: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                ADVANCING: "ADVANCING";
                UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
                STALLED: "STALLED";
                REGRESSED: "REGRESSED";
                CONFLICT: "CONFLICT";
            }>;
            reason: z.ZodNullable<z.ZodEnum<{
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
            advancedBlocks: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            headNumber: z.ZodNullable<z.ZodString>;
            baselineBlockNumber: z.ZodNullable<z.ZodString>;
            baselineBlockHash: z.ZodNullable<z.ZodString>;
            sameBlockStreak: z.ZodNumber;
            evaluatedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        assurance: z.ZodOptional<z.ZodObject<{
            schemaVersion: z.ZodLiteral<1>;
            policyVersion: z.ZodLiteral<"oracle-assurance-v1">;
            chainId: z.ZodLiteral<1672>;
            marketId: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            evaluatedAt: z.ZodISODateTime;
            retrievedAt: z.ZodNullable<z.ZodISODateTime>;
            evidenceKind: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>;
            continuityScope: z.ZodString;
            baseline: z.ZodNullable<z.ZodObject<{
                block: z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>;
                retrievedAt: z.ZodISODateTime;
                snapshotIdentifier: z.ZodString;
                configuration: z.ZodObject<{
                    oracle: z.ZodString;
                    feed: z.ZodString;
                    cache: z.ZodNullable<z.ZodString>;
                    forwarder: z.ZodNullable<z.ZodString>;
                    feedId: z.ZodNullable<z.ZodString>;
                    proxyOwner: z.ZodNullable<z.ZodString>;
                    cacheOwner: z.ZodNullable<z.ZodString>;
                    forwarderOwner: z.ZodNullable<z.ZodString>;
                    allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                    proxyImplementation: z.ZodNullable<z.ZodString>;
                    proxyAdmin: z.ZodNullable<z.ZodString>;
                    proxyBeacon: z.ZodNullable<z.ZodString>;
                    oracleRuntime: z.ZodNullable<z.ZodString>;
                    proxyRuntime: z.ZodNullable<z.ZodString>;
                    cacheRuntime: z.ZodNullable<z.ZodString>;
                    forwarderRuntime: z.ZodNullable<z.ZodString>;
                    compositionHash: z.ZodNullable<z.ZodString>;
                    signerConfigurationHash: z.ZodNullable<z.ZodString>;
                    workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                    collateralToken: z.ZodNullable<z.ZodString>;
                    loanToken: z.ZodNullable<z.ZodString>;
                    collateralDecimals: z.ZodNullable<z.ZodNumber>;
                    loanDecimals: z.ZodNullable<z.ZodNumber>;
                    feedDecimals: z.ZodNullable<z.ZodNumber>;
                    denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                    descriptionHash: z.ZodNullable<z.ZodString>;
                    signerCoverage: z.ZodEnum<{
                        UNOBSERVED: "UNOBSERVED";
                        SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                        COMPLETE: "COMPLETE";
                    }>;
                }, z.core.$strict>;
                configurationFingerprint: z.ZodString;
                observationTimestamp: z.ZodNullable<z.ZodString>;
            }, z.core.$strict>>;
            block: z.ZodNullable<z.ZodObject<{
                number: z.ZodString;
                hash: z.ZodString;
                timestamp: z.ZodString;
            }, z.core.$strict>>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            overall: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            actionable: z.ZodLiteral<false>;
            gate: z.ZodEnum<{
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ASSURANCE_REQUIREMENTS_MET: "ASSURANCE_REQUIREMENTS_MET";
            }>;
            dimensions: z.ZodObject<{
                CONTRACT_IDENTITY: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                SOURCE_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                OPERATOR_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                PRICE_SEMANTICS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                FRESHNESS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                INDEPENDENT_VALIDATION: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                CONFIGURATION_CONTROL: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
            }, z.core.$strict>;
            configuration: z.ZodNullable<z.ZodObject<{
                oracle: z.ZodString;
                feed: z.ZodString;
                cache: z.ZodNullable<z.ZodString>;
                forwarder: z.ZodNullable<z.ZodString>;
                feedId: z.ZodNullable<z.ZodString>;
                proxyOwner: z.ZodNullable<z.ZodString>;
                cacheOwner: z.ZodNullable<z.ZodString>;
                forwarderOwner: z.ZodNullable<z.ZodString>;
                allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                proxyImplementation: z.ZodNullable<z.ZodString>;
                proxyAdmin: z.ZodNullable<z.ZodString>;
                proxyBeacon: z.ZodNullable<z.ZodString>;
                oracleRuntime: z.ZodNullable<z.ZodString>;
                proxyRuntime: z.ZodNullable<z.ZodString>;
                cacheRuntime: z.ZodNullable<z.ZodString>;
                forwarderRuntime: z.ZodNullable<z.ZodString>;
                compositionHash: z.ZodNullable<z.ZodString>;
                signerConfigurationHash: z.ZodNullable<z.ZodString>;
                workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                collateralToken: z.ZodNullable<z.ZodString>;
                loanToken: z.ZodNullable<z.ZodString>;
                collateralDecimals: z.ZodNullable<z.ZodNumber>;
                loanDecimals: z.ZodNullable<z.ZodNumber>;
                feedDecimals: z.ZodNullable<z.ZodNumber>;
                denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                descriptionHash: z.ZodNullable<z.ZodString>;
                signerCoverage: z.ZodEnum<{
                    UNOBSERVED: "UNOBSERVED";
                    SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                    COMPLETE: "COMPLETE";
                }>;
            }, z.core.$strict>>;
            configurationFingerprint: z.ZodNullable<z.ZodString>;
            changes: z.ZodArray<z.ZodEnum<{
                ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
                PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
                ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
                ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
                ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
                ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
            }>>;
            evidenceInvalidated: z.ZodBoolean;
            invalidatedAt: z.ZodNullable<z.ZodISODateTime>;
            invalidationReason: z.ZodNullable<z.ZodEnum<{
                CONFIGURATION_CHANGE: "CONFIGURATION_CHANGE";
                OBSERVABILITY_GAP: "OBSERVABILITY_GAP";
            }>>;
            freshness: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                observationTimestamp: z.ZodNullable<z.ZodString>;
                observationAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyOrigin: z.ZodEnum<{
                    NONE: "NONE";
                    OPERATOR_DEFINED_LOCAL_REJECTION: "OPERATOR_DEFINED_LOCAL_REJECTION";
                }>;
                policyRejected: z.ZodBoolean;
                verifiedHeartbeatSeconds: z.ZodNullable<z.ZodString>;
                upstreamFreshnessGuaranteeSeconds: z.ZodNullable<z.ZodString>;
                timestampMeaning: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    WORKFLOW_SUPPLIED_OBSERVATION_TIME: "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                }>;
                onchainExpiryEnforced: z.ZodNullable<z.ZodBoolean>;
                timingConfigurationFingerprint: z.ZodNullable<z.ZodString>;
                anomalies: z.ZodArray<z.ZodEnum<{
                    ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
                    FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
                    TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
                    TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
                }>>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            independent: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                availability: z.ZodEnum<{
                    UNAVAILABLE: "UNAVAILABLE";
                    AVAILABLE: "AVAILABLE";
                    NOT_CONFIGURED: "NOT_CONFIGURED";
                }>;
                sourceId: z.ZodNullable<z.ZodString>;
                eligible: z.ZodBoolean;
                reasons: z.ZodArray<z.ZodString>;
                toleranceBps: z.ZodNullable<z.ZodNumber>;
                morphoPrice: z.ZodNullable<z.ZodString>;
                independentPrice: z.ZodNullable<z.ZodString>;
                candidate: z.ZodNullable<z.ZodObject<{
                    id: z.ZodString;
                    availability: z.ZodEnum<{
                        UNAVAILABLE: "UNAVAILABLE";
                        AVAILABLE: "AVAILABLE";
                    }>;
                    base: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    quote: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    kind: z.ZodEnum<{
                        MARKET_PRICE: "MARKET_PRICE";
                        REDEMPTION_RATE: "REDEMPTION_RATE";
                    }>;
                    denomination: z.ZodEnum<{
                        WHOLE_QUOTE_PER_WHOLE_BASE: "WHOLE_QUOTE_PER_WHOLE_BASE";
                        QUOTE_BASE_UNITS_PER_BASE_UNIT: "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    }>;
                    price: z.ZodNullable<z.ZodString>;
                    decimals: z.ZodNumber;
                    timestamp: z.ZodNullable<z.ZodString>;
                    frequencySeconds: z.ZodNullable<z.ZodString>;
                    operatorId: z.ZodNullable<z.ZodString>;
                    upstreamId: z.ZodNullable<z.ZodString>;
                    proofs: z.ZodArray<z.ZodObject<{
                        claim: z.ZodEnum<{
                            ASSET: "ASSET";
                            QUOTE: "QUOTE";
                            DENOMINATION: "DENOMINATION";
                            TIMESTAMP: "TIMESTAMP";
                            FREQUENCY: "FREQUENCY";
                            OPERATOR: "OPERATOR";
                            PROVENANCE: "PROVENANCE";
                            INDEPENDENCE: "INDEPENDENCE";
                        }>;
                        evidence: z.ZodObject<{
                            subjectAddress: z.ZodString;
                            chainId: z.ZodNumber;
                            source: z.ZodString;
                            sourceKind: z.ZodEnum<{
                                FIXTURE: "FIXTURE";
                                SNAPSHOT: "SNAPSHOT";
                                RPC: "RPC";
                                MCP: "MCP";
                                VERIFIED_SOURCE: "VERIFIED_SOURCE";
                                COMPILER: "COMPILER";
                                OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                                RESEARCH: "RESEARCH";
                                LOCAL_POLICY: "LOCAL_POLICY";
                            }>;
                            block: z.ZodNullable<z.ZodObject<{
                                number: z.ZodString;
                                hash: z.ZodString;
                                timestamp: z.ZodString;
                            }, z.core.$strict>>;
                            retrievedAt: z.ZodISODateTime;
                            method: z.ZodString;
                            artifactSha256: z.ZodNullable<z.ZodString>;
                            confidence: z.ZodEnum<{
                                UNKNOWN: "UNKNOWN";
                                PROVEN: "PROVEN";
                                INTERPRETATION: "INTERPRETATION";
                            }>;
                            unresolved: z.ZodArray<z.ZodString>;
                        }, z.core.$strict>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>;
                selectedUpstreamId: z.ZodNullable<z.ZodString>;
                base: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                quote: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                evidenceMode: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    PRODUCTION: "PRODUCTION";
                }>;
                blockTimestamp: z.ZodNullable<z.ZodString>;
                selectedTimestamp: z.ZodNullable<z.ZodString>;
                candidateAgeSeconds: z.ZodNullable<z.ZodString>;
                timestampSkewSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxSkewSeconds: z.ZodNullable<z.ZodString>;
                normalizedMorpho: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                normalizedIndependent: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                deviationBps: z.ZodNullable<z.ZodString>;
                disagrees: z.ZodBoolean;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            findings: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                subjectAddress: z.ZodString;
                statement: z.ZodString;
                classification: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
            limitations: z.ZodArray<z.ZodString>;
            providerIndependence: z.ZodLiteral<"RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT">;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    suggestedAction: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strict>;
/** Parse historical bytes only after their storage hash/integrity check, then add a visibly legacy non-financial action in memory. */
export declare const storedAlertSchema: z.ZodPipe<z.ZodUnion<readonly [z.ZodObject<{
    id: z.ZodString;
    fingerprint: z.ZodString;
    scope: z.ZodString;
    cycleId: z.ZodString;
    createdAt: z.ZodISODateTime;
    severity: z.ZodEnum<{
        WARNING: "WARNING";
        CRITICAL: "CRITICAL";
        INFO: "INFO";
        BOUNDARY: "BOUNDARY";
    }>;
    category: z.ZodEnum<{
        RISK: "RISK";
        DATA_QUALITY: "DATA_QUALITY";
        ORACLE: "ORACLE";
        MONITOR_HEALTH: "MONITOR_HEALTH";
    }>;
    code: z.ZodEnum<{
        ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
        PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
        ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
        ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
        ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
        ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
        INDEPENDENT_PRICE_DISAGREEMENT: "INDEPENDENT_PRICE_DISAGREEMENT";
        INITIAL_RISK: "INITIAL_RISK";
        RISK_WORSENED: "RISK_WORSENED";
        RISK_IMPROVED: "RISK_IMPROVED";
        RISK_RECOVERY: "RISK_RECOVERY";
        NO_DEBT_OBSERVED: "NO_DEBT_OBSERVED";
        DEBT_OBSERVED: "DEBT_OBSERVED";
        CRITICAL_REMINDER: "CRITICAL_REMINDER";
        DATA_QUALITY_CHANGED: "DATA_QUALITY_CHANGED";
        DATA_RESTORED: "DATA_RESTORED";
        ORACLE_QUALITY_CHANGED: "ORACLE_QUALITY_CHANGED";
        PERSISTENT_READ_FAILURE: "PERSISTENT_READ_FAILURE";
        ORACLE_TIMESTAMP_ANOMALY: "ORACLE_TIMESTAMP_ANOMALY";
        ORACLE_ASSURANCE_DETERIORATED: "ORACLE_ASSURANCE_DETERIORATED";
        ORACLE_ASSURANCE_IMPROVED: "ORACLE_ASSURANCE_IMPROVED";
        ORACLE_ASSURANCE_INVALIDATED: "ORACLE_ASSURANCE_INVALIDATED";
    }>;
    previous: z.ZodNullable<z.ZodObject<{
        cycleId: z.ZodString;
        observedAt: z.ZodISODateTime;
        accepted: z.ZodBoolean;
        risk: z.ZodObject<{
            chainId: z.ZodLiteral<1672>;
            account: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
            marketId: z.ZodLiteral<`0x${string}`>;
            protocol: z.ZodLiteral<"Morpho Blue">;
            morphoAddress: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            accountRole: z.ZodEnum<{
                PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
                EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            }>;
            calculationVersion: z.ZodLiteral<"1.0.0">;
            evidenceKind: z.ZodNullable<z.ZodEnum<{
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>>;
            mathematicalRiskState: z.ZodNullable<z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>>;
            effectiveRiskState: z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>;
            dataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2DataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2OracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleVerification: z.ZodLiteral<"UNVERIFIED">;
            heartbeat: z.ZodLiteral<"UNKNOWN">;
            actionable: z.ZodLiteral<false>;
            actionability: z.ZodEnum<{
                BLOCKED: "BLOCKED";
                INDICATIVE_ONLY: "INDICATIVE_ONLY";
            }>;
            safetyRatio: z.ZodNullable<z.ZodString>;
            ltv: z.ZodNullable<z.ZodString>;
            ratioScale: z.ZodString;
            debtAmount: z.ZodNullable<z.ZodString>;
            collateralAmount: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            snapshotRetrievedAt: z.ZodNullable<z.ZodISODateTime>;
            calculatedAt: z.ZodISODateTime;
            temporalContext: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                FIXTURE: "FIXTURE";
                LIVE_AS_OF_BLOCK: "LIVE_AS_OF_BLOCK";
                HISTORICAL: "HISTORICAL";
            }>;
            thresholds: z.ZodObject<{
                warningRatio: z.ZodString;
                criticalRatio: z.ZodString;
                targetRatio: z.ZodString;
                liquidationBoundary: z.ZodString;
            }, z.core.$strict>;
            repayment: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            additionalCollateral: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            recoveryEligibility: z.ZodOptional<z.ZodObject<{
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
        diagnostics: z.ZodArray<z.ZodEnum<{
            BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
            RPC_UNAVAILABLE: "RPC_UNAVAILABLE";
            MCP_UNAVAILABLE: "MCP_UNAVAILABLE";
            RPC_INVALID: "RPC_INVALID";
            MCP_INVALID: "MCP_INVALID";
            SNAPSHOT_INVALID: "SNAPSHOT_INVALID";
            SNAPSHOT_UNAVAILABLE: "SNAPSHOT_UNAVAILABLE";
            ORACLE_UNVERIFIED: "ORACLE_UNVERIFIED";
            ORACLE_DATA_UNAVAILABLE: "ORACLE_DATA_UNAVAILABLE";
            ORACLE_DATA_INVALID: "ORACLE_DATA_INVALID";
            ORACLE_FRESHNESS_UNKNOWN: "ORACLE_FRESHNESS_UNKNOWN";
            FRESHNESS_UNDETERMINED: "FRESHNESS_UNDETERMINED";
            MONITOR_MODE_MISMATCH: "MONITOR_MODE_MISMATCH";
            PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
            RISK_CALCULATION_FAILED: "RISK_CALCULATION_FAILED";
            BLOCK_REGRESSION: "BLOCK_REGRESSION";
        }>>;
        progression: z.ZodOptional<z.ZodObject<{
            state: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                ADVANCING: "ADVANCING";
                UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
                STALLED: "STALLED";
                REGRESSED: "REGRESSED";
                CONFLICT: "CONFLICT";
            }>;
            reason: z.ZodNullable<z.ZodEnum<{
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
            advancedBlocks: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            headNumber: z.ZodNullable<z.ZodString>;
            baselineBlockNumber: z.ZodNullable<z.ZodString>;
            baselineBlockHash: z.ZodNullable<z.ZodString>;
            sameBlockStreak: z.ZodNumber;
            evaluatedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        assurance: z.ZodOptional<z.ZodObject<{
            schemaVersion: z.ZodLiteral<1>;
            policyVersion: z.ZodLiteral<"oracle-assurance-v1">;
            chainId: z.ZodLiteral<1672>;
            marketId: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            evaluatedAt: z.ZodISODateTime;
            retrievedAt: z.ZodNullable<z.ZodISODateTime>;
            evidenceKind: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>;
            continuityScope: z.ZodString;
            baseline: z.ZodNullable<z.ZodObject<{
                block: z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>;
                retrievedAt: z.ZodISODateTime;
                snapshotIdentifier: z.ZodString;
                configuration: z.ZodObject<{
                    oracle: z.ZodString;
                    feed: z.ZodString;
                    cache: z.ZodNullable<z.ZodString>;
                    forwarder: z.ZodNullable<z.ZodString>;
                    feedId: z.ZodNullable<z.ZodString>;
                    proxyOwner: z.ZodNullable<z.ZodString>;
                    cacheOwner: z.ZodNullable<z.ZodString>;
                    forwarderOwner: z.ZodNullable<z.ZodString>;
                    allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                    proxyImplementation: z.ZodNullable<z.ZodString>;
                    proxyAdmin: z.ZodNullable<z.ZodString>;
                    proxyBeacon: z.ZodNullable<z.ZodString>;
                    oracleRuntime: z.ZodNullable<z.ZodString>;
                    proxyRuntime: z.ZodNullable<z.ZodString>;
                    cacheRuntime: z.ZodNullable<z.ZodString>;
                    forwarderRuntime: z.ZodNullable<z.ZodString>;
                    compositionHash: z.ZodNullable<z.ZodString>;
                    signerConfigurationHash: z.ZodNullable<z.ZodString>;
                    workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                    collateralToken: z.ZodNullable<z.ZodString>;
                    loanToken: z.ZodNullable<z.ZodString>;
                    collateralDecimals: z.ZodNullable<z.ZodNumber>;
                    loanDecimals: z.ZodNullable<z.ZodNumber>;
                    feedDecimals: z.ZodNullable<z.ZodNumber>;
                    denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                    descriptionHash: z.ZodNullable<z.ZodString>;
                    signerCoverage: z.ZodEnum<{
                        UNOBSERVED: "UNOBSERVED";
                        SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                        COMPLETE: "COMPLETE";
                    }>;
                }, z.core.$strict>;
                configurationFingerprint: z.ZodString;
                observationTimestamp: z.ZodNullable<z.ZodString>;
            }, z.core.$strict>>;
            block: z.ZodNullable<z.ZodObject<{
                number: z.ZodString;
                hash: z.ZodString;
                timestamp: z.ZodString;
            }, z.core.$strict>>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            overall: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            actionable: z.ZodLiteral<false>;
            gate: z.ZodEnum<{
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ASSURANCE_REQUIREMENTS_MET: "ASSURANCE_REQUIREMENTS_MET";
            }>;
            dimensions: z.ZodObject<{
                CONTRACT_IDENTITY: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                SOURCE_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                OPERATOR_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                PRICE_SEMANTICS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                FRESHNESS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                INDEPENDENT_VALIDATION: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                CONFIGURATION_CONTROL: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
            }, z.core.$strict>;
            configuration: z.ZodNullable<z.ZodObject<{
                oracle: z.ZodString;
                feed: z.ZodString;
                cache: z.ZodNullable<z.ZodString>;
                forwarder: z.ZodNullable<z.ZodString>;
                feedId: z.ZodNullable<z.ZodString>;
                proxyOwner: z.ZodNullable<z.ZodString>;
                cacheOwner: z.ZodNullable<z.ZodString>;
                forwarderOwner: z.ZodNullable<z.ZodString>;
                allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                proxyImplementation: z.ZodNullable<z.ZodString>;
                proxyAdmin: z.ZodNullable<z.ZodString>;
                proxyBeacon: z.ZodNullable<z.ZodString>;
                oracleRuntime: z.ZodNullable<z.ZodString>;
                proxyRuntime: z.ZodNullable<z.ZodString>;
                cacheRuntime: z.ZodNullable<z.ZodString>;
                forwarderRuntime: z.ZodNullable<z.ZodString>;
                compositionHash: z.ZodNullable<z.ZodString>;
                signerConfigurationHash: z.ZodNullable<z.ZodString>;
                workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                collateralToken: z.ZodNullable<z.ZodString>;
                loanToken: z.ZodNullable<z.ZodString>;
                collateralDecimals: z.ZodNullable<z.ZodNumber>;
                loanDecimals: z.ZodNullable<z.ZodNumber>;
                feedDecimals: z.ZodNullable<z.ZodNumber>;
                denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                descriptionHash: z.ZodNullable<z.ZodString>;
                signerCoverage: z.ZodEnum<{
                    UNOBSERVED: "UNOBSERVED";
                    SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                    COMPLETE: "COMPLETE";
                }>;
            }, z.core.$strict>>;
            configurationFingerprint: z.ZodNullable<z.ZodString>;
            changes: z.ZodArray<z.ZodEnum<{
                ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
                PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
                ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
                ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
                ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
                ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
            }>>;
            evidenceInvalidated: z.ZodBoolean;
            invalidatedAt: z.ZodNullable<z.ZodISODateTime>;
            invalidationReason: z.ZodNullable<z.ZodEnum<{
                CONFIGURATION_CHANGE: "CONFIGURATION_CHANGE";
                OBSERVABILITY_GAP: "OBSERVABILITY_GAP";
            }>>;
            freshness: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                observationTimestamp: z.ZodNullable<z.ZodString>;
                observationAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyOrigin: z.ZodEnum<{
                    NONE: "NONE";
                    OPERATOR_DEFINED_LOCAL_REJECTION: "OPERATOR_DEFINED_LOCAL_REJECTION";
                }>;
                policyRejected: z.ZodBoolean;
                verifiedHeartbeatSeconds: z.ZodNullable<z.ZodString>;
                upstreamFreshnessGuaranteeSeconds: z.ZodNullable<z.ZodString>;
                timestampMeaning: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    WORKFLOW_SUPPLIED_OBSERVATION_TIME: "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                }>;
                onchainExpiryEnforced: z.ZodNullable<z.ZodBoolean>;
                timingConfigurationFingerprint: z.ZodNullable<z.ZodString>;
                anomalies: z.ZodArray<z.ZodEnum<{
                    ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
                    FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
                    TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
                    TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
                }>>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            independent: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                availability: z.ZodEnum<{
                    UNAVAILABLE: "UNAVAILABLE";
                    AVAILABLE: "AVAILABLE";
                    NOT_CONFIGURED: "NOT_CONFIGURED";
                }>;
                sourceId: z.ZodNullable<z.ZodString>;
                eligible: z.ZodBoolean;
                reasons: z.ZodArray<z.ZodString>;
                toleranceBps: z.ZodNullable<z.ZodNumber>;
                morphoPrice: z.ZodNullable<z.ZodString>;
                independentPrice: z.ZodNullable<z.ZodString>;
                candidate: z.ZodNullable<z.ZodObject<{
                    id: z.ZodString;
                    availability: z.ZodEnum<{
                        UNAVAILABLE: "UNAVAILABLE";
                        AVAILABLE: "AVAILABLE";
                    }>;
                    base: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    quote: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    kind: z.ZodEnum<{
                        MARKET_PRICE: "MARKET_PRICE";
                        REDEMPTION_RATE: "REDEMPTION_RATE";
                    }>;
                    denomination: z.ZodEnum<{
                        WHOLE_QUOTE_PER_WHOLE_BASE: "WHOLE_QUOTE_PER_WHOLE_BASE";
                        QUOTE_BASE_UNITS_PER_BASE_UNIT: "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    }>;
                    price: z.ZodNullable<z.ZodString>;
                    decimals: z.ZodNumber;
                    timestamp: z.ZodNullable<z.ZodString>;
                    frequencySeconds: z.ZodNullable<z.ZodString>;
                    operatorId: z.ZodNullable<z.ZodString>;
                    upstreamId: z.ZodNullable<z.ZodString>;
                    proofs: z.ZodArray<z.ZodObject<{
                        claim: z.ZodEnum<{
                            ASSET: "ASSET";
                            QUOTE: "QUOTE";
                            DENOMINATION: "DENOMINATION";
                            TIMESTAMP: "TIMESTAMP";
                            FREQUENCY: "FREQUENCY";
                            OPERATOR: "OPERATOR";
                            PROVENANCE: "PROVENANCE";
                            INDEPENDENCE: "INDEPENDENCE";
                        }>;
                        evidence: z.ZodObject<{
                            subjectAddress: z.ZodString;
                            chainId: z.ZodNumber;
                            source: z.ZodString;
                            sourceKind: z.ZodEnum<{
                                FIXTURE: "FIXTURE";
                                SNAPSHOT: "SNAPSHOT";
                                RPC: "RPC";
                                MCP: "MCP";
                                VERIFIED_SOURCE: "VERIFIED_SOURCE";
                                COMPILER: "COMPILER";
                                OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                                RESEARCH: "RESEARCH";
                                LOCAL_POLICY: "LOCAL_POLICY";
                            }>;
                            block: z.ZodNullable<z.ZodObject<{
                                number: z.ZodString;
                                hash: z.ZodString;
                                timestamp: z.ZodString;
                            }, z.core.$strict>>;
                            retrievedAt: z.ZodISODateTime;
                            method: z.ZodString;
                            artifactSha256: z.ZodNullable<z.ZodString>;
                            confidence: z.ZodEnum<{
                                UNKNOWN: "UNKNOWN";
                                PROVEN: "PROVEN";
                                INTERPRETATION: "INTERPRETATION";
                            }>;
                            unresolved: z.ZodArray<z.ZodString>;
                        }, z.core.$strict>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>;
                selectedUpstreamId: z.ZodNullable<z.ZodString>;
                base: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                quote: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                evidenceMode: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    PRODUCTION: "PRODUCTION";
                }>;
                blockTimestamp: z.ZodNullable<z.ZodString>;
                selectedTimestamp: z.ZodNullable<z.ZodString>;
                candidateAgeSeconds: z.ZodNullable<z.ZodString>;
                timestampSkewSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxSkewSeconds: z.ZodNullable<z.ZodString>;
                normalizedMorpho: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                normalizedIndependent: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                deviationBps: z.ZodNullable<z.ZodString>;
                disagrees: z.ZodBoolean;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            findings: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                subjectAddress: z.ZodString;
                statement: z.ZodString;
                classification: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
            limitations: z.ZodArray<z.ZodString>;
            providerIndependence: z.ZodLiteral<"RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT">;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    current: z.ZodObject<{
        cycleId: z.ZodString;
        observedAt: z.ZodISODateTime;
        accepted: z.ZodBoolean;
        risk: z.ZodObject<{
            chainId: z.ZodLiteral<1672>;
            account: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
            marketId: z.ZodLiteral<`0x${string}`>;
            protocol: z.ZodLiteral<"Morpho Blue">;
            morphoAddress: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            accountRole: z.ZodEnum<{
                PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
                EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            }>;
            calculationVersion: z.ZodLiteral<"1.0.0">;
            evidenceKind: z.ZodNullable<z.ZodEnum<{
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>>;
            mathematicalRiskState: z.ZodNullable<z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>>;
            effectiveRiskState: z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>;
            dataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2DataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2OracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleVerification: z.ZodLiteral<"UNVERIFIED">;
            heartbeat: z.ZodLiteral<"UNKNOWN">;
            actionable: z.ZodLiteral<false>;
            actionability: z.ZodEnum<{
                BLOCKED: "BLOCKED";
                INDICATIVE_ONLY: "INDICATIVE_ONLY";
            }>;
            safetyRatio: z.ZodNullable<z.ZodString>;
            ltv: z.ZodNullable<z.ZodString>;
            ratioScale: z.ZodString;
            debtAmount: z.ZodNullable<z.ZodString>;
            collateralAmount: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            snapshotRetrievedAt: z.ZodNullable<z.ZodISODateTime>;
            calculatedAt: z.ZodISODateTime;
            temporalContext: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                FIXTURE: "FIXTURE";
                LIVE_AS_OF_BLOCK: "LIVE_AS_OF_BLOCK";
                HISTORICAL: "HISTORICAL";
            }>;
            thresholds: z.ZodObject<{
                warningRatio: z.ZodString;
                criticalRatio: z.ZodString;
                targetRatio: z.ZodString;
                liquidationBoundary: z.ZodString;
            }, z.core.$strict>;
            repayment: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            additionalCollateral: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            recoveryEligibility: z.ZodOptional<z.ZodObject<{
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
        diagnostics: z.ZodArray<z.ZodEnum<{
            BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
            RPC_UNAVAILABLE: "RPC_UNAVAILABLE";
            MCP_UNAVAILABLE: "MCP_UNAVAILABLE";
            RPC_INVALID: "RPC_INVALID";
            MCP_INVALID: "MCP_INVALID";
            SNAPSHOT_INVALID: "SNAPSHOT_INVALID";
            SNAPSHOT_UNAVAILABLE: "SNAPSHOT_UNAVAILABLE";
            ORACLE_UNVERIFIED: "ORACLE_UNVERIFIED";
            ORACLE_DATA_UNAVAILABLE: "ORACLE_DATA_UNAVAILABLE";
            ORACLE_DATA_INVALID: "ORACLE_DATA_INVALID";
            ORACLE_FRESHNESS_UNKNOWN: "ORACLE_FRESHNESS_UNKNOWN";
            FRESHNESS_UNDETERMINED: "FRESHNESS_UNDETERMINED";
            MONITOR_MODE_MISMATCH: "MONITOR_MODE_MISMATCH";
            PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
            RISK_CALCULATION_FAILED: "RISK_CALCULATION_FAILED";
            BLOCK_REGRESSION: "BLOCK_REGRESSION";
        }>>;
        progression: z.ZodOptional<z.ZodObject<{
            state: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                ADVANCING: "ADVANCING";
                UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
                STALLED: "STALLED";
                REGRESSED: "REGRESSED";
                CONFLICT: "CONFLICT";
            }>;
            reason: z.ZodNullable<z.ZodEnum<{
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
            advancedBlocks: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            headNumber: z.ZodNullable<z.ZodString>;
            baselineBlockNumber: z.ZodNullable<z.ZodString>;
            baselineBlockHash: z.ZodNullable<z.ZodString>;
            sameBlockStreak: z.ZodNumber;
            evaluatedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        assurance: z.ZodOptional<z.ZodObject<{
            schemaVersion: z.ZodLiteral<1>;
            policyVersion: z.ZodLiteral<"oracle-assurance-v1">;
            chainId: z.ZodLiteral<1672>;
            marketId: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            evaluatedAt: z.ZodISODateTime;
            retrievedAt: z.ZodNullable<z.ZodISODateTime>;
            evidenceKind: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>;
            continuityScope: z.ZodString;
            baseline: z.ZodNullable<z.ZodObject<{
                block: z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>;
                retrievedAt: z.ZodISODateTime;
                snapshotIdentifier: z.ZodString;
                configuration: z.ZodObject<{
                    oracle: z.ZodString;
                    feed: z.ZodString;
                    cache: z.ZodNullable<z.ZodString>;
                    forwarder: z.ZodNullable<z.ZodString>;
                    feedId: z.ZodNullable<z.ZodString>;
                    proxyOwner: z.ZodNullable<z.ZodString>;
                    cacheOwner: z.ZodNullable<z.ZodString>;
                    forwarderOwner: z.ZodNullable<z.ZodString>;
                    allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                    proxyImplementation: z.ZodNullable<z.ZodString>;
                    proxyAdmin: z.ZodNullable<z.ZodString>;
                    proxyBeacon: z.ZodNullable<z.ZodString>;
                    oracleRuntime: z.ZodNullable<z.ZodString>;
                    proxyRuntime: z.ZodNullable<z.ZodString>;
                    cacheRuntime: z.ZodNullable<z.ZodString>;
                    forwarderRuntime: z.ZodNullable<z.ZodString>;
                    compositionHash: z.ZodNullable<z.ZodString>;
                    signerConfigurationHash: z.ZodNullable<z.ZodString>;
                    workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                    collateralToken: z.ZodNullable<z.ZodString>;
                    loanToken: z.ZodNullable<z.ZodString>;
                    collateralDecimals: z.ZodNullable<z.ZodNumber>;
                    loanDecimals: z.ZodNullable<z.ZodNumber>;
                    feedDecimals: z.ZodNullable<z.ZodNumber>;
                    denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                    descriptionHash: z.ZodNullable<z.ZodString>;
                    signerCoverage: z.ZodEnum<{
                        UNOBSERVED: "UNOBSERVED";
                        SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                        COMPLETE: "COMPLETE";
                    }>;
                }, z.core.$strict>;
                configurationFingerprint: z.ZodString;
                observationTimestamp: z.ZodNullable<z.ZodString>;
            }, z.core.$strict>>;
            block: z.ZodNullable<z.ZodObject<{
                number: z.ZodString;
                hash: z.ZodString;
                timestamp: z.ZodString;
            }, z.core.$strict>>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            overall: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            actionable: z.ZodLiteral<false>;
            gate: z.ZodEnum<{
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ASSURANCE_REQUIREMENTS_MET: "ASSURANCE_REQUIREMENTS_MET";
            }>;
            dimensions: z.ZodObject<{
                CONTRACT_IDENTITY: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                SOURCE_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                OPERATOR_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                PRICE_SEMANTICS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                FRESHNESS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                INDEPENDENT_VALIDATION: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                CONFIGURATION_CONTROL: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
            }, z.core.$strict>;
            configuration: z.ZodNullable<z.ZodObject<{
                oracle: z.ZodString;
                feed: z.ZodString;
                cache: z.ZodNullable<z.ZodString>;
                forwarder: z.ZodNullable<z.ZodString>;
                feedId: z.ZodNullable<z.ZodString>;
                proxyOwner: z.ZodNullable<z.ZodString>;
                cacheOwner: z.ZodNullable<z.ZodString>;
                forwarderOwner: z.ZodNullable<z.ZodString>;
                allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                proxyImplementation: z.ZodNullable<z.ZodString>;
                proxyAdmin: z.ZodNullable<z.ZodString>;
                proxyBeacon: z.ZodNullable<z.ZodString>;
                oracleRuntime: z.ZodNullable<z.ZodString>;
                proxyRuntime: z.ZodNullable<z.ZodString>;
                cacheRuntime: z.ZodNullable<z.ZodString>;
                forwarderRuntime: z.ZodNullable<z.ZodString>;
                compositionHash: z.ZodNullable<z.ZodString>;
                signerConfigurationHash: z.ZodNullable<z.ZodString>;
                workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                collateralToken: z.ZodNullable<z.ZodString>;
                loanToken: z.ZodNullable<z.ZodString>;
                collateralDecimals: z.ZodNullable<z.ZodNumber>;
                loanDecimals: z.ZodNullable<z.ZodNumber>;
                feedDecimals: z.ZodNullable<z.ZodNumber>;
                denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                descriptionHash: z.ZodNullable<z.ZodString>;
                signerCoverage: z.ZodEnum<{
                    UNOBSERVED: "UNOBSERVED";
                    SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                    COMPLETE: "COMPLETE";
                }>;
            }, z.core.$strict>>;
            configurationFingerprint: z.ZodNullable<z.ZodString>;
            changes: z.ZodArray<z.ZodEnum<{
                ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
                PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
                ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
                ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
                ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
                ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
            }>>;
            evidenceInvalidated: z.ZodBoolean;
            invalidatedAt: z.ZodNullable<z.ZodISODateTime>;
            invalidationReason: z.ZodNullable<z.ZodEnum<{
                CONFIGURATION_CHANGE: "CONFIGURATION_CHANGE";
                OBSERVABILITY_GAP: "OBSERVABILITY_GAP";
            }>>;
            freshness: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                observationTimestamp: z.ZodNullable<z.ZodString>;
                observationAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyOrigin: z.ZodEnum<{
                    NONE: "NONE";
                    OPERATOR_DEFINED_LOCAL_REJECTION: "OPERATOR_DEFINED_LOCAL_REJECTION";
                }>;
                policyRejected: z.ZodBoolean;
                verifiedHeartbeatSeconds: z.ZodNullable<z.ZodString>;
                upstreamFreshnessGuaranteeSeconds: z.ZodNullable<z.ZodString>;
                timestampMeaning: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    WORKFLOW_SUPPLIED_OBSERVATION_TIME: "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                }>;
                onchainExpiryEnforced: z.ZodNullable<z.ZodBoolean>;
                timingConfigurationFingerprint: z.ZodNullable<z.ZodString>;
                anomalies: z.ZodArray<z.ZodEnum<{
                    ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
                    FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
                    TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
                    TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
                }>>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            independent: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                availability: z.ZodEnum<{
                    UNAVAILABLE: "UNAVAILABLE";
                    AVAILABLE: "AVAILABLE";
                    NOT_CONFIGURED: "NOT_CONFIGURED";
                }>;
                sourceId: z.ZodNullable<z.ZodString>;
                eligible: z.ZodBoolean;
                reasons: z.ZodArray<z.ZodString>;
                toleranceBps: z.ZodNullable<z.ZodNumber>;
                morphoPrice: z.ZodNullable<z.ZodString>;
                independentPrice: z.ZodNullable<z.ZodString>;
                candidate: z.ZodNullable<z.ZodObject<{
                    id: z.ZodString;
                    availability: z.ZodEnum<{
                        UNAVAILABLE: "UNAVAILABLE";
                        AVAILABLE: "AVAILABLE";
                    }>;
                    base: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    quote: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    kind: z.ZodEnum<{
                        MARKET_PRICE: "MARKET_PRICE";
                        REDEMPTION_RATE: "REDEMPTION_RATE";
                    }>;
                    denomination: z.ZodEnum<{
                        WHOLE_QUOTE_PER_WHOLE_BASE: "WHOLE_QUOTE_PER_WHOLE_BASE";
                        QUOTE_BASE_UNITS_PER_BASE_UNIT: "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    }>;
                    price: z.ZodNullable<z.ZodString>;
                    decimals: z.ZodNumber;
                    timestamp: z.ZodNullable<z.ZodString>;
                    frequencySeconds: z.ZodNullable<z.ZodString>;
                    operatorId: z.ZodNullable<z.ZodString>;
                    upstreamId: z.ZodNullable<z.ZodString>;
                    proofs: z.ZodArray<z.ZodObject<{
                        claim: z.ZodEnum<{
                            ASSET: "ASSET";
                            QUOTE: "QUOTE";
                            DENOMINATION: "DENOMINATION";
                            TIMESTAMP: "TIMESTAMP";
                            FREQUENCY: "FREQUENCY";
                            OPERATOR: "OPERATOR";
                            PROVENANCE: "PROVENANCE";
                            INDEPENDENCE: "INDEPENDENCE";
                        }>;
                        evidence: z.ZodObject<{
                            subjectAddress: z.ZodString;
                            chainId: z.ZodNumber;
                            source: z.ZodString;
                            sourceKind: z.ZodEnum<{
                                FIXTURE: "FIXTURE";
                                SNAPSHOT: "SNAPSHOT";
                                RPC: "RPC";
                                MCP: "MCP";
                                VERIFIED_SOURCE: "VERIFIED_SOURCE";
                                COMPILER: "COMPILER";
                                OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                                RESEARCH: "RESEARCH";
                                LOCAL_POLICY: "LOCAL_POLICY";
                            }>;
                            block: z.ZodNullable<z.ZodObject<{
                                number: z.ZodString;
                                hash: z.ZodString;
                                timestamp: z.ZodString;
                            }, z.core.$strict>>;
                            retrievedAt: z.ZodISODateTime;
                            method: z.ZodString;
                            artifactSha256: z.ZodNullable<z.ZodString>;
                            confidence: z.ZodEnum<{
                                UNKNOWN: "UNKNOWN";
                                PROVEN: "PROVEN";
                                INTERPRETATION: "INTERPRETATION";
                            }>;
                            unresolved: z.ZodArray<z.ZodString>;
                        }, z.core.$strict>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>;
                selectedUpstreamId: z.ZodNullable<z.ZodString>;
                base: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                quote: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                evidenceMode: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    PRODUCTION: "PRODUCTION";
                }>;
                blockTimestamp: z.ZodNullable<z.ZodString>;
                selectedTimestamp: z.ZodNullable<z.ZodString>;
                candidateAgeSeconds: z.ZodNullable<z.ZodString>;
                timestampSkewSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxSkewSeconds: z.ZodNullable<z.ZodString>;
                normalizedMorpho: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                normalizedIndependent: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                deviationBps: z.ZodNullable<z.ZodString>;
                disagrees: z.ZodBoolean;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            findings: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                subjectAddress: z.ZodString;
                statement: z.ZodString;
                classification: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
            limitations: z.ZodArray<z.ZodString>;
            providerIndependence: z.ZodLiteral<"RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT">;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    suggestedAction: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
}, z.core.$strict>, z.ZodObject<{
    id: z.ZodString;
    fingerprint: z.ZodString;
    scope: z.ZodString;
    cycleId: z.ZodString;
    createdAt: z.ZodISODateTime;
    severity: z.ZodEnum<{
        WARNING: "WARNING";
        CRITICAL: "CRITICAL";
        INFO: "INFO";
        BOUNDARY: "BOUNDARY";
    }>;
    category: z.ZodEnum<{
        RISK: "RISK";
        DATA_QUALITY: "DATA_QUALITY";
        ORACLE: "ORACLE";
        MONITOR_HEALTH: "MONITOR_HEALTH";
    }>;
    code: z.ZodEnum<{
        ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
        PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
        ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
        ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
        ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
        ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
        INDEPENDENT_PRICE_DISAGREEMENT: "INDEPENDENT_PRICE_DISAGREEMENT";
        INITIAL_RISK: "INITIAL_RISK";
        RISK_WORSENED: "RISK_WORSENED";
        RISK_IMPROVED: "RISK_IMPROVED";
        RISK_RECOVERY: "RISK_RECOVERY";
        NO_DEBT_OBSERVED: "NO_DEBT_OBSERVED";
        DEBT_OBSERVED: "DEBT_OBSERVED";
        CRITICAL_REMINDER: "CRITICAL_REMINDER";
        DATA_QUALITY_CHANGED: "DATA_QUALITY_CHANGED";
        DATA_RESTORED: "DATA_RESTORED";
        ORACLE_QUALITY_CHANGED: "ORACLE_QUALITY_CHANGED";
        PERSISTENT_READ_FAILURE: "PERSISTENT_READ_FAILURE";
        ORACLE_TIMESTAMP_ANOMALY: "ORACLE_TIMESTAMP_ANOMALY";
        ORACLE_ASSURANCE_DETERIORATED: "ORACLE_ASSURANCE_DETERIORATED";
        ORACLE_ASSURANCE_IMPROVED: "ORACLE_ASSURANCE_IMPROVED";
        ORACLE_ASSURANCE_INVALIDATED: "ORACLE_ASSURANCE_INVALIDATED";
    }>;
    previous: z.ZodNullable<z.ZodObject<{
        cycleId: z.ZodString;
        observedAt: z.ZodISODateTime;
        accepted: z.ZodBoolean;
        risk: z.ZodObject<{
            chainId: z.ZodLiteral<1672>;
            account: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
            marketId: z.ZodLiteral<`0x${string}`>;
            protocol: z.ZodLiteral<"Morpho Blue">;
            morphoAddress: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            accountRole: z.ZodEnum<{
                PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
                EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            }>;
            calculationVersion: z.ZodLiteral<"1.0.0">;
            evidenceKind: z.ZodNullable<z.ZodEnum<{
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>>;
            mathematicalRiskState: z.ZodNullable<z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>>;
            effectiveRiskState: z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>;
            dataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2DataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2OracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleVerification: z.ZodLiteral<"UNVERIFIED">;
            heartbeat: z.ZodLiteral<"UNKNOWN">;
            actionable: z.ZodLiteral<false>;
            actionability: z.ZodEnum<{
                BLOCKED: "BLOCKED";
                INDICATIVE_ONLY: "INDICATIVE_ONLY";
            }>;
            safetyRatio: z.ZodNullable<z.ZodString>;
            ltv: z.ZodNullable<z.ZodString>;
            ratioScale: z.ZodString;
            debtAmount: z.ZodNullable<z.ZodString>;
            collateralAmount: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            snapshotRetrievedAt: z.ZodNullable<z.ZodISODateTime>;
            calculatedAt: z.ZodISODateTime;
            temporalContext: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                FIXTURE: "FIXTURE";
                LIVE_AS_OF_BLOCK: "LIVE_AS_OF_BLOCK";
                HISTORICAL: "HISTORICAL";
            }>;
            thresholds: z.ZodObject<{
                warningRatio: z.ZodString;
                criticalRatio: z.ZodString;
                targetRatio: z.ZodString;
                liquidationBoundary: z.ZodString;
            }, z.core.$strict>;
            repayment: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            additionalCollateral: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            recoveryEligibility: z.ZodOptional<z.ZodObject<{
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
        diagnostics: z.ZodArray<z.ZodEnum<{
            BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
            RPC_UNAVAILABLE: "RPC_UNAVAILABLE";
            MCP_UNAVAILABLE: "MCP_UNAVAILABLE";
            RPC_INVALID: "RPC_INVALID";
            MCP_INVALID: "MCP_INVALID";
            SNAPSHOT_INVALID: "SNAPSHOT_INVALID";
            SNAPSHOT_UNAVAILABLE: "SNAPSHOT_UNAVAILABLE";
            ORACLE_UNVERIFIED: "ORACLE_UNVERIFIED";
            ORACLE_DATA_UNAVAILABLE: "ORACLE_DATA_UNAVAILABLE";
            ORACLE_DATA_INVALID: "ORACLE_DATA_INVALID";
            ORACLE_FRESHNESS_UNKNOWN: "ORACLE_FRESHNESS_UNKNOWN";
            FRESHNESS_UNDETERMINED: "FRESHNESS_UNDETERMINED";
            MONITOR_MODE_MISMATCH: "MONITOR_MODE_MISMATCH";
            PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
            RISK_CALCULATION_FAILED: "RISK_CALCULATION_FAILED";
            BLOCK_REGRESSION: "BLOCK_REGRESSION";
        }>>;
        progression: z.ZodOptional<z.ZodObject<{
            state: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                ADVANCING: "ADVANCING";
                UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
                STALLED: "STALLED";
                REGRESSED: "REGRESSED";
                CONFLICT: "CONFLICT";
            }>;
            reason: z.ZodNullable<z.ZodEnum<{
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
            advancedBlocks: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            headNumber: z.ZodNullable<z.ZodString>;
            baselineBlockNumber: z.ZodNullable<z.ZodString>;
            baselineBlockHash: z.ZodNullable<z.ZodString>;
            sameBlockStreak: z.ZodNumber;
            evaluatedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        assurance: z.ZodOptional<z.ZodObject<{
            schemaVersion: z.ZodLiteral<1>;
            policyVersion: z.ZodLiteral<"oracle-assurance-v1">;
            chainId: z.ZodLiteral<1672>;
            marketId: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            evaluatedAt: z.ZodISODateTime;
            retrievedAt: z.ZodNullable<z.ZodISODateTime>;
            evidenceKind: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>;
            continuityScope: z.ZodString;
            baseline: z.ZodNullable<z.ZodObject<{
                block: z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>;
                retrievedAt: z.ZodISODateTime;
                snapshotIdentifier: z.ZodString;
                configuration: z.ZodObject<{
                    oracle: z.ZodString;
                    feed: z.ZodString;
                    cache: z.ZodNullable<z.ZodString>;
                    forwarder: z.ZodNullable<z.ZodString>;
                    feedId: z.ZodNullable<z.ZodString>;
                    proxyOwner: z.ZodNullable<z.ZodString>;
                    cacheOwner: z.ZodNullable<z.ZodString>;
                    forwarderOwner: z.ZodNullable<z.ZodString>;
                    allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                    proxyImplementation: z.ZodNullable<z.ZodString>;
                    proxyAdmin: z.ZodNullable<z.ZodString>;
                    proxyBeacon: z.ZodNullable<z.ZodString>;
                    oracleRuntime: z.ZodNullable<z.ZodString>;
                    proxyRuntime: z.ZodNullable<z.ZodString>;
                    cacheRuntime: z.ZodNullable<z.ZodString>;
                    forwarderRuntime: z.ZodNullable<z.ZodString>;
                    compositionHash: z.ZodNullable<z.ZodString>;
                    signerConfigurationHash: z.ZodNullable<z.ZodString>;
                    workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                    collateralToken: z.ZodNullable<z.ZodString>;
                    loanToken: z.ZodNullable<z.ZodString>;
                    collateralDecimals: z.ZodNullable<z.ZodNumber>;
                    loanDecimals: z.ZodNullable<z.ZodNumber>;
                    feedDecimals: z.ZodNullable<z.ZodNumber>;
                    denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                    descriptionHash: z.ZodNullable<z.ZodString>;
                    signerCoverage: z.ZodEnum<{
                        UNOBSERVED: "UNOBSERVED";
                        SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                        COMPLETE: "COMPLETE";
                    }>;
                }, z.core.$strict>;
                configurationFingerprint: z.ZodString;
                observationTimestamp: z.ZodNullable<z.ZodString>;
            }, z.core.$strict>>;
            block: z.ZodNullable<z.ZodObject<{
                number: z.ZodString;
                hash: z.ZodString;
                timestamp: z.ZodString;
            }, z.core.$strict>>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            overall: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            actionable: z.ZodLiteral<false>;
            gate: z.ZodEnum<{
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ASSURANCE_REQUIREMENTS_MET: "ASSURANCE_REQUIREMENTS_MET";
            }>;
            dimensions: z.ZodObject<{
                CONTRACT_IDENTITY: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                SOURCE_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                OPERATOR_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                PRICE_SEMANTICS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                FRESHNESS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                INDEPENDENT_VALIDATION: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                CONFIGURATION_CONTROL: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
            }, z.core.$strict>;
            configuration: z.ZodNullable<z.ZodObject<{
                oracle: z.ZodString;
                feed: z.ZodString;
                cache: z.ZodNullable<z.ZodString>;
                forwarder: z.ZodNullable<z.ZodString>;
                feedId: z.ZodNullable<z.ZodString>;
                proxyOwner: z.ZodNullable<z.ZodString>;
                cacheOwner: z.ZodNullable<z.ZodString>;
                forwarderOwner: z.ZodNullable<z.ZodString>;
                allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                proxyImplementation: z.ZodNullable<z.ZodString>;
                proxyAdmin: z.ZodNullable<z.ZodString>;
                proxyBeacon: z.ZodNullable<z.ZodString>;
                oracleRuntime: z.ZodNullable<z.ZodString>;
                proxyRuntime: z.ZodNullable<z.ZodString>;
                cacheRuntime: z.ZodNullable<z.ZodString>;
                forwarderRuntime: z.ZodNullable<z.ZodString>;
                compositionHash: z.ZodNullable<z.ZodString>;
                signerConfigurationHash: z.ZodNullable<z.ZodString>;
                workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                collateralToken: z.ZodNullable<z.ZodString>;
                loanToken: z.ZodNullable<z.ZodString>;
                collateralDecimals: z.ZodNullable<z.ZodNumber>;
                loanDecimals: z.ZodNullable<z.ZodNumber>;
                feedDecimals: z.ZodNullable<z.ZodNumber>;
                denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                descriptionHash: z.ZodNullable<z.ZodString>;
                signerCoverage: z.ZodEnum<{
                    UNOBSERVED: "UNOBSERVED";
                    SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                    COMPLETE: "COMPLETE";
                }>;
            }, z.core.$strict>>;
            configurationFingerprint: z.ZodNullable<z.ZodString>;
            changes: z.ZodArray<z.ZodEnum<{
                ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
                PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
                ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
                ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
                ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
                ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
            }>>;
            evidenceInvalidated: z.ZodBoolean;
            invalidatedAt: z.ZodNullable<z.ZodISODateTime>;
            invalidationReason: z.ZodNullable<z.ZodEnum<{
                CONFIGURATION_CHANGE: "CONFIGURATION_CHANGE";
                OBSERVABILITY_GAP: "OBSERVABILITY_GAP";
            }>>;
            freshness: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                observationTimestamp: z.ZodNullable<z.ZodString>;
                observationAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyOrigin: z.ZodEnum<{
                    NONE: "NONE";
                    OPERATOR_DEFINED_LOCAL_REJECTION: "OPERATOR_DEFINED_LOCAL_REJECTION";
                }>;
                policyRejected: z.ZodBoolean;
                verifiedHeartbeatSeconds: z.ZodNullable<z.ZodString>;
                upstreamFreshnessGuaranteeSeconds: z.ZodNullable<z.ZodString>;
                timestampMeaning: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    WORKFLOW_SUPPLIED_OBSERVATION_TIME: "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                }>;
                onchainExpiryEnforced: z.ZodNullable<z.ZodBoolean>;
                timingConfigurationFingerprint: z.ZodNullable<z.ZodString>;
                anomalies: z.ZodArray<z.ZodEnum<{
                    ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
                    FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
                    TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
                    TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
                }>>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            independent: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                availability: z.ZodEnum<{
                    UNAVAILABLE: "UNAVAILABLE";
                    AVAILABLE: "AVAILABLE";
                    NOT_CONFIGURED: "NOT_CONFIGURED";
                }>;
                sourceId: z.ZodNullable<z.ZodString>;
                eligible: z.ZodBoolean;
                reasons: z.ZodArray<z.ZodString>;
                toleranceBps: z.ZodNullable<z.ZodNumber>;
                morphoPrice: z.ZodNullable<z.ZodString>;
                independentPrice: z.ZodNullable<z.ZodString>;
                candidate: z.ZodNullable<z.ZodObject<{
                    id: z.ZodString;
                    availability: z.ZodEnum<{
                        UNAVAILABLE: "UNAVAILABLE";
                        AVAILABLE: "AVAILABLE";
                    }>;
                    base: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    quote: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    kind: z.ZodEnum<{
                        MARKET_PRICE: "MARKET_PRICE";
                        REDEMPTION_RATE: "REDEMPTION_RATE";
                    }>;
                    denomination: z.ZodEnum<{
                        WHOLE_QUOTE_PER_WHOLE_BASE: "WHOLE_QUOTE_PER_WHOLE_BASE";
                        QUOTE_BASE_UNITS_PER_BASE_UNIT: "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    }>;
                    price: z.ZodNullable<z.ZodString>;
                    decimals: z.ZodNumber;
                    timestamp: z.ZodNullable<z.ZodString>;
                    frequencySeconds: z.ZodNullable<z.ZodString>;
                    operatorId: z.ZodNullable<z.ZodString>;
                    upstreamId: z.ZodNullable<z.ZodString>;
                    proofs: z.ZodArray<z.ZodObject<{
                        claim: z.ZodEnum<{
                            ASSET: "ASSET";
                            QUOTE: "QUOTE";
                            DENOMINATION: "DENOMINATION";
                            TIMESTAMP: "TIMESTAMP";
                            FREQUENCY: "FREQUENCY";
                            OPERATOR: "OPERATOR";
                            PROVENANCE: "PROVENANCE";
                            INDEPENDENCE: "INDEPENDENCE";
                        }>;
                        evidence: z.ZodObject<{
                            subjectAddress: z.ZodString;
                            chainId: z.ZodNumber;
                            source: z.ZodString;
                            sourceKind: z.ZodEnum<{
                                FIXTURE: "FIXTURE";
                                SNAPSHOT: "SNAPSHOT";
                                RPC: "RPC";
                                MCP: "MCP";
                                VERIFIED_SOURCE: "VERIFIED_SOURCE";
                                COMPILER: "COMPILER";
                                OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                                RESEARCH: "RESEARCH";
                                LOCAL_POLICY: "LOCAL_POLICY";
                            }>;
                            block: z.ZodNullable<z.ZodObject<{
                                number: z.ZodString;
                                hash: z.ZodString;
                                timestamp: z.ZodString;
                            }, z.core.$strict>>;
                            retrievedAt: z.ZodISODateTime;
                            method: z.ZodString;
                            artifactSha256: z.ZodNullable<z.ZodString>;
                            confidence: z.ZodEnum<{
                                UNKNOWN: "UNKNOWN";
                                PROVEN: "PROVEN";
                                INTERPRETATION: "INTERPRETATION";
                            }>;
                            unresolved: z.ZodArray<z.ZodString>;
                        }, z.core.$strict>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>;
                selectedUpstreamId: z.ZodNullable<z.ZodString>;
                base: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                quote: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                evidenceMode: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    PRODUCTION: "PRODUCTION";
                }>;
                blockTimestamp: z.ZodNullable<z.ZodString>;
                selectedTimestamp: z.ZodNullable<z.ZodString>;
                candidateAgeSeconds: z.ZodNullable<z.ZodString>;
                timestampSkewSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxSkewSeconds: z.ZodNullable<z.ZodString>;
                normalizedMorpho: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                normalizedIndependent: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                deviationBps: z.ZodNullable<z.ZodString>;
                disagrees: z.ZodBoolean;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            findings: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                subjectAddress: z.ZodString;
                statement: z.ZodString;
                classification: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
            limitations: z.ZodArray<z.ZodString>;
            providerIndependence: z.ZodLiteral<"RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT">;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    current: z.ZodObject<{
        cycleId: z.ZodString;
        observedAt: z.ZodISODateTime;
        accepted: z.ZodBoolean;
        risk: z.ZodObject<{
            chainId: z.ZodLiteral<1672>;
            account: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
            marketId: z.ZodLiteral<`0x${string}`>;
            protocol: z.ZodLiteral<"Morpho Blue">;
            morphoAddress: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            accountRole: z.ZodEnum<{
                PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
                EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            }>;
            calculationVersion: z.ZodLiteral<"1.0.0">;
            evidenceKind: z.ZodNullable<z.ZodEnum<{
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>>;
            mathematicalRiskState: z.ZodNullable<z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>>;
            effectiveRiskState: z.ZodEnum<{
                NO_DEBT: "NO_DEBT";
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ABOVE_WARNING: "ABOVE_WARNING";
                WARNING: "WARNING";
                CRITICAL: "CRITICAL";
                LIQUIDATION_BOUNDARY: "LIQUIDATION_BOUNDARY";
            }>;
            dataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2DataQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            phase2OracleQuality: z.ZodEnum<{
                VALID: "VALID";
                STALE: "STALE";
                UNAVAILABLE: "UNAVAILABLE";
                INVALID: "INVALID";
                UNVERIFIED: "UNVERIFIED";
            }>;
            oracleVerification: z.ZodLiteral<"UNVERIFIED">;
            heartbeat: z.ZodLiteral<"UNKNOWN">;
            actionable: z.ZodLiteral<false>;
            actionability: z.ZodEnum<{
                BLOCKED: "BLOCKED";
                INDICATIVE_ONLY: "INDICATIVE_ONLY";
            }>;
            safetyRatio: z.ZodNullable<z.ZodString>;
            ltv: z.ZodNullable<z.ZodString>;
            ratioScale: z.ZodString;
            debtAmount: z.ZodNullable<z.ZodString>;
            collateralAmount: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            snapshotRetrievedAt: z.ZodNullable<z.ZodISODateTime>;
            calculatedAt: z.ZodISODateTime;
            temporalContext: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                FIXTURE: "FIXTURE";
                LIVE_AS_OF_BLOCK: "LIVE_AS_OF_BLOCK";
                HISTORICAL: "HISTORICAL";
            }>;
            thresholds: z.ZodObject<{
                warningRatio: z.ZodString;
                criticalRatio: z.ZodString;
                targetRatio: z.ZodString;
                liquidationBoundary: z.ZodString;
            }, z.core.$strict>;
            repayment: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            additionalCollateral: z.ZodNullable<z.ZodObject<{
                raw: z.ZodString;
                formatted: z.ZodString;
                tokenAddress: z.ZodString;
                decimals: z.ZodNumber;
                targetRatio: z.ZodString;
                calculationMethod: z.ZodEnum<{
                    "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint": "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint";
                    "morpho-v1.0.0/nested-ceilings/forward-minimality-proof": "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                }>;
                actionable: z.ZodLiteral<false>;
                indicative: z.ZodLiteral<true>;
                inputSnapshotIdentifier: z.ZodString;
                blockNumber: z.ZodString;
                blockHash: z.ZodString;
                calculatedAt: z.ZodISODateTime;
            }, z.core.$strict>>;
            recoveryEligibility: z.ZodOptional<z.ZodObject<{
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
        diagnostics: z.ZodArray<z.ZodEnum<{
            BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
            RPC_UNAVAILABLE: "RPC_UNAVAILABLE";
            MCP_UNAVAILABLE: "MCP_UNAVAILABLE";
            RPC_INVALID: "RPC_INVALID";
            MCP_INVALID: "MCP_INVALID";
            SNAPSHOT_INVALID: "SNAPSHOT_INVALID";
            SNAPSHOT_UNAVAILABLE: "SNAPSHOT_UNAVAILABLE";
            ORACLE_UNVERIFIED: "ORACLE_UNVERIFIED";
            ORACLE_DATA_UNAVAILABLE: "ORACLE_DATA_UNAVAILABLE";
            ORACLE_DATA_INVALID: "ORACLE_DATA_INVALID";
            ORACLE_FRESHNESS_UNKNOWN: "ORACLE_FRESHNESS_UNKNOWN";
            FRESHNESS_UNDETERMINED: "FRESHNESS_UNDETERMINED";
            MONITOR_MODE_MISMATCH: "MONITOR_MODE_MISMATCH";
            PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
            RISK_CALCULATION_FAILED: "RISK_CALCULATION_FAILED";
            BLOCK_REGRESSION: "BLOCK_REGRESSION";
        }>>;
        progression: z.ZodOptional<z.ZodObject<{
            state: z.ZodEnum<{
                UNKNOWN: "UNKNOWN";
                ADVANCING: "ADVANCING";
                UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
                STALLED: "STALLED";
                REGRESSED: "REGRESSED";
                CONFLICT: "CONFLICT";
            }>;
            reason: z.ZodNullable<z.ZodEnum<{
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
            advancedBlocks: z.ZodNullable<z.ZodString>;
            blockNumber: z.ZodNullable<z.ZodString>;
            blockHash: z.ZodNullable<z.ZodString>;
            blockTimestamp: z.ZodNullable<z.ZodString>;
            headNumber: z.ZodNullable<z.ZodString>;
            baselineBlockNumber: z.ZodNullable<z.ZodString>;
            baselineBlockHash: z.ZodNullable<z.ZodString>;
            sameBlockStreak: z.ZodNumber;
            evaluatedAt: z.ZodISODateTime;
        }, z.core.$strict>>;
        assurance: z.ZodOptional<z.ZodObject<{
            schemaVersion: z.ZodLiteral<1>;
            policyVersion: z.ZodLiteral<"oracle-assurance-v1">;
            chainId: z.ZodLiteral<1672>;
            marketId: z.ZodLiteral<`0x${string}`>;
            oracleAddress: z.ZodLiteral<`0x${string}`>;
            evaluatedAt: z.ZodISODateTime;
            retrievedAt: z.ZodNullable<z.ZodISODateTime>;
            evidenceKind: z.ZodEnum<{
                UNAVAILABLE: "UNAVAILABLE";
                LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
                HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
                FIXTURE: "FIXTURE";
            }>;
            continuityScope: z.ZodString;
            baseline: z.ZodNullable<z.ZodObject<{
                block: z.ZodObject<{
                    number: z.ZodString;
                    hash: z.ZodString;
                    timestamp: z.ZodString;
                }, z.core.$strict>;
                retrievedAt: z.ZodISODateTime;
                snapshotIdentifier: z.ZodString;
                configuration: z.ZodObject<{
                    oracle: z.ZodString;
                    feed: z.ZodString;
                    cache: z.ZodNullable<z.ZodString>;
                    forwarder: z.ZodNullable<z.ZodString>;
                    feedId: z.ZodNullable<z.ZodString>;
                    proxyOwner: z.ZodNullable<z.ZodString>;
                    cacheOwner: z.ZodNullable<z.ZodString>;
                    forwarderOwner: z.ZodNullable<z.ZodString>;
                    allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                    proxyImplementation: z.ZodNullable<z.ZodString>;
                    proxyAdmin: z.ZodNullable<z.ZodString>;
                    proxyBeacon: z.ZodNullable<z.ZodString>;
                    oracleRuntime: z.ZodNullable<z.ZodString>;
                    proxyRuntime: z.ZodNullable<z.ZodString>;
                    cacheRuntime: z.ZodNullable<z.ZodString>;
                    forwarderRuntime: z.ZodNullable<z.ZodString>;
                    compositionHash: z.ZodNullable<z.ZodString>;
                    signerConfigurationHash: z.ZodNullable<z.ZodString>;
                    workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                    collateralToken: z.ZodNullable<z.ZodString>;
                    loanToken: z.ZodNullable<z.ZodString>;
                    collateralDecimals: z.ZodNullable<z.ZodNumber>;
                    loanDecimals: z.ZodNullable<z.ZodNumber>;
                    feedDecimals: z.ZodNullable<z.ZodNumber>;
                    denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                    descriptionHash: z.ZodNullable<z.ZodString>;
                    signerCoverage: z.ZodEnum<{
                        UNOBSERVED: "UNOBSERVED";
                        SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                        COMPLETE: "COMPLETE";
                    }>;
                }, z.core.$strict>;
                configurationFingerprint: z.ZodString;
                observationTimestamp: z.ZodNullable<z.ZodString>;
            }, z.core.$strict>>;
            block: z.ZodNullable<z.ZodObject<{
                number: z.ZodString;
                hash: z.ZodString;
                timestamp: z.ZodString;
            }, z.core.$strict>>;
            snapshotIdentifier: z.ZodNullable<z.ZodString>;
            overall: z.ZodEnum<{
                UNVERIFIED: "UNVERIFIED";
                VERIFIED: "VERIFIED";
                PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                UNKNOWN: "UNKNOWN";
                FAILED: "FAILED";
            }>;
            actionable: z.ZodLiteral<false>;
            gate: z.ZodEnum<{
                DATA_UNVERIFIED: "DATA_UNVERIFIED";
                DATA_INVALID: "DATA_INVALID";
                DATA_UNAVAILABLE: "DATA_UNAVAILABLE";
                ASSURANCE_REQUIREMENTS_MET: "ASSURANCE_REQUIREMENTS_MET";
            }>;
            dimensions: z.ZodObject<{
                CONTRACT_IDENTITY: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                SOURCE_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                OPERATOR_PROVENANCE: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                PRICE_SEMANTICS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                FRESHNESS: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                INDEPENDENT_VALIDATION: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
                CONFIGURATION_CONTROL: z.ZodObject<{
                    state: z.ZodEnum<{
                        UNVERIFIED: "UNVERIFIED";
                        VERIFIED: "VERIFIED";
                        PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                        UNKNOWN: "UNKNOWN";
                        FAILED: "FAILED";
                    }>;
                    rule: z.ZodString;
                    satisfied: z.ZodArray<z.ZodString>;
                    missing: z.ZodArray<z.ZodString>;
                    findingIds: z.ZodArray<z.ZodString>;
                }, z.core.$strict>;
            }, z.core.$strict>;
            configuration: z.ZodNullable<z.ZodObject<{
                oracle: z.ZodString;
                feed: z.ZodString;
                cache: z.ZodNullable<z.ZodString>;
                forwarder: z.ZodNullable<z.ZodString>;
                feedId: z.ZodNullable<z.ZodString>;
                proxyOwner: z.ZodNullable<z.ZodString>;
                cacheOwner: z.ZodNullable<z.ZodString>;
                forwarderOwner: z.ZodNullable<z.ZodString>;
                allowedWorkflowOwner: z.ZodNullable<z.ZodString>;
                proxyImplementation: z.ZodNullable<z.ZodString>;
                proxyAdmin: z.ZodNullable<z.ZodString>;
                proxyBeacon: z.ZodNullable<z.ZodString>;
                oracleRuntime: z.ZodNullable<z.ZodString>;
                proxyRuntime: z.ZodNullable<z.ZodString>;
                cacheRuntime: z.ZodNullable<z.ZodString>;
                forwarderRuntime: z.ZodNullable<z.ZodString>;
                compositionHash: z.ZodNullable<z.ZodString>;
                signerConfigurationHash: z.ZodNullable<z.ZodString>;
                workflowConfigurationHash: z.ZodNullable<z.ZodString>;
                collateralToken: z.ZodNullable<z.ZodString>;
                loanToken: z.ZodNullable<z.ZodString>;
                collateralDecimals: z.ZodNullable<z.ZodNumber>;
                loanDecimals: z.ZodNullable<z.ZodNumber>;
                feedDecimals: z.ZodNullable<z.ZodNumber>;
                denomination: z.ZodLiteral<"ECONOMIC_QUOTE_UNVERIFIED">;
                descriptionHash: z.ZodNullable<z.ZodString>;
                signerCoverage: z.ZodEnum<{
                    UNOBSERVED: "UNOBSERVED";
                    SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
                    COMPLETE: "COMPLETE";
                }>;
            }, z.core.$strict>>;
            configurationFingerprint: z.ZodNullable<z.ZodString>;
            changes: z.ZodArray<z.ZodEnum<{
                ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
                PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
                ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
                ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
                ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
                ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
            }>>;
            evidenceInvalidated: z.ZodBoolean;
            invalidatedAt: z.ZodNullable<z.ZodISODateTime>;
            invalidationReason: z.ZodNullable<z.ZodEnum<{
                CONFIGURATION_CHANGE: "CONFIGURATION_CHANGE";
                OBSERVABILITY_GAP: "OBSERVABILITY_GAP";
            }>>;
            freshness: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                observationTimestamp: z.ZodNullable<z.ZodString>;
                observationAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyOrigin: z.ZodEnum<{
                    NONE: "NONE";
                    OPERATOR_DEFINED_LOCAL_REJECTION: "OPERATOR_DEFINED_LOCAL_REJECTION";
                }>;
                policyRejected: z.ZodBoolean;
                verifiedHeartbeatSeconds: z.ZodNullable<z.ZodString>;
                upstreamFreshnessGuaranteeSeconds: z.ZodNullable<z.ZodString>;
                timestampMeaning: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    WORKFLOW_SUPPLIED_OBSERVATION_TIME: "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                }>;
                onchainExpiryEnforced: z.ZodNullable<z.ZodBoolean>;
                timingConfigurationFingerprint: z.ZodNullable<z.ZodString>;
                anomalies: z.ZodArray<z.ZodEnum<{
                    ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
                    FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
                    TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
                    TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
                }>>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            independent: z.ZodObject<{
                state: z.ZodEnum<{
                    UNVERIFIED: "UNVERIFIED";
                    VERIFIED: "VERIFIED";
                    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
                    UNKNOWN: "UNKNOWN";
                    FAILED: "FAILED";
                }>;
                availability: z.ZodEnum<{
                    UNAVAILABLE: "UNAVAILABLE";
                    AVAILABLE: "AVAILABLE";
                    NOT_CONFIGURED: "NOT_CONFIGURED";
                }>;
                sourceId: z.ZodNullable<z.ZodString>;
                eligible: z.ZodBoolean;
                reasons: z.ZodArray<z.ZodString>;
                toleranceBps: z.ZodNullable<z.ZodNumber>;
                morphoPrice: z.ZodNullable<z.ZodString>;
                independentPrice: z.ZodNullable<z.ZodString>;
                candidate: z.ZodNullable<z.ZodObject<{
                    id: z.ZodString;
                    availability: z.ZodEnum<{
                        UNAVAILABLE: "UNAVAILABLE";
                        AVAILABLE: "AVAILABLE";
                    }>;
                    base: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    quote: z.ZodObject<{
                        chainId: z.ZodNumber;
                        address: z.ZodString;
                        decimals: z.ZodNumber;
                    }, z.core.$strict>;
                    kind: z.ZodEnum<{
                        MARKET_PRICE: "MARKET_PRICE";
                        REDEMPTION_RATE: "REDEMPTION_RATE";
                    }>;
                    denomination: z.ZodEnum<{
                        WHOLE_QUOTE_PER_WHOLE_BASE: "WHOLE_QUOTE_PER_WHOLE_BASE";
                        QUOTE_BASE_UNITS_PER_BASE_UNIT: "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    }>;
                    price: z.ZodNullable<z.ZodString>;
                    decimals: z.ZodNumber;
                    timestamp: z.ZodNullable<z.ZodString>;
                    frequencySeconds: z.ZodNullable<z.ZodString>;
                    operatorId: z.ZodNullable<z.ZodString>;
                    upstreamId: z.ZodNullable<z.ZodString>;
                    proofs: z.ZodArray<z.ZodObject<{
                        claim: z.ZodEnum<{
                            ASSET: "ASSET";
                            QUOTE: "QUOTE";
                            DENOMINATION: "DENOMINATION";
                            TIMESTAMP: "TIMESTAMP";
                            FREQUENCY: "FREQUENCY";
                            OPERATOR: "OPERATOR";
                            PROVENANCE: "PROVENANCE";
                            INDEPENDENCE: "INDEPENDENCE";
                        }>;
                        evidence: z.ZodObject<{
                            subjectAddress: z.ZodString;
                            chainId: z.ZodNumber;
                            source: z.ZodString;
                            sourceKind: z.ZodEnum<{
                                FIXTURE: "FIXTURE";
                                SNAPSHOT: "SNAPSHOT";
                                RPC: "RPC";
                                MCP: "MCP";
                                VERIFIED_SOURCE: "VERIFIED_SOURCE";
                                COMPILER: "COMPILER";
                                OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                                RESEARCH: "RESEARCH";
                                LOCAL_POLICY: "LOCAL_POLICY";
                            }>;
                            block: z.ZodNullable<z.ZodObject<{
                                number: z.ZodString;
                                hash: z.ZodString;
                                timestamp: z.ZodString;
                            }, z.core.$strict>>;
                            retrievedAt: z.ZodISODateTime;
                            method: z.ZodString;
                            artifactSha256: z.ZodNullable<z.ZodString>;
                            confidence: z.ZodEnum<{
                                UNKNOWN: "UNKNOWN";
                                PROVEN: "PROVEN";
                                INTERPRETATION: "INTERPRETATION";
                            }>;
                            unresolved: z.ZodArray<z.ZodString>;
                        }, z.core.$strict>;
                    }, z.core.$strict>>;
                }, z.core.$strict>>;
                selectedUpstreamId: z.ZodNullable<z.ZodString>;
                base: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                quote: z.ZodObject<{
                    chainId: z.ZodNumber;
                    address: z.ZodString;
                    decimals: z.ZodNumber;
                }, z.core.$strict>;
                evidenceMode: z.ZodEnum<{
                    FIXTURE: "FIXTURE";
                    PRODUCTION: "PRODUCTION";
                }>;
                blockTimestamp: z.ZodNullable<z.ZodString>;
                selectedTimestamp: z.ZodNullable<z.ZodString>;
                candidateAgeSeconds: z.ZodNullable<z.ZodString>;
                timestampSkewSeconds: z.ZodNullable<z.ZodString>;
                policyMaxAgeSeconds: z.ZodNullable<z.ZodString>;
                policyMaxSkewSeconds: z.ZodNullable<z.ZodString>;
                normalizedMorpho: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                normalizedIndependent: z.ZodNullable<z.ZodObject<{
                    numerator: z.ZodString;
                    denominator: z.ZodString;
                }, z.core.$strict>>;
                deviationBps: z.ZodNullable<z.ZodString>;
                disagrees: z.ZodBoolean;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            findings: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                subjectAddress: z.ZodString;
                statement: z.ZodString;
                classification: z.ZodEnum<{
                    UNKNOWN: "UNKNOWN";
                    PROVEN: "PROVEN";
                    INTERPRETATION: "INTERPRETATION";
                }>;
                evidence: z.ZodArray<z.ZodObject<{
                    subjectAddress: z.ZodString;
                    chainId: z.ZodNumber;
                    source: z.ZodString;
                    sourceKind: z.ZodEnum<{
                        FIXTURE: "FIXTURE";
                        SNAPSHOT: "SNAPSHOT";
                        RPC: "RPC";
                        MCP: "MCP";
                        VERIFIED_SOURCE: "VERIFIED_SOURCE";
                        COMPILER: "COMPILER";
                        OFFICIAL_DOCUMENT: "OFFICIAL_DOCUMENT";
                        RESEARCH: "RESEARCH";
                        LOCAL_POLICY: "LOCAL_POLICY";
                    }>;
                    block: z.ZodNullable<z.ZodObject<{
                        number: z.ZodString;
                        hash: z.ZodString;
                        timestamp: z.ZodString;
                    }, z.core.$strict>>;
                    retrievedAt: z.ZodISODateTime;
                    method: z.ZodString;
                    artifactSha256: z.ZodNullable<z.ZodString>;
                    confidence: z.ZodEnum<{
                        UNKNOWN: "UNKNOWN";
                        PROVEN: "PROVEN";
                        INTERPRETATION: "INTERPRETATION";
                    }>;
                    unresolved: z.ZodArray<z.ZodString>;
                }, z.core.$strict>>;
                unresolved: z.ZodArray<z.ZodString>;
            }, z.core.$strict>>;
            limitations: z.ZodArray<z.ZodString>;
            providerIndependence: z.ZodLiteral<"RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT">;
        }, z.core.$strict>>;
    }, z.core.$strict>;
}, z.core.$strict>]>, z.ZodTransform<{
    id: string;
    fingerprint: string;
    scope: string;
    cycleId: string;
    createdAt: string;
    severity: "WARNING" | "CRITICAL" | "INFO" | "BOUNDARY";
    category: "RISK" | "DATA_QUALITY" | "ORACLE" | "MONITOR_HEALTH";
    code: "ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED" | "INDEPENDENT_PRICE_DISAGREEMENT" | "INITIAL_RISK" | "RISK_WORSENED" | "RISK_IMPROVED" | "RISK_RECOVERY" | "NO_DEBT_OBSERVED" | "DEBT_OBSERVED" | "CRITICAL_REMINDER" | "DATA_QUALITY_CHANGED" | "DATA_RESTORED" | "ORACLE_QUALITY_CHANGED" | "PERSISTENT_READ_FAILURE" | "ORACLE_TIMESTAMP_ANOMALY" | "ORACLE_ASSURANCE_DETERIORATED" | "ORACLE_ASSURANCE_IMPROVED" | "ORACLE_ASSURANCE_INVALIDATED";
    previous: {
        cycleId: string;
        observedAt: string;
        accepted: boolean;
        risk: {
            chainId: 1672;
            account: `0x${string}`;
            marketId: `0x${string}`;
            protocol: "Morpho Blue";
            morphoAddress: `0x${string}`;
            oracleAddress: `0x${string}`;
            accountRole: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET" | "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            calculationVersion: "1.0.0";
            evidenceKind: "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE" | null;
            mathematicalRiskState: "NO_DEBT" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY" | null;
            effectiveRiskState: "NO_DEBT" | "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY";
            dataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2DataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2OracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleVerification: "UNVERIFIED";
            heartbeat: "UNKNOWN";
            actionable: false;
            actionability: "BLOCKED" | "INDICATIVE_ONLY";
            safetyRatio: string | null;
            ltv: string | null;
            ratioScale: string;
            debtAmount: string | null;
            collateralAmount: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            snapshotIdentifier: string | null;
            snapshotRetrievedAt: string | null;
            calculatedAt: string;
            temporalContext: "UNAVAILABLE" | "FIXTURE" | "LIVE_AS_OF_BLOCK" | "HISTORICAL";
            thresholds: {
                warningRatio: string;
                criticalRatio: string;
                targetRatio: string;
                liquidationBoundary: string;
            };
            repayment: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            additionalCollateral: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            recoveryEligibility?: {
                eligible: boolean;
                status: "ELIGIBLE" | "BLOCKED";
                reasonCodes: ("RECOVERY_POSITION_DATA_BLOCKED" | "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH" | "RECOVERY_CHAIN_PROGRESSION_UNKNOWN" | "RECOVERY_CHAIN_PROGRESSION_STALLED" | "RECOVERY_CHAIN_PROGRESSION_REGRESSED" | "RECOVERY_CHAIN_PROGRESSION_CONFLICT" | "RECOVERY_CHAIN_PROGRESSION_UNCHANGED" | "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED" | "RECOVERY_ASSURANCE_GATE_NOT_MET" | "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED" | "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED" | "RECOVERY_EVIDENCE_INVALIDATED" | "RECOVERY_TIMESTAMP_ANOMALY" | "RECOVERY_CONFIGURATION_MISMATCH")[];
            } | undefined;
        };
        diagnostics: ("BLOCK_TIMESTAMP_REGRESSION" | "RPC_UNAVAILABLE" | "MCP_UNAVAILABLE" | "RPC_INVALID" | "MCP_INVALID" | "SNAPSHOT_INVALID" | "SNAPSHOT_UNAVAILABLE" | "ORACLE_UNVERIFIED" | "ORACLE_DATA_UNAVAILABLE" | "ORACLE_DATA_INVALID" | "ORACLE_FRESHNESS_UNKNOWN" | "FRESHNESS_UNDETERMINED" | "MONITOR_MODE_MISMATCH" | "PROCESS_INTERRUPTED" | "RISK_CALCULATION_FAILED" | "BLOCK_REGRESSION")[];
        progression?: {
            state: "UNKNOWN" | "ADVANCING" | "UNCHANGED_WITHIN_WINDOW" | "STALLED" | "REGRESSED" | "CONFLICT";
            reason: "FIRST_OBSERVATION" | "NO_SNAPSHOT_EVIDENCE" | "MISSING_PROVIDER_HEAD" | "CHAIN_ID_MISMATCH" | "PROVIDER_HEAD_BELOW_SELECTED_BLOCK" | "INVALID_BLOCK_EVIDENCE" | "PROVIDER_HEAD_REGRESSION" | "BLOCK_NUMBER_REGRESSION" | "BLOCK_TIMESTAMP_REGRESSION" | "SAME_HEIGHT_HASH_CONFLICT" | "SAME_BLOCK_RE_READ" | "STALL_WINDOW_EXCEEDED" | "STRICT_ADVANCE" | null;
            advancedBlocks: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            headNumber: string | null;
            baselineBlockNumber: string | null;
            baselineBlockHash: string | null;
            sameBlockStreak: number;
            evaluatedAt: string;
        } | undefined;
        assurance?: {
            schemaVersion: 1;
            policyVersion: "oracle-assurance-v1";
            chainId: 1672;
            marketId: `0x${string}`;
            oracleAddress: `0x${string}`;
            evaluatedAt: string;
            retrievedAt: string | null;
            evidenceKind: "UNAVAILABLE" | "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE";
            continuityScope: string;
            baseline: {
                block: {
                    number: string;
                    hash: string;
                    timestamp: string;
                };
                retrievedAt: string;
                snapshotIdentifier: string;
                configuration: {
                    oracle: string;
                    feed: string;
                    cache: string | null;
                    forwarder: string | null;
                    feedId: string | null;
                    proxyOwner: string | null;
                    cacheOwner: string | null;
                    forwarderOwner: string | null;
                    allowedWorkflowOwner: string | null;
                    proxyImplementation: string | null;
                    proxyAdmin: string | null;
                    proxyBeacon: string | null;
                    oracleRuntime: string | null;
                    proxyRuntime: string | null;
                    cacheRuntime: string | null;
                    forwarderRuntime: string | null;
                    compositionHash: string | null;
                    signerConfigurationHash: string | null;
                    workflowConfigurationHash: string | null;
                    collateralToken: string | null;
                    loanToken: string | null;
                    collateralDecimals: number | null;
                    loanDecimals: number | null;
                    feedDecimals: number | null;
                    denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                    descriptionHash: string | null;
                    signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
                };
                configurationFingerprint: string;
                observationTimestamp: string | null;
            } | null;
            block: {
                number: string;
                hash: string;
                timestamp: string;
            } | null;
            snapshotIdentifier: string | null;
            overall: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
            actionable: false;
            gate: "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ASSURANCE_REQUIREMENTS_MET";
            dimensions: {
                CONTRACT_IDENTITY: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                SOURCE_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                OPERATOR_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                PRICE_SEMANTICS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                FRESHNESS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                INDEPENDENT_VALIDATION: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                CONFIGURATION_CONTROL: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
            };
            configuration: {
                oracle: string;
                feed: string;
                cache: string | null;
                forwarder: string | null;
                feedId: string | null;
                proxyOwner: string | null;
                cacheOwner: string | null;
                forwarderOwner: string | null;
                allowedWorkflowOwner: string | null;
                proxyImplementation: string | null;
                proxyAdmin: string | null;
                proxyBeacon: string | null;
                oracleRuntime: string | null;
                proxyRuntime: string | null;
                cacheRuntime: string | null;
                forwarderRuntime: string | null;
                compositionHash: string | null;
                signerConfigurationHash: string | null;
                workflowConfigurationHash: string | null;
                collateralToken: string | null;
                loanToken: string | null;
                collateralDecimals: number | null;
                loanDecimals: number | null;
                feedDecimals: number | null;
                denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                descriptionHash: string | null;
                signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
            } | null;
            configurationFingerprint: string | null;
            changes: ("ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED")[];
            evidenceInvalidated: boolean;
            invalidatedAt: string | null;
            invalidationReason: "CONFIGURATION_CHANGE" | "OBSERVABILITY_GAP" | null;
            freshness: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                observationTimestamp: string | null;
                observationAgeSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyOrigin: "NONE" | "OPERATOR_DEFINED_LOCAL_REJECTION";
                policyRejected: boolean;
                verifiedHeartbeatSeconds: string | null;
                upstreamFreshnessGuaranteeSeconds: string | null;
                timestampMeaning: "UNKNOWN" | "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                onchainExpiryEnforced: boolean | null;
                timingConfigurationFingerprint: string | null;
                anomalies: ("ZERO_TIMESTAMP" | "FUTURE_TIMESTAMP" | "TIMESTAMP_REGRESSION" | "TIMESTAMP_MISMATCH")[];
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            independent: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                availability: "UNAVAILABLE" | "AVAILABLE" | "NOT_CONFIGURED";
                sourceId: string | null;
                eligible: boolean;
                reasons: string[];
                toleranceBps: number | null;
                morphoPrice: string | null;
                independentPrice: string | null;
                candidate: {
                    id: string;
                    availability: "UNAVAILABLE" | "AVAILABLE";
                    base: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    quote: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    kind: "MARKET_PRICE" | "REDEMPTION_RATE";
                    denomination: "WHOLE_QUOTE_PER_WHOLE_BASE" | "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    price: string | null;
                    decimals: number;
                    timestamp: string | null;
                    frequencySeconds: string | null;
                    operatorId: string | null;
                    upstreamId: string | null;
                    proofs: {
                        claim: "ASSET" | "QUOTE" | "DENOMINATION" | "TIMESTAMP" | "FREQUENCY" | "OPERATOR" | "PROVENANCE" | "INDEPENDENCE";
                        evidence: {
                            subjectAddress: string;
                            chainId: number;
                            source: string;
                            sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                            block: {
                                number: string;
                                hash: string;
                                timestamp: string;
                            } | null;
                            retrievedAt: string;
                            method: string;
                            artifactSha256: string | null;
                            confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                            unresolved: string[];
                        };
                    }[];
                } | null;
                selectedUpstreamId: string | null;
                base: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                quote: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                evidenceMode: "FIXTURE" | "PRODUCTION";
                blockTimestamp: string | null;
                selectedTimestamp: string | null;
                candidateAgeSeconds: string | null;
                timestampSkewSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyMaxSkewSeconds: string | null;
                normalizedMorpho: {
                    numerator: string;
                    denominator: string;
                } | null;
                normalizedIndependent: {
                    numerator: string;
                    denominator: string;
                } | null;
                deviationBps: string | null;
                disagrees: boolean;
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            findings: {
                id: string;
                subjectAddress: string;
                statement: string;
                classification: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
                unresolved: string[];
            }[];
            limitations: string[];
            providerIndependence: "RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT";
        } | undefined;
    } | null;
    current: {
        cycleId: string;
        observedAt: string;
        accepted: boolean;
        risk: {
            chainId: 1672;
            account: `0x${string}`;
            marketId: `0x${string}`;
            protocol: "Morpho Blue";
            morphoAddress: `0x${string}`;
            oracleAddress: `0x${string}`;
            accountRole: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET" | "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            calculationVersion: "1.0.0";
            evidenceKind: "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE" | null;
            mathematicalRiskState: "NO_DEBT" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY" | null;
            effectiveRiskState: "NO_DEBT" | "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY";
            dataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2DataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2OracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleVerification: "UNVERIFIED";
            heartbeat: "UNKNOWN";
            actionable: false;
            actionability: "BLOCKED" | "INDICATIVE_ONLY";
            safetyRatio: string | null;
            ltv: string | null;
            ratioScale: string;
            debtAmount: string | null;
            collateralAmount: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            snapshotIdentifier: string | null;
            snapshotRetrievedAt: string | null;
            calculatedAt: string;
            temporalContext: "UNAVAILABLE" | "FIXTURE" | "LIVE_AS_OF_BLOCK" | "HISTORICAL";
            thresholds: {
                warningRatio: string;
                criticalRatio: string;
                targetRatio: string;
                liquidationBoundary: string;
            };
            repayment: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            additionalCollateral: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            recoveryEligibility?: {
                eligible: boolean;
                status: "ELIGIBLE" | "BLOCKED";
                reasonCodes: ("RECOVERY_POSITION_DATA_BLOCKED" | "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH" | "RECOVERY_CHAIN_PROGRESSION_UNKNOWN" | "RECOVERY_CHAIN_PROGRESSION_STALLED" | "RECOVERY_CHAIN_PROGRESSION_REGRESSED" | "RECOVERY_CHAIN_PROGRESSION_CONFLICT" | "RECOVERY_CHAIN_PROGRESSION_UNCHANGED" | "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED" | "RECOVERY_ASSURANCE_GATE_NOT_MET" | "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED" | "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED" | "RECOVERY_EVIDENCE_INVALIDATED" | "RECOVERY_TIMESTAMP_ANOMALY" | "RECOVERY_CONFIGURATION_MISMATCH")[];
            } | undefined;
        };
        diagnostics: ("BLOCK_TIMESTAMP_REGRESSION" | "RPC_UNAVAILABLE" | "MCP_UNAVAILABLE" | "RPC_INVALID" | "MCP_INVALID" | "SNAPSHOT_INVALID" | "SNAPSHOT_UNAVAILABLE" | "ORACLE_UNVERIFIED" | "ORACLE_DATA_UNAVAILABLE" | "ORACLE_DATA_INVALID" | "ORACLE_FRESHNESS_UNKNOWN" | "FRESHNESS_UNDETERMINED" | "MONITOR_MODE_MISMATCH" | "PROCESS_INTERRUPTED" | "RISK_CALCULATION_FAILED" | "BLOCK_REGRESSION")[];
        progression?: {
            state: "UNKNOWN" | "ADVANCING" | "UNCHANGED_WITHIN_WINDOW" | "STALLED" | "REGRESSED" | "CONFLICT";
            reason: "FIRST_OBSERVATION" | "NO_SNAPSHOT_EVIDENCE" | "MISSING_PROVIDER_HEAD" | "CHAIN_ID_MISMATCH" | "PROVIDER_HEAD_BELOW_SELECTED_BLOCK" | "INVALID_BLOCK_EVIDENCE" | "PROVIDER_HEAD_REGRESSION" | "BLOCK_NUMBER_REGRESSION" | "BLOCK_TIMESTAMP_REGRESSION" | "SAME_HEIGHT_HASH_CONFLICT" | "SAME_BLOCK_RE_READ" | "STALL_WINDOW_EXCEEDED" | "STRICT_ADVANCE" | null;
            advancedBlocks: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            headNumber: string | null;
            baselineBlockNumber: string | null;
            baselineBlockHash: string | null;
            sameBlockStreak: number;
            evaluatedAt: string;
        } | undefined;
        assurance?: {
            schemaVersion: 1;
            policyVersion: "oracle-assurance-v1";
            chainId: 1672;
            marketId: `0x${string}`;
            oracleAddress: `0x${string}`;
            evaluatedAt: string;
            retrievedAt: string | null;
            evidenceKind: "UNAVAILABLE" | "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE";
            continuityScope: string;
            baseline: {
                block: {
                    number: string;
                    hash: string;
                    timestamp: string;
                };
                retrievedAt: string;
                snapshotIdentifier: string;
                configuration: {
                    oracle: string;
                    feed: string;
                    cache: string | null;
                    forwarder: string | null;
                    feedId: string | null;
                    proxyOwner: string | null;
                    cacheOwner: string | null;
                    forwarderOwner: string | null;
                    allowedWorkflowOwner: string | null;
                    proxyImplementation: string | null;
                    proxyAdmin: string | null;
                    proxyBeacon: string | null;
                    oracleRuntime: string | null;
                    proxyRuntime: string | null;
                    cacheRuntime: string | null;
                    forwarderRuntime: string | null;
                    compositionHash: string | null;
                    signerConfigurationHash: string | null;
                    workflowConfigurationHash: string | null;
                    collateralToken: string | null;
                    loanToken: string | null;
                    collateralDecimals: number | null;
                    loanDecimals: number | null;
                    feedDecimals: number | null;
                    denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                    descriptionHash: string | null;
                    signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
                };
                configurationFingerprint: string;
                observationTimestamp: string | null;
            } | null;
            block: {
                number: string;
                hash: string;
                timestamp: string;
            } | null;
            snapshotIdentifier: string | null;
            overall: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
            actionable: false;
            gate: "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ASSURANCE_REQUIREMENTS_MET";
            dimensions: {
                CONTRACT_IDENTITY: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                SOURCE_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                OPERATOR_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                PRICE_SEMANTICS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                FRESHNESS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                INDEPENDENT_VALIDATION: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                CONFIGURATION_CONTROL: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
            };
            configuration: {
                oracle: string;
                feed: string;
                cache: string | null;
                forwarder: string | null;
                feedId: string | null;
                proxyOwner: string | null;
                cacheOwner: string | null;
                forwarderOwner: string | null;
                allowedWorkflowOwner: string | null;
                proxyImplementation: string | null;
                proxyAdmin: string | null;
                proxyBeacon: string | null;
                oracleRuntime: string | null;
                proxyRuntime: string | null;
                cacheRuntime: string | null;
                forwarderRuntime: string | null;
                compositionHash: string | null;
                signerConfigurationHash: string | null;
                workflowConfigurationHash: string | null;
                collateralToken: string | null;
                loanToken: string | null;
                collateralDecimals: number | null;
                loanDecimals: number | null;
                feedDecimals: number | null;
                denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                descriptionHash: string | null;
                signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
            } | null;
            configurationFingerprint: string | null;
            changes: ("ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED")[];
            evidenceInvalidated: boolean;
            invalidatedAt: string | null;
            invalidationReason: "CONFIGURATION_CHANGE" | "OBSERVABILITY_GAP" | null;
            freshness: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                observationTimestamp: string | null;
                observationAgeSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyOrigin: "NONE" | "OPERATOR_DEFINED_LOCAL_REJECTION";
                policyRejected: boolean;
                verifiedHeartbeatSeconds: string | null;
                upstreamFreshnessGuaranteeSeconds: string | null;
                timestampMeaning: "UNKNOWN" | "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                onchainExpiryEnforced: boolean | null;
                timingConfigurationFingerprint: string | null;
                anomalies: ("ZERO_TIMESTAMP" | "FUTURE_TIMESTAMP" | "TIMESTAMP_REGRESSION" | "TIMESTAMP_MISMATCH")[];
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            independent: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                availability: "UNAVAILABLE" | "AVAILABLE" | "NOT_CONFIGURED";
                sourceId: string | null;
                eligible: boolean;
                reasons: string[];
                toleranceBps: number | null;
                morphoPrice: string | null;
                independentPrice: string | null;
                candidate: {
                    id: string;
                    availability: "UNAVAILABLE" | "AVAILABLE";
                    base: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    quote: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    kind: "MARKET_PRICE" | "REDEMPTION_RATE";
                    denomination: "WHOLE_QUOTE_PER_WHOLE_BASE" | "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    price: string | null;
                    decimals: number;
                    timestamp: string | null;
                    frequencySeconds: string | null;
                    operatorId: string | null;
                    upstreamId: string | null;
                    proofs: {
                        claim: "ASSET" | "QUOTE" | "DENOMINATION" | "TIMESTAMP" | "FREQUENCY" | "OPERATOR" | "PROVENANCE" | "INDEPENDENCE";
                        evidence: {
                            subjectAddress: string;
                            chainId: number;
                            source: string;
                            sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                            block: {
                                number: string;
                                hash: string;
                                timestamp: string;
                            } | null;
                            retrievedAt: string;
                            method: string;
                            artifactSha256: string | null;
                            confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                            unresolved: string[];
                        };
                    }[];
                } | null;
                selectedUpstreamId: string | null;
                base: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                quote: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                evidenceMode: "FIXTURE" | "PRODUCTION";
                blockTimestamp: string | null;
                selectedTimestamp: string | null;
                candidateAgeSeconds: string | null;
                timestampSkewSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyMaxSkewSeconds: string | null;
                normalizedMorpho: {
                    numerator: string;
                    denominator: string;
                } | null;
                normalizedIndependent: {
                    numerator: string;
                    denominator: string;
                } | null;
                deviationBps: string | null;
                disagrees: boolean;
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            findings: {
                id: string;
                subjectAddress: string;
                statement: string;
                classification: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
                unresolved: string[];
            }[];
            limitations: string[];
            providerIndependence: "RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT";
        } | undefined;
    };
    suggestedAction: {
        type: "NON_FINANCIAL";
        financialOptions: [];
        schemaVersion: 1;
        origin: "GENERATED" | "LEGACY_DERIVED";
        instruction: string;
        rationale: "STRICT_RECOVERY_ELIGIBILITY_PASSED" | "POSITION_REQUIRES_REVIEW" | "DATA_REQUIRES_REFRESH" | "ORACLE_REQUIRES_VERIFICATION" | "CONTINUE_MONITORING" | "LEGACY_ALERT_WITHOUT_PERSISTED_ACTION";
        createdAt: string;
        evidence: {
            status: "QUALIFIED_FINANCIAL" | "NOT_QUALIFIED" | "LEGACY_UNAVAILABLE";
            cycleId: string | null;
            chainId: 1672 | null;
            account: string | null;
            marketId: string | null;
            snapshotIdentifier: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            progressionState: "UNKNOWN" | "ADVANCING" | "UNCHANGED_WITHIN_WINDOW" | "STALLED" | "REGRESSED" | "CONFLICT" | null;
            progressionReason: "FIRST_OBSERVATION" | "NO_SNAPSHOT_EVIDENCE" | "MISSING_PROVIDER_HEAD" | "CHAIN_ID_MISMATCH" | "PROVIDER_HEAD_BELOW_SELECTED_BLOCK" | "INVALID_BLOCK_EVIDENCE" | "PROVIDER_HEAD_REGRESSION" | "BLOCK_NUMBER_REGRESSION" | "BLOCK_TIMESTAMP_REGRESSION" | "SAME_HEIGHT_HASH_CONFLICT" | "SAME_BLOCK_RE_READ" | "STALL_WINDOW_EXCEEDED" | "STRICT_ADVANCE" | null;
            oracleAssurance: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            oracleFreshness: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            independentValidation: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            evidenceInvalidated: boolean | null;
            oracleObservationTimestamp: string | null;
            timestampAnomalies: ("ZERO_TIMESTAMP" | "FUTURE_TIMESTAMP" | "TIMESTAMP_REGRESSION" | "TIMESTAMP_MISMATCH")[];
            configurationChanges: ("ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED")[];
            recoveryEligibility: {
                eligible: boolean;
                status: "ELIGIBLE" | "BLOCKED";
                reasonCodes: ("RECOVERY_POSITION_DATA_BLOCKED" | "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH" | "RECOVERY_CHAIN_PROGRESSION_UNKNOWN" | "RECOVERY_CHAIN_PROGRESSION_STALLED" | "RECOVERY_CHAIN_PROGRESSION_REGRESSED" | "RECOVERY_CHAIN_PROGRESSION_CONFLICT" | "RECOVERY_CHAIN_PROGRESSION_UNCHANGED" | "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED" | "RECOVERY_ASSURANCE_GATE_NOT_MET" | "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED" | "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED" | "RECOVERY_EVIDENCE_INVALIDATED" | "RECOVERY_TIMESTAMP_ANOMALY" | "RECOVERY_CONFIGURATION_MISMATCH")[];
            } | null;
        };
        actionable: false;
    } | {
        type: "FINANCIAL_OPTION";
        financialOptions: {
            type: "REPAY" | "ADD_COLLATERAL";
            amountRaw: string;
            amountFormatted: string;
            assetAddress: string;
            assetDecimals: number;
            chainId: 1672;
            account: string;
            marketId: string;
            targetRatio: string;
            calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
            snapshotIdentifier: string;
            blockNumber: string;
            blockHash: string;
            calculatedAt: string;
            oracleObservationTimestamp: string;
            freshness: "VERIFIED";
            condition: "REFRESH_AND_SIMULATE_BEFORE_ANY_TRANSACTION";
            actionable: false;
        }[];
        schemaVersion: 1;
        origin: "GENERATED" | "LEGACY_DERIVED";
        instruction: string;
        rationale: "STRICT_RECOVERY_ELIGIBILITY_PASSED" | "POSITION_REQUIRES_REVIEW" | "DATA_REQUIRES_REFRESH" | "ORACLE_REQUIRES_VERIFICATION" | "CONTINUE_MONITORING" | "LEGACY_ALERT_WITHOUT_PERSISTED_ACTION";
        createdAt: string;
        evidence: {
            status: "QUALIFIED_FINANCIAL" | "NOT_QUALIFIED" | "LEGACY_UNAVAILABLE";
            cycleId: string | null;
            chainId: 1672 | null;
            account: string | null;
            marketId: string | null;
            snapshotIdentifier: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            progressionState: "UNKNOWN" | "ADVANCING" | "UNCHANGED_WITHIN_WINDOW" | "STALLED" | "REGRESSED" | "CONFLICT" | null;
            progressionReason: "FIRST_OBSERVATION" | "NO_SNAPSHOT_EVIDENCE" | "MISSING_PROVIDER_HEAD" | "CHAIN_ID_MISMATCH" | "PROVIDER_HEAD_BELOW_SELECTED_BLOCK" | "INVALID_BLOCK_EVIDENCE" | "PROVIDER_HEAD_REGRESSION" | "BLOCK_NUMBER_REGRESSION" | "BLOCK_TIMESTAMP_REGRESSION" | "SAME_HEIGHT_HASH_CONFLICT" | "SAME_BLOCK_RE_READ" | "STALL_WINDOW_EXCEEDED" | "STRICT_ADVANCE" | null;
            oracleAssurance: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            oracleFreshness: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            independentValidation: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            evidenceInvalidated: boolean | null;
            oracleObservationTimestamp: string | null;
            timestampAnomalies: ("ZERO_TIMESTAMP" | "FUTURE_TIMESTAMP" | "TIMESTAMP_REGRESSION" | "TIMESTAMP_MISMATCH")[];
            configurationChanges: ("ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED")[];
            recoveryEligibility: {
                eligible: boolean;
                status: "ELIGIBLE" | "BLOCKED";
                reasonCodes: ("RECOVERY_POSITION_DATA_BLOCKED" | "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH" | "RECOVERY_CHAIN_PROGRESSION_UNKNOWN" | "RECOVERY_CHAIN_PROGRESSION_STALLED" | "RECOVERY_CHAIN_PROGRESSION_REGRESSED" | "RECOVERY_CHAIN_PROGRESSION_CONFLICT" | "RECOVERY_CHAIN_PROGRESSION_UNCHANGED" | "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED" | "RECOVERY_ASSURANCE_GATE_NOT_MET" | "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED" | "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED" | "RECOVERY_EVIDENCE_INVALIDATED" | "RECOVERY_TIMESTAMP_ANOMALY" | "RECOVERY_CONFIGURATION_MISMATCH")[];
            } | null;
        };
        actionable: false;
    };
}, {
    id: string;
    fingerprint: string;
    scope: string;
    cycleId: string;
    createdAt: string;
    severity: "WARNING" | "CRITICAL" | "INFO" | "BOUNDARY";
    category: "RISK" | "DATA_QUALITY" | "ORACLE" | "MONITOR_HEALTH";
    code: "ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED" | "INDEPENDENT_PRICE_DISAGREEMENT" | "INITIAL_RISK" | "RISK_WORSENED" | "RISK_IMPROVED" | "RISK_RECOVERY" | "NO_DEBT_OBSERVED" | "DEBT_OBSERVED" | "CRITICAL_REMINDER" | "DATA_QUALITY_CHANGED" | "DATA_RESTORED" | "ORACLE_QUALITY_CHANGED" | "PERSISTENT_READ_FAILURE" | "ORACLE_TIMESTAMP_ANOMALY" | "ORACLE_ASSURANCE_DETERIORATED" | "ORACLE_ASSURANCE_IMPROVED" | "ORACLE_ASSURANCE_INVALIDATED";
    previous: {
        cycleId: string;
        observedAt: string;
        accepted: boolean;
        risk: {
            chainId: 1672;
            account: `0x${string}`;
            marketId: `0x${string}`;
            protocol: "Morpho Blue";
            morphoAddress: `0x${string}`;
            oracleAddress: `0x${string}`;
            accountRole: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET" | "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            calculationVersion: "1.0.0";
            evidenceKind: "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE" | null;
            mathematicalRiskState: "NO_DEBT" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY" | null;
            effectiveRiskState: "NO_DEBT" | "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY";
            dataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2DataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2OracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleVerification: "UNVERIFIED";
            heartbeat: "UNKNOWN";
            actionable: false;
            actionability: "BLOCKED" | "INDICATIVE_ONLY";
            safetyRatio: string | null;
            ltv: string | null;
            ratioScale: string;
            debtAmount: string | null;
            collateralAmount: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            snapshotIdentifier: string | null;
            snapshotRetrievedAt: string | null;
            calculatedAt: string;
            temporalContext: "UNAVAILABLE" | "FIXTURE" | "LIVE_AS_OF_BLOCK" | "HISTORICAL";
            thresholds: {
                warningRatio: string;
                criticalRatio: string;
                targetRatio: string;
                liquidationBoundary: string;
            };
            repayment: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            additionalCollateral: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            recoveryEligibility?: {
                eligible: boolean;
                status: "ELIGIBLE" | "BLOCKED";
                reasonCodes: ("RECOVERY_POSITION_DATA_BLOCKED" | "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH" | "RECOVERY_CHAIN_PROGRESSION_UNKNOWN" | "RECOVERY_CHAIN_PROGRESSION_STALLED" | "RECOVERY_CHAIN_PROGRESSION_REGRESSED" | "RECOVERY_CHAIN_PROGRESSION_CONFLICT" | "RECOVERY_CHAIN_PROGRESSION_UNCHANGED" | "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED" | "RECOVERY_ASSURANCE_GATE_NOT_MET" | "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED" | "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED" | "RECOVERY_EVIDENCE_INVALIDATED" | "RECOVERY_TIMESTAMP_ANOMALY" | "RECOVERY_CONFIGURATION_MISMATCH")[];
            } | undefined;
        };
        diagnostics: ("BLOCK_TIMESTAMP_REGRESSION" | "RPC_UNAVAILABLE" | "MCP_UNAVAILABLE" | "RPC_INVALID" | "MCP_INVALID" | "SNAPSHOT_INVALID" | "SNAPSHOT_UNAVAILABLE" | "ORACLE_UNVERIFIED" | "ORACLE_DATA_UNAVAILABLE" | "ORACLE_DATA_INVALID" | "ORACLE_FRESHNESS_UNKNOWN" | "FRESHNESS_UNDETERMINED" | "MONITOR_MODE_MISMATCH" | "PROCESS_INTERRUPTED" | "RISK_CALCULATION_FAILED" | "BLOCK_REGRESSION")[];
        progression?: {
            state: "UNKNOWN" | "ADVANCING" | "UNCHANGED_WITHIN_WINDOW" | "STALLED" | "REGRESSED" | "CONFLICT";
            reason: "FIRST_OBSERVATION" | "NO_SNAPSHOT_EVIDENCE" | "MISSING_PROVIDER_HEAD" | "CHAIN_ID_MISMATCH" | "PROVIDER_HEAD_BELOW_SELECTED_BLOCK" | "INVALID_BLOCK_EVIDENCE" | "PROVIDER_HEAD_REGRESSION" | "BLOCK_NUMBER_REGRESSION" | "BLOCK_TIMESTAMP_REGRESSION" | "SAME_HEIGHT_HASH_CONFLICT" | "SAME_BLOCK_RE_READ" | "STALL_WINDOW_EXCEEDED" | "STRICT_ADVANCE" | null;
            advancedBlocks: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            headNumber: string | null;
            baselineBlockNumber: string | null;
            baselineBlockHash: string | null;
            sameBlockStreak: number;
            evaluatedAt: string;
        } | undefined;
        assurance?: {
            schemaVersion: 1;
            policyVersion: "oracle-assurance-v1";
            chainId: 1672;
            marketId: `0x${string}`;
            oracleAddress: `0x${string}`;
            evaluatedAt: string;
            retrievedAt: string | null;
            evidenceKind: "UNAVAILABLE" | "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE";
            continuityScope: string;
            baseline: {
                block: {
                    number: string;
                    hash: string;
                    timestamp: string;
                };
                retrievedAt: string;
                snapshotIdentifier: string;
                configuration: {
                    oracle: string;
                    feed: string;
                    cache: string | null;
                    forwarder: string | null;
                    feedId: string | null;
                    proxyOwner: string | null;
                    cacheOwner: string | null;
                    forwarderOwner: string | null;
                    allowedWorkflowOwner: string | null;
                    proxyImplementation: string | null;
                    proxyAdmin: string | null;
                    proxyBeacon: string | null;
                    oracleRuntime: string | null;
                    proxyRuntime: string | null;
                    cacheRuntime: string | null;
                    forwarderRuntime: string | null;
                    compositionHash: string | null;
                    signerConfigurationHash: string | null;
                    workflowConfigurationHash: string | null;
                    collateralToken: string | null;
                    loanToken: string | null;
                    collateralDecimals: number | null;
                    loanDecimals: number | null;
                    feedDecimals: number | null;
                    denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                    descriptionHash: string | null;
                    signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
                };
                configurationFingerprint: string;
                observationTimestamp: string | null;
            } | null;
            block: {
                number: string;
                hash: string;
                timestamp: string;
            } | null;
            snapshotIdentifier: string | null;
            overall: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
            actionable: false;
            gate: "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ASSURANCE_REQUIREMENTS_MET";
            dimensions: {
                CONTRACT_IDENTITY: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                SOURCE_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                OPERATOR_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                PRICE_SEMANTICS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                FRESHNESS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                INDEPENDENT_VALIDATION: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                CONFIGURATION_CONTROL: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
            };
            configuration: {
                oracle: string;
                feed: string;
                cache: string | null;
                forwarder: string | null;
                feedId: string | null;
                proxyOwner: string | null;
                cacheOwner: string | null;
                forwarderOwner: string | null;
                allowedWorkflowOwner: string | null;
                proxyImplementation: string | null;
                proxyAdmin: string | null;
                proxyBeacon: string | null;
                oracleRuntime: string | null;
                proxyRuntime: string | null;
                cacheRuntime: string | null;
                forwarderRuntime: string | null;
                compositionHash: string | null;
                signerConfigurationHash: string | null;
                workflowConfigurationHash: string | null;
                collateralToken: string | null;
                loanToken: string | null;
                collateralDecimals: number | null;
                loanDecimals: number | null;
                feedDecimals: number | null;
                denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                descriptionHash: string | null;
                signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
            } | null;
            configurationFingerprint: string | null;
            changes: ("ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED")[];
            evidenceInvalidated: boolean;
            invalidatedAt: string | null;
            invalidationReason: "CONFIGURATION_CHANGE" | "OBSERVABILITY_GAP" | null;
            freshness: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                observationTimestamp: string | null;
                observationAgeSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyOrigin: "NONE" | "OPERATOR_DEFINED_LOCAL_REJECTION";
                policyRejected: boolean;
                verifiedHeartbeatSeconds: string | null;
                upstreamFreshnessGuaranteeSeconds: string | null;
                timestampMeaning: "UNKNOWN" | "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                onchainExpiryEnforced: boolean | null;
                timingConfigurationFingerprint: string | null;
                anomalies: ("ZERO_TIMESTAMP" | "FUTURE_TIMESTAMP" | "TIMESTAMP_REGRESSION" | "TIMESTAMP_MISMATCH")[];
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            independent: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                availability: "UNAVAILABLE" | "AVAILABLE" | "NOT_CONFIGURED";
                sourceId: string | null;
                eligible: boolean;
                reasons: string[];
                toleranceBps: number | null;
                morphoPrice: string | null;
                independentPrice: string | null;
                candidate: {
                    id: string;
                    availability: "UNAVAILABLE" | "AVAILABLE";
                    base: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    quote: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    kind: "MARKET_PRICE" | "REDEMPTION_RATE";
                    denomination: "WHOLE_QUOTE_PER_WHOLE_BASE" | "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    price: string | null;
                    decimals: number;
                    timestamp: string | null;
                    frequencySeconds: string | null;
                    operatorId: string | null;
                    upstreamId: string | null;
                    proofs: {
                        claim: "ASSET" | "QUOTE" | "DENOMINATION" | "TIMESTAMP" | "FREQUENCY" | "OPERATOR" | "PROVENANCE" | "INDEPENDENCE";
                        evidence: {
                            subjectAddress: string;
                            chainId: number;
                            source: string;
                            sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                            block: {
                                number: string;
                                hash: string;
                                timestamp: string;
                            } | null;
                            retrievedAt: string;
                            method: string;
                            artifactSha256: string | null;
                            confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                            unresolved: string[];
                        };
                    }[];
                } | null;
                selectedUpstreamId: string | null;
                base: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                quote: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                evidenceMode: "FIXTURE" | "PRODUCTION";
                blockTimestamp: string | null;
                selectedTimestamp: string | null;
                candidateAgeSeconds: string | null;
                timestampSkewSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyMaxSkewSeconds: string | null;
                normalizedMorpho: {
                    numerator: string;
                    denominator: string;
                } | null;
                normalizedIndependent: {
                    numerator: string;
                    denominator: string;
                } | null;
                deviationBps: string | null;
                disagrees: boolean;
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            findings: {
                id: string;
                subjectAddress: string;
                statement: string;
                classification: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
                unresolved: string[];
            }[];
            limitations: string[];
            providerIndependence: "RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT";
        } | undefined;
    } | null;
    current: {
        cycleId: string;
        observedAt: string;
        accepted: boolean;
        risk: {
            chainId: 1672;
            account: `0x${string}`;
            marketId: `0x${string}`;
            protocol: "Morpho Blue";
            morphoAddress: `0x${string}`;
            oracleAddress: `0x${string}`;
            accountRole: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET" | "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            calculationVersion: "1.0.0";
            evidenceKind: "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE" | null;
            mathematicalRiskState: "NO_DEBT" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY" | null;
            effectiveRiskState: "NO_DEBT" | "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY";
            dataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2DataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2OracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleVerification: "UNVERIFIED";
            heartbeat: "UNKNOWN";
            actionable: false;
            actionability: "BLOCKED" | "INDICATIVE_ONLY";
            safetyRatio: string | null;
            ltv: string | null;
            ratioScale: string;
            debtAmount: string | null;
            collateralAmount: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            snapshotIdentifier: string | null;
            snapshotRetrievedAt: string | null;
            calculatedAt: string;
            temporalContext: "UNAVAILABLE" | "FIXTURE" | "LIVE_AS_OF_BLOCK" | "HISTORICAL";
            thresholds: {
                warningRatio: string;
                criticalRatio: string;
                targetRatio: string;
                liquidationBoundary: string;
            };
            repayment: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            additionalCollateral: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            recoveryEligibility?: {
                eligible: boolean;
                status: "ELIGIBLE" | "BLOCKED";
                reasonCodes: ("RECOVERY_POSITION_DATA_BLOCKED" | "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH" | "RECOVERY_CHAIN_PROGRESSION_UNKNOWN" | "RECOVERY_CHAIN_PROGRESSION_STALLED" | "RECOVERY_CHAIN_PROGRESSION_REGRESSED" | "RECOVERY_CHAIN_PROGRESSION_CONFLICT" | "RECOVERY_CHAIN_PROGRESSION_UNCHANGED" | "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED" | "RECOVERY_ASSURANCE_GATE_NOT_MET" | "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED" | "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED" | "RECOVERY_EVIDENCE_INVALIDATED" | "RECOVERY_TIMESTAMP_ANOMALY" | "RECOVERY_CONFIGURATION_MISMATCH")[];
            } | undefined;
        };
        diagnostics: ("BLOCK_TIMESTAMP_REGRESSION" | "RPC_UNAVAILABLE" | "MCP_UNAVAILABLE" | "RPC_INVALID" | "MCP_INVALID" | "SNAPSHOT_INVALID" | "SNAPSHOT_UNAVAILABLE" | "ORACLE_UNVERIFIED" | "ORACLE_DATA_UNAVAILABLE" | "ORACLE_DATA_INVALID" | "ORACLE_FRESHNESS_UNKNOWN" | "FRESHNESS_UNDETERMINED" | "MONITOR_MODE_MISMATCH" | "PROCESS_INTERRUPTED" | "RISK_CALCULATION_FAILED" | "BLOCK_REGRESSION")[];
        progression?: {
            state: "UNKNOWN" | "ADVANCING" | "UNCHANGED_WITHIN_WINDOW" | "STALLED" | "REGRESSED" | "CONFLICT";
            reason: "FIRST_OBSERVATION" | "NO_SNAPSHOT_EVIDENCE" | "MISSING_PROVIDER_HEAD" | "CHAIN_ID_MISMATCH" | "PROVIDER_HEAD_BELOW_SELECTED_BLOCK" | "INVALID_BLOCK_EVIDENCE" | "PROVIDER_HEAD_REGRESSION" | "BLOCK_NUMBER_REGRESSION" | "BLOCK_TIMESTAMP_REGRESSION" | "SAME_HEIGHT_HASH_CONFLICT" | "SAME_BLOCK_RE_READ" | "STALL_WINDOW_EXCEEDED" | "STRICT_ADVANCE" | null;
            advancedBlocks: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            headNumber: string | null;
            baselineBlockNumber: string | null;
            baselineBlockHash: string | null;
            sameBlockStreak: number;
            evaluatedAt: string;
        } | undefined;
        assurance?: {
            schemaVersion: 1;
            policyVersion: "oracle-assurance-v1";
            chainId: 1672;
            marketId: `0x${string}`;
            oracleAddress: `0x${string}`;
            evaluatedAt: string;
            retrievedAt: string | null;
            evidenceKind: "UNAVAILABLE" | "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE";
            continuityScope: string;
            baseline: {
                block: {
                    number: string;
                    hash: string;
                    timestamp: string;
                };
                retrievedAt: string;
                snapshotIdentifier: string;
                configuration: {
                    oracle: string;
                    feed: string;
                    cache: string | null;
                    forwarder: string | null;
                    feedId: string | null;
                    proxyOwner: string | null;
                    cacheOwner: string | null;
                    forwarderOwner: string | null;
                    allowedWorkflowOwner: string | null;
                    proxyImplementation: string | null;
                    proxyAdmin: string | null;
                    proxyBeacon: string | null;
                    oracleRuntime: string | null;
                    proxyRuntime: string | null;
                    cacheRuntime: string | null;
                    forwarderRuntime: string | null;
                    compositionHash: string | null;
                    signerConfigurationHash: string | null;
                    workflowConfigurationHash: string | null;
                    collateralToken: string | null;
                    loanToken: string | null;
                    collateralDecimals: number | null;
                    loanDecimals: number | null;
                    feedDecimals: number | null;
                    denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                    descriptionHash: string | null;
                    signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
                };
                configurationFingerprint: string;
                observationTimestamp: string | null;
            } | null;
            block: {
                number: string;
                hash: string;
                timestamp: string;
            } | null;
            snapshotIdentifier: string | null;
            overall: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
            actionable: false;
            gate: "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ASSURANCE_REQUIREMENTS_MET";
            dimensions: {
                CONTRACT_IDENTITY: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                SOURCE_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                OPERATOR_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                PRICE_SEMANTICS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                FRESHNESS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                INDEPENDENT_VALIDATION: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                CONFIGURATION_CONTROL: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
            };
            configuration: {
                oracle: string;
                feed: string;
                cache: string | null;
                forwarder: string | null;
                feedId: string | null;
                proxyOwner: string | null;
                cacheOwner: string | null;
                forwarderOwner: string | null;
                allowedWorkflowOwner: string | null;
                proxyImplementation: string | null;
                proxyAdmin: string | null;
                proxyBeacon: string | null;
                oracleRuntime: string | null;
                proxyRuntime: string | null;
                cacheRuntime: string | null;
                forwarderRuntime: string | null;
                compositionHash: string | null;
                signerConfigurationHash: string | null;
                workflowConfigurationHash: string | null;
                collateralToken: string | null;
                loanToken: string | null;
                collateralDecimals: number | null;
                loanDecimals: number | null;
                feedDecimals: number | null;
                denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                descriptionHash: string | null;
                signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
            } | null;
            configurationFingerprint: string | null;
            changes: ("ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED")[];
            evidenceInvalidated: boolean;
            invalidatedAt: string | null;
            invalidationReason: "CONFIGURATION_CHANGE" | "OBSERVABILITY_GAP" | null;
            freshness: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                observationTimestamp: string | null;
                observationAgeSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyOrigin: "NONE" | "OPERATOR_DEFINED_LOCAL_REJECTION";
                policyRejected: boolean;
                verifiedHeartbeatSeconds: string | null;
                upstreamFreshnessGuaranteeSeconds: string | null;
                timestampMeaning: "UNKNOWN" | "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                onchainExpiryEnforced: boolean | null;
                timingConfigurationFingerprint: string | null;
                anomalies: ("ZERO_TIMESTAMP" | "FUTURE_TIMESTAMP" | "TIMESTAMP_REGRESSION" | "TIMESTAMP_MISMATCH")[];
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            independent: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                availability: "UNAVAILABLE" | "AVAILABLE" | "NOT_CONFIGURED";
                sourceId: string | null;
                eligible: boolean;
                reasons: string[];
                toleranceBps: number | null;
                morphoPrice: string | null;
                independentPrice: string | null;
                candidate: {
                    id: string;
                    availability: "UNAVAILABLE" | "AVAILABLE";
                    base: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    quote: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    kind: "MARKET_PRICE" | "REDEMPTION_RATE";
                    denomination: "WHOLE_QUOTE_PER_WHOLE_BASE" | "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    price: string | null;
                    decimals: number;
                    timestamp: string | null;
                    frequencySeconds: string | null;
                    operatorId: string | null;
                    upstreamId: string | null;
                    proofs: {
                        claim: "ASSET" | "QUOTE" | "DENOMINATION" | "TIMESTAMP" | "FREQUENCY" | "OPERATOR" | "PROVENANCE" | "INDEPENDENCE";
                        evidence: {
                            subjectAddress: string;
                            chainId: number;
                            source: string;
                            sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                            block: {
                                number: string;
                                hash: string;
                                timestamp: string;
                            } | null;
                            retrievedAt: string;
                            method: string;
                            artifactSha256: string | null;
                            confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                            unresolved: string[];
                        };
                    }[];
                } | null;
                selectedUpstreamId: string | null;
                base: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                quote: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                evidenceMode: "FIXTURE" | "PRODUCTION";
                blockTimestamp: string | null;
                selectedTimestamp: string | null;
                candidateAgeSeconds: string | null;
                timestampSkewSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyMaxSkewSeconds: string | null;
                normalizedMorpho: {
                    numerator: string;
                    denominator: string;
                } | null;
                normalizedIndependent: {
                    numerator: string;
                    denominator: string;
                } | null;
                deviationBps: string | null;
                disagrees: boolean;
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            findings: {
                id: string;
                subjectAddress: string;
                statement: string;
                classification: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
                unresolved: string[];
            }[];
            limitations: string[];
            providerIndependence: "RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT";
        } | undefined;
    };
} | {
    id: string;
    fingerprint: string;
    scope: string;
    cycleId: string;
    createdAt: string;
    severity: "WARNING" | "CRITICAL" | "INFO" | "BOUNDARY";
    category: "RISK" | "DATA_QUALITY" | "ORACLE" | "MONITOR_HEALTH";
    code: "ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED" | "INDEPENDENT_PRICE_DISAGREEMENT" | "INITIAL_RISK" | "RISK_WORSENED" | "RISK_IMPROVED" | "RISK_RECOVERY" | "NO_DEBT_OBSERVED" | "DEBT_OBSERVED" | "CRITICAL_REMINDER" | "DATA_QUALITY_CHANGED" | "DATA_RESTORED" | "ORACLE_QUALITY_CHANGED" | "PERSISTENT_READ_FAILURE" | "ORACLE_TIMESTAMP_ANOMALY" | "ORACLE_ASSURANCE_DETERIORATED" | "ORACLE_ASSURANCE_IMPROVED" | "ORACLE_ASSURANCE_INVALIDATED";
    previous: {
        cycleId: string;
        observedAt: string;
        accepted: boolean;
        risk: {
            chainId: 1672;
            account: `0x${string}`;
            marketId: `0x${string}`;
            protocol: "Morpho Blue";
            morphoAddress: `0x${string}`;
            oracleAddress: `0x${string}`;
            accountRole: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET" | "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            calculationVersion: "1.0.0";
            evidenceKind: "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE" | null;
            mathematicalRiskState: "NO_DEBT" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY" | null;
            effectiveRiskState: "NO_DEBT" | "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY";
            dataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2DataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2OracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleVerification: "UNVERIFIED";
            heartbeat: "UNKNOWN";
            actionable: false;
            actionability: "BLOCKED" | "INDICATIVE_ONLY";
            safetyRatio: string | null;
            ltv: string | null;
            ratioScale: string;
            debtAmount: string | null;
            collateralAmount: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            snapshotIdentifier: string | null;
            snapshotRetrievedAt: string | null;
            calculatedAt: string;
            temporalContext: "UNAVAILABLE" | "FIXTURE" | "LIVE_AS_OF_BLOCK" | "HISTORICAL";
            thresholds: {
                warningRatio: string;
                criticalRatio: string;
                targetRatio: string;
                liquidationBoundary: string;
            };
            repayment: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            additionalCollateral: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            recoveryEligibility?: {
                eligible: boolean;
                status: "ELIGIBLE" | "BLOCKED";
                reasonCodes: ("RECOVERY_POSITION_DATA_BLOCKED" | "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH" | "RECOVERY_CHAIN_PROGRESSION_UNKNOWN" | "RECOVERY_CHAIN_PROGRESSION_STALLED" | "RECOVERY_CHAIN_PROGRESSION_REGRESSED" | "RECOVERY_CHAIN_PROGRESSION_CONFLICT" | "RECOVERY_CHAIN_PROGRESSION_UNCHANGED" | "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED" | "RECOVERY_ASSURANCE_GATE_NOT_MET" | "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED" | "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED" | "RECOVERY_EVIDENCE_INVALIDATED" | "RECOVERY_TIMESTAMP_ANOMALY" | "RECOVERY_CONFIGURATION_MISMATCH")[];
            } | undefined;
        };
        diagnostics: ("BLOCK_TIMESTAMP_REGRESSION" | "RPC_UNAVAILABLE" | "MCP_UNAVAILABLE" | "RPC_INVALID" | "MCP_INVALID" | "SNAPSHOT_INVALID" | "SNAPSHOT_UNAVAILABLE" | "ORACLE_UNVERIFIED" | "ORACLE_DATA_UNAVAILABLE" | "ORACLE_DATA_INVALID" | "ORACLE_FRESHNESS_UNKNOWN" | "FRESHNESS_UNDETERMINED" | "MONITOR_MODE_MISMATCH" | "PROCESS_INTERRUPTED" | "RISK_CALCULATION_FAILED" | "BLOCK_REGRESSION")[];
        progression?: {
            state: "UNKNOWN" | "ADVANCING" | "UNCHANGED_WITHIN_WINDOW" | "STALLED" | "REGRESSED" | "CONFLICT";
            reason: "FIRST_OBSERVATION" | "NO_SNAPSHOT_EVIDENCE" | "MISSING_PROVIDER_HEAD" | "CHAIN_ID_MISMATCH" | "PROVIDER_HEAD_BELOW_SELECTED_BLOCK" | "INVALID_BLOCK_EVIDENCE" | "PROVIDER_HEAD_REGRESSION" | "BLOCK_NUMBER_REGRESSION" | "BLOCK_TIMESTAMP_REGRESSION" | "SAME_HEIGHT_HASH_CONFLICT" | "SAME_BLOCK_RE_READ" | "STALL_WINDOW_EXCEEDED" | "STRICT_ADVANCE" | null;
            advancedBlocks: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            headNumber: string | null;
            baselineBlockNumber: string | null;
            baselineBlockHash: string | null;
            sameBlockStreak: number;
            evaluatedAt: string;
        } | undefined;
        assurance?: {
            schemaVersion: 1;
            policyVersion: "oracle-assurance-v1";
            chainId: 1672;
            marketId: `0x${string}`;
            oracleAddress: `0x${string}`;
            evaluatedAt: string;
            retrievedAt: string | null;
            evidenceKind: "UNAVAILABLE" | "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE";
            continuityScope: string;
            baseline: {
                block: {
                    number: string;
                    hash: string;
                    timestamp: string;
                };
                retrievedAt: string;
                snapshotIdentifier: string;
                configuration: {
                    oracle: string;
                    feed: string;
                    cache: string | null;
                    forwarder: string | null;
                    feedId: string | null;
                    proxyOwner: string | null;
                    cacheOwner: string | null;
                    forwarderOwner: string | null;
                    allowedWorkflowOwner: string | null;
                    proxyImplementation: string | null;
                    proxyAdmin: string | null;
                    proxyBeacon: string | null;
                    oracleRuntime: string | null;
                    proxyRuntime: string | null;
                    cacheRuntime: string | null;
                    forwarderRuntime: string | null;
                    compositionHash: string | null;
                    signerConfigurationHash: string | null;
                    workflowConfigurationHash: string | null;
                    collateralToken: string | null;
                    loanToken: string | null;
                    collateralDecimals: number | null;
                    loanDecimals: number | null;
                    feedDecimals: number | null;
                    denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                    descriptionHash: string | null;
                    signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
                };
                configurationFingerprint: string;
                observationTimestamp: string | null;
            } | null;
            block: {
                number: string;
                hash: string;
                timestamp: string;
            } | null;
            snapshotIdentifier: string | null;
            overall: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
            actionable: false;
            gate: "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ASSURANCE_REQUIREMENTS_MET";
            dimensions: {
                CONTRACT_IDENTITY: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                SOURCE_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                OPERATOR_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                PRICE_SEMANTICS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                FRESHNESS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                INDEPENDENT_VALIDATION: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                CONFIGURATION_CONTROL: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
            };
            configuration: {
                oracle: string;
                feed: string;
                cache: string | null;
                forwarder: string | null;
                feedId: string | null;
                proxyOwner: string | null;
                cacheOwner: string | null;
                forwarderOwner: string | null;
                allowedWorkflowOwner: string | null;
                proxyImplementation: string | null;
                proxyAdmin: string | null;
                proxyBeacon: string | null;
                oracleRuntime: string | null;
                proxyRuntime: string | null;
                cacheRuntime: string | null;
                forwarderRuntime: string | null;
                compositionHash: string | null;
                signerConfigurationHash: string | null;
                workflowConfigurationHash: string | null;
                collateralToken: string | null;
                loanToken: string | null;
                collateralDecimals: number | null;
                loanDecimals: number | null;
                feedDecimals: number | null;
                denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                descriptionHash: string | null;
                signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
            } | null;
            configurationFingerprint: string | null;
            changes: ("ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED")[];
            evidenceInvalidated: boolean;
            invalidatedAt: string | null;
            invalidationReason: "CONFIGURATION_CHANGE" | "OBSERVABILITY_GAP" | null;
            freshness: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                observationTimestamp: string | null;
                observationAgeSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyOrigin: "NONE" | "OPERATOR_DEFINED_LOCAL_REJECTION";
                policyRejected: boolean;
                verifiedHeartbeatSeconds: string | null;
                upstreamFreshnessGuaranteeSeconds: string | null;
                timestampMeaning: "UNKNOWN" | "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                onchainExpiryEnforced: boolean | null;
                timingConfigurationFingerprint: string | null;
                anomalies: ("ZERO_TIMESTAMP" | "FUTURE_TIMESTAMP" | "TIMESTAMP_REGRESSION" | "TIMESTAMP_MISMATCH")[];
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            independent: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                availability: "UNAVAILABLE" | "AVAILABLE" | "NOT_CONFIGURED";
                sourceId: string | null;
                eligible: boolean;
                reasons: string[];
                toleranceBps: number | null;
                morphoPrice: string | null;
                independentPrice: string | null;
                candidate: {
                    id: string;
                    availability: "UNAVAILABLE" | "AVAILABLE";
                    base: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    quote: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    kind: "MARKET_PRICE" | "REDEMPTION_RATE";
                    denomination: "WHOLE_QUOTE_PER_WHOLE_BASE" | "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    price: string | null;
                    decimals: number;
                    timestamp: string | null;
                    frequencySeconds: string | null;
                    operatorId: string | null;
                    upstreamId: string | null;
                    proofs: {
                        claim: "ASSET" | "QUOTE" | "DENOMINATION" | "TIMESTAMP" | "FREQUENCY" | "OPERATOR" | "PROVENANCE" | "INDEPENDENCE";
                        evidence: {
                            subjectAddress: string;
                            chainId: number;
                            source: string;
                            sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                            block: {
                                number: string;
                                hash: string;
                                timestamp: string;
                            } | null;
                            retrievedAt: string;
                            method: string;
                            artifactSha256: string | null;
                            confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                            unresolved: string[];
                        };
                    }[];
                } | null;
                selectedUpstreamId: string | null;
                base: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                quote: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                evidenceMode: "FIXTURE" | "PRODUCTION";
                blockTimestamp: string | null;
                selectedTimestamp: string | null;
                candidateAgeSeconds: string | null;
                timestampSkewSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyMaxSkewSeconds: string | null;
                normalizedMorpho: {
                    numerator: string;
                    denominator: string;
                } | null;
                normalizedIndependent: {
                    numerator: string;
                    denominator: string;
                } | null;
                deviationBps: string | null;
                disagrees: boolean;
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            findings: {
                id: string;
                subjectAddress: string;
                statement: string;
                classification: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
                unresolved: string[];
            }[];
            limitations: string[];
            providerIndependence: "RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT";
        } | undefined;
    } | null;
    current: {
        cycleId: string;
        observedAt: string;
        accepted: boolean;
        risk: {
            chainId: 1672;
            account: `0x${string}`;
            marketId: `0x${string}`;
            protocol: "Morpho Blue";
            morphoAddress: `0x${string}`;
            oracleAddress: `0x${string}`;
            accountRole: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET" | "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
            calculationVersion: "1.0.0";
            evidenceKind: "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE" | null;
            mathematicalRiskState: "NO_DEBT" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY" | null;
            effectiveRiskState: "NO_DEBT" | "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY";
            dataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2DataQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            phase2OracleQuality: "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
            oracleVerification: "UNVERIFIED";
            heartbeat: "UNKNOWN";
            actionable: false;
            actionability: "BLOCKED" | "INDICATIVE_ONLY";
            safetyRatio: string | null;
            ltv: string | null;
            ratioScale: string;
            debtAmount: string | null;
            collateralAmount: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            snapshotIdentifier: string | null;
            snapshotRetrievedAt: string | null;
            calculatedAt: string;
            temporalContext: "UNAVAILABLE" | "FIXTURE" | "LIVE_AS_OF_BLOCK" | "HISTORICAL";
            thresholds: {
                warningRatio: string;
                criticalRatio: string;
                targetRatio: string;
                liquidationBoundary: string;
            };
            repayment: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            additionalCollateral: {
                raw: string;
                formatted: string;
                tokenAddress: string;
                decimals: number;
                targetRatio: string;
                calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
                actionable: false;
                indicative: true;
                inputSnapshotIdentifier: string;
                blockNumber: string;
                blockHash: string;
                calculatedAt: string;
            } | null;
            recoveryEligibility?: {
                eligible: boolean;
                status: "ELIGIBLE" | "BLOCKED";
                reasonCodes: ("RECOVERY_POSITION_DATA_BLOCKED" | "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH" | "RECOVERY_CHAIN_PROGRESSION_UNKNOWN" | "RECOVERY_CHAIN_PROGRESSION_STALLED" | "RECOVERY_CHAIN_PROGRESSION_REGRESSED" | "RECOVERY_CHAIN_PROGRESSION_CONFLICT" | "RECOVERY_CHAIN_PROGRESSION_UNCHANGED" | "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED" | "RECOVERY_ASSURANCE_GATE_NOT_MET" | "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED" | "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED" | "RECOVERY_EVIDENCE_INVALIDATED" | "RECOVERY_TIMESTAMP_ANOMALY" | "RECOVERY_CONFIGURATION_MISMATCH")[];
            } | undefined;
        };
        diagnostics: ("BLOCK_TIMESTAMP_REGRESSION" | "RPC_UNAVAILABLE" | "MCP_UNAVAILABLE" | "RPC_INVALID" | "MCP_INVALID" | "SNAPSHOT_INVALID" | "SNAPSHOT_UNAVAILABLE" | "ORACLE_UNVERIFIED" | "ORACLE_DATA_UNAVAILABLE" | "ORACLE_DATA_INVALID" | "ORACLE_FRESHNESS_UNKNOWN" | "FRESHNESS_UNDETERMINED" | "MONITOR_MODE_MISMATCH" | "PROCESS_INTERRUPTED" | "RISK_CALCULATION_FAILED" | "BLOCK_REGRESSION")[];
        progression?: {
            state: "UNKNOWN" | "ADVANCING" | "UNCHANGED_WITHIN_WINDOW" | "STALLED" | "REGRESSED" | "CONFLICT";
            reason: "FIRST_OBSERVATION" | "NO_SNAPSHOT_EVIDENCE" | "MISSING_PROVIDER_HEAD" | "CHAIN_ID_MISMATCH" | "PROVIDER_HEAD_BELOW_SELECTED_BLOCK" | "INVALID_BLOCK_EVIDENCE" | "PROVIDER_HEAD_REGRESSION" | "BLOCK_NUMBER_REGRESSION" | "BLOCK_TIMESTAMP_REGRESSION" | "SAME_HEIGHT_HASH_CONFLICT" | "SAME_BLOCK_RE_READ" | "STALL_WINDOW_EXCEEDED" | "STRICT_ADVANCE" | null;
            advancedBlocks: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            headNumber: string | null;
            baselineBlockNumber: string | null;
            baselineBlockHash: string | null;
            sameBlockStreak: number;
            evaluatedAt: string;
        } | undefined;
        assurance?: {
            schemaVersion: 1;
            policyVersion: "oracle-assurance-v1";
            chainId: 1672;
            marketId: `0x${string}`;
            oracleAddress: `0x${string}`;
            evaluatedAt: string;
            retrievedAt: string | null;
            evidenceKind: "UNAVAILABLE" | "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE";
            continuityScope: string;
            baseline: {
                block: {
                    number: string;
                    hash: string;
                    timestamp: string;
                };
                retrievedAt: string;
                snapshotIdentifier: string;
                configuration: {
                    oracle: string;
                    feed: string;
                    cache: string | null;
                    forwarder: string | null;
                    feedId: string | null;
                    proxyOwner: string | null;
                    cacheOwner: string | null;
                    forwarderOwner: string | null;
                    allowedWorkflowOwner: string | null;
                    proxyImplementation: string | null;
                    proxyAdmin: string | null;
                    proxyBeacon: string | null;
                    oracleRuntime: string | null;
                    proxyRuntime: string | null;
                    cacheRuntime: string | null;
                    forwarderRuntime: string | null;
                    compositionHash: string | null;
                    signerConfigurationHash: string | null;
                    workflowConfigurationHash: string | null;
                    collateralToken: string | null;
                    loanToken: string | null;
                    collateralDecimals: number | null;
                    loanDecimals: number | null;
                    feedDecimals: number | null;
                    denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                    descriptionHash: string | null;
                    signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
                };
                configurationFingerprint: string;
                observationTimestamp: string | null;
            } | null;
            block: {
                number: string;
                hash: string;
                timestamp: string;
            } | null;
            snapshotIdentifier: string | null;
            overall: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
            actionable: false;
            gate: "DATA_UNVERIFIED" | "DATA_INVALID" | "DATA_UNAVAILABLE" | "ASSURANCE_REQUIREMENTS_MET";
            dimensions: {
                CONTRACT_IDENTITY: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                SOURCE_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                OPERATOR_PROVENANCE: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                PRICE_SEMANTICS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                FRESHNESS: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                INDEPENDENT_VALIDATION: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
                CONFIGURATION_CONTROL: {
                    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                    rule: string;
                    satisfied: string[];
                    missing: string[];
                    findingIds: string[];
                };
            };
            configuration: {
                oracle: string;
                feed: string;
                cache: string | null;
                forwarder: string | null;
                feedId: string | null;
                proxyOwner: string | null;
                cacheOwner: string | null;
                forwarderOwner: string | null;
                allowedWorkflowOwner: string | null;
                proxyImplementation: string | null;
                proxyAdmin: string | null;
                proxyBeacon: string | null;
                oracleRuntime: string | null;
                proxyRuntime: string | null;
                cacheRuntime: string | null;
                forwarderRuntime: string | null;
                compositionHash: string | null;
                signerConfigurationHash: string | null;
                workflowConfigurationHash: string | null;
                collateralToken: string | null;
                loanToken: string | null;
                collateralDecimals: number | null;
                loanDecimals: number | null;
                feedDecimals: number | null;
                denomination: "ECONOMIC_QUOTE_UNVERIFIED";
                descriptionHash: string | null;
                signerCoverage: "UNOBSERVED" | "SAMPLED_ACTIVE_CONFIGS" | "COMPLETE";
            } | null;
            configurationFingerprint: string | null;
            changes: ("ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED")[];
            evidenceInvalidated: boolean;
            invalidatedAt: string | null;
            invalidationReason: "CONFIGURATION_CHANGE" | "OBSERVABILITY_GAP" | null;
            freshness: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                observationTimestamp: string | null;
                observationAgeSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyOrigin: "NONE" | "OPERATOR_DEFINED_LOCAL_REJECTION";
                policyRejected: boolean;
                verifiedHeartbeatSeconds: string | null;
                upstreamFreshnessGuaranteeSeconds: string | null;
                timestampMeaning: "UNKNOWN" | "WORKFLOW_SUPPLIED_OBSERVATION_TIME";
                onchainExpiryEnforced: boolean | null;
                timingConfigurationFingerprint: string | null;
                anomalies: ("ZERO_TIMESTAMP" | "FUTURE_TIMESTAMP" | "TIMESTAMP_REGRESSION" | "TIMESTAMP_MISMATCH")[];
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            independent: {
                state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
                availability: "UNAVAILABLE" | "AVAILABLE" | "NOT_CONFIGURED";
                sourceId: string | null;
                eligible: boolean;
                reasons: string[];
                toleranceBps: number | null;
                morphoPrice: string | null;
                independentPrice: string | null;
                candidate: {
                    id: string;
                    availability: "UNAVAILABLE" | "AVAILABLE";
                    base: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    quote: {
                        chainId: number;
                        address: string;
                        decimals: number;
                    };
                    kind: "MARKET_PRICE" | "REDEMPTION_RATE";
                    denomination: "WHOLE_QUOTE_PER_WHOLE_BASE" | "QUOTE_BASE_UNITS_PER_BASE_UNIT";
                    price: string | null;
                    decimals: number;
                    timestamp: string | null;
                    frequencySeconds: string | null;
                    operatorId: string | null;
                    upstreamId: string | null;
                    proofs: {
                        claim: "ASSET" | "QUOTE" | "DENOMINATION" | "TIMESTAMP" | "FREQUENCY" | "OPERATOR" | "PROVENANCE" | "INDEPENDENCE";
                        evidence: {
                            subjectAddress: string;
                            chainId: number;
                            source: string;
                            sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                            block: {
                                number: string;
                                hash: string;
                                timestamp: string;
                            } | null;
                            retrievedAt: string;
                            method: string;
                            artifactSha256: string | null;
                            confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                            unresolved: string[];
                        };
                    }[];
                } | null;
                selectedUpstreamId: string | null;
                base: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                quote: {
                    chainId: number;
                    address: string;
                    decimals: number;
                };
                evidenceMode: "FIXTURE" | "PRODUCTION";
                blockTimestamp: string | null;
                selectedTimestamp: string | null;
                candidateAgeSeconds: string | null;
                timestampSkewSeconds: string | null;
                policyMaxAgeSeconds: string | null;
                policyMaxSkewSeconds: string | null;
                normalizedMorpho: {
                    numerator: string;
                    denominator: string;
                } | null;
                normalizedIndependent: {
                    numerator: string;
                    denominator: string;
                } | null;
                deviationBps: string | null;
                disagrees: boolean;
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
            };
            findings: {
                id: string;
                subjectAddress: string;
                statement: string;
                classification: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                evidence: {
                    subjectAddress: string;
                    chainId: number;
                    source: string;
                    sourceKind: "FIXTURE" | "SNAPSHOT" | "RPC" | "MCP" | "VERIFIED_SOURCE" | "COMPILER" | "OFFICIAL_DOCUMENT" | "RESEARCH" | "LOCAL_POLICY";
                    block: {
                        number: string;
                        hash: string;
                        timestamp: string;
                    } | null;
                    retrievedAt: string;
                    method: string;
                    artifactSha256: string | null;
                    confidence: "UNKNOWN" | "PROVEN" | "INTERPRETATION";
                    unresolved: string[];
                }[];
                unresolved: string[];
            }[];
            limitations: string[];
            providerIndependence: "RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT";
        } | undefined;
    };
    suggestedAction: {
        type: "NON_FINANCIAL";
        financialOptions: [];
        schemaVersion: 1;
        origin: "GENERATED" | "LEGACY_DERIVED";
        instruction: string;
        rationale: "STRICT_RECOVERY_ELIGIBILITY_PASSED" | "POSITION_REQUIRES_REVIEW" | "DATA_REQUIRES_REFRESH" | "ORACLE_REQUIRES_VERIFICATION" | "CONTINUE_MONITORING" | "LEGACY_ALERT_WITHOUT_PERSISTED_ACTION";
        createdAt: string;
        evidence: {
            status: "QUALIFIED_FINANCIAL" | "NOT_QUALIFIED" | "LEGACY_UNAVAILABLE";
            cycleId: string | null;
            chainId: 1672 | null;
            account: string | null;
            marketId: string | null;
            snapshotIdentifier: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            progressionState: "UNKNOWN" | "ADVANCING" | "UNCHANGED_WITHIN_WINDOW" | "STALLED" | "REGRESSED" | "CONFLICT" | null;
            progressionReason: "FIRST_OBSERVATION" | "NO_SNAPSHOT_EVIDENCE" | "MISSING_PROVIDER_HEAD" | "CHAIN_ID_MISMATCH" | "PROVIDER_HEAD_BELOW_SELECTED_BLOCK" | "INVALID_BLOCK_EVIDENCE" | "PROVIDER_HEAD_REGRESSION" | "BLOCK_NUMBER_REGRESSION" | "BLOCK_TIMESTAMP_REGRESSION" | "SAME_HEIGHT_HASH_CONFLICT" | "SAME_BLOCK_RE_READ" | "STALL_WINDOW_EXCEEDED" | "STRICT_ADVANCE" | null;
            oracleAssurance: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            oracleFreshness: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            independentValidation: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            evidenceInvalidated: boolean | null;
            oracleObservationTimestamp: string | null;
            timestampAnomalies: ("ZERO_TIMESTAMP" | "FUTURE_TIMESTAMP" | "TIMESTAMP_REGRESSION" | "TIMESTAMP_MISMATCH")[];
            configurationChanges: ("ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED")[];
            recoveryEligibility: {
                eligible: boolean;
                status: "ELIGIBLE" | "BLOCKED";
                reasonCodes: ("RECOVERY_POSITION_DATA_BLOCKED" | "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH" | "RECOVERY_CHAIN_PROGRESSION_UNKNOWN" | "RECOVERY_CHAIN_PROGRESSION_STALLED" | "RECOVERY_CHAIN_PROGRESSION_REGRESSED" | "RECOVERY_CHAIN_PROGRESSION_CONFLICT" | "RECOVERY_CHAIN_PROGRESSION_UNCHANGED" | "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED" | "RECOVERY_ASSURANCE_GATE_NOT_MET" | "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED" | "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED" | "RECOVERY_EVIDENCE_INVALIDATED" | "RECOVERY_TIMESTAMP_ANOMALY" | "RECOVERY_CONFIGURATION_MISMATCH")[];
            } | null;
        };
        actionable: false;
    } | {
        type: "FINANCIAL_OPTION";
        financialOptions: {
            type: "REPAY" | "ADD_COLLATERAL";
            amountRaw: string;
            amountFormatted: string;
            assetAddress: string;
            assetDecimals: number;
            chainId: 1672;
            account: string;
            marketId: string;
            targetRatio: string;
            calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint" | "morpho-v1.0.0/nested-ceilings/forward-minimality-proof";
            snapshotIdentifier: string;
            blockNumber: string;
            blockHash: string;
            calculatedAt: string;
            oracleObservationTimestamp: string;
            freshness: "VERIFIED";
            condition: "REFRESH_AND_SIMULATE_BEFORE_ANY_TRANSACTION";
            actionable: false;
        }[];
        schemaVersion: 1;
        origin: "GENERATED" | "LEGACY_DERIVED";
        instruction: string;
        rationale: "STRICT_RECOVERY_ELIGIBILITY_PASSED" | "POSITION_REQUIRES_REVIEW" | "DATA_REQUIRES_REFRESH" | "ORACLE_REQUIRES_VERIFICATION" | "CONTINUE_MONITORING" | "LEGACY_ALERT_WITHOUT_PERSISTED_ACTION";
        createdAt: string;
        evidence: {
            status: "QUALIFIED_FINANCIAL" | "NOT_QUALIFIED" | "LEGACY_UNAVAILABLE";
            cycleId: string | null;
            chainId: 1672 | null;
            account: string | null;
            marketId: string | null;
            snapshotIdentifier: string | null;
            blockNumber: string | null;
            blockHash: string | null;
            blockTimestamp: string | null;
            progressionState: "UNKNOWN" | "ADVANCING" | "UNCHANGED_WITHIN_WINDOW" | "STALLED" | "REGRESSED" | "CONFLICT" | null;
            progressionReason: "FIRST_OBSERVATION" | "NO_SNAPSHOT_EVIDENCE" | "MISSING_PROVIDER_HEAD" | "CHAIN_ID_MISMATCH" | "PROVIDER_HEAD_BELOW_SELECTED_BLOCK" | "INVALID_BLOCK_EVIDENCE" | "PROVIDER_HEAD_REGRESSION" | "BLOCK_NUMBER_REGRESSION" | "BLOCK_TIMESTAMP_REGRESSION" | "SAME_HEIGHT_HASH_CONFLICT" | "SAME_BLOCK_RE_READ" | "STALL_WINDOW_EXCEEDED" | "STRICT_ADVANCE" | null;
            oracleAssurance: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            oracleFreshness: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            independentValidation: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED" | null;
            evidenceInvalidated: boolean | null;
            oracleObservationTimestamp: string | null;
            timestampAnomalies: ("ZERO_TIMESTAMP" | "FUTURE_TIMESTAMP" | "TIMESTAMP_REGRESSION" | "TIMESTAMP_MISMATCH")[];
            configurationChanges: ("ORACLE_CONFIGURATION_CHANGED" | "PROXY_IMPLEMENTATION_CHANGED" | "ORACLE_OWNER_CHANGED" | "ORACLE_FEED_ID_CHANGED" | "ORACLE_SIGNER_CONFIGURATION_CHANGED" | "ORACLE_DENOMINATION_CHANGED")[];
            recoveryEligibility: {
                eligible: boolean;
                status: "ELIGIBLE" | "BLOCKED";
                reasonCodes: ("RECOVERY_POSITION_DATA_BLOCKED" | "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH" | "RECOVERY_CHAIN_PROGRESSION_UNKNOWN" | "RECOVERY_CHAIN_PROGRESSION_STALLED" | "RECOVERY_CHAIN_PROGRESSION_REGRESSED" | "RECOVERY_CHAIN_PROGRESSION_CONFLICT" | "RECOVERY_CHAIN_PROGRESSION_UNCHANGED" | "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED" | "RECOVERY_ASSURANCE_GATE_NOT_MET" | "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED" | "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED" | "RECOVERY_EVIDENCE_INVALIDATED" | "RECOVERY_TIMESTAMP_ANOMALY" | "RECOVERY_CONFIGURATION_MISMATCH")[];
            } | null;
        };
        actionable: false;
    };
}>>;
export type RiskView = z.infer<typeof riskViewSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type MonitorState = z.infer<typeof stateSchema>;
export type Alert = z.infer<typeof alertSchema>;
export type Diagnostic = z.infer<typeof diagnosticSchema>;
export type Progression = PersistedProgression;
export type Channel = "console" | "telegram" | "discord";
export declare const channelSchema: z.ZodEnum<{
    telegram: "telegram";
    discord: "discord";
    console: "console";
}>;
export declare const hashParts: (parts: unknown) => string;
export declare function monitoringScope(thresholds: ThresholdConfiguration, block?: bigint, position?: PositionConfiguration): string;
export declare function initialState(): MonitorState;
export declare function riskView(result: RiskResult): RiskView;
