// Consolidate already captured evidence only. No RPC, monitor, wallet, notification or repository write.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const audit = dirname(fileURLToPath(import.meta.url)), repo = "C:/liquidation-watchdog", stage2 = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/live-stage2-SGNCxp";
const hash = bytes => createHash("sha256").update(bytes).digest("hex"), load = path => JSON.parse(readFileSync(path));
const rpc = load(join(audit, "oracle-rpc-audit/summary.json")), prior = load(join(stage2, "live-monitor-assurance.json"));
const research = load(join(audit, "public-oracle-research/summary.json"));
assert.equal(rpc.status, "BOUNDED_ORACLE_CONFIGURATION_READ_COMPLETE"); assert.equal(rpc.chainId, 1672); assert.equal(rpc.trace.length, 62);
assert.ok(rpc.trace.every(entry => ["eth_chainId", "eth_blockNumber", "eth_getBlockByNumber", "eth_getCode", "eth_call", "eth_getStorageAt"].includes(entry.method)));
for (const entry of rpc.trace) assert.equal(hash(readFileSync(join(audit, "oracle-rpc-audit", entry.bodyPath))), entry.responseSha256);
for (const source of research.results.filter(source => source.bodyPath)) assert.equal(hash(readFileSync(join(audit, "public-oracle-research", source.bodyPath))), source.responseSha256);
const pe = research.results.find(source => source.name === "pharos-chainlink-push-engine");
assert.equal(pe.status, 200); assert.equal(pe.responseSha256, "5d2c0bab0cb7a190ab7f37e327662427a2709fdb6e4905e74e57ae530e110b42");
const peText = readFileSync(join(audit, "public-oracle-research", pe.bodyPath), "utf8").split(/\n# Agent Instructions\b/)[0];
const publishedFeedRow = peText.split(/\r?\n/).find(line => line.includes(rpc.facade.getFeedId));
assert.ok(publishedFeedRow.includes("WSRUSD/RUSD") && publishedFeedRow.toLowerCase().includes(rpc.composition.BASE_FEED_1.toLowerCase()));
const registrySource = research.results.find(source => source.name === "reservoir-addresses");
const registryText = readFileSync(join(audit, "public-oracle-research", registrySource.bodyPath), "utf8");
const registryRows = [...registryText.matchAll(/<tr>(.*?)<\/tr>/gs)].map(match => [...match[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)]
  .map(cell => cell[1].replace(/<[^>]*>/g, "").trim())).filter(cells => cells.length >= 3);
const pharosCollateralRow = registryRows.find(cells => cells[0] === "wsrUSD" && cells[1].toLowerCase() === rpc.tokens.collateral.address.toLowerCase() && cells[2] === "Pharos");
assert.ok(pharosCollateralRow);
const requirements = {
  CONTRACT_IDENTITY: {
    required: ["CHAIN_AND_MARKET", "PINNED_RUNTIME_HASHES", "REPRODUCED_SOURCE"],
    facts: ["Stage 2's evaluated dependency identity is VERIFIED. The separate current audit matches all five reviewed dependency runtime SHA-256/Keccak hashes, re-derives the exact market ID, confirms the facade/cache/forwarder path and stable before/after header, and rechecks Stage 2's anchor.",
      "The collateral runtime also matches its historical bound hash. Loan runtime bytes are captured, but no prior reproduced loan-runtime identity pin was asserted."],
    prerequisites: ["Retain chain ID 1672, exact five market parameters and re-derived market ID, pinned number/hash/timestamp and stable before/after header.",
      "For all five pricing dependencies, retain full nonempty runtime bytes with both SHA-256 and Keccak matching verified-source/compiler-reproduction artifacts for those exact addresses and immutable settings.",
      "Any runtime, dependency, address, block or proxy-interpretation mismatch must invalidate rather than inherit prior identity. This gate proves code identity only, not economic correctness."],
    wiring: "Existing identity gate is implemented; current separate oracle audit corroborates facts but is not a new evaluated monitor assurance object."
  },
  SOURCE_PROVENANCE: {
    required: ["EXACT_FEED_PRODUCT", "WORKFLOW_SOURCE", "ECONOMIC_INPUTS"],
    facts: ["Official Pharos Pacific documentation explicitly maps the exact feed ID and facade to WSRUSD/RUSD and the cache address, and describes CRE periodically fetching Chainlink Data Streams reports.",
      "One previously sampled workflow ID remains allowed in current getters; a workflow identifier/allowlist entry is not its binary/source, upstream feed configuration or a complete enumeration."],
    prerequisites: ["Bind the exact chain-1672 feed ID/proxy/cache/product registry row to the active workflow/configuration at the qualified block with dated, full, hashed official deployment evidence.",
      "Obtain reviewed workflow program/source, immutable build/compiler information, deployed executable/configuration hash, and authenticated binding from that executable to the allowed workflow ID and DON/version/receiver.",
      "Obtain the exact Data Streams product/report schema and economic input sources, aggregation/normalization rules, wrapper/share/redemption semantics and handling of unavailable or old input data. Bind these to the active configuration, not generic CRE documentation.",
      "Resolve whether this is a redemption/share exchange rate or an executable market price, and the exact base/quote economic assets; do not infer either from a feed-ID prefix, matching token symbols or a near-1 answer."],
    wiring: "evaluateAssurance() SOURCE_V1 currently passes an empty satisfied list and a fixed UNKNOWN finding. Evidence ingestion and configuration-binding support are not implemented; new documents cannot automatically promote this gate."
  },
  OPERATOR_PROVENANCE: {
    required: ["SOURCE_OPERATOR", "SIGNER_OPERATORS", "CONTROLLER_IDENTITIES"],
    facts: ["Current facade/cache/forwarder owner addresses match Stage 2, and a known stored DON/version has f=3 with ten distinct signer addresses.",
      "Stage 2's matched historical report had four recovered signatures. Cryptographic distinctness does not prove distinct legal/operational organizations or independent economic sources."],
    prerequisites: ["Obtain dated authoritative identities and operating responsibilities for the economic input publisher, CRE/workflow executor and report/price publisher, explicitly tied to the chosen product and configuration.",
      "Bind every active signer key to its real-world operator and establish organizational/control independence rather than counting addresses. Bind rotation/version history to the pinned current configuration.",
      "Identify facade, cache, forwarder, workflow-owner and authorized-forwarder controllers, including contract/multisig/delegation ownership and operational/change controls. Do not treat on-chain owner addresses as identities or trust attestations."],
    wiring: "evaluateAssurance() OPERATOR_V1 currently has no qualified source/operator evidence ingestion and passes an empty satisfied list."
  },
  PRICE_SEMANTICS: {
    required: ["MECHANICAL_SCALING", "ECONOMIC_BASE_QUOTE", "FEED_DENOMINATION"],
    facts: ["Current getters bind collateral wsrUSD to 18 decimals, selected loan USDC to 6 decimals, the feed to 18 decimals and SCALE_FACTOR to 1000000. Oracle price equals feed answer times 1000000.",
      "Both vaults, second base feed and both quote feeds are zero. No active quote feed converts the publicly declared rUSD quote to the selected USDC loan.",
      "The issuer registry maps the exact chain-1672 collateral to wsrUSD. Issuer savings/redemption descriptions do not establish a wsrUSD/USDC market price or rUSD/USDC economic equivalence."],
    prerequisites: ["Retain exact chain/address/decimal identities and reproduced mechanical formula for all active vault/feed components, including the direction and whole-token versus base-unit denomination.",
      "Obtain authoritative exact-product base/quote denomination and wrapper/redemption/market semantics, bound to the active workflow/source/report schema.",
      "Resolve rUSD versus the selected USDC loan with explicit independently defensible conversion/valuation and exact chain/token provenance, or establish a separately authorized correctly denominated oracle/market design. A peg, ticker or assumed 1:1 relationship is not proof; no conversion or replacement was made in this task.",
      "Document that Morpho uses price * collateralBaseUnits / 10^36 to obtain loan base units. Numerically applying the 1000000 scale is not sufficient to qualify the published rUSD answer as a USDC price."],
    wiring: "evaluateAssurance() only satisfies MECHANICAL_SCALING. configurationSchema.denomination is literally ECONOMIC_QUOTE_UNVERIFIED; no configuration-bound qualified denomination can currently be represented."
  },
  FRESHNESS: {
    required: ["TIMESTAMP_SEMANTICS", "VERIFIED_HEARTBEAT", "UPSTREAM_FRESHNESS_GUARANTEE"],
    facts: ["Official documentation declares a common heartbeat of 3600 seconds, 18 decimals and deviation threshold 0.5. These are published facts, not a source/active-config-bound end-to-end guarantee.",
      "Current facade startedAt/updatedAt and cache timestamp agree; roundId/answeredInRound are zero. The timestamp is workflow-supplied observation time, not publication/inclusion time.",
      "Stage 2's observation age was 1333 seconds and its bounded sample interval was 3601 seconds. The current separate audit measures age 1103 seconds. None is a maximum-age or heartbeat guarantee.",
      "Reviewed cache ignores validFromTimestamp, skips non-increasing timestamps, allows future timestamps and does not expire readable answers. Morpho's feed consumer has no observation-age enforcement; local invalid timestamp/zero/negative checks remain unchanged."],
    prerequisites: ["For verified heartbeat H and upstream freshness maximum G, obtain two positive bounded parameters from full, dated, hashed verified-source/official artifacts that actually support each claim for the exact chain-1672 feed and active configuration.",
      "Bind H and G to the complete qualified configurationFingerprint, including active feed/workflow/DON/operator/input settings. A common settings table alone does not supply this binding or G.",
      "Document and verify input-observation timestamp semantics, maximum upstream input age, fetching/aggregation behavior, heartbeat/deviation triggers, publication delay/failure handling, and stale-report rejection. Do not label transaction inclusion time or local retrieval age as economic observation age.",
      "Each VerifiedTiming EvidenceRef must be confidence=PROVEN, artifactSha256 non-null, sourceKind VERIFIED_SOURCE or OFFICIAL_DOCUMENT, chainId 1672, subjectAddress the exact facade, with provenance and a valid 64-hex configuration fingerprint equal to the evaluator's active fingerprint.",
      "At evaluation, require nonzero observation time, nonnegative age <= G, startedAt/cache timestamp agreement and no future/regression/mismatch anomaly. Any explicit local age limit is only an additional rejection policy, not H or G. Preserve failure on expired/anomalous observations and explicit consumer non-expiry disclosure."],
    wiring: "analyzeFreshness() accepts VerifiedTiming, but evaluateAssurance() supplies neither verifiedHeartbeat, upstreamGuarantee nor configurationFingerprint and its FRESHNESS dimension retains fixed missing timing requirements. AssuranceOptions lacks qualified timing ingestion. This must be explicitly implemented and tested before promotion; this repair does not alter it."
  },
  INDEPENDENT_VALIDATION: {
    required: ["ASSET", "QUOTE", "DENOMINATION", "TIMESTAMP", "FREQUENCY", "OPERATOR", "PROVENANCE", "INDEPENDENCE", "EXPLICIT_TEMPORAL_POLICY", "EXPLICIT_TOLERANCE"],
    facts: ["No eligible comparator is configured; selectedUpstreamId is null. RPC/MCP are shared-upstream access paths, not independent economic sources.",
      "Official issuer redemption descriptions are not MARKET_PRICE. A differently denominated or cross-chain WSRUSD/RUSD feed cannot by itself match this exact Pharos wsrUSD/USDC market or establish independent inputs.",
      "Retained Chainlink research URLs returned 404; the Avalanche candidate returned 429. DexScreener exact-address responses returned no pairs. These are bounded research outcomes, not proof that no comparator exists anywhere."],
    prerequisites: ["Obtain an available MARKET_PRICE candidate for exact base chain1672/address0x4809010926aec940b550D34a46A52739f996D75D/18 decimals and quote chain1672/address0xC879C018dB60520F4355C26eD1a6D572cdAC1815/6 decimals, with strictly positive bounded price and exact normalization/denomination.",
      "Supply all eight hashed, subject/chain-bound PROVEN EvidenceRef claims: ASSET, QUOTE, DENOMINATION, TIMESTAMP, FREQUENCY, OPERATOR, PROVENANCE, INDEPENDENCE. The last four require verified-source/official-document evidence in production, never a fixture or arbitrary identifier.",
      "Establish both selected and comparator upstream/operator identities and actual source independence; distinct IDs, URLs, RPCs or signers are insufficient. Use a genuinely separate economic input path.",
      "Supply positive documented candidate update frequency, positive non-future candidate and selected observation times, explicit bounded maxAge/maxSkew policies and an explicit integer tolerance 0..10000 basis points. Both observations must pass age/alignment policy at the same block context.",
      "Retain original Morpho and independent raw prices separately. Normalize with exact rational arithmetic, compare within tolerance and preserve FAILED on disagreement; never substitute the comparator into the original snapshot."],
    wiring: "compareIndependent() enforces these conditions, but evaluateAssurance() deliberately supplies no selectedUpstreamId because the selected source identity is unresolved. Caller-supplied comparator labels cannot make this gate eligible."
  },
  CONFIGURATION_CONTROL: {
    required: ["PERMISSION_BOUNDARIES", "CURRENT_CONTROLLERS", "COMPLETE_SIGNER_CONFIGURATION", "CONTROLLER_IDENTITIES"],
    facts: ["Current getters match the three observed owners; optional allowedWorkflowOwner is zero and the known workflow ID remains allowed.",
      "Three EIP-1967 slots are zero; their interpretation uses full reproduced runtime/source evidence, not zero-slot inference alone.",
      "Current audit reads only one known stored signer config and workflow permission. It does not enumerate every active DON/version, workflow ID or separately owner-authorized route entry."],
    prerequisites: ["Bind reproduced permission boundaries and all exact current owner/controller/proxy/forwarder/workflow getters to the pinned block and runtime hashes.",
      "Obtain complete, provenance-bound active signer configurations, authorized forwarder routes and workflow permissions, including creation/removal/rotation history or an authoritative complete registry at the block. A bounded sample is not COMPLETE coverage.",
      "Bind these addresses to verified controller/operator identities and their administrative/multisig/change-management responsibilities.",
      "Retain a complete active configuration fingerprint and continuity baseline. Requalify after relevant owner/feed/runtime/workflow/signer/denomination change or observability gap; do not clear sticky invalidation merely because a later sample looks unchanged."],
    wiring: "Current gate proves permission boundaries/current addresses only; complete coverage and real-world controller identities remain missing. Configuration fingerprints presently include sampled rather than complete signer/workflow evidence."
  }
};
const dimensions = Object.fromEntries(Object.entries(requirements).map(([name, entry]) => [name, { historicalEvaluatedState: prior.dimensions[name].state,
  historicalSatisfied: prior.dimensions[name].satisfied, historicalMissing: prior.dimensions[name].missing, requiredForVerified: entry.required,
  retainedAndNewResearchFacts: entry.facts, exactPromotionPrerequisites: entry.prerequisites, implementationGapOrScope: entry.wiring }]));
const sourceReferences = ["src/oracle-assurance/evaluate.ts", "src/oracle-assurance/model.ts", "src/oracle-assurance/freshness.ts",
  "src/oracle-assurance/independent.ts", "src/oracle-assurance/configuration.ts", "src/risk/eligibility.ts",
  "evidence/phase1/sources/SelfManagedFeedsCache.sol", "evidence/phase1/sources/SelfManagedFeedsCacheProxy.sol", "evidence/phase1/sources/KeystoneForwarder.sol"]
  .map(path => ({ path, bytes: readFileSync(join(repo, path)).length, sha256: hash(readFileSync(join(repo, path))) }));
const result = { schemaVersion: 1, status: "EVIDENCE_GAPS_IDENTIFIED_NO_GATE_PROMOTION", analyzedAt: new Date().toISOString(),
  decision: "NO-GO", monitor: "STOPPED", noNewEvaluatedMonitorAssurance: true,
  pinnedOracleOnlyAudit: { block: rpc.block, startedAt: rpc.startedAt, completedAt: rpc.completedAt, requestCount: rpc.trace.length,
    summarySha256: hash(readFileSync(join(audit, "oracle-rpc-audit/summary.json"))), stage2AnchorRechecked: rpc.stage2AnchorRechecked,
    scope: "Fixed oracle/market configuration, token metadata, runtime and known configuration reads only; no borrower, balances, accrued debt or health-factor cycle." },
  publishedFacts: { feedRow: publishedFeedRow, document: pe, pharosCollateralRegistryRow: pharosCollateralRow,
    heartbeatSeconds: 3600, feedDecimals: 18, declaredDeviationThreshold: "0.5", heartbeatIsNotUpstreamMaximumAge: true,
    productQuote: "rUSD", selectedMarketLoan: rpc.tokens.loan, noActiveQuoteConversion: true },
  historicalEvaluatedResult: { block: prior.block, overall: prior.overall, gate: prior.gate, configurationFingerprint: prior.configurationFingerprint,
    verifiedHeartbeatSeconds: prior.freshness.verifiedHeartbeatSeconds, upstreamFreshnessGuaranteeSeconds: prior.freshness.upstreamFreshnessGuaranteeSeconds,
    timingConfigurationFingerprint: prior.freshness.timingConfigurationFingerprint, independent: { state: prior.independent.state, eligible: prior.independent.eligible,
      selectedUpstreamId: prior.independent.selectedUpstreamId } },
  dimensions, sourceReferences,
  productionCapabilitiesMissing: ["Configuration-bound workflow/source/operator evidence ingestion for SOURCE_V1 and OPERATOR_V1.",
    "A schema capable of representing verified exact economic base/quote denomination, rather than the literal ECONOMIC_QUOTE_UNVERIFIED.",
    "Validated VerifiedTiming ingestion and active-fingerprint binding through evaluateAssurance(), with dynamically fulfilled FRESHNESS requirements.",
    "Selected upstream identity established from verified evidence and supplied to independent validation only after actual source independence is qualified.",
    "Complete current signer/workflow/authorized-route/controller evidence and post-change invalidation/requalification lifecycle."],
  recoveryBlockedReasonsRetained: ["RECOVERY_CHAIN_PROGRESSION_UNKNOWN", "RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED", "RECOVERY_ASSURANCE_GATE_NOT_MET",
    "RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED", "RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED", "RECOVERY_CONFIGURATION_MISMATCH"],
  recoveryPromotionPrerequisites: ["All seven assurance dimensions VERIFIED with referenced PROVEN hashed evidence; gate ASSURANCE_REQUIREMENTS_MET and no invalidation or observation anomaly.",
    "Freshness timingConfigurationFingerprint exactly equals the complete active assurance configurationFingerprint; independent comparison VERIFIED and eligible.",
    "A separately authorized real position observation/progression sequence establishes ADVANCING for the exact identity and complete valid snapshot, without reusing oracle-only reads or old Stage 2 data as a new baseline.",
    "Qualified deployment/host/channel/operational acceptance and explicit authorization before real continuous monitoring or any financial workflow. No future operation is authorized by this report."],
  safety: { readExistingEvidenceOnly: true, noGateOrApplicationCodeChange: true, realMonitorStopped: true, financialRecoveryAmountsProduced: false,
    independentPriceSubstitution: false, noOwnerContact: true, noTransactionsOrWalletOperations: true, noPaidServices: true } };
writeFileSync(join(audit, "oracle-qualification-gaps.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: result.status, decision: result.decision, auditBlock: rpc.block, publishedProduct: "WSRUSD/RUSD", declaredHeartbeatSeconds: 3600,
  historicalOverall: prior.overall, historicalGate: prior.gate,
  dimensions: Object.fromEntries(Object.entries(dimensions).map(([name, entry]) => [name, { state: entry.historicalEvaluatedState,
    required: entry.requiredForVerified, prerequisiteCount: entry.exactPromotionPrerequisites.length }])),
  productionCapabilitiesMissing: result.productionCapabilitiesMissing, recoveryBlockedReasonsRetained: result.recoveryBlockedReasonsRetained }, null, 2));
