# Neon Stage 1C — Connection Remediation

**Completed:** 2026-11-05  
**Project:** `liquidation-watchdog-pg17`  
**Authorized target:** child branch `a4-migration-test` only  
**PostgreSQL target:** 17.11  
**Recommendation:** **NO-GO pending corrected reader credentials and an approved remote retest**

## 1. Outcome

The narrow local pooled-connection source fix is implemented and fully verified locally. Direct connections retain startup `search_path` hardening; endpoints using the conventional `-pooler` hostname marker omit only the incompatible PostgreSQL startup `options` field. Transaction-local `search_path=pg_catalog` remains mandatory before application SQL.

Remote retesting did not run. The external credential file is structurally complete, but its reader URLs still contain the same password bytes as the writer URLs. Stage 1 previously proved those bytes authenticate `watchdog_writer` and fail `watchdog_reader` with `28P01`. The Stage 1C authorization explicitly requires remote testing to stop when the reader credential has not been manually corrected.

No Neon API request or PostgreSQL connection was made during Stage 1C. No password, database privilege, TEMP policy, schema, migration, deployment or scheduler state was changed.

## 2. Preflight

### 2.1 Source path inspection

The connection path remains:

1. `src/config/postgres.ts` strictly parses the two runtime URLs into separate `PoolConfig` objects.
2. `src/runtime/postgres-runtime.ts` passes those configurations unchanged to one writer and one reader `PgConnection`.
3. `src/storage/postgres/connection.ts` creates one bounded pool per role and uses a single checked-out client for each transaction.
4. Before a callback can issue application SQL, `PgConnection.transaction()` begins the required transaction and sets transaction-local `search_path`, UTC, durability and timeout settings.
5. `scripts/a4-neon-qualification.ts` remains a separate direct-endpoint maintenance path. It was inspected but not executed because it can run migrations.

### 2.2 Credential-file preflight

Inspected external file:

`%LOCALAPPDATA%\Temp\opencode\neon-stage1.env`

Safety checks:

- regular file, not a symlink;
- all seven required variables present;
- two reader URLs and two writer URLs present;
- database `neondb`;
- direct/pooled structure present;
- `sslmode=verify-full`;
- `channel_binding=require`;
- reader URLs agree with each other;
- writer URLs agree with each other.

Blocking result:

- in-memory SHA-256 comparison of decoded password bytes shows that the reader and writer passwords are identical;
- no password or hash was printed, logged or written to the repository;
- therefore the corrected reader credential prerequisite is **not met**.

The credential file was not modified. No password was guessed or rotated.

## 3. Source changes

### 3.1 Application source

Changed `src/config/postgres.ts` only.

After the existing strict URL validation, connection configuration now detects a pooled endpoint using the first DNS label's conventional `-pooler` suffix:

```ts
const pooled = url.hostname.toLowerCase().split(".")[0]!.endsWith("-pooler");
```

Configuration behavior:

```ts
...(pooled ? {} : { options: "-c search_path=pg_catalog" })
```

No provider-specific endpoint, project, branch, role password or hostname is hardcoded.

### 3.2 Tests

Changed:

- `test/postgres-config.test.ts`
- `test/postgres-connection.test.ts`

Added assertions prove:

- direct endpoints retain `options=-c search_path=pg_catalog`;
- pooled endpoints omit `options` and no other field;
- `ssl.rejectUnauthorized=true` remains present;
- `sslnegotiation="postgres"` remains present;
- required channel binding remains enabled;
- UTF-8 and fixed application name remain present;
- role/database values remain intact;
- every writer/reader transaction sets `search_path=pg_catalog` before callback SQL;
- writer and reader statement timeout values remain 5,000 ms and 1,000 ms;
- all connection, queue, query, transaction, lock and close limits remain unchanged.

### 3.3 Generated build output

The required production build regenerated the corresponding `dist/` configuration output. No runtime, scheduler, storage schema or migration source was changed.

## 4. Exact pooled and direct behavior

### Direct or maintenance endpoint

The resulting `PoolConfig` retains:

- `options: "-c search_path=pg_catalog"`;
- `ssl: { rejectUnauthorized: true }`;
- `sslnegotiation: "postgres"`;
- required channel binding when the URL specifies it;
- `application_name: "liquidation-watchdog"`;
- `client_encoding: "UTF8"`;
- explicit host, port, database, username and password;
- all bounded pool settings supplied by `PgConnection`.

### Pooled endpoint

The resulting `PoolConfig` is identical except that the `options` property is absent. It does not replace it with an empty string and does not relax any other security or capacity setting.

### Transaction-local enforcement

Both endpoint types still execute, on the same checked-out client:

1. writer: `BEGIN ISOLATION LEVEL READ COMMITTED`; or
2. reader: `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`;
3. transaction-local `set_config('search_path','pg_catalog',true)` plus UTC, `synchronous_commit=on`, lock, statement and idle-transaction timeouts;
4. callback SQL;
5. `COMMIT` or bounded `ROLLBACK`.

If the transaction-local settings statement fails, callback SQL is not reached.

## 5. Security properties preserved

The fix does not change:

- TLS requirement or certificate/hostname verification;
- channel binding enforcement;
- protocol/database/username/password validation;
- rejection of URL-supplied certificate/key/options parameters;
- separate writer and reader identities;
- same host, port and database requirement for runtime roles;
- fixed application name and UTF-8;
- one connection per role, zero minimum idle connections and bounded queue;
- connection, statement, lock, transaction, lifetime and close timeouts;
- exact bigint/string parsers;
- same-client transaction ownership;
- writer `READ COMMITTED` or reader `REPEATABLE READ READ ONLY` isolation;
- transaction-local `search_path=pg_catalog` before application SQL;
- transaction-local `synchronous_commit=on`;
- sanitized errors, bounded reconnect and unknown-COMMIT handling;
- table-backed scheduler leases and fences.

## 6. Local verification results

| Verification | Result |
| --- | --- |
| Focused PostgreSQL configuration and connection tests | **50/50 passed** |
| Full unit suite | **922/922 passed**, 44/44 files |
| TypeScript `--noEmit` | PASS |
| Full ESLint | PASS |
| Production build | PASS |

The test count increased from 920 to 922 because Stage 1C added focused direct/pooler and reader transaction-local search-path coverage.

## 7. Remote connection retest

### Stage 1C result

All four remote tests were **NOT RUN** because reader credentials were not manually corrected:

| Endpoint | Stage 1C result | Reason |
| --- | --- | --- |
| Direct writer | NOT RUN | Four-endpoint retest gated on complete corrected credential file. |
| Direct reader | NOT RUN | Reader password still matches writer password; prior `28P01`. |
| Pooled writer | NOT RUN | Exact remediated configuration requires approved four-endpoint retest. |
| Pooled reader | NOT RUN | Reader password still matches writer password; prior `28P01`. |

No connection was attempted, so Stage 1C makes no new TLS, SQLSTATE, role, branch, version or read-only claim about Neon.

### Prior Stage 1 evidence, not a post-fix result

For context only:

- Neon metadata previously bound the supplied endpoint to project `liquidation-watchdog-pg17`, child branch `a4-migration-test`, parent `production`, region `aws-us-east-2` and PostgreSQL major 17.
- direct writer previously passed authorized TLS 1.3, PostgreSQL 17.11, database/role identity and a read-only transaction;
- both reader URLs previously failed with `28P01`;
- the old exact pooled writer configuration failed with `08P01`;
- a diagnostic pooled writer connection without startup `options` previously passed.

Those results justify the local fix but do not replace the required post-fix four-endpoint retest.

## 8. Required retest after reader correction

After the operator manually supplies the actual `watchdog_reader` password in both external reader URLs, repeat preflight and require:

- reader password bytes are internally consistent and distinct from writer password bytes;
- API metadata still binds project, child branch, parent and endpoint;
- every connection uses the exact `connectionConfiguration()` output from the remediated source;
- direct writer, direct reader, pooled writer and pooled reader all connect;
- TLS socket is encrypted, authorized and has no authorization error;
- server version is PostgreSQL 17.x and observed target is 17.11;
- database is `neondb` and `current_user` matches the expected role;
- each test runs only inside `REPEATABLE READ READ ONLY`;
- `transaction_read_only=on` and `search_path=pg_catalog`;
- only catalog/metadata `SELECT` statements execute;
- every connection closes cleanly;
- failures report only a stable SQLSTATE and never untrusted driver text or secrets.

The retest must not run migrations or any write/DDL/privilege statement.

## 9. TEMP privilege policy

No TEMP privilege change was made. In particular, Stage 1C did not execute:

```sql
REVOKE TEMPORARY ON DATABASE neondb FROM PUBLIC;
```

The database-wide impact review and approval described in Stage 1B remain required.

## 10. Remaining blockers

1. Correct `watchdog_reader` credentials have not been supplied; both reader URLs still use writer password bytes.
2. The remediated application configuration has not been remotely tested against all four endpoints.
3. `watchdog_pg`, its migration history, 15 tables, identity/lease rows and runtime grants remain absent by design.
4. The TEMP policy remains undecided.
5. Native PostgreSQL 17 integration cannot be rerun on this host until approved local binaries are available.
6. Migration authority, privileged credential custody and one-use attempt controls remain separate A4 blockers.
7. Scheduler activation, deployment, backup/restore and Neon Free operational limits remain unqualified.

## 11. Recommendation

**Local source remediation: GO.** The change is narrow, security-preserving and fully green locally.

**Neon application integration: NO-GO.** Manually correct the reader credential, obtain explicit read-only retest approval, and pass all four direct/pooled role checks before reconsidering connection readiness.

Stage 2 is not authorized or started.
