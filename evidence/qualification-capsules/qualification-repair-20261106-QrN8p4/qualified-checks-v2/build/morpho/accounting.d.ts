import type { Accrual, Market, MarketParams, Position, Valuation } from "../domain/types.js";
export declare function accruePosition(params: MarketParams, rawMarket: Market, rawPosition: Position, blockTimestamp: bigint, rate: bigint): Accrual;
export declare function valuePosition(collateral: bigint, price: bigint, lltv: bigint, debt: bigint): Valuation;
