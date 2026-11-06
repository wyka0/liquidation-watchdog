# Indicative target-recovery mathematics

These are **separate snapshot-bound hypothetical calculations**, not instructions to repay or supply collateral. The selected oracle remains `UNVERIFIED`; both envelopes retain that limitation and `actionable: false`. A modeled target proof applies only to the specified inputs, rounding rules, block and hash.

Common assumptions: fixed oracle price, LLTV and token units; starting debt accrued to the selected block; no subsequent interest, other users' operations or bad-debt changes; fully credited token transfers; and no gas, funding, authorization or execution-availability model. Debt changes through the repayment simulation; it stays fixed in the collateral scenario. Combining the two scenarios is not modeled.

Use `W = 10^18`, oracle scale `S = 10^36`, WAD target `T`, collateral amount `C`, price `P`, LLTV `L`, capacity `K`, and rounded-up debt `D`.

## 1. Minimum share-aware repayment

Implementation: `src/risk/repayment.ts`, method `morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint`, calculation version `1.0.0`.

```text
allowedDebt = floor(K * W / T)
initialRepaymentEstimate = max(0, D - allowedDebt)
```

The initial estimate is a lower bound, not the answer. Let `A` be accrued market borrow assets, `Q` market borrow shares, and `b` this borrower's shares. Morpho's virtual values are one asset and `v = 1,000,000` shares:

```text
D = ceil(b * (A + 1) / (Q + v))
```

The engine first proves that the supplied `D`, `A`, `Q`, and `b` describe the same snapshot, including storage bounds and `b <= Q`.

### Forward repayment simulation

For an integer asset payment `0 < a < D`:

```text
s  = floor(a * (Q + v) / (A + 1))   shares burned (asset mode)
b' = b - s
Q' = Q - s
A' = max(A - a, 0)                  Morpho's zeroFloorSub
D' = ceil(b' * (A' + 1) / (Q' + v))
```

At `a = 0`, mode `NONE` leaves the accounting unchanged and denotes no operation. At full repayment (`a = D > 0`), mode `SHARES` burns exactly `b` shares and charges `ceil(b * (A + 1) / (Q + v))` assets. Using the rounded-up debt as an **asset-mode** input can burn more shares than the borrower owns and revert; the full-share endpoint avoids that problem. A rounded asset payment can exceed stored market assets by one, so `zeroFloorSub` must not be replaced by an underflowing subtraction.

### Why binary search proves a global minimum

Search all integer asset costs in `[0, D]`; full-share repayment is a valid endpoint with zero remaining debt. For `a < D`, `a < b(A+1)/(Q+v)`, so the floor-rounded burn is strictly less than `b`.

Put `F = Q + v` and `E = A + 1`. In the partial interval, the unrounded remaining debt is `(b-s)(E-a)/(F-s)`. As `a` increases, `s` is nondecreasing, `(b-s)/(F-s)` is nonincreasing because `b < F`, and `E-a` is nonincreasing and positive. Ceiling preserves monotonicity. Thus `D' <= allowedDebt` is a monotone predicate. With storage-sized debt, binary search takes at most 129 iterations.

Asset mode also dominates any share-mode alternative with the **same asset cost**: if `a = ceil(sE/F)`, then `s <= floor(aF/E)`. Burning at least those shares gives no greater remaining debt. At the full-debt endpoint, burning all shares is already optimal. Hence searching asset costs with the full-share endpoint finds the minimum across both valid repay modes.

The debt-minus-allowed estimate is a lower bound: with `s = floor(aF/E)`,

```text
remainingUnroundedDebt - (bE/F - a)
  = (F-b) * (aF-sE) / (F * (F-s)) >= 0
```

Therefore `D' >= D-a`; the final repayment-above-initial rounding margin is nonnegative.

After search, the implementation independently checks:

1. `D' <= allowedDebt` and `D' * T <= K * W`.
2. If `a > 0`, simulating `a-1` leaves debt **above** `allowedDebt`.

Only then is `minimumProven: true` returned. A failed proof, out-of-range value or overflow returns no amount through the public engine. The ratio after full repayment is null with `NO_DEBT` semantics, not infinity.

### Deterministic rounding example — FIXTURE

This intentionally tiny state demonstrates rounding; it is not a live position recommendation.

| Input | Raw value |
| --- | --- |
| Accrued market assets `A` | 29 |
| Total shares `Q` | 2,000,003 |
| Borrower shares `b` | 1,000,001 |
| Rounded debt `D` | 10 |
| Capacity `K` | 10 |
| Target | 1.25 |

Allowed debt is 8; the initial estimate is 2. Paying 2 burns 200,000 shares and leaves rounded debt **9**, failing the target. Paying **3** burns 300,000 shares and leaves debt **8**, yielding modeled ratio **1.25**. One less fails, proving minimality. For a six-decimal USDC token, 3 raw units format as `0.000003 USDC`. The repayment rounding margin is one raw unit.

A second fixture (`A=0, Q=1, b=1, D=1`) proves the full-share endpoint: paying one in asset mode would attempt to burn 1,000,001 shares; repaying the single borrower share charges one asset unit and clears the debt.

## 2. Minimum additional collateral

Implementation: `src/risk/collateral.ts`, method `morpho-v1.0.0/nested-ceilings/forward-minimality-proof`, version `1.0.0`.

```text
requiredCapacity        = ceil(D * T / W)
requiredCollateralValue = ceil(requiredCapacity * W / L)
requiredCollateral      = ceil(requiredCollateralValue * S / P)
additionalCollateral    = max(0, requiredCollateral - C)
```

Forward verification uses the unchanged Phase 1 valuation:

```text
newCollateral = C + additionalCollateral
newValue      = floor(newCollateral * P / S)
newCapacity   = floor(newValue * L / W)

newCapacity >= requiredCapacity
newCapacity * W >= D * T
```

### Rounding and minimality proof

For positive integer denominator `y` and integer threshold `n`, `floor(x/y) >= n` if and only if `x >= n*y`. Applying this equivalence backwards through the target, LLTV and oracle floors yields exactly the three ceilings above. Each ceiling is the smallest integer satisfying that stage. The nested result is therefore the least collateral amount that can meet the target.

The forward calculation is still mandatory. A bounded defensive correction can add collateral base units if the first forward predicate fails, followed by the full proof. With the exact current formulas the correction is zero. Failure after two correction units, overflow, or a successful one-unit-less candidate fails closed rather than returning an unproved amount.

For a positive addition, the engine checks that `newCollateral-1` gives capacity **below** `requiredCapacity`. For zero addition, zero is already minimal. The final collateral must fit uint128 and every financial intermediate must fit its checked arithmetic bound.

### Deterministic nested-ceiling example — FIXTURE

For `C=1`, `P=2*S`, `L=floor(W/3)`, `D=1`, `T=1.25*W`:

- Required capacity: 2 loan units.
- Required value: 7 loan units (rounding `L` matters).
- Required collateral: 4 units; **addition: 3 units**.
- Forward value: 8; forward capacity: 2; resulting ratio: 2.00.
- One fewer collateral unit gives capacity 1 and fails.

Very small amounts or very high prices can overshoot the target because indivisible base units cannot be split further. Extremely low prices may require unrepresentable collateral; that is an invalid estimate, not a zero amount.

## 3. Report fields and validation evidence

Each estimate includes raw/formatted amount, token address/symbol/decimals, WAD target and scale, method/version, rounding rules, assumptions, oracle address/price/time/policy, quality, non-actionability, snapshot identifier, block/hash/time, and calculation time.

Repayment adds allowed debt, initial estimate, mode, burned/remaining shares, updated market totals, post-debt, modeled ratio, candidate/neighbor proof, search count, and two rounding margins: asset cost above the initial estimate and debt headroom below allowed debt.

Collateral adds required capacity/value/collateral, modeled new collateral/value/capacity/ratio, neighbor proof, capacity surplus above required capacity, and correction units. These margins are explicitly denominated; they are not execution slippage allowances.

`test/risk-repayment.test.ts` compares the solver against independent exhaustive enumeration of **both** repay modes and checks monotonicity, virtual values, full repayment, zero payments, large values, and overflow. `test/risk-collateral.test.ts` independently enumerates minimal additions for fractional prices and LLTVs and checks tiny values, extreme positive prices and storage/rounding overflow. Snapshot/CLI/evidence tests cover quality precedence, detached provenance, stale data and non-actionability. The live integration forwards one real snapshot through both engines and validates its target inequalities without asserting a fixed live debt or price.

Full evidence and counts are in `evidence/phase2/unit-tests.json`, `integration-tests.json`, and `verification-results.json`. The mathematical proof is snapshot-local; it does not guarantee a later real transaction produces an identical result.
