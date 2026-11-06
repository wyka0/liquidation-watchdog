import { describe, expect, it } from "vitest";
import { DEPLOYMENT } from "../src/config/deployment.js";
import { analyzeFreshness } from "../src/oracle-assurance/freshness.js";
import { freshnessSchema } from "../src/oracle-assurance/model.js";
import { REVIEWED_SOURCES } from "../src/oracle-assurance/reviewed.js";

const input = { blockTimestamp: 10_000n, observationTimestamp: 9_000n, startedAt: 9_000n, cacheTimestamp: 9_000n, semanticsVerified: true, evidence: [REVIEWED_SOURCES[0]!] };
const fingerprint = "a".repeat(64);
const timing = { seconds: 1_000n, configurationFingerprint: fingerprint, evidence: { ...REVIEWED_SOURCES[0]!, source: "fixture:official-timing", method: "Synthetic official timing claim for deterministic validation only." } };
describe("FIXTURE: observation age, local rejection policy and upstream guarantees", () => {
  it("does not manufacture heartbeat or freshness from a readable, recently updated cache", () => {
    expect(analyzeFreshness(input)).toMatchObject({ state: "UNKNOWN", observationAgeSeconds: "1000", verifiedHeartbeatSeconds: null,
      upstreamFreshnessGuaranteeSeconds: null, policyMaxAgeSeconds: null, onchainExpiryEnforced: false });
    expect(analyzeFreshness({ ...input, observationTimestamp: 10_000n, startedAt: 10_000n, cacheTimestamp: 10_000n }).state).toBe("UNKNOWN");
  });
  it("treats local policy equality as passing but not verifying, and rejects only above the limit", () => {
    expect(analyzeFreshness({ ...input, localMaxAgeSeconds: 1_000n })).toMatchObject({ state: "UNKNOWN", policyRejected: false, policyOrigin: "OPERATOR_DEFINED_LOCAL_REJECTION" });
    expect(analyzeFreshness({ ...input, localMaxAgeSeconds: 999n })).toMatchObject({ state: "FAILED", policyRejected: true, verifiedHeartbeatSeconds: null });
  });
  it.each([
    { observationTimestamp: 0n, expected: "ZERO_TIMESTAMP" }, { observationTimestamp: 10_001n, expected: "FUTURE_TIMESTAMP" },
    { previousTimestamp: 9_001n, expected: "TIMESTAMP_REGRESSION" }, { cacheTimestamp: 9_001n, expected: "TIMESTAMP_MISMATCH" },
    { startedAt: 8_999n, expected: "TIMESTAMP_MISMATCH" }
  ])("rejects $expected", ({ expected, ...change }) => {
    const result = analyzeFreshness({ ...input, ...change }); expect(result.state).toBe("FAILED"); expect(result.anomalies).toContain(expected);
  });
  it("allows equal successive observation timestamps without claiming a new observation", () => {
    expect(analyzeFreshness({ ...input, previousTimestamp: 9_000n })).toMatchObject({ state: "UNKNOWN", anomalies: [], observationAgeSeconds: "1000" });
  });
  it("requires both separately evidenced timing guarantees and current configuration binding", () => {
    expect(analyzeFreshness({ ...input, configurationFingerprint: fingerprint, verifiedHeartbeat: timing }).state).toBe("UNKNOWN");
    expect(analyzeFreshness({ ...input, configurationFingerprint: fingerprint, verifiedHeartbeat: timing, upstreamGuarantee: timing }).state).toBe("VERIFIED");
    expect(analyzeFreshness({ ...input, blockTimestamp: 10_001n, configurationFingerprint: fingerprint, verifiedHeartbeat: timing, upstreamGuarantee: timing }).state).toBe("FAILED");
  });
  it.each(["configuration", "chain", "subject", "confidence", "hash", "rpc"])("rejects unbound %s timing evidence", kind => {
    const altered = structuredClone(timing);
    if (kind === "configuration") altered.configurationFingerprint = "b".repeat(64);
    if (kind === "chain") altered.evidence.chainId = 1;
    if (kind === "subject") altered.evidence.subjectAddress = DEPLOYMENT.loanToken;
    if (kind === "confidence") altered.evidence.confidence = "UNKNOWN";
    if (kind === "hash") altered.evidence.artifactSha256 = null;
    if (kind === "rpc") altered.evidence.sourceKind = "RPC";
    expect(() => analyzeFreshness({ ...input, configurationFingerprint: fingerprint, verifiedHeartbeat: altered })).toThrow();
  });
  it("rejects invented serialized freshness and nonpositive local thresholds", () => {
    expect(freshnessSchema.safeParse({ ...analyzeFreshness(input), state: "VERIFIED" }).success).toBe(false);
    expect(() => analyzeFreshness({ ...input, localMaxAgeSeconds: 0n })).toThrow();
    expect(analyzeFreshness({ ...input, observationTimestamp: null }).observationAgeSeconds).toBeNull();
  });
});
