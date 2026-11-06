import { beforeAll, describe, expect, it } from "vitest";
import type { Snapshot } from "../src/domain/types.js";
import { stringify } from "../src/domain/serialize.js";
import { DEPLOYMENT } from "../src/config/deployment.js";
import { parseThresholds } from "../src/config/risk.js";
import { calculateRisk, ORACLE_LIMITATION } from "../src/risk/engine.js";
import { snapshotIdentifier } from "../src/risk/provenance.js";
import { renderRiskReport } from "../src/risk/report.js";
import { WAD } from "../src/morpho/math.js";
import { U256_MAX } from "../src/validation/schemas.js";
import { riskFixture, RISK_FIXTURE_TIME } from "./fixtures/risk.js";
import * as f from "./fixtures/state.js";

let base: Snapshot;
const now = () => ({ calculatedAt: new Date(RISK_FIXTURE_TIME) });
beforeAll(async () => { base = await riskFixture(); });

describe("FIXTURE: snapshot-bound, non-actionable base risk engine", () => {
  it("reuses Phase 1 accounting and retains mathematical, quality and actionability results separately", () => {
    const result = calculateRisk(base, parseThresholds(), now());
    expect(result.mathematicalRiskState).toBe("WARNING");
    expect(result.riskState).toBe("DATA_UNVERIFIED");
    expect(result.dataQuality.overall).toBe("UNVERIFIED");
    expect(result.dataQuality.oracle).toBe("UNVERIFIED");
    expect(result.debtAmount).toBe(base.accounting?.debt);
    expect(result.ltv).toBe(base.valuation?.ltvWad);
    expect(result.safetyRatio).toBe(base.valuation?.safetyRatioWad);
    expect(result.liquidationCapacity).toBe(base.valuation?.maxBorrow);
    expect(result.actionability).toMatchObject({ status: "INDICATIVE_ONLY", actionable: false });
    // Base risk never implies recovery estimates; the strict gate owns them.
    expect(result.repayment).toBeNull();
    expect(result.additionalCollateral).toBeNull();
    expect(result.recoveryEligibility).toMatchObject({ status: "BLOCKED", eligible: false,
      reasonCodes: expect.arrayContaining(["RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED", "RECOVERY_CHAIN_PROGRESSION_UNKNOWN"]) });
    expect(result.warnings).toContain(ORACLE_LIMITATION);
  });

  it("records exactly the base reasons that apply to a complete, identity-valid snapshot", () => {
    const result = calculateRisk(base, parseThresholds(), now());
    expect(result.repayment).toBeNull();
    expect(result.additionalCollateral).toBeNull();
    // Base data and identity pass; only assurance and chain progression are unavailable to the base engine.
    expect(result.recoveryEligibility.reasonCodes).toEqual(["RECOVERY_CHAIN_PROGRESSION_UNKNOWN", "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED"]);
    expect(JSON.stringify(result.recoveryEligibility)).not.toMatch(/amount|raw/i);
  });

  it("adds base data and identity reasons when base inputs are invalid", async () => {
    const snapshot = await riskFixture({ values: { position: { ...f.position, borrowShares: 0n } } });
    snapshot.account = "0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb";
    const result = calculateRisk(snapshot, parseThresholds(), now());
    expect(result.recoveryEligibility.reasonCodes).toEqual(expect.arrayContaining([
      "RECOVERY_POSITION_DATA_BLOCKED", "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH"]));
  });

  it("does not mutate Phase 1 input and freezes base output", () => {
    const snapshot = structuredClone(base);
    const before = stringify(snapshot);
    const result = calculateRisk(snapshot, parseThresholds(), now());
    expect(stringify(snapshot)).toBe(before);
    expect(Object.isFrozen(snapshot)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.recoveryEligibility)).toBe(true);
    expect(Object.isFrozen(result.recoveryEligibility.reasonCodes)).toBe(true);
  });

  it("keeps ABOVE_WARNING provisional while the oracle is unverified", async () => {
    const snapshot = await riskFixture({ values: { position: { ...f.position, collateral: f.position.collateral * 2n } } });
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.mathematicalRiskState).toBe("ABOVE_WARNING");
    expect(r.riskState).toBe("DATA_UNVERIFIED");
    expect(r.actionable).toBe(false);
    expect(r.repayment).toBeNull();
    expect(r.additionalCollateral).toBeNull();
    expect(renderRiskReport(r)).not.toMatch(/\bSAFE\b/);
  });

  it("represents confirmed zero debt as provisional NO_DEBT without a zero-valued estimate", async () => {
    const snapshot = await riskFixture({ values: { position: { ...f.position, borrowShares: 0n } } });
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.mathematicalRiskState).toBe("NO_DEBT");
    expect(r.riskState).toBe("DATA_UNVERIFIED");
    expect(r.debtAmount).toBe(0n);
    expect(r.safetyRatio).toBeNull();
    expect(r.repayment).toBeNull();
    expect(r.additionalCollateral).toBeNull();
  });

  it("handles zero collateral with debt without modeling repayment", async () => {
    const snapshot = await riskFixture({ values: { position: { ...f.position, collateral: 0n } } });
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.mathematicalRiskState).toBe("LIQUIDATION_BOUNDARY");
    expect(r.capacityRelation).toBe("BELOW_DEBT");
    expect(r.ltv).toBeNull();
    expect(r.safetyRatio).toBe(0n);
    expect(r.riskState).toBe("DATA_UNVERIFIED");
    expect(r.repayment).toBeNull();
  });

  it("reports equality as a mathematical boundary, with Morpho equality semantics retained", async () => {
    const snapshot = await riskFixture({ values: {
      market: { ...f.market, totalBorrowAssets: 29n, totalSupplyAssets: 100n, totalBorrowShares: 2_000_003n, lastUpdate: f.historicalBlock.timestamp },
      position: { ...f.position, borrowShares: 1_000_001n, collateral: 10_000_000_000_000n }
    } });
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.liquidationCapacity).toBe(10n);
    expect(r.debtAmount).toBe(10n);
    expect(r.capacityRelation).toBe("EQUAL_TO_DEBT");
    expect(r.mathematicalRiskState).toBe("LIQUIDATION_BOUNDARY");
    expect(r.repayment).toBeNull();
    expect(renderRiskReport(r)).toContain("capacity >= debt check includes equality");
  });

  it.each([null, undefined, {}])("fails closed for absent or malformed snapshot %#", snapshot => {
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.riskState).toBe(snapshot == null ? "DATA_UNAVAILABLE" : "DATA_INVALID");
    expect(r.mathematicalRiskState).toBeNull();
    expect(r.debtAmount).toBeNull();
    expect(r.repayment).toBeNull();
    expect(r.additionalCollateral).toBeNull();
    expect(r.actionable).toBe(false);
    expect(r.warnings).toContain(ORACLE_LIMITATION);
  });

  it("suppresses classification on failed RPC, retaining the obtained block provenance", async () => {
    const snapshot = await riskFixture({ unavailableCall: true }, {});
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.riskState).toBe("DATA_UNAVAILABLE");
    expect(r.mathematicalRiskState).toBeNull();
    expect(r.debtAmount).toBeNull();
    expect(r.blockHash).toBe(snapshot.block?.hash);
    expect(r.inputSnapshotIdentifier).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(r.repayment).toBeNull();
  });

  it("does not recalculate missing accounting into a successful position result", () => {
    const snapshot = structuredClone(base);
    snapshot.accounting = null;
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.riskState).toBe("DATA_UNAVAILABLE");
    expect(r.debtAmount).toBeNull();
    expect(r.repayment).toBeNull();
  });

  it("respects an explicitly rejected input even if numerical values remain attached", () => {
    const snapshot = structuredClone(base);
    snapshot.accepted = false;
    expect(calculateRisk(snapshot, parseThresholds(), now()).riskState).toBe("DATA_UNAVAILABLE");
  });

  it("retains provisional mathematics for stale data and blocks every recovery estimate at the base gate", () => {
    const snapshot = structuredClone(base);
    snapshot.quality.overall = "STALE";
    snapshot.oracle.quality = "STALE";
    snapshot.quality.byScope.oracle = "STALE";
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.dataQuality.overall).toBe("STALE");
    expect(r.dataQuality.oracle).toBe("STALE");
    expect(r.riskState).toBe("DATA_UNVERIFIED");
    expect(r.mathematicalRiskState).toBe("WARNING");
    expect(r.repayment).toBeNull();
    expect(r.additionalCollateral).toBeNull();
    expect(r.recoveryEligibility.status).toBe("BLOCKED");
    expect(r.recoveryEligibility.reasonCodes).toContain("RECOVERY_POSITION_DATA_BLOCKED");
    expect(r.actionable).toBe(false);
  });

  it("preserves STALE when Phase 1 already suppressed accounting", () => {
    const snapshot = structuredClone(base);
    snapshot.quality.overall = "STALE";
    snapshot.quality.byScope.oracle = "STALE";
    snapshot.oracle.quality = "STALE";
    snapshot.accounting = null;
    snapshot.valuation = null;
    snapshot.accepted = false;
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.dataQuality.overall).toBe("STALE");
    expect(r.mathematicalRiskState).toBeNull();
    expect(r.repayment).toBeNull();
  });

  it("does not promote caller-supplied verification flags for the selected oracle", () => {
    const snapshot = structuredClone(base);
    snapshot.oracle.quality = "VALID";
    snapshot.quality.overall = "VALID";
    snapshot.quality.byScope.oracle = "VALID";
    snapshot.quality.findings = [];
    Object.assign(snapshot.oracle.policy, { sourceVerified: true, operatorIdentityVerified: true, heartbeatVerified: true, heartbeatSeconds: 60n });
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.dataQuality.oracle).toBe("UNVERIFIED");
    expect(r.oraclePolicy?.sourceVerified).toBe(false);
    expect(r.oraclePolicy?.heartbeatVerified).toBe(false);
    expect(r.oraclePolicy?.heartbeatSeconds).toBeNull();
    expect(snapshot.oracle.policy.sourceVerified).toBe(true); // caller input not mutated
  });

  it("does not invent staleness from old age without a verified heartbeat", async () => {
    const snapshot = await riskFixture({ values: {
      "feed.latestRoundData": [0n, f.answer, 1n, 1n, 0n], "feed.latestTimestamp": 1n, "cache.latestAnswerTimestampForFeed": 1n
    } });
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.dataQuality.overall).toBe("UNVERIFIED");
    expect(r.repayment).toBeNull();
    expect(r.actionable).toBe(false);
  });

  it.each([
    ["accounting debt", (s: Snapshot) => { s.accounting!.debt += 1n; }],
    ["accrual elapsed", (s: Snapshot) => { s.accounting!.elapsedSeconds += 1n; }],
    ["valuation", (s: Snapshot) => { s.valuation!.maxBorrow += 1n; }],
    ["position", (s: Snapshot) => { s.position!.borrowShares += 1_000_000n; }],
    ["final header", (s: Snapshot) => { s.consistency.rpcAfter!.hash = `0x${"aa".repeat(32)}`; }],
    ["contract block", (s: Snapshot) => { s.contracts[0]!.blockNumber += 1n; }],
    ["read block", (s: Snapshot) => { s.reads.find(read => read.blockNumber !== null)!.blockNumber! += 1n; }],
    ["comparison digest", (s: Snapshot) => { s.consistency.comparisons[0]!.mcpDigest = "aa".repeat(32); }],
    ["market ID", (s: Snapshot) => { s.marketId = `0x${"aa".repeat(32)}`; }],
    ["account", (s: Snapshot) => { s.account = DEPLOYMENT.morpho; }],
    ["token decimals", (s: Snapshot) => { s.tokens.loan!.decimals = 18; }],
    ["LLTV", (s: Snapshot) => { s.params!.lltv = WAD; }],
    ["oracle address", (s: Snapshot) => { s.oracle.address = DEPLOYMENT.morpho; }],
    ["chain", (s: Snapshot) => { s.network = { ...s.network, chainId: 1 }; }],
    ["zero price", (s: Snapshot) => { s.oracle.price = 0n; }],
    ["overflow price", (s: Snapshot) => { s.oracle.price = U256_MAX + 1n; }],
    ["future timestamp", (s: Snapshot) => { s.oracle.round!.updatedAt = s.block!.timestamp + 1n; }]
  ] as const)("rejects mismatched/invalid %s without usable recovery amounts", (_name, mutate) => {
    const snapshot = structuredClone(base);
    mutate(snapshot);
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.riskState).toBe("DATA_INVALID");
    expect(r.mathematicalRiskState).toBeNull();
    expect(r.debtAmount).toBeNull();
    expect(r.repayment).toBeNull();
    expect(r.additionalCollateral).toBeNull();
    expect(r.blockNumber).toBe(base.block?.number);
    expect(r.actionable).toBe(false);
  });

  it("retains valid block provenance for malformed financial data and renders it safely", () => {
    const r = calculateRisk({ ...base, oracle: { ...base.oracle, price: "1.10" } }, parseThresholds(), now());
    expect(r.riskState).toBe("DATA_INVALID");
    expect(r.blockNumber).toBe(base.block?.number);
    expect(r.blockHash).toBe(base.block?.hash);
    expect(r.oraclePrice).toBeNull();
    expect(renderRiskReport(r)).toContain("NON-ACTIONABLE");
  });

  it("enforces an explicit snapshot identifier and changes the ID when input provenance changes", () => {
    const original = snapshotIdentifier(base);
    const accepted = calculateRisk(base, parseThresholds(), { ...now(), expectedSnapshotIdentifier: original });
    expect(accepted.riskState).toBe("DATA_UNVERIFIED");
    const snapshot = structuredClone(base);
    snapshot.startedAt = "2026-11-01T14:04:59.000Z";
    expect(snapshotIdentifier(snapshot)).not.toBe(original);
    const r = calculateRisk(snapshot, parseThresholds(), { ...now(), expectedSnapshotIdentifier: original });
    expect(r.riskState).toBe("DATA_INVALID");
    expect(r.dataQuality.findings.some(finding => finding.code === "SNAPSHOT_IDENTIFIER_MISMATCH")).toBe(true);
    expect(r.repayment).toBeNull();
  });

  it("gives the same identifier for equivalent key order", () => {
    const reordered = Object.fromEntries(Object.entries(base).reverse()) as unknown as Snapshot;
    expect(snapshotIdentifier(reordered)).toBe(snapshotIdentifier(base));
  });

  it("distinguishes bigint values from lookalike objects/arrays in snapshot identifiers", () => {
    const typed = structuredClone(base);
    typed.reads[0]!.params = 7n;
    const object = structuredClone(typed);
    object.reads[0]!.params = { bigint: "7" };
    const array = structuredClone(typed);
    array.reads[0]!.params = ["bigint", "7"];
    const identifier = snapshotIdentifier(typed);
    expect(new Set([identifier, snapshotIdentifier(object), snapshotIdentifier(array)]).size).toBe(3);
    const r = calculateRisk(object, parseThresholds(), { ...now(), expectedSnapshotIdentifier: identifier });
    expect(r.riskState).toBe("DATA_INVALID");
    expect(r.repayment).toBeNull();
    expect(r.dataQuality.findings.some(finding => finding.code === "SNAPSHOT_IDENTIFIER_MISMATCH")).toBe(true);
  });

  it("labels explicitly historical calculations without historical estimates", () => {
    const snapshot = { ...base, evidenceKind: "HISTORICAL_SNAPSHOT" as const };
    const r = calculateRisk(snapshot, parseThresholds(), now());
    expect(r.temporalContext).toBe("HISTORICAL");
    expect(r.repayment).toBeNull();
    expect(r.additionalCollateral).toBeNull();
    expect(renderRiskReport(r)).toContain("Evidence: HISTORICAL");
    expect(renderRiskReport(r)).not.toContain("LIVE_AS_OF_BLOCK");
  });

  it("keeps base diagnostics when an eligibility-gated estimate would previously have overflowed", () => {
    const r = calculateRisk(base, parseThresholds({ targetRatio: `1${"0".repeat(54)}` }), now());
    expect(r.mathematicalRiskState).toBe("WARNING");
    expect(r.dataQuality.overall).toBe("UNVERIFIED");
    expect(r.repayment).toBeNull();
    expect(r.additionalCollateral).toBeNull();
    expect(r.recoveryEligibility.status).toBe("BLOCKED");
    expect(r.recoveryEligibility.reasonCodes).toContain("RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED");
    expect(r.actionable).toBe(false);
  });
});
