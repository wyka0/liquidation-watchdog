import { z } from "zod";
import type { Alert, Channel, MonitorState, Observation } from "../monitoring/model.js";
import type { DeliveryResult } from "../notifications/types.js";
import type { OracleAssurance } from "../oracle-assurance/model.js";
import type { ResourceLimits } from "../config/monitoring.js";
import type { WorkerRuntime } from "../operations/model.js";
export declare const deliverySchema: z.ZodObject<{
    id: z.ZodString;
    alert_id: z.ZodString;
    channel: z.ZodEnum<{
        telegram: "telegram";
        discord: "discord";
        console: "console";
    }>;
    status: z.ZodEnum<{
        FAILED: "FAILED";
        PENDING: "PENDING";
        IN_FLIGHT: "IN_FLIGHT";
        DELIVERED: "DELIVERED";
        RETRY_SCHEDULED: "RETRY_SCHEDULED";
        PERMANENTLY_FAILED: "PERMANENTLY_FAILED";
    }>;
    attempts: z.ZodNumber;
    next_at: z.ZodISODateTime;
    last_error: z.ZodNullable<z.ZodEnum<{
        TRANSPORT_ERROR: "TRANSPORT_ERROR";
        PROVIDER_HTTP_ERROR: "PROVIDER_HTTP_ERROR";
        PROVIDER_REJECTED: "PROVIDER_REJECTED";
        PROVIDER_RESPONSE_INVALID: "PROVIDER_RESPONSE_INVALID";
        PROVIDER_RATE_LIMIT: "PROVIDER_RATE_LIMIT";
        PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT";
        ATTEMPT_INTERRUPTED: "ATTEMPT_INTERRUPTED";
        CONSOLE_ERROR: "CONSOLE_ERROR";
        ADAPTER_ERROR: "ADAPTER_ERROR";
        RETRY_EXHAUSTED: "RETRY_EXHAUSTED";
    }>>;
    ambiguous: z.ZodUnion<readonly [z.ZodLiteral<0>, z.ZodLiteral<1>]>;
}, z.core.$strip>;
export type Delivery = z.infer<typeof deliverySchema>;
declare const cycleRowSchema: z.ZodObject<{
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
type CycleRow = z.infer<typeof cycleRowSchema>;
export declare class MonitorStore {
    private readonly db;
    private readonly path;
    private lock;
    private owned;
    private closed;
    readonly schemaVersion: number;
    private readonly readOnly;
    private readonly limits;
    constructor(path: string, options?: {
        readOnly?: boolean;
        allowLegacy?: boolean;
        existingOnly?: boolean;
        limits?: ResourceLimits;
    });
    private transaction;
    /** A separate SQLite OS lock permits status readers and is released by the OS on process death. */
    private lockFile;
    acquireMonitor(): void;
    private requireWriter;
    close(): void;
    get storagePath(): string;
    state(scope: string): MonitorState;
    beginCycle(id: string, scope: string, startedAt: string): void;
    commitObservation(scope: string, observation: Observation, previousRevision: number, state: MonitorState, candidates: Alert[], channels: Channel[]): Alert[];
    finishCycle(id: string, completedAt: string, interrupted?: boolean): void;
    private insertOracleAssurance;
    saveOracleAssurance(id: string, result: OracleAssurance, bundle?: {
        path: string;
        manifestSha256: string;
    }): void;
    latestOracleAssurance(context?: string): {
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
    } | null;
    unfinishedCycles(scope: string): CycleRow[];
    latestCycle(scope: string, acceptedOnly?: boolean): CycleRow | null;
    alerts(limit?: number, scope?: string): Alert[];
    alert(id: string): Alert;
    deliveries(): Delivery[];
    deliveriesForAlerts(ids: readonly string[]): Delivery[];
    deliveryCounts(): Record<Delivery["status"], number>;
    pendingCount(): number;
    providerLimits(): {
        channel: "telegram" | "discord" | "console";
        next_at: string;
        blocked: 0 | 1;
    }[];
    due(now: string, channels: readonly Channel[], limit?: number): Delivery[];
    nextDeliveryAt(channels: readonly Channel[]): string | null;
    private event;
    startAttempt(id: string, now: string): Delivery;
    finishAttempt(id: string, result: DeliveryResult, now: string, retryAt: string | null): Delivery["status"];
    recoverDeliveries(now: string, maxAttempts: number): number;
    exhaust(id: string, now: string): void;
    attempts(id: string): unknown[];
    prune(now: string, cycleDays: number, alertDays: number): void;
    summary(scope: string): {
        schemaVersion: number;
        latestCycle: {
            id: string;
            scope: string;
            started_at: string;
            status: "RUNNING" | "PERSISTED" | "COMPLETED" | "INTERRUPTED";
            completed_at: string | null;
        } | null;
        lastAcceptedCycle: {
            id: string;
            scope: string;
            started_at: string;
            status: "RUNNING" | "PERSISTED" | "COMPLETED" | "INTERRUPTED";
            completed_at: string | null;
        } | null;
        state: {
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
        };
        providerLimits: {
            channel: "telegram" | "discord" | "console";
            next_at: string;
            blocked: 0 | 1;
        }[];
        deliveryCounts: Record<"FAILED" | "PENDING" | "IN_FLIGHT" | "DELIVERED" | "RETRY_SCHEDULED" | "PERMANENTLY_FAILED", number>;
    };
    /** One short, read-only snapshot for the HTTP read model. No arbitrary SQL or write callback. */
    readSnapshot(scope: string, page?: {
        kind: "alerts" | "observations";
        limit: number;
        before?: number;
    }): {
        state: {
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
        };
        runtime: {
            runId: string;
            scope: string;
            pid: number;
            startedAt: string;
            updatedAt: string;
            rssBytes: number;
            status: "FAILED" | "STARTING" | "READING" | "DELIVERING" | "IDLE" | "STOPPED";
            error: "READ_CANCELLED" | "RESOURCE_EVIDENCE_LIMIT" | "STORE_CORRUPT" | "CYCLE_TIMEOUT" | "SHUTDOWN_TIMEOUT" | "STORE_TRANSACTION_FAILED" | "STORE_OPEN_FAILED" | "RESOURCE_DATABASE_LIMIT" | "RESOURCE_WAL_LIMIT" | "RESOURCE_DISK_RESERVE" | "RESOURCE_BACKLOG_LIMIT" | "RESOURCE_MEMORY_LIMIT" | "RESOURCE_CHECK_FAILED" | "WORKER_FAILED" | null;
        } | null;
        latestCycle: {
            id: string;
            scope: string;
            started_at: string;
            status: "RUNNING" | "PERSISTED" | "COMPLETED" | "INTERRUPTED";
            completed_at: string | null;
        } | null;
        alerts: {
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
        }[];
        observations: {
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
        }[];
        deliveries: {
            id: string;
            alert_id: string;
            channel: "telegram" | "discord" | "console";
            status: "FAILED" | "PENDING" | "IN_FLIGHT" | "DELIVERED" | "RETRY_SCHEDULED" | "PERMANENTLY_FAILED";
            attempts: number;
            next_at: string;
            last_error: "TRANSPORT_ERROR" | "PROVIDER_HTTP_ERROR" | "PROVIDER_REJECTED" | "PROVIDER_RESPONSE_INVALID" | "PROVIDER_RATE_LIMIT" | "PROVIDER_TIMEOUT" | "ATTEMPT_INTERRUPTED" | "CONSOLE_ERROR" | "ADAPTER_ERROR" | "RETRY_EXHAUSTED" | null;
            ambiguous: 0 | 1;
        }[];
        nextCursor: string | null;
    };
    runtime(): WorkerRuntime | null;
    saveRuntime(input: WorkerRuntime): void;
    recentFailures(): {
        occurred_at: string;
        code: "READ_CANCELLED" | "RESOURCE_EVIDENCE_LIMIT" | "STORE_CORRUPT" | "CYCLE_TIMEOUT" | "SHUTDOWN_TIMEOUT" | "STORE_TRANSACTION_FAILED" | "STORE_OPEN_FAILED" | "RESOURCE_DATABASE_LIMIT" | "RESOURCE_WAL_LIMIT" | "RESOURCE_DISK_RESERVE" | "RESOURCE_BACKLOG_LIMIT" | "RESOURCE_MEMORY_LIMIT" | "RESOURCE_CHECK_FAILED" | "WORKER_FAILED";
    }[];
    ownership(): "HELD" | "AVAILABLE" | "UNKNOWN";
    statistics(): {
        schemaVersion: number;
        sqliteVersion: string;
        pageSize: number;
        pageCount: number;
        freePages: number;
        journalMode: string;
        foreignKeys: boolean;
        connectionReadOnly: boolean;
        connectionSynchronous: number;
        pendingDeliveries: number;
        counts: {
            [k: string]: number;
        };
    };
    private presentTables;
    evidenceBundles(): {
        path: string;
        manifestSha256: string;
    }[];
    localEvidenceReferences(): {
        path: string;
        sha256: string;
    }[];
    knownDeliveredHash(): string;
    /** Incremental hashes avoid loading the outbox/history into JS memory. SQL order is deterministic. */
    contentHashes(): Record<string, string>;
    validateAll(): void;
    backupTo(path: string): Promise<number>;
}
export {};
