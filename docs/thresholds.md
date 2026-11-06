# Risk threshold configuration

`src/config/risk.ts` owns threshold parsing and validation; mathematical functions receive the configuration explicitly. Defaults are:

```json
{
  "warningRatio": "1.30",
  "criticalRatio": "1.10",
  "targetRatio": "1.25",
  "liquidationBoundary": "1.00"
}
```

All values are **unsigned plain decimal strings** parsed using Phase 1's `parseAmount(text, 18)`. The configuration retains both the decimal text and exact WAD integers with scale `10^18`. JSON numbers, exponents, signs, leading/trailing whitespace, missing integer parts, excessive fractional precision, unknown keys, and uint256 overflow are rejected. No `parseFloat`, financial `Number` conversion, or floating-point multiplication is used.

## Constraints

- Every ratio is positive.
- `warningRatio > criticalRatio > liquidationBoundary`.
- `targetRatio > criticalRatio`.
- `liquidationBoundary` must equal **one WAD (1.00)**. It is Morpho's mathematical invariant, not an adjustable protocol liquidation rule.
- `targetRatio` may be below warning, as in the defaults, or above it. A target of 1.25 can leave the mathematical state in `WARNING`; target recovery is not an `ABOVE_WARNING` guarantee.

Positive representable thresholds may still make a particular calculation overflow. Configuration validity does not bypass the engine's checked cross-products and inverse calculations. Such calculations return an explicit invalid result/estimate rather than silently saturating.

## Precedence and overrides

Precedence is **defaults → explicit JSON file → CLI flags**. Files can contain a subset of fields. The CLI loads only an explicitly requested regular `.json` file of at most 16 KiB; symbolic links and other file types are rejected. No ambient environment-variable overrides or credentials are required.

```powershell
# Flags override the defaults.
npm run watchdog -- risk --warning 1.50 --critical 1.20 --target 1.40

# A supplied JSON file can be selectively overridden by flags.
npm run watchdog -- risk --config config/risk-thresholds.example.json --target 1.40
```

Duplicate and unknown CLI flags are errors. Threshold flags apply to `risk`; `inspect` keeps its existing arguments. Configuration is validated before any chain request.

Programmatic callers use `parseThresholds(overrides)` or `loadThresholds(path, overrides)` and pass the returned configuration to `calculateRisk`. Parsed configuration is immutable; its text/WAD consistency is revalidated at the calculation boundary.

## Exact bands

For debt `D > 0`, capacity `K`, and `W = 10^18`, test the most severe band first:

| Exact comparison | Provisional mathematical state |
| --- | --- |
| `K * W <= D * liquidationBoundary` | `LIQUIDATION_BOUNDARY` |
| Otherwise, `K * W <= D * criticalRatio` | `CRITICAL` |
| Otherwise, `K * W <= D * warningRatio` | `WARNING` |
| Otherwise | `ABOVE_WARNING` |

Actual zero debt is `NO_DEBT`. Ratio division is not used for band selection. Tests cover one integer unit above/below boundaries, exact equality, custom settings, and a ratio above warning whose floor-rounded WAD still equals warning.

Quality takes precedence in `riskState`. With this oracle, even `ABOVE_WARNING` or `NO_DEBT` mathematics produces `DATA_UNVERIFIED` and `actionable: false`. Equality is in the requested boundary band although Morpho's `capacity >= debt` protocol comparison includes equality. See [risk-engine semantics](risk-engine.md).
