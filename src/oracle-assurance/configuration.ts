import { keccak256 } from "viem";
import type { Hex } from "viem";
import { DEPLOYMENT, NETWORK, RUNTIME_HASHES } from "../config/deployment.js";
import type { Snapshot } from "../domain/types.js";
import { stringify } from "../domain/serialize.js";
import { bytesSchema } from "../validation/schemas.js";
import { deriveMarketId } from "../validation/market.js";
import { sha256 } from "./evidence.js";
import { configurationDigest, configurationSchema } from "./model.js";
import type { ConfigurationChange, OracleConfiguration } from "./model.js";

export const FORWARDER = "0x76c9cf548b4179F8901cda1f8623568b58215E62" as const;
export const IDENTITY_PINS = [
  { address: DEPLOYMENT.morpho, keccak256: "0xc7e89967df297eebdb2642ade6225f6a9f72a61862c83de181dd707ff2e2c744", sha256: "5b1b9424a6dc46c6a041f8eb1d69239342e89f3726ea31dc409cae9dd333a55f" },
  { address: DEPLOYMENT.oracle, keccak256: "0x2b4b39be4acacf49ae05c056a0debbe9bf8fff8e47c9ff6b67f101dbad34de9b", sha256: "178a10129f94627df4d95f019df5eb7875a4d1049364fe28ff69c06dd456c794" },
  { address: DEPLOYMENT.feed, keccak256: RUNTIME_HASHES.feed, sha256: "95027d40e661cafffa6a90129991f47fd63b59bd0435481f53cc5a0b2414a9fa" },
  { address: DEPLOYMENT.cache, keccak256: RUNTIME_HASHES.cache, sha256: "8bb736091d9032c49a1b279f51406f653b3fbf7c0880d7b917c93b2ce9086103" },
  { address: FORWARDER, keccak256: "0x2b21870eb5ea9013a781ed3db7d5fab742b612b2ac8de0990ac9d95b22f795fc", sha256: "f9c0c886360e5fd0b5837b83a0d307cea7aab6a43ad05d2c6ebf2f023e04edd0" }
] as const;
const same = (a: string | null | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();
export function verifyRuntimeBytecode(code: Hex, expected: { sha256: string; keccak256: string }) {
  const runtime = bytesSchema.parse(code), digest = sha256(Buffer.from(runtime.slice(2), "hex"));
  return { sha256: digest, keccak256: keccak256(runtime), verified: runtime !== "0x" && digest === expected.sha256 && same(keccak256(runtime), expected.keccak256) };
}
export function validateContractIdentity(snapshot: Snapshot): "VERIFIED" | "UNKNOWN" | "FAILED" {
  if (!snapshot.block || !snapshot.params || !snapshot.oracle.cache || !snapshot.oracle.forwarder) return "UNKNOWN";
  if (snapshot.network.chainId !== NETWORK.chainId || snapshot.marketId !== DEPLOYMENT.marketId || snapshot.derivedMarketId !== DEPLOYMENT.marketId
    || deriveMarketId(snapshot.params) !== DEPLOYMENT.marketId
    || !same(snapshot.params.oracle, DEPLOYMENT.oracle) || !same(snapshot.oracle.address, DEPLOYMENT.oracle) || !same(snapshot.oracle.feed, DEPLOYMENT.feed)
    || !same(snapshot.oracle.cache, DEPLOYMENT.cache) || !same(snapshot.oracle.forwarder, FORWARDER)) return "FAILED";
  for (const pin of IDENTITY_PINS) {
    const contract = snapshot.contracts.find(contract => same(contract.address, pin.address));
    if (!contract) return "UNKNOWN";
    if (contract.blockNumber !== snapshot.block.number || contract.byteLength <= 0 || !same(contract.keccak256, pin.keccak256) || contract.sha256 !== pin.sha256 || !contract.mcpMatchesRpc) return "FAILED";
  }
  return snapshot.consistency.blockHashesStable ? "VERIFIED" : "FAILED";
}
export function configurationFromSnapshot(snapshot: Snapshot, supplemental: { [Key in keyof OracleConfiguration]?: OracleConfiguration[Key] | undefined } = {}): OracleConfiguration {
  const oracle = snapshot.oracle;
  const runtime = (address: string | null) => snapshot.contracts.find(contract => address !== null && same(contract.address, address))?.keccak256 ?? null;
  return configurationSchema.parse({
    oracle: oracle.address, feed: oracle.feed, cache: oracle.cache, forwarder: oracle.forwarder, feedId: oracle.feedId,
    proxyOwner: oracle.proxyOwner, cacheOwner: oracle.cacheOwner, forwarderOwner: oracle.forwarderOwner, allowedWorkflowOwner: oracle.allowedWorkflowOwner,
    proxyImplementation: supplemental.proxyImplementation ?? null, proxyAdmin: supplemental.proxyAdmin ?? null, proxyBeacon: supplemental.proxyBeacon ?? null,
    oracleRuntime: runtime(oracle.address), proxyRuntime: runtime(oracle.feed), cacheRuntime: runtime(oracle.cache), forwarderRuntime: runtime(oracle.forwarder),
    compositionHash: oracle.composition ? sha256(stringify(oracle.composition)) : null,
    signerConfigurationHash: supplemental.signerConfigurationHash ?? null, workflowConfigurationHash: supplemental.workflowConfigurationHash ?? null,
    collateralToken: snapshot.params?.collateralToken ?? null, loanToken: snapshot.params?.loanToken ?? null,
    collateralDecimals: snapshot.tokens.collateral?.decimals ?? null, loanDecimals: snapshot.tokens.loan?.decimals ?? null, feedDecimals: oracle.decimals,
    denomination: "ECONOMIC_QUOTE_UNVERIFIED", descriptionHash: oracle.description === null ? null : sha256(oracle.description),
    signerCoverage: supplemental.signerCoverage ?? "UNOBSERVED"
  });
}
export const configurationFingerprint = configurationDigest;
export const configurationObservabilityLost = (before: OracleConfiguration, after: OracleConfiguration | null): boolean =>
  Object.entries(before).some(([key, value]) => value !== null && value !== "UNOBSERVED" && (after === null || after[key as keyof OracleConfiguration] === null
    || (key === "signerCoverage" && after.signerCoverage === "UNOBSERVED")));
export function configurationChanges(before: OracleConfiguration, after: OracleConfiguration): ConfigurationChange[] {
  const changed = (keys: (keyof OracleConfiguration)[]) => keys.some(key => before[key] !== null && after[key] !== null
    && String(before[key]).toLowerCase() !== String(after[key]).toLowerCase());
  const changes: ConfigurationChange[] = [];
  if (changed(["oracle", "feed", "cache", "forwarder", "compositionHash", "oracleRuntime", "proxyRuntime", "cacheRuntime", "forwarderRuntime", "workflowConfigurationHash"])) changes.push("ORACLE_CONFIGURATION_CHANGED");
  if (changed(["proxyImplementation", "proxyBeacon"])) changes.push("PROXY_IMPLEMENTATION_CHANGED");
  if (changed(["proxyOwner", "cacheOwner", "forwarderOwner", "allowedWorkflowOwner", "proxyAdmin"])) changes.push("ORACLE_OWNER_CHANGED");
  if (changed(["feedId"])) changes.push("ORACLE_FEED_ID_CHANGED");
  if (changed(["signerConfigurationHash"])) changes.push("ORACLE_SIGNER_CONFIGURATION_CHANGED");
  if (changed(["collateralToken", "loanToken", "collateralDecimals", "loanDecimals", "feedDecimals", "denomination", "descriptionHash"])) changes.push("ORACLE_DENOMINATION_CHANGED");
  return changes;
}
