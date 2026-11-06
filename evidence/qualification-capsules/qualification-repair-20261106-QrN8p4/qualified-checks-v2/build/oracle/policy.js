import { DEPLOYMENT, NETWORK, RUNTIME_HASHES, SOURCES } from "../config/deployment.js";
// No command-line or environment option can promote this to a verified heartbeat.
// Production has no established upstream workflow/feed identity or update SLA.
export const SELECTED_ORACLE_POLICY = Object.freeze({
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
//# sourceMappingURL=policy.js.map