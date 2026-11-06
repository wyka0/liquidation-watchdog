# Neon PostgreSQL Qualification — Stage 1

**Qualification date:** 2026-11-05  
**Project:** `liquidation-watchdog-pg17`  
**Authorized target:** child branch `a4-migration-test` only  
**Recommendation:** **NO-GO for application integration**

## 1. Scope and safety boundary

This stage inspected the existing application implementation and performed bounded, non-mutating checks against the existing Neon child branch. It did **not** run migrations, create schema objects, alter grants or roles, change passwords, activate the scheduler, deploy the application, send notifications, or write application data.

Remote SQL was limited to explicit `REPEATABLE READ READ ONLY` transactions and catalog/data-count `SELECT` statements. Neon management API access used authenticated `GET` requests only. The parent branch was not connected to or modified. Credentials remained in the external local file and are not reproduced in this report or any repository file.

## 2. Executive result

The Neon metadata target is correct, PostgreSQL 17.11 is compatible with the application's required major, and the direct writer endpoint successfully negotiated certificate-authorized TLS 1.3. Both database roles have appropriately hardened role attributes in the catalog.

Application integration is nevertheless **not ready**:

1. The `watchdog_pg` schema and both application migrations are completely absent, as expected for an untouched Stage 1 branch. Startup would fail schema verification; no migration was run.
2. `watchdog_reader` authentication fails with PostgreSQL code `28P01` on both direct and pooled endpoints. Its catalog definition exists, but its supplied credentials were not usable.
3. The exact application connection configuration is incompatible with the Neon pooled endpoint. The pooled writer succeeds with verified TLS when no startup `options` parameter is supplied, but the application-required `options=-c search_path=pg_catalog` startup parameter is rejected by the pooler with `08P01`.
4. Required schema/table/sequence/function grants cannot yet exist because the application schema is absent.
5. Both roles currently inherit `TEMP` on `neondb`. The application does not require temporary-object privileges; this is an unnecessary effective privilege that should be reviewed rather than silently changed.

## 3. Target identity and connectivity

### 3.1 Neon metadata verification

Authenticated read-only Neon API metadata checks passed:

| Check | Result |
| --- | --- |
| Project name | `liquidation-watchdog-pg17` — PASS |
| PostgreSQL major | 17 — PASS |
| Region | `aws-us-east-2` (Ohio) — PASS |
| Branch | `a4-migration-test` — PASS |
| Parent branch | `production` — PASS |
| Endpoint belongs to child branch | PASS |
| Direct endpoint hostname matches branch endpoint | PASS |
| Direct and pooled URLs identify the same endpoint | PASS |

Project, branch, parent and endpoint identifiers were compared in memory. Full identifiers and hostnames are intentionally omitted from this report.

### 3.2 TLS and endpoint behavior

All supplied URLs passed local structural validation before connection:

- database `neondb`;
- port 5432;
- Ohio Neon hostname suffix;
- `sslmode=verify-full` exactly once;
- `channel_binding=require` exactly once;
- direct host without `-pooler` and matching pooled host with `-pooler`;
- exact role names `watchdog_writer` and `watchdog_reader`.

Observed results:

| Endpoint / role | Result | TLS / database evidence |
| --- | --- | --- |
| Direct / `watchdog_writer` | PASS | Authorized TLS 1.3, no certificate authorization error, PostgreSQL `17.11 (9045acd)`, database `neondb`, role binding correct, read-only transaction confirmed. |
| Direct / `watchdog_reader` | FAIL | Authentication failed before inspection with `28P01`. TLS/SQL role behavior therefore remains unqualified through the reader credential. |
| Pooled / `watchdog_writer`, exact application configuration | FAIL | `08P01` during connection startup. |
| Pooled / `watchdog_writer`, diagnostic without startup `options` | PASS | Authorized TLS 1.3 and a `BEGIN READ ONLY` / `SELECT` / `ROLLBACK` sequence succeeded. This diagnostic proves the endpoint and credentials work; it does not qualify the current application configuration. |
| Pooled / `watchdog_reader` | FAIL | Authentication failed with `28P01`. |

One bounded direct application connection completed in approximately 2.24 seconds. The pooled diagnostic without startup `options` completed in approximately 2.24 seconds. The exact pooled application attempt failed in approximately 2.15 seconds. These are qualification samples, not latency guarantees.

### 3.3 Pool and timeout configuration

The application statically configures one lazy pool per role:

| Setting | Application value |
| --- | --- |
| Maximum connections | 1 writer + 1 reader |
| Minimum connections | 0 |
| Bounded queued work | 3 waiters per role; excess refused |
| Connection timeout | 5,000 ms |
| Idle timeout | 5,000 ms |
| Connection lifetime | 60 seconds |
| Client query timeout | 6,000 ms |
| Writer transaction timeout | 10,000 ms |
| Reader transaction timeout | 4,000 ms |
| Writer statement timeout | 5,000 ms |
| Reader statement timeout | 1,000 ms |
| Lock timeout | 1,000 ms |
| Idle-in-transaction timeout | 5,000 ms |
| Keepalive | Disabled |
| `synchronous_commit` | Transaction-local `on` |

The capacity limits are suitable for Neon Free in principle. The pooled startup incompatibility must be resolved and requalified before pooled deployment.

## 4. Role qualification

### 4.1 Role attributes

Both roles were visible through PostgreSQL catalogs:

| Attribute | `watchdog_writer` | `watchdog_reader` | Required |
| --- | ---: | ---: | ---: |
| LOGIN | Yes | Yes | Yes |
| INHERIT | No | No | No (`NOINHERIT`) |
| SUPERUSER | No | No | No |
| CREATEDB | No | No | No |
| CREATEROLE | No | No | No |
| REPLICATION | No | No | No |
| BYPASSRLS | No | No | No |
| Role memberships | None | None | None |
| Owned user schemas/relations/functions | None | None | None |
| Database CONNECT | Yes | Yes | Yes |
| Database CREATE | No | No | No |
| Database TEMP | Yes | Yes | Not required; review/revoke separately if approved |
| `public` USAGE | Yes | Yes | Not used by the application, but not an elevation |
| `public` CREATE | No | No | No |

The reader's attributes were inspected from PostgreSQL catalogs through the authenticated writer. This does not replace a successful reader login; reader authentication remains a blocker.

### 4.2 Exact runtime privileges required after schema creation

The migration/schema owner must remain separate from both runtime roles. Neither runtime role may own application objects or be a member of the owning role.

#### `watchdog_writer`

Required:

- `CONNECT` on `neondb`.
- `USAGE` on schema `watchdog_pg`; no schema `CREATE`.
- `SELECT` on all 15 application tables.
- `INSERT, UPDATE, DELETE` on:
  - `streams`
  - `cycles`
  - `fingerprints`
  - `alerts`
  - `deliveries`
  - `delivery_attempts`
  - `delivery_events`
  - `provider_limits`
  - `oracle_assurance`
  - `worker_runtime`
  - `operational_events`
  - `scheduled_executions`
- `UPDATE` only on `worker_lease`; no `INSERT` or `DELETE` on that singleton control table.
- `USAGE` on identity sequences used by inserts; no sequence `UPDATE` privilege.
- `EXECUTE` on `watchdog_pg.utc_value(text)` and `watchdog_pg.clock_now()`.

Explicitly forbidden:

- writes to `schema_migrations` and `database_identity`;
- `INSERT` or `DELETE` on `worker_lease`;
- table `TRUNCATE`, `REFERENCES`, or `TRIGGER` privileges;
- schema `CREATE`;
- ownership or owner-role membership;
- sequence `UPDATE`;
- elevated PostgreSQL role attributes.

#### `watchdog_reader`

Required:

- `CONNECT` on `neondb`.
- `USAGE` on schema `watchdog_pg`; no schema `CREATE`.
- `SELECT` on all 15 application tables.
- `EXECUTE` on the two application SQL functions where catalog/read queries call them.

Explicitly forbidden:

- all table/column `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER` privileges;
- sequence `USAGE` or `UPDATE` privileges;
- ownership or owner-role membership;
- elevated PostgreSQL role attributes.

### 4.3 Current grant status

Because `watchdog_pg` does not exist, all application-object privileges are currently missing by definition. This stage did not create objects or grant privileges. The hardened global role attributes are suitable, apart from unnecessary effective `TEMP`; application grants must be established only by a separately approved provisioning step and then re-audited.

## 5. Existing database baseline

The baseline was read through the authenticated direct writer inside a read-only transaction:

| Baseline item | Observed result |
| --- | --- |
| User schemas | `public` only |
| `watchdog_pg` schema | Absent |
| User tables | None |
| User sequences | None |
| User indexes | None |
| Application functions | None |
| Migration records | None; migration table absent |
| Existing application/user data | None; no user tables exist |
| Extensions | `plpgsql` 1.0 only, in `pg_catalog` |
| Default-privilege entries involving runtime roles | None |

No destructive or modifying baseline command was issued.

## 6. Exact application database requirements

### 6.1 Schema lineage and identity

- Dedicated schema: `watchdog_pg`.
- Two independent, checksummed PostgreSQL migrations:
  - version 1: `7d682b2267b9d35d0a6ed01511dc0342a3ef801051e0ee0fdf8f0c60a09b015d`
  - version 2: `7b8aa97bf0a386081b79bd5d6eb36c57af91d5c40cd3498302dd4615d4a9eb75`
- Required production catalog fingerprint: `24b4fea1efeab7c49999dd693f59ddc9aa776bcb4d4e262185978c9630c80ba3`.
- `database_identity.backend = 'liquidation-watchdog-pg'`.
- Runtime namespace must exactly match the configured `WATCHDOG_POSTGRES_NAMESPACE`; the reviewed A4 target is `watchdog_free`.
- PostgreSQL server major must remain 17.

### 6.2 Domains and functions

Required domains:

1. `identifier`
2. `digest`
3. `uint_text`
4. `utc_text`
5. `object_text`
6. `delivery_status`
7. `channel`

Required SQL functions:

1. `utc_value(text) → timestamptz`
2. `clock_now() → timestamptz`

No non-core PostgreSQL extension is required. `plpgsql` is present but application functions use `LANGUAGE sql`.

### 6.3 Required tables

Exactly 15 tables:

1. `schema_migrations`
2. `cycles`
3. `streams`
4. `fingerprints`
5. `alerts`
6. `deliveries`
7. `delivery_attempts`
8. `delivery_events`
9. `provider_limits`
10. `oracle_assurance`
11. `worker_runtime`
12. `operational_events`
13. `database_identity`
14. `worker_lease`
15. `scheduled_executions`

These tables enforce primary/unique/foreign keys, bounded counters and payload sizes, canonical decimal/UTC text, false-only actionability, delivery claim consistency, database incarnation, lease fencing, and durable scheduled-execution receipts.

### 6.4 Required explicit indexes

Exactly 15 named non-constraint indexes:

1. `cycles_scope_time`
2. `cycles_history` — partial where `observation_json IS NOT NULL`
3. `cycles_unfinished` — partial for `RUNNING`/`PERSISTED`
4. `cycles_retention` — partial for terminal cycles
5. `alerts_history`
6. `alerts_time`
7. `alerts_cycle`
8. `deliveries_due`
9. `deliveries_alert`
10. `delivery_events_delivery`
11. `assurance_context_time`
12. `assurance_time`
13. `streams_latest_cycle`
14. `streams_accepted_cycle`
15. `executions_slot`

PostgreSQL must additionally retain the automatically created indexes backing every declared primary-key and unique constraint, including stable-sequence uniqueness, `(id, scope)`, alert fingerprint uniqueness, `(alert_id, channel)`, database incarnation uniqueness, cycle/execution uniqueness and `(namespace, schedule, slot)`.

### 6.5 SQL features used

The implementation relies on PostgreSQL 17 core behavior:

- checked domains, regular-expression checks and `COLLATE "C"`;
- `timestamptz(6)`, generated stored columns and identity sequences;
- UUID, deferrable foreign keys, cascades and check constraints;
- `ON CONFLICT`, conditional upserts and `RETURNING`;
- partial and descending indexes;
- `READ COMMITTED` writer and `REPEATABLE READ READ ONLY` reader transactions;
- transaction-local `set_config`, statement/lock/idle timeouts and `synchronous_commit=on`;
- row locking with `FOR UPDATE` / `FOR UPDATE OF`;
- built-in JSON validation over hash-sensitive JSON stored as text;
- exact bigint values returned as strings, with application range checks;
- window functions, arrays, catalog functions and `pg_database_size`;
- SHA-256 catalog fingerprinting through PostgreSQL core hash functions;
- transaction-scoped advisory lock `(1672, 10001)` during explicit migration only.

Runtime scheduling does not rely on session advisory locks, `LISTEN/NOTIFY`, temporary tables, session-local ownership or named prepared statements.

## 7. Application compatibility assessment

### Compatible findings

- PostgreSQL 17.11 matches the hard PostgreSQL 17 requirement.
- Direct `pg` 8.23.1 connectivity works with authorized TLS 1.3 and required channel binding configuration.
- SQL syntax and core features are supported by PostgreSQL 17.
- JSON is stored as original validated text and independently SHA-256 bound; it does not rely on JSONB reserialization.
- Financial and large integer values use canonical decimal text; PostgreSQL `int8`, `numeric`, timestamp and JSON driver parsers are overridden to strings where needed.
- Transactions use one checked-out client from `BEGIN` through `COMMIT`/`ROLLBACK`.
- Observation/state/assurance/alert/outbox writes are atomic within one writer transaction.
- Unknown COMMIT outcomes are reconciled by durable identities rather than replayed.
- Table-backed lease/fence state is compatible with transaction pooling in design; scheduler ownership is not session-bound.
- Scheduler construction is inert while disabled, and no scheduler was activated during qualification.

### Incompatibilities and unverified behavior

1. **Pooled startup parameter:** `connectionConfiguration()` always sets `options: '-c search_path=pg_catalog'`. The Neon pooler rejects that startup configuration with `08P01`. Removing it diagnostically makes the pooled connection work, but source changes are prohibited in this stage. The implementation therefore cannot currently use the qualified pooled endpoint.
2. **Reader authentication:** both direct and pooled reader credentials fail with `28P01`. Dashboard/read-model operation cannot be qualified.
3. **Schema absence:** runtime `verifyPostgresSchema()` would fail immediately because migration history, identity, lease and catalog fingerprint are absent.
4. **Grant absence:** no application-object grant can be validated until the separately approved schema/provisioning step is complete.
5. **Native local rerun unavailable:** `postgres.exe`, `initdb.exe`, `pg_ctl.exe`, `psql.exe` and `WATCHDOG_PG_TEST_BIN` are absent on this host, so the native PostgreSQL integration suite was not rerun during Stage 1.

## 8. Tests performed

### Local, non-remote

- PostgreSQL configuration/URL/TLS tests
- PostgreSQL connection ownership, cancellation and unknown-COMMIT tests
- A4 safety/metadata/migration-runner mock tests
- Runtime configuration and lifecycle tests
- Scheduler runner and HTTP contract tests

Result: **7 test files, 160/160 tests passed**.

Additional checks:

- `tsc --noEmit`: PASS
- full ESLint over source, tests, scripts and configuration: PASS
- native PostgreSQL integration: NOT RUN; local PostgreSQL 17 binaries unavailable

### Remote, read-only

- Authenticated Neon API `GET` metadata binding: PASS
- Direct writer TLS/server/database/role/read-only transaction: PASS
- Direct reader login: FAIL (`28P01`)
- Pooled writer with exact application configuration: FAIL (`08P01`)
- Pooled writer diagnostic without startup `options`: PASS
- Pooled reader login: FAIL (`28P01`)
- Catalog role inspection for both roles: PASS
- Empty branch baseline inspection: PASS

## 9. Remaining blockers and required next decisions

1. Correct or rotate the `watchdog_reader` branch credential through an independently approved credential-management action, then re-run direct and pooled reader checks. This report does not authorize a password change.
2. Resolve the Neon pooled startup-parameter incompatibility in a separately approved source-change phase. A likely design is to remove URL/session startup `options` and continue setting `search_path=pg_catalog` transaction-locally, but this requires implementation, adversarial review, full tests and requalification.
3. Review whether `TEMP` should be revoked from both runtime roles. Do not change it silently.
4. Approve a separate migration/provisioning stage before creating `watchdog_pg`. Stage 1 does not authorize `applyPostgresMigrations` or any SQL write.
5. After migration, establish only the exact grants listed above and re-run role drift checks, catalog fingerprint verification, migration checksum verification and exact empty-data baseline checks.
6. Re-run the native PostgreSQL integration suite when approved PostgreSQL 17 binaries are available locally.
7. Keep the scheduler disabled until schema, reader, pooled configuration, grants, runtime identity and post-migration catalog are all qualified.

## 10. Recommendation

**NO-GO for Liquidation Watchdog application integration on this Neon branch at Stage 1.**

The child branch identity and direct writer transport are qualified, and the role definitions are promising. However, the application cannot currently start successfully or provide reader-backed APIs, and its exact pooled configuration is rejected. A separately approved remediation/provisioning sequence is required. This recommendation does not authorize migration, role modification, credential rotation, deployment or scheduler activation.
