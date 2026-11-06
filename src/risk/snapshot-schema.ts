import { z } from "zod";
import type { Snapshot } from "../domain/types.js";
import { addressSchema, hashSchema, marketParamsSchema, marketSchema, positionSchema, tokenSchema, uint256Schema } from "../validation/schemas.js";

const quality = z.enum(["VALID", "STALE", "UNAVAILABLE", "INVALID", "UNVERIFIED"]);
const scope = z.enum(["network", "contracts", "market", "position", "tokens", "oracle", "accounting", "consistency", "snapshot"]);
const date = z.iso.datetime();
const nullableUint = uint256Schema.nullable();
const nullableAddress = addressSchema.nullable();
const block = z.object({ number: uint256Schema, hash: hashSchema, parentHash: hashSchema, timestamp: uint256Schema }).strict();
// Phase 1 hashes scalar/code comparisons with bare SHA-256 and Multicall return bytes
// with 0x-prefixed Keccak-256. Preserve both encodings at this compatibility boundary.
const comparisonDigest = z.union([z.string().regex(/^[a-f0-9]{64}$/), hashSchema]);

// This validates the existing in-memory Snapshot boundary; it performs no chain reads.
// Its financial fields must already be bigint, so a lossy JSON/Number conversion is rejected.
export const riskSnapshotSchema: z.ZodType<Snapshot> = z.object({
  schemaVersion: z.literal(1), evidenceKind: z.enum(["LIVE_CHAIN_READ", "HISTORICAL_SNAPSHOT", "FIXTURE"]),
  network: z.object({ name: z.string(), chainId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), rpc: z.string(), mcp: z.string(), explorer: z.string() }).strict(),
  account: addressSchema, accountRole: z.enum(["PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET", "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET"]), marketId: hashSchema,
  startedAt: date, retrievedAt: date, block: block.nullable(),
  heads: z.object({ rpc: nullableUint, mcp: nullableUint, selectionLagBlocks: uint256Schema }).strict(),
  observedChainIds: z.object({ rpc: nullableUint, mcp: nullableUint }).strict(),
  contracts: z.array(z.object({
    label: z.string(), address: addressSchema, blockNumber: uint256Schema, byteLength: z.number().int().nonnegative(),
    keccak256: hashSchema, sha256: z.string().regex(/^[a-f0-9]{64}$/), expectedRuntimeHash: hashSchema.nullable(),
    runtimeHashMatches: z.boolean().nullable(), mcpMatchesRpc: z.boolean()
  }).strict()),
  params: marketParamsSchema.nullable(), derivedMarketId: hashSchema.nullable(), market: marketSchema.nullable(), position: positionSchema.nullable(),
  tokens: z.object({ loan: tokenSchema.nullable(), collateral: tokenSchema.nullable() }).strict(),
  oracle: z.object({
    address: addressSchema, price: nullableUint, feed: addressSchema, feedId: hashSchema.nullable(),
    composition: z.object({
      baseVault: addressSchema, quoteVault: addressSchema, baseFeed1: addressSchema, baseFeed2: addressSchema,
      quoteFeed1: addressSchema, quoteFeed2: addressSchema, baseVaultConversionSample: uint256Schema,
      quoteVaultConversionSample: uint256Schema, scaleFactor: uint256Schema
    }).strict().nullable(),
    decimals: z.number().int().min(0).max(77).nullable(), description: z.string().nullable(), typeAndVersion: z.string().nullable(),
    round: z.object({ roundId: uint256Schema, answer: z.bigint(), startedAt: uint256Schema, updatedAt: uint256Schema, answeredInRound: uint256Schema }).strict().nullable(),
    latestTimestamp: nullableUint, proxyOwner: nullableAddress, cache: nullableAddress, cacheTypeAndVersion: z.string().nullable(),
    cacheOwner: nullableAddress, forwarder: nullableAddress, forwarderOwner: nullableAddress, forwarderTypeAndVersion: z.string().nullable(),
    allowedWorkflowOwner: nullableAddress, cacheAnswer: nullableUint, cacheTimestamp: nullableUint, ageSeconds: nullableUint,
    quality,
    policy: z.object({
      sourceVerified: z.boolean(), operatorIdentityVerified: z.boolean(), timestampSemanticsVerified: z.boolean(), timestampMeaning: z.string(),
      heartbeatSeconds: nullableUint, heartbeatVerified: z.boolean(), expectedUpdateFrequency: z.string(),
      stalenessEnforcedOnchain: z.boolean().nullable(), references: z.array(z.string())
    }).strict()
  }).strict(),
  borrowRatePerSecondWad: nullableUint,
  accounting: z.object({
    elapsedSeconds: uint256Schema, ratePerSecondWad: uint256Schema, firstTerm: uint256Schema, secondTerm: uint256Schema, thirdTerm: uint256Schema,
    interest: uint256Schema, accruedBorrowAssets: uint256Schema, accruedSupplyAssets: uint256Schema, accruedSupplyShares: uint256Schema,
    totalBorrowShares: uint256Schema, feeAmount: uint256Schema, feeShares: uint256Schema, debt: uint256Schema
  }).strict().nullable(),
  valuation: z.object({
    collateralValue: uint256Schema, maxBorrow: uint256Schema, ltvWad: nullableUint, safetyRatioWad: nullableUint,
    debtState: z.enum(["NO_DEBT", "OUTSTANDING_DEBT"]), indicative: z.literal(true), actionable: z.literal(false)
  }).strict().nullable(),
  consistency: z.object({
    rpcBefore: block.nullable(), mcpBefore: block.nullable(), rpcAfter: block.nullable(), mcpAfter: block.nullable(),
    blockHashesStable: z.boolean(), batchSentinelsChecked: z.number().int().nonnegative(),
    comparisons: z.array(z.object({
      label: z.string(), blockNumber: nullableUint, matches: z.boolean(),
      rpcDigest: comparisonDigest, mcpDigest: comparisonDigest
    }).strict())
  }).strict(),
  quality: z.object({
    overall: quality, byScope: z.record(scope, quality),
    findings: z.array(z.object({ scope, status: z.enum(["STALE", "UNAVAILABLE", "INVALID", "UNVERIFIED"]), code: z.string(), message: z.string() }).strict())
  }).strict(),
  accepted: z.boolean(), actionable: z.literal(false),
  reads: z.array(z.object({
    source: z.enum(["rpc", "mcp"]), endpoint: z.string(), method: z.string(), blockNumber: nullableUint,
    params: z.unknown(), result: z.unknown(), retrievedAt: date
  }).strict())
}).strict();

// Retain independently valid provenance even if a financial field is malformed.
export const snapshotIdentitySchema = z.object({
  network: z.object({ chainId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }),
  account: addressSchema, accountRole: z.enum(["PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET", "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET"]),
  marketId: hashSchema, block: block.nullable(),
  evidenceKind: z.enum(["LIVE_CHAIN_READ", "HISTORICAL_SNAPSHOT", "FIXTURE"]), retrievedAt: date
});
