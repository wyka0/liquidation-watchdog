import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { decodeFunctionResult, encodeFunctionData, keccak256, parseAbi } from "viem";
import { z } from "zod";
import { inspectLive } from "../src/chain/live.js";
import { RpcClient } from "../src/chain/rpc.js";
import { publicEndpoint, RequestPacer } from "../src/chain/transport.js";
import { DEPLOYMENT, NETWORK } from "../src/config/deployment.js";
import { stringify } from "../src/domain/serialize.js";
import { saveOracleBundle, sha256 } from "../src/oracle-assurance/evidence.js";
import { addressSchema, bytesSchema } from "../src/validation/schemas.js";

// Explicit one-shot research. Downloads public source/compiler inputs; performs no chain writes.
const artifacts: Record<string, string> = {}, results: unknown[] = [];
const record = (name: string, value: unknown) => { artifacts[name] = stringify(value) + "\n"; };
const pacer = new RequestPacer(250);
async function get(url: string, maxBytes = 5_000_000): Promise<{ bytes: Uint8Array; retrievedAt: string; status: number }> {
  publicEndpoint(url);
  return pacer.run(async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: "error" });
    if (!response.ok) { await response.body?.cancel(); return { bytes: new Uint8Array(), retrievedAt: new Date().toISOString(), status: response.status }; }
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = response.body!.getReader();
    try { for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > maxBytes) throw new Error("Public artifact exceeded its byte budget."); chunks.push(next.value); } }
    finally { await reader.cancel(); }
    return { bytes: Buffer.concat(chunks), retrievedAt: new Date().toISOString(), status: response.status };
  });
}
const metadataSchema = z.object({ chain_id: z.literal(NETWORK.chainId), address: addressSchema,
  contract_name: z.string(), deployed_code_hash: z.string().regex(/^[a-f0-9]{64}$/), compiler_version: z.string(),
  settings: z.string(), implementation: z.unknown().optional(), proxy: z.unknown().optional(),
  files: z.array(z.object({ name: z.string(), path: z.url() })).max(128)
});
const compilerSchema = z.object({ builds: z.array(z.object({ path: z.string(),
  version: z.string(), longVersion: z.string(), sha256: z.string(), keccak256: z.string() }).passthrough()) }).passthrough();
const compileSchema = z.object({ errors: z.array(z.object({ severity: z.string(), formattedMessage: z.string() })).optional(),
  contracts: z.record(z.string(), z.record(z.string(), z.object({ storageLayout: z.unknown(), metadata: z.string(),
    evm: z.object({ deployedBytecode: z.object({ object: z.string(), immutableReferences: z.record(z.string(), z.array(z.object({ start: z.number(), length: z.number() }))) }) })
  }).passthrough())).optional(), sources: z.record(z.string(), z.object({ ast: z.unknown() }).passthrough()).optional()
}).passthrough();
let completed = false;
try {
const snapshot = await inspectLive();
if (!snapshot.block || !snapshot.accepted || !snapshot.oracle.forwarder) throw new Error("Research requires a validated block-pinned snapshot.");
record("snapshot.json", snapshot);
const rpc = new RpcClient();
const block = snapshot.block;
const listUrl = "https://binaries.soliditylang.org/windows-amd64/list.json";
const listRead = await get(listUrl);
if (listRead.status !== 200) throw new Error("Compiler manifest unavailable.");
const list = compilerSchema.parse(JSON.parse(Buffer.from(listRead.bytes).toString("utf8")));
record("compiler-manifest.json", { url: listUrl, retrievedAt: listRead.retrievedAt, sha256: sha256(listRead.bytes), manifest: list });
const cache = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/phase4-solc";
await mkdir(cache, { recursive: true });
const binaries = new Map<string, { path: string; sha256: string; url: string; retrievedAt: string }>();
async function compiler(version: string) {
  const existing = binaries.get(version); if (existing) return existing;
  const build = list.builds.find(build => `v${build.longVersion}` === version);
  if (!build || !/^solc-windows-amd64-v[0-9.]+\+commit\.[a-f0-9]+\.exe$/.test(build.path)) throw new Error("Exact native compiler release is absent from the official manifest.");
  const url = `https://binaries.soliditylang.org/windows-amd64/${build.path}`;
  const read = await get(url, 25_000_000);
  if (read.status !== 200 || `0x${sha256(read.bytes)}` !== build.sha256 || keccak256(read.bytes) !== build.keccak256) throw new Error("Compiler binary integrity check failed.");
  const path = join(cache, build.path);
  try { await writeFile(path, read.bytes, { flag: "wx" }); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "EEXIST") || sha256(await readFile(path)) !== sha256(read.bytes)) throw error; }
  const result = { path, sha256: sha256(read.bytes), url, retrievedAt: read.retrievedAt }; binaries.set(version, result); return result;
}
function compile(path: string, input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let length = 0;
    const child = spawn(path, ["--standard-json"], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, timeout: 120_000 });
    child.stdout.on("data", (bytes: Buffer) => { length += bytes.length; if (length > 30_000_000) child.kill(); else chunks.push(bytes); });
    child.stderr.resume(); child.on("error", () => reject(new Error("Compiler execution failed.")));
    child.stdin.on("error", () => { /* close handler reports failed compiler execution */ });
    child.on("close", code => code === 0 && length <= 30_000_000 ? resolve(Buffer.concat(chunks).toString("utf8")) : reject(new Error("Compiler did not complete within bounds.")));
    child.stdin.end(input);
  });
}
function variables(ast: unknown, into = new Map<string, string>()): Map<string, string> {
  if (Array.isArray(ast)) ast.forEach(node => variables(node, into));
  else if (ast !== null && typeof ast === "object") {
    const node = ast as Record<string, unknown>;
    if (node.nodeType === "VariableDeclaration" && node.mutability === "immutable" && typeof node.id === "number" && typeof node.name === "string") into.set(String(node.id), node.name);
    Object.values(node).forEach(value => variables(value, into));
  }
  return into;
}
for (const [label, address] of [["oracle", DEPLOYMENT.oracle], ["proxy", DEPLOYMENT.feed], ["cache", DEPLOYMENT.cache],
  ["forwarder", snapshot.oracle.forwarder], ["morpho", DEPLOYMENT.morpho], ["collateral", DEPLOYMENT.collateralToken]] as const) {
  console.log(`Research: ${label} source and independent compilation.`);
  const url = `https://api.socialscan.io/pharos-mainnet/v1/explorer/contract/${address.toLowerCase()}/code`;
  const read = await get(url);
  if (read.status !== 200) { results.push({ label, address, url, status: read.status, conclusion: "SOURCE_UNAVAILABLE" }); continue; }
  const meta = metadataSchema.parse(JSON.parse(Buffer.from(read.bytes).toString("utf8")));
  if (meta.address.toLowerCase() !== address.toLowerCase()) throw new Error("Explorer identity mismatch.");
  const settings = z.record(z.string(), z.unknown()).parse(JSON.parse(meta.settings));
  const deployed = await rpc.code(address, block.number), deployedSha256 = sha256(Buffer.from(deployed.slice(2), "hex"));
  record(`${label}-runtime.json`, { address, chainId: NETWORK.chainId, block, retrievedAt: new Date().toISOString(), endpoint: NETWORK.rpc,
    code: deployed, sha256: deployedSha256, keccak256: keccak256(deployed) });
  const sources: Record<string, { content: string }> = {}, sourceRecords = [];
  const prefix = `https://smart-contract-verify-service-4lladlc2eq-uc.a.run.app/v1/contract_verify/files/1672/${address.toLowerCase()}/`;
  for (const file of meta.files) {
    if (!file.path.startsWith(prefix)) throw new Error("Source path is outside the verified contract namespace.");
    const name = decodeURIComponent(file.path.slice(prefix.length));
    if (!/^[a-zA-Z0-9_@./-]+$/.test(name) || name.includes("..") || Object.hasOwn(sources, name)) throw new Error("Source path invalid or duplicated.");
    const fetched = await get(file.path);
    if (fetched.status !== 200) throw new Error("A required compiler source could not be retrieved.");
    sources[name] = { content: Buffer.from(fetched.bytes).toString("utf8") };
    sourceRecords.push({ path: name, url: file.path, retrievedAt: fetched.retrievedAt, sha256: sha256(fetched.bytes), bytes: fetched.bytes.length });
  }
  record(`${label}-metadata.json`, { ...meta, settings, url, retrievedAt: read.retrievedAt, sourceRecords, metadataSha256: sha256(read.bytes),
    explorerRuntimeSha256Matches: deployedSha256 === meta.deployed_code_hash });
  const input = { language: "Solidity", sources, settings: { ...settings, outputSelection: { "*": { "": ["ast"], "*": ["evm.deployedBytecode.object", "evm.deployedBytecode.immutableReferences", "storageLayout", "metadata"] } } } };
  record(`${label}-compiler-input.json`, input);
  const executable = await compiler(meta.compiler_version);
  const outputText = await compile(executable.path, JSON.stringify(input));
  const output = compileSchema.parse(JSON.parse(outputText));
  record(`${label}-compiler-output.json`, output);
  const contract = Object.values(output.contracts ?? {}).map(group => group[meta.contract_name]).find(item => item !== undefined);
  if (!contract || output.errors?.some(error => error.severity === "error")) { results.push({ label, address, conclusion: "COMPILATION_FAILED", compiler: executable }); continue; }
  const bytecode = contract.evm.deployedBytecode;
  let patched = bytecode.object;
  const ids = variables(Object.values(output.sources ?? {}).map(source => source.ast));
  const immutableReads = [];
  let allImmutablesBound = true;
  for (const [id, positions] of Object.entries(bytecode.immutableReferences)) {
    const name = ids.get(id);
    // Public constant getters supply immutable values; never copy bytes from the target runtime into a purported proof.
    if (!name || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) { allImmutablesBound = false; continue; }
    const abi = parseAbi([`function ${name}() view returns (uint256)`]);
    try {
      const raw = await rpc.call(address, encodeFunctionData({ abi, functionName: name }), block.number);
      const value = decodeFunctionResult({ abi, functionName: name, data: raw });
      const word = bytesSchema.parse(raw).slice(2);
      if (word.length !== 64 || positions.some(position => position.length !== 32)) { allImmutablesBound = false; continue; }
      for (const position of positions) patched = patched.slice(0, position.start * 2) + word + patched.slice((position.start + position.length) * 2);
      immutableReads.push({ id, name, raw, value, positions, method: "PINNED_PUBLIC_IMMUTABLE_GETTER" });
    } catch { allImmutablesBound = false; }
  }
  const fullMatch = allImmutablesBound && `0x${patched}`.toLowerCase() === deployed.toLowerCase();
  results.push({ label, address, block, sourceUrl: url, retrievedAt: read.retrievedAt, compiler: executable,
    compilerVersion: meta.compiler_version, inputSha256: sha256(artifacts[`${label}-compiler-input.json`]!), deployedSha256,
    reproducedSha256: /^[a-fA-F0-9]+$/.test(patched) ? sha256(Buffer.from(patched, "hex")) : null,
    explorerHashMatches: meta.deployed_code_hash === deployedSha256, allImmutablesBound, immutableReads,
    fullRuntimeMatch: fullMatch, conclusion: fullMatch ? "INDEPENDENT_FULL_RUNTIME_REPRODUCTION" : "RUNTIME_REPRODUCTION_INCOMPLETE" });
}
const docs = [
  ["reservoir-addresses", "https://docs.reservoir.xyz/security-and-compliance/smart-contract-addresses.md"],
  ["reservoir-savings", "https://docs.reservoir.xyz/products/savings-srusd-and-wsrusd.md"],
  ["chainlink-megaeth", "https://data.chain.link/feeds/megaeth/megaeth/wsrusd-rusd-exchange-rate"],
  ["pharos-watch", "https://pharos.watch/stablecoin/wsrusd-reservoir"]
] as const;
for (const [id, url] of docs) {
  try {
    const read = await get(url);
    const text = Buffer.from(read.bytes).toString("utf8");
    // Preserve bounded relevant excerpts instead of unrelated page scripts, cookies or query-bearing links.
    const excerpts = text.split(/\r?\n/).filter(line => /Pharos|wsrUSD|0x480901|governance|PSM|Chainlink|RUSD|yield|reservoir/i.test(line))
      .map(line => line.replace(/https?:\/\/[^\s<>"')]+/g, candidate => { try { const u = new URL(candidate); u.search = ""; u.hash = ""; return u.href; } catch { return "[URL omitted]"; } }).slice(0, 6_000)).slice(0, 40);
    record(`${id}-research.json`, { subjectAddress: DEPLOYMENT.collateralToken, subjectChainId: NETWORK.chainId, url, retrievedAt: read.retrievedAt,
      status: read.status, block: null, responseSha256: read.status === 200 ? sha256(read.bytes) : null, excerpts,
      classification: "RESEARCH_NOT_QUALIFIED_PRICE_EVIDENCE", independentComparatorEligible: false,
      unresolved: ["Exact feed upstream, quote and independent operator relationship are not established by this page.", "No normalized independent price observation is adopted."] });
  } catch { record(`${id}-research.json`, { subjectAddress: DEPLOYMENT.collateralToken, url, retrievedAt: new Date().toISOString(), status: "UNAVAILABLE", independentComparatorEligible: false }); }
}
const after = await rpc.block(block.number);
if (after.hash !== block.hash || await rpc.chainId() !== BigInt(NETWORK.chainId)) throw new Error("Research anchor changed.");
record("research-summary.json", { chainId: NETWORK.chainId, block, retrievedAt: new Date().toISOString(), results,
  unresolved: ["Reproduced code does not prove economic source, operator identity, heartbeat or independence.", "RPC and MCP share an upstream."] });
record("supplemental-rpc-reads.json", rpc.records);
completed = true;
} finally {
record("capture-completion.json", { completed, recordedAt: new Date().toISOString() });
record("independent-recompilation.json", results);
const bundle = await saveOracleBundle(artifacts, { prefix: "oracle-research" });
console.log(stringify({ ...bundle, results }));
}
