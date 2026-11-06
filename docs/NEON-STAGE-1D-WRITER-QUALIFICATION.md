# Neon Stage 1D — Writer-Only Qualification

**Completed:** 2026-11-05  
**Project:** `liquidation-watchdog-pg17`  
**Target branch:** `a4-migration-test`  
**PostgreSQL:** 17.11  
**Writer-only recommendation:** **GO**  
**Full application integration:** **NO-GO — reader and schema remain unqualified**

## 1. Scope and restrictions

Stage 1D tested only:

1. direct `watchdog_writer`;
2. pooled `watchdog_writer`.

Both tests used the existing Stage 1C `connectionConfiguration()` output and credentials from the external local qualification file. Reader URL values were not parsed or authenticated. No reader login was attempted and no reader password was changed, reset or guessed.

Remote SQL was limited to explicit `REPEATABLE READ READ ONLY` transactions, transaction-local settings and catalog/metadata `SELECT` statements. No migration, DML, DDL, grant, revoke, TEMP policy, schema creation, deployment, scheduler, notification or transaction-broadcast operation occurred.

## 2. Target and branch identity

Authenticated Neon metadata `GET` requests verified:

| Check | Result |
| --- | --- |
| Project name | `liquidation-watchdog-pg17` — PASS |
| PostgreSQL major | 17 — PASS |
| Region | `aws-us-east-2` — PASS |
| Branch name | `a4-migration-test` — PASS |
| Supplied branch ID | Matches API branch — PASS |
| Parent branch | `production` — PASS |
| Direct endpoint belongs to child branch | PASS |
| Direct endpoint hostname matches API metadata | PASS |
| Direct and pooled writer URLs identify the same endpoint | PASS |

Full provider identifiers and hostnames are omitted. No parent-branch endpoint was used.

## 3. Exact connection configuration

### Direct writer

The active Stage 1C parser produced:

- role `watchdog_writer`;
- database `neondb`;
- port 5432;
- `ssl: { rejectUnauthorized: true }`;
- `sslnegotiation: "postgres"`;
- channel binding enabled;
- UTF-8;
- fixed application name;
- startup `options=-c search_path=pg_catalog` retained.

### Pooled writer

The parser produced the same security and identity settings, but the incompatible startup `options` property was absent. No other setting was omitted or weakened.

Both connections used bounded 5-second connection and 6-second query timeouts for qualification. Application pool limits remain one connection per role, zero minimum idle connections and a bounded queue.

## 4. Direct writer result

**PASS**

| Verification | Observed result |
| --- | --- |
| Connection | PASS |
| Approximate connection time | 3.68 seconds |
| Client TLS transport | Encrypted |
| Certificate/hostname authorization | Authorized; no authorization error |
| TLS protocol | TLS 1.3 |
| Channel-binding mechanism | `SCRAM-SHA-256-PLUS` |
| PostgreSQL | `17.11 (9045acd)` |
| Database | `neondb` |
| Role | `watchdog_writer` |
| Transaction | `REPEATABLE READ READ ONLY` |
| `transaction_read_only` | `on` |
| Transaction isolation | `repeatable read` |
| Transaction-local search path | `pg_catalog` |
| Clean shutdown | PASS |

The direct startup search-path option was present, and the transaction-local search path was independently reapplied before catalog queries.

## 5. Pooled writer result

**PASS**

| Verification | Observed result |
| --- | --- |
| Connection | PASS; no `08P01` |
| Approximate connection time | 2.53 seconds |
| Client TLS transport | Encrypted |
| Certificate/hostname authorization | Authorized; no authorization error |
| TLS protocol | TLS 1.3 |
| Channel-binding mechanism | `SCRAM-SHA-256-PLUS` |
| PostgreSQL | `17.11 (9045acd)` |
| Database | `neondb` |
| Role | `watchdog_writer` |
| Transaction | `REPEATABLE READ READ ONLY` |
| `transaction_read_only` | `on` |
| Transaction isolation | `repeatable read` |
| Transaction-local search path | `pg_catalog` |
| Clean shutdown | PASS |

This confirms the Stage 1C fix: omitting only the pooled startup `options` field resolves the Neon pooler protocol failure while preserving transaction-local hardening.

## 6. TLS and channel-binding interpretation

TLS was verified from Node's active `TLSSocket` for each connection:

- `encrypted = true`;
- `authorized = true`;
- no certificate authorization error;
- protocol `TLSv1.3`.

The `pg` authentication path was instrumented without retaining secret material and recorded `SCRAM-SHA-256-PLUS` for both endpoints. This verifies channel binding, not merely that the configuration flag was set.

The backend `pg_stat_ssl` row reports no backend-local SSL session. Neon terminates the client TLS connection at its authenticated connection proxy before forwarding to the PostgreSQL backend, so `pg_stat_ssl` does not describe the client-to-Neon TLS leg. The authorized client TLS socket and channel-bound SCRAM mechanism are the applicable transport evidence.

## 7. Read-only and search-path verification

For each endpoint, qualification executed only:

1. `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`;
2. transaction-local `set_config` calls for `search_path`, UTC, `synchronous_commit`, lock, statement and idle-transaction timeouts;
3. target, role, SSL-catalog and schema-baseline `SELECT` statements;
4. `ROLLBACK`;
5. bounded client shutdown.

No `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `GRANT`, `REVOKE` or migration statement ran.

Both endpoints reported:

- `transaction_read_only=on`;
- `transaction_isolation=repeatable read`;
- `search_path=pg_catalog`.

The existing schema baseline remains absent (`watchdog_pg` and its migration table are not present); no schema preparation was authorized.

## 8. Reader qualification

**NOT VERIFIED.**

Stage 1D intentionally did not inspect or authenticate reader URLs. The `watchdog_reader` password was left unchanged. Prior stages found that the local reader URLs did not contain a working reader credential, but Stage 1D neither reconfirmed nor attempted to remediate that condition.

No conclusion about direct-reader or pooled-reader transport, authentication, TLS, grants or runtime behavior is made by this report.

## 9. Local verification

Relevant local tests were rerun against the Stage 1C source:

| Check | Result |
| --- | --- |
| `test/postgres-config.test.ts` | PASS |
| `test/postgres-connection.test.ts` | PASS |
| Combined focused tests | **50/50 passed** |
| TypeScript `--noEmit` | PASS |
| Targeted ESLint | PASS |

The production build used for the remote parser was the successful Stage 1C build. Stage 1D changed no application source or generated output.

## 10. Files changed in Stage 1D

Added only:

- `docs/NEON-STAGE-1D-WRITER-QUALIFICATION.md`

No source, test, migration, configuration or build file changed during Stage 1D.

Qualification evidence containing no secret values is retained outside the workspace at:

`[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/neon-stage1d-14354d1a/writer-qualification.json`

## 11. Remaining blockers and risks

1. Reader direct and pooled authentication remain unverified.
2. Full runtime integration requires two distinct working roles on the same endpoint/database.
3. The required `watchdog_pg` schema, migration history, 15 tables, identity/lease rows and runtime grants remain absent.
4. TEMP privilege policy remains a separate unapproved decision.
5. Migration authority, credential custody and one-use attempt controls remain unresolved A4 gates.
6. Native PostgreSQL 17 integration cannot currently be rerun on this host without approved local binaries.
7. Backup/restore, Free-plan operational capacity, scheduler and deployment remain unqualified.

## 12. Recommendation

**GO for writer-only connection compatibility on the `a4-migration-test` branch.** Both direct and pooled writer connections meet the Stage 1D TLS, channel-binding, identity, read-only, search-path and shutdown requirements.

**NO-GO for full application integration or production readiness.** Reader qualification and all schema/provisioning gates remain outstanding.

Stage 2 is not authorized or started.
