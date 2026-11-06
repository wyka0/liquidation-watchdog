import { z } from "zod";
export declare const DIMENSIONS: readonly ["CONTRACT_IDENTITY", "SOURCE_PROVENANCE", "OPERATOR_PROVENANCE", "PRICE_SEMANTICS", "FRESHNESS", "INDEPENDENT_VALIDATION", "CONFIGURATION_CONTROL"];
export declare const assuranceStateSchema: z.ZodEnum<{
    UNVERIFIED: "UNVERIFIED";
    VERIFIED: "VERIFIED";
    PARTIALLY_VERIFIED: "PARTIALLY_VERIFIED";
    UNKNOWN: "UNKNOWN";
    FAILED: "FAILED";
}>;
export type AssuranceState = z.infer<typeof assuranceStateSchema>;
export declare const unsignedSchema: z.ZodString;
export declare const digestSchema: z.ZodString;
export declare const address: z.ZodString;
export declare const hash: z.ZodString;
export declare const blockRefSchema: z.ZodObject<{
    number: z.ZodString;
    hash: z.ZodString;
    timestamp: z.ZodString;
}, z.core.$strict>;
export declare const evidenceRefSchema: z.ZodObject<{
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
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export declare const findingSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type AssuranceFinding = z.infer<typeof findingSchema>;
export declare const dimensionSchema: z.ZodObject<{
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
export declare const configurationSchema: z.ZodObject<{
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
export type OracleConfiguration = z.infer<typeof configurationSchema>;
export declare const configurationDigest: (value: OracleConfiguration) => string;
export declare const continuityScopeSchema: z.ZodString;
export declare const configurationBaselineSchema: z.ZodObject<{
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
}, z.core.$strict>;
export declare const changeCodeSchema: z.ZodEnum<{
    ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
    PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
    ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
    ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
    ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
    ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
}>;
export type ConfigurationChange = z.infer<typeof changeCodeSchema>;
export declare const timestampAnomalySchema: z.ZodEnum<{
    ZERO_TIMESTAMP: "ZERO_TIMESTAMP";
    FUTURE_TIMESTAMP: "FUTURE_TIMESTAMP";
    TIMESTAMP_REGRESSION: "TIMESTAMP_REGRESSION";
    TIMESTAMP_MISMATCH: "TIMESTAMP_MISMATCH";
}>;
export declare const freshnessSchema: z.ZodObject<{
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
export type FreshnessResult = z.infer<typeof freshnessSchema>;
export declare const independentAssetSchema: z.ZodObject<{
    chainId: z.ZodNumber;
    address: z.ZodString;
    decimals: z.ZodNumber;
}, z.core.$strict>;
export declare const INDEPENDENT_PROOFS: readonly ["ASSET", "QUOTE", "DENOMINATION", "TIMESTAMP", "FREQUENCY", "OPERATOR", "PROVENANCE", "INDEPENDENCE"];
export declare const candidateSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type IndependentCandidate = z.infer<typeof candidateSchema>;
export declare const sameIndependentAsset: (a: z.infer<typeof independentAssetSchema>, b: z.infer<typeof independentAssetSchema>) => boolean;
export declare function missingIndependentProofs(source: IndependentCandidate, fixture: boolean): string[];
export declare const independentSchema: z.ZodObject<{
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
export type IndependentResult = z.infer<typeof independentSchema>;
export declare const assuranceSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type OracleAssurance = z.infer<typeof assuranceSchema>;
/** Diagnostics never persist remote error bodies or secret-bearing URLs. */
export declare function redactPublicText(value: string): string;
