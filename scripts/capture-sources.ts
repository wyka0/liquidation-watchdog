import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { DEPLOYMENT, SOURCES } from "../src/config/deployment.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";
import { pacedFetch, publicEndpoint, RequestPacer, retryRead } from "../src/chain/transport.js";
import { stringify } from "../src/domain/serialize.js";

const directory = `${CURRENT_EVIDENCE}/sources`;
await mkdir(directory, { recursive: true });
const fetcher = pacedFetch(new RequestPacer(250));
const morpho = "https://raw.githubusercontent.com/morpho-org/morpho-blue/v1.0.0/";
const oracles = "https://raw.githubusercontent.com/morpho-org/morpho-blue-oracles/v2.0.0/";
const proxyRoot = SOURCES.proxy.slice(0, SOURCES.proxy.lastIndexOf("/src/"));
const forwarderRoot = "https://smart-contract-verify-service-4lladlc2eq-uc.a.run.app/v1/contract_verify/files/1672/0x76c9cf548b4179f8901cda1f8623568b58215e62/";
const sourceList: [string, string][] = [
  ["IMorpho.sol", `${morpho}src/interfaces/IMorpho.sol`],
  ["Morpho.sol", `${morpho}src/Morpho.sol`],
  ["MorphoBalancesLib.sol", `${morpho}src/libraries/periphery/MorphoBalancesLib.sol`],
  ["MathLib.sol", `${morpho}src/libraries/MathLib.sol`],
  ["UtilsLib.sol", `${morpho}src/libraries/UtilsLib.sol`],
  ["SharesMathLib.sol", `${morpho}src/libraries/SharesMathLib.sol`],
  ["MarketParamsLib.sol", `${morpho}src/libraries/MarketParamsLib.sol`],
  ["ConstantsLib.sol", `${morpho}src/libraries/ConstantsLib.sol`],
  ["MorphoChainlinkOracleV2.sol", `${oracles}src/morpho-chainlink/MorphoChainlinkOracleV2.sol`],
  ["ChainlinkDataFeedLib.sol", `${oracles}src/morpho-chainlink/libraries/ChainlinkDataFeedLib.sol`],
  ["MorphoChainlinkOracleV2Factory.sol", `${oracles}src/morpho-chainlink/MorphoChainlinkOracleV2Factory.sol`],
  ["SelfManagedFeedsCacheProxy.sol", SOURCES.proxy],
  ["SelfManagedFeedsCache.sol", SOURCES.cache],
  ["Multicall3.sol", SOURCES.multicall],
  ["ConfirmedOwnerWithProposal.sol", `${proxyRoot}/src/shared/access/ConfirmedOwnerWithProposal.sol`],
  ["ISelfManagedFeedsCache.sol", `${proxyRoot}/src/interfaces/ISelfManagedFeedsCache.sol`],
  ["KeystoneForwarder.sol", `${forwarderRoot}src/keystone/KeystoneForwarder.sol`],
  ["verified-ChainlinkDataFeedLib.sol", "https://smart-contract-verify-service-4lladlc2eq-uc.a.run.app/v1/contract_verify/files/1672/0x9416f861970c2a39c02ab7696ef0496383d4e81b/src/morpho-chainlink/libraries/ChainlinkDataFeedLib.sol"]
];
const manifest: { file: string; url: string; sha256: string; retrievedAt: string; kind: string }[] = [];
async function capture(file: string, url: string, kind: string): Promise<string> {
  publicEndpoint(url);
  const text = await retryRead(async () => (await fetcher(url)).text());
  await writeFile(join(directory, file), text, "utf8");
  manifest.push({ file, url, sha256: createHash("sha256").update(text).digest("hex"), retrievedAt: new Date().toISOString(), kind });
  return text;
}
for (const [file, url] of sourceList) await capture(file, url, url.includes("raw.githubusercontent.com") ? "VERSION_PINNED_OFFICIAL_SOURCE" : "EXPLORER_VERIFIED_SOURCE");

const metadataSchema = z.object({
  chain_id: z.number(), address: z.string(), contract_name: z.string(), compiler_version: z.string(),
  deployed_code_hash: z.string().nullable(), settings: z.string(), abi: z.string(),
  files: z.array(z.object({ name: z.string(), path: z.string() }))
});
const metadata: unknown[] = [];
for (const [label, address] of [["proxy", DEPLOYMENT.feed], ["cache", DEPLOYMENT.cache], ["oracle", DEPLOYMENT.oracle], ["forwarder", "0x76c9cf548b4179f8901cda1f8623568b58215e62"], ["multicall", DEPLOYMENT.multicall]] as const) {
  const url = `https://api.socialscan.io/pharos-mainnet/v1/explorer/contract/${address.toLowerCase()}/code`;
  const response = await retryRead(async () => (await fetcher(url)).json() as Promise<unknown>);
  const data = metadataSchema.parse(response);
  // Metadata's verifier wallet is deliberately omitted; it is not the current contract owner.
  const sanitized = { ...data, abi: JSON.parse(data.abi) as unknown, settings: JSON.parse(data.settings) as unknown, url, retrievedAt: new Date().toISOString() };
  const file = `${label}-verified-metadata.json`;
  const text = `${stringify(sanitized)}\n`;
  await writeFile(join(directory, file), text, "utf8");
  manifest.push({ file, url, sha256: createHash("sha256").update(text).digest("hex"), retrievedAt: sanitized.retrievedAt, kind: "EXPLORER_VERIFICATION_METADATA" });
  metadata.push(sanitized);
}
const registry = await retryRead(async () => (await fetcher(SOURCES.registry)).text());
const registryEvidence = [DEPLOYMENT.morpho, DEPLOYMENT.irm, DEPLOYMENT.oracleFactory].map(address => {
  const index = registry.toLowerCase().indexOf(address.toLowerCase());
  return { address, present: index >= 0, excerpt: index < 0 ? null : registry.slice(Math.max(0, index - 240), index + 1_200) };
});
await writeFile(join(directory, "official-registry-excerpts.json"), `${stringify({
  evidenceKind: "SOURCE_MATERIAL", url: SOURCES.registry, retrievedAt: new Date().toISOString(),
  responseSha256: createHash("sha256").update(registry).digest("hex"), entries: registryEvidence
})}\n`, "utf8");
const officialLib = await readFile(join(directory, "ChainlinkDataFeedLib.sol"), "utf8");
const verifiedLib = await readFile(join(directory, "verified-ChainlinkDataFeedLib.sol"), "utf8");
await writeFile(join(directory, "manifest.json"), `${stringify({
  evidenceKind: "SOURCE_MATERIAL", files: manifest,
  oracleLibraryExactTextMatch: officialLib === verifiedLib,
  compilerReproductionPerformed: false,
  metadataHashInterpretation: "Explorer deployed_code_hash is preserved without assuming its hash algorithm; runtime keccak256 and SHA-256 are recorded in contract-verification.json.",
  sourceDoesNotProve: "Off-chain workflow source, operator identity, exact economic feed denomination, or heartbeat."
})}\n`, "utf8");
console.log(`Captured ${manifest.length} source/metadata artifacts and official registry excerpts.`);
