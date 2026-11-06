import { createHash } from "node:crypto";
import { hexToBytes, keccak256, zeroAddress } from "viem";
import type { Address, Hex } from "viem";
import { z } from "zod";
import { DEPLOYMENT, NETWORK, READ_LIMITS, RUNTIME_HASHES } from "../config/deployment.js";
import { DataError } from "../domain/errors.js";
import { stringify } from "../domain/serialize.js";
import type { BlockRef, EvidenceKind, Finding, Scope, Snapshot } from "../domain/types.js";
import { accruePosition, valuePosition } from "../morpho/accounting.js";
import { irmAbi, morphoAbi, tokenAbi } from "../morpho/abi.js";
import { cacheAbi, feedAbi, forwarderAbi, oracleAbi, oracleFactoryAbi } from "../oracle/abi.js";
import { assessOracle, emptyOracle } from "../oracle/validate.js";
import { deriveMarketId, validateChainId, validateMarket, validateMarketParams, validatePosition, validateToken } from "../validation/market.js";
import { addressSchema, hashSchema, metadataTextSchema, parseData, sameHex, uint256Schema } from "../validation/schemas.js";
import { canCalculate, summarizeQuality } from "../validation/quality.js";
import type { ReadClient } from "./client.js";
import { contractCall, readComparedBatch } from "./multicall.js";
import type { CallSpec, Subcall } from "./multicall.js";
import { demoPositionConfiguration } from "../config/position.js";
import type { PositionConfiguration } from "../config/position.js";

const digest = (value: unknown) => createHash("sha256").update(stringify(value, 0)).digest("hex");

export function validateBlock(block: BlockRef, requested: bigint, now: Date): void {
  if (block.number !== requested || block.number <= 0n || block.timestamp <= 0n || /^0x0{64}$/.test(block.hash)) {
    throw new DataError("INVALID_BLOCK", "Block header is missing, invalid, or belongs to another block number.", "consistency");
  }
  if (block.timestamp > BigInt(Math.floor(now.getTime() / 1_000))) {
    throw new DataError("FUTURE_BLOCK", "Block timestamp is later than the local retrieval clock.", "consistency");
  }
}

export function initialQueries(position: PositionConfiguration = demoPositionConfiguration()): CallSpec[] {
  const d = position.identity;
  const calls = [
    contractCall("params", d.protocolAddress, morphoAbi, "idToMarketParams", [d.marketId], "market"),
    contractCall("market", d.protocolAddress, morphoAbi, "market", [d.marketId], "market"),
    contractCall("position", d.protocolAddress, morphoAbi, "position", [d.marketId, d.account], "position"),
    contractCall("irmEnabled", d.protocolAddress, morphoAbi, "isIrmEnabled", [d.irmAddress], "market"),
    contractCall("lltvEnabled", d.protocolAddress, morphoAbi, "isLltvEnabled", [DEPLOYMENT.lltv], "market"),
    contractCall("factoryRecognizesOracle", DEPLOYMENT.oracleFactory, oracleFactoryAbi, "isMorphoChainlinkOracleV2", [d.oracleAddress], "oracle")
  ];
  for (const [role, address] of [["loan", d.loanToken], ["collateral", d.collateralToken]] as const) {
    for (const name of ["decimals", "symbol", "name"]) calls.push(contractCall(`${role}.${name}`, address, tokenAbi, name, [], "tokens"));
  }
  for (const name of ["price", "BASE_VAULT", "QUOTE_VAULT", "BASE_FEED_1", "BASE_FEED_2", "QUOTE_FEED_1", "QUOTE_FEED_2", "BASE_VAULT_CONVERSION_SAMPLE", "QUOTE_VAULT_CONVERSION_SAMPLE", "SCALE_FACTOR"]) {
    calls.push(contractCall(`oracle.${name}`, d.oracleAddress, oracleAbi, name, [], "oracle"));
  }
  for (const name of ["latestRoundData", "latestTimestamp", "decimals", "description", "typeAndVersion", "owner", "aggregator", "getFeedId"]) {
    calls.push(contractCall(`feed.${name}`, DEPLOYMENT.feed, feedAbi, name, [], "oracle"));
  }
  return calls;
}

export interface InspectOptions {
  rpc: ReadClient;
  mcp: ReadClient;
  blockNumber?: bigint;
  evidenceKind?: EvidenceKind;
  now?: () => Date;
  position?: PositionConfiguration;
}

export async function inspectPosition(options: InspectOptions): Promise<Snapshot> {
  const { rpc, mcp } = options;
  const position = options.position ?? demoPositionConfiguration(), identity = position.identity;
  const now = options.now ?? (() => new Date());
  const findings: Finding[] = [];
  const snapshot: Snapshot = {
    schemaVersion: 1,
    evidenceKind: options.evidenceKind ?? (options.blockNumber === undefined ? "LIVE_CHAIN_READ" : "HISTORICAL_SNAPSHOT"),
    network: NETWORK, account: identity.account, accountRole: position.accountRole,
    marketId: identity.marketId, startedAt: now().toISOString(), retrievedAt: now().toISOString(),
    block: null, heads: { rpc: null, mcp: null, selectionLagBlocks: READ_LIMITS.blockLag },
    observedChainIds: { rpc: null, mcp: null }, contracts: [], params: null, derivedMarketId: null,
    market: null, position: null, tokens: { loan: null, collateral: null }, oracle: emptyOracle(),
    borrowRatePerSecondWad: null, accounting: null, valuation: null,
    consistency: { rpcBefore: null, mcpBefore: null, rpcAfter: null, mcpAfter: null, blockHashesStable: false, batchSentinelsChecked: 0, comparisons: [] },
    quality: summarizeQuality(findings), accepted: false, actionable: false, reads: []
  };
  const recordError = (error: unknown) => {
    if (error instanceof DataError && error.quality !== "VALID") {
      findings.push({ scope: error.scope, status: error.quality, code: error.code, message: error.message });
    } else {
      findings.push({ scope: "snapshot", status: "UNAVAILABLE", code: "READ_FAILED", message: "Snapshot retrieval failed; no substitute values or risk classification were produced." });
    }
  };
  const attempt = <T>(operation: () => T): T | null => {
    try { return operation(); } catch (error) { recordError(error); return null; }
  };
  const compare = (label: string, left: unknown, right: unknown, blockNumber: bigint | null) => {
    const rpcDigest = digest(left), mcpDigest = digest(right);
    const matches = rpcDigest === mcpDigest;
    snapshot.consistency.comparisons.push({ label, blockNumber, matches, rpcDigest, mcpDigest });
    if (!matches) throw new DataError("MCP_RPC_DISAGREEMENT", `${label}: MCP and RPC evidence disagree.`, "consistency");
  };
  const verifyCode = async (label: string, address: Address, block: BlockRef, expected: Hex | null = null) => {
    const rpcCode = await rpc.code(address, block.number);
    const mcpCode = await mcp.code(address, block.number);
    const hash = keccak256(rpcCode);
    snapshot.contracts.push({
      label, address, blockNumber: block.number, byteLength: hexToBytes(rpcCode).length,
      keccak256: hash, sha256: createHash("sha256").update(hexToBytes(rpcCode)).digest("hex"),
      expectedRuntimeHash: expected, runtimeHashMatches: expected === null ? null : sameHex(hash, expected),
      mcpMatchesRpc: sameHex(rpcCode, mcpCode)
    });
    compare(`code:${label}`, rpcCode.toLowerCase(), mcpCode.toLowerCase(), block.number);
    if (rpcCode === "0x") throw new DataError("MISSING_CONTRACT_CODE", `${label} has no deployed bytecode at the pinned block.`, "contracts");
    if (expected !== null && !sameHex(hash, expected)) {
      if (label === "Multicall3") throw new DataError("MULTICALL_CODE_MISMATCH", "Multicall3 runtime differs from its verified bytecode pin.", "contracts");
      findings.push({ scope: "oracle", status: "UNVERIFIED", code: "ORACLE_RUNTIME_CHANGED", message: `${label} runtime differs from the investigated version.` });
    }
  };
  const batch = async (block: BlockRef, label: string, calls: CallSpec[]) => {
    const result = await readComparedBatch(rpc, mcp, block, label, calls);
    findings.push(...result.findings);
    snapshot.consistency.comparisons.push(...result.comparisons);
    snapshot.consistency.batchSentinelsChecked += result.sentinels;
    return result.reads;
  };
  const value = <T>(reads: Map<string, Subcall>, key: string, schema: z.ZodType<T>, scope: Scope): T | null => {
    const read = reads.get(key);
    if (!read || read.finding) return null;
    return attempt(() => parseData(schema, read.value, "INVALID_CONTRACT_RESULT", scope));
  };
  const raw = (reads: Map<string, Subcall>, key: string): unknown => {
    const read = reads.get(key);
    return read?.finding ? null : read?.value;
  };
  const requireScopeData = (scope: Scope, ready: boolean, message: string, status: "UNAVAILABLE" | "STALE" = "UNAVAILABLE") => {
    if (!ready && !findings.some(item => item.scope === scope && ["INVALID", "UNAVAILABLE"].includes(item.status))) {
      findings.push({ scope, status, code: "SCOPE_DATA_UNAVAILABLE", message });
    }
  };

  try {
    snapshot.observedChainIds.rpc = await rpc.chainId();
    validateChainId(snapshot.observedChainIds.rpc);
    snapshot.observedChainIds.mcp = await mcp.chainId();
    validateChainId(snapshot.observedChainIds.mcp);
    compare("chainId", snapshot.observedChainIds.rpc, snapshot.observedChainIds.mcp, null);
    snapshot.heads.rpc = await rpc.blockNumber();
    snapshot.heads.mcp = await mcp.blockNumber();
    const commonHead = snapshot.heads.rpc < snapshot.heads.mcp ? snapshot.heads.rpc : snapshot.heads.mcp;
    if (commonHead <= READ_LIMITS.blockLag) throw new DataError("INVALID_HEAD", "Reported chain head is too low.", "network");
    const selected = options.blockNumber ?? commonHead - READ_LIMITS.blockLag;
    if (selected <= 0n || selected > commonHead) throw new DataError("INVALID_BLOCK_INPUT", "Requested block is not available on both providers.", "consistency");
    const block = await rpc.block(selected);
    validateBlock(block, selected, now());
    snapshot.block = block;
    snapshot.consistency.rpcBefore = block;
    const mcpBlock = await mcp.block(selected);
    validateBlock(mcpBlock, selected, now());
    snapshot.consistency.mcpBefore = mcpBlock;
    compare("initial block header", block, mcpBlock, selected);

    for (const [label, address, expected] of [
      ["Multicall3", DEPLOYMENT.multicall, RUNTIME_HASHES.multicall],
      ["Morpho Blue", identity.protocolAddress, null],
      ["Adaptive Curve IRM", identity.irmAddress, null],
      ["Oracle factory", DEPLOYMENT.oracleFactory, null],
      ["Market oracle", identity.oracleAddress, null],
      ["Loan token", identity.loanToken, null],
      ["Collateral token", identity.collateralToken, null],
      ["Feed proxy", DEPLOYMENT.feed, RUNTIME_HASHES.feed]
    ] as const) await verifyCode(label, address, block, expected);

    const first = await batch(block, "market-and-oracle", initialQueries(position));
    if (raw(first, "params") != null) snapshot.params = attempt(() => validateMarketParams(raw(first, "params")));
    if (snapshot.params) snapshot.derivedMarketId = deriveMarketId(snapshot.params);
    if (raw(first, "market") != null) snapshot.market = attempt(() => validateMarket(raw(first, "market"), block));
    if (snapshot.market && raw(first, "position") != null) {
      const market = snapshot.market;
      snapshot.position = attempt(() => validatePosition(raw(first, "position"), market));
    }
    for (const key of ["irmEnabled", "lltvEnabled", "factoryRecognizesOracle"]) {
      const scope = key === "factoryRecognizesOracle" ? "oracle" : "market";
      const enabled = value(first, key, z.boolean(), scope);
      if (enabled === false) findings.push({ scope, status: "INVALID", code: "DEPLOYMENT_REGISTRY_MISMATCH", message: `${key} returned false.` });
    }
    for (const role of ["loan", "collateral"] as const) {
      const address = role === "loan" ? identity.loanToken : identity.collateralToken;
      if (["decimals", "symbol", "name"].every(name => raw(first, `${role}.${name}`) != null)) {
        snapshot.tokens[role] = attempt(() => validateToken({
          address, decimals: raw(first, `${role}.decimals`), symbol: raw(first, `${role}.symbol`), name: raw(first, `${role}.name`)
        }, role));
      }
    }
    const o = snapshot.oracle;
    o.price = value(first, "oracle.price", uint256Schema, "oracle");
    const composition: Record<string, unknown> = {};
    for (const [key, getter] of [
      ["baseVault", "BASE_VAULT"], ["quoteVault", "QUOTE_VAULT"], ["baseFeed1", "BASE_FEED_1"], ["baseFeed2", "BASE_FEED_2"],
      ["quoteFeed1", "QUOTE_FEED_1"], ["quoteFeed2", "QUOTE_FEED_2"], ["baseVaultConversionSample", "BASE_VAULT_CONVERSION_SAMPLE"],
      ["quoteVaultConversionSample", "QUOTE_VAULT_CONVERSION_SAMPLE"], ["scaleFactor", "SCALE_FACTOR"]
    ]) {
      if (key && getter) composition[key] = raw(first, `oracle.${getter}`);
    }
    if (Object.values(composition).every(item => item != null)) {
      o.composition = attempt(() => parseData(z.object({
        baseVault: addressSchema, quoteVault: addressSchema, baseFeed1: addressSchema, baseFeed2: addressSchema,
        quoteFeed1: addressSchema, quoteFeed2: addressSchema, baseVaultConversionSample: uint256Schema,
        quoteVaultConversionSample: uint256Schema, scaleFactor: uint256Schema
      }), composition, "INVALID_ORACLE_COMPOSITION", "oracle"));
    }
    const round = value(first, "feed.latestRoundData", z.tuple([uint256Schema, z.bigint(), uint256Schema, uint256Schema, uint256Schema]), "oracle");
    if (round) o.round = { roundId: round[0], answer: round[1], startedAt: round[2], updatedAt: round[3], answeredInRound: round[4] };
    o.latestTimestamp = value(first, "feed.latestTimestamp", uint256Schema, "oracle");
    o.decimals = value(first, "feed.decimals", z.number().int().min(0).max(77), "oracle");
    o.description = value(first, "feed.description", metadataTextSchema, "oracle");
    o.typeAndVersion = value(first, "feed.typeAndVersion", metadataTextSchema, "oracle");
    o.proxyOwner = value(first, "feed.owner", addressSchema, "oracle");
    o.cache = value(first, "feed.aggregator", addressSchema, "oracle");
    o.feedId = value(first, "feed.getFeedId", hashSchema, "oracle");

    const secondQueries: CallSpec[] = [];
    if (snapshot.params && snapshot.market) secondQueries.push(contractCall("rate", snapshot.params.irm, irmAbi, "borrowRateView", [snapshot.params, snapshot.market], "accounting"));
    if (o.cache && o.feedId) {
      if (sameHex(o.cache, zeroAddress) || /^0x0{64}$/.test(o.feedId)) throw new DataError("INVALID_CACHE_CONFIG", "Proxy cache or feed ID is zero.", "oracle");
      await verifyCode("Feed cache", o.cache, block, RUNTIME_HASHES.cache);
      for (const method of ["owner", "typeAndVersion", "getForwarderAddress", "getAllowedWorkflowOwner"]) {
        secondQueries.push(contractCall(`cache.${method}`, o.cache, cacheAbi, method, [], "oracle"));
      }
      for (const method of ["latestAnswerForFeed", "latestAnswerTimestampForFeed"]) {
        secondQueries.push(contractCall(`cache.${method}`, o.cache, cacheAbi, method, [o.feedId], "oracle"));
      }
    }
    if (secondQueries.length) {
      const second = await batch(block, "rate-and-cache", secondQueries);
      snapshot.borrowRatePerSecondWad = value(second, "rate", uint256Schema, "accounting");
      o.cacheOwner = value(second, "cache.owner", addressSchema, "oracle");
      o.cacheTypeAndVersion = value(second, "cache.typeAndVersion", metadataTextSchema, "oracle");
      o.forwarder = value(second, "cache.getForwarderAddress", addressSchema, "oracle");
      o.allowedWorkflowOwner = value(second, "cache.getAllowedWorkflowOwner", addressSchema, "oracle");
      o.cacheAnswer = value(second, "cache.latestAnswerForFeed", uint256Schema, "oracle");
      o.cacheTimestamp = value(second, "cache.latestAnswerTimestampForFeed", uint256Schema, "oracle");
    }
    if (o.forwarder && sameHex(o.forwarder, zeroAddress)) {
      throw new DataError("INVALID_FORWARDER_CONFIG", "The cache forwarder is zero, contrary to the verified adapter's configuration constraints.", "oracle");
    }
    if (o.forwarder) {
      await verifyCode("Report forwarder", o.forwarder, block);
      const third = await batch(block, "forwarder-control", [
        contractCall("forwarder.owner", o.forwarder, forwarderAbi, "owner", [], "oracle"),
        contractCall("forwarder.typeAndVersion", o.forwarder, forwarderAbi, "typeAndVersion", [], "oracle")
      ]);
      o.forwarderOwner = value(third, "forwarder.owner", addressSchema, "oracle");
      o.forwarderTypeAndVersion = value(third, "forwarder.typeAndVersion", metadataTextSchema, "oracle");
    }

    snapshot.consistency.rpcAfter = await rpc.block(selected);
    snapshot.consistency.mcpAfter = await mcp.block(selected);
    validateBlock(snapshot.consistency.rpcAfter, selected, now());
    validateBlock(snapshot.consistency.mcpAfter, selected, now());
    // Check each provider against its original header, not just against each other.
    for (const final of [snapshot.consistency.rpcAfter, snapshot.consistency.mcpAfter]) {
      if (!sameHex(final.hash, block.hash) || final.timestamp !== block.timestamp || !sameHex(final.parentHash, block.parentHash)) {
        throw new DataError("BLOCK_HASH_CHANGED", "Pinned block hash or header changed during the snapshot; snapshot rejected.", "consistency");
      }
    }
    compare("final block header", snapshot.consistency.rpcAfter, snapshot.consistency.mcpAfter, selected);
    validateChainId(await rpc.chainId());
    validateChainId(await mcp.chainId());
    snapshot.consistency.blockHashesStable = true;
  } catch (error) {
    recordError(error);
  }

  if (snapshot.block) findings.push(...assessOracle(snapshot.oracle, snapshot.block, snapshot.contracts));
  else findings.push({ scope: "oracle", status: "UNAVAILABLE", code: "ORACLE_NOT_READ", message: "No validated block was available for oracle reads." });
  requireScopeData("network", snapshot.observedChainIds.rpc !== null && snapshot.observedChainIds.mcp !== null
    && snapshot.heads.rpc !== null && snapshot.heads.mcp !== null, "Network verification did not complete on both endpoints.");
  requireScopeData("contracts", snapshot.contracts.length === 10, "The complete contract-code inventory was not verified.");
  requireScopeData("market", snapshot.params !== null && snapshot.market !== null, "Validated market parameters and totals are unavailable.");
  requireScopeData("position", snapshot.position !== null, "A validated position read is unavailable.");
  requireScopeData("tokens", snapshot.tokens.loan !== null && snapshot.tokens.collateral !== null, "Validated metadata for both market tokens is unavailable.");
  requireScopeData("consistency", snapshot.consistency.blockHashesStable, "The final block and chain rechecks did not complete successfully.");
  snapshot.quality = summarizeQuality(findings);
  snapshot.oracle.quality = snapshot.quality.byScope.oracle;
  const complete = snapshot.params && snapshot.market && snapshot.position && snapshot.block && snapshot.tokens.loan && snapshot.tokens.collateral
    && snapshot.borrowRatePerSecondWad !== null && snapshot.oracle.price !== null;
  if (complete && canCalculate(snapshot.quality.overall) && snapshot.consistency.blockHashesStable) {
    const { params, market, position, block, borrowRatePerSecondWad } = snapshot;
    if (params && market && position && block && borrowRatePerSecondWad !== null && snapshot.oracle.price !== null) {
      snapshot.accounting = attempt(() => accruePosition(params, market, position, block.timestamp, borrowRatePerSecondWad));
      if (snapshot.accounting) {
        const debt = snapshot.accounting.debt;
        snapshot.valuation = attempt(() => valuePosition(position.collateral, snapshot.oracle.price!, params.lltv, debt));
      }
    }
  }
  requireScopeData("accounting", snapshot.accounting !== null && snapshot.valuation !== null,
    "Derived accounting is unavailable because its required inputs or consistency checks did not pass.",
    snapshot.quality.overall === "STALE" ? "STALE" : "UNAVAILABLE");
  snapshot.quality = summarizeQuality(findings);
  snapshot.oracle.quality = snapshot.quality.byScope.oracle;
  snapshot.accepted = Boolean(snapshot.accounting && snapshot.valuation && snapshot.consistency.blockHashesStable && canCalculate(snapshot.quality.overall));
  if (!snapshot.accepted) { snapshot.accounting = null; snapshot.valuation = null; }
  snapshot.retrievedAt = now().toISOString();
  snapshot.reads = [...rpc.records, ...mcp.records].sort((a, b) => a.retrievedAt.localeCompare(b.retrievedAt));
  return snapshot;
}
