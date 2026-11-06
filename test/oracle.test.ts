import { describe, expect, it } from "vitest";
import { DEPLOYMENT, RUNTIME_HASHES } from "../src/config/deployment.js";
import type { ContractEvidence, OracleRead } from "../src/domain/types.js";
import { assessOracle, emptyOracle } from "../src/oracle/validate.js";
import { SELECTED_ORACLE_POLICY } from "../src/oracle/policy.js";
import * as f from "./fixtures/state.js";

// FIXTURE attestations for exercising the binding logic, not fresh code reads.
const contracts: ContractEvidence[] = [[DEPLOYMENT.feed, RUNTIME_HASHES.feed], [DEPLOYMENT.cache, RUNTIME_HASHES.cache]].map(([address, hash]) => ({
  label: "FIXTURE", address: address!, blockNumber: f.historicalBlock.number, byteLength: 1,
  keccak256: hash!, sha256: "FIXTURE", expectedRuntimeHash: hash!, runtimeHashMatches: true, mcpMatchesRpc: true
}));
function oracle(): OracleRead {
  return {
    ...emptyOracle(), price: f.price, composition: f.composition, feedId: DEPLOYMENT.feedId,
    decimals: 18, description: "SelfManagedFeedsCacheProxy", typeAndVersion: "SelfManagedFeedsCacheProxy 1.0.0",
    round: { roundId: 0n, answer: f.answer, startedAt: f.updatedAt, updatedAt: f.updatedAt, answeredInRound: 0n },
    latestTimestamp: f.updatedAt, cache: DEPLOYMENT.cache, cacheTypeAndVersion: "SelfManagedFeedsCache 1.0.0",
    cacheAnswer: f.answer, cacheTimestamp: f.updatedAt
  };
}
const verifiedFixturePolicy = {
  ...SELECTED_ORACLE_POLICY, sourceVerified: true, operatorIdentityVerified: true,
  heartbeatVerified: true, heartbeatSeconds: 60n,
  references: ["FIXTURE: synthetic 60-second policy; never used for the live market"]
};

describe("FIXTURE: oracle quality and actual cache semantics", () => {
  it("accepts intentional zero round IDs while retaining an unknown heartbeat", () => {
    const o = oracle();
    const findings = assessOracle(o, f.historicalBlock, contracts);
    expect(o.quality).toBe("UNVERIFIED");
    expect(o.ageSeconds).toBe(3_420n);
    expect(o.policy.timestampSemanticsVerified).toBe(true);
    expect(findings.map(item => item.code)).toContain("HEARTBEAT_UNVERIFIED");
    expect(findings.some(item => item.status === "STALE")).toBe(false);
  });
  it("does not invent staleness from even a very old timestamp", () => {
    const o = oracle();
    assessOracle(o, { ...f.historicalBlock, timestamp: f.historicalBlock.timestamp + 1_000_000n }, contracts);
    expect(o.quality).toBe("UNVERIFIED");
  });
  it.each([0n, -1n, f.historicalBlock.timestamp + 1n])("rejects invalid/future observation timestamp %s", timestamp => {
    const o = oracle();
    o.round = { ...o.round!, startedAt: timestamp, updatedAt: timestamp };
    o.latestTimestamp = timestamp;
    o.cacheTimestamp = timestamp;
    assessOracle(o, f.historicalBlock, contracts);
    expect(o.quality).toBe("INVALID");
    expect(o.ageSeconds).toBeNull();
  });
  it.each([0n, -1n])("rejects invalid price answer %s", answer => {
    const o = oracle();
    o.round = { ...o.round!, answer };
    assessOracle(o, f.historicalBlock, contracts);
    expect(o.quality).toBe("INVALID");
  });
  it("detects round/timestamp, cache answer, and oracle scale inconsistencies", () => {
    for (const change of [
      { latestTimestamp: f.updatedAt - 1n }, { cacheTimestamp: f.updatedAt - 1n }, { cacheAnswer: f.answer + 1n },
      { price: f.price + 1n }, { decimals: 6 }, { round: { ...oracle().round!, roundId: 1n } }
    ]) {
      const o = { ...oracle(), ...change };
      assessOracle(o, f.historicalBlock, contracts);
      expect(o.quality).toBe("INVALID");
    }
  });
  it("keeps unavailable oracle data unavailable", () => {
    const o = { ...oracle(), price: null, round: null };
    assessOracle(o, f.historicalBlock, contracts);
    expect(o.quality).toBe("UNAVAILABLE");
    expect(o.price).toBeNull();
  });
  it("invalidates verified timestamp semantics if the cache binding changes", () => {
    const o = { ...oracle(), cache: DEPLOYMENT.account };
    assessOracle(o, f.historicalBlock, contracts);
    expect(o.quality).toBe("UNVERIFIED");
    expect(o.policy.timestampSemanticsVerified).toBe(false);
  });
  it("rejects applying a verified policy to a different runtime or feed ID", () => {
    const o = { ...oracle(), feedId: `0x${"ab".repeat(32)}` as const };
    assessOracle(o, f.historicalBlock, contracts, verifiedFixturePolicy);
    expect(o.policy.heartbeatVerified).toBe(false);
    expect(o.quality).toBe("UNVERIFIED");
  });
  it("allows the exact verified-policy age boundary and marks the next second stale", () => {
    const fresh = oracle();
    assessOracle(fresh, { ...f.historicalBlock, timestamp: f.updatedAt + 60n }, contracts, verifiedFixturePolicy);
    expect(fresh.quality).toBe("VALID");
    const stale = oracle();
    assessOracle(stale, { ...f.historicalBlock, timestamp: f.updatedAt + 61n }, contracts, verifiedFixturePolicy);
    expect(stale.quality).toBe("STALE");
  });
  it("ignores an unverified proposed maximum age", () => {
    const o = oracle();
    assessOracle(o, f.historicalBlock, contracts, { ...verifiedFixturePolicy, heartbeatVerified: false });
    expect(o.quality).toBe("UNVERIFIED");
    expect(o.policy.heartbeatSeconds).toBeNull();
  });
});
