# A3 — Render Free operations preparation

**DRAFT-UNAPPROVED-NOT-DEPLOYED.** These procedures apply only after explicit provisioning, host-test and scheduler approvals. No Render resource exists from A3.

## 1. Startup and health

`npm run start:postgres` consumes only explicit environment names, validates PostgreSQL URLs/roles/namespace/cadence, and binds `0.0.0.0:$PORT`. Importing code performs no query or migration. Startup creates no SQLite database and assumes no persistent local directory.

`GET /api/health` is the Render health path and reports only in-memory lifecycle. It must stay lightweight during Neon sleep/outage. Authenticated `/api/readiness` is the operator signal for database/observation availability and stale state. A 200 health response is not proof of a fresh observation, a successful Cron run or database durability.

Initial deployment remains `WATCHDOG_SCHEDULER_ENABLED=false`. Protected reads may be tested only after reader-role/catalog verification. Enabling the endpoint and activating Cron are separate A6 changes.

## 2. Cold start and five-minute timing

The future Cloudflare request can wake a sleeping Render service (about one minute per Render documentation) and then a sleeping Neon compute. The endpoint has a 420-second HTTP bound; the Worker has a 450-second network timeout; Cloudflare Cron has a 15-minute wall limit. The monitor keeps its 240-second cycle, 300-second job and 360-second lease limits.

These nested limits make work finite, not guaranteed. If cold start/wake/read exceeds the budget, the Worker logs a sanitized failure and performs no retry. Durable PostgreSQL slot identity prevents duplicate execution when delivery is duplicated. Missing invocations create no observations. Last accepted data becomes stale after 600 seconds regardless of liveness.

## 3. Graceful shutdown and deploys

Render may restart Free instances at any time. SIGTERM invokes the existing bounded stop: refuse new scheduler work, cancel/settle active work, close HTTP, then close PostgreSQL pools. A stale or killed owner cannot write after a newer database fence. The Blueprint's 30-second platform delay is not an SLA and must be measured on actual Render before operation.

Automatic deployment stays off. A future manual deploy must identify source/build/schema, start monitoring disabled, verify old/new overlap fencing and review the durable receipt for any interrupted cycle. Rollback changes application bytes only; it does not restore PostgreSQL state. Never use Render rollback as a database rollback.

## 4. Logs and secret safety

Application logs contain fixed event/error codes only. Do not enable environment dumps, shell tracing, authorization-header logging, pg URL output, raw driver/provider errors or request-body logging. Review actual Render access logs to ensure `Authorization` is absent before scheduler activation. Dashboard and scheduler credentials remain distinct.

Free services have no Shell access. Maintenance and migration therefore run from a separately approved operator runner using direct Neon access, never an HTTP administration route or build/start command.

## 5. Quota/provider failures

| Failure | Response |
| --- | --- |
| Render hours exhausted/suspension | Service unavailable; Cloudflare records non-2xx/network failure; data ages stale. Do not upgrade automatically. |
| Build minutes exhausted | New builds stop; preserve current release identity, investigate, and wait/reset. |
| Bandwidth/service-traffic suspension | Disable the external Cron if it only creates failures; preserve evidence and seek review. |
| Render restart | PostgreSQL fencing/recovery resolves interrupted work; no local recovery state is trusted. |
| Neon sleep/outage | Health may remain responsive; readiness/data fail or show stale; no SQLite fallback. |
| Chain provider failure | Failed/rejected cycle, no synthetic observation, last accepted record retained and aged. |

Monitor monthly instance hours, outbound usage and pipeline minutes in Render, plus the independent Neon/Cloudflare limits. Free provides no guaranteed uptime. A five-minute target is best-effort only.

## 6. Acceptance still required

A6 must measure actual Linux runtime/version, cold starts, proxy/request duration, TLS, access logging, shutdown/kill, deploy overlap, Neon wake, 0.1-CPU/512-MB load and quota behavior through a finite disabled/console-only plan. A7 governs real notification destinations. A8 alone can authorize production operation.
