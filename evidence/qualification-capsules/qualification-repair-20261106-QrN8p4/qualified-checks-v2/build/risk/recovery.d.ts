import type { Snapshot } from "../domain/types.js";
import type { ThresholdConfiguration } from "../config/risk.js";
import type { RiskResult } from "./types.js";
export declare const MODEL_ASSUMPTIONS: readonly ["Each estimate is a separate hypothetical operation at the identified snapshot block and hash.", "Oracle price, LLTV and token units are held constant throughout each modeled operation.", "The starting debt is accrued to the snapshot; no later interest, other market activity or bad-debt changes are modeled.", "Repayment changes market borrow assets/shares exactly as Morpho v1.0.0; collateral addition holds that accrued debt fixed.", "Amounts describe protocol accounting with fully credited token transfers; gas, wallet funding and execution availability are outside the model.", "A real transaction at a later state is not guaranteed to reproduce these numbers."];
/** Separate, explicitly invoked recovery stage. Never called from base risk classification; the strict
 * eligibility gate in calculateAssuredRisk is the only production caller. Amounts remain internal bigint. */
export declare function applyRecoveryEstimates(result: RiskResult, snapshot: Snapshot, thresholds: ThresholdConfiguration): void;
