import { describe, expect, it } from "vitest";
import { DEPLOYMENT } from "../src/config/deployment.js";
import { inspectPosition } from "../src/chain/snapshot.js";
import { renderReport } from "../src/domain/report.js";
import { FixtureClient } from "./fixtures/clients.js";
import type { FixtureOverrides } from "./fixtures/clients.js";
import * as f from "./fixtures/state.js";

async function inspect(rpcOverrides: FixtureOverrides = {}, mcpOverrides: FixtureOverrides = rpcOverrides) {
  const rpc = new FixtureClient("rpc", rpcOverrides), mcp = new FixtureClient("mcp", mcpOverrides);
  const snapshot = await inspectPosition({ rpc, mcp, evidenceKind: "FIXTURE", now: () => new Date("2026-11-01T13:30:00Z") });
  return { snapshot, rpc, mcp };
}

describe("FIXTURE: complete block-pinned read path", () => {
  it("pins code, metadata, market, position, price and rate on both endpoints", async () => {
    const { snapshot: s, rpc, mcp } = await inspect();
    expect(s.accepted).toBe(true);
    expect(s.quality.overall).toBe("UNVERIFIED");
    expect(s.oracle.quality).toBe("UNVERIFIED");
    expect(s.evidenceKind).toBe("FIXTURE");
    expect(s.accounting?.debt).toBe(273_626_732_767n);
    expect(new Set([...rpc.pinnedBlocks, ...mcp.pinnedBlocks])).toEqual(new Set([f.historicalBlock.number]));
    expect(s.consistency.blockHashesStable).toBe(true);
    expect(s.consistency.batchSentinelsChecked).toBe(6);
    expect(s.consistency.comparisons).toHaveLength(58);
    expect(s.consistency.comparisons.every(item => item.matches)).toBe(true);
    expect(s.valuation?.actionable).toBe(false);
    expect(renderReport(s)).toContain("INDICATIVE AND NON-ACTIONABLE");
    expect(renderReport(s)).not.toMatch(/\bSAFE\b/);
  });

  it.each([
    ["wrong chain", { chainId: 1n }, "WRONG_CHAIN"],
    ["chain changes at recheck", { finalChainId: 1n }, "WRONG_CHAIN"],
    ["missing Morpho code", { missingCode: DEPLOYMENT.morpho }, "MISSING_CONTRACT_CODE"],
    ["untrusted Multicall runtime", { changedMulticallCode: true }, "MULTICALL_CODE_MISMATCH"],
    ["different returned block number", { initialHeaderNumber: f.historicalBlock.number + 1n }, "INVALID_BLOCK"],
    ["mixed EVM block", { sentinelBlockOffset: 1n }, "MIXED_BLOCK_READ"],
    ["mixed EVM timestamp", { sentinelTimestampOffset: 1n }, "MIXED_BLOCK_READ"],
    ["block hash changed", { afterHash: `0x${"ab".repeat(32)}` }, "BLOCK_HASH_CHANGED"]
  ] as const)("rejects %s and suppresses all derived results", async (_label, overrides, expected) => {
    const { snapshot: s } = await inspect(overrides);
    expect(s.accepted).toBe(false);
    expect(s.quality.overall).toBe("INVALID");
    expect(s.accounting).toBeNull();
    expect(s.valuation).toBeNull();
    expect(s.quality.findings.map(item => item.code)).toContain(expected);
  });

  it("handles a failed oracle subcall explicitly without treating it as zero", async () => {
    const { snapshot: s } = await inspect({ fail: "oracle.price" });
    expect(s.oracle.price).toBeNull();
    expect(s.position).toEqual(f.position);
    expect(s.quality.overall).toBe("UNAVAILABLE");
    expect(s.oracle.quality).toBe("UNAVAILABLE");
    expect(s.valuation).toBeNull();
    expect(s.quality.findings.map(item => item.code)).toContain("SUBCALL_FAILED");
  });
  it.each(["position", "borrowRateView"])("never reports zero debt when %s fails", async key => {
    const { snapshot: s } = await inspect({ fail: key });
    expect(s.quality.overall).toBe("UNAVAILABLE");
    expect(s.accounting).toBeNull();
    expect(renderReport(s)).toContain("Accrued debt: UNAVAILABLE");
    expect(renderReport(s)).not.toContain("Debt state: NO_DEBT");
  });
  it("rejects malformed successful subcall results", async () => {
    const { snapshot: s } = await inspect({ malformed: "position" });
    expect(s.quality.overall).toBe("INVALID");
    expect(s.position).toBeNull();
    expect(s.quality.findings.map(item => item.code)).toContain("SUBCALL_ENCODING");
  });
  it("rejects MCP/RPC value and per-subcall success disagreement", async () => {
    for (const overrides of [{ values: { position: { ...f.position, borrowShares: 0n } } }, { fail: "oracle.price" }]) {
      const { snapshot: s } = await inspect({}, overrides);
      expect(s.accepted).toBe(false);
      expect(s.quality.overall).toBe("INVALID");
      expect(s.quality.findings.map(item => item.code)).toContain("MCP_RPC_DISAGREEMENT");
      expect(s.consistency.comparisons.some(item => !item.matches)).toBe(true);
    }
  });
  it("rejects an unavailable MCP path instead of accepting an unchecked RPC result", async () => {
    const { snapshot: s } = await inspect({}, { unavailableCall: true });
    expect(s.accepted).toBe(false);
    expect(s.accounting).toBeNull();
    expect(s.quality.overall).toBe("UNAVAILABLE");
    for (const scope of ["market", "position", "tokens", "accounting", "consistency"] as const) {
      expect(s.quality.byScope[scope]).toBe("UNAVAILABLE");
    }
  });
  it("shows no debt only after a successful, cross-checked zero-share read", async () => {
    const { snapshot: s } = await inspect({ values: { position: { ...f.position, borrowShares: 0n } } });
    expect(s.accepted).toBe(true);
    expect(s.accounting?.debt).toBe(0n);
    expect(s.valuation?.safetyRatioWad).toBeNull();
    expect(s.valuation?.debtState).toBe("NO_DEBT");
    expect(s.quality.overall).toBe("UNVERIFIED");
  });
  it("rejects mismatched token decimals despite matching prices and token symbols", async () => {
    const { snapshot: s } = await inspect({ values: { "loan.decimals": 18 } });
    expect(s.quality.overall).toBe("INVALID");
    expect(s.accounting).toBeNull();
    expect(s.quality.findings.map(item => item.code)).toContain("TOKEN_DECIMALS_MISMATCH");
  });
  it("does not relabel invalid timestamps as merely stale", async () => {
    const timestamp = f.historicalBlock.timestamp + 1n;
    const { snapshot: s } = await inspect({ values: { "feed.latestRoundData": [0n, f.answer, timestamp, timestamp, 0n], "feed.latestTimestamp": timestamp, "cache.latestAnswerTimestampForFeed": timestamp } });
    expect(s.oracle.quality).toBe("INVALID");
    expect(s.valuation).toBeNull();
  });
});
