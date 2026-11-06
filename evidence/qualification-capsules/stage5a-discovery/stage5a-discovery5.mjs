import { writeFileSync } from "node:fs";
import { encodeFunctionData, decodeFunctionResult, parseAbi } from "file:///C:/liquidation-watchdog/node_modules/viem/_esm/index.js";
const dir = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/stage5a-discovery";
const endpoint = "https://rpc.pharos.xyz";
const MULTICALL = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MORPHO = "0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb";
const STAGE2_BORROWER = "0x086eb9C2B14dD657ae77D07dF9115A2F946CE327";
const STAGE2_MARKET = "0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73";
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
const compositionAbi = parseAbi(["function BASE_VAULT() view returns (address)", "function BASE_VAULT_CONVERSION_SAMPLE() view returns (uint256)",
  "function BASE_FEED_1() view returns (address)", "function BASE_FEED_2() view returns (address)",
  "function QUOTE_VAULT() view returns (address)", "function QUOTE_VAULT_CONVERSION_SAMPLE() view returns (uint256)",
  "function QUOTE_FEED_1() view returns (address)", "function QUOTE_FEED_2() view returns (address)",
  "function SCALE_FACTOR() view returns (uint256)", "function BASE_TOKEN_DECIMALS() view returns (uint256)",
  "function QUOTE_TOKEN_DECIMALS() view returns (uint256)", "function price() view returns (uint256)"]);
const compositionNames = ["BASE_VAULT", "BASE_VAULT_CONVERSION_SAMPLE", "BASE_FEED_1", "BASE_FEED_2",
  "QUOTE_VAULT", "QUOTE_VAULT_CONVERSION_SAMPLE", "QUOTE_FEED_1", "QUOTE_FEED_2",
  "SCALE_FACTOR", "BASE_TOKEN_DECIMALS", "QUOTE_TOKEN_DECIMALS", "price"];
const oracles = { A: "0xd7E33079D91c5fA12798C1e7b28A7877045aa7C3", B: "0x4eEfC4C6e7216Aedd5E809e4fC74fb8859B3FA46",
  S2: "0x9416F861970C2a39c02ab7696Ef0496383d4E81b" };
const compCalls = [], compSpecs = [];
for (const [k, o] of Object.entries(oracles)) {
  for (const name of compositionNames) {
    compSpecs.push({ subject: k, fn: name });
    compCalls.push({ target: o, data: encodeFunctionData({ abi: compositionAbi, functionName: name, args: [] }) });
  }
}
const compDecoded = {};
{
  const results = await readBatch(compCalls);
  for (const [i, spec] of compSpecs.entries()) {
    const raw = results[i];
    if (!raw) { problems.push({ note: "COMP_RAW_NULL", subject: spec.subject, fn: spec.fn }); continue; }
    try {
      const value = decodeFunctionResult({ abi: compositionAbi, functionName: spec.fn, data: raw });
      (compDecoded[spec.subject] ??= {})[spec.fn] = typeof value === "bigint" ? value.toString() : value;
    } catch (e) { problems.push({ note: "COMP_DECODE_FAIL", subject: spec.subject, fn: spec.fn, err: String(e.message).slice(0, 120) }); }
  }
}
const zero = "0x0000000000000000000000000000000000000000";
const feeds = new Set();
for (const c of Object.values(compDecoded)) {
  for (const k of ["BASE_VAULT", "BASE_FEED_1", "BASE_FEED_2", "QUOTE_FEED_1", "QUOTE_FEED_2"]) {
    const a = c[k];
    if (typeof a === "string" && a.length >= 42 && a.toLowerCase() !== zero.toLowerCase() && feeds.size < 6) feeds.add(a);
  }
}
const feedAbi = parseAbi(["function typeAndVersion() view returns (string)", "function description() view returns (string)",
  "function decimals() view returns (uint8)", "function owner() view returns (address)", "function getFeedId() view returns (bytes32)",
  "function aggregator() view returns (address)", "function latestAnswer() view returns (int256)",
  "function latestTimestamp() view returns (uint256)", "function latestRoundData() view returns ((uint80,int256,uint256,uint256,uint80))"]);
const feedNames = ["typeAndVersion", "description", "decimals", "owner", "getFeedId", "aggregator", "latestAnswer", "latestTimestamp", "latestRoundData"];
const feedCalls = [], feedSpecs = [];
for (const f of feeds) {
  for (const name of feedNames) {
    feedSpecs.push({ subject: f, fn: name });
    feedCalls.push({ target: f, data: encodeFunctionData({ abi: feedAbi, functionName: name, args: [] }) });
  }
}
const feedDecoded = {};
if (feedCalls.length) {
  const results = await readBatch(feedCalls);
  for (const [i, spec] of feedSpecs.entries()) {
    const raw = results[i];
    if (!raw) { problems.push({ note: "FEED_RAW_NULL", subject: spec.subject, fn: spec.fn }); continue; }
    try {
      const value = decodeFunctionResult({ abi: feedAbi, functionName: spec.fn, data: raw });
      feedDecoded[spec.subject] ??= {};
      feedDecoded[spec.subject][spec.fn] = Array.isArray(value) ? value.map(v => typeof v === "bigint" ? v.toString() : v)
        : (typeof value === "bigint" ? value.toString() : value);
    } catch (e) { problems.push({ note: "FEED_DECODE_FAIL", subject: spec.subject, fn: spec.fn, err: String(e.message).slice(0, 120) }); }
  }
}
const stage2Position = {};
{
  const args = [STAGE2_MARKET, STAGE2_BORROWER];
  const data = encodeFunctionData({ abi: parseAbi(["function position(bytes32,address) view returns ((uint256,uint128,uint128))"]), functionName: "position", args });
  const raw = await rpc("eth_call", [{ to: MORPHO, data }, "latest"]).then(r => r);
  if (raw) {
    try {
      const value = decodeFunctionResult({ abi: parseAbi(["function position(bytes32,address) view returns ((uint256,uint128,uint128))"]), functionName: "position", data: raw });
      Object.assign(stage2Position, { [STAGE2_BORROWER]: { supplyShares: value[0].toString(), borrowShares: value[1].toString(), collateral: value[2].toString() } });
    } catch (e) { problems.push({ note: "S2POS_DECODE_FAIL", err: String(e.message).slice(0, 120) }); }
  }
}
const out = { requestedAt: new Date().toISOString(), requestCount: requests, composition: compDecoded, feeds: feedDecoded, stage2Position, problems: problems.slice(0, 30) };
writeFileSync(dir + "/summary5.json", JSON.stringify(out, null, 2));
writeFileSync(dir + "/trace5.json", JSON.stringify(trace, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 9000));
