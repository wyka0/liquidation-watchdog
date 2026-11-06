import { z } from "zod";
import type { ReadSnapshot, SnapshotPage, SnapshotReader } from "../persistence.js";
import type { PgConnection, Sql } from "./connection.js";
export declare const cycleRowSchema: z.ZodObject<{
    id: z.ZodString;
    scope: z.ZodString;
    started_at: z.ZodISODateTime;
    status: z.ZodEnum<{
        RUNNING: "RUNNING";
        PERSISTED: "PERSISTED";
        COMPLETED: "COMPLETED";
        INTERRUPTED: "INTERRUPTED";
    }>;
    completed_at: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strip>;
export interface Fence {
    owner: string;
    fence: string;
    incarnation: string;
    executionId: string;
    cycleId: string;
    slot: string;
    missedSlots: number;
}
export declare function loadState(sql: Sql, scope: string): Promise<{
    revision: number;
    latest: {
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
    lastAccepted: {
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
    consecutiveFailures: number;
    episodes: {
        risk: number;
        data: number;
        oracle: number;
        failures: number;
        assurance?: number | undefined;
    };
    lastCriticalAlertAt: string | null;
    assuranceBaseline?: {
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
}>;
export declare function loadAssurance(sql: Sql, context?: string): Promise<{
    id: string;
    assurance: {
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
    };
    bundlePath: string | null;
    manifestSha256: string | null;
} | null>;
export declare function assertFence(sql: Sql, fence: Fence, completion?: boolean): Promise<void>;
export declare class PostgresDatabase implements SnapshotReader {
    readonly writer: PgConnection;
    readonly reader: PgConnection;
    readonly namespace: string;
    private readonly catalogFingerprint;
    /** The optional catalog binding is dependency injection for administrator-controlled local fixtures only. */
    constructor(writer: PgConnection, reader: PgConnection, namespace: string, catalogFingerprint?: string);
    verifySchema(sql: Sql): Promise<string>;
    verifyRole(sql: Sql, readOnly: boolean): Promise<void>;
    write<T>(fence: Fence, operation: (sql: Sql) => Promise<T>, signal?: AbortSignal): Promise<T>;
    readSnapshot(scope: string, page?: SnapshotPage): Promise<ReadSnapshot>;
    close(): Promise<void>;
}
