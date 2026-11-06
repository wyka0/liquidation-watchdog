// Separate documentary validator implementation: only built-in local file/JSON/byte operations.
// Does not import the report writer/helpers, application, database, network or process-execution APIs.
// report/manifest save exclusive new validation records. seal is strictly read-only and emits JSON.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AUDIT = dirname(fileURLToPath(import.meta.url)), REPO = "C:/liquidation-watchdog";
const STAGE2 = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/live-stage2-SGNCxp";
const ROOTS = { REPAIR: AUDIT, STAGE2, REPOSITORY: REPO };
const F = { baseline: "finalization-baseline.json", preservation: "preservation-seal.json", report: "FINAL-QUALIFICATION-REPAIR-REPORT.md",
  evidence: "final-qualification-evidence.json", validation: "final-report-validation.json", manifest: "final-artifact-manifest.json",
  manifestHash: "final-artifact-manifest.sha256", manifestVerification: "final-manifest-verification.json",
  completion: "final-completion.json", seal: "final-seal.json", sealHash: "final-seal.sha256" };
const EXCLUDED = [F.manifest, F.manifestHash, F.manifestVerification, F.completion, F.seal, F.sealHash];
const BEFORE = "099f9e3bf952c30fbbb4b99e074e8aee8f13417e0ae84a0cbdaee21f6b829846";
const AFTER = "98a358c1a083cf84cbb2e3a7e8adf86986be630245943c5897e0be9d0e5665cb";
const GUARD = "c20447118ed79039c832d6fdd171794659fcd905654e805adcd48ab67c614da6";
const OLD_REPORT = "acdfe3b107fa723c5d87ff990de66aaa7a2e3246e38b0f01b43b299efd66c60e";
const INDEX = "99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689";
const mode = process.argv[2], startedAt = new Date().toISOString(), checks = [];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const portable = path => path.replaceAll("\\", "/"), norm = path => portable(resolve(path)).toLowerCase();
const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const load = (file, root = "REPAIR") => readJson(join(ROOTS[root], file));
const readText = path => readFileSync(path, "utf8");
const total = entries => entries.reduce((sum, entry) => sum + entry.bytes, 0);
const same = (a, b) => { assert.deepEqual(a, b); };
const descriptor = path => { const bytes = readFileSync(path); return { bytes: bytes.length, sha256: hash(bytes) }; };
const reference = (file, root = "REPAIR") => ({ root, file: portable(file), ...descriptor(join(ROOTS[root], file)) });
const check = (name, operation) => {
  try { checks.push({ name, status: "PASS", detail: operation() ?? null }); }
  catch (error) { checks.push({ name, status: "FAIL", error: { name: error.name, message: error.message, stack: error.stack } }); }
};
function safePath(root, file) {
  assert.ok(ROOTS[root] && typeof file === "string" && !isAbsolute(file), "Reference must use a declared root and relative file");
  const path = resolve(ROOTS[root], file);
  assert.ok(norm(path).startsWith(norm(ROOTS[root]) + "/"), "Reference escapes its declared root");
  return path;
}
function verifyRef(ref, defaultRoot = "REPAIR") {
  const path = isAbsolute(ref.file) ? resolve(ref.file) : safePath(ref.root ?? defaultRoot, ref.file);
  assert.ok(Object.values(ROOTS).some(root => norm(path).startsWith(norm(root) + "/")), "Absolute reference is outside declared roots");
  same(descriptor(path), { bytes: ref.bytes, sha256: ref.sha256 });
  return path;
}
function verifyReferences(value, defaultRoot = "REPAIR") {
  let count = 0;
  const visit = item => {
    if (!item || typeof item !== "object") return;
    if (typeof item.file === "string" && Number.isInteger(item.bytes) && /^[a-f0-9]{64}$/.test(item.sha256 ?? "")) {
      verifyRef(item, defaultRoot); count++;
    }
    for (const child of Object.values(item)) if (child && typeof child === "object") visit(child);
  };
  visit(value); return count;
}
function inventory(root, excluded = []) {
  const ignored = new Set(excluded), result = [], pending = [root];
  while (pending.length) {
    const directory = pending.pop();
    for (const name of readdirSync(directory)) {
      const path = join(directory, name), key = portable(relative(root, path));
      if (ignored.has(key)) continue;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        const target = readlinkSync(path);
        result.push({ path: key, type: "SYMLINK", mode: stat.mode, bytes: Buffer.byteLength(target), sha256: hash(target), target });
      } else if (stat.isDirectory()) pending.push(path);
      else { assert.ok(stat.isFile(), "Unexpected artifact type"); result.push({ path: key, type: "FILE", mode: stat.mode, ...descriptor(path) }); }
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}
function assertInventory(expected, actual) {
  const old = new Map(expected.map(entry => [entry.path, entry])), now = new Map(actual.map(entry => [entry.path, entry]));
  assert.equal(old.size, expected.length, "Duplicate expected inventory path");
  assert.equal(now.size, actual.length, "Duplicate current inventory path");
  same([...old.keys()].sort(), [...now.keys()].sort());
  for (const [path, entry] of old) same(now.get(path), entry);
}
function preservedArtifacts() {
  const baseline = load(F.baseline), repair = inventory(AUDIT), stage2 = inventory(STAGE2), current = new Map(repair.map(entry => [entry.path, entry]));
  for (const entry of baseline.repair.files) same(current.get(entry.path), entry);
  same(baseline.repair.fileCount, baseline.repair.files.length); same(baseline.repair.bytes, total(baseline.repair.files));
  assertInventory(baseline.stage2.files, stage2); assertInventory(load("baseline.json").priorStage2.files, stage2);
  assert.equal(stage2.length, 561);
  return { existingRepairFilesRehashed: baseline.repair.files.length, existingRepairBytesRehashed: total(baseline.repair.files),
    allStage2FilesRehashed: stage2.length, allStage2BytesRehashed: total(stage2), existingArtifactChanges: 0 };
}
function preservedRepository() {
  const baseline = load("baseline.json"), current = inventory(REPO), allowed = load("authorized-changes.json").files;
  assert.equal(allowed.length, 1); assert.equal(allowed[0].path, "test/runtime-process.test.ts");
  same([allowed[0].beforeSha256, allowed[0].afterSha256, allowed[0].beforeBytes, allowed[0].afterBytes], [BEFORE, AFTER, 4776, 5805]);
  const old = new Map(baseline.files.map(entry => [entry.path, entry])), now = new Map(current.map(entry => [entry.path, entry]));
  same([...old.keys()].sort(), [...now.keys()].sort());
  const delta = [];
  for (const [path, entry] of old) {
    const after = now.get(path);
    if (JSON.stringify(entry) !== JSON.stringify(after)) delta.push({ path, before: entry, after });
  }
  assert.equal(delta.length, 1); assert.equal(delta[0].path, allowed[0].path);
  same([delta[0].before.sha256, delta[0].after.sha256], [BEFORE, AFTER]);
  same([baseline.entries, baseline.bytes, current.length, total(current)], [22029, 273681577, 22029, 273682606]);
  same(descriptor(join(REPO, ".git/index")), { bytes: 65736, sha256: INDEX });
  const preservation = load(F.preservation);
  same(preservation.git, baseline.git); assert.equal(preservation.status, "PASS");
  for (const field of ["protectedGitUnchanged", "priorStage2Unchanged", "statusUnchanged", "worktreeDiffUnchanged"]) assert.equal(preservation[field], true);
  same(preservation.changes, delta); assert.equal(preservation.baselineSha256, descriptor(join(AUDIT, "baseline.json")).sha256);
  assert.equal(preservation.git.stagedDiff.stdoutBytes, 0); assert.equal(preservation.git.head.exitCode, 128);
  return { filesRehashed: current.length, bytesRehashed: total(current), onlyDelta: allowed[0].path, gitIndexSha256: INDEX,
    savedReadOnlyGitCommandOutcomesMatchBaseline: true, allDotGitBytesUnchanged: true };
}
function originalManifest() {
  const manifest = load("artifact-manifest.json", "STAGE2");
  assert.equal(manifest.fileCount, 387); assert.equal(manifest.totalBytes, 10157722); assert.equal(manifest.files.length, 387);
  assert.equal(total(manifest.files), 10157722);
  for (const ref of manifest.files) verifyRef(ref, "STAGE2");
  assert.equal(descriptor(join(STAGE2, "LIVE-STAGE-2-MONITORING-REPORT.md")).sha256, OLD_REPORT);
  const completion = load("report-completion.json", "STAGE2"); verifyReferences(completion, "STAGE2");
  return { filesRehashed: 387, bytesRehashed: 10157722, originalReportSha256: OLD_REPORT };
}
function testsInventory(tests) {
  return tests.testResults.flatMap(file => file.assertionResults.map(test => `${norm(file.name)}|${test.fullName ?? [...(test.ancestorTitles ?? []), test.title].join(" ")}`)).sort();
}
function testAccounting(tests) {
  const rows = tests.testResults.flatMap(file => file.assertionResults), statuses = rows.map(row => row.status);
  const counts = { files: tests.testResults.length, total: rows.length, passed: statuses.filter(status => status === "passed").length,
    failed: statuses.filter(status => status === "failed").length, unselected: statuses.filter(status => status === "skipped" || status === "pending").length,
    todo: statuses.filter(status => status === "todo").length };
  same([tests.numTotalTests, tests.numPassedTests, tests.numFailedTests, tests.numPendingTests, tests.numTodoTests],
    [counts.total, counts.passed, counts.failed, counts.unselected, counts.todo]);
  assert.equal(counts.total, counts.passed + counts.failed + counts.unselected + counts.todo);
  return counts;
}
function syntaxChecks() {
  const syntax = load("final-documentary-syntax-checks/summary.json");
  assert.equal(syntax.status, "PASS"); assert.equal(syntax.scripts.length, 7);
  for (const result of syntax.scripts) {
    assert.equal(result.exitCode, 0); assert.equal(result.signal, null);
    same(descriptor(join(AUDIT, result.script)), { bytes: result.bytes, sha256: result.sha256 });
    same(descriptor(join(AUDIT, "final-documentary-syntax-checks", result.sourceCapsule)), { bytes: result.bytes, sha256: result.sha256 });
    verifyRef({ ...result.stdout, file: `final-documentary-syntax-checks/${result.stdout.file}` });
    verifyRef({ ...result.stderr, file: `final-documentary-syntax-checks/${result.stderr.file}` });
    assert.equal(result.command[1], "--check");
  }
  return { documentaryToolsSyntaxChecked: 7, actionModesOrSoftwareTestsInvoked: 0 };
}
function manifestContents() {
  const manifest = load(F.manifest);
  same(manifest.roots.map(root => root.root), ["REPAIR", "STAGE2"]);
  same(manifest.exclusions.map(item => ({ root: item.root, file: item.file })), EXCLUDED.map(file => ({ root: "REPAIR", file })));
  let files = 0, bytes = 0;
  for (const root of manifest.roots) {
    assert.equal(norm(root.directory), norm(ROOTS[root.root]));
    const actual = inventory(ROOTS[root.root], root.root === "REPAIR" ? EXCLUDED : []);
    assertInventory(root.files, actual); assert.equal(root.fileCount, actual.length); assert.equal(root.totalBytes, total(actual));
    files += actual.length; bytes += total(actual);
  }
  same([manifest.fileCount, manifest.totalBytes], [files, bytes]);
  assert.equal(readText(join(AUDIT, F.manifestHash)), `${descriptor(join(AUDIT, F.manifest)).sha256}  ${F.manifest}\n`);
  verifyRef(manifest.report); verifyRef(manifest.validation); verifyRef(manifest.preservation); verifyRef(manifest.originalStage2Manifest);
  return { fileCount: files, totalBytes: bytes, roots: manifest.roots.map(({ root, fileCount, totalBytes }) => ({ root, fileCount, totalBytes })),
    excludedRepairIntegrityEnvelopeFiles: EXCLUDED, unmanifestedFilesWithinDeclaredCoverage: 0 };
}
function reportChecks() {
  const evidence = load(F.evidence), report = readText(join(AUDIT, F.report)), live = load("live-stage2-evidence.json", "STAGE2");
  const batch = load("qualification-batch/summary.json"), gaps = load("oracle-qualification-gaps.json"), lifecycle = load("final-lifecycle-verification.json");
  const causality = load("causal-analysis.json"), original = load("unit-tests.json", "STAGE2"), qualified = load("qualified-full-v2/tests.json");
  check("REPORT_METADATA_REFERENCES_AND_NO_RENDERER_PLACEHOLDERS", () => {
    assert.equal(evidence.status, "FINAL_QUALIFICATION_REPAIR_SOFTWARE_PASS_PRODUCTION_NOT_ACCEPTED_NO_GO"); verifyRef(evidence.report);
    // The exact retained TypeError legitimately contains "undefined"; exempt only that captured message.
    const capturedError = load("causal-consolidation-attempt-1.json").error.message;
    assert.ok(report.includes(capturedError)); assert.ok(!/\b(?:undefined|NaN)\b/.test(report.replaceAll(capturedError, "")));
    assert.ok(report.includes(evidence.generatedAt));
    return { referencesRehashed: verifyReferences(evidence), report: reference(F.report), evidence: reference(F.evidence) };
  });
  check("FOUR_EXACT_REQUIREMENTS_PASS_WITH_FINITE_LOCAL_SCOPE_ONLY", () => {
    const expected = ["Read collateral, debt and health factor (or equivalent) from chain",
      "Support configurable warning and critical thresholds, with default examples 1.3 and 1.1",
      "Send timestamped alerts through at least one supported channel", "Include a concrete suggested action in each alert"];
    same(evidence.originalRequirements.map(item => item.requirement), expected);
    same(evidence.originalRequirements.map(({ requirement, verdict, scope }) => ({ requirement, verdict, scope })), load("report-completion.json", "STAGE2").originalRequirements);
    for (const item of evidence.originalRequirements) {
      assert.equal(item.verdict, "PASS"); assert.equal(item.scope, "EXACT_FINITE_LOCAL_RUN_ONLY");
      assert.ok(item.evidence.length > 40); assert.ok(report.includes(`| ${item.requirement} | **PASS — finite local run only** |`));
    }
    assert.ok(readText(join(REPO, "docs/PHASE-11-PRODUCT-ACCEPTANCE-AUDIT.md")).includes("1.3"));
    return { originalRequirements: 4, productionAcceptanceImplied: false };
  });
  check("RETAINED_CHAIN_READ_DERIVATION_AND_THRESHOLD_EVIDENCE", () => {
    same(evidence.historicalStage2.target, live.target); same(evidence.historicalStage2.block, live.block);
    assert.equal(live.block.number, "22225454"); assert.equal(live.target.chainId, 1672);
    assert.equal(new Date(Number(BigInt(live.block.timestamp)) * 1000).toISOString(), live.block.timestampUtc);
    same(live.thresholds, { warningRatio: "1.30", criticalRatio: "1.10", targetRatio: "1.25", liquidationBoundary: "1.00" });
    const direct = load("independent-pinned-verification.json", "STAGE2");
    assert.equal(direct.status, "PASS"); assert.equal(direct.calls.length, 10);
    assert.ok(direct.calls.every(call => call.matches && call.blockNumber === live.block.number && call.rpcBytes === call.mcpBytes));
    const audit = load("offline-verification-results-v2.json", "STAGE2"); assert.equal(audit.status, "PASS");
    const readCheck = audit.checks.find(item => item.name === "PINNED_GETTER_REDECODING_AND_PRODUCTION_CROSS_CHECKS");
    const mathCheck = audit.checks.find(item => item.name === "SEPARATE_INTEGER_ACCOUNTING_AND_THRESHOLD_RECHECK");
    same([readCheck.detail.productionComparisons, readCheck.detail.directGetters, mathCheck.detail.fields], [58, 10, 17]);
    for (const value of [live.position.collateral, live.position.borrowShares, live.accounting.debt, live.decoded.safetyRatio, live.block.hash]) assert.ok(report.includes(value));
    return { priorAccessPathComparisons: 58, priorDirectGetters: 10, priorBigIntMatches: 17, newPositionReads: 0 };
  });
  check("SEPARATE_BIGINT_RECHECK_FROM_RETAINED_RAW_ABI_BYTES", () => {
    const direct = load("independent-pinned-verification.json", "STAGE2"), snapshot = load("live-monitor-snapshot.json", "STAGE2");
    const words = label => {
      const raw = direct.calls.find(call => call.label === label)?.rpcBytes;
      assert.ok(typeof raw === "string" && /^0x(?:[a-fA-F0-9]{64})+$/.test(raw), `Missing complete ABI words: ${label}`);
      return raw.slice(2).match(/.{64}/g).map(word => BigInt("0x" + word));
    };
    const params = words("market identity"), market = words("market totals"), borrower = words("borrower position");
    same([params.length, market.length, borrower.length], [5, 6, 3]);
    const WAD = 10n ** 18n, price = words("oracle price")[0], rate = words("pinned IRM view rate")[0];
    const round = words("feed answer and timestamp");
    assert.equal(round.length, 5); assert.equal(price, round[1] * 1_000_000n);
    same([round[0], round[2], round[4]], [0n, round[3], 0n]);
    assert.equal(BigInt(live.block.timestamp) - round[3], 1333n);
    const elapsed = BigInt(live.block.timestamp) - market[4], first = rate * elapsed;
    const second = first * first / (2n * WAD), third = second * first / (3n * WAD);
    const interest = market[2] * (first + second + third) / WAD;
    const accruedBorrowAssets = market[2] + interest, accruedSupplyAssets = market[0] + interest;
    const feeAmount = interest * market[5] / WAD;
    const feeShares = feeAmount * (market[1] + 1_000_000n) / (accruedSupplyAssets - feeAmount + 1n);
    const denominator = market[3] + 1_000_000n;
    const debt = (borrower[1] * (accruedBorrowAssets + 1n) + denominator - 1n) / denominator;
    const collateralValue = borrower[2] * price / (10n ** 36n), maxBorrow = collateralValue * params[4] / WAD;
    const accounting = { elapsedSeconds: elapsed, ratePerSecondWad: rate, firstTerm: first, secondTerm: second, thirdTerm: third,
      interest, accruedBorrowAssets, accruedSupplyAssets, accruedSupplyShares: market[1] + feeShares, totalBorrowShares: market[3], feeAmount, feeShares, debt };
    const valuation = { collateralValue, maxBorrow, safetyRatioWad: maxBorrow * WAD / debt, ltvWad: debt * WAD / collateralValue };
    for (const [field, value] of Object.entries(accounting)) { assert.equal(value.toString(), snapshot.accounting[field]); assert.equal(value.toString(), live.accounting[field]); }
    for (const [field, value] of Object.entries(valuation)) assert.equal(value.toString(), snapshot.valuation[field]);
    assert.equal(borrower[2].toString(), live.position.collateral); assert.equal(borrower[1].toString(), live.position.borrowShares);
    assert.equal(valuation.safetyRatioWad.toString(), live.healthFactorWad);
    assert.equal(`${valuation.safetyRatioWad / WAD}.${(valuation.safetyRatioWad % WAD).toString().padStart(18, "0")}`, live.decoded.safetyRatio);
    const numerator = maxBorrow * WAD;
    const thresholds = { warningRatio: 1_300_000_000_000_000_000n, criticalRatio: 1_100_000_000_000_000_000n,
      targetRatio: 1_250_000_000_000_000_000n, liquidationBoundary: WAD };
    for (const [name, value] of Object.entries(thresholds)) {
      const comparison = live.thresholdResult.comparisons[name];
      same(comparison, { thresholdWad: value.toString(), debtTimesThreshold: (debt * value).toString(), atOrBelow: numerator <= debt * value });
    }
    same([numerator.toString(), debt.toString()], [live.thresholdResult.numerator, live.thresholdResult.debt]);
    assert.ok(numerator > debt * WAD && numerator <= debt * thresholds.criticalRatio);
    assert.equal(live.risk.mathematical, "CRITICAL"); assert.equal(live.risk.effective, "DATA_UNVERIFIED");
    return { rawAbiInputs: 6, accountingAndValuationFieldsRecomputed: 17, exactThresholdCrossProducts: 4,
      observationIsHistoricalOnly: true, oracleEconomicAccuracyOrFinancialActionNotInferred: true };
  });
  check("THREE_ACTUAL_TIMESTAMPED_CONSOLE_ALERTS_SINGLE_NON_FINANCIAL_ACTIONS", () => {
    const consoleText = readText(join(STAGE2, "console-alerts.txt")), restart = load("restart-verification.json", "STAGE2");
    const cycle = load("live-monitor-cycle-result.json", "STAGE2"), logs = load("cycle-logs.json", "STAGE2");
    const persisted = load("persisted-before-restart.json", "STAGE2");
    // The renderer prints alert IDs, not semantic codes. Slice the original bytes at their exact headers.
    const headers = [...consoleText.matchAll(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\] ([A-Z]+) \| (alert_[a-f0-9]{64})$/gm)];
    assert.equal(live.alerts.length, 3); assert.equal(live.persistence.consoleDelivered, 3); assert.equal(live.persistence.runtimeStatus, "STOPPED");
    assert.equal(headers.length, 3); assert.equal(headers[0].index, 0); assert.equal(new Set(headers.map(header => header[3])).size, 3);
    same(headers.map(header => header[3]), live.alerts.map(alert => alert.id));
    assert.equal(cycle.alerts.length, 3); assert.equal(persisted.deliveries.length, 3);
    const messages = [];
    for (const [index, alert] of live.alerts.entries()) {
      const header = headers[index], message = consoleText.slice(header.index, headers[index + 1]?.index ?? consoleText.length);
      const lines = message.split("\n"), action = alert.suggestedAction, binding = action.evidence;
      messages.push(message); assert.equal(lines.pop(), ""); assert.equal(lines.length, 15);
      same([header[1], header[2], header[3]], [alert.timestamp, alert.severity, alert.id]);
      assert.equal(hash(message), alert.renderedSha256); assert.equal(alert.timestamp, live.observedAt); assert.equal(action.createdAt, alert.timestamp);
      const captured = cycle.alerts.find(item => item.id === alert.id); assert.ok(captured);
      same([captured.code, captured.severity, captured.createdAt], [alert.code, alert.severity, alert.timestamp]);
      same(captured.suggestedAction, action);
      same([binding.chainId, binding.account, binding.marketId, binding.snapshotIdentifier, binding.blockNumber, binding.blockHash, binding.blockTimestamp],
        [live.target.chainId, live.target.account, live.target.marketId, live.snapshotIdentifier, live.block.number, live.block.hash, live.block.timestamp]);
      assert.equal(binding.cycleId, cycle.observation.cycleId); assert.equal(captured.current.risk.snapshotIdentifier, binding.snapshotIdentifier);
      for (const line of [`Position: ${binding.account}`, `Market: ${binding.marketId}`,
        `Snapshot: block ${binding.blockNumber}; hash ${binding.blockHash}`,
        `Snapshot ID: ${binding.snapshotIdentifier}; context: ${captured.current.risk.temporalContext}`,
        `Action evidence: ${binding.status}; rationale: ${action.rationale}; origin: ${action.origin}; actionable: false`]) assert.ok(lines.includes(line));
      same(lines.filter(line => line.startsWith("Action: ")), [`Action: ${action.instruction}`]);
      assert.equal(lines.filter(line => line.startsWith("Action option: ")).length, 0);
      same([action.type, action.origin, action.actionable, binding.status], ["NON_FINANCIAL", "GENERATED", false, "NOT_QUALIFIED"]);
      same(action.financialOptions, []); assert.ok(report.includes(action.instruction));
      const created = logs.filter(item => item.event === "alert_created" && item.alertId === alert.id);
      assert.equal(created.length, 1); same([created[0].timestamp, created[0].cycleId], [alert.timestamp, binding.cycleId]);
      const delivered = logs.filter(item => item.event === "notification_delivery" && item.alertId === alert.id);
      assert.equal(delivered.length, 1); same([delivered[0].channel, delivered[0].deliveryStatus], ["console", "DELIVERED"]);
      assert.ok(Date.parse(delivered[0].timestamp) >= Date.parse(alert.timestamp)); assert.ok(report.includes(delivered[0].timestamp.slice(11)));
      const rows = persisted.deliveries.filter(item => item.alert_id === alert.id);
      assert.equal(rows.length, 1); same([rows[0].channel, rows[0].status, rows[0].attempts, rows[0].ambiguous], ["console", "DELIVERED", 1, 0]);
      const attempts = persisted.attempts[rows[0].id]; assert.equal(attempts.length, 1);
      same([attempts[0].attempt, attempts[0].outcome, attempts[0].ambiguous, attempts[0].completed_at], [1, "DELIVERED", 0, delivered[0].timestamp]);
      assert.ok(Date.parse(attempts[0].started_at) >= Date.parse(alert.timestamp));
      assert.ok(Date.parse(attempts[0].completed_at) >= Date.parse(attempts[0].started_at));
    }
    assert.equal(messages.join(""), consoleText);
    same(descriptor(join(STAGE2, "console-alerts.txt")), { bytes: 3664, sha256: "1fa8721cd6de619e98f3ac46837627e02eb7f39bff042d6df0bd7168a938aaa8" });
    const prior = load("report-validation-results.json", "STAGE2");
    assert.equal(prior.status, "PASS"); same([prior.checkGroupsPassed, prior.checkGroupsFailed], [9, 0]);
    same([restart.status, restart.newObservations, restart.outboxDrainAttempts, restart.knownDeliveredResends], ["PASS", 0, 0, 0]);
    return { actualDeliveries: 3, perMessageByteHashesAndTimestampActionSnapshotBindings: 3, actionsPerAlert: 1, financialOptions: 0,
      transcriptChanged: false, realMonitor: "STOPPED" };
  });
  check("ORIGINAL_FULL_FAILURE_AND_ORIGINAL_FOCUSED_PASS_RETAINED", () => {
    same(testAccounting(original), { files: 49, total: 1007, passed: 1006, failed: 1, unselected: 0, todo: 0 }); assert.equal(original.success, false);
    const failed = original.testResults.flatMap(file => file.assertionResults).filter(test => test.status === "failed");
    assert.equal(failed.length, 1); assert.ok(failed[0].failureMessages.some(message => message.includes("40000ms")));
    assert.ok(failed[0].failureMessages.some(message => message.includes("EPERM")));
    same(testAccounting(load("runtime-rerun-tests.json", "STAGE2")), { files: 1, total: 4, passed: 4, failed: 0, unselected: 0, todo: 0 });
    assert.equal(load("offline-verification-results.json", "STAGE2").status, "FAIL");
    return { originalFull: "FAIL_1006_OF_1007", originalFocused: "PASS_4_OF_4", originalDocumentaryFailureRetained: true };
  });
  check("ONE_FILE_CORRECTION_ASSERTIONS_CHILD_BOUNDS_AND_V2_GUARD", () => {
    const contract = load("test-contract-preservation.json"), before = readText(join(AUDIT, "source-before/runtime-process.test.ts")), after = readText(join(REPO, "test/runtime-process.test.ts"));
    same(descriptor(join(AUDIT, "source-before/runtime-process.test.ts")), { bytes: 4776, sha256: BEFORE });
    same(descriptor(join(REPO, "test/runtime-process.test.ts")), { bytes: 5805, sha256: AFTER });
    assert.equal(contract.status, "PASS"); assert.equal(contract.expandedTests, 4); assert.equal(contract.originalAssertionChainsPreserved.length, 12);
    const squash = value => value.replace(/\s+/g, " ");
    for (const assertion of contract.originalAssertionChainsPreserved) { assert.ok(squash(before).includes(squash(assertion))); assert.ok(squash(after).includes(squash(assertion))); }
    assert.equal(contract.addedCleanupAssertion.length, 1); assert.ok(squash(after).includes(squash(contract.addedCleanupAssertion[0])));
    same(contract.unchangedPerChildSpawnTimeoutsMs, [30000, 20000]); assert.equal(contract.unchangedGracefulShutdownAssertionMs, 3000);
    same([contract.aggregateRecoveryDeadline.beforeMs, contract.aggregateRecoveryDeadline.afterMs], [40000, 70000]);
    assert.ok(!/\bit\.(?:skip|only|todo)\s*\(/.test(after)); assert.ok(after.includes("await child.closed"));
    assert.ok(after.includes("directories.splice(0)")); assert.ok(after.includes("Promise.allSettled(children.splice(0).map(stop))"));
    for (const ref of contract.preserved) verifyRef({ ...ref, root: "REPOSITORY", file: ref.path });
    same(descriptor(join(AUDIT, "test-network-guard-v2.cjs")), descriptor(join(STAGE2, "test-network-guard-v2.cjs")));
    assert.equal(descriptor(join(AUDIT, "test-network-guard-v2.cjs")).sha256, GUARD);
    assert.ok(readText(join(REPO, "vitest.config.ts")).includes("maxWorkers: 2"));
    assert.ok(readText(join(REPO, "test/helpers/phase8-runtime.ts")).includes("25_000"));
    return { originalAssertions: 12, addedAssertions: 1, expandedTests: 4, onlyAggregateDeadlineChangedToMs: 70000, criticalFilesUnchanged: 8, guardSha256: GUARD };
  });
  check("CAUSAL_DIAGNOSTIC_CONTROLS_AND_MISSING_PROVENANCE_STAY_HONEST", () => {
    assert.equal(causality.controls.length, 6); assert.equal(causality.rootCause.length, 4);
    const expected = { "ipc-v1-negative-control": "FAIL", "unmodified-independent-v2": "PASS", "unmodified-loaded-v2": "PASS",
      "original-budget-latency-negative-control": "FAIL", "corrected-budget-latency-control": "PASS", "corrected-teardown-deadline-negative-control": "FAIL" };
    for (const control of causality.controls) {
      assert.equal(control.status, expected[control.name]); assert.equal(control.role, "DIAGNOSTIC_CONTROL_NOT_FRESH_QUALIFICATION");
      assert.equal(descriptor(join(AUDIT, control.name, "summary.json")).sha256, control.summarySha256);
      assert.equal(descriptor(join(AUDIT, control.name, "process-lifecycle.jsonl")).sha256, control.lifecycleSha256);
      if (!control.sourceCapsuleRecorded) assert.equal(control.sourceSha256, null);
      else assert.equal(control.sourceSha256, load(`${control.name}/summary.json`).tooling.testSource.sha256);
      assert.ok(report.includes(control.name));
    }
    const v1 = causality.controls.find(item => item.name === "ipc-v1-negative-control");
    same([v1.selectedAssertion.status, v1.guard.blockedLocalIPC, v1.guard.demonstratedRemoteAttempts], ["passed", 4, 0]);
    const originalControl = causality.controls.find(item => item.name === "original-budget-latency-negative-control");
    const correctedControl = causality.controls.find(item => item.name === "corrected-budget-latency-control");
    const deadlineControl = causality.controls.find(item => item.name === "corrected-teardown-deadline-negative-control");
    assert.ok(originalControl.selectedAssertion.failureMessages.some(message => message.includes("EPERM")));
    assert.ok(correctedControl.selectedAssertion.durationMs > 40000);
    assert.ok(deadlineControl.selectedAssertion.failureMessages.some(message => message.includes("40000ms")));
    assert.ok(deadlineControl.selectedAssertion.failureMessages.every(message => !message.includes("EPERM")));
    for (const limit of causality.limits) assert.ok(report.includes(limit));
    return { controlsKeptDiagnostic: 6, v1FalseLocalIPCBlocks: 4, earlyMissingCapsulesKeptNull: 3, lostHistoricalLifecycleNotInvented: true };
  });
  check("RETAINED_CAUSAL_HELPER_FAILURE_HAS_EXACT_CAPSULE_AND_UNKNOWN_INVOCATION_TIME", () => {
    const failure = load("causal-consolidation-attempt-1.json");
    assert.equal(failure.exitCode, 1); assert.equal(failure.failedInvocationTimestamp, "NOT_CAPTURED");
    same(failure.error, { name: "TypeError", message: "Cannot read properties of undefined (reading 'sha256')", location: "consolidate-causality.mjs:35:46" });
    assert.equal(descriptor(failure.toolCapsule).sha256, failure.toolSha256);
    assert.ok(readText(join(AUDIT, "causal-consolidation-attempt-1.stderr.txt")).includes(failure.error.message));
    assert.ok(report.includes("concise error excerpt")); assert.ok(report.includes("NOT_CAPTURED"));
    return { exitCode: 1, timestamp: "NOT_CAPTURED", failureSeparateFromSoftwareQualification: true };
  });
  check("RETAINED_INPUT_REVIEW_QUOTING_FAILURE_BEFORE_EVIDENCE_READ", () => {
    const failure = load("documentary-input-review-attempt-1.json");
    assert.equal(failure.exitCode, 1); assert.equal(failure.failedInvocationTimestamp, "NOT_CAPTURED");
    same(failure.error, { name: "SyntaxError", message: "Unexpected identifier 'node'", location: "file:///C:/liquidation-watchdog/[eval1]:1" });
    assert.equal(failure.actualNativeEvalArgumentFullyCaptured, false); assert.equal(failure.streamSeparationCaptured, false);
    assert.equal(failure.noCapturedEvidenceRead, true); assert.equal(failure.noSoftwareTestOrApplicationOrDatabaseOrNetworkOrMonitoringOperation, true);
    verifyReferences(failure); assert.ok(report.includes("PowerShell quoting failure"));
    return { exitCode: 1, failedBeforeEvidenceRead: true, nativeEvalArgumentAndInvocationTimeNotInvented: true, softwareQualificationUnchanged: true };
  });
  check("FIVE_FINAL_PHASES_SEQUENTIAL_AND_ALL_COMMAND_OUTPUT_BYTES", () => {
    assert.equal(batch.status, "PASS"); assert.equal(batch.results.length, 5); assert.equal(batch.defaultMaxWorkers, 2); assert.equal(batch.guardSha256, GUARD);
    assert.equal(batch.sequentialNoConcurrentTestOrCompilerWorkloads, true);
    same(batch.results.map(phase => phase.mode), ["independent", "runtime-process", "focused", "full", "checks"]);
    for (let index = 0; index < batch.results.length; index++) {
      const phase = batch.results[index], summary = load(`${phase.name}/summary.json`);
      assert.equal(phase.exitCode, 0); assert.equal(phase.status, "PASS"); assert.equal(summary.status, "PASS");
      same(phase, load(`qualification-batch/${phase.name}-orchestration.json`));
      assert.equal(descriptor(join(AUDIT, "qualification-batch", `${phase.name}.stdout.txt`)).sha256, phase.stdoutSha256);
      assert.equal(descriptor(join(AUDIT, "qualification-batch", `${phase.name}.stderr.txt`)).sha256, phase.stderrSha256);
      assert.equal(descriptor(join(AUDIT, phase.name, "summary.json")).sha256, phase.summarySha256);
      if (index) assert.ok(Date.parse(phase.startedAt) >= Date.parse(batch.results[index - 1].completedAt));
      assert.equal(summary.tooling.testSource.sha256, AFTER); assert.equal(summary.networkGuard.sha256, GUARD);
      assert.equal(summary.networkGuard.version, "v2"); same([summary.networkGuard.blockedRecords, summary.networkGuard.blockedLocalIPC, summary.networkGuard.demonstratedRemoteAttempts], [0, 0, 0]);
      same([summary.safety.readinessMessagesIntentionallyDelayedForControl, summary.safety.aggregateDeadlineIntentionallyLoweredForControl], [false, false]);
      assert.equal(summary.safety.timeoutsOrAssertionsChangedByDiagnosticPreloader, false); verifyReferences(summary);
      same(descriptor(summary.tooling.diagnostics.file), descriptor(join(AUDIT, "process-diagnostics.cjs")));
      same(descriptor(summary.tooling.runner.file), descriptor(join(AUDIT, "run-tests.mjs")));
      same(descriptor(summary.tooling.runtimeHelper.file), descriptor(join(REPO, "test/helpers/phase8-runtime.ts")));
      const network = readText(summary.logs.network.file).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
      assert.equal(network.length, summary.networkGuard.records); assert.ok(network.every(record => record.outcome !== "EXTERNAL_BLOCKED"));
      assert.equal(network.filter(record => record.ipcClass === "WINDOWS_LOCAL_NAMED_PIPE" && record.allowed === true).length, summary.networkGuard.allowedLocalNamedPipes);
      for (const result of summary.results) {
        same(result, load(`${phase.name}/${result.label}-command.json`)); assert.equal(result.exitCode, 0); assert.equal(norm(result.cwd), norm(REPO));
        assert.ok(!result.command.some(arg => /^--(?:maxWorkers|minWorkers)|--fix$/.test(arg)));
        for (const arg of result.command) assert.ok(report.includes(arg));
      }
    }
    return { sequentialPhases: 5, childCommandRecordsRehashed: 7, unchangedMaxWorkers: 2, qualifiedRemoteAttempts: 0 };
  });
  for (const [name, expected] of [["qualified-independent-v2", { files: 1, total: 4, passed: 1, failed: 0, unselected: 3, todo: 0 }],
    ["qualified-runtime-process-v2", { files: 1, total: 4, passed: 4, failed: 0, unselected: 0, todo: 0 }],
    ["qualified-focused-v2", { files: 3, total: 31, passed: 31, failed: 0, unselected: 0, todo: 0 }],
    ["qualified-full-v2", { files: 49, total: 1007, passed: 1007, failed: 0, unselected: 0, todo: 0 }]]) {
    check(`QUALIFIED_TEST_ACCOUNTING_${name}`, () => {
      const tests = load(`${name}/tests.json`); assert.equal(tests.success, true); same(testAccounting(tests), expected);
      if (name === "qualified-focused-v2") same(tests.testResults.map(file => norm(file.name)).sort(),
        ["test/runtime-process.test.ts", "test/runtime-lifecycle.test.ts", "test/runtime-storage.test.ts"].map(file => norm(join(REPO, file))).sort());
      if (name === "qualified-independent-v2") {
        const selected = tests.testResults.flatMap(file => file.assertionResults).filter(test => test.status === "passed");
        assert.equal(selected[0].title, "fences a second process and recovers after actual forced OS termination with an unfinished cycle");
        assert.equal(selected[0].duration, 10538.9707);
      } else assert.ok(tests.testResults.flatMap(file => file.assertionResults).every(test => test.failureMessages.length === 0));
      return expected;
    });
  }
  check("FULL_1007_TEST_49_FILE_INVENTORY_EXACTLY_MATCHES_ORIGINAL", () => { same(testsInventory(qualified), testsInventory(original)); return { files: 49, tests: 1007, removedOrRenamedTests: 0 }; });
  check("TYPESCRIPT_ESLINT_AND_EXTERNAL_BUILD_EXACT_EXIT_ZERO", () => {
    const results = load("qualified-checks-v2/summary.json").results;
    same(results.map(result => [result.label, result.exitCode]), [["typecheck", 0], ["lint", 0], ["build", 0]]);
    assert.ok(results[0].command.includes("--noEmit")); assert.ok(results[1].command.includes("--no-cache")); assert.ok(!results[1].command.includes("--fix"));
    const out = results[2].command[results[2].command.indexOf("--outDir") + 1]; assert.equal(norm(out), norm(join(AUDIT, "qualified-checks-v2/build")));
    assert.ok(inventory(out).length > 0); return { typecheck: 0, lint: 0, externalBuild: 0, repositoryDistTouched: false };
  });
  check("LIFECYCLE_RECORD_97_GROUPS_17_CHILDREN_AND_RAW_TRACES", () => {
    assert.equal(lifecycle.status, "PASS"); assert.equal(lifecycle.checks.length, 97); assert.ok(lifecycle.checks.every(item => item.status === "PASS"));
    const children = lifecycle.phases.flatMap(phase => phase.children);
    same([children.length, children.filter(child => child.kind === "RUNTIME_WITH_IPC").length, children.filter(child => child.kind === "IMPORT_WITHOUT_IPC").length], [17, 14, 3]);
    const signals = children.filter(child => child.signalToCloseMs !== null).map(child => child.signalToCloseMs);
    same([Math.min(...signals), Math.max(...signals)], [39.3036, 68.3595]);
    for (const phase of lifecycle.phases) {
      const log = readText(join(AUDIT, phase.name, "process-lifecycle.jsonl")).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
      assert.equal(hash(readFileSync(join(AUDIT, phase.name, "process-lifecycle.jsonl"))), phase.rawLifecycleSha256);
      assert.ok(!log.some(record => record.event === "fixture_remove_error"));
      for (const child of phase.children) {
        const exit = log.find(record => record.event === "child_exit" && record.childPid === child.pid);
        const close = log.find(record => record.event === "child_close" && record.childPid === child.pid);
        assert.ok(exit && close && BigInt(exit.hrNs) <= BigInt(close.hrNs));
        same([close.connected, close.stdoutDestroyed, close.stderrDestroyed], [false, true, true]);
        same([exit.at, close.at], [child.exitAt, child.closeAt]); assert.equal(child.status, "PASS"); assert.equal(child.childErrors.length, 0);
        assert.equal(log.filter(record => record.event === "child_error" && record.childPid === child.pid).length, 0);
        if (child.kind === "RUNTIME_WITH_IPC") assert.ok(log.some(record => record.event === "child_disconnected" && record.childPid === child.pid && BigInt(record.hrNs) <= BigInt(close.hrNs)));
        const own = log.filter(record => record.pid === child.pid), balance = new Map();
        for (const record of own.filter(record => ["sqlite_open_done", "sqlite_close_done"].includes(record.event))) balance.set(norm(record.path), (balance.get(norm(record.path)) ?? 0) + (record.event === "sqlite_open_done" ? 1 : -1));
        if (child.forcedOSDeath) assert.equal(close.signal, "SIGKILL"); else { assert.equal(close.code, 0); assert.ok([...balance.values()].every(value => value === 0)); }
        const probes = own.filter(record => record.event === "workspace_probe_open");
        assert.equal(probes.length, child.workspaceProbes.opened);
        assert.ok(probes.every(probe => own.some(record => record.event === "workspace_probe_closed" && record.path === probe.path && BigInt(record.hrNs) <= BigInt(close.hrNs))));
        if (child.kind === "RUNTIME_WITH_IPC" && !child.forcedOSDeath) assert.ok(own.some(record => record.event === "chdir_done" && norm(record.directory) === norm(REPO) && BigInt(record.hrNs) <= BigInt(close.hrNs)));
      }
      for (const removal of phase.runtimeFixtureRemovals) {
        const record = log.find(item => item.event === "fixture_remove_call" && norm(item.path) === norm(removal.path)); assert.ok(record);
        for (const pid of removal.childPids) assert.ok(log.some(item => item.event === "child_close" && item.childPid === pid && BigInt(item.hrNs) <= BigInt(record.hrNs)));
        const active = new Map();
        for (const item of log.filter(item => ["sqlite_open_done", "sqlite_close_done"].includes(item.event)
          && norm(item.path).startsWith(norm(removal.path) + "/") && BigInt(item.hrNs) <= BigInt(record.hrNs))) {
          const key = `${item.pid}|${norm(item.path)}`, current = active.get(key) ?? { pid: item.pid, count: 0 };
          current.count += item.event === "sqlite_open_done" ? 1 : -1; active.set(key, current);
        }
        const unreleased = [...active.values()].filter(item => item.count > 0 && !log.some(event =>
          ((event.event === "child_close" && event.childPid === item.pid) || (event.event === "process_exit" && event.pid === item.pid))
          && BigInt(event.hrNs) <= BigInt(record.hrNs)));
        assert.equal(unreleased.length, 0);
        assert.ok(log.some(item => item.event === "fixture_remove_done" && norm(item.path) === norm(removal.path) && item.exists === false && BigInt(item.hrNs) >= BigInt(record.hrNs)));
        assert.equal(removal.unreleasedObservedSqliteConnections.length, 0); assert.equal(removal.status, "PASS"); assert.ok(!existsSync(removal.path));
      }
      assert.equal(phase.finalFixtureDirectories.length, 0); assert.equal(phase.network.demonstratedRemoteAttempts, 0);
    }
    assert.equal(lifecycle.phases.reduce((sum, phase) => sum + phase.runtimeFixtureRemovals.length, 0), 10);
    same([lifecycle.osObservation.recordedPidsPresent.length, lifecycle.osObservation.relevantNodeProcesses.length], [0, 0]);
    assert.equal(evidence.lifecycle.exhaustiveOSHandleInventoryClaimed, false);
    return { childLifecyclesRechecked: 17, runtimeFixtureRemovalsRechecked: 10, qualifiedRemnants: 0, retainedOSObservation: lifecycle.osObservation.observedAtUtc };
  });
  check("COPIED_STAGE2_STORE_HASHES_CLOSED_INSPECTION_AND_STOPPED_HISTORY", () => {
    const inspection = lifecycle.realStage2StoreInspection, stored = inspection.stored;
    assert.equal(inspection.sourceSha256, descriptor(inspection.source).sha256); assert.equal(inspection.copiedSha256, descriptor(inspection.readOnlyCopy).sha256);
    assert.equal(inspection.sourceSha256, inspection.copiedSha256); assert.equal(inspection.closeCompleted, true);
    assert.ok(stored.quickCheck.every(row => row.quick_check === "ok")); same([stored.cycles.length, stored.observations, stored.unfinishedCycles], [1, 1, 0]);
    same(stored.runtimes, [{ status: "STOPPED" }]); assert.equal(stored.cycles[0].status, "COMPLETED");
    assert.equal(stored.deliveries.length, 3); assert.ok(stored.deliveries.every(row => row.channel === "console" && row.status === "DELIVERED" && row.attempts === 1 && row.ambiguous === 0));
    assert.ok(stored.actions.every(row => row.type === "NON_FINANCIAL" && row.actionable === 0 && row.financialOptions === 0));
    return { unchangedStoreSha256: inspection.sourceSha256, realStoreOpenedByThisValidator: false, newObservationCycleDelivery: 0 };
  });
  check("ORACLE_AUDIT_62_READ_ONLY_RESPONSES_PINNED_BLOCK_AND_SCOPE", () => {
    const rpc = load("oracle-rpc-audit/summary.json"); assert.equal(rpc.trace.length, 62); assert.equal(rpc.chainId, 1672);
    same([rpc.block.number, rpc.block.hash, rpc.block.timestamp], ["22229239", "0x3623b544e2c84d5e5d7358234a010b446bc74fccafcbac00ed67046381906d4c", "1793925778"]);
    assert.equal(rpc.block.time, new Date(Number(BigInt(rpc.block.timestamp)) * 1000).toISOString());
    assert.equal(descriptor(join(AUDIT, "oracle-rpc-audit/summary.json")).sha256, gaps.pinnedOracleOnlyAudit.summarySha256);
    const permitted = new Set(["eth_chainId", "eth_blockNumber", "eth_getBlockByNumber", "eth_getCode", "eth_call", "eth_getStorageAt"]);
    const stateMethods = new Set(["eth_getCode", "eth_call", "eth_getStorageAt"]), pin = "0x" + BigInt(rpc.block.number).toString(16);
    for (const request of rpc.trace) {
      assert.ok(permitted.has(request.method)); assert.equal(request.httpStatus, 200);
      same(descriptor(join(AUDIT, "oracle-rpc-audit", request.bodyPath)), { bytes: request.responseBytes, sha256: request.responseSha256 });
      if (stateMethods.has(request.method)) assert.equal(request.params.at(-1), pin);
      if (request.method === "eth_call" && request.params[0].to.toLowerCase() === live.target.protocolAddress.toLowerCase()) assert.ok(request.params[0].data.startsWith("0x2c3c9157"));
      assert.ok(Date.parse(request.retrievedAt) >= Date.parse(request.requestedAt));
    }
    const headers = rpc.trace.filter(request => request.label === "audit-block-before" || request.label === "audit-block-after")
      .map(request => load(`oracle-rpc-audit/${request.bodyPath}`).result);
    assert.equal(headers.length, 2); same(headers[0], headers[1]); assert.equal(headers[0].hash, rpc.block.hash);
    same([rpc.mechanicalChecks.economicQuoteVerified, rpc.mechanicalChecks.heartbeatFromSamplingInferred, rpc.mechanicalChecks.onchainFreshnessEnforcement], [false, false, false]);
    return { responseBodiesRehashed: 62, block: rpc.block, newMonitoredPositionObservation: false };
  });
  check("ORACLE_EXACT_RUNTIME_DEPENDENCIES_TOKENS_SCALING_AND_SAMPLE_LIMITS", () => {
    const rpc = load("oracle-rpc-audit/summary.json");
    for (const runtime of rpc.runtimeIdentities) {
      const request = rpc.trace.find(item => item.label === `${runtime.label}-runtime`); assert.ok(request);
      const bytes = Buffer.from(load(`oracle-rpc-audit/${request.bodyPath}`).result.slice(2), "hex");
      same({ bytes: bytes.length, sha256: hash(bytes) }, { bytes: runtime.bytes, sha256: runtime.sha256 });
      if (runtime.label !== "loan") { assert.equal(runtime.matchesReproducedHistoricalRuntime, true); assert.equal(runtime.sha256, runtime.expectedSha256); }
      else same([runtime.expectedSha256, runtime.matchesReproducedHistoricalRuntime], [null, null]);
    }
    assert.equal(rpc.marketParameters.marketId, rpc.marketParameters.recomputedMarketId);
    assert.equal(rpc.composition.BASE_FEED_1, rpc.runtimeIdentities.find(item => item.label === "facade").address);
    assert.equal(rpc.facade.aggregator, rpc.runtimeIdentities.find(item => item.label === "cache").address);
    assert.equal(rpc.cache.getForwarderAddress, rpc.runtimeIdentities.find(item => item.label === "forwarder").address);
    assert.equal(BigInt(rpc.composition.price), BigInt(rpc.facade.round.answer) * 1000000n);
    same([rpc.tokens.collateral.decimals, rpc.tokens.loan.decimals, rpc.facade.decimals], [18, 6, 18]);
    same([rpc.facade.round.startedAt, rpc.facade.round.updatedAt, rpc.cache.timestamp], ["1793924675", "1793924675", "1793924675"]);
    assert.equal(BigInt(rpc.block.timestamp) - BigInt(rpc.cache.timestamp), 1103n);
    same([rpc.sampledKnownDonConfiguration.configId, rpc.sampledKnownDonConfiguration.f, rpc.sampledKnownDonConfiguration.signers.length], ["4294967297", 3, 10]);
    assert.ok(rpc.sampledKnownDonConfiguration.completeness.includes("no claim"));
    assert.ok(report.includes("Code identity is not economic verification")); return { runtimesRehashed: 7, reproducedPricingDependencies: 5, sampledNotComplete: true, quoteEquivalenceVerified: false };
  });
  check("PUBLIC_RESEARCH_FULL_BODIES_OFFICIAL_PRODUCT_AND_UNSUCCESSFUL_COMPARATORS", () => {
    const research = load("public-oracle-research/summary.json"); assert.equal(research.results.length, 10);
    for (const result of research.results) {
      same(descriptor(join(AUDIT, "public-oracle-research", result.bodyPath)), { bytes: result.bytes, sha256: result.responseSha256 });
      assert.ok(Date.parse(result.retrievedAt) >= Date.parse(result.beganAt)); assert.equal(result.method, "GET");
    }
    const official = research.results.find(item => item.name === "pharos-chainlink-push-engine"), body = readText(join(AUDIT, "public-oracle-research", official.bodyPath));
    same([official.status, official.bytes, official.responseSha256], [200, 8722, "5d2c0bab0cb7a190ab7f37e327662427a2709fdb6e4905e74e57ae530e110b42"]);
    assert.ok(body.includes(gaps.publishedFacts.feedRow)); assert.ok(/PriceFeed Heartbeat\s*\|\s*3600 seconds/.test(body));
    assert.ok(body.includes("PriceFeed DeviationThreshold")); assert.equal(gaps.publishedFacts.productQuote, "rUSD");
    assert.equal(research.results.filter(item => item.status === 404).length, 3); assert.equal(research.results.find(item => item.name === "chainlink-avalanche-wsrusd-rusd").status, 429);
    const generic = load("public-oracle-research/dexscreener-exact-address.body.txt"), pharos = load("public-oracle-research/dexscreener-pharos-exact-address.body.txt");
    assert.ok(generic.pairs === null || generic.pairs.length === 0); same(pharos, []);
    assert.ok(report.includes("not proof that no comparator exists anywhere") || report.includes("do not prove that no comparator exists anywhere"));
    return { publicResponseBodiesRehashed: 10, documentedProduct: "WSRUSD/RUSD", documentedHeartbeatSeconds: 3600, eligibleComparatorAdopted: false };
  });
  check("ALL_SEVEN_GATES_EXACT_HISTORICAL_STATES_PROOFS_AND_PREREQUISITES", () => {
    const assurance = load("live-monitor-assurance.json", "STAGE2"); assert.equal(Object.keys(gaps.dimensions).length, 7);
    same(evidence.oracle.dimensions, gaps.dimensions); same(evidence.oracle.historicalEvaluatedResult, gaps.historicalEvaluatedResult);
    for (const [name, dimension] of Object.entries(gaps.dimensions)) {
      assert.equal(dimension.historicalEvaluatedState, assurance.dimensions[name].state);
      same(dimension.historicalSatisfied, assurance.dimensions[name].satisfied); same(dimension.historicalMissing, assurance.dimensions[name].missing);
      assert.ok(report.includes(`### ${name}`));
      for (const prerequisite of dimension.exactPromotionPrerequisites) assert.ok(report.includes(prerequisite));
      for (const proof of dimension.requiredForVerified) assert.ok(report.includes(proof));
      assert.ok(report.includes(dimension.implementationGapOrScope));
    }
    same([assurance.overall, assurance.gate, assurance.freshness.state, assurance.independent.state, assurance.independent.eligible], ["UNVERIFIED", "DATA_UNVERIFIED", "UNKNOWN", "UNKNOWN", false]);
    assert.equal(evidence.oracle.newEvaluatedAssurance, null); assert.equal(gaps.noNewEvaluatedMonitorAssurance, true);
    return { gates: 7, promotedGates: 0, historicalOverall: "UNVERIFIED", freshness: "UNKNOWN", independentEligible: false };
  });
  check("SOURCE_TIMING_DENOMINATION_AND_INDEPENDENCE_WIRING_REMAINS_BLOCKED", () => {
    for (const ref of gaps.sourceReferences) verifyRef({ ...ref, file: ref.path, root: "REPOSITORY" });
    const evaluate = readText(join(REPO, "src/oracle-assurance/evaluate.ts")), model = readText(join(REPO, "src/oracle-assurance/model.ts"));
    assert.ok(/SOURCE_V1[^\n]+\], \[\],/.test(evaluate)); assert.ok(/OPERATOR_V1[^\n]+\], \[\],/.test(evaluate));
    assert.ok(!evaluate.includes("selectedUpstreamId")); assert.ok(!evaluate.includes("verifiedHeartbeat:")); assert.ok(!evaluate.includes("upstreamGuarantee:"));
    assert.ok(model.includes('denomination: z.literal("ECONOMIC_QUOTE_UNVERIFIED")'));
    const independent = readText(join(REPO, "src/oracle-assurance/independent.ts"));
    assert.ok(independent.includes("31_536_000n")); assert.ok(independent.includes("tolerance > 10_000")); assert.ok(independent.includes('result.state = result.disagrees ? "FAILED" : "VERIFIED"'));
    for (const capability of gaps.productionCapabilitiesMissing) assert.ok(report.includes(capability));
    same([evidence.oracle.publishedHeartbeatQualifiedForActiveConfiguration, evidence.oracle.upstreamMaximumAgeGuaranteeQualified,
      evidence.oracle.selectedLoanQuoteEquivalenceVerified], [false, false, false]);
    return { sourceOperatorIngestion: "MISSING", timingBinding: "MISSING", denomination: "ECONOMIC_QUOTE_UNVERIFIED", selectedUpstreamId: null, sourceBytesUnchanged: true };
  });
  check("RECOVERY_SIX_BLOCKERS_FIRST_OBSERVATION_AND_NO_FINANCIAL_PROMOTION", () => {
    same(gaps.recoveryBlockedReasonsRetained, live.risk.recoveryEligibility.reasonCodes);
    same(evidence.oracle.recoveryBlockers, gaps.recoveryBlockedReasonsRetained); assert.equal(gaps.recoveryBlockedReasonsRetained.length, 6);
    for (const item of [...gaps.recoveryBlockedReasonsRetained, ...gaps.recoveryPromotionPrerequisites]) assert.ok(report.includes(item));
    same([live.risk.recoveryEligibility.status, live.risk.progression.state, live.risk.progression.reason, live.risk.repayment, live.risk.additionalCollateral], ["BLOCKED", "UNKNOWN", "FIRST_OBSERVATION", null, null]);
    assert.ok(report.includes("missing qualified timing-configuration binding")); assert.ok(report.includes("not demonstrated chain/borrower/market identity drift"));
    return { recoveryBlockers: 6, financialAmountsProduced: 0, newAdvancingProgressionClaimed: false };
  });
  check("ALL_LOCAL_REPORT_LINKS_AND_HASH_TABLE_ROWS", () => {
    const links = [...report.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)], local = [];
    for (const [, , url] of links) {
      if (/^https?:\/\//.test(url)) continue;
      const path = url.startsWith("file:") ? fileURLToPath(url) : resolve(AUDIT, decodeURIComponent(url));
      assert.ok(Object.values(ROOTS).some(root => norm(path).startsWith(norm(root) + "/"))); assert.ok(existsSync(path), `Missing local report link: ${url}`); local.push(path);
    }
    for (const anchor of evidence.anchors) {
      verifyRef(anchor); assert.ok(report.includes(`| ${anchor.bytes} | \`${anchor.sha256}\` |`)); assert.ok(report.includes(`[${anchor.label}]`));
    }
    assert.ok(report.includes("outside the two manifest roots")); assert.ok(report.includes("no retrospective self-reference"));
    return { markdownReferences: links.length, localReferencesChecked: local.length, embeddedByteHashRows: evidence.anchors.length, websitesContacted: 0 };
  });
  check("DOCUMENTARY_TOOL_SYNTAX_AND_FROZEN_SOURCE_CAPSULES", syntaxChecks);
  check("EXHAUSTIVE_REPOSITORY_AND_GIT_PRESERVATION", preservedRepository);
  check("EVERY_PREEXISTING_REPAIR_AND_STAGE2_ARTIFACT_UNCHANGED", preservedArtifacts);
  check("ORIGINAL_STAGE2_MANIFEST_AND_REPORT_REHASHED_UNCHANGED", originalManifest);
  check("FINAL_DECISION_AND_FINITE_STOP_SAFETY", () => {
    same(evidence.decision, { originalRequirements: "PASS_EXACT_FINITE_LOCAL_STAGE2_RUN_ONLY", software: "PASS", production: "NOT_ACCEPTED_NO_GO",
      oracleOverall: "UNVERIFIED", freshness: "UNKNOWN", independentValidation: "UNKNOWN_INELIGIBLE", financialRecovery: "BLOCKED", monitor: "STOPPED" });
    for (const key of ["finalizationNetworkRequests", "finalizationApplicationImports", "finalizationDatabaseOpens", "finalizationTestsRun"]) assert.equal(evidence.safety[key], 0);
    assert.equal(evidence.safety.furtherAuthorizationGranted, false); assert.equal(evidence.safety.stopAfterDelivery, true);
    assert.ok(report.includes("Production: NOT ACCEPTED / NO-GO")); assert.ok(report.includes("The real monitor remains STOPPED"));
    assert.ok(report.includes("Stop after delivery")); return evidence.decision;
  });
}
function manifestChecks() {
  check("MANIFEST_COMPLETE_TWO_ROOT_FILE_BYTES_AND_EXCLUSIONS", manifestContents);
  check("REPORT_AND_MANIFEST_PREREQUISITE_VALIDATIONS_PASS", () => {
    const validation = load(F.validation); assert.equal(validation.status, "PASS"); assert.ok(validation.checks.every(item => item.status === "PASS"));
    verifyRef(validation.report); verifyRef(validation.evidence); return { reportCheckGroups: validation.checks.length };
  });
  check("EVERY_PREEXISTING_REPAIR_AND_STAGE2_ARTIFACT_STILL_UNCHANGED", preservedArtifacts);
  check("ORIGINAL_STAGE2_MANIFEST_STILL_UNCHANGED", originalManifest);
  check("REPOSITORY_AND_GIT_STILL_HAVE_ONLY_ALLOWLISTED_TEST_DELTA", preservedRepository);
  check("DOCUMENTARY_TOOL_SOURCE_CAPSULES_STILL_MATCH", syntaxChecks);
  check("MANIFEST_DECISION_AND_MIXED_EVIDENCE_SCOPE", () => {
    const manifest = load(F.manifest); same([manifest.monitor, manifest.software, manifest.production], ["STOPPED", "PASS", "NOT_ACCEPTED_NO_GO"]);
    assert.ok(manifest.evidenceClass.includes("NOT_ALL_LIVE_PROOF")); return { independentCustodyClaimed: false, newOperationalWork: false };
  });
}
function sealChecks() {
  const seal = load(F.seal), completion = load(F.completion), evidence = load(F.evidence), manifest = load(F.manifest);
  check("SEALED_CORE_AND_COMPLETION_BYTE_REFERENCES", () => {
    const required = [F.report, F.evidence, F.validation, F.preservation, F.baseline, F.manifest, F.manifestHash, F.manifestVerification, F.completion];
    same(seal.artifacts.map(ref => ref.file), required); same(completion.artifacts.map(ref => ref.file), required.slice(0, -1));
    for (const ref of [...seal.artifacts, ...completion.artifacts]) verifyRef(ref);
    assert.equal(load(F.validation).status, "PASS"); assert.equal(load(F.manifestVerification).status, "PASS");
    verifyRef(load(F.manifestVerification).manifest);
    return { sealedArtifactsRehashed: required.length, completionArtifactsRehashed: required.length - 1 };
  });
  check("SEAL_AND_MANIFEST_SIDECARS_NO_SELF_HASH_CLAIM", () => {
    assert.equal(readText(join(AUDIT, F.sealHash)), `${descriptor(join(AUDIT, F.seal)).sha256}  ${F.seal}\n`);
    assert.equal(readText(join(AUDIT, F.manifestHash)), `${descriptor(join(AUDIT, F.manifest)).sha256}  ${F.manifest}\n`);
    same(seal.explicitlyExcludedManifestFiles, EXCLUDED); same(completion.finalEnvelopeExclusions, EXCLUDED);
    assert.equal(seal.selfReference.noSelfHashClaim, true); assert.ok(!seal.artifacts.some(ref => ref.file === F.seal || ref.file === F.sealHash));
    for (const file of EXCLUDED.slice(0, 4)) assert.ok(seal.artifacts.some(ref => ref.file === file));
    return { manifestEnvelopeExclusions: 6, firstFourCoveredBySeal: true, sealCoveredBySeparateSidecar: true };
  });
  check("ALL_MANIFESTED_BYTES_REHASHED_AFTER_COMPLETION_AND_SEAL", manifestContents);
  check("FINAL_SOFTWARE_ACCOUNTING_AND_SCOPED_REQUIREMENTS_MATCH_REPORT", () => {
    same(completion.originalRequirements, evidence.originalRequirements.map(({ requirement, verdict, scope }) => ({ requirement, verdict, scope })));
    same([completion.software.independentSelectedPassed, completion.software.independentUnselected, completion.software.runtimeProcessPassed,
      completion.software.focusedPassed, completion.software.fullPassed, completion.software.fullTotal, completion.software.fullFiles,
      completion.software.fullFailedPendingSkippedTodo, completion.software.typecheckExitCode, completion.software.lintExitCode, completion.software.externalBuildExitCode],
      [1, 3, 4, 31, 1007, 1007, 49, 0, 0, 0, 0]);
    same([completion.documentary.manifestFileCount, seal.manifestFileCount, completion.documentary.manifestBytes, seal.manifestBytes],
      [manifest.fileCount, manifest.fileCount, manifest.totalBytes, manifest.totalBytes]);
    return { fullTests: "1007/1007", originalRequirements: "4_PASS_FINITE_LOCAL_ONLY", production: "NOT_ACCEPTED_NO_GO" };
  });
  check("REPORT_REFERENCE_GRAPH_STILL_VALID_AFTER_SEALING", () => { verifyRef(evidence.report); return { referencesRehashed: verifyReferences(evidence) }; });
  check("ALL_PREEXISTING_REPAIR_AND_STAGE2_BYTES_STILL_PRESERVED", preservedArtifacts);
  check("ORIGINAL_STAGE2_MANIFEST_AND_REPORT_STILL_PRESERVED", originalManifest);
  check("ENTIRE_REPOSITORY_AND_GIT_STILL_PRESERVED_EXCEPT_AUTHORIZED_TEST", preservedRepository);
  check("ALL_FINAL_DOCUMENTARY_TOOL_BYTES_MATCH_SYNTAX_CAPSULES", syntaxChecks);
  check("POST_SEAL_RECEIPT_IS_EXPLICITLY_DETACHED_AND_SAFETY_UNCHANGED", () => {
    same(seal.decision, evidence.decision); same(completion.decision, evidence.decision); same(completion.safety, evidence.safety);
    assert.equal(completion.furtherAuthorizationGranted, false); assert.equal(seal.noFurtherAuthorization, true); assert.equal(seal.monitor, "STOPPED");
    assert.equal(completion.detachedReadOnlyVerificationReceipt.outsideManifestRootsAndSealCoverage, true);
    assert.ok(!Object.values(ROOTS).some(root => norm(completion.detachedReadOnlyVerificationReceipt.expectedPath).startsWith(norm(root) + "/")));
    assert.equal(completion.detachedReadOnlyVerificationReceipt.noSelfHashClaim, true);
    return { receiptOutsideSealedRoots: true, noNewMonitorCycleOrProductionOperation: true, monitor: "STOPPED" };
  });
}

try {
  assert.ok(["report", "manifest", "seal"].includes(mode), "Use report, manifest or seal");
  if (mode === "report") reportChecks(); else if (mode === "manifest") manifestChecks(); else sealChecks();
} catch (error) { checks.push({ name: "VALIDATOR_INPUT_OR_EXECUTION_FAILURE", status: "FAIL", error: { name: error.name, message: error.message, stack: error.stack } }); }
const pass = checks.length > 0 && checks.every(item => item.status === "PASS");
const result = { schemaVersion: 1, status: pass ? "PASS" : "FAIL", operation: mode, evidenceClass: "SEPARATE_OFFLINE_DOCUMENTARY_REHASH_NOT_A_NEW_TEST_OR_MONITOR_CYCLE",
  startedAt, completedAt: new Date().toISOString(), checkGroupsPassed: checks.filter(item => item.status === "PASS").length,
  checkGroupsFailed: checks.filter(item => item.status === "FAIL").length, checks,
  validator: reference("validate-final-qualification.mjs"),
  ...(existsSync(join(AUDIT, F.report)) ? { report: reference(F.report) } : {}),
  ...(existsSync(join(AUDIT, F.evidence)) ? { evidence: reference(F.evidence) } : {}),
  ...(mode === "manifest" || mode === "seal" ? { manifest: reference(F.manifest) } : {}),
  ...(mode === "seal" ? { seal: reference(F.seal), checksumSidecar: reference(F.sealHash) } : {}),
  safety: { applicationImports: 0, databaseOpens: 0, networkRequests: 0, subprocesses: 0, testsRun: 0, newRealMonitorCycles: 0,
    repositoryWrites: 0, modeIsReadOnly: mode === "seal", existingArtifactOverwrites: 0, production: "NOT_ACCEPTED_NO_GO", monitor: "STOPPED" },
  trustLimit: "Separate validation implementation on the same local host; captured-byte integrity, not independent custody or notarization." };
if (mode !== "seal") {
  const file = pass ? (mode === "report" ? F.validation : F.manifestVerification) : `documentary-${mode}-validation-failure-${Date.now()}.json`;
  writeFileSync(join(AUDIT, file), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: result.status, operation: mode, checkGroupsPassed: result.checkGroupsPassed, checkGroupsFailed: result.checkGroupsFailed,
    output: reference(file), failures: checks.filter(item => item.status === "FAIL"), noTestsOrMonitorInvoked: true }, null, 2));
} else console.log(JSON.stringify(result, null, 2));
if (!pass) process.exitCode = 1;
