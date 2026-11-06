import { DataError } from "../domain/errors.js";
import { DEPLOYMENT, NETWORK } from "../config/deployment.js";
import { digestSchema, evidenceRefSchema, freshnessSchema } from "./model.js";
export function analyzeFreshness(input) {
    const local = input.localMaxAgeSeconds ?? null;
    if (local !== null && (local <= 0n || local >= 10n ** 78n))
        throw new DataError("FRESHNESS_POLICY", "A local maximum age must be a positive bounded integer, with no implicit default.");
    const timing = (value) => {
        if (!value)
            return null;
        const ref = evidenceRefSchema.parse(value.evidence);
        if (value.seconds <= 0n || value.configurationFingerprint !== input.configurationFingerprint || !digestSchema.safeParse(value.configurationFingerprint).success || ref.confidence !== "PROVEN"
            || ref.chainId !== NETWORK.chainId || ref.subjectAddress.toLowerCase() !== DEPLOYMENT.feed.toLowerCase()
            || !["VERIFIED_SOURCE", "OFFICIAL_DOCUMENT"].includes(ref.sourceKind) || ref.artifactSha256 === null) {
            throw new DataError("FRESHNESS_EVIDENCE", "Official timing parameters require verified, hashed, configuration-bound evidence.");
        }
        return value.seconds;
    };
    const heartbeat = timing(input.verifiedHeartbeat), guarantee = timing(input.upstreamGuarantee);
    const timestamp = input.observationTimestamp, block = input.blockTimestamp;
    const age = timestamp === null || block === null ? null : block - timestamp;
    const anomalies = [];
    if (timestamp === 0n)
        anomalies.push("ZERO_TIMESTAMP");
    if (age !== null && age < 0n)
        anomalies.push("FUTURE_TIMESTAMP");
    if (timestamp !== null && input.previousTimestamp != null && timestamp < input.previousTimestamp)
        anomalies.push("TIMESTAMP_REGRESSION");
    if (timestamp !== null && ((input.startedAt != null && input.startedAt !== timestamp) || (input.cacheTimestamp != null && input.cacheTimestamp !== timestamp)))
        anomalies.push("TIMESTAMP_MISMATCH");
    const rejected = age !== null && local !== null && age > local;
    const expired = age !== null && guarantee !== null && age > guarantee;
    return freshnessSchema.parse({
        state: anomalies.length || rejected || expired ? "FAILED" : age !== null && input.semanticsVerified && heartbeat !== null && guarantee !== null ? "VERIFIED" : "UNKNOWN",
        observationTimestamp: timestamp?.toString() ?? null, observationAgeSeconds: age?.toString() ?? null,
        policyMaxAgeSeconds: local?.toString() ?? null, policyOrigin: local === null ? "NONE" : "OPERATOR_DEFINED_LOCAL_REJECTION", policyRejected: rejected,
        verifiedHeartbeatSeconds: heartbeat?.toString() ?? null, upstreamFreshnessGuaranteeSeconds: guarantee?.toString() ?? null,
        timestampMeaning: input.semanticsVerified ? "WORKFLOW_SUPPLIED_OBSERVATION_TIME" : "UNKNOWN", onchainExpiryEnforced: input.semanticsVerified ? false : null,
        timingConfigurationFingerprint: heartbeat !== null || guarantee !== null ? input.configurationFingerprint : null,
        anomalies, evidence: [...input.evidence, ...[input.verifiedHeartbeat?.evidence, input.upstreamGuarantee?.evidence].filter((ref) => ref !== undefined)]
    });
}
//# sourceMappingURL=freshness.js.map