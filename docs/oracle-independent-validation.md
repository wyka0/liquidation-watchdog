# Independent oracle validation

**No independently qualified comparator is available for the selected Pharos collateral/loan pair.** The production result is `UNKNOWN`, `eligible: false`, with no price substitution. The original Morpho answer remains the sole input to the Phase 2 mathematics, gated as unverified.

## Exact economic identity

The selected base is chain **1672**, address **`0x4809010926aec940b550D34a46A52739f996D75D`**, 18 decimals. The selected quote is chain **1672**, address **`0xC879C018dB60520F4355C26eD1a6D572cdAC1815`**, 6 decimals. Matching symbols or numerical prices are insufficient.

The complete Reservoir issuer registry, retrieved at **`2026-11-01T17:30:37.716Z`**, explicitly maps the selected Pharos address to **wsrUSD**. That same hexadecimal address is listed as an Ethereum USDC peg-stability module on chain 1; Ethereum wsrUSD is instead `0xd3fd63209fa2d55b07a0f6db36c2f43900be3094`. This is why chain identity must accompany every address.

The [retained issuer artifact](../evidence/phase4/independent-research-2026-11-01T17-30-38-572Z-cf7ce161-e80a-412c-aad3-79f1f03a8d15/reservoir-addresses.json) has SHA-256 **`9d5055471d0c44d2a7dbb46b1e212fe26896feec6c13ea6cd170d49596f52a2c`**. The complete bounded document and exact table rows are retained. An earlier shortened research excerpt that omitted the Pharos row is also preserved and is not used to deny the later exact match.

This proves an issuer-published identity mapping, not the selected oracle's economic quote, independent operator provenance, bridge/redemption equivalence or a USDC market price.

## Investigated candidates and disposition

| Candidate | Source and observed response | What can be established | Why it is not qualified |
| --- | --- | --- | --- |
| Reservoir registry | [Official registry](https://docs.reservoir.xyz/security-and-compliance/smart-contract-addresses.md), HTTP 200 | Exact issuer-published Pharos collateral identity | Contains no temporally aligned market-price observation |
| Reservoir savings/redemption documentation | [Retained document](../evidence/phase4/independent-research-2026-11-01T17-30-38-572Z-cf7ce161-e80a-412c-aad3-79f1f03a8d15/reservoir-savings.json), HTTP 200 | Describes governance-maintained yield and liquidity-dependent PSM redemption | Redemption/accrual rate is not a guaranteed executable wsrUSD/USDC market quote; independence from the selected workflow is unproved |
| DexScreener exact Pharos address | [Retained response](../evidence/phase4/independent-research-2026-11-01T17-30-38-572Z-cf7ce161-e80a-412c-aad3-79f1f03a8d15/dexscreener-exact-address.json), HTTP 200 with `[]` | The queried endpoint returned no pairs | No candidate price, timestamp, liquidity or operator provenance; this does not prove that no market exists anywhere |
| Chainlink MegaETH wsrUSD/rUSD exchange-rate page | [Candidate page](https://data.chain.link/feeds/megaeth/megaeth/wsrusd-rusd-exchange-rate), [retained response](../evidence/phase4/independent-research-2026-11-01T17-30-38-572Z-cf7ce161-e80a-412c-aad3-79f1f03a8d15/chainlink-megaeth.json), HTTP 429 | Only the requested candidate URL and failed retrieval | Different chain and proposed quote; no verified page content, timing/operator facts or independence established |
| Pharos.watch collateral page | [Retained unavailable research](../evidence/phase4/oracle-research-2026-11-01T17-23-46-683Z-9ad554c5-ffdd-4f43-83d7-3a52a8abd91f/pharos-watch-research.json) | Unavailable at research time | No qualified observation or underlying source provenance |
| RPC and MCP copies of the selected feed | Pinned same-block comparison | Shared-upstream data consistency | Same chain state/feed; not an independent economic source |

The independent-research artifacts retain retrieval time, response status, source URL, response hashes and unresolved questions; the manifest hashes every saved artifact, including unavailable-research records. The independent-research bundle manifest is **`9aa625a5e3896777d91762abc3a4a48ca346cbfa67aad2c5eb24525521e98a97`**. A rate-limited page is evidence of unavailability, not evidence for its advertised price or heartbeat.

## Qualification model

`src/oracle-assurance/independent.ts` requires separate evidence for **ASSET, QUOTE, DENOMINATION, TIMESTAMP, FREQUENCY, OPERATOR, PROVENANCE and INDEPENDENCE**. Candidate metadata retains exact chain/address/decimals for both assets, price kind, units, raw answer/scaling, observation timestamp, frequency, operator/upstream identifiers and hashed proof references.

An eligible production comparison requires:

1. Exact base/quote identity and decimal matches; a market price rather than a redemption rate.
2. Positive bounded answers, nonzero/nonfuture timestamps and supported exact rational unit conversion.
3. Hashed, subject-bound proof references for every required claim; operator/provenance/frequency/independence require reviewed source or official documentation. Fixture evidence is accepted only in explicit fixture mode.
4. Established selected-upstream identity and a demonstrably different candidate upstream. Distinct arbitrary IDs alone are not evidence; the independence claim also needs its proof reference. The production assurance evaluator deliberately supplies **no selected-upstream identity** while that identity remains unresolved.
5. Explicit local maximum observation age, maximum timestamp skew and integer basis-point tolerance. These comparison policies are never interpreted as upstream promises.

Unknown units/quote/independence make a candidate ineligible. Stale or unaligned observations are rejected for comparison. Invalid prices/timestamps fail closed; source failure is `UNAVAILABLE`. A qualified disagreement produces `FAILED`, `DATA_INVALID` and an `INDEPENDENT_PRICE_DISAGREEMENT` alert. Agreement verifies only that dimension for those bound observations, never the entire oracle.

## Normalization and exact comparison

For Morpho price `P`, base-token decimals `b` and quote-token decimals `q`, the whole-token ratio is:

```text
Morpho whole quote per whole base = P × 10^b / (10^36 × 10^q)
```

Candidates explicitly choose `WHOLE_QUOTE_PER_WHOLE_BASE` or `QUOTE_BASE_UNITS_PER_BASE_UNIT` plus their answer decimals. Normalization and deviation use reduced BigInt rationals, without floating-point conversions or silent rounding. For normalized prices `M` and `I`:

```text
deviation in basis points = |I - M| × 10000 / M
disagreement              = deviation > explicit tolerance
```

Both original prices, normalized fractions, timestamps, local age/skew bounds, exact fractional deviation and all candidate evidence are retained. Persisted schemas recompute normalization and deviation, rejecting fabricated or inconsistent comparison fields. The risk wrapper checks the retained Morpho answer against its own input and never selects the candidate price.

Deterministic fixtures cover scale/quote/chain mismatches, redemption-rate rejection, same-upstream rejection, incomplete proof, stale/skewed/future observations, zero/overflow prices, exact tolerance boundaries, agreement/disagreement, corrupted normalization, unavailable sources and production-vs-fixture separation. These tests establish program behavior; they do not qualify a real comparator.
