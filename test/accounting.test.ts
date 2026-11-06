import { describe, expect, it } from "vitest";
import { zeroAddress } from "viem";
import { accruePosition, valuePosition } from "../src/morpho/accounting.js";
import { add, mulDivDown, mulDivUp, ORACLE_SCALE, toAssetsUp, WAD } from "../src/morpho/math.js";
import { U128_MAX, U256_MAX } from "../src/validation/schemas.js";
import { formatAmount, parseAmount, validateDecimals } from "../src/validation/decimals.js";
import * as f from "./fixtures/state.js";

describe("FIXTURE: official Morpho v1.0.0 integer accounting", () => {
  it("reproduces Phase 0's historical debt, collateral value and safety ratio", () => {
    const a = accruePosition(f.params, f.market, f.position, f.historicalBlock.timestamp, f.rate);
    expect(a.elapsedSeconds).toBe(766n);
    expect(a.interest).toBe(7_585_260n);
    expect(a.accruedBorrowAssets).toBe(5_390_491_404_029n);
    expect(a.debt).toBe(273_626_732_767n);
    const v = valuePosition(f.position.collateral, f.price, f.params.lltv, a.debt);
    expect(v.collateralValue).toBe(350_475_818_801n);
    expect(v.maxBorrow).toBe(320_685_374_202n);
    expect(v.ltvWad).toBe(780_729_277_423_744_678n);
    expect(v.safetyRatioWad).toBe(1_171_981_154_615_735_623n);
    expect(v.actionable).toBe(false);
  });

  it("does not replace accrued debt with stored share-converted debt", () => {
    const a = accruePosition(f.params, f.market, f.position, f.historicalBlock.timestamp, f.rate);
    expect(a.debt).toBeGreaterThan(toAssetsUp(f.position.borrowShares, f.market.totalBorrowAssets, f.market.totalBorrowShares));
  });

  it("uses the third Taylor term and floors fee shares after adding interest", () => {
    const market = { ...f.market, lastUpdate: 100n, totalBorrowAssets: 6_000n, totalSupplyAssets: 12_000n, totalSupplyShares: 0n, fee: WAD / 4n };
    const a = accruePosition(f.params, market, { ...f.position, supplyShares: 0n, borrowShares: 0n }, 101n, WAD / 10n);
    expect(a.firstTerm).toBe(100_000_000_000_000_000n);
    expect(a.secondTerm).toBe(5_000_000_000_000_000n);
    expect(a.thirdTerm).toBe(166_666_666_666_666n);
    expect(a.interest).toBe(630n);
    expect(a.accruedSupplyAssets).toBe(12_630n);
    expect(a.feeAmount).toBe(157n);
    expect(a.feeShares).toBe(12_586n);
    expect(a.accruedSupplyShares).toBe(12_586n);
  });

  it.each(["elapsed", "borrowAssets", "irm"] as const)("skips accrual when %s is zero, as the official library does", field => {
    const params = field === "irm" ? { ...f.params, irm: zeroAddress } : f.params;
    const market = field === "borrowAssets" ? { ...f.market, totalBorrowAssets: 0n } : f.market;
    const timestamp = field === "elapsed" ? market.lastUpdate : f.historicalBlock.timestamp;
    const a = accruePosition(params, market, f.position, timestamp, U256_MAX);
    expect(a.interest).toBe(0n);
    expect(a.accruedBorrowAssets).toBe(market.totalBorrowAssets);
  });

  it("rounds debt up with virtual assets/shares, including one-base-unit debt", () => {
    expect(toAssetsUp(1n, 0n, 0n)).toBe(1n);
    expect(toAssetsUp(0n, 0n, 0n)).toBe(0n);
    expect(toAssetsUp(1_000_000n, 0n, 0n)).toBe(1n);
    expect(toAssetsUp(1_000_001n, 0n, 0n)).toBe(2n);
  });

  it("satisfies exact ceiling inequalities over diverse share sizes", () => {
    for (const shares of [0n, 1n, 999_999n, 1_000_001n, 10n ** 23n]) {
      for (const assets of [0n, 1n, 1_999n, 10n ** 24n]) {
        const totalShares = 10n ** 25n;
        const numerator = shares * (assets + 1n), denominator = totalShares + 1_000_000n;
        const debt = toAssetsUp(shares, assets, totalShares);
        expect(debt * denominator).toBeGreaterThanOrEqual(numerator);
        if (debt > 0n) expect((debt - 1n) * denominator).toBeLessThan(numerator);
      }
    }
  });

  it("uses 1e36 base-unit pricing for 18-decimal collateral / 6-decimal debt", () => {
    const v = valuePosition(10n ** 18n, 2n * 10n ** 24n, WAD / 2n, 1_000_000n);
    expect(v.collateralValue).toBe(2_000_000n);
    expect(v.maxBorrow).toBe(1_000_000n);
    expect(v.safetyRatioWad).toBe(WAD);
    expect(valuePosition(1n, ORACLE_SCALE - 1n, WAD / 2n, 1n).collateralValue).toBe(0n);
  });

  it("represents no debt with a null ratio and preserves undefined zero-value LTV", () => {
    const noDebt = valuePosition(f.position.collateral, f.price, f.params.lltv, 0n);
    expect(noDebt.debtState).toBe("NO_DEBT");
    expect(noDebt.safetyRatioWad).toBeNull();
    const noCollateral = valuePosition(0n, f.price, f.params.lltv, 1n);
    expect(noCollateral.ltvWad).toBeNull();
    expect(noCollateral.safetyRatioWad).toBe(0n);
  });

  it("rejects checked intermediate overflows even when the final quotient would fit", () => {
    expect(() => mulDivDown(U256_MAX, 2n, 2n)).toThrow();
    expect(() => mulDivUp(U256_MAX, 1n, 2n)).toThrow();
    expect(() => add(U128_MAX, 1n, 128)).toThrow();
    expect(() => accruePosition(f.params, f.market, f.position, f.historicalBlock.timestamp, U256_MAX)).toThrow();
    expect(() => accruePosition(f.params, { ...f.market, totalSupplyAssets: U128_MAX }, f.position, f.historicalBlock.timestamp, f.rate)).toThrow();
  });

  it("rejects negative inputs, zero denominators, invalid fees and future lastUpdate", () => {
    expect(() => mulDivDown(-1n, 1n, 1n)).toThrow();
    expect(() => mulDivUp(1n, 1n, 0n)).toThrow();
    expect(() => accruePosition(f.params, f.market, f.position, f.market.lastUpdate - 1n, f.rate)).toThrow();
    expect(() => accruePosition(f.params, { ...f.market, fee: WAD }, f.position, f.historicalBlock.timestamp, f.rate)).toThrow();
    expect(() => valuePosition(1n, 0n, f.params.lltv, 1n)).toThrow();
  });
});

describe("strict decimal boundaries", () => {
  it("round-trips large amounts without Number conversions", () => {
    const text = "316838.566331327720653953";
    expect(parseAmount(text, 18)).toBe(f.position.collateral);
    expect(formatAmount(parseAmount(text, 18), 18)).toBe(text);
    expect(parseAmount("1.000001", 6)).toBe(1_000_001n);
    expect(parseAmount("1", 0)).toBe(1n);
  });
  it.each(["1e6", "-1", "+1", " 1", "1.", ".1", "01", "1.0000001"])("rejects ambiguous or over-precise amount %s", text => {
    expect(() => parseAmount(text, 6)).toThrow();
  });
  it.each([-1, 1.5, 78, NaN])("rejects invalid decimals %s", value => {
    expect(() => validateDecimals(value)).toThrow();
  });
  it("rejects amounts outside uint256", () => {
    expect(() => parseAmount((U256_MAX + 1n).toString(), 0)).toThrow();
  });
});
