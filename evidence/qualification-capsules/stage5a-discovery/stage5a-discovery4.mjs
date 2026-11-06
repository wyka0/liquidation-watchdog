// Stage 5A run 4: token/oracle/feed detail for the three discovered markets, with explicit diagnostics. Read-only.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { encodeFunctionData, decodeFunctionResult, parseAbi, keccak256, toHex, getAddress, zeroAddress } =
  await import("file:///C:/liquidation-watchdog/node_modules/viem/_esm/index.js");
const dir = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/stage5a-discovery";
mkdirSync(dir, { recursive: true });
const endpoint = "https://rpc.pharos.xyz";
const MORPHO = "0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb";
const MULTICALL = "0xcA11bde05977b3631167028862bE2a173976CA11";
const STAGE2_MARKET = "0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73";
const REQUEST_BUDGET = 80;
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
  } catch (error) { trace.push({ method, error: String(error.message).slice(0, 220), began }); return null; }
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
      if (values.length !== chunk.length) problems.push({ note: "AGG_MISMATCH", expected: chunk.length, got: values.length });
    } catch (e) { problems.push({ note: "AGG_DECODE_FAIL", err: String(e.message).slice(0, 150) }); out.push(...chunk.map(() => null)); }
  }
  return out;
}
const prior = JSON.parse(readFileSync(join(dir, "summary3.json"), "utf8"));
const ids = prior.ranked.map(r => r.id);
const paramsById = new Map(prior.candidates.filter(c => c.params).map(c => [c.marketId, c.params]));
const headBlock = BigInt(await rpc("eth_blockNumber", []));
// ---- fresh states ----
const morphoAbi = parseAbi([
  "function market(bytes32) view returns ((uint128,uint128,uint128,uint128,uint128,uint128))",
  "function position(bytes32,address) view returns ((uint256,uint128,uint128))"
]);
const stateResults = await readBatch(ids.map(id => ({ target: MORPHO, data: encodeFunctionData({ abi: morphoAbi, functionName: "market", args: [id] }) })));
const states = {};
for (const [i, id] of ids.entries()) {
  const raw = stateResults[i];
  if (!raw) continue;
  try {
    const value = decodeFunctionResult({ abi: morphoAbi, functionName: "market", data: raw });
    states[id] = value.map(v => v.toString());
  } catch (e) { problems.push({ note: "STATE_DECODE_FAIL", id: id.slice(0, 12), err: String(e.message).slice(0, 150) }); }
}
// ---- tokens ----
const tokenSet = new Map();
for (const p of paramsById.values()) {
  for (const t of [p.loanToken, p.collateralToken]) if (t) tokenSet.set(t.toLowerCase(), t);
}
const erc20Abi = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)",
  "function name() view returns (string)", "function balanceOf(address) view returns (uint256)"]);
const tokenCalls = [], tokenSpecs = [];
for (const t of tokenSet.values()) {
  for (const name of ["symbol", "decimals", "name"]) {
    tokenSpecs.push({ subject: t.toLowerCase(), fn: name });
    tokenCalls.push({ target: t, data: encodeFunctionData({ abi: erc20Abi, functionName: name, args: [] }) });
  }
  tokenSpecs.push({ subject: t.toLowerCase(), fn: "balanceOf(morpho)" });
  tokenCalls.push({ target: t, data: encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [MORPHO] }) });
}
const decodedTokens = {};
{
  const results = await readBatch(tokenCalls);
  for (const [i, spec] of tokenSpecs.entries()) {
    const raw = results[i];
    if (!raw) { problems.push({ note: "TOKEN_RAW_NULL", subject: spec.subject, fn: spec.fn }); continue; }
    try {
      const fnName = spec.fn === "balanceOf(morpho)" ? "balanceOf" : spec.fn;
      const value = decodeFunctionResult({ abi: erc20Abi, functionName: fnName, data: raw });
      (decodedTokens[spec.subject] ??= {})[spec.fn] = typeof value === "bigint" ? value.toString() : value;
    } catch (e) { problems.push({ note: "TOKEN_DECODE_FAIL", subject: spec.subject, fn: spec.fn, err: String(e.message).slice(0, 150), raw: String(raw).slice(0, 40) }); }
  }
}
// ---- oracles ----
const oracleSet = new Map();
for (const p of paramsById.values()) if (p.oracle) oracleSet.set(p.oracle.toLowerCase(), p.oracle);
const oracleAbi = parseAbi(["function price() view returns (uint256)", "function typeAndVersion() view returns (string)",
  "function description() view returns (string)", "function decimals() view returns (uint8)", "function owner() view returns (address)",
  "function baseVault() view returns (address)", "function baseVaultConversionSample() view returns (uint256)",
  "function baseFeed1() view returns (address)", "function baseFeed2() view returns (address)",
  "function quoteVault() view returns (address)", "function quoteVaultConversionSample() view returns (uint256)",
  "function quoteFeed1() view returns (address)", "function quoteFeed2() view returns (address)",
  "function scaleFactor() view returns (uint256)", "function baseTokenDecimals() view returns (uint256)",
  "function quoteTokenDecimals() view returns (uint256)", "function getFeedId() view returns (bytes32)",
  "function aggregator() view returns (address)", "function latestAnswer() view returns (int256)",
  "function latestTimestamp() view returns (uint256)", "function latestRoundData() view returns ((uint80,int256,uint256,uint256,uint80))"]);
const oracleNames = ["typeAndVersion", "description", "decimals", "owner", "baseVault", "baseVaultConversionSample", "baseFeed1", "baseFeed2",
  "quoteVault", "quoteVaultConversionSample", "quoteFeed1", "quoteFeed2", "scaleFactor", "baseTokenDecimals", "quoteTokenDecimals",
  "getFeedId", "aggregator", "latestAnswer", "latestTimestamp", "latestRoundData", "price"];
const oracleCalls = [], oracleSpecs = [];
for (const o of oracleSet.values()) {
  for (const name of oracleNames) {
    oracleSpecs.push({ subject: o.toLowerCase(), fn: name });
    oracleCalls.push({ target: o, data: encodeFunctionData({ abi: oracleAbi, functionName: name, args: [] }) });
  }
}
const decodedOracles = {};
{
  const results = await readBatch(oracleCalls);
  for (const [i, spec] of oracleSpecs.entries()) {
    const raw = results[i];
    if (!raw) { problems.push({ note: "ORACLE_RAW_NULL", subject: spec.subject, fn: spec.fn }); continue; }
    try {
      const value = decodeFunctionResult({ abi: oracleAbi, functionName: spec.fn, data: raw });
      (decodedOracles[spec.subject] ??= {})[spec.fn] = Array.isArray(value) ? value.map(v => typeof v === "bigint" ? v.toString() : v)
        : (typeof value === "bigint" ? value.toString() : value);
    } catch (e) { problems.push({ note: "ORACLE_DECODE_FAIL", subject: spec.subject, fn: spec.fn, err: String(e.message).slice(0, 150), raw: String(raw).slice(0, 40) }); }
  }
}
// ---- downstream feeds (bounded) ----
const zero = zeroAddress.toLowerCase();
const known = new Set([...tokenSet.values(), ...oracleSet.values()].map(a => a.toLowerCase()));
known.add(zero);
const newFeeds = new Map();
for (const info of Object.values(decodedOracles)) {
  for (const key of ["baseFeed1", "baseFeed2", "quoteFeed1", "quoteFeed2", "aggregator", "baseVault", "quoteVault"]) {
    const address = info?.[key];
    if (typeof address === "string" && address.length >= 42 && address.toLowerCase() !== zero && !known.has(address.toLowerCase()) && newFeeds.size < 8)
      newFeeds.set(address.toLowerCase(), address);
  }
}
const feedMeta = {};
{
  const feedCalls = [], feedSpecs = [];
  for (const address of [...newFeeds.values()]) {
    for (const name of ["typeAndVersion", "description", "decimals", "owner", "aggregator", "latestAnswer", "latestTimestamp", "price"]) {
      feedSpecs.push({ subject: address.toLowerCase(), fn: name });
      feedCalls.push({ target: address, data: encodeFunctionData({ abi: oracleAbi, functionName: name, args: [] }).catch?.(() => null) });
    }
  }
  const safeCalls = [];
  for (const [i, call] of feedCalls.entries()) {
    if (!call?.data) continue;
    safeCalls.push({ call: feedCalls[i], spec: feedSpecs[i] });
  }
  const results = await readBatch(safeCalls.map(s => s.call));
  for (const [i, s] of safeCalls.entries()) {
    const raw = results[i];
    if (!raw) { problems.push({ note: "FEED_RAW_NULL", subject: s.spec.subject, fn: s.spec.fn }); continue; }
    try {
      const value = decodeFunctionResult({ abi: oracleAbi, functionName: s.spec.fn, data: raw });
      (feedMeta[s.spec.subject] ??= {})[s.spec.fn] = Array.isArray(value) ? value.map(v => typeof v === "bigint" ? v.toString() : v)
        : (typeof value === "bigint" ? value.toString() : value);
    } catch (e) { problems.push({ note: "FEED_DECODE_FAIL", subject: s.spec.subject, fn: s.spec.fn, err: String(e.message).slice(0, 120) }); }
  }
}
const summary = { requestedAt: new Date().toISOString(), requestCount: requests, headBlock: headBlock.toString(),
  states, decodedTokens, decodedOracles, newlyFoundFeeds: feedMeta, problems, traceCount: trace.length };
writeFileSync(join(dir, "summary4.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(dir, "trace4.json"), JSON.stringify(trace, null, 2));
console.log(JSON.stringify({ requestCount: requests, headBlock: headBlock.toString(), problems: problems.slice(0, 12),
  decodedTokens: Object.keys(decodedTokens), decodedOracles: Object.keys(decodedOracles), newFeeds: Object.keys(feedMeta) }, null, 1));
