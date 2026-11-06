import { readFile } from "node:fs/promises";
import { decodeFunctionResult, encodeFunctionData, parseAbi } from "viem";
import { z } from "zod";
import { RpcClient } from "../src/chain/rpc.js";
import { DEPLOYMENT, NETWORK } from "../src/config/deployment.js";
import { stringify } from "../src/domain/serialize.js";
import { saveOracleBundle, sha256, verifyOracleBundle } from "../src/oracle-assurance/evidence.js";
import { RESEARCH_BUNDLE } from "../src/oracle-assurance/reviewed.js";

await verifyOracleBundle(RESEARCH_BUNDLE);
const input = await readFile(`${RESEARCH_BUNDLE}/collateral-compiler-input.json`);
const output = await readFile(`${RESEARCH_BUNDLE}/collateral-compiler-output.json`);
const runtime = z.object({ code: z.string(), block: z.object({ number: z.string(), hash: z.string(), timestamp: z.string() }) })
  .parse(JSON.parse(await readFile(`${RESEARCH_BUNDLE}/collateral-runtime.json`, "utf8")));
const parsed = z.object({ contracts: z.record(z.string(), z.record(z.string(), z.object({ evm: z.object({ deployedBytecode: z.object({ object: z.string(),
  immutableReferences: z.record(z.string(), z.array(z.object({ start: z.number(), length: z.number() }))) }) }) }))) }).parse(JSON.parse(output.toString("utf8")));
const contract = parsed.contracts["contracts/WsrusdOft.sol"]?.WsrusdOft;
if (!contract) throw new Error("Archived compiler output lacks the exact collateral contract.");
const rpc = new RpcClient(), block = BigInt(runtime.block.number), bindings = [];
if (await rpc.chainId() !== BigInt(NETWORK.chainId) || (await rpc.block(block)).hash !== runtime.block.hash) throw new Error("Anchor mismatch.");
let patched = contract.evm.deployedBytecode.object;
for (const [id, name] of [["1386", "endpoint"], ["2906", "decimalConversionRate"]] as const) {
  const abi = parseAbi([`function ${name}() view returns (uint256)`]);
  const raw = await rpc.call(DEPLOYMENT.collateralToken, encodeFunctionData({ abi, functionName: name }), block);
  const value = decodeFunctionResult({ abi, functionName: name, data: raw });
  const positions = contract.evm.deployedBytecode.immutableReferences[id];
  if (!positions || raw.length !== 66 || positions.some(position => position.length !== 32)) throw new Error("Immutable layout mismatch.");
  for (const position of positions) patched = patched.slice(0, position.start * 2) + raw.slice(2) + patched.slice((position.start + 32) * 2);
  bindings.push({ id, name, raw, value, positions, method: "PUBLIC_GETTER_MATCHED_TO_COMPILER_AST" });
}
const deployed = await rpc.code(DEPLOYMENT.collateralToken, block);
const fullMatch = `0x${patched}` === deployed && deployed === runtime.code;
if (!fullMatch || (await rpc.block(block)).hash !== runtime.block.hash) throw new Error("Collateral runtime proof failed.");
const conclusion = { chainId: NETWORK.chainId, subjectAddress: DEPLOYMENT.collateralToken, block: runtime.block, retrievedAt: new Date().toISOString(),
  method: "Independent native compiler output from the referenced immutable bundle, completed with the two public immutable getters. No runtime bytes were copied as immutable values.",
  sourceBundle: RESEARCH_BUNDLE, compilerInputSha256: sha256(input), compilerOutputSha256: sha256(output), bindings, fullRuntimeMatch: fullMatch,
  runtimeSha256: sha256(Buffer.from(patched, "hex")), classification: "PROVEN", unresolved: ["Cross-chain OFT identity does not prove redemption value, market-price quote or selected-feed provenance."] };
const bundle = await saveOracleBundle({ "collateral-proof.json": stringify(conclusion) + "\n", "rpc-reads.json": stringify(rpc.records) + "\n" }, { prefix: "collateral-proof" });
console.log(stringify({ ...bundle, conclusion }));
