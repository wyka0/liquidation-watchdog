import type { ThresholdConfiguration } from "../config/risk.js";
import type { QualityStatus } from "../domain/types.js";
export type MathematicalRiskState = "NO_DEBT" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY";
export type RiskState = MathematicalRiskState | "DATA_UNVERIFIED" | "DATA_UNAVAILABLE" | "DATA_INVALID";
export declare function classifyMathematicalRisk(capacity: bigint, debt: bigint, thresholds: ThresholdConfiguration): MathematicalRiskState;
export declare function effectiveRiskState(quality: QualityStatus, mathematical: MathematicalRiskState | null): RiskState;
