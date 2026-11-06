import { DEPLOYMENT } from "../config/deployment.js";
import { DIMENSIONS, assuranceSchema } from "./model.js";
export function dependencyGraph(input) {
    const assurance = assuranceSchema.parse(input), config = assurance.configuration;
    return { chainId: assurance.chainId, block: assurance.block, retrievedAt: assurance.retrievedAt, snapshotIdentifier: assurance.snapshotIdentifier,
        edges: [
            { subjectAddress: DEPLOYMENT.morpho, from: assurance.marketId, to: config?.oracle ?? DEPLOYMENT.oracle, relationship: "MARKET_ORACLE", findingIds: ["DEPENDENCY_GRAPH", "RUNTIME_0"] },
            { subjectAddress: DEPLOYMENT.oracle, from: config?.oracle ?? DEPLOYMENT.oracle, to: config?.feed ?? DEPLOYMENT.feed, relationship: "BASE_FEED_1", findingIds: ["DEPENDENCY_GRAPH", "RUNTIME_1"] },
            { subjectAddress: DEPLOYMENT.feed, from: config?.feed ?? DEPLOYMENT.feed, to: config?.cache ?? null, relationship: "OWNER_CONFIGURABLE_CACHE_FACADE", findingIds: ["DEPENDENCY_GRAPH", "RUNTIME_2"] },
            { subjectAddress: DEPLOYMENT.cache, from: config?.cache ?? DEPLOYMENT.cache, to: config?.feedId ?? null, relationship: "SELECTED_CACHE_KEY", findingIds: ["SOURCE_PROVENANCE"] },
            { subjectAddress: DEPLOYMENT.cache, from: config?.cache ?? DEPLOYMENT.cache, to: config?.forwarder ?? null, relationship: "AUTHORIZED_REPORT_FORWARDER", findingIds: ["CONFIGURATION_CONTROL"] },
            { subjectAddress: config?.forwarder ?? DEPLOYMENT.cache, from: config?.forwarder ?? null, to: config?.signerConfigurationHash ?? null, relationship: "SAMPLED_SIGNER_CONFIGURATION_NOT_FULL_ENUMERATION", findingIds: ["CONFIGURATION_CONTROL", "OPERATOR_PROVENANCE"] },
            { subjectAddress: DEPLOYMENT.cache, from: config?.feedId ?? null, to: null, relationship: "ECONOMIC_SOURCE_UNRESOLVED", findingIds: ["SOURCE_PROVENANCE", "PRICE_SEMANTICS"] }
        ], confidence: "Edges are observations or runtime-bound interpretations as classified by their referenced findings; unresolved endpoints remain null." };
}
export function renderOracleStatus(input) {
    const result = assuranceSchema.parse(input);
    return [
        "Oracle assurance — Phase 4", `Overall: ${result.overall} | gate: ${result.gate} | actionable: false`,
        `Evidence: ${result.evidenceKind} | evaluated: ${result.evaluatedAt} | retrieved: ${result.retrievedAt ?? "UNKNOWN"}`,
        `Block: ${result.block?.number ?? "UNKNOWN"} | hash: ${result.block?.hash ?? "UNKNOWN"} | block timestamp: ${result.block?.timestamp ?? "UNKNOWN"}`,
        `Snapshot ID: ${result.snapshotIdentifier ?? "UNAVAILABLE"}`,
        ...(result.evidenceKind === "HISTORICAL_SNAPSHOT" ? ["HISTORICAL audit: this is not a current oracle assessment."] : []),
        ...DIMENSIONS.map(dimension => `${dimension}: ${result.dimensions[dimension].state}`),
        `OBSERVATION_AGE: ${result.freshness.observationAgeSeconds ?? "UNKNOWN"} seconds`,
        `POLICY_MAX_AGE: ${result.freshness.policyMaxAgeSeconds ?? "NONE"} (${result.freshness.policyOrigin}); rejected: ${result.freshness.policyRejected}`,
        `VERIFIED_HEARTBEAT: ${result.freshness.verifiedHeartbeatSeconds ?? "UNKNOWN"}`,
        `UPSTREAM_FRESHNESS_GUARANTEE: ${result.freshness.upstreamFreshnessGuaranteeSeconds ?? "UNKNOWN"}`,
        `Independent validation: ${result.independent.state}; eligible: ${result.independent.eligible}; no price substitution`,
        `Configuration fingerprint: ${result.configurationFingerprint ?? "UNKNOWN"}; evidence invalidated: ${result.evidenceInvalidated}`,
        "RPC/MCP share an upstream. Successful reads do not prove economic correctness or independence.",
        "All recovery estimates remain indicative and non-actionable.", ""
    ].join("\n");
}
//# sourceMappingURL=report.js.map