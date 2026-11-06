// Strictly offline verification of captured bytes. No reader, service cycle, scheduler or delivery is invoked.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Socket } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = "C:/liquidation-watchdog", audit = dirname(fileURLToPath(import.meta.url));
const resultFile = process.argv[2] ?? "offline-verification-results.json";
assert.match(resultFile, /^offline-verification-results(?:-v[1-9][0-9]*)?\.json$/);
const originalFetch = globalThis.fetch, originalConnect = Socket.prototype.connect;
let fetchAttempts = 0, socketAttempts = 0;
globalThis.fetch = async () => { fetchAttempts += 1; throw new Error("OFFLINE_VERIFICATION_NETWORK_FORBIDDEN"); };
Socket.prototype.connect = function () { socketAttempts += 1; throw new Error("OFFLINE_VERIFICATION_SOCKET_FORBIDDEN"); } as any;
const load = async (file: string) => import(pathToFileURL(`${repo}/${file}`).href);
const viem = createRequire(pathToFileURL(`${repo}/package.json`))("viem");
const { stringify } = await load("src/domain/serialize.ts");
const { riskSnapshotSchema } = await load("src/risk/snapshot-schema.ts");
const { snapshotIdentifier } = await load("src/risk/provenance.ts");
const { validateRiskSnapshot } = await load("src/risk/validate.ts");
const { observe } = await load("src/monitoring/observation.ts");
const { transition } = await load("src/monitoring/transitions.ts");
const { initialState, monitoringScope, alertSchema } = await load("src/monitoring/model.ts");
const { renderAlert } = await load("src/notifications/format.ts");
const { loadRuntimeConfiguration } = await load("src/config/runtime.ts");
const { calculateAssuredRisk } = await load("src/risk/assured.ts");
const { supplementalResultSchema } = await load("src/oracle-assurance/supplemental.ts");
const { assuranceSchema } = await load("src/oracle-assurance/model.ts");
const { MonitorStore } = await load("src/storage/store.ts");
const { morphoAbi, irmAbi, tokenAbi } = await load("src/morpho/abi.ts");
const { oracleAbi, feedAbi } = await load("src/oracle/abi.ts");
const { NETWORK } = await load("src/config/deployment.ts");
const { RPC_READ_METHODS } = await load("src/chain/rpc.ts");
const { MCP_READ_TOOLS } = await load("src/mcp/client.ts");
const { AUDIT_READ_METHODS } = await load("src/oracle-assurance/audit-rpc.ts");

const sha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const bytes = (file: string) => readFileSync(join(audit, file));
const json = (file: string) => JSON.parse(bytes(file).toString("utf8"));
const checks: { name: string; status: string; detail: unknown }[] = [];
const pass = (name: string, detail: unknown) => checks.push({ name, status: "PASS", detail });
const jsonEqual = (actual: unknown, expected: unknown, message: string) => assert.deepEqual(JSON.parse(stringify(actual)), expected, message);
const startedAt = new Date().toISOString();
let result: any;
let store: any = null;
try {
  const live = json("live-stage2-evidence.json"), preflight = json("preflight.json"), restart = json("restart-verification.json");
  assert.equal(sha256(bytes("live-stage2-evidence.json")), "f94ec2761c77d2ddb219c8215dd3b6ac0ee9836ced59798c36740fe19f6b2124");
  assert.equal(live.status, "PASS_FINITE_LIVE_MONITOR_AND_CONSOLE_DELIVERY_ORACLE_UNVERIFIED");
  for (const artifact of live.artifacts) {
    const content = bytes(artifact.file);
    assert.equal(content.length, artifact.bytes, artifact.file);
    assert.equal(sha256(content), artifact.sha256, artifact.file);
  }
  assert.equal(live.artifacts.length, 12);
  pass("LIVE_ARTIFACT_BYTE_HASHES", { count: live.artifacts.length, mainEvidenceSha256: sha256(bytes("live-stage2-evidence.json")) });

  const configuration = await loadRuntimeConfiguration({ positionPath: join(audit, "position.json"), monitoringPath: join(audit, "monitoring.json") });
  const { position, thresholds, monitoring } = configuration;
  const scope = monitoringScope(thresholds, undefined, position);
  assert.deepEqual(position.identity, live.target);
  assert.equal(scope, live.scope); assert.equal(scope, preflight.scope); assert.equal(scope, restart.scope);
  assert.equal(configuration.configurationFingerprint, live.configurationFingerprint);
  assert.equal(monitoring.monitoring.enabled, false);
  assert.equal(monitoring.notifications.telegram, false); assert.equal(monitoring.notifications.discord, false);
  assert.equal(monitoring.monitoring.oracleLocalMaxAgeSeconds, undefined);
  assert.equal(preflight.fixturePermission, false);
  for (const [file, hash] of Object.entries(live.configurationHashes)) assert.equal(sha256(bytes(file)), hash);
  for (const source of preflight.sourceChecks) {
    const content = readFileSync(join(repo, source.source));
    assert.equal(content.length, source.bytes); assert.equal(sha256(content), source.sha256);
  }
  const previousBytes = readFileSync(join(preflight.historicalEvidence.directory, "live-candidate-evidence.json"));
  const borrowBytes = readFileSync(join(preflight.historicalEvidence.directory, "historical-borrow-discovery.json"));
  assert.equal(sha256(previousBytes), preflight.historicalEvidence.discoverySha256);
  assert.equal(sha256(borrowBytes), preflight.historicalEvidence.borrowProvenanceSha256);
  const historical = JSON.parse(previousBytes.toString("utf8")), borrow = JSON.parse(borrowBytes.toString("utf8"));
  assert.equal(historical.target.account, position.identity.account); assert.equal(borrow.selectedCandidate.account, position.identity.account);
  assert.equal(borrow.status, "BORROW_PROVENANCE_VERIFIED_READ_ONLY");
  assert.equal(borrow.borrowLogPathsAgree && borrow.borrowBlockPathsAgree && borrow.borrowReceiptPathsAgree, true);
  assert.ok(BigInt(live.block.number) > BigInt(historical.block.number));
  assert.ok(BigInt(live.block.timestamp) > BigInt(historical.block.timestamp)); assert.notEqual(live.block.hash, historical.block.hash);
  pass("IDENTITY_CONFIGURATION_AND_REVIEWED_SOURCE_HASHES", { sourceReferences: preflight.sourceChecks.length, scope,
    positionId: position.identity.positionId, historicalDataUsedAsCurrentInput: false,
    newBlockDelta: (BigInt(live.block.number) - BigInt(historical.block.number)).toString() });

  // Restore ONLY the documented bigint fields. Arbitrary JSON wire params/results remain byte-derived JSON;
  // numbers such as decimals, chain configuration and uint32 report fields are not globally coerced.
  const raw = json("live-monitor-snapshot.json");
  const integer = (value: any) => value === null ? null : BigInt(value);
  const fields = (object: any, names: string[]) => { if (object) for (const name of names) object[name] = integer(object[name]); };
  const header = (value: any) => fields(value, ["number", "timestamp"]);
  header(raw.block); fields(raw.heads, ["rpc", "mcp", "selectionLagBlocks"]); fields(raw.observedChainIds, ["rpc", "mcp"]);
  for (const contract of raw.contracts) fields(contract, ["blockNumber"]);
  fields(raw.params, ["lltv"]);
  fields(raw.market, ["totalSupplyAssets", "totalSupplyShares", "totalBorrowAssets", "totalBorrowShares", "lastUpdate", "fee"]);
  fields(raw.position, ["supplyShares", "borrowShares", "collateral"]);
  fields(raw.oracle, ["price", "latestTimestamp", "cacheAnswer", "cacheTimestamp", "ageSeconds"]);
  fields(raw.oracle.composition, ["baseVaultConversionSample", "quoteVaultConversionSample", "scaleFactor"]);
  fields(raw.oracle.round, ["roundId", "answer", "startedAt", "updatedAt", "answeredInRound"]);
  fields(raw.oracle.policy, ["heartbeatSeconds"]);
  raw.borrowRatePerSecondWad = integer(raw.borrowRatePerSecondWad);
  fields(raw.accounting, ["elapsedSeconds", "ratePerSecondWad", "firstTerm", "secondTerm", "thirdTerm", "interest", "accruedBorrowAssets",
    "accruedSupplyAssets", "accruedSupplyShares", "totalBorrowShares", "feeAmount", "feeShares", "debt"]);
  fields(raw.valuation, ["collateralValue", "maxBorrow", "ltvWad", "safetyRatioWad"]);
  for (const name of ["rpcBefore", "mcpBefore", "rpcAfter", "mcpAfter"]) header(raw.consistency[name]);
  for (const comparison of raw.consistency.comparisons) fields(comparison, ["blockNumber"]);
  for (const read of raw.reads) fields(read, ["blockNumber"]);
  const snapshot = riskSnapshotSchema.parse(raw);
  assert.equal(snapshotIdentifier(snapshot), live.snapshotIdentifier);
  const supplemental = supplementalResultSchema.parse(json("live-monitor-supplemental.json"));
  const assurance = assuranceSchema.parse(json("live-monitor-assurance.json"));
  assert.equal(assurance.snapshotIdentifier, live.snapshotIdentifier);
  const parsedSnapshotBytes = Buffer.from(stringify(snapshot) + "\n"), parsedSupplementalBytes = Buffer.from(stringify(supplemental) + "\n");
  const references: any[] = [];
  const collect = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.sourceKind === "string" && "artifactSha256" in value && "subjectAddress" in value) references.push(value);
    for (const child of Object.values(value)) collect(child);
  };
  collect(assurance);
  for (const ref of references) {
    if (ref.sourceKind === "SNAPSHOT") {
      assert.equal(ref.source, live.snapshotIdentifier); assert.equal(ref.artifactSha256, sha256(parsedSnapshotBytes));
      assert.equal(ref.block.hash, live.block.hash); assert.equal(ref.block.number, live.block.number);
    } else if (ref.sourceKind === "RPC") {
      assert.equal(ref.source, NETWORK.rpc); assert.equal(ref.artifactSha256, sha256(parsedSupplementalBytes));
    } else if (ref.source.startsWith("evidence/")) assert.equal(ref.artifactSha256, sha256(readFileSync(join(repo, ref.source))));
    else throw new Error(`Unexpected assurance reference kind: ${ref.sourceKind}`);
  }
  pass("CANONICAL_SNAPSHOT_AND_ASSURANCE_REFERENCE_BINDINGS", { canonicalSnapshotIdentifier: live.snapshotIdentifier,
    snapshotFileSha256: sha256(bytes("live-monitor-snapshot.json")), schemaParsedSnapshotSha256: sha256(parsedSnapshotBytes),
    assuranceReferencesChecked: references.length, supplementalSha256: sha256(parsedSupplementalBytes),
    explanation: "Canonical typed identity, captured-file bytes and schema-parsed serialization hashes are deliberately distinct." });

  const cycle = json("live-monitor-cycle-result.json"), persisted = json("persisted-before-restart.json");
  const observation = observe(snapshot, cycle.observation.cycleId, new Date(cycle.observation.observedAt), thresholds, { position, supplemental });
  assert.deepEqual(observation, cycle.observation);
  const next = transition(initialState(), observation, monitoring.monitoring, scope);
  assert.deepEqual(next.alerts, cycle.alerts); assert.deepEqual(next.state, persisted.state);
  const risk = calculateAssuredRisk(snapshot, assurance, thresholds,
    { calculatedAt: new Date(observation.observedAt), progression: { state: observation.progression.state }, position });
  jsonEqual(risk, json("live-monitor-risk.json"), "Entire captured assured-risk result");
  jsonEqual(validateRiskSnapshot(structuredClone(snapshot), new Date(observation.observedAt), position), json("live-monitor-validation.json"), "Input validation");
  assert.equal(observation.accepted, true); assert.equal(observation.progression.reason, "FIRST_OBSERVATION");
  assert.equal(observation.progression.baselineBlockNumber, null); assert.equal(observation.risk.actionable, false);
  assert.equal(observation.risk.repayment, null); assert.equal(observation.risk.additionalCollateral, null);
  pass("PURE_CAPTURED_PIPELINE_REPRODUCTION", { accepted: true, alertCodes: next.alerts.map((alert: any) => alert.code),
    newLiveReads: 0, monitoringServiceInvocations: 0, progression: "UNKNOWN/FIRST_OBSERVATION", financialOptionsGenerated: 0 });

  const direct = json("independent-pinned-verification.json");
  const specifications: any[] = [
    ["market identity", position.identity.protocolAddress, morphoAbi, "idToMarketParams", [position.identity.marketId], snapshot.params],
    ["market totals", position.identity.protocolAddress, morphoAbi, "market", [position.identity.marketId], snapshot.market],
    ["borrower position", position.identity.protocolAddress, morphoAbi, "position", [position.identity.marketId, position.identity.account], snapshot.position],
    ["loan decimals", snapshot.params.loanToken, tokenAbi, "decimals", [], snapshot.tokens.loan.decimals],
    ["collateral decimals", snapshot.params.collateralToken, tokenAbi, "decimals", [], snapshot.tokens.collateral.decimals],
    ["loan symbol", snapshot.params.loanToken, tokenAbi, "symbol", [], snapshot.tokens.loan.symbol],
    ["collateral symbol", snapshot.params.collateralToken, tokenAbi, "symbol", [], snapshot.tokens.collateral.symbol],
    ["pinned IRM view rate", snapshot.params.irm, irmAbi, "borrowRateView", [snapshot.params, snapshot.market], snapshot.borrowRatePerSecondWad],
    ["oracle price", snapshot.params.oracle, oracleAbi, "price", [], snapshot.oracle.price],
    ["feed answer and timestamp", snapshot.oracle.feed, feedAbi, "latestRoundData", [],
      [snapshot.oracle.round.roundId, snapshot.oracle.round.answer, snapshot.oracle.round.startedAt, snapshot.oracle.round.updatedAt, snapshot.oracle.round.answeredInRound]]
  ];
  assert.equal(direct.status, "PASS"); assert.equal(direct.calls.length, specifications.length);
  const decoded: Record<string, any> = {};
  for (const [label, to, abi, functionName, args, expected] of specifications) {
    const record = direct.calls.find((item: any) => item.label === label);
    assert.equal(record.to, to); assert.equal(record.blockNumber, live.block.number);
    assert.equal(record.data, viem.encodeFunctionData({ abi, functionName, args }));
    assert.equal(record.rpcBytes.toLowerCase(), record.mcpBytes.toLowerCase());
    decoded[label] = viem.decodeFunctionResult({ abi, functionName, data: record.rpcBytes });
    assert.deepEqual(decoded[label], expected, label);
    jsonEqual(decoded[label], record.decodedRpc, label); jsonEqual(decoded[label], record.decodedMcp, label);
  }
  for (const name of ["rpcBefore", "mcpBefore", "rpcAfter", "mcpAfter"]) {
    jsonEqual(snapshot.consistency[name], JSON.parse(stringify(snapshot.block)), `Production ${name}`);
    jsonEqual(snapshot.block, direct[name], `Direct ${name}`);
  }
  assert.equal(snapshot.consistency.batchSentinelsChecked, 6); assert.equal(snapshot.contracts.length, 10);
  assert.equal(snapshot.consistency.comparisons.length, 58);
  assert.ok(snapshot.consistency.comparisons.every((item: any) => item.matches && item.rpcDigest === item.mcpDigest && (item.blockNumber === null || item.blockNumber === snapshot.block.number)));
  assert.ok(snapshot.reads.every((read: any) => read.blockNumber === null || read.blockNumber === snapshot.block.number));
  assert.ok(snapshot.reads.every((read: any) => (read.source === "rpc" ? RPC_READ_METHODS : MCP_READ_TOOLS).includes(read.method)));
  pass("PINNED_GETTER_REDECODING_AND_PRODUCTION_CROSS_CHECKS", { directGetters: specifications.length, productionComparisons: 58,
    sentinels: 6, contracts: 10, mixedBlockProductionReads: 0, beforeAfterHeaderSets: 2,
    providerIndependence: "RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT" });

  const params = decoded["market identity"], market = decoded["market totals"], borrower = decoded["borrower position"];
  const derivedMarketId = viem.keccak256(viem.encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "uint256" }],
    [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv]));
  assert.equal(derivedMarketId, live.target.marketId); assert.equal(derivedMarketId, direct.derivedMarketId);
  const WAD = 10n ** 18n, price = decoded["oracle price"], rate = decoded["pinned IRM view rate"];
  const elapsed = snapshot.block.timestamp - market.lastUpdate, first = rate * elapsed;
  const second = first * first / (2n * WAD), third = second * first / (3n * WAD);
  const interest = market.totalBorrowAssets * (first + second + third) / WAD;
  const accruedBorrowAssets = market.totalBorrowAssets + interest, accruedSupplyAssets = market.totalSupplyAssets + interest;
  const feeAmount = interest * market.fee / WAD;
  const feeShares = feeAmount * (market.totalSupplyShares + 1_000_000n) / (accruedSupplyAssets - feeAmount + 1n);
  const shareDenominator = market.totalBorrowShares + 1_000_000n;
  const debt = (borrower.borrowShares * (accruedBorrowAssets + 1n) + shareDenominator - 1n) / shareDenominator;
  const collateralValue = borrower.collateral * price / (10n ** 36n), maxBorrow = collateralValue * params.lltv / WAD;
  const accounting: any = { elapsedSeconds: elapsed, ratePerSecondWad: rate, firstTerm: first, secondTerm: second, thirdTerm: third,
    interest, accruedBorrowAssets, accruedSupplyAssets, accruedSupplyShares: market.totalSupplyShares + feeShares,
    totalBorrowShares: market.totalBorrowShares, feeAmount, feeShares, debt };
  const valuation: any = { collateralValue, maxBorrow, safetyRatioWad: maxBorrow * WAD / debt, ltvWad: debt * WAD / collateralValue };
  for (const [field, value] of Object.entries(accounting)) assert.equal(value, snapshot.accounting[field]);
  for (const [field, value] of Object.entries(valuation)) assert.equal(value, snapshot.valuation[field]);
  const numerator = maxBorrow * WAD;
  for (const [name, value] of Object.entries(thresholds.wad) as [string, bigint][]) {
    const comparison = direct.thresholdResult.comparisons[name];
    assert.equal(comparison.thresholdWad, value.toString()); assert.equal(comparison.debtTimesThreshold, (debt * value).toString());
    assert.equal(comparison.atOrBelow, numerator <= debt * value);
  }
  assert.equal(numerator.toString(), live.thresholdResult.numerator); assert.equal(debt.toString(), live.thresholdResult.debt);
  assert.ok(numerator > debt * thresholds.wad.liquidationBoundary && numerator <= debt * thresholds.wad.criticalRatio);
  assert.equal(observation.risk.mathematicalRiskState, "CRITICAL"); assert.equal(observation.risk.effectiveRiskState, "DATA_UNVERIFIED");
  assert.equal(price, decoded["feed answer and timestamp"][1] * 1_000_000n);
  assert.equal(valuation.safetyRatioWad.toString(), observation.risk.safetyRatio);
  pass("SEPARATE_INTEGER_ACCOUNTING_AND_THRESHOLD_RECHECK", { fields: Object.keys(accounting).length + Object.keys(valuation).length,
    debt: debt.toString(), collateral: borrower.collateral.toString(), safetyRatioWad: valuation.safetyRatioWad.toString(),
    mathematical: "CRITICAL", effective: "DATA_UNVERIFIED", liquidationEligibilityProven: false });

  let rendered = "";
  for (const alert of cycle.alerts) {
    alertSchema.parse(alert);
    const summary = live.alerts.find((item: any) => item.id === alert.id), action = alert.suggestedAction;
    assert.equal(alert.createdAt, observation.observedAt); assert.equal(action.createdAt, alert.createdAt);
    assert.equal(action.type, "NON_FINANCIAL"); assert.equal(action.origin, "GENERATED"); assert.equal(action.actionable, false);
    assert.equal(action.financialOptions.length, 0); assert.equal(action.evidence.status, "NOT_QUALIFIED");
    assert.equal(action.evidence.account, live.target.account); assert.equal(action.evidence.chainId, live.target.chainId);
    assert.equal(action.evidence.marketId, live.target.marketId); assert.equal(action.evidence.snapshotIdentifier, live.snapshotIdentifier);
    assert.equal(action.evidence.blockNumber, live.block.number); assert.equal(action.evidence.blockHash, live.block.hash);
    assert.deepEqual(action, summary.suggestedAction);
    const text = renderAlert(alert);
    assert.equal(text.split("\n").filter((line: string) => line.startsWith("Action: ")).length, 1);
    assert.equal(sha256(text), summary.renderedSha256); rendered += text;
  }
  assert.equal(cycle.alerts.length, 3); assert.equal(rendered, bytes("console-alerts.txt").toString("utf8"));
  assert.equal(sha256(rendered), "1fa8721cd6de619e98f3ac46837627e02eb7f39bff042d6df0bd7168a938aaa8");
  const logs = json("cycle-logs.json");
  for (const event of ["cycle_started", "cycle_observed", "cycle_completed", "shutdown"]) assert.equal(logs.filter((record: any) => record.event === event).length, 1);
  assert.equal(logs.filter((record: any) => record.event === "alert_created").length, 3);
  assert.equal(logs.filter((record: any) => record.event === "notification_delivery" && record.channel === "console" && record.deliveryStatus === "DELIVERED").length, 3);
  pass("ACTUAL_CONSOLE_BYTES_TIMESTAMPS_AND_ONE_TYPED_ACTION", { alerts: 3, actionsPerAlert: 1, generatedNonFinancialActions: 3,
    financialOptions: 0, actualConsoleTranscriptBytes: Buffer.byteLength(rendered), actualConsoleTranscriptSha256: sha256(rendered) });

  // Re-decode captured signed report transactions and receipts; recover signatures locally, not by network replay.
  const forwarderAbi = viem.parseAbi(["function report(address receiver, bytes rawReport, bytes reportContext, bytes[] signatures)"]);
  const workflowAbi = viem.parseAbi(["function isAllowedWorkflowId(bytes32 workflowId) view returns (bool)"]);
  const reportsAbi = [{ type: "tuple[]", components: [{ name: "feedId", type: "bytes32" }, { name: "validFromTimestamp", type: "uint32" },
    { name: "observationsTimestamp", type: "uint32" }, { name: "answer", type: "uint256" }] }];
  const signedSamples: any[] = [];
  for (const sample of supplemental.samples) {
    const tx = supplemental.trace.find((record: any) => record.method === "eth_getTransactionByHash" && record.params[0] === sample.transactionHash).result;
    const receipt = supplemental.trace.find((record: any) => record.method === "eth_getTransactionReceipt" && record.params[0] === sample.transactionHash).result;
    assert.equal(tx.to, snapshot.oracle.forwarder); assert.equal(tx.hash, sample.transactionHash);
    assert.equal(tx.blockHash, sample.block.hash); assert.equal(BigInt(tx.blockNumber), BigInt(sample.block.number));
    assert.equal(BigInt(receipt.status), 1n); assert.equal(receipt.transactionHash, tx.hash); assert.equal(receipt.blockHash, tx.blockHash);
    const decodedReport = viem.decodeFunctionData({ abi: forwarderAbi, data: tx.input });
    assert.equal(decodedReport.functionName, "report");
    const [receiver, report, context, signatures] = decodedReport.args;
    assert.equal(receiver, snapshot.oracle.cache);
    const slice = (start: number, end: number) => `0x${report.slice(2 + start * 2, 2 + end * 2)}`;
    assert.equal(BigInt(slice(37, 45)).toString(), sample.configId); assert.equal(slice(45, 77), sample.workflowId);
    assert.equal(viem.getAddress(slice(87, 107)), sample.workflowOwner);
    const reportHash = viem.keccak256(`0x${viem.keccak256(report).slice(2)}${context.slice(2)}`);
    const recovered = await Promise.all(signatures.map((signature: string) => viem.recoverAddress({ hash: reportHash,
      signature: `${signature.slice(0, -2)}${(Number.parseInt(signature.slice(-2), 16) + 27).toString(16)}` })));
    assert.equal(new Set(recovered).size, 4); assert.deepEqual(recovered, sample.distinctRecoveredSigners);
    const reports = viem.decodeAbiParameters(reportsAbi, slice(109, (report.length - 2) / 2))[0];
    jsonEqual(reports, sample.reports, "Captured reports");
    const observationEvidence = supplemental.observations.find((item: any) => item.transactionHash === tx.hash);
    const selectedReport = reports.find((item: any) => item.feedId === snapshot.oracle.feedId);
    assert.equal(BigInt(selectedReport.observationsTimestamp).toString(), observationEvidence.timestamp);
    assert.equal(selectedReport.answer.toString(), observationEvidence.answer);
    assert.ok(receipt.logs.some((item: any) => !item.removed && item.address === receiver && item.transactionHash === tx.hash
      && item.blockHash === tx.blockHash && item.topics[1] === snapshot.oracle.feedId && BigInt(item.topics[2]).toString() === observationEvidence.timestamp
      && viem.decodeAbiParameters([{ type: "uint256" }], item.data)[0].toString() === observationEvidence.answer));
    const callData = viem.encodeFunctionData({ abi: workflowAbi, functionName: "isAllowedWorkflowId", args: [sample.workflowId] });
    const allowed = supplemental.trace.find((record: any) => record.method === "eth_call" && record.params[0].to === receiver
      && record.params[0].data === callData && BigInt(record.params[1]) === BigInt(tx.blockNumber));
    assert.equal(viem.decodeAbiParameters([{ type: "bool" }], allowed.result)[0], true);
    signedSamples.push({ transactionHash: tx.hash, recoveredSignatures: recovered.length, reportAndReceiptMatched: true,
      workflowAllowedAtTransactionBlock: true, historicalSignerOperatorIdentityProven: false });
  }
  const set = supplemental.signerSets[0];
  const configBase = BigInt(viem.keccak256(viem.encodeAbiParameters([{ type: "uint64" }, { type: "uint256" }], [BigInt(set.configId), 2n])));
  const stored = (slot: bigint) => supplemental.trace.find((record: any) => record.method === "eth_getStorageAt"
    && record.params[0] === snapshot.oracle.forwarder && BigInt(record.params[1]) === slot && BigInt(record.params[2]) === snapshot.block.number).result;
  const f = Number(BigInt(stored(configBase)) & 255n), signerCount = BigInt(stored(configBase + 1n));
  const firstSigner = BigInt(viem.keccak256(viem.encodeAbiParameters([{ type: "uint256" }], [configBase + 1n])));
  const currentSigners = Array.from({ length: Number(signerCount) }, (_, index) => viem.getAddress(`0x${stored(firstSigner + BigInt(index)).slice(-40)}`));
  assert.equal(f, set.f); assert.deepEqual(currentSigners, set.signers); assert.equal(signerCount, 10n);
  const configurationQueries = supplemental.trace.filter((record: any) => record.method === "eth_getLogs" && Array.isArray(record.params[0].address));
  const updateQueries = supplemental.trace.filter((record: any) => record.method === "eth_getLogs" && !Array.isArray(record.params[0].address));
  for (const queries of [configurationQueries, updateQueries]) {
    assert.equal(queries.length, 8);
    let expected = BigInt(supplemental.historyFrom);
    for (const query of queries) {
      assert.equal(BigInt(query.params[0].fromBlock), expected);
      assert.equal(BigInt(query.params[0].toBlock) - expected + 1n, 1_000n);
      expected = BigInt(query.params[0].toBlock) + 1n;
    }
    assert.equal(expected, BigInt(supplemental.historyTo) + 1n);
  }
  assert.equal(configurationQueries.reduce((count: number, record: any) => count + record.result.length, 0), 0);
  assert.equal(updateQueries.reduce((count: number, record: any) => count + record.result.length, 0), 2);
  assert.equal(supplemental.trace.length, 44); assert.ok(supplemental.trace.every((record: any) => AUDIT_READ_METHODS.includes(record.method)));
  assert.equal(assurance.freshness.observationAgeSeconds, (snapshot.block.timestamp - snapshot.oracle.round.updatedAt).toString());
  assert.equal(assurance.freshness.observationAgeSeconds, "1333"); assert.equal(assurance.freshness.state, "UNKNOWN");
  assert.equal(assurance.freshness.verifiedHeartbeatSeconds, null); assert.equal(assurance.freshness.upstreamFreshnessGuaranteeSeconds, null);
  assert.equal(assurance.freshness.timingConfigurationFingerprint, null); assert.equal(assurance.independent.eligible, false);
  assert.equal(assurance.independent.availability, "NOT_CONFIGURED"); assert.equal(assurance.overall, "UNVERIFIED");
  pass("BOUNDED_ORACLE_AUDIT_REDECODING_AND_GAP_CHECK", { requests: 44, configurationEvents: 0, updateSamples: 2,
    signedSamples, sampledCurrentSigners: 10, f: 3, currentAndHistoricalMembershipKeptDistinct: true,
    observedIntervalSeconds: (BigInt(supplemental.observations[1].timestamp) - BigInt(supplemental.observations[0].timestamp)).toString(),
    intervalIsHeartbeatGuarantee: false, freshness: "UNKNOWN", independentValidation: "NOT_CONFIGURED", financialRecoveryEligible: false });

  const network = json("network-read-only-guard.json");
  assert.equal(network.blockedNetworkAttempts, 0);
  for (const request of network.requests) {
    const endpoint = new URL(request.endpoint).href;
    if (endpoint === new URL(NETWORK.rpc).href) assert.ok([...RPC_READ_METHODS, ...AUDIT_READ_METHODS].includes(request.method));
    else {
      assert.equal(endpoint, new URL(NETWORK.mcp).href);
      assert.ok(["GET", "DELETE", "POST"].includes(request.httpMethod));
      if (request.httpMethod === "POST") assert.ok(["initialize", "notifications/initialized", "notifications/cancelled", "tools/list"].includes(request.method)
        || (request.method === "tools/call" && MCP_READ_TOOLS.includes(request.tool)));
    }
  }
  assert.equal(live.execution.runOnceCalls, 1); assert.equal(live.execution.liveReaderCalls, 1); assert.equal(live.execution.supplementalCalls, 1);
  assert.deepEqual(live.execution.notificationChannels, ["console"]);
  for (const output of restart.cli) {
    assert.equal(bytes(output.outputFile).length, output.bytes); assert.equal(sha256(bytes(output.outputFile)), output.sha256);
    assert.equal(output.exitCode, 0);
  }
  assert.equal(restart.status, "PASS"); assert.equal(restart.liveRunOnceCalls, 0); assert.equal(restart.fetchAttempts, 0);
  assert.equal(restart.newObservations, 0); assert.equal(restart.knownDeliveredResends, 0); assert.equal(bytes("restart-console.txt").length, 0);
  store = new MonitorStore(monitoring.storage.path, { readOnly: true });
  store.validateAll(); assert.deepEqual(store.state(scope), persisted.state); assert.deepEqual(store.alerts(100, scope), persisted.alerts);
  assert.deepEqual(store.contentHashes(), persisted.contentHashes); assert.deepEqual(store.deliveries(), persisted.deliveries);
  assert.equal(store.knownDeliveredHash(), persisted.knownDeliveredHash); assert.equal(store.pendingCount(), 0);
  assert.equal(store.statistics().counts.cycles, 1); assert.equal(store.statistics().counts.alerts, 3);
  assert.equal(store.statistics().counts.delivery_attempts, 3); assert.equal(store.runtime().status, "STOPPED");
  for (const delivery of store.deliveries()) {
    assert.equal(delivery.status, "DELIVERED"); assert.equal(delivery.attempts, 1); assert.equal(delivery.ambiguous, 0);
    // SQLite exposes null-prototype rows; the captured JSON intentionally retains values, not JS prototypes.
    jsonEqual(store.attempts(delivery.id), persisted.attempts[delivery.id], "Persisted attempt JSON values");
  }
  pass("READ_ONLY_SQLITE_PERSISTENCE_AND_RESTART_BINDING", { cycles: 1, alerts: 3, delivered: 3, attemptsEach: 1,
    pending: 0, runtime: "STOPPED", logicalTableHashesUnchanged: true, restartNewObservations: 0, restartResends: 0,
    liveReadOnlyNetworkRequests: network.requests.length, exactlyOneLiveRunOnce: true });
  assert.equal(fetchAttempts, 0); assert.equal(socketAttempts, 0);
  result = { schemaVersion: 1, status: "PASS", evidenceClass: "OFFLINE_VERIFICATION_OF_CAPTURED_LIVE_BYTES_NOT_A_NEW_LIVE_CYCLE",
    startedAt, completedAt: new Date().toISOString(), checks, checkGroupsPassed: checks.length, checkGroupsFailed: 0,
    network: { fetchAttempts, socketAttempts, remoteAccessPermitted: false },
    verifierNote: "The first offline verifier stopped on a JS-prototype-only comparison of SQLite attempt rows versus parsed JSON. Its diagnostic result is retained; this revision compares their complete serialized values, without changing evidence or production code.",
    retainedDiagnosticFile: "offline-verification-results.json",
    baselineStoreContentHashes: store.contentHashes(), statement: "No delivery adapter or MonitoringService was called; all re-rendering and recalculation are offline." };
} catch (error) {
  result = { schemaVersion: 1, status: "FAIL", startedAt, completedAt: new Date().toISOString(), checks,
    network: { fetchAttempts, socketAttempts }, error: error instanceof Error ? { name: error.name, message: error.message } : String(error) };
  process.exitCode = 1;
} finally {
  store?.close(); globalThis.fetch = originalFetch; Socket.prototype.connect = originalConnect;
  writeFileSync(join(audit, resultFile), stringify(result) + "\n", { flag: "wx" });
  console.log(stringify(result));
}
