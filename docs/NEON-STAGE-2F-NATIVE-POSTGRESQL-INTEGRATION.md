# Neon Stage 2F — Native PostgreSQL 17 Integration

**Completed:** 2026-11-05  
**Scope:** disposable local PostgreSQL 17.11 integration only  
**Native implementation recommendation:** **GO**  
**Real Neon integration recommendation:** **NO-GO — remaining remote/security blockers apply**

## 1. Safety and preflight

Stage 2F used only the verified extracted binaries at:

`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\liquidation-watchdog-pg17\pgsql\bin`

`WATCHDOG_PG_TEST_BIN` was injected only into the native Vitest child process. It was not set in the OpenCode parent, user environment or machine environment.

Before cluster startup, inspection confirmed:

- all four required binaries existed and reported PostgreSQL 17.11;
- no PostgreSQL process existed;
- no PostgreSQL Windows service existed;
- the dedicated external TEMP fixture root contained no pre-existing fixture directory;
- a loopback-only ephemeral port could be allocated;
- fixture source uses `mkdtemp` under external TEMP;
- fixture network binding is exactly `127.0.0.1`;
- cleanup validates the exact fixture directory/data-child shape;
- process stop/status operations use the exact fixture `pg_ctl -D` path;
- no database URL or existing data directory is accepted.

No Neon credential or remote endpoint was used.

## 2. PostgreSQL binaries

| Binary | Path | Version |
| --- | --- | --- |
| `postgres.exe` | `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\liquidation-watchdog-pg17\pgsql\bin\postgres.exe` | `postgres (PostgreSQL) 17.11` |
| `initdb.exe` | `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\liquidation-watchdog-pg17\pgsql\bin\initdb.exe` | `initdb (PostgreSQL) 17.11` |
| `pg_ctl.exe` | `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\liquidation-watchdog-pg17\pgsql\bin\pg_ctl.exe` | `pg_ctl (PostgreSQL) 17.11` |
| `psql.exe` | `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\liquidation-watchdog-pg17\pgsql\bin\psql.exe` | `psql (PostgreSQL) 17.11` |

Archive and binary hashes remain recorded in the Stage 2E report. Stage 2F reran version commands but did not modify the extracted distribution.

## 3. Disposable cluster identity and lifecycle

### 3.1 Identity

The fixture created one private local cluster with:

- PostgreSQL 17.11;
- a unique `watchdog-phase10-pg-*` data root below the Stage 2F external TEMP directory;
- loopback host `127.0.0.1`;
- one dynamically allocated port;
- locale `C` and UTF-8;
- `max_connections=16`;
- `shared_buffers=16MB`;
- fixture superuser `watchdog_test_admin`;
- database `watchdog_phase10_fixture`;
- restricted roles `watchdog_test_writer` and `watchdog_test_reader`;
- PostgreSQL namespace identity `phase10-fixture`;
- no remote URL and no existing user database.

The random cluster port and unique data-directory suffix were intentionally not retained after successful cleanup.

### 3.2 Lifecycle

The fixture:

1. verified the server major;
2. initialized a unique local cluster;
3. started only that cluster on loopback;
4. created the fixture database and roles;
5. reset/applied the reviewed migrations and grants before each test;
6. exercised controlled restart, backend termination and killed-child recovery cases;
7. stopped the exact fixture server;
8. deleted only its validated temporary directory.

No Windows service was installed or registered.

## 4. Native integration command and result

Only this test file ran under the integration configuration:

`test/integration/postgres.test.ts`

The live-chain integration test was not selected.

Result:

| Metric | Result |
| --- | --- |
| Test files | **1/1 passed** |
| Native PostgreSQL tests | **60/60 passed** |
| Duration | 253.06 seconds |
| Exit status | 0 |
| Signal/error | None |
| Skipped native tests | None |

This is real PostgreSQL 17.11 evidence, not mocked PostgreSQL evidence.

## 5. Detailed native behavior coverage

### 5.1 Real connection and transaction handling

Passed with real server connections:

- writer `READ COMMITTED` transactions;
- reader `REPEATABLE READ READ ONLY` transactions;
- same checked-out client across begin/settings/callback/commit/rollback;
- transaction-local search path, UTC, durability and server timeouts;
- rollback after SQL failure and subsequent connection reuse;
- actual long-running statement timeout and connection reuse;
- real terminated idle backend followed by bounded reconnection;
- pool close and rejection after close.

### 5.2 Migration, schema and catalog

- exact two-migration lineage and checksums;
- complete 15-table schema;
- idempotent migration;
- checksum/gap/future-lineage refusal without repair;
- namespace mismatch refusal;
- complete production/test catalog fingerprint handling;
- domain, timestamp, generated-column, identity, constraint and index behavior.

### 5.3 Writer and reader role isolation

- writer runtime DML succeeds only on reviewed objects;
- reader projections succeed with true reader role;
- reader writes fail;
- writer DDL/control-table mutation fails;
- privileged/owner connections are refused as runtime roles;
- schema `CREATE`, reader table/column writes and sequence mutation drift are detected;
- writer credentials cannot be used as reader credentials.

### 5.4 JSON, hashes and exact numeric serialization

- original observation/state/assurance/alert JSON text round-trips exactly;
- SHA-256 bindings are verified;
- corrupted JSON hashes fail closed;
- canonical unsigned decimal text accepts valid 78-digit values and rejects noncanonical/out-of-range forms;
- six-digit UTC text is preserved exactly;
- exact bigint cursors beyond `Number.MAX_SAFE_INTEGER` remain strings;
- server-side read byte limits reject oversized pages.

### 5.5 Atomic observation and progression persistence

- cycle observation, stream revision/state, assurance, fingerprints, alerts and outbox commit atomically;
- backlog overflow rolls back all observation/state/assurance/alert/outbox effects;
- competing state transitions serialize and cannot duplicate alert channels;
- lost observation COMMIT acknowledgment reconciles through exact observation/state hashes without replay;
- the complete current observation/state JSON—including Phase 12C progression evidence and same-block baseline fields—round-trips through native PostgreSQL unchanged;
- `actionable:false`, oracle `UNVERIFIED`, freshness `UNKNOWN` and absent blocked recovery amounts remain intact.

### 5.6 Scheduler leases and fencing

- two concurrent admissions produce one owner and one in-progress result;
- unique slot/cycle identity prevents duplicate observations;
- database time enforces slot boundaries despite host-clock skew;
- missed-slot accounting does not invent catch-up observations;
- high-water slot blocks replay after receipt pruning and clock rollback;
- expired owners are superseded by monotonically increasing fences;
- old owners cannot read/write/release after takeover or incarnation rotation;
- job/lease deadlines reject expired work;
- durable terminal receipts bind slot, cycle, status, acceptance and completion.

### 5.7 Restart and process-death recovery

- immediate PostgreSQL server restart preserves database identity, observation state and receipt;
- killed mid-read worker becomes a durable interrupted execution;
- killed in-flight send recovers with sticky ambiguity and no duplicate attempt number;
- queued persistence cancellation leaves the in-flight owner transaction intact;
- already-aborted capabilities cannot enter the database.

### 5.8 Unknown-COMMIT reconciliation

- lost observation COMMIT acknowledgment resolves by immutable payload hashes;
- lost admission acknowledgment never grants execution and resolves to durable identity;
- lost delivery acknowledgment reconciles the committed attempt without resend;
- no tested unknown outcome is blindly replayed.

### 5.9 Read models, thresholds, recovery eligibility and readiness

- coherent reader snapshots across uncommitted writer changes;
- alerts/observations/deliveries paginate with exact exclusive cursors;
- custom threshold streams remain isolated from default threshold streams;
- stale observations retain exact risk fields but readiness remains 503;
- reader projections omit credentials, owner/fence/incarnation and internal configuration;
- persisted observations retain fail-closed recovery eligibility and progression state;
- readiness remains separated into retrieval age, block age, progression, oracle assurance and oracle freshness.

### 5.10 Rollback, retention and failure handling

- failed SQL rolls back and leaves the connection reusable;
- database constraints reject duplicate/orphan/out-of-range/actionable data;
- retention deletes only terminal unprotected history;
- fingerprints, stream bindings and pending deliveries remain protected;
- resource admission and backlog bounds fail closed;
- cancellation and shutdown release/discard exact clients safely.

## 6. Additional local verification

Full non-integration unit suite after native testing:

| Check | Result |
| --- | --- |
| Unit test files | **45/45 passed** |
| Unit tests | **933/933 passed** |
| TypeScript `--noEmit` | PASS |
| Full ESLint | PASS |
| Production build | PASS |

The unit total includes the new Stage 2E adversarial cleanup coverage. Unit and mocked results are reported separately from the 60 native tests.

## 7. Post-run cleanup verification

After the native test process exited:

- no `postgres.exe`, `pg_ctl.exe`, `initdb.exe` or `psql.exe` process existed;
- no PostgreSQL/pgsql Windows service existed;
- the dedicated Stage 2F fixture root contained no `watchdog-phase10-pg-*` directory and was otherwise empty;
- no user/machine/current-parent `WATCHDOG_PG_TEST_BIN` remained;
- no unrelated PostgreSQL process existed before the run, so none could have been stopped;
- the extracted PostgreSQL distribution remained unchanged and no cluster data remained.

Cleanup outcome is certain and complete. No retained fixture directory requires manual handling.

## 8. Failures and skipped work

- Native PostgreSQL tests: no failures, no skipped tests.
- Full unit suite: no failures.
- One expected Node experimental SQLite warning appeared in the native test process; it did not affect PostgreSQL results.
- `test/integration/live.test.ts` was intentionally not run by authorization.
- No Neon/remote test, migration, scheduler deployment or external notification ran.

## 9. Recommendation

### Local PostgreSQL implementation

**GO.** The reviewed PostgreSQL adapter, schema, transactions, role isolation, persistence, progression, scheduler fencing, recovery and read models pass the complete native PostgreSQL 17.11 integration suite.

### Real Neon application integration

**NO-GO.** Native success does not remove these blockers:

1. `watchdog_reader` Neon credentials remain unavailable/unverified.
2. A4.5 independent migration authority, credential custody and one-use attempt controls remain NO-GO.
3. The Neon child branch remains schema-empty and ungranted.
4. No authorized Neon observation write/read/restart integration has occurred.
5. TEMP policy, backup/restore, Free-plan capacity and operational monitoring remain unresolved.

Do not start Stage 3 until reader and migration-security/provisioning gates are separately resolved and approved.
