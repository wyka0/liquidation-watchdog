// Final documentary validation only. No production imports, database opens, subprocesses or network calls.
// The original failed test/verifier records are retained; this does not run a test suite or monitoring cycle.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { Socket } from "node:net";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const audit = dirname(fileURLToPath(import.meta.url)), repo = "C:/liquidation-watchdog";
const reportFile = "LIVE-STAGE-2-MONITORING-REPORT.md";
const outputs = ["report-validation-results.json", "artifact-manifest.json", "artifact-manifest.sha256", "report-completion.json", "report-completion.sha256"];
for (const output of outputs) assert.equal(existsSync(join(audit, output)), false, `Refuse to overwrite ${output}`);
const originalFetch = globalThis.fetch, originalConnect = Socket.prototype.connect;
let fetchAttempts = 0, socketAttempts = 0;
globalThis.fetch = async () => { fetchAttempts += 1; throw new Error("FINAL_DOCUMENTARY_VERIFICATION_FETCH_FORBIDDEN"); };
Socket.prototype.connect = function () { socketAttempts += 1; throw new Error("FINAL_DOCUMENTARY_VERIFICATION_SOCKET_FORBIDDEN"); };
const sha256 = content => createHash("sha256").update(content).digest("hex");
const bytes = file => readFileSync(join(audit, file));
const json = file => JSON.parse(bytes(file).toString("utf8"));
const save = (file, value) => writeFileSync(join(audit, file), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const anchor = file => ({ file, bytes: bytes(file).length, sha256: sha256(bytes(file)) });
const checks = [];
const pass = (name, detail) => checks.push({ name, status: "PASS", detail });
const startedAt = new Date().toISOString();

try {
  const reportBytes = bytes(reportFile), report = reportBytes.toString("utf8");
  const live = json("live-stage2-evidence.json"), snapshot = json("live-monitor-snapshot.json"), cycle = json("live-monitor-cycle-result.json");
  const assurance = json("live-monitor-assurance.json"), supplemental = json("live-monitor-supplemental.json"), logs = json("cycle-logs.json");
  const preflight = json("preflight.json"), restart = json("restart-verification.json"), persisted = json("persisted-before-restart.json");
  const offline = json("offline-verification-results-v2.json"), initialVerifier = json("offline-verification-results.json");
  const accounting = json("test-accounting.json"), fullTests = json("offline-test-results.json"), unit = json("unit-tests.json");
  const focused = json("targeted-runtime-test-results.json"), focusedUnit = json("runtime-rerun-tests.json");
  const preservation = json("preservation-report.json"), baseline = json("baseline.json");
  const has = text => assert.ok(report.includes(String(text)), `Report must contain: ${text}`);

  assert.equal(sha256(reportBytes), "acdfe3b107fa723c5d87ff990de66aaa7a2e3246e38b0f01b43b299efd66c60e");
  assert.equal(Buffer.byteLength(report), reportBytes.length);
  assert.equal(/\bundefined\b|\bNaN\b|\[object Object\]|\$\{/.test(report), false, "No unresolved renderer placeholders");
  assert.equal(live.status, "PASS_FINITE_LIVE_MONITOR_AND_CONSOLE_DELIVERY_ORACLE_UNVERIFIED");
  assert.equal(sha256(bytes("live-stage2-evidence.json")), "f94ec2761c77d2ddb219c8215dd3b6ac0ee9836ced59798c36740fe19f6b2124");
  for (const artifact of live.artifacts) assert.deepEqual(anchor(artifact.file), artifact);
  assert.equal(live.artifacts.length, 12);
  for (const source of preflight.sourceChecks) {
    const content = readFileSync(join(repo, source.source));
    assert.equal(content.length, source.bytes); assert.equal(sha256(content), source.sha256); assert.equal(source.matches, true);
  }
  assert.equal(offline.status, "PASS"); assert.equal(offline.checkGroupsPassed, 9); assert.equal(offline.checkGroupsFailed, 0);
  assert.ok(offline.checks.every(check => check.status === "PASS"));
  assert.equal(offline.network.fetchAttempts, 0); assert.equal(offline.network.socketAttempts, 0);
  const binding = offline.checks.find(check => check.name === "CANONICAL_SNAPSHOT_AND_ASSURANCE_REFERENCE_BINDINGS").detail;
  assert.equal(binding.assuranceReferencesChecked, 33); assert.equal(binding.snapshotFileSha256, sha256(bytes("live-monitor-snapshot.json")));
  assert.equal(binding.canonicalSnapshotIdentifier, live.snapshotIdentifier);
  has(binding.schemaParsedSnapshotSha256); has(live.snapshotIdentifier); has("different defined representations, not a hash mismatch");
  pass("REPORT_BYTES_AND_CAPTURED_EVIDENCE_ANCHORS", { report: anchor(reportFile), liveArtifacts: 12, reviewedSourceReferences: preflight.sourceChecks.length,
    authoritativeOfflineAudit: "9/9 check groups, 33 assurance references", noNewPipelineOrLiveExecution: true });

  const position = json("position.json"), monitoring = json("monitoring.json");
  assert.equal(position.positions.length, 1); assert.equal(position.positions[0].enabled, true); assert.equal(position.positions[0].mode, "CONFIGURED");
  for (const [field, value] of Object.entries(position.positions[0].identity)) assert.equal(live.target[field], value);
  assert.equal(live.target.account, "0x086eb9C2B14dD657ae77D07dF9115A2F946CE327"); assert.equal(live.target.chainId, 1672);
  assert.equal(live.target.marketId, "0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73");
  assert.deepEqual(position.positions[0].thresholds, live.thresholds);
  assert.equal(monitoring.monitoring.enabled, false); assert.equal(monitoring.notifications.telegram, false); assert.equal(monitoring.notifications.discord, false);
  assert.equal(monitoring.operations.profile, "local"); assert.equal(resolve(monitoring.storage.path), resolve(join(audit, "watchdog.sqlite")));
  for (const [file, hash] of Object.entries(live.configurationHashes)) assert.equal(sha256(bytes(file)), hash);
  for (const [field, value] of Object.entries(live.target)) {
    if (field === "protocol") { assert.equal(value, "MORPHO_BLUE"); has("Morpho deployment"); }
    else has(value);
  }
  has(live.scope); has(live.configurationFingerprint); has("a public third-party borrower, not the user's wallet");
  assert.equal(preflight.fixturePermission, false);
  assert.deepEqual(snapshot.position, live.position); assert.deepEqual(snapshot.accounting, live.accounting);
  assert.equal(snapshot.block.number, live.block.number); assert.equal(snapshot.block.hash, live.block.hash); assert.equal(snapshot.block.timestamp, live.block.timestamp);
  const iso = timestamp => new Date(Number(timestamp) * 1_000).toISOString();
  assert.equal(iso(live.block.timestamp), live.block.timestampUtc);
  const minHead = BigInt(live.heads.rpc) < BigInt(live.heads.mcp) ? BigInt(live.heads.rpc) : BigInt(live.heads.mcp);
  assert.equal(minHead - BigInt(live.heads.selectionLagBlocks), BigInt(live.block.number));
  assert.ok(BigInt(live.block.number) > BigInt(preflight.historicalEvidence.previousBlock.number));
  const format = (raw, decimals, trim) => {
    const value = BigInt(raw), scale = 10n ** BigInt(decimals);
    const whole = (value / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const fraction = (value % scale).toString().padStart(decimals, "0");
    return whole + "." + (trim ? fraction.replace(/0+$/, "") : fraction);
  };
  has(format(live.position.collateral, 18, true) + " wsrUSD"); has(format(live.accounting.debt, 6, false) + " USDC");
  has(format(live.healthFactorWad, 18, false)); has(live.block.timestampUtc); has(live.block.hash); has(live.observedAt);
  assert.equal(BigInt(snapshot.valuation.maxBorrow) * 10n ** 18n / BigInt(snapshot.accounting.debt), BigInt(live.healthFactorWad));
  for (const [name, comparison] of Object.entries(live.thresholdResult.comparisons)) {
    const [whole, fraction = ""] = live.thresholds[name].split(".");
    const wad = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"));
    assert.equal(wad.toString(), comparison.thresholdWad);
    assert.equal((BigInt(live.accounting.debt) * wad).toString(), comparison.debtTimesThreshold);
    assert.equal(BigInt(live.thresholdResult.numerator) <= BigInt(comparison.debtTimesThreshold), comparison.atOrBelow);
    has(`| \`${name}\` | \`${live.thresholds[name]}\` | \`${comparison.debtTimesThreshold}\` | ${comparison.atOrBelow ? "YES" : "NO"} |`);
  }
  assert.equal(live.thresholdResult.comparisons.criticalRatio.atOrBelow, true); assert.equal(live.thresholdResult.comparisons.liquidationBoundary.atOrBelow, false);
  assert.equal(live.crossChecks.productionComparisons, 58); assert.equal(live.crossChecks.productionMismatches, 0);
  assert.equal(live.crossChecks.directGetterComparisons, 10); assert.equal(live.crossChecks.separateArithmeticMatches, 17);
  has("**58/58**"); has("**10/10**"); has("**17/17**"); has("not a direct on-chain health-factor getter"); has("not a claim about the position at report-reading time");
  pass("CONFIGURED_IDENTITY_PINNED_VALUES_AND_EXACT_THRESHOLDS", { block: live.block, account: live.target.account, positionId: live.target.positionId,
    collateralDisplay: format(live.position.collateral, 18, true), debtDisplay: format(live.accounting.debt, 6, false), healthFactor: format(live.healthFactorWad, 18, false),
    thresholds: live.thresholds, liveReadersCalledByThisValidator: 0 });

  const fenced = [...report.matchAll(/^```text\n([\s\S]*?)^```(?:\n|$)/gm)];
  assert.equal(fenced.length, 1);
  assert.deepEqual(Buffer.from(fenced[0][1]), bytes("console-alerts.txt"));
  const transcript = fenced[0][1], messages = transcript.split(/(?=^\[\d{4}-\d{2}-\d{2}T)/m).filter(Boolean);
  assert.equal(messages.length, 3); assert.equal(Buffer.byteLength(transcript), 3664);
  assert.equal(sha256(transcript), "1fa8721cd6de619e98f3ac46837627e02eb7f39bff042d6df0bd7168a938aaa8");
  assert.equal(live.alerts.length, 3); assert.equal(cycle.alerts.length, 3);
  const actionDetails = live.alerts.map((summary, index) => {
    const alert = cycle.alerts.find(item => item.id === summary.id), action = alert.suggestedAction, message = messages[index];
    assert.ok(action && typeof action === "object" && !Array.isArray(action)); assert.deepEqual(action, summary.suggestedAction);
    assert.equal(action.schemaVersion, 1); assert.equal(action.origin, "GENERATED"); assert.equal(action.type, "NON_FINANCIAL");
    assert.equal(action.actionable, false); assert.deepEqual(action.financialOptions, []); assert.equal(action.evidence.status, "NOT_QUALIFIED");
    assert.equal(alert.createdAt, live.observedAt); assert.equal(action.createdAt, alert.createdAt);
    for (const [field, value] of Object.entries({ chainId: live.target.chainId, account: live.target.account, marketId: live.target.marketId,
      cycleId: cycle.observation.cycleId, snapshotIdentifier: live.snapshotIdentifier, blockNumber: live.block.number, blockHash: live.block.hash,
      blockTimestamp: live.block.timestamp, progressionState: "UNKNOWN", progressionReason: "FIRST_OBSERVATION", oracleAssurance: "UNVERIFIED", oracleFreshness: "UNKNOWN" })) {
      assert.equal(action.evidence[field], value);
    }
    assert.deepEqual(action.evidence.recoveryEligibility, live.risk.recoveryEligibility);
    assert.equal(sha256(message), summary.renderedSha256);
    assert.equal(message.split("\n").filter(line => line.startsWith("Action: ")).length, 1);
    assert.equal(message.split("\n").filter(line => line.startsWith("Action evidence: ")).length, 1);
    assert.ok(message.includes(`Action: ${action.instruction}\n`)); assert.ok(message.startsWith(`[${alert.createdAt}] ${alert.severity} | ${alert.id}\n`));
    has(`| \`${summary.code}\` | \`NON_FINANCIAL\` | \`${action.rationale}\` | ${action.instruction} |`);
    return { id: alert.id, code: alert.code, type: action.type, rationale: action.rationale, instruction: action.instruction, actions: 1, financialOptions: 0 };
  });
  pass("FULL_CONSOLE_BYTES_TIMESTAMPS_AND_SINGLE_TYPED_ACTIONS", { transcript: anchor("console-alerts.txt"), alerts: actionDetails, adaptersInvoked: 0 });

  assert.equal(live.execution.runOnceCalls, 1); assert.equal(live.execution.liveReaderCalls, 1); assert.equal(live.execution.supplementalCalls, 1);
  assert.deepEqual(live.execution.notificationChannels, ["console"]);
  assert.equal(json("network-read-only-guard.json").requests.length, live.execution.networkRequests);
  for (const event of ["cycle_started", "cycle_observed", "cycle_completed", "shutdown"]) assert.equal(logs.filter(item => item.event === event).length, 1);
  assert.equal(logs.filter(item => item.event === "alert_created").length, 3);
  const delivered = logs.filter(item => item.event === "notification_delivery"); assert.equal(delivered.length, 3);
  for (const row of persisted.deliveries) {
    assert.equal(row.channel, "console"); assert.equal(row.status, "DELIVERED"); assert.equal(row.attempts, 1); assert.equal(row.ambiguous, 0);
    assert.equal(persisted.attempts[row.id].length, 1);
  }
  assert.equal(persisted.deliveries.length, 3); assert.equal(persisted.alerts.length, 3);
  assert.deepEqual(persisted.contentHashes, offline.baselineStoreContentHashes);
  const complete = logs.find(item => item.event === "cycle_completed"), start = logs.find(item => item.event === "cycle_started"), stop = logs.find(item => item.event === "shutdown");
  assert.equal(Date.parse(complete.timestamp) - Date.parse(start.timestamp), complete.durationMs);
  has(complete.durationMs); has(complete.timestamp); has(stop.timestamp);
  for (const summary of live.alerts) {
    const delivery = delivered.find(item => item.alertId === summary.id); assert.equal(delivery.channel, "console"); assert.equal(delivery.deliveryStatus, "DELIVERED");
    has(`| \`${summary.code}\` | \`${summary.severity}\` | \`${summary.timestamp}\` | \`${delivery.timestamp}\` | DELIVERED / 1 / 0 |`);
  }
  assert.equal(restart.status, "PASS"); assert.equal(restart.runtime.status, "STOPPED"); assert.equal(restart.statistics.pendingDeliveries, 0);
  for (const field of ["liveRunOnceCalls", "newObservations", "recoveredInFlight", "outboxDrainAttempts", "knownDeliveredResends", "fetchAttempts"]) assert.equal(restart[field], 0);
  for (const field of ["stateUnchanged", "logicalDatabaseHashesUnchanged", "deliveredHashUnchanged"]) assert.equal(restart[field], true);
  assert.equal(restart.knownDeliveredHash, persisted.knownDeliveredHash); assert.equal(bytes("restart-console.txt").length, 0);
  for (const command of restart.cli) {
    assert.equal(command.exitCode, 0); assert.equal(command.networkAttempted, false); assert.equal(command.deliveryAdapterInvoked, false);
    assert.equal(anchor(command.outputFile).bytes, command.bytes); assert.equal(anchor(command.outputFile).sha256, command.sha256);
  }
  has("It does not prove a second live worker cycle"); has("Provider exactly-once delivery is not claimed");
  pass("ONE_CAPTURED_CYCLE_AND_COMPLETED_DELIVERY_RESTART", { liveRunOnceCalls: 1, delivered: 3, attemptsEach: 1, pending: 0, runtime: "STOPPED",
    restartNewCycles: 0, restartNewObservations: 0, restartResends: 0, databaseOpenedByThisValidator: false });

  assert.equal(assurance.overall, "UNVERIFIED"); assert.equal(assurance.freshness.state, "UNKNOWN");
  assert.equal(assurance.freshness.observationAgeSeconds, "1333"); assert.equal(assurance.freshness.observationAgeSeconds,
    (BigInt(live.block.timestamp) - BigInt(snapshot.oracle.round.updatedAt)).toString());
  for (const field of ["verifiedHeartbeatSeconds", "upstreamFreshnessGuaranteeSeconds", "timingConfigurationFingerprint", "policyMaxAgeSeconds"]) assert.equal(assurance.freshness[field], null);
  assert.equal(assurance.freshness.policyOrigin, "NONE"); assert.equal(assurance.independent.selectedUpstreamId, null);
  assert.equal(assurance.independent.availability, "NOT_CONFIGURED"); assert.equal(assurance.independent.eligible, false);
  assert.equal(live.risk.actionable, false); assert.equal(live.risk.repayment, null); assert.equal(live.risk.additionalCollateral, null);
  assert.equal(live.risk.recoveryEligibility.eligible, false); assert.equal(live.risk.recoveryEligibility.status, "BLOCKED");
  assert.equal(live.risk.progression.state, "UNKNOWN"); assert.equal(live.risk.progression.reason, "FIRST_OBSERVATION"); assert.equal(live.risk.progression.baselineBlockNumber, null);
  assert.equal(supplemental.trace.length, 44); assert.equal(supplemental.samples.length, 2); assert.equal(supplemental.events.length, 0);
  assert.equal(BigInt(supplemental.historyTo) - BigInt(supplemental.historyFrom) + 1n, 8_000n);
  assert.equal(supplemental.signerSets[0].signers.length, 10); assert.equal(supplemental.signerSets[0].f, 3);
  const interval = BigInt(supplemental.samples[0].reports[0].observationsTimestamp) - BigInt(supplemental.samples[1].reports[0].observationsTimestamp);
  assert.equal(interval < 0n ? -interval : interval, 3_601n);
  for (const field of ["proxyOwner", "cacheOwner", "forwarderOwner", "allowedWorkflowOwner", "feed", "cache", "forwarder", "feedId"]) has(assurance.configuration[field]);
  for (const dimension of Object.values(assurance.dimensions)) for (const gap of dimension.missing) has(gap);
  for (const reason of live.risk.recoveryEligibility.reasonCodes) has(`- \`${reason}\``);
  has("**missing qualified timing-configuration fingerprint binding**"); has("not a changed chain, borrower, market");
  has("**RPC/MCP share an upstream**"); has("not independent economic verification or independent consensus");
  has("**3,601 seconds**"); has("**not a verified hourly heartbeat or a maximum-age guarantee**");
  pass("ORACLE_GAPS_NON_ACTIONABILITY_AND_FIRST_OBSERVATION", { overall: "UNVERIFIED", freshness: "UNKNOWN", oracleAgeSeconds: "1333",
    independentComparator: "NOT_CONFIGURED", timingConfigurationFingerprint: null, recoveryReasons: live.risk.recoveryEligibility.reasonCodes,
    intervalIsHeartbeatGuarantee: false, financialEstimatesGenerated: 0 });

  const assertions = unit.testResults.flatMap(file => file.assertionResults), originalFailed = assertions.filter(test => test.status === "failed");
  assert.equal(unit.testResults.length, 49); assert.equal(assertions.length, 1007); assert.equal(originalFailed.length, 1);
  assert.equal(assertions.filter(test => test.status === "passed").length, 1006); assert.equal(fullTests.status, "FAIL");
  assert.deepEqual(fullTests.unit, { files: 49, total: 1007, passed: 1006, failed: 1, pending: 0, todo: 0 });
  assert.equal(accounting.originalFullSuite.status, "FAIL"); assert.equal(accounting.currentAllGreenFullSuiteQualified, false);
  assert.equal(accounting.originalFullSuite.unitJsonSha256, sha256(bytes("unit-tests.json")));
  assert.equal(focused.status, "PASS"); assert.deepEqual(focused.unit, { files: 1, total: 4, passed: 4, failed: 0, pending: 0, todo: 0 });
  assert.equal(focusedUnit.numPassedTests, 4); assert.equal(focusedUnit.numFailedTests, 0); assert.equal(focusedUnit.testResults.length, 1);
  for (const command of fullTests.checks) {
    assert.deepEqual(json(`${command.name}-command.json`), command);
    has(command.command.join(" "));
    assert.equal(command.exitCode, command.name === "unit-tests" ? 1 : 0);
    for (const stream of [command.stdout, command.stderr]) assert.deepEqual(anchor(stream.file), stream);
  }
  assert.deepEqual(json("runtime-rerun-command.json"), focused.command); has(focused.command.command.join(" "));
  for (const stream of [focused.command.stdout, focused.command.stderr]) assert.deepEqual(anchor(stream.file), stream);
  assert.equal(sha256(bytes(focused.command.guardFile)), focused.command.guardSha256);
  const guardRecords = file => bytes(file).toString("utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
  const originalGuard = guardRecords("unit-network-guard.jsonl"), blocked = originalGuard.filter(row => row.outcome === "EXTERNAL_BLOCKED");
  assert.equal(originalGuard.length, 556); assert.equal(blocked.length, 18); assert.ok(blocked.every(row => row.host === "LOCAL_IPC"));
  const focusedGuard = guardRecords("runtime-rerun-network-guard.jsonl");
  assert.equal(focusedGuard.length, 10); assert.ok(focusedGuard.every(row => row.ipcClass === "WINDOWS_LOCAL_NAMED_PIPE" && row.allowed && row.outcome !== "EXTERNAL_BLOCKED"));
  assert.equal(focused.networkGuard.actualExternalAttempts, 0); assert.equal(focused.guardCases.length, 7); assert.ok(focused.guardCases.every(test => test.status === "PASS"));
  assert.equal(initialVerifier.status, "FAIL"); assert.equal(initialVerifier.checks.length, 8);
  assert.match(initialVerifier.error.message, /prototype|deep-equal/i);
  has("**FAIL — 1006/1007 passed**"); has("**PASS — 4/4 passed**"); has("No corrected-guard full-suite rerun was performed");
  has("**40,000 ms timeout**"); has("**EPERM cleanup**"); has(accounting.originalFullSuite.failures[0].fullName);
  has("precise cause of the timeout/cleanup failure is not conclusively isolated"); has("does **not** establish 18 external RPC/HTTP requests");
  pass("EXACT_CURRENT_TEST_COMMANDS_COUNTS_AND_RETAINED_FAILURES", { fullUnit: fullTests.unit, originalFullExitCode: 1, focused: focused.unit,
    freshAllGreenFullSuiteQualified: false, commandRecordsAndOutputHashesVerified: 5, originalBlockedLocalIpc: 18, originalBlockedNonIpc: 0,
    focusedExternalAttempts: 0, initialVerifierDiagnosticRetained: true });

  const auditDocument = readFileSync(join(repo, "docs/PHASE-11-PRODUCT-ACCEPTANCE-AUDIT.md"), "utf8");
  const tableRows = (text, header) => {
    const index = text.indexOf(header); assert.ok(index >= 0);
    return text.slice(index).split("\n\n")[0].split("\n").slice(2).map(line => line.slice(2, -2).split(" | "));
  };
  const originalRequirements = tableRows(auditDocument, "| Acceptance requirement | Verdict | Product-level conclusion |");
  const reportRequirements = tableRows(report, "| Original requirement | Finite-run verdict | Evidence and limitation |");
  assert.equal(reportRequirements.length, 4); assert.deepEqual(reportRequirements.map(row => row[0]), originalRequirements.map(row => row[0]));
  assert.ok(reportRequirements.every(row => row[1] === "**PASS**" && row[2].length > 100));
  has("These verdicts are limited to this exact finite local run"); has("production decision remains **NOT ACCEPTED / NO-GO**");
  has("Any additional live reads/cycles, activation, external notifications, implementation or migrations require a separately scoped approval");
  pass("FOUR_ORIGINAL_REQUIREMENTS_WITH_FINITE_LOCAL_SCOPE", { requirements: reportRequirements.map(row => ({ requirement: row[0], verdict: "PASS", scope: "EXACT_FINITE_LOCAL_RUN_ONLY" })),
    productionAcceptance: "NOT_ACCEPTED_NO_GO", furtherAuthorizationGranted: false });

  assert.equal(preservation.status, "PASS"); assert.deepEqual(preservation.added, []); assert.deepEqual(preservation.removed, []); assert.deepEqual(preservation.changed, []);
  assert.equal(preservation.gitUnchanged, true); assert.equal(preservation.indexUnchanged, true);
  assert.equal(preservation.baselineSha256, sha256(bytes("baseline.json")));
  assert.equal(preservation.currentEntries, 22029); assert.equal(preservation.currentBytes, 273681577); assert.deepEqual(preservation.git, baseline.git);
  assert.equal(preservation.git.head.exitCode, 128); assert.equal(preservation.git.stagedDiff.stdoutBytes, 0);
  assert.equal(sha256(readFileSync(join(repo, ".git/index"))), preservation.git.index.sha256);
  has(preservation.completedAt); has(preservation.git.index.sha256);
  pass("FRESH_FULL_PRESERVATION_RECORD_AND_UNCHANGED_INDEX", { fullComparisonCompletedAt: preservation.completedAt, entries: 22029, bytes: 273681577,
    added: 0, removed: 0, changed: 0, gitUnchanged: true, reportAndValidatorOutsideRepository: true });

  const links = [...report.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map(match => ({ label: match[1], target: match[2] }));
  const linkPaths = [];
  for (const link of links) {
    const path = link.target.startsWith("file:") ? fileURLToPath(link.target) : resolve(audit, link.target);
    assert.equal(/^[a-z]+:\/\//i.test(link.target) && !link.target.startsWith("file:///"), false, "Only local references are permitted");
    assert.ok(lstatSync(path).isFile(), link.target); linkPaths.push(resolve(path));
  }
  const hashRows = [...report.matchAll(/^\| \[([^\]]+)\]\(([^)]+)\) \| (\d+) \| `([a-f0-9]{64})` \|$/gm)];
  assert.equal(hashRows.length, 25);
  for (const row of hashRows) {
    assert.equal(row[1], row[2]); assert.equal(bytes(row[2]).length, Number(row[3])); assert.equal(sha256(bytes(row[2])), row[4]);
  }
  assert.equal(fetchAttempts, 0); assert.equal(socketAttempts, 0);
  pass("ALL_REPORT_LINKS_AND_EMBEDDED_HASH_TABLE", { references: links.length, uniqueLocalFiles: new Set(linkPaths).size, byteHashRows: hashRows.length,
    websitesContacted: 0, transcriptBytes: 3664, unresolvedRendererPlaceholders: 0 });

  const validation = { schemaVersion: 1, status: "PASS", evidenceClass: "OFFLINE_DOCUMENTARY_VALIDATION_NOT_A_NEW_LIVE_CYCLE_OR_TEST_RUN",
    startedAt, completedAt: new Date().toISOString(), report: anchor(reportFile), checkGroupsPassed: checks.length, checkGroupsFailed: 0, checks,
    network: { fetchAttempts, socketAttempts, remoteAccessPermitted: false }, productionImports: 0, databaseOpens: 0, subprocesses: 0,
    currentAllGreenFullSuiteQualified: false, productionAcceptance: "NOT_ACCEPTED_NO_GO" };
  save("report-validation-results.json", validation);

  // Manifest all top-level artifacts plus the offline build. Temporary fixture directories remain untouched.
  // Self-referential manifest/completion records are anchored by separate hash sidecars and the completion record.
  const selfExclusions = new Set(["artifact-manifest.json", "artifact-manifest.sha256", "report-completion.json", "report-completion.sha256"]);
  const excludedDirectories = [], files = [];
  const visitBuild = directory => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name), info = lstatSync(path);
      assert.equal(info.isSymbolicLink(), false);
      if (info.isDirectory()) visitBuild(path);
      else { assert.ok(info.isFile()); files.push(anchor(relative(audit, path).replaceAll("\\", "/"))); }
    }
  };
  for (const name of readdirSync(audit).sort()) {
    if (selfExclusions.has(name)) continue;
    const path = join(audit, name), info = lstatSync(path); assert.equal(info.isSymbolicLink(), false);
    if (info.isDirectory()) {
      if (name === "build") visitBuild(path);
      else excludedDirectories.push({ directory: name + "/", reason: "Temporary offline unit/process fixture directory, not live evidence; retained without cleanup or alteration." });
    } else { assert.ok(info.isFile()); files.push(anchor(name)); }
  }
  files.sort((a, b) => a.file.localeCompare(b.file));
  const manifest = { schemaVersion: 1, kind: "LOCAL_STAGE2_FINAL_ARTIFACT_BYTE_MANIFEST", createdAt: new Date().toISOString(), directory: audit,
    evidenceClass: "MIXED_LOCAL_LIVE_CAPTURE_OFFLINE_TEST_DOCUMENTATION_AND_BUILD_ARTIFACTS_NOT_ALL_LIVE_EVIDENCE", fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), files, excludedDirectories, selfReferenceExclusions: [...selfExclusions],
    report: anchor(reportFile), validation: anchor("report-validation-results.json"),
    sqliteNote: "SQLite database/WAL/SHM/monitor-lock bytes are a final physical-file snapshot only. No database was opened or checkpointed here; logical row qualification is the separately captured offline/restart evidence.",
    qualifiedLogicalDatabase: { source: "offline-verification-results-v2.json", completedAt: offline.completedAt, contentHashes: offline.baselineStoreContentHashes },
    integrityLimitation: "Local baseline-relative integrity, not independent custody or tamper-proof authority under full administrator compromise." };
  save("artifact-manifest.json", manifest);
  const manifestAnchor = anchor("artifact-manifest.json");
  writeFileSync(join(audit, "artifact-manifest.sha256"), `${manifestAnchor.sha256}  artifact-manifest.json\n`, { flag: "wx" });
  for (const file of json("artifact-manifest.json").files) assert.deepEqual(anchor(file.file), file, `Final rehash: ${file.file}`);
  assert.equal(bytes("artifact-manifest.sha256").toString("utf8"), `${sha256(bytes("artifact-manifest.json"))}  artifact-manifest.json\n`);
  assert.equal(sha256(bytes(reportFile)), validation.report.sha256);

  const completion = { schemaVersion: 1, status: "REPORT_COMPLETE_FINITE_LOCAL_RUN_PASSED_WITH_EXPLICIT_LIMITATIONS", completedAt: new Date().toISOString(),
    report: anchor(reportFile), validation: anchor("report-validation-results.json"), manifest: manifestAnchor, manifestHashSidecar: anchor("artifact-manifest.sha256"),
    evidence: anchor("live-stage2-evidence.json"), testAccounting: anchor("test-accounting.json"), preservation: anchor("preservation-report.json"),
    manifestFilesRehashed: files.length, manifestBytesRehashed: manifest.totalBytes,
    originalRequirements: reportRequirements.map(row => ({ requirement: row[0], verdict: "PASS", scope: "EXACT_FINITE_LOCAL_RUN_ONLY" })),
    execution: { capturedAuthorizedLiveCycles: 1, liveCyclesDuringFinalReportWork: 0, consoleAlerts: 3, delivered: 3, actionsPerAlert: 1,
      financialOptionsPerAlert: 0, pendingDeliveries: 0, runtime: "STOPPED", restartObservations: 0, restartResends: 0 },
    software: { fullUnit: fullTests.unit, fullUnitVerdict: "FAIL", fullUnitExitCode: 1, focusedUnit: focused.unit, focusedVerdict: "PASS",
      typecheck: "PASS", lint: "PASS", externalBuild: "PASS", freshAllGreenFullSuiteQualified: false, originalFailureRetained: true, conclusiveTimeoutCauseEstablished: false },
    oracle: { overall: "UNVERIFIED", freshness: "UNKNOWN", independentComparator: "NOT_CONFIGURED", selectedUpstreamId: null,
      qualifiedTimingConfigurationFingerprint: null, recoveryEligibility: "BLOCKED", actionable: false, financialAmountsSuggested: 0 },
    finalReportWork: { fetchAttempts, socketAttempts, productionImports: 0, databaseOpens: 0, subprocesses: 0, repositoryFilesWritten: 0 },
    productionAcceptance: "NOT_ACCEPTED_NO_GO", furtherAuthorizationGranted: false,
    stop: "Task stopped after the finite-run report. Further live reads/cycles, activation, external notifications, implementation, deployment or migrations require separately scoped approval." };
  save("report-completion.json", completion);
  const completionAnchor = anchor("report-completion.json");
  writeFileSync(join(audit, "report-completion.sha256"), `${completionAnchor.sha256}  report-completion.json\n`, { flag: "wx" });
  assert.deepEqual(json("report-completion.json"), completion); assert.equal(sha256(bytes(reportFile)), completion.report.sha256);
  assert.equal(fetchAttempts, 0); assert.equal(socketAttempts, 0);
  console.log(JSON.stringify({ status: completion.status, report: completion.report, validation: completion.validation, manifest: completion.manifest,
    completion: completionAnchor, reportCheckGroups: checks.length, artifactFilesRehashed: files.length, artifactBytesRehashed: manifest.totalBytes,
    fullUnit: "FAIL_1006_PASSED_1_FAILED", focusedUnit: "PASS_4_OF_4", oracle: "UNVERIFIED", actionable: false, runtime: "STOPPED", finalNetwork: { fetchAttempts, socketAttempts } }, null, 2));
} catch (error) {
  const file = existsSync(join(audit, "report-validation-results.json")) ? "report-finalization-diagnostic.json" : "report-validation-results.json";
  const failure = { schemaVersion: 1, status: "FAIL", startedAt, completedAt: new Date().toISOString(), checks,
    error: error instanceof Error ? { name: error.name, message: error.message } : String(error), network: { fetchAttempts, socketAttempts },
    reportCompletionNotQualified: true };
  save(file, failure); console.log(JSON.stringify(failure, null, 2)); process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch; Socket.prototype.connect = originalConnect;
}
