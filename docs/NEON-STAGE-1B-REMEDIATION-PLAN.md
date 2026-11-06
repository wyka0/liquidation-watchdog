# Neon Stage 1B — Connection and Privilege Remediation Plan

**Prepared:** 2026-11-05  
**Project:** `liquidation-watchdog-pg17`  
**Authorized target:** child branch `a4-migration-test` only  
**Status:** diagnosis and plan only — no remediation executed

## 1. Safety boundary

This stage performed local configuration/source inspection, authenticated Neon metadata `GET` requests and read-only PostgreSQL catalog queries against the verified child-branch direct endpoint. It did not change a password, role, grant, database ACL, schema, table, migration record, application source, scheduler, deployment or notification configuration.

The proposed pooled configuration was **not** retested in Stage 1B because the authorization requires separate explicit approval before that read-only connection test.

No credential, connection string, password, token, endpoint hostname or full provider identifier is stored in this report.

## 2. Blocker 1 — `watchdog_reader` authentication (`28P01`)

### 2.1 Findings

PostgreSQL catalogs prove that both roles exist:

| Attribute | `watchdog_reader` | `watchdog_writer` |
| --- | ---: | ---: |
| Exists | Yes | Yes |
| LOGIN | Yes | Yes |
| INHERIT | No | No |
| Password validity limit | None (`rolvaliduntil IS NULL`) | None |
| Per-role configuration | None | None |
| Elevated attributes | None | None |
| Role memberships | None | None |

The Stage 1 qualification read credentials only from the external regular file:

`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\neon-stage1.env`

The exact variables used were:

- direct reader: `WATCHDOG_NEON_DIRECT_READER_URL`
- pooled reader: `WATCHDOG_NEON_POOLED_READER_URL`
- direct writer: `WATCHDOG_NEON_DIRECT_WRITER_URL`
- pooled writer: `WATCHDOG_NEON_POOLED_WRITER_URL`

No application `.env`, `DATABASE_URL`, `PGPASSWORD`, source file or implicit `pg` environment fallback was used.

Local comparison was performed by hashing decoded password bytes in memory; hashes and passwords were not printed or retained. It established:

- the two reader URLs contain the same password bytes;
- the two writer URLs contain the same password bytes;
- the reader and writer password bytes are also identical;
- the writer authenticates successfully;
- the reader rejects those bytes on both direct and pooled endpoints with `28P01`.

### 2.2 Root cause

The external reader URLs contain the **writer password**, not the valid `watchdog_reader` password. Role absence, `NOLOGIN`, inherited-role behavior and password expiry are ruled out.

If an independently retained correct reader password exists, the local reader URLs can be corrected without a database password change. If it is not available, `watchdog_reader` requires a password reset/rotation. Neon does not expose existing database password material through read-only metadata APIs.

### 2.3 Exact manual Neon Console procedure

This procedure requires separate approval because it changes an authentication secret.

1. Sign in to the Neon Console through the approved operator account.
2. Open project **`liquidation-watchdog-pg17`**.
3. Select branch **`a4-migration-test`** and verify the branch identifier before continuing. Do not select `production` or another branch.
4. Open **Roles & Databases** (in some Console layouts this is under the branch's **Connect** or **Database** page).
5. Locate role **`watchdog_reader`**. Confirm that `watchdog_writer` is not selected.
6. Choose **Reset password** / **Rotate password** from the reader role's action menu.
7. Confirm the reset only after recording the approved change ticket/authorization.
8. Copy the newly generated reader password directly into the approved secret-handling workflow. Do not paste it into chat, source, documentation, command history or reports.
9. URL-encode the password and update only these two entries in the external local file:
   - `WATCHDOG_NEON_DIRECT_READER_URL`
   - `WATCHDOG_NEON_POOLED_READER_URL`
10. Verify that both URLs retain:
    - username `watchdog_reader`;
    - database `neondb`;
    - port 5432;
    - `sslmode=verify-full`;
    - `channel_binding=require`;
    - direct/pooled host binding to the `a4-migration-test` endpoint.
11. Do not alter either writer URL.
12. Run the approved read-only reader verification below. Delete or rotate transient local copies according to the credential-handling policy after verification.

### 2.4 Read-only verification after approval

Connect using the external secret without displaying it, then execute only:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_user,
       current_database(),
       current_setting('server_version_num'),
       current_setting('transaction_read_only'),
       current_setting('transaction_isolation');
ROLLBACK;
```

Acceptance:

- direct and pooled logins both succeed;
- `current_user = 'watchdog_reader'`;
- database is `neondb`;
- version number starts with `17`;
- transaction is read-only;
- TLS is encrypted and certificate-authorized;
- no server or credential detail is printed on failure.

### 2.5 Security impact and approval

- **Impact:** rotation invalidates the prior reader secret and can temporarily disable dashboard/read-model access wherever the old secret is deployed.
- **Required approval:** credential rotation/change approval for the child branch plus authorization to update each approved secret store.
- **Not authorized here:** resetting the password or editing deployed secrets.

## 3. Blocker 2 — Neon pooled startup protocol (`08P01`)

### 3.1 Injection trace

The rejected startup option originates at:

- `src/config/postgres.ts:32-48` — `connectionConfiguration()` parses both writer and reader URLs.
- `src/config/postgres.ts:47` — every returned `PoolConfig` includes:

  ```ts
  options: "-c search_path=pg_catalog"
  ```

- `src/config/postgres.ts:55-58` — the same function constructs writer and reader configurations.
- `src/runtime/postgres-runtime.ts:52` — configurations are passed unchanged to two `PgConnection` instances.
- `src/storage/postgres/connection.ts:27-30` — `PgConnection` spreads the configuration into `new Pool(...)`, so `options` is sent in the PostgreSQL startup packet.

The pooled Neon endpoint rejects the exact application startup packet with SQLSTATE `08P01`. The same pooled endpoint, writer credential, verified TLS and read-only transaction work when the startup `options` field is omitted.

### 3.2 Existing defense that permits a narrow fix

`src/storage/postgres/connection.ts:84-86` begins a transaction and immediately executes transaction-local settings before any application operation:

```sql
SELECT set_config('search_path','pg_catalog',true),
       set_config('TimeZone','UTC',true),
       set_config('synchronous_commit','on',true),
       set_config('lock_timeout','1000',true),
       set_config('statement_timeout',$1,true),
       set_config('idle_in_transaction_session_timeout','5000',true)
```

All store, schema verification, role verification and runtime queries execute after that statement on the same checked-out client. Runtime lease ownership is table-backed; it does not depend on session advisory locks, temporary tables, `LISTEN/NOTIFY` or persistent session state.

### 3.3 Narrowest safe source fix

In a separately approved source-change stage:

1. Detect a Neon pooled hostname only after the existing strict URL validation (the reviewed form includes `-pooler` in the hostname).
2. Omit `PoolConfig.options` **only for pooled endpoint configurations**.
3. Retain startup `options=-c search_path=pg_catalog` for direct maintenance/unpooled configurations.
4. Retain all of the following unchanged:
   - `ssl: { rejectUnauthorized: true }`;
   - `sslnegotiation: "postgres"`;
   - `enableChannelBinding` when `channel_binding=require`;
   - fixed `application_name`;
   - `client_encoding: "UTF8"` unless separately proven incompatible;
   - distinct writer/reader roles;
   - one connection per role and every timeout/queue limit;
   - the immediate transaction-local `search_path=pg_catalog` and other settings.
5. Do not weaken URL validation, add `sslmode=disable`, accept `rejectUnauthorized:false`, or fall back to a direct endpoint silently.

This conditional omission is narrower than removing startup hardening globally. It preserves the direct migration/maintenance path while relying on the already mandatory transaction-local search path for pooled runtime transactions.

### 3.4 Required tests before remote retest

Local tests must prove:

- direct URLs still return `options=-c search_path=pg_catalog`;
- pooled URLs omit only `options`;
- pooled configs still retain TLS verification, channel binding, UTF-8, application name, role/database/host binding and pool limits;
- every transaction runs `BEGIN` then transaction-local `set_config` before the callback;
- failure of the settings statement prevents the callback and rolls back;
- no query executes outside the checked-out transaction client;
- migration/A4 direct configuration is unchanged;
- direct and pooled reader/writer configuration parsing remains fail-closed.

### 3.5 Remote verification command after explicit approval

No Stage 1B pooled retest was run. After source-change review and explicit connection-test approval, use the exact resulting `PoolConfig` and execute:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT set_config('search_path','pg_catalog',true),
       set_config('TimeZone','UTC',true),
       set_config('lock_timeout','1000',true),
       set_config('statement_timeout','1000',true),
       set_config('idle_in_transaction_session_timeout','5000',true);
SELECT current_user,
       current_database(),
       current_setting('search_path'),
       current_setting('transaction_read_only');
ROLLBACK;
```

Acceptance requires both writer and reader pooled roles, authorized TLS, `pg_catalog`, read-only mode, no startup `08P01`, and no database writes.

### 3.6 Security impact and approval

- **Impact:** removing a startup defense on pooled connections increases reliance on the transaction wrapper. Any future query outside `PgConnection.transaction()` would execute before the hardened search path and must be prohibited by tests/review.
- **Required approval:** source-code remediation, adversarial review, local test approval, build/release update, then separate approval for a read-only pooled Neon retest.
- **Not authorized here:** source modification or the proposed remote retest.

## 4. Blocker 3 — effective `TEMPORARY` privilege

### 4.1 Root cause

The `neondb` database ACL explicitly contains:

| Grantee | Privilege | Grantable |
| --- | --- | --- |
| `PUBLIC` | `CONNECT` | No |
| `PUBLIC` | `TEMPORARY` | No |

There are no explicit database ACL entries granting `TEMPORARY` to either `watchdog_writer` or `watchdog_reader`. Both roles receive it solely through `PUBLIC`.

### 4.2 Runtime requirement

The application does **not** require temporary tables or a temporary schema:

- no `CREATE TEMP`, `CREATE TEMPORARY`, `TEMP TABLE` or `pg_temp` statement exists under `src/`;
- persistence uses permanent `watchdog_pg` tables;
- scheduling uses permanent table-backed leases and receipts;
- read snapshots use ordinary read-only MVCC transactions;
- catalog verification and migrations do not create temporary objects.

`TEMPORARY` is unnecessary for both runtime roles.

### 4.3 Least-privilege remediation

PostgreSQL has grants but no per-role denial that overrides a `PUBLIC` grant. Therefore removing effective `TEMPORARY` from only the two runtime roles is not possible while `PUBLIC` retains it.

The least-privilege database-wide remediation is:

```sql
REVOKE TEMPORARY ON DATABASE neondb FROM PUBLIC;
```

Then explicitly restore `TEMPORARY` only to separately reviewed roles that actually require it:

```sql
GRANT TEMPORARY ON DATABASE neondb TO <approved_non_runtime_role>;
```

Do **not** grant it back to `watchdog_writer` or `watchdog_reader`.

Because the revoke affects every role relying on the `PUBLIC` grant, first inventory all branch roles and approved workflows. On the currently empty child branch no user tables or application jobs exist, but operator/maintenance tooling may still expect temporary objects.

### 4.4 Verification query

```sql
SELECT CASE WHEN privilege.grantee = 0
            THEN 'PUBLIC'
            ELSE pg_get_userbyid(privilege.grantee)
       END AS grantee,
       privilege.privilege_type,
       privilege.is_grantable
FROM pg_database AS database
CROSS JOIN LATERAL
     aclexplode(COALESCE(database.datacl,
                         acldefault('d', database.datdba))) AS privilege
WHERE database.datname = 'neondb'
ORDER BY grantee, privilege_type;

SELECT has_database_privilege('watchdog_writer','neondb','TEMP') AS writer_temp,
       has_database_privilege('watchdog_reader','neondb','TEMP') AS reader_temp;
```

Acceptance: both effective checks are false; `CONNECT` remains available; no unreviewed role loses a required workflow.

### 4.5 Security impact and approval

- **Benefit:** prevents runtime principals from creating temporary relations/functions that could increase storage use or widen search-path/object-confusion surfaces.
- **Operational risk:** database-wide `PUBLIC` revocation can break unrelated tooling that relied on defaults.
- **Required approval:** database privilege-change approval plus complete branch-role/workflow impact review.
- **Not authorized here:** any `REVOKE` or `GRANT`.

## 5. Blocker 4 — exact schema preparation

### 5.1 Migration identity

The application uses schema `watchdog_pg`, PostgreSQL major 17 and two independent checksummed migrations:

| Version | SHA-256 |
| ---: | --- |
| 1 | `7d682b2267b9d35d0a6ed01511dc0342a3ef801051e0ee0fdf8f0c60a09b015d` |
| 2 | `7b8aa97bf0a386081b79bd5d6eb36c57af91d5c40cd3498302dd4615d4a9eb75` |

Required production catalog fingerprint:

`24b4fea1efeab7c49999dd693f59ddc9aa776bcb4d4e262185978c9630c80ba3`

Reviewed A4 namespace: `watchdog_free`.

No extension beyond PostgreSQL 17 core functionality is required. The existing `plpgsql` extension is not required by the two application functions, which use `LANGUAGE sql`.

### 5.2 Required domains and functions

Domains:

1. `identifier` — 1-100 character application identifier.
2. `digest` — lowercase SHA-256 hex.
3. `uint_text` — canonical 0 or 1-78 digit unsigned decimal text.
4. `utc_text` — canonical UTC text with up to six fractional digits and validated conversion.
5. `object_text` — JSON object text, maximum 1 MiB.
6. `delivery_status` — bounded delivery state vocabulary.
7. `channel` — `console`, `telegram`, `discord`.

Functions:

1. `utc_value(text) RETURNS timestamptz` — immutable, strict, SQL, `search_path=pg_catalog`, UTC.
2. `clock_now() RETURNS timestamptz` — volatile SQL wrapper over `clock_timestamp()`, `search_path=pg_catalog`.

### 5.3 Required tables and constraints

Exactly 15 tables:

1. **`schema_migrations`** — primary key `version`; 64-character lowercase checksum check; non-null `applied_at` defaulting to `clock_timestamp()`.
2. **`cycles`** — primary key `id`; unique positive identity `stable_seq`; unique `(id,scope)`; canonical start/observe/complete text plus generated timestamp projections; bounded lifecycle status, acceptance, block/snapshot/risk fields, false-only `actionable`, safe duration; JSON/hash nullability pairing; persisted and terminal-state consistency checks.
3. **`streams`** — primary key `scope`; safe nonnegative revision; state JSON/hash; composite foreign keys `(latest_cycle,scope)` and `(last_accepted_cycle,scope)` to cycles.
4. **`fingerprints`** — primary key digest and non-null creation time; retained deduplication tombstone.
5. **`alerts`** — primary key `id`; unique positive identity `stable_seq`; unique fingerprint foreign key; composite cycle/scope foreign key; bounded severity/category; JSON ≤256 KiB and hash.
6. **`deliveries`** — primary key `id`; unique positive identity `stable_seq`; alert foreign key with cascade; unique `(alert_id,channel)`; bounded status/attempt/error/ambiguity; generated due timestamp; all-or-none fenced claim columns and in-flight consistency.
7. **`delivery_attempts`** — composite primary key `(delivery_id,attempt)`; cascading delivery foreign key; attempts 1-10; bounded outcome/error/ambiguity; owner/fence/incarnation; completion/outcome consistency.
8. **`delivery_events`** — positive identity primary key; cascading delivery foreign key; event UTC text and bounded status.
9. **`provider_limits`** — channel primary key; next time and 0/1 blocked flag.
10. **`oracle_assurance`** — primary key `id`; unique positive identity `stable_seq`; generated evaluation timestamp; bounded continuity context; JSON ≤256 KiB/hash; evidence path/manifest all-or-none constraint.
11. **`worker_runtime`** — singleton primary key `id=1`; runtime JSON ≤32 KiB.
12. **`operational_events`** — positive identity primary key; UTC event time; allowlisted operational code.
13. **`database_identity`** — singleton primary key `id=1`; fixed backend `liquidation-watchdog-pg`; bounded namespace; unique incarnation UUID; creation timestamp.
14. **`worker_lease`** — singleton primary key `id=1`; deferrable incarnation foreign key; nonnegative fence; owner/expiry/deadline/current-execution all-or-none; `deadline_at <= expires_at`; high-water slot; deferrable current-execution foreign key.
15. **`scheduled_executions`** — digest primary key; fixed schedule value; UTC slot plus generated timestamp; unique cycle foreign key with cascade; positive fence; status/accepted/missed-slot/receipt fields; unique `(namespace,schedule,slot)`; running/completion/receipt consistency checks.

Identity sequences are required for `cycles.stable_seq`, `alerts.stable_seq`, `deliveries.stable_seq`, `delivery_events.id`, `oracle_assurance.stable_seq` and `operational_events.id`.

### 5.4 Required explicit indexes

Exactly 15 named indexes in addition to primary/unique constraint indexes:

1. `cycles_scope_time`
2. `cycles_history` — partial, observations only
3. `cycles_unfinished` — partial, `RUNNING`/`PERSISTED`
4. `cycles_retention` — partial, terminal cycles
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

Required constraint-backed indexes include every table primary key plus unique indexes for cycle stable sequence and `(id,scope)`, alert stable sequence/fingerprint, delivery stable sequence and `(alert_id,channel)`, assurance stable sequence, database incarnation, scheduled-execution cycle and `(namespace,schedule,slot)`.

### 5.5 Exact grants after separately approved migration

The migration/schema owner must remain separate. Runtime roles must own no application object and have no membership in the owner role.

#### Writer

```text
DATABASE neondb: CONNECT
SCHEMA watchdog_pg: USAGE (not CREATE)
ALL 15 TABLES: SELECT
streams, cycles, fingerprints, alerts, deliveries,
delivery_attempts, delivery_events, provider_limits,
oracle_assurance, worker_runtime, operational_events,
scheduled_executions: INSERT, UPDATE, DELETE
worker_lease: UPDATE only
identity sequences: USAGE, not UPDATE
utc_value(text), clock_now(): EXECUTE
```

Forbidden writer privileges:

- writes to `schema_migrations` or `database_identity`;
- `INSERT`/`DELETE` on `worker_lease`;
- table/column `TRUNCATE`, `REFERENCES` or `TRIGGER`;
- schema `CREATE`, sequence `UPDATE`, ownership or owner membership.

#### Reader

```text
DATABASE neondb: CONNECT
SCHEMA watchdog_pg: USAGE (not CREATE)
ALL 15 TABLES: SELECT only
utc_value(text), clock_now(): EXECUTE where required by read queries
```

Forbidden reader privileges: every table/column write privilege, sequence `USAGE`/`UPDATE`, schema `CREATE`, ownership and owner membership.

### 5.6 Migration boundary

`applyPostgresMigrations()` is an explicit maintenance API. It acquires transaction-scoped advisory lock `(1672,10001)`, creates the schema/migration table, checks ordered checksums, applies missing SQL, inserts database identity/lease rows and verifies the full catalog fingerprint.

No migration, schema preparation or grant statement is authorized by Stage 1B. The existing A4.4/A4.5 execution-authority and credential-custody blockers remain applicable before any migration attempt.

## 6. Approval matrix

| Remediation | Required approval | Stage 1B action |
| --- | --- | --- |
| Correct local reader URLs using an already retained valid secret | Secret-store/configuration update approval | Diagnose only |
| Reset/rotate `watchdog_reader` password | Neon credential-change approval and coordinated secret update | Manual instructions only |
| Conditional omission of pooled startup `options` | Source-change, security-review and release approval | Design only |
| Read-only pooled retest using remediated config | Separate explicit remote-test approval | Not run |
| Revoke `TEMPORARY` from `PUBLIC` | Database privilege-change and impact-review approval | SQL proposal only |
| Create `watchdog_pg` / run migrations | Separate migration authorization under approved A4 execution architecture | Not run |
| Apply runtime grants | Separate least-privilege provisioning approval after schema creation | Grant plan only |
| Enable scheduler/deploy | Production deployment and scheduler approvals after all gates pass | Not performed |

## 7. Verification sequence after remediation approvals

1. Rebind and independently verify project, child branch, parent and endpoint metadata.
2. Verify all URL structures locally without printing secrets.
3. Verify reader direct and pooled authentication in read-only transactions.
4. Implement and locally test the conditional pooled `options` behavior.
5. After separate approval, run the exact read-only pooled configuration test for both roles.
6. Inventory branch roles/workflows, then separately approve and apply any database ACL change.
7. If migration is later approved, use the direct endpoint and separately controlled migration principal; keep runtime/scheduler disabled.
8. Verify migration checksums, database identity/namespace, 15-table inventory, constraints, functions, sequences, explicit indexes and catalog fingerprint.
9. Apply only the reviewed runtime grants; rerun writer/reader role-drift verification.
10. Confirm every application table is empty before any import/cutover qualification.
11. Run the native PostgreSQL integration suite and Neon read-only runtime compatibility checks.
12. Keep deployment and scheduler disabled until backup/restore, secret custody, monitoring, Free-plan resource and rollback gates are separately accepted.

## 8. Remaining production risks

- Reader availability remains blocked until its credential is corrected and independently verified.
- The current release cannot use Neon pooling because its startup packet is rejected.
- Removing pooled startup hardening requires permanent enforcement that no application SQL bypasses the transaction wrapper.
- Revoking `TEMPORARY` from `PUBLIC` is database-wide and may affect future maintenance tooling.
- The branch remains intentionally schema-empty; no persistence path can start successfully.
- Migration execution authority, one-use attempt control and privileged credential custody remain unresolved under the A4.4/A4.5 threat model.
- Native PostgreSQL 17 integration cannot currently be rerun on this host because local binaries are unavailable.
- Neon Free scale-to-zero latency, compute/egress/storage quotas, backup/restore and operational telemetry remain unqualified.
- Direct maintenance and pooled runtime paths require separate post-remediation qualification.
- No result here qualifies oracle assurance, freshness, financial actionability, deployment or scheduler operation.

## 9. Recommendation

Proceed only with separately approved remediation in this order:

1. correct/rotate the reader credential and qualify reader login;
2. implement the narrowly conditional pooled `options` omission and complete local security tests;
3. explicitly approve and run the read-only pooled retest;
4. decide the branch-wide `TEMPORARY` policy;
5. resolve migration authority/custody blockers before any schema or grant change.

Application integration remains **NO-GO** until all five steps and their verification gates are complete.
