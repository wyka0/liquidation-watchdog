# Stage 4 — Oracle Assurance Investigation

**Completed:** 2026-11-06 (UTC)
**Scope:** read-only public-chain, source and documentation investigation; no code, test, Git-index, deployment or monitoring changes
**Executive verdict:** **FAIL** — the market's collateral valuation is mechanically reproducible but is **not established as an economically trustworthy USDC-denominated value**
**Monitor state:** STOPPED (no monitoring cycle was started at any point in Stage 4)
**Financial-action status:** remains **BLOCKED** — unchanged, untouched

Stage 4 accepts the completed Stage 2/qualification history as-is (original finite local run,
preserved), makes **no new evaluated monitor assurance object**, and asks one question: *is the
watchdog's collateral valuation economically trustworthy and sufficiently fresh to permit
financially quantified recovery recommendations?* This document answers that question with
bounded new facts and verdicts. It does not weaken, bypass or modify any safety gate, and it does
not implement Stage 5.

## Identity under investigation (all verified repeatedly)

| Item | Exact value |
| --- | --- |
| Chain | Pharos Pacific Mainnet, chainId **1672** (`https://rpc.pharos.xyz`) |
| Protocol | Morpho Blue (`0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb`, v1.0.0) |
| Market | `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73` |
| Account monitored | configured public account `0xc6dd9976066f3364b4d6a72cd4f1fa0468327aa7`; Stage 2 historical observation borrower `0x086eb9C2B14dD657ae77D07dF9115A2F946CE327` |
| LLTV | 0.915 (915000000000000000) |
| Collateral token | `0x4809010926aec940b550D34a46A52739f996D75D`, RPC symbol `wsrUSD`, 18 decimals |
| Loan token | `0xC879C018dB60520F4355C26eD1a6D572cdAC1815`, RPC symbol `USDC`, 6 decimals |
| Market oracle | `0x9416F861970C2a39c02ab7696Ef0496383d4E81b` (MorphoChainlinkOracleV2) |
| Feed facade | `0xb5779919e2F183e59A34140331F7779cbFF1d1BC` (SelfManagedFeedsCacheProxy) |
| Cache | `0xd9F00c86ced2De92F6B7152b0492cb28edc4B5a8` (SelfManagedFeedsCache) |
| Forwarder | `0x76c9cf548b4179F8901cda1f8623568b58215E62` (KeystoneForwarder) |
| Feed ID | `0x0007c129e624689953a2636c014531b2f0bd0c15f9a22211f53023354f309fa6` |
| Retained Stage 2 anchor | block `22225454`, hash `0x9515451f…5cd4e883d`, timestamp `1793922408` (2026-11-05T23:46:48.000Z) |
| Retained oracle-only audit anchor | block `22229239`, hash `0x3623b544…81906d4c`, timestamp `1793925778` (2026-11-06T00:42:58.000Z) |

## Gate summary

| # | Gate | Verdict | Basis |
| --- | --- | --- | --- |
| A | Actual oracle implementation, valuation path, calculation and units | **PASS** | Reproduced runtime-verified sources + pinned runtime hashes + on-chain configuration reads; mechanics fully established (economics separate, see gates B–E) |
| B | wsrUSD / rUSD / USDC economic equivalence | **FAIL** | Official mapping declares quote **rUSD**; oracle has **no active quote feed** converting rUSD→USDC; no authoritative equivalence evidence; depeg/redemption/liquidity/basis risks structurally unmanaged |
| C | Source and operator provenance | **FAIL** | On-chain permissions are code-PROVEN, but SOURCE_V1 and OPERATOR_V1 have zero satisfied requirements; real-world source/operator/controller identities are unestablishable from available evidence; workflow binary/source unreviewed; signer/route coverage sampled, not complete |
| D | Freshness guarantees | **FAIL** | No on-chain staleness enforcement anywhere in the path (verified in reproduced runtime sources); published heartbeat is **not** configuration-bound; no upstream maximum-age guarantee exists; `evaluateAssurance()` supplies no verified timing |
| E | Independent economic comparator | **UNKNOWN** | No eligible comparator established; genuine source/operator independence cannot be established; bounded research cannot prove global absence; per investigation rule this gate is UNKNOWN, never PASS |
| F | Existing Stage 3A financial-action gates | **PASS (gate integrity only)** | Gates are strict, fail-closed and unmodified; every production path today yields `NON_FINANCIAL`/no amounts; exact missing evidence enumerated below |

**Executive verdict FAIL** follows directly from the acceptance rule: Stage 4 passes only if
economic valuation, source/operator provenance, configuration-bound freshness and eligible
independent validation are *all* adequately established. Gate B is materially FAIL (the
implementation structurally prices collateral in a rUSD-denominated quote with no USDC
conversion), gates C and D are FAIL (verified inadequacy, not ignorance), and gate E is UNKNOWN.
Missing evidence is never converted into a PASS anywhere in this document.

---

## 1. Actual oracle implementation and valuation path — Gate A: PASS (mechanics)

Everything below is verified from reproduced, runtime-hash-bound sources
(`evidence/phase1/sources/`, SHA-256/Keccak matched to the pinned deployed bytecodes at the
historic anchor) plus the retained 62-request pinned audit at block 22229239.

**Composition (on-chain, immutable-config verified):**

```
BASE_VAULT(0) × BASE_FEED_1(facade) × BASE_FEED_2(0)
price() = SCALE_FACTOR × ─────────────────────────────────────────────────────
         QUOTE_VAULT(0) × QUOTE_FEED_1(0) × QUOTE_FEED_2(0)
```

- Both vaults, the second base feed, and **both quote feeds are the zero address**; per
  `ChainlinkDataFeedLib.getPrice`, a zero feed returns exactly `1`. Therefore
  `price() = SCALE_FACTOR × BASE_FEED_1.getPrice()` with **no conversion layer of any kind**.
- `SCALE_FACTOR` is immutable `10^(36 + 6 + 0 + 0 − 18 − 18 − 0)` = **1 000 000**, confirmed by
  the reproduced constructor formula and the pinned on-chain getter.
- Feed facade `decimals()` is `pure 18`; collateral 18 decimals; loan 6 decimals.

**Mechanically exact calculation and units:**

- Facade `latestAnswer()` returns `int(cache.latestAnswerForFeed(feedId))`. At the retained audit
  block the stored answer was `1107000019483605886` — i.e. **≈ 1.10700019483605886 (18 dp) quote
  units per whole wsrUSD**, where the quote is documented as **rUSD** (Section 2).
- Morpho oracle `price()` = answer × 1 000 000 = `1107000019483605886000000`.
- Morpho Blue values collateral as `collateralBaseUnits × price / 10^36` in **loan base units**;
  one whole wsrUSD (10^18 units) therefore values to
  `10^18 × 1.10700019483605886e24 / 1e36 = 1 107 000.19483605886` loan base units = **1.107
  USDC-*named* units, mechanically, with no rUSD→USDC conversion ever applied**.

**Complete end-to-end path (all segments verified in reproduced source, runtime-hash-bound):**

1. A **CRE workflow** (Chainlink Runtime Environment) fetches price data from the **Chainlink
   Data Streams API**, checks deviation/heartbeat thresholds, and pushes updates on-chain
   (official Pharos documentation).
2. **KeystoneForwarder `report()`** validates `f+1` distinct signatures from the configured signer
   set for `configId = (donId<<32) | configVersion` against `keccak(rawReport)‖reportContext`.
   The separately owner-authorized **`route()`** path delivers without that signature
   validation (`signatureValidationInThisEntrypoint:false`).
3. **SelfManagedFeedsCache `onReport()`** requires `msg.sender == forwarder`, an explicitly
   allowed `workflowId` (plus optional `allowedWorkflowOwner` check, currently zero = disabled),
   skips answers whose `observationsTimestamp <= stored timestamp` (stale skip), and **ignores
   `validFromTimestamp` entirely**. It stores one `{answer, timestamp}` pair per feedId and emits
   `AnswerUpdated`. There is **no expiry**: old answers stay readable forever.
4. **SelfManagedFeedsCacheProxy** (the AggregatorV3 facade) exposes `latestAnswer`,
   `latestTimestamp`, `latestRoundData()` (roundId/answeredInRound always 0; startedAt equals
   updatedAt), delegating by `feedId`; its owner can change the feed ID or the target cache.
5. **MorphoChainlinkOracleV2.price()** applies scale 10^6 and Morpho consumes it with
   `collateral × price / 1e36`. The feed-consumer library **rejects negative answers only; it
   performs no staleness check by design** ("Staleness is not checked because it's assumed that
   the Chainlink feed keeps its promises").

Conclusion for Gate A: the **mechanical** implementation is fully established and reproducible —
this is a code-identity PASS, explicitly **not** an economic-correctness PASS.

## 2. wsrUSD / rUSD / USDC economic relationship — Gate B: FAIL

**Verified representation facts:**

- The official Pharos Pacific mapping (official document, 8722 bytes,
  SHA-256 `5d2c0bab…e110b42`, re-fetched 2026-11-06T14:19:01.671Z with the **identical SHA-256**,
  proving the published mapping is still current) lists the exact feed ID and facade as
  **WSRUSD/RUSD**, decimals 18 — i.e. the feed publishes a **rUSD-denominated** quantity. It is
  **not** WSRUSD/USDC.
- The market's loan token is USDC (0xC879…, 6 decimals). The oracle's quote side is unconverted
  (both quote feeds zero), so the implemented design **silently treats 1 rUSD = 1 USDC**.
- Internal representation confirms this: `configurationSchema.denomination` is the literal
  `ECONOMIC_QUOTE_UNVERIFIED`; no configuration-bound qualified denomination is representable
  today (`src/oracle-assurance/model.ts:43`).
- The observed answer ≈ 1.107 is consistent with a **yield-bearing share valuation** (wsrUSD
  accrues interest and is redeemable for >1 rUSD worth of rUSD), not with a rUSD/USDC market
  price and not with any USDC measure.

**Verified issuer facts (official Reservoir registry + savings documentation, retained today):**

- Exact Pharos registry row (`reservoir-addresses.body.txt`, SHA-256 `d0c14a1d…bb0d4`, retrieved
  2026-11-06T00:32:00.993Z): rUSD = `0x09D4214C03D01F49544C0448DBE3A27f768F2b34` and wsrUSD =
  `0x4809010926aec940b550D34a46A52739f996D75D` for chain option **Pharos** (collateral identity
  confirmed on the issuer side).
- The same registry documents the **same hex rUSD/wsrUSD addresses across 15+ chains** (Sonic,
  World Chain, Arbitrum, Sei, Unichain, BNB, Avalanche, Katana, Linea, Monad, Plasma, Megaeth,
  XDC, Pharos). Identical hex across EVM chains is consistent with deliberate cross-chain
  equivalence by deterministic deployment, but this document does **not** verify that claim;
  per-chain bytecode comparison would be required. Interpreted, not proven.
- The registry's Ethereum "Core" section (all core contracts deployed on Ethereum) lists
  **"Peg Stability Module (USDC)" at exactly `0x4809010926aec940b550D34a46A52739f996D75D`** — the
  same hex address as the monitored collateral. Verified document fact. EVM addresses are not
  globally unique across chains, so this establishes official issuer documentation associating
  this address family with a USDC peg-stability module; it does **not** prove that this exact
  address functions as a wsrUSD↔USDC mint/redeem entry point on Pharos (remains unverified), nor
  the quality/limit of its USDC liquidity.
- Issuer savings documentation: "wsrUSD … accrues interest each block and users can mint and/or
  redeem at any time"; "Redemptions will be fulfilled immediately **when the PSM has available
  liquidity**"; the interest rate is "actively maintained by governance … based on the state of
  the protocol balance sheet"; wsrUSD is "Reservoir's yield bearing token minted via rUSD" and
  availability is jurisdiction-restricted (non-U.S./non-sanctioned users).

**Assessment — this is why the gate FAILs rather than UNKNOWNs:**

1. The value being published is, by the issuer's own official mapping, a **rUSD quantity**; the
   market demands a **USDC quantity**; the deployed oracle **contains no conversion mechanism**
   (verified zero quote side). The conversion assumption 1 rUSD : 1 USDC is structural in the
   market design and is **not an assumption the monitor can accept unverified**.
2. Redemption: wsrUSD redeems (via the PSM path) for rUSD-side liquidity that is
   **liquidity-gated and governance-managed**, not contractually 1:1 USDC. No authoritative
   rUSD→USDC redemption or mint policy has been obtained.
3. Depeg/basis risk: rUSD's USDC/USD claim, wsrUSD's rUSD share ratio, PSM liquidity depth and
   the difference between the feed's **instant share valuation** and **realizable redemption
   proceeds** are all unmeasured. During stress, the feed can overstate liquidation-support value
   precisely when the borrower's collateral is hardest to realize — the direction that most
   endangers debt recovery. (Feed values a whole wsrUSD at 1.107 rUSD-equivalents while
   mechanical valuation calls it 1.107 "USDC"; any rUSD/USDC deviation and any share/redemption
   basis each multiply silently.)
4. Debt-side basis risk is separately unevaluated: the loan token's RPC symbol is "USDC", but
   **no issuer/bridge provenance evidence for `0xC879C018…` was obtained** in Stage 4. A
   symbol alone does not identify the economic issuer, bridge backing or redemption rights of
   the debt asset.
5. No authoritative document (issuer legal terms, PSM specification, audit scope, or a properly
   denominated alternative feed) was found that establishes the rUSD↔USDC conversion authority
   for this market.

Verified facts, assumptions and unknowns are separated explicitly in Section 9. The FAIL verdict
stands on verified absence of any conversion mechanism plus verified mismatch of the published
product denomination; remaining equivalence questions cannot rescue it.

## 3. Source and operator provenance — Gate C: FAIL

**Code-proven permission boundaries (reproduced runtime sources, pinned at the anchor):**

| Controller role | Observed address | Enforceable powers (source-verified) |
| --- | --- | --- |
| Facade owner | `0x007DB8D5b32015E34f63Cf5312505ADf03Fcca5d` | `setFeedId`, `setCache`, two-step ownership transfer |
| Cache owner | `0x59538b88DB99635Eb9181AdFBd1F6CF5588DDFf0` | `setForwarderAddress`, `setAllowedWorkflowId`, `setAllowedWorkflowOwner`, ownership transfer |
| Forwarder owner | `0xB8F1032c6E69ef81DB98CF036133b9CBeAD1B3b0` | `setConfig`/`clearConfig` (signer sets), `addForwarder`/`removeForwarder` |
| Workflow allowlist entry | workflow `0x00bd398f80a8f53c31e1270678b7dd5283d5b9a0f5898ae3c4ceed15455ede02` allowed; `allowedWorkflowOwner` = zero (check disabled) | Allowed-set membership is code-enforced; the zero-sentinel disables the optional owner comparison only |
| Sampled DON configuration | configId `4294967297`, f=3, 10 distinct signer addresses | `report()` requires f+1 = 4 distinct in-set signatures; `route()` is a separate owner-authorized path without signature validation |

**What this gate cannot establish (verified limitations, not remediable by reading):**

- **SOURCE_PROVENANCE (SOURCE_V1): zero of three requirements.** No reviewed workflow program or
  binary, no immutable build/compiler artifact binding the executable to the allowed workflow ID
  and DON/version, no Data Streams product/report schema or aggregation-input evidence bound to
  the active configuration. The published "WSRUSD/RUSD" table row and the CRE/Data Streams
  architecture description are official text, not the active workflow's source or input
  definition.
- **OPERATOR_PROVENANCE (OPERATOR_V1): zero of three requirements.** On-chain owner addresses
  are not legal identities; signer address distinctness does not establish organizational
  independence (one operator can run multiple keys); no authority ever attested who operates the
  workflow, its upstream Data Streams subscription, or the three owners.
- **CONFIGURATION_CONTROL completeness:** signer coverage in any produced fingerprint is
  `SAMPLED_ACTIVE_CONFIGS`, never `COMPLETE`; a bounded historical scan is not a
  deployment-to-present enumeration; route-path authorizations are sampled separately.
- **Independence of source ecosystem:** the feed, facade, cache and forwarder live inside a
  single Chainlink CRE/Data Streams ecosystem; without established operator identities there is
  no basis to assert separation from any potential comparator (relevant to Gate E).

Gate C is FAIL because the investigation established that the required provenance evidence is
absent and unobtainable by public read-only means — a verified inadequacy, distinct from "more
research might exist". No configured evidence ingestion today can promote SOURCE_V1 or
OPERATOR_V1 (`evaluateAssurance()` passes empty satisfied lists by design).

## 4. Freshness guarantees — Gate D: FAIL

**Mechanism of staleness behavior, verified in reproduced source:**

- **Strictness never enforced on-chain.** The cache stores the *latest* answer forever; its only
  timing rule is skipping non-increasing `observationsTimestamp` (emitting `StaleReport`). It
  **ignores `validFromTimestamp`**, accepts **future** timestamps, and features **no age expiry**
  (`CACHE_EXPIRY` finding). The consumer library (`ChainlinkDataFeedLib.getPrice`) checks
  negativity only ("Staleness is not checked…"), and Morpho's oracle composition adds nothing.
  A reader that succeeds today may be reading an arbitrarily old answer.
- **Timestamp semantics.** `startedAt` = `updatedAt` = the DON's report **observation
  timestamp** — *not* transaction inclusion time and *not* the reader's retrieval time
  (official document + reproduced facade source; `TIMESTAMP_SEMANTICS` PROVEN,
  `timestampMeaning: WORKFLOW_SUPPLIED_OBSERVATION_TIME`).
- **Published settings are not guarantees.** The Heartbeat (3600 s), DeviationThreshold (0.5)
  and decimals 18 are **common settings rows** for the push-engine product; they are not bound
  to the exact feed's active workflow/configuration fingerprint, not an upstream maximum
  observation age G, and not a publishing-contract enforcement. Historical measured ages (Stage
  2: 1333 s over a 3601 s bounded interval; audit: 1103 s) are observations, never guarantees.
- **Evaluator wiring.** `analyzeFreshness()` accepts qualified `VerifiedTiming` heartbeat/inputs,
  but the schema (correctly) refuses any such value whose `configurationFingerprint` is not equal
  to the complete active fingerprint with PROVEN, hashed, `VERIFIED_SOURCE`/`OFFICIAL_DOCUMENT`
  evidence for chain 1672 and this exact facade
  (`src/oracle-assurance/freshness.ts:23-27`; `src/oracle-assurance/model.ts:65-79`).
  `evaluateAssurance()` supplies **no verified timing and no configuration fingerprint for
  freshness** (`src/oracle-assurance/evaluate.ts:88-93`), so a VERIFIED freshness state is
  unreachable in production by construction until qualified timing ingestion exists. This is a
  fail-closed design and was not modified in Stage 4.
- **Configuration/restart continuity.** The continuity machinery exists and is code-proven:
  `configurationBaselineSchema` binds {block, configuration, SHA-256 fingerprint, observation
  timestamp}; change codes compare prior→current configuration; sticky invalidation
  (`ORACLE_*_CHANGED`, `OBSERVABILITY_GAP`) is not cleared merely by later samples
  (`src/oracle-assurance/evaluate.ts:61-71`). But fingerprints include only **sampled**
  signer/workflow evidence, and because no verified timing exists, the required
  `timingConfigurationFingerprint === configurationFingerprint` binding (Gate D's core) cannot
  arise. Whether continuity survives host restarts in production is **untested** — the monitor is
  stopped and no production deployment exists to observe; Stage 3A's proven restart-persistence
  covers alerts/actions, not assurance baselines in a deployed context.
- **Local policy.** Any operator-defined `localMaxAgeSeconds` is an explicit local rejection
  policy (`OPERATOR_DEFINED_LOCAL_REJECTION`); passing it does not prove a heartbeat or an
  upstream guarantee, and no implicit default was introduced.

Gate D verdict FAIL: the only verified, on-chain "freshness guarantee" is that **none exists**;
the published heartbeat is unbound documentation; and the evaluator cannot accept timing claims
until the full binding chain exists.

## 5. Independent economic comparator — Gate E: UNKNOWN

**Eligibility requirements (all enforced by `compareIndependent()`; none waivable):** AVAILABLE
`MARKET_PRICE`; exact base (1672, `0x4809…D75D`, 18) and quote (1672, `0xC879…`, 6);
positive bounded price; explicit denomination; positive documented frequency; operator identity;
provenance; and — decisive for this investigation — a **selected upstream identity** from the
primary path to compare against, plus all eight `ASSET, QUOTE, DENOMINATION, TIMESTAMP,
FREQUENCY, OPERATOR, PROVENANCE, INDEPENDENCE` proofs as PROVEN, hashed, subject/chain-bound
evidence. `evaluateAssurance()` **deliberately supplies no selectedUpstreamId** because the
selected source identity is unresolved (Gate C), so no comparator can currently be made eligible
even with all other evidence in hand.

**Verification outcomes:**

- No eligible comparator is configured; `selectedUpstreamId == null`; the evaluated
  INDEPENDENT_VALIDATION state is `UNKNOWN`/ineligible with `NO_QUALIFIED_INDEPENDENT_SOURCE`.
- Bounded retained research: three Chainlink documentation URLs 404; data.chain.link
  WSRUSD/RUSD (Avalanche) 429; DexScreener exact-address and exact-Pharos lookups returned no
  pairs.
- Stage 4 reconfirmations (2026-11-06T14:19Z, unauthenticated, no paid access): the official
  Pharos mapping re-fetched **byte-identical** (SHA-256 `5d2c0bab…`); the DexScreener Pharos
  lookup again returned an empty pair list (2 bytes, SHA-256 `4f53cda1…`, URL
  `https://api.dexscreener.com/token-pairs/v1/pharos/0x4809010926ae…`); the official Chainlink
  "Exchange Rate Data Streams" page is now HTTP 200 (16.9 MB SPA,
  SHA-256 `c235f9a7…a8eeb1`) and confirms the product family exists, but its stream inventory is
  client-rendered and was not enumerated; Chainlink Data Streams is a signed-up, billed service
  ("Sign Up", "Billing"), i.e. **paid/authenticated access that Stage 4's boundaries prohibit**.
- Even if a wsrUSD/rUSD exchange-rate stream were obtained on another chain, a differently
  denominated or cross-chain feed cannot substitute for a source-independent exact
  **Pharos wsrUSD/USDC** market price, and it would share the same upstream operator family as
  the primary feed, defeating independence.

Gate E verdict UNKNOWN, per the investigation rule (`If independence cannot be established, mark
this gate UNKNOWN`). The known-unachievable pieces (selected upstream identity, paid access,
denomination) are documented so the uncertainty is operational rather than rhetorical.

## 6. Existing Stage 3A financial-action gates and exact missing evidence — Gate F: PASS (integrity)

Stage 3A's typed actions remain intact and were **not** modified. The financial path is
`deriveSuggestedAction()` → `qualified()` (`src/actions/derive.ts:47-60`) and the strict,
all-or-nothing `evaluateRecoveryEligibility()` (`src/risk/eligibility.ts:52-92`), driven by
`calculateAssuredRisk()` (`src/risk/assured.ts:26-71`). All conditions must pass
independently; failing ones are collected as bounded reason codes; no solver runs otherwise; no
amount exists when blocked.

**Verified behavior:** with the current production inputs (assurance `UNVERIFIED`, gate
`DATA_UNVERIFIED`, freshness `UNKNOWN`, independent `UNKNOWN`/ineligible, progression
`UNKNOWN`/`FIRST_OBSERVATION`, denomination `ECONOMIC_QUOTE_UNVERIFIED`), every financial option
is impossible: `derive.ts` requires `qualified()` ⇒ assurance `VERIFIED` +
`ASSURANCE_REQUIREMENTS_MET` + freshness `VERIFIED` + independent `VERIFIED`+eligible +
`ADVANCING` progression + zero reason codes + matching
`freshness.timingConfigurationFingerprint === configurationFingerprint` + estimate-provenance
binding. The retained Stage 2 alert set is 100% `NON_FINANCIAL`, `actionable:false`,
`financialOptions: []`. Gate integrity FAIL-closed behavior is confirmed as working — the PASS
verdict is about gate integrity, **not** about evidence availability.

**Exact missing evidence per blocked reason (current production reason set is retained from the
completed qualification; unchanged):**

| Missing evidence | Blocking reason code |
| --- | --- |
| Real position observation/progression sequence establishing `ADVANCING` (not `FIRST_OBSERVATION`/`UNKNOWN`) — requires a separately authorized new observation workflow | `RECOVERY_CHAIN_PROGRESSION_UNKNOWN` |
| Oracle assurance overall `VERIFIED` — requires **all seven dimensions** VERIFIED (currently 1 VERIFIED + 2 PARTIALLY + 3 UNVERIFIED/UNKNOWN + sampled config) | `RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED` |
| Assurance gate `ASSURANCE_REQUIREMENTS_MET` | `RECOVERY_ASSURANCE_GATE_NOT_MET` |
| Freshness `VERIFIED` with observation timestamp — requires configuration-bound verified heartbeat + upstream guarantee (Gate D) | `RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED` |
| Independent validation `VERIFIED` + eligible — requires comparator + selected upstream identity + actual independence (Gate E) | `RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED` |
| Configuration/fingerprint present and timing-fingerprint equal | `RECOVERY_CONFIGURATION_MISMATCH` |

**Structural prerequisites that evidence alone cannot clear (implementation, later and only with
explicit authorization):** schema representation of a verified denomination
(replacing literal `ECONOMIC_QUOTE_UNVERIFIED`), `SOURCE_V1`/`OPERATOR_V1` evidence ingestion,
`VerifiedTiming` ingestion through `evaluateAssurance()`, selected-upstream establishment, and
complete signer/route/controller coverage with post-change requalification. For this market,
even a fully implemented schema chain cannot produce a verified USDC denomination while the
rUSD→USDC conversion question (Gate B) remains unresolved by the market/oracle design itself.

## 7. Evidence table

| Evidence | Subject / source | Block / timestamp | Immutable reference |
| --- | --- | --- | --- |
| Reproduced oracle contract source | `evidence/phase1/sources/MorphoChainlinkOracleV2.sol` | reviewed 2026-11-01T13:50Z window | see `src/oracle-assurance/reviewed.ts` + manifest |
| Feed consumer library | `evidence/phase1/sources/verified-ChainlinkDataFeedLib.sol` | — | hash `82b18d00…59ae06` |
| Facade source | `evidence/phase1/sources/SelfManagedFeedsCacheProxy.sol` | — | hash `cc61c1da…80b4cefe` |
| Cache source | `evidence/phase1/sources/SelfManagedFeedsCache.sol` | — | hash `602a035e…cbd461` |
| Forwarder source | `evidence/phase1/sources/KeystoneForwarder.sol` | — | hash `edae1208…0542c` |
| Retained 62-request pinned configuration audit | block 22229239, hash `0x3623b544…81906d4c`, ts 1793925778 (00:42:58Z) | archive summary SHA-256 `be1fdcfc…35b8b09` | `…\oracle-rpc-audit\summary.json` |
| Official Pharos mapping/settings (retained) | docs.pharos.xyz /tooling-and-infrastructure/oracles/chainlink-pe.md | fetched 2026-11-06T00:31:59.706Z, 8722 bytes, SHA-256 `5d2c0bab…e110b42` | `…\public-oracle-research\pharos-chainlink-push-engine.body.txt` |
| Official Pharos mapping re-confirmation (Stage 4) | same URL | fetched 2026-11-06T14:19:01.671Z, **8722 bytes, same SHA-256** | `…\stage4-oracle-reads\pharos-chainlink-push-engine.body.txt` |
| Official Reservoir registry (retained) | docs.reservoir.xyz /security-and-compliance/smart-contract-addresses.md | fetched 2026-11-06T00:32:00.993Z, 16097 bytes, SHA-256 `d0c14a1d…12bb0d4` | `…\public-oracle-research\reservoir-addresses.body.txt` |
| Official Reservoir savings page (retained) | docs.reservoir.xyz /products/savings-srusd-and-wsrusd.md | fetched 2026-11-06T00:32:00.915Z, 1095 bytes, SHA-256 `f2263323…65866` | `…\public-oracle-research\reservoir-savings.body.txt` |
| Chainlink Exchange Rate Data Streams page (Stage 4) | docs.chain.link/data-streams/exchange-rate-streams | fetched 2026-11-06T14:19:33.306Z, HTTP 200, 16 942 643 bytes, SHA-256 `c235f9a7…a8eeb1` (SPA; stream inventory client-rendered, not enumerated) | `…\stage4-oracle-reads\chainlink-exchange-rate-streams.body.txt` |
| DexScreener Pharos exact-address lookup (Stage 4) | api.dexscreener.com /token-pairs/v1/pharos/0x4809010926ae… | fetched 2026-11-06T14:19:34.046Z, HTTP 200, 2 bytes (`[]`), SHA-256 `4f53cda1…02b945` — no pairs | `…\stage4-oracle-reads\dexscreener-pharos-collateral.body.txt` |
| Observed feed answer / timestamp (retained audit) | feedId `0x0007c129…09fa6` | answer `1107000019483605886`; startedAt=updatedAt=cache ts `1793924675`; measured age 1103 s at audit block | oracle-rpc-audit responses 022/029/030/035/036 |
| Controller getters (retained audit) | facade/cache/forwarder owners; workflow allowlist; DON config | addresses as in Section 3 | oracle-rpc-audit responses 025/031/037/038/049-060 |
| Seven-dimension prerequisite record | retained completed-qualification artifact | analyzedAt 2026-11-06T00:48:39.997Z, SHA-256 `03178712…6fd5` | `…\oracle-qualification-gaps.json` |
| Historical Stage 2 evaluated assurance (not superseded) | UNVERIFIED / DATA_UNVERIFIED; config fingerprint `c5fdcac7…18fb0` | anchor 22225454 | gaps.json `historicalEvaluatedResult` |

## 8. Verified facts vs assumptions vs unknowns

**Verified facts (each backed by an evidence reference above):**

1. Oracle composition, scale 10^6, price formula and unit path; feed answer 1.10700019483605886
   (rUSD-denominated per official mapping) at the retained audit block; Morpho's
   `price × collateral / 1e36` valuation of 1 whole wsrUSD → 1 107 000.19483605886 loan base
   units.
2. The oracle's quote side is inactive (both quote feeds zero): the design contains **no**
   rUSD→USDC conversion.
3. The official feed product is **WSRUSD/RUSD**, 18 decimals; the collateral's issuer identity is
   wsrUSD on Pharos per the issuer's own registry; the issuer documents a USDC Peg Stability
   Module at the same hex address and wsrUSD/rUSD at identical hex addresses across 15+ chains.
4. On-chain staleness enforcement is absent end-to-end (cache skip-only, no expiry, validFrom
   ignored, future timestamps accepted; consumer checks negativity only); timestamps are
   DON-supplied observation times; round IDs are always 0.
5. Permission boundaries and the three controller addresses are source- and runtime-verified;
   report-path signature validation (f+1 of configured set) is separate from the owner-authorized
   `route()` path; signer/workflow coverage is sampled, never complete.
6. `freshnessSchema` and `independentSchema` make a VERIFIED state unreachable without
   configuration-bound hashed timing evidence and a selected upstream identity that
   `evaluateAssurance()` does not supply; `qualified()` and `evaluateRecoveryEligibility()`
   consequently never produce financial options today.
7. Stage 4 created no evaluated assurance change, no code change, no monitored cycle.

**Assumptions (explicitly assumptions, not facts):**

- That identical hex addresses across chains imply identical asset semantics (cross-chain
  equivalence by design) — plausible, unverified at bytecode level per chain.
- That the issuer's Ethereum PSM row describes contract behavior available at the same address on
  Pharos.
- That the loan token's "USDC" RPC symbol reflects a USD-pegged, issuer-credible asset.

**Unknowns (would each be required for promotion):**

1. The active CRE workflow's program/binary, build artifact, product/report schema, aggregation
   inputs and their binding to the allowed workflow ID and this feed.
2. Real-world identities/independence of the economic source publisher, workflow executor and the
   three controller owners, plus complete signer/route authorization coverage.
3. An authoritative rUSD↔USDC conversion authority (issuer policy, PSM on-chain behavior on
   Pharos, or a correctly denominated market/oracle design) and measurable depeg/redemption
   basis/liquidity depth.
4. The loan asset's issuer/bridge provenance.
5. Upstream maximum-age guarantee G and a fully configuration-bound heartbeat H.
6. Any eligible, genuinely independent comparator; and whether a qualified comparator exists at
   all without paid Data Streams access (unauthorized in Phase 4).
7. Production restart/configuration continuity of assurance baselines (monitor stopped; cannot be
   observed in Phase 4).

## 9. Recommended next step

Do **not** proceed to any production or financial stage. Preserve the block.

1. **Highest-value, authorization-free research question (if later authorized as read-only):**
   obtain issuer/design-authority documentation for the market's intended collateral valuation —
   either (a) confirmation that this market prices wsrUSD in **rUSD terms** with the rUSD/USDC
   relationship delegated to the PSM, which must then be characterized on-chain (PSM
   mint/redeem, liquidity) and independently priced, or (b) evidence of an intended
   correctly-denominated design, in which case the market/oracle choice itself is the item to
   renegotiate, not the monitor.
2. **Before any gate-promotion implementation work:** a separately authorized engineering
   program is required — denomination-capable schema, SOURCE_V1/OPERATOR_V1 ingestion,
   VerifiedTiming ingestion via `evaluateAssurance()`, complete signer/route coverage, and
   selected-upstream identity — followed by a real, separately authorized observation/progression
   workflow.
3. Meanwhile the watchdog's correct, unchanged behavior stands: non-financial actions instruct
   independent verification of the oracle's source, freshness and configuration
   (`ORACLE_REQUIRES_VERIFICATION`), and no request can be granted where the design itself
   (Gate B) remains unqualified.

## 10. Operating-boundary confirmation

- Monitor **STOPPED** throughout; no monitoring cycle, restart, scheduler or deployment.
- No transactions, signing, broadcasting, notifications, database writes/migrations, Neon or
  production access, paid services or spending; treated remote content strictly as data; the one
  non-2xx-free new read batch was unauthenticated public documentation/API research.
- No changes to application/test code, eligibility logic, schemas or gates. Repository writes in
  this task: **exactly one file — this document**. The staged diff remained empty; the Git index
  and HEAD were not modified; a post-write read-only re-verification of index bytes, staged diff,
  status, HEAD state and relevant Node processes runs alongside delivery.
- All prior completed qualification artifacts, original Stage 2 evidence (including failure
  remnants), retained research archives and unrelated user work are untouched and unmodified.

---

*Prepared read-only for Phase 4. The FAIL verdict preserves the existing financial-action block
pending the evidence in Sections 6–8; this document does not authorize any monitoring, deployment
or financial operation.*
