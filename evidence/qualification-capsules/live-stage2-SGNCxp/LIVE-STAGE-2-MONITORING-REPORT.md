# Live Stage 2 — single-position end-to-end monitoring

## Outcome and acceptance scope

**The authorized finite live workflow passed: one fresh pinned observation, three timestamped local-console deliveries, persisted evidence, and a clean new-process outbox restart with no resend. Monitoring is stopped.**

**Important qualification exceptions:** the fresh full unit suite was **FAIL — 1006/1007 passed**, with one process-fixture timeout/cleanup failure. The isolated follow-up was **PASS — 4/4 passed** and does not erase or replace the failed full run. Economic oracle assurance remains **UNVERIFIED**, freshness **UNKNOWN**, and financial recovery **BLOCKED**. This is **not production acceptance, verified live protection, or transaction advice**.

Report generated: **2026-11-06T00:09:37.564Z**. All observation and delivery times below are UTC. The snapshot was fresh for this one authorized execution; after shutdown it is retained historical evidence, not a claim about the position at report-reading time.

The four original requirements are taken from [the Phase 11 product acceptance audit](file:///C:/liquidation-watchdog/docs/PHASE-11-PRODUCT-ACCEPTANCE-AUDIT.md). These verdicts are limited to this exact finite local run:

| Original requirement | Finite-run verdict | Evidence and limitation |
| --- | --- | --- |
| Read collateral, debt and health factor (or equivalent) from chain | **PASS** | Fresh pinned collateral/borrow shares/market/IRM inputs were cross-checked; accrued debt and the Morpho health-factor equivalent were independently recomputed. Economic accuracy of the oracle and liquidation eligibility remain UNVERIFIED. |
| Support configurable warning and critical thresholds, with default examples 1.3 and 1.1 | **PASS** | Existing supported position configuration loaded warning 1.30 and critical 1.10 into the real reader/risk/transition scope. Exact integer cross-products classify CRITICAL. No global defaults were changed or long-running runtime activated. |
| Send timestamped alerts through at least one supported channel | **PASS** | All three actual alerts from that cycle were delivered by the existing local console adapter and persisted as DELIVERED with one attempt each. Telegram/Discord, external exactly-once delivery and deployed notifications are UNVERIFIED/not exercised. |
| Include a concrete suggested action in each alert | **PASS** | Each actual alert contains exactly one required typed NON_FINANCIAL instruction with a distinct rationale and snapshot-bound evidence. All retain actionable:false, NOT_QUALIFIED evidence and an empty financialOptions array. |

The suggested-action requirement is a messaging requirement, not permission to transact. Phase 11 itself describes safety-qualified human review/refresh instructions as an appropriate way to satisfy it. No financial amount or executable transaction instruction is needed while the strict gates are blocked. The historical audit is not rewritten or retroactively treated as a pass; the production decision remains **NOT ACCEPTED / NO-GO**.

## 1. Exact identity, configuration and one-cycle boundary

| Field | Verified value |
| --- | --- |
| Chain | Pharos Pacific Mainnet / `1672` |
| Account | `0x086eb9C2B14dD657ae77D07dF9115A2F946CE327` |
| Account role | `EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET` — a public third-party borrower, not the user's wallet |
| Morpho deployment | `0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb` |
| Market | `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73` |
| Oracle | `0x9416F861970C2a39c02ab7696Ef0496383d4E81b` |
| IRM | `0xD5E02889C13230458506CC842347c4E62F8cDF3a` |
| Canonical position ID | `2868fdc6591f5ec9674c9a33febfd27023f136783e11c24cb6dbd5f82994a06f` |
| Configured monitor-v2 scope | `1d9d31ed07649d3c00247bb62b508432ece0d26c3f29ab74b8ff82fa7325eb61` |
| Runtime configuration fingerprint | `59fb22e09b2b886afe8dbbb1f1c98fe693d93adeaf5d1ddcf8bbb606659b8fe1` |
| Position configuration SHA-256 | `99f1e601d5301aad96ee1b05e91c47379380adc923f0c2d36116480e1d6e4c84` |
| Monitoring configuration SHA-256 | `395ff3dcd8b3404d0ddd5780faa156c933ed1350cf4eded339a6c2adc3d2c2ce` |

- [position.json](position.json) selects this one enabled CONFIGURED position and owns its thresholds; [monitoring.json](monitoring.json) points only to the isolated local SQLite store, uses the local profile, keeps **monitoring.enabled=false**, and disables both external channels. Startup validation passed without a startup network call or printed credentials.
- [live-monitor.mts](live-monitor.mts) invoked the unchanged **MonitoringService.runOnce() exactly once**. Its capture hooks called the real supported **readMonitoredPosition()** and bounded **inspectSupplemental()** paths; separately written direct getters and integer arithmetic audited their result. No fixtures, allowFixture permission, replacement snapshot, altered risk pipeline or weakened safety gate was supplied.
- Historical discovery established identity and decoded Borrow.onBehalf provenance only. The new block is **2423 blocks later** than discovery block `22223031` and has a distinct later header. Discovery data was not reused as current input or seeded as a monitored progression baseline.
- Exclusive one-cycle marker: [one-live-cycle-authorized.json](one-live-cycle-authorized.json). The temporary live driver refuses an existing store/marker, preventing an accidental repeat in this evidence directory. It is evidence tooling, not authorization for any further live invocation.
- Runtime logs contain one cycle_started, one cycle_observed, one cycle_completed and one shutdown. The guard recorded **118 requests**, only to the reviewed RPC/MCP endpoints and allowlisted read methods; there were **zero rejected live requests**. Getters/receipts/calldata inspection are read-only; no signing, broadcast, state-changing simulation or position operation occurred.

## 2. Fresh pinned chain observation

| Provenance | Value |
| --- | --- |
| Block | `22225454` |
| Block hash | `0x9515451fc030160d2c4014b4b663f0d024b50b5774bbb1bf3829bbe5cd4e883d` |
| Parent hash | `0x165dc5d790fcea58ab8af01a6a83332032dd5655c4db4b5315f7b974cff796e1` |
| Block timestamp | `1793922408` / `2026-11-05T23:46:48.000Z` |
| Observed RPC/MCP heads | `22225459` / `22225460` |
| Selection | min(heads) − `5` blocks; both chain IDs `1672` |
| Snapshot read completion | `2026-11-05T23:47:20.525Z` |
| Observation / alert creation | `2026-11-05T23:48:19.444Z` |
| Cycle ID | `a4e2d2de-af29-4f39-a534-c5dda37c5b60` |
| Cycle start / completion | `2026-11-05T23:46:49.430Z` / `2026-11-05T23:48:20.549Z` |
| Cycle duration | `91119` ms, including capture/getter/audit verification — not a cadence/SLA qualification |
| Shutdown | `2026-11-05T23:48:20.609Z` |
| Canonical typed snapshot ID | `sha256:b00e8d0859e45aec43a33d1431665d8ce6ec8df0efc41874f3c89d8322671c95` |

### Position and derived risk

| Quantity | Raw / precision | Display or conclusion |
| --- | --- | --- |
| Collateral | `18706585513096000000000000`; 18 decimals | **18,706,585.513096 wsrUSD** |
| Collateral token | `0x4809010926aec940b550D34a46A52739f996D75D` | Wrapped Savings rUSD / wsrUSD; chain-bound issuer evidence retained |
| Borrow shares | `17768613114986061183` | Nonzero borrower; not an amount in USDC |
| Supply shares | `0` | Zero; not substituted for collateral |
| Accrued borrower debt | `18001980562580`; 6 decimals | **18,001,980.562580 USDC** |
| Loan token | `0xC879C018dB60520F4355C26eD1a6D572cdAC1815` | USDC / 6 decimals; symbol alone is not economic-price verification |
| LLTV | `915000000000000000` WAD | 0.915 |
| Health-factor equivalent | `1052543254080507595` / 10^18 | **1.052543254080507595** |
| Mathematical classification | `CRITICAL` | At/below critical 1.10, above mathematical boundary 1.00 |
| Effective state | `DATA_UNVERIFIED` | Oracle assurance remains unverified |
| Actionability | `INDICATIVE_ONLY`; actionable:false | Indicative only; no repayment or collateral-addition recommendation |
| Accepted observation | `true` | Acceptance of validated indicative inputs, not an oracle trust or liquidation-eligibility claim |

Collateral and borrow shares are direct contract values. Debt is derived by accruing market borrow assets to the pinned timestamp and converting the position's shares with debt rounded up, including Morpho's virtual assets/shares. Collateral value and LLTV capacity round down. The health-factor equivalent is floor(capacity × 10^18 / debt), **not a direct on-chain health-factor getter**.

Accounting inputs: elapsed **12410 seconds**, IRM rate **1560788518 WAD/second**, market interest **348683942 raw loan units**, and accrued market borrow assets **18001981475385**. The position's debt is not the total market debt.

### Active configurable thresholds and exact comparison

Warning **1.30**, critical **1.10**, target **1.25**, immutable mathematical boundary **1.00**. The target is configuration, not a financial recovery estimate. No displayed-ratio rounding was used for threshold decisions.

Capacity × WAD numerator: `18947863201232000000000000000000`. Debt: `18001980562580`.

| Threshold | Loaded decimal | Debt × threshold WAD | Numerator at/below? |
| --- | --- | --- | --- |
| `warningRatio` | `1.30` | `23402574731354000000000000000000` | YES |
| `criticalRatio` | `1.10` | `19802178618838000000000000000000` | YES |
| `targetRatio` | `1.25` | `22502475703225000000000000000000` | YES |
| `liquidationBoundary` | `1.00` | `18001980562580000000000000000000` | NO |

Result: **CRITICAL**, not LIQUIDATION_BOUNDARY. Being above 1.00 does not establish economic oracle accuracy, executable safety or liquidation eligibility.

### Cross-checks

- **58/58** production RPC/MCP comparisons matched, six batch sentinels checked, ten contract-code observations compared, stable before/after pinned headers, and zero mixed-block entries in the production position trace.
- **10/10** separately issued pinned direct-getter comparisons: market identity, market totals, borrower position, both decimals, both symbols, IRM view rate, oracle price, and feed answer/timestamp. Market ID was independently re-derived from the five market parameters.
- **17/17** separately written BigInt accounting/valuation fields matched the production snapshot. No production accounting/math helper was used for that independent arithmetic.
- Offline re-decoding and complete pure observation/assurance/risk/transition reproduction matched the captured cycle and persisted state. These are **offline calculations from captured bytes**, not another live observation or delivery.
- **RPC/MCP share an upstream**: this is separate-access-path consistency, not independent economic verification or independent consensus.

## 3. All actual console alerts and exactly one typed action each

The first accepted observation legitimately generated INITIAL_RISK, DATA_QUALITY_CHANGED and ORACLE_QUALITY_CHANGED. No safety notice was suppressed to force a single alert. WARNING is the notice severity of the latter two; their position mathematics remains CRITICAL.

| Alert code | Severity | Created UTC | Actual delivery completion UTC | Status / attempts / ambiguous |
| --- | --- | --- | --- | --- |
| `INITIAL_RISK` | `CRITICAL` | `2026-11-05T23:48:19.444Z` | `2026-11-05T23:48:20.483Z` | DELIVERED / 1 / 0 |
| `DATA_QUALITY_CHANGED` | `WARNING` | `2026-11-05T23:48:19.444Z` | `2026-11-05T23:48:20.516Z` | DELIVERED / 1 / 0 |
| `ORACLE_QUALITY_CHANGED` | `WARNING` | `2026-11-05T23:48:19.444Z` | `2026-11-05T23:48:20.538Z` | DELIVERED / 1 / 0 |

| Alert code | Type | Rationale | Concrete instruction |
| --- | --- | --- | --- |
| `INITIAL_RISK` | `NON_FINANCIAL` | `POSITION_REQUIRES_REVIEW` | Review this position and independently refresh the current chain and oracle state before making any financial decision. |
| `DATA_QUALITY_CHANGED` | `NON_FINANCIAL` | `DATA_REQUIRES_REFRESH` | Do not transact from this alert; refresh the position and restore complete valid data before making a decision. |
| `ORACLE_QUALITY_CHANGED` | `NON_FINANCIAL` | `ORACLE_REQUIRES_VERIFICATION` | Do not rely on financial estimates; independently verify the oracle source, freshness and configuration. |

Every action has schemaVersion=1, origin=GENERATED, evidence.status=NOT_QUALIFIED, actionable=false, and financialOptions=[]. Its evidence binds cycle ID, chain/account/market, block/hash/time and snapshot identifier; it retains UNKNOWN/FIRST_OBSERVATION progression, UNVERIFIED oracle assurance, UNKNOWN freshness/independence and the full blocked recovery reasons. This is one typed action object per alert, not an array of conflicting actions.

### Full console messages — exact actual transcript bytes

The following fenced text is copied directly from [console-alerts.txt](console-alerts.txt), without rewording or ellipses. It is **3664 bytes**, SHA-256 `1fa8721cd6de619e98f3ac46837627e02eb7f39bff042d6df0bd7168a938aaa8`. Re-rendering all three stored typed alerts reproduced these exact bytes offline; no adapter was called during that check. The stock recovery-disclaimer footer does not mean any recovery amount was produced; there are zero financial option lines.

```text
[2026-11-05T23:48:19.444Z] CRITICAL | alert_b7d6f901fb5242047f34f14fc1c74ae676806d8566740cdca908af36653a367f
Position: 0x086eb9C2B14dD657ae77D07dF9115A2F946CE327
Market: 0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73
State: UNKNOWN -> CRITICAL
Safety ratio: 1.052543254080507595
Data quality: UNKNOWN -> UNVERIFIED; effective state: DATA_UNVERIFIED
Oracle data: UNVERIFIED; oracle verification: UNVERIFIED; heartbeat: UNKNOWN
Actionability: false (INDICATIVE_ONLY)
Snapshot: block 22225454; hash 0x9515451fc030160d2c4014b4b663f0d024b50b5774bbb1bf3829bbe5cd4e883d
Snapshot ID: sha256:b00e8d0859e45aec43a33d1431665d8ce6ec8df0efc41874f3c89d8322671c95; context: LIVE_AS_OF_BLOCK
Reason: Initial indicative mathematical assessment at the identified block.
Action: Review this position and independently refresh the current chain and oracle state before making any financial decision.
Action evidence: NOT_QUALIFIED; rationale: POSITION_REQUIRES_REVIEW; origin: GENERATED; actionable: false
Oracle assurance: UNVERIFIED; freshness: UNKNOWN; evidence invalidated: false.
Recovery estimates are snapshot-bound, indicative and non-actionable. RPC/MCP share an upstream; agreement is not independent consensus.
[2026-11-05T23:48:19.444Z] WARNING | alert_551ef4df81f5a02ea823c00ff0caf6c0b4ea9a3db990637bfc3306dbe3a08a3e
Position: 0x086eb9C2B14dD657ae77D07dF9115A2F946CE327
Market: 0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73
State: UNKNOWN -> CRITICAL
Safety ratio: 1.052543254080507595
Data quality: UNKNOWN -> UNVERIFIED; effective state: DATA_UNVERIFIED
Oracle data: UNVERIFIED; oracle verification: UNVERIFIED; heartbeat: UNKNOWN
Actionability: false (INDICATIVE_ONLY)
Snapshot: block 22225454; hash 0x9515451fc030160d2c4014b4b663f0d024b50b5774bbb1bf3829bbe5cd4e883d
Snapshot ID: sha256:b00e8d0859e45aec43a33d1431665d8ce6ec8df0efc41874f3c89d8322671c95; context: LIVE_AS_OF_BLOCK
Reason: Effective data quality changed independently of mathematical risk.
Action: Do not transact from this alert; refresh the position and restore complete valid data before making a decision.
Action evidence: NOT_QUALIFIED; rationale: DATA_REQUIRES_REFRESH; origin: GENERATED; actionable: false
Oracle assurance: UNVERIFIED; freshness: UNKNOWN; evidence invalidated: false.
Recovery estimates are snapshot-bound, indicative and non-actionable. RPC/MCP share an upstream; agreement is not independent consensus.
[2026-11-05T23:48:19.444Z] WARNING | alert_9c8ef2388a2bd46de1e0c55bce6ccb1aa3ff1a42dac70cd16cae711dacd607a2
Position: 0x086eb9C2B14dD657ae77D07dF9115A2F946CE327
Market: 0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73
State: UNKNOWN -> CRITICAL
Safety ratio: 1.052543254080507595
Data quality: UNKNOWN -> UNVERIFIED; effective state: DATA_UNVERIFIED
Oracle data: UNVERIFIED; oracle verification: UNVERIFIED; heartbeat: UNKNOWN
Actionability: false (INDICATIVE_ONLY)
Snapshot: block 22225454; hash 0x9515451fc030160d2c4014b4b663f0d024b50b5774bbb1bf3829bbe5cd4e883d
Snapshot ID: sha256:b00e8d0859e45aec43a33d1431665d8ce6ec8df0efc41874f3c89d8322671c95; context: LIVE_AS_OF_BLOCK
Reason: Oracle data quality changed; successful reads do not verify its economic source or heartbeat.
Action: Do not rely on financial estimates; independently verify the oracle source, freshness and configuration.
Action evidence: NOT_QUALIFIED; rationale: ORACLE_REQUIRES_VERIFICATION; origin: GENERATED; actionable: false
Oracle assurance: UNVERIFIED; freshness: UNKNOWN; evidence invalidated: false.
Recovery estimates are snapshot-bound, indicative and non-actionable. RPC/MCP share an upstream; agreement is not independent consensus.
```

## 4. Persistence and strictly offline new-process restart

The isolated store is `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\live-stage2-SGNCxp\watchdog.sqlite`. SQLite schema **5**, runtime SQLite **3.51.2**, Node **v24.14.1**. The existing local schema initializer applies only to this new disposable SQLite store; **no repository/production database, PostgreSQL/Neon schema, grant or migration was touched**.

| Persisted item / restart assertion | Result |
| --- | --- |
| Streams / cycles / accepted observations | 1 / 1 / 1; configured scope and canonical account identity retained |
| Alerts / permanent fingerprints / assurance rows | 3 / 3 / 1 |
| Console delivery rows / attempts | 3 DELIVERED rows / 3 attempts; each attempts=1 and ambiguous=0 |
| Delivery events / operational events | 9 / 0 |
| Pending deliveries | 0 |
| Persisted runtime | STOPPED |
| New-process recovered in-flight deliveries | 0 |
| New-process drain attempts / console resends | 0 / 0 |
| New live cycles / observations / fetch attempts during restart | 0 / 0 / 0 |
| Logical table/state/delivered hashes | Unchanged; all rows revalidated |
| Known-delivered hash | `2591037f212ad493e664d536bb960f1423aba1cfaadcaaf02b827d9b9bc0d160` |
| Public status and alerts commands | Both exit 0; output is persisted history, not new reads or notification resends |

[restart-check.mts](restart-check.mts) reopened the actual store in another process, acquired its local monitor lock, invoked the existing delivery recovery/drain code, and confirmed zero work to replay. It **did not call MonitoringService.runOnce(), monitor --once, or a chain reader**. [restart-console.txt](restart-console.txt) is empty. Public history outputs are [restart-cli-status.txt](restart-cli-status.txt) and [restart-cli-alerts.txt](restart-cli-alerts.txt).

**Limitation:** this proves a clean new-process store/outbox restart after completed delivery. It does not prove a second live worker cycle, sustained progression/cadence, or crash-in-flight delivery to a real external provider. The separate process unit fixtures do not turn those unexecuted live scenarios into live evidence. Provider exactly-once delivery is not claimed; terminal ambiguous-delivery protections were not weakened or bypassed.

## 5. Oracle evidence, current controls and unresolved gaps

### Pinned pricing path and measured timestamp

| Oracle field | Pinned value / conclusion |
| --- | --- |
| Feed facade | `0xb5779919e2F183e59A34140331F7779cbFF1d1BC` |
| Cache | `0xd9F00c86ced2De92F6B7152b0492cb28edc4B5a8` |
| Forwarder | `0x76c9cf548b4179F8901cda1f8623568b58215E62` |
| Feed ID | `0x0007c129e624689953a2636c014531b2f0bd0c15f9a22211f53023354f309fa6` |
| Feed answer | `1106992358384461601` |
| Morpho oracle price | `1106992358384461601000000` |
| Mechanical composition | Feed answer × 1,000,000; feed/collateral 18 decimals, loan 6 decimals, Morpho scale 10^36 |
| Workflow-supplied observation timestamp | `1793921075` / `2026-11-05T23:24:35.000Z` |
| Age at pinned block | `1333` seconds — measurement only, not verified freshness |
| Round ID / answeredInRound | 0 / 0; this facade does not supply OCR consensus rounds |
| Timestamp anomalies | None observed in the bounded evidence |
| Freshness / heartbeat / upstream guarantee | UNKNOWN / null / null |
| Local maximum-age rejection policy | Not configured; policyOrigin=NONE; no implicit staleness cutoff |
| Timing configuration fingerprint | null — no qualified timing evidence bound to this configuration |
| Independent comparator / selected upstream ID | NOT_CONFIGURED / null; eligible=false; no price substitution |
| Overall assurance / gate | `UNVERIFIED` / `DATA_UNVERIFIED` |

| Assurance dimension | State | Satisfied | Still missing |
| --- | --- | --- | --- |
| `CONTRACT_IDENTITY` | `VERIFIED` | `CHAIN_AND_MARKET`, `PINNED_RUNTIME_HASHES`, `REPRODUCED_SOURCE` | None |
| `SOURCE_PROVENANCE` | `UNVERIFIED` | None | `EXACT_FEED_PRODUCT`, `WORKFLOW_SOURCE`, `ECONOMIC_INPUTS` |
| `OPERATOR_PROVENANCE` | `UNVERIFIED` | None | `SOURCE_OPERATOR`, `SIGNER_OPERATORS`, `CONTROLLER_IDENTITIES` |
| `PRICE_SEMANTICS` | `PARTIALLY_VERIFIED` | `MECHANICAL_SCALING` | `ECONOMIC_BASE_QUOTE`, `FEED_DENOMINATION` |
| `FRESHNESS` | `UNKNOWN` | `TIMESTAMP_SEMANTICS` | `VERIFIED_HEARTBEAT`, `UPSTREAM_FRESHNESS_GUARANTEE` |
| `INDEPENDENT_VALIDATION` | `UNKNOWN` | None | `NO_QUALIFIED_INDEPENDENT_SOURCE` |
| `CONFIGURATION_CONTROL` | `PARTIALLY_VERIFIED` | `PERMISSION_BOUNDARIES`, `CURRENT_CONTROLLERS` | `COMPLETE_SIGNER_CONFIGURATION`, `CONTROLLER_IDENTITIES` |

CONTRACT_IDENTITY=VERIFIED is a code/runtime identity claim for the pricing path, **not** verification of the economic feed product, its price or its operators. Historical reviewed source/compiler/issuer bytes were rehashed locally and bound to the new runtime observations; no new compiler download, external research or solc execution occurred.

### Controllers actually observed at this Stage 2 block

| Control | Pinned address | Reviewed permission boundary |
| --- | --- | --- |
| Feed facade owner | `0x007DB8D5b32015E34f63Cf5312505ADf03Fcca5d` | May change cache/feed ID and transfer ownership |
| Cache owner | `0x59538b88DB99635Eb9181AdFBd1F6CF5588DDFf0` | Controls forwarder, workflow-ID allowlist and optional workflow-owner check |
| Forwarder owner | `0xB8F1032c6E69ef81DB98CF036133b9CBeAD1B3b0` | Controls signer configurations and separately authorized route forwarders |
| Additional workflow-owner check | `0x0000000000000000000000000000000000000000` | Zero disables only this additional comparison, not the forwarder or workflow-ID checks |

These values come from the fresh assurance configuration, not substituted historical documentation. They are addresses, not identified real-world organizations. EIP-1967 implementation/admin/beacon slots were all zero. That fact alone is insufficient to identify architecture; the reproduced source/runtime establishes this facade's owner-controlled cache/feed selection. A stable oracle address is not a guarantee of stable downstream data or configuration.

### Bounded oracle update audit

The **44-request** supplemental audit completed over **22217455–22225454**, exactly 8,000 blocks, using eight 1,000-block configuration queries and eight separate answer-history queries. It observed **zero configuration events** and **two matched update samples**. This is not deployment-to-present history or complete enumeration of mappings/authorized entries.

| Update transaction | Block | Publication UTC | Observation timestamp | Answer | Distinct recovered signatures |
| --- | --- | --- | --- | --- | --- |
| `0xf4e5dbc3bca19c58e5c6b5eac7cbad45769a9ead1f7379292599780d2b73fbb4` | `22223919` | `2026-11-05T23:24:54.000Z` | `1793921075` | `1106992358384461601` | 4 |
| `0xd549e17fc2b8ca9170091e9884df6baefca6ee9f6ff1f4de8fb1218438680b09` | `22219987` | `2026-11-05T22:24:55.000Z` | `1793917474` | `1106984697338336555` | 4 |

- Sampled workflow ID: `0x00bd398f80a8f53c31e1270678b7dd5283d5b9a0f5898ae3c4ceed15455ede02`; reported workflow owner: `0xf0900CD3ef1eba7f96756D22DC5c7EE1A012D449`. The workflow-ID allowance was read at each sampled transaction block and at the audit block. These identifiers do not identify a published workflow program or its economic inputs.
- Current sampled signer configuration: config ID `4294967297`, **f=3**, **10 signers**, signerCoverage=SAMPLED_ACTIVE_CONFIGS. Historical signature recovery and current signer membership remain separate observations. Four valid recovered signatures are not proof of four independent organizations or economic correctness.
- The two observation timestamps differ by **3,601 seconds**. That is a sample interval, **not a verified hourly heartbeat or a maximum-age guarantee**.
- Local offline verification re-decoded both captured report transactions, matched their successful receipts/feed events, recovered all four signatures per sample, and reconstructed the sampled current signer storage. No additional chain request was made.

### Source-backed behavior and open economic questions

1. [evidence/phase1/sources/SelfManagedFeedsCache.sol](file:///C:/liquidation-watchdog/evidence/phase1/sources/SelfManagedFeedsCache.sol) onReport validates the configured forwarder and workflow metadata, stores workflow-supplied observation timestamps, and skips non-increasing timestamps. **validFromTimestamp is not used to enforce validity or age expiry**, and stored answers have no age expiry.
2. [evidence/phase1/sources/SelfManagedFeedsCacheProxy.sol](file:///C:/liquidation-watchdog/evidence/phase1/sources/SelfManagedFeedsCacheProxy.sol) latestRoundData returns zero round IDs and returns the report's observation timestamp for both startedAt and updatedAt. A recent-looking facade timestamp is not upstream freshness verification.
3. [evidence/phase1/sources/verified-ChainlinkDataFeedLib.sol](file:///C:/liquidation-watchdog/evidence/phase1/sources/verified-ChainlinkDataFeedLib.sol) obtains the answer but does **not enforce staleness**. Mechanical compatibility with a Chainlink-style interface does not establish a standard economic Chainlink feed product or its operational promises.
4. [evidence/phase1/sources/KeystoneForwarder.sol](file:///C:/liquidation-watchdog/evidence/phase1/sources/KeystoneForwarder.sol) report checks configured DON/version and f+1 distinct configured signatures. Its **route entrypoint is a separate owner-authorized forwarding path without that signature-validation step**. The bounded audit does not fully enumerate every route authorization.
5. Still unresolved: **exact feed-ID/product mapping, workflow source code, source/aggregation inputs, economic base/quote and denomination, real-world source/signer/controller operators, verified heartbeat, upstream maximum-age guarantee, upstream identity/independence and a qualified independent comparator**. An issuer redemption rate, same symbol/address on another chain, numerical agreement or a presumed USDC peg is not a replacement for those proofs.

Reviewed context remains [docs/oracle-architecture.md](file:///C:/liquidation-watchdog/docs/oracle-architecture.md), [docs/oracle-freshness.md](file:///C:/liquidation-watchdog/docs/oracle-freshness.md) and [docs/oracle-independent-validation.md](file:///C:/liquidation-watchdog/docs/oracle-independent-validation.md). Their historical samples are context only; the fresh values in this report are derived from Stage 2 artifacts. The earlier mixed-block preliminary discovery diagnostic is not reused as evidence of oracle staleness.

### Strict blocked recovery and first-observation progression

The effective result is DATA_UNVERIFIED, recoveryEligibility.status=BLOCKED, eligible=false, repayment=null and additionalCollateral=null. All actionable fields remain unconditionally false. Exact reasons:

- `RECOVERY_CHAIN_PROGRESSION_UNKNOWN`
- `RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED`
- `RECOVERY_ASSURANCE_GATE_NOT_MET`
- `RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED`
- `RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED`
- `RECOVERY_CONFIGURATION_MISMATCH`

RECOVERY_CONFIGURATION_MISMATCH refers to the **missing qualified timing-configuration fingerprint binding**, not a changed chain, borrower, market or runtime threshold identity. There were no reported configuration changes or timestamp anomalies and evidenceInvalidated=false; absence of observed changes is not sufficient to qualify the missing evidence.

Progression remains **UNKNOWN / FIRST_OBSERVATION**, with a null accepted baseline. Being later than discovery does not change that monitored-stream result: no discovery observation was inserted as a progression baseline. No second live observation was authorized or executed to manufacture an ADVANCING state.

## 6. Exact current software checks and retained failures

| Current check | Result | Evidence / scope |
| --- | --- | --- |
| Full unit suite | **FAIL — 1006 passed, 1 failed, 0 skipped/pending/todo; 1007 tests in 49 files** | Exit 1; 48 files passed, 1 file failed. Original JSON/stdout/stderr and command record retained. |
| Affected process-fixture file follow-up | **PASS — 4/4 passed; 0 failed; 1 file** | Corrected local-IPC guard, single worker, unchanged existing tests; does NOT replace the failed full suite. |
| TypeScript --noEmit | **PASS**, exit 0 | No output/findings; source/test/scripts/config type-checking |
| ESLint --no-cache | **PASS**, exit 0 | No output/findings; no --fix |
| External-output TypeScript build | **PASS**, exit 0 | Emission only under this audit directory's build/; repository dist/ preserved |
| Live artifact / offline pipeline audit | **PASS — 9/9 check groups** | 12 captured artifact hashes, 33 assurance references, direct decoding/arithmetic/actions and persisted rows; zero fetch/socket attempts |
| Actual Stage 2 store/outbox restart | **PASS** | New process; zero live cycles/reads, no observation or delivery replay |
| Repository / Git preservation | **PASS** | Full fresh baseline comparison after tests; no repository exceptions |

**Original failed test:** `C:/liquidation-watchdog/test/runtime-process.test.ts` → `PHASE8 FIXTURE: actual runtime processes fences a second process and recovers after actual forced OS termination with an unfinished cycle`. It hit its existing **40,000 ms timeout**, followed by a Windows **EPERM cleanup** error. No production code/test timeout was changed. The precise cause of the timeout/cleanup failure is not conclusively isolated by this follow-up.

The original guard logged **556 records** and labelled **18 LOCAL_IPC path records** EXTERNAL_BLOCKED. Its summary field actualExternalAttempts=18 therefore does **not** establish 18 external RPC/HTTP requests. V1 rejected every double-backslash path, including the local Windows named-pipe form used by tsx; it omitted the actual IPC paths, so those original paths cannot be retrospectively proven from the log. There were **zero blocked non-IPC-host/fetch records**, and external access was never permitted. The separately retained v2 guard explicitly recognizes only local Windows named pipes and continues to reject external hosts/remote UNC pipes. The focused follow-up recorded **10 guard records**, **10 local named-pipe records** and **0 external attempts**. Its seven guard classification cases are pure checks, not network connections.

[offline-test-results.json](offline-test-results.json) remains FAIL; [test-accounting.json](test-accounting.json) is PASS only for **accurate accounting**, not an all-green test claim. A focused pass must not be relabelled as a fresh 1007/1007 full-suite pass. No corrected-guard full-suite rerun was performed.

The first external offline artifact verifier also retained a diagnostic failure: SQLite returns null-prototype attempt rows whereas parsed JSON uses ordinary object prototypes. Eight check groups had already passed; the complete row **values** were equal. Only that temporary verifier's prototype-sensitive comparison was corrected to compare complete serialized values, and its second run passed all nine groups. [offline-verification-results.json](offline-verification-results.json) is retained beside the authoritative [offline-verification-results-v2.json](offline-verification-results-v2.json); captured evidence, production code and the one live cycle were not changed.

### Commands and test authorization limits

- **unit-tests** (exit 1): `C:\Program Files\nodejs\node.exe node_modules/vitest/vitest.mjs run --configLoader=native --no-cache --no-fsModuleCache --reporter=default --reporter=json --outputFile.json=[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\live-stage2-SGNCxp\unit-tests.json`
- **typecheck** (exit 0): `C:\Program Files\nodejs\node.exe node_modules/typescript/bin/tsc --noEmit`
- **lint** (exit 0): `C:\Program Files\nodejs\node.exe node_modules/eslint/bin/eslint.js src test scripts *.config.* --no-cache`
- **build** (exit 0): `C:\Program Files\nodejs\node.exe node_modules/typescript/bin/tsc -p tsconfig.build.json --outDir [REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\live-stage2-SGNCxp\build`

- **Affected-file follow-up** (exit 0): `C:\Program Files\nodejs\node.exe node_modules/vitest/vitest.mjs run test/runtime-process.test.ts --configLoader=native --no-cache --no-fsModuleCache --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\live-stage2-SGNCxp\runtime-rerun-tests.json`

Both test runs used native Vitest configuration, no module/file cache, NODE_DISABLE_COMPILE_CACHE=1, external TEMP/TMP/evidence outputs, and guarded loopback/local-IPC fixtures. Existing synthetic process fixtures may temporarily enable their fixture runtime; they are not this live configured position, production activation or a scheduler qualification.

**Not rerun:** native PostgreSQL integration, live integration suites, Neon, remote notification delivery, deployment, scheduler/cadence qualification, production migrations or multi-position execution. Previous 1007/1007, native PostgreSQL 61/61, prior focused 5/5, secret-scan and documentation-link results are historical and are not presented as fresh Stage 2 passes.

## 7. Repository and Git preservation

Fresh baseline: `2026-11-05T23:40:30.835Z` through `2026-11-05T23:41:39.835Z`. Final comparison completed at `2026-11-06T00:09:12.001Z`.

| Preservation assertion | Result |
| --- | --- |
| Regular-file/symlink entries | 22029 → 22029 |
| Repository byte total | 273681577 → 273681577 |
| Added / removed / changed entries | 0 / 0 / 0 |
| Git status / staged diff / worktree diff / symbolic HEAD | Byte hashes and command outcomes unchanged |
| Git index | 65,736 bytes; `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689`; unchanged |
| HEAD | Unborn; rev-parse --verify HEAD remains exit 128 |
| Staged diff | Empty, 0 bytes |
| Repository scope | Includes .git, ignored data/evidence, node_modules, dist, source, tests and existing user work |
| Intentional repository modifications / exceptions | None — all new drivers, configuration, database, test outputs and this report are outside the repository |

No stage, commit, push, stash, reset, checkout or discard operation occurred. Read-only Git commands disabled optional locks. Existing uncommitted work and the index remain preserved; there is no claim that the working tree was originally clean.

## 8. Evidence anchors, final verification and stop condition

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| [live-stage2-evidence.json](live-stage2-evidence.json) | 59328 | `f94ec2761c77d2ddb219c8215dd3b6ac0ee9836ced59798c36740fe19f6b2124` |
| [live-monitor-snapshot.json](live-monitor-snapshot.json) | 350127 | `c4df894aeb206fa42c808525a47b5ed7524f54d9915b354e8f01e3a5c770938a` |
| [independent-pinned-verification.json](independent-pinned-verification.json) | 38672 | `087d245c444e415240d7753ac683c2104ed5954587950d4983f2aa9e50c6dfc8` |
| [live-monitor-supplemental.json](live-monitor-supplemental.json) | 42200 | `ee8b81e3c10b119d7f94688c923d7953b3fd4202965d144b6c23bc41ad3e06f6` |
| [live-monitor-cycle-result.json](live-monitor-cycle-result.json) | 227998 | `c3ec832225f4fbcdcf3fb354dd59f4fc170d34ad4d3d942ea04be2d64a347c4b` |
| [live-monitor-validation.json](live-monitor-validation.json) | 1874 | `7651cdfd684bb5233453135fde55edd84b99c484c8ad743c7ef5cafe22b101fb` |
| [live-monitor-risk.json](live-monitor-risk.json) | 56463 | `b2402882d4a986758103e425c86581ac94ece34b4a5346a5ea07b394c0c34c47` |
| [live-monitor-assurance.json](live-monitor-assurance.json) | 45193 | `86bb25858c1261259c50345120cc6edcd0806f06d40068eb4cf53582f5e4ddb6` |
| [persisted-before-restart.json](persisted-before-restart.json) | 502590 | `8f3b1338f5785707c76699ddfc176401f8ece95c2b7f23a498dcfe539ef694d6` |
| [network-read-only-guard.json](network-read-only-guard.json) | 36245 | `688fc973abe8f5075f4250a2c0abce17d02b84abf3cf616221f24580002ec9b3` |
| [cycle-logs.json](cycle-logs.json) | 2372 | `a0a5edae2a9c495f2769faa4130a2a01c6e9caea59b38f63546b01aab8134888` |
| [console-alerts.txt](console-alerts.txt) | 3664 | `1fa8721cd6de619e98f3ac46837627e02eb7f39bff042d6df0bd7168a938aaa8` |
| [monitor-console.txt](monitor-console.txt) | 5654 | `a83356fc69dd3f14cd50882dab2d3ed621d089a3315a5d2e55137e8210878385` |
| [preflight.json](preflight.json) | 4340 | `7228a4e3b2c4effdaf5ea97ca949e57cc163e08318a3871e8e2c5ec6f22e74ab` |
| [resolved-runtime-configuration.json](resolved-runtime-configuration.json) | 2988 | `5ddf0266c7d5d63a1201b1f084a67ed3adf522f4d6cd5f5d82db3dcee20f45af` |
| [restart-verification.json](restart-verification.json) | 3026 | `8b3f37b7151d345e0889803c239fa17c6b08975376b5c7c402d28a191783cec7` |
| [offline-verification-results-v2.json](offline-verification-results-v2.json) | 6667 | `9523dd95b56736ba3ac956229e134b2b829c690c2bae199244b60565276214bb` |
| [offline-verification-results.json](offline-verification-results.json) | 4787 | `e835d62d096d4627169743d7cfa9d50ddc07bd937d4959323912570e75bd2900` |
| [offline-test-results.json](offline-test-results.json) | 4994 | `df217dae7e2e239fdf90176e001fd0ba1112d89adb68fa6e9ba891c77357d458` |
| [unit-tests.json](unit-tests.json) | 408810 | `bd1aba2cdbcd8f6bbbefda19ad7a7d175ee6748b1f570d9958b724d53a62711d` |
| [targeted-runtime-test-results.json](targeted-runtime-test-results.json) | 4288 | `451b153b5449a1be49865e50c4881c4dac5fca0ec71c9064870057e42b6c6b71` |
| [runtime-rerun-tests.json](runtime-rerun-tests.json) | 2244 | `87e5e86170466bf9ef4a20193a1905d98b1f9272a185fad293b83a3631b2a47a` |
| [test-accounting.json](test-accounting.json) | 13150 | `122d8b218638f2accd423c97d87076a222f191d745ac7f4b8e0f6f83b311b43e` |
| [preservation-report.json](preservation-report.json) | 1996 | `570cb6a638add010e0d459a3d28c8967dde796de0a974b86db512265b184f284` |
| [baseline.json](baseline.json) | 5128472 | `1e1af2b6634c7c1c905be7cc28ed0ef8eb3813aac7c0184935b7fdd88fe0f7fb` |

**Hash semantics:** the captured snapshot file hash is `c4df894aeb206fa42c808525a47b5ed7524f54d9915b354e8f01e3a5c770938a`, while the schema-parsed snapshot serialization referenced by assurance is `3fcc33e2976625b88b904253dda7db1cd4c2001e8df569d8c8d48bf39f0c1fe5`. The canonical typed snapshot identifier is `sha256:b00e8d0859e45aec43a33d1431665d8ce6ec8df0efc41874f3c89d8322671c95`. These are different defined representations, not a hash mismatch; all were independently reproduced from the captured bytes. Local hashes provide integrity relative to this captured baseline, not independent custody/tamper-proof authority under an administrator-compromised host.

The final local report validator records link/hash/transcript checks and an artifact manifest separately in this directory. It does not contact linked websites. [live-stage2-evidence.json](live-stage2-evidence.json) remains the authoritative live capture; the report is its consolidated interpretation, with software-check failures and oracle gaps disclosed rather than hidden.

**Stop:** one live cycle is complete and stopped, zero pending console deliveries remain, and no live reader or monitoring loop is left running for this task. No third-party wallet owner was contacted. No wallet was created/funded, no message signed, no transaction broadcast, no supply/borrow/repay/withdrawal or position modification performed, and no external notification, Neon/paid service, deployment, scheduler activation, PostgreSQL/Neon migration or multi-position implementation was authorized or executed.

Production acceptance and financial recovery remain **NO-GO / UNVERIFIED** as described above. Any additional live reads/cycles, activation, external notifications, implementation or migrations require a separately scoped approval. This report does not grant it.
