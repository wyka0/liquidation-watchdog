# Phase 11 — Liquidation Watchdog Product Acceptance Audit

Audit date: **2026-11-04**

Repository: `C:\liquidation-watchdog`

Decision: **NOT ACCEPTED as an end-to-end product**

This was a read-only implementation and evidence audit. The only intentional repository change is this report. No application or test file was changed; no live provider, Neon, SQL, migration, deployment, external scheduler, signing, broadcast, Git staging, commit, or push operation was performed.

## 1. Executive verdict

| Acceptance requirement | Verdict | Product-level conclusion |
| --- | --- | --- |
| Read collateral, debt and health factor (or equivalent) from chain | **PARTIAL** | The reader obtains a pinned position and market inputs from Pharos and derives exact accrued debt and a Morpho safety-ratio equivalent. It supports only one compiled-in public demonstration account/market, no fresh Phase 11 live read was authorized, and current chain/oracle freshness is not established. |
| Support configurable warning and critical thresholds, with default examples 1.3 and 1.1 | **PARTIAL** | Exact validated configuration and the defaults `1.30`/`1.10` exist in the CLI path. Both long-running runtimes and both HTTP read models hard-code the default threshold stream, so deployed service thresholds are not configurable end to end. |
| Send timestamped alerts through at least one supported channel | **PARTIAL** | Alert formatting, console/Telegram/Discord adapters, retrying delivery, and historical console delivery evidence exist. The PostgreSQL runtime used by the deployment draft constructs `adapters: []`; the SQLite service permits console only; and no deployed scheduler or current external-channel delivery was demonstrated. |
| Include a concrete suggested action in each alert | **FAIL** | The alert schema has no suggested-action field. Rendering gives reasons and sometimes optional numerical recovery estimates, but many alerts have no estimate or instruction and every estimate is explicitly non-actionable. |

The codebase contains substantial, safety-conscious monitoring machinery, but the four requirements are not jointly satisfied by one deployable runtime. Product acceptance therefore remains **NO-GO**.

## 2. Evidence classification

The following distinctions are essential when interpreting this audit:

| Evidence class | What exists | What it proves—and does not prove |
| --- | --- | --- |
| Implementation | Source paths and functions cited below | Shows intended and testable behavior, not that a service is deployed or currently receiving valid chain data. |
| Historical real-chain capture | [`evidence/phase5/inspect/live/position-snapshot.json`](../evidence/phase5/inspect/live/position-snapshot.json), block `21924008`, retrieved `2026-11-02T10:20:33.130Z` | Shows a prior real Pharos RPC/MCP read for the public demonstration position. It is not a Phase 11 live check or a current assessment. |
| Historical live monitor/console capture | [`evidence/phase5/monitor-smoke-once.txt`](../evidence/phase5/monitor-smoke-once.txt), block `21924130` | Shows prior accepted `WARNING` mathematics, timestamped console messages, and recorded console deliveries. It also records `UNVERIFIED` oracle quality and `UNKNOWN` freshness. |
| Historical requested-block calculations | `evidence/phase5/risk/historical-21853902/` | Historical chain-derived calculations only; explicitly not a current position assessment. |
| Fixtures and mocks | The Phase 11 Vitest selections | Verify pure arithmetic, validation, state transitions, adapter behavior with mocked HTTP, and scheduler boundaries. They are not live-chain, live-provider, deployed-scheduler, or production-database acceptance. |
| Prior local PostgreSQL evidence | [`docs/phase10-test-evidence.md`](phase10-test-evidence.md) and the external Phase 10 certification | Shows local PostgreSQL fixture behavior. It does not prove Neon, deployed Render, or live production acceptance. |
| Deployment drafts | [`render-a3.yaml`](../render-a3.yaml), [`cloudflare/monitor-scheduler/wrangler.toml`](../cloudflare/monitor-scheduler/wrangler.toml) | Both are expressly unapproved/not deployed; the Render draft disables scheduling. |

No estimate, fixture, prior capture, or stored alert was treated as current chain truth.

## 3. Requirement 1 — chain position and risk data

**Verdict: PARTIAL.** The core read and arithmetic are implemented for the single supported demonstration position, but the product is not a general wallet watchdog and freshness remains unresolved.

### Implementation and actual behavior

- [`src/config/deployment.ts`](../src/config/deployment.ts) fixes Pharos chain `1672`, one Morpho market, and account `0xc6dD...7Aa7`; the account role is explicitly `PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET`.
- [`src/chain/live.ts`](../src/chain/live.ts) `inspectLive()` creates the RPC and official Chain MCP clients and calls `inspectPosition()`.
- [`src/chain/snapshot.ts`](../src/chain/snapshot.ts) `inspectPosition()`:
  - selects `min(RPC head, MCP head) - 5` unless a historical block is explicitly requested;
  - pins reads to one block and validates chain IDs and before/after headers;
  - compares RPC/MCP results, contract code, six batch sentinels, and the complete required read set;
  - reads the position collateral and borrow shares, market totals, IRM rate, LLTV, token metadata, oracle price, feed timestamp, and configuration/control values;
  - accepts accounting only after required validation and stable block checks pass.
- Collateral is a direct contract value (`position.collateral`). Debt is not a provider-supplied estimate: [`src/morpho/accounting.ts`](../src/morpho/accounting.ts) `accruePosition()` accrues market interest and converts borrow shares to assets with debt rounded up.
- The health-factor equivalent is [`src/morpho/accounting.ts`](../src/morpho/accounting.ts) `valuePosition()`'s `safetyRatioWad = floor(maxBorrow * WAD / debt)`, where `maxBorrow` is collateral value times LLTV. A value of `1.00` is the mathematical liquidation boundary.
- [`src/risk/engine.ts`](../src/risk/engine.ts) and [`src/risk/assured.ts`](../src/risk/assured.ts) validate provenance, apply assurance gates, calculate risk, and preserve block/hash/snapshot bindings.

### Precision and validation

- Financial values use checked `bigint`, WAD `10^18`, and oracle scale `10^36`; [`src/morpho/math.ts`](../src/morpho/math.ts) rejects unsigned-range overflow and zero denominators.
- Debt conversion rounds up; valuation and capacity round down. [`src/risk/thresholds.ts`](../src/risk/thresholds.ts) compares exact cross-products rather than a floor-rounded displayed ratio.
- Recovery solvers separately prove the minimum repayment and additional-collateral amounts under their stated snapshot assumptions. They do not model gas, wallet funding, subsequent interest/state changes, execution availability, fee-on-transfer behavior, or combined actions.

### Remaining gaps

1. **Fixed identity:** no runtime input selects an arbitrary user, market, chain, or position. This is a watchdog for one demonstration position, not a generally configurable product.
2. **No current acceptance read:** Phase 11 deliberately made no external-chain call. The real-chain evidence is historical.
3. **Provider independence:** RPC and MCP agreement is useful consistency checking but both share an upstream and are not independent consensus.
4. **Old-block acceptance:** `validateBlock()` rejects malformed and future headers but has no maximum block age. If both endpoints repeatedly expose the same old head/block, retrieval can still complete.
5. **Readiness measures retrieval age, not chain progress:** [`src/runtime/read-model.ts`](../src/runtime/read-model.ts) computes staleness from `snapshotRetrievedAt`. Re-reading an unchanged old block can receive a recent retrieval timestamp without proving advancing chain state.
6. **Oracle freshness and assurance:** [`src/oracle-assurance/freshness.ts`](../src/oracle-assurance/freshness.ts) correctly leaves freshness `UNKNOWN` without verified heartbeat, timing semantics, and upstream guarantee. Production evaluation supplies none. An optional local maximum age is only an operator-defined rejection bound, not proof of source freshness. Oracle assurance remains `UNVERIFIED`, so risk numbers remain indicative.

## 4. Requirement 2 — configurable thresholds

**Verdict: PARTIAL.** The configuration model is exact and well validated, but the deployable service paths do not consume threshold configuration.

### Implemented behavior

- [`src/config/risk.ts`](../src/config/risk.ts) defaults to warning `1.30`, critical `1.10`, target `1.25`, and immutable boundary `1.00`.
- Decimal text is parsed exactly to 18-decimal WAD values; scientific notation, signs, whitespace variants, leading-zero forms, and excess precision are rejected.
- Validation requires `warning > critical > 1.00` and `target > critical`; the boundary must be exactly `1.00`. A target below warning is intentionally permitted.
- `loadThresholds()` accepts a bounded regular JSON file, then applies explicit CLI overrides. [`src/cli/options.ts`](../src/cli/options.ts) and [`src/cli/monitor.ts`](../src/cli/monitor.ts) expose these options for risk/monitor commands.
- Monitoring scope includes the threshold decimal text, preventing histories from different threshold configurations from being silently merged.

### Runtime wiring gap

- [`src/runtime/postgres-runtime.ts`](../src/runtime/postgres-runtime.ts) `start()` calls `parseThresholds()` with no overrides and builds the scheduler/store scope from those defaults.
- [`src/runtime/service.ts`](../src/runtime/service.ts) `RenderRuntime.initialize()` also calls `parseThresholds()` with no overrides.
- [`src/runtime/read-model.ts`](../src/runtime/read-model.ts) both `PersistedReadModel.read()` and `AsyncPersistedReadModel.read()` query `monitoringScope(parseThresholds())`, again selecting only the default stream.
- PostgreSQL environment parsing has no threshold fields. Consequently, a non-default stream created elsewhere would not be the stream served by these HTTP surfaces.

Threshold tests demonstrate exact parsing and classification, but not configurable thresholds in either long-running product runtime.

## 5. Requirement 3 — timestamped alerts and delivery

**Verdict: PARTIAL.** Alert generation and supported adapters exist, but no deployable, scheduled runtime currently joins them.

### Implemented behavior

- [`src/monitoring/transitions.ts`](../src/monitoring/transitions.ts) creates alerts at the observation timestamp for risk transitions, critical reminders, data-quality changes, persistent failures, and oracle-assurance changes.
- [`src/notifications/format.ts`](../src/notifications/format.ts) begins every message with UTC `createdAt` and includes severity, identity, state transition, safety ratio, data/oracle status, block/hash, snapshot ID, reason, and optional estimates.
- [`src/notifications/adapters.ts`](../src/notifications/adapters.ts) implements console, Telegram, and Discord adapters with bounded HTTP and validated credential/destination shapes.
- [`src/notifications/dispatcher.ts`](../src/notifications/dispatcher.ts) implements a durable bounded outbox: by default five attempts, 5-second base delay, 900-second cap, 15-second provider timeout, and ten messages per drain.
- Historical evidence in `monitor-smoke-once.txt` shows three timestamped console messages and `DELIVERED` records. Phase 11 mocked-adapter tests passed; they did not contact Telegram or Discord.

### Deduplication, repetition, and delivery semantics

- Fingerprints bind scope, dimension, episode, code, and—only for configured repeated critical alerts—the cycle. Threshold text is part of scope.
- A new mathematical state creates a new episode alert. Persistent read failure alerts once when the default three-failure boundary is crossed. Critical reminders are disabled by default unless `alertOnEveryCriticalCheck` or `criticalReminderSeconds` is configured.
- Permanent fingerprint records survive normal history pruning, preventing regeneration of already-known alerts.
- Delivery is bounded **at least once**, not exactly once. A provider may accept a message while the response is lost; the persisted ambiguous attempt can then be retried and duplicate the external message.

### Runtime and deployment gaps

1. [`src/runtime/postgres-runtime.ts`](../src/runtime/postgres-runtime.ts) constructs every scheduled `MonitoringService` with `adapters: []`. Alerts may be persisted, but no delivery rows are created for a supported channel.
2. [`src/runtime/service.ts`](../src/runtime/service.ts) rejects Telegram/Discord and supplies only a console adapter. Console output satisfies a local supported channel, but it is not a durable operator push channel.
3. The standalone CLI can construct configured adapters, but it is not the PostgreSQL scheduled deployment path.
4. The Cloudflare five-minute Worker and Render configuration remain unapproved and undeployed. Render explicitly has `WATCHDOG_SCHEDULER_ENABLED=false`.

## 6. Requirement 4 — concrete suggested action in every alert

**Verdict: FAIL.**

- [`src/monitoring/model.ts`](../src/monitoring/model.ts) `alertSchema` contains identity, severity/category/code, and previous/current observations, but no required `suggestedAction` or equivalent.
- [`src/notifications/format.ts`](../src/notifications/format.ts) has a descriptive `Reason:` map, not an action map. Data-quality, oracle, failure, no-debt, recovery, and other alerts can contain no instruction at all.
- Optional repayment/additional-collateral amounts appear only when calculation and data gates permit them. Absence has no universal fallback action.
- Every amount and alert says `actionable: false`; the renderer calls estimates “indicative and non-actionable.” A number that the product expressly says not to act on cannot satisfy a requirement for a concrete suggested action.
- No signer, transaction builder, approval flow, simulation-to-execution binding, or broadcast capability exists. Source search found no wallet/private-key or send-transaction implementation.

### Are the numerical recommendations safely actionable?

**No.** Their arithmetic is conservative and snapshot-bound, but execution safety is not established. Oracle source/heartbeat is unverified, the chain may have advanced, funding/gas/approvals and transfer behavior are unmodeled, and the software cannot bind a displayed amount to a freshly simulated transaction. They are useful decision-support estimates, not transaction instructions.

A safe implementation should make a concrete human action mandatory for every code, for example:

- stale/unavailable/invalid data: **“Do not transact from this alert; independently verify the current position and oracle before deciding.”**
- warning/critical risk: **“Review the named position now and independently verify current chain state; if validated, consider reducing debt or adding collateral.”**
- calculated amount: present it only as an explicitly conditional option with block/hash, age, assumptions, token/decimals, and a requirement to refresh and simulate before execution.

This would satisfy the messaging requirement without falsely promoting estimates to executable advice.

## 7. Oracle and alert safety assessment

- Assurance is bound to snapshot ID, block, price/configuration evidence, and retrieval time. Invalid/unavailable assurance suppresses estimates, and configuration/observability invalidation is sticky.
- That fail-closed behavior is valuable, but accepted mathematical observations may still have `UNVERIFIED` data/oracle quality; the historical smoke does exactly this. The effective state remains `DATA_UNVERIFIED` while a mathematical `WARNING` is also shown.
- There is no qualified independent price comparator, verified feed heartbeat, or upstream freshness guarantee in production configuration.
- The product must not imply “safe” from successful reads, provider agreement, HTTP `200`, scheduler `accepted: true`, or a ratio above a configured band.

## 8. Scheduler and missed-slot behavior

- [`src/config/postgres.ts`](../src/config/postgres.ts) defaults to five-minute (`300` second) UTC slots and constrains configured periods to minute-grid divisors of one hour that can contain the cycle budget.
- [`src/storage/postgres/scheduler-store.ts`](../src/storage/postgres/scheduler-store.ts) uses database time, a global fenced lease, a persistent high-water slot, durable execution receipts, and a 600-second admission window.
- A later admitted slot records the number of missed slots. It does **not** run catch-up observations for those slots. This is appropriate for avoiding stale replay, but monitoring gaps remain gaps.
- [`src/runtime/scheduler.ts`](../src/runtime/scheduler.ts) runs one finite cycle per admitted request. A completed HTTP exchange or receipt records whether the observation was accepted; neither proves chain progress or oracle freshness.
- [`cloudflare/monitor-scheduler/src/worker.ts`](../cloudflare/monitor-scheduler/src/worker.ts) makes one authenticated request and calls `noRetry()`. This avoids duplicate platform retries but means a failed event is not caught up automatically.
- The Worker and service are not deployed or activated, so cadence is implementation/local-test evidence only.

## 9. Phase 11 test results

All tests were existing tests. Commands used Node **24.14.1**, Vitest **5.0.5**, native config loading, `--no-cache`, `--no-fsModuleCache`, `NODE_DISABLE_COMPILE_CACHE=1`, and an external temporary directory. No build, emit, fix, evidence-generation, database migration, or live integration command ran.

| Check | Result | Scope |
| --- | --- | --- |
| Core selected suites | **543/543 passed**, 23 files, 0 failed/skipped | Accounting, validation, chain snapshots/transports, oracle/risk, thresholds/recovery, monitoring, PostgreSQL config, scheduler HTTP/runner, Worker, and A3 config; fixtures/mocks/local HTTP only. |
| Filtered notification/continuity suites | **44 passed, 16 intentionally skipped**, 2 files, 0 failed | Pure/mock cases selected by positive test-name filter. Eleven SQLite delivery-persistence cases and five SQLite continuity-persistence cases were excluded to avoid repository/database side effects. |
| Aggregate | **587 passed, 16 skipped**, 25 unique files, 0 failed | This is selected Phase 11 coverage, not the entire repository suite and not live acceptance. |
| TypeScript | **PASS**, exit `0` | `node node_modules/typescript/bin/tsc --noEmit` |
| ESLint | **PASS**, exit `0`, no findings | `node node_modules/eslint/bin/eslint.js src test scripts *.config.* --no-cache` |

Authoritative external records are under `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase11-audit-Buz5k5`:

| Record | SHA-256 |
| --- | --- |
| `core-tests-command.json` | `02bc609ab420701b8ae005f87fd1409dcd40e043f561e9f9a0dd3f48b14b12e3` |
| `core-tests.json` | `725fe74d4adca9b75359f7de5ed74ccdc03a60977957175a877d9e071bd1a5c3` |
| `filtered-tests-command.json` | `0fd94a015b72779fe70cfb2e0bd3996a89e60bcbef6b423afb03d62472acb1b2` |
| `filtered-tests.json` | `ba1e9664c420bf67c9f4420f84cdb2367cae65fc787520077729fba79494979c` |
| `typecheck-command.json` | `3a1ddfca1b34ff3abc6955c9ed80cba1ee6d253d789feea12031d7845e4e0b26` |
| `lint-command.json` | `a61e60f93523b18e5015e631c88c44cb651d626733e107105c33cb099c889aec` |
| `post-test-preservation.json` | `0df71b87499d13c2760f196f8c74d13a7ab98c52a3e8f6af19c982af640f2cba` |

SQLite experimental warnings resulted from module imports; the selected filtered cases did not perform the excluded persistence operations.

## 10. Recommended implementation order

1. **Make every alert actionable as a message, not as an automated transaction.** Add a required, bounded suggested-action code/text to the alert schema; define safe per-alert defaults; render it on every channel; add schema/transition/format tests. Preserve explicit non-actionability of financial estimates.
2. **Wire threshold configuration through each runtime and read model.** Parse one threshold configuration at startup, inject it into monitoring, scheduler scope, and HTTP reads, expose the active threshold values, reject mismatched streams, and test restart/history behavior with non-default values.
3. **Wire at least one real delivery adapter into the PostgreSQL runtime.** Prefer an explicitly configured operator channel; validate secrets at startup; create outbox rows atomically with alerts; preserve bounded at-least-once semantics and disclose possible duplicates. Prove delivery with a controlled acceptance destination before production.
4. **Close the chain-progress/readiness gap.** Track observed head/block progression and block timestamp age separately from retrieval time; alert and mark unready on stalled providers; retain oracle freshness as a separate assurance dimension.
5. **Decide and implement product identity scope.** Either explicitly accept this as a single pinned-position service or add validated account/market configuration and isolated per-position scopes. Do not silently present the demonstration account as the user's wallet.
6. **Qualify oracle freshness/independence or keep the hard limitation.** Add configuration-bound evidence for heartbeat/timing semantics and a genuinely eligible independent comparator. Until then, continue showing `UNVERIFIED`/`UNKNOWN` and non-actionable estimates.
7. **Run deployment acceptance only after authorization.** Exercise the exact release with the intended PostgreSQL service, scheduler, current chain reads, and a real notification destination; verify missed-slot visibility, restart recovery, ambiguous delivery handling, and no silent stale readiness.
8. **Treat transaction execution as a separate, higher-risk project.** Do not add signing/broadcast merely to satisfy the suggested-action requirement. Any future execution path needs fresh-state simulation, slippage/amount limits, explicit authorization, independent security controls, and separate acceptance.

## 11. Preservation and authorization boundaries

The post-test comparison covered all regular files and symlink targets, including `.git`, ignored files, dependencies, `dist`, `data`, and `evidence`:

- baseline at `2026-11-04T17:57:32.596Z`: **21,916 entries**, **271,242,654 bytes**;
- post-test result: no added, changed, or deleted entry;
- Git HEAD remained unborn (`null`);
- `.git/index` remained **65,736 bytes**, SHA-256 `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689`;
- Git status, staged diff, and worktree diff matched their pre-audit byte hashes;
- A4.4 and A4.5 documents remained byte-identical.

After this report is created, it is the only permitted repository addition. Final report validation and the resulting one-file preservation exception are recorded separately in the audit directory.

A4 remains outside Phase 11 implementation authority. Under the documented full Windows-administrator-compromise model, local processes, files, clocks, trust stores, signatures, and receipts are not authoritative. [`A4.5-PROVIDER-ARCHITECTURE-EVALUATION.md`](A4.5-PROVIDER-ARCHITECTURE-EVALUATION.md) remains **NO-GO for implementation or migration**; no complete zero-spend architecture has been verified. Its next separately approved step remains G0, including independent custodians/recovery domains, scenario-10 scope, repository visibility, and hard budget limits.

## 12. Acceptance exit criteria

Re-audit only when one exact, authorized runtime can demonstrate all of the following together:

1. current, advancing, block-bound chain reads for the explicitly supported position identity;
2. active warning/critical thresholds loaded from documented configuration and reflected in the served scope;
3. a timestamped alert delivered through a configured supported channel from that same runtime;
4. a required, concrete, safety-qualified suggested action on every alert code, including unavailable-data cases;
5. explicit oracle freshness/assurance status without treating retrieval recency as chain/oracle freshness;
6. scheduler and restart evidence, including visible missed slots and bounded duplicate-delivery behavior;
7. unchanged source/test baselines except for the separately authorized implementation and evidence set.

Until those criteria are met, the correct product decision is **NOT ACCEPTED / NO-GO**.
