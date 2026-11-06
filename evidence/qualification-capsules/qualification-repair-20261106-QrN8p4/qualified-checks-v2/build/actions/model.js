import { z } from "zod";
import { NETWORK } from "../config/deployment.js";
import { progressionReasonSchema, progressionStateSchema } from "../chain/progression.js";
import { RECOVERY_ELIGIBILITY_REASONS } from "../risk/eligibility.js";
import { assuranceStateSchema, changeCodeSchema, timestampAnomalySchema } from "../oracle-assurance/model.js";
const utc = z.iso.datetime();
const unsigned = z.string().regex(/^(?:0|[1-9][0-9]{0,77})$/);
const hash = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const snapshotId = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const instruction = z.string().min(1).max(1_000).refine(value => [...value].every(character => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
}));
export const suggestedActionRationaleSchema = z.enum([
    "STRICT_RECOVERY_ELIGIBILITY_PASSED", "POSITION_REQUIRES_REVIEW", "DATA_REQUIRES_REFRESH",
    "ORACLE_REQUIRES_VERIFICATION", "CONTINUE_MONITORING", "LEGACY_ALERT_WITHOUT_PERSISTED_ACTION"
]);
const recoveryReasonSchema = z.enum(RECOVERY_ELIGIBILITY_REASONS);
export const actionEvidenceSchema = z.object({
    status: z.enum(["QUALIFIED_FINANCIAL", "NOT_QUALIFIED", "LEGACY_UNAVAILABLE"]),
    cycleId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).nullable(),
    chainId: z.literal(NETWORK.chainId).nullable(), account: address.nullable(), marketId: hash.nullable(),
    snapshotIdentifier: snapshotId.nullable(), blockNumber: unsigned.nullable(), blockHash: hash.nullable(), blockTimestamp: unsigned.nullable(),
    progressionState: progressionStateSchema.nullable(), progressionReason: progressionReasonSchema,
    oracleAssurance: assuranceStateSchema.nullable(), oracleFreshness: assuranceStateSchema.nullable(),
    independentValidation: assuranceStateSchema.nullable(), evidenceInvalidated: z.boolean().nullable(),
    oracleObservationTimestamp: unsigned.nullable(), timestampAnomalies: z.array(timestampAnomalySchema).max(4),
    configurationChanges: z.array(changeCodeSchema).max(6),
    recoveryEligibility: z.object({ eligible: z.boolean(), status: z.enum(["ELIGIBLE", "BLOCKED"]),
        reasonCodes: z.array(recoveryReasonSchema).max(14) }).strict().nullable()
}).strict();
export const suggestedFinancialOptionSchema = z.object({
    type: z.enum(["REPAY", "ADD_COLLATERAL"]), amountRaw: unsigned,
    amountFormatted: z.string().regex(/^[0-9]+(?:\.[0-9]+)?$/), assetAddress: address, assetDecimals: z.number().int().min(0).max(77),
    chainId: z.literal(NETWORK.chainId), account: address, marketId: hash, targetRatio: unsigned,
    calculationMethod: z.enum(["morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint", "morpho-v1.0.0/nested-ceilings/forward-minimality-proof"]),
    snapshotIdentifier: snapshotId, blockNumber: unsigned, blockHash: hash, calculatedAt: utc,
    oracleObservationTimestamp: unsigned, freshness: z.literal("VERIFIED"),
    condition: z.literal("REFRESH_AND_SIMULATE_BEFORE_ANY_TRANSACTION"), actionable: z.literal(false)
}).strict();
const base = {
    schemaVersion: z.literal(1), origin: z.enum(["GENERATED", "LEGACY_DERIVED"]),
    instruction, rationale: suggestedActionRationaleSchema, createdAt: utc,
    evidence: actionEvidenceSchema, actionable: z.literal(false)
};
const nonFinancialActionSchema = z.object({ ...base, type: z.literal("NON_FINANCIAL"), financialOptions: z.tuple([]) }).strict();
const financialActionSchema = z.object({ ...base, type: z.literal("FINANCIAL_OPTION"),
    financialOptions: z.array(suggestedFinancialOptionSchema).min(1).max(2) }).strict();
export const suggestedActionSchema = z.discriminatedUnion("type", [nonFinancialActionSchema, financialActionSchema]);
/** Legacy rows are upgraded only after their original bytes/integrity bindings are checked. Never infer an amount. */
export function legacySuggestedAction(createdAt) {
    return suggestedActionSchema.parse({ schemaVersion: 1, origin: "LEGACY_DERIVED", type: "NON_FINANCIAL",
        instruction: "Review this legacy alert and independently verify the current position and oracle state; no suggested action was persisted with the original alert.",
        rationale: "LEGACY_ALERT_WITHOUT_PERSISTED_ACTION", createdAt, actionable: false, financialOptions: [],
        evidence: { status: "LEGACY_UNAVAILABLE", cycleId: null, chainId: null, account: null, marketId: null,
            snapshotIdentifier: null, blockNumber: null, blockHash: null,
            blockTimestamp: null, progressionState: null, progressionReason: null, oracleAssurance: null, oracleFreshness: null,
            independentValidation: null, evidenceInvalidated: null, oracleObservationTimestamp: null,
            timestampAnomalies: [], configurationChanges: [], recoveryEligibility: null } });
}
//# sourceMappingURL=model.js.map