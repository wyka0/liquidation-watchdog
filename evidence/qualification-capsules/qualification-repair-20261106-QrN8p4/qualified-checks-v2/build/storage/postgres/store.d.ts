import type { ResourceLimits } from "../../config/monitoring.js";
import type { Alert, Channel, MonitorState, Observation } from "../../monitoring/model.js";
import type { DeliveryResult } from "../../notifications/types.js";
import type { WorkerRuntime } from "../../operations/model.js";
import type { MonitoringPersistence } from "../persistence.js";
import type { Delivery } from "../store.js";
import type { Fence, PostgresDatabase } from "./database.js";
/** A job-scoped capability. Closing it revokes late continuations; the runtime owns the pools. */
export declare class PostgresMonitorStore implements MonitoringPersistence {
    private readonly db;
    private readonly fence;
    private readonly limits;
    private readonly caller?;
    private owned;
    private closed;
    private readonly cancellation;
    private readonly onCancel;
    constructor(db: PostgresDatabase, fence: Fence, limits: ResourceLimits, caller?: AbortSignal | undefined);
    acquireMonitor(): Promise<void>;
    private write;
    cancel(): void;
    close(): void;
    state(scope: string): Promise<MonitorState>;
    latestOracleAssurance(context?: string): Promise<{
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
    beginCycle(id: string, scope: string, startedAt: string): Promise<void>;
    unfinishedCycles(scope: string): Promise<{
        id: string;
        scope: string;
        started_at: string;
        status: "RUNNING" | "PERSISTED" | "COMPLETED" | "INTERRUPTED";
        completed_at: string | null;
    }[]>;
    commitObservation(scope: string, observation: Observation, previousRevision: number, state: MonitorState, candidates: Alert[], channels: Channel[]): Promise<Alert[]>;
    private insertAssurance;
    finishCycle(id: string, completedAt: string, interrupted?: boolean): Promise<void>;
    private event;
    due(now: string, channels: readonly Channel[], limit?: number): Promise<Delivery[]>;
    nextDeliveryAt(channels: readonly Channel[]): Promise<string | null>;
    alert(id: string): Promise<Alert>;
    startAttempt(id: string, now: string): Promise<Delivery>;
    finishAttempt(id: string, input: DeliveryResult, now: string, retryAt: string | null): Promise<Delivery["status"]>;
    recoverDeliveries(now: string, maxAttempts: number): Promise<number>;
    exhaust(id: string, now: string): Promise<void>;
    prune(now: string, cycleDays: number, alertDays: number): Promise<void>;
    saveRuntime(input: WorkerRuntime): Promise<void>;
    requireResources(limits: ResourceLimits): Promise<void>;
}
