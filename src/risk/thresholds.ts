import type { ThresholdConfiguration } from "../config/risk.js";
import { validateThresholds } from "../config/risk.js";
import { mul, uint, WAD } from "../morpho/math.js";
import type { QualityStatus } from "../domain/types.js";

export type MathematicalRiskState = "NO_DEBT" | "ABOVE_WARNING" | "WARNING" | "CRITICAL" | "LIQUIDATION_BOUNDARY";
export type RiskState = MathematicalRiskState | "DATA_UNVERIFIED" | "DATA_UNAVAILABLE" | "DATA_INVALID";

// Compare the exact rational capacity/debt, never its floor-rounded display.
export function classifyMathematicalRisk(capacity: bigint, debt: bigint, thresholds: ThresholdConfiguration): MathematicalRiskState {
  uint(capacity);
  uint(debt);
  validateThresholds(thresholds);
  if (debt === 0n) return "NO_DEBT";
  const numerator = mul(capacity, WAD);
  if (numerator <= mul(debt, thresholds.wad.liquidationBoundary)) return "LIQUIDATION_BOUNDARY";
  if (numerator <= mul(debt, thresholds.wad.criticalRatio)) return "CRITICAL";
  if (numerator <= mul(debt, thresholds.wad.warningRatio)) return "WARNING";
  return "ABOVE_WARNING";
}

export function effectiveRiskState(quality: QualityStatus, mathematical: MathematicalRiskState | null): RiskState {
  if (quality === "INVALID") return "DATA_INVALID";
  if (quality === "UNAVAILABLE") return "DATA_UNAVAILABLE";
  // STALE remains explicit in dataQuality; no new, undocumented DATA_STALE state.
  if (quality === "STALE" || quality === "UNVERIFIED") return "DATA_UNVERIFIED";
  return mathematical ?? "DATA_UNAVAILABLE";
}
