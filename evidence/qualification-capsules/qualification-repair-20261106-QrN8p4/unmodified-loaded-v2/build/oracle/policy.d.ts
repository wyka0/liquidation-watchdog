import type { Address, Hex } from "viem";
export interface OraclePolicy {
    chainId: number;
    oracle: Address;
    feed: Address;
    cache: Address;
    feedId: Hex;
    feedRuntimeHash: Hex;
    cacheRuntimeHash: Hex;
    sourceVerified: boolean;
    operatorIdentityVerified: boolean;
    timestampSemanticsVerified: boolean;
    heartbeatVerified: boolean;
    heartbeatSeconds: bigint | null;
    references: readonly string[];
}
export declare const SELECTED_ORACLE_POLICY: Readonly<OraclePolicy>;
