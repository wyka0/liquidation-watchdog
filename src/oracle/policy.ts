import type { Address, Hex } from "viem";
import { DEPLOYMENT, NETWORK, RUNTIME_HASHES, SOURCES } from "../config/deployment.js";

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

// No command-line or environment option can promote this to a verified heartbeat.
// Production has no established upstream workflow/feed identity or update SLA.
export const SELECTED_ORACLE_POLICY: Readonly<OraclePolicy> = Object.freeze({
  chainId: NETWORK.chainId,
  oracle: DEPLOYMENT.oracle,
  feed: DEPLOYMENT.feed,
  cache: DEPLOYMENT.cache,
  feedId: DEPLOYMENT.feedId,
  feedRuntimeHash: RUNTIME_HASHES.feed,
  cacheRuntimeHash: RUNTIME_HASHES.cache,
  sourceVerified: false,
  operatorIdentityVerified: false,
  timestampSemanticsVerified: true,
  heartbeatVerified: false,
  heartbeatSeconds: null,
  references: [SOURCES.proxy, SOURCES.cache, SOURCES.oracle]
});
