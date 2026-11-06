# Neon Stage 2E — PostgreSQL 17 Preparation

**Completed:** 2026-11-05  
**Scope:** local fixture cleanup hardening and verified PostgreSQL 17 binary preparation  
**Recommendation for Stage 2F:** **CONDITIONAL GO**

## 1. Safety boundary

Stage 2E did not initialize or start PostgreSQL, create a cluster/database, run migrations, connect to Neon, alter WSL, install a Windows service, modify persistent environment variables, deploy, schedule or notify.

The only extracted executables run were the four approved `--version` commands. `WATCHDOG_PG_TEST_BIN` was supplied only to one non-native test child process and was not persisted.

## 2. Fixture cleanup changes

Changed:

- `test/fixtures/postgres.ts`
- added `test/postgres-fixture-cleanup.test.ts`

No production application source or migration changed.

### 2.1 Lifecycle controller

The native fixture now uses an idempotent `PostgresFixtureCleanup` controller that owns:

- exactly one `mkdtemp` directory under `%TEMP%\opencode` whose basename must begin `watchdog-phase10-pg-`;
- exactly its `data` child directory;
- its admin connection;
- every application database/pool created by the fixture;
- startup-attempt and known-started state;
- one memoized cleanup promise.

Unsafe cleanup paths are rejected before any recursive removal.

### 2.2 Startup and partial initialization

- Failures before a startup attempt remove only the unique fixture directory.
- Immediately before `pg_ctl start`, the fixture records `startupAttempted=true`.
- Only a successful `pg_ctl start` records `serverStarted=true`.
- If startup fails ambiguously, cleanup runs `pg_ctl -D <exact fixture data> status`.
- Status exit 3 is treated as definitively not running.
- If status proves the fixture server is running, cleanup stops it with the same exact `-D` path before removal.
- Any other status failure is uncertain and prevents recursive deletion.

No process-name kill, global service stop or unrelated PostgreSQL termination is used.

### 2.3 Guaranteed failure cleanup

The complete initialization is wrapped so failures during:

- executable/version checks;
- port allocation;
- `initdb`;
- server startup;
- database creation;
- writer role creation;
- reader role creation;
- admin connection/setup;

all invoke the same cleanup controller before the failure escapes.

Database and role creation are now separate statements so their failure stages are attributable. The temporary setup pool is always ended. If both setup and setup-pool cleanup fail, both failures are retained.

### 2.4 Migration and test setup failures

`reset()` now guards pool close, schema reset, migration application, synthetic-clock setup and grants. Any failure closes remaining pools/admin, stops the exact fixture server and removes the owned directory when safe.

Clock, production-clock and restart helper failures use the same guard. Restart updates known stopped/starting/started state around `pg_ctl` operations.

### 2.5 Normal completion and repeated cleanup

Normal `close()`:

1. closes every registered application database/pool;
2. closes the admin connection;
3. stops the exact fixture server;
4. removes only the validated fixture directory.

Repeated calls return the same cleanup promise and do not repeat stop/delete operations.

### 2.6 Failure preservation

If cleanup succeeds, the initiating error object is rethrown unchanged.

If cleanup also fails, an `AggregateError`:

- uses the initiating error as `cause` and first error;
- retains the nested cleanup failures;
- refuses directory deletion when server stop/running state is unsafe.

Thus cleanup diagnostics are available without replacing or hiding the original failure.

## 3. Adversarial cleanup tests

New tests cover:

1. partial initialization before startup;
2. startup failure with status proving no server;
3. startup failure where status discovers a running server;
4. database-creation failure;
5. role-creation failure;
6. migration failure;
7. test-setup failure;
8. test-execution failure;
9. normal completion;
10. repeated idempotent cleanup;
11. stop/cleanup failure with original-error preservation and no unsafe delete;
12. rejection of a directory outside the fixture-owned temporary root.

The parameterized failure test accounts for five independently named stages; Vitest reports **11 test cases** in the cleanup file.

Focused cleanup/configuration/driver run:

- 3 files, **61/61 passed**.

Final requested local run:

- cleanup tests;
- PostgreSQL configuration tests;
- PostgreSQL connection tests;
- mocked A4 qualification safety tests;
- 4 files, **88/88 passed**.

The native integration suite was intentionally not run.

## 4. Archive source and identity

Official archive URL:

`https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip`

Publisher checksum URL:

`https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip.sha256`

Archive staging path outside the repository:

`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\neon-stage2e-6f90f02a\download\postgresql-17.11-5-windows-x64-binaries.zip`

Archive size: **381,531,864 bytes**.

### Checksum verification

| Source | SHA-256 |
| --- | --- |
| Expected task value | `80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f` |
| Locally calculated archive digest | `80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f` |
| Publisher checksum file | `80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f` |

All three values match exactly. Extraction did not begin until this verification passed.

The first PowerShell `Expand-Archive` attempt exceeded the harness timeout and was treated as incomplete. A ZIP inventory found 2,739 missing files. No extractor remained running. Only the dedicated Stage 2E extraction directory was removed, recreated and extracted with Windows `bsdtar`.

Final extraction validation compared every non-directory ZIP entry to the target:

- ZIP entries: 22,033;
- files: 20,489;
- directory entries: 1,544;
- expected uncompressed file bytes: 1,002,085,601;
- missing files: 0;
- length mismatches: 0.

## 5. Extracted binary paths, versions and hashes

Extraction root:

`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\liquidation-watchdog-pg17\`

Fixture bin path:

`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\liquidation-watchdog-pg17\pgsql\bin`

| Binary | Version | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `postgres.exe` | `postgres (PostgreSQL) 17.11` | 9,939,456 | `f5dbfd059f8088b9511a02fc014e659369996fc7d3e88e47658b1cfa2fbb02d2` |
| `initdb.exe` | `initdb (PostgreSQL) 17.11` | 245,248 | `d385519a50d2cd5e143e86c2c10acfe0d44d3039d714c8211b804011bca2409f` |
| `pg_ctl.exe` | `pg_ctl (PostgreSQL) 17.11` | 132,096 | `9885ac53af9d67c76c1ddde87c19e6b15539d7c482bca70cd5ead5dad0b7ce3c` |
| `psql.exe` | `psql (PostgreSQL) 17.11` | 635,392 | `c290c7f0a3335f290f8c18011a1e5afa03ee3cdd628697a5f3e767e5f1d3d10d` |

All four version commands exited successfully and reported PostgreSQL 17.11.

No other binary was executed.

## 6. Environment-variable handling

No user or machine environment variable was changed.

For the final non-native test child only, the process environment contained:

```text
WATCHDOG_PG_TEST_BIN=[REDACTED_LOCAL_PATH]\AppData\Local\Temp\liquidation-watchdog-pg17\pgsql\bin
```

That test set did not import/run the native integration fixture. The value ceased to exist when the child process ended.

Stage 2F should inject the same path into only the native integration test process.

## 7. Local verification results

| Check | Result |
| --- | --- |
| Adversarial cleanup tests | PASS |
| PostgreSQL configuration tests | PASS |
| PostgreSQL connection tests | PASS |
| Mocked A4 safety tests | PASS |
| Final selected tests | **88/88 passed** |
| TypeScript `--noEmit` | PASS |
| Full ESLint | PASS |
| Production build | PASS |
| Native PostgreSQL integration suite | **NOT RUN by restriction** |

No server, data directory or database was created by these tests.

## 8. Remaining blockers and cautions

1. The native integration suite has not yet proven that the extracted archive can initialize/start on this host.
2. Antivirus, DLL/runtime availability, locale and Windows permissions may still affect `initdb`/startup.
3. Fixture cleanup should be observed under real startup, migration, restart and process-kill paths in Stage 2F.
4. Reader Neon credentials, A4.5 migration authority and remote schema/grants remain unrelated blockers.
5. The extracted directory is temporary preparation material, not a permanent installation or approved production runtime.
6. No persistent PATH or `WATCHDOG_PG_TEST_BIN` configuration exists.

## 9. Stage 2F recommendation

**CONDITIONAL GO** for a separately authorized Stage 2F local native PostgreSQL 17 integration run.

Stage 2F should:

1. use only the verified bin directory through a child-process `WATCHDOG_PG_TEST_BIN`;
2. redirect TEMP/TMP to a dedicated external audit directory;
3. run only `test/integration/postgres.test.ts` with `vitest.integration.config.ts`—not the live integration test;
4. monitor exact fixture processes/directories and verify cleanup after success/failure;
5. record PostgreSQL version, test counts, process state and preservation hashes;
6. make no Neon connection or remote/database change.

Stage 2F was not started.
