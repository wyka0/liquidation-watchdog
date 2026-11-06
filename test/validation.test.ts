import { describe, expect, it } from "vitest";
import { zeroAddress } from "viem";
import { DEPLOYMENT } from "../src/config/deployment.js";
import { deriveMarketId, validateChainId, validateMarket, validateMarketParams, validatePosition, validateToken } from "../src/validation/market.js";
import { quantitySchema } from "../src/validation/schemas.js";
import { canCalculate, worstQuality } from "../src/validation/quality.js";
import { WAD } from "../src/morpho/math.js";
import * as f from "./fixtures/state.js";

describe("FIXTURE: chain-bound market validation", () => {
  it("recomputes the official market ID from ABI-encoded parameters", () => {
    expect(deriveMarketId(f.params)).toBe(DEPLOYMENT.marketId);
    expect(validateMarketParams(f.params)).toEqual(f.params);
    expect(deriveMarketId({ ...f.params, lltv: f.params.lltv - 1n })).not.toBe(DEPLOYMENT.marketId);
  });
  it("rejects absent markets and wrong token, IRM, oracle, or LLTV bindings", () => {
    expect(() => validateMarketParams({ ...f.params, loanToken: zeroAddress })).toThrow();
    for (const field of ["loanToken", "collateralToken", "oracle", "irm"] as const) {
      expect(() => validateMarketParams({ ...f.params, [field]: DEPLOYMENT.account })).toThrow();
    }
    for (const lltv of [0n, WAD, f.params.lltv - 1n]) expect(() => validateMarketParams({ ...f.params, lltv })).toThrow();
    expect(() => validateMarketParams({ ...f.params, lltv: "915000000000000000" })).toThrow();
  });
  it("validates market existence, totals, last update, fee and uint128 widths", () => {
    expect(validateMarket(f.market, f.historicalBlock)).toEqual(f.market);
    for (const invalid of [
      { lastUpdate: 0n }, { lastUpdate: f.historicalBlock.timestamp + 1n },
      { totalBorrowAssets: f.market.totalSupplyAssets + 1n }, { fee: WAD }, { totalBorrowShares: 1n << 128n }
    ]) expect(() => validateMarket({ ...f.market, ...invalid }, f.historicalBlock)).toThrow();
  });
  it("distinguishes a valid zero-debt account from unavailable or inconsistent data", () => {
    expect(validatePosition({ ...f.position, borrowShares: 0n }, f.market).borrowShares).toBe(0n);
    expect(() => validatePosition(null, f.market)).toThrow();
    expect(() => validatePosition({ ...f.position, borrowShares: f.market.totalBorrowShares + 1n }, f.market)).toThrow();
    expect(() => validatePosition({ ...f.position, supplyShares: f.market.totalSupplyShares + 1n }, f.market)).toThrow();
  });
  it("uses addresses rather than symbols for identity and validates decimals", () => {
    const token = { address: DEPLOYMENT.loanToken, name: "USD Coin", symbol: "USDC", decimals: 6 };
    expect(validateToken(token, "loan")).toEqual(token);
    expect(validateToken({ ...token, symbol: "OTHER" }, "loan").address).toBe(token.address);
    expect(() => validateToken({ ...token, address: DEPLOYMENT.account }, "loan")).toThrow();
    expect(() => validateToken({ ...token, decimals: 18 }, "loan")).toThrow();
    expect(() => validateToken({ ...token, symbol: "\u001b[31mFAKE" }, "loan")).toThrow();
  });
  it("rejects wrong chains and lossy/malformed numeric RPC fields", () => {
    expect(() => validateChainId(1n)).toThrow();
    expect(() => validateChainId(1672n)).not.toThrow();
    for (const input of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1, "1e18", "0x", null]) expect(quantitySchema.safeParse(input).success).toBe(false);
  });
  it("never lets a provisional calculation override a failed quality check", () => {
    expect(worstQuality(["VALID", "UNVERIFIED", "UNAVAILABLE", "INVALID"])).toBe("INVALID");
    expect(worstQuality(["UNVERIFIED", "STALE"])).toBe("STALE");
    expect(canCalculate("UNVERIFIED")).toBe(true);
    for (const state of ["STALE", "UNAVAILABLE", "INVALID"] as const) expect(canCalculate(state)).toBe(false);
  });
});
