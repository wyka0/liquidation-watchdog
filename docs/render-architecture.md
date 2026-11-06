# Render target architecture — Phase 7

**Recommendation: retain single-owner SQLite. Start with one disk-backed Render Web Service containing the monitor and a small read-only HTTP interface. If independently deployed web and monitoring services are required, use a disk-owning Private Service (`pserv`) plus a dashboard Web Service.** A Render Background Worker cannot receive private or public requests, and a separate Web Service cannot mount its disk.

Status: **proposal, unimplemented and unapproved for deployment**. Phase 7 inspected the application and wrote planning documents; Render has not been accepted as the production host. Oracle assurance remains **UNVERIFIED**, freshness **UNKNOWN**, and recovery estimates **indicative / `actionable: false`**.

Companions: [storage decision](render-storage-decision.md), [deployment plan](render-deployment-plan.md), [security plan](render-security-plan.md), [Phase 7 report](phase7-report.md), [unapproved Blueprint draft](../render.yaml).

## 1. Actual application and startup behavior

| Question | Finding from source |
| --- | --- |
| Application/framework | TypeScript ESM CLI and monitoring library, application `0.1.0`. Runtime dependencies: `viem 2.57.11`, `zod 4.6.7`, `@modelcontextprotocol/sdk 1.32.2`. No Next.js, React, dashboard, inbound HTTP server, or web build exists. See `package.json`, `src/cli.ts`, `src/cli/run.ts`. |
| Build/runtime | `npm run build` invokes TypeScript and produces `dist/cli.js` and supporting modules. Declared compatibility is Node `>=22.18.0`; the verified production profile requires **Node v24.14.1 / SQLite 3.51.2**. The existing `npm start` runs the CLI, not a web listener. |
| Independent worker | The explicit `monitor` command runs without a frontend. `monitor --once` requests one bounded cycle. Continuous mode requires both an explicit command and `--enable` or `monitoring.enabled=true`; default configuration is disabled. See `src/cli/monitor.ts:28–76`. |
| Imports | Importing the inspected library modules does not start monitoring. **Do not import `src/cli.ts` into a web application:** it dispatches `process.argv` at module evaluation. Future route modules must import libraries and receive read dependencies explicitly. |
| Construction | `MonitoringService` construction validates configuration/thresholds and constructs the dispatcher; it does not start a cycle, acquire monitor ownership, or contact providers. It is not entirely side-effect-free: config/path validation inspects the local filesystem. See `src/monitoring/service.ts:53–65`, `src/config/monitoring.ts:56–74`, `src/storage/paths.ts`. |
| Writable opens | `new MonitorStore(path)` is writable by default. Its constructor obtains maintenance ownership before opening/initializing/migrating and then releases that temporary ownership. Long-lived monitor ownership starts with `acquireMonitor()` in the first cycle's `initialize()`. Never construct a default store from an HTTP handler. |
| Other writers | Monitoring is not the only write path: `database-init`, writable oracle audits, and isolated restore/recovery also write. `backup` reads the source and writes a separate backup. These are explicit operator operations, not HTTP routes. See `src/cli/operations.ts`, `src/cli/oracle.ts`, `src/storage/backup.ts`. |
| Concurrent readers | Same-host `readOnly: true` connections can read while the monitor owns the database. They validate existing storage and never initialize or migrate it. Missing storage is reported, not created. The local ownership lock refuses competing maintenance/monitor writers. |

The baseline architecture and its limits are recorded in [production architecture](production-architecture.md) and [database operations](database-operations.md). Local concurrency evidence includes [health during an active cycle](../evidence/phase6/health-during-active-cycle.txt) and [competing initialization refusal](../evidence/phase6/database-init-rejected-during-active-cycle.txt). These Windows observations do not establish Render/Linux filesystem behavior.

### Timing and lifecycle already implemented

`src/monitoring/service.ts:159–184` awaits each cycle and then schedules the next one. Healthy default delay is **60 seconds after completion, with 0–20% positive jitter**; it is not a fixed 240-second period. Default cycle timeout is **240 seconds**, connectivity timeout **30 seconds**, and failure-backoff ceiling **900 seconds**. Phase 6 bounded cycles took about **63.6–64.8 seconds**. A healthy continuous start-to-start estimate is therefore about **124–137 seconds**, before other delays; continuous Render pacing has not been measured.

The active-cycle guard prevents overlap. The CLI handles SIGINT/SIGTERM through bounded `shutdown()`. Stop requests stop scheduling and delivery admission; current work may settle until the deadline, after which reads/delivery are cancelled and the store is closed. Timeout/fatal paths exit unsuccessfully. Phase 8 must extend this lifecycle to HTTP connections and any backup job without starting a second scheduler.

## 2. Render's storage and networking constraint

**A separate Render Web Service cannot open the Background Worker's SQLite file.** Render documents that a persistent disk is accessible by only one service instance, only at runtime. Separate services have independent filesystems. The application's `*-monitor-lock` SQLite `BEGIN EXCLUSIVE` transaction coordinates cooperating local processes; it is not a distributed lease and does not make storage shared.

Render Background Workers can send requests but **receive no inbound network traffic, including private-network traffic**. An owner that serves an internal read API must instead be a **Private Service** or a suitably restricted Web Service. A Private Service must bind a port and has an internal hostname, with no public `onrender.com` endpoint.

Sources consulted 2026-11-02: [persistent disks](https://render.com/docs/disks), [private networking](https://render.com/docs/private-network), [Background Workers](https://render.com/docs/background-workers), [Private Services](https://render.com/docs/private-services).

## 3. Topologies evaluated

| Topology | Data path and tradeoff | Recommendation |
| --- | --- | --- |
| **1 — one Web Service, one disk** | Monitor and HTTP reader share one instance. Exactly one authoritative writer; API reads use a separate read-only interface. Lowest service count and no database migration. HTTP load, process failure and deploy downtime also affect monitoring. | **Initial Option A variant** for this single-position application, subject to bounded HTTP-load and lifecycle tests. |
| **2 — Private Service owner + Web Service** | The `pserv` owns SQLite and runs the monitor plus a restricted internal read API. The Web Service authenticates server-to-server over the same-region private network and never opens SQLite. Public requests cannot directly reach the owner. | **Option A for a two-service requirement.** Independent frontend deploys and resource isolation, with an extra service and an authenticated internal protocol to test. |
| **3 — Background Worker + Web Service + PostgreSQL** | A worker writes PostgreSQL; the web service uses a database role limited to approved reads. Monitor/outbox ownership must still be fenced across connections and deploys. Evidence files require durable storage too. | **Option B, deferred.** Substantial persistence/migration/recovery work; no migration performed. |
| Worker-owned SQLite + outbound projection publishing | A true Background Worker could publish signed/versioned snapshots to a durable read store or ingestion service. Consumers must handle retries, ordering, stale data and gaps. This does not share the SQLite file. | Technically possible, but adds an unimplemented replication protocol and extra storage; not the minimal next step. |

Thus PostgreSQL is **not the only possible split-service design**. Topology 2 provides an on-demand SQLite-backed read API; projection publishing provides an eventually consistent alternative. Neither gives the dashboard independent access to a current SQLite database during owner downtime. Under Topology 2 the dashboard can remain online, but must label cached data stale or unavailable when the owner is down.

## 4. Recommended initial data flow

```text
Render Web Service — paid compute, exactly one instance
  proposed explicit service entrypoint
    ├─ startup: runtime/config/evidence validation; HTTP binding on 0.0.0.0:$PORT
    ├─ when explicitly enabled: existing MonitoringService
    │    ├─ fixed RPC + MCP read paths, paced and bounded
    │    ├─ unchanged accounting, risk and conservative oracle assurance
    │    └─ SQLite transaction: state/cycle/fingerprints/alerts/outbox
    ├─ bounded read-only repository → sanitized HTTP response cache
    └─ authenticated read-only JSON / minimal HTML dashboard

One persistent disk: /var/data/watchdog
  storage/    database, WAL/SHM, journal and ownership sidecars
  runtime/    hash-verified evidence tree at the existing relative paths
  backups/    bounded local staging of application-consistent backup sets

RPC: https://rpc.pharos.xyz         MCP: https://mcp.pharos.xyz/mcp
Notifications: console; Telegram/Discord disabled by default
Verified complete backup sets → separately approved off-disk storage
```

Proposed entrypoint/configuration paths (`src/service.ts`, `dist/service.js`, `config/render.json`) **do not exist**. The initial disabled configuration must allow HTTP status without starting a scheduler or creating/migrating missing storage. A later enabled configuration starts exactly one loop through that explicit entrypoint. Imports, builds, page rendering and health probes must never enable it.

Deploys with disks stop the old instance before starting the new one and incur downtime. `numInstances: 1`, the existing ownership fence and an observed stop/start acceptance test are all required. Fatal monitor failure must propagate to service lifecycle state; a live HTTP socket must not hide a failed worker. Upstream failure/backoff is degraded observation status, not by itself a reason to restart repeatedly.

The disk layout needs **new bootstrap plumbing**, not just a database-path override. `CURRENT_EVIDENCE`, reviewed references and backup bundle paths are relative to the working directory and include `evidence/phase1` through `evidence/phase5`. The proposed runtime workspace copies and verifies required release evidence at those same paths, uses exclusive creation and rejects conflicting hashes. Resolve executable/configuration paths before changing working directory; use regular paths, not symlink aliases. See [deployment plan](render-deployment-plan.md) §4.

## 5. Dashboard and read API contract — proposed

A narrow HTML/JSON addition is recommended because no frontend exists. A separate Next.js application would add a dependency/build/service surface and still need the same read API. It becomes an option under Topology 2 if frontend requirements justify it; Phase 7 adds neither framework nor server.

| Route | Contract / available source |
| --- | --- |
| `GET /api/health` | Public, tiny in-memory startup/liveness/terminal-status response. No SQLite open, evidence walk, provider check or secret inspection per request. It is not the existing CLI `health` output. |
| `GET /api/readiness` | Authenticated, bounded cached observation-readiness summary. Distinguishes operational readiness, monitoring enablement and financial actionability. Stale/missing data produces not-ready; it never becomes financially actionable. |
| `GET /api/positions` | Authenticated fixed market/account identity; latest attempt and last accepted observation explicitly distinguished, with debt/collateral base units and provenance. |
| `GET /api/risk` | Authenticated persisted `riskView` subset: ratios/scales, configured thresholds, mathematical/effective/quality states, indicative estimates and their matching snapshot provenance. |
| `GET /api/alerts` | Authenticated bounded alert page with delivery status/attempt counts/ambiguity. Use bounded alert IDs and `deliveriesForAlerts`, not an unrestricted `deliveries()` dump. |
| `GET /api/monitoring/status` | Authenticated sanitized lifecycle, last-cycle/backoff information and observation age. No PID, internal paths, raw runtime/config objects, stack or provider response. |
| `GET /api/observations` | Proposed bounded historical page from persisted cycle observations. A cursor query/read helper must be added and tested; there is no ready-made HTTP/history endpoint today. |

Existing CLI diagnostics are **operator-oriented, not an HTTP DTO**. `operationalDiagnostics()` validates configuration and SQLite, reads counts/runtime/resources/evidence, and can inspect enabled-provider configuration; `probe: true` also performs network calls. `summary()` and observations can contain full assurance data. Phase 8 must explicitly select fields into new bounded response schemas, not serialize these objects wholesale or spawn a CLI per request.

Proposed reader rules: a validated read-only connection per service lifecycle, coherent short read snapshots, parameterized cursor queries (default 20, maximum 100 rows), response byte caps and bounded caching. Close/refresh connections across schema transitions. SQLite's synchronous calls share Node's event loop, so test sustained reads during a cycle and avoid expensive validation on each HTTP request. Historical query helpers may require **read-only storage additions**; storage mutation logic and schema migration are not needed for this proposal.

Required displays: collateral/debt, safety ratio, warning/critical/target thresholds, observation and alert history, delivery state, monitoring state, data quality, oracle assurance **UNVERIFIED**, freshness **UNKNOWN**, and recovery estimates **indicative / `actionable: false`**. Preserve exact integer strings and ratio scale; include block number/hash/time, snapshot identifier and retrieval time beside numeric results. Do not promote last-accepted or cached history to a current observation, or turn an absent estimate into zero.

## 6. Fixed identity and financial behavior

| Item | Fixed value |
| --- | --- |
| Chain | **1672** |
| RPC | `https://rpc.pharos.xyz` |
| MCP | `https://mcp.pharos.xyz/mcp` |
| Market | `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73` |
| Public demonstration account | `0xc6dd9976066f3364b4d6a72cd4f1fa0468327aa7` |
| Defaults | warning `1.30`, critical `1.10`, target `1.25`, liquidation boundary `1.00` |
| Safety | oracle **UNVERIFIED**; freshness **UNKNOWN**; estimates indicative; **`actionable: false`** |

RPC/MCP agreement does not establish independent upstream truth. Existing repayment/additional-collateral modules calculate estimates; they do not execute transactions. No signing/broadcasting feature is introduced. The [Phase 8 plan](render-deployment-plan.md) requires re-verification of lifecycle, read access and packaging while preserving these calculations, thresholds, identity and assurance gates.
