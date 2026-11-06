import type { Hex } from "viem";
import type { BlockRef, Market, MarketParams, Position, TokenMetadata } from "../domain/types.js";
export declare function validateChainId(chainId: bigint): void;
export declare function deriveMarketId(params: MarketParams): Hex;
export declare function validateMarketParams(raw: unknown): MarketParams;
export declare function validateMarket(raw: unknown, block: BlockRef): Market;
export declare function validatePosition(raw: unknown, market: Market): Position;
export declare function validateToken(raw: unknown, role: "loan" | "collateral"): TokenMetadata;
