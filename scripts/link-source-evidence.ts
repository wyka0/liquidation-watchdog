import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { stringify } from "../src/domain/serialize.js";
import { PHASE1_REGRESSION_EVIDENCE, CURRENT_EVIDENCE } from "../src/config/evidence.js";

const root = "evidence/phase1";
const manifest = z.object({ files: z.array(z.object({ file: z.string().regex(/^[A-Za-z0-9_.-]+$/), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) })
  .parse(JSON.parse(await readFile(`${root}/sources/manifest.json`, "utf8")));
const sourceFileHashes = await Promise.all(manifest.files.map(async item => ({
  file: item.file,
  matches: createHash("sha256").update(await readFile(`${root}/sources/${item.file}`)).digest("hex") === item.sha256
})));
const officialOracleLibrary = await readFile(`${root}/sources/ChainlinkDataFeedLib.sol`, "utf8");
const verifiedOracleLibrary = await readFile(`${root}/sources/verified-ChainlinkDataFeedLib.sol`, "utf8");
const oracleLibraryExactTextMatch = officialOracleLibrary === verifiedOracleLibrary;
const contracts = z.object({
  block: z.unknown(), retrievedAt: z.string(),
  contracts: z.array(z.object({ address: z.string(), label: z.string(), sha256: z.string(), keccak256: z.string(), mcpMatchesRpc: z.boolean() }))
}).parse(JSON.parse(await readFile(`${PHASE1_REGRESSION_EVIDENCE}/contract-verification.json`, "utf8")));
const matches = [];
for (const label of ["proxy", "cache", "oracle", "forwarder", "multicall"]) {
  const metadata = z.object({ chain_id: z.number(), address: z.string(), contract_name: z.string(), deployed_code_hash: z.string(), url: z.string(), retrievedAt: z.string() })
    .parse(JSON.parse(await readFile(`${root}/sources/${label}-verified-metadata.json`, "utf8")));
  const runtime = contracts.contracts.find(item => item.address.toLowerCase() === metadata.address.toLowerCase());
  matches.push({
    label, address: metadata.address, contractName: metadata.contract_name, sourceMetadataUrl: metadata.url,
    sourceMetadataRetrievedAt: metadata.retrievedAt, explorerDeployedCodeHash: metadata.deployed_code_hash,
    onchainRuntimeSha256: runtime?.sha256 ?? null, onchainRuntimeKeccak256: runtime?.keccak256 ?? null,
    chainIdMatches: metadata.chain_id === 1672,
    sha256Matches: runtime?.sha256 === metadata.deployed_code_hash,
    mcpMatchesRpc: runtime?.mcpMatchesRpc ?? false
  });
}
const allMatch = matches.every(item => item.sha256Matches && item.chainIdMatches && item.mcpMatchesRpc)
  && sourceFileHashes.every(item => item.matches) && oracleLibraryExactTextMatch;
await mkdir(CURRENT_EVIDENCE, { recursive: true });
await writeFile(`${CURRENT_EVIDENCE}/source-runtime-matches.json`, `${stringify({
  evidenceKind: "LIVE_CHAIN_READ_WITH_ARCHIVED_SOURCE_MATERIAL", block: contracts.block, retrievedAt: contracts.retrievedAt,
  sourceArchive: `${root}/sources`, contractEvidence: `${PHASE1_REGRESSION_EVIDENCE}/contract-verification.json`,
  matches, allMatch, sourceFileHashes, oracleLibraryExactTextMatch,
  conclusion: "For the listed contracts, the explorer's deployed_code_hash equals SHA-256 of the bytecode read at the pinned block. This hash-link check does not recompile source; Phase 4's separate oracle-evidence-verification.json checks the archived six-contract runtime reproduction.",
  independentReproductionEvidence: `${CURRENT_EVIDENCE}/oracle-evidence-verification.json`
})}\n`, "utf8");
if (!allMatch) process.exitCode = 1;
console.log(`Source/runtime hash links: ${matches.filter(item => item.sha256Matches).length}/${matches.length} matched.`);
console.log(`Archived source hashes: ${sourceFileHashes.filter(item => item.matches).length}/${sourceFileHashes.length} matched; oracle library exact text match: ${oracleLibraryExactTextMatch}.`);
