import { getAddress } from "viem";
import type { Address, Hex } from "viem";

const address = (value: string): Address => getAddress(value.toLowerCase());

export const NETWORK = Object.freeze({
  name: "Pharos Pacific Mainnet",
  chainId: 1672,
  rpc: "https://rpc.pharos.xyz",
  mcp: "https://mcp.pharos.xyz/mcp",
  explorer: "https://www.pharosscan.xyz"
});

export const DEPLOYMENT = Object.freeze({
  morpho: address("0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb"),
  irm: address("0xD5E02889C13230458506CC842347c4E62F8cDF3a"),
  oracleFactory: address("0xb8118256d8Aa950ec0B26a0b8Be7C6c1a858f6a3"),
  oracle: address("0x9416F861970C2a39c02ab7696Ef0496383d4E81b"),
  feed: address("0xb5779919e2F183e59A34140331F7779cbFF1d1BC"),
  cache: address("0xd9F00c86ced2De92F6B7152b0492cb28edc4B5a8"),
  loanToken: address("0xC879C018dB60520F4355C26eD1a6D572cdAC1815"),
  collateralToken: address("0x4809010926aec940b550D34a46A52739f996D75D"),
  multicall: address("0xcA11bde05977b3631167028862bE2a173976CA11"),
  marketId: "0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73" as Hex,
  account: address("0xc6dd9976066f3364b4d6a72cd4f1fa0468327aa7"),
  lltv: 915_000_000_000_000_000n,
  loanDecimals: 6,
  collateralDecimals: 18,
  feedDecimals: 18,
  scaleFactor: 1_000_000n,
  feedId: "0x0007c129e624689953a2636c014531b2f0bd0c15f9a22211f53023354f309fa6" as Hex
});

// Runtime pins linked to explorer-verified source in evidence/phase1/sources/.
// These bind contract behavior, not upstream price-data authenticity.
export const RUNTIME_HASHES = Object.freeze({
  multicall: "0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891" as Hex,
  feed: "0xace6df7e3159128786ca24c6ad172b38b0d69ae20f4fa8edae07ea0d39f93c9d" as Hex,
  cache: "0xa408ee37af0e83e6c4fab1f1a3c7927c8253b02ea28dbe14e9eaec9d123e9869" as Hex
});

export const READ_LIMITS = Object.freeze({
  timeoutMs: 15_000,
  attempts: 3,
  minIntervalMs: 750,
  maxRetryDelayMs: 15_000,
  blockLag: 5n,
  maxBatchCalls: 48,
  maxLogBlocks: 1_000n
});

export const SOURCES = Object.freeze({
  registry: "https://docs.morpho.org/developers/contracts/addresses/",
  morpho: "https://github.com/morpho-org/morpho-blue/tree/v1.0.0",
  oracle: "https://github.com/morpho-org/morpho-blue-oracles/tree/v2.0.0",
  proxy: "https://smart-contract-verify-service-4lladlc2eq-uc.a.run.app/v1/contract_verify/files/1672/0xb5779919e2f183e59a34140331f7779cbff1d1bc/src/SelfManagedFeedsCacheProxy.sol",
  cache: "https://smart-contract-verify-service-4lladlc2eq-uc.a.run.app/v1/contract_verify/files/1672/0xd9f00c86ced2de92f6b7152b0492cb28edc4b5a8/src/SelfManagedFeedsCache.sol",
  multicall: "https://smart-contract-verify-service-4lladlc2eq-uc.a.run.app/v1/contract_verify/files/1672/0xca11bde05977b3631167028862be2a173976ca11/0xca11bde05977b3631167028862be2a173976ca11.sol",
  mcp: "https://docs.pharos.xyz/tooling-and-infrastructure/mcp"
});
