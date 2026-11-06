// Stage 5A bounded read-only discovery, run 3. No monitoring, no repo writes, no signing, no paid access.
// Event topic0 + canonical signatures: retained compiler-output ABI (event-signatures.json). Log window: 1000 blocks (audited bound).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const TOPIC = {
  Borrow: "0x570954540bed6b1304a87dfe815a5eda4a648f7097a16240dcd85c9b5fd42a43",
  SupplyCollateral: "0xa3b9472a1399e17e123f3c2e6586c23e504184d504de59cdaa2b375e880c6184"
};
const EXTENDED_BLOCKS = 150000n;   // ~36h; covers from before the Stage 2 anchor (Nov 5 23:46Z) to head
const WINDOW = 1000n;              // audited maximum safe log window on this node
const LOG_CAP = 512;
const REQUEST_BUDGET = 460;
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
      if (trace.length > 600) trace.splice(0, 300);
      return json.result;
    } catch (error) {
      if (attempt === 1) { trace.push({ method, error: String(error.payload ?? error.message).slice(0, 220), began }); return null; }
      await new Promise(resolve => setTimeout(resolve, 900));
    }
  }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const Agg = parseAbi(["function aggregate3((address,bool,bytes)[]) returns ((bool,bytes)[])"]);
async function readBatch(calls) {
  const out = [];
  for (let start = 0; start < calls.length; start += 30) {
    const chunk = calls.slice(start, start + 30);
    const payload = encodeFunctionData({ abi: Agg, functionName: "aggregate3", args: [chunk.map(call => [call.target, true, call.data])] });
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
// ---------- Phase 0 ----------
const headBlock = BigInt(await rpc("eth_blockNumber", []));
await sleep(600);
const fromBlock = headBlock - EXTENDED_BLOCKS > 1n ? headBlock - EXTENDED_BLOCKS : 1n;
// ---------- Phase 1: extended activity rake (split on cap) ----------
const activity = new Map(); // id -> { borrowCount, supplyCollateralCount, borrowerSamples:Set, supplierSamples:Set, lastBorrow, lastSupply, capWindows }
const windowNotes = [];
let scanNulls = 0, splitCount = 0;
function note(kind, id, who, block) {
  const entry = activity.get(id) ?? { borrowCount: 0, supplyCollateralCount: 0, borrowerSamples: new Set(), supplierSamples: new Set(),
    lastBorrow: 0n, lastSupply: 0n, capWindows: 0 };
  if (kind === "Borrow") { entry.borrowCount++; if (entry.borrowerSamples.size < 3) entry.borrowerSamples.add(who); entry.lastBorrow = block; }
  else { entry.supplyCollateralCount++; if (entry.supplierSamples.size < 2) entry.supplierSamples.add(who); entry.lastSupply = block; }
  activity.set(id, entry);
}
async function scanWindow(kind, start, end, depth) {
  const logs = await rpc("eth_getLogs", [{ address: MORPHO, topics: [TOPIC[kind]], fromBlock: toHex(start), toBlock: toHex(end) }]);
  await sleep(450);
  if (logs === null) { scanNulls++; windowNotes.push({ kind, start: start.toString(), end: end.toString(), result: "NULL" }); return; }
  if (!Array.isArray(logs)) { windowNotes.push({ kind, start: start.toString(), end: end.toString(), result: "UNEXPECTED" }); return; }
  if (logs.length >= LOG_CAP && depth < 2) {
    splitCount++;
    windowNotes.push({ kind, start: start.toString(), end: end.toString(), result: "CAP_512_SPLIT" });
    const mid = (start + end) / 2n;
    await scanWindow(kind, start, mid, depth + 1);
    if (end > mid) await scanWindow(kind, mid + 1n, end, depth + 1);
    return;
  }
  for (const log of logs) {
    // Borrow topics: [topic0, id, onBehalf, receiver]; SupplyCollateral topics: [topic0, id, caller, onBehalf]
    note(kind, log.topics[1], log.topics[log.topics.length >= 4 ? 3 : 2], BigInt(log.blockNumber));
  }
}
for (const kind of ["Borrow", "SupplyCollateral"]) {
  for (let cursor = fromBlock; cursor <= headBlock + 1n; cursor += WINDOW) {
    const end = cursor + WINDOW - 1n > headBlock ? headBlock : cursor + WINDOW - 1n;
    await scanWindow(kind, cursor, end, 0);
  }
}
// seed the Stage 2 market id explicitly (its activity may predate the window)
// ---------- Phase 2: params + state ----------
const morphoAbi = parseAbi([
  "function idToMarketParams(bytes32) view returns ((address,address,address,address,uint256))",
  "function market(bytes32) view returns ((uint128,uint128,uint128,uint128,uint128,uint128))",
  "function position(bytes32,address) view returns ((uint256,uint128,uint128))"
]);
const ids = [...new Set([...activity.keys(), STAGE2_MARKET])];
const paramResults = await readBatch(ids.map(id => ({ target: MORPHO, data: encodeFunctionData({ abi: morphoAbi, functionName: "idToMarketParams", args: [id] }) })));
const stateResults = await readBatch(ids.map(id => ({ target: MORPHO, data: encodeFunctionData({ abi: morphoAbi, functionName: "market", args: [id] }) })));
const paramsById = new Map();
for (const [i, id] of ids.entries()) {
  const raw = paramResults[i];
  if (!raw) continue;
  try {
    const p = decodeFunctionResult({ abi: morphoAbi, functionName: "idToMarketParams", data: raw }); // single output unwraps directly
    paramsById.set(id, { loanToken: getAddress(p[0]), collateralToken: getAddress(p[1]), oracle: getAddress(p[2]), irm: getAddress(p[3]), lltv: p[4].toString() });
  } catch { }
}
for (const [id, p] of paramsById) {
  p.derivedId = keccak256(encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "uint256" }],
    [p.loanToken, p.collateralToken, p.oracle, p.irm, BigInt(p.lltv)]));
  p.derivedIdMatches = p.derivedId.toLowerCase() === id.toLowerCase();
}
// ---------- Phase 3: ERC20 + oracle ---------- (as before, single-output unwraps direct)
const tokenSet = new Map(), oracleSet = new Map();
for (const p of paramsById.values()) {
  for (const t of [p.loanToken, p.collateralToken]) if (t) tokenSet.set(t.toLowerCase(), t);
  if (p.oracle) oracleSet.set(p.oracle.toLowerCase(), p.oracle);
}
const erc20Abi = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)", "function name() view returns (string)",
  "function balanceOf(address) view returns (uint256)"]);
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
    try { (decodedTokens[spec.subject] ??= {})[spec.fn] = fnName === "decimals" ? decodeFunctionResult({ abi: erc20Abi, functionName: fnName, data: raw }).toString()
      : (() => { const v = decodeFunctionResult({ abi: erc20Abi, functionName: fnName, data: raw }); return typeof v === "bigint" ? v.toString() : v; })(); } catch { }
  }
}
{
  const results = await readBatch(oracleCalls);
  for (const [i, spec] of oracleSpecs.entries()) {
    const raw = results[i];
    if (!raw) continue;
    try {
      const value = decodeFunctionResult({ abi: oracleAbi, functionName: spec.fn, data: raw });
      (decodedOracles[spec.subject] ??= {})[spec.fn] = Array.isArray(value)
        ? value.map(v => typeof v === "bigint" ? v.toString() : v)
        : (typeof value === "bigint" ? value.toString() : value);
    } catch { }
  }
}
// ---------- Phase 4: downstream feeds ----------
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
      (feedMeta[spec.subject] ??= {})[spec.fn] = Array.isArray(value) ? value.map(v => typeof v === "bigint" ? v.toString() : v)
        : (typeof value === "bigint" ? value.toString() : value);
    } catch { }
  }
}
// ---------- Phase 5: position samples ----------
const ranked = ids.map(id => {
  const a = activity.get(id) ?? { borrowCount: 0, supplyCollateralCount: 0, borrowerSamples: new Set(), supplierSamples: new Set(), lastBorrow: 0n, lastSupply: 0n, capWindows: 0 };
  const score = a.lastBorrow > a.lastSupply ? a.lastBorrow : a.lastSupply;
  return { id, score: score.toString(), borrowCount: a.borrowCount, supplyCollateralCount: a.supplyCollateralCount,
    borrowerSamples: [...a.borrowerSamples], supplierSamples: [...a.supplierSamples], lastBorrow: a.lastBorrow.toString(), lastSupply: a.lastSupply.toString() };
}).sort((a, b) => (BigInt(a.score) > BigInt(b.score) ? -1 : 1));
const positionResults = {};
{
  const positionCalls = [], positionSpecs = [];
  for (const r of ranked.slice(0, 12)) {
    const who0 = [...r.borrowerSamples, ...r.supplierSamples].slice(0, 5).filter(w => typeof w === "string" && w.length >= 66);
    for (const who of who0) {
      const addr = getAddress("0x" + who.slice(-40));
      positionSpecs.push({ id: r.id, who: addr });
      positionCalls.push({ target: MORPHO, data: encodeFunctionData({ abi: morphoAbi, functionName: "position", args: [r.id, addr] }) });
    }
  }
  const results = await readBatch(positionCalls);
  for (let i = 0; i < results.length; i++) {
    const spec = positionSpecs[i], raw = results[i];
    if (!raw) continue;
    try {
      const value = decodeFunctionResult({ abi: morphoAbi, functionName: "position", data: raw });
      (positionResults[spec.id] ??= {})[spec.who] = { supplyShares: value[0].toString(), borrowShares: value[1].toString(), collateral: value[2].toString() };
    } catch { }
  }
}
// ---------- display ----------
const display = ranked.map(r => {
  const id = r.id, p = paramsById.get(id);
  const idx = ids.indexOf(id);
  let state = null;
  const raw = stateResults[idx];
  if (raw) {
    try { state = decodeFunctionResult({ abi: morphoAbi, functionName: "market", data: raw }).map(v => v.toString()); } catch { state = null; }
  }
  const loan = p ? decodedTokens[p.loanToken.toLowerCase()] : null;
  const col = p ? decodedTokens[p.collateralToken.toLowerCase()] : null;
  const oracleInfo = p ? decodedOracles[p.oracle.toLowerCase()] : null;
  return { marketId: id, isStage2Market: id === STAGE2_MARKET, idVerified: p ? p.derivedIdMatches : null,
    borrowCount: r.borrowCount, supplyCollateralCount: r.supplyCollateralCount, lastBorrowBlock: r.lastBorrow, lastSupplyBlock: r.lastSupply,
    recentPositions: positionResults[id] ?? {},
    params: p?.params !== undefined ? p.params : (p ? { loanToken: p.loanToken, collateralToken: p.collateralToken, oracle: p.oracle, irm: p.irm, lltv: p.lltv, derivedIdMatches: p.derivedIdMatches } : null),
    loan: p ? { address: p.loanToken, symbol: loan?.symbol ?? null, decimals: loan?.decimals ?? null, name: loan?.name ?? null } : null,
    collateral: p ? { address: p.collateralToken, symbol: col?.symbol ?? null, decimals: col?.decimals ?? null, name: col?.name ?? null,
      morphoBalance: col ? col["balanceOf(morpho)"] ?? null : null } : null,
    oracle: p ? { address: p.oracle, ...(oracleInfo ?? {}) } : null,
    state: state ? { totalSupplyAssets: state[0], totalSupplyShares: state[1], totalBorrowAssets: state[2],
      totalBorrowShares: state[3], lastUpdate: state[4], fee: state[5] } : null };
});
const summary = { requestedAt: new Date().toISOString(), endpoint, requestCount: requests, requestBudget: REQUEST_BUDGET,
  headBlock: headBlock.toString(), scanFromBlock: fromBlock.toString(), extendedBlocks: EXTENDED_BLOCKS.toString(),
  windowSize: WINDOW.toString(), scanNulls, splitCount, windowNotes: windowNotes.slice(0, 60),
  idEnumerationSource: "Borrow/SupplyCollateral logs + Stage2 anchor id",
  distinctIds: ids.length, paramsDecoded: paramsById.size, newlyFoundFeeds: feedMeta, ranked, candidates: display };
writeFileSync(join(dir, "summary3.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(dir, "trace3.json"), JSON.stringify(trace, null, 2));
console.log(JSON.stringify({ requestCount: requests, headBlock: headBlock.toString(), scanNulls, splitCount, distinctIds: ids.length,
  paramsDecoded: paramsById.size,
  top: ranked.map(r => ({ id: r.id.slice(0, 12), borrow: r.borrowCount, sc: r.supplyCollateralCount, score: r.score })) }, null, 1));
