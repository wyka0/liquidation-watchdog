# Accounting and units

All financial calculations use `bigint`. `Number` is used only for nonfinancial presentation/control values such as dates and decimal counts. JSON represents bigint quantities as unsigned decimal strings.

## Authoritative model

The port follows Morpho Blue **v1.0.0**:

- [`MorphoBalancesLib.sol`](../evidence/phase1/sources/MorphoBalancesLib.sol): expected balances and borrower debt after interest.
- [`MathLib.sol`](../evidence/phase1/sources/MathLib.sol): third-order Taylor compounding and floor/ceiling integer arithmetic.
- [`SharesMathLib.sol`](../evidence/phase1/sources/SharesMathLib.sol): virtual shares/assets and conversion direction.
- [`UtilsLib.sol`](../evidence/phase1/sources/UtilsLib.sol): checked uint128 conversion.
- [`Morpho.sol`](../evidence/phase1/sources/Morpho.sol): LLTV-adjusted collateral capacity in `_isHealthy`.
- [`ConstantsLib.sol`](../evidence/phase1/sources/ConstantsLib.sol): WAD-scale fee and `1e36` oracle price scale.

Their canonical URLs and captured content hashes are in the [source manifest](../evidence/phase1/sources/manifest.json). Stored market amounts do not already include elapsed interest.

## Interest accrual

Let `T` be the pinned block timestamp; `r` be that block's `borrowRateView` result in WAD per second; `B`, `S`, `QS`, `QB`, and `f` be stored borrow assets, supply assets, supply shares, borrow shares, and fee. `WAD = 10^18`.

```text
elapsed = T - market.lastUpdate
first   = r * elapsed
second  = floor(first * first / (2 * WAD))
third   = floor(second * first / (3 * WAD))
interest = floor(B * (first + second + third) / WAD)

accruedBorrowAssets = B + interest
accruedSupplyAssets = S + interest
```

Exactly as in `MorphoBalancesLib`, accrual is skipped when elapsed time, total borrow assets, or the IRM address is zero. The production selected market requires its nonzero configured IRM, but the accounting function preserves the official zero-IRM branch.

For a nonzero fee:

```text
feeAmount = floor(interest * f / WAD)
feeShares = floor(feeAmount * (QS + 1,000,000)
                  / (accruedSupplyAssets - feeAmount + 1))
accruedSupplyShares = QS + feeShares
```

The fee amount is removed from the share-conversion denominator because supply assets have already been increased. Total borrow shares remain unchanged. The report includes rate, elapsed time, Taylor terms, interest, fee amount/shares, and accrued totals; the CLI displays the principal accounting fields and the JSON retains all intermediates.

## Debt conversion

With virtual assets `1` and virtual shares `1,000,000`:

```text
debt = ceil(position.borrowShares * (accruedBorrowAssets + 1)
            / (totalBorrowShares + 1,000,000))
```

Debt is rounded **up**, not down. `mulDivUp` reproduces the checked Solidity expression `(x*y + (d-1))/d`; both multiplication and the rounding addition are checked. Arbitrary-precision JavaScript arithmetic must not silently hide a Solidity overflow.

## Collateral value, LTV, and provisional ratio

`price()` is the number of **loan base units per collateral base unit**, scaled by `10^36`. It is not directly an 18-decimal USD price. For 18-decimal collateral, 6-decimal loan, and the observed single 18-decimal feed:

```text
scaleFactor = 10^(36 + 6 - 18 - 18) = 1,000,000
oraclePrice = feedAnswer * scaleFactor

collateralValue = floor(collateralRaw * oraclePrice / 10^36)
maxBorrow       = floor(collateralValue * LLTV / WAD)
LTV_WAD         = floor(debt * WAD / collateralValue)
safetyRatio_WAD = floor(maxBorrow * WAD / debt)
```

`collateralValue`, `maxBorrow`, and debt are in loan-token base units; formatted amounts use 6 decimals. The two-stage rounding of `maxBorrow` follows Morpho `_isHealthy`.

The safety ratio is **Morpho capacity/accrued debt**, not an Aave health factor. It is a descriptive ratio only; no alert threshold, recommendation, or SAFE classification is implemented. Unknown upstream denomination/heartbeat keeps valuation and the ratio indicative and non-actionable.

## Undefined and failed cases

- Confirmed zero borrow shares yield debt `0`, `debtState: NO_DEBT`, and a **null safety ratio**, not infinity.
- Zero collateral value yields a null LTV. With positive debt, zero capacity gives a zero safety ratio.
- Missing/reverted/invalid price, market, position, metadata, rate, or consistency data suppresses the derived results. Failed reads never become zero debt.
- Verified-policy stale data also suppresses derived results. An unknown heartbeat alone remains `UNVERIFIED`, permitting explicitly indicative calculations.
- uint256 intermediate overflow, uint128 accrued-total overflow, negative operands, zero divisors, and invalid timestamps are rejected.

## Historical arithmetic regression fixture

The fixture reproduces the financial values recorded for block `21,848,634`; its operational metadata is explicitly synthetic. Expected debt is `273626732767` raw USDC, accrued market borrow assets `5390491404029`, collateral value `350475818801`, capacity `320685374202`, and ratio `1.171981154615735623`. Unit tests additionally exercise fee shares, the third Taylor term, small-share rounding, exact ceiling inequalities, decimal scaling, empty balances, and intermediate overflow boundaries.

Live integration retrieves new inputs rather than expecting these historical quantities. Its results are in `evidence/phase1/accounting.json`.
