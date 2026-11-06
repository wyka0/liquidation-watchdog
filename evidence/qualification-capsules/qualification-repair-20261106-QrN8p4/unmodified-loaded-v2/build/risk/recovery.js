import { riskProvenance } from "./provenance.js";
import { DataError } from "../domain/errors.js";
import { formatAmount } from "../validation/decimals.js";
import { canCalculate } from "../validation/quality.js";
import * as collateralSolver from "./collateral.js";
import * as repaymentSolver from "./repayment.js";
export const MODEL_ASSUMPTIONS = [
    "Each estimate is a separate hypothetical operation at the identified snapshot block and hash.",
    "Oracle price, LLTV and token units are held constant throughout each modeled operation.",
    "The starting debt is accrued to the snapshot; no later interest, other market activity or bad-debt changes are modeled.",
    "Repayment changes market borrow assets/shares exactly as Morpho v1.0.0; collateral addition holds that accrued debt fixed.",
    "Amounts describe protocol accounting with fully credited token transfers; gas, wallet funding and execution availability are outside the model.",
    "A real transaction at a later state is not guaranteed to reproduce these numbers."
];
function recommendationContext(result, snapshot, method, roundingMethod) {
    const { block, tokens, oracle } = snapshot;
    if (!block || !tokens.loan || !tokens.collateral || !oracle.round || oracle.price === null || result.inputSnapshotIdentifier === null) {
        throw new DataError("RECOMMENDATION_PROVENANCE", "A recovery estimate requires complete snapshot, oracle and token provenance.");
    }
    return {
        ...riskProvenance(snapshot, result.inputSnapshotIdentifier), inputSnapshotIdentifier: result.inputSnapshotIdentifier,
        blockNumber: block.number, blockHash: block.hash, blockTimestamp: block.timestamp,
        calculatedAt: result.calculatedAt, calculationMethod: method, calculationVersion: "1.0.0", ratioScale: result.ratioScale,
        targetRatio: result.thresholdConfiguration.wad.targetRatio, thresholdConfiguration: result.thresholdConfiguration,
        tokens: { loan: tokens.loan, collateral: tokens.collateral },
        oracleAddress: snapshot.oracle.address, oraclePrice: oracle.price, oracleTimestamp: oracle.round.updatedAt, oraclePolicy: snapshot.oracle.policy,
        dataQuality: result.dataQuality, actionability: result.actionability, actionable: false, indicative: true,
        roundingMethod, assumptions: [...MODEL_ASSUMPTIONS], warnings: [...result.warnings]
    };
}
function recovery(context, token, operation) {
    if (!canCalculate(context.dataQuality.overall)) {
        return { ...context, status: "BLOCKED", amount: null, calculation: null, issue: { code: "DATA_QUALITY_BLOCK", message: "Required data quality does not permit a recovery estimate." } };
    }
    try {
        const { calculation, amount } = operation();
        return {
            ...context, status: "CALCULATED", calculation,
            amount: { raw: amount, formatted: formatAmount(amount, token.decimals), tokenAddress: token.address, symbol: token.symbol, decimals: token.decimals },
            issue: null
        };
    }
    catch (error) {
        const issue = error instanceof DataError ? { code: error.code, message: error.message }
            : { code: "RECOVERY_CALCULATION_FAILED", message: "Recovery arithmetic could not be proved; no amount was returned." };
        return {
            ...context, status: "INVALID", amount: null, calculation: null, issue,
            actionability: { actionable: false, status: "BLOCKED", reasons: [...context.actionability.reasons, issue.message] },
            warnings: [...context.warnings, `${issue.code}: ${issue.message}`]
        };
    }
}
/** Separate, explicitly invoked recovery stage. Never called from base risk classification; the strict
 * eligibility gate in calculateAssuredRisk is the only production caller. Amounts remain internal bigint. */
export function applyRecoveryEstimates(result, snapshot, thresholds) {
    const repaymentContext = recommendationContext(result, snapshot, "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint", [
        "allowedDebt=floor(capacity*WAD/target)", "Partial asset repayment burns floor(assets*(totalShares+1e6)/(totalAssets+1)) shares.",
        "Full repayment uses all borrower shares and ceil(shares*(totalAssets+1)/(totalShares+1e6)) assets.",
        "Remaining debt is rounded up using updated market totals; verify the candidate and one loan-base-unit less."
    ]);
    result.repayment = recovery(repaymentContext, snapshot.tokens.loan, () => {
        const calculation = repaymentSolver.solveMinimumRepayment({
            borrowShares: snapshot.position.borrowShares, totalBorrowShares: snapshot.accounting.totalBorrowShares,
            totalBorrowAssets: snapshot.accounting.accruedBorrowAssets, debt: snapshot.accounting.debt
        }, snapshot.valuation.maxBorrow, thresholds.wad.targetRatio);
        return { calculation, amount: calculation.repaymentAmount };
    });
    const collateralContext = recommendationContext(result, snapshot, "morpho-v1.0.0/nested-ceilings/forward-minimality-proof", [
        "Invert capacity, LLTV and oracle scaling with three explicit ceiling divisions.",
        "Forward-check the two Morpho floor divisions and verify one collateral-base-unit less."
    ]);
    result.additionalCollateral = recovery(collateralContext, snapshot.tokens.collateral, () => {
        const calculation = collateralSolver.solveAdditionalCollateral(snapshot.position.collateral, snapshot.oracle.price, snapshot.params.lltv, snapshot.accounting.debt, thresholds.wad.targetRatio);
        return { calculation, amount: calculation.additionalCollateral };
    });
    for (const estimate of [result.repayment, result.additionalCollateral]) {
        if (estimate.status === "INVALID")
            result.warnings.push(`${estimate.calculationMethod}: ${estimate.issue?.code ?? "INVALID"}; that recovery amount is unavailable.`);
    }
}
//# sourceMappingURL=recovery.js.map