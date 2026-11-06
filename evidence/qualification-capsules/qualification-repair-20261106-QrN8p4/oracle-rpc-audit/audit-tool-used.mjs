// Bounded explicit oracle/configuration-only RPC audit. This does not import or invoke monitoring code.
// No borrower/position/market-balance reads, transaction submission, wallet, signing or notifications.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const repo = "C:/liquidation-watchdog", audit = dirname(fileURLToPath(import.meta.url));
const { decodeFunctionResult, encodeFunctionData, encodeAbiParameters, getAddress, keccak256, parseAbi, stringToHex, toHex } =
  await import(pathToFileURL(join(repo, "node_modules/viem/_esm/index.js")).href);
const directory = join(audit, "oracle-rpc-audit"); mkdirSync(directory);
copyFileSync(fileURLToPath(import.meta.url), join(directory, "audit-tool-used.mjs"));
const endpoint = "https://rpc.pharos.xyz";
const A = { morpho: "0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb", oracle: "0x9416F861970C2a39c02ab7696Ef0496383d4E81b",
  facade: "0xb5779919e2F183e59A34140331F7779cbFF1d1BC", cache: "0xd9F00c86ced2De92F6B7152b0492cb28edc4B5a8",
  forwarder: "0x76c9cf548b4179F8901cda1f8623568b58215E62", collateral: "0x4809010926aec940b550D34a46A52739f996D75D",
  loan: "0xC879C018dB60520F4355C26eD1a6D572cdAC1815" };
const expectedSha256 = { morpho: "5b1b9424a6dc46c6a041f8eb1d69239342e89f3726ea31dc409cae9dd333a55f",
  oracle: "178a10129f94627df4d95f019df5eb7875a4d1049364fe28ff69c06dd456c794",
  facade: "95027d40e661cafffa6a90129991f47fd63b59bd0435481f53cc5a0b2414a9fa",
  cache: "8bb736091d9032c49a1b279f51406f653b3fbf7c0880d7b917c93b2ce9086103",
  forwarder: "f9c0c886360e5fd0b5837b83a0d307cea7aab6a43ad05d2c6ebf2f023e04edd0",
  collateral: "494f468eef50ffd3c8b6debdec66583cb02c433bdb1ae8bd12f5927dc417e8e8" };
const marketId = "0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73";
const feedId = "0x0007c129e624689953a2636c014531b2f0bd0c15f9a22211f53023354f309fa6";
const knownWorkflowId = "0x00bd398f80a8f53c31e1270678b7dd5283d5b9a0f5898ae3c4ceed15455ede02";
const limits = { requests: 96, wallMs: 120_000, requestMs: 15_000, bytesPerResponse: 2_000_000, signerConfigurations: 1, signers: 31 };
const startedAt = new Date().toISOString(), started = performance.now(), trace = []; let block = null;
const json = value => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, 2) + "\n";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const save = (name, value) => writeFileSync(join(directory, name), json(value), { flag: "wx" });
const request = async (label, method, params, provenance = block) => {
  assert.ok(["eth_chainId", "eth_blockNumber", "eth_getBlockByNumber", "eth_getCode", "eth_call", "eth_getStorageAt"].includes(method), "Non-read-only method rejected");
  assert.ok(trace.length < limits.requests && performance.now() - started < limits.wallMs, "RPC audit bound exceeded");
  const id = trace.length + 1, entry = { id, label, endpoint, method, params, block: provenance, requestedAt: new Date().toISOString() };
  trace.push(entry);
  const response = await fetch(endpoint, { method: "POST", redirect: "error",
    signal: AbortSignal.timeout(Math.max(1, Math.min(limits.requestMs, Math.floor(limits.wallMs - (performance.now() - started))))),
    headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body ?? []) { bytes += chunk.length; if (bytes > limits.bytesPerResponse) throw new Error("RPC response byte bound exceeded"); chunks.push(chunk); }
  const body = Buffer.concat(chunks), bodyPath = `${String(id).padStart(3, "0")}-${label}.response.json`;
  writeFileSync(join(directory, bodyPath), body, { flag: "wx" });
  Object.assign(entry, { retrievedAt: new Date().toISOString(), httpStatus: response.status, responseBytes: body.length, responseSha256: hash(body), bodyPath });
  assert.equal(response.status, 200); const envelope = JSON.parse(body);
  assert.equal(envelope.id, id); assert.equal(envelope.jsonrpc, "2.0"); assert.equal(envelope.error, undefined, "Read-only RPC returned error");
  return envelope.result;
};
const readHeader = async (label, number, provenance = block) => {
  const header = await request(label, "eth_getBlockByNumber", [toHex(number), false], provenance);
  assert.equal(BigInt(header.number), number); assert.match(header.hash, /^0x[a-fA-F0-9]{64}$/);
  return { number: number.toString(), hash: header.hash, timestamp: BigInt(header.timestamp).toString(), parentHash: header.parentHash,
    time: new Date(Number(BigInt(header.timestamp)) * 1000).toISOString() };
};
const call = async (label, address, signature, args = []) => {
  assert.ok(Object.values(A).some(pin => pin.toLowerCase() === address.toLowerCase()), "Unapproved read target rejected");
  const abi = parseAbi([signature]), functionName = /^function ([A-Za-z0-9_]+)/.exec(signature)[1];
  const data = encodeFunctionData({ abi, functionName, args });
  const result = await request(label, "eth_call", [{ to: address, data }, toHex(BigInt(block.number))]);
  return decodeFunctionResult({ abi, functionName, data: result });
};
const storage = async (label, address, slot) => {
  assert.ok([A.facade, A.forwarder].includes(address));
  const result = await request(label, "eth_getStorageAt", [address, typeof slot === "bigint" ? toHex(slot, { size: 32 }) : slot, toHex(BigInt(block.number))]);
  assert.match(result, /^0x[a-fA-F0-9]{64}$/); return result;
};
const state = { status: "UNAVAILABLE", startedAt, chainId: null, block: null, runtimeIdentities: [], marketParameters: null,
  composition: {}, facade: {}, cache: {}, forwarder: {}, tokens: {}, eip1967: {}, sampledKnownDonConfiguration: null };
try {
  state.chainId = Number(BigInt(await request("chain-id-before", "eth_chainId", [], null))); assert.equal(state.chainId, 1672);
  const head = BigInt(await request("head-discovery", "eth_blockNumber", [], null));
  assert.ok(head > 5n); block = await readHeader("audit-block-before", head - 5n, null); state.block = block;
  state.headAtDiscovery = head.toString();
  const stage2Block = { number: "22225454", hash: "0x9515451fc030160d2c4014b4b663f0d024b50b5774bbb1bf3829bbe5cd4e883d", timestamp: "1793922408" };
  state.stage2AnchorRechecked = await readHeader("stage2-anchor-recheck", BigInt(stage2Block.number), stage2Block);
  assert.equal(state.stage2AnchorRechecked.hash, stage2Block.hash); assert.equal(state.stage2AnchorRechecked.timestamp, stage2Block.timestamp);
  for (const [label, address] of Object.entries(A)) {
    const code = await request(`${label}-runtime`, "eth_getCode", [address, toHex(BigInt(block.number))]);
    assert.match(code, /^0x(?:[a-fA-F0-9]{2})+$/);
    const identity = { label, address, bytes: (code.length - 2) / 2, sha256: hash(Buffer.from(code.slice(2), "hex")), keccak256: keccak256(code),
      expectedSha256: expectedSha256[label] ?? null };
    identity.matchesReproducedHistoricalRuntime = identity.expectedSha256 === null ? null : identity.sha256 === identity.expectedSha256;
    state.runtimeIdentities.push(identity);
  }
  assert.ok(state.runtimeIdentities.every(identity => identity.matchesReproducedHistoricalRuntime !== false), "Runtime changed; reviewed layout/behavior cannot be assumed");
  const params = await call("market-parameters", A.morpho, "function idToMarketParams(bytes32 id) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)", [marketId]);
  const [loanToken, collateralToken, oracle, irm, lltv] = params;
  state.marketParameters = { marketId, loanToken, collateralToken, oracle, irm, lltv: lltv.toString(),
    recomputedMarketId: keccak256(encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "uint256" }], params)) };
  assert.equal(state.marketParameters.recomputedMarketId, marketId);
  for (const [value, expected] of [[loanToken, A.loan], [collateralToken, A.collateral], [oracle, A.oracle]]) assert.equal(value.toLowerCase(), expected.toLowerCase());
  for (const getter of ["BASE_VAULT", "QUOTE_VAULT", "BASE_FEED_1", "BASE_FEED_2", "QUOTE_FEED_1", "QUOTE_FEED_2"])
    state.composition[getter] = await call(`oracle-${getter.toLowerCase()}`, A.oracle, `function ${getter}() view returns (address)`);
  for (const getter of ["BASE_VAULT_CONVERSION_SAMPLE", "QUOTE_VAULT_CONVERSION_SAMPLE", "SCALE_FACTOR", "price"])
    state.composition[getter] = (await call(`oracle-${getter.toLowerCase()}`, A.oracle, `function ${getter}() view returns (uint256)`)).toString();
  assert.equal(state.composition.BASE_FEED_1.toLowerCase(), A.facade.toLowerCase());
  for (const getter of ["BASE_VAULT", "QUOTE_VAULT", "BASE_FEED_2", "QUOTE_FEED_1", "QUOTE_FEED_2"]) assert.equal(BigInt(state.composition[getter]), 0n);
  assert.equal(state.composition.SCALE_FACTOR, "1000000");
  for (const [getter, resultType] of [["aggregator", "address"], ["getFeedId", "bytes32"], ["owner", "address"], ["decimals", "uint8"], ["description", "string"], ["typeAndVersion", "string"], ["latestTimestamp", "uint256"]])
    state.facade[getter] = await call(`facade-${getter.toLowerCase()}`, A.facade, `function ${getter}() view returns (${resultType})`);
  const round = await call("facade-latest-round-data", A.facade, "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)");
  state.facade.round = { roundId: round[0].toString(), answer: round[1].toString(), startedAt: round[2].toString(), updatedAt: round[3].toString(), answeredInRound: round[4].toString() };
  assert.equal(state.facade.getFeedId, feedId); assert.equal(state.facade.aggregator.toLowerCase(), A.cache.toLowerCase());
  for (const [getter, resultType] of [["owner", "address"], ["getForwarderAddress", "address"], ["getAllowedWorkflowOwner", "address"], ["typeAndVersion", "string"]])
    state.cache[getter] = await call(`cache-${getter.toLowerCase()}`, A.cache, `function ${getter}() view returns (${resultType})`);
  state.cache.answer = (await call("cache-answer", A.cache, "function latestAnswerForFeed(bytes32) view returns (uint256)", [feedId])).toString();
  state.cache.timestamp = (await call("cache-observation-time", A.cache, "function latestAnswerTimestampForFeed(bytes32) view returns (uint256)", [feedId])).toString();
  state.cache.knownWorkflow = { id: knownWorkflowId, allowedAtAuditBlock: await call("known-workflow-allowlist", A.cache, "function isAllowedWorkflowId(bytes32) view returns (bool)", [knownWorkflowId]),
    completeness: "One previously sampled workflow only; not complete enumeration or a newly matched report." };
  assert.equal(state.cache.getForwarderAddress.toLowerCase(), A.forwarder.toLowerCase());
  for (const [getter, resultType] of [["owner", "address"], ["typeAndVersion", "string"]])
    state.forwarder[getter] = await call(`forwarder-${getter.toLowerCase()}`, A.forwarder, `function ${getter}() view returns (${resultType})`);
  for (const label of ["collateral", "loan"]) {
    state.tokens[label] = { chainId: 1672, address: A[label], decimals: Number(await call(`${label}-decimals`, A[label], "function decimals() view returns (uint8)")),
      symbol: await call(`${label}-symbol`, A[label], "function symbol() view returns (string)"), name: await call(`${label}-name`, A[label], "function name() view returns (string)") };
  }
  assert.equal(state.tokens.collateral.decimals, 18); assert.equal(state.tokens.loan.decimals, 6); assert.equal(Number(state.facade.decimals), 18);
  for (const label of ["implementation", "admin", "beacon"]) {
    const slot = toHex(BigInt(keccak256(stringToHex(`eip1967.proxy.${label}`))) - 1n, { size: 32 });
    state.eip1967[label] = { slot, value: await storage(`facade-eip1967-${label}`, A.facade, slot) };
  }
  const configId = 4294967297n, base = BigInt(keccak256(encodeAbiParameters([{ type: "uint64" }, { type: "uint256" }], [configId, 2n])));
  const f = Number(BigInt(await storage("known-don-f", A.forwarder, base)) & 255n), count = BigInt(await storage("known-don-signer-count", A.forwarder, base + 1n));
  assert.ok(count <= BigInt(limits.signers), "Known signer configuration exceeds bound");
  const first = BigInt(keccak256(encodeAbiParameters([{ type: "uint256" }], [base + 1n]))), signers = [];
  for (let index = 0n; index < count; index++) signers.push(getAddress(`0x${(await storage(`known-don-signer-${index}`, A.forwarder, first + index)).slice(-40)}`));
  state.sampledKnownDonConfiguration = { configId: configId.toString(), f, signers, sourceLayoutRuntimeSha256: expectedSha256.forwarder,
    internallyValidStoredConfiguration: f > 0 && count > BigInt(3 * f) && new Set(signers).size === signers.length && signers.every(signer => BigInt(signer) !== 0n),
    completeness: "One known stored DON/version sampled; no claim that every active config or authorized route entry is enumerated." };
  assert.ok(state.sampledKnownDonConfiguration.internallyValidStoredConfiguration);
  const after = await readHeader("audit-block-after", BigInt(block.number));
  assert.deepEqual(after, block); assert.equal(BigInt(await request("chain-id-after", "eth_chainId", [])), 1672n);
  state.mechanicalChecks = { priceEqualsAnswerTimesScale: BigInt(state.composition.price) === BigInt(state.facade.round.answer) * BigInt(state.composition.SCALE_FACTOR),
    facadeCacheAnswerAgreement: state.facade.round.answer === state.cache.answer,
    timestampAgreement: state.facade.round.startedAt === state.facade.round.updatedAt && state.facade.round.updatedAt === state.cache.timestamp,
    observationAgeSeconds: (BigInt(block.timestamp) - BigInt(state.cache.timestamp)).toString(),
    economicQuoteVerified: false, heartbeatFromSamplingInferred: false, onchainFreshnessEnforcement: false };
  assert.ok(state.mechanicalChecks.priceEqualsAnswerTimesScale && state.mechanicalChecks.facadeCacheAnswerAgreement && state.mechanicalChecks.timestampAgreement);
  assert.ok(performance.now() - started <= limits.wallMs, "RPC audit total wall bound exceeded");
  state.status = "BOUNDED_ORACLE_CONFIGURATION_READ_COMPLETE";
} catch (error) { state.failure = { classification: "READ_OR_BINDING_FAILURE_NO_GATE_PROMOTION", errorName: error.name,
  assertionCode: error.code ?? null, message: String(error.message).slice(0, 2000), lastRequestId: trace.at(-1)?.id ?? null }; }
const stage2AssuranceBytes = readFileSync("[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/live-stage2-SGNCxp/live-monitor-assurance.json");
const previousAssurance = JSON.parse(stage2AssuranceBytes);
state.priorStage2 = { assuranceArtifactSha256: hash(stage2AssuranceBytes), configurationFingerprint: previousAssurance.configurationFingerprint,
  dimensions: previousAssurance.dimensions, overall: previousAssurance.overall, gate: previousAssurance.gate,
  meaning: "Historical evaluated result retained; this separate audit is not a new monitor cycle or production assurance promotion." };
state.completedAt = new Date().toISOString(); state.durationMs = performance.now() - started; state.endpoint = endpoint; state.bounds = limits; state.trace = trace;
state.toolUsedSha256 = hash(readFileSync(join(directory, "audit-tool-used.mjs")));
state.observedConfigurationSha256 = hash(json({ block: state.block, runtimeIdentities: state.runtimeIdentities, marketParameters: state.marketParameters,
  composition: state.composition, facade: state.facade, cache: state.cache, forwarder: state.forwarder, tokens: state.tokens,
  eip1967: state.eip1967, sampledKnownDonConfiguration: state.sampledKnownDonConfiguration }));
state.observedConfigurationDigestMeaning = "Hash of this bounded audit serialization only; not a complete qualified timing configuration or substitute for the production configuration fingerprint.";
state.limitations = ["The endpoint is not independent economic validation or independent chain consensus.", "Zero EIP-1967 slots are interpreted together with full runtime/source reproduction, never alone.",
  "Only current getters, runtimes and one known stored signer/workflow configuration were read. No complete configuration/event history or current workflow binary is established.",
  "Economic quote equivalence, workflow inputs, real-world source/signer/controller identities, verified configuration-bound heartbeat/upstream maximum age and eligible independent comparator remain unqualified."];
state.safety = { realMonitorStopped: true, applicationOrMonitoringCodeInvoked: false, borrowerPositionOrDebtReads: false,
  externalNotification: false, transactionOrWalletOperation: false, onlyExplicitReadOnlyRpcMethods: true, repositoryWrites: false };
save("summary.json", state); save("request-trace.json", trace);
console.log(json({ status: state.status, block: state.block, requests: trace.length, runtimeIdentities: state.runtimeIdentities,
  mechanicalChecks: state.mechanicalChecks, controllerAddresses: { facade: state.facade.owner, cache: state.cache.owner, forwarder: state.forwarder.owner },
  knownSignerConfiguration: state.sampledKnownDonConfiguration ? { configId: state.sampledKnownDonConfiguration.configId, f: state.sampledKnownDonConfiguration.f,
    count: state.sampledKnownDonConfiguration.signers.length, completeness: state.sampledKnownDonConfiguration.completeness } : null,
  failure: state.failure ?? null, safety: state.safety }));
if (state.status !== "BOUNDED_ORACLE_CONFIGURATION_READ_COMPLETE") process.exitCode = 1;
