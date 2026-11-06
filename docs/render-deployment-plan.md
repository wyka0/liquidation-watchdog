# Render deployment plan — Phase 7

**Plan only. Production approval remains NOT GRANTED.** No Render account connection, Git-provider connection, service, disk, database, plan purchase or deployment was performed. The [Blueprint draft](../render.yaml) is **DRAFT-UNAPPROVED-NOT-DEPLOYED**; the Phase 8 files it references (`dist/service.js`, `config/render.json`) are committed in this copy, but their presence does not establish host, deployment or production acceptance. Reading public platform documentation and validating a schema locally are not host acceptance.

Companions: [architecture](render-architecture.md), [storage decision](render-storage-decision.md), [security plan](render-security-plan.md), [Phase 7 report and verification](phase7-report.md).

## 1. Platform facts and their consequences

Official Render documentation consulted **2026-11-02**:

| Fact | Consequence for this project | Reference |
| --- | --- | --- |
| A disk is available to one instance, at runtime only. | All SQLite file access and backup creation run on the owner. Build, pre-deploy, one-off jobs and separate services cannot use that disk. | [Disks](https://render.com/docs/disks) |
| Disk-backed deploys stop the old instance before starting the new one; horizontal scaling is unavailable. | Accept downtime and use exactly one owner. An HTTP/monitor process shares that downtime. | [Disks](https://render.com/docs/disks), [deploy lifecycle](https://render.com/docs/deploys) |
| Disk services cannot customize the shutdown delay; default SIGTERM-to-SIGKILL allowance is 30 seconds. | The application's existing 30-second settlement budget leaves no cleanup margin. Propose 20 seconds plus measured cleanup headroom. | [Graceful shutdown](https://render.com/docs/deploys#graceful-shutdown) |
| Background Workers receive no inbound traffic; Private Services do. | A separate SQLite owner exposing an internal API must be `pserv`, not `worker`. Same-region private networking is required for the split design. | [Workers](https://render.com/docs/background-workers), [private networking](https://render.com/docs/private-network) |
| Web services support HTTP health checks; Private Services have TCP checks only. | `/api/health` is the proposed Web Service probe. Private owner application health needs an authenticated internal check and terminal-failure exit, not an assumed Render HTTP probe. | [Health checks](https://render.com/docs/health-checks) |
| `NODE_VERSION` has priority over repository version files/`engines`. | Pin `24.14.1` explicitly and verify the Linux binary plus bundled SQLite at runtime. | [Node version selection](https://render.com/docs/node-version) |
| Free web services spin down and cannot attach disks; free Postgres expires after 30 days. | Neither free service is the durable continuous-monitoring target. | [Free instances](https://render.com/docs/free) |

## 2. Proposed service settings

These settings describe **Topology 1**; none has been applied.

| Setting | Proposed value / behavior |
| --- | --- |
| Type/runtime | `type: web`, `runtime: node` |
| Compute | `plan: 1c-2g` — advertised 1 CPU / 2 GB RAM; starting point consistent with the existing host recommendation, pending load tests |
| Instances | `numInstances: 1`; no horizontal replicas/autoscaling |
| Build | `npm ci --include=dev && npm run build` — TypeScript requires devDependencies; compilation must not start monitoring or access the disk |
| Start | `node dist/service.js --config config/render.json --runtime-root /var/data/watchdog/runtime --database /var/data/watchdog/storage/watchdog.sqlite` — **proposed argument contract; the referenced executable and JSON config are committed in this copy but have never been deployed to a host** |
| Listener | Bind `0.0.0.0` on Render's `PORT` (documented default 10000); validate the value. Current CLI binds no HTTP port. |
| HTTP probe | `healthCheckPath: /api/health`; small in-memory response, 200 when startup has succeeded and lifecycle is healthy; no upstream calls |
| Deploy control | `autoDeployTrigger: 'off'`, preview generation `'off'`; all deploys remain explicit. These settings do **not** prevent the initial deployment if a Blueprint is applied. |
| Disk | `sizeGB: 20`, `mountPath: /var/data/watchdog`; proposed capacity, not a provisioned volume |
| Restart behavior | Use Render lifecycle management; fail nonzero on terminal worker/storage errors. The docs describe automatic restarts for sustained failing health checks. Crash/retry timing and restart-storm handling require host acceptance; no invented `restartPolicy` Blueprint field is used. |
| Shutdown | Propose `shutdownTimeoutSeconds: 20` in the reviewed JSON. Close HTTP admission/idle connections, stop scheduling, settle/cancel work and close storage within the platform's 30 seconds. No `maxShutdownDelaySeconds` override with a disk. |

Default 15-second provider timeouts fit inside the proposed 20-second application budget, but this is **not proof of successful shutdown**. Current shutdown can wait until its deadline before aborting reads. Synchronous SQLite work, HTTP sockets, backup activity and final close may add delay. Phase 8 must measure total SIGTERM-to-exit and hard-kill recovery under those conditions; clean stop exits 0, timed-out/failed stop exits nonzero. The existing 240-second cycle budget is not a shutdown allowance.

`region`, repository, branch and immutable release identity must be selected before a future apply. The draft omits unselected values rather than inventing them; Render defaults would otherwise apply. The current Git identity is `UNAVAILABLE_NO_VERIFIED_HEAD`, so there is no approved deployment revision today.

## 3. Configuration and environment

Proposed `config/render.json` is a reviewed **non-secret** derivative of [the production example](../config/production.example.json), supplied as a regular bounded JSON file:

- `operations.profile: "production"`; preserve runtime/chain validation.
- `monitoring.enabled: false` initially; interval **60 seconds after completion** with existing jitter/backoff.
- `storage.path: "/var/data/watchdog/storage/watchdog.sqlite"`; retention 30 days for eligible cycles, 180 days for eligible alerts.
- `notifications.telegram: false`, `notifications.discord: false`; retain existing retry/cooldown semantics.
- Proposed shutdown budget 20 seconds; cycle timeout 240, connectivity timeout 30, chain-status maximum age 600 and failure-backoff maximum 900 seconds.
- Preserve the resource ceilings in §6 and risk thresholds warning **1.30**, critical **1.10**, target **1.25**, liquidation boundary **1.00**.

Resolve config/threshold paths against the release directory **before** entering the runtime workspace. No config field or HTTP parameter may change chain **1672**, RPC `https://rpc.pharos.xyz`, MCP `https://mcp.pharos.xyz/mcp`, market `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73`, account `0xc6dd9976066f3364b4d6a72cd4f1fa0468327aa7`, or conservative assurance/actionability rules.

| Environment variable | Existing or proposed use | Handling |
| --- | --- | --- |
| `NODE_VERSION` | Render interpreter selection | Non-secret `24.14.1`; not a replacement for the runtime check |
| `PORT` | Proposed HTTP listener | Platform-supplied; current CLI does not consume it |
| `WATCHDOG_TELEGRAM_BOT_TOKEN`, `WATCHDOG_TELEGRAM_CHAT_ID`, `WATCHDOG_DISCORD_WEBHOOK_URL` | Existing optional notification configuration | Disabled providers need none of these. If later enabled, inject privately; never put values in JSON, source or evidence. |
| `WATCHDOG_READ_API_TOKEN` | **Proposed** operator read access to data routes/dashboard | New Phase 8 auth code, not a current recognized application option. `sync: false` in the draft; missing credential must never make data routes public. |
| `WATCHDOG_INTERNAL_API_TOKEN` | **Proposed, Topology 2 only** | Distinct service-to-service secret at the owner and frontend backend; never browser-visible |

No secret value is included here or in the Blueprint. `sync: false` requests secure input during a future setup; it does not provision credentials now. `.env.example` remains byte-identical to the verified template. Notifications stay disabled even if their variables happen to exist.

## 4. Runtime storage and packaging work

Suggested regular-directory layout on the owner:

```text
/opt/render/project/src/              release source/build/config (ephemeral deployment)
  dist/service.js                     committed build output; never deployed to a host
  config/render.json                  committed non-secret config; never deployed to a host
/var/data/watchdog/                   one persistent disk
  storage/watchdog.sqlite             main DB and all adjacent SQLite/ownership sidecars
  runtime/evidence/phase1/...          required reviewed references at original paths
  runtime/evidence/phase2/...          required release/backup references
  runtime/evidence/phase3/...
  runtime/evidence/phase4/...
  runtime/evidence/phase5/...          required archive + any new runtime audit bundles
  backups/<exclusive-backup-id>/      temporary staging of complete verified backup sets
```

The database alone is insufficient. `src/oracle-assurance/reviewed.ts`, `src/config/evidence.ts`, diagnostics and `src/storage/backup.ts` use relative evidence paths; persisted bundle validation specifically recognizes `evidence/phase4/...` and `evidence/phase5/...`. Merely moving the DB leaves generated evidence on the ephemeral filesystem. Do not rename bundle references or bypass path validation to work around this.

Phase 8 bootstrap must resolve the release paths, validate the mount and permissions, exclusively seed required evidence from the verified release, compare existing files to recorded hashes, and then select `/var/data/watchdog/runtime` as the working directory. Conflicts/missing required references fail closed; no silent overwrite, empty reset or symlink alias. The executable and explicit configuration remain associated with the release, while evidence survives redeploys. Operator backup commands must use this workspace (or the existing library's explicit `projectRoot`). This bootstrap and its failure/upgrade tests are **not implemented**.

Migrations and restore promotion run on the owning runtime instance, after fencing the monitor and taking a verified backup. They cannot run in Render's build, pre-deploy or one-off job. A separate cron service cannot mount this disk. Initial `database-init` is an explicit operator step; an unauthenticated HTTP request must never initialize the database.

## 5. Backup, restart and recovery

Existing mechanisms are documented in [database operations](database-operations.md) and [rollback/recovery](rollback-and-recovery.md): SQLite online backup, standalone backup DB, manifests/hashes, required evidence, isolated restore validation, forward-only migrations and restart recovery. Reuse them, then prove them on Render.

Proposed backup operation:

1. Run one bounded, non-overlapping backup task **on the owner** on an hourly schedule and before a migration. Scheduling/transfer automation is Phase 8 work; it must participate in shutdown and have bounded CPU/disk/timeout budgets. An operator can run the existing backup CLI in the owner's Shell/SSH during acceptance.
2. Write a new exclusive bundle under `backups/`, using the online backup API rather than copying a live main DB/WAL. Check free space for DB plus all referenced evidence. Retain partial failures as unusable incident artifacts; stop/alert before reserve exhaustion.
3. Complete `backup-verify`, transfer the whole bundle plus matching release/configuration identity to separately controlled off-disk storage, and verify the received bytes. A file on the same Render disk is only local staging.
4. Perform isolated restore checks off-host at representative sizes. Proposed off-disk retention is 24 hourly plus 7 daily verified sets, subject to measured storage/cost. Keep local staging bounded and only retire a verified local set after independently verified off-disk receipt; account for partial/new sets before starting the next backup.
5. For corruption/host loss, fence writers, preserve the incident DB and sidecars, restore into a new candidate directory, validate schema/evidence, reconcile post-backup deliveries, then explicitly promote the candidate. Render code rollback does not roll back schema/data safely by itself.

Render takes disk snapshots every 24 hours and retains them for seven days. It warns against raw disk-snapshot restore for custom database recovery. These snapshots **do not replace application-consistent SQLite/evidence backups or off-disk copies**. The inherited **RPO ≤1 hour / RTO ≤30 minutes** are proposed targets, not achieved results; measure from successful off-disk backup completion and a timed host-loss restore/reconciliation drill.

Ordinary restart recovery retains known-delivered rows and dedup fingerprints. Delivery is **at least once**, with ambiguous in-flight attempts recorded. An older backup can omit acknowledgments/events that occurred afterward; those can already have reached recipients. Keep external channels disabled during restore review and reconcile later delivery evidence before enabling them.

## 6. Sizing and estimated monthly cost

Measurements from [Phase 5](phase5-report.md) / [Phase 6](host-acceptance-report.md): approximately **94 MiB worker RSS**, **101 MiB checker RSS**, **292 MiB synthetic peak**, 144 synthetic cycles with DB about **3.8 MiB** / WAL about **4.3 MiB**, and **1,310,720 bytes** DB after the Phase 6 12-cycle series. These are small local runs, not HTTP load tests or production-duration measurements. A roughly 64-second cycle is elapsed time including network waits, not a CPU-utilization measurement.

| Resource | Initial proposal and capacity rationale |
| --- | --- |
| Compute | 1 CPU / 2 GB advertised plan, retaining headroom above the application's **512 MiB RSS stop ceiling**. Measured RSS below 512 MiB does not qualify a 512 MB host for combined HTTP, monitoring and backups. |
| Live storage | DB cap **4 GiB**, WAL cap **256 MiB**, current evidence budget **2 GiB / 50,000 files**, minimum free reserve **512 MiB**. The evidence cap is not a cap on the entire mounted volume; include seeded archive data, sidecars and backups separately. |
| Disk size | **20 GB** starting proposal for the small observed workload, live ceilings and bounded local backup staging. At ceilings, one DB+evidence backup can approach **6 GiB**; simultaneous old/new backups, partial captures and restore scratch can exhaust this disk. Preflight actual usage, transfer/retire staging promptly and grow capacity before more copies are needed. Do not promise full-size recovery scratch fits. |
| Growth | Cycle/alert retention is conditional; fingerprints and required assurance/delivery records survive pruning. Track DB/WAL/evidence growth and forecast capacity; the short runs cannot establish a steady-state size. |
| Network | Two fixed upstream **destinations**, many bounded requests per cycle (including supplemental audit reads). Roughly 630–700 healthy cycles/day is an extrapolation from local timing plus default delay, not a measured Render rate. Request/response bytes, dashboard usage and backup egress must be measured; bandwidth is not assumed negligible. |
| Logs | Structured bounded stdout; no secret/request payloads. Render currently advertises 7-day Hobby / 14-day Pro log retention. Verify actual selected-plan behavior and off-host incident retention; logs are not the authoritative database/evidence backup. |

Illustrative USD list prices from [Render pricing](https://render.com/pricing), **2026-11-02**, before taxes/usage/backup storage:

| Layout | Illustrative monthly subtotal |
| --- | --- |
| Topology 1 | `1c-2g` **$25** + 20 GB disk at **$0.25/GB = $5** → **$30/month** |
| Topology 2 | Owner $25 + illustrative small frontend `0.5c-512mb` $7 + disk $5 → **$37/month**; **$55** if the frontend also needs `1c-2g`. Frontend sizing remains untested. |
| Topology 3 example | Worker $25 + frontend $7 + PostgreSQL `0.5c-1g` $19 → **$51/month before database storage and durable evidence storage**. Postgres storage is listed at $0.30/GB/month. Paid Postgres also has a smaller $6 tier; the $19 example is not a claimed minimum. |

Workspace pricing is separate: Hobby **$0 + compute**, Pro **$25/month + compute**. Bandwidth, build minutes, off-disk backups and other usage can add charges. No plan was selected or purchased. A paid workspace and a paid compute instance are different billing choices.

## 7. Blueprint review status

[render.yaml](../render.yaml) records Topology 1 only and contains no database resource. It uses documented `web`/`node`, current plan ID `1c-2g`, one instance, disk, health path, explicit Node pin, `autoDeployTrigger: 'off'` and disabled previews. It intentionally has no disk-accessing pre-deploy command, unsupported restart policy or disk shutdown-delay override.

The [published JSON schema](https://render.com/schema/render.yaml.json) can validate syntax/field types locally; that is not validation of service startup, credentials, runtime availability, region, storage durability or host acceptance. The exact local validation result is in [Phase 7 verification](phase7-report.md). **Do not apply this draft in Phase 7:** its entrypoint/config and HTTP authentication are unimplemented, and applying it would create paid resources and attempt an initial deploy despite auto-deploy being off.

## 8. Phase 8 implementation and acceptance sequence — proposed

1. Review the Phase 7 recommendation and choose Topology 1 or the explicit Topology 2 variant; confirm resource/cost and protected read-access requirements. Implementation approval is distinct from deployment/production approval.
2. Add an explicit service entrypoint, runtime-workspace bootstrap, one-owner lifecycle, sanitized read-only repository/HTTP DTOs, protected routes and minimal dashboard. Add bounded history queries if needed. Preserve fixed identity, financial calculations, all oracle gates, and disabled notification defaults.
3. Add targeted tests for import/build safety, disabled startup, read-only refusal/missing DB, field omission, auth, cursor/size limits, coherent reads, no request-triggered RPC/MCP, HTTP pressure, duplicate owner refusal and shutdown/backup cancellation. Pin/test Node v24.14.1 / SQLite 3.51.2 on Linux too.
4. Prepare a **separate verification candidate/archive**. Current verification/finalization scripts write `evidence/phase5`; protect the sealed historical release first. Extend release inputs to bind `render.yaml`, `config/render.json` and any new web assets (the current allowlist does not cover them). Run the existing full verification pipeline plus new checks, then finalization/manifest/check on that candidate; retain old evidence and new output separately.
5. Produce an approved immutable release identity and review actual build artifacts/configuration. Only with separate authorization connect a Git provider/create Render resources and perform the first acceptance deployment. Monitoring and external notifications start disabled.
6. On the actual instance, record runtime/binary provenance, SQLite version, mount/regular-path permissions, evidence hashes and config validation. Initialize/migrate only on the owner. Verify HTTP liveness, not-ready behavior, protected reads, and absence of request-driven monitoring.
7. With bounded acceptance authorization, run console-only observations and collect actual timings. Test read concurrency, restart/dedup recovery, stop-old/start-new deployment, total shutdown time below 30 seconds, forced interruption recovery, fatal-error handling, transient upstream backoff and resource/load behavior. For Topology 2 also test same-region private connectivity, token rejection, owner outage and stale-cache display.
8. Verify off-disk backup receipt and a timed isolated host-loss restore; measure RPO/RTO, capacity and log retention. Reconcile every outstanding [host-acceptance gate](host-acceptance-checklist.md), including durability/fault behavior and an approved real-duration soak.
9. Continuous production monitoring requires its own go/no-go after acceptance. Real Telegram/Discord delivery requires separate destination/credential approval and tests. Oracle **UNVERIFIED**, freshness **UNKNOWN** and **`actionable: false`** persist through all of these steps.
