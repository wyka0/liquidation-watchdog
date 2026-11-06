// Stage 5A bounded read-only discovery. No monitoring, no repo writes, no signing, no paid access.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { encodeFunctionData, decodeFunctionResult, decodeFunctionData, parseAbi, keccak256, encodePacked, stringToHex, toHex, getAddress } =
  await import("file:///C:/liquidation-watchdog/node_modules/viem/_esm/index.js");
const dir = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/stage5a-discovery";
mkdirSync(dir, { recursive: true });
const endpoint = "https://rpc.pharos.xyz";
const MORPHO = "0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb";
const USDC = "0xC879C018dB60520F4355C26eD1a6D572cdAC1815";
const STAGE2_MARKET = "0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73";
const MULTICALL = "0xcA11bde05977b3631167028862bE2a173976CA11";
const trace = [];
let requests = 0;
const REQUEST_BUDGET = 130;
function rpc(method, params) { return rpcAsync(method, params) }
async function rpcAsync(method, params) {
  if (++requests > REQUEST_BUDGET) throw new Error("REQUEST_BUDGET_EXHAUSTED");
  const began = new Date().toISOString();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: controller.signal });
      clearTimeout(timer);
      const json = await res.json();
      if (json.error) { const e = new Error("RPC_ERROR"); e.payload = JSON.stringify(json.error).slice(0, 260); throw e; }
      trace.push({ method, params: params.length ? params : undefined, began, responseBytes: JSON.stringify(json.result).length });
      if (trace.length > 240) trace.splice(0, 120);
      return json.result;
    } catch (error) {
      if (attempt === 1) { trace.push({ method, error: String((error.payload ?? error.message)).slice(0, 200), began }); return null; }
      await new Promise(resolve => setTimeout(resolve, 900));
    }
  }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha = value => createHash("sha256").update(value).digest("hex");
const Agg = parseAbi(["function aggregate3((address,bool,bytes)[]) returns ((bool,bytes)[])"]);
async function readBatch(calls) { // [{target,data}] sequential aggregate3 in chunks of 40, returns bytes|null per input in order
  const out = [];
  for (let start = 0; start < calls.length; start += 40) {
    const chunk = calls.slice(start, start + 40);
    const payload = encodeFunctionData({ abi: Agg, functionName: "aggregate3",
      args: [chunk.map(call => [call.target, false, call.data])] });
    const result = await rpc("eth_call", [{ to: MULTICALL, data: payload }, "latest"]);
    await sleep(750);
    if (!result) { out.push(...chunk.map(() => null)); continue; }
    try {
      const values = decodeFunctionResult({ abi: Agg, functionName: "aggregate3", data: result });
      for (const v of values) out.push(v[0] ? v[1] : null);
      if (values.length !== chunk.length) trace.push({ warning: "AGG_MISMATCH", expected: chunk.length, got: values.length });
    } catch { out.push(...chunk.map(() => null)); }
  }
  return out;
}
const headBlock = BigInt(await rpc("eth_blockNumber", []));
await sleep(750);
// Morpho first-code block (binary search)
let low = 1n, high = headBlock;
while (low < high) {
  const mid = (low + high) >> 1n;
  const code = await rpc("eth_getCode", [MORPHO, toHex(mid)]);
  await sleep(500);
  if (code !== null && code.length > 2) high = mid; else low = mid + 1n;
}
const firstCodeBlock = low;
// CreateMarket enumeration
const createMarkerTopic = keccak256(stringToHex("CreateMarket(bytes32,(address,address,address,address,uint256))"));
const rawLogs = [];
let scanc = 0, window = 1n << 20n, cursor = firstCodeBlock, partial = false;
while (cursor <= headBlock && scanc < 34) {
  const end = cursor + window > headBlock ? headBlock : cursor + window;
  const logs = await rpc("eth_getLogs", [{ address: MORPHO, topics: [createMarkerTopic], fromBlock: toHex(cursor), toBlock: toHex(end) }]);
  await sleep(750); scanc++;
  if (logs === null) {
    if (window > 1n << 13n) { window >>= 1n; continue; }
    partial = true; break;
  }
  for (const log of logs) rawLogs.push(log);
  cursor = end + 1n;
}
const unique = [];
for (const log of rawLogs) if (!unique.some(u => u.id === log.topics[1])) unique.push({ id: log.topics[1], blockNumber: log.blockNumber, txHash: log.transactionHash });
// Decode params from creation transactions (validate id derivation)
const candidates = [];
const creationTxBudget = Math.min(unique.length, 24);
for (const [index, m] of unique.entries()) {
  let params = null, creator = null, creationTarget = null, decodeNote = null;
  if (index < creationTxBudget) {
    const tx = await rpc("eth_getTransactionByHash", [m.txHash]);
    await sleep(750);
    if (tx) {
      creator = tx.from; creationTarget = tx.to;
      try {
        const dec = decodeFunctionData({ abi: parseAbi(["function createMarket((address,address,address,address,uint256))"]), data: tx.input });
        params = dec.args[0];
      } catch { decodeNote = "INDIRECT_OR_MULTICALL_CREATION"; }
    }
  } else decodeNote = "TX_BUDGET_UNSPENT";
  let derived = null, matches = null;
  if (params) {
    derived = keccak256(encodePacked(["address", "address", "address", "address", "uint256"], params));
    matches = derived.toLowerCase() === m.id.toLowerCase();
  }
  candidates.push({ id: m.id, creationBlockNumber: m.blockNumber, creationTxHash: m.txHash, creator, creationTarget,
    loanToken: params ? getAddress(params[0]) : null, collateralToken: params ? getAddress(params[1]) : null,
    oracle: params ? getAddress(params[2]) : null, irm: params ? getAddress(params[3]) : null,
    lltv: params ? params[4].toString() : null, derivedId: derived, derivedIdMatches: matches, decodeNote });
}
// market state
const marketAbi = parseAbi(["function market(bytes32) view returns ((uint128,uint128,uint128,uint128,uint128,uint128))"]);
const stateResults = (await readBatch(candidates.map(c => ({ target: MORPHO,
  data: encodeFunctionData({ abi: marketAbi, functionName: "market", args: [c.id] }) }))));
// tokens + oracles
const tokenSet = new Map();
for (const c of candidates) {
  for (const t of [c.loanToken, c.collateralToken]) if (t && !tokenSet.has(t.toLowerCase())) tokenSet.set(t.toLowerCase(), { address: t });
}
const oracleSet = new Map();
for (const c of candidates) {
  if (c.oracle && !oracleSet.has(c.oracle.toLowerCase())) oracleSet.set(c.oracle.toLowerCase(), { address: c.oracle });
}
const tokenList = [...tokenSet.values()], oracleList = [...oracleSet.values()];
const tokenAbiErc20 = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)",
  "function name() view returns (string)", "function balanceOf(address) view returns (uint256)"]);
const tokenCalls = [];
const tokenSpecs = [];
for (const t of tokenList) {
  for (const name of ["symbol", "decimals", "name"]) {
    tokenSpecs.push({ subject: t.address, fn: name });
    tokenCalls.push({ target: t.address, data: encodeFunctionData({ abi: tokenAbiErc20, functionName: name, args: name === "balanceOf" ? null : [] }) });
  }
  tokenSpecs.push({ subject: t.address, fn: "balanceOf(morpho)" });
  tokenCalls.push({ target: t.address, data: encodeFunctionData({ abi: tokenAbiErc20, functionName: "balanceOf", args: [MORPHO] }) });
}
const oracleAbi = parseAbi(["function price() view returns (uint256)", "function typeAndVersion() view returns (string)",
  "function description() view returns (string)", "function decimals() view returns (uint8)", "function owner() view returns (address)",
  "function baseVault() view returns (address)", "function baseVaultConversionSample() view returns (uint256)",
  "function baseFeed1() view returns (address)", "function baseFeed2() view returns (address)",
  "function quoteVault() view returns (address)", "function quoteVaultConversionSample() view returns (uint256)",
  "function quoteFeed1() view returns (address)", "function quoteFeed2() view returns (address)",
  "function scaleFactor() view returns (uint256)", "function baseTokenDecimals() view returns (uint256)",
  "function quoteTokenDecimals() view returns (uint256)", "function getFeedId() view returns (bytes32)",
  "function aggregator() view returns (address)", "function latestAnswer() view returns (int256)",
  "function BASE_FEED_1() view returns (address)", "function BASE_FEED_2() view returns (address)",
  "function SCALE_FACTOR() view returns (uint256)"]);
const oracleNames = ["typeAndVersion", "description", "decimals", "owner", "baseVault", "baseVaultConversionSample",
  "baseFeed1", "baseFeed2", "quoteFeed1", "quoteFeed2", "scaleFactor", "baseTokenDecimals", "quoteTokenDecimals",
  "BASE_FEED_1", "BASE_FEED_2", "SCALE_FACTOR", "price", "getFeedId", "aggregator", "latestAnswer"];
const oracleCalls = [], oracleSpecs = [];
for (const o of oracleList) {
  for (const name of oracleNames) {
    oracleSpecs.push({ subject: o.address, fn: name });
    oracleCalls.push({ target: o.address, data: encodeFunctionData({ abi: oracleAbi, functionName: name, args: [] }) });
  }
}
const decodedTokens = {}, decodedOracles = {};
{
  const results = await readBatch(tokenCalls);
  for (const [i, spec] of tokenSpecs.entries()) {
    const raw = results[i];
    if (!raw) continue;
    const fnName = spec.fn === "balanceOf(morpho)" ? "balanceOf" : spec.fn;
    try {
      const value = decodeFunctionResult({ abi: tokenAbiErc20, functionName: fnName, data: raw });
      const holder = decodedTokens[spec.subject] ??= {};
      holder[spec.fn] = typeof value === "bigint" ? value.toString() : value;
    } catch { /* decoding unavailable descriptor */ }
  }
}
{
  const results = await readBatch(oracleCalls);
  for (const [i, spec] of oracleSpecs.entries()) {
    const raw = results[i];
    if (!raw) continue;
    try {
      const value = decodeFunctionResult({ abi: oracleAbi, functionName: spec.fn, data: raw });
      const holder = decodedOracles[spec.subject] ??= {};
      holder[spec.fn] = Array.isArray(value) ? Array.from(value).map(v => typeof v === "bigint" ? v.toString() : v)
        : typeof value === "bigint" ? value.toString() : value;
    } catch { /* unavailable getter */ }
  }
}
// Distinct newly-discovered feed addresses referenced by candidate oracles (bounded inspection)
const knownAddresses = new Set([...tokenList, ...oracleList].map(o => o.address.toLowerCase()));
const newFeeds = new Map();
for (const info of Object.values(decodedOracles)) {
  for (const key of ["baseFeed1", "baseFeed2", "quoteFeed1", "quoteFeed2", "aggregator"]) {
    const address = info?.[key];
    if (typeof address === "string" && address.toLowerCase() !== "0x0000000000000000000000000000000000000000"
      && !knownAddresses.has(address.toLowerCase())) newFeeds.set(address.toLowerCase(), address);
  }
}
const feedMeta = {};
const feedCalls = [], feedSpecs = [];
for (const address of [...newFeeds.values()].slice(0, 6)) {
  for (const name of ["typeAndVersion", "description", "decimals", "owner", "aggregator", "latestAnswer", "getFeedId", "price"]) {
    feedSpecs.push({ subject: address, fn: name });
    feedCalls.push({ target: address, data: encodeFunctionData({ abi: oracleAbi, functionName: name, args: [] }) });
  }
}
if (feedCalls.length) {
  const results = await readBatch(feedCalls);
  for (const [i, spec] of feedSpecs.entries()) {
    const raw = results[i];
    if (!raw) continue;
    try {
      const value = decodeFunctionResult({ abi: oracleAbi, functionName: spec.fn, data: raw });
      const holder = feedMeta[spec.subject] ??= {};
      holder[spec.fn] = typeof value === "bigint" ? value.toString() : value;
    } catch { /* unavailable getter */ }
  }
}
const display = candidates.map((c, index) => {
  const state = stateResults[index] ? Array.from(stateResults[index]) : null;
  const s = state ? state.map(v => v.toString()) : null;
  const loan = c.loanToken ? decodedTokens[c.loanToken.toLowerCase()] ?? decodedTokens[c.loanToken] : null;
  const col = c.collateralToken ? decodedTokens[c.collateralToken.toLowerCase()] ?? decodedTokens[c.collateralToken] : null;
  const oracleInfo = c.oracle ? decodedOracles[c.oracle.toLowerCase()] ?? decodedOracles[c.oracle] : null;
  const baseOnly = oracleInfo && oracleInfo.scaleFactor !== undefined && oracleInfo.quoteFeed1 === "0x0000000000000000000000000000000000000000"
    && oracleInfo.quoteFeed2 === "0x0000000000000000000000000000000000000000";
  const activeBorrow = s && s[3] !== "0";
  return { index: index + 1, marketId: c.id, idVerified: c.derivedIdMatches, creationBlock: c.creationBlockNumber,
    creator: c.creator, decodeNote: c.decodeNote,
    loan: { address: c.loanToken, symbol: loan && (loan.symbol ?? null), decimals: loan && (loan.decimals ?? null), name: loan && (loan.name ?? null) },
    collateral: { address: c.collateralToken, symbol: col && (col.symbol ?? null), decimals: col && (col.decimals ?? null),
      name: col && (col.name ?? null), morphoBalance: col && (col["balanceOf(morpho)"] ?? null) },
    lltv: c.lltv, irm: c.irm,
    oracle: { address: c.oracle, ...oracleInfo }, activeBorrow,
    loanIsKnownUSDC: (c.loanToken ?? "").toLowerCase() === USDC.toLowerCase(),
    isStage2Market: c.id === STAGE2_MARKET,
    state: s ? { totalSupplyAssets: s[0], totalSupplyShares: s[1], totalBorrowAssets: s[2], totalBorrowShares: s[3], lastUpdate: s[4], fee: s[5] } : null };
});
const summary = { requestedAt: new Date().toISOString(), endpoint, requestCount: requests, requestBudget: REQUEST_BUDGET,
  headBlock: headBlock.toString(), morphoFirstCodeBlock: firstCodeBlock.toString(), scanPartial: partial,
  createMarketLogCount: rawLogs.length, distinctMarkets: unique.length, newlyFoundFeeds: feedMeta, candidates: display };
writeFileSync(join(dir, "summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(dir, "trace.json"), JSON.stringify(trace, null, 2));
console.log(JSON.stringify({ requestCount: requests, headBlock: headBlock.toString(), firstCodeBlock: firstCodeBlock.toString(),
  distinctMarkets: unique.length, candidateCount: candidates.length, newlyFoundFeeds: Object.keys(feedMeta).length }, null, 1));
