# Submission Package — Liquidation Watchdog

**Prepared:** 2026-11-06
**Purpose:** reviewer-ready summary of what has been demonstrated, what is verified, and what is explicitly not qualified.
**Scope of this document:** documentation only. No source, test, or configuration file was changed; nothing was staged, committed, or pushed; no monitoring cycle, transaction, external notification, database write, or external service access was performed while preparing it. The monitor is **STOPPED**.

This document uses only repository contents and preserved evidence artifacts. Anything not reproducible from the available evidence is marked **NOT VERIFIED** rather than asserted.

---

## A. Project overview

Liquidation Watchdog is a read-only TypeScript CLI and opt-in monitor for one real Morpho Blue borrow position on **Pharos Pacific Mainnet (chainId 1672)**. The liquidation-risk problem it addresses: for a Morpho Blue borrow position, collateral can become liquidatable when the position's safety ratio (a health-factor equivalent derived from collateral, accrued debt, and the market LLTV) falls toward 1.00. Debt accrues continuously; borrowers and operators need an early, precisely measured warning before the liquidation boundary, together with safe, concrete next steps — without the monitoring tool itself becoming a source of unverified financial advice.

The tool combines:

- pinned chain reads of collateral/borrow shares and market inputs from Morpho Blue, with accrued-debt derivation including Morpho's virtual assets/shares rounding;
- exact integer (BigInt/WAD) risk mathematics with configurable warning/critical thresholds and the fixed liquidation boundary 1.00;
- durable SQLite persistence of observations, alerts, and notification deliveries, with an outbox that preserves known-delivered state and does not automatically resend terminal unknown outcomes;
- evidence-based oracle assurance that deliberately fails closed: until the oracle's economic valuation, provenance, freshness, and independent validation are qualified, every alert's suggested action is a typed **non-financial** instruction. `actionable:false` remains structural even if a strict-gate financial option can be derived.

The monitored position during the live demonstration was a **public third-party borrower account, not the user's wallet**. The tool performs no signing, no transaction construction, no broadcasting, and no position modification.

---

## B. Requirements acceptance matrix

The four requirements are those of `docs/PHASE-11-PRODUCT-ACCEPTANCE-AUDIT.md` (audit of 2026-11-04, verdict then **NOT ACCEPTED** with all four PARTIAL/FAIL). The results of the finite live Stage 2 run of 2026-11-05, documented in the preserved `LIVE-STAGE-2-MONITORING-REPORT.md` (SHA-256 recorded on its evidence capsule; see § H for locations), supersede the audit's pre-stage-3 assessment. Verdicts below are scoped to that finite demonstration, not to production.

| # | Requirement | Verdict | Evidence scope |
| --- | --- | --- | --- |
| 1 | Read collateral, debt, and health factor (or equivalent) from chain | **PASS** | Fresh pinned Stage 2 live run (finite, one cycle) |
| 2 | Configurable warning and critical thresholds (defaults 1.3 / 1.1) | **PASS** | warning 1.30, critical 1.10 loaded and enforced exactly |
| 3 | Send timestamped alerts through at least one supported channel | **PASS** | Three console alerts, UTC-timestamped, persisted DELIVERED |
| 4 | Include a suggested action in each alert | **PASS (non-financial only)** | Exactly one typed `NON_FINANCIAL` action per alert; quantified repayment/collateral recommendations **NOT QUALIFIED** |

### B.1 Requirement 1 — on-chain reading (PASS)

From the live run at block `22225454` (block hash `0x9515451fc030160d2c4014b4b663f0d024b50b5774bbb1bf3829bbe5cd4e883d`, block time 2026-11-05T23:46:48.000Z):

| Quantity | Value |
| --- | --- |
| Collateral | **18,706,585.513096 wsrUSD** (`18706585513096000000000000`, 18 decimals) |
| Accrued borrower debt | **18,001,980.562580 USDC** (`18001980562580`, 6 decimals) |
| Health-factor equivalent | **1.052543254080507595** |
| Mathematical classification | `CRITICAL` (at/below critical 1.10, above the mathematical boundary 1.00) |
| Effective state | `DATA_UNVERIFIED` (oracle economics unverified); actionability `INDICATIVE_ONLY`, `actionable:false` |

Cross-checks in the same cycle: **58/58** production RPC/MCP comparisons matched; **10/10** separately issued pinned direct-getter comparisons matched; **17/17** independently written BigInt accounting/valuation fields matched the production snapshot with no production math helper. The health-factor equivalent is floor(capacity × 10^18 / debt) — a Morpho safety-ratio equivalent, not a direct on-chain health-factor getter.

### B.2 Requirement 2 — configurable thresholds (PASS)

Warning **1.30**, critical **1.10**, target **1.25**, immutable boundary **1.00** were loaded from the reviewed position configuration into the real reader/risk/transition scope. Threshold decisions used exact integer cross-products (debt × threshold WAD); no displayed-ratio rounding. No global defaults were changed and no long-running runtime was activated.

### B.3 Requirement 3 — timestamped alerts on a supported channel (PASS)

All three alerts generated by the cycle were delivered by the local console adapter:

| Alert code | Severity | Created (UTC) | Delivered (UTC) | Status |
| --- | --- | --- | --- | --- |
| `INITIAL_RISK` | `CRITICAL` | 2026-11-05T23:48:19.444Z | 2026-11-05T23:48:20.483Z | DELIVERED / 1 attempt / 0 ambiguous |
| `DATA_QUALITY_CHANGED` | `WARNING` | 2026-11-05T23:48:19.444Z | 2026-11-05T23:48:20.516Z | DELIVERED / 1 attempt / 0 ambiguous |
| `ORACLE_QUALITY_CHANGED` | `WARNING` | 2026-11-05T23:48:19.444Z | 2026-11-05T23:48:20.538Z | DELIVERED / 1 attempt / 0 ambiguous |

Each message carries the UTC alert timestamp, alert ID, position/market identity, state transition, safety ratio, data/oracle quality, snapshot block/hash, reason, the typed action, action evidence status, and an explicit `actionable:false`. The full console transcript (3,664 bytes, SHA-256 `1fa8721cd6de619e98f3ac46837627e02eb7f39bff042d6df0bd7168a938aaa8`) is preserved in the Stage 2 evidence capsule. Console is the proven channel; **Telegram/Discord delivery is NOT VERIFIED** (§ G).

### B.4 Requirement 4 — suggested action per alert (PASS with explicit qualification boundary)

Each alert contained exactly **one** typed, versioned `suggestedAction` object (schemaVersion 1, origin `GENERATED`):

| Alert | Type | Rationale code | Concrete instruction |
| --- | --- | --- | --- |
| `INITIAL_RISK` | `NON_FINANCIAL` | `POSITION_REQUIRES_REVIEW` | Review this position and independently refresh the current chain and oracle state before making any financial decision. |
| `DATA_QUALITY_CHANGED` | `NON_FINANCIAL` | `DATA_REQUIRES_REFRESH` | Do not transact from this alert; refresh the position and restore complete valid data before making a decision. |
| `ORACLE_QUALITY_CHANGED` | `NON_FINANCIAL` | `ORACLE_REQUIRES_VERIFICATION` | Do not rely on financial estimates; independently verify the oracle source, freshness and configuration. |

Every action has `evidence.status=NOT_QUALIFIED`, `actionable:false`, and `financialOptions: []`, with evidence bound to cycle ID, chain/account/market, block/hash/time, and the snapshot identifier `sha256:b00e8d0859e45aec43a33d1431665d8ce6ec8df0efc41874f3c89d8322671c95`.

**Explicit disclosure:** quantified repayment and collateral-addition recommendations were **not qualified** in the live demonstration. A `FINANCIAL_OPTION` action (typed amounts produced by the existing recovery pipeline) requires the strict, all-or-nothing eligibility gate in `src/risk/eligibility.ts` — oracle assurance `VERIFIED`, freshness `VERIFIED`, independent validation `VERIFIED` and eligible, `ADVANCING` progression, zero reason codes, and fingerprint binding — which are not jointly satisfied by the live evidence (§ F). Even an eligible option remains structurally `actionable:false`. The separate fixture demo exercises the qualified code path using synthetic evidence only; it does not qualify live financial recommendations.

---

## C. Architecture

Only components present in the repository and exercised by tests/evidence are described.

**Module layout (`src/`):** `actions`, `chain`, `cli`, `config`, `domain`, `mcp`, `monitoring`, `morpho`, `notifications`, `operations`, `oracle`, `oracle-assurance`, `positions`, `risk`, `runtime`, `storage` (+ `storage/postgres`), `validation`.

### C.1 Chain and lending-position reader

- Morpho Blue market reads on Pharos chainId 1672 against the reviewed deployment (`0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb`), market `0xbea21c37…49e73`, oracle `0x9416F861970C2a39c02ab7696Ef0496383d4E81b`, LLTV 0.915, loan USDC (6 dec), collateral wsrUSD (18 dec).
- Pinned snapshot queries (`src/chain/snapshot.ts`), request pacing and bounded retries/timeouts in the transport layer (`src/chain/transport.ts` — serialized requests, minimum interval, at most **3 total attempts** including the initial attempt, hence at most 2 retries, and a 15 s transport timeout).
- Accrued-debt derivation converting borrow shares at the pinned block, including Morpho virtual assets/shares.

### C.2 Risk and health-factor evaluation

- Exact decimal/WAD arithmetic — no floating-point (`src/risk/*`): capacity × 10^18 vs debt cross-products, `CRITICAL`/`WARNING`/`ABOVE_WARNING` classification against thresholds (plus `LIQUIDATION_BOUNDARY` and `NO_DEBT`), and snapshot identity validation before use.
- Assured risk (`src/risk/assured.ts`) combines the mathematical result with oracle-assurance freshness/progression gating. Recovery estimates are suppressed when the strict eligibility gate fails. When eligible, estimates remain snapshot-bound, indicative, and structurally `actionable:false`; passing eligibility never authorizes a transaction.

### C.3 Configurable thresholds and position identity

- Threshold model: exact decimal strings, order validation (warning > critical > 1.00, target > critical), fixed liquidation boundary 1.00; CLI flags, risk-config JSON (`--risk-config`, `WATCHDOG_RISK_CONFIG_PATH`), or position-file ownership.
- Stage 3C position identity (`src/positions/model.ts`, `src/config/position.ts`): a canonical `PositionIdentity` (positionId SHA-256 fingerprint, chainId, protocol, protocolAddress, marketId, account, oracle, IRM, both tokens) pinned to the reviewed deployment; the account is the only freely selectable field. Non-account fields outside the reviewed tuple are rejected (`POSITION_UNSUPPORTED`). Demo (`DEMO`) and configured (`CONFIGURED`) account roles are explicit and never claim custody.
- Monitoring scope isolation: demo streams use `hash("monitor-v1", …)`, configured positions use `hash("monitor-v2", positionId, authoredThresholds, context)`, so accounts and threshold sets never share state.

### C.4 Typed suggested-action model (Stage 3A)

- `src/actions/model.ts` + `src/actions/derive.ts`: every newly generated alert carries exactly one strict, versioned `suggestedAction` — either `FINANCIAL_OPTION` (only via the strict qualified recovery pipeline) or `NON_FINANCIAL` (a concrete safe human instruction with no financial amounts). All actions are structurally `actionable:false`.

### C.5 Notification adapters and delivery/outbox behavior (Stage 3B)

- Adapters: console (always present, no secret), Telegram (opt-in with named secrets, shape-validated, no startup network call), Discord (opt-in, HTTPS/host/path-allowlisted webhook, no caller-supplied query/port). The adapter factory accesses notification values only for enabled channels; the PostgreSQL executable still captures its named notification environment inputs at invocation.
- Strict shared `renderAlert()` output; bounded payload lengths; no credential, destination, or provider body is logged or persisted.
- Outbox: observation persistence creates alerts and delivery rows atomically; delivery identity `delivery_<sha256(alertId, channel)>`; `(alert_id, channel)` uniqueness prevents duplicate outbox rows; alert fingerprints prevent regeneration of the same episode/code; delivered rows are terminal.
- Lifecycle statuses `PENDING → IN_FLIGHT → (FAILED/RETRY_SCHEDULED) → DELIVERED | PERMANENTLY_FAILED`; retryable known failures use bounded exponential backoff with jitter, attempt caps, provider Retry-After/cooldown; **ambiguous outcomes (timeout, interrupted process, failed acknowledgment persistence) are terminal `UNKNOWN`** — retained with `ambiguous=1`, excluded from `due()`, never automatically replayed after restart.
- PostgreSQL delivery claims are lease/fence-bound (owner, fence, database incarnation, deadline); stale claims terminalize as unknown rather than requeue. SQLite follows the same conservative ambiguity policy.

### C.6 Persistence and monitoring lifecycle

- SQLite store (schema 5) persisting streams, cycles, observations, alerts/fingerprints, deliveries/attempts/events, provider limits, worker runtime; default database `data/watchdog.sqlite`.
- PostgreSQL support (`storage/postgres`, `runtime/postgres-runtime.ts`, scheduler lease/execute model with `scheduled_executions`, singleton worker lease and monotonic fence, fenced writes before and after every writer transaction).
- Monitoring lifecycle: `MonitoringService` one-cycle/continuous modes, `Ctrl+C`/SIGTERM shutdown that stops new work, permits bounded active settlement (~30 s default), cancels overdue work, and closes the store; whole-cycle limit defaults 240 s. `alerts`/`status` read persisted history without new chain reads.
- Oracle assurance integration (`src/oracle-assurance/*`): seven-dimension evaluation bound to configuration fingerprints; configuration changes and observability gaps invalidate and invalidate-stickily; verified freshness requires configuration-bound hashed timing evidence which `evaluateAssurance()` intentionally does not supply today (fail-closed by construction).

### C.7 Multi-position (Stage 3D) — architecture review only

`docs/STAGE-3D-MULTI-POSITION-ARCHITECTURE.md` is an architecture and readiness review (**CONDITIONAL GO** for future phases); **it is not implemented**. The runtime remains structurally single-position: one configured position per runtime, identity allowlist of one reviewed market, no multi-position coordinator, no persisted multi-position runtime.

---

## D. Live demonstration (finite Stage 2 run)

**Class: one authorized finite live cycle on real chain data; monitor STOPPED afterwards and currently stopped.**

- **Chain / market:** Pharos Pacific Mainnet (1672); Morpho Blue market `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73` (USDC / wsrUSD, LLTV 0.915).
- **Monitored account:** `0x086eb9C2B14dD657ae77D07dF9115A2F946CE327` — a public third-party borrower, role `EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET`, not the user's wallet.
- **Block evidence:** block `22225454`, hash `0x9515451fc030160d2c4014b4b663f0d024b50b5774bbb1bf3829bbe5cd4e883d`, block time `2026-11-05T23:46:48.000Z`; observed heads 22225459/22225460, selection min(heads) − 5.
- **Position snapshot:** collateral 18,706,585.513096 wsrUSD; borrow shares `17768613114986061183` → accrued debt 18,001,980.562580 USDC; health-factor equivalent 1.052543254080507595 → `CRITICAL`, effective `DATA_UNVERIFIED`, `actionable:false`.
- **Thresholds:** warning 1.30 / critical 1.10 / target 1.25 / boundary 1.00 (exact integer cross-products; § B.2).
- **Alerts:** three timestamped console alerts with exactly one typed `NON_FINANCIAL` action each (§ B.3/B.4), all persisted DELIVERED with one attempt and zero ambiguous outcomes.
- **Restart / duplicate-delivery verification:** a separate process reopened the same disposable SQLite store (schema 5, SQLite 3.51.2, Node v24.14.1), acquired the monitor lock, ran the existing delivery recovery/drain code, and confirmed **0 in-flight deliveries recovered, 0 drain attempts, 0 console resends, 0 pending deliveries**, 3 DELIVERED rows, 3 alerts / 3 permanent fingerprints, and unchanged logical hashes. No new live cycles, observations, or fetch attempts occurred during the restart. This proves a clean restart after completed delivery; it does **not** prove sustained progression, crash-in-flight external delivery, or provider exactly-once semantics.
- **Boundary and hygiene:** the cycle was executed exactly once via `MonitoringService.runOnce()` with a refusals-on-repeat marker; 118 requests, only to the reviewed RPC/MCP endpoints and allowlisted read methods, zero rejected live requests; no fixtures, no safety-gate weakening; cross-checks per § B.1.
- **Current monitor state: STOPPED.** Persisted runtime status is `STOPPED`; zero pending deliveries remain; no live reader or monitoring loop is running. It has not been restarted since.

The finite live run operated on an isolated temporary store and evidence capsule (`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\live-stage2-SGNCxp\`). No production database, no PostgreSQL/Neon schema or migration, no credential, and no external delivery was involved. The snapshot is historical evidence as of that block; it is not a claim about the position at reading time. No secrets or private credentials are contained in this document; the report transcript shown above contains only public account/market identifiers.

---

## E. Test and build evidence

Final verified results from the qualification batch of 2026-11-06 (`…\qualification-repair-20261106-QrN8p4\qualification-batch\summary.json`, status **PASS**, run 2026-11-06T00:48:48Z → 00:53:10Z, sequential with no concurrent test/compiler workloads, `realMonitor: "STOPPED"`):

| Check | Result |
| --- | --- |
| Full default (non-integration) suite | **1007 / 1007 passed across 49 test files**, exit code 0 |
| Focused runtime-process suite (isolated, after the repair) | 4 / 4 passed, exit code 0 |
| Focused qualification suites | 31 / 31 passed, exit code 0 |
| Independent re-run selection | **1 selected test passed; 3 intentionally unselected/pending**, 0 failed, exit code 0 |
| TypeScript (`tsc --noEmit`) | exit code 0 |
| ESLint (full) | exit code 0 |
| Production build (`tsc -p tsconfig.build.json`, external output directory) | exit code 0 |

These are preserved historical results, not new validation of this documentation edit. Focused runtime-process/qualification selections overlap the full suite and are not additive coverage counts. The independent selection's three pending tests were intentionally not selected; it is not a four-pass result. Integration suites have separate prerequisites and evidence, described in [testing](testing.md).

Honest history: the original live Stage 2 run reported the then-current full suite as **1006/1007** (one process-fixture timeout/cleanup failure); the failure was subsequently repaired and the final batch above re-verified the suite at **1007/1007** with the same correction preserved as an uncommitted change (`test/runtime-process.test.ts`). Both facts are reported as-recorded; the final qualification result is the operative one.

Older saved evidence bundles under `evidence/phase5/` (verification runs, release manifest, phase 1–4 preservation) reflect earlier Phase 5 states and are preserved as history; the figures in this section come only from the final qualification report.

---

## F. Oracle assurance and financial-action limitations

**Stage 4 (`docs/STAGE-4-ORACLE-ASSURANCE-INVESTIGATION.md`) — executive verdict: FAIL.** The market's collateral valuation is mechanically reproducible (gate A: PASS, mechanics — composition `BASE_FEED_1 × SCALE_FACTOR`, no conversion layer) but is **not established as an economically trustworthy USDC-denominated value**:

- **Economic denomination (gate B: FAIL).** The official Pharos feed mapping is **WSRUSD/RUSD**; the oracle's quote side is inactive (both quote feeds zero address), so the market design silently treats 1 rUSD = 1 USDC with **no rUSD→USDC conversion mechanism anywhere in the path**. Redemption/liquidity/depeg/basis risks are structurally unmeasured; the observed feed answer ≈ 1.107 is consistent with a yield-bearing share valuation, not a USDC price.
- **Provenance (gate C: FAIL).** SOURCE_V1 and OPERATOR_V1 requirements are entirely unmet: no reviewed workflow program/binary bound to the allowed workflow ID, no operator identity attestation, signer coverage sampled not complete. On-chain permissions are code-proven, but code-provable permissions are not operator identities.
- **Freshness (gate D: FAIL).** No on-chain staleness enforcement exists anywhere in the oracle path (perpetual cache storage, `validFromTimestamp` ignored, consumer library checks negativity only); the published heartbeat is unbound documentation; a VERIFIED freshness state is unreachable in production by construction until configuration-bound verified timing ingestion exists.
- **Independent comparator (gate E: UNKNOWN).** No eligible comparator established; DexScreener Pharos lookups returned zero pairs; Data Streams access is paid and out of bounds.
- **Financial gates (gate F: PASS — integrity only).** The Stage 3A gates are strict, fail-closed, and unmodified; every production input today yields `NON_FINANCIAL` with `financialOptions: []`.

**Stage 5A (`docs/STAGE-5A-QUALIFIED-MARKET-DISCOVERY.md`) — verdict: NO QUALIFIED MARKET FOUND.** A bounded read-only enumeration of Pharos Morpho Blue activity identified three distinct market identities; **all three fail qualification**:

1. **Anchor market (C, wsrUSD)** — carries Stage 4's standing FAIL verdict.
2. **Candidate A, USDC/APT "Axil Pot"** — pricing is the curator's own off-chain NAV accounting of an unverified proxy vault with an on-chain cash buffer covering ≈ 0.62% of the collateral nominal; no feed, no comparator at all; FAIL.
3. **Candidate B, USDC/syzUSD "Staked Yuzu USD"** — the most active market, but the feed publishes **SYZUSD/YZUSD** (a KYC-gated, shared-loss, no-guaranteed-par instrument), the quote side is unconverted, and it shares the same feed architecture/cache/facade owner family and the same provenance/freshness/comparator failures as Stage 2; FAIL.

Because the position identity is hard-pinned to the reviewed deployment, non-anchor markets additionally fail with `RECOVERY_SNAPSHOT_IDENTITY_MISMATCH` (via `POSITION_UNSUPPORTED`) — a structural, correct, fail-closed behavior. **Financially quantified repayment/collateral recommendations remain NOT QUALIFIED** for every market investigated.

One positive follow-up from Stage 5A: the loan token `0xC879C018…1815` is established from official Circle/Pharos sources as **Circle-issued native USDC on Pharos**, which resolves Stage 4's debt-side issuer unknown (this concerns the debt asset only; it does not qualify any collateral valuation).

---

## G. Production readiness

**Production readiness is NOT accepted.** A finite one-cycle live demonstration is not continuous production monitoring:

- The live evidence covers one cycle at one block; no production-duration soak, no cadence under load, no multi-day restart behavior in production has been exercised.
- Oracle assurance (family Stage 4/5A) is unresolved: valuation denomination, provenance, configuration-bound freshness, and independent validation are all inadequately established for the demonstrable market, and no other qualified market exists on this chain per Stage 5A.
- Qualified financial recovery calculations are missing by design until the Stage 3A eligibility gates can be met; the correct current behavior is fail-closed non-financial actions.
- **Real external notification delivery has NOT been proven.** Only console delivery is demonstrated. Telegram/Discord wiring is covered by mocks and inert fixtures; real Stage 3B provider qualification requires separate operator authorization. No real Telegram or Discord delivery is evidenced here. The provider interfaces supply no portable exactly-once key and no exactly-once delivery guarantee is claimed; ambiguous outcomes are conservatively terminal (`UNKNOWN`), with no operator resend workflow implemented.
- Deployment/runtime qualification: host/supervisor acceptance, off-host recovery, Neon/PostgreSQL production operation, reader/writer grant setup, and secret management remain separate gates (see `docs/release-readiness.md`, `docs/production-readiness-gaps.md`).
- Multi-position monitoring remains a reviewed architecture (Stage 3D) that is **not implemented**.

---

## H. Reproduction guide

All commands use real package scripts from `package.json`. Windows is the verified host (Node.js 24.14.1 / SQLite 3.51.2); the package declares Node `>=22.18.0`.

### H.1 Safe local demonstration (no keys, no live chain, no financial operations)

Prerequisites: the verified Node/SQLite runtime, installed development dependencies (`tsx`), and an **absent** `data/submission-demo/` output directory in the chosen workspace. The currently retained output is preserved evidence. The script refuses to overwrite it and exposes no command-line output-directory flag; use the [preservation-aware rerun guidance](SUBMISSION-SINGLE-POSITION-DEMO.md#re-running-and-cleanup). Run the following command sequence from the chosen fresh workspace's root, not by clearing existing output. A build is not required by the `tsx` demo itself.

```powershell
npm ci
npm run demo:submission
```

`npm run demo:submission` (`scripts/submission-demo.ts`) runs one configured position through the real monitoring pipeline with deterministic local fixtures — warning then critical threshold states, non-financial actions while evidence is unverified, one separately labeled synthetic strict-gate scenario (the only place a financial option can appear), SQLite alert/outbox persistence, console delivery, a restart without resending known deliveries, and read-model output. Artifacts are written to `data/submission-demo/`. Full details: `docs/SUBMISSION-SINGLE-POSITION-DEMO.md`. No live chain, live provider, Neon, or deployment access is used; readiness endpoints return `503` by design; all evidence remains `actionable:false`.

### H.2 Local read-only inspection and risk (live chain, read-only)

```powershell
npm ci
npm run watchdog -- inspect
npm run watchdog -- risk
```

Optional evidence capture: append `--save-evidence` (writes to `evidence/phase5/{inspect|risk}/{live|historical-<block>}/`; preserve existing captures first). Explicitly historical blocks use `--block <n>`. Threshold overrides: `npm run watchdog -- risk --warning 1.30 --critical 1.10 --target 1.25`, or a threshold file via `--config`. `inspect` returns 0 for an accepted snapshot and 2 otherwise. `risk` returns 0 when overall data quality is calculable and `mathematicalRiskState` is non-null, including indicative `UNVERIFIED` output; it does **not** require both recovery estimates to succeed. It returns 2 when those conditions fail. CLI/configuration/execution errors return 1. No exit code establishes actionability.

### H.3 Re-running the test suite

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

`npm run test` selects the default non-integration suite; § E records its final historical qualification counts. Tests create temporary files/databases and child processes; package test reporters, builds and verification workflows can also write repository output. See [testing and side effects](testing.md) before a separately authorized rerun. A fresh rerun is **NOT VERIFIED** here: this documentation preparation/update executed none of these commands, and the cited results come from the preserved final qualification report.

### H.4 The live one-cycle demonstration

The finite live Stage 2 run used a purpose-built one-cycle driver with an exclusive one-cycle authorization marker, diagnostic capture hooks, and write-out to an isolated disposable store — it is evidence tooling, not a shipped product command, and is not re-runnable from the repository alone (its store, configs, and guard are in the preserved evidence capsule `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\live-stage2-SGNCxp\`). Re-execution would require new authorization and tooling; the persisted report and hashes are the audit trail. Marked **NOT VERIFIED for repetition without new tooling**.

The supported shipped monitoring entrypoint is `npm run watchdog -- monitor --once` (one bounded cycle; continuous scheduling requires explicit enablement and is gated by production gates above). Configuration examples: `config/monitoring.example.json`, `config/production.example.json` (continuous monitoring and external channels disabled), `.env.example` (placeholders only, not auto-loaded).

---

## I. Final verdict

1. **Core monitoring features demonstrated.** In one authorized finite live run, the watchdog read a real Morpho Blue position from Pharos (collateral 18,706,585.513096 wsrUSD; accrued debt 18,001,980.562580 USDC; health-factor-equivalent 1.052543254080507595 → CRITICAL), enforced configurable thresholds (1.30/1.10 with target 1.25 and boundary 1.00), delivered three timestamped, persisted console alerts, attached exactly one typed concrete non-financial action to each, and proved a clean outbox restart with zero duplicate sends. The monitor is STOPPED.
2. **Requirement 4 is satisfied with non-financial actions only.** Quantified repayment/collateral recommendations remain incomplete and unqualified — deliberately. Stage 4's FAIL verdict and Stage 5A's NO QUALIFIED MARKET FOUND verdict document that no investigated Pharos Morpho market (anchor wsrUSD, APT, syzUSD) has an economically trustworthy, well-provenanced, fresh, independently validated collateral valuation that could safely support quantified advice. This is fail-closed by construction, not a defect of the alerting.
3. **The final historical qualification passed:** 1007/1007 across 49 default test files, plus typecheck, ESLint, and an external-output build at exit code 0. These are the preserved final qualification results, not a fresh rerun during documentation cleanup.
4. **Production readiness is not accepted.** Console delivery is proven; real Telegram/Discord delivery is not; oracle economics are not qualified for any available market; deployment, Neon/PostgreSQL production operation, multi-position support, and production-duration monitoring remain open gates.

The honest summary: **the monitoring engine is implemented and demonstrated within the finite-run scope above; its demonstrated actions are non-financial, and financial qualification and production readiness remain unaccepted.**

---

## J. Applied README documentation corrections

The approved documentation cleanup of **2026-11-06** updated [README.md](../README.md) after preserving and SHA-256-verifying its original outside the repository. This supersedes this section's earlier unapplied proposal. The audit identified incorrect as well as outdated statements, particularly the risk exit-code rule and the presentation of Phase 5 captures as current qualification.

The README now:

1. presents the implemented single-position monitor, typed actions, configured identity, SQLite HTTP runtime and PostgreSQL scheduler entrypoint;
2. leads reviewers to the finite live demonstration, this package, Stage 4 **FAIL**, Stage 5A **NO QUALIFIED MARKET FOUND**, and [final qualification provenance](#e-test-and-build-evidence);
3. corrects the risk exit-code rule without suggesting that any exit code or eligible estimate makes an action actionable;
4. states the demo's existing-output refusal and preservation-aware prerequisites;
5. labels Phase 5 captures/manifests as historical and explains verification, database/live-read and evidence-writing side effects; and
6. retains the unqualified financial, real-provider and production-readiness boundaries.

These are documentation corrections. Original evidence, failures, manifests and seals retain their historical meaning; this update supplies no new runtime or release certification.

---

## K. Evidence index

Primary sources cited by this document:

- `docs/PHASE-11-PRODUCT-ACCEPTANCE-AUDIT.md` — original four-requirement audit (NOT ACCEPTED, 2026-11-04).
- `docs/SUBMISSION-SINGLE-POSITION-DEMO.md` — synthetic-fixture demo guide (`npm run demo:submission`).
- `docs/STAGE-3A-TYPED-SUGGESTED-ACTIONS.md` — typed action schema and non-financial behavior.
- `docs/STAGE-3B-RUNTIME-NOTIFICATIONS.md` — runtime wiring, outbox/ambiguity semantics; real provider delivery requires separate authorization.
- `docs/STAGE-3C-POSITION-CONFIGURATION.md` — position identity, thresholds ownership, scopes.
- `docs/STAGE-3D-MULTI-POSITION-ARCHITECTURE.md` — architecture review only; not implemented.
- `docs/STAGE-4-ORACLE-ASSURANCE-INVESTIGATION.md` — FAIL verdict and gate-by-gate evidence.
- `docs/STAGE-5A-QUALIFIED-MARKET-DISCOVERY.md` — NO QUALIFIED MARKET FOUND; three markets, all FAIL.
- Preserved Stage 2 live evidence capsule: `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\live-stage2-SGNCxp\LIVE-STAGE-2-MONITORING-REPORT.md` (finite live run, alerts, restart, monitor stopped).
- Preserved final qualification report: `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\qualification-repair-20261106-QrN8p4\qualification-batch\summary.json` (1007/1007 across 49 files; typecheck/lint/build exit 0; realMonitor STOPPED).
- Repository evidence history: `evidence/phase5/**` (Phase 5 verification runs, release manifest, prior-phase preservation), unchanged.

*This package is documentation. It authorizes no monitoring, deployment, transaction, delivery, or database operation, and stages or commits nothing.*
