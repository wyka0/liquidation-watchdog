# Phase 2 — snapshot-bound Morpho risk engine

The public API is `calculateRisk(snapshot, thresholds?, options?)` in `src/risk/engine.ts`. It consumes the existing Phase 1 in-memory `Snapshot` and returns an immutable `RiskResult`. The CLI's `risk` command obtains that snapshot through the same `inspectLive` RPC/MCP path as `inspect`.

**The selected oracle remains `UNVERIFIED`. Every risk result and every recovery estimate is indicative and `actionable: false`.** A mathematical threshold band does not establish current liquidation eligibility or protection.

## Calculations and units

All amounts and financial intermediates are checked `bigint`. Phase 1's `src/morpho/math.ts`, `src/morpho/accounting.ts`, and `src/validation/decimals.ts` provide the arithmetic and formatting. No financial value is converted through a JavaScript floating-point number.

| Symbol | Meaning |
| --- | --- |
| `C` | Collateral-token base units (wsrUSD, 18 decimals in this market) |
| `P` | Morpho oracle price, base-unit conversion scaled by `S = 10^36` |
| `L` | Market LLTV scaled by `W = 10^18` |
| `D` | Borrower debt in loan-token base units (USDC, 6 decimals), accrued at the snapshot and rounded up from shares |

```text
V = floor(C * P / S)             collateral value, loan base units
K = floor(V * L / W)             liquidation capacity, loan base units
safetyRatioWad = floor(K * W / D) when D > 0
ltvWad = floor(D * W / V)         when V > 0
```

The oracle price already accounts for the tokens' different decimal counts; applying an extra 18-to-6 conversion would be incorrect. Keep both valuation floors in their original order.

Thresholds use the **exact rational comparison** `K * W` versus `D * thresholdWad`. The floor-rounded ratio is for display and diagnostics. A ratio can be fractionally above warning even when its displayed WAD equals warning.

Checked multiplication/addition uses uint256 bounds, including the numerator addition in ceiling division. Collateral, market totals, and shares obey Morpho's storage widths. Overflows fail closed; arbitrary-precision `bigint` is not used to hide a modeled EVM overflow.

## Three separate result layers

1. `mathematicalRiskState`: `NO_DEBT`, `ABOVE_WARNING`, `WARNING`, `CRITICAL`, or `LIQUIDATION_BOUNDARY`; null when mathematical inputs are unusable.
2. `dataQuality`: overall status, oracle status, source snapshot status, and explicit findings. Original severe findings remain effective when the production oracle policy is reassessed.
3. `actionability`: `INDICATIVE_ONLY` or `BLOCKED`, reasons, and `actionable: false`. The root result and each estimate also carry an explicit false flag.

`riskState` combines quality and mathematics:

| Effective quality | `riskState` | Mathematics | Recovery estimates |
| --- | --- | --- | --- |
| `INVALID` | `DATA_INVALID` | Suppressed | No amounts |
| `UNAVAILABLE` | `DATA_UNAVAILABLE` | Suppressed | No amounts |
| `STALE` | `DATA_UNVERIFIED` | Retained only if complete and internally valid | Blocked |
| `UNVERIFIED` | `DATA_UNVERIFIED` | Provisional | Indicative, non-actionable |
| `VALID` | Mathematical state | Available | Still non-actionable in Phase 2 |

The selected production policy cannot yield verified oracle quality. Caller-supplied `sourceVerified`, `heartbeatVerified`, or quality flags cannot promote it. `STALE` remains explicit in `dataQuality`; it is not erased by its mapping to `DATA_UNVERIFIED`.

An unknown heartbeat does not justify inventing a staleness cutoff. Oracle time is the bound cache's workflow-supplied `observationsTimestamp`, not independent validation time. Age is assessed against the selected block. Even a very old readable price remains limited by `UNVERIFIED` unless a valid bound staleness finding exists.

## Zero and invalid cases

- Confirmed zero debt gives provisional `NO_DEBT`, a null safety ratio, and zero-operation recovery estimates when all required data is usable. Quality still takes precedence.
- Zero collateral with debt gives zero value/capacity and safety ratio, undefined LTV (`null`), and a provisional boundary state.
- Zero price is invalid even for a debt-free position. Missing price is unavailable; neither becomes zero.
- Missing accounting/valuation is not reconstructed into an accepted result. Recalculation validates existing Phase 1 data, rather than bypassing its suppression policy.
- Invalid LLTV, wrong identities, incompatible decimals, timestamp inconsistencies, mismatched accounting, mixed blocks, or checked-arithmetic errors suppress the relevant calculation.
- If just one recovery operation exceeds a bound, that estimate is `INVALID` with `amount: null` and an issue code. Valid provisional risk mathematics and the other estimate may remain. CLI exit code 2 records the incomplete result.

## Morpho boundary semantics and Aave distinction

Morpho v1.0.0 `_isHealthy` checks rounded-up borrow debt against the two-stage capacity and **includes equality**: `capacity >= debt`. A zero-share borrower also passes that protocol check without needing a valuation. Phase 2 nevertheless requires valid price/data to issue a complete risk calculation.

The requested `LIQUIDATION_BOUNDARY` band includes `K / D <= 1`. At exact equality the band is therefore not equivalent to a failing Morpho health check. `capacityRelation` explicitly records `BELOW_DEBT`, `EQUAL_TO_DEBT`, `ABOVE_DEBT`, or `NO_DEBT`. No result asserts liquidation eligibility.

This **Morpho safety ratio is not an Aave health factor**. It describes one isolated Morpho market with one collateral, one loan asset, and that market's LLTV, using Morpho's share accounting and oracle scale. Aave health factor uses an account's enabled collateral portfolio, liquidation thresholds and applicable Aave configuration against its debts. The superficially similar dimensionless ratio does not transfer Aave's portfolio, e-mode, rounding, or liquidation rules to Morpho.

Source basis: archived `evidence/phase1/sources/Morpho.sol` (`repay`, lines 269–295; `_isHealthy`, lines 527–538), `SharesMathLib.sol`, `MathLib.sol`, and the Phase 1 accounting tests. The archived source bytes are preserved; a new independent Solidity compilation was not performed.

## Snapshot validation and provenance

`src/risk/snapshot-schema.ts` validates the existing typed boundary. Financial fields must already be `bigint`; a lossy JSON/Number conversion is rejected. It accepts both Phase 1 comparison encodings: bare SHA-256 for scalar/code comparisons and 0x-prefixed Keccak-256 for Multicall bytes.

`src/risk/validate.ts` checks market/account/network/token identities; complete before/after headers; selected block tags; ten required contracts; six sentinels; 58 matching comparisons; both read paths; the unchanged oracle binding; and recalculated Phase 1 accounting and valuation. It operates on the parsed copy and does not mutate the source snapshot.

Each result includes chain/protocol/Morpho address, market, account and account role, block number/hash/timestamp, retrieval and calculation times, oracle address/price/observation timestamp/policy, token units, threshold configuration, mathematical outputs, quality, warnings, and actionability. Unknown values use null, not invented zero or a fabricated block.

`inputSnapshotIdentifier` is `sha256:` plus a canonical hash of the normalized, typed input snapshot **before** policy reassessment. Object keys are sorted; bigint quantities, arrays and objects use distinct type tags, so a lookalike JSON object cannot impersonate a bigint value. An optional `expectedSnapshotIdentifier` rejects a different input. Runtime output is recursively frozen. These identifiers detect changed content; they are not signatures or independent chain-state proofs.

Both estimates carry their own block/hash, snapshot identifier, tokens/decimals, method/version, target, rounding rules, assumptions, quality, oracle limitation, and false actionability. Treat the numerical kernels in `repayment.ts` and `collateral.ts` as internal mathematics; the public engine supplies the mandatory context. See [recommendation mathematics](recommendation-math.md).

## CLI and evidence

```powershell
npm run watchdog -- inspect
npm run watchdog -- risk
npm run watchdog -- risk --warning 1.30 --critical 1.10 --target 1.25
npm run watchdog -- risk --config config/risk-thresholds.example.json --save-evidence
npm run watchdog -- risk --block 21853902 --save-evidence
```

Default reads select the same current-as-of-block snapshot as Phase 1. Only explicit `--block` requests produce `HISTORICAL`; no unavailable live read falls back to a historical fixture. A returned block/mode inconsistent with the CLI request is rejected. Deterministic fixtures retain `FIXTURE` on the result and both estimates.

New captures are under `evidence/phase2/{inspect|risk}/{live|historical-<block>}`. A risk capture contains:

- `input-snapshot.json`, `risk-result.json`, and `risk-report.txt`;
- `repayment-estimate.json` and `collateral-estimate.json`, each carrying its context;
- `manifest.json` with block provenance, quality, and SHA-256 file hashes.

The evidence writer rejects different input identifiers or detached estimate provenance. JSON quantities are decimal strings. File hashes cover serialized bytes; they differ from the canonical typed snapshot identifier. A manifest is written last; consumers should verify it before using a saved set.

Exit 0 means a complete **indicative** calculation, including both estimates; exit 2 means data/estimate suppression; exit 1 means configuration or execution failure. It never means approval to transact. Phase 1 `inspect` retains its report and acceptance behavior, with new captures routed outside its archive.

## Limitations

Oracle source, economic denomination, operator identity and heartbeat remain unverified. RPC and hosted MCP share an upstream, and block pinning is not finality. Each recovery scenario assumes constant price/LLTV and no intervening interest or market activity, and does not model transaction availability or funding. The adapter remains bound to the investigated Pharos market and public demonstration account. Phase 2 is a one-shot local calculation; later-phase functionality requires separate approval.
