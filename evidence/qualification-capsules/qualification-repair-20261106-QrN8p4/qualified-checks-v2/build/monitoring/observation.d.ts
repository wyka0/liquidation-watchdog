import type { ThresholdConfiguration } from "../config/risk.js";
import type { OracleAssurance } from "../oracle-assurance/model.js";
import type { SupplementalResult } from "../oracle-assurance/supplemental.js";
import type { Diagnostic, Observation } from "./model.js";
import type { PositionConfiguration } from "../config/position.js";
/** Phase 2 owns all validation and financial arithmetic. This gate owns only monitoring context. */
export declare function observe(raw: unknown, cycleId: string, now: Date, thresholds: ThresholdConfiguration, options?: {
    block?: bigint;
    diagnostic?: Diagnostic;
    previous?: Observation | null;
    allowFixture?: boolean;
    previousAssurance?: OracleAssurance;
    supplemental?: SupplementalResult;
    localMaxAgeSeconds?: bigint;
    position?: PositionConfiguration;
}): Observation;
