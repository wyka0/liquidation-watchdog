# Phase 8 report — single-owner runtime and protected dashboard

Project: `C:\liquidation-watchdog`. **COMPLETE — local Phase 8 implementation and verification, ready for a separate deployment review.** Deployment and production operation remain blocked by the outstanding acceptance/backup work below. No Render deployment or production approval has been granted. The completed handoff is bound by `evidence/phase8/phase8-seal.json` and its detached SHA-256 checksum.

Deliverables: this report, [file inventory](phase8-files.md), [runtime operations](render-runtime-operations.md), [dashboard/API contract](render-dashboard-api.md), and [test evidence](phase8-test-evidence.md).

## 1. Implementation scope

Implemented the Phase 7 **Topology 1**: one disk-backed Render Web Service, one instance, one Node process containing the existing monitor and a protected read-only HTTP/dashboard layer. The initial production-profile configuration keeps monitoring and external providers disabled. There is no deployment, production installation, indefinite run or transaction execution in this phase.

The six mandatory Phase 7 documents were read before implementation: [architecture](render-architecture.md), [deployment plan](render-deployment-plan.md), [storage decision](render-storage-decision.md), [security plan](render-security-plan.md), [report](phase7-report.md), and [inventory](phase7-files.md). Their hashes and the prior release/evidence bindings passed before editing. The unchanged draft Blueprint's executable/configuration contract is now implemented.

## 2. Actual architecture

```text
Explicit node dist/service.js invocation
  └─ RenderRuntime — one process-wide owner
       ├─ persistent workspace validation + exclusive evidence seeding
       ├─ runtime-owner.sqlite OS fence
       ├─ MonitoringService — one loop, original writer fence and WAL database
       └─ ReadHttpServer
            ├─ public in-memory /api/health
            └─ authenticated dashboard + persisted read projections
                 └─ one read-only SQLite connection in the same process
```

The service uses Node's built-in HTTP/SQLite modules and existing schema validation. There is no separate worker service, distributed SQLite ownership, PostgreSQL migration, frontend framework or additional dependency. Public reads and the monitor share the process/event loop, failure domain and disk. The separate read connection does not own a scheduler or grant write authority.

Runtime paths follow `/var/data/watchdog/{storage,runtime,backups}`. The release/configuration is resolved before changing into the persistent runtime workspace. Required reviewed evidence retains its original relative `evidence/phase1`…`phase5` identities; new monitoring evidence is written under the persistent workspace.

## 3. Files and release inputs

New implementation modules are `src/service.ts` and `src/runtime/{auth,dashboard,http,read-model,service,workspace}.ts`; new configuration is `config/render.json`. New tests comprise five runtime suites, fixtures and process/import helpers. `scripts/phase8-reliability.ts` runs the bounded synthetic reliability/backup/restore measurement.

Only two existing source files are modified: `src/storage/store.ts` adds existing-only startup and bounded coherent read snapshots; `scripts/release-inputs.ts` binds `render.yaml` and `config/render.json`. The three built `dist/storage/store.*` files change accordingly; 21 new runtime/executable build outputs are added. The implementation/document delta is **43 additions and 5 modified originals**. Full path/byte/SHA-256 details are in the [inventory](phase8-files.md) and Phase 8 evidence manifests.

The final **180 source/configuration inputs** and **258 build files** exactly match the fully verified candidate. Their aggregate SHA-256 identities are `e9c758240dcfcd06e7691e51a8bb48194e5f7f38cd616ec3ec547c9c7fff3004` and `84830d46176759e16458ce285adc310cd49c3810321724c017e3a5a214f3072b`, respectively. The seal additionally binds all five final documents and the new evidence inventory.

The original monitor, financial/assurance modules, schema/migrations, notification adapters, package/lockfile, `.env.example`, Phase 1–7 archives and `render.yaml` retain their historical bytes. The Blueprint still carries its historical Phase 7 comments; [operations](render-runtime-operations.md) explains the now-implemented paths without rewriting that artifact.

## 4. Explicit startup, scheduling and shutdown

The executable accepts only `--config`, `--runtime-root`, and `--database`, with explicit `PORT` and read-credential inputs. Importing source/built entrypoints is guarded; importing modules or constructing `RenderRuntime` does not start monitoring or open SQLite/HTTP. Production fixture injection and enabled external notification providers are refused.

Startup is single-use and protected by a process-wide owner. HTTP binds before an enabled `MonitoringService` starts. Existing cycle-overlap guards and cadence remain: nominal 60–72 seconds after completion, bounded failure backoff and due-outbox wakeups. Ordinary upstream/data-quality failure is reflected in persisted state; a terminal worker failure marks the runtime failed, closes HTTP and exits nonzero.

Explicit SIGINT/SIGTERM handlers request shutdown and cancel bootstrap between file operations. HTTP and monitor shutdown proceed concurrently; HTTP sockets have a two-second close bound, the production monitor budget is 20 seconds, and the executable has a 25-second signal-cleanup fallback. Cleanup closes the reader, original writer and workspace fence, restores the working directory and removes signal handlers. Native synchronous stalls remain outside a hard JavaScript deadline.

## 5. SQLite, persistent evidence and restart behavior

Production startup requires an existing writable Linux mount at exactly `/var/data/watchdog`, validates regular/disjoint absolute paths, links/sidecars, disk reserve and write/sync probes, and refuses ephemeral fallback. Evidence seeding is exclusive and hash-checked; conflicts or missing required references are startup failures, never automatic repair.

Disabled mode can expose health/status without an application DB. Enabled mode requires an explicitly initialized, current-schema DB; a missing, corrupt, drifted, legacy or unsupported DB is refused without reset or automatic migration. Current schema remains **5**, application ID **`0x4c575033`**, with the existing WAL/FULL durability and monitor writer fence. The separate workspace fence also excludes a second disabled service and is released by the OS after termination.

The new reader is `readOnly: true`/`query_only`, uses coherent bounded transactions and never initializes storage. Existing interrupted-cycle/outbox recovery, dedup fingerprints, acknowledged delivery history, cooldowns and at-least-once ambiguity are preserved. Backup/restore primitives are reused and tested against the persistent layout. **Hourly backup scheduling, verified off-disk transfer/receipt and automated retention are outstanding deployment-review work**; inherited RPO/RTO are targets only.

## 6. Routes, authentication and dashboard

Public `/api/health` returns only in-memory lifecycle status. Authentication protects `/api/readiness`, `/api/monitoring/status`, `/api/positions`, `/api/risk`, `/api/observations`, `/api/alerts`, `/`, `/dashboard.js` and `/dashboard.css`.

The required `WATCHDOG_READ_API_TOKEN` supports bearer access and Basic access with username `watchdog`. Credential inputs are bounded and compared through fixed-length SHA-256 digests using `timingSafeEqual`. Missing configuration fails startup; invalid requests receive a small refusal. No credential value is embedded or stored by the dashboard.

GET/HEAD projections select persisted fields and retain latest/last-accepted separation, history/stale/as-of metadata, exact amount/ratio strings and estimate/block/snapshot provenance. Pagination is parameterized, default 20/max 100, with an exclusive rowid cursor. A one-second bounded cache and read/concurrency/rate limits constrain work. The minimal dashboard renders dynamic content with `textContent`, same-origin assets and manual refresh. See the [API contract](render-dashboard-api.md) for exact fields, limits and error codes.

## 7. Security and fixed financial boundaries

- Data routes hold only a narrow read interface; requests do not start monitoring, open databases, spawn a CLI, contact providers, change configuration or execute financial actions.
- Strict projections omit secrets, destinations, internal paths/PIDs/configuration, full assurance graphs and raw exception/provider output. Responses use fixed error codes, no-store, restrictive CSP, frame denial, no-referrer and no wildcard CORS.
- Admission bounds cover headers/URLs, request bodies, page/cursor values, response/parse/cache sizes, read frequency, connections, concurrent requests and peer identity tables. Unverified forwarded headers do not manufacture rate-limit identities.
- No private environment file, real credential, wallet key or provider token was inspected, copied or emitted. Tests use synthetic in-memory read credentials and mock external notification adapters. No real Telegram, Discord or email delivery occurred.
- Chain **1672**, RPC `https://rpc.pharos.xyz`, MCP `https://mcp.pharos.xyz/mcp`, market `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73`, account `0xc6dd9976066f3364b4d6a72cd4f1fa0468327aa7` and thresholds **1.30 / 1.10 / 1.25 / 1.00** are preserved.
- Oracle remains **UNVERIFIED**, freshness **UNKNOWN**, all recovery estimates indicative and **`actionable: false`**. RPC/MCP agreement remains shared-upstream evidence, not independent oracle validation.

The dependency audit reports **0 vulnerabilities** at every severity. Candidate release checking reports **0 secret findings** across 1,092 files; the expanded main-tree and post-seal scans are recorded in `main-final-checks.json` and `seal-verification.json`. The scan verifies the exact placeholder template and reports potential private filenames without opening them; dependencies/build/Git/private runtime data/backups are excluded. No broad claim of production security follows from these local checks.

## 8. Exact tests and verification results

The isolated full verification passed **26/26 checks**, finalization **5/5**, and manifest generation/check both exited **0**. The full run was **2026-11-02T14:46:26.888Z–14:59:28.560Z**; candidate release checking completed at **15:03:55.246Z**.

| Suite / check | Completed result |
| --- | --- |
| Full unit/fixture suites | **709/709**, 34 files; includes **47/47** new runtime tests in five files |
| Operations subset, repeated | **99/99**, four files; already included in the 709 unit tests |
| Live read-only integration | **2/2**, one file, fixed RPC/MCP only |
| Unique unit + live tests | **711**; **810 executions** including the repeated operations subset |
| Final automated failures / skips / todo | **0 / 0 / 0** |
| Existing synthetic stability | **144/144 cycles**, two restarts; zero external calls |
| New bounded runtime reliability | **24/24 cycles**, three sessions, 72/72 HTTP 200 reads, backup/restore passed |
| Built service executable smoke | **2/2 scenarios**: disabled auth/HTTP/signal shutdown and expected enabled/missing-DB refusal |
| TypeScript / ESLint / production build / guarded built import | **PASS** |
| Dependency audit / evidence integrity / exact replay / source-runtime links | **PASS** |

The [test evidence](phase8-test-evidence.md) records all commands and four corrected development-command failures: unused import, ESM test spy, lint import type, and native-Windows-path ESM preload in an external smoke harness. The latter was reproduced and corrected to a file URL; it required no application-source change. Earlier results remain intact. Expected negative/refusal cases are distinct from failed tests.

Legacy scripts write Phase 5 outputs, so the full pipeline ran only in `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase8-verification-B1B2r7`. **173 new/changed candidate outputs** are preserved under `evidence/phase8/verification` with exact original-path/provenance mappings. Its retained `PHASE5_*` labels are compatibility-check metadata, not a replacement for historical Phase 5 evidence or the final Phase 8 implementation identity. Candidate finalization checked its original document set; the five final Phase 8 documents receive separate main-tree validation and sealing.

## 9. Bounded reliability and resource evidence

The preferred full-sampling run completed **24 synthetic cycles**, **3 sessions / 2 restarts**, and **72/72 authenticated HTTP 200 responses** in **12,124.8282 ms** wall time, representing 1,440 synthetic seconds. The database reached **2,117,632 bytes**. API p95 was **20.3925 ms**, maximum **55.0122 ms**; startup was approximately **967–1,383 ms**, clean shutdown **6.11–8.47 ms**.

Sampled RSS peak was **255,627,264 bytes** including backup/restore; final RSS growth was **107,048,960 bytes**. Verified backup and isolated restore passed and left source table hashes intact. This source/fixture harness is short, small and Windows-local; sampled RSS is not an exhaustive peak or proof of steady-state memory. The earlier run omitted backup/restore from its cycle-peak sampling and is retained transparently as superseded measurement evidence.

Runtime tests additionally cover real SQLite write contention/rollback, WAL reads during uncommitted writes, HTTP concurrency/rate limiting, slow partial requests, active-read shutdown, non-cooperative/late reads, duplicate owner exclusion, actual forced process termination, restart/outbox recovery and disabled repeated starts.

The built executable's disabled local smoke started in **3,211.4948 ms** and shut down in **27.3911 ms** through its actual handler, dispatched by a Windows-only test IPC preload. Public health, protected status/dashboard, unauthorized refusal and unavailable data returned their expected statuses; no application DB was created. This is compiled-executable coverage, not native Linux signal acceptance.

The existing stability harness completed 144 cycles over 36 simulated days in **9,483 ms**, including 32 deliberately rejected observations and 144 prevented overlaps. Its peak RSS was **345,890,816 bytes**, maximum DB **3,973,120 bytes**, WAL **4,482,592 bytes**; simulated notification faults and retention preserved required state. The live CLI smoke completed two accepted monitoring cycles across restart, 15 operator commands and three oracle audits plus three persisted-status reads. All stayed bounded and console/mock-only for notifications.

## 10. Historical integrity and Git preservation

Pre-edit verification at **2026-11-02T14:19:08.607Z** passed **1,237/1,237 historical bindings** and captured **1,241 unique original files** in an exclusive external snapshot. Subsequent checks matched **1,236 original files plus the five intended source/build modifications**, all **1,241 snapshot files**, all seven Phase 7 bindings, and the original Git index. Final exact timestamps/results are in the main-tree check and detached seal-verification records.

An unexpected historical mismatch is a stop condition. No historical restoration/recovery occurred in Phase 8. The prior Phase 7 report's disclosed recovery remains historical context; it was not repeated or rewritten. Final byte/hash checks and the detached Phase 8 seal bind the actual completed work.

Original index SHA-256: `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689`. Initial porcelain status had **597 entries**; the final working-tree status has **613 entries** and remains uncommitted. The exact NUL-delimited status and its hash are retained at handoff. Process checks after verification and after the built smoke found **0 matching watchdog runtime/CLI/helper processes**; the unrelated `seller.ts` process was not targeted or modified. No commit, push, branch/tag action, staging/index mutation or author/committer configuration change was performed.

## 11. Remaining limitations and blockers

Actual Render/Linux runtime provenance, mount/permissions, durability/power loss, signals, deploy stop-old/start-new behavior, TLS/proxy/Basic-browser/access-log handling, representative capacity/flood load and production-duration acceptance remain unqualified. Local tests do not establish behavior at the 4 GiB database ceiling; synchronous SQLite/native I/O has no hard CPU/stall deadline.

The Phase 7 backup schedule, off-disk destination/verified receipt, retention integration and achieved RPO/RTO remain unresolved. The service currently starts no backup scheduler. Real provider delivery stays disabled and untested in this phase. Oracle/operator/economic independence and freshness gaps also remain unchanged.

There is no verified Git HEAD release revision; the implementation is identified by content hashes. No immutable deployed release, hosting account/resource, disk/plan purchase or production service installation has been created.

## 12. Deployment-review readiness and stopping point

**COMPLETE for local runtime/dashboard implementation and verification; ready for separate deployment review. Deployment/production acceptance remains BLOCKED** by the actual-host, backup automation/off-disk recovery and capacity/soak requirements in §11. This completion decision does not claim that every Phase 7 production-readiness task is implemented or qualified.

The handoff consists of the five documents, final source/build/evidence identities, preservation/index/process results and detached seal. Work stops here for user review. No Render resource/account/deployment, production service installation, signing/broadcasting, repayment/collateral transaction, production notification or indefinite monitor was performed.
