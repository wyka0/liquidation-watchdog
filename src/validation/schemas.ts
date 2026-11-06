import { getAddress, isAddress } from "viem";
import type { Hex } from "viem";
import { z } from "zod";
import { DataError } from "../domain/errors.js";
import type { Scope } from "../domain/types.js";

export const U128_MAX = (1n << 128n) - 1n;
export const U256_MAX = (1n << 256n) - 1n;
export const uint256Schema = z.bigint().min(0n).max(U256_MAX);
export const uint128Schema = z.bigint().min(0n).max(U128_MAX);
export const addressSchema = z.string().refine(value => isAddress(value, { strict: true })).transform(value => getAddress(value));
export const bytesSchema = z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/).transform(value => value.toLowerCase() as Hex);
export const hashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value.toLowerCase() as Hex);
export const quantitySchema = z.union([
  z.string().regex(/^(?:0x[0-9a-fA-F]+|0|[1-9][0-9]*)$/),
  z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
]).transform(value => BigInt(value)).pipe(uint256Schema);
export const metadataTextSchema = z.string().min(1).max(120).refine(value =>
  !/[\p{Cc}\p{Cf}]/u.test(value) && value.trim() === value, "Unsafe or empty metadata text"
);

export const blockSchema = z.object({
  number: quantitySchema,
  hash: hashSchema,
  parentHash: hashSchema,
  timestamp: quantitySchema
});

export const marketParamsSchema = z.object({
  loanToken: addressSchema,
  collateralToken: addressSchema,
  oracle: addressSchema,
  irm: addressSchema,
  lltv: uint256Schema
}).strict();

export const marketSchema = z.object({
  totalSupplyAssets: uint128Schema,
  totalSupplyShares: uint128Schema,
  totalBorrowAssets: uint128Schema,
  totalBorrowShares: uint128Schema,
  lastUpdate: uint128Schema,
  fee: uint128Schema
}).strict();

export const positionSchema = z.object({
  supplyShares: uint256Schema,
  borrowShares: uint128Schema,
  collateral: uint128Schema
}).strict();

export const tokenSchema = z.object({
  address: addressSchema,
  decimals: z.number().int().min(0).max(77),
  name: metadataTextSchema,
  symbol: metadataTextSchema
}).strict();

export function parseData<T>(schema: z.ZodType<T>, raw: unknown, code: string, scope: Scope): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new DataError(code, `${scope}: malformed or out-of-range data.`, scope);
  return parsed.data;
}

export function sameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
