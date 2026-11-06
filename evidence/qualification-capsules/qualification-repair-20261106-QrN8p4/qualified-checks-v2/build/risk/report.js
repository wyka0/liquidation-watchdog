import { utcFromSeconds } from "../domain/serialize.js";
import { formatAmount } from "../validation/decimals.js";
const missing = "UNAVAILABLE";
const ratio = (value) => value === null ? "undefined" : formatAmount(value, 18);
const time = (value) => value === null ? missing
    : value <= 0n || value > 8640000000000n ? `INVALID (${value})` : utcFromSeconds(value);
const amount = (value, token) => value === null || token === null ? missing : `${formatAmount(value, token.decimals)} ${token.symbol}`;
export function renderRiskReport(result) {
    const r = result;
    const loan = r.tokens.loan;
    const t = r.thresholdConfiguration.decimal;
    const blocked = r.recoveryEligibility.reasonCodes.length
        ? ` (${r.recoveryEligibility.reasonCodes.join(", ")})` : "";
    const output = [
        "Liquidation Watchdog — Phase 2 risk calculation",
        `Evidence: ${r.temporalContext} | source ${r.evidenceKind ?? missing}`,
        `Network: chain ${r.chainId} | ${r.protocol} | Morpho ${r.morphoAddress}`,
        `Market: ${r.marketId}`,
        `Account: ${r.account} (public demonstration account; NOT the user's wallet)`,
        `Block: ${r.blockNumber ?? missing} | ${time(r.blockTimestamp)}`,
        `Block hash: ${r.blockHash ?? missing}`,
        `Input snapshot: ${r.inputSnapshotIdentifier ?? missing}`,
        `Retrieved: ${r.snapshotRetrievedAt ?? missing} | calculated: ${r.calculatedAt}`,
        `Collateral: ${amount(r.collateralAmount, r.tokens.collateral)}`,
        `Accrued debt: ${amount(r.debtAmount, loan)}`,
        `Indicative collateral value: ${amount(r.collateralValue, loan)}`,
        `Indicative liquidation capacity: ${amount(r.liquidationCapacity, loan)}`,
        `Indicative LTV: ${r.ltv === null ? "undefined" : `${formatAmount(r.ltv, 16)}%`}`,
        `Indicative Morpho safety ratio (capacity/debt): ${ratio(r.safetyRatio)}`,
        `Thresholds: warning ${t.warningRatio} | critical ${t.criticalRatio} | target ${t.targetRatio} | boundary ${t.liquidationBoundary}`,
        `Mathematical risk state: ${r.mathematicalRiskState ?? missing}`,
        `Quality-gated risk state: ${r.riskState}`,
        `Data quality: ${r.dataQuality.overall} | oracle: ${r.dataQuality.oracle}`,
        `Actionability: ${r.actionability.status}; actionable=false`,
        `Recovery estimates: ${r.recoveryEligibility.status}${blocked}`,
        `Oracle: ${r.oracleAddress} | price (1e36 base-unit scale): ${r.oraclePrice ?? missing}`,
        `Oracle observation time: ${time(r.oracleTimestamp)}`,
        "Boundary semantics: threshold comparisons use exact integers; equality is included in the boundary band, while Morpho's capacity >= debt check includes equality.",
        "NON-ACTIONABLE: these hypothetical calculations do not establish current liquidation eligibility or protection.",
        ""
    ];
    const repayment = r.repayment;
    output.push("Indicative repayment calculation:");
    if (repayment?.calculation && repayment.amount) {
        const c = repayment.calculation;
        output.push(`  Amount: ${repayment.amount.raw} raw loan units | ${repayment.amount.formatted} ${repayment.amount.symbol}`, `  Token: ${repayment.amount.tokenAddress} | decimals ${repayment.amount.decimals}`, `  Target ratio: ${ratio(c.targetRatioWad)} | allowed debt: ${amount(c.allowedDebt, loan)}`, `  Initial debt-minus-allowed estimate: ${c.initialRepaymentEstimate} raw loan units`, `  Mode: ${c.simulation.mode} | shares burned: ${c.simulation.sharesBurned} | remaining borrower shares: ${c.simulation.remainingBorrowShares}`, `  Modeled post-repayment debt: ${c.modeledPostRepaymentDebt} raw | ${amount(c.modeledPostRepaymentDebt, loan)}`, `  Modeled resulting ratio: ${c.modeledPostRepaymentDebt === 0n ? "NO_DEBT (undefined ratio)" : ratio(c.modeledResultingRatioWad)}`, `  Rounding margin: ${c.roundingMargin.repaymentAboveInitialEstimate} raw above initial estimate | debt headroom ${c.roundingMargin.debtHeadroomBelowAllowed} raw`, `  Proof: target satisfied; minimum amount proved | one-unit-less post-debt ${c.proof.previousAmountPostDebt ?? "not applicable"}`, `  Method: ${repayment.calculationMethod} | version ${repayment.calculationVersion}`, `  Snapshot: block ${repayment.blockNumber} | ${repayment.blockHash} | ${repayment.inputSnapshotIdentifier}`, `  Data: ${repayment.dataQuality.overall}; oracle ${repayment.dataQuality.oracle}; actionable=false`);
    }
    else
        output.push(`  BLOCKED: no repayment amount was calculated or exposed. Reason codes: ${r.recoveryEligibility.reasonCodes.join(", ") || "NONE"}.`);
    output.push("", "Indicative additional collateral calculation:");
    const collateral = r.additionalCollateral;
    if (collateral?.calculation && collateral.amount) {
        const c = collateral.calculation;
        output.push(`  Amount: ${collateral.amount.raw} raw collateral units | ${collateral.amount.formatted} ${collateral.amount.symbol}`, `  Token: ${collateral.amount.tokenAddress} | decimals ${collateral.amount.decimals}`, `  Target ratio: ${ratio(c.targetRatioWad)} | required capacity: ${amount(c.requiredCapacity, loan)}`, `  Modeled new collateral: ${amount(c.modeledNewCollateral, r.tokens.collateral)}`, `  Modeled capacity: ${amount(c.modeledCapacity, loan)} | post-addition ratio: ${r.debtAmount === 0n ? "NO_DEBT (undefined ratio)" : ratio(c.modeledPostAdditionRatioWad)}`, `  Rounding margin: ${c.roundingMargin.capacitySurplus} raw loan capacity | correction ${c.roundingMargin.correctionCollateralUnits} raw collateral units`, `  Proof: target satisfied; minimum additional collateral proved | one-unit-less capacity ${c.proof.previousCollateralCapacity ?? "not applicable"}`, `  Method: ${collateral.calculationMethod} | version ${collateral.calculationVersion}`, `  Snapshot: block ${collateral.blockNumber} | ${collateral.blockHash} | ${collateral.inputSnapshotIdentifier}`, `  Data: ${collateral.dataQuality.overall}; oracle ${collateral.dataQuality.oracle}; actionable=false`);
    }
    else
        output.push(`  BLOCKED: no additional-collateral amount was calculated or exposed. Reason codes: ${r.recoveryEligibility.reasonCodes.join(", ") || "NONE"}.`);
    output.push("", "Assumptions:", ...new Set([...(repayment?.assumptions ?? []), ...(collateral?.assumptions ?? [])]), "", "Limitations:", ...r.warnings.map(warning => `- ${warning}`));
    return `${output.join("\n")}\n`;
}
//# sourceMappingURL=report.js.map