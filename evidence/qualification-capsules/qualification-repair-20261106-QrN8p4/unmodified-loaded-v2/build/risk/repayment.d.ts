/** Internal arithmetic kernel. User-facing estimates are wrapped by calculateRisk with provenance and quality. */
export interface BorrowState {
    borrowShares: bigint;
    totalBorrowShares: bigint;
    totalBorrowAssets: bigint;
    debt: bigint;
}
export interface RepaymentSimulation {
    mode: "NONE" | "ASSETS" | "SHARES";
    assets: bigint;
    sharesBurned: bigint;
    remainingBorrowShares: bigint;
    remainingTotalBorrowShares: bigint;
    remainingTotalBorrowAssets: bigint;
    remainingDebt: bigint;
}
export interface RepaymentMath {
    targetRatioWad: bigint;
    allowedDebt: bigint;
    initialRepaymentEstimate: bigint;
    repaymentAmount: bigint;
    modeledPostRepaymentDebt: bigint;
    modeledResultingRatioWad: bigint | null;
    simulation: RepaymentSimulation;
    roundingMargin: {
        repaymentAboveInitialEstimate: bigint;
        debtHeadroomBelowAllowed: bigint;
    };
    proof: {
        targetSatisfied: true;
        minimumProven: true;
        previousAmount: bigint | null;
        previousAmountPostDebt: bigint | null;
        searchIterations: number;
    };
}
export declare function simulateRepayment(state: BorrowState, assets: bigint): RepaymentSimulation;
export declare function solveMinimumRepayment(state: BorrowState, capacity: bigint, targetRatioWad: bigint): RepaymentMath;
