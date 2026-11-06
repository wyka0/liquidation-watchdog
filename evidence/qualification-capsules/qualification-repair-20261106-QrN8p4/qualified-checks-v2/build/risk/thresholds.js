import { validateThresholds } from "../config/risk.js";
import { mul, uint, WAD } from "../morpho/math.js";
// Compare the exact rational capacity/debt, never its floor-rounded display.
export function classifyMathematicalRisk(capacity, debt, thresholds) {
    uint(capacity);
    uint(debt);
    validateThresholds(thresholds);
    if (debt === 0n)
        return "NO_DEBT";
    const numerator = mul(capacity, WAD);
    if (numerator <= mul(debt, thresholds.wad.liquidationBoundary))
        return "LIQUIDATION_BOUNDARY";
    if (numerator <= mul(debt, thresholds.wad.criticalRatio))
        return "CRITICAL";
    if (numerator <= mul(debt, thresholds.wad.warningRatio))
        return "WARNING";
    return "ABOVE_WARNING";
}
export function effectiveRiskState(quality, mathematical) {
    if (quality === "INVALID")
        return "DATA_INVALID";
    if (quality === "UNAVAILABLE")
        return "DATA_UNAVAILABLE";
    // STALE remains explicit in dataQuality; no new, undocumented DATA_STALE state.
    if (quality === "STALE" || quality === "UNVERIFIED")
        return "DATA_UNVERIFIED";
    return mathematical ?? "DATA_UNAVAILABLE";
}
//# sourceMappingURL=thresholds.js.map