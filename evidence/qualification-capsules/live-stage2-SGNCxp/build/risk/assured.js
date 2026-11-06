import { assuranceSchema } from "../oracle-assurance/model.js";
import { worstQuality } from "../validation/quality.js";
import { calculateRisk } from "./engine.js";
import { evaluateRecoveryEligibility } from "./eligibility.js";
import { freezeResult } from "./provenance.js";
import { applyRecoveryEstimates } from "./recovery.js";
import { riskSnapshotSchema } from "./snapshot-schema.js";
import { effectiveRiskState } from "./thresholds.js";
/** Phase 4 entrypoint: explicit assurance gate around the unchanged Phase 2 mathematical engine.
 * Recovery estimates are a separate stage and are computed only when every strict eligibility
 * condition passes; otherwise amounts are absent and bounded reason codes are recorded. */
export function calculateAssuredRisk(raw, assurance, thresholds, options = {}) {
    const proof = assuranceSchema.parse(assurance);
    const phase2 = calculateRisk(raw, thresholds, options);
    const result = { ...structuredClone(phase2), phase2DataQuality: structuredClone(phase2.dataQuality), oracleAssurance: proof };
    const bound = proof.snapshotIdentifier === result.inputSnapshotIdentifier && (proof.block?.number ?? null) === (result.blockNumber?.toString() ?? null)
        && (proof.block?.hash ?? null) === result.blockHash && (proof.block?.timestamp ?? null) === (result.blockTimestamp?.toString() ?? null)
        && proof.evidenceKind === (result.evidenceKind ?? "UNAVAILABLE") && proof.retrievedAt === result.snapshotRetrievedAt
        && proof.independent.morphoPrice === (result.oraclePrice?.toString() ?? null)
        && proof.freshness.observationTimestamp === (result.oracleTimestamp?.toString() ?? null);
    const invalid = !bound && result.inputSnapshotIdentifier !== null;
    const quality = invalid || proof.gate === "DATA_INVALID" ? "INVALID" : proof.gate === "DATA_UNAVAILABLE" ? "UNAVAILABLE" : "UNVERIFIED";
    result.dataQuality.oracle = worstQuality([result.dataQuality.oracle, quality]);
    result.dataQuality.overall = worstQuality([result.dataQuality.overall, quality]);
    result.dataQuality.findings.push({ scope: "oracle", status: quality, code: invalid ? "ASSURANCE_SNAPSHOT_MISMATCH" : proof.gate,
        message: invalid ? "Oracle assurance does not belong to this exact snapshot/block." : `Explicit oracle assurance: ${proof.overall}; freshness: ${proof.freshness.state}; actionable: false.` });
    result.riskState = effectiveRiskState(result.dataQuality.overall, result.mathematicalRiskState);
    result.warnings.push("Phase 4 assurance gates the original Morpho price; independent prices never replace it.");
    if (["INVALID", "UNAVAILABLE", "STALE"].includes(result.dataQuality.overall)) {
        result.actionability = { actionable: false, status: "BLOCKED", reasons: [...result.actionability.reasons, "Explicit oracle assurance blocks recovery estimates."] };
    }
    const parsed = riskSnapshotSchema.safeParse(raw);
    const eligibility = evaluateRecoveryEligibility({
        phase2QualityOverall: result.phase2DataQuality.overall,
        positionComplete: Boolean(parsed.success && parsed.data.position && parsed.data.accounting && parsed.data.valuation
            && parsed.data.params && parsed.data.block && parsed.data.tokens.loan && parsed.data.tokens.collateral
            && parsed.data.oracle.price !== null && parsed.data.oracle.round && result.mathematicalRiskState !== null),
        mathematicalRiskState: result.mathematicalRiskState,
        identity: { chainId: result.chainId, account: result.account, marketId: result.marketId, snapshotIdentifier: result.inputSnapshotIdentifier },
        expectedSnapshotIdentifier: options.expectedSnapshotIdentifier,
        expectedIdentity: options.position?.identity,
        assurance: proof, progression: options.progression
    });
    result.recoveryEligibility = eligibility;
    if (eligibility.eligible && parsed.success) {
        applyRecoveryEstimates(result, parsed.data, result.thresholdConfiguration);
    }
    else {
        // Blocked: no solver runs, no amount exists, and every reason code is visible without exposing numbers.
        result.repayment = null;
        result.additionalCollateral = null;
        if (!["INVALID", "UNAVAILABLE", "STALE"].includes(result.dataQuality.overall)) {
            result.actionability = { ...result.actionability, reasons: [...result.actionability.reasons, ...eligibility.reasonCodes] };
        }
    }
    return freezeResult(result);
}
//# sourceMappingURL=assured.js.map