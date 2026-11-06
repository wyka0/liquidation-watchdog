# Stage 5A — Qualified Market Discovery (READ-ONLY)

**Completed:** 2026-11-06 (UTC)
**Scope:** bounded read-only public-chain enumeration of Pharos Morpho Blue markets plus free, unauthenticated public-document research; no code, test, configuration, Git-index, deployment or monitoring changes
**Executive verdict:** **NO QUALIFIED MARKET FOUND.** Three distinct Morpho Blue market identities exist in evidence; **all three FAIL** — none can safely support financially quantified repayment or collateral-recovery recommendations under the existing, unmodified Stage 3A gates.
**Monitor state:** STOPPED throughout (no monitoring cycle was started at any point)
**Financial-action status:** remains **BLOCKED** — unchanged, untouched
**Document budget honored:** this is the only repository file created by Stage 5A

Stage 5A asks: *is there a Pharos lending market with active collateral and borrowing whose collateral valuation can be established as economically trustworthy in USDC terms, with adequate provenance, freshness assurance and independent validation, such that a quantified recovery recommendation could be demonstrated safely?* This document answers with bounded new facts. It does not weaken any existing gate, does not implement Stage 5, and does not manufacture a PASS where evidence does not support one.

---

## 1. Method and boundaries (all free, unauthenticated, read-only)

**On-chain enumeration (bounded rake).** Two bounded scans of `https://rpc.pharos.xyz` (chainId 1672) via `eth_getLogs` on the Morpho Blue contract `0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb` (v1.0.0, deployed-bytecode first-code block `4202147`, verified by binary search):

| Scan | Window | Blocks | Request semantics | Result |
| --- | --- | --- | --- | --- |
| Run 2 | last 60,000 blocks (≈14.6 h; head 22287224) | ≥22227224 | `Borrow` + `SupplyCollateral` topic0 in 500-block windows | 1 distinct market id; **0 Borrow events** |
| Run 3 | last 150,000 blocks (≈36 h; head 22287883) | ≥22137883 | same, 1000-block windows (audited maximum), cap-splitting on 512-log hits | **3 distinct market ids**, plus the anchor market re-verified directly by identity read |

- Event topic0 hashes (`Borrow` `0x5709545…2a43`; `SupplyCollateral` `0xa3b9472…1864`; and `CreateMarket` `0xac4b240…63ac`) were **derived from the retained compiler-verified Morpho ABI** (`morpho-compiler-output.json` → canonical signatures + keccak256, stored as `event-signatures.json`); no hash was guessed.
- Zero RPC errors, zero truncated (≥512-log) windows, zero null windows in run 3 (`scanNulls: 0`, `splitCount: 0`).
- For every distinct id, authoritative parameters were read via `idToMarketParams(Id)` (reproduced `IMorpho.sol:326`) through Multicall3 (`0xcA11…CA11`, `aggregate3` with per-safe-call failures) and **independently re-verified** by recomputing `keccak256(abi.encode([loanToken, collateralToken, oracle, irm, lltv]))` per `src/validation/market.ts:15-21` — **all three ids matched** (`idVerified: true` ×3).
- Market state (`market(Id)` — six uint128 fields), current `position(Id, address)` samples from in-window log participants, ERC20 `symbol()/decimals()/name()/balanceOf(Morpho)`, full oracle composition getters (`BASE_FEED_1/2`, `BASE/QUOTE_VAULT`, `…_CONVERSION_SAMPLE`, `SCALE_FACTOR`, `price()`), downstream feed getters (`typeAndVersion`, `owner`, `getFeedId`, `aggregator`, `latestAnswer/Timestamp`, `latestRoundData`) and the pricing vault's own getters were read in bounded batches (runs 3–6; 245 + 310 + 6 + 4 + 1 requests total ≈ 566, all logged in `trace2..6.json`).
- Full-history `CreateMarket` enumeration was **not** feasible: the node silently returns empty for windows beyond the audited 1000-block bound, and a full span (≈18.1 M blocks) would require ≈18,000 windows. Market creation dates/creators are therefore recorded as UNKNOWN (documented limitation, not omission).
- **Residual coverage limitation:** the rake enumerates markets that emitted `Borrow` or `SupplyCollateral` within ≈36 h. A market with zero activity in the window would not appear. One internal-ledger observation supports that such markets may exist: the sum of the three enumerated markets' idle USDC (supply − borrow = ≈3,126,143.75 USDC) is **≈281,323.93 USDC short** of Morpho's actual USDC balance (`balanceOf(Morpho)` = 3,407,467.68; read at run 4, block 22288365). The gap is consistent with at least one additional non-enumerated market holding USDC supply without in-window activity. Recorded as an observation, not resolved.

**Off-chain research (free).** Official Pharos Chainlink push-engine feed page (re-fetched; byte-identical SHA-256 `5d2c0bab…e110b42`, third consecutive identical fetch — the published mapping is current), issuer/documentation research for the newly discovered collateral tokens, DexScreener Pharos pair lookups for all three tokens, and DIA/Circle/DefiLlama cross-references for the loan token. All fetch bodies + SHA-256s are preserved in the Stage 5A temp capsule (`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\stage5a-discovery\`); no paid, authenticated or MCP-only source was consulted, and no RPC/MCP agreement is treated as independent economic validation.

**Code-side truth (unmodified, verified locally).** `parsePositionIdentity()` (`src/positions/model.ts:56-60`) hard-pins the supported position identity to the exact chain/protocol/market/oracle/IRM/loan/collateral tuple of the Stage 2 market (`DEPLOYMENT.marketId` = `0xbea21c37…49e73`). Any other market raises `POSITION_UNSUPPORTED`, and `evaluateRecoveryEligibility()` (`src/risk/eligibility.ts:72`) yields `RECOVERY_SNAPSHOT_IDENTITY_MISMATCH` → no financial options. This is a **structural** failure of the financial-action gate for every non-anchor market, independent of oracle quality.

Morpho liquidation parameters reproduced from the verified sources (`ConstantsLib.sol`, `Morpho.sol:365-368`): `LIQUIDATION_CURSOR = 0.3e18`, `MAX_LIQUIDATION_INCENTIVE_FACTOR = 1.15e18`, `ORACLE_PRICE_SCALE = 1e36`; incentive factor = `min(1.15, 1/(1 − 0.3×(1 − LLTV)))`.

---

## 2. Enumeration result — markets with active collateral and borrowing

Three distinct Morpho Blue market ids were observed with recent activity (plus the Stage 2 anchor market, verified separately by direct identity read). All loan sides use **the same USDC loan token and the same IRM** (`0xD5E02889…DF3a`); states read at block 22288365 (run 4, 15:09Z) unless noted:

| # | Market id (verified by re-derivation) | Loan / Collateral (18-dec or 6-dec as read) | LLTV | Recent activity in 36 h window | Market size (USDC-loan base units) |
| --- | --- | --- | --- | --- | --- |
| C (anchor) | `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73` | USDC (6 dec, `0xC879C018…1815`) / wsrUSD (18 dec, `0x48090109…D75D`) | 0.915 | **0** events (activity preceded the window) | supply 20,601,276.55; borrow 18,002,831.59 |
| A | `0xd834016ed49b76ffcbeb8402733e2d69b1f77d30b28d6f21c826931214ae5aea` | USDC / **APT "Axil Pot"** (18 dec, `0x13282289…b0F8`) | **0.86** | 1 SupplyCollateral (block 22255355 ≈ 07:07Z); 0 Borrow | supply 1,086,626.60; borrow 975,971.62 |
| B | `0xc79579a002dbc8c535d3a87198fcbbece1a664ad82a356b0447c5bff9e16fd86` | USDC / **syzUSD "Staked Yuzu USD"** (18 dec, `0x54dF79D8…8934`) | 0.915 | **2 Borrow + 2 SupplyCollateral** (block 22169884–22169935 ≈ 28 h ago); two sampled live debt positions | supply 4,174,556.55; borrow 3,757,512.74 |

Position samples (run 3, raw on-chain `position()` reads; debt = borrowShares × market borrow assets/shares ratio ≈1.0132e-6 USDC per share, exact within the read block):

- **A / `0x966B9dCE…fB257`:** collateral 153,191.35 APT (≈154,800 USDC nominal at 1.010541); borrowShares 69,977,880,991,489,665 → ≈70,209 USDC debt (≈52.7% of its LLTV-0.86 borrow limit; the market's remaining ≈905.8k USDC debt is held by accounts whose activity predates the window).
- **B / `0x96B7d14D…537b6`:** collateral 169,490.80 syzUSD (≈185,388 USDC nominal at 1.093776); borrowShares 166,468,109,432,766,137 → ≈168,534 USDC debt — **≈99.3% of its LLTV-0.915 borrow limit**.
- **B / `0xE6a47712…9e7c`:** collateral 1,542,766.60 syzUSD (≈1,687,572 USDC nominal); borrowShares 1,515,367,357,434,141,280 → ≈1,535,390 USDC debt — **≈99.4% of its borrow limit**.
- **C / `0x086eb9C2…E327`** (retained Stage 2 observation borrower, direct read at run 5): collateral 18,706,585.51 wsrUSD; borrowShares 17,768,613,114,986,061,183 — i.e., the anchor market's entire ≈18.0 M USDC debt is this monitored public account.

The two sampled candidate-B borrowers sit ≈0.6–0.7% from their liquidation thresholds — genuinely useful positions for any future safely-demonstrated liquidation-suppose adequacy analysis, which is precisely why their market's oracle failures in § 4.3 matter.

ERC20 sanity (run 4): USDC `symbol=USDC, decimals=6, name=USDC`; APT `symbol=APT, name=Axil Pot, decimals=18`; syzUSD `symbol=syzUSD, name=Staked Yuzu USD, decimals=18`; wsrUSD `symbol=wsrUSD, name=Wrapped Savings rUSD, decimals=18`. Actual collateral parked in Morpho: APT 2,051,323.82; syzUSD 3,843,816.94; wsrUSD 18,706,623.52.

**Loan-asset provenance — new verified fact (closes a Stage 4 unknown):** the loan token `0xC879C018dB60520F4355C26eD1a6D572cdAC1815` is **Circle-issued native USDC on Pharos**: Circle's own announcement ("USDC and CCTP are now live on Pharos… Mainnet Address: 0xC879C018dB60520F4355C26eD1a6D572cdAC1815", issued by regulated Circle affiliates), the official Pharos token registry ("USDC (Circle Deployed)"), Circle's multichain page, CCTP V2 contracts on Pharos (TokenMessengerV2 domain 31, `0x28b5a0e9…8cf5d` etc.), verified explorer proxy (`FiatTokenProxy`), and cross-chain directory corroboration. The debt side being denominated in a Circle-issued, redeemable 1:1-for-USD regulated stablecoin is now an **officially established fact** — it upgrades Stage 4's unknown #4 for the debt asset. (This concerns the debt asset's issuer; it does not by itself qualify any collateral valuation.)

---

## 3. Candidate A — USDC / APT ("Axil Pot"), market `0xd834016e…`

### 3.1 Composition, exact valuation formula (mechanics verified)

- Oracle `0xd7E33079D91c5fA12798C1e7b28A7877045aa7C3` — deployed runtime code **2,557 bytes, exactly the reproduced `MorphoChainlinkOracleV2` family** confirmed against the retained Stage 4 audit snapshot of `0x9416F861970C2a39c02ab7696Ef0496383d4E81b` (identical length; same ten composition selectors decoded from bytecode: `BASE_VAULT`, `BASE_VAULT_CONVERSION_SAMPLE`, `BASE_FEED_1/2`, `QUOTE_VAULT`, `QUOTE_VAULT_CONVERSION_SAMPLE`, `QUOTE_FEED_1/2`, `SCALE_FACTOR`, `price()`; no `typeAndVersion`/`owner`-class getters exist on this contract family — the run-4 getter batch nulls are expected behavior, re-verified with the correct selector set in run 5).
- On-chain inlined configuration (run 5): `BASE_VAULT = 0x921974d7B1a2dbACcaf5ba893A3A1500638Cea6B`, `BASE_VAULT_CONVERSION_SAMPLE = 1e18`, **all feeds zero**, `QUOTE_VAULT = 0`, `QUOTE_VAULT_CONVERSION_SAMPLE = 1`, `SCALE_FACTOR = 1e18`.
- Exact formula (per reproduced `MorphoChainlinkOracleV2.sol:144-148` with zero feeds = 1):
  `price() = 1e18 × BASE_VAULT.getAssets(1e18)` — and the on-chain vault establishes the semantics of `getAssets(sample)` computationally: `convertToAssets(1e18) = 1,010,541` raw USDC units ⇒ `price() = 1.010541e24` (read twice; exact).
- Market valuation (Morpho Blue `Morpho.sol`): collateralBaseUnits × price() / 1e36 in loan base units ⇒ **1 APT (18 dec) pieces valued at exactly 1.010541 USDC** by the vault's own share accounting. `LLTV 0.86 ⇒ liquidationIncentiveFactor = 1/(1 − 0.3×0.14) ≈ 1.04384` (factor under the 1.15 cap).

### 3.2 What the price source actually is (issuer provenance, verified)

- APT = **"Axil Pot"** — an RWA (real-world asset) consumer-credit yield vault: launched ≈Oct 1, 2026 by **Axil** (curator) through **R25** vault infrastructure, marketed via TopNod Wallet; ~8% target APY; underlying assets per public materials are money-market-type liquid assets plus emerging-market consumer/BNPL micro-loans (press: GlobeNewswire 2026-10-01, Xrada 2026-10-04, AiCoin 2026-11-05 analog). The on-chain ERC20 resides at `0x13282289…b0F8` — an **unverified ERC1967 proxy** on the Pharos explorer (total supply ≈12,762,051.94; 76 holders).
- Pricing vault `0x921974d7…ea6B` (read, run 6): `asset()` = **the market's own USDC**; `totalAssets() = 12,896.61 USDC` (on-chain cash buffer only); `totalSupply() = 12,762,075.53e18` shares; NAV per share 1.010541 USDC; the vault does **not** expose `symbol/name/decimals/typeAndVersion/description/owner/redeemFee` (all reverted) — a minimal custom ERC-4626-style contract of unverified provenance with an unexamined upgrade path.
- Manager-side design facts from public material: NAV depends on **off-chain RWA accounting**; instant T+0 redemption is capped by a daily liquidity buffer reported at ≈10% of vault size, remainder T+1…T+7; capacity was capped at $10 M at launch; no underlying-asset address list, audit results or full risk methodology was published.

### 3.3 Assurance assessment

| Gate | Verdict | Basis |
| --- | --- | --- |
| Mechanics (exact formula + units) | **PASS (mechanical)** | Formula reproduced end-to-end on-chain, twice-consistent reads |
| Economic denomination (USDC trustworthiness) | **FAIL** | The USDC denomination is **the curator's own accounting** (`convertToAssets`) of an unverified proxy vault whose on-chain cash buffer covers only ≈0.62% of the market's outstanding collateral nominal (2,051,323.82 APT ×1.010541 ≈ 2,072,824 USDC nominal vs 12,896.61 USDC on-chain). NAV integrity rests on off-chain RWA loan performance and curator invoices that cannot be independently validated from free public sources. There is **no market/oracle price at all** — no feed, no comparator. A liquidator realizing this collateral depends on the vault's T+0/T+7 redemption windows whose depth is policy-gated by the same curator whose accounting defines the price. |
| Oracle source/operator provenance | **FAIL** | No feed to attribute; the pricing authority is an **unreadable-minimal, unverified vault contract** whose owner/administration cannot be established on-chain (owner getter absent) and whose deployer identity is UNKNOWN (creation tx not enumerable within budget; explorer lists contract as unverified). No workflow, signer set, source or authoritative operator statement exists. |
| Freshness enforcement | **FAIL** | On-chain share accounting is fresh by construction, but its **economic** freshness (correctness of NAV over time) has no independent tie to reality; no price feed exists to age-check, and nothing prevents the vault's accounting from holding any value. |
| Independent economic comparator | **UNKNOWN** | DexScreener Pharos pair lookup for APT: **zero pairs** (2-byte `[]`, SHA-256 `4f53cda1…02b945`). No free public comparator exists for a curator-set NAV. Genuine independence cannot be established. |
| Stage 3A financial-action gates | **FAIL** | Identity mismatch `RECOVERY_SNAPSHOT_IDENTITY_MISMATCH` by the structural pin (§ 1); plus every assurance gate above. |

**Candidate A verdict: FAIL.** It cannot safely support quantified repayment or recovery recommendations: the instrument pricing is the curator's self-reported accounting, the collateral's realizable USDC path is policy-limited and ~0.6% covered on-chain, and no independent price exists at any price.

---

## 4. Candidate B — USDC / syzUSD ("Staked Yuzu USD"), market `0xc79579a0…`

### 4.1 Composition, exact valuation formula (mechanics verified)

- Oracle `0x4eEfC4C6e7216Aedd5E809e4fC74fb8859B3FA46` — same reproduced `MorphoChainlinkOracleV2` family (2,557-byte runtime; identical length to the Stage 2 oracle; diff analysis shows the deployed code is byte-for-byte identical except one embedded address: `BASE_FEED_1` inlined as `0x36Aff5A272c80B3222c0C9138f2D43c7FAE2F372` where the Stage 2 oracle inlines `0xb5779919…1BC`).
- On-chain configuration (run 5): `BASE_FEED_1 = 0x36Aff5a2…72cE`, everything else zero, `SCALE_FACTOR = 1e6` — the **exact same architecture as the Stage 2 market**: `price() = 1e6 × BASE_FEED_1.latestAnswer()`.
- Feed: `SelfManagedFeedsCacheProxy 1.0.0` at `0x36Aff5a2…`, `aggregator = 0xd9F00c86ced2De92F6B7152b0492cb28edc4B5a8` (**the same self-managed cache the Stage 2 feed uses**), `owner = 0x007DB8D5b32015E34f63Cf5312505ADf03Fcca5d` (**the same facade/controller owner as the Stage 2 feed**), `getFeedId() = 0x0007690a1667f3978924aa34b16a46ab12fcaae1b012c2f348905cb8299f58b7`.
- **Official product mapping (unchanged doc, SHA re-verified):** the exact feedId and facade appear in the official Pharos price-feed table as **`SYZUSD/YZUSD`** — i.e. the feed publishes syzUSD valued in **YZUSD**, exactly parallel to Stage 2's `WSRUSD/RUSD`. It is not `SYZUSD/USD` and not `SYZUSD/USDC`.
- Latest state at run 5 (15:06Z): answer `1.093776084463388736` (18 dp), observation timestamp `1793977477` (2026-11-06T15:04:37Z, ≈2 m before read); `latestRoundData` roundId/answeredInRound both `0` (as the official page states is inherent for the product).
- Exact end-to-end: `price() = 1,093,776,084,463,388,736 × 1e6 / 1e18 = 1.093776…e24` ⇒ 1 syzUSD = 1.0937761 USDC-*named* units **mechanically, with no YZUSD→USDC conversion**. `LLTV 0.915 ⇒ liquidationIncentiveFactor = 1/(1 − 0.3×0.085) ≈ 1.02617`.

### 4.2 Issuer provenance (verified from public sources)

- syzUSD (Pharos `0x54dF79D8…8934`, verified by Chainlink CCIP cross-chain directory row "Pharos Mainnet · BurnMint · 0x54d…934") is **Yuzu's staking wrapper of yzUSD**; YZUSD is a KYC/institutionally-gated synthetic dollar (mint/redeem 1:1 with **USDT0** for eligible investors only, multi-day settlement, "commercially-reasonable-efforts" targeting $1.00 explicitly **without any guaranteed at-par put right**, junior-tranche shared losses, issuer/admin can freeze holder balances, CeFi-dependent governance; third-party tracking grades YZUSD C− (52/100) and syzUSD D (42/100); yzUSD circulating ≈$42.7 M per DefiLlama). Authorizations are issuer-disclosed under the Kutaisi FEZ framework and **not independently verified**.

### 4.3 Assurance assessment

| Gate | Verdict | Basis |
| --- | --- | --- |
| Mechanics | **PASS (mechanical)** | Same verified composition as Stage 2; inlined-constant diff + on-chain getters + live read agreement |
| Economic denomination | **FAIL** | The published quantity is **YZUSD**-denominated (official mapping), the oracle's quote side is zero (no conversion), and YZUSD↔USDC/USD is a KYC-gated, USDT0-based, no-guaranteed-par, shared-loss regime. The market structurally treats 1 YZUSD = 1 USDC. Depeg/redemption/basis risks are unmeasured; during stress the feed can overstate liquidation-support value exactly like Stage 2's wsrUSD feed. |
| Source/operator provenance | **FAIL** | Economic source lives in the **same Chainlink CRE/Data Streams, same cache, same facade owner** as the Stage 2 feed; same SOURCE_V1/OPERATOR_V1 gaps (no reviewed workflow program, no immutable build/ID binding, no operator identity attestation, signer coverage sampled not complete). Issuer-side facts are public but do not substitute for workflow/operator provenance. |
| Freshness enforcement | **FAIL** | None on-chain (verified Stage 4 semantics of this cache family: perpetual storage, stale-skip only, `validFromTimestamp` ignored, future timestamps accepted); the operator's own documentation instructs consumers to verify staleness manually; published heartbeat 3600 s/deviation 0.5 are unbound common settings. |
| Independent comparator | **UNKNOWN** | DexScreener Pharos pair lookup for syzUSD: **zero pairs** (2-byte `[]`, same SHA). A free comparator for an exact Pharos syzUSD/USDC market price does not exist in free sources; any Data Streams or cross-chain feed alternative is paid and would share operator family. |
| Stage 3A financial-action gates | **FAIL** | Identity mismatch (structural); all assurance gates above. |

**Candidate B verdict: FAIL.** It is the most "active" market (recent borrows, two live debt positions, largest non-anchor TVL) and its pricing is a mitigated version of Stage 2's problem (official mapping read for a distinctly different product), but every decisive assurance deficiency of Stage 4 is reproduced — the same feed architecture, the same no-conversion quote side, the same absence of freshness enforcement, no independent comparator — and the identity pin excludes it structurally.

---

## 5. Anchor market C (Stage 2, wsrUSD) — reconfirmed, not a candidate

The anchor market was enumerated for completeness and read fresh (state totals consistent with Stage 4; single monitored borrower's position still holds the full ≈18.0 M USDC debt against 18.7 M wsrUSD; market `lastUpdate` 1793952693 = 2026-11-06T08:11:33Z from interest accrual). It carries the completed Stage 4 verdict: **FAIL** (Oracle assurance FAIL; denomination rUSD; no freshness enforcement; no comparator; DOCUMENTED). **FAIL — by Stage 4's standing verdict; documented here, not re-litigated.**

---

## 6. Stage 3A financial-action eligibility — every candidate

The strict, all-or-nothing `evaluateRecoveryEligibility()` (unmodified) requires every condition below to hold simultaneously (assurance VERIFIED + ASSURANCE_REQUIREMENTS_MET + freshness VERIFIED + independent VERIFIED & eligible + progression ADVANCING + zero reason codes + fingerprint match). With the existing application identity pin, production runs against candidates A/B cannot even load the position:

| Blocking reason code | Why it applies to A and B today |
| --- | --- |
| `RECOVERY_SNAPSHOT_IDENTITY_MISMATCH` (via `POSITION_UNSUPPORTED`) | Both markets differ from the pinned identity tuple in `src/config/deployment.ts` (marketId, oracle, collateral). Code cannot produce financial options for them without an **authorized reconfiguration** that Stage 5A does not perform. |
| `RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED` / `…GATE_NOT_MET` | Both candidates' oracle assurance is UNVERIFIED (and Stage 4's proven per-gate inadequacies replicate for B; A has no feed at all). |
| `RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED` | No verified, configuration-bound timing exists for either candidate (same cache family semantics; A's pricing has no feed to time). |
| `RECOVERY_INDEPENDENT_VALIDATION_NOT_VERIFIED` | No eligible comparator; DexScreener lookups for APT, syzUSD **and even USDC on Pharos** returned zero pairs — no free market-price comparator exists at all. |
| `RECOVERY_CHAIN_PROGRESSION_UNKNOWN` | No separately authorized observation/progression workflow exists (and Stage 5A explicitly did not start one). |
| `RECOVERY_CONFIGURATION_MISMATCH` | No fingerprint binding would match for a reconfigured identity. |

**No candidate satisfies every existing Stage 3A financial-action eligibility gate. None can safely support quantified repayment or collateral recommendations.**

---

## 7. Could any candidate ever pass? (the honest, unchanged answer)

- **Candidate B** would remain fundamentally blocked even if reconfiguration were authorized later: its collateral's economic quote is YZUSD (a KYC-gated, USDT0-based, shared-loss, no-guaranteed-par instrument), the market's oracle design contains no conversion mechanism, its data feed shares Stage 2's whole architecture and controller family (same owner, same cache), and freshness enforcement is absent by design. Those are the same reasons Stage 4 failed — with issuer-tracked risk marks (D/C−) additionally recorded in public sources.
- **Candidate A** would additionally require establishing the integrity of a curator-run, off-chain NAV with unverified proxy code and ~0.6% on-chain coverage — beyond what any read-only, free-source qualification could establish, and materially worse from a liquidation-realization standpoint.
- **Candidate C** is Stage 4's standing FAIL.
- Under the current code (no reconfiguration), **zero** markets are eligible — this is by construction, gate-fail-closed, and *is the correct behavior*, not a defect.

---

## 8. Verified facts vs assumptions vs unknowns

**Verified facts (each evidence-bound above):**

1. Three distinct market ids with recent activity, parameterized and id-verified by recomputation; single common loan token = Circle-issued native USDC on Pharos (official Circle and Pharos sources, on-chain verified proxy); common IRM across all markets.
2. Candidate A's oracle is the reproduced MorphoChainlinkOracleV2 family with inlined vault-only configuration; exact formula `1e18 × convertToAssets(1e18)` verified live; the pricing vault's `asset()` is that same USDC; vault cash buffer 12,896.61 USDC vs 2.05 M APT collateral nominal; vault bytecode minimal/unverified and owners unreadable.
3. Candidate B's oracle differs from the Stage 2 oracle only in the inlined base-feed address; feed is officially mapped as `SYZUSD/YZUSD`; the feed/cache/owner family and its no-on-chain-freshness semantics match Stage 4's verified analysis; live answer/timestamp read twice.
4. Morpho liquidation constants and per-LLTV incentive factors (`≈1.04384` @ 0.86; `≈1.02617` @ 0.915) from reproduced sources.
5. Identity pin and unsolvable-by-design financial gates for non-anchor markets (code-cited above).
6. Anchor market's standing and Stage 4 verdict unchanged; loan-asset provenance upgrade shared for all markets using this USDC.
7. Repository/state hygiene: monitor never started; only this document written; no index/staging/HEAD changes; no test/runtime/process side effects.

**Assumptions (explicit):**

- Identical-hex cross-chain presence (syzUSD per CCIP directory; Reservoir family per Stage 4) implies asset-semantic equivalence per chain (plausible; per-chain bytecode comparison not performed).
- That public issuer material for APT/Yuzu faithfully describes the on-chain instruments. Third-party risk "grades" are opinions of tracking sites, not qualified ratings; they are recorded as context, never as gate evidence.
- That "recent activity" (36 h) reasonably identifies "active" markets; older markets may exist (the ≈281,324 USDC idle-ledger gap is noted but unexplained).

**Unknowns (would be required for any future promotion):**

1. Market creation blocks/dates and creators for A and B (enumeration budget-bounded; not established).
2. The `VaultLib.getAssets` implementation source (not in the retained corpus); for A the exact on-chain semantic was verified computationally instead, but vault administration, upgrade path and NAV integrity remain unestablished.
3. CRE workflow programs, build artifacts, Datas Streams product/report schemas, operator identities, and complete signer/route coverage for B's feed (same gaps as Stage 4, per architecture).
4. Whether additional idle-USDC-holding markets exist (the discrepancies in § 1).
5. Verified denominated prices and any eligible, genuinely independent comparator for APT/syzUSD/wsrUSD on Pharos from free sources (none found; 0 DEX pairs).
6. A separately authorized reconfiguration + fresh Stage 2→3A requalification cycle if a future sweep is intended; that is out of Stage 5A scope and unperformed.

---

## 9. Result, evidence table, and recommended next step

**Result: NO QUALIFIED MARKET. Stage 5A explicitly reports that no candidate passes; no PASS was manufactured. Financial-action blocking remains intact and correct. The monitor remains STOPPED.**

### Evidence table

| Evidence | Subject / source | Reference / observation | Immutability |
| --- | --- | --- | --- |
| Event signatures + topic0 hashes | retained compiler-output ABI (incl. `CreateMarket`, `Borrow`, `SupplyCollateral`) | `temp/stage5a-discovery/event-signatures.json` | SHA-256 recorded on write |
| Full activity ledger, params, states, positions (run 3) | runs at head 22287883, window ≥22137883 | `temp/stage5a-discovery/summary3.json`, `trace3.json` (310 requests, 0 nulls/caps) | preserved |
| Market states at head 22288365 + token metadata + price reads (run 4) | `summary4.json`, `trace4.json` | 6 requests; problem log with per-getter nulls retained | preserved |
| Oracle compositions + feed dynamic reads (run 5) | `summary5.json`, `trace5.json` | includes Stage 2 oracle re-read for byte-diff comparison | preserved |
| Vault reads (run 6) | `summary6.json`, `trace6.json` | `convertToAssets` exactness | preserved |
| Oracle runtime code A/B | `temp/stage5a-discovery/oracle-code.json` | SHA-256 `69aac7df…641` (A), `a3476073…811` (B); identical-length diff to Stage 2 oracle (`178a1012…794`) | preserved |
| Official feed mapping (re-fetched, byte-identical) | docs.pharos.xyz chainlink-pe.md | 8,722 bytes, SHA-256 `5d2c0bab…e110b42`; `SYZUSD/YZUSD` row read at L49 | preserved (`pharos-chainlink-push-engine.body.txt`) |
| DexScreener lookups (APT, syzUSD, USDC) | api.dexscreener.com token-pairs/v1/pharos/… | all 2-byte `[]`, SHA-256 `4f53cda1…02b945` | preserved |
| Circle/Pharos USDC provenance | circle.com blog + multi-chain page; docs.pharos.xyz token-registry & CCTP; explorer proxy | addresses match exactly | URL-cited (public) |
| syzUSD/YZUSD issuer facts | Yuzu documentation rows captured via search; CCIP directory; Dallas/bluprynt/DefiLlama/level summaries | captured in conversation record; addresses cross-checked on-chain | URL-cited (public) |
| Identity pin & eligibility codes (unmodified code) | `src/positions/model.ts:56-60`, `src/risk/eligibility.ts:14,72`, `src/config/deployment.ts` | quoted in § 1 | unchanged |

### Recommended next step

1. Do **not** attach recovery quantification to any of these markets. The binding causes are structural and evidence-structural, not "yet another read away": oracle-denomination and provenance/freshness/comparator inadequacies exist for every enumerable market on this chain in this stage's research, and the code itself correctly refuses non-anchor identities.
2. If a demonstration market is a business requirement, the prerequisite is an explicitly authorized engineering + evidence program (position-identity reconfiguration, denomination-capable schema, verified-timing ingestion, selected upstream identity, comparator establishment) followed by fresh Stage 2→3A requalification on a **specific** market whose oracle has an officially-Circle/officially-documented, correctly-denominated instrument (e.g., a market designed to value collateral directly against the official `USDC/USD` feed `0x00038f83323b6b08116d1614cf33a9bd71ab5e0abf0c9f1b783a74a43e7bd992`/`0x3f882C4F2836b1e5C5278ff2B9FccE2502A35C5d` listed on the same page — no such market was observed).
3. Meanwhile, legitimate work continues to be: keep the monitor stopped; preserve evidence; treat match-else alerting as non-financial, independent-verification instructions exactly as today.

---

## 10. Operating-boundary confirmation

- Read-only throughout; **only this document created** in the repository (post-write read-only re-verification of index bytes, staged diff, status, HEAD state and relevant Node processes accompanies delivery).
- No transactions, signing, broadcasting, notifications, database writes/migrations, Neon or production access, paid services, or monitor start; MCP was not used for market data; no result is based on RPC/MCP agreement as economic validation.
- All previous evidence (Stage 4 document and artifacts, retained qualification/audit/research archives, original Stage 2 evidence, unrelated user work) untouched.

---

*Prepared read-only for Stage 5A. The FAIL series above preserves the existing financial-action block; this document authorizes no monitoring, deployment, reconfiguration or financial operation, and, explicitly per the tasking, reports honestly that **it found no qualified market**.'
