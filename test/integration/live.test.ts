import { beforeAll, describe, expect, it } from "vitest";
import { inspectLive } from "../../src/chain/live.js";
import { saveSnapshotEvidence } from "../../src/domain/evidence.js";
import { renderReport } from "../../src/domain/report.js";
import { DEPLOYMENT, NETWORK, RUNTIME_HASHES } from "../../src/config/deployment.js";
import { PHASE1_REGRESSION_EVIDENCE, CURRENT_EVIDENCE } from "../../src/config/evidence.js";
import type { Snapshot } from "../../src/domain/types.js";
import { calculateRisk } from "../../src/risk/engine.js";
import { saveRiskEvidence } from "../../src/risk/evidence.js";
import { renderRiskReport } from "../../src/risk/report.js";

let snapshot: Snapshot;
beforeAll(async () => {
  snapshot = await inspectLive();
  // Preserve diagnostics even if assertions fail, without replacing Phase 1 evidence.
  await saveSnapshotEvidence(snapshot, PHASE1_REGRESSION_EVIDENCE);
});

describe("LIVE_CHAIN_READ: real Pharos RPC + official Chain MCP", () => {
  it("retrieves the public demonstration borrow position at one consistent block", async () => {
    const s = snapshot;
    expect(s.accepted, renderReport(s)).toBe(true);
    expect(s.network.chainId).toBe(1672);
    expect(s.observedChainIds).toEqual({ rpc: 1672n, mcp: 1672n });
    expect(s.account).toBe(DEPLOYMENT.account);
    expect(s.accountRole).toBe("PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET");
    expect(s.marketId).toBe(DEPLOYMENT.marketId);
    expect(s.derivedMarketId).toBe(DEPLOYMENT.marketId);
    expect(s.params?.lltv).toBe(DEPLOYMENT.lltv);
    expect(s.tokens.loan?.decimals).toBe(6);
    expect(s.tokens.collateral?.decimals).toBe(18);
    expect(s.position!.borrowShares).toBeGreaterThan(0n);
    expect(s.accounting!.debt).toBeGreaterThan(0n);
    expect(s.contracts).toHaveLength(10);
    expect(s.contracts.every(item => item.byteLength > 0 && item.mcpMatchesRpc)).toBe(true);
    expect(s.contracts.find(item => item.address === DEPLOYMENT.multicall)?.keccak256).toBe(RUNTIME_HASHES.multicall);
    expect(s.consistency.blockHashesStable).toBe(true);
    expect(s.consistency.rpcBefore).toEqual(s.consistency.mcpBefore);
    expect(s.consistency.rpcBefore).toEqual(s.consistency.rpcAfter);
    expect(s.consistency.rpcBefore).toEqual(s.consistency.mcpAfter);
    expect(s.consistency.comparisons.every(item => item.matches)).toBe(true);
    expect(s.consistency.comparisons).toHaveLength(58);
    expect(s.consistency.batchSentinelsChecked).toBe(6);
    expect(s.reads.filter(item => item.blockNumber !== null).every(item => item.blockNumber === s.block?.number)).toBe(true);
    expect(new Set(s.reads.map(item => item.source))).toEqual(new Set(["mcp", "rpc"]));
    expect(s.reads.every(item => [new URL(NETWORK.rpc).href, NETWORK.mcp].includes(item.endpoint))).toBe(true);
    expect(s.oracle.quality).toBe("UNVERIFIED");
    expect(s.quality.overall).toBe("UNVERIFIED");
    expect(s.oracle.policy.heartbeatSeconds).toBeNull();
    expect(s.oracle.policy.timestampSemanticsVerified).toBe(true);
    expect(s.oracle.cacheAnswer).toBe(s.oracle.round?.answer);
    expect(s.oracle.cacheTimestamp).toBe(s.oracle.round?.updatedAt);
    expect(s.oracle.price).toBe(s.oracle.round!.answer * DEPLOYMENT.scaleFactor);
    expect(s.valuation?.actionable).toBe(false);
    expect(renderReport(s)).not.toMatch(/\bSAFE\b/);
    expect(s.evidenceKind).toBe("LIVE_CHAIN_READ");
  });

  it("derives non-actionable base risk and proves recovery estimates stay strictly gated on real data", async () => {
    const s = snapshot;
    const r = calculateRisk(s);
    await saveRiskEvidence(s, r, `${CURRENT_EVIDENCE}/risk-integration`);
    expect(r.riskState, renderRiskReport(r)).toBe("DATA_UNVERIFIED");
    expect(r.dataQuality.overall).toBe("UNVERIFIED");
    expect(r.dataQuality.oracle).toBe("UNVERIFIED");
    expect(r.mathematicalRiskState).not.toBeNull();
    expect(r.debtAmount).toBe(s.accounting?.debt);
    expect(r.liquidationCapacity).toBe(s.valuation?.maxBorrow);
    expect(r.blockHash).toBe(s.block?.hash);
    expect(r.temporalContext).toBe("LIVE_AS_OF_BLOCK");
    expect(r.actionable).toBe(false);
    expect(renderRiskReport(r)).not.toMatch(/\bSAFE\b/);
    // No verified assurance or supplied chain progression exists on a live read: amounts fail closed.
    expect(r.repayment).toBeNull();
    expect(r.additionalCollateral).toBeNull();
    expect(r.recoveryEligibility).toMatchObject({ status: "BLOCKED", eligible: false,
      reasonCodes: expect.arrayContaining(["RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED", "RECOVERY_CHAIN_PROGRESSION_UNKNOWN"]) });
  });
});
