# A3 — Neon Free setup preparation

**DRAFT-UNAPPROVED-NOT-DEPLOYED.** This is a future operator checklist, not evidence that a Neon account, project, branch, role, database or connection exists. A3 performed no Neon login, API call, SQL connection, schema migration or SQLite import.

## 1. Prepared application contract

The application uses the existing pinned `pg@8.23.1` implementation and explicit SQL. It requires **PostgreSQL 17**, one database, one namespace and three different capability classes:

| Capability | Runtime placement | Connection type |
| --- | --- | --- |
| Migration/role operator | Approved external operator runner only | Direct Neon endpoint; never Render or Worker runtime configuration. |
| Runtime writer | Render secret `WATCHDOG_POSTGRES_WRITER_URL` | Neon pooled endpoint for the restricted writer role. |
| Runtime reader | Render secret `WATCHDOG_POSTGRES_READER_URL` | Same pooled host/port/database as writer, but a distinct restricted reader role. |

The runtime URL parser accepts only `postgres:`/`postgresql:`, a DNS hostname, explicit username/password, a bounded database name, and reviewed TLS parameters. The recommended Neon form uses `sslmode=verify-full` and may include `channel_binding=require`; the parser maps that to node-postgres channel binding and always sets certificate verification (`rejectUnauthorized: true`). It rejects localhost, URL credentials in logs, unknown query options, duplicate TLS/channel-binding options, fragments and permissive SSL modes.

The runtime creates two lazy pools, maximum **one connection per role**, minimum zero, three queued admissions, 5-second connect/idle/close bounds, 60-second maximum connection lifetime and bounded server/client statement/transaction timeouts. This is compatible with Neon's transaction-mode pooled endpoint: SQL is schema-qualified and transaction-local `set_config` is used; there are no session advisory locks, `LISTEN/NOTIFY`, temporary tables or session-persistent state.

## 2. Future manual account/project steps (not executed)

Only after separate provisioning approval:

1. Create or select a **Neon Free** account without enabling a paid plan or payment-backed overage.
2. Choose a region after comparing it with the approved Render region; record the exact project/region/branch/compute identity. No region is selected in this repository.
3. Create one root branch and select **PostgreSQL 17**. The runtime refuses a different major.
4. Keep Free scale-to-zero enabled (mandatory after five minutes of inactivity) and keep compute/autoscaling within the approved Free allowance.
5. Through an approved direct operator connection, create separate non-owner login roles for writer and reader. Never use the Neon project owner in Render.
6. During the separately approved A4 maintenance window, run the two checksummed PostgreSQL migrations explicitly and verify the production catalog fingerprint before granting runtime access. **Startup never runs migrations.**
7. Grant the reader `USAGE` on `watchdog_pg` and `SELECT` only on reviewed tables. Grant the writer the reviewed `SELECT`, table DML, sequence `USAGE`, and `worker_lease` update privileges documented by the Phase 10 fixture. Deny schema `CREATE`, ownership, role/database creation, replication, bypass-RLS, control-table DML and sequence update.
8. Obtain pooled connection strings separately for those two roles. Place them only in Render secret environment configuration under the two names above. Do not paste them into source, Blueprint, documentation, tickets, logs or Worker configuration.
9. Retain the direct operator URL outside Render and outside the repository for migration/dump/restore only.
10. Run role/catalog/TLS/wrong-host checks from an approved target before setting `WATCHDOG_SCHEDULER_ENABLED=true`.

No real SQLite rows are imported by this checklist. A4 must name the authoritative source, maintenance window, parity evidence, rollback boundary and monitoring gap before any import.

## 3. Environment names (values never committed)

- `WATCHDOG_POSTGRES_WRITER_URL`
- `WATCHDOG_POSTGRES_READER_URL`
- `WATCHDOG_POSTGRES_NAMESPACE`
- `WATCHDOG_STORAGE_BACKEND`

The Render process also needs the read and scheduler credentials described in [Render setup](a3-render-setup.md). Cloudflare never receives either database URL and never connects to Neon.

## 4. Free-plan limits and stop conditions

Official Neon plan documentation reviewed **2026-11-04** states: Free costs $0/month; 100 CU-hours/project/month; mandatory scale-to-zero after five idle minutes; up to 2 CU autoscaling; 1 GB PostgreSQL storage/project and 20 GB total/account; 5 GB public network transfer/project/month; 10 branches/project; one day of monitoring; six hours of history with at most 1 GB of changes; and one manual snapshot. Free has no uptime SLA and community support only.

- CU-hour or public-network-transfer exhaustion suspends compute until the next period or an upgrade. This application must surface database unavailability; it must not fall back to SQLite or cached JSON.
- Storage-cap exhaustion can make storage-increasing inserts, updates **and deletes** fail. The application stops admission at `pg_database_size >= 800,000,000` bytes, but catalog/history/snapshot overhead still requires operator headroom and measured alerts.
- Scale-to-zero can make the first connection slow or stale. The lazy pool serializes bounded reconnect attempts and discards failed sockets. A wake failure produces sanitized unavailability and no synthetic observation.
- The six-hour history and one manual snapshot are same-provider aids, not the independent backup required by A5.

At five-minute cadence there are 8,640 nominal invocations in a 30-day month (8,928 in 31 days). If each invocation keeps a 0.25-CU compute active for the full five-minute interval, monthly use is approximately **90 CU-hours for 30 days / 93 CU-hours for 31 days**, before dashboard, maintenance, retry or backup activity. This narrow theoretical margin must be measured; it is not a capacity approval.

Sources: [Neon plans](https://neon.com/docs/introduction/plans), [secure connections](https://neon.com/docs/connect/connect-securely), [connection pooling](https://neon.com/docs/connect/connection-pooling), and [network transfer](https://neon.com/docs/introduction/network-transfer).

## 5. Setup acceptance gate

Provisioning is incomplete until a future record binds: account/project/region/branch/PG-major identities; exact role grants; pooled/direct endpoint classifications (without URL values); TLS/channel-binding tests; catalog fingerprint; Free usage limits; initial database size; and proof that Render cannot perform DDL. Applying migrations or importing data belongs to A4, not A3.
