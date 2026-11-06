import { describe, expect, it } from "vitest";
import { accruePosition, valuePosition } from "../src/morpho/accounting.js";
import { ORACLE_SCALE, WAD } from "../src/morpho/math.js";
import { solveAdditionalCollateral } from "../src/risk/collateral.js";
import { U128_MAX, U256_MAX } from "../src/validation/schemas.js";
import * as f from "./fixtures/state.js";

const target = 5n * WAD / 4n;

describe("FIXTURE: conservative collateral target recovery", () => {
  it("reaches the historical fixture target and proves one collateral unit less fails", () => {
    const a = accruePosition(f.params, f.market, f.position, f.historicalBlock.timestamp, f.rate);
    const r = solveAdditionalCollateral(f.position.collateral, f.price, f.params.lltv, a.debt, target);
    expect(r.additionalCollateral).toBeGreaterThan(0n);
    expect(r.modeledCapacity * WAD).toBeGreaterThanOrEqual(a.debt * target);
    expect(r.proof.previousCollateralCapacity!).toBeLessThan(r.requiredCapacity);
    expect(r.modeledNewCollateral).toBe(f.position.collateral + r.additionalCollateral);
    expect(r.roundingMargin.correctionCollateralUnits).toBe(0n);
  });

  it("rounds every inverse stage upward and verifies the two forward floors", () => {
    const r = solveAdditionalCollateral(1n, 2n * ORACLE_SCALE, WAD / 3n, 1n, target);
    expect(r.requiredCapacity).toBe(2n);
    expect(r.requiredCollateralValue).toBe(7n);
    expect(r.requiredCollateral).toBe(4n);
    expect(r.additionalCollateral).toBe(3n);
    expect(r.modeledCollateralValue).toBe(8n);
    expect(r.modeledCapacity).toBe(2n);
    expect(r.proof.previousCollateralCapacity).toBe(1n);
  });

  it("returns zero when the current collateral already reaches target", () => {
    const r = solveAdditionalCollateral(20n, ORACLE_SCALE, WAD / 2n, 5n, target);
    expect(r.additionalCollateral).toBe(0n);
    expect(r.modeledNewCollateral).toBe(20n);
    expect(r.modeledPostAdditionRatioWad).toBe(2n * WAD);
    expect(r.proof.previousCollateralCapacity).toBeNull();
  });

  it("preserves zero debt and undefined ratio without proposing extra collateral", () => {
    const r = solveAdditionalCollateral(0n, ORACLE_SCALE, WAD / 2n, 0n, target);
    expect(r.additionalCollateral).toBe(0n);
    expect(r.requiredCapacity).toBe(0n);
    expect(r.modeledPostAdditionRatioWad).toBeNull();
  });

  it("handles zero collateral with one loan-base-unit debt", () => {
    const r = solveAdditionalCollateral(0n, ORACLE_SCALE, WAD / 2n, 1n, target);
    expect(r.additionalCollateral).toBe(4n);
    expect(r.modeledCapacity).toBe(2n);
    expect(r.modeledPostAdditionRatioWad).toBe(2n * WAD);
  });

  it.each([1n, 10n ** 24n, 1n << 240n])("handles extreme positive oracle price %s within checked arithmetic bounds", price => {
    const r = solveAdditionalCollateral(0n, price, WAD / 2n, 1n, target);
    expect(r.modeledCapacity * WAD).toBeGreaterThanOrEqual(target);
    expect(r.proof.previousCollateralCapacity!).toBeLessThan(r.requiredCapacity);
    expect(r.additionalCollateral).toBeGreaterThan(0n);
  });

  it("matches exhaustive small collateral searches with fractional prices and LLTVs", () => {
    for (const price of [ORACLE_SCALE / 3n, ORACLE_SCALE, 3n * ORACLE_SCALE / 2n, 7n * ORACLE_SCALE]) {
      for (const lltv of [WAD / 3n, WAD / 2n, 915n * WAD / 1_000n]) {
        for (let debt = 0n; debt <= 12n; debt += 1n) {
          for (const collateral of [0n, 1n, 17n, 100n]) {
            const r = solveAdditionalCollateral(collateral, price, lltv, debt, target);
            let expected = 0n;
            // Independent scalar predicate: uses exact two-stage floors and cross-products.
            while ((((collateral + expected) * price / ORACLE_SCALE) * lltv / WAD) * WAD < debt * target) expected += 1n;
            expect(r.additionalCollateral).toBe(expected);
            expect(r.roundingMargin.correctionCollateralUnits).toBe(0n);
          }
        }
      }
    }
  });

  it("rejects zero/invalid prices and LLTV, including zero-debt inputs", () => {
    for (const price of [0n, -1n, U256_MAX + 1n]) expect(() => solveAdditionalCollateral(0n, price, WAD / 2n, 0n, target)).toThrow();
    for (const lltv of [0n, -1n, WAD, WAD + 1n]) expect(() => solveAdditionalCollateral(0n, ORACLE_SCALE, lltv, 1n, target)).toThrow();
    expect(() => solveAdditionalCollateral(0n, ORACLE_SCALE, WAD / 2n, 1n, 0n)).toThrow();
  });

  it("rejects unrepresentable collateral and inverse-product overflow", () => {
    expect(() => solveAdditionalCollateral(0n, 1n, WAD / 2n, 1_000n, target)).toThrow();
    expect(() => solveAdditionalCollateral(U128_MAX + 1n, 1n, WAD / 2n, 1n, target)).toThrow();
    expect(() => solveAdditionalCollateral(0n, ORACLE_SCALE, WAD / 2n, 10n, U256_MAX)).toThrow();
    expect(() => solveAdditionalCollateral(0n, U256_MAX, WAD / 2n, 1n, target)).toThrow();
    expect(() => valuePosition(U128_MAX, U256_MAX, WAD / 2n, 1n)).toThrow();
  });
});
