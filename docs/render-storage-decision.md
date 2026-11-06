# Render storage decision — SQLite versus PostgreSQL

**Decision recommendation: Option A, retain single-owner SQLite.** Use a co-located read interface initially; if separate services are required, the disk owner must be a Render Private Service exposing a restricted internal read-only API. **No database migration, PostgreSQL instance or storage implementation was created in Phase 7.**

Companions: [architecture](render-architecture.md), [deployment and recovery plan](render-deployment-plan.md), [security plan](render-security-plan.md), [Phase 7 report](phase7-report.md). Production approval is **NOT GRANTED**; oracle assurance **UNVERIFIED**, freshness **UNKNOWN**, estimates **indicative / `actionable: false`**.

## 1. Can a Render Web Service share the worker's SQLite file?

**No.** Render explicitly states that a persistent disk is accessible by only one service instance and cannot be accessed by another service. The Web Service and Background Worker have independent filesystems. Matching an absolute path on both instances does not make it the same database.

The application's ownership fence is a separate local SQLite database (`<database>-monitor-lock`) held in a `BEGIN EXCLUSIVE` transaction. It is not a PID marker, distributed lease or network-storage protocol. WAL readers on the same local filesystem can coexist with one owner; cross-host file access is unsupported. See `src/storage/store.ts`, [database operations](database-operations.md) and [production architecture](production-architecture.md).

The Phase 6 [read-only health check](../evidence/phase6/health-during-active-cycle.txt) succeeded while a monitor was active, and [database initialization by a second process](../evidence/phase6/database-init-rejected-during-active-cycle.txt) was refused. This demonstrates cooperating **local** processes, not separate Render instances.

Render Background Workers also receive **no inbound network traffic**, including private traffic. Keeping a disk-backed SQLite owner behind an internal API therefore requires **Private Service (`pserv`)** rather than Background Worker (`worker`). Sources consulted 2026-11-02: [disks](https://render.com/docs/disks), [workers](https://render.com/docs/background-workers), [private networking](https://render.com/docs/private-network), [Private Services](https://render.com/docs/private-services).

## 2. Option A — one SQLite owner, restricted read access

- Keep `node:sqlite`, schema **5**, application ID `0x4c575033`, checksummed migrations, WAL/`synchronous=FULL`, fail-closed schema/content validation, local ownership and transaction/recovery behavior.
- **Initial compact variant:** one Web Service instance contains the monitor and a small authenticated read-only HTTP interface. Reader code uses explicit read-only access and sanitized projections. Public HTTP pressure is a shared failure/resource risk that must be tested.
- **Two-service variant:** one disk-backed `pserv` contains the monitor and restricted internal API; a separate Web Service proxies reads using a distinct server-side bearer credential over the same-region private network. The frontend has no SQLite path, disk mount or database write credentials.
- The internal API returns bounded, versioned, as-of projections. It exposes no start/stop, configuration, database initialization/migration, backup, restore, arbitrary SQL or evidence-file download controls.
- The owner retains exclusive mutation responsibility. Explicit maintenance and writable oracle-audit paths remain operator-controlled; monitoring is not the only writable CLI path. A competing writer must be refused while ownership is held.
- An owner outage interrupts live reads. A separate frontend can remain online with explicitly stale cached results or an unavailable state; it cannot promise fresh observations while the owner is down.

The entrypoint, HTTP/auth layer, bounded history queries, durable runtime-evidence workspace and backup scheduling/transfer are **new Phase 8 work**. Existing SQLite behavior is a tested foundation, not proof that this Render integration already works.

## 3. Option B — PostgreSQL for monitoring state

This would support a genuine Background Worker plus independently deployed Web Service accessing a shared database. Use a writer role for the monitor and a least-privilege read role for the dashboard. PostgreSQL supplies transactions and concurrent connections, but **does not automatically ensure one scheduler or one outbox dispatcher**.

Any later migration design must preserve the following contracts:

| Contract | Required PostgreSQL design / verification |
| --- | --- |
| One monitor owner | Explicit connection-scoped advisory ownership or a correctly fenced lease/epoch. Losing ownership/connection stops writes and dispatch; deployment overlap and reconnect races must be tested. Removing the SQLite file lock without replacement is insufficient. |
| Atomic observation | State revision, cycle/observation, fingerprints, alerts, outbox and assurance updates commit together. Preserve expected-revision checks, isolation and rollback behavior, including ambiguous network failures after commit. |
| Deduplication | Preserve all fingerprint IDs/tombstones and uniqueness constraints; retry by durable identity, never regenerate IDs or reset dedup state during import. |
| Outbox semantics | At-least-once delivery, `(alert, channel)` uniqueness, attempt continuity, in-flight ambiguity, provider blocks/cooldowns and known-delivered retention. A future multiple-dispatcher design requires explicit claiming/fencing; initial migration should keep one. |
| Financial precision | Preserve exact integer/base-unit strings and BigInt arithmetic. Do not round amounts/ratios into floating point or recalculate historical financial results during import. |
| Assurance continuity | Preserve hashes, context, monotonic baseline/evaluation time and sticky invalidation. Keep original serialized evidence text where hashes depend on bytes; JSONB key reordering must not silently change JSON-based identities. |
| Migrations | Design a separate PostgreSQL schema/migration history with checksums and an explicit SQLite-to-PostgreSQL mapping. Retain original SQLite migration evidence; do not relabel its SQL as a verified PostgreSQL migration. |
| Evidence storage | Provide durable immutable storage for referenced bundles/reviewed artifacts and verify hashes and path/identity mappings. Moving table rows alone does not preserve the evidence chain. |
| Backup/recovery | Managed database backup/PITR plus coordinated evidence/release/config recovery. Re-prove restart behavior, rollback compatibility, isolated restore and post-backup notification reconciliation. Existing SQLite backup commands cannot back up PostgreSQL. |

Cutover, if separately approved later: fence the SQLite writer and external channels → create/verify a complete backup → import into an isolated candidate → compare counts, identities, original JSON/evidence hashes and replay invariants → exercise failure/reconnect/restore → accept one new writer. Preserve the old store and explicit rollback limits. No dual active writers or automatic in-place conversion is proposed here.

## 4. Comparison

| Dimension | Option A — single-owner SQLite | Option B — PostgreSQL |
| --- | --- | --- |
| Implementation complexity | Reuses the storage implementation and backups. New entrypoint, read-only access, persistent-evidence bootstrap and owner-local backup automation still need work. | New driver, schema/migrations, transaction/error/connection behavior, ownership, tests, migration and recovery tooling. Financial modules can remain, but current storage tests do not qualify the new backend. |
| Operational reliability | Small topology with existing fail-closed local locking and restart recovery. One owner/disk is a failure domain; disk-backed deploys have downtime. | Managed datastore operations and independent application deploys; adds network, pool/connection-limit, maintenance and lease-loss failure modes. Availability depends on the selected database configuration, not the word “managed.” |
| Cost | Initial example: $25 service + $5 for 20 GB disk = **$30/month**; split-service example from **$37**. Off-disk backups/workspace/usage extra. | Illustrative worker $25 + web $7 + 1 GB Postgres compute $19 = **$51/month before DB/evidence storage**. Smaller paid database tiers exist; actual capacity is unqualified. See [cost details](render-deployment-plan.md). |
| Data durability | WAL/FULL and validation provide application-level consistency; durable fsync/storage-fault behavior must be accepted on Render. One disk is not independent recovery protection. | Managed backup/PITR is a real benefit; selected plan/retention/failover and transaction semantics still require validation. Migration correctness and durable evidence are additional obligations. |
| Backup and recovery | Existing online-backup + evidence manifest + isolated-restore mechanisms. Owner-local execution and verified off-disk copies required; raw disk snapshots are not the database recovery procedure. | New database backup/restore procedure plus evidence/release coordination. PITR can rewind delivery acknowledgments; post-restore reconciliation remains necessary. |
| Concurrency | Many short read-only accesses on the owner; one writer. Read cache/internal API can absorb viewers. Synchronous SQLite work and slow readers need load/WAL tests. | Many connections/read roles and potential scaling. One monitor owner and coherent projections still require explicit design. |
| Failure recovery | Existing interrupted-cycle closure, ambiguous-attempt handling and known-delivered retention are verified locally. New HTTP/bootstrap/Render failure paths are not. | Those same guarantees must be re-proven for network failures, transactions, lease loss and restore/cutover. |
| Future scalability | Appropriate starting point for one market/account. A separate frontend/cache is possible without migrating. Disk owner cannot horizontally scale. | Better fit when independently scalable persistence, higher write concurrency or stronger availability requirements justify the additional work. |

Render [pricing](https://render.com/pricing) and [free-instance limits](https://render.com/docs/free), consulted 2026-11-02: free Postgres expires after 30 days and has a 1 GB cap; it is unsuitable for durable continuous monitoring. Compare **paid** PostgreSQL with disk-backed SQLite fairly, including managed recovery benefits and evidence costs.

## 5. Recommendation and revisit criteria

**Choose Option A now**, with Topology 1 as the initial footprint and Topology 2 when process/public-surface isolation or independent frontend deploys are required. This minimizes changes to the verified storage contracts for the actual one-position workload. Phase 6's database was about 1.3 MB after 12 cycles; synthetic runs and local reads have not demonstrated a need for a client-server database. They also do not establish long-term growth or an HTTP-capacity limit.

Revisit Option B when measurements or requirements show a need for independently available stored data during owner replacement, substantially more write/query concurrency, multiple monitor owners with explicit partitioning/fencing, or managed database recovery/availability features worth the migration cost. More viewers or a separately deployed dashboard alone do **not** force PostgreSQL: bounded reads, caching and the Private Service API may suffice.

A true Background Worker could alternatively push versioned projections outward, but that creates a replication/retry/order/staleness protocol and durable destination absent today. It is not a shared SQLite volume and is not selected for Phase 8's minimal proposal.

No storage choice establishes oracle validity or financial safety. Source economics/operators remain unverified, upstream freshness unknown, and RPC/MCP agreement is not independent validation. All recovery calculations remain **indicative and non-actionable**.
