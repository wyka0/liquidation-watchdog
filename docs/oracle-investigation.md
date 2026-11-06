# Oracle investigation — ten questions

**Conclusion:** the on-chain adapter structure and timestamp semantics are supported by actual same-block reads and explorer-verified source tied to observed runtime hashes. The exact upstream economic feed/workflow, real-world operator identities, and heartbeat policy remain **`UNVERIFIED`**. A readable positive answer does not establish freshness or accurate economic valuation.

All addresses below are on **Pharos Pacific Mainnet, chain 1672**. Controller values are observations at the saved snapshot, not immutable ownership claims.

## 1. Which contracts supply this market's price?

| Role | Address |
| --- | --- |
| Morpho Blue | `0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb` |
| Adaptive Curve IRM | `0xD5E02889C13230458506CC842347c4E62F8cDF3a` |
| Morpho oracle factory | `0xb8118256d8Aa950ec0B26a0b8Be7C6c1a858f6a3` |
| Market oracle, MorphoChainlinkOracleV2 | `0x9416F861970C2a39c02ab7696Ef0496383d4E81b` |
| SelfManagedFeedsCacheProxy 1.0.0 | `0xb5779919e2F183e59A34140331F7779cbFF1d1BC` |
| SelfManagedFeedsCache 1.0.0 | `0xd9F00c86ced2De92F6B7152b0492cb28edc4B5a8` |
| KeystoneForwarder 1.0.0 | `0x76c9cf548b4179F8901cda1f8623568b58215E62` |
| Multicall3 used for read batching | `0xcA11bde05977b3631167028862bE2a173976CA11` |

Market ID: `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73`.

The actual `idToMarketParams` oracle address is validated, not inferred from a token symbol. The official Morpho address registry identifies the Pharos core, IRM, and oracle factory. On-chain factory recognition, IRM/LLTV enablement, derived market ID, deployed code, and MCP/RPC agreement are checked.

Evidence: [market parameters](../evidence/phase1/market-parameters.json), [contract verification](../evidence/phase1/contract-verification.json), [registry excerpts](../evidence/phase1/sources/official-registry-excerpts.json).

## 2. What is the exact upstream data source?

The active feed ID is:

```text
0x0007c129e624689953a2636c014531b2f0bd0c15f9a22211f53023354f309fa6
```

Verified cache source describes **Chainlink Data Streams received through CRE workflows**, and actual successful forwarder delivery is observed. The proxy's description is only `SelfManagedFeedsCacheProxy`; it does not name an economic pair.

The exact upstream instrument/denomination, workflow implementation/content, data-vendor inputs, and any intermediate exchange-rate computation were not independently established. In particular, the feed cannot be certified as a USD or USDC market price merely from its magnitude, the token symbols, or those source comments. `sourceVerified` therefore remains `false`.

Evidence: [live oracle reads](../evidence/phase1/oracle-investigation-live.json), [cache source](../evidence/phase1/sources/SelfManagedFeedsCache.sol), [historical delivery receipt](../evidence/phase1/oracle-update-history.json).

## 3. Who operates and is authorized to update it?

Observed controllers:

| Control | Observed address |
| --- | --- |
| Proxy owner | `0x007DB8D5b32015E34f63Cf5312505ADf03Fcca5d` |
| Cache owner | `0x59538b88DB99635Eb9181AdFBd1F6CF5588DDFf0` |
| Forwarder owner | `0xB8F1032c6E69ef81DB98CF036133b9CBeAD1B3b0` |
| Allowed workflow owner | `0x0000000000000000000000000000000000000000` |
| Sender of sampled successful report | `0x462647e7aF8dAA4398583E0EC17E18C82600c8e4` |

`onReport` requires the configured forwarder and an explicitly allowed workflow ID. A zero allowed-workflow-owner disables that **additional owner check**; it does not disable the workflow-ID allowlist. The allowed workflow IDs and active signer-set identities are not fully enumerated by this Phase 1 investigation.

The forwarder's normal `report` path checks an owner-configured DON/version signer set and requires `f+1` distinct valid signatures. Its owner can also authorize other forwarders to use `route`. An external transmitter address is neither proof of the economic feed's operator nor of all signer identities. `operatorIdentityVerified` remains `false`.

Evidence: current owner/forwarder getters in the snapshot, cache `_validateWorkflowMetadata`, forwarder `report`/`route`, and the sampled receipt.

## 4. What do the returned timestamps and round IDs mean?

The cache decodes a report containing `uint32 observationsTimestamp` and stores that field as the answer timestamp. The proxy returns it as **both `startedAt` and `updatedAt`**. `latestTimestamp()` and the cache's timestamp getter return the same value.

This is a workflow-supplied **observation timestamp**, not the block inclusion time or proof of an independently validated off-chain quote time. `validFromTimestamp` is decoded but unused by the cache. Verified semantics describe what the field represents; they do not establish that the off-chain value is truthful.

Both `roundId` and `answeredInRound` intentionally return **zero**. This adapter has no meaningful OCR round sequence; `latestRound`, `getRoundData`, `getAnswer`, and `getTimestamp` revert. Applying generic nonzero-round or `answeredInRound` freshness rules would be incorrect here.

The production policy's timestamp-semantics assertion is bound to chain, oracle/feed/cache addresses, feed ID, versions, and proxy/cache runtime hashes. A changed binding removes that assertion.

Evidence: proxy `latestRoundData`, cache `onReport`, exact runtime/source links, and same-block round/timestamp comparisons.

## 5. What is the last update and its measured age?

Every inspection reports:

```text
ageSeconds = pinnedBlock.timestamp - round.updatedAt
```

The freshest saved result is in [oracle-investigation-live.json](../evidence/phase1/oracle-investigation-live.json) and [cli-report.txt](../evidence/phase1/cli-report.txt), each carrying its own block/hash and retrieval time.

As an explicitly historical example, block `21,852,148` at `2026-11-01T13:29:15Z` used an observation timestamp of `2026-11-01T13:24:37Z`, giving **278 seconds**. This example is not substituted for a later integration snapshot.

Zero, future, inconsistent, or out-of-range timestamps are `INVALID`, not merely stale. The reader does not invent a tolerance for future timestamps.

## 6. Is there a verified heartbeat or expected update frequency?

**No verified heartbeat, acceptable maximum age, deviation threshold, or update SLA was found for this feed/workflow.** The cache and proxy expose no such policy. The production configuration therefore has `heartbeatSeconds: null`, `heartbeatVerified: false`, and expected frequency `UNVERIFIED`.

The proxy's source recommends an appropriate consumer maximum-age check, but does not supply the appropriate threshold for this feed. A measured age alone cannot select one. Even an old timestamp remains `UNVERIFIED` when the policy is unknown; the reader never silently adopts a one-hour heartbeat.

The policy tests use an explicitly **synthetic** verified 60-second policy to verify the boundary behavior. That test policy is not exposed to the CLI or applied to the selected market.

## 7. What update cadence was actually observed?

Eight bounded 1,000-block historical ranges, anchored at block `21,852,148`, contained these cache `AnswerUpdated` events on November 1, 2026:

| Observation time (UTC) | Included at block | Observation-to-inclusion delay |
| --- | --- | --- |
| 11:24:34 | 21,845,387 | 18 seconds |
| 12:24:37 | 21,848,801 | 19 seconds |
| 13:24:37 | 21,851,901 | 17 seconds |

Intervals were **3,603 and 3,600 seconds**. Three updates are a small historical sample, not an enforceable heartbeat or proof of future cadence. A timestamp supplied by the workflow is also not an independent latency measurement of the underlying market data.

The latest sampled transaction was `0xb7aedd47c84cd7fc5c8fd52e88a89d9ad623f3ae84c38ba4e6d544b17ad5eccf`. Its receipt succeeded and includes `ReportProcessed` with `result: true` for the cache. The `workflowExecutionId` in that event is an execution identifier, not a verified workflow source CID.

Evidence: [oracle-update-history.json](../evidence/phase1/oracle-update-history.json), including raw logs/receipt, event block hashes, ranges, and anchor hash recheck. This history was retrieved through RPC; it is not presented as a second independent feed or as MCP-cross-checked history.

## 8. What happens if upstream updates stop or fail?

The cache stores the last accepted answer indefinitely. A report timestamp must strictly increase; an equal/older report emits `StaleReport` and is skipped. This is an **ordering check**, not a wall-clock-age cutoff.

There is no check against current block time, no future-time bound, and no enforcement of the report's `validFromTimestamp` in the investigated cache. A zero/nonexistent feed ID makes the singular getters revert; the batch getters may return zero. The reader uses the singular getters and explicitly rejects missing or nonpositive results.

If an upstream workflow stops, data becomes unavailable off-chain, or forwarder delivery fails, existing cached data can remain readable. The forwarder records successful/failed delivery, but cannot by itself establish economic quote quality. A positive `price()` result therefore cannot be treated as fresh or as evidence that upstream dependencies are functioning now.

## 9. Which administrative changes can affect trust?

- **Proxy owner:** can change the feed ID or cache address. This is a configurable forwarding facade, not evidence of a frozen upstream source.
- **Cache owner:** can change the forwarder, allow/disallow workflow IDs, and enable/disable/change the allowed workflow owner.
- **Forwarder owner:** can set/clear DON signer configurations and add/remove trusted forwarders.
- The inspected ownership support uses a proposal/acceptance two-step ownership transfer. No additional timelock or real-world operator guarantee is established by this investigation.
- The MorphoChainlinkOracleV2 feed/vault addresses and scale factor are immutable in its verified implementation, but its configured feed proxy still has the administrative controls above.

Evidence: proxy setters, cache setters, forwarder administration, and `ConfirmedOwnerWithProposal.sol`. Source compilation was not independently reproduced; trust attribution uses explorer-verified source, observed runtime hashes, ABI behavior, and registry evidence.

## 10. How are values scaled/aggregated, and does Morpho enforce staleness?

Actual oracle composition is one nonzero **base feed**, the proxy above. Both vaults and the other three feeds are zero; conversion samples are `1`. Zero optional feeds contribute multiplicative `1`, so this oracle performs no additional on-chain median or multi-source aggregation.

Loan, collateral, and proxy feed decimals are **6, 18, and 18**. The observed scale factor is `10^(36 + 6 - 18 - 18) = 1,000,000`. Same-block reads confirm:

```text
Morpho price = positive feed answer * 1,000,000
loan-base-unit collateral value = floor(collateralRaw * price / 10^36)
```

This verifies adapter arithmetic, not the unverified upstream denomination. No vault conversion is called even though the collateral token is a wrapped savings asset; that economic conversion, if represented in the quote, would have to come from the unverified feed workflow.

The deployed oracle feed library exactly matches official Morpho oracle **v2.0.0** source. `ChainlinkDataFeedLib.getPrice()` reads the answer and rejects negative values, but explicitly **does not check staleness** or timestamps. It even permits zero at the library level; this reader's positive-price requirement is stricter. The cache, proxy, and Morpho oracle path do not provide a usable price-age policy.

Accordingly, source, operator, or heartbeat uncertainty is preserved as `UNVERIFIED`. No SAFE status or actionable recommendation is emitted.

## Source attribution

The [source manifest](../evidence/phase1/sources/manifest.json) records URLs, retrieval times, SHA-256 hashes, and evidence classes. [Source/runtime matches](../evidence/phase1/source-runtime-matches.json) checks the proxy, cache, market oracle, forwarder, and Multicall3 explorer deployed-code hashes against SHA-256 of actual runtime bytecode and verifies all archived manifest hashes. Runtime Keccak-256 hashes are also retained. A matching code hash links the inspected source metadata to those deployed bytes; it does not prove off-chain economic data or reproduce Solidity compilation.
