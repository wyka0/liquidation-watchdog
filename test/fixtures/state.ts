import { zeroAddress } from "viem";
import type { BlockRef, Market, MarketParams, Position } from "../../src/domain/types.js";
import { DEPLOYMENT } from "../../src/config/deployment.js";

// FIXTURE: totals/position/rate reproduce Phase 0's historical 21,848,634 read.
// Header parent hash and operational metadata in fake clients are synthetic.
// This is never labeled as a fresh chain read.
export const fixtureKind = "FIXTURE" as const;
export const historicalBlock: BlockRef = {
  number: 21_848_634n,
  hash: "0xe1b135035a9a05dcb3c305303eb4ccf381530fe3fc928d2a0285929d174012c1",
  parentHash: `0x${"22".repeat(32)}`,
  timestamp: 1_793_535_694n
};
export const params: MarketParams = {
  loanToken: DEPLOYMENT.loanToken, collateralToken: DEPLOYMENT.collateralToken,
  oracle: DEPLOYMENT.oracle, irm: DEPLOYMENT.irm, lltv: DEPLOYMENT.lltv
};
export const market: Market = {
  totalSupplyAssets: 5_952_073_982_495n,
  totalSupplyShares: 5_886_569_627_533_310_138n,
  totalBorrowAssets: 5_390_483_818_769n,
  totalBorrowShares: 5_324_169_446_054_473_402n,
  lastUpdate: 1_793_534_928n,
  fee: 0n
};
export const position: Position = {
  supplyShares: 0n, borrowShares: 270_260_163_875_273_673n, collateral: 316_838_566_331_327_720_653_953n
};
export const rate = 1_837_019_108n;
export const answer = 1_106_165_271_671_254_114n;
export const price = answer * 1_000_000n;
export const updatedAt = 1_793_532_274n;
export const round = [0n, answer, updatedAt, updatedAt, 0n] as const;
export const proxyOwner = "0x007DB8D5b32015E34f63Cf5312505ADf03Fcca5d" as const;
export const cacheOwner = "0x59538b88DB99635Eb9181AdFBd1F6CF5588DDFf0" as const;
export const forwarder = "0x76c9cf548b4179F8901cda1f8623568b58215E62" as const;
export const composition = {
  baseVault: zeroAddress, quoteVault: zeroAddress, baseFeed1: DEPLOYMENT.feed,
  baseFeed2: zeroAddress, quoteFeed1: zeroAddress, quoteFeed2: zeroAddress,
  baseVaultConversionSample: 1n, quoteVaultConversionSample: 1n, scaleFactor: 1_000_000n
};
