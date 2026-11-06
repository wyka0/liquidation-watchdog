import { DataError } from "../domain/errors.js";
import { mul, mulDivDown, sub, toAssetsUp, toSharesDown, uint, WAD } from "../morpho/math.js";
function validateBorrowState(state) {
    uint(state.borrowShares, 128);
    uint(state.totalBorrowShares, 128);
    uint(state.totalBorrowAssets, 128);
    if (state.borrowShares > state.totalBorrowShares || uint(state.debt) !== toAssetsUp(state.borrowShares, state.totalBorrowAssets, state.totalBorrowShares)) {
        throw new DataError("REPAYMENT_STATE_MISMATCH", "Borrow shares, accrued totals and rounded-up debt do not describe the same state.", "accounting");
    }
}
export function simulateRepayment(state, assets) {
    validateBorrowState(state);
    uint(assets);
    if (assets > state.debt)
        throw new DataError("EXCESS_REPAYMENT", "The model only searches repayments from zero through full rounded-up debt.", "accounting");
    const mode = assets === 0n ? "NONE" : assets === state.debt ? "SHARES" : "ASSETS";
    // repay(assets=0, shares=all borrower shares) avoids asset-mode over-burning at full repayment.
    const sharesBurned = mode === "SHARES" ? state.borrowShares : toSharesDown(assets, state.totalBorrowAssets, state.totalBorrowShares);
    if (sharesBurned > state.borrowShares)
        throw new DataError("REPAYMENT_OVERBURN", "Asset-mode conversion would burn more shares than the borrower owns.", "accounting");
    const remainingBorrowShares = sub(state.borrowShares, sharesBurned);
    const remainingTotalBorrowShares = sub(state.totalBorrowShares, sharesBurned);
    // Morpho.repay uses zeroFloorSub, including a possible one-unit rounded surplus.
    const remainingTotalBorrowAssets = assets >= state.totalBorrowAssets ? 0n : sub(state.totalBorrowAssets, assets);
    return {
        mode, assets, sharesBurned, remainingBorrowShares, remainingTotalBorrowShares, remainingTotalBorrowAssets,
        remainingDebt: toAssetsUp(remainingBorrowShares, remainingTotalBorrowAssets, remainingTotalBorrowShares)
    };
}
export function solveMinimumRepayment(state, capacity, targetRatioWad) {
    validateBorrowState(state);
    uint(capacity);
    if (uint(targetRatioWad) === 0n)
        throw new DataError("ZERO_TARGET", "Target ratio must be positive.", "accounting");
    const allowedDebt = mulDivDown(capacity, WAD, targetRatioWad);
    const initialRepaymentEstimate = state.debt > allowedDebt ? sub(state.debt, allowedDebt) : 0n;
    let low = 0n;
    let high = state.debt;
    let searchIterations = 0;
    // For assets a < debt, burned shares floor(a*(Q+v)/(A+1)) are <= borrower shares.
    // Both (b-s)/(Q+v-s) and max(A-a,0)+1 are nonincreasing with a; so is ceil(their product).
    // Full repayment in shares is the valid upper endpoint. This bounds the search to <=129 steps.
    while (low < high) {
        const mid = low + (high - low) / 2n;
        if (simulateRepayment(state, mid).remainingDebt <= allowedDebt)
            high = mid;
        else
            low = mid + 1n;
        searchIterations += 1;
        if (searchIterations > 129)
            throw new DataError("REPAYMENT_SEARCH_BOUND", "Repayment search exceeded the uint128 debt bound.", "accounting");
    }
    const simulation = simulateRepayment(state, low);
    const previousAmount = low === 0n ? null : low - 1n;
    const previousAmountPostDebt = previousAmount === null ? null : simulateRepayment(state, previousAmount).remainingDebt;
    if (simulation.remainingDebt > allowedDebt || mul(simulation.remainingDebt, targetRatioWad) > mul(capacity, WAD)
        || (previousAmountPostDebt !== null && previousAmountPostDebt <= allowedDebt)) {
        throw new DataError("REPAYMENT_PROOF_FAILED", "Post-repayment target or minimality could not be proved.", "accounting");
    }
    return {
        targetRatioWad, allowedDebt, initialRepaymentEstimate, repaymentAmount: low,
        modeledPostRepaymentDebt: simulation.remainingDebt,
        modeledResultingRatioWad: simulation.remainingDebt === 0n ? null : mulDivDown(capacity, WAD, simulation.remainingDebt),
        simulation,
        roundingMargin: { repaymentAboveInitialEstimate: sub(low, initialRepaymentEstimate), debtHeadroomBelowAllowed: sub(allowedDebt, simulation.remainingDebt) },
        proof: { targetSatisfied: true, minimumProven: true, previousAmount, previousAmountPostDebt, searchIterations }
    };
}
//# sourceMappingURL=repayment.js.map