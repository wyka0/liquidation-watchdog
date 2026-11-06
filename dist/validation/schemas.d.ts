import { z } from "zod";
import type { Scope } from "../domain/types.js";
export declare const U128_MAX: bigint;
export declare const U256_MAX: bigint;
export declare const uint256Schema: z.ZodBigInt;
export declare const uint128Schema: z.ZodBigInt;
export declare const addressSchema: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
export declare const bytesSchema: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
export declare const hashSchema: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
export declare const quantitySchema: z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<bigint, string | number>>, z.ZodBigInt>;
export declare const metadataTextSchema: z.ZodString;
export declare const blockSchema: z.ZodObject<{
    number: z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<bigint, string | number>>, z.ZodBigInt>;
    hash: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
    parentHash: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
    timestamp: z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<bigint, string | number>>, z.ZodBigInt>;
}, z.core.$strip>;
export declare const marketParamsSchema: z.ZodObject<{
    loanToken: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
    collateralToken: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
    oracle: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
    irm: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
    lltv: z.ZodBigInt;
}, z.core.$strict>;
export declare const marketSchema: z.ZodObject<{
    totalSupplyAssets: z.ZodBigInt;
    totalSupplyShares: z.ZodBigInt;
    totalBorrowAssets: z.ZodBigInt;
    totalBorrowShares: z.ZodBigInt;
    lastUpdate: z.ZodBigInt;
    fee: z.ZodBigInt;
}, z.core.$strict>;
export declare const positionSchema: z.ZodObject<{
    supplyShares: z.ZodBigInt;
    borrowShares: z.ZodBigInt;
    collateral: z.ZodBigInt;
}, z.core.$strict>;
export declare const tokenSchema: z.ZodObject<{
    address: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
    decimals: z.ZodNumber;
    name: z.ZodString;
    symbol: z.ZodString;
}, z.core.$strict>;
export declare function parseData<T>(schema: z.ZodType<T>, raw: unknown, code: string, scope: Scope): T;
export declare function sameHex(a: string, b: string): boolean;
