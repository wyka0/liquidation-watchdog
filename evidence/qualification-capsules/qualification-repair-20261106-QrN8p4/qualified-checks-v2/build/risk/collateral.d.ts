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
    roundingMargin: {
        capacitySurplus: bigint;
        correctionCollateralUnits: bigint;
    };
    proof: {
        targetSatisfied: true;
        minimumProven: true;
        previousCollateralCapacity: bigint | null;
    };
}
export declare function solveAdditionalCollateral(collateral: bigint, price: bigint, lltv: bigint, debt: bigint, targetRatioWad: bigint): CollateralMath;
