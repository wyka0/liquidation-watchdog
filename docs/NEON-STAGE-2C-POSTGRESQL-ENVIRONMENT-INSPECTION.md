# Neon Stage 2C — Native PostgreSQL 17 Environment Inspection

**Inspected:** 2026-11-05  
**Authorization:** read-only environment inspection  
**Environment classification:** **UNKNOWN overall** — Windows is **BLOCKED**; WSL package state is unknown  
**Recommendation:** **NO-GO for running native integration tests now**

## 1. Safety boundary

This stage used only Windows-visible path, directory, service, uninstall-registry and WSL registration/status queries plus repository file inspection. It did not:

- invoke any Ubuntu command;
- start/stop WSL or a service;
- execute any PostgreSQL binary;
- create a database or data directory;
- alter an environment variable;
- install/download/configure software;
- connect to Neon or any PostgreSQL server;
- run migrations or integration tests.

## 2. Windows PostgreSQL findings

### 2.1 PATH

`where` found no instance of:

| Executable | PATH result |
| --- | --- |
| `postgres.exe` | Not found |
| `initdb.exe` | Not found |
| `pg_ctl.exe` | Not found |
| `psql.exe` | Not found |

No version could be recorded because no executable was found or invoked.

### 2.2 Standard installation directories

Absent:

- `C:\Program Files\PostgreSQL`
- `C:\Program Files (x86)\PostgreSQL`
- `C:\PostgreSQL`
- `C:\pgsql`
- `C:\tools\pgsql`
- `D:\PostgreSQL`
- `D:\pgsql`

### 2.3 Services and installed-application registry

- No Windows service with a PostgreSQL/pgsql name or display name was found.
- No PostgreSQL/EnterpriseDB/pgsql uninstall record was found under current-user, 64-bit machine or 32-bit machine uninstall registry roots.

Consequently there is no service executable path or installed version to report.

### 2.4 Known developer-tool locations

| Location | Result |
| --- | --- |
| User Scoop apps | Scoop apps directory absent |
| Chocolatey packages | Chocolatey package directory absent |
| `%LOCALAPPDATA%\Programs` | No PostgreSQL/pgsql entry |
| WinGet package directory | No PostgreSQL/pgsql entry |
| Project `node_modules` | No embedded PostgreSQL/PGlite package or binary |
| Project package manifests | No embedded-postgres, Testcontainers, PGlite or Docker dependency |

### 2.5 Test binary configuration

`WATCHDOG_PG_TEST_BIN` is absent from the current process environment.

The current Windows environment is therefore **BLOCKED**: no suitable native PostgreSQL 17 binary directory is available to the existing fixture.

## 3. WSL2 findings

### 3.1 WSL platform metadata

Windows reports:

| Component | Version |
| --- | --- |
| WSL | 2.1.5.0 |
| Kernel | 5.15.146.1-2 |
| WSLg | 1.0.60 |
| MSRDC | 1.2.5105 |
| Direct3D | 1.611.1 |
| Windows | 10.0.26300.9818 |

Default WSL version is 2. Default distribution is `Ubuntu`.

### 3.2 Registered distributions

| Distribution | WSL version | State | Default UID | Package family |
| --- | ---: | --- | ---: | --- |
| `Ubuntu` | 2 | **Stopped** | 1000 | Canonical Ubuntu package family |
| `Ubuntu-22.04` | 2 | **Stopped** | 1000 | Canonical Ubuntu 22.04 LTS package family |

Registry metadata and `wsl --list --verbose` agree that both distributions are stopped. No distribution was invoked.

### 3.3 PostgreSQL status inside WSL

**UNKNOWN.** Determining whether either distribution contains `postgres`, `initdb`, `pg_ctl` and `psql`, and determining their versions, requires executing a command in that distribution. That would start WSL and is outside Stage 2C authorization.

Even if PostgreSQL 17 exists inside WSL, the current Windows test process cannot directly consume those Linux binaries: `test/fixtures/postgres.ts` appends `.exe` when `process.platform === "win32"`. A WSL option would therefore require a separately approved WSL-native Node/test setup, not merely pointing the Windows process at a Linux `bin` directory.

## 4. Native PostgreSQL binary availability

| Execution environment | Classification | Reason |
| --- | --- | --- |
| Windows native | **BLOCKED** | No binaries, installation, service, package, embedded dependency or configured bin path found |
| WSL `Ubuntu` | **UNKNOWN** | Distribution is stopped; package state not inspected |
| WSL `Ubuntu-22.04` | **UNKNOWN** | Distribution is stopped; package state not inspected |
| Overall current environment | **UNKNOWN / not runnable** | A possible WSL installation cannot be ruled in or out; no currently available bin path can run the fixture |

No exact PostgreSQL binary path or version is available to report.

## 5. Existing integration-test infrastructure

### 5.1 Entry points

- Script: `npm run test:integration`
- Configuration: `vitest.integration.config.ts`
- PostgreSQL suite: `test/integration/postgres.test.ts`
- Fixture: `test/fixtures/postgres.ts`

The integration configuration is serialized:

- one worker;
- no file parallelism;
- 240-second test and hook timeouts.

The configuration also includes `test/integration/live.test.ts`, which performs real chain RPC/MCP reads and writes evidence. A future local PostgreSQL-only run must select `test/integration/postgres.test.ts` explicitly rather than invoking the whole integration script.

### 5.2 `WATCHDOG_PG_TEST_BIN` contract

The fixture accepts no database URL or existing data directory. It requires `WATCHDOG_PG_TEST_BIN` to name a directory containing:

- `postgres.exe`
- `initdb.exe`
- `pg_ctl.exe`

`psql.exe` is useful for operator diagnosis but is not called by the fixture.

The fixture executes `postgres --version` and requires output matching PostgreSQL major 17 before creating anything. On Windows it constructs exact `<bin>\<name>.exe` paths.

### 5.3 Initialization behavior

For a valid approved binary directory, the fixture would:

1. create a unique directory below external `%TEMP%\opencode`;
2. allocate an unused loopback port;
3. run `initdb` with:
   - fixture superuser `watchdog_test_admin`;
   - UTF-8;
   - locale `C`;
   - trust authentication for the disposable cluster;
4. start PostgreSQL bound only to `127.0.0.1` with:
   - the allocated port;
   - `max_connections=16`;
   - `shared_buffers=16MB`;
5. create only database `watchdog_phase10_fixture`;
6. create restricted synthetic writer and reader roles;
7. create/apply the reviewed `watchdog_pg` migrations inside that disposable database;
8. install a test-only synthetic database clock and exact test grants.

No existing user database, cluster or PostgreSQL service is opened or modified.

### 5.4 Required PostgreSQL version/features

- PostgreSQL major 17 is mandatory.
- Production schema/catalog was captured against PostgreSQL 17.11.
- Tests exercise domains, identity sequences, generated stored columns, deferrable foreign keys, partial indexes, JSON validation, SHA-256, row locks, advisory locks, transaction isolation and server timeouts.
- No optional PostgreSQL extension is required. `plpgsql` may exist by default but application functions use `LANGUAGE sql`.

### 5.5 Permissions

The disposable `initdb` superuser performs fixture setup/migrations. The fixture then grants:

- schema `USAGE` and table `SELECT` to reader/writer;
- identity-sequence `USAGE` to writer;
- exact runtime DML to writer;
- `UPDATE` only on `worker_lease` for writer.

The suite verifies that reader writes, runtime DDL/control-table changes, schema creation, sequence mutation, ownership/elevated roles and drifted grants are rejected.

### 5.6 Isolation and cleanup

Positive controls:

- unique external temporary data directory;
- random loopback port;
- no accepted remote URL;
- serialized test execution;
- per-test closure of application pools;
- per-test schema reset/migration within the disposable database;
- suite shutdown via `pg_ctl -m immediate -w stop`;
- recursive deletion limited to the fixture's unique temporary directory.

Tests include server restart, backend termination and killed worker-child recovery.

Cleanup caveat:

If `localPostgresFixture()` throws after PostgreSQL has started but before it returns and assigns `cluster`, the suite's `afterAll` optional close cannot stop that unreturned cluster. One early role-creation failure path explicitly stops PostgreSQL, but later setup/reset failures are not all wrapped by a single outer cleanup guard. Before authorizing execution, Stage 2D should harden or supervise startup so every post-start failure stops the exact fixture process and records/removes the exact temporary directory.

## 6. Qualification decision

### Classification

**UNKNOWN overall, NO-GO to execute now.**

- Windows is conclusively **BLOCKED**.
- WSL package state is **UNKNOWN** because both distributions are stopped and starting them was not authorized.
- No current `WATCHDOG_PG_TEST_BIN` can satisfy the fixture.

This is not `READY`: no four-binary PostgreSQL 17 path has been identified. It is not yet `CONDITIONAL`: no binaries have been proven to exist. If PostgreSQL 17 is found in WSL, that path becomes conditional on a WSL-native Node/dependency/test setup and cleanup review.

## 7. Exact next step

Request separate authorization for **Stage 2D — WSL PostgreSQL Presence Check**, limited to starting one distribution at a time and executing read-only version/path/package-status commands such as:

```text
command -v postgres initdb pg_ctl psql
postgres --version
initdb --version
pg_ctl --version
psql --version
dpkg-query -W 'postgresql-17*' 'postgresql-client-17*'
```

Stage 2D must not start a PostgreSQL server, install/update packages, modify WSL, create a cluster/database, or run integration tests.

If exact PostgreSQL 17 binaries are present, separately decide between:

1. a WSL-native test run with an approved Linux Node/dependency environment; or
2. operator-supplied, checksum-verified Windows PostgreSQL 17 binaries assigned to `WATCHDOG_PG_TEST_BIN` for one test process.

If WSL lacks PostgreSQL 17, do not install automatically. Return to the manually supplied binary or separately approved container/CI options from Stage 2B.

## 8. Recommendation

- Windows native environment: **NO-GO / BLOCKED**.
- WSL environment: **NO-GO pending inspection / UNKNOWN**.
- Current native integration execution: **NO-GO**.
- Next step: separately approve Stage 2D presence/version inspection only.

Stage 2D was not started.
