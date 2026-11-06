# Phase 10 test evidence

All Phase 10 verification ran through the exclusive evidence runner (`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase10-run.mjs`, unique labels, artifacts under `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase10-validation-6OrEZX`). Each command record binds label, exact argv, cwd, start/finish timestamps, exit code and SHA-256 of stdout/stderr under `commands/<label>.json`. Failed and superseded runs are **retained**, never deleted.

## 1. Authoritative results

| Check | Record | Result |
| --- | --- | --- |
| TypeScript (`tsc --noEmit`) whole tree incl. tests | `typecheck-07` | **PASSED**, 0 errors (exit 0). |
| Full unit suite (`test/**` except `test/integration/**`) | `units-01` | **776/776 passed** across 38 files (exit 0; JSON report `units-01.json`). |
| Scheduler-specific units (config + HTTP + runner + connection) | `scheduler-unit-04` | **67/67 passed** (19 config, 31 HTTP, 9 runner, 8 connection) — supersedes scheduler-unit-01/02/03. |
| Native PostgreSQL integration suite (PostgreSQL 17.11 fixture) | `postgres-06` | **58/58 passed**, zero unhandled rejections — the authoritative native record (supersedes postgres-01…05). JSON report `postgres-06.json`. |
| Legacy live-chain integration (real Pharos RPC + MCP), isolated copied workspace | `live-verify-01` | **2/2 passed** (no repository writes; original evidence untouched). |
| Production build (`tsc -p tsconfig.build.json`) in isolated workspace | `build-verify-01` | **PASSED** (297 built JS/d.ts/map files; original `dist` untouched). |
| ESLint, script-exact scope (`eslint src test scripts *.config.*`) | `lint-04` | **PASSED**, 0 problems (supersedes lint-01/02/03 where lint-01 exposed an inline `import()` type annotation that was fixed before re-running). |
| Dependency audit (`npm audit --json`, isolated npm cache) | `deps-audit-02` | **PASSED**: 0 vulnerabilities across 297 dependencies (prod 123 / dev 174 / optional 54 / peer 36). |
| Read-only secret scan (`scripts/check-secrets.ts --read-only`) | `secrets-scan-01` | **PASSED**: 1,277 files, 9 rules, 0 findings, authored `.env.example` placeholder byte-verified. |
| Catalog fingerprints | `postgres-catalog-01` | Fixture `6243896b…d3cb` vs production `24b4fea1…0ba3` recorded with PostgreSQL **17.11** identity. |
| Local SQLite monitoring suite (Phase 9 preservation gate) | `sqlite-monitoring-01` | 90/90 passed (retained; SQLite behavior untouched). |

## 2. Native integration composition (`postgres-06`, 58 tests)

| Suite | Tests |
| --- | --- |
| Isolated schema and migration contracts | 21 — idempotent two-migration lineage, checksum/gap/future refusals, transaction rollback reuse, hostile-value binding, four exact-decimal round-trip classes and rejects, canonical UTC text/microsecond projection, timestamp constraints, PK/FK/channel/actionability/counter invariants, namespace/DDL denial. |
| Global ownership, slots and atomic persistence | 12 — single-winner concurrent admit, slot expiry/late-receipt retries, database-clock admission boundary, high-water replay prevention (including clock rollback), expired-owner recovery with missed slots and late-write refusal, 300 s job budget, incarnation rotation fencing, atomic state/assurance/fingerprint/alert/outbox commit, whole-transaction backlog rollback, serialized state transitions, lost-COMMIT reconciliation for observation and admission. |
| Outbox, API snapshots and driver failures | 14 — single concurrent claim, retry history, provider cooldown/blocking, stale-claim recovery, ambiguity stickiness, bigint-cursor pagination + byte-budget snapshots, coherent snapshots across uncommitted writes, 601 s stale observation semantics (`UNKNOWN` freshness, `actionable:false`), corrupted-binding refusals, admission bounds without disk probing, server-side statement termination/reuse, terminated-backend recovery, shared monitoring service end-to-end with synthetic sends and durable receipt, writer-role read refusal. |
| Hardened roles, bound receipts, retention and recovery | 9 — catalog-drift and privileged-connection refusal, drifted-runtime-grant refusal with exact grant restoration, receipt tamper matrix (`{}`, acceptance flip, `completed_at` binding) except exact awaited binding acceptance, persisted-cycle-derived acceptance after later failures, prune protection matrix (pending alerts/tombstones/stream-bound cycles preserved; terminal delivered alert + delivery pruned by cascade), cursor pagination over ~100 real ≥260 KB observation rows with server-side `READ_LIMIT`, immediate-restart survival (durable incarnation + receipt + unchanged identity, ~31 s), queued-persistence cancellation with intact in-flight owner transaction, deliberately-aborted capability (synchronous `STORE_NOT_OWNED` refusal). |
| Killed child processes recover through persisted state only | 2 — genuinely killed mid-read owner (read-only state preserved, `PROCESS_INTERRUPTED` derived, missed slots 0, database rolls forward); genuinely killed mid-send owner (IN_FLIGHT attempt recovered as `ATTEMPT_INTERRUPTED` + ambiguous, retried without duplicate attempts, delivery closes `DELIVERED`). |

The killed-child tests spawn real `tsx` child processes (`test/helpers/phase10-worker.ts`) and terminate them with `process.kill` semantics observed on Windows (`SIGTERM`-sent signal reporting `SIGTERM`); they read/persist only through the durable protocol — no direct database side channels — and the recovery assertions run on the surviving parent's own connection.

## 3. Superseded and failed records (retained)

| Record | Notes |
| --- | --- |
| `typecheck-01…05` | Superseded; `typecheck-05` first failed on one 441-byte-width non-null assertion, fixed (`width!`) in `test/integration/postgres.test.ts`. |
| `scheduler-unit-01/02/03` | Superseded by -04 after fixture/connection-test evolution. |
| `postgres-01/02/03` | Early filtered/constrained runs retained as development evidence. |
| `postgres-04` | 47/47 pre-expansion suite; superseded by -06 after adding the nine hardened-role tests + two killed-child tests (58 total). |
| `postgres-05` | 52/58 + 1 unhandled-rejection run against the first expansion: exposed **(1)** an unawaited admit promise in the receipt-tamper equality, **(2)** wrong prune-count expectations (single-alert assumption instead of the actual three-alert fixture), **(3)** `int4` number vs `'1'`-string coercion, **(4)** synchronous `STORE_NOT_OWNED` throw captured by `.rejects`, **(5)** Windows `SIGTERM` exit-signal expectation in both kill tests. All fixed for `postgres-06`. |
| `lint-01` | Failed on `consistent-type-imports` inline `import()`; fixed and re-run as lint-03/-04. |
| `lint-02` | Erroneous launch pattern (bad argument expansion); no findings, superseded. |
| `deps-audit-01` | Malformed invocation (`npm_execpath` unavailable in that harness); superseded by -02 with explicit npm CLI path and isolated cache. |
| `unit-01-interruption` | Historical full-suite attempt exceeding the earlier harness timeout; superseded by `units-01` overall. |
| `postgres-admission-diagnostic-01/02`, `postgres-cycle-diagnostic-01`, `postgres-catalog-01` | Development diagnostics and the authoritative catalog fingerprint record. |

## 4. Evidence-integrity rules

- Every record above is byte-bound in `commands/*.json`; the final [Phase 10 report](phase10-report.md) and the external final record bind the aggregate inventory by SHA-256. The runner refuses label reuse (`Use a new exclusive command label`).
- No verification wrote into the repository's historical evidence directories. `test:unit`/`test:integration`/`verify`-style archive writers were redirected to the external validation directory, and the legacy live integration plus the production build ran **only** inside a deliberately copied workspace (`phase10-verify-ws-01`) with the original `dist/` intact.
- Native-suite execution used `WATCHDOG_PG_TEST_BIN`-record-dedicated PostgreSQL 17.11 binaries from the validation directory — never a real Neon/production server, never the repository SQLite databases.
