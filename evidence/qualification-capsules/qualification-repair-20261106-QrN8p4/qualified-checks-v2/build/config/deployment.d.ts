import type { Hex } from "viem";
export declare const NETWORK: Readonly<{
    name: "Pharos Pacific Mainnet";
    chainId: 1672;
    rpc: "https://rpc.pharos.xyz";
    mcp: "https://mcp.pharos.xyz/mcp";
    explorer: "https://www.pharosscan.xyz";
}>;
export declare const DEPLOYMENT: Readonly<{
    morpho: `0x${string}`;
    irm: `0x${string}`;
    oracleFactory: `0x${string}`;
    oracle: `0x${string}`;
    feed: `0x${string}`;
    cache: `0x${string}`;
    loanToken: `0x${string}`;
    collateralToken: `0x${string}`;
    multicall: `0x${string}`;
    marketId: Hex;
    account: `0x${string}`;
    lltv: 915000000000000000n;
    loanDecimals: 6;
    collateralDecimals: 18;
    feedDecimals: 18;
    scaleFactor: 1000000n;
    feedId: Hex;
}>;
export declare const RUNTIME_HASHES: Readonly<{
    multicall: Hex;
    feed: Hex;
    cache: Hex;
}>;
export declare const READ_LIMITS: Readonly<{
    timeoutMs: 15000;
    attempts: 3;
    minIntervalMs: 750;
    maxRetryDelayMs: 15000;
    blockLag: 5n;
    maxBatchCalls: 48;
    maxLogBlocks: 1000n;
}>;
export declare const SOURCES: Readonly<{
    registry: "https://docs.morpho.org/developers/contracts/addresses/";
    morpho: "https://github.com/morpho-org/morpho-blue/tree/v1.0.0";
    oracle: "https://github.com/morpho-org/morpho-blue-oracles/tree/v2.0.0";
    proxy: "https://smart-contract-verify-service-4lladlc2eq-uc.a.run.app/v1/contract_verify/files/1672/0xb5779919e2f183e59a34140331f7779cbff1d1bc/src/SelfManagedFeedsCacheProxy.sol";
    cache: "https://smart-contract-verify-service-4lladlc2eq-uc.a.run.app/v1/contract_verify/files/1672/0xd9f00c86ced2de92f6b7152b0492cb28edc4b5a8/src/SelfManagedFeedsCache.sol";
    multicall: "https://smart-contract-verify-service-4lladlc2eq-uc.a.run.app/v1/contract_verify/files/1672/0xca11bde05977b3631167028862be2a173976ca11/0xca11bde05977b3631167028862be2a173976ca11.sol";
    mcp: "https://docs.pharos.xyz/tooling-and-infrastructure/mcp";
}>;
