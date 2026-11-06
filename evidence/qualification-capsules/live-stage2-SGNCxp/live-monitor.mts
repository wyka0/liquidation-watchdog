// Finite local qualification: exactly one real MonitoringService.runOnce(), no scheduler or fixtures.
// The reader and supplemental hooks only capture the existing production live paths and add strict
// direct getter/arithmetic cross-checks. They never replace oracle evidence or weaken a risk gate.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = "C:/liquidation-watchdog";
const audit = dirname(fileURLToPath(import.meta.url));
const discoveryDirectory = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/live-disc-ebf0249a";
const mode = process.argv[2];
assert.ok(["preflight", "run"].includes(mode), "Use preflight or run.");
const load = async (file: string) => import(pathToFileURL(`${repo}/${file}`).href);
const requireFromRepo = createRequire(pathToFileURL(`${repo}/package.json`));
const viem = requireFromRepo("viem");
const { stringify, utcFromSeconds } = await load("src/domain/serialize.ts");
const { loadRuntimeConfiguration } = await load("src/config/runtime.ts");
const { requireStartupConfiguration, validateStartupConfiguration } = await load("src/config/production.ts");
const { DEPLOYMENT, NETWORK } = await load("src/config/deployment.ts");
const { RpcClient, RPC_READ_METHODS } = await load("src/chain/rpc.ts");
const { PharosMcpClient, MCP_READ_TOOLS } = await load("src/mcp/client.ts");
const { RequestPacer } = await load("src/chain/transport.ts");
const { readMonitoredPosition } = await load("src/monitoring/reader.ts");
const { MonitoringService } = await load("src/monitoring/service.ts");
const { monitoringScope, alertSchema, riskView } = await load("src/monitoring/model.ts");
const { structuredLogger } = await load("src/monitoring/logs.ts");
const { notificationAdapters } = await load("src/notifications/adapters.ts");
const { renderAlert } = await load("src/notifications/format.ts");
const { MonitorStore } = await load("src/storage/store.ts");
const { AuditRpc, AUDIT_READ_METHODS, AUDIT_BOUNDS } = await load("src/oracle-assurance/audit-rpc.ts");
const { inspectSupplemental } = await load("src/oracle-assurance/supplemental.ts");
const { REVIEWED_SOURCES, REVIEWED_RECOMPILATION, ISSUER_IDENTITY_EVIDENCE } = await load("src/oracle-assurance/reviewed.ts");
const { morphoAbi, irmAbi, tokenAbi } = await load("src/morpho/abi.ts");
const { oracleAbi, feedAbi } = await load("src/oracle/abi.ts");
const { validateRiskSnapshot } = await load("src/risk/validate.ts");
const { calculateAssuredRisk } = await load("src/risk/assured.ts");
const { snapshotIdentifier } = await load("src/risk/provenance.ts");
const { formatAmount } = await load("src/validation/decimals.ts");

const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const save = (name: string, value: unknown) => {
  const bytes = Buffer.from(stringify(value) + "\n");
  writeFileSync(join(audit, name), bytes, { flag: "wx" });
  return { file: name, bytes: bytes.length, sha256: sha256(bytes) };
};
const configuration = await loadRuntimeConfiguration({ positionPath: join(audit, "position.json"), monitoringPath: join(audit, "monitoring.json") });
const { position, thresholds, monitoring } = configuration;
const account = "0x086eb9C2B14dD657ae77D07dF9115A2F946CE327";
assert.equal(position.identity.account, account);
assert.equal(position.identity.positionId, "2868fdc6591f5ec9674c9a33febfd27023f136783e11c24cb6dbd5f82994a06f");
assert.equal(position.identity.marketId, "0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73");
assert.equal(position.identity.chainId, 1672);
assert.equal(position.identity.protocolAddress, DEPLOYMENT.morpho);
assert.equal(position.mode, "CONFIGURED");
assert.equal(position.accountRole, "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET");
assert.deepEqual(thresholds.decimal, { warningRatio: "1.30", criticalRatio: "1.10", targetRatio: "1.25", liquidationBoundary: "1.00" });
assert.equal(monitoring.monitoring.enabled, false);
assert.equal(monitoring.notifications.telegram, false);
assert.equal(monitoring.notifications.discord, false);
assert.equal(monitoring.operations.profile, "local");
assert.equal(monitoring.monitoring.oracleLocalMaxAgeSeconds, undefined);
assert.equal(resolve(monitoring.storage.path), resolve(join(audit, "watchdog.sqlite")));
requireStartupConfiguration(monitoring, { thresholds, position });
const scope = monitoringScope(thresholds, undefined, position);

const oldBytes = readFileSync(join(discoveryDirectory, "live-candidate-evidence.json"));
assert.equal(sha256(oldBytes), "a54df5eb17ca03376b815ce99a5bf6a3c3100fb9676e9e1df81c70bcd54a5ded");
const old = JSON.parse(oldBytes.toString("utf8"));
assert.equal(old.target.account, account);
assert.equal(old.target.positionId, position.identity.positionId);
assert.equal(old.target.marketId, position.identity.marketId);
const borrowBytes = readFileSync(join(discoveryDirectory, "historical-borrow-discovery.json"));
assert.equal(sha256(borrowBytes), "c2e80b1c3dacceef625e77d8db003c982c87c8b7dd79cbb1830a812b3d6eda06");
const borrow = JSON.parse(borrowBytes.toString("utf8"));
assert.equal(borrow.status, "BORROW_PROVENANCE_VERIFIED_READ_ONLY");
assert.equal(borrow.selectedCandidate.account, account);
assert.equal(borrow.borrowLogPathsAgree && borrow.borrowBlockPathsAgree && borrow.borrowReceiptPathsAgree, true);
const referenceMap = new Map<string, any>();
for (const ref of [...REVIEWED_SOURCES, ...REVIEWED_RECOMPILATION, ISSUER_IDENTITY_EVIDENCE]) referenceMap.set(ref.source, ref);
const sourceChecks = [...referenceMap.values()].map(ref => {
  const bytes = readFileSync(join(repo, ref.source));
  const actualSha256 = sha256(bytes);
  assert.equal(actualSha256, ref.artifactSha256, `Reviewed local source hash: ${ref.source}`);
  return { source: ref.source, bytes: bytes.length, sha256: actualSha256, matches: true, evidenceClass: ref.sourceKind };
});
const configurationHashes = Object.fromEntries(["position.json", "monitoring.json"].map(name => [name, sha256(readFileSync(join(audit, name)))]));
const preflight = {
  schemaVersion: 1, status: "PASS", checkedAt: new Date().toISOString(), target: position.identity, accountRole: position.accountRole,
  thresholds: thresholds.decimal, scope, configurationFingerprint: configuration.configurationFingerprint, configurationHashes,
  startup: validateStartupConfiguration(monitoring, { thresholds, position }), sourceChecks,
  historicalEvidence: { directory: discoveryDirectory, discoverySha256: sha256(oldBytes), borrowProvenanceSha256: sha256(borrowBytes),
    previousBlock: old.block, use: "IDENTITY_AND_HISTORICAL_PROVENANCE_ONLY_NOT_CURRENT_INPUT" },
  monitoringEnabled: false, notifications: ["console"], fixturePermission: false,
  expectedLiveCalls: "Exactly one MonitoringService.runOnce(); existing live reader plus bounded supplemental audit and separate pinned direct getters."
};

if (mode === "preflight") {
  assert.equal(existsSync(monitoring.storage.path), false, "Qualification requires a new isolated store, never an existing operator database.");
  save("resolved-runtime-configuration.json", configuration);
  save("preflight.json", preflight);
  console.log(stringify(preflight));
} else {
  const priorPreflight = JSON.parse(readFileSync(join(audit, "preflight.json"), "utf8"));
  assert.deepEqual(priorPreflight.configurationHashes, configurationHashes);
  assert.equal(priorPreflight.scope, scope);
  assert.equal(existsSync(monitoring.storage.path), false, "Never repeat or overwrite this qualification's live store.");
  writeFileSync(join(audit, "one-live-cycle-authorized.json"), stringify({ startedAt: new Date().toISOString(), scope, account, maximumRunOnceCalls: 1 }) + "\n", { flag: "wx" });
  const originalFetch = globalThis.fetch;
  const network: any[] = [];
  let blockedNetworkAttempts = 0;
  globalThis.fetch = async (input: any, init?: any) => {
    const endpoint = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const httpMethod = (init?.method ?? (typeof input === "object" && input.method) ?? "GET").toUpperCase();
    let payload: any = null;
    if (typeof init?.body === "string") payload = JSON.parse(init.body);
    const entry: any = { startedAt: new Date().toISOString(), endpoint: endpoint.href, httpMethod,
      method: payload?.method ?? null, tool: payload?.method === "tools/call" ? payload.params?.name : null };
    network.push(entry);
    const rpcAllowed = endpoint.href === new URL(NETWORK.rpc).href && httpMethod === "POST"
      && [...RPC_READ_METHODS, ...AUDIT_READ_METHODS].includes(payload?.method);
    const mcpAllowed = endpoint.href === new URL(NETWORK.mcp).href && ["GET", "DELETE", "POST"].includes(httpMethod)
      && (httpMethod !== "POST" || ["initialize", "notifications/initialized", "notifications/cancelled", "tools/list"].includes(payload?.method)
        || (payload?.method === "tools/call" && MCP_READ_TOOLS.includes(payload.params?.name)));
    if ((!rpcAllowed && !mcpAllowed) || network.length > 300) {
      blockedNetworkAttempts += 1; entry.outcome = "BLOCKED";
      throw new Error("Qualification network guard rejected an endpoint, write method or request budget.");
    }
    try {
      const response = await originalFetch(input, init);
      entry.completedAt = new Date().toISOString(); entry.status = response.status; entry.outcome = "RESPONSE_RETURNED_UNMODIFIED";
      return response;
    } catch (error) { entry.completedAt = new Date().toISOString(); entry.outcome = "TRANSPORT_ERROR"; throw error; }
  };

  let rawSnapshot: any = null, supplemental: any = null, direct: any = null, cycle: any = null;
  let liveCycleSignal: AbortSignal | undefined;
  let readCalls = 0, supplementalCalls = 0, runOnceCalls = 0;
  const logs: any[] = [], messages: string[] = [], artifacts: any[] = [];
  const persist = (name: string, value: unknown) => { const ref = save(name, value); artifacts.push(ref); return ref; };
  writeFileSync(join(audit, "monitor-console.txt"), "", { flag: "wx" });
  writeFileSync(join(audit, "console-alerts.txt"), "", { flag: "wx" });
  const write = (text: string) => { appendFileSync(join(audit, "monitor-console.txt"), text); process.stdout.write(text); };
  const adapters = notificationAdapters(monitoring, (text: string) => {
    appendFileSync(join(audit, "console-alerts.txt"), text);
    write(text);
    messages.push(text);
  });
  assert.deepEqual(adapters.map((adapter: any) => adapter.channel), ["console"]);
  const logSink = structuredLogger(write);
  const log = (record: any) => { logs.push(record); logSink(record); };
  const summary: any = { schemaVersion: 1, evidenceKind: "LIVE_CHAIN_READ", purpose: "SINGLE_POSITION_FINITE_LIVE_MONITORING",
    startedAt: new Date().toISOString(), target: position.identity, accountRole: position.accountRole,
    thresholds: thresholds.decimal, scope, configurationFingerprint: configuration.configurationFingerprint,
    configurationHashes, endpoints: { rpc: NETWORK.rpc, mcp: NETWORK.mcp }, status: "IN_PROGRESS", artifacts };
  let service: any = null;

  const independentVerify = async (snapshot: any, signal: AbortSignal) => {
    const block = snapshot.block;
    assert.ok(block, "Live snapshot must have a pinned block.");
    assert.ok(block.number > BigInt(old.block.number), "A genuinely new block is required; discovery data cannot be current input.");
    assert.notEqual(block.hash, old.block.hash);
    assert.ok(block.timestamp > BigInt(old.block.timestamp));
    assert.equal(snapshot.evidenceKind, "LIVE_CHAIN_READ");
    assert.equal(snapshot.account, account);
    assert.equal(snapshot.marketId, position.identity.marketId);
    assert.equal(snapshot.observedChainIds.rpc, 1672n);
    assert.equal(snapshot.observedChainIds.mcp, 1672n);
    assert.equal(snapshot.heads.selectionLagBlocks, 5n);
    assert.equal(block.number, (snapshot.heads.rpc < snapshot.heads.mcp ? snapshot.heads.rpc : snapshot.heads.mcp) - 5n);
    assert.equal(snapshot.accepted, true, "Production snapshot failed; no replacement snapshot will be supplied.");
    assert.equal(snapshot.consistency.blockHashesStable, true);
    assert.equal(snapshot.consistency.batchSentinelsChecked, 6);
    assert.equal(snapshot.contracts.length, 10);
    assert.ok(snapshot.consistency.comparisons.every((comparison: any) => comparison.matches && comparison.rpcDigest === comparison.mcpDigest));
    assert.ok(snapshot.reads.every((record: any) => record.blockNumber === null || record.blockNumber === block.number));
    const pacer = new RequestPacer(), rpc = new RpcClient(pacer, undefined, undefined, signal), mcp = new PharosMcpClient(pacer, undefined, undefined, signal);
    const result: any = { schemaVersion: 1, status: "IN_PROGRESS", evidenceKind: "LIVE_CHAIN_READ", startedAt: new Date().toISOString(),
      block, calls: [], arithmetic: [], providerIndependence: "RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT",
      arithmeticMethod: "Separately written BigInt arithmetic using direct getter inputs, without importing production accounting/math/risk functions." };
    try {
      assert.equal(await rpc.chainId(), 1672n); assert.equal(await mcp.chainId(), 1672n);
      const headerMatches = (header: any) => assert.deepEqual(header, block);
      result.rpcBefore = await rpc.block(block.number); headerMatches(result.rpcBefore);
      result.mcpBefore = await mcp.block(block.number); headerMatches(result.mcpBefore);
      const call = async (label: string, to: string, abi: any, functionName: string, args: any[], expected: unknown, wordCount?: number) => {
        const data = viem.encodeFunctionData({ abi, functionName, args });
        const rpcBytes = await rpc.call(to, data, block.number), mcpBytes = await mcp.call(to, data, block.number);
        assert.equal(rpcBytes.toLowerCase(), mcpBytes.toLowerCase(), `Direct getter byte match: ${label}`);
        if (wordCount !== undefined) assert.equal((rpcBytes.length - 2) / 64, wordCount, `Exact return word count: ${label}`);
        const decodedRpc = viem.decodeFunctionResult({ abi, functionName, data: rpcBytes });
        const decodedMcp = viem.decodeFunctionResult({ abi, functionName, data: mcpBytes });
        assert.deepEqual(decodedRpc, decodedMcp, `Direct getter decoding: ${label}`);
        assert.deepEqual(decodedRpc, expected, `Direct getter matches cycle snapshot: ${label}`);
        result.calls.push({ label, to, data, blockNumber: block.number, rpcBytes, mcpBytes, decodedRpc, decodedMcp, matches: true });
        return decodedRpc;
      };
      const params = await call("market identity", position.identity.protocolAddress, morphoAbi, "idToMarketParams", [position.identity.marketId], snapshot.params, 5);
      const market = await call("market totals", position.identity.protocolAddress, morphoAbi, "market", [position.identity.marketId], snapshot.market, 6);
      const p = await call("borrower position", position.identity.protocolAddress, morphoAbi, "position", [position.identity.marketId, account], snapshot.position, 3);
      const loanDecimals = await call("loan decimals", params.loanToken, tokenAbi, "decimals", [], snapshot.tokens.loan.decimals, 1);
      const collateralDecimals = await call("collateral decimals", params.collateralToken, tokenAbi, "decimals", [], snapshot.tokens.collateral.decimals, 1);
      await call("loan symbol", params.loanToken, tokenAbi, "symbol", [], snapshot.tokens.loan.symbol);
      await call("collateral symbol", params.collateralToken, tokenAbi, "symbol", [], snapshot.tokens.collateral.symbol);
      const rate = await call("pinned IRM view rate", params.irm, irmAbi, "borrowRateView", [params, market], snapshot.borrowRatePerSecondWad, 1);
      const price = await call("oracle price", params.oracle, oracleAbi, "price", [], snapshot.oracle.price, 1);
      const round = await call("feed answer and timestamp", snapshot.oracle.feed, feedAbi, "latestRoundData", [],
        [snapshot.oracle.round.roundId, snapshot.oracle.round.answer, snapshot.oracle.round.startedAt, snapshot.oracle.round.updatedAt, snapshot.oracle.round.answeredInRound], 5);
      assert.equal(loanDecimals, 6); assert.equal(collateralDecimals, 18);
      assert.equal(params.loanToken, position.identity.loanToken); assert.equal(params.collateralToken, position.identity.collateralToken);
      assert.equal(params.oracle, position.identity.oracleAddress); assert.equal(params.irm, position.identity.irmAddress);
      assert.equal(params.lltv, DEPLOYMENT.lltv);
      const derivedMarketId = viem.keccak256(viem.encodeAbiParameters(
        [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "uint256" }],
        [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv]));
      assert.equal(derivedMarketId, position.identity.marketId); assert.equal(derivedMarketId, snapshot.derivedMarketId);
      assert.equal(price, round[1] * 1_000_000n);
      const WAD = 10n ** 18n, ORACLE_SCALE = 10n ** 36n;
      const elapsed = block.timestamp - market.lastUpdate;
      assert.ok(elapsed >= 0n);
      const accrue = elapsed !== 0n && market.totalBorrowAssets !== 0n && BigInt(params.irm) !== 0n;
      const first = accrue ? rate * elapsed : 0n;
      const second = first * first / (2n * WAD), third = second * first / (3n * WAD);
      const interest = accrue ? market.totalBorrowAssets * (first + second + third) / WAD : 0n;
      const accruedBorrowAssets = market.totalBorrowAssets + interest, accruedSupplyAssets = market.totalSupplyAssets + interest;
      const feeAmount = accrue ? interest * market.fee / WAD : 0n;
      const feeShares = feeAmount * (market.totalSupplyShares + 1_000_000n) / (accruedSupplyAssets - feeAmount + 1n);
      const denominator = market.totalBorrowShares + 1_000_000n;
      const debt = (p.borrowShares * (accruedBorrowAssets + 1n) + denominator - 1n) / denominator;
      const collateralValue = p.collateral * price / ORACLE_SCALE, capacity = collateralValue * params.lltv / WAD;
      const ratio = debt === 0n ? null : capacity * WAD / debt;
      const ltv = collateralValue === 0n ? null : debt * WAD / collateralValue;
      const arithmetic: any = { elapsedSeconds: elapsed, ratePerSecondWad: rate, firstTerm: first, secondTerm: second, thirdTerm: third,
        interest, accruedBorrowAssets, accruedSupplyAssets, accruedSupplyShares: market.totalSupplyShares + feeShares,
        totalBorrowShares: market.totalBorrowShares, feeAmount, feeShares, debt };
      for (const [field, value] of Object.entries(arithmetic)) {
        assert.equal(value, snapshot.accounting[field], `Independent accounting: ${field}`);
        result.arithmetic.push({ field, independent: value, production: snapshot.accounting[field], matches: true });
      }
      const valuation: any = { collateralValue, maxBorrow: capacity, safetyRatioWad: ratio, ltvWad: ltv };
      for (const [field, value] of Object.entries(valuation)) {
        assert.equal(value, snapshot.valuation[field], `Independent valuation: ${field}`);
        result.arithmetic.push({ field, independent: value, production: snapshot.valuation[field], matches: true });
      }
      const numerator = capacity * WAD;
      const mathState = debt === 0n ? "NO_DEBT" : numerator <= debt * thresholds.wad.liquidationBoundary ? "LIQUIDATION_BOUNDARY"
        : numerator <= debt * thresholds.wad.criticalRatio ? "CRITICAL" : numerator <= debt * thresholds.wad.warningRatio ? "WARNING" : "ABOVE_WARNING";
      result.derivedMarketId = derivedMarketId;
      result.thresholdResult = { mathematicalRiskState: mathState, numerator, debt,
        comparisons: Object.fromEntries(Object.entries(thresholds.wad).map(([name, value]: [string, any]) => [name,
          { thresholdWad: value, debtTimesThreshold: debt * value, atOrBelow: numerator <= debt * value }])) };
      result.decoded = { collateral: formatAmount(p.collateral, collateralDecimals), debt: formatAmount(debt, loanDecimals),
        safetyRatio: ratio === null ? null : formatAmount(ratio, 18), loanDecimals, collateralDecimals };
      result.rpcAfter = await rpc.block(block.number); headerMatches(result.rpcAfter);
      result.mcpAfter = await mcp.block(block.number); headerMatches(result.mcpAfter);
      assert.equal(await rpc.chainId(), 1672n); assert.equal(await mcp.chainId(), 1672n);
      assert.ok(rpc.records.every((record: any) => RPC_READ_METHODS.includes(record.method)));
      assert.ok(mcp.records.every((record: any) => MCP_READ_TOOLS.includes(record.method)));
      result.status = "PASS";
      return result;
    } finally {
      result.completedAt = new Date().toISOString(); result.readTrace = { rpc: rpc.records, mcp: mcp.records };
      persist("independent-pinned-verification.json", result);
      await Promise.allSettled([rpc.close(), mcp.close()]);
    }
  };

  try {
    const store = new MonitorStore(monitoring.storage.path, { limits: monitoring.resources });
    service = new MonitoringService({ configuration: monitoring, thresholds, position, store, adapters, log,
      read: async (requestedBlock: bigint | undefined, signal: AbortSignal) => {
        readCalls += 1; assert.equal(readCalls, 1); assert.equal(requestedBlock, undefined);
        liveCycleSignal = signal;
        const pacer = new RequestPacer();
        rawSnapshot = await readMonitoredPosition({ position, rpc: new RpcClient(pacer, undefined, undefined, signal),
          mcp: new PharosMcpClient(pacer, undefined, undefined, signal) });
        persist("live-monitor-snapshot.json", rawSnapshot);
        direct = await independentVerify(rawSnapshot, signal);
        return rawSnapshot;
      },
      supplemental: async (snapshot: any) => {
        supplementalCalls += 1; assert.equal(supplementalCalls, 1); assert.equal(snapshot, rawSnapshot);
        supplemental = await inspectSupplemental(snapshot, new AuditRpc(globalThis.fetch, new RequestPacer(), liveCycleSignal));
        persist("live-monitor-supplemental.json", supplemental);
        return supplemental;
      }
    });
    assert.equal(service.scope, scope);
    runOnceCalls += 1; assert.equal(runOnceCalls, 1);
    cycle = await service.runOnce();
    persist("live-monitor-cycle-result.json", cycle);
    await service.shutdown();
    assert.ok("observation" in cycle, "The only authorized cycle was skipped.");
    assert.equal(cycle.observation.accepted, true, "The live cycle was not accepted; it will not be repeated.");
    assert.equal(direct?.status, "PASS");
    assert.equal(cycle.observation.risk.mathematicalRiskState, direct.thresholdResult.mathematicalRiskState);
    assert.equal(cycle.observation.risk.snapshotIdentifier, snapshotIdentifier(rawSnapshot));
    assert.equal(cycle.observation.risk.account, account);
    assert.equal(cycle.observation.risk.marketId, position.identity.marketId);
    assert.equal(cycle.observation.risk.temporalContext, "LIVE_AS_OF_BLOCK");
    assert.equal(cycle.observation.risk.actionable, false);
    assert.equal(cycle.observation.risk.repayment, null);
    assert.equal(cycle.observation.risk.additionalCollateral, null);
    assert.equal(cycle.observation.risk.recoveryEligibility.eligible, false);
    assert.equal(cycle.observation.progression.state, "UNKNOWN");
    assert.equal(cycle.observation.progression.reason, "FIRST_OBSERVATION");
    assert.ok(cycle.alerts.length > 0);
    for (const alert of cycle.alerts) {
      alertSchema.parse(alert);
      assert.equal(alert.current.cycleId, cycle.observation.cycleId);
      assert.equal(alert.createdAt, cycle.observation.observedAt);
      assert.equal(alert.suggestedAction.createdAt, alert.createdAt);
      assert.equal(Array.isArray(alert.suggestedAction), false);
      assert.equal(alert.suggestedAction.type, "NON_FINANCIAL");
      assert.equal(alert.suggestedAction.actionable, false);
      assert.equal(alert.suggestedAction.financialOptions.length, 0);
      assert.equal(alert.suggestedAction.evidence.snapshotIdentifier, cycle.observation.risk.snapshotIdentifier);
      assert.equal(alert.suggestedAction.evidence.account, account);
      assert.equal(alert.suggestedAction.evidence.marketId, position.identity.marketId);
      assert.equal(messages.filter(text => text === renderAlert(alert)).length, 1, "One actual console delivery per generated alert.");
    }
    assert.equal(messages.length, cycle.alerts.length);
    assert.equal(blockedNetworkAttempts, 0);
    assert.equal(logs.filter(record => record.event === "cycle_started").length, 1);
    assert.equal(logs.filter(record => record.event === "cycle_completed").length, 1);
    assert.equal(logs.filter(record => record.event === "shutdown").length, 1);
    assert.ok(logs.filter(record => record.event === "notification_delivery").every(record => record.channel === "console" && record.deliveryStatus === "DELIVERED"));

    const observedAt = new Date(cycle.observation.observedAt);
    const validation = validateRiskSnapshot(structuredClone(rawSnapshot), observedAt, position);
    const risk = calculateAssuredRisk(rawSnapshot, cycle.observation.assurance, thresholds,
      { calculatedAt: observedAt, progression: { state: cycle.observation.progression.state }, position });
    const recomputedView = riskView(risk);
    recomputedView.phase2DataQuality = risk.phase2DataQuality.overall; recomputedView.phase2OracleQuality = risk.phase2DataQuality.oracle;
    assert.deepEqual(recomputedView, cycle.observation.risk, "Pure recomputation matches the actual persisted cycle risk, not a new snapshot.");
    persist("live-monitor-validation.json", validation);
    persist("live-monitor-risk.json", risk);
    persist("live-monitor-assurance.json", cycle.observation.assurance);
    const reader = new MonitorStore(monitoring.storage.path, { readOnly: true });
    try {
      reader.validateAll();
      const state = reader.state(scope), storedAlerts = reader.alerts(100, scope), deliveries = reader.deliveries();
      const statistics = reader.statistics();
      assert.deepEqual(state.latest, cycle.observation); assert.deepEqual(state.lastAccepted, cycle.observation);
      assert.equal(state.revision, 1); assert.equal(statistics.counts.cycles, 1); assert.equal(statistics.counts.alerts, cycle.alerts.length);
      assert.equal(statistics.counts.oracle_assurance, 1); assert.equal(statistics.counts.streams, 1);
      assert.equal(storedAlerts.length, cycle.alerts.length); assert.equal(deliveries.length, cycle.alerts.length);
      assert.ok(deliveries.every((delivery: any) => delivery.channel === "console" && delivery.status === "DELIVERED" && delivery.attempts === 1 && delivery.ambiguous === 0));
      assert.equal(reader.runtime().status, "STOPPED"); assert.equal(reader.pendingCount(), 0);
      const persistence = { status: "PASS", summary: reader.summary(scope), state, alerts: storedAlerts, deliveries, statistics,
        runtime: reader.runtime(), attempts: Object.fromEntries(deliveries.map((delivery: any) => [delivery.id, reader.attempts(delivery.id)])),
        knownDeliveredHash: reader.knownDeliveredHash(), contentHashes: reader.contentHashes() };
      persist("persisted-before-restart.json", persistence);
      summary.persistence = { status: "PASS", schemaVersion: reader.schemaVersion, cycles: statistics.counts.cycles,
        alerts: storedAlerts.length, consoleDelivered: deliveries.length, attemptsEach: 1, pending: 0, runtimeStatus: "STOPPED" };
    } finally { reader.close(); }
    const block = rawSnapshot.block;
    summary.block = { ...block, timestampUtc: utcFromSeconds(block.timestamp) };
    summary.heads = rawSnapshot.heads; summary.observedChainIds = rawSnapshot.observedChainIds;
    summary.snapshotIdentifier = cycle.observation.risk.snapshotIdentifier;
    summary.observedAt = cycle.observation.observedAt;
    summary.position = rawSnapshot.position; summary.market = rawSnapshot.market; summary.accounting = rawSnapshot.accounting;
    summary.tokens = rawSnapshot.tokens; summary.decoded = direct.decoded;
    summary.healthFactorWad = cycle.observation.risk.safetyRatio;
    summary.risk = { mathematical: cycle.observation.risk.mathematicalRiskState, effective: cycle.observation.risk.effectiveRiskState,
      actionability: cycle.observation.risk.actionability, actionable: false, recoveryEligibility: cycle.observation.risk.recoveryEligibility,
      repayment: null, additionalCollateral: null, diagnostics: cycle.observation.diagnostics, progression: cycle.observation.progression };
    summary.thresholdResult = direct.thresholdResult;
    summary.crossChecks = { productionComparisons: rawSnapshot.consistency.comparisons.length,
      productionMismatches: rawSnapshot.consistency.comparisons.filter((item: any) => !item.matches).length,
      sentinels: rawSnapshot.consistency.batchSentinelsChecked, contracts: rawSnapshot.contracts.length,
      blockHashesStable: true, singlePinnedBlockInProductionTrace: true, directGetterComparisons: direct.calls.length,
      separateArithmeticMatches: direct.arithmetic.length, directStableBeforeAfterHeaders: true };
    summary.alerts = cycle.alerts.map((alert: any) => ({ id: alert.id, code: alert.code, severity: alert.severity,
      timestamp: alert.createdAt, suggestedAction: alert.suggestedAction, renderedSha256: sha256(renderAlert(alert)) }));
    const assurance = cycle.observation.assurance;
    summary.oracle = { overall: assurance.overall, gate: assurance.gate, freshness: assurance.freshness, independent: assurance.independent,
      dimensions: assurance.dimensions, configuration: assurance.configuration, evidenceInvalidated: assurance.evidenceInvalidated,
      price: rawSnapshot.oracle.price, round: rawSnapshot.oracle.round, observationTimestampUtc: utcFromSeconds(rawSnapshot.oracle.round.updatedAt),
      providerIndependence: assurance.providerIndependence, supplementalStatus: supplemental.status, supplementalRequests: supplemental.trace.length,
      supplementalBounds: AUDIT_BOUNDS, findings: assurance.findings };
    summary.status = "PASS_FINITE_LIVE_MONITOR_AND_CONSOLE_DELIVERY_ORACLE_UNVERIFIED";
  } catch (error) {
    summary.status = "FAIL_CLOSED_NO_SECOND_LIVE_CYCLE";
    summary.error = { name: error instanceof Error ? error.name : "Unknown", code: (error as any)?.code ?? null,
      message: error instanceof Error ? error.message : String(error) };
    process.exitCode = 1;
    console.error(`LIVE_STAGE2_STOPPED ${JSON.stringify(summary.error)}`);
  } finally {
    try { if (service) await service.shutdown(); } catch (error) { summary.shutdownError = error instanceof Error ? error.message : "SHUTDOWN_FAILED"; process.exitCode = 1; }
    globalThis.fetch = originalFetch;
    summary.completedAt = new Date().toISOString();
    summary.execution = { runOnceCalls, liveReaderCalls: readCalls, supplementalCalls, blockedNetworkAttempts, networkRequests: network.length,
      notificationChannels: adapters.map((adapter: any) => adapter.channel), actualConsoleMessages: messages.length,
      noContinuousMonitoring: true, noSchedulerActivated: true, noFixturePermission: true, noProductionConfigurationChange: true,
      noRemoteDatabase: true, noSigningBroadcastOrLendingOperation: true };
    persist("network-read-only-guard.json", { allowedEndpoints: [NETWORK.rpc, NETWORK.mcp], blockedNetworkAttempts, requests: network });
    persist("cycle-logs.json", logs);
    for (const file of ["console-alerts.txt", "monitor-console.txt"]) {
      const bytes = readFileSync(join(audit, file)); artifacts.push({ file, bytes: bytes.length, sha256: sha256(bytes) });
    }
    const evidenceRef = save("live-stage2-evidence.json", summary);
    console.log(`LIVE_STAGE2_EVIDENCE ${join(audit, evidenceRef.file)} sha256=${evidenceRef.sha256}`);
  }
}
