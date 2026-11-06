import { describe, expect, it } from "vitest";
import { accruePosition } from "../src/morpho/accounting.js";
import { toAssetsUp, toSharesDown, WAD } from "../src/morpho/math.js";
import { simulateRepayment, solveMinimumRepayment } from "../src/risk/repayment.js";
import type { BorrowState } from "../src/risk/repayment.js";
import { U128_MAX, U256_MAX } from "../src/validation/schemas.js";
import * as f from "./fixtures/state.js";

const target = 5n * WAD / 4n;
const ceil = (n: bigint, d: bigint) => n / d + (n % d === 0n ? 0n : 1n);
const state = (assets: bigint, shares: bigint, borrower: bigint): BorrowState => ({
  totalBorrowAssets: assets, totalBorrowShares: shares, borrowShares: borrower,
  debt: ceil(borrower * (assets + 1n), shares + 1_000_000n)
});

// Independent small-state enumerator: checks BOTH Morpho repay modes directly,
// without calling the production simulator or binary search.
function independentRemaining(s: BorrowState, assets: bigint, shares: bigint): bigint {
  const remainingAssets = assets >= s.totalBorrowAssets ? 0n : s.totalBorrowAssets - assets;
  return ceil((s.borrowShares - shares) * (remainingAssets + 1n), s.totalBorrowShares - shares + 1_000_000n);
}

describe("FIXTURE: minimum share-aware Morpho repayment", () => {
  it("reaches the historical fixture target and proves one base unit less fails", () => {
    const a = accruePosition(f.params, f.market, f.position, f.historicalBlock.timestamp, f.rate);
    const s = { borrowShares: f.position.borrowShares, totalBorrowShares: a.totalBorrowShares, totalBorrowAssets: a.accruedBorrowAssets, debt: a.debt };
    const capacity = 320_685_374_202n;
    const r = solveMinimumRepayment(s, capacity, target);
    expect(r.allowedDebt).toBe(capacity * WAD / target);
    expect(r.modeledPostRepaymentDebt).toBeLessThanOrEqual(r.allowedDebt);
    expect(r.modeledPostRepaymentDebt * target).toBeLessThanOrEqual(capacity * WAD);
    expect(r.proof.previousAmountPostDebt!).toBeGreaterThan(r.allowedDebt);
    expect(r.simulation.remainingTotalBorrowAssets).toBe(s.totalBorrowAssets - r.repaymentAmount);
    expect(r.simulation.remainingTotalBorrowShares).toBe(s.totalBorrowShares - r.simulation.sharesBurned);
    expect(r.simulation.remainingBorrowShares).toBe(s.borrowShares - r.simulation.sharesBurned);
    expect(r.proof.searchIterations).toBeLessThanOrEqual(129);
  });

  it("adds a conservative base unit when debt-minus-allowed does not reach target", () => {
    const s = state(29n, 2_000_003n, 1_000_001n);
    expect(s.debt).toBe(10n);
    const r = solveMinimumRepayment(s, 10n, target);
    expect(r.allowedDebt).toBe(8n);
    expect(r.initialRepaymentEstimate).toBe(2n);
    expect(simulateRepayment(s, 2n).remainingDebt).toBe(9n);
    expect(r.repaymentAmount).toBe(3n);
    expect(r.modeledPostRepaymentDebt).toBe(8n);
    expect(r.modeledResultingRatioWad).toBe(target);
    expect(r.roundingMargin.repaymentAboveInitialEstimate).toBe(1n);
  });

  it("uses a full-share endpoint when repaying rounded debt in assets would over-burn", () => {
    const s = state(0n, 1n, 1n);
    expect(s.debt).toBe(1n);
    expect(toSharesDown(s.debt, s.totalBorrowAssets, s.totalBorrowShares)).toBeGreaterThan(s.borrowShares);
    const r = solveMinimumRepayment(s, 0n, target);
    expect(r.repaymentAmount).toBe(1n);
    expect(r.simulation.mode).toBe("SHARES");
    expect(r.simulation.sharesBurned).toBe(1n);
    expect(r.simulation.remainingTotalBorrowAssets).toBe(0n);
    expect(r.modeledPostRepaymentDebt).toBe(0n);
    expect(r.modeledResultingRatioWad).toBeNull();
  });

  it("models a valid asset payment that burns zero shares without inventing debt reduction", () => {
    const s = state(10_000_000n, 1n, 1n);
    const result = simulateRepayment(s, 1n);
    expect(result.mode).toBe("ASSETS");
    expect(result.sharesBurned).toBe(0n);
    expect(result.remainingDebt).toBe(s.debt);
  });

  it("returns zero and NONE when already at or above target", () => {
    const s = state(29n, 2_000_003n, 1_000_001n);
    for (const capacity of [13n, 100n]) {
      const r = solveMinimumRepayment(s, capacity, target);
      expect(r.repaymentAmount).toBe(0n);
      expect(r.simulation.mode).toBe("NONE");
      expect(r.modeledPostRepaymentDebt).toBe(s.debt);
      expect(r.proof.previousAmount).toBeNull();
    }
  });

  it("handles actual zero shares/debt and an empty market", () => {
    const r = solveMinimumRepayment(state(0n, 0n, 0n), 0n, target);
    expect(r.repaymentAmount).toBe(0n);
    expect(r.modeledPostRepaymentDebt).toBe(0n);
    expect(r.modeledResultingRatioWad).toBeNull();
    expect(r.proof.targetSatisfied).toBe(true);
  });

  it("uses the virtual assets/shares, including a one-unit surplus over market assets", () => {
    const s = state(5n, 2_000_003n, 1_000_001n);
    expect(s.debt).toBe(2n);
    expect(toAssetsUp(s.borrowShares, s.totalBorrowAssets, s.totalBorrowShares)).toBe(s.debt);
    const r = solveMinimumRepayment(s, 2n, target);
    expect(r.initialRepaymentEstimate).toBe(1n);
    expect(r.repaymentAmount).toBe(2n);
    expect(r.simulation.mode).toBe("SHARES");
    expect(r.modeledPostRepaymentDebt).toBe(0n);
  });

  it("proves the minimum against exhaustive asset AND share repayment choices on small states", () => {
    for (const assets of [0n, 1n, 29n, 999_999n, 1_000_000n, 5_000_001n]) {
      for (let totalShares = 0n; totalShares <= 8n; totalShares += 1n) {
        for (let borrower = 0n; borrower <= totalShares; borrower += 1n) {
          const s = state(assets, totalShares, borrower);
          for (const capacity of [0n, 1n, s.debt / 2n, s.debt, s.debt * 2n]) {
            const allowed = capacity * WAD / target;
            const validCosts: bigint[] = [];
            for (let paid = 0n; paid <= s.debt; paid += 1n) {
              const burned = paid * (totalShares + 1_000_000n) / (assets + 1n);
              if (burned <= borrower && independentRemaining(s, paid, burned) <= allowed) validCosts.push(paid);
            }
            for (let burned = 0n; burned <= borrower; burned += 1n) {
              const paid = ceil(burned * (assets + 1n), totalShares + 1_000_000n);
              if (independentRemaining(s, paid, burned) <= allowed) validCosts.push(paid);
            }
            const expected = validCosts.reduce((min, cost) => cost < min ? cost : min, s.debt);
            expect(solveMinimumRepayment(s, capacity, target).repaymentAmount).toBe(expected);
          }
        }
      }
    }
  });

  it("has monotone post-debt across coarse/high-resolution share rates", () => {
    for (const assets of [0n, 5n, 29n, 97n]) {
      for (const total of [1n, 999_999n, 1_000_000n, 2_000_003n, 10_000_001n]) {
        for (const borrower of [1n, total / 2n, total]) {
          const s = state(assets, total, borrower);
          let last = s.debt;
          for (let paid = 0n; paid <= s.debt; paid += 1n) {
            const next = simulateRepayment(s, paid).remainingDebt;
            expect(next).toBeLessThanOrEqual(last);
            if (paid < s.debt) expect(next).toBeGreaterThanOrEqual(s.debt - paid);
            last = next;
          }
        }
      }
    }
  });

  it("terminates with exact inequalities on large uint128-scale positions", () => {
    const s = state(10n ** 30n, 10n ** 35n, 3n * 10n ** 34n);
    const r = solveMinimumRepayment(s, s.debt, target);
    expect(r.modeledPostRepaymentDebt * target).toBeLessThanOrEqual(s.debt * WAD);
    expect(r.proof.previousAmountPostDebt!).toBeGreaterThan(r.allowedDebt);
    expect(r.proof.searchIterations).toBeLessThanOrEqual(129);
  });

  it("rejects incoherent totals, debt and over-burn inputs", () => {
    const s = state(29n, 2_000_003n, 1_000_001n);
    expect(() => solveMinimumRepayment({ ...s, debt: s.debt + 1n }, 10n, target)).toThrow();
    expect(() => solveMinimumRepayment({ ...s, borrowShares: s.totalBorrowShares + 1n }, 10n, target)).toThrow();
    expect(() => simulateRepayment(s, s.debt + 1n)).toThrow();
    expect(() => simulateRepayment(s, -1n)).toThrow();
    expect(() => solveMinimumRepayment(s, 1n, 0n)).toThrow();
  });

  it("rejects storage and checked-multiply/rounding overflow", () => {
    const s = state(29n, 2_000_003n, 1_000_001n);
    expect(() => solveMinimumRepayment({ ...s, totalBorrowAssets: U128_MAX + 1n }, 1n, target)).toThrow();
    expect(() => solveMinimumRepayment(state(U128_MAX, U128_MAX, U128_MAX), 1n, target)).toThrow();
    expect(() => solveMinimumRepayment(s, U256_MAX, target)).toThrow();
    expect(() => solveMinimumRepayment(s, 1n, U256_MAX + 1n)).toThrow();
  });
});
