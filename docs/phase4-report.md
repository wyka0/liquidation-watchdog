# Liquidation Watchdog — Phase 4 report

Project: `C:\liquidation-watchdog`. Scope: evidence-based oracle assurance, freshness and independent-source investigation, monitoring/risk integration, immutable audit evidence and bounded status/audit commands. All work is local and uncommitted.

**Oracle assurance remains `UNVERIFIED`, freshness is `UNKNOWN`, and no independent comparator is qualified. All recovery estimates remain indicative and `actionable: false`.**

**Phase 4 verification passed all 22/22 commands**, including **562/562 unit tests across 25 files** and **2/2 live integration tests**. The full run completed from **`2026-11-01T18:23:50.557Z` to `2026-11-01T18:33:45.320Z`** on Windows with Node **v24.14.1**. Exact commands, exit codes, UTC timings and output paths are recorded in [verification-results.json](../evidence/phase4/verification-results.json).

## 1. Dependency graph

All identifiers below are on **Pharos chain 1672**:

| Role | Exact identifier |
| --- | --- |
| Morpho market | `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73` |
| Morpho | `0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb` |
| Market oracle | `0x9416F861970C2a39c02ab7696Ef0496383d4E81b` |
| Active feed proxy | `0xb5779919e2F183e59A34140331F7779cbFF1d1BC` |
| Cache | `0xd9F00c86ced2De92F6B7152b0492cb28edc4B5a8` |
| Feed ID | `0x0007c129e624689953a2636c014531b2f0bd0c15f9a22211f53023354f309fa6` |
| Forwarder | `0x76c9cf548b4179F8901cda1f8623568b58215E62` |
| Collateral | `0x4809010926aec940b550D34a46A52739f996D75D` |
| Loan | `0xC879C018dB60520F4355C26eD1a6D572cdAC1815` |

The market selects the oracle; its immutable `BASE_FEED_1` selects the proxy; the proxy selects a configurable cache/feed ID; the cache accepts its configured forwarder and allowed workflow; the forwarder accepts a configured signed report or an owner-authorized route. **The economic source beyond the workflow remains unresolved.** The full graph and evidence classifications are in [oracle-architecture.md](oracle-architecture.md).

Research anchor: block **21864844**, hash **`0x34bed88e5dcc0890c2087cc2f2c7f71a484e74bd7a140cb5f8449c4196a61f8b`**, timestamp **1793553649**. New live/historical captures are identified in [oracle-smoke.json](../evidence/phase4/oracle-smoke.json). Current means as of the stated block/retrieval time.

## 2. Contract identity and source verification

Six full deployed runtimes were independently reproduced: oracle, proxy, cache, forwarder, Morpho and collateral. Compiler versions are respectively **0.8.21, 0.8.26, 0.8.26, 0.8.24, 0.8.19 and 0.8.22**. Inputs include complete source contents, original source URLs/hashes, remappings, optimizer/EVM/viaIR/metadata settings, and compiler output. Official native compiler binaries were SHA-256/Keccak checked; they remain outside the repository.

Immutable substitutions use compiler AST/reference positions and pinned public getter reads. The collateral addendum completes `endpoint` and `decimalConversionRate`; the earlier incomplete proof is retained. Exact settings, source counts and six runtime hashes are in [the architecture table](oracle-architecture.md#source-and-runtime-identity). The offline checker reconstructs archived outputs without claiming new compilation or chain reads.

The proxy is a reproduced owner-configurable cache/feed facade. Its historical EIP-1967 implementation/admin/beacon slots were zero; runtime/source analysis, rather than those slots alone, establishes the architecture. Contract names, ABI compatibility and matching explorer hashes are insufficient on their own.

## 3. Ownership and configuration control

Historical proxy/cache/forwarder owners are respectively **`0x007DB8D5b32015E34f63Cf5312505ADf03Fcca5d`**, **`0x59538b88DB99635Eb9181AdFBd1F6CF5588DDFf0`**, **`0xB8F1032c6E69ef81DB98CF036133b9CBeAD1B3b0`**. The cache's additional allowed-workflow-owner is zero; configured-forwarder and allowed-workflow-ID checks still apply.

The owners can change cache/feed routing, workflow permissions and forwarder signer/route configuration. `report` enforces configured DON/version and exactly `f+1` distinct signatures; `route` uses separately owner-authorized forwarders. `clearConfig` emits a signer-configuration change. The reviewed storage layout binds sampled `s_configs` enumeration to slot 2, with `OracleSet.f`, `signers`, `_positions` in relative slots 0, 1, 2.

The historical scan **21856845–21864844** observed zero configuration events. Two sampled updates each recovered four distinct signers. The active sampled configuration was **DON 1/version 1, ID 4294967297, f=3, ten signers**. Workflow **`0x00bd398f80a8f53c31e1270678b7dd5283d5b9a0f5898ae3c4ceed15455ede02`**, reported owner **`0xf0900CD3ef1eba7f96756D22DC5c7EE1A012D449`**, was allowed at the sampled transaction blocks and audit block. Real-world operators and all authorized mapping entries remain unknown.

## 4. Feed semantics and units

One active feed; no active vaults or secondary feeds. Feed/collateral decimals: **18/18**; loan decimals: **6**; `SCALE_FACTOR=1000000`. The exact mechanical relation is `Morpho price = feed answer × 1000000` with Morpho's `10^36` base-unit price scale.

At the historical anchor the feed answer **1106203549076968373** mechanically yields price **1106203549076968373000000**. This normalizes to **1.106203549076968373 whole quote units per whole base unit** under the configured token decimals. The workflow's economic quote is unproven, so this is not a verified USDC market valuation or peg guarantee.

## 5. Freshness

The cache stores workflow-supplied observation time, ignores `validFromTimestamp`, skips timestamps less than or equal to its stored value, accepts future timestamps and has no age expiry. The proxy returns that time as both `startedAt`/`updatedAt`, zero round IDs, and rejects historical rounds. Morpho's feed library rejects negatives without enforcing age.

At block 21864844 the observation age was **3373 seconds**. Sampled observations were **3601 seconds** apart, with publication delays of **19/20 seconds**; earlier samples showed **3603/3600 seconds**. These are measurements, **not a verified heartbeat**.

The fresh saved live audit at block **21869021**, timestamp **1793557869**, records observation time **1793557476** and age **393 seconds**. Its retrieval time and exact block/artifact hashes are in section 9. Freshness remains `UNKNOWN` for both saved audits.

`OBSERVATION_AGE`, `POLICY_MAX_AGE`, `VERIFIED_HEARTBEAT` and `UPSTREAM_FRESHNESS_GUARANTEE` are separate fields. No age policy is enabled by default. Explicit local age limits only reject data; passing cannot prove upstream freshness. Zero/future/regressing/mismatched timestamps fail closed. See [oracle-freshness.md](oracle-freshness.md) for sample transaction hashes and evidence requirements.

## 6. Independent sources

The complete Reservoir registry maps the exact Pharos collateral to wsrUSD. The same address denotes an Ethereum PSM, while Ethereum wsrUSD is **`0xd3fd63209fa2d55b07a0f6db36c2f43900be3094`**. Issuer mapping and redemption documentation do not prove a temporally aligned independent wsrUSD/USDC market price.

The exact-address DexScreener request returned HTTP 200 with `[]`; the Chainlink MegaETH wsrUSD/rUSD candidate page returned HTTP 429; Pharos.watch was unavailable. No candidate satisfied exact economic asset/quote, units, timestamp/frequency, operator/provenance and independence requirements. RPC/MCP agree through a shared upstream and do not qualify.

The comparator retains both prices, candidate metadata and exact rational deviation, with explicit local age/skew/tolerance policies. Qualified disagreement fails closed. The production evaluator supplies no asserted selected-upstream ID and adopts no substitute price. See [oracle-independent-validation.md](oracle-independent-validation.md).

## 7. Assurance and status

For the reviewed, fully observed configuration:

| Dimension | Status |
| --- | --- |
| `CONTRACT_IDENTITY` | `VERIFIED` |
| `SOURCE_PROVENANCE` | `UNVERIFIED` |
| `OPERATOR_PROVENANCE` | `UNVERIFIED` |
| `PRICE_SEMANTICS` | `PARTIALLY_VERIFIED` |
| `FRESHNESS` | `UNKNOWN` |
| `INDEPENDENT_VALIDATION` | `UNKNOWN` |
| `CONFIGURATION_CONTROL` | `PARTIALLY_VERIFIED` |
| Overall / gate / actionability | **`UNVERIFIED` / `DATA_UNVERIFIED` / false** |

Mandatory evidence rules are explicit; partial facts cannot compensate for missing requirements. Each finding retains subject/source/block/retrieval/method/hash/confidence/unresolved fields. `oracle-audit`, saved audit, text status and JSON status are implemented; historical audits are explicitly labeled. Status serves persisted evidence with no fresh chain read.

## 8. Risk, monitoring and persistence integration

`src/risk/assured.ts` applies bound assurance around the original Phase 2 mathematical engine. Unknown assurance preserves indicative calculations; invalid/unavailable/conflicting evidence suppresses recovery estimates. Original mathematical state and Phase 2 quality remain separately available.

Configuration, implementation, owner, feed-ID, signer, denomination, timestamp, disagreement, assurance invalidation and assurance-quality changes emit persistent alerts through the existing deduplication and delivery infrastructure. The fingerprint and last complete baseline are block-bound. Invalidation is sticky across failures, restarts and threshold streams; stable reads do not automatically restore verification. `LIVE`, `FIXTURE` and historical scopes are distinct.

SQLite migration **4** adds hashed assurance records and bundle bindings. Storage rejects malformed records, cleared latches, lost/regressed baselines and backwards evaluation clocks. The [monitoring smoke](../evidence/phase4/monitoring-smoke.json) passed with **two accepted live cycles across restart**, **3 then 3 stored alerts**, persisted assurance and console-only deliveries; all four built CLI processes exited 0. Implementation and file lists are in [oracle-assurance.md](oracle-assurance.md) and [phase4-files.md](phase4-files.md).

## 9. Evidence bundles and hashes

The eight retained bundles are listed below; capture times are UTC on **2026-11-01**. Integrity verification passed for every bundle, with incomplete and superseded dispositions retained explicitly.

| Bundle | Manifest SHA-256 | Disposition |
| --- | --- | --- |
| [Main research, 17:23:46](../evidence/phase4/oracle-research-2026-11-01T17-23-46-683Z-9ad554c5-ffdd-4f43-83d7-3a52a8abd91f/manifest.json) | `8f435f593e1ba6d24eb287c1459eb20d944f6b27ecca6796d26e3e1abff87521` | Complete capture; collateral proof completed separately |
| [Collateral proof, 17:28:39](../evidence/phase4/collateral-proof-2026-11-01T17-28-39-523Z-2726e5be-5979-42ba-9fbb-c29342e4be09/manifest.json) | `c932baf8113819948c531fd51e31214ae017978d1c4e5aa8fc62615d1d289acb` | Completes full collateral runtime reproduction |
| [Independent research, 17:30:38](../evidence/phase4/independent-research-2026-11-01T17-30-38-572Z-cf7ce161-e80a-412c-aad3-79f1f03a8d15/manifest.json) | `9aa625a5e3896777d91762abc3a4a48ca346cbfa67aad2c5eb24525521e98a97` | No qualified independent market-price source |
| [Earlier research, 17:18:42](../evidence/phase4/oracle-research-2026-11-01T17-18-42-620Z-a3287621-5c9c-4828-b169-638ac3f62f96/manifest.json) | `ba4e97894abe48abf8a2c233fe7513067e8a40c743a4f637d523809834f448bf` | Retained incomplete capture |
| [Development audit, 17:31:19](../evidence/phase4/oracle-audit-2026-11-01T17-31-19-568Z-26fe152a-a99b-4c2b-8f61-8e95a73b58c8/manifest.json) | `48a1cf5229f4a30a5a7ef813ab233a1136c613ab73f15bbb9d899022612acd50` | Superseded schema and snapshot serialization |
| [Development audit, 17:47:35](../evidence/phase4/oracle-audit-2026-11-01T17-47-35-687Z-5078c30b-6b3f-4325-ad6c-abae354e3d97/manifest.json) | `108ab27c33230e3acd2de403dca2c413a02d7d8bead7470106acb27470927488` | Superseded snapshot serialization; retained for offline replay |
| [Saved live audit, 18:32:13](../evidence/phase4/oracle-audit-2026-11-01T18-32-13-912Z-d26d4dba-dd17-4135-a95f-06fac88f3121/manifest.json) | `9da99fa2bac844709344868c32095f42cfde2e3592322d6aa3057e5a002ec2a9` | Validated live as-of-block audit and exact artifact bindings |
| [Saved historical audit, 18:33:24](../evidence/phase4/oracle-audit-2026-11-01T18-33-24-873Z-98cd1fc4-ca41-4c66-be4b-50a0078f2a50/manifest.json) | `2a986307c44acbaedf6365990b84305418602e21559e67413cd5db32ca77576b` | Validated `HISTORICAL_SNAPSHOT` and exact artifact bindings |

Main recompilation artifact SHA-256: **`1d8626de9a4b8136a84e3dd625e00891fc05302879bd1c1525fce7e17d0bffcb`**. Complete issuer registry artifact SHA-256: **`9d5055471d0c44d2a7dbb46b1e212fe26896feec6c13ea6cd170d49596f52a2c`**.

The 17:47 development audit saved snapshot hash **`9dbf5c485adadd90c7b5bc0bef7cf659643fda2a06506660054d97f81de9c1b0`**, while its findings reference normalized bytes hash **`a0c76f5b2ca2be69a0fbeac829898a3cec63ba5996185833f21b027febface49`**. It is not a fully bound current audit. The save paths now serialize the same schema-normalized artifacts as the evaluator; fresh captures and exact-hash regression assertions validate that correction. Earlier artifacts are never repaired in place.

The fresh saved audits have the following exact provenance:

| Field | Saved live audit | Saved historical audit |
| --- | --- | --- |
| Evidence kind | `LIVE_CHAIN_READ` | `HISTORICAL_SNAPSHOT` |
| Block number / timestamp | `21869021` / `1793557869` | `21864844` / `1793553649` |
| Block hash | `0x0c0768c1098843b0e88a57a62e1ece5e55b1766c4e11ffb372d334e49169f884` | `0x34bed88e5dcc0890c2087cc2f2c7f71a484e74bd7a140cb5f8449c4196a61f8b` |
| Snapshot retrieved at | `2026-11-01T18:31:40.933Z` | `2026-11-01T18:32:52.011Z` |
| Assurance evaluated at | `2026-11-01T18:32:13.681Z` | `2026-11-01T18:33:24.672Z` |
| Type-tagged snapshot identifier | `sha256:e069f97697156354dc305cfab21ef2e16c594ed9f3cf40c35699d999837e4889` | `sha256:49cea3e6fbf7fe25b6bc915a453ed6a3b34c7ec849e3c16c1ab061e2c9457267` |
| `snapshot.json` SHA-256 | `fd2b3683c0ef449a0e29b1adc3c829b121d2ddebb0d25b6d29928849faf96aa9` | `950036b1a6699447dc5d2b9d0fe7dc4a7f051f32c8224a863c7a33a12cec56f8` |
| `supplemental.json` SHA-256 | `b46d7db8059a7c888b51c5c548362db8c1fddc7f79720f6ba5c94f5ab395748a` | `098edcbf00734ef9962c9022d0fb3172e1561c902288e97e3461df23ad8c147e` |
| Supplemental status | `BOUNDED_READ_COMPLETE` | `BOUNDED_READ_COMPLETE` |
| Overall / gate | `UNVERIFIED` / `DATA_UNVERIFIED` | `UNVERIFIED` / `DATA_UNVERIFIED` |

Both record configuration fingerprint **`c5fdcac715408818794eff1d8c0bb518404d51a8df63b4fcd210128e9d818fb0`** and `evidenceInvalidated: false`. That means no invalidation was detected within their bound continuity evidence; it does not establish economic correctness or complete historical coverage.

The [oracle smoke](../evidence/phase4/oracle-smoke.json) and [offline evidence verification](../evidence/phase4/oracle-evidence-verification.json) passed exact snapshot/supplemental finding bindings and archived RPC replay for both fresh captures. The checker's `usableAsCurrentAudit: true` denotes current schema/provenance validity; the historical audit remains explicitly historical. Each UUID bundle is exclusively created, with a complete artifact inventory and manifest hash. Offline replay is labeled `FIXTURE` and does not recreate a new live read or the original type-tagged snapshot identifier.

## 10. Tests and regression verification

`npm.cmd run verify` completed successfully: **22/22 commands exited 0**. This table records that full run's outcomes; the root-level inventory, documentation-link and secret-scan JSON reports retain their own check timestamps when refreshed after documentation edits.

| Verification command/check | Result |
| --- | --- |
| `typecheck` | PASS — TypeScript strict checking |
| `lint` | PASS — ESLint |
| `test-unit` | PASS — **562/562 tests, 25/25 files**, no failures |
| `test-integration` | PASS — **2/2 live RPC/MCP tests** |
| `build` | PASS — production TypeScript build |
| `built-cli-smoke` | PASS — built CLI help |
| `cli-inspect-smoke` | PASS — live inspection with saved evidence |
| `built-cli-risk-smoke` | PASS — live risk calculation and bound assurance |
| `built-cli-historical-risk-smoke` | PASS — explicit block 21853902 and historical labels |
| `historical-phase2-regression` | PASS — exact identity, accounting and both recovery proofs |
| `bounded-monitoring-restart-smoke` | PASS — two accepted cycles, four CLI processes, 3 then 3 stored alerts |
| `bounded-oracle-cli-smoke` | PASS — three audits, three persisted-status processes, two new immutable bundles |
| `source-runtime-links` | PASS — **5/5 links**, **23/23 archived source hashes**, exact oracle-library text match |
| `dependency-audit` | PASS — **0 reported vulnerabilities** |
| `phase1-evidence-integrity` | PASS — **54/54** original Phase 1 evidence files unchanged |
| `prior-phases-integrity` | PASS — **204/204** original evidence files unchanged; **0** unexpected |
| `oracle-evidence-verification` | PASS — **8 bundles**, **6/6 reconstructed runtimes**, **10 reviewed references**, **4 audit dispositions** |
| `phase4-inventory` | PASS — **27 changed, 225 added, 298 unchanged, 0 missing**; original reader/risk core unchanged |
| `documentation-links` | PASS — **137/137** local targets at full-run time |
| `secrets-check` | PASS — **562 files, 9 rules, 0 findings**, one exact synthetic-fixture exception |
| `git-intent-to-add` | PASS — local entries include new files in whitespace checks |
| `git-diff-check` | PASS — no whitespace errors |

Seven dedicated oracle suites cover identity/runtime hashes, units, freshness anomalies and local policies, source qualification and exact independent deviation, continuity/invalidation and alerts, immutable evidence, read-only audit transport/calldata/signature replay, and audit/status behavior. Regressions verify the shared **512-log** budget and exact saved-artifact hashes. Existing monitoring/storage/risk suites cover migration **1/2/3→4**, persistence/restart, assurance-to-snapshot binding and preservation of original arithmetic. Archived JSON replay and synthetic candidates are labeled `FIXTURE`.

The exact Phase 2 historical regression passed at block **21853902**, hash **`0xfe044ec9c464d3899f431b23efc307e9ccb619a71d42fdfe4c0b7a2e346c88d3`**. Target-1.25 repayment is **17077942565** loan base units; additional collateral is **21091061440441662813831** collateral base units. The regression compared identity, debt/value/capacity/LTV/ratio and both full calculation proofs against the saved Phase 2 result.

The exclusive pre-Phase-4 baseline contains **325 original project files**, including **204 Phase 1–3 evidence files** (**54 + 73 + 77**). Baseline SHA-256: **`eff105e08d795d592671c1426685b79361dd76098cabe78daf9ca8fae7c74a3c`**. All 204 evidence files and the original reader/RPC/MCP/oracle-policy, validation, fixtures and Phase 2 mathematical core are byte-for-byte preserved. Inventory: **27 modified originals, 298 unchanged originals, 0 missing, 225 added**. Exact hashes and lists are in [prior-phases-integrity.json](../evidence/phase4/prior-phases-integrity.json) and [file-changes.json](../evidence/phase4/file-changes.json).

## 11. Security and operational boundaries

The supplemental transport uses a fixed public endpoint with a method/parameter allowlist, selector/address-bound view calls, explicit block tags, redirect rejection, request/time/size/history/log/signer limits and normalized retained fields. Failed remote response bodies and provider extension fields are not persisted. Secret-bearing URLs/text and malformed provenance are rejected or redacted; tests exercise these boundaries.

Evidence creation refuses prior archive paths and link traversal. SQLite validates schema/checksums, assurance content hashes and continuity before persistence. Audit/monitor operations reuse the exclusive local monitor lock. Real notification providers remain disabled for all verification; mocked notification tests and console deliveries are used.

The dependency audit reported **0 vulnerabilities**. The secret scan passed across **562 files** using **9 rules**, with **0 findings** and **one exact synthetic-fixture exception**. Its scope excludes dependency/build/Git directories and reports potential credential-file names without opening them. Results are in [dependency-audit.json](../evidence/phase4/dependency-audit.json) and [secret-scan.json](../evidence/phase4/secret-scan.json).

## 12. Limitations and unresolved questions

- The exact economic product behind the feed ID, workflow source/aggregation inputs and economic quote remain unproved.
- On-chain controller/signer/workflow addresses do not establish real-world operator identity, independence, governance trust or data-source correctness.
- No verified heartbeat or upstream freshness guarantee is available. Local rejection policies and observed intervals cannot supply one.
- No qualified independent collateral/loan market-price comparator was found; source unavailability and cross-chain/quote mismatches remain explicit.
- The history scan and sampled signer set are bounded, not complete deployment history or mapping enumeration. A gap invalidates continuity rather than silently asserting stability.
- Runtime reproduction verifies recorded bytecode identity. Compiler/metadata input authenticity and economics are different questions; the offline checker only reconstructs the archived execution outputs.
- RPC and MCP share upstream infrastructure; their agreement is not independent consensus. All current outputs are as-of a pinned block, and historical/fixture provenance is preserved.
- Configuration invalidation is persistent; the implementation offers no automatic trust-restoration shortcut.

## 13. Prohibited-action confirmation and phase boundary

Work is confined to Phase 4 in `C:\liquidation-watchdog`. Chain ID/endpoints and selected deployment configuration are preserved. No signing, transaction broadcasting, wallet use, market/position/oracle modification, real external notification, commit, push or deployment was performed. No unrelated repository was modified. Public transaction signatures were recovered for read-only analysis; no signature was created.

The project remains local and uncommitted. Completion of this report closes Phase 4; further phases require separate approval.
