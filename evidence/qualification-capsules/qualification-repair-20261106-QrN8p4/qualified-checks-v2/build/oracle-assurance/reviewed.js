import { DEPLOYMENT, NETWORK } from "../config/deployment.js";
import { FORWARDER } from "./configuration.js";
// Reviewed source claims are code/runtime-bound, not claims about the feed's economic upstream.
export const REVIEWED_SOURCES = [
    [DEPLOYMENT.feed, "SelfManagedFeedsCacheProxy.sol", "cc61c1da8e2c5b6c25ed1c10db8851226b36a120616aefda8e978d8280b4cefe", "2026-11-01T13:50:02.085Z"],
    [DEPLOYMENT.cache, "SelfManagedFeedsCache.sol", "602a035ebd7ec5d258715dcb0e5c61d679f072b89ae774824668e4a13dcbd461", "2026-11-01T13:50:02.821Z"],
    [FORWARDER, "KeystoneForwarder.sol", "edae1208bfe3f3f311382e05470e8954067324ff7bfdcee7772f2e8d20e0542c", "2026-11-01T13:50:08.023Z"],
    [DEPLOYMENT.oracle, "verified-ChainlinkDataFeedLib.sol", "82b18d00ba9c278686f5483df5ca3881f3bc2200d7532500c80b7ea81359ae06", "2026-11-01T13:50:09.686Z"]
].map(([subjectAddress, file, artifactSha256, retrievedAt]) => ({
    subjectAddress: subjectAddress, chainId: NETWORK.chainId, source: `evidence/phase1/sources/${file}`, sourceKind: "VERIFIED_SOURCE",
    block: null, retrievedAt: retrievedAt, method: "Inspected explorer source; bind behavior only when deployed runtime matches the reviewed hash.",
    artifactSha256: artifactSha256, confidence: "PROVEN", unresolved: ["Source comments and interface names do not prove source operation, economic quote or operator identity."]
}));
// Populated only after the separately archived compiler reproduction has been inspected.
export const RESEARCH_BUNDLE = "evidence/phase4/oracle-research-2026-11-01T17-23-46-683Z-9ad554c5-ffdd-4f43-83d7-3a52a8abd91f";
export const REVIEWED_RECOMPILATION = [DEPLOYMENT.morpho, DEPLOYMENT.oracle, DEPLOYMENT.feed, DEPLOYMENT.cache, FORWARDER].map(subjectAddress => ({
    subjectAddress, chainId: NETWORK.chainId, source: `${RESEARCH_BUNDLE}/independent-recompilation.json`, sourceKind: "COMPILER",
    block: { number: "21864844", hash: "0x34bed88e5dcc0890c2087cc2f2c7f71a484e74bd7a140cb5f8449c4196a61f8b", timestamp: "1793553649" },
    retrievedAt: "2026-11-01T17:23:46.680Z", method: "Exact-version native solc with SHA-256 and Keccak release checks; full runtime equality, with public-getter immutable binding where needed.",
    artifactSha256: "1d8626de9a4b8136a84e3dd625e00891fc05302879bd1c1525fce7e17d0bffcb", confidence: "PROVEN",
    unresolved: ["This is bytecode reproduction, not proof of feed economics, operator identity or heartbeat."]
}));
export const ISSUER_IDENTITY_EVIDENCE = {
    subjectAddress: DEPLOYMENT.collateralToken, chainId: NETWORK.chainId,
    source: "evidence/phase4/independent-research-2026-11-01T17-30-38-572Z-cf7ce161-e80a-412c-aad3-79f1f03a8d15/reservoir-addresses.json", sourceKind: "OFFICIAL_DOCUMENT",
    block: null, retrievedAt: "2026-11-01T17:30:37.716Z", method: "Full bounded issuer registry and exact Pharos table row map chain-1672 collateral to wsrUSD; economic equivalence and feed quote remain separate questions.",
    artifactSha256: "9d5055471d0c44d2a7dbb46b1e212fe26896feec6c13ea6cd170d49596f52a2c", confidence: "PROVEN",
    unresolved: ["No selected-feed price mapping, USDC market quote or independence from the selected upstream is established."]
};
//# sourceMappingURL=reviewed.js.map