import type { IndependentCandidate } from "./independent.js";
import type { AssuranceState, OracleAssurance } from "./model.js";
import type { PositionConfiguration } from "../config/position.js";
/** All mandatory requirements must be proved; partial facts cannot compensate for a missing requirement. */
export declare function evaluateRule(rule: string, requirements: readonly string[], satisfied: readonly string[], findingIds: string[], failure?: boolean, noEvidence?: AssuranceState): {
    state: "UNVERIFIED" | "VERIFIED" | "PARTIALLY_VERIFIED" | "UNKNOWN" | "FAILED";
    rule: string;
    satisfied: string[];
    missing: string[];
    findingIds: string[];
};
export declare function overallAssurance(dimensions: OracleAssurance["dimensions"], invalidated?: boolean): AssuranceState;
export interface AssuranceOptions {
    now?: Date;
    previous?: OracleAssurance | null;
    supplemental?: unknown;
    localMaxAgeSeconds?: bigint | null;
    independentCandidate?: IndependentCandidate;
    independentToleranceBps?: number;
    independentMaxAgeSeconds?: bigint;
    independentMaxSkewSeconds?: bigint;
    block?: bigint;
    position?: PositionConfiguration;
}
export declare const oracleContinuityScope: (kind: OracleAssurance["evidenceKind"], block?: bigint) => string;
export declare function evaluateAssurance(raw: unknown, options?: AssuranceOptions): OracleAssurance;
