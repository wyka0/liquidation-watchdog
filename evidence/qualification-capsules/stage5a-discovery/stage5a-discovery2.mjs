// Stage 5A bounded read-only discovery, phase 2 design. No monitoring, no repo writes, no signing, no paid access.
// Sources of truth: reproduced compiler-output ABI (event-signatures.json), reproduced IMorpho.sol/Morpho.sol,
// src/validation/market.ts id derivation, src/oracle-assurance/audit-rpc.ts bounds (1000-block log windows).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { encodeFunctionData, decodeFunctionResult, parseAbi, keccak256, encodeAbiParameters, stringToHex, toHex, getAddress, zeroAddress } =
  await import("file:///C:/liquidation-watchdog/node_modules/viem/_esm/index.js");
const dir = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/stage5a-discovery";
mkdirSync(dir, { recursive: true });
const endpoint = "https://rpc.pharos.xyz";
const MORPHO = "0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb";
const USDC = "0xC879C018dB60520F4355C26eD1a6D572cdAC1815";
const STAGE2_MARKET = "0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73";
const MULTICALL = "0xcA11bde05977b3631167028862bE2a173976CA11";
// Topic0 hashes extracted from the retained compiler-verified ABI (event-signatures.json), not guessed:
const TOPIC = {
  CreateMarket: "0xac4b2400f169220b0c0afdde7a0b32e775ba727ea1cb30b35f935cdaab8683ac",
  Borrow: "0x570954540bed6b1304a87dfe815a5eda4a648f7097a16240dcd85c9b5fd42a43",
  SupplyCollateral: "0xa3b9472a1399e17e123f3c2e6586c23e504184d504de59cdaa2b375e880c6184"
};
const RECENT_BLOCKS = 60000n;           // ~15h at ~0.86 s/block; covers since the Stage 2 anchor (Nov 5 23:46Z)
const WINDOW = 500n;                    // well under the audited 1000-block safe log window
const LOG_CAP = 512;                    // audited node cap; a full-window hit flags possible truncation
const REQUEST_BUDGET = 400;
const trace = [];
let requests = 0;
function rpc(method, params) { return rpcAsync(method, params); }
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
      if (trace.length > 500) trace.splice(0, 250);
      return json.result;
    } catch (error) {
      if (attempt === 1) { trace.push({ method, error: String(error.payload ?? error.message).slice(0, 220), began }); return null; }
      await new Promise(resolve => setTimeout(resolve, 900));
    }
  }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const Agg = parseAbi(["function aggregate3((address,bool,bytes)[]) returns ((bool,bytes)[])"]);
async function readBatch(calls) { // [{target,data}] -> raw bytes|null per input, in order; per-call safe failures
  const out = [];
  for (let start = 0; start < calls.length; start += 30) {
    const chunk = calls.slice(start, start + 30);
    const payload = encodeFunctionData({ abi: Agg, functionName: "aggregate3",
      args: [chunk.map(call => [call.target, true, call.data])] });
    const result = await rpc("eth_call", [{ to: MULTICALL, data: payload }, "latest"]);
    await sleep(600);
    if (!result) { out.push(...chunk.map(() => null)); continue; }
    try {
      const values = decodeFunctionResult({ abi: Agg, functionName: "aggregate3", data: result });
      for (const v of values) out.push(v[0] ? v[1] : null);
    } catch { out.push(...chunk.map(() => null)); }
  }
  return out;
}
// ---------- Phase 0: head ----------
const headBlock = BigInt(await rpc("eth_blockNumber", []));
await sleep(600);
const fromBlock = headBlock - RECENT_BLOCKS > 1n ? headBlock - RECENT_BLOCKS : 1n;
// ---------- Phase 1: recent-activity rake ----------
const activity = new Map(); // id -> { borrowCount, supplyCollateralCount, borrowers:Set, suppliers:Set, lastBorrowBlock, lastSupplyBlock, truncated }
function note(kind, log) {
  const id = log.topics[1];
  const entry = activity.get(id) ?? { borrowCount: 0, supplyCollateralCount: 0, borrowerSamples: new Set(), supplierSamples: new Set(),
    lastBorrowBlock: 0, lastSupplyBlock: 0, truncated: false };
  if (kind === "Borrow") {
    entry.borrowCount++; entry.borrowerSamples.add(log.topics[2]); entry.lastBorrowBlock = BigInt(log.blockNumber);
  } else {
    entry.supplyCollateralCount++; entry.supplierSamples.add(log.topics[2]); entry.lastSupplyBlock = BigInt(log.blockNumber);
  }
  activity.set(id, entry);
}
const windowNotes = [];
let scanNulls = 0;
for (const kind of ["Borrow", "SupplyCollateral"]) {
  // Merge both kinds into one pass over identical windows to halve requests? Keep separate filters for correct histogram.
  for (let cursor = fromBlock; cursor <= headBlock + 1n; cursor += WINDOW) {
    const end = cursor + WINDOW - 1n > headBlock ? headBlock : cursor + WINDOW - 1n;
    const logs = await rpc("eth_getLogs", [{ address: MORPHO, topics: [TOPIC[kind]], fromBlock: toHex(cursor), toBlock: toHex(end) }]);
    await sleep(400);
    if (logs === null) { scanNulls++; windowNotes.push({ kind, cursor: cursor.toString(), end: end.toString(), result: "NULL" }); continue; }
    if (Array.isArray(logs)) {
      if (logs.length >= LOG_CAP) windowNotes.push({ kind, cursor: cursor.toString(), end: end.toString(), result: "CAP_512" });
      for (const log of logs) note(kind, log);
    }
  }
}
const ids = [...activity.keys()];
// ---------- Phase 2: per-ID params + state via idToMarketParams/market ----------
const morphoAbi = parseAbi([
  "function idToMarketParams(bytes32) view returns ((address,address,address,address,uint256))",
  "function market(bytes32) view returns ((uint128,uint128,uint128,uint128,uint128,uint128))",
  "function position(bytes32,address) view returns ((uint256,uint128,uint128))"
]);
const paramCalls = ids.map(id => ({ target: MORPHO, data: encodeFunctionData({ abi: morphoAbi, functionName: "idToMarketParams", args: [id] }) }));
const paramResults = await readBatch(paramCalls);
const stateCalls = ids.map(id => ({ target: MORPHO, data: encodeFunctionData({ abi: morphoAbi, functionName: "market", args: [id] }) }));
const stateResults = await readBatch(stateCalls);
const paramsById = new Map();
for (const [i, id] of ids.entries()) {
  const raw = paramResults[i];
  if (raw == null) continue;
  try {
    const value = decodeFunctionResult({ abi: morphoAbi, functionName: "idToMarketParams", data: raw });
    const [loan, col, oracle, irm, lltv] = Array.from(value[0][0] !== undefined ? value[0] : value).map(v => typeof v === "bigint" ? v : v);
    paramsById.set(id, { loanToken: getAddress(loan), collateralToken: getAddress(col), oracle: getAddress(oracle), irm: getAddress(irm), lltv: lltv.toString() });
  } catch { /* record below */ }
}
// ---------------- verify ids ----------------
for (const [id, p] of paramsById) {
  const derived = keccak256(encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "uint256" }],
    [p.loanToken, p.collateralToken, p.oracle, p.irm, BigInt(p.lltv)]));
  p.derivedIdMatches = derived.toLowerCase() === id.toLowerCase();
  p.derivedId = derived;
}
// ---------- Phase 3: ERC20 + oracle getters ----------
const tokenSet = new Map();
for (const p of paramsById.values()) {
  for (const t of [p.loanToken, p.collateralToken]) if (t && !tokenSet.has(t.toLowerCase())) tokenSet.set(t.toLowerCase(), t);
}
const oracleSet = new Map();
for (const p of paramsById.values()) if (p.oracle && !oracleSet.has(p.oracle.toLowerCase())) oracleSet.set(p.oracle.toLowerCase(), p.oracle);
const erc20Abi = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)", "function name() view returns (string)",
  "function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)"]);
const tokenCalls = [], tokenSpecs = [];
for (const t of tokenSet.values()) {
  for (const name of ["symbol", "decimals", "name"]) {
    tokenSpecs.push({ subject: t, fn: name });
    tokenCalls.push({ target: t, data: encodeFunctionData({ abi: erc20Abi, functionName: name, args: [] }) });
  }
  tokenSpecs.push({ subject: t, fn: "balanceOf(morpho)" });
  tokenCalls.push({ target: t, data: encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [MORPHO] }) });
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
  "function latestTimestamp() view returns (uint256)", "function latestRoundData() view returns ((uint80,int256,uint256,uint256,uint80))"]);
const oracleNames = ["typeAndVersion", "description", "decimals", "owner", "baseVault", "baseVaultConversionSample", "baseFeed1", "baseFeed2",
  "quoteVault", "quoteVaultConversionSample", "quoteFeed1", "quoteFeed2", "scaleFactor", "baseTokenDecimals", "quoteTokenDecimals",
  "getFeedId", "aggregator", "latestAnswer", "latestTimestamp", "latestRoundData", "price"];
const oracleCalls = [], oracleSpecs = [];
for (const o of oracleSet.values()) {
  for (const name of oracleNames) {
    oracleSpecs.push({ subject: o, fn: name });
    oracleCalls.push({ target: o, data: encodeFunctionData({ abi: oracleAbi, functionName: name, args: [] }) });
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
      const value = decodeFunctionResult({ abi: erc20Abi, functionName: fnName, data: raw });
      (decodedTokens[spec.subject] ??= {})[spec.fn] = typeof value === "bigint" ? value.toString() : value;
    } catch { /* unavailable */ }
  }
}
{
  const results = await readBatch(oracleCalls);
  for (const [i, spec] of oracleSpecs.entries()) {
    const raw = results[i];
    if (!raw) continue;
    try {
      const value = decodeFunctionResult({ abi: oracleAbi, functionName: spec.fn, data: raw });
      const norm = Array.isArray(value)
        ? Array.from(value).map(v => typeof v === "bigint" ? v.toString() : v)
        : (typeof value === "bigint" ? value.toString() : value);
      (decodedOracles[spec.subject] ??= {})[spec.fn] = norm;
    } catch { /* unavailable getter */ }
  }
}
// ---------- Phase 4: downstream feed introspection (bounded) ----------
const known = new Set([...tokenSet.values(), ...oracleSet.values()].map(a => a.toLowerCase()));
known.add(zeroAddress.toLowerCase());
const newFeeds = new Map();
for (const info of Object.values(decodedOracles)) {
  for (const key of ["baseFeed1", "baseFeed2", "quoteFeed1", "quoteFeed2", "aggregator", "baseVault", "quoteVault"]) {
    const address = info?.[key];
    if (typeof address === "string" && address.length >= 42 && address.toLowerCase() !== zeroAddress.toLowerCase() && !known.has(address.toLowerCase())
      && newFeeds.size < 8) newFeeds.set(address.toLowerCase(), address);
  }
}
const feedMeta = {};
if (newFeeds.size) {
  const feedCalls = [], feedSpecs = [];
  for (const address of [...newFeeds.values()]) {
    for (const name of ["typeAndVersion", "description", "decimals", "owner", "aggregator", "latestAnswer", "latestTimestamp", "price"]) {
      feedSpecs.push({ subject: address, fn: name });
      feedCalls.push({ target: address, data: encodeFunctionData({ abi: oracleAbi, functionName: name, args: [] }) });
    }
  }
  const results = await readBatch(feedCalls);
  for (const [i, spec] of feedSpecs.entries()) {
    const raw = results[i];
    if (!raw) continue;
    try {
      const value = decodeFunctionResult({ abi: oracleAbi, functionName: spec.fn, data: raw });
      (feedMeta[spec.subject] ??= {})[spec.fn] = typeof value === "bigint" ? value.toString() : value;
    } catch { /* unavailable */ }
  }
}
// ---------- Phase 5: sampled active-position checks for top ids ----------
const ranked = ids.map(id => {
  const a = activity.get(id);
  const recent = BigInt(Math.max(Number(a.lastBorrowBlock), Number(a.lastSupplyBlock)));
  return { id, activityScore: recent, borrowCount: a.borrowCount, supplyCollateralCount: a.supplyCollateralCount,
    borrowerSamples: [...a.borrowerSamples].slice(0, 3), supplierSamples: [...a.supplierSamples].slice(0, 2) };
}).sort((a, b) => (a.activityScore > b.activityScore ? -1 : a.activityScore < b.activityScore ? 1 : 0));
const positionResults = {};
const positionCalls = [], positionSpecs = [];
for (const r of ranked.slice(0, 12)) {
  for (const who of r.borrowerSamples) {
    positionSpecs.push({ id: r.id, who });
    positionCalls.push({ target: MORPHO, data: encodeFunctionData({ abi: morphoAbi, functionName: "position", args: [r.id, who] }) });
  }
}
{
  const results = await readBatch(positionCalls);
  for (let i = 0; i < results.length; i++) {
    const spec = positionSpecs[i], raw = results[i];
    if (!raw) continue;
    try {
      const value = decodeFunctionResult({ abi: morphoAbi, functionName: "position", data: raw });
      const [supplyShares, borrowShares, collateral] = Array.from(Array.from(value)[0] !== undefined ? Array.from(value)[0] : value)
        .map(v => typeof v === "bigint" ? v.toString() : v);
      positionResults[spec.id] ??= {};
      positionResults[spec.id][spec.who] = { supplyShares, borrowShares, collateral };
    } catch { /* unavailable */ }
  }
}
// ---------- display ----------
const display = ranked.map((r, index) => {
  const p = paramsById.get(r.id);
  const id = r.id;
  const stateRaw = stateResults[index];
  let state = null;
  if (stateRaw) {
    try {
      const value = decodeFunctionResult({ abi: morphoAbi, functionName: "market", data: stateRaw });
      state = Array.from(Array.from(value)[0] !== undefined ? Array.from(value)[0] : value).map(v => v.toString());
    } catch { state = null; }
  }
  const loanToken = p ? tokenSet.get(p.loanToken.toLowerCase()) : null;
  const colToken = p ? tokenSet.get(p.collateralToken.toLowerCase()) : null;
  const loan = loanToken ? decodedTokens[loanToken] ?? decodedTokens[loanToken.toLowerCase()] : null;
  const col = colToken ? decodedTokens[colToken] ?? decodedTokens[colToken.toLowerCase()] : null;
  const oracleAddr = p ? oracleSet.get(p.oracle.toLowerCase()) : null;
  const oracleInfo = oracleAddr ? decodedOracles[oracleAddr] ?? decodedOracles[oracleAddr.toLowerCase()] : null;
  return { index: index + 1, marketId: id, idVerified: p ? p.derivedIdMatches : null,
    creationNotScanned: true,
    borrowCount: r.borrowCount, supplyCollateralCount: r.supplyCollateralCount, lastBorrowBlock: r.activityScore.toString(),
    recentPositions: positionResults[id] ?? {},
    params: p ?? null,
    loan: { address: p ? p.loanToken : null, symbol: loan?.symbol, decimals: loan?.decimals, name: loan?.name },
    collateral: { address: p ? p.collateralToken : null, symbol: col?.symbol, decimals: col?.decimals, name: col?.name,
      morphoBalance: col ? col["balanceOf(morpho)"] : null },
    oracle: { address: p ? p.oracle : null, ...oracleInfo },
    isStage2Market: id === STAGE2_MARKET,
    state: state ? { totalSupplyAssets: state[0], totalSupplyShares: state[1], totalBorrowAssets: state[2],
      totalBorrowShares: state[3], lastUpdate: state[4], fee: state[5] } : null };
});
const summary = { requestedAt: new Date().toISOString(), endpoint, requestCount: requests, requestBudget: REQUEST_BUDGET,
  headBlock: headBlock.toString(), scanFromBlock: fromBlock.toString(), recentBlocks: RECENT_BLOCKS.toString(),
  windowSize: WINDOW.toString(), scanNulls, windowNotes: windowNotes.slice(0, 40),
  eventSignaturesSource: "retained compiler-output ABI (event-signatures.json)", idSource: "idToMarketParams + derived verification",
  distinctIds: ids.length, paramsDecoded: paramsById.size, newlyFoundFeeds: feedMeta, candidates: display };
writeFileSync(join(dir, "summary2.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(dir, "trace2.json"), JSON.stringify(trace, null, 2));
console.log(JSON.stringify({ requestCount: requests, headBlock: headBlock.toString(), scanNulls, distinctIds: ids.length,
  paramsDecoded: paramsById.size, rankedTop: ranked.slice(0, 14).map(r => ({ id: r.id.slice(0, 10), borrow: r.borrowCount, sc: r.supplyCollateralCount }))
  }, null, 1));
