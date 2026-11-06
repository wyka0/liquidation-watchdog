# Neon Stage 2D — WSL PostgreSQL Presence Check

**Inspected:** 2026-11-05  
**Authorized distribution:** `Ubuntu-22.04` only  
**Recommendation for native PostgreSQL testing:** **NO-GO / BLOCKED**

## 1. Safety boundary

This stage started `Ubuntu-22.04` solely to run the approved read-only executable-presence, version and package-status commands. It did not:

- invoke the other `Ubuntu` distribution;
- install, update, upgrade or remove a package;
- start a PostgreSQL server;
- initialize a cluster;
- create or connect to a database;
- change WSL configuration;
- connect to Neon or any remote service.

`Ubuntu-22.04` was stopped before inspection and was terminated after inspection. Both registered distributions were confirmed stopped at the end.

## 2. Preflight distribution state

Windows-visible WSL registration before inspection:

| Distribution | Version | Initial state | Inspected internally? |
| --- | ---: | --- | --- |
| `Ubuntu` | WSL2 | Stopped | **No** |
| `Ubuntu-22.04` | WSL2 | Stopped | **Yes, authorized command set only** |

The default distribution is `Ubuntu`, but it was not started or inspected.

## 3. Executable findings in `Ubuntu-22.04`

| Command | `command -v` result | Version result |
| --- | --- | --- |
| `postgres` | Not found | Not available |
| `initdb` | Not found | Not available |
| `pg_ctl` | Not found | Not available |
| `psql` | Not found | Not available |

There are no executable paths or PostgreSQL versions to report.

The first inspection invocation suffered Windows-to-shell quoting errors and produced no valid command result. It executed no PostgreSQL or package-management operation. The approved inspection was repeated from a temporary script containing only the authorized commands; the table above reflects the valid result.

## 4. Package-status findings

Read-only `dpkg-query -W` checks for `postgresql*` and `libpq*` found no installed PostgreSQL server, client or libpq package.

One package-selection record named `postgresql-pgmp` was returned with status:

```text
unknown ok not-installed
```

It is not installed and does not provide a usable PostgreSQL server/client environment.

No package installation/update command was run.

## 5. PostgreSQL 17 assessment

PostgreSQL 17 is **not installed or available** in the authorized `Ubuntu-22.04` distribution based on:

- all four executable lookups failing;
- all four version commands being unavailable;
- no installed PostgreSQL/libpq package in the approved package-status query.

Classification for `Ubuntu-22.04`: **BLOCKED**.

Combined with Stage 2C Windows findings, no native PostgreSQL 17 environment is currently available on the host.

## 6. WSL-native Node.js test compatibility

The PostgreSQL binaries are absent, so the integration suite cannot run in this distribution regardless of Node.js availability.

Node.js/npm/package state was not inspected because Stage 2D authorized only PostgreSQL executable/version/package queries.

If PostgreSQL 17 were later supplied inside WSL, the current Windows-native test harness would still require a separate Linux-native setup:

- run Node/Vitest inside WSL so `process.platform` is Linux and fixture paths do not append `.exe`;
- provide Linux PostgreSQL 17 `bin` through `WATCHDOG_PG_TEST_BIN` for that WSL process;
- provide a reviewed Linux Node runtime and Linux-compatible dependencies;
- keep external TEMP, loopback isolation and cleanup supervision;
- invoke only `test/integration/postgres.test.ts`, not the live-chain integration file.

No such setup was created.

## 7. Cleanup verification

After inspection, Windows successfully terminated only `Ubuntu-22.04`.

Final state:

| Distribution | Final state |
| --- | --- |
| `Ubuntu` | Stopped |
| `Ubuntu-22.04` | Stopped |

No service or PostgreSQL process was started, so no database-process cleanup was necessary.

## 8. Qualification decision

- PostgreSQL 17 installed in `Ubuntu-22.04`: **No**.
- Complete binary set (`postgres`, `initdb`, `pg_ctl`, `psql`): **No**.
- Usable by WSL-native tests now: **No**.
- Usable by current Windows fixture now: **No**.
- Environment classification: **BLOCKED**.
- Recommendation: **NO-GO** for native PostgreSQL integration execution.

## 9. Exact next step

Do not install automatically and do not inspect/start the other Ubuntu distribution without separate authorization.

The next decision must select one separately approved source of PostgreSQL 17 binaries:

1. operator-supplied, checksum/provenance-verified Windows PostgreSQL 17 binaries for the existing `WATCHDOG_PG_TEST_BIN` fixture; or
2. separately approved PostgreSQL 17 installation in `Ubuntu-22.04` plus a reviewed WSL-native Node/dependency/test setup; or
3. separately approved pinned container/CI PostgreSQL 17 environment.

The most direct fit for the existing test harness is option 1. Before execution, harden/supervise fixture cleanup for every post-start failure path identified in Stage 2C.

No later stage was started automatically.
