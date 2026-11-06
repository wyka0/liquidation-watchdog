# PostgreSQL schema reference (Phase 10)

**Status: local implementation only.** This schema has been created and exercised exclusively on disposable local PostgreSQL 17 test clusters. **No Neon account, no managed deployment and no production database exists.** This document describes the reviewed schema that the runtime requires; it does not authorize provisioning or cutover (Phase 9 approvals A2–A8 remain open).

## 1. Schema placement and isolation

Everything lives in one dedicated schema `watchdog_pg`, created only by [explicit maintenance migrations](postgres-operations.md#5-migrations). The runtime never creates, drops, or edits schema objects; it verifies the schema against the reviewed catalog fingerprint at open and refuses all work on any drift.

- Driver: **`pg` (node-postgres) 8.23.1** (types `@types/pg` 8.23.1), pinned in [package.json](../package.json). Explicit parameterized SQL only; no ORM, no text interpolation of data values.
- Catalog fingerprint over the complete runtime-visible catalog (columns, domains, functions, tables, indexes):

| Fingerprint | Scope |
| --- | --- |
| `24b4fea1efeab7c49999dd693f59ddc9aa776bcb4d4e262185978c9630c80ba3` | **Production** schema (real database clock) — the value compiled into the reviewed code. |
| `6243896b2824191f9c8fa63dda3fbdf0c050b0e4527a6eae7899078e9a59d3cb` | **Disposable test fixture** schema that adds an administrator-owned synthetic clock function; never deployed. |

A mismatch is `STORE_SCHEMA_DRIFT`: the process refuses reads, writes and scheduling instead of repairing anything. Tests additionally reject runtime grant drift (schema `CREATE`, table/column `UPDATE`, control-table columns, sequence `UPDATE`) that would let runtime roles alter the reviewed schema.

## 2. Value domains

| Domain | Meaning |
| --- | --- |
| `identifier` | Text identifiers `^[a-zA-Z0-9_-]{1,100}$`, binary collation. |
| `digest` | Lowercase SHA-256 hex `^[a-f0-9]{64}$` — scope, cycle, execution and object hash identifiers. |
| `uint_text` | Canonical unsigned decimal TEXT `^(0|[1-9][0-9]{0,77})$` up to 78 digits — every financial amount, ratio, LTV and block number. Exact BigInt math round-trips through these strings; no numeric, float or JSONB reserialization is used for financial values. |
| `utc_text` | Original UTC text `YYYY-MM-DDTHH:MM:SS(.ffffff)Z` with lossless microsecond semantics; canonical six-digit text is preserved byte-for-byte. |
| `object_text` | Hash-sensitive original JSON stored as TEXT (`json_typeof` object, ≤1,048,576 bytes at the domain, smaller per-column limits). JSON is never re-serialized; bytes and their SHA-256 must agree. |
| `delivery_status` | `PENDING, IN_FLIGHT, DELIVERED, FAILED, RETRY_SCHEDULED, PERMANENTLY_FAILED`. |
| `channel` | `console, telegram, discord`. |

Time has two representations. Every persisted timestamp is original `utc_text` plus a generated `*_ts timestamptz(6)` projection via `utc_value(utc_text)` for interval/index work. Future deadlines use database time: `clock_now()` (volatile) returns `clock_timestamp()`. Host clocks never define admission, claim deadlines or retention; tests prove admission boundaries hold under host-clock skew and after server restart.

## 3. Tables

Fifteen tables in `watchdog_pg`, matching the SQLite schema 5 responsibilities plus Phase 10 scheduling/identity:

| Table | Purpose |
| --- | --- |
| `schema_migrations` | `(version integer PK, checksum text, applied_at timestamptz(6) NOT NULL DEFAULT clock_timestamp())`. Checksummed independent lineage (two migrations); the SQLite five-migration history and `user_version` are untouched. |
| `cycles` | One row per monitoring cycle: `scope digest`, `started_at/observed_at/completed_at` plus `_ts` projections, `status text CHECK (RUNNING, PERSISTED, COMPLETED, INTERRUPTED)`, `accepted smallint`, `observation_json object_text ≤262,144 bytes` + `observation_sha256`, `block_number uint_text`, `block_hash`, `snapshot_id` (`sha256:<hex>`), `math_state`, `data_quality`, `oracle_quality`, `safety_ratio`, `ltv uint_text`, `actionable smallint CHECK (actionable=0)` (only non-actionable estimates are ever persisted), `duration_ms bigint ≤ 2^53-1`. Check-invariants force `PERSISTED` to have an accepted observation and terminal statuses to have `completed_at`. `UNIQUE(id,scope)` backs stream references. `stable_seq` identity preserves rowid-ordering/historical pagination order. |
| `streams` | Current state fork: `scope digest PK`, `revision bigint 0..2^53-1`, `state_json + state_sha256`, `latest_cycle`, `last_accepted_cycle` — both FK-referenced cycles. Revision-conditional upserts enforce transition serialization. |
| `fingerprints` | Alert dedup tombstones: `fingerprint digest PK`, `created_at utc_text`. `[ON CONFLICT DO NOTHING]` inserts make alerts exactly-once per fingerprint; never pruned. |
| `alerts` | Persisted alert rows: `id PK`, `stable_seq`, `fingerprint UNIQUE → fingerprints`, `cycle_id,scope → cycles`, `created_at(+_ts)`, `severity CHECK (INFO, WARNING, CRITICAL, BOUNDARY)`, `category CHECK (RISK, DATA_QUALITY, ORACLE, MONITOR_HEALTH)`, `alert_json ≤262,144 bytes + alert_sha256`. |
| `deliveries` | |Outbox rows: `id PK`, `stable_seq`, `alert_id → alerts ON DELETE CASCADE`, `channel`, `status`, `attempts 0..10`, `next_at(+_ts)`, `last_error` from the allowlisted set, `ambiguous 0/1` stickiness, and `IN_FLIGHT` claim columns `(claim_owner, claim_fence, claim_incarnation, claim_deadline)` with `CHECK((status='IN_FLIGHT')=(claim_owner IS NOT NULL))` and all-or-nothing claim nullability. `UNIQUE(alert_id,channel)`. |
| `delivery_attempts` | Per-attempt audit trail: `PK(delivery_id,attempt) → deliveries CASCADE`, `started_at`, `completed_at`, `outcome CHECK (IN_FLIGHT, DELIVERED, FAILED)`, `error_code` allowlist (e.g. `ATTEMPT_INTERRUPTED`), claim identity owner/fence/incarnation. `CHECK((outcome='IN_FLIGHT')=(completed_at IS NULL))`. |
| `delivery_events` | Ordered status events per delivery: `id identity PK`, `delivery_id → deliveries CASCADE`, `occurred_at`, `status`. |
| `provider_limits` | Channel-wide cooldown/blocking: `channel PK`, `next_at`, `blocked 0/1`. Whole-provider cooldown never shortens an existing `retryAfter`. |
| `oracle_assurance` | Assurance continuity: `id PK`, `stable_seq`, `evaluated_at(+_ts)`, `context CHECK (^LIVE$|FIXTURE|HISTORICAL-[0-9]+$)`, `result_json ≤262,144 + result_sha256`, optional `bundle_path`/`manifest_sha256` evidence binding (paired by check). |
| `worker_runtime` | Single-row runtime status/diagnosis: `id=1`, `runtime_json ≤32,768 bytes`. |
| `operational_events` | Bounded(100) operator event log with an allowlisted `code` set (`CYCLE_TIMEOUT`, `READ_CANCELLED`, `RESOURCE_*`, `WORKER_FAILED`, ...), auto-pruned on insert. |
| `database_identity` | Migration 2. `id=1`, `backend='liquidation-watchdog-pg'`, `namespace` (`^[a-z0-9][a-z0-9_-]{0,63}$`), `incarnation uuid` — a fresh incarnation is minted only by explicit maintenance; runtime writers are fenced by it. |
| `worker_lease` | Migration 2. `id=1`, `incarnation → database_identity DEFERRABLE (lease row seeded with the first incarnation)`, `fence bigint ≥0`, `(owner, expires_at, deadline_at, current_execution)` all-or-nothing, `deadline_at ≤ expires_at`, `high_water_slot timestamptz(6)` — replay protection for schedule slots. |
| `scheduled_executions` | Migration 2. Durable slot receipts: `id digest PK`, `namespace`, `schedule='morpho-30m-v1'`, `slot utc_text UNIQUE(namespace,schedule,slot)`, `cycle_id UNIQUE → cycles ON DELETE CASCADE`, admitting `(owner, fence>0, incarnation)`, `started_at/completed_at timestamptz(6)`, `status CHECK (RUNNING, COMPLETED, FAILED, INTERRUPTED)`, `accepted boolean`, `missed_slots ≥0`, `receipt_json object_text ≤4,096 bytes` with `CHECK((status='RUNNING')=(receipt_json IS NULL))`. |

Indexes (including partial and generated-column-friendly ones): `cycles_scope_time`, `cycles_history` (observed rows), `cycles_unfinished`, `cycles_retention` (terminal completed), `alerts_history`, `alerts_time`, `alerts_cycle`, `deliveries_due`, `deliveries_alert`, `delivery_events_delivery`, `assurance_context_time`, `assurance_time`, `streams_latest_cycle`, `streams_accepted_cycle`, `executions_slot`.

## 4. Roles and privileges

The runtime requires **separate writer and reader roles** and refuses privileged connections:

- `verifyRole(writer)` checks the writer role against a control set: `USAGE` on the schema, but **no** schema-level `CREATE`, **no** owner/regress membership, `SELECT,INSERT,UPDATE,DELETE` plus `USAGE` on all sequences for the three runtime-mutated tables families, column-level `UPDATE` grants only (`streams.state_json…`, `scheduled_executions.completed_at,status,accepted,missed_slots,receipt_json…`), and `INSERT`/`UPDATE(applied_at)` denial on `schema_migrations` and other control tables. Table/sequence grants are re-derived at open; drift is refused.
- `verifyRole(reader)` checks read-only behavior: `SELECT`-only on all tables, **no** `UPDATE/INSERT/DELETE`, no column-update privileges anywhere (including `schema_migrations.applied_at`), `SELECT` on sequences, and `USAGE` on the schema.
- Connection strings must be DNS-hostnames with username, password, `sslmode=require|verify-full` only; TLS is always `rejectUnauthorized: true`; no URL-supplied TLS files and no localhost.

Catalog drift, identity mismatch (`POSTGRES_IDENTITY`), non-PostgreSQL-17 servers (`POSTGRES_VERSION`) and role drift are hard stops. See [operations](postgres-operations.md#4-fencing-and-ownership) for lease/incarnation semantics.

## 5. Codec contract (application level)

`src/storage/postgres/codec.ts` pins the numeric surface: financial values always arrive as canonical decimal TEXT; only bounded operational counters cross the number boundary (`counter()` rejects non-canonical strings and >`Number.MAX_SAFE_INTEGER`); `sequence()` validates exact bigint pagination cursors (`^[1-9][0-9]{0,18}$` ≤ int8 max) as decimal strings end-to-end; `corrupt()` reproduces `STORE_CORRUPT` for any hash/JSON/counter mismatch. Read pages additionally fail on the server when a page's serialized bytes exceed the 1 MiB budget (`READ_LIMIT`).
