import { zeroAddress } from "viem";
import { DEPLOYMENT, NETWORK } from "../config/deployment.js";
import { stringify } from "../domain/serialize.js";
import { freezeResult, snapshotIdentifier } from "../risk/provenance.js";
import { riskSnapshotSchema } from "../risk/snapshot-schema.js";
import { validateRiskSnapshot } from "../risk/validate.js";
import { configurationChanges, configurationFingerprint, configurationFromSnapshot, configurationObservabilityLost, IDENTITY_PINS, validateContractIdentity } from "./configuration.js";
import { sha256 } from "./evidence.js";
import { analyzeFreshness } from "./freshness.js";
import { compareIndependent } from "./independent.js";
import { assuranceSchema, DIMENSIONS, dimensionSchema, evidenceRefSchema } from "./model.js";
import { ISSUER_IDENTITY_EVIDENCE, REVIEWED_RECOMPILATION, REVIEWED_SOURCES } from "./reviewed.js";
import { supplementalResultSchema } from "./supplemental.js";
/** All mandatory requirements must be proved; partial facts cannot compensate for a missing requirement. */
export function evaluateRule(rule, requirements, satisfied, findingIds, failure = false, noEvidence = "UNKNOWN") {
    const met = requirements.filter(requirement => satisfied.includes(requirement)), missing = requirements.filter(requirement => !met.includes(requirement));
    return dimensionSchema.parse({ rule, satisfied: met, missing, findingIds,
        state: failure ? "FAILED" : missing.length === 0 ? "VERIFIED" : met.length ? "PARTIALLY_VERIFIED" : noEvidence });
}
export function overallAssurance(dimensions, invalidated = false) {
    if (DIMENSIONS.some(dimension => dimensions[dimension].state === "FAILED"))
        return "FAILED";
    return !invalidated && DIMENSIONS.every(dimension => dimensions[dimension].state === "VERIFIED") ? "VERIFIED" : "UNVERIFIED";
}
export const oracleContinuityScope = (kind, block) => kind === "FIXTURE" ? "FIXTURE" : kind === "HISTORICAL_SNAPSHOT" && block !== undefined ? `HISTORICAL-${block}` : "LIVE";
export function evaluateAssurance(raw, options = {}) {
    const now = (options.now ?? new Date()).toISOString();
    const parsed = riskSnapshotSchema.safeParse(raw), snapshot = parsed.success ? parsed.data : null;
    const block = snapshot?.block ? { number: snapshot.block.number.toString(), hash: snapshot.block.hash, timestamp: snapshot.block.timestamp.toString() } : null;
    const identifier = snapshot === null ? null : snapshotIdentifier(snapshot);
    const suppliedPrevious = options.previous ? assuranceSchema.parse(options.previous) : null;
    const continuityScope = options.block !== undefined ? `HISTORICAL-${options.block}` : snapshot
        ? oracleContinuityScope(snapshot.evidenceKind, snapshot.block?.number) : suppliedPrevious?.continuityScope ?? "LIVE";
    const previous = suppliedPrevious?.continuityScope === continuityScope ? suppliedPrevious : null;
    const priorBaseline = previous?.baseline ?? null;
    const validation = snapshot ? validateRiskSnapshot(structuredClone(snapshot), new Date(now), options.position) : null;
    const identity = snapshot ? validateContractIdentity(snapshot) : "UNKNOWN";
    const parsedSupplemental = supplementalResultSchema.safeParse(options.supplemental);
    const supplemental = parsedSupplemental.success ? parsedSupplemental.data : undefined;
    const supplementalBound = supplemental !== undefined && block !== null && supplemental.block.number === block.number && supplemental.block.hash === block.hash
        && supplemental.block.timestamp === block.timestamp && supplemental.historyTo === block.number && BigInt(supplemental.historyFrom) <= BigInt(block.number);
    const supplementalUsable = supplementalBound && supplemental?.status === "BOUNDED_READ_COMPLETE";
    const boundSource = (subjectAddress, confidence = identity === "VERIFIED" ? "PROVEN" : "UNKNOWN") => evidenceRefSchema.parse({
        subjectAddress, chainId: NETWORK.chainId, source: identifier ?? "snapshot:unavailable", sourceKind: snapshot?.evidenceKind === "FIXTURE" ? "FIXTURE" : "SNAPSHOT",
        block, retrievedAt: snapshot?.retrievedAt ?? now, method: "Snapshot address, block, runtime hashes and RPC/MCP consistency reviewed; canonical snapshot identifier and serialized artifact hash are separate.",
        artifactSha256: snapshot ? sha256(stringify(snapshot) + "\n") : null, confidence, unresolved: ["RPC/MCP agreement is not independent consensus or proof of economic correctness."]
    });
    const refs = (subject) => [boundSource(subject), ...REVIEWED_SOURCES.filter(ref => ref.subjectAddress.toLowerCase() === subject.toLowerCase())];
    const configuration = snapshot && block ? configurationFromSnapshot(snapshot, supplementalUsable ? supplemental.configuration : {}) : null;
    const fingerprint = configuration ? configurationFingerprint(configuration) : null;
    const previousBlock = priorBaseline?.block ?? previous?.block;
    const timelineConflict = block !== null && previousBlock != null && (BigInt(block.number) < BigInt(previousBlock.number)
        || (block.number === previousBlock.number && block.hash !== previousBlock.hash));
    const changes = priorBaseline && configuration && !timelineConflict ? configurationChanges(priorBaseline.configuration, configuration) : [];
    if (supplementalBound && previousBlock && block && !timelineConflict) {
        for (const event of supplemental.events)
            if (BigInt(event.blockNumber) > BigInt(previousBlock.number) && BigInt(event.blockNumber) <= BigInt(block.number))
                changes.push(event.code);
    }
    const gap = priorBaseline !== null && (timelineConflict || configurationObservabilityLost(priorBaseline.configuration, configuration)
        || validation?.overall === "UNAVAILABLE" || (priorBaseline.configuration.proxyImplementation !== null
        && (!supplementalUsable || (previousBlock != null && BigInt(supplemental.historyFrom) > BigInt(previousBlock.number) + 1n))));
    const invalidated = previous?.evidenceInvalidated === true || changes.length > 0 || gap;
    const findings = [];
    const add = (id, subjectAddress, statement, classification, unresolved, evidence = refs(subjectAddress)) => {
        findings.push({ id, subjectAddress, statement, classification, evidence, unresolved });
    };
    for (const [index, pin] of IDENTITY_PINS.entries())
        add(`RUNTIME_${index}`, pin.address, `Runtime identity result for the exact selected dependency: ${identity}.`, identity === "VERIFIED" ? "PROVEN" : "UNKNOWN", identity === "VERIFIED" ? [] : ["The complete bound dependency identity could not be established."], [boundSource(pin.address), ...REVIEWED_RECOMPILATION.filter(ref => ref.subjectAddress.toLowerCase() === pin.address.toLowerCase())]);
    const semantics = identity === "VERIFIED";
    const composition = snapshot?.oracle.composition;
    const scaleKnown = semantics && composition !== null && composition !== undefined && composition.baseVault === zeroAddress && composition.quoteVault === zeroAddress
        && composition.baseFeed1 === DEPLOYMENT.feed && composition.baseFeed2 === zeroAddress && composition.quoteFeed1 === zeroAddress && composition.quoteFeed2 === zeroAddress
        && composition.scaleFactor === DEPLOYMENT.scaleFactor && snapshot?.oracle.decimals === DEPLOYMENT.feedDecimals
        && snapshot.tokens.collateral?.decimals === DEPLOYMENT.collateralDecimals && snapshot.tokens.loan?.decimals === DEPLOYMENT.loanDecimals;
    const price = snapshot?.oracle.price ?? null, answer = snapshot?.oracle.round?.answer ?? null;
    const invalidPrice = (price !== null && price <= 0n) || (answer !== null && answer <= 0n) || (scaleKnown && price !== null && answer !== null && price !== answer * DEPLOYMENT.scaleFactor);
    const sameTimeline = priorBaseline !== null && block !== null && !timelineConflict;
    const freshness = analyzeFreshness({
        blockTimestamp: snapshot?.block?.timestamp ?? null, observationTimestamp: snapshot?.oracle.round?.updatedAt ?? null,
        startedAt: snapshot?.oracle.round?.startedAt ?? null, cacheTimestamp: snapshot?.oracle.cacheTimestamp ?? null,
        previousTimestamp: sameTimeline && priorBaseline.observationTimestamp !== null ? BigInt(priorBaseline.observationTimestamp) : null,
        localMaxAgeSeconds: options.localMaxAgeSeconds ?? null, semanticsVerified: semantics, evidence: refs(DEPLOYMENT.feed)
    });
    // The selected source identity is unresolved. No caller-supplied ID can assert independence from it.
    const independent = compareIndependent({
        base: { chainId: NETWORK.chainId, address: DEPLOYMENT.collateralToken, decimals: DEPLOYMENT.collateralDecimals },
        quote: { chainId: NETWORK.chainId, address: DEPLOYMENT.loanToken, decimals: DEPLOYMENT.loanDecimals },
        morphoPrice: price, blockTimestamp: snapshot?.block?.timestamp ?? null, selectedTimestamp: snapshot?.oracle.round?.updatedAt ?? null,
        ...(options.independentCandidate ? { candidate: options.independentCandidate } : {}),
        ...(options.independentToleranceBps === undefined ? {} : { toleranceBps: options.independentToleranceBps }),
        ...(options.independentMaxAgeSeconds === undefined ? {} : { maxAgeSeconds: options.independentMaxAgeSeconds }),
        ...(options.independentMaxSkewSeconds === undefined ? {} : { maxSkewSeconds: options.independentMaxSkewSeconds })
    });
    add("DEPENDENCY_GRAPH", DEPLOYMENT.oracle, "Market oracle reads a cache/feed facade; the facade owner can change its cache and feed ID. No economic upstream identity follows from these addresses.", semantics ? "PROVEN" : "UNKNOWN", ["Underlying economic source and feed operator identities are unresolved."]);
    add("SNAPSHOT_VALIDATION", DEPLOYMENT.oracle, `Unchanged Phase 2 input validation: ${validation?.overall ?? (raw == null ? "UNAVAILABLE" : "INVALID")}; block continuity conflict: ${timelineConflict}.`, validation && ["VALID", "UNVERIFIED"].includes(validation.overall) ? "PROVEN" : "UNKNOWN", ["Snapshot validation does not establish the economic origin of a feed answer."]);
    add("SOURCE_PROVENANCE", DEPLOYMENT.cache, "The exact economic source behind the selected feed ID has not been established.", "UNKNOWN", ["Workflow source code, feed-ID product mapping, aggregation inputs and economic quote remain unverified."]);
    add("OPERATOR_PROVENANCE", snapshot?.oracle.forwarder ?? IDENTITY_PINS[4].address, "On-chain owners, workflow identifiers and signer addresses do not identify their real-world operators.", "UNKNOWN", ["Legal/operator identities, upstream independence and operational responsibilities are unverified."]);
    add("PRICE_SEMANTICS", DEPLOYMENT.oracle, scaleKnown ? "Mechanical conversion: feed answer times 1000000; 18 feed decimals, 18 collateral decimals, 6 loan decimals, Morpho price scale 10^36." : "Mechanical price units could not be fully validated.", scaleKnown ? "PROVEN" : "UNKNOWN", ["The economic quote of the workflow answer is not proved; token symbols are insufficient."]);
    add("TIMESTAMP_SEMANTICS", DEPLOYMENT.feed, semantics ? "updatedAt and startedAt are the cache's workflow-supplied observation timestamp; round IDs are zero and historical round getters revert." : "Timestamp implementation semantics are not bound to the observed runtime.", semantics ? "PROVEN" : "UNKNOWN", ["Observation time is claimed by the workflow; it is not the transaction publication time."]);
    add("CACHE_EXPIRY", DEPLOYMENT.cache, semantics ? "Updates with timestamp less than or equal to the stored timestamp are skipped. The cache ignores validFromTimestamp, accepts future timestamps and has no age expiry; old answers remain readable." : "Cache expiry behavior is unresolved for this runtime.", semantics ? "PROVEN" : "UNKNOWN", ["No verified heartbeat or upstream maximum-age guarantee is available."]);
    add("CONSUMER_EXPIRY", DEPLOYMENT.oracle, semantics ? "The bound feed library rejects negative answers but does not enforce observation age; the local reader also rejects zero and invalid timestamps." : "Consumer validation semantics are not bound to the observed runtime.", semantics ? "PROVEN" : "UNKNOWN", ["Successful price reads cannot establish freshness."]);
    add("INDEPENDENT_VALIDATION", DEPLOYMENT.collateralToken, "No independently qualified, temporally aligned collateral/loan market-price comparator is configured. Original Morpho and candidate prices remain separate.", "UNKNOWN", ["Issuer redemption information and differently denominated or cross-chain feeds are not substitutes."]);
    add("COLLATERAL_ISSUER_REGISTRY", DEPLOYMENT.collateralToken, "Reservoir issuer registry research for the exact Pharos collateral address; see the retained source evidence.", ISSUER_IDENTITY_EVIDENCE.confidence, ["Issuer identity is not a verified market price or proof of this oracle's quote."], [ISSUER_IDENTITY_EVIDENCE]);
    add("CONFIGURATION_CONTROL", DEPLOYMENT.cache, "Owners can change cache/feed forwarding, workflow permissions and forwarder signers; source inspection defines permissions, not controller trustworthiness.", semantics ? "PROVEN" : "UNKNOWN", ["All active signer configurations and authorized forwarder entries are not enumerated."]);
    if (options.localMaxAgeSeconds != null)
        add("LOCAL_FRESHNESS_POLICY", DEPLOYMENT.feed, `Operator-defined maximum observation age ${options.localMaxAgeSeconds} seconds is a local rejection policy only.`, "PROVEN", ["Passing this policy does not prove a heartbeat or an upstream freshness guarantee."], [{ ...boundSource(DEPLOYMENT.feed), sourceKind: "LOCAL_POLICY", source: "policy:operator-defined-local-maximum-age", method: "Explicit local rejection threshold; never interpreted as a feed guarantee." }]);
    if (supplemental)
        add("BOUNDED_HISTORY", DEPLOYMENT.cache, `Supplemental investigation: ${supplementalBound ? supplemental.status : "UNBOUND_RESULT_REJECTED"}; history is explicitly bounded.`, supplementalUsable ? "PROVEN" : "UNKNOWN", supplemental.limitations, [{ ...boundSource(DEPLOYMENT.cache, supplementalUsable ? "PROVEN" : "UNKNOWN"), source: NETWORK.rpc, sourceKind: "RPC", retrievedAt: supplemental.retrievedAt,
                artifactSha256: sha256(stringify(supplemental) + "\n"), method: "Bounded logs, matched receipts/calldata and runtime-bound storage layout at the identified block." }]);
    else if (options.supplemental !== undefined)
        add("BOUNDED_HISTORY", DEPLOYMENT.cache, "Malformed supplemental evidence rejected before configuration or provenance evaluation.", "UNKNOWN", ["Malformed supplemental fields were not retained."]);
    const identityRequirements = ["CHAIN_AND_MARKET", "PINNED_RUNTIME_HASHES", "REPRODUCED_SOURCE"];
    const identitiesReproduced = IDENTITY_PINS.every(pin => REVIEWED_RECOMPILATION.some(ref => ref.subjectAddress.toLowerCase() === pin.address.toLowerCase() && ref.confidence === "PROVEN"));
    const dimensions = {
        CONTRACT_IDENTITY: evaluateRule("IDENTITY_V1", identityRequirements, identity === "VERIFIED" ? ["CHAIN_AND_MARKET", "PINNED_RUNTIME_HASHES", ...(identitiesReproduced ? ["REPRODUCED_SOURCE"] : [])] : [], IDENTITY_PINS.map((_, index) => `RUNTIME_${index}`), identity === "FAILED"),
        SOURCE_PROVENANCE: evaluateRule("SOURCE_V1", ["EXACT_FEED_PRODUCT", "WORKFLOW_SOURCE", "ECONOMIC_INPUTS"], [], ["SOURCE_PROVENANCE"], false, "UNVERIFIED"),
        OPERATOR_PROVENANCE: evaluateRule("OPERATOR_V1", ["SOURCE_OPERATOR", "SIGNER_OPERATORS", "CONTROLLER_IDENTITIES"], [], ["OPERATOR_PROVENANCE"], false, "UNVERIFIED"),
        PRICE_SEMANTICS: evaluateRule("SEMANTICS_V1", ["MECHANICAL_SCALING", "ECONOMIC_BASE_QUOTE", "FEED_DENOMINATION"], scaleKnown ? ["MECHANICAL_SCALING"] : [], ["PRICE_SEMANTICS"], invalidPrice),
        FRESHNESS: { state: freshness.state, rule: "FRESHNESS_V1", satisfied: semantics ? ["TIMESTAMP_SEMANTICS"] : [], missing: ["VERIFIED_HEARTBEAT", "UPSTREAM_FRESHNESS_GUARANTEE"], findingIds: ["TIMESTAMP_SEMANTICS", "CACHE_EXPIRY", "CONSUMER_EXPIRY"] },
        INDEPENDENT_VALIDATION: { state: independent.state, rule: "INDEPENDENCE_V1", satisfied: independent.eligible ? ["ELIGIBLE_SOURCE"] : [], missing: independent.reasons, findingIds: ["INDEPENDENT_VALIDATION"] },
        CONFIGURATION_CONTROL: evaluateRule("CONTROL_V1", ["PERMISSION_BOUNDARIES", "CURRENT_CONTROLLERS", "COMPLETE_SIGNER_CONFIGURATION", "CONTROLLER_IDENTITIES"], semantics ? ["PERMISSION_BOUNDARIES", ...(snapshot?.oracle.proxyOwner && snapshot.oracle.cacheOwner && snapshot.oracle.forwarderOwner ? ["CURRENT_CONTROLLERS"] : [])] : [], ["CONFIGURATION_CONTROL"])
    };
    if (invalidated)
        for (const dimension of DIMENSIONS) {
            const record = dimensions[dimension];
            if (["VERIFIED", "PARTIALLY_VERIFIED"].includes(record.state)) {
                record.state = "UNVERIFIED";
                record.missing.push("POST_CHANGE_REEVALUATION_REQUIRED");
            }
        }
    const overall = overallAssurance(dimensions, invalidated);
    const unavailable = snapshot === null || price === null || snapshot.oracle.quality === "UNAVAILABLE" || validation?.overall === "UNAVAILABLE"
        || (supplementalBound && supplemental?.status === "UNAVAILABLE") || independent.availability === "UNAVAILABLE";
    const invalid = (raw != null && snapshot === null) || timelineConflict || ["INVALID", "STALE"].includes(validation?.overall ?? "")
        || identity === "FAILED" || invalidPrice || freshness.state === "FAILED" || independent.state === "FAILED" || (options.supplemental !== undefined && !supplementalBound);
    // Retain the last complete observation through gaps. Never label carried values as reads at a newer block.
    const baseline = snapshot && block && identifier && configuration && fingerprint && identity === "VERIFIED" && !invalid && !unavailable
        && (!priorBaseline || !configurationObservabilityLost(priorBaseline.configuration, configuration))
        ? { block, retrievedAt: snapshot.retrievedAt, snapshotIdentifier: identifier, configuration, configurationFingerprint: fingerprint,
            observationTimestamp: freshness.observationTimestamp } : priorBaseline;
    return freezeResult(assuranceSchema.parse({ schemaVersion: 1, policyVersion: "oracle-assurance-v1", chainId: NETWORK.chainId, marketId: DEPLOYMENT.marketId, oracleAddress: DEPLOYMENT.oracle,
        evaluatedAt: now, retrievedAt: snapshot?.retrievedAt ?? null, evidenceKind: snapshot?.evidenceKind ?? "UNAVAILABLE", block, snapshotIdentifier: identifier,
        continuityScope, baseline,
        overall, actionable: false, gate: invalid ? "DATA_INVALID" : unavailable ? "DATA_UNAVAILABLE" : overall === "VERIFIED" ? "ASSURANCE_REQUIREMENTS_MET" : "DATA_UNVERIFIED",
        dimensions, configuration, configurationFingerprint: fingerprint, changes: [...new Set(changes)], evidenceInvalidated: invalidated,
        invalidatedAt: invalidated ? previous?.invalidatedAt ?? now : null,
        invalidationReason: invalidated ? previous?.invalidationReason ?? (changes.length ? "CONFIGURATION_CHANGE" : "OBSERVABILITY_GAP") : null,
        freshness, independent, findings, providerIndependence: "RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT",
        limitations: ["Economic source, operator identities and heartbeat remain unverified.", "Independent comparison is unavailable without an independently established upstream relationship and exact economic denomination.",
            "A bounded historical scan is not complete configuration enumeration.", "All recovery estimates remain indicative and non-actionable."]
    }));
}
//# sourceMappingURL=evaluate.js.map