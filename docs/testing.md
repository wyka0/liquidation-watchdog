# Testing and verification

## Commands

Run from the project root only in a validation workspace where the described writes and prerequisites are intended. These commands are **not a read-only documentation check**; none was rerun for the 2026-11-06 documentation cleanup. In particular, integration selects both live-network and native-database tests:

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run test:operations
npm run test:integration
npm run test:stability
npm run build
npm run secrets:check
npm run evidence:check-phase1
npm run evidence:check-prior
npm run evidence:inventory
git diff --check
```

| Selection | Files / prerequisites | Side effects |
| --- | --- | --- |
| `npm test` / `npm run test:unit` | `vitest.config.ts` selects `test/**/*.test.ts` and excludes `test/integration/**`: **49 default files** in the reviewed tree | Fixture tests create temporary SQLite databases, filesystem artifacts, local listeners and child processes; tool caches may change. `test:unit` also writes `evidence/phase5/unit-tests.json`. |
| `npm run test:operations` | Four operational files already included in the default suite | Repeats local filesystem/SQLite/process tests and writes `evidence/phase5/operations-tests.json`; not additive coverage. |
| `npm run test:integration` | `vitest.integration.config.ts` selects **two files**, `test/integration/live.test.ts` and `test/integration/postgres.test.ts` | Requires both public RPC/MCP access and local PostgreSQL 17 binaries; writes `evidence/phase5/integration-tests.json` plus the effects below. |
| `npm run test:integration -- test/integration/live.test.ts` | Live integration file only; fixed Pharos RPC and hosted MCP | Real read-only chain calls and snapshot/risk evidence writes. |
| `npm run test:integration -- test/integration/postgres.test.ts` | Native integration file only; `WATCHDOG_PG_TEST_BIN` | Creates, mutates, restarts and tears down a disposable local PostgreSQL cluster. |

Filtered integration invocations still use the same package report destination; they do not create distinct named reports automatically. Preserve earlier outputs before any new capture. `npm ci` changes installed dependencies; `npm run build` emits `dist/`; stability and smoke harnesses create local database/evidence outputs.

`npm run verify` plans 26 checks, including typecheck/lint/default tests/operations/**both integration files**/stability/build, built CLI help, inspect/live-risk/historical-risk smokes, historical Phase 2 proof regression, two one-cycle monitor processes with restart/history/status checks, a 15-command operational CLI smoke, six oracle audit/status processes, source/runtime links, dependency audit, archive/oracle integrity, exact typed Phase 2 replays, inventory, links, secret scan and Git whitespace checks. It performs live RPC/MCP access, database initialization/writes and backup/restore smokes, and a network dependency audit; it writes reports and captures under `evidence/phase5/`. The dependent sequence stops on failure; preservation/inventory/scanning still run. Saved `evidence/phase5/verification-results.json` and `verification-runs/` are **historical Phase 5 attempts**, not current certification. Most subprocesses have a five-minute bound; monitor/operational harnesses have nine minutes and the oracle harness thirteen. Monitor/oracle smoke children have four-minute hard bounds; operational smoke children have three minutes.

The repository was initialized locally for Phase 1. Phase 5 preserved existing intent-to-add entries and used `git diff --check` plus `git diff --no-index --check` for new files without staging, committing or pushing. `docs/phase5-files.md` and `evidence/phase5/file-changes.json` are **historical Phase 5 inventories**, not an inventory of the current implementation. Their hashes and prior completed inventories retain their original scope.

`npm run verify -- --finalize` repeats five local inventory/link/secret/whitespace checks, confirms tested source/configuration/scripts are unchanged, and fingerprints that attempt's documentation. It **writes** finalization/evidence output; inventory generation also rewrites `docs/phase5-files.md`. The default secret, link, inventory and preservation scripts write results even when named a “check.” `npm run release:manifest` writes the manifest/checksum and `npm run release:check` writes `release-manifest-check.json` (its internal secret scan is read-only, but the release command as a whole is not). These historical workflows require a completed full run, finalization, unchanged finalized documentation and matching test-report copies. Existing manifests/seals must not be regenerated merely to make later edits look historically certified. See [reliability testing](reliability-testing.md) and the [historical Phase 5 report](phase5-report.md#12-tests-and-exact-verification-results).

## Final qualification provenance

The final preserved qualification batch of **2026-11-06** recorded **1007/1007 across 49 default files**, runtime-process **4/4**, focused qualification **31/31**, and an independent selection with **1 passed / 3 intentionally unselected-pending / 0 failed**. Typecheck, lint and an external-output build exited 0. Focused selections overlap the full suite and are not additional independent coverage. The original Stage 2 **1006/1007** outcome, the runtime-process repair, failed attempts and negative controls remain part of the history.

The [submission package test evidence](SUBMISSION-PACKAGE.md#e-test-and-build-evidence) and [evidence index](SUBMISSION-PACKAGE.md#k-evidence-index) identify the external `qualification-repair-20261106-QrN8p4/qualification-batch/summary.json` provenance. Those saved results do not include a new integration run or a fresh validation of this documentation cleanup. The [synthetic demo report](SUBMISSION-SINGLE-POSITION-DEMO.md#6-verification-results-this-qualification) retains its own dated native PostgreSQL result separately.

## Required cases

The following is the **historical Phase 5 coverage map**, retained for context. It is not a complete inventory of the later 49-file default suite, nor does its inclusion of a live file make that file part of default tests. Current selection rules are above; later action, position, HTTP runtime, scheduler and PostgreSQL coverage is described in the stage reports.

| Test file | Meaningful coverage |
| --- | --- |
| `test/accounting.test.ts` | Historical integer regression; interest versus stored debt; third Taylor term and fee-share ordering; all official skip conditions; virtual assets/shares; ceiling inequalities; 18/6 decimal valuation; `NO_DEBT`; zero collateral; uint128/uint256/intermediate overflow; invalid amounts and decimals |
| `test/validation.test.ts` | Derived market ID; wrong addresses/LLTV; nonexistent market; inconsistent totals/timestamps/fee; storage width; position/total mismatch; token identity and metadata; unsafe RPC numeric shapes; quality precedence |
| `test/oracle.test.ts` | Intentional zero rounds; unknown heartbeat; old timestamps without invented staleness; zero/future/negative timestamps; nonpositive answers; cache/scale disagreements; unavailable price; changed binding; verified-policy exact-age boundary and staleness |
| `test/snapshot.test.ts` | End-to-end synthetic snapshot, same-block reads, wrong/changed chain, missing code, altered Multicall runtime, mixed EVM block/timestamp, reorganization, individual failures, malformed success, provider disagreement, MCP outage, unread-scope quality, confirmed zero debt, wrong decimals, invalid timestamps |
| `test/transport.test.ts` | Three-attempt retry bound; Retry-After; paced queue; HTTP/timeout failures; credential-free endpoint checks; RPC ID/null-result handling; log-range bounds; seven-tool MCP boundary; SDK call rejection; envelopes; network fields; tool discovery and expired-session reconnection |
| `test/integration/live.test.ts` | Real current Pharos position through RPC plus the official MCP SDK; all ten contracts, market/token parameters, positive debt, oracle cross-checks, all 58 comparisons, six sentinels, header stability, and retained `UNVERIFIED` quality |
| `test/risk-thresholds.test.ts` | Exact decimal configuration; CLI/file precedence; invalid order/format; adjacent and exact threshold boundaries; displayed-ratio truncation; custom thresholds; overflow and quality gating |
| `test/risk-repayment.test.ts` | Target and neighbor proofs; share burning and updated market totals; both repay modes; full-share over-burn edge; virtual values; monotonicity; exhaustive independent minima; uint bounds |
| `test/risk-collateral.test.ts` | Three ceiling inversions; two forward floors; minimality; tiny amounts; fractional LLTV/price; extreme positive prices; unrepresentable collateral and overflow |
| `test/risk-engine.test.ts` | Non-actionability; separate provisional state/quality; oracle-policy pin; zero debt/collateral; missing/invalid/stale data; snapshot identity/accounting/block mismatches; immutable provenance; historical labels |
| `test/risk-cli.test.ts` | Original inspect behavior; risk/default/custom/config flags; raw/formatted amounts; historical mode enforcement; invalid arguments before network; unavailable/overflow exit codes |
| `test/risk-evidence.test.ts` | Self-contained result/estimate files and exact byte hashes; changed input and detached-provenance rejection; false actionability enforcement |
| `test/monitoring-config.test.ts` | Opt-in defaults; interval/config bounds; secret-file refusal; separate CLI threshold config |
| `test/monitoring-transitions.test.ts` | All mathematical/effective-quality/oracle-quality pairs; simultaneous transitions; recurrence fingerprints; critical reminders; recovery/failure episodes |
| `test/monitoring-storage.test.ts` | New/existing database; v1/v2-to-v3 migration and rollback; structural/semantic corruption; atomic state/outbox; baseline preservation; unique fingerprints; ownership; retention; interrupted attempts |
| `test/monitoring-service.test.ts` | Accepted/failing RPC/MCP cycles; malformed/partial/block-inconsistent data; backwards head; non-overlap/shutdown; fatal persistence stop/recovery; historical isolation; oracle policy; interruption recovery |
| `test/monitoring-cli.test.ts` | Bounded monitor/history/status commands; persisted restart views; default-disabled continuous mode; unknown/failed risk output |
| `test/notifications.test.ts` | Console; mocked Telegram/Discord success/error/429; bounded jitter/retries; provider-wide restart cooldown/fallback/blocking; pending/ambiguous outcomes; secret redaction |
| `test/monitoring-safety.test.ts` | Source-level execution-path exclusion and unchanged read-method allowlists |
| `test/oracle-assurance.test.ts`, `test/oracle-freshness.test.ts`, `test/oracle-independent.test.ts` | Seven assurance dimensions; unknown versus policy age; source/unit/identity qualification; no promotion from caller flags or independent-price substitution |
| `test/oracle-continuity.test.ts`, `test/oracle-audit-rpc.test.ts` | Persistent invalidation and configuration/timestamp/disagreement episodes; bounded historical logs, fixed read-only audit methods and block rechecks |
| `test/oracle-evidence.test.ts`, `test/oracle-cli.test.ts` | Immutable bundles, hashes/references, sanitized audit/status, exclusive evidence creation and persisted as-of labels |
| `test/operations-config.test.ts` | Exact production runtime/config/budgets, secret-free reporting, local path boundaries and read-only health/readiness/worker coherence |
| `test/operations-storage.test.ts` | Maintenance ownership, exact schema/record validation, migration rollback, actual SQLite page exhaustion, resource refusal, concurrent online backup, legacy/current isolated restoration and evidence tampering |
| `test/operations-lifecycle.test.ts` | Bounded active settlement/cancellation, hung reads/sends, late-result guards, real child kill/restart, simulated Windows graceful handlers and known-delivered preservation |
| `test/operations-transports.test.ts` | HTTP/MCP retry exhaustion, stalled/oversized streaming bodies, fixed endpoints, redirects, cancellation, bounded discovery/reconnection and notification ambiguity |

The Phase 5 `unit-tests.json` and `integration-tests.json` describe their recorded attempts. Use [final qualification provenance](#final-qualification-provenance) for the later default-suite result; documentation does not treat synthetic case data as live evidence.

## Live integration behavior

`test/integration/live.test.ts` uses **no mocks or fixture clients**. One shared live read retrieves the compiled public demonstration borrower at a newly selected block. The first test retains the original chain/position assertions and checks nonzero debt. The second calculates risk from that snapshot and verifies non-actionable provenance and strict suppression of repayment/additional-collateral estimates while assurance/progression are unqualified. It does not assert an unchanging numerical debt, price or risk band. This live-file description does not apply to the separate synthetic native PostgreSQL integration file.

A provider outage, changed market/oracle configuration, missing borrower debt, or disagreement is a real integration failure. The test does not quietly skip, fall back to a fixture, or convert a failed read to zero. Its timeout is 240 seconds and it runs one worker to avoid flooding public services.

Integration snapshots are saved in `evidence/phase5/phase1-regression/` and `evidence/phase5/risk-integration/`. CLI smokes have separate `inspect/live`, `risk/live`, and `risk/historical-21853902` directories under Phase 5. Compare each artifact's own block/hash and retrieval time. `scripts/phase5-preservation.ts` verifies all 391 prior evidence files and the sealed gap register. The exact-replay script separately verifies the 127 Phase 1/2 archive files, 15 Phase 2 risk artifacts and three complete typed-input/result replays. Real historical reread results are checked separately.

## Native PostgreSQL integration

`test/integration/postgres.test.ts` calls `localPostgresFixture()` from `test/fixtures/postgres.ts`. **`WATCHDOG_PG_TEST_BIN` must point to a local directory containing `postgres`, `initdb` and `pg_ctl` executables** (`.exe` on Windows). The fixture rejects a missing input or any server major other than PostgreSQL 17. It does not download/install binaries and does not accept a remote URL or an existing database directory. Historical qualification used PostgreSQL **17.11**; the broader major-version check is not a claim that every 17.x host was qualified.

The fixture creates a unique `watchdog-phase10-pg-*` directory under the local `opencode` temporary root, starts a loopback-only cluster on an allocated port, creates disposable database/roles, applies migrations and grants, resets schemas between tests, and exercises writes, restarts, fencing and killed-process recovery with synthetic observations. It closes tracked pools and stops its exact owned cluster before removing its unique directory; failed/uncertain server shutdown prevents directory removal. These are real local database/process/filesystem side effects, not read-only checks and not evidence of Neon persistence or live chain behavior. The integration configuration uses one worker and 240-second test/hook limits for both integration files.

## Monitoring and operational smokes

The monitoring smoke uses a unique local `data/phase5-monitor-smoke-*/watchdog.sqlite` database, then reopens it in a second built CLI process. It checks unique accepted cycles and that previously delivered entries were not retried. Alert totals may grow if a real meaningful transition occurs. Both cycles enable console only. The operational smoke immediately follows, checks as-of readiness within its 600-second policy, and verifies backup/restoration of that database. Sanitized JSON/text summaries are retained under Phase 5.

## Fixture provenance

- `test/fixtures/state.ts`: `FIXTURE`. Financial inputs reproduce the earlier block `21,848,634` arithmetic, while parent hash and some operational metadata are deliberately synthetic.
- `test/fixtures/runtime.json`: `HISTORICAL_SNAPSHOT`. Real public Multicall/proxy/cache bytecode archived from block `21,852,148`, with original hash, endpoint, and retrieval timestamp.
- `test/fixtures/clients.ts`: `FIXTURE`. Combines archived runtime with synthetic contract returns and injected failures. Its `.invalid` endpoints never contact a network.
- The 60-second verified policy in `oracle.test.ts` is explicitly synthetic and has no production configuration path.
- `test/fixtures/risk.ts` composes Phase 1 fake clients with a fixed `2026-11-01T14:05:00.000Z` clock and explicit `FIXTURE` evidence. Tiny arithmetic examples are also fixtures, not financial recommendations or real-chain claims.
- `test/fixtures/monitoring.ts` composes that unchanged risk fixture and deterministic clocks; generic transition-state pairs are synthetic. Provider HTTP mocks use inert generated credentials and never contact Telegram/Discord. SQLite tests create isolated temporary files under the local OpenCode temporary directory.
- `test/fixtures/phase4.ts` adds fixture assurance/continuity and SQLite helpers. The deterministic stability harness advances 144 cycles over 36 virtual days, two restarts and a 200-day retention jump; it makes zero external calls and is explicitly not a production-duration soak.

## Build and dependencies

TypeScript strictness includes `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, unused checks, and a separate source-only build. The build emits `dist/cli.js`, `dist/service.js`, `dist/postgres-service.js`, declarations and source maps. In the original source package `dist/` and installed dependencies were ignored by Git; this publication copy explicitly includes the **321 committed `dist/` build files** through the publication ignore exceptions. Their presence reflects the historical qualified build captured at publication time, not a fresh successful build of the current tree. Historical Phase 5 records bind their own tested build, not later source. The final qualification batch above used an external build-output directory. The verified runtime is Node 24.14.1 / SQLite 3.51.2; broader package-engine compatibility is not a tested host matrix.

Versions are pinned in `package.json`/`package-lock.json`. `minimatch` is overridden to `11.0.1` to resolve the development-tool dependency advisory found during initial installation; the final dependency audit is preserved separately. The audit, scanner, and tests establish the checks performed at their recorded times, not a permanent guarantee about future dependencies or chain behavior.
