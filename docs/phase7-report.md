# Phase 7 report — Render architecture adaptation

Project: `C:\liquidation-watchdog`. **Phase 7 scope is architecture/documentation only. Production approval remains NOT GRANTED.** Render is an evaluated candidate host, not an accepted deployment. The deliverables describe proposed implementation; no Render deployment or monitoring run was started during this phase.

Fixed safety state: **oracle UNVERIFIED, freshness UNKNOWN, recovery estimates indicative, `actionable: false`**. Chain **1672**, RPC `https://rpc.pharos.xyz`, MCP `https://mcp.pharos.xyz/mcp`, market `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73`, account `0xc6dd9976066f3364b4d6a72cd4f1fa0468327aa7` and financial calculations are preserved.

Required historical inputs were read: [Phase 2](phase2-report.md), [Phase 3](phase3-report.md), [Phase 4](phase4-report.md), [Phase 5](phase5-report.md), [host acceptance](host-acceptance-report.md), [production architecture](production-architecture.md), [deployment guide](deployment.md), [database backup/recovery](database-operations.md), and [release readiness](release-readiness.md). The requested names `deployment-guide.md` and `database-backup-recovery.md` do not exist in this repository; their actual equivalents are `docs/deployment.md` and `docs/database-operations.md`.

Deliverables: [architecture](render-architecture.md), [deployment plan](render-deployment-plan.md), [storage decision](render-storage-decision.md), [security plan](render-security-plan.md), this report, [file inventory](phase7-files.md), and an optional **unapproved** [render.yaml](../render.yaml). All work is local and uncommitted.

## 1. Actual application structure

| Area | Verified finding |
| --- | --- |
| Runtime/dependencies | TypeScript ESM, app **0.1.0**; `viem 2.57.11`, `zod 4.6.7`, MCP SDK **1.32.2**. Package declares Node `>=22.18.0`, while production checks require **Node v24.14.1 / SQLite 3.51.2**. |
| Entrypoints | `src/cli.ts` dispatches `src/cli/{run,monitor,operations,oracle}.ts`; `npm start` runs `dist/cli.js`. No inbound server exists. |
| Monitoring | `src/monitoring/service.ts`: explicit one-shot/continuous execution, active-cycle guard, awaited scheduler, bounded reads, transactional observations/outbox, shutdown and restart recovery. |
| Persistence | `src/storage/{store,migrations,validation,backup,paths}.ts`: SQLite schema **5**, app ID **0x4c575033**, checked migrations, WAL/FULL, local ownership, bounded resources and verified backup/recovery primitives. |
| Risk/assurance | `src/morpho/*`, `src/risk/*`, `src/oracle/*`, `src/oracle-assurance/*`; exact arithmetic and persisted conservative public risk views. Repayment/collateral modules calculate estimates, not transactions. |
| Configuration/build | Strict non-secret JSON examples, three existing optional provider variables; `tsc -p tsconfig.build.json` builds CLI/support modules. No frontend bundle or server entrypoint is produced. |

Source inspections covered package/build configuration, CLI dispatch, constructor/initialization/loop call sites, storage locks/read paths, diagnostics, resource and path validation, backup/evidence handling and release-verification scripts. This assessment is based on code as well as prior reports.

## 2. Existing frontend findings

**No Next.js application, frontend framework, dashboard or inbound HTTP server exists.** Source searches for HTTP server creation/listening and common web imports returned no matches. Existing HTTP code is outbound RPC/MCP/notification transport.

Recommendation: a narrow read-only HTML/JSON addition in the proposed service, with explicit auth and bounded data projections. A separate Next.js project adds dependencies/build/deploy work and still needs the same data boundary; consider it with the independently deployed frontend variant only when requirements justify it. No frontend was created in Phase 7.

## 3. Worker isolation findings

- Monitoring already runs independently of any frontend through the explicit CLI. Continuous mode requires `monitor` plus `--enable` or `monitoring.enabled=true`; `--once` is a distinct bounded request. Defaults remain disabled.
- Inspected library imports do not start monitoring. **`src/cli.ts` is not import-safe for a web module** because it immediately dispatches arguments. Proposed route/library modules must never import it or call monitor methods at module scope/build time.
- `MonitoringService` construction does not schedule work, contact providers or acquire ownership. It does validate configuration/thresholds, including filesystem path inspection. A blanket “all constructors/imports are side-effect-free” claim would be inaccurate.
- `MonitorStore` defaults writable: constructor maintenance ownership precedes initialization/migrations; long-lived ownership is acquired by `MonitoringService.initialize()` at first cycle. A web reader must explicitly use `readOnly: true` and never expose a writable constructor.
- SIGINT/SIGTERM shutdown, bounded settlement, cancellation and ordinary restart recovery exist. Windows local tests and forced-child termination are historical evidence; actual Linux/Render signals, HTTP shutdown and disk-service deadlines remain untested.

Healthy default delay is **60–72 seconds after completion**. The **240-second** value is a cycle timeout. With Phase 6's approximately **63.6–64.8-second** bounded cycles, healthy start-to-start timing would be about **124–137 seconds** before other delays; this is an extrapolation, not an accepted Render cadence.

## 4. SQLite multi-process compatibility

**Same host:** read-only connections coexist with one owner; competing writable initialization/monitoring is refused. `database-init`, writable oracle audits and isolated recovery are also write paths; monitoring is not the sole writer command. Backup reads the source but creates a separate artifact.

**Separate Render instances:** they cannot share this SQLite file or disk. The local `*-monitor-lock` transaction is not a distributed lease. The [active-cycle health](../evidence/phase6/health-during-active-cycle.txt) and [competing-writer refusal](../evidence/phase6/database-init-rejected-during-active-cycle.txt) records demonstrate local behavior only.

Render's [disks documentation](https://render.com/docs/disks) restricts a disk to one service instance. Its [Background Worker documentation](https://render.com/docs/background-workers) excludes all inbound traffic. Therefore a separate web instance cannot directly open a worker-owned SQLite database, and the worker cannot serve an internal read API. The supported owner API type is [Private Service](https://render.com/docs/private-services), with same-region [private networking](https://render.com/docs/private-network).

## 5. SQLite versus PostgreSQL comparison

The [storage decision](render-storage-decision.md) evaluates implementation complexity, operational reliability, cost, durability, backup/recovery, concurrency, failure recovery and scalability.

- **Option A recommended:** retain one SQLite owner and restricted read access. Compact initial variant co-locates HTTP/monitoring; split variant uses `pserv` owner + Web Service. Reuse verified storage contracts, then test the new lifecycle/read/bootstrap behavior on Render.
- **Option B deferred:** PostgreSQL enables a real Background Worker + Web Service sharing durable rows through separate roles. It requires schema/driver/migration/backup changes and explicit monitor/outbox ownership; PostgreSQL does not itself enforce one scheduler.
- A future migration must preserve atomic state/cycle/fingerprint/alert/outbox commits, revision checks, exact amounts, dedup tombstones, delivery attempts/cooldowns/ambiguity, sticky assurance and evidence hashes. Managed PITR is valuable but does not replace durable evidence storage or notification reconciliation.
- More viewers or a separate dashboard alone do not force PostgreSQL. A Private Service read API or an outward-published projection can retain SQLite; projection publishing is a separate unimplemented consistency protocol.

No PostgreSQL service, driver, schema or migration was created.

## 6. Recommended Render architecture

**Topology 1, initial proposal:** one paid **Web Service**, `numInstances: 1`, persistent disk, explicit service entrypoint containing the existing monitor plus read-only HTTP/dashboard. SQLite reads stay on the owner. Monitor startup is explicitly gated; disabled startup must expose safe HTTP state without starting a loop or creating missing storage. Public HTTP and monitoring share a resource/failure/deploy domain, so load/shutdown tests are essential.

**Topology 2, two-service variant:** the monitor and SQLite live on a disk-backed **Private Service (`pserv`)** exposing a restricted authenticated read API. A separate Web Service proxies it server-side. The frontend can redeploy independently but must show stale/unavailable data during an owner outage. It never mounts or opens the database.

**Topology 3, future Option B:** Background Worker + Web Service + PostgreSQL, with explicit ownership and durable evidence. An outbound projection publisher is another possible worker-based split, but neither shared SQLite nor an existing implementation.

Fixed RPC/MCP, read bounds, financial calculations, assurance gates and optional disabled notification adapters remain the behavior to preserve. Render adoption does not create an execution feature or qualify the oracle.

## 7. Proposed service configuration

| Item | Proposal / qualification |
| --- | --- |
| Type/plan | Web Service, native Node, `1c-2g` (1 CPU / 2 GB advertised), exactly one instance |
| Runtime pin | `NODE_VERSION=24.14.1`; verify SQLite **3.51.2** and binary provenance on the actual Linux instance |
| Build | `npm ci --include=dev && npm run build`; no monitor or disk operations during build |
| Start | `node dist/service.js --config config/render.json --runtime-root /var/data/watchdog/runtime --database /var/data/watchdog/storage/watchdog.sqlite` — **proposed contract, files absent** |
| HTTP | `0.0.0.0:$PORT`, public tiny `/api/health`; protected data routes and deeper cached readiness |
| Shutdown | Proposed application **20 seconds**, retaining margin before Render's fixed **30 seconds** for disk services; actual total exit time must be measured |
| Persistence | Proposed **20 GB** at `/var/data/watchdog`; DB/sidecars, persistent evidence workspace, bounded backup staging |
| Deploy control | `autoDeployTrigger: 'off'`, previews `'off'`; this does not prevent an initial deploy if applied |
| Environment | Existing provider variables remain optional/disabled; proposed read-access token and, for Topology 2, distinct internal token. No secret values supplied. |
| Blueprint | [render.yaml](../render.yaml), **DRAFT-UNAPPROVED-NOT-DEPLOYED**. Local schema/field checks only; never applied or submitted to an account. |

Evidence paths and backups require runtime-workspace bootstrap: the current code expects relative `evidence/phase1`…`phase5` paths. A DB-path change alone would leave new evidence ephemeral. Seed/verify regular evidence files on the disk without overwriting conflicts; keep release/config paths explicit. Build, pre-deploy, one-off jobs and separate cron services cannot access the owner's disk. See [deployment plan](render-deployment-plan.md) §§4–5.

## 8. Dashboard and API design

Proposed GET routes: `/api/health`, `/api/readiness`, `/api/positions`, `/api/risk`, `/api/alerts`, `/api/monitoring/status`, and a bounded `/api/observations` history route. All data routes are protected reads; no HTTP start/stop/reconfigure, migration, backup or restore controls are proposed.

Existing `riskView` is a useful validated source, but full diagnostics, summaries and assurance objects are not public DTOs. Build explicit bounded response schemas: omit internal paths/PIDs/configuration, secrets, raw errors/provider payloads and unrestricted evidence graphs. Use short coherent read snapshots, bounded caching, parameterized cursor queries, at most 100 rows and a proposed 256 KiB response cap. History helpers and HTTP code are new work; do not claim they already exist.

The dashboard displays fixed position identity, debt/collateral, ratios/scales, thresholds, history, delivery state, monitoring state, data quality and snapshot/block/time provenance. Every view retains **oracle UNVERIFIED / freshness UNKNOWN / indicative estimates / `actionable: false`**. Distinguish rejected latest attempts from last-accepted history; never make stale/cached data appear current or turn an absent estimate into zero. No HTTP request triggers a chain read or another monitor loop.

## 9. Security assessment

The [security plan](render-security-plan.md) preserves existing fixed chain wiring, method/body bounds, explicit provider enablement, redaction and path/storage checks. It proposes a minimal public liveness response, protected data routes, separate internal credentials for the split design, strict field allowlists, bounded request/page/cache limits, same-origin rendering, safe headers and no user-controlled URLs/paths/SQL.

Authentication is new Phase 8 work: read-only does not automatically justify public operational-history disclosure. Provider secrets remain disabled/optional; proposed read credentials are distinct, privately injected and never rendered to clients or logs. Configuration/maintenance stays on the operator side with writer fencing. Off-disk backups and Render/Linux platform behavior remain acceptance work, not inherited proof from local testing.

## 10. Estimated Render resource requirements

Local measurements: worker RSS approximately **94 MiB**, checker about **101 MiB**, synthetic peak about **292 MiB**; DB about **3.8 MiB** in a synthetic run and **1,310,720 bytes** after Phase 6's 12-cycle series. These do not establish the capacity of an HTTP/worker/backup process. A 64-second elapsed cycle includes network waits and does not measure CPU utilization.

Initial proposal: **1 CPU / 2 GB RAM**, consistent with the earlier ≥2 GiB host sizing recommendation; preserve the application's **512 MiB RSS ceiling** and prove headroom under HTTP/backup load. Proposed disk **20 GB** includes live storage/evidence and bounded backup staging, not unlimited retention or full-size multi-copy restore scratch. Preserve caps: DB 4 GiB, WAL 256 MiB, evidence 2 GiB/50,000 files, free reserve 512 MiB, pending deliveries 10,000. Seeded archives, backups, partial captures and all unpruned records count toward real volume usage.

[Render pricing](https://render.com/pricing), consulted **2026-11-02**: service `1c-2g` **$25/month**, disk **$0.25/GB/month** → initial **$30/month** for one service + 20 GB. Split example **$37/month** with a $7 small frontend (or $55 with two $25 services). PostgreSQL example compute subtotal **$51/month** for worker $25 + frontend $7 + `0.5c-1g` DB $19, before DB/evidence storage. Postgres storage is listed at $0.30/GB/month; smaller paid compute exists. Workspace, usage, taxes and off-disk backup costs are additional. No plan was purchased.

Bandwidth and long-term growth are unmeasured. There are many bounded requests to two destinations, not two requests every 240 seconds. Roughly 630–700 healthy cycles/day is an estimate from local timing, not a Render observation/SLA. Free web instances cannot provide this persistent continuous workload.

## 11. Implementation steps for Phase 8

All steps are **proposed**; Phase 7 stops before implementation/deployment:

1. Review the architecture/storage/access/cost decisions and choose the single-service or `pserv` split variant. Keep implementation, acceptance deployment and production operation approvals distinct.
2. Add the explicit service entrypoint, persistent-evidence bootstrap, read-only repository/DTOs/auth/routes and minimal dashboard. Add bounded history reads as needed; preserve financial/assurance/chain logic and storage mutation contracts.
3. Test import/build/disabled-start behavior, one owner, missing/corrupt read refusal, coherent bounded reads, auth/redaction, no request-triggered upstream calls, HTTP pressure and shutdown/backup cancellation.
4. Extend release inputs for new configuration/Blueprint/assets and run full verification plus new checks in a **separate candidate archive**, followed by finalization/manifest/check. Current scripts write Phase 5 outputs; preserve historical archives rather than rerunning them over sealed evidence. No source change can inherit a documentation-only verification result.
5. After separate deployment authorization, create an immutable identified release and perform Render acceptance with monitoring and external providers disabled. Validate actual Linux runtime/binary/SQLite, mount/permissions, evidence, config and protected HTTP behavior.
6. Run specifically authorized bounded console-only observations; exercise read concurrency, stop/start deploys, lock exclusion, interrupt/restart/dedup recovery, total exit before the 30-second kill limit, transient failures and resource behavior. Repeat applicable [host gates](host-acceptance-checklist.md) on Render.
7. Implement/test owner-local consistent backups and verified off-disk transfer. Demonstrate isolated restore/reconciliation at representative sizes; inherited RPO ≤1 hour and RTO ≤30 minutes remain **targets**, not measurements. Verify log handling and an approved real-duration soak.
8. Only after acceptance and a fresh go/no-go, consider continuous production monitoring; real provider notification enablement is separate. Financial actionability remains false throughout.

## 12. Outstanding risks and blockers

1. Oracle economics/operators remain unverified; upstream freshness unknown; no qualified independent comparator. RPC/MCP share an upstream. Deployment closes none of these assurance gaps.
2. Production approval is **NOT GRANTED**. Render is not yet an accepted target; runtime provenance, Linux signals, storage durability/faults, permissions and actual lifecycle/restart behavior are unverified there.
3. Service/HTTP/auth/bootstrap/history/backup automation is unimplemented. The Blueprint's missing entrypoint/config prevent it from being a runnable deployment package today.
4. Single-owner/disk downtime and co-located public HTTP load are real design tradeoffs. A separate frontend only retains stale data during an owner outage; database/projection alternatives add verification scope.
5. Off-disk recovery/RPO/RTO, real notification delivery and a production-duration soak remain outstanding. An older restore may lose post-backup acknowledgments and require delivery reconciliation.
6. The preserved pre-Phase-7 release does not bind the added documents/Blueprint. A future candidate needs explicit new binding; the original historical manifest must not be silently replaced.

### Phase 7 verification and preservation record

**Completed local checks passed within their stated scope.** Preparation ran on **2026-11-02, 14:07:28.785–14:07:57.817Z**; the initial documentation/preservation pass finished at **14:11:52.687Z**. Exact arguments, working directories, timestamps and outputs are retained outside the project at `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase7-validation-fqzKjQ\`.

In the command table, `<T>` means `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode`, and `<R>` means that full verification directory. `node` resolved to `C:\Program Files\nodejs\node.exe`. Commands ran in `C:\liquidation-watchdog` unless an isolated working directory is specified.

| Check | Command / working directory | Recorded result |
| --- | --- | --- |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit` | **PASS, exit 0**; no build output written |
| ESLint | `node node_modules/eslint/bin/eslint.js src test scripts "*.config.*"` | **PASS, exit 0** |
| Guarded library import/construction | `node "<T>\phase7-import-check.mjs"` | **PASS, exit 0**; five built library modules and disabled `MonitoringService` construction |
| Blueprint YAML/JSON Schema | `python "<T>\phase7-validate-blueprint.py" "<R>"` | **PASS, exit 0**; zero schema errors, proposal assertions passed, missing service/config entrypoints confirmed |
| Original release binding | `node --import tsx scripts/release-manifest.ts --check`, cwd `<R>\original-release` | **PASS, exit 0**; original source/build/documents and 375 Phase 5 evidence files match |
| Expanded-document binding boundary | Same release-check command, cwd `<R>\phase7-documents` | **Expected exit 1**: added Phase 7 documentation is outside the original release binding; this is not a newly approved release |
| Local documentation targets | `node --import tsx scripts/check-doc-links.ts`, cwd `<R>\phase7-documents` | **PASS, exit 0; 330/330** targets exist; generated check output stays in the isolated copy |
| Secret hygiene | `node --import tsx scripts/check-secrets.ts --read-only` | **PASS, exit 0; 1,004 files, 0 findings**; placeholder template verified |
| Git diff whitespace | `git diff --check` | **PASS, exit 0** |
| Untracked-file whitespace | `git -c core.quotePath=false diff --no-index --check -- "<R>\empty.txt" <file>` for each untracked project file | **PASS, 454/454 files**; zero whitespace diagnostics, accepted diff exit statuses 0/1 |

The guarded smoke imported `dist/monitoring/service.js`, `dist/storage/store.js`, `dist/operations/diagnostics.js`, `dist/config/monitoring.js` and `dist/config/risk.js`. It recorded **0 monitor-method calls, DB opens, storage-method calls, filesystem writes, network attempts, recurring schedulers, added signal handlers or new timer/network resources**. It did not import the dispatching CLI entrypoint. Filesystem metadata reads during path validation remain possible; this result qualifies inspected library imports and disabled construction, not future HTTP startup or an enabled service.

The Blueprint matches SHA-256 `766eb55f0a0f215155853a77fad09da243cd575eb93b22260288d49ce24628ef`; the downloaded schema matches `8a3fb8da6b4f55fe686fbefa790e011d3dd7895f013f355953c572a21ab6494a`. Validation was local, against the published schema; no Render account/API validation or deployment occurred. The secret scan covered project-owned source/documents/sanitized evidence, excluded dependencies/build/Git/private runtime data/backups and did not open potential private-key files. `.env.example` retains SHA-256 `517c936b52b4489029ba6576c553cbfc2b052eebe638511b4d055ace99d22c69`.

| Preserved binding group | Exact byte-length and SHA-256 matches |
| --- | ---: |
| Source/configuration/tests/scripts/package inputs | **162/162** |
| Original built outputs | **237/237** |
| Original release-bound documents | **40/40** |
| Phase 1–4 evidence, against the sealed prior-phase baseline | **391/391** |
| Phase 5 evidence, against the original release manifest | **375/375** |
| Phase 6 payloads, against its self-excluding hash manifest | **25/25** |
| **Total historical bindings** | **1,230/1,230** |

The project inventory contains **997 unchanged original files, 0 modified/missing originals, and exactly 7 additions**, totaling **1,004 files** under the existing project-inventory exclusions; built outputs are checked separately above. The Git index is byte-unchanged. The original release manifest/checksum remain intact; the Phase 6 manifest retains SHA-256 `15708b4f1000f1c1859010f6dabfc11c87d96391bcacb60662354ab122c4bda3`. These are final-byte preservation results after the recovery disclosed below. Historical Phase 5/6 full verification is preserved, not relabeled as a newly executed full suite.

Process snapshots at **14:07:26.079Z** and **14:11:51.634Z** found **0 watchdog CLI/service processes**. The final seal records another process snapshot. These checks did not start a monitoring cycle, contact chain/provider endpoints, send notifications or open a live monitoring database.

The external verifier was invoked as follows; its `final` mode produced the pre-seal documentation results, while `seal` verifies the completed report/inventory:

```powershell
node "[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase7-validate.mjs" prepare
node "[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase7-validate.mjs" final "[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase7-validation-fqzKjQ"
node "[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase7-validate.mjs" seal "[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase7-validation-fqzKjQ"
```

Evidence files in `<R>`: `source-and-release-results.json` and its five command logs; `pre-seal-results.json` and its command/whitespace logs; `final-results.json` for the handoff seal's exact final timestamps, repeated link/secret/Git checks, seven deliverable whitespace checks, original-byte/index/process preservation, **12 report sections** and **six inventory hash rows**; and `phase7-file-bindings.json` for all seven final hashes, including this report and the self-excluding inventory. The other **447** untracked files retain the bytes covered by the initial whitespace pass. Final hash records stay external to avoid circular self-hashes or rewriting historical release evidence.

### Verification side effect and exact recovery

An early `npm run verify -- --finalize` invocation passed **5/5 checks**, but the existing script writes to `evidence/phase5` and regenerates `docs/phase5-files.md`. It overwrote **nine bound Phase 5 outputs and that inventory**, and added **seven** attempt files under `verification-runs/29a5c200-80e5-4439-ba0c-a9461903b9ae`. Its result was not accepted as evidence of archive preservation.

All accidental outputs were preserved separately. The ten historical files were then restored **only after their candidate bytes matched the pre-existing sealed SHA-256 and byte length**: five exact copies from attempt `8832e535-5f0d-459e-ae7c-a717ecfd0de1`; deterministic reconstruction of four JSON outputs and the inventory for the remaining five. Original timestamp bytes were recovered within the old recorded command intervals and confirmed by the sealed digests; they do not represent new verification runs. The seven new attempt files were relocated out of Phase 5 after byte-verified preservation.

Recovery completed **2026-11-02T13:45:58.192Z** with **1,230/1,230 historical bindings matching**. Recovery records, candidate bytes and preserved accidental output remain at `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase7-reconciliation-efJIYL\`. The original manifest/checksum were retained: SHA-256 **`f9059fe0ad2fd031a505c79ea0e38397cc4eb624f6a4d7e0caee96463d581f3a`**, created **2026-11-02T10:42:35.783Z**. Final checks use read-only operations or isolated copies so this archive is preserved.

### Phase restriction confirmation

No Render account/service connection or creation, Git-provider connection, service/disk/database/plan creation, PostgreSQL migration, deployment, production environment change, permanent monitoring, real notification, transaction signing/broadcasting, commit/push/tag, or unrelated-project change occurred. No private credential value was inspected, printed or stored. Local transient evidence writes are disclosed and recovered above; the final Phase 7 project delta is the six documents and unapproved Blueprint listed in the inventory.
