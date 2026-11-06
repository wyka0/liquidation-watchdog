# Neon Stage 2A — PostgreSQL Application Integration Preparation

**Completed:** 2026-11-05  
**Scope:** local application integration and testing only  
**Neon target context:** `liquidation-watchdog-pg17` / `a4-migration-test` / PostgreSQL 17.11 / `aws-us-east-2`  
**Recommendation:** **NO-GO for a real Neon application integration test**

## 1. Executive assessment

The PostgreSQL implementation is structurally compatible with the reviewed PostgreSQL 17 schema and preserves the monitoring, oracle-assurance, recovery-eligibility and progression safety contracts. The Stage 1C pooled fix remains locally verified, and Stage 1D proved direct and pooled writer transport with TLS 1.3 and `SCRAM-SHA-256-PLUS`.

No source or schema incompatibility requiring a new migration was found during Stage 2A. In particular, Phase 12C progression is stored inside the existing validated observation/state JSON and does not require an additional SQL column or migration.

A real Neon application integration test remains blocked because:

1. the reader credential is not verified;
2. the required `watchdog_pg` schema and runtime grants are absent;
3. A4.5 migration security remains NO-GO;
4. native PostgreSQL 17 integration tests could not be rerun on this host because the fixture binaries are unavailable;
5. remote persistence would require database writes and is not authorized by Stage 2A.

The application has no supported production writer-only mode. It must not silently substitute the writer for the reader.

## 2. Verified infrastructure boundary

Stage 2A relies on, but does not extend, these prior read-only facts:

- project `liquidation-watchdog-pg17`;
- child branch `a4-migration-test`, parent `production`;
- PostgreSQL 17.11 in Ohio / `aws-us-east-2`;
- direct and pooled `watchdog_writer` transport passed;
- authorized TLS 1.3 and `SCRAM-SHA-256-PLUS` passed;
- reader is **NOT VERIFIED**;
- `watchdog_pg` is absent;
- no application table or migration record exists on the branch.

Stage 2A made no Neon API or database connection. No remote persistence claim is made.

## 3. Source inventory

### 3.1 Inspected application source

Configuration and entrypoints:

- `src/config/postgres.ts`
- `src/config/runtime.ts`
- `src/config/monitoring.ts`
- `src/config/risk.ts`
- `src/postgres-service.ts`
- `src/runtime/postgres-runtime.ts`

PostgreSQL implementation:

- `src/storage/persistence.ts`
- `src/storage/postgres/connection.ts`
- `src/storage/postgres/codec.ts`
- `src/storage/postgres/catalog.ts`
- `src/storage/postgres/migrations.ts`
- `src/storage/postgres/database.ts`
- `src/storage/postgres/scheduler-store.ts`
- `src/storage/postgres/store.ts`

Monitoring and safety integration:

- `src/monitoring/model.ts`
- `src/monitoring/observation.ts`
- `src/monitoring/service.ts`
- `src/monitoring/transitions.ts`
- `src/chain/progression.ts`
- `src/risk/assured.ts`
- `src/risk/eligibility.ts`
- `src/risk/recovery.ts`
- oracle-assurance schemas/evaluation used by persisted observations

Runtime APIs and scheduling:

- `src/runtime/read-model.ts`
- `src/runtime/auth.ts`
- `src/runtime/http.ts`
- `src/runtime/scheduler.ts`
- `src/runtime/scheduler-contract.ts`

Relevant PostgreSQL, persistence, progression, recovery, runtime and scheduler tests were also inspected.

### 3.2 Files changed in Stage 2A

No application source, test, migration, configuration or generated build file was changed.

Added only:

- `docs/NEON-STAGE-2A-APPLICATION-INTEGRATION.md`

## 4. Architecture findings

### 4.1 Configuration and pool initialization

- PostgreSQL is selected only when `WATCHDOG_STORAGE_BACKEND=postgres`.
- Writer and reader URLs are mandatory, must use distinct usernames and must target the same host, port and database.
- TLS certificate verification cannot be disabled; URL TLS file injection and arbitrary URL options are rejected.
- Conventional pooled hosts omit only startup `options`; direct connections retain startup `search_path=pg_catalog`.
- Pools are lazy: constructing or starting `PostgresRuntime` does not connect to PostgreSQL.
- Each role has `max=1`, `min=0`, a bounded queue, five-second connect/idle/close limits and a 60-second maximum connection lifetime.
- Driver parsers preserve `int8`, `numeric`, timestamp and timestamptz values as strings rather than coercing them to unsafe JavaScript numbers or millisecond `Date` values.

Important consequence: runtime startup and `/api/health` can succeed before schema/role/database verification. Actual reads or scheduled work fail closed when they first use their pool. `/api/readiness` requires a reader query and therefore cannot pass with the current unverified reader.

### 4.2 Transaction handling and cleanup

- Every operation checks out one client and uses it from `BEGIN` through `COMMIT`/`ROLLBACK`.
- Writer transactions use `READ COMMITTED`; reader snapshots use `REPEATABLE READ READ ONLY`.
- Transaction-local settings establish `search_path=pg_catalog`, UTC, `synchronous_commit=on`, lock/statement timeouts and idle-in-transaction timeout before callback SQL.
- Callbacks cannot run after cancellation or client discard.
- Failed operations roll back; transient acquisition failures retry at most twice with bounded jitter.
- A lost COMMIT acknowledgment is `POSTGRES_COMMIT_UNKNOWN`, never an assumed rollback or blind replay.
- Pool shutdown, cancellation and connection/client errors are bounded and sanitized.

### 4.3 JSON serialization and progression persistence

- Observations, monitor state, alerts, oracle assurance and runtime status are validated by strict Zod schemas before encoding.
- JSON is stored as exact UTF-8 text, size-bounded and accompanied by SHA-256 where the schema requires it.
- Reads verify hashes before JSON parsing and schema validation.
- `progression` is an optional strict object on `observationSchema`; historical rows without it remain readable.
- New observations persist progression inside `observation_json`, `state_json` and alert observation payloads.
- Exact progression block/head/baseline numbers are decimal strings. No SQL or JavaScript floating-point conversion occurs.
- The existing `object_text` domain and JSON column limits already cover progression; no migration is required.

### 4.4 BigInt and cursor safety

- Financial values, block numbers and ratios remain canonical unsigned decimal text up to 78 digits.
- Operational `bigint` and identity values are returned as strings.
- `counter()` converts only canonical values no greater than `Number.MAX_SAFE_INTEGER`.
- Pagination cursors remain exact decimal strings bounded by PostgreSQL `int8` maximum.
- No financial amount passes through PostgreSQL floating types or JavaScript `Number`.

### 4.5 Atomic observation persistence

`PostgresMonitorStore.commitObservation()` runs in one globally fenced writer transaction and atomically:

1. reloads and validates the expected stream revision;
2. updates the admitted running cycle with exact observation JSON/hash and scalar projections;
3. compare-and-set upserts stream state JSON/hash, latest cycle and last accepted cycle;
4. inserts oracle assurance when present;
5. checks pending outbox capacity;
6. inserts deduplication fingerprints, alerts, deliveries and delivery events.

Any error rolls back all these effects. A rejected observation is forbidden from replacing `lastAccepted`. Progression and its accepted baseline therefore commit atomically with the observation/state that produced them.

Cycle completion is deliberately a later transaction. A crash after observation commit leaves a `PERSISTED` cycle that restart recovery can finish without recomputing or duplicating the observation.

### 4.6 Restart recovery

- Monitoring initialization scans bounded unfinished cycles.
- A prior `RUNNING` cycle receives a fail-closed interrupted observation through normal transition/persistence logic.
- A prior `PERSISTED` cycle is finished without recalculation.
- Outbox recovery changes only stale/foreign in-flight claims and preserves ambiguity.
- Stable fingerprints prevent duplicate alerts across restart.
- Unknown observation COMMIT outcomes are reconciled through observation/state hashes rather than replayed.

SQLite restart tests and mocked asynchronous lifecycle tests pass. Native PostgreSQL process-kill/restart tests exist but were not rerun in Stage 2A because local PostgreSQL binaries are unavailable.

### 4.7 Scheduler locking and leases

- Runtime scheduling is externally invoked and disabled by default.
- Ownership is a singleton table-backed `worker_lease`, not a session lock.
- Admission locks the lease row, uses database time, increments a fence, binds database incarnation and persists the high-water slot, scheduled execution and cycle atomically.
- Every monitor mutation validates owner/fence/incarnation/expiry before and after work.
- Old owners cannot release or write after takeover.
- Durable execution receipts prevent duplicate slot execution; late receipt lookup grants no execution permission.
- The migration advisory lock is transaction-scoped and used only by the explicit maintenance migration API, never by runtime scheduling.

This design is compatible with transaction pooling; it does not depend on a persistent PgBouncer session.

### 4.8 Thresholds, progression and recovery eligibility

- Thresholds resolve once at PostgreSQL entrypoint startup from the explicit threshold path or reviewed defaults and are revalidated before any pool/listener work.
- Monitoring scope binds chain, market, account and authored threshold decimals.
- Progression is computed before assured risk and is passed into the Phase 12B eligibility gate.
- Missing, unchanged, stalled, regressed or conflicting progression blocks recovery estimates.
- Even `ADVANCING` progression is insufficient unless oracle assurance, assurance gate, freshness, independent validation, configuration and identity all independently pass.
- Blocked estimates are `null`; `actionable` remains structurally `false` in risk, observations, APIs and persisted recovery amounts.
- PostgreSQL integration does not weaken oracle `UNVERIFIED`, freshness `UNKNOWN`, 600-second readiness age, block-age or progression readiness checks.

### 4.9 Read model and authorization

- All dashboard/status/risk/history reads use the reader pool through `PostgresDatabase.readSnapshot()`.
- Each read verifies schema fingerprint and reader-role restrictions before selecting application rows.
- Multi-query responses use one coherent repeatable-read/read-only transaction.
- Server-side windowing bounds history JSON bytes before transport; application parsing enforces a total 1 MiB page budget.
- Read API projections omit internal configuration, evidence graphs, owner/fence identities and credentials.
- Read HTTP authorization uses a separately supplied credential and constant-time digest comparison.
- Scheduler authentication is a distinct bearer secret; reuse of the read credential is rejected.

## 5. PostgreSQL compatibility matrix

| Area | Implementation status | Local evidence | Remote status |
| --- | --- | --- | --- |
| Direct writer configuration | Compatible | Config/connection tests pass | Writer transport passed in Stage 1D; no Stage 2A DB use |
| Pooled writer configuration | Compatible after Stage 1C fix | Direct/pooler focused tests pass | Writer transport passed in Stage 1D; no persistence test |
| Reader connection | Architecturally required | Reader transaction/role mocks pass | **NOT VERIFIED** |
| Pool bounds/timeouts | Compatible | Connection admission, timeout, close and cancellation tests pass | No load/cold-start qualification |
| Transaction semantics | Compatible | Same-client begin/settings/commit/rollback tests pass | Read-only writer transport only |
| PostgreSQL 17 syntax/features | Static compatibility found | Migration source and prior native suite exist | Schema absent; not exercised remotely |
| Migration lineage | Two exact checksummed migrations | Checksum/catalog unit tests pass | Not applied; A4.5 NO-GO |
| Schema/catalog fingerprint | Exact reviewed fingerprint | Catalog tests pass | Schema absent |
| JSON text/hash persistence | Compatible | Schema, codec, persistence tests pass | Not remotely persisted |
| BigInt/decimal safety | Compatible | Codec, risk and pagination tests pass | Not remotely persisted |
| Observation/state atomicity | Compatible by code/tests | SQLite atomicity plus PostgreSQL native test source; native rerun unavailable | Not remotely tested |
| Progression persistence | No schema change required | Progression lifecycle/restart tests pass | Not remotely persisted |
| Recovery eligibility | Fail-closed | Adversarial eligibility suite passes | Not remotely persisted |
| Scheduler lease/fencing | Compatible by design/tests | Scheduler unit tests pass; native rerun unavailable | Not remotely exercised |
| Restart/unknown COMMIT recovery | Implemented | Mock/SQLite tests pass; native suite source covers server restart/process kill | Not remotely tested |
| Reader API snapshots | Requires reader role | Read-model/runtime tests pass | Blocked by reader credential and absent schema |
| HTTP/read authorization | Compatible | Runtime HTTP/auth suites pass | Not deployed |
| Error sanitization/cleanup | Compatible | Driver/runtime failure tests pass | Writer clean shutdown passed Stage 1D |
| `actionable:false` safety | Preserved | Risk, monitoring, read-model and full suites pass | No deployment |

No schema-change incompatibility was identified. This does not substitute for a current native PostgreSQL integration run or post-provision Neon verification.

## 6. Schema and migration compatibility

### 6.1 Required catalog

- schema: `watchdog_pg`;
- migration versions: 1 and 2;
- migration checksums:
  - `7d682b2267b9d35d0a6ed01511dc0342a3ef801051e0ee0fdf8f0c60a09b015d`
  - `7b8aa97bf0a386081b79bd5d6eb36c57af91d5c40cd3498302dd4615d4a9eb75`
- production catalog fingerprint:
  `24b4fea1efeab7c49999dd693f59ddc9aa776bcb4d4e262185978c9630c80ba3`;
- backend identity: `liquidation-watchdog-pg`;
- configured namespace must match `database_identity.namespace`;
- reviewed A4 namespace: `watchdog_free`.

### 6.2 Objects

Seven domains:

`identifier`, `digest`, `uint_text`, `utc_text`, `object_text`, `delivery_status`, `channel`.

Two SQL functions:

`utc_value(text)` and `clock_now()`.

Fifteen tables:

`schema_migrations`, `cycles`, `streams`, `fingerprints`, `alerts`, `deliveries`, `delivery_attempts`, `delivery_events`, `provider_limits`, `oracle_assurance`, `worker_runtime`, `operational_events`, `database_identity`, `worker_lease`, `scheduled_executions`.

Six identity sequences are generated for cycle/alert/delivery/assurance stable order and event IDs.

Fifteen explicit indexes:

`cycles_scope_time`, `cycles_history`, `cycles_unfinished`, `cycles_retention`, `alerts_history`, `alerts_time`, `alerts_cycle`, `deliveries_due`, `deliveries_alert`, `delivery_events_delivery`, `assurance_context_time`, `assurance_time`, `streams_latest_cycle`, `streams_accepted_cycle`, `executions_slot`.

Primary/unique constraints additionally create the required backing indexes. Foreign keys, generated timestamp projections, domain checks, payload-size checks, owner/claim consistency, false-only actionability, identity incarnation and deferrable lease/execution links match every inspected query.

### 6.3 Search path and PostgreSQL 17

- All application relations/functions are explicitly schema-qualified.
- Direct connections retain startup `search_path=pg_catalog`.
- Pooled connections omit the incompatible startup option but set `pg_catalog` transaction-locally before callback SQL.
- Functions pin `search_path=pg_catalog`; `utc_value` also pins UTC.
- Required domains, generated stored columns, identity, partial indexes, deferrable foreign keys, `ON CONFLICT`, `RETURNING`, row locks, core SHA-256 and JSON functions are available in PostgreSQL 17.
- No non-core extension is required.

### 6.4 Grant boundary

Migrations create schema objects under a separate maintenance owner and do **not** grant runtime privileges. This is intentional: grants require a separately approved provisioning step.

Writer requires `CONNECT`, schema `USAGE`, `SELECT` on all application tables, DML on runtime-mutated tables, `UPDATE` only on `worker_lease`, sequence `USAGE` and function `EXECUTE`; it must have no control-table writes, schema `CREATE`, ownership, `TRUNCATE`, `REFERENCES`, `TRIGGER` or sequence `UPDATE`.

Reader requires `CONNECT`, schema `USAGE`, `SELECT` on all application tables and required function `EXECUTE`; it must have no write, ownership, sequence mutation or schema-creation privilege.

`verifyRole()` is primarily a deny-list/elevation check. Missing required grants surface when operations execute, so post-provision qualification must explicitly test the full positive grant matrix before runtime use.

## 7. Query-to-schema and privilege mapping

| Repository / operation | Objects and functions | Required role/privileges |
| --- | --- | --- |
| `verifyPostgresSchema` | `schema_migrations`, `database_identity`, all `watchdog_pg` catalog objects | Writer and reader: table/catalog `SELECT`, schema `USAGE` |
| `postgresCatalogFingerprint` | `pg_class`, `pg_attribute`, `pg_constraint`, `pg_index`, `pg_type`, `pg_proc`, `pg_sequence`, triggers/rules for `watchdog_pg` | Both: catalog read visibility |
| `verifyRole` | `pg_roles`, `pg_class`, `pg_proc`, `pg_namespace`, control-table privilege checks | Both: catalog/ACL inspection |
| `loadState` | `streams` | Writer path: `SELECT`; reader snapshot: `SELECT` |
| `loadAssurance` | `oracle_assurance` | Writer path: `SELECT`; reader as applicable: `SELECT` |
| `assertFence` | `worker_lease`, `database_identity`, `clock_now()`, row lock | Writer: `SELECT`, `UPDATE` on lease, function `EXECUTE` |
| `readSnapshot` base | `streams`, `worker_runtime`, `cycles` | Reader: `SELECT` |
| `readSnapshot` observations | `cycles`, generated/identity ordering | Reader: `SELECT` |
| `readSnapshot` alerts | `alerts`, `deliveries` | Reader: `SELECT` |
| Scheduler `admit` | schema/role verification, `worker_lease`, `scheduled_executions`, `cycles`, `clock_now()` | Writer: `SELECT`; lease `UPDATE`; execution/cycle `INSERT`; execution `UPDATE`; sequence `USAGE`; function `EXECUTE` |
| Scheduler `lookup` | schema/role verification, `scheduled_executions` | Writer: `SELECT` |
| Scheduler `finish` | `worker_lease`, `database_identity`, `cycles`, `scheduled_executions`, `clock_now()` | Writer: `SELECT`, execution/lease `UPDATE` |
| Monitor `acquireMonitor` | fence tables via `assertFence` | Writer only |
| `beginCycle` / unfinished recovery | `cycles` | Writer: `SELECT` (cycle is inserted during scheduler admission) |
| `commitObservation` cycle | `cycles` | Writer: `SELECT`, `UPDATE` |
| `commitObservation` state | `streams` | Writer: `SELECT`, `INSERT`, `UPDATE` |
| `commitObservation` assurance | `oracle_assurance` | Writer: `SELECT`, `INSERT`, sequence `USAGE` |
| `commitObservation` alert/outbox | `fingerprints`, `alerts`, `deliveries`, `delivery_events` | Writer: `SELECT`, `INSERT`, sequence `USAGE` |
| Unknown observation COMMIT reconciliation | `cycles`, `streams`, `alerts` | Writer: `SELECT` |
| `finishCycle` | `cycles`, `utc_value()` | Writer: `UPDATE`, function `EXECUTE` |
| Delivery due/next/alert | `deliveries`, `alerts`, `provider_limits` | Writer: `SELECT` |
| Attempt claim | `deliveries`, `worker_lease`, `provider_limits`, `delivery_attempts`, `delivery_events` | Writer: delivery `UPDATE`; attempt/event `INSERT`; related `SELECT` |
| Attempt completion | `deliveries`, `delivery_attempts`, `provider_limits`, `delivery_events`, `clock_now()` | Writer: `SELECT`, `INSERT`, `UPDATE`, function `EXECUTE` |
| Delivery recovery/exhaustion | `deliveries`, `delivery_attempts`, `delivery_events` | Writer: `SELECT`, `UPDATE`, event `INSERT` |
| Retention prune | `alerts`, `deliveries`, `cycles`, `streams`, `scheduled_executions`, `worker_lease`, `oracle_assurance` | Writer: related `SELECT`; alert/cycle/assurance `DELETE` |
| Runtime status/events | `worker_runtime`, `operational_events` | Writer: runtime `INSERT/UPDATE`; events `INSERT/DELETE`; sequence `USAGE` |
| Resource admission | `pg_database_size`, `deliveries` | Writer: function/catalog access and delivery `SELECT` |
| Explicit migration only | advisory lock, schema, migration table, all domains/functions/tables/indexes, identity/lease seed | Separate maintenance owner; DDL/DML authority, never runtime roles |

All application data values are parameterized. Dynamic SQL is restricted to reviewed fixed query fragments; no request-supplied table or column name reaches SQL.

## 8. Writer, reader and combined dependencies

### Writer-only operations

- scheduler admission, lookup and completion;
- fenced monitoring lifecycle and restart recovery;
- observation/state/progression/assurance persistence;
- alert/outbox claim, acknowledgment, recovery and retention;
- runtime status and resource admission.

### Reader-only operations

- `/api/readiness` database projection;
- monitoring status, positions, risk, observations and alerts APIs;
- coherent history pagination and delivery projections.

`/api/health` does not query PostgreSQL, but it is not a database-readiness proof.

### Operations requiring both roles at product level

- a complete PostgreSQL runtime process constructs both pools;
- safe deployment requires writer persistence plus independent reader-backed readiness/observability;
- production acceptance requires both role policies and all grants to pass against the same schema/namespace/database.

### Writer-only development mode

There is no supported configuration that omits the reader URL or substitutes writer credentials for reader access. `postgresConfiguration()` requires distinct users and `PostgresDatabase.readSnapshot()` always uses the reader pool.

Safe restricted uses of a verified writer are limited to:

- read-only connection/catalog qualification;
- local repository/scheduler tests using disposable fixtures or mocks;
- a future separately approved write integration test on the child branch after schema/grants exist.

A scheduler/monitor job is internally writer-backed, but running it without reader readiness would leave the dashboard/readiness path unavailable and is not a safe product operating mode. Supplying a writer URL as the reader is explicitly rejected and must not be introduced as a bypass.

## 9. Test results

### 9.1 Local fixture and mocked tests executed

Focused Stage 2A suites:

- PostgreSQL configuration and driver behavior;
- monitoring storage/service/transitions;
- progression lifecycle and persistence;
- recovery eligibility;
- runtime read model and lifecycle;
- scheduler runner and HTTP contract.

Result: **11 files, 287/287 tests passed**.

Full non-integration unit suite:

**44 files, 922/922 tests passed**.

Static/build checks:

- TypeScript `--noEmit`: PASS
- Full ESLint: PASS
- Production build: PASS

These tests use mocks, SQLite fixtures and deterministic application fixtures. They do not prove Neon persistence.

### 9.2 Native PostgreSQL integration

`test/integration/postgres.test.ts` exists and covers:

- migration/catalog/role contracts;
- exact text, UTC and BigInt round trips;
- global lease/fence concurrency;
- atomic observation/alert/outbox persistence;
- unknown COMMIT reconciliation;
- reader snapshots and pagination;
- progression as part of observation JSON;
- role/grant drift rejection;
- restart and killed-process recovery.

It requires `WATCHDOG_PG_TEST_BIN` pointing to native PostgreSQL 17 executables. During Stage 2A:

- `WATCHDOG_PG_TEST_BIN` was absent;
- `postgres.exe`, `initdb.exe`, `pg_ctl.exe` and `psql.exe` were not found.

Therefore the native integration suite was **NOT RUN**, not silently counted as passing. No software was installed.

### 9.3 Actual remote Neon tests

No Stage 2A remote test ran. Stage 1D writer transport evidence remains connection-only and read-only. No remote migration, grant, schema verification, application read, observation write, restart or lease test has occurred.

## 10. Product readiness

The application cannot safely operate as a Neon-backed product with the current infrastructure state:

- verified writer transport alone cannot satisfy the runtime's reader dependency;
- the reader remains unverified;
- the schema/identity/lease/grants are absent;
- startup is lazy and does not itself prove database readiness;
- no remote persistence or recovery behavior is qualified.

Safety behavior remains correct while blocked:

- no fallback database or writer-as-reader substitution;
- no manufactured progression or freshness;
- recovery estimates remain absent unless every strict gate passes;
- oracle assurance remains `UNVERIFIED` and freshness `UNKNOWN` in production evidence;
- `actionable:false` remains structural.

## 11. Minimum blockers before a real Neon integration test

1. Correct and qualify direct/pooled `watchdog_reader` credentials without using writer credentials.
2. Resolve A4.5 migration execution authority, credential custody and one-use attempt controls.
3. Obtain separate authorization to apply the exact existing migrations to `a4-migration-test` through the direct maintenance endpoint.
4. Apply and independently audit only the exact writer/reader grants after schema creation.
5. Verify migration checksums, namespace/database identity, PostgreSQL major and complete catalog fingerprint.
6. Re-run the native PostgreSQL 17 integration suite against current source.
7. Perform a separately approved, bounded child-branch integration test that is allowed to write synthetic observations and then verify atomicity/restart/read-model behavior. Stage 2A does not authorize it.
8. Resolve TEMP policy, backup/restore, resource/quota and operational monitoring acceptance before deployment.

## 12. Recommended Stage 2B scope

Stage 2B should not begin until blockers 1-5 above are satisfied and explicitly approved. Its narrow scope should be:

1. **Post-provision read-only preflight:** verify child-branch identity, schema checksum/fingerprint, database identity/namespace and exact grants with scheduler disabled.
2. **Current native qualification:** run the full PostgreSQL 17 integration suite using approved local disposable binaries.
3. **Synthetic child-branch write test under separate approval:** use no live chain or notifications; admit one deterministic test slot, persist deterministic fixture observations including progression, verify hashes/state/alerts atomically, read through the true reader role, restart/reconcile, then retain evidence. Do not use production branch data.
4. **Failure qualification:** cancellation, unknown COMMIT, stale fence, pooler reconnect, read budget and cleanup.
5. **Post-test read-only inventory:** prove exact expected rows, no schema drift and no active lease/claim.

Stage 2B must remain scheduler-disabled outside the explicitly invoked test and must not deploy or send external notifications.

## 13. Recommendation

**Local application compatibility: CONDITIONAL GO.** Static analysis and all available local/mocked suites show that the current application and reviewed migration lineage are internally compatible, including Phase 12 progression and recovery gates.

**Real Neon application integration: NO-GO.** Reader, schema, grants, migration authority, current native integration and authorized remote persistence testing remain blockers.

Stage 2B is not authorized or started.
