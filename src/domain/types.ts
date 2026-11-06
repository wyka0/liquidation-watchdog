import type { Address, Hex } from "viem";

export type QualityStatus = "VALID" | "STALE" | "UNAVAILABLE" | "INVALID" | "UNVERIFIED";
export type Scope = "network" | "contracts" | "market" | "position" | "tokens" | "oracle" | "accounting" | "consistency" | "snapshot";
export type SourceKind = "rpc" | "mcp";
export type EvidenceKind = "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE";

export interface Finding {
  scope: Scope;
  status: Exclude<QualityStatus, "VALID">;
  code: string;
  message: string;
}

export interface BlockRef {
  number: bigint;
  hash: Hex;
  parentHash: Hex;
  timestamp: bigint;
}

export interface MarketParams {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
}

export interface Market {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
}

export interface Position {
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
}

export interface TokenMetadata {
  address: Address;
  decimals: number;
  name: string;
  symbol: string;
}

export interface FeedRound {
  roundId: bigint;
  answer: bigint;
  startedAt: bigint;
  updatedAt: bigint;
  answeredInRound: bigint;
}

export interface OracleComposition {
  baseVault: Address;
  quoteVault: Address;
  baseFeed1: Address;
  baseFeed2: Address;
  quoteFeed1: Address;
  quoteFeed2: Address;
  baseVaultConversionSample: bigint;
  quoteVaultConversionSample: bigint;
  scaleFactor: bigint;
}

export interface OracleRead {
  address: Address;
  price: bigint | null;
  composition: OracleComposition | null;
  feed: Address;
  feedId: Hex | null;
  decimals: number | null;
  description: string | null;
  typeAndVersion: string | null;
  round: FeedRound | null;
  latestTimestamp: bigint | null;
  proxyOwner: Address | null;
  cache: Address | null;
  cacheTypeAndVersion: string | null;
  cacheOwner: Address | null;
  forwarder: Address | null;
  forwarderOwner: Address | null;
  forwarderTypeAndVersion: string | null;
  allowedWorkflowOwner: Address | null;
  cacheAnswer: bigint | null;
  cacheTimestamp: bigint | null;
  ageSeconds: bigint | null;
  quality: QualityStatus;
  policy: {
    sourceVerified: boolean;
    operatorIdentityVerified: boolean;
    timestampSemanticsVerified: boolean;
    timestampMeaning: string;
    heartbeatSeconds: bigint | null;
    heartbeatVerified: boolean;
    expectedUpdateFrequency: string;
    stalenessEnforcedOnchain: boolean | null;
    references: readonly string[];
  };
}

export interface ContractEvidence {
  label: string;
  address: Address;
  blockNumber: bigint;
  byteLength: number;
  keccak256: Hex;
  sha256: string;
  expectedRuntimeHash: Hex | null;
  runtimeHashMatches: boolean | null;
  mcpMatchesRpc: boolean;
}

export interface ReadRecord {
  source: SourceKind;
  endpoint: string;
  method: string;
  blockNumber: bigint | null;
  params: unknown;
  result: unknown;
  retrievedAt: string;
}

export interface Comparison {
  label: string;
  blockNumber: bigint | null;
  matches: boolean;
  rpcDigest: string;
  mcpDigest: string;
}

export interface Accrual {
  elapsedSeconds: bigint;
  ratePerSecondWad: bigint;
  firstTerm: bigint;
  secondTerm: bigint;
  thirdTerm: bigint;
  interest: bigint;
  accruedBorrowAssets: bigint;
  accruedSupplyAssets: bigint;
  accruedSupplyShares: bigint;
  totalBorrowShares: bigint;
  feeAmount: bigint;
  feeShares: bigint;
  debt: bigint;
}

export interface Valuation {
  collateralValue: bigint;
  maxBorrow: bigint;
  ltvWad: bigint | null;
  safetyRatioWad: bigint | null;
  debtState: "NO_DEBT" | "OUTSTANDING_DEBT";
  indicative: true;
  actionable: false;
}

export interface Snapshot {
  schemaVersion: 1;
  evidenceKind: EvidenceKind;
  network: { name: string; chainId: number; rpc: string; mcp: string; explorer: string };
  account: Address;
  accountRole: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET" | "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
  marketId: Hex;
  startedAt: string;
  retrievedAt: string;
  block: BlockRef | null;
  heads: { rpc: bigint | null; mcp: bigint | null; selectionLagBlocks: bigint };
  observedChainIds: { rpc: bigint | null; mcp: bigint | null };
  contracts: ContractEvidence[];
  params: MarketParams | null;
  derivedMarketId: Hex | null;
  market: Market | null;
  position: Position | null;
  tokens: { loan: TokenMetadata | null; collateral: TokenMetadata | null };
  oracle: OracleRead;
  borrowRatePerSecondWad: bigint | null;
  accounting: Accrual | null;
  valuation: Valuation | null;
  consistency: {
    rpcBefore: BlockRef | null;
    mcpBefore: BlockRef | null;
    rpcAfter: BlockRef | null;
    mcpAfter: BlockRef | null;
    blockHashesStable: boolean;
    batchSentinelsChecked: number;
    comparisons: Comparison[];
  };
  quality: {
    overall: QualityStatus;
    byScope: Record<Scope, QualityStatus>;
    findings: Finding[];
  };
  accepted: boolean;
  actionable: false;
  reads: ReadRecord[];
}
