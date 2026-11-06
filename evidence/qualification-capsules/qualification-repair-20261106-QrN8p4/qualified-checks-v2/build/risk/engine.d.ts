import type { ThresholdConfiguration } from "../config/risk.js";
import type { RiskResult } from "./types.js";
import type { PositionConfiguration } from "../config/position.js";
export declare const ORACLE_LIMITATION = "The selected oracle's economic source, operator identities and heartbeat remain UNVERIFIED. All derived calculations are indicative and non-actionable.";
export interface RiskOptions {
    calculatedAt?: Date;
    expectedSnapshotIdentifier?: string;
    position?: PositionConfiguration;
}
/** Public base-risk API. Pure, read-only, schema-validated, and always non-actionable.
 * It never computes recovery estimates: repayment and additionalCollateral are null here by design. */
export declare function calculateRisk(raw: unknown, thresholds?: ThresholdConfiguration, options?: RiskOptions): RiskResult;
