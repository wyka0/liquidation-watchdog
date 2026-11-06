// Create the consolidated report and detached integrity envelope from retained evidence only.
// Modes never run the finished qualification batch or any application/monitoring operation.
import assert from "node:assert/strict";
import { join } from "node:path";
import { AUDIT, STAGE2, FILES, ENVELOPE, inventory, totalBytes, load, text, reference, referenceValid,
  newJson, newText, preservedArtifacts, retainFailure } from "./final-documentary-tools.mjs";

const mode = process.argv[2], script = "complete-qualification-report.mjs";
const c = value => "`" + value + "`";
const link = (label, file, root = "REPAIR") => `[${label}](${root === "STAGE2" ? "../live-stage2-SGNCxp/" : root === "REPOSITORY" ? "file:///C:/liquidation-watchdog/" : ""}${file})`;
const table = (headers, rows) => ["| " + headers.join(" | ") + " |", "| " + headers.map(() => "---").join(" | ") + " |",
  ...rows.map(row => "| " + row.join(" | ") + " |")];
const fmt = value => Number(value).toFixed(3);

function capture() {
  const startedAt = new Date().toISOString(), repairFiles = inventory(AUDIT), stage2Files = inventory(STAGE2);
  newJson(FILES.baseline, { schemaVersion: 1, kind: "FINAL_DOCUMENTARY_WORK_PREEXISTING_ARTIFACT_BASELINE", startedAt, completedAt: new Date().toISOString(),
    repair: { directory: AUDIT, fileCount: repairFiles.length, bytes: totalBytes(repairFiles), files: repairFiles },
    stage2: { directory: STAGE2, fileCount: stage2Files.length, bytes: totalBytes(stage2Files), files: stage2Files },
    repositoryBaseline: reference("baseline.json"),
    meaning: "Every existing repair artifact, control failure/remnant and Stage 2 file is frozen before final-documentary outputs. Only new final-documentary files may be added; no existing bytes are overwritten.",
    exclusions: ["This baseline cannot include its own bytes.", "Directory metadata/empty directories are not file-byte evidence.", "Repository bytes are covered by the earlier complete baseline and allowlisted preservation checks."],
    safety: { noTestsApplicationDatabaseNetworkOrMonitor: true, noExistingArtifactOverwritten: true, noRepositoryWrite: true } });
  console.log(JSON.stringify({ status: "FINAL_DOCUMENTARY_BASELINE_CAPTURED", repairFiles: repairFiles.length, stage2Files: stage2Files.length }));
}

function report() {
  const generatedAt = new Date().toISOString(), batch = load("qualification-batch/summary.json"), gaps = load("oracle-qualification-gaps.json");
  const causality = load("causal-analysis.json"), contract = load("test-contract-preservation.json"), preservation = load(FILES.preservation);
  const lifecycle = load("final-lifecycle-verification.json"), research = load("public-oracle-research/summary.json"), rpc = load("oracle-rpc-audit/summary.json");
  const priorCompletion = load("report-completion.json", "STAGE2"), live = load("live-stage2-evidence.json", "STAGE2");
  const helperFailure = load("causal-consolidation-attempt-1.json"), frozen = preservedArtifacts();
  assert.equal(batch.status, "PASS"); assert.equal(lifecycle.status, "PASS"); assert.equal(preservation.status, "PASS"); assert.equal(frozen.status, "PASS");
  assert.equal(gaps.decision, "NO-GO"); assert.equal(gaps.monitor, "STOPPED");
  const phases = batch.results.map(phase => ({ ...phase, summary: load(`${phase.name}/summary.json`) }));
  const children = lifecycle.phases.flatMap(phase => phase.children), graceful = children.filter(child => child.signalToCloseMs !== null).map(child => child.signalToCloseMs);
  const requirements = priorCompletion.originalRequirements.map((item, index) => ({ ...item, evidence: [
    "Stage 2's pinned collateral/borrow shares/market/IRM inputs, 58 matched access-path comparisons, 10 separate direct-getter comparisons and 17 independent BigInt matches establish the read/derivation. The ratio is a Morpho equivalent, not a direct health-factor getter; oracle economic accuracy is unverified.",
    "Stage 2 loaded warning 1.30 and critical 1.10 from the supported configuration into the actual reader/risk/transition scope. Decisions use exact integer cross-products. The original defaults/configuration and mathematical 1.00 boundary were not changed by this repair.",
    "Three actual Stage 2 alerts were timestamped and delivered through the supported local console adapter, each DELIVERED with one attempt and no ambiguity. External channels, deployed alerts and external exactly-once behavior were not qualified.",
    "Each actual Stage 2 alert contains one typed, concrete NON_FINANCIAL instruction with snapshot-bound evidence. All remain actionable:false, evidence NOT_QUALIFIED and financialOptions:[]. This is a messaging PASS, not permission to transact."
  ][index] }));
  const anchorSpecs = [
    ["Original Stage 2 report", "LIVE-STAGE-2-MONITORING-REPORT.md", "STAGE2"],
    ["Original live evidence", "live-stage2-evidence.json", "STAGE2"],
    ["Original failed full suite", "unit-tests.json", "STAGE2"],
    ["Original focused pass", "runtime-rerun-tests.json", "STAGE2"],
    ["Original Stage 2 manifest", "artifact-manifest.json", "STAGE2"],
    ["Final qualification batch", "qualification-batch/summary.json", "REPAIR"],
    ["Causal analysis", "causal-analysis.json", "REPAIR"],
    ["Lifecycle verification", "final-lifecycle-verification.json", "REPAIR"],
    ["Latest Git/repository/Stage 2 preservation", FILES.preservation, "REPAIR"],
    ["Seven-gate qualification gaps", "oracle-qualification-gaps.json", "REPAIR"],
    ["Bounded oracle configuration audit", "oracle-rpc-audit/summary.json", "REPAIR"],
    ["Full public research provenance", "public-oracle-research/summary.json", "REPAIR"],
    ["Retained documentary-helper failure", "causal-consolidation-attempt-1.json", "REPAIR"],
    ["Exact failed helper capsule", "causal-consolidation-attempt-1-tool.mjs", "REPAIR"],
    ["Test contract preservation", "test-contract-preservation.json", "REPAIR"],
    ["One-file repair allowlist", "authorized-changes.json", "REPAIR"],
    ["Final documentary-tool syntax checks", "final-documentary-syntax-checks/summary.json", "REPAIR"],
    ["Separate documentary validator source", "validate-final-qualification.mjs", "REPAIR"],
    ["Retained read-only input-review failure", "documentary-input-review-attempt-1.json", "REPAIR"]
  ];
  const anchors = anchorSpecs.map(([label, file, root]) => ({ label, ...reference(file, root) }));
  const lines = [], add = (...values) => lines.push(...values);
  add("# Final Qualification Repair — consolidated report", "",
    "## Outcome and acceptance scope", "",
    "**Software qualification: PASS. The four original requirements: PASS for the retained finite local Stage 2 run only. Production: NOT ACCEPTED / NO-GO. The real monitor remains STOPPED.**", "",
    "The fresh qualification completed 1/1 selected formerly failing test, 4/4 runtime-process tests, 31/31 focused tests, and 1007/1007 tests in 49 files. TypeScript, ESLint and the external-output build all exited 0. This clears the runtime-test qualification blocker; it does not establish verified oracle protection or production acceptance.", "",
    `Report generated: **${generatedAt}**. Qualification window: **${batch.startedAt}–${batch.completedAt}**. Times are UTC. The original failed full run, original focused pass, diagnostic/control failures and documentary-helper failures remain historical evidence and are not overwritten or relabelled.`, "",
    "Exactly one repository file changed: `test/runtime-process.test.ts`. Application/runtime/helper/assurance code, the corrected V2 local-IPC guard and unrelated user work remain unchanged. This finalization performs no new test batch, real monitoring cycle, chain request or delivery.", "",
    "## 1. Four original requirement verdicts", "",
    ...table(["Original requirement", "Verdict", "Evidence and limitation"], requirements.map(item => [item.requirement, "**PASS — finite local run only**", item.evidence])), "",
    `Requirement wording and original scope: ${link("Phase 11 product acceptance audit", "docs/PHASE-11-PRODUCT-ACCEPTANCE-AUDIT.md", "REPOSITORY")}; retained live evidence: ${link("Stage 2 report", "LIVE-STAGE-2-MONITORING-REPORT.md", "STAGE2")} and ${link("live-stage2-evidence.json", "live-stage2-evidence.json", "STAGE2")}. Neither the earlier audit nor Stage 2's failed full-suite result has been rewritten.`, "",
    "### Retained historical observation, not a new or current position read", "",
    ...table(["Field", "Stage 2 retained value"], [
      ["Chain / account role", "Pharos Pacific / 1672; EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET"],
      ["Borrower", c(live.target.account)], ["Morpho", c(live.target.protocolAddress)], ["Market", c(live.target.marketId)],
      ["Oracle", c(live.target.oracleAddress)], ["Stage 2 block", c(live.block.number)], ["Stage 2 block hash", c(live.block.hash)],
      ["Stage 2 block time", `${c(live.block.timestamp)} / ${live.block.timestampUtc}`], ["Observation / alert creation", live.observedAt],
      ["Collateral, raw / display", `${c(live.position.collateral)} / 18,706,585.513096 wsrUSD`],
      ["Borrow shares, raw", c(live.position.borrowShares)], ["Derived borrower debt, raw / display", `${c(live.accounting.debt)} / 18,001,980.562580 USDC`],
      ["Derived health-factor equivalent", c(live.decoded.safetyRatio)],
      ["Mathematical / effective state", "CRITICAL / DATA_UNVERIFIED; INDICATIVE_ONLY; actionable:false"],
      ["Recovery / progression", "BLOCKED / UNKNOWN–FIRST_OBSERVATION; no accepted progression baseline"]
    ]), "",
    "Debt is accrued and rounded up from borrower shares using Morpho virtual assets/shares; capacity rounds down. The ratio is floor(capacity × 10^18 / debt). These historical position amounts are not recovery amounts, current balances, liquidation advice or a guarantee of economic price accuracy.", "",
    "All three actual console messages were created at 2026-11-05T23:48:19.444Z and delivered at 23:48:20.483Z / 23:48:20.516Z / 23:48:20.538Z respectively. Their concrete instructions are:", "",
    ...table(["Alert", "One typed NON_FINANCIAL instruction"], live.alerts.map(alert => [c(alert.code), alert.suggestedAction.instruction])), "",
    `The exact transcript remains in ${link("console-alerts.txt", "console-alerts.txt", "STAGE2")}. The retained ${link("new-process outbox restart", "restart-verification.json", "STAGE2")} had zero new observations, zero drain attempts and zero known-delivered resends; it is not a second live worker cycle.`, "",
    "## 2. Established failure mechanism and honest causal limits", "",
    "The formerly failing test is `fences a second process and recovers after actual forced OS termination with an unfinished cycle` (original declaration test/runtime-process.test.ts:47; corrected declaration :68).", "",
    ...causality.rootCause.map((statement, index) => `${index + 1}. ${statement}`), "",
    "The original assertion took **40,153.113 ms** before timeout and Windows EPERM removal; the original unchanged focused pass took **36,628.4016 ms**. Original signal-test totals were **22,381.945 / 22,866.7833 ms**, including startup. A separate copied original failure store has revision 2, one INTERRUPTED and one COMPLETED cycle, and runtime STOPPED; its last file write at 2026-11-05T23:58:24.374Z occurred after the failed deadline. That is evidence of asynchronous work outliving the test timeout, not a new live monitoring run.", "",
    "Unmodified V2 controls completed the selected assertion in 11,553.0981 / 21,694.0204 ms. Controlled compiler load increased first-child spawn-to-reading from **6095.7177 to 15611.1448 ms**. This demonstrates startup sensitivity, not the exact load or scheduling of the original host.", "",
    "### Diagnostic controls — never counted as fresh qualification", "",
    ...table(["Control", "Retained outcome", "Selected assertion ms", "Meaning"], causality.controls.map(control => [
      link(control.name, `${control.name}/summary.json`), c(control.status), fmt(control.selectedAssertion.durationMs), ({
        "ipc-v1-negative-control": "Selected assertion passed, but control qualification FAIL: four false LOCAL_IPC rejections; no demonstrated remote request.",
        "unmodified-independent-v2": "Unmodified source; V2; one selected pass, three unselected.",
        "unmodified-loaded-v2": "Unmodified source under explicit compiler load; diagnostic only.",
        "original-budget-latency-negative-control": "FAIL: 40000-ms timeout + EPERM. Resumed child still connected, cwd in fixture runtime, five SQLite opens. Failure remnant retained.",
        "corrected-budget-latency-control": "PASS above 40000 ms with corrected source; children closed/disconnected, stdio destroyed, fixture removed.",
        "corrected-teardown-deadline-negative-control": "FAIL: 40000-ms timeout only. Only the aggregate deadline was restored externally; corrected cleanup reaped both children with no EPERM and removed the fixture."
      })[control.name]
    ])), "",
    "The paired latency controls hold each readiness event until 20 seconds of child life, within the unchanged 30-second child bound. They are explicit synthetic controls, not hidden retries or production observations. The deadline-negative control proves that successful cleanup does not suppress or convert a timeout into PASS.", "",
    "The original V1 summary's `actualExternalAttempts:18` consists of LOCAL_IPC-labelled rejections, not 18 established external requests. Its missing IPC paths/timestamps cannot be reconstructed. V2 is byte-identical to Stage 2's corrected guard and continues to reject external hosts and remote UNC pipes. The V1 control stays FAIL even though its selected test assertion passed.", "",
    ...causality.limits.map(limit => "- " + limit), "",
    "Early diagnostic runs without per-run test-source capsules retain sourceSha256:null; later capsules are not retrospectively substituted. For the original latency-negative control, later resumed-child exit/close events are missing. Independent CIM observation confirmed PIDs 13028 and 15676 absent at 2026-11-06T00:40:16.041Z; no missing exit reason/time is invented, and all 99 files plus the failure remnant remain.", "",
    `Evidence: ${link("causal-analysis.json", "causal-analysis.json")}, ${link("original-failure-inspection.json", "original-failure-inspection.json")}, ${link("timing analysis", "timing-analysis-unmodified-independent-v2-unmodified-loaded-v2.json")}, ${link("negative-control independent OS verification", "negative-control-independent-process-verification.json")}.`, "",
    "## 3. Smallest justified correction and assertion preservation", "",
    ...table(["Changed repository file", "Before", "After", "Reason"], [[c("test/runtime-process.test.ts"), "4776 bytes", "5805 bytes", "Test-only lifecycle cleanup and evidence-backed two-child aggregate budget; no application fix."]]), "",
    `Before SHA-256: ${c(contract.sourceBeforeSha256)}.`, `After SHA-256: ${c(contract.sourceAfterSha256)}.`, "",
    "- Track every child, including the no-IPC import child, through a `close` promise installed immediately after spawn.",
    "- Record child errors and surface them after actual close. `stop()` always awaits that promise, even if exitCode/signalCode is already set; it signals only a still-live child.",
    "- Asynchronous afterEach independently reaps all tracked children, removes fixture-directory registrations before awaiting stop to reject late spawns, then removes directories and asserts their absence. Cleanup errors remain failures.",
    "- Change only the forced-recovery aggregate deadline to **70,000 ms = 2 × unchanged 30,000-ms child bounds + existing normal 10,000-ms assertion allowance**. The original timing and paired controls justify that budget; this is not an unsupported global timeout increase.",
    "- Preserve all four expanded tests, all twelve original assertion chains, titles and ordering, the **3000-ms graceful-shutdown assertion**, the **30000-ms runtime child bound**, the **20000-ms import child bound**, and the unchanged helper's **25000-ms post-import hard limit**. Add one directory-removal assertion. No tests were deleted, source-skipped, made exclusive, marked todo or weakened.", "",
    `${link("test-contract-preservation.json", "test-contract-preservation.json")} verifies the AST assertion/title/deadline contract and eight critical unchanged files. ${link("authorized-changes.json", "authorized-changes.json")} seals the only permitted before/after delta; source-before/source-after capsules are retained. Default vitest.config.ts maxWorkers remains 2.`, "",
    "## 4. Fresh independent, focused and complete qualification", "",
    ...table(["Fresh check", "Outcome", "Files / selection", "Command duration seconds", "Evidence"], phases.flatMap(phase => phase.mode === "checks"
      ? phase.summary.results.map(result => [result.label === "typecheck" ? "TypeScript --noEmit" : result.label === "lint" ? "ESLint --no-cache" : "External-output TypeScript build", "**PASS — exit 0**", "No test selection", fmt(result.durationMs / 1000), link(`${result.label}-command.json`, `${phase.name}/${result.label}-command.json`)])
      : [[({ independent: "Formerly failing test independently", "runtime-process": "Entire runtime-process file", focused: "Relevant focused suites", full: "Complete original unit suite" })[phase.mode],
        `**PASS — ${phase.tests.passed}/${phase.mode === "independent" ? "1 selected" : phase.tests.total}**`, `${phase.tests.files} file(s)${phase.mode === "independent" ? "; 3 intentionally unselected" : ""}`, fmt(phase.summary.results[0].durationMs / 1000), link("summary.json", `${phase.name}/summary.json`)] ])), "",
    "The independent selected assertion itself took **10,538.9707 ms** (its command duration is 14.819 seconds). Its three other tests are intentionally unselected by `-t` and appear as skipped/pending in Vitest JSON; this is not a claim of four independent passes. The entire-file, focused and full runs have **zero failed, pending, skipped or todo tests**. The full run's 1007-test/49-file title inventory exactly matches the original failed run.", "",
    "Focused files: `test/runtime-process.test.ts`, `test/runtime-lifecycle.test.ts`, `test/runtime-storage.test.ts`. All five final phases ran sequentially, with no concurrent test/compiler workload. Unlike the earlier Stage 2 one-worker follow-up, fresh qualification uses the unchanged repository configuration, **maxWorkers:2**, with no worker-count override.", "",
    "All final test commands use native configuration loading, disabled Vitest/module caches, NODE_DISABLE_COMPILE_CACHE=1, external TEMP/TMP/output locations, V2 network guard and the observation-only process diagnostic preloader. No readiness-delay/deadline-control preloader is used in qualification. Tool-source and runtime-helper capsules, command records, JSON, stdout, stderr and lifecycle/network traces are retained. Tool caches/output directories intentionally remain; only fixture resources are removed.", "",
    "Nonempty stderr is retained, including Node's SQLite ExperimentalWarning and fixture diagnostics. Warnings are not suppressed; tests and exit status govern qualification. No --fix, skip/delete, assertion suppression, retry-to-hide-failure or disabled cleanup assertion was used.", "",
    "### Exact executed commands (documentary record, not a request to rerun)", "",
    "Working directory: `C:/liquidation-watchdog`. Each line below is the recorded child command; inherited guards/external TEMP/TMP are in the retained runner capsule.", "", "```powershell",
    ...phases.flatMap(phase => phase.summary.results.map(result => "& " + result.command.map(arg => /[\s]/.test(arg) ? '"' + arg + '"' : arg).join(" "))), "```", "",
    "Not qualified or rerun here: native PostgreSQL/live integration, Neon, remote notification delivery, deployment, scheduler/cadence, production migrations, continuous monitoring or multi-position execution. Historical integration passes are not presented as fresh results.", "",
    "## 5. Child / IPC / stdio / SQLite / fixture cleanup", "",
    `The retained ${link("final-lifecycle-verification.json", "final-lifecycle-verification.json")} passes **${lifecycle.checks.length} check groups** across **${children.length} observed children** (14 runtime-with-IPC, 3 import-without-IPC).`, "",
    ...table(["Phase", "Children", "Runtime fixture removals", "All logged fixture removals", "Qualified remnants / remote attempts"], lifecycle.phases.map(phase => [phase.name, phase.children.length, phase.runtimeFixtureRemovals.length, phase.allLoggedFixtureRemovalAttempts, `${phase.finalFixtureDirectories.length} / ${phase.network.demonstratedRemoteAttempts}`])), "",
    "- Every observed child has exit-before-close ordering and destroyed stdout/stderr at close. Runtime children have a disconnect event and connected:false at close. Import children have no IPC channel; no disconnect event is expected.",
    `- All observed graceful signal-to-close measurements are **${fmt(Math.min(...graceful))}–${fmt(Math.max(...graceful))} ms**, far below the preserved 3000-ms assertion. On Windows, the SIGINT/SIGTERM handler tests use the existing explicit IPC handler simulation; forced termination is actual OS SIGKILL.`,
    "- Graceful runtime children explicitly close all observed SQLite connections and workspace probes and leave their runtime cwd. Actual SIGKILL cannot execute application finally/SQLite close; release is evidenced by process close, successful original exclusive-lock/recovery/reopen assertions, removal after child close and final OS absence.",
    "- All ten qualified runtime fixture directories are removed only after their related children close. No observed unreleased SQLite connection remains at removal; no qualified fixture-removal error or leftover exists. Historical failure remnants are deliberately untouched.",
    `- Point-in-time CIM observation **${lifecycle.osObservation.observedAtUtc}** found no recorded PID and no relevant fixture/test/real-monitor Node process. Unrelated user/harness processes were not terminated. _getActiveHandles class counts are diagnostics, **not an exhaustive OS handle inventory**; a retiring parent ChildProcess handle at close is not itself a live orphan.`, "",
    "### Original real store inspected only through a separate read-only copy", "",
    `Original Stage 2 store and copy SHA-256: ${c(lifecycle.realStage2StoreInspection.sourceSha256)}. The original database was never opened for this inspection. The byte-identical copy was opened readOnly/query_only, quick_check returned ok, and its connection was explicitly closed. Original and copy hashes remained unchanged.`, "",
    "Stored history remains exactly one COMPLETED cycle/observation, runtime STOPPED, no unfinished cycle, three console DELIVERED rows with one attempt/no ambiguity each, three NON_FINANCIAL actions, actionable:false and zero financial options. No new real cycle, observation or delivery was performed.", "",
    "## 6. Oracle research: exact facts, not gate promotion", "",
    `The completed **62-request** oracle/configuration-only audit ran ${rpc.startedAt}–${rpc.completedAt}, with full request/response hashes retained. It did not read borrower collateral, balances, debt or health factor and is **not a monitored observation or progression baseline**. No further RPC or public research is performed during this finalization.`, "",
    ...table(["Provenance / component", "Separate bounded audit value"], [
      ["Chain / block", `${rpc.chainId} / ${c(rpc.block.number)}`], ["Block hash", c(rpc.block.hash)], ["Block timestamp / UTC", `${c(rpc.block.timestamp)} / ${rpc.block.time}`],
      ["Rechecked historical anchor", `${c(rpc.stage2AnchorRechecked.number)} / ${c(rpc.stage2AnchorRechecked.hash)}`],
      ["Pricing path", `${c(live.target.oracleAddress)} → ${c(rpc.composition.BASE_FEED_1)} → ${c(rpc.facade.aggregator)} → ${c(rpc.cache.getForwarderAddress)}`],
      ["Feed ID", c(rpc.facade.getFeedId)], ["Facade description / version", `${rpc.facade.description} / ${rpc.facade.typeAndVersion}`],
      ["Collateral / decimals", `${c(rpc.tokens.collateral.address)} / wsrUSD / 18`], ["Selected loan / decimals", `${c(rpc.tokens.loan.address)} / USDC / 6`],
      ["Answer / oracle mechanical price", `${c(rpc.facade.round.answer)} / ${c(rpc.composition.price)}`],
      ["startedAt = updatedAt = cache time", c(rpc.facade.round.updatedAt)], ["Measured age at audit block", "1103 seconds; measurement only"],
      ["roundId / answeredInRound", "0 / 0; not OCR aggregation rounds"], ["Scale / inactive components", "answer × 1000000; both vaults, second base feed and both quote feeds zero"],
      ["Sampled known DON configuration", "4294967297; f=3; ten distinct signer addresses; not complete enumeration"],
      ["Known sampled workflow ID", c(rpc.cache.knownWorkflow.id)]
    ]), "",
    "All five reviewed pricing-dependency runtimes match retained reproduced SHA-256/Keccak identities; collateral runtime also matches its historical binding. The market ID was re-derived and before/after pinned headers were stable. Loan runtime bytes were captured, but no prior reproduced loan-runtime pin is asserted. Code identity is not economic verification.", "",
    "### Published product and timing settings", "",
    `${link("Official Pharos Pacific mapping/settings", "https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe.md")} was retained as a full 200 response, **8722 bytes**, SHA-256 ${c(gaps.publishedFacts.document.responseSha256)}, retrieved **2026-11-06T00:31:59.706Z**. The exact Pacific row maps this feed ID/facade to **WSRUSD/RUSD**, not WSRUSD/USDC. Common settings declare **18 decimals**, **PriceFeed Heartbeat 3600 seconds** and **DeviationThreshold 0.5** (literal published setting).`, "",
    "The official CRE/Data Streams architecture description, issuer's exact Pharos wsrUSD registry row and savings/redemption descriptions are retained research facts. They do not identify the deployed workflow binary/economic inputs, prove executable market-price semantics, identify every operator, or bind the common timing settings to the complete active configuration.", "",
    "Mechanical scaling establishes Morpho's `price × collateralBaseUnits / 10^36` representation of loan base units. It does not convert a published rUSD economic quote to the selected USDC loan. With no active quote feed, **rUSD/selected-USDC equivalence remains unproved**; no peg assumption, conversion or price replacement was introduced.", "",
    "### Observed controllers and source-backed enforcement", "",
    ...table(["Controller", "Observed address", "Permission boundary"], [
      ["Facade owner", c(rpc.facade.owner), "May change cache/feed ID and transfer ownership."],
      ["Cache owner", c(rpc.cache.owner), "Controls forwarder, workflow permissions and optional workflow-owner check."],
      ["Forwarder owner", c(rpc.forwarder.owner), "Controls signer configurations and separately authorized route forwarders."],
      ["Additional allowedWorkflowOwner", c(rpc.cache.getAllowedWorkflowOwner), "Zero disables this extra comparison only; it does not disable all report authorization."]
    ]), "",
    "Owner addresses are not real-world controller/operator identities. Three zero EIP-1967 slots are interpreted with reproduced runtime/source, never as sufficient architecture evidence alone. One allowed workflow and one stored DON/version do not enumerate all active configurations or authorized routes. Ten keys/four recovered historical signatures do not prove ten/four independent organizations or independent economic inputs.", "",
    "Reviewed cache code ignores validFromTimestamp, skips non-increasing observations, permits future timestamps and does not expire readable answers. The facade returns workflow-supplied observation time for both startedAt/updatedAt; the Morpho feed consumer does not enforce observation age. The existing local reader still rejects zero/negative answers and invalid timestamp data. No implicit local age limit was added; a local rejection policy is not an upstream guarantee.", "",
    "The forwarder's signed-report entrypoint checks configured DON/version and f+1 distinct configured signatures; its route entrypoint is a separate owner-authorized path without that signature-validation step. Complete route/controller provenance remains missing. Stage 2's 1333-second age and 3601-second sample interval, and this audit's 1103-second age, are **observations, never heartbeat or maximum-age guarantees**.", "",
    "### Independent comparator research", "",
    "Three retained Chainlink documentation URLs returned 404, the Avalanche WSRUSD/RUSD candidate returned 429, and both DexScreener exact-address responses returned no pairs. Full bodies, response status/headers/times and hashes remain in public-oracle-research/. These bounded results do not prove that no comparator exists anywhere. Same-product/cross-chain feeds, redemption rates, different RPC/MCP access paths or distinct URLs/keys cannot substitute for a source-independent exact Pharos wsrUSD/USDC MARKET_PRICE comparator.", "",
    "## 7. Every VERIFIED gate: exact prerequisites and missing wiring", "",
    "These are the retained Stage 2 evaluated states. The separate oracle audit and new public documents do not create a new evaluated assurance object, change these states or promote any gate. Overall remains UNVERIFIED / DATA_UNVERIFIED, freshness UNKNOWN and independent validation UNKNOWN/ineligible.", "",
    ...table(["Dimension", "Historical evaluated state", "Satisfied", "Still missing"], Object.entries(gaps.dimensions).map(([name, dimension]) => [c(name), c(dimension.historicalEvaluatedState), dimension.historicalSatisfied.length ? dimension.historicalSatisfied.map(c).join(", ") : "None", dimension.historicalMissing.length ? dimension.historicalMissing.map(c).join(", ") : "None"])), "");
  for (const [name, dimension] of Object.entries(gaps.dimensions)) {
    add(`### ${name}`, "", `Required proofs: ${dimension.requiredForVerified.map(c).join(", ")}.`, "", "Exact promotion / continuity prerequisites:", "",
      ...dimension.exactPromotionPrerequisites.map((item, index) => `${index + 1}. ${item}`), "",
      "**Implementation gap / scope:** " + dimension.implementationGapOrScope, "");
  }
  add("### Explicit temporal/comparison bounds and production ingestion blockers", "",
    "Independent comparison requires AVAILABLE MARKET_PRICE, exact base/quote chain/address/decimals, positive price bounded by uint256, positive documented frequency, all eight PROVEN hashed subject/chain-bound proofs, qualified selected/comparator upstream identities and actual source independence. The FREQUENCY/OPERATOR/PROVENANCE/INDEPENDENCE claims require VERIFIED_SOURCE/OFFICIAL_DOCUMENT evidence in production.", "",
    "Policies are explicit: integer tolerance **0..10000 bps**; maximum age **1..31,536,000 seconds**; maximum timestamp skew **0..31,536,000 seconds**. Both observation times must be positive, non-future and within age/alignment policy. Exact rational normalization keeps raw Morpho/comparator prices separate; disagreement stays FAILED, with **no price substitution**.", "",
    "VerifiedTiming requires positive schema-bounded seconds, PROVEN hashed VERIFIED_SOURCE/OFFICIAL_DOCUMENT evidence for chain 1672 and this exact facade, and a valid 64-hex configuration fingerprint matching the active evaluator fingerprint. A documented heartbeat H does not by itself prove upstream maximum age G; both require exact-product/configuration-bound evidence and timestamp/anomaly/expiry checks.", "",
    ...gaps.productionCapabilitiesMissing.map(item => "- " + item), "",
    "In particular, SOURCE_V1 and OPERATOR_V1 currently supply empty satisfied lists; evaluateAssurance() supplies no verified timing or selected upstream identity; its freshness requirements remain fixed; and denomination is literally ECONOMIC_QUOTE_UNVERIFIED. This is not solved by placing a document in an evidence directory. No further ingestion/schema/evaluator change is justified or authorized by this repair.", "",
    `Complete evidence references, source hashes and exact prerequisite lists: ${link("oracle-qualification-gaps.json", "oracle-qualification-gaps.json")}; implementation: ${link("evaluate.ts", "src/oracle-assurance/evaluate.ts", "REPOSITORY")}, ${link("freshness.ts", "src/oracle-assurance/freshness.ts", "REPOSITORY")}, ${link("independent.ts", "src/oracle-assurance/independent.ts", "REPOSITORY")}, ${link("model.ts", "src/oracle-assurance/model.ts", "REPOSITORY")}.`, "",
    "## 8. Recovery remains blocked; future prerequisites are not authorization", "",
    ...gaps.recoveryBlockedReasonsRetained.map(reason => "- " + c(reason)), "",
    "RECOVERY_CONFIGURATION_MISMATCH means **missing qualified timing-configuration binding**, not demonstrated chain/borrower/market identity drift. The retained accepted observation is FIRST_OBSERVATION/UNKNOWN; oracle-only reads and older discovery cannot be reused as a new monitored progression baseline.", "",
    ...gaps.recoveryPromotionPrerequisites.map((item, index) => `${index + 1}. ${item}`), "",
    "These are acceptance prerequisites only. No second real cycle, continuous monitor, external notification, owner contact, financial recovery amount, signing, transaction, wallet operation, paid service or production action was performed to satisfy them. All actionable flags and financial option gates remain blocked/false.", "",
    "## 9. Repository, Git, user work and historical evidence preservation", "",
    `Latest exhaustive allowlisted verification completed **${preservation.completedAt}**: ${link(FILES.preservation, FILES.preservation)}. It retains the earlier ${link("preservation-final.json", "preservation-final.json")} rather than replacing it.`, "",
    ...table(["Preservation assertion", "Result"], [
      ["Repository entries", `${preservation.baselineEntries} → ${preservation.currentEntries}`],
      ["Repository bytes", `${preservation.baselineBytes} → ${preservation.currentBytes}; +1029 bytes solely in the allowlisted test`],
      ["Unexpected / missing changes", "0 / 0; only test/runtime-process.test.ts changed"],
      ["Index", `65736 bytes; ${c(preservation.git.index.sha256)}; unchanged`],
      ["Git status / staged diff / worktree diff / symbolic HEAD", "Outcomes and byte hashes unchanged; staged diff 0 bytes"],
      ["HEAD", "Unborn; rev-parse --verify HEAD remains exit 128"],
      ["Stage 2 directory", "All 561 files unchanged, including original failure remnants and final evidence envelope"],
      ["Original Stage 2 manifest", "387 files / 10,157,722 bytes; its original coverage/exclusions remain intact"],
      ["Repository scope", "Includes .git, ignored evidence/data, node_modules, dist, source, tests and existing Phase 12/Stage 3 user work"]
    ]), "",
    "Git summaries are not the sole proof of file preservation: the complete byte inventory explicitly records the one allowed test delta. There is no claim that the working tree was originally clean. No staging, commit, push, stash, reset, checkout, discard or index write occurred; read-only Git commands disabled optional locks.", "",
    "All repair tooling, research, controls, qualification outputs and core report artifacts are under `[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/qualification-repair-20261106-QrN8p4/`, not in the repository. Only the explicitly detached post-seal verification receipt is written to its declared sibling path. The pre-finalization artifact baseline and final validators rehash existing repair artifacts and Stage 2 files without deleting caches or historical failure remnants.", "",
    "## 10. Retained documentary failures, anchors and final seal", "",
    "The original Stage 2 offline verifier's null-prototype versus ordinary-object row comparison failure remains beside its subsequent 9/9 value-comparison PASS. That historical documentary correction did not change captured live evidence or application code.", "",
    `The first repair causal-consolidation helper exited **1** with **${helperFailure.error.name}: ${helperFailure.error.message}** at **${helperFailure.error.location}**. It assumed an early-run tooling.testSource capsule that had not been captured. The exact failed tool, error record and retained stderr are separate from software qualification. Its invocation timestamp was not captured and remains NOT_CAPTURED; the retained stderr is a concise error excerpt, not a newly invented complete stderr transcript. The corrected external helper uses null for missing provenance and produced causal-analysis.json; no additional repository edit/test rerun was involved.`, "",
    "A later read-only final-documentary input review exited 1 with SyntaxError: Unexpected identifier 'node' from a PowerShell quoting failure: the requested quoted module specifier reached Node unquoted. Parsing failed before imports or evidence reads. The requested shell capsule and full tool-returned combined output are retained in documentary-input-review-attempt-1.json; the complete native eval argument, stream separation and invocation timestamp were not captured and are not invented. A file-based local helper avoids that quoting boundary; no evidence, repository file or software result changed.", "",
    ...table(["Artifact", "Bytes", "SHA-256"], anchors.map(anchor => [link(anchor.label, anchor.file, anchor.root), anchor.bytes, c(anchor.sha256)])), "",
    `Companion consolidated metadata: ${link(FILES.evidence, FILES.evidence)}. Documentary validation is recorded in ${c(FILES.validation)}. Exact final counts, byte totals, roots and exclusions are in ${c(FILES.manifest)} and ${c(FILES.manifestVerification)}; completion is ${c(FILES.completion)}.`, "",
    "The final artifact manifest covers every regular file/symlink in the repair and original Stage 2 roots, including full response bodies, source/tool capsules, command outputs, databases/copies, caches and failure remnants. It is mixed live-history/offline-test/research/documentary evidence, not an assertion that every artifact is live or independently qualified. Repository contents are covered separately by the complete baseline and allowlisted preservation/documentary checks; empty directories and external harness/parent-directory files are outside file-byte coverage.", "",
    "To avoid self-reference, the manifest excludes its own file, its hash sidecar, the later manifest-verification record, completion, final seal and seal sidecar. The final seal hashes the manifest/sidecar/verification/completion and core report/evidence/validation/preservation records; the seal sidecar hashes the seal. A separate read-only verification rehashes the final envelope. Local SHA-256 provides captured-byte integrity, not independent custody, notarization or protection against an administrator-compromised host.", "",
    "The read-only seal validator's stdout/stderr and invocation outcome are captured afterward in the exclusive sibling receipt `[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/final-qualification-seal-verification-QrN8p4.json`. That receipt is deliberately outside the two manifest roots and is not hashed by the seal it verifies; no retrospective self-reference is claimed.", "",
    "## 11. Final decision and stop", "",
    "**GO for the repaired software-test qualification only. NO-GO for production acceptance, verified live liquidation protection and financial recovery. Production remains NOT ACCEPTED. The real monitor remains STOPPED.**", "",
    "The four PASS verdicts are scoped solely to the retained finite local Stage 2 run. No additional production/oracle-ingestion implementation is made or authorized. No real monitoring cycle/loop, external notification, wallet/signing/transaction/lending action, owner contact, Neon/paid service, deployment, scheduler activation, production migration, multi-position work or Git mutation follows this report. Stop after delivery; any later scope requires separate approval.", "");
  newText(FILES.report, lines.join("\n"));
  newJson(FILES.evidence, { schemaVersion: 1, status: "FINAL_QUALIFICATION_REPAIR_SOFTWARE_PASS_PRODUCTION_NOT_ACCEPTED_NO_GO", generatedAt,
    report: reference(FILES.report), evidenceClass: "CONSOLIDATION_OF_IMMUTABLE_STAGE2_HISTORY_FRESH_OFFLINE_QUALIFICATION_AND_BOUNDED_READ_ONLY_RESEARCH",
    originalRequirements: requirements, qualifiedSoftware: { status: "PASS", startedAt: batch.startedAt, completedAt: batch.completedAt,
      batch: reference("qualification-batch/summary.json"), defaultMaxWorkers: 2, sequentialTestAndCompilerPhases: true,
      phases: phases.map(phase => ({ name: phase.name, mode: phase.mode, status: phase.status, counts: phase.tests,
        summary: reference(`${phase.name}/summary.json`), ...(phase.mode === "checks" ? {} : { tests: reference(`${phase.name}/tests.json`) }),
        commands: phase.summary.results.map(result => ({ label: result.label, exitCode: result.exitCode, durationMs: result.durationMs,
          commandRecord: reference(`${phase.name}/${result.label}-command.json`) })), sourceSha256: phase.summary.tooling.testSource.sha256,
        network: phase.summary.networkGuard, readinessOrDeadlineControlUsed: false })), fullInventoryPreserved: true },
    correction: { allowlist: reference("authorized-changes.json"), assertionContract: reference("test-contract-preservation.json"),
      onlyRepositoryFile: "test/runtime-process.test.ts", beforeSha256: contract.sourceBeforeSha256, afterSha256: contract.sourceAfterSha256,
      beforeBytes: 4776, afterBytes: 5805, aggregateBudgetMs: 70000, runtimeChildBoundMs: 30000, importChildBoundMs: 20000,
      gracefulShutdownAssertionMs: 3000, helperPostImportLimitMs: 25000, originalAssertionChains: 12, addedCleanupAssertions: 1,
      sourceBefore: reference("source-before/runtime-process.test.ts"), sourceAfter: reference("source-after/runtime-process.test.ts"),
      v2Guard: reference("test-network-guard-v2.cjs"), applicationRuntimeHelperAssuranceCodeUnchanged: true },
    causalEvidence: { analysis: reference("causal-analysis.json"), controlsNotQualification: true, historicalLimits: causality.limits,
      controls: causality.controls.map(control => ({ name: control.name, status: control.status, selectedAssertion: control.selectedAssertion,
        sourceSha256: control.sourceSha256, sourceCapsuleRecorded: control.sourceCapsuleRecorded, summary: reference(`${control.name}/summary.json`) })),
      retainedHelperFailure: reference("causal-consolidation-attempt-1.json"), failedHelperCapsule: reference("causal-consolidation-attempt-1-tool.mjs"),
      failedHelperStderrExcerpt: reference("causal-consolidation-attempt-1.stderr.txt"),
      retainedReadOnlyInputReviewFailure: reference("documentary-input-review-attempt-1.json") },
    historicalStage2: { report: reference("LIVE-STAGE-2-MONITORING-REPORT.md", "STAGE2"), evidence: reference("live-stage2-evidence.json", "STAGE2"),
      completion: reference("report-completion.json", "STAGE2"), originalFull: { status: "FAIL", files: 49, total: 1007, passed: 1006, failed: 1,
        artifact: reference("unit-tests.json", "STAGE2") }, originalFocused: { status: "PASS", files: 1, total: 4, passed: 4,
        artifact: reference("runtime-rerun-tests.json", "STAGE2") }, originalManifest: reference("artifact-manifest.json", "STAGE2"),
      originalManifestFileCount: 387, originalManifestBytes: 10157722, target: live.target, block: live.block, observations: 1,
      actualConsoleDeliveries: 3, originalFailuresRetained: true, noNewRealCycleOrDelivery: true },
    lifecycle: { verification: reference("final-lifecycle-verification.json"), checks: lifecycle.checks.length, observedChildren: children.length,
      runtimeWithIPC: 14, importWithoutIPC: 3, gracefulSignalToCloseMs: { minimum: Math.min(...graceful), maximum: Math.max(...graceful) },
      osObservedAt: lifecycle.osObservation.observedAtUtc, sourceStoreSha256: lifecycle.realStage2StoreInspection.sourceSha256,
      originalStoreNeverOpened: true, separateReadOnlyCopyClosed: true, qualifiedFixtureRemnants: 0, exhaustiveOSHandleInventoryClaimed: false },
    oracle: { gaps: reference("oracle-qualification-gaps.json"), audit: reference("oracle-rpc-audit/summary.json"),
      publicResearch: reference("public-oracle-research/summary.json"), auditBlock: rpc.block, requestCount: rpc.trace.length,
      auditIsNotMonitoredObservation: true, publishedProduct: "WSRUSD/RUSD", publishedHeartbeatSeconds: 3600,
      publishedHeartbeatQualifiedForActiveConfiguration: false, upstreamMaximumAgeGuaranteeQualified: false,
      selectedLoanQuoteEquivalenceVerified: false, newEvaluatedAssurance: null, historicalEvaluatedResult: gaps.historicalEvaluatedResult,
      dimensions: gaps.dimensions, missingProductionCapabilities: gaps.productionCapabilitiesMissing,
      recoveryBlockers: gaps.recoveryBlockedReasonsRetained, recoveryPromotionPrerequisites: gaps.recoveryPromotionPrerequisites,
      noGatePromotionOrIndependentPriceSubstitution: true, researchUrlCount: research.results.length },
    preservation: { latest: reference(FILES.preservation), earlier: reference("preservation-final.json"), preFinalizationArtifacts: frozen,
      repositoryEntries: preservation.currentEntries, repositoryBytes: preservation.currentBytes, stage2FilesUnchanged: 561,
      gitIndexSha256: preservation.git.index.sha256, gitIndexBytes: preservation.git.index.bytes,
      noStagingCommitPushResetCheckoutDiscard: true, unrelatedUserWorkPreserved: true },
    anchors, generator: { tool: reference(script), helpers: reference("final-documentary-tools.mjs"),
      separateValidator: reference("validate-final-qualification.mjs"), syntaxChecks: reference("final-documentary-syntax-checks/summary.json"),
      sealReceiptTool: reference("capture-final-seal-verification.mjs") },
    decision: { originalRequirements: "PASS_EXACT_FINITE_LOCAL_STAGE2_RUN_ONLY", software: "PASS", production: "NOT_ACCEPTED_NO_GO",
      oracleOverall: "UNVERIFIED", freshness: "UNKNOWN", independentValidation: "UNKNOWN_INELIGIBLE", financialRecovery: "BLOCKED", monitor: "STOPPED" },
    safety: { finalizationNetworkRequests: 0, finalizationApplicationImports: 0, finalizationDatabaseOpens: 0, finalizationTestsRun: 0,
      noAdditionalRealMonitoringCycle: true, noContinuousMonitoringExternalNotificationTransactionWalletOwnerContactOrFinancialRecoveryAmounts: true,
      noNeonPaidServiceDeploymentSchedulerProductionMigrationOrMultiPositionWork: true, noRepositoryWriteDuringFinalization: true,
      furtherAuthorizationGranted: false, stopAfterDelivery: true } });
  console.log(JSON.stringify({ status: "CONSOLIDATED_REPORT_AND_EVIDENCE_CREATED", report: reference(FILES.report), evidence: reference(FILES.evidence),
    finiteLocalRequirements: "4 PASS", software: "PASS", production: "NOT_ACCEPTED_NO_GO", monitor: "STOPPED" }, null, 2));
}

function manifest() {
  assert.equal(load(FILES.validation).status, "PASS"); assert.equal(preservedArtifacts().status, "PASS");
  const roots = [{ root: "REPAIR", directory: AUDIT, files: inventory(AUDIT, ENVELOPE) }, { root: "STAGE2", directory: STAGE2, files: inventory(STAGE2) }]
    .map(root => ({ ...root, fileCount: root.files.length, totalBytes: totalBytes(root.files) }));
  const manifest = { schemaVersion: 1, kind: "FINAL_QUALIFICATION_REPAIR_TWO_ROOT_FILE_BYTE_MANIFEST", createdAt: new Date().toISOString(),
    fileCount: roots.reduce((sum, root) => sum + root.fileCount, 0), totalBytes: roots.reduce((sum, root) => sum + root.totalBytes, 0), roots,
    evidenceClass: "MIXED_IMMUTABLE_LIVE_HISTORY_OFFLINE_QUALIFICATION_RESEARCH_TOOLS_DOCUMENTATION_CACHES_AND_FAILURE_REMNANTS_NOT_ALL_LIVE_PROOF",
    exclusions: [...ENVELOPE].map(file => ({ root: "REPAIR", file, reason: "Self-reference or later integrity-envelope artifact; explicitly covered by final-seal.json/sidecar and read-only envelope verification." })),
    coverage: ["All existing regular files and symlinks in the two declared roots, including hidden files, caches and failure remnants; symlink targets are hashed without traversal.",
      "Original Stage 2 report, failed test artifacts, original manifest and final envelope are included unchanged.",
      "The entire repository is separately covered by baseline.json, authorized-changes.json, preservation-seal.json and final-report-validation.json; repository bytes are not duplicated into this two-root manifest.",
      "Empty directory metadata and external parent/harness artifacts are excluded. Local hashes are integrity evidence, not independent custody or notarization."],
    report: reference(FILES.report), validation: reference(FILES.validation), preservation: reference(FILES.preservation),
    originalStage2Manifest: { ...reference("artifact-manifest.json", "STAGE2"), originalFileCount: 387, originalBytes: 10157722 },
    monitor: "STOPPED", software: "PASS", production: "NOT_ACCEPTED_NO_GO", noNewOperationalWork: true };
  newJson(FILES.manifest, manifest); newText(FILES.manifestHash, `${reference(FILES.manifest).sha256}  ${FILES.manifest}\n`);
  console.log(JSON.stringify({ status: "FINAL_MANIFEST_CREATED", fileCount: manifest.fileCount, bytes: manifest.totalBytes,
    roots: roots.map(({ root, fileCount, totalBytes }) => ({ root, fileCount, totalBytes })), manifest: reference(FILES.manifest) }, null, 2));
}

function seal() {
  const validation = load(FILES.validation), verification = load(FILES.manifestVerification), manifest = load(FILES.manifest), evidence = load(FILES.evidence);
  assert.equal(validation.status, "PASS"); assert.equal(verification.status, "PASS"); assert.equal(preservedArtifacts().status, "PASS");
  assert.ok(referenceValid(verification.manifest));
  const completedAt = new Date().toISOString();
  const coreRefs = [FILES.report, FILES.evidence, FILES.validation, FILES.preservation, FILES.baseline, FILES.manifest, FILES.manifestHash, FILES.manifestVerification].map(file => reference(file));
  newJson(FILES.completion, { schemaVersion: 1, status: "FINAL_QUALIFICATION_REPAIR_COMPLETE_SOFTWARE_PASS_PRODUCTION_NOT_ACCEPTED_NO_GO", completedAt,
    artifacts: coreRefs, originalRequirements: evidence.originalRequirements.map(({ requirement, verdict, scope }) => ({ requirement, verdict, scope })),
    software: { status: "PASS", independentSelectedPassed: 1, independentUnselected: 3, runtimeProcessPassed: 4, focusedPassed: 31,
      fullPassed: 1007, fullTotal: 1007, fullFiles: 49, fullFailedPendingSkippedTodo: 0, typecheckExitCode: 0, lintExitCode: 0, externalBuildExitCode: 0,
      originalFailed1006Of1007AndAllControlFailuresRetained: true },
    documentary: { status: "PASS", checkGroups: validation.checks.length, manifestVerificationCheckGroups: verification.checks.length,
      manifestFileCount: manifest.fileCount, manifestBytes: manifest.totalBytes, roots: manifest.roots.map(({ root, fileCount, totalBytes }) => ({ root, fileCount, totalBytes })),
      originalStage2ManifestFilesRehashed: 387, originalStage2ManifestBytesRehashed: 10157722, allStage2FilesRehashed: 561,
      allExistingRepairArtifactsPreserved: true, causalHelperFailureRetainedSeparately: true },
    correction: evidence.correction, decision: evidence.decision, finalEnvelopeExclusions: [...ENVELOPE],
    envelopeMeaning: "Manifest covers all declared-root file bytes except six explicitly excluded integrity-envelope files; final seal covers manifest/sidecar/verification/completion plus core records; seal sidecar hashes the seal itself.",
    detachedReadOnlyVerificationReceipt: { expectedPath: "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/final-qualification-seal-verification-QrN8p4.json",
      createdAfterSealing: true, outsideManifestRootsAndSealCoverage: true, noSelfHashClaim: true },
    safety: evidence.safety, furtherAuthorizationGranted: false, stop: "Deliver the report and stop. No additional monitoring, implementation, financial or production operation is authorized." });
  const sealedRefs = [...coreRefs, reference(FILES.completion)];
  const seal = { schemaVersion: 1, kind: "DETACHED_LOCAL_FINAL_QUALIFICATION_INTEGRITY_SEAL", sealedAt: new Date().toISOString(),
    artifacts: sealedRefs, manifestFileCount: manifest.fileCount, manifestBytes: manifest.totalBytes,
    roots: manifest.roots.map(({ root, fileCount, totalBytes }) => ({ root, fileCount, totalBytes })),
    explicitlyExcludedManifestFiles: [...ENVELOPE],
    selfReference: { seal: FILES.seal, checksumSidecar: FILES.sealHash, noSelfHashClaim: true },
    trustLimit: "Local captured-byte integrity only; not independent custody/notarization or a defense against an administrator-compromised host.",
    decision: evidence.decision, monitor: "STOPPED", noFurtherAuthorization: true };
  newJson(FILES.seal, seal); newText(FILES.sealHash, `${reference(FILES.seal).sha256}  ${FILES.seal}\n`);
  assert.ok(sealedRefs.every(referenceValid));
  assert.equal(text(join(AUDIT, FILES.sealHash)), `${reference(FILES.seal).sha256}  ${FILES.seal}\n`);
  console.log(JSON.stringify({ status: "FINAL_COMPLETION_AND_SEAL_CREATED", completion: reference(FILES.completion), seal: reference(FILES.seal),
    manifestFiles: manifest.fileCount, manifestBytes: manifest.totalBytes, decision: evidence.decision }, null, 2));
}

try {
  assert.ok(["capture", "report", "manifest", "seal"].includes(mode), "Use capture, report, manifest or seal");
  if (mode === "capture") capture(); else if (mode === "report") report(); else if (mode === "manifest") manifest(); else seal();
} catch (error) { retainFailure(mode ?? "missing-mode", error, script); }
