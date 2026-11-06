import type { Accrual, Market, MarketParams, Position, Valuation } from "../domain/types.js";
import { DataError } from "../domain/errors.js";
import { zeroAddress } from "viem";
import { add, mul, mulDivDown, ORACLE_SCALE, sub, toAssetsUp, toSharesDown, uint, WAD } from "./math.js";
import { marketSchema, parseData, positionSchema } from "../validation/schemas.js";

export function accruePosition(params: MarketParams, rawMarket: Market, rawPosition: Position, blockTimestamp: bigint, rate: bigint): Accrual {
  const market = parseData(marketSchema, rawMarket, "INVALID_MARKET", "accounting");
  const position = parseData(positionSchema, rawPosition, "INVALID_POSITION", "accounting");
  uint(blockTimestamp);
  uint(rate);
  if (market.fee > WAD / 4n) throw new DataError("INVALID_FEE", "Morpho v1.0.0 caps fees at 25%.", "accounting");
  if (position.borrowShares > market.totalBorrowShares) {
    throw new DataError("POSITION_TOTAL_MISMATCH", "Borrow shares exceed the market total.", "accounting");
  }
  const elapsedSeconds = sub(blockTimestamp, market.lastUpdate);
  let firstTerm = 0n;
  let secondTerm = 0n;
  let thirdTerm = 0n;
  let interest = 0n;
  let feeAmount = 0n;
  let feeShares = 0n;
  let accruedSupplyAssets = market.totalSupplyAssets;
  let accruedBorrowAssets = market.totalBorrowAssets;
  let accruedSupplyShares = market.totalSupplyShares;

  // MorphoBalancesLib v1.0.0: skip all accrual when one of these is zero.
  if (elapsedSeconds !== 0n && market.totalBorrowAssets !== 0n && params.irm.toLowerCase() !== zeroAddress) {
    firstTerm = mul(rate, elapsedSeconds);
    secondTerm = mulDivDown(firstTerm, firstTerm, 2n * WAD);
    thirdTerm = mulDivDown(secondTerm, firstTerm, 3n * WAD);
    interest = mulDivDown(market.totalBorrowAssets, add(add(firstTerm, secondTerm), thirdTerm), WAD);
    // The Solidity library casts interest to uint128 before adding to storage-sized totals.
    accruedBorrowAssets = add(market.totalBorrowAssets, interest, 128);
    accruedSupplyAssets = add(market.totalSupplyAssets, interest, 128);
    if (market.fee !== 0n) {
      feeAmount = mulDivDown(interest, market.fee, WAD);
      feeShares = toSharesDown(feeAmount, sub(accruedSupplyAssets, feeAmount), market.totalSupplyShares);
      accruedSupplyShares = add(market.totalSupplyShares, feeShares, 128);
    }
  }

  return {
    elapsedSeconds, ratePerSecondWad: rate, firstTerm, secondTerm, thirdTerm, interest,
    accruedBorrowAssets, accruedSupplyAssets, accruedSupplyShares,
    totalBorrowShares: market.totalBorrowShares, feeAmount, feeShares,
    debt: toAssetsUp(position.borrowShares, accruedBorrowAssets, market.totalBorrowShares)
  };
}

export function valuePosition(collateral: bigint, price: bigint, lltv: bigint, debt: bigint): Valuation {
  uint(collateral, 128);
  uint(debt);
  if (uint(price) === 0n) throw new DataError("ZERO_PRICE", "A zero price cannot value collateral.", "oracle");
  if (uint(lltv) === 0n || lltv >= WAD) throw new DataError("INVALID_LLTV", "LLTV must be between zero and one WAD.", "market");
  const collateralValue = mulDivDown(collateral, price, ORACLE_SCALE);
  const maxBorrow = mulDivDown(collateralValue, lltv, WAD);
  return {
    collateralValue,
    maxBorrow,
    ltvWad: collateralValue === 0n ? null : mulDivDown(debt, WAD, collateralValue),
    safetyRatioWad: debt === 0n ? null : mulDivDown(maxBorrow, WAD, debt),
    debtState: debt === 0n ? "NO_DEBT" : "OUTSTANDING_DEBT",
    indicative: true,
    actionable: false
  };
}
