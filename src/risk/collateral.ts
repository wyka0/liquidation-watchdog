import { DataError } from "../domain/errors.js";
import { valuePosition } from "../morpho/accounting.js";
import { add, mul, mulDivUp, ORACLE_SCALE, sub, uint, WAD } from "../morpho/math.js";

/** Internal arithmetic kernel; calculateRisk supplies the mandatory snapshot/quality envelope. */
export interface CollateralMath {
  targetRatioWad: bigint;
  requiredCapacity: bigint;
  requiredCollateralValue: bigint;
  requiredCollateral: bigint;
  additionalCollateral: bigint;
  modeledNewCollateral: bigint;
  modeledCollateralValue: bigint;
  modeledCapacity: bigint;
  modeledPostAdditionRatioWad: bigint | null;
  roundingMargin: { capacitySurplus: bigint; correctionCollateralUnits: bigint };
  proof: { targetSatisfied: true; minimumProven: true; previousCollateralCapacity: bigint | null };
}

export function solveAdditionalCollateral(collateral: bigint, price: bigint, lltv: bigint, debt: bigint, targetRatioWad: bigint): CollateralMath {
  // Reuse the Phase 1 valuation checks and two-stage floor rounding.
  valuePosition(collateral, price, lltv, debt);
  if (uint(targetRatioWad) === 0n) throw new DataError("ZERO_TARGET", "Target ratio must be positive.", "accounting");
  const requiredCapacity = mulDivUp(debt, targetRatioWad, WAD);
  const requiredCollateralValue = mulDivUp(requiredCapacity, WAD, lltv);
  const requiredCollateral = mulDivUp(requiredCollateralValue, ORACLE_SCALE, price);
  uint(requiredCollateral, 128);
  let modeledNewCollateral = collateral > requiredCollateral ? collateral : requiredCollateral;
  let forward = valuePosition(modeledNewCollateral, price, lltv, debt);
  let correctionCollateralUnits = 0n;
  // Exact nested ceilings imply this needs zero increments. Keep a bounded defensive
  // correction, followed by an independent forward/minimality proof; never return an unproved estimate.
  while (forward.maxBorrow < requiredCapacity && correctionCollateralUnits < 2n) {
    modeledNewCollateral = add(modeledNewCollateral, 1n, 128);
    correctionCollateralUnits += 1n;
    forward = valuePosition(modeledNewCollateral, price, lltv, debt);
  }
  const additionalCollateral = sub(modeledNewCollateral, collateral);
  const previousCollateralCapacity = additionalCollateral === 0n ? null : valuePosition(modeledNewCollateral - 1n, price, lltv, debt).maxBorrow;
  if (forward.maxBorrow < requiredCapacity || mul(forward.maxBorrow, WAD) < mul(debt, targetRatioWad)
    || (previousCollateralCapacity !== null && previousCollateralCapacity >= requiredCapacity)) {
    throw new DataError("COLLATERAL_PROOF_FAILED", "Post-addition target or minimality could not be proved.", "accounting");
  }
  return {
    targetRatioWad, requiredCapacity, requiredCollateralValue, requiredCollateral, additionalCollateral, modeledNewCollateral,
    modeledCollateralValue: forward.collateralValue, modeledCapacity: forward.maxBorrow,
    modeledPostAdditionRatioWad: forward.safetyRatioWad,
    roundingMargin: { capacitySurplus: sub(forward.maxBorrow, requiredCapacity), correctionCollateralUnits },
    proof: { targetSatisfied: true, minimumProven: true, previousCollateralCapacity }
  };
}
