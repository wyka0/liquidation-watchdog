# PostgreSQL operations reference (Phase 10)

**Current-reference update — 2026-11-06; production readiness remains unaccepted.** This runbook originated in Phase 10. At that handoff, Neon provisioning, data import/cutover, Render deployment, external scheduling and production operation were outside its authorization; the approval register in [the Phase 9 report](phase9-report.md#11-blockers-risks-and-required-approvals) is historical scope, not the status of every later phase. Subsequent [A2 cadence work](a2-monitoring-cadence.md), [native PostgreSQL integration](NEON-STAGE-2F-NATIVE-POSTGRESQL-INTEGRATION.md) and [Stage 3B notification wiring](STAGE-3B-RUNTIME-NOTIFICATIONS.md) qualify local capabilities. The Phase 8 SQLite service is therefore not the sole locally verified implementation. See the [submission package](SUBMISSION-PACKAGE.md#g-production-readiness) for qualification limits; local PostgreSQL results do not establish production or Neon cutover readiness.

## 1. Entry point and configuration

The separate entrypoint `npm run start:postgres` (`node dist/postgres-service.js`) starts the PostgreSQL runtime. Imports are inert. Explicit startup validates configuration and constructs lazy role pools and HTTP, but performs no migration, SQLite open or monitoring cycle. Inputs below are explicitly named (**secret values are injected privately, never placed in files, logs or manifests**):

| Variable | Meaning |
| --- | --- |
| `WATCHDOG_STORAGE_BACKEND` | Required literal `postgres`; a missing/other value fails startup. There is no SQLite fallback. |
| `WATCHDOG_POSTGRES_NAMESPACE` | Deployment namespace `^[a-z0-9][a-z0-9_-]{0,63}$` persisted into `database_identity`. |
| `WATCHDOG_POSTGRES_WRITER_URL` | PostgreSQL URL for the writer role. |
| `WATCHDOG_POSTGRES_READER_URL` | PostgreSQL URL for a **distinct reader role** on the same host/port/database (writer and reader usernames must differ; equality is refused). |
| `WATCHDOG_SCHEDULER_ENABLED` | `true` → lifecycle `RUNNING` (server accepts scheduler jobs); `false`/absent → `DISABLED` (reads and health only). |
| `WATCHDOG_SCHEDULER_SLOT_SECONDS` | Optional; default **300**. Canonical positive integer, multiple of 60, divides 3600, at least the 240-second cycle budget and at most 3600. |
| `WATCHDOG_READ_API_TOKEN` | Required at startup, including disabled scheduling. `^[A-Za-z0-9_-]{32,256}$`; read requests accept Basic `watchdog:<credential>` or Bearer. |
| `WATCHDOG_SCHEDULER_SECRET` | Required at startup, including disabled scheduling. `^[A-Za-z0-9_-]{43,256}$`, distinct from the read token; scheduler requests require Bearer. |
| `PORT` | HTTP port 1–65,535. |
| `WATCHDOG_MONITORING_CONFIG_PATH` | Optional non-secret monitoring JSON; absent selects defaults. |
| `WATCHDOG_RISK_CONFIG_PATH` | Optional threshold JSON, only when no position file is selected. |
| `WATCHDOG_POSITION_CONFIG_PATH` | Optional single-position JSON; owns its thresholds. Combining it with the risk-config path fails as `POSITION_THRESHOLD_AMBIGUOUS`. |

Both authenticators are validated before role-pool/listener construction. Invalid configuration fails closed; selecting the separate SQLite entrypoint is an explicit operator choice, never fallback behavior. Relative PostgreSQL configuration paths resolve against the invocation working directory. Without a position file the public demonstration identity remains selected. Enabled notification adapters consume `WATCHDOG_TELEGRAM_BOT_TOKEN`/`WATCHDOG_TELEGRAM_CHAT_ID` or `WATCHDOG_DISCORD_WEBHOOK_URL`; flags and policy remain in the monitoring JSON. See [environment/configuration](environment-variables.md).

URL grammar enforced by `connectionConfiguration`: `postgres:`/`postgresql:`, explicit username/password, hostname `^[A-Za-z0-9.-]+$` (localhost/127.0.0.1 refused), path `^/[A-Za-z0-9_-]{1,63}$`, optional single `sslmode=require|verify-full` and optional single `channel_binding=require`, no other query parameters or hash/fragment, length at most 4,096 characters. The driver uses `rejectUnauthorized: true`, `sslnegotiation: "postgres"`, a fixed `application_name`, and `enableChannelBinding:true` when `channel_binding=require` is supplied. A hostname whose first label ends with `-pooler` omits startup `options`; direct connections use `-c search_path=pg_catalog`. Transactions set the hardened search path locally in either case. No permissive TLS option or implicit `PG*` connection discovery is used. URL/role mismatch is rejected before connecting.

On SIGINT/SIGTERM the runtime stops the scheduler and closes HTTP concurrently, then closes pools once both have settled. The monitoring shutdown budget is **10 seconds**; the executable uses the shared **25-second signal-cleanup fallback**, which writes the redacted `PROCESS_SHUTDOWN_DEADLINE` event and exits 1 if cleanup exceeds it. These are distinct budgets, not a single 10-second process-exit deadline.

## 2. Pools and bounded capacity

Everything is bounded by `PG_LIMITS` in `src/config/postgres.ts`:

| Limit | Value / meaning |
| --- | --- |
| `connectionsPerRole` | **1** connection per role (writer pool and reader pool, independent lazy pools). |
| `queuedPerRole` | 3 waiters in addition to the one active client; excess admission is refused (`READ_BUSY`) instead of stacking connections. |
| `connectMs / idleMs / closeMs` | 5,000 / 5,000 / 5,000 — lazy pools have minimum size zero; an idle client may remain until its five-second idle timeout. |
| `queryMs / transactionMs / readTransactionMs` | 6,000 / 10,000 / 4,000 hard client bounds; writer statement 5,000 ms, reader statement 1,000 ms (server-side statement timeouts terminate long reads so the pooled connection is reusable), lock wait 1,000 ms. |
| `cycleMs / jobMs / leaseSeconds / httpMs` | 240,000 / 300,000 / 360 / 420,000 — the receive/cycle/job/lease/HTTP budget ladder (verified by unit tests). |
| `bodyBytes` | 1,024 scheduler request cap. |
| `storageStopBytes / pendingDeliveries` | 800,000,000 / 10,000 admission stops (`RESOURCE_DATABASE_LIMIT` / `RESOURCE_BACKLOG_LIMIT`), replacing SQLite disk probing with database-space (`pg_database_size`) and pending-count checks. |
| `synchronous_commit=on` durability | Writer transactions issue `SET LOCAL synchronous_commit=on` so stuck-at-commit outcomes resolve to the durable record; lost COMMIT/verify results reconcile through stable identity instead of replays. |

Connection acquisition serializes across callers so outages cannot create reconnect storms; transient-class failures (`08*`, `57P01-3`, socket errors) allow at most two connection attempts with capped jittered backoff. Write transactions are not automatically replayed. Every surface error is sanitized (`POSTGRES_UNAVAILABLE`, `POSTGRES_COMMIT_UNKNOWN`, ...) — raw driver text, URLs and credentials never appear in any error.

Disconnect cancellation: transactions honor their caller's `AbortSignal` (scheduler job cancellation, shutdown, closed store). Cancellation discards an acquired in-flight client; cancelled queued work cannot issue application SQL. Server-side statement timeouts provide an additional bound. The historical immediately-abort and queued-persistence-cancel tests cover these paths.

## 3. Runtime wiring

`PostgresRuntime` ([postgres-runtime.ts](../src/runtime/postgres-runtime.ts)) offers the same lifecycle states as the Phase 8 service (`STARTING/RUNNING/DISABLED/STOPPING/STOPPED/FAILED`) with `AsyncServiceOptions`-wired monitoring: the monitoring service, dispatcher and read models now await every store call (shared [MonitoringService](../src/monitoring/service.ts) code, async `commitObservation` boundaries, dispatcher async sends) — the exact decisions, thresholds, BigInt math, `actionable:false`, UNVERIFIED/UNKNOWN labels and 600-second age rule are unchanged. The HTTP server (modified [http.ts](../src/runtime/http.ts)) keeps the Phase 8 protections and adds the [scheduler route](scheduler-endpoint-contract.md); the [read model](#6-authenticated-read-apis) gains exact bigint cursors and the server-side byte budget.

The resolved monitoring policy is retained except for scheduler-owned enablement/interval and the fixed PostgreSQL operation budgets (cycle 240 s, accepted-observation age 600 s, monitoring shutdown 10 s). No internal interval loop creates jobs; an authenticated external request must name an admissible configured UTC slot. Cadence is a best-effort opportunity to attempt a cycle, not proof of freshness or continuous operation.

## 4. Fencing and ownership

- `database_identity.incarnation` rotates **only** by explicit maintenance; every runtime writer pins its admitted incarnation and refuses old-incarnation writes after rotations (isolated-restore-style tests).
- One **global lease** row (`worker_lease`) grants exactly one owner a fenced execution window: `(owner, fence, incarnation, deadline_at ≤ expires_at, current_execution → scheduled_executions)`. Late writes/acknowledgments from expired, superseded or new-incarnation owners are refused with stable codes; claims (`deliveries.claim_*`) check `owner+fence+incarnation+claim_deadline` (20 s acknowledgment headroom).
- `high_water_slot` never regresses and blocks replay of admitted/pruned slots even across database-clock rollback.
- `restart`-safe: after an immediate server restart the identity, lease high-water, durable `IN_FLIGHT` attempts and receipts survive; daily operations do not reset any of them.

## 5. Migrations

Two checksummed migrations (independent SQLite lineage, `user_version` untouched) build the complete [schema](postgres-schema-reference.md). They run **explicitly** — `applyPostgresMigrations` is a maintenance API (never invoked by startup, reads or scheduled work) executed under `pg_advisory_xact_lock(1672,10001)`, idempotent, checksum-verified each open, refusing checksum/gap/future lineage corruption without repair. Phase 10 local runs used the pinned native fixture (`@embedded-postgres/windows-x64@17.11.0-beta.19`, PostgreSQL **17.11** binaries). Real deployment initialization/cutover requires its own migration authority and approved operator runner; these local results do not authorize it.

## 6. Authenticated read APIs

Same read routes as Phase 8: `/api/readiness`, `/api/monitoring/status`, `/api/positions`, `/api/risk`, `/api/observations`, `/api/alerts`. `/api/health` is unauthenticated and dashboard assets are credential-free; protected reads accept Basic or Bearer. PostgreSQL specifics:

- Independent single-reader snapshots: `readSnapshot` uses a bounded REPEATABLE READ / READ ONLY transaction so multi-endpoint reads stay coherent across concurrent writer commits.
- History pages paginate on **exact bigint cursors** (`stable_seq`), transported as canonical decimal strings; cursors are exclusively ordered (no misses/repeats at steady state).
- The **server** prices each page's JSON payload against a 1,048,576-byte budget and raises `READ_LIMIT` (HTTP 413) before rows cross the wire; the extra serialized key never travels.
- Projections use shared field-safe schemas: exact amount strings, strict `schemaVersion: 1` envelopes, no internal assurance/config/path fields, no `SAFE` wording, `actionable:false` structural, and UNVERIFIED/UNKNOWN labels preserved. When scheduler-enabled, `safety.schedule` reflects the configured period; the default is `{"mode":"EXTERNAL_UTC_SLOTS","periodSeconds":300,"utcMinutes":[0,5,10,15,20,25,30,35,40,45,50,55]}`. The frozen identity label `morpho-30m-v1` does not determine cadence.

## 7. Retention, recovery and boundaries

- `prune(now, cycleDays, alertDays)` deletes only terminal, unprotected history: alerts older than `alertDays` without non-terminal deliveries (≥7-day guard is a hard failure, `STORE_CORRUPT`), cycles older than `cycleDays` (≥1) not referenced by streams (latest/last-accepted) or the lease's current execution, and superseded non-baseline oracle assurance. Fingerprints (dedup tombstones) are never pruned; delivered-with-cascade alert deletion does not remove other rows' protections.
- Delivery recovery (`recoverDeliveries`) processes stale/foreign `IN_FLIGHT` claims, records `ATTEMPT_INTERRUPTED`, retains attempt history, clears stale claim fields and terminalizes the rows as `PERMANENTLY_FAILED` with `ambiguous=1` (logical `UNKNOWN`). They are excluded from `due()` and never automatically replayed. Known-delivered rows stay terminal; only known non-ambiguous retryable failures use bounded retries. No operator resend workflow for unknown outcomes or exactly-once external delivery guarantee is implemented; see [Stage 3B](STAGE-3B-RUNTIME-NOTIFICATIONS.md#5-delivery-lifecycle).
- No automatic restore/repair pathway exists against any database (SQLite or PostgreSQL), matching the standing data-preservation rule.

## 8. What this phase did not do

**Historical Phase 10 scope:** no Neon account/connection, real-data import/cutover, Render deployment, external scheduler run, real notification send, financial signing authority, commit/push/tag/Git-index mutation, or rerun of `phase9-audit.mjs` against its modified tree occurred in that phase. Its test/preservation evidence remains in [the test-evidence record](phase10-test-evidence.md) and [Phase 10 report](phase10-report.md). These statements do not erase later work; current qualification limits are summarized in the [submission package](SUBMISSION-PACKAGE.md).
