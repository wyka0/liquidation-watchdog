// Render the final report from verified local artifacts only. Never imports a chain reader or runtime.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const audit = dirname(fileURLToPath(import.meta.url));
const bytes = file => readFileSync(join(audit, file));
const json = file => JSON.parse(bytes(file).toString("utf8"));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const live = json("live-stage2-evidence.json"), snapshot = json("live-monitor-snapshot.json"), assurance = json("live-monitor-assurance.json");
const supplemental = json("live-monitor-supplemental.json"), restart = json("restart-verification.json"), preflight = json("preflight.json");
const offline = json("offline-verification-results-v2.json"), preservation = json("preservation-report.json"), accounting = json("test-accounting.json");
const fullTests = json("offline-test-results.json"), targeted = json("targeted-runtime-test-results.json"), baseline = json("baseline.json");
const cycle = json("live-monitor-cycle-result.json"), persisted = json("persisted-before-restart.json"), logs = json("cycle-logs.json");
assert.equal(live.status, "PASS_FINITE_LIVE_MONITOR_AND_CONSOLE_DELIVERY_ORACLE_UNVERIFIED");
assert.equal(offline.status, "PASS"); assert.equal(restart.status, "PASS"); assert.equal(preservation.status, "PASS");
assert.equal(accounting.currentAllGreenFullSuiteQualified, false); assert.equal(fullTests.unit.failed, 1);
assert.equal(sha256(bytes("live-stage2-evidence.json")), "f94ec2761c77d2ddb219c8215dd3b6ac0ee9836ced59798c36740fe19f6b2124");
const completed = logs.find(record => record.event === "cycle_completed");
const started = logs.find(record => record.event === "cycle_started");
const shutdown = logs.find(record => record.event === "shutdown");
const rendered = bytes("console-alerts.txt").toString("utf8");
const cell = value => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const table = (headers, rows) => ["| " + headers.join(" | ") + " |", "| " + headers.map(() => "---").join(" | ") + " |",
  ...rows.map(row => "| " + row.map(cell).join(" | ") + " |")].join("\n");
const record = file => `[${file}](${file})`;
const code = value => "`" + value + "`";
const repository = (file, text = file) => `[${text}](file:///C:/liquidation-watchdog/${file})`;
const actionRows = live.alerts.map(alert => [code(alert.code), code(alert.suggestedAction.type), code(alert.suggestedAction.rationale), alert.suggestedAction.instruction]);
const dimensions = Object.entries(assurance.dimensions).map(([name, dimension]) => [code(name), code(dimension.state),
  dimension.satisfied.length ? dimension.satisfied.map(code).join(", ") : "None", dimension.missing.length ? dimension.missing.map(code).join(", ") : "None"]);
const deliveryRows = live.alerts.map(alert => {
  const event = logs.find(item => item.event === "notification_delivery" && item.alertId === alert.id);
  const delivery = persisted.deliveries.find(item => item.alert_id === alert.id);
  assert.ok(event); assert.ok(delivery); assert.equal(delivery.attempts, 1); assert.equal(delivery.status, "DELIVERED");
  return [code(alert.code), code(alert.severity), code(alert.timestamp), code(event.timestamp), "DELIVERED / 1 / 0"];
});
const thresholds = Object.entries(live.thresholdResult.comparisons).map(([name, value]) => [code(name), code(live.thresholds[name]),
  code(value.debtTimesThreshold), value.atOrBelow ? "YES" : "NO"]);
const updateRows = supplemental.samples.map(sample => [code(sample.transactionHash), code(sample.block.number),
  code(new Date(Number(sample.publicationTimestamp) * 1_000).toISOString()), code(sample.reports[0].observationsTimestamp),
  code(sample.reports[0].answer), sample.signatureCount]);
const currentControllers = [
  ["Feed facade owner", code(assurance.configuration.proxyOwner), "May change cache/feed ID and transfer ownership"],
  ["Cache owner", code(assurance.configuration.cacheOwner), "Controls forwarder, workflow-ID allowlist and optional workflow-owner check"],
  ["Forwarder owner", code(assurance.configuration.forwarderOwner), "Controls signer configurations and separately authorized route forwarders"],
  ["Additional workflow-owner check", code(assurance.configuration.allowedWorkflowOwner), "Zero disables only this additional comparison, not the forwarder or workflow-ID checks"]
];
const evidenceFiles = ["live-stage2-evidence.json", ...live.artifacts.map(artifact => artifact.file), "preflight.json", "resolved-runtime-configuration.json",
  "restart-verification.json", "offline-verification-results-v2.json", "offline-verification-results.json", "offline-test-results.json", "unit-tests.json",
  "targeted-runtime-test-results.json", "runtime-rerun-tests.json", "test-accounting.json", "preservation-report.json", "baseline.json"];
const evidenceRows = evidenceFiles.map(file => [record(file), bytes(file).length, code(sha256(bytes(file)))]);
const commands = fullTests.checks.map(command => "- **" + command.name + "** (exit " + command.exitCode + "): " + code(command.command.join(" "))).join("\n");
const targetCommand = code(targeted.command.command.join(" "));
const failed = accounting.originalFullSuite.failures[0];
const report = `# Live Stage 2 — single-position end-to-end monitoring

## Outcome and acceptance scope

**The authorized finite live workflow passed: one fresh pinned observation, three timestamped local-console deliveries, persisted evidence, and a clean new-process outbox restart with no resend. Monitoring is stopped.**

**Important qualification exceptions:** the fresh full unit suite was **FAIL — 1006/1007 passed**, with one process-fixture timeout/cleanup failure. The isolated follow-up was **${targeted.status} — ${targeted.unit.passed}/${targeted.unit.total} passed** and does not erase or replace the failed full run. Economic oracle assurance remains **UNVERIFIED**, freshness **UNKNOWN**, and financial recovery **BLOCKED**. This is **not production acceptance, verified live protection, or transaction advice**.

Report generated: **${new Date().toISOString()}**. All observation and delivery times below are UTC. The snapshot was fresh for this one authorized execution; after shutdown it is retained historical evidence, not a claim about the position at report-reading time.

The four original requirements are taken from ${repository("docs/PHASE-11-PRODUCT-ACCEPTANCE-AUDIT.md", "the Phase 11 product acceptance audit")}. These verdicts are limited to this exact finite local run:

${table(["Original requirement", "Finite-run verdict", "Evidence and limitation"], [
  ["Read collateral, debt and health factor (or equivalent) from chain", "**PASS**", "Fresh pinned collateral/borrow shares/market/IRM inputs were cross-checked; accrued debt and the Morpho health-factor equivalent were independently recomputed. Economic accuracy of the oracle and liquidation eligibility remain UNVERIFIED."],
  ["Support configurable warning and critical thresholds, with default examples 1.3 and 1.1", "**PASS**", "Existing supported position configuration loaded warning 1.30 and critical 1.10 into the real reader/risk/transition scope. Exact integer cross-products classify CRITICAL. No global defaults were changed or long-running runtime activated."],
  ["Send timestamped alerts through at least one supported channel", "**PASS**", "All three actual alerts from that cycle were delivered by the existing local console adapter and persisted as DELIVERED with one attempt each. Telegram/Discord, external exactly-once delivery and deployed notifications are UNVERIFIED/not exercised."],
  ["Include a concrete suggested action in each alert", "**PASS**", "Each actual alert contains exactly one required typed NON_FINANCIAL instruction with a distinct rationale and snapshot-bound evidence. All retain actionable:false, NOT_QUALIFIED evidence and an empty financialOptions array."]
])}

The suggested-action requirement is a messaging requirement, not permission to transact. Phase 11 itself describes safety-qualified human review/refresh instructions as an appropriate way to satisfy it. No financial amount or executable transaction instruction is needed while the strict gates are blocked. The historical audit is not rewritten or retroactively treated as a pass; the production decision remains **NOT ACCEPTED / NO-GO**.

## 1. Exact identity, configuration and one-cycle boundary

${table(["Field", "Verified value"], [
  ["Chain", "Pharos Pacific Mainnet / " + code(live.target.chainId)],
  ["Account", code(live.target.account)],
  ["Account role", code(live.accountRole) + " — a public third-party borrower, not the user's wallet"],
  ["Morpho deployment", code(live.target.protocolAddress)],
  ["Market", code(live.target.marketId)],
  ["Oracle", code(live.target.oracleAddress)],
  ["IRM", code(live.target.irmAddress)],
  ["Canonical position ID", code(live.target.positionId)],
  ["Configured monitor-v2 scope", code(live.scope)],
  ["Runtime configuration fingerprint", code(live.configurationFingerprint)],
  ["Position configuration SHA-256", code(live.configurationHashes["position.json"])],
  ["Monitoring configuration SHA-256", code(live.configurationHashes["monitoring.json"])]
])}

- ${record("position.json")} selects this one enabled CONFIGURED position and owns its thresholds; ${record("monitoring.json")} points only to the isolated local SQLite store, uses the local profile, keeps **monitoring.enabled=false**, and disables both external channels. Startup validation passed without a startup network call or printed credentials.
- ${record("live-monitor.mts")} invoked the unchanged **MonitoringService.runOnce() exactly once**. Its capture hooks called the real supported **readMonitoredPosition()** and bounded **inspectSupplemental()** paths; separately written direct getters and integer arithmetic audited their result. No fixtures, allowFixture permission, replacement snapshot, altered risk pipeline or weakened safety gate was supplied.
- Historical discovery established identity and decoded Borrow.onBehalf provenance only. The new block is **${offline.checks.find(check => check.name === "IDENTITY_CONFIGURATION_AND_REVIEWED_SOURCE_HASHES").detail.newBlockDelta} blocks later** than discovery block ${code(preflight.historicalEvidence.previousBlock.number)} and has a distinct later header. Discovery data was not reused as current input or seeded as a monitored progression baseline.
- Exclusive one-cycle marker: ${record("one-live-cycle-authorized.json")}. The temporary live driver refuses an existing store/marker, preventing an accidental repeat in this evidence directory. It is evidence tooling, not authorization for any further live invocation.
- Runtime logs contain one cycle_started, one cycle_observed, one cycle_completed and one shutdown. The guard recorded **${live.execution.networkRequests} requests**, only to the reviewed RPC/MCP endpoints and allowlisted read methods; there were **zero rejected live requests**. Getters/receipts/calldata inspection are read-only; no signing, broadcast, state-changing simulation or position operation occurred.

## 2. Fresh pinned chain observation

${table(["Provenance", "Value"], [
  ["Block", code(live.block.number)], ["Block hash", code(live.block.hash)], ["Parent hash", code(live.block.parentHash)],
  ["Block timestamp", code(live.block.timestamp) + " / " + code(live.block.timestampUtc)],
  ["Observed RPC/MCP heads", code(live.heads.rpc) + " / " + code(live.heads.mcp)],
  ["Selection", "min(heads) − " + code(live.heads.selectionLagBlocks) + " blocks; both chain IDs " + code(live.target.chainId)],
  ["Snapshot read completion", code(snapshot.retrievedAt)],
  ["Observation / alert creation", code(live.observedAt)],
  ["Cycle ID", code(cycle.observation.cycleId)],
  ["Cycle start / completion", code(started.timestamp) + " / " + code(completed.timestamp)],
  ["Cycle duration", code(completed.durationMs) + " ms, including capture/getter/audit verification — not a cadence/SLA qualification"],
  ["Shutdown", code(shutdown.timestamp)],
  ["Canonical typed snapshot ID", code(live.snapshotIdentifier)]
])}

### Position and derived risk

${table(["Quantity", "Raw / precision", "Display or conclusion"], [
  ["Collateral", code(live.position.collateral) + "; 18 decimals", "**18,706,585.513096 wsrUSD**"],
  ["Collateral token", code(live.tokens.collateral.address), "Wrapped Savings rUSD / wsrUSD; chain-bound issuer evidence retained"],
  ["Borrow shares", code(live.position.borrowShares), "Nonzero borrower; not an amount in USDC"],
  ["Supply shares", code(live.position.supplyShares), "Zero; not substituted for collateral"],
  ["Accrued borrower debt", code(live.accounting.debt) + "; 6 decimals", "**18,001,980.562580 USDC**"],
  ["Loan token", code(live.tokens.loan.address), "USDC / 6 decimals; symbol alone is not economic-price verification"],
  ["LLTV", code(snapshot.params.lltv) + " WAD", "0.915"],
  ["Health-factor equivalent", code(live.healthFactorWad) + " / 10^18", "**1.052543254080507595**"],
  ["Mathematical classification", code(live.risk.mathematical), "At/below critical 1.10, above mathematical boundary 1.00"],
  ["Effective state", code(live.risk.effective), "Oracle assurance remains unverified"],
  ["Actionability", code(live.risk.actionability) + "; actionable:false", "Indicative only; no repayment or collateral-addition recommendation"],
  ["Accepted observation", code(cycle.observation.accepted), "Acceptance of validated indicative inputs, not an oracle trust or liquidation-eligibility claim"]
])}

Collateral and borrow shares are direct contract values. Debt is derived by accruing market borrow assets to the pinned timestamp and converting the position's shares with debt rounded up, including Morpho's virtual assets/shares. Collateral value and LLTV capacity round down. The health-factor equivalent is floor(capacity × 10^18 / debt), **not a direct on-chain health-factor getter**.

Accounting inputs: elapsed **${live.accounting.elapsedSeconds} seconds**, IRM rate **${live.accounting.ratePerSecondWad} WAD/second**, market interest **${live.accounting.interest} raw loan units**, and accrued market borrow assets **${live.accounting.accruedBorrowAssets}**. The position's debt is not the total market debt.

### Active configurable thresholds and exact comparison

Warning **1.30**, critical **1.10**, target **1.25**, immutable mathematical boundary **1.00**. The target is configuration, not a financial recovery estimate. No displayed-ratio rounding was used for threshold decisions.

Capacity × WAD numerator: ${code(live.thresholdResult.numerator)}. Debt: ${code(live.thresholdResult.debt)}.

${table(["Threshold", "Loaded decimal", "Debt × threshold WAD", "Numerator at/below?"], thresholds)}

Result: **CRITICAL**, not LIQUIDATION_BOUNDARY. Being above 1.00 does not establish economic oracle accuracy, executable safety or liquidation eligibility.

### Cross-checks

- **58/58** production RPC/MCP comparisons matched, six batch sentinels checked, ten contract-code observations compared, stable before/after pinned headers, and zero mixed-block entries in the production position trace.
- **10/10** separately issued pinned direct-getter comparisons: market identity, market totals, borrower position, both decimals, both symbols, IRM view rate, oracle price, and feed answer/timestamp. Market ID was independently re-derived from the five market parameters.
- **17/17** separately written BigInt accounting/valuation fields matched the production snapshot. No production accounting/math helper was used for that independent arithmetic.
- Offline re-decoding and complete pure observation/assurance/risk/transition reproduction matched the captured cycle and persisted state. These are **offline calculations from captured bytes**, not another live observation or delivery.
- **RPC/MCP share an upstream**: this is separate-access-path consistency, not independent economic verification or independent consensus.

## 3. All actual console alerts and exactly one typed action each

The first accepted observation legitimately generated INITIAL_RISK, DATA_QUALITY_CHANGED and ORACLE_QUALITY_CHANGED. No safety notice was suppressed to force a single alert. WARNING is the notice severity of the latter two; their position mathematics remains CRITICAL.

${table(["Alert code", "Severity", "Created UTC", "Actual delivery completion UTC", "Status / attempts / ambiguous"], deliveryRows)}

${table(["Alert code", "Type", "Rationale", "Concrete instruction"], actionRows)}

Every action has schemaVersion=1, origin=GENERATED, evidence.status=NOT_QUALIFIED, actionable=false, and financialOptions=[]. Its evidence binds cycle ID, chain/account/market, block/hash/time and snapshot identifier; it retains UNKNOWN/FIRST_OBSERVATION progression, UNVERIFIED oracle assurance, UNKNOWN freshness/independence and the full blocked recovery reasons. This is one typed action object per alert, not an array of conflicting actions.

### Full console messages — exact actual transcript bytes

The following fenced text is copied directly from ${record("console-alerts.txt")}, without rewording or ellipses. It is **${Buffer.byteLength(rendered)} bytes**, SHA-256 ${code(sha256(rendered))}. Re-rendering all three stored typed alerts reproduced these exact bytes offline; no adapter was called during that check. The stock recovery-disclaimer footer does not mean any recovery amount was produced; there are zero financial option lines.

\`\`\`text
${rendered}\`\`\`

## 4. Persistence and strictly offline new-process restart

The isolated store is ${code(join(audit, "watchdog.sqlite"))}. SQLite schema **5**, runtime SQLite **3.51.2**, Node **v24.14.1**. The existing local schema initializer applies only to this new disposable SQLite store; **no repository/production database, PostgreSQL/Neon schema, grant or migration was touched**.

${table(["Persisted item / restart assertion", "Result"], [
  ["Streams / cycles / accepted observations", "1 / 1 / 1; configured scope and canonical account identity retained"],
  ["Alerts / permanent fingerprints / assurance rows", "3 / 3 / 1"],
  ["Console delivery rows / attempts", "3 DELIVERED rows / 3 attempts; each attempts=1 and ambiguous=0"],
  ["Delivery events / operational events", "9 / 0"],
  ["Pending deliveries", "0"],
  ["Persisted runtime", "STOPPED"],
  ["New-process recovered in-flight deliveries", String(restart.recoveredInFlight)],
  ["New-process drain attempts / console resends", String(restart.outboxDrainAttempts) + " / " + String(restart.knownDeliveredResends)],
  ["New live cycles / observations / fetch attempts during restart", "0 / 0 / 0"],
  ["Logical table/state/delivered hashes", "Unchanged; all rows revalidated"],
  ["Known-delivered hash", code(restart.knownDeliveredHash)],
  ["Public status and alerts commands", "Both exit 0; output is persisted history, not new reads or notification resends"]
])}

${record("restart-check.mts")} reopened the actual store in another process, acquired its local monitor lock, invoked the existing delivery recovery/drain code, and confirmed zero work to replay. It **did not call MonitoringService.runOnce(), monitor --once, or a chain reader**. ${record("restart-console.txt")} is empty. Public history outputs are ${record("restart-cli-status.txt")} and ${record("restart-cli-alerts.txt")}.

**Limitation:** this proves a clean new-process store/outbox restart after completed delivery. It does not prove a second live worker cycle, sustained progression/cadence, or crash-in-flight delivery to a real external provider. The separate process unit fixtures do not turn those unexecuted live scenarios into live evidence. Provider exactly-once delivery is not claimed; terminal ambiguous-delivery protections were not weakened or bypassed.

## 5. Oracle evidence, current controls and unresolved gaps

### Pinned pricing path and measured timestamp

${table(["Oracle field", "Pinned value / conclusion"], [
  ["Feed facade", code(assurance.configuration.feed)], ["Cache", code(assurance.configuration.cache)],
  ["Forwarder", code(assurance.configuration.forwarder)], ["Feed ID", code(assurance.configuration.feedId)],
  ["Feed answer", code(snapshot.oracle.round.answer)], ["Morpho oracle price", code(snapshot.oracle.price)],
  ["Mechanical composition", "Feed answer × 1,000,000; feed/collateral 18 decimals, loan 6 decimals, Morpho scale 10^36"],
  ["Workflow-supplied observation timestamp", code(snapshot.oracle.round.updatedAt) + " / " + code(live.oracle.observationTimestampUtc)],
  ["Age at pinned block", code(assurance.freshness.observationAgeSeconds) + " seconds — measurement only, not verified freshness"],
  ["Round ID / answeredInRound", "0 / 0; this facade does not supply OCR consensus rounds"],
  ["Timestamp anomalies", "None observed in the bounded evidence"],
  ["Freshness / heartbeat / upstream guarantee", "UNKNOWN / null / null"],
  ["Local maximum-age rejection policy", "Not configured; policyOrigin=NONE; no implicit staleness cutoff"],
  ["Timing configuration fingerprint", "null — no qualified timing evidence bound to this configuration"],
  ["Independent comparator / selected upstream ID", "NOT_CONFIGURED / null; eligible=false; no price substitution"],
  ["Overall assurance / gate", code(assurance.overall) + " / " + code(assurance.gate)]
])}

${table(["Assurance dimension", "State", "Satisfied", "Still missing"], dimensions)}

CONTRACT_IDENTITY=VERIFIED is a code/runtime identity claim for the pricing path, **not** verification of the economic feed product, its price or its operators. Historical reviewed source/compiler/issuer bytes were rehashed locally and bound to the new runtime observations; no new compiler download, external research or solc execution occurred.

### Controllers actually observed at this Stage 2 block

${table(["Control", "Pinned address", "Reviewed permission boundary"], currentControllers)}

These values come from the fresh assurance configuration, not substituted historical documentation. They are addresses, not identified real-world organizations. EIP-1967 implementation/admin/beacon slots were all zero. That fact alone is insufficient to identify architecture; the reproduced source/runtime establishes this facade's owner-controlled cache/feed selection. A stable oracle address is not a guarantee of stable downstream data or configuration.

### Bounded oracle update audit

The **${supplemental.trace.length}-request** supplemental audit completed over **${supplemental.historyFrom}–${supplemental.historyTo}**, exactly 8,000 blocks, using eight 1,000-block configuration queries and eight separate answer-history queries. It observed **zero configuration events** and **two matched update samples**. This is not deployment-to-present history or complete enumeration of mappings/authorized entries.

${table(["Update transaction", "Block", "Publication UTC", "Observation timestamp", "Answer", "Distinct recovered signatures"], updateRows)}

- Sampled workflow ID: ${code(supplemental.samples[0].workflowId)}; reported workflow owner: ${code(supplemental.samples[0].workflowOwner)}. The workflow-ID allowance was read at each sampled transaction block and at the audit block. These identifiers do not identify a published workflow program or its economic inputs.
- Current sampled signer configuration: config ID ${code(supplemental.signerSets[0].configId)}, **f=3**, **10 signers**, signerCoverage=SAMPLED_ACTIVE_CONFIGS. Historical signature recovery and current signer membership remain separate observations. Four valid recovered signatures are not proof of four independent organizations or economic correctness.
- The two observation timestamps differ by **3,601 seconds**. That is a sample interval, **not a verified hourly heartbeat or a maximum-age guarantee**.
- Local offline verification re-decoded both captured report transactions, matched their successful receipts/feed events, recovered all four signatures per sample, and reconstructed the sampled current signer storage. No additional chain request was made.

### Source-backed behavior and open economic questions

1. ${repository("evidence/phase1/sources/SelfManagedFeedsCache.sol")} onReport validates the configured forwarder and workflow metadata, stores workflow-supplied observation timestamps, and skips non-increasing timestamps. **validFromTimestamp is not used to enforce validity or age expiry**, and stored answers have no age expiry.
2. ${repository("evidence/phase1/sources/SelfManagedFeedsCacheProxy.sol")} latestRoundData returns zero round IDs and returns the report's observation timestamp for both startedAt and updatedAt. A recent-looking facade timestamp is not upstream freshness verification.
3. ${repository("evidence/phase1/sources/verified-ChainlinkDataFeedLib.sol")} obtains the answer but does **not enforce staleness**. Mechanical compatibility with a Chainlink-style interface does not establish a standard economic Chainlink feed product or its operational promises.
4. ${repository("evidence/phase1/sources/KeystoneForwarder.sol")} report checks configured DON/version and f+1 distinct configured signatures. Its **route entrypoint is a separate owner-authorized forwarding path without that signature-validation step**. The bounded audit does not fully enumerate every route authorization.
5. Still unresolved: **exact feed-ID/product mapping, workflow source code, source/aggregation inputs, economic base/quote and denomination, real-world source/signer/controller operators, verified heartbeat, upstream maximum-age guarantee, upstream identity/independence and a qualified independent comparator**. An issuer redemption rate, same symbol/address on another chain, numerical agreement or a presumed USDC peg is not a replacement for those proofs.

Reviewed context remains ${repository("docs/oracle-architecture.md")}, ${repository("docs/oracle-freshness.md")} and ${repository("docs/oracle-independent-validation.md")}. Their historical samples are context only; the fresh values in this report are derived from Stage 2 artifacts. The earlier mixed-block preliminary discovery diagnostic is not reused as evidence of oracle staleness.

### Strict blocked recovery and first-observation progression

The effective result is DATA_UNVERIFIED, recoveryEligibility.status=BLOCKED, eligible=false, repayment=null and additionalCollateral=null. All actionable fields remain unconditionally false. Exact reasons:

${live.risk.recoveryEligibility.reasonCodes.map(reason => "- " + code(reason)).join("\n")}

RECOVERY_CONFIGURATION_MISMATCH refers to the **missing qualified timing-configuration fingerprint binding**, not a changed chain, borrower, market or runtime threshold identity. There were no reported configuration changes or timestamp anomalies and evidenceInvalidated=false; absence of observed changes is not sufficient to qualify the missing evidence.

Progression remains **UNKNOWN / FIRST_OBSERVATION**, with a null accepted baseline. Being later than discovery does not change that monitored-stream result: no discovery observation was inserted as a progression baseline. No second live observation was authorized or executed to manufacture an ADVANCING state.

## 6. Exact current software checks and retained failures

${table(["Current check", "Result", "Evidence / scope"], [
  ["Full unit suite", "**FAIL — 1006 passed, 1 failed, 0 skipped/pending/todo; 1007 tests in 49 files**", "Exit 1; 48 files passed, 1 file failed. Original JSON/stdout/stderr and command record retained."],
  ["Affected process-fixture file follow-up", "**" + targeted.status + " — " + targeted.unit.passed + "/" + targeted.unit.total + " passed; " + targeted.unit.failed + " failed; " + targeted.unit.files + " file**", "Corrected local-IPC guard, single worker, unchanged existing tests; does NOT replace the failed full suite."],
  ["TypeScript --noEmit", "**PASS**, exit 0", "No output/findings; source/test/scripts/config type-checking"],
  ["ESLint --no-cache", "**PASS**, exit 0", "No output/findings; no --fix"],
  ["External-output TypeScript build", "**PASS**, exit 0", "Emission only under this audit directory's build/; repository dist/ preserved"],
  ["Live artifact / offline pipeline audit", "**PASS — 9/9 check groups**", "12 captured artifact hashes, 33 assurance references, direct decoding/arithmetic/actions and persisted rows; zero fetch/socket attempts"],
  ["Actual Stage 2 store/outbox restart", "**PASS**", "New process; zero live cycles/reads, no observation or delivery replay"],
  ["Repository / Git preservation", "**PASS**", "Full fresh baseline comparison after tests; no repository exceptions"]
])}

**Original failed test:** ${code(failed.file)} → ${code(failed.fullName)}. It hit its existing **40,000 ms timeout**, followed by a Windows **EPERM cleanup** error. No production code/test timeout was changed. The precise cause of the timeout/cleanup failure is not conclusively isolated by this follow-up.

The original guard logged **556 records** and labelled **18 LOCAL_IPC path records** EXTERNAL_BLOCKED. Its summary field actualExternalAttempts=18 therefore does **not** establish 18 external RPC/HTTP requests. V1 rejected every double-backslash path, including the local Windows named-pipe form used by tsx; it omitted the actual IPC paths, so those original paths cannot be retrospectively proven from the log. There were **zero blocked non-IPC-host/fetch records**, and external access was never permitted. The separately retained v2 guard explicitly recognizes only local Windows named pipes and continues to reject external hosts/remote UNC pipes. The focused follow-up recorded **${targeted.networkGuard.records} guard records**, **${targeted.networkGuard.localNamedPipeRecords} local named-pipe records** and **${targeted.networkGuard.actualExternalAttempts} external attempts**. Its seven guard classification cases are pure checks, not network connections.

${record("offline-test-results.json")} remains FAIL; ${record("test-accounting.json")} is PASS only for **accurate accounting**, not an all-green test claim. A focused pass must not be relabelled as a fresh 1007/1007 full-suite pass. No corrected-guard full-suite rerun was performed.

The first external offline artifact verifier also retained a diagnostic failure: SQLite returns null-prototype attempt rows whereas parsed JSON uses ordinary object prototypes. Eight check groups had already passed; the complete row **values** were equal. Only that temporary verifier's prototype-sensitive comparison was corrected to compare complete serialized values, and its second run passed all nine groups. ${record("offline-verification-results.json")} is retained beside the authoritative ${record("offline-verification-results-v2.json")}; captured evidence, production code and the one live cycle were not changed.

### Commands and test authorization limits

${commands}

- **Affected-file follow-up** (exit ${targeted.command.exitCode}): ${targetCommand}

Both test runs used native Vitest configuration, no module/file cache, NODE_DISABLE_COMPILE_CACHE=1, external TEMP/TMP/evidence outputs, and guarded loopback/local-IPC fixtures. Existing synthetic process fixtures may temporarily enable their fixture runtime; they are not this live configured position, production activation or a scheduler qualification.

**Not rerun:** native PostgreSQL integration, live integration suites, Neon, remote notification delivery, deployment, scheduler/cadence qualification, production migrations or multi-position execution. Previous 1007/1007, native PostgreSQL 61/61, prior focused 5/5, secret-scan and documentation-link results are historical and are not presented as fresh Stage 2 passes.

## 7. Repository and Git preservation

Fresh baseline: ${code(baseline.startedAt)} through ${code(baseline.completedAt)}. Final comparison completed at ${code(preservation.completedAt)}.

${table(["Preservation assertion", "Result"], [
  ["Regular-file/symlink entries", String(preservation.baselineEntries) + " → " + String(preservation.currentEntries)],
  ["Repository byte total", String(preservation.baselineBytes) + " → " + String(preservation.currentBytes)],
  ["Added / removed / changed entries", String(preservation.added.length) + " / " + String(preservation.removed.length) + " / " + String(preservation.changed.length)],
  ["Git status / staged diff / worktree diff / symbolic HEAD", "Byte hashes and command outcomes unchanged"],
  ["Git index", "65,736 bytes; " + code(preservation.git.index.sha256) + "; unchanged"],
  ["HEAD", "Unborn; rev-parse --verify HEAD remains exit 128"],
  ["Staged diff", "Empty, 0 bytes"],
  ["Repository scope", "Includes .git, ignored data/evidence, node_modules, dist, source, tests and existing user work"],
  ["Intentional repository modifications / exceptions", "None — all new drivers, configuration, database, test outputs and this report are outside the repository"]
])}

No stage, commit, push, stash, reset, checkout or discard operation occurred. Read-only Git commands disabled optional locks. Existing uncommitted work and the index remain preserved; there is no claim that the working tree was originally clean.

## 8. Evidence anchors, final verification and stop condition

${table(["Artifact", "Bytes", "SHA-256"], evidenceRows)}

**Hash semantics:** the captured snapshot file hash is ${code(sha256(bytes("live-monitor-snapshot.json")))}, while the schema-parsed snapshot serialization referenced by assurance is ${code(offline.checks.find(check => check.name === "CANONICAL_SNAPSHOT_AND_ASSURANCE_REFERENCE_BINDINGS").detail.schemaParsedSnapshotSha256)}. The canonical typed snapshot identifier is ${code(live.snapshotIdentifier)}. These are different defined representations, not a hash mismatch; all were independently reproduced from the captured bytes. Local hashes provide integrity relative to this captured baseline, not independent custody/tamper-proof authority under an administrator-compromised host.

The final local report validator records link/hash/transcript checks and an artifact manifest separately in this directory. It does not contact linked websites. ${record("live-stage2-evidence.json")} remains the authoritative live capture; the report is its consolidated interpretation, with software-check failures and oracle gaps disclosed rather than hidden.

**Stop:** one live cycle is complete and stopped, zero pending console deliveries remain, and no live reader or monitoring loop is left running for this task. No third-party wallet owner was contacted. No wallet was created/funded, no message signed, no transaction broadcast, no supply/borrow/repay/withdrawal or position modification performed, and no external notification, Neon/paid service, deployment, scheduler activation, PostgreSQL/Neon migration or multi-position implementation was authorized or executed.

Production acceptance and financial recovery remain **NO-GO / UNVERIFIED** as described above. Any additional live reads/cycles, activation, external notifications, implementation or migrations require a separately scoped approval. This report does not grant it.
`;
const path = join(audit, "LIVE-STAGE-2-MONITORING-REPORT.md");
writeFileSync(path, report, { flag: "wx" });
console.log(JSON.stringify({ path, bytes: Buffer.byteLength(report), sha256: sha256(report), finiteLiveVerdict: "PASS",
  originalFullUnitSuite: "FAIL_1006_OF_1007_PASSED", focusedRerun: targeted.status, oracle: "UNVERIFIED", monitoring: "STOPPED" }, null, 2));
