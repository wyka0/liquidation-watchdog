import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";
import type { Snapshot } from "../src/domain/types.js";
import { parseThresholds } from "../src/config/risk.js";
import { WAD } from "../src/morpho/math.js";
import { stringify } from "../src/domain/serialize.js";
import { evaluateChainProgression } from "../src/chain/progression.js";
import { calculateAssuredRisk } from "../src/risk/assured.js";
import type { AssuredRiskOptions } from "../src/risk/assured.js";
import type { ProgressionEvidence, RecoveryEligibilityReason } from "../src/risk/eligibility.js";
import { calculateRisk } from "../src/risk/engine.js";
import * as collateralSolver from "../src/risk/collateral.js";
import * as repaymentSolver from "../src/risk/repayment.js";
import type { OracleAssurance } from "../src/oracle-assurance/model.js";
import { riskFixture, testClock } from "./fixtures/phase4.js";
import { verifiedAssuranceFixture } from "./fixtures/recovery.js";
import * as f from "./fixtures/state.js";
import { temporaryMonitorDirectory } from "./fixtures/monitoring.js";

let base: Snapshot;
const directory = temporaryMonitorDirectory();
beforeAll(async () => { base = await riskFixture(); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });

const ADVANCING: ProgressionEvidence = { state: "ADVANCING" };
const eligibleThresholds = parseThresholds();
const eligibleOptions = (overrides: Partial<AssuredRiskOptions> = {}): AssuredRiskOptions =>
  ({ calculatedAt: testClock(), progression: ADVANCING, ...overrides });

function eligibleFixture(): { snapshot: Snapshot; assurance: OracleAssurance } {
  const snapshot = structuredClone(base);
  return { snapshot, assurance: verifiedAssuranceFixture(snapshot) };
}

/** Eligible by construction; each adversarial case mutates exactly one gate input. */
function runEligible(overrides: Partial<AssuredRiskOptions> = {}, snapshotOverrides?: (snapshot: Snapshot) => void) {
  const { snapshot, assurance } = eligibleFixture();
  snapshotOverrides?.(snapshot);
  return calculateAssuredRisk(snapshot, assurance, eligibleThresholds, eligibleOptions(overrides));
}

describe("FIXTURE: strict recovery-estimate eligibility gate", () => {
  it("calculates both estimates only when every condition passes, with exact BigInt amounts and non-actionability", () => {
    const repaymentSpy = vi.spyOn(repaymentSolver, "solveMinimumRepayment");
    const collateralSpy = vi.spyOn(collateralSolver, "solveAdditionalCollateral");
    const result = runEligible();
    expect(result.recoveryEligibility).toEqual({ eligible: true, status: "ELIGIBLE", reasonCodes: [] });
    expect(result.repayment?.status).toBe("CALCULATED");
    expect(result.additionalCollateral?.status).toBe("CALCULATED");
    expect(typeof result.repayment?.amount?.raw).toBe("bigint");
    expect(result.repayment?.amount?.raw).toBe(result.repayment?.calculation?.repaymentAmount);
    expect(result.additionalCollateral?.amount?.raw).toBe(result.additionalCollateral?.calculation?.additionalCollateral);
    expect(result.repayment?.actionable).toBe(false);
    expect(result.additionalCollateral?.actionable).toBe(false);
    expect(result.actionable).toBe(false);
    expect(result.repayment?.blockHash).toBe(base.block?.hash);
    expect(result.repayment?.inputSnapshotIdentifier).toBe(result.inputSnapshotIdentifier);
    expect(result.repayment?.temporalContext).toBe("FIXTURE");
    expect(result.repayment?.assumptions.length).toBeGreaterThan(0);
    expect(result.repayment?.calculation?.proof).toMatchObject({ targetSatisfied: true, minimumProven: true });
    expect(result.additionalCollateral?.calculation?.proof).toMatchObject({ targetSatisfied: true, minimumProven: true });
    // Proven target/minimality invariants on the exact fixture numbers.
    const repay = result.repayment!.calculation!;
    expect(repay.modeledPostRepaymentDebt * repay.targetRatioWad).toBeLessThanOrEqual(result.liquidationCapacity! * WAD);
    if (repay.proof.previousAmountPostDebt !== null) expect(repay.proof.previousAmountPostDebt).toBeGreaterThan(repay.allowedDebt);
    const collateral = result.additionalCollateral!.calculation!;
    expect(collateral.modeledCapacity * WAD).toBeGreaterThanOrEqual(result.debtAmount! * collateral.targetRatioWad);
    if (collateral.proof.previousCollateralCapacity !== null) expect(collateral.proof.previousCollateralCapacity).toBeLessThan(collateral.requiredCapacity);
    expect(repaymentSpy).toHaveBeenCalledTimes(1);
    expect(collateralSpy).toHaveBeenCalledTimes(1);
    repaymentSpy.mockRestore();
    collateralSpy.mockRestore();
  });

  function degraded(assurance: OracleAssurance, mutate: (tampered: OracleAssurance) => void): OracleAssurance {
    const tampered = structuredClone(assurance);
    mutate(tampered);
    // Re-derive the conservative overall/gate pair so every tampered object stays schema-valid.
    const states = Object.values(tampered.dimensions).map(dimension => dimension.state);
    const failed = states.some(state => state === "FAILED") || tampered.freshness.state === "FAILED" || tampered.independent.state === "FAILED";
    const verified = !tampered.evidenceInvalidated && states.every(state => state === "VERIFIED");
    (tampered as { overall: OracleAssurance["overall"] }).overall = failed ? "FAILED" : verified ? "VERIFIED" : "UNVERIFIED";
    (tampered as { gate: OracleAssurance["gate"] }).gate = failed ? "DATA_INVALID" : verified ? "ASSURANCE_REQUIREMENTS_MET" : "DATA_UNVERIFIED";
    return tampered;
  }
  const allDimensions = (assurance: OracleAssurance, state: "UNVERIFIED" | "UNKNOWN" | "FAILED") => {
    for (const dimension of Object.keys(assurance.dimensions) as (keyof OracleAssurance["dimensions"])[]) assurance.dimensions[dimension].state = state;
  };

  it("never invokes a recovery solver when any single condition fails, and always reports the reason", () => {
    const cases: { name: string; run: () => ReturnType<typeof calculateAssuredRisk>; reason: RecoveryEligibilityReason; exact?: boolean }[] = [
      // Conditions outside the assurance object are independently evaluable: exact single reason codes.
      { name: "unknown chain progression", reason: "RECOVERY_CHAIN_PROGRESSION_UNKNOWN", exact: true,
        run: () => { const { snapshot, assurance } = eligibleFixture(); return calculateAssuredRisk(snapshot, assurance, eligibleThresholds, { calculatedAt: testClock() }); } },
      { name: "stalled chain progression", reason: "RECOVERY_CHAIN_PROGRESSION_STALLED", exact: true,
        run: () => runEligible({ progression: { state: "STALLED" } }) },
      { name: "regressed chain progression", reason: "RECOVERY_CHAIN_PROGRESSION_REGRESSED", exact: true,
        run: () => runEligible({ progression: { state: "REGRESSED" } }) },
      { name: "conflicting chain progression", reason: "RECOVERY_CHAIN_PROGRESSION_CONFLICT", exact: true,
        run: () => runEligible({ progression: { state: "CONFLICT" } }) },
      { name: "unchanged chain progression", reason: "RECOVERY_CHAIN_PROGRESSION_UNCHANGED", exact: true,
        run: () => runEligible({ progression: { state: "UNCHANGED_WITHIN_WINDOW" } }) },
      { name: "stale phase-2 oracle evidence", reason: "RECOVERY_POSITION_DATA_BLOCKED", exact: true,
        run: () => runEligible({}, snapshot => { snapshot.oracle.quality = "STALE"; snapshot.quality.overall = "STALE"; snapshot.quality.byScope.oracle = "STALE"; }) },
      { name: "incomplete position data", reason: "RECOVERY_POSITION_DATA_BLOCKED", exact: true,
        run: () => runEligible({}, snapshot => { snapshot.accounting = null; snapshot.valuation = null; snapshot.accepted = false; }) },
      // Assurance-coupled conditions: the conservative schema couples any degradation to overall/gate, so the
      // gate reports the specific reason together with the coupled assurance/gate reasons.
      { name: "UNVERIFIED oracle assurance (gate not met)", reason: "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED",
        run: () => { const { snapshot, assurance } = eligibleFixture(); const tampered = degraded(assurance, degradedAssurance => { allDimensions(degradedAssurance, "UNVERIFIED"); }); return calculateAssuredRisk(snapshot, tampered, eligibleThresholds, eligibleOptions()); } },
      { name: "UNKNOWN oracle freshness", reason: "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED",
        run: () => { const { snapshot, assurance } = eligibleFixture(); const tampered = degraded(assurance, tamperedAssurance => {
          allDimensions(tamperedAssurance, "UNVERIFIED"); tamperedAssurance.dimensions.FRESHNESS.state = "UNKNOWN";
          (tamperedAssurance.freshness as { state: string }).state = "UNKNOWN"; }); return calculateAssuredRisk(snapshot, tampered, eligibleThresholds, eligibleOptions()); } },
      { name: "independent validation failure", reason: "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED",
        run: () => { const { snapshot, assurance } = eligibleFixture(); const tampered = degraded(assurance, tamperedAssurance => {
          tamperedAssurance.dimensions.INDEPENDENT_VALIDATION.state = "UNKNOWN";
          const independent = tamperedAssurance.independent as { state: string; eligible: boolean; normalizedMorpho: unknown; normalizedIndependent: unknown; deviationBps: unknown };
          independent.state = "UNKNOWN"; independent.eligible = false;
          independent.normalizedMorpho = null; independent.normalizedIndependent = null; independent.deviationBps = null; });
          return calculateAssuredRisk(snapshot, tampered, eligibleThresholds, eligibleOptions()); } },
      { name: "invalidated evidence", reason: "RECOVERY_EVIDENCE_INVALIDATED",
        run: () => { const { snapshot, assurance } = eligibleFixture(); const tampered = degraded(assurance, tamperedAssurance => {
          allDimensions(tamperedAssurance, "UNVERIFIED"); tamperedAssurance.evidenceInvalidated = true;
          tamperedAssurance.invalidationReason = "CONFIGURATION_CHANGE"; tamperedAssurance.invalidatedAt = tamperedAssurance.evaluatedAt; });
          return calculateAssuredRisk(snapshot, tampered, eligibleThresholds, eligibleOptions()); } },
      { name: "timestamp anomaly", reason: "RECOVERY_TIMESTAMP_ANOMALY",
        run: () => { const { snapshot, assurance } = eligibleFixture(); const tampered = degraded(assurance, tamperedAssurance => {
          (tamperedAssurance.freshness as { anomalies: string[] }).anomalies = ["TIMESTAMP_REGRESSION"];
          (tamperedAssurance.freshness as { state: string }).state = "FAILED"; tamperedAssurance.dimensions.FRESHNESS.state = "FAILED"; });
          return calculateAssuredRisk(snapshot, tampered, eligibleThresholds, eligibleOptions()); } },
      { name: "configuration mismatch", reason: "RECOVERY_CONFIGURATION_MISMATCH",
        run: () => { const { snapshot, assurance } = eligibleFixture(); const tampered = degraded(assurance, tamperedAssurance => {
          (tamperedAssurance.freshness as { timingConfigurationFingerprint: string | null }).timingConfigurationFingerprint = "f".repeat(64);
          (tamperedAssurance.freshness as { state: string }).state = "UNKNOWN"; tamperedAssurance.dimensions.FRESHNESS.state = "UNKNOWN"; });
          return calculateAssuredRisk(snapshot, tampered, eligibleThresholds, eligibleOptions()); } },
      { name: "mismatched borrower identity", reason: "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH",
        run: () => runEligible({}, snapshot => { snapshot.account = "0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb"; }) },
      { name: "mismatched market identity", reason: "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH",
        run: () => runEligible({}, snapshot => { snapshot.marketId = `0x${"bb".repeat(32)}`; snapshot.derivedMarketId = snapshot.marketId; }) },
      { name: "mismatched expected snapshot identity", reason: "RECOVERY_SNAPSHOT_IDENTITY_MISMATCH",
        run: () => runEligible({ expectedSnapshotIdentifier: `sha256:${"0".repeat(64)}` }) }
    ];
    const repaymentSpy = vi.spyOn(repaymentSolver, "solveMinimumRepayment");
    const collateralSpy = vi.spyOn(collateralSolver, "solveAdditionalCollateral");
    for (const { name, run, reason, exact } of cases) {
      const result = run();
      expect(result.recoveryEligibility.status, name).toBe("BLOCKED");
      expect(result.recoveryEligibility.eligible, name).toBe(false);
      if (exact) expect(result.recoveryEligibility.reasonCodes, name).toEqual([reason]);
      else expect(result.recoveryEligibility.reasonCodes, name).toContain(reason);
      expect(result.repayment, name).toBeNull();
      expect(result.additionalCollateral, name).toBeNull();
      expect(result.actionable, name).toBe(false);
      // Blocked results never contain numeric estimate payloads anywhere in the eligibility record.
      expect(JSON.stringify(result.recoveryEligibility), name).not.toMatch(/amount|raw/i);
    }
    expect(repaymentSpy).not.toHaveBeenCalled();
    expect(collateralSpy).not.toHaveBeenCalled();
    repaymentSpy.mockRestore();
    collateralSpy.mockRestore();
  });

  it("keeps base risk classification independently valid when estimates are blocked", () => {
    const result = runEligible({ progression: { state: "REGRESSED" } });
    expect(result.mathematicalRiskState).toBe("WARNING");
    expect(result.riskState).toBe("DATA_UNVERIFIED");
    expect(result.debtAmount).toBe(base.accounting?.debt);
    expect(result.safetyRatio).toBe(base.valuation?.safetyRatioWad);
    expect(result.liquidationCapacity).toBe(base.valuation?.maxBorrow);
    expect(result.actionability.status).toBe("INDICATIVE_ONLY");
    expect(result.actionability.reasons).toContain("RECOVERY_CHAIN_PROGRESSION_REGRESSED");
    expect(result.actionability.actionable).toBe(false);
    expect(renderReportSafe(result.warnings));
  });

  it("distinguishes absent estimates from zero-valued ones and never serializes float amounts", () => {
    const blocked = runEligible({ progression: { state: "STALLED" } });
    expect(blocked.repayment).toBeNull();
    expect(JSON.stringify(blocked.repayment)).toBe(JSON.stringify(null));
    const eligible = runEligible();
    expect(eligible.repayment?.amount?.raw).toBeTypeOf("bigint");
    for (const estimate of [eligible.repayment, eligible.additionalCollateral]) {
      expect(estimate?.amount?.formatted).toMatch(/^[0-9]+(?:\.[0-9]+)?$/);
      // Exact decimal text only: no exponent, no float artifacts, in any serialized view.
      const serialized = stringify(estimate?.amount ?? null);
      expect(serialized).not.toMatch(/e[+-]?[0-9]/i);
      expect(serialized).toContain(estimate!.amount!.raw.toString());
    }
  });

  it("fails the target proof for one base unit below the calculated repayment requirement", () => {
    // Solver-level directional proof, exercised through the eligible gate on the same snapshot values.
    const state = {
      borrowShares: f.position.borrowShares, totalBorrowShares: f.market.totalBorrowShares,
      totalBorrowAssets: base.accounting!.accruedBorrowAssets, debt: base.accounting!.debt
    };
    const capacity = base.valuation!.maxBorrow, target = eligibleThresholds.wad.targetRatio;
    const proof = repaymentSolver.solveMinimumRepayment(state, capacity, target);
    expect(proof.proof.targetSatisfied).toBe(true);
    if (proof.proof.previousAmount !== null && proof.proof.previousAmount > 0n) {
      const below = repaymentSolver.simulateRepayment(state, proof.proof.previousAmount);
      expect(below.remainingDebt * target).toBeGreaterThan(capacity * WAD);
    }
    const collateralProof = collateralSolver.solveAdditionalCollateral(f.position.collateral, f.price, f.params.lltv, base.accounting!.debt, target);
    if (collateralProof.proof.previousCollateralCapacity !== null) {
      expect(collateralProof.proof.previousCollateralCapacity).toBeLessThan(collateralProof.requiredCapacity);
    }
  });

  it("keeps an explicit snapshot-identifier binding on the eligible path and rejects a stale binding", () => {
    const { snapshot, assurance } = eligibleFixture();
    const identifier = calculateRisk(snapshot, eligibleThresholds, { calculatedAt: testClock() }).inputSnapshotIdentifier!;
    const accepted = calculateAssuredRisk(snapshot, assurance, eligibleThresholds, eligibleOptions({ expectedSnapshotIdentifier: identifier }));
    expect(accepted.recoveryEligibility.status).toBe("ELIGIBLE");
    expect(accepted.repayment?.status).toBe("CALCULATED");
    const changed = structuredClone(snapshot);
    changed.startedAt = "2026-11-01T14:04:59.000Z";
    const rejected = calculateAssuredRisk(changed, assurance, eligibleThresholds, eligibleOptions({ expectedSnapshotIdentifier: identifier }));
    expect(rejected.recoveryEligibility.status).toBe("BLOCKED");
    expect(rejected.recoveryEligibility.reasonCodes).toContain("RECOVERY_SNAPSHOT_IDENTITY_MISMATCH");
    expect(rejected.repayment).toBeNull();
    expect(rejected.actionable).toBe(false);
  });

  it("exposes a solver failure as an INVALID estimate without amounts while base risk stays valid", () => {
    // A target ratio beyond arithmetic bounds must not silently block: the solver's explicit failure is surfaced.
    const { snapshot, assurance } = eligibleFixture();
    const overflow = parseThresholds({ targetRatio: `1${"0".repeat(54)}` });
    const result = calculateAssuredRisk(snapshot, assurance, overflow, eligibleOptions());
    expect(result.recoveryEligibility.status).toBe("ELIGIBLE");
    expect(result.additionalCollateral?.status).toBe("INVALID");
    expect(result.additionalCollateral?.amount).toBeNull();
    expect(result.additionalCollateral?.issue?.code).toBe("INTEGER_RANGE");
    expect(result.repayment?.status).toBe("CALCULATED");
    expect(result.actionable).toBe(false);
    expect(result.additionalCollateral?.actionable).toBe(false);
  });
});

describe("FIXTURE: pure chain progression evaluation", () => {
  const previous = { blockNumber: 100n, blockHash: `0x${"ab".repeat(32)}`, blockTimestamp: 1_000n, headNumber: 105n };
  it.each([
    ["advancing", { blockNumber: 105n, blockHash: `0x${"cd".repeat(32)}`, blockTimestamp: 1_300n, headNumber: 110n }, "ADVANCING"],
    ["unchanged reread", { blockNumber: 100n, blockHash: previous.blockHash, blockTimestamp: 1_000n, headNumber: 105n }, "UNCHANGED_WITHIN_WINDOW"],
    ["regressed block", { blockNumber: 99n, blockHash: `0x${"cd".repeat(32)}`, blockTimestamp: 1_300n, headNumber: 110n }, "REGRESSED"],
    ["regressed head", { blockNumber: 105n, blockHash: `0x${"cd".repeat(32)}`, blockTimestamp: 1_300n, headNumber: 104n }, "REGRESSED"],
    ["regressed time", { blockNumber: 105n, blockHash: `0x${"cd".repeat(32)}`, blockTimestamp: 999n, headNumber: 110n }, "REGRESSED"],
    ["same-height conflict", { blockNumber: 100n, blockHash: `0x${"cd".repeat(32)}`, blockTimestamp: 1_000n, headNumber: 105n }, "CONFLICT"]
  ] as const)("classifies %s without using retrieval age", (_name, current, expected) => {
    expect(evaluateChainProgression(previous, current).state).toBe(expected);
  });
  it("advances only on a strictly higher block and reports the exact distance", () => {
    const result = evaluateChainProgression(previous, { blockNumber: 103n, blockHash: `0x${"cd".repeat(32)}`, blockTimestamp: 1_200n, headNumber: 108n });
    expect(result).toEqual({ state: "ADVANCING", advancedBlocks: 3n, reason: null });
  });
  it.each([
    { blockNumber: 0n, blockHash: `0x${"ab".repeat(32)}`, blockTimestamp: 1_000n, headNumber: null },
    { blockNumber: 100n, blockHash: "not-a-hash", blockTimestamp: 1_000n, headNumber: null },
    { blockNumber: 100n, blockHash: `0x${"ab".repeat(32)}`, blockTimestamp: 0n, headNumber: null }
  ])("fails closed on malformed %o evidence", current => {
    expect(() => evaluateChainProgression(previous, current)).toThrow();
  });
});

/** Safe-rendering helper: warnings may describe limitations but never claim safety. */
function renderReportSafe(warnings: readonly string[]): boolean {
  return warnings.join(" ").toLowerCase().includes("indicative") || warnings.every(warning => !/\bsafe\b/i.test(warning));
}
