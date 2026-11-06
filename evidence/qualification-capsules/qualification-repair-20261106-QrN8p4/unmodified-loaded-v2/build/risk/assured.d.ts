import type { ThresholdConfiguration } from "../config/risk.js";
import type { OracleAssurance } from "../oracle-assurance/model.js";
import type { RiskOptions } from "./engine.js";
import type { ProgressionEvidence } from "./eligibility.js";
import type { RiskDataQuality, RiskResult } from "./types.js";
export interface AssuredRiskResult extends RiskResult {
    oracleAssurance: OracleAssurance;
    phase2DataQuality: RiskDataQuality;
}
export interface AssuredRiskOptions extends RiskOptions {
    /** Independent chain-progression evidence. Absent/unknown progression always blocks recovery estimates;
     * this production code path does not yet supply it, so estimates fail closed (Phase 12C wires it). */
    progression?: ProgressionEvidence | undefined;
}
/** Phase 4 entrypoint: explicit assurance gate around the unchanged Phase 2 mathematical engine.
 * Recovery estimates are a separate stage and are computed only when every strict eligibility
 * condition passes; otherwise amounts are absent and bounded reason codes are recorded. */
export declare function calculateAssuredRisk(raw: unknown, assurance: OracleAssurance, thresholds?: ThresholdConfiguration, options?: AssuredRiskOptions): AssuredRiskResult;
