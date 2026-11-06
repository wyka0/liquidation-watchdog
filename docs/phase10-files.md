# Phase 10 files and preservation inventory

**Scope:** local PostgreSQL implementation only (`pg@8.23.1` backend, protected scheduler endpoint, authenticated bounded reads, native PostgreSQL 17 test fixture). Everything is uncommitted; the working tree holds six modified originals, twenty-six additions (twenty code files and the six Phase 10 documents), and unchanged historical material.

## 1. Modified originals (6, exactly the authorized set)

The Phase 10 authorization list is pinned externally (`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase10-allowed-modifications.json`); the fresh verifier compares byte hashes against the frozen pre-implementation snapshot (`baseline.json`, SHA-256 `88d3a445b80328bb09a47168b0bb4e3d485aef98f2c982ec160aba965a2542de`).

| File | Diff vs original | Why it changes |
| --- | --- | --- |
| `package.json` | +3 lines | `start:postgres` entrypoint script; pinned `pg`/`@types/pg` **8.23.1** dependencies. |
| `package-lock.json` | Pinned install entries only | The two new packages and their transitive closure; all other resolutions untouched. |
| `src/monitoring/service.ts` | 38 lines removed / 49 added | The monitoring service now supports `AsyncServiceOptions` (awaited store calls: acquire/requireResources/state/assurance/commitObservation/finishCycle/recoverDeliveries), propagates cancellation into the store, and bounds the whole cycle (`CYCLE_TIMEOUT`) with consistent async wake/fail semantics. Shared with SQLite via `monitoringPersistence`. |
| `src/notifications/dispatcher.ts` | 7 lines removed / 8 added | Dispatcher awaits async store acknowledgments; delivery/attempt/reservation semantics and retry math unchanged. |
| `src/runtime/read-model.ts` | 13 lines removed / 42 added | Adds `AsyncPersistedReadModel` (async read-only snapshots, exact bigint cursor kind, strict 600-second age preservation), while `PersistedReadModel` keeps byte-identical SQLite behavior. |
| `src/runtime/http.ts` | 17 lines removed / 80 added | Adds the protected scheduler route (admission-timeout, body caps, auth/rate/origin discipline), query-paging validation including exact bigint cursors, and 413/429/418-family sanitized error mapping; all Phase 8 read-route behavior preserved. |

## 2. Additions — implementation (20)

| Path | Role |
| --- | --- |
| `src/config/postgres.ts` | `PG_LIMITS` budgets; strict URL grammar; explicit `PostgresConfiguration` (namespace, schedulerEnabled, writer/reader). |
| `src/postgres-service.ts` | Import-safe `start:postgres` entrypoint (env-var names consumed only at invocation; redacted startup/shutdown failure events). |
| `src/runtime/postgres-runtime.ts` | Inert-construction runtime; explicit lifecycle; scheduler/HTTP/database wiring; bounded stop with exit codes. |
| `src/runtime/scheduler.ts` | `SchedulerRunner` — the 240s/300s/360s/420s budget ladder, slot protocol, and receipt publication. |
| `src/runtime/scheduler-contract.ts` | Slot regex (UTC `:07/:37`), literal-body parser, receipt schema + cross-status refinement, `scheduledIdentity`, digest-based authenticator. |
| `src/storage/postgres/catalog.ts` | Fixed-drift catalog fingerprint computation. |
| `src/storage/postgres/codec.ts` | Canonical TEXT/counter/sequence codecs; `PG_MAX_INT8`; `STORE_CORRUPT` factory. |
| `src/storage/postgres/connection.ts` | Role pools (`max=1`, queue 3, connect/idle/close 5 s), serialized bounded reconnection, transaction discipline with server-side statement/lock timeouts and `synchronous_commit=on`. |
| `src/storage/postgres/database.ts` | `PostgresDatabase` — catalog/identity verification, role verification, global fencing, atomic writes, readSnapshot with 1 MiB server-side page budget and bigint cursors. |
| `src/storage/postgres/migrations.ts` | Two checksummed migrations (15-table schema + identity/lease/executions), idempotent explicit maintenance application, PostgreSQL-17 family requirement. |
| `src/storage/postgres/scheduler-store.ts` | Global admission/lease/missed-slots math, durable receipt binding and tamper refusal, interrupted-derivation. |
| `src/storage/postgres/store.ts` | Job-scoped capability store — begin/commit/finish cycle atomicity, outbox claim/ack/recovery/cooldown, pruning, runtime/resources. |
| `test/fixtures/postgres.ts` | Disposable local PostgreSQL 17 fixture (loopback port, dedicated database, admin/writer/reader roles, fixture/admin clock functions, catalog constants, restart helper). |
| `test/helpers/phase10-worker.ts` | IPC child-process fixture used by the killed-child recovery tests (direct write contract only). |
| `test/integration/postgres.test.ts` | 58 native integration tests: migration/codec/roles/fencing/atomicity/outbox/HTTP-admission/retention/restart/kill-recovery suites (config `vitest.integration.config.ts`). |
| `test/postgres-config.test.ts` | 19 config/URL-namespace/scheduler tests. |
| `test/postgres-connection.test.ts` | 8 pool/connection-budget tests including admission retention after cancellation. |
| `test/scheduler-http.test.ts` | 31 authenticated-HTTP scheduler tests (rate limit, body discipline, disconnect, 420 s budget). |
| `test/scheduler-runner.test.ts` | 9 runner tests for the exact budget ladder and account-bound outcomes. |

## 3. Additions — documentation (6)

[phase10-report.md](phase10-report.md), [phase10-files.md](phase10-files.md) *(this file)*, [postgres-schema-reference.md](postgres-schema-reference.md), [postgres-operations.md](postgres-operations.md), [scheduler-endpoint-contract.md](scheduler-endpoint-contract.md), [phase10-test-evidence.md](phase10-test-evidence.md).

Final byte-bindings for all six are published in the external final record `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase10-validation-6OrEZX\validation-final.json` (written after the documents were finished; see [§6](#6-final-bindings)).

## 4. New tooling and test records (external, no repository impact)

Would-be-external command records live under `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase10-validation-6OrEZX`:

| Record | Content |
| --- | --- |
| `baseline.json` | Pre-implementation exclusive baseline: all 1,779 files bound (`with 64 SQLite database/sidecar` files, 7,806,976 bytes), Git-bound at index `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689`. |
| `phase10-allowed-modifications.json` | The six-file authorization exactly as [§1](#1-modified-originals-6-exactly-the-authorized-set). |
| `commands/<label>.{json,stdout.txt,stderr.txt}` | Every Phase 10 verification run ([inventory](phase10-test-evidence.md)). |
| `verification-*.json` | Preservation verifications; the final one indexes all documents. |
| `postgres-binaries-*/` | Hydrated native PostgreSQL 17 fixture binaries (external tooling only). |

## 5. Verification queue (fresh at next completion)

- Baseline snapshot comparison: expected **1,773 unchanged originals / 6 authorized modifications / 26 additions**; commit-index unchanged; SQLite bytes unchanged.
- Whitespace check for all untracked/new files (exclusive copied workspace, as in Phase 8/9 verification).
- Read-only secret scan and link checks across the six new documents.

Exact numbers are published from the final verifier record; any deviation is a stop condition. `phase9-audit.mjs` (Phase 9's verifier) was **not** rerun against the modified tree, as required.

## 6. Final bindings

Byte-level hashes of all six Phase 10 documents, the fresh preservation verdict, and the unchanged Git index are published by the external final record `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase10-validation-6OrEZX\validation-final.json`, written immediately after these documents were completed. Its `passed: true` result and matching document hashes are the Phase 10 handoff authority, exactly like the Phase 9 protocol.
