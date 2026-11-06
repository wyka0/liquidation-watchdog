import { writeFileSync } from "node:fs";
import { encodeFunctionData, decodeFunctionResult, parseAbi } from "file:///C:/liquidation-watchdog/node_modules/viem/_esm/index.js";
const dir = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/stage5a-discovery";
const endpoint = "https://rpc.pharos.xyz";
const MULTICALL = "0xcA11bde05977b3631167028862bE2a173976CA11";
const REQUEST_BUDGET = 40;
const trace = [], problems = [];
let requests = 0;
async function rpc(method, params) {
  if (++requests > REQUEST_BUDGET) throw new Error("REQUEST_BUDGET_EXHAUSTED");
  const began = new Date().toISOString();
  try {
    const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(15000) });
    const json = await res.json();
    if (json.error) throw new Error(JSON.stringify(json.error).slice(0, 200));
    trace.push({ method, began, responseBytes: JSON.stringify(json.result).length });
    return json.result;
  } catch (error) { trace.push({ method, error: String(error.message).slice(0, 200), began }); return null; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const Agg = parseAbi(["function aggregate3((address,bool,bytes)[]) returns ((bool,bytes)[])"]);
async function readBatch(calls) {
  const out = [];
  for (let start = 0; start < calls.length; start += 30) {
    const chunk = calls.slice(start, start + 30);
    const payload = encodeFunctionData({ abi: Agg, functionName: "aggregate3", args: [chunk.map(c => [c.target, true, c.data])] });
    const result = await rpc("eth_call", [{ to: MULTICALL, data: payload }, "latest"]);
    await sleep(500);
    if (!result) { out.push(...chunk.map(() => null)); continue; }
    try {
      const values = decodeFunctionResult({ abi: Agg, functionName: "aggregate3", data: result });
      for (const v of values) out.push(v[0] ? v[1] : null);
    } catch (e) { problems.push({ note: "AGG_DECODE_FAIL", err: String(e.message).slice(0, 140) }); out.push(...chunk.map(() => null)); }
  }
  return out;
}
const vault = "0x921974d7B1a2dbACcaf5ba893A3A1500638Cea6B";
const vaultAbi = parseAbi(["function symbol() view returns (string)", "function name() view returns (string)",
  "function decimals() view returns (uint8)", "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)", "function totalSupply() view returns (uint256)",
  "function convertToAssets(uint256) view returns (uint256)", "function convertToShares(uint256) view returns (uint256)",
  "function maxRedeem(address) view returns (uint256)", "function typeAndVersion() view returns (string)",
  "function description() view returns (string)", "function owner() view returns (address)", "function redeemFee() view returns (uint256)",
  "function totalSupply() view returns (uint256)"]);
const specs = [];
const calls = [];
for (const name of ["symbol", "name", "decimals", "asset", "totalAssets", "totalSupply", "typeAndVersion", "description", "owner", "redeemFee"]) {
  specs.push({ fn: name });
  calls.push({ target: vault, data: encodeFunctionData({ abi: vaultAbi, functionName: name, args: [] }) });
}
specs.push({ fn: "convertToAssets(1e18)" });
calls.push({ target: vault, data: encodeFunctionData({ abi: vaultAbi, functionName: "convertToAssets", args: [1000000000000000000n] }) });
specs.push({ fn: "convertToShares(1e6)" });
calls.push({ target: vault, data: encodeFunctionData({ abi: vaultAbi, functionName: "convertToShares", args: [1000000n] }) });
const decoded = {};
{
  const results = await readBatch(calls);
  for (const [i, spec] of specs.entries()) {
    const raw = results[i];
    if (!raw) { problems.push({ note: "VAULT_RAW_NULL", fn: spec.fn }); continue; }
    try {
      const value = decodeFunctionResult({ abi: vaultAbi, functionName: spec.fn.split("(")[0], data: raw });
      decoded[spec.fn] = typeof value === "bigint" ? value.toString() : value;
    } catch (e) { problems.push({ note: "VAULT_DECODE_FAIL", fn: spec.fn, err: String(e.message).slice(0, 120) }); }
  }
}
const out = { requestedAt: new Date().toISOString(), requestCount: requests, vault: decoded, problems };
writeFileSync(dir + "/summary6.json", JSON.stringify(out, null, 2));
writeFileSync(dir + "/trace6.json", JSON.stringify(trace, null, 2));
console.log(JSON.stringify(out, null, 1));
