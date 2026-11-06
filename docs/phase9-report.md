# Phase 9 — Neon PostgreSQL + Render Free compatibility audit

**COMPLETE — Phase 9 documentation-only audit/design, awaiting separate Phase 10 approval.** Recommend a small `pg` backend and **option B: externally triggered, protected 30-minute monitoring cycles** for a limited Free demonstration. The current disk-backed Phase 8 service is not Render Free compatible. Continuous/timely monitoring, production deployment and any Phase 10 implementation remain separately gated. Preservation and documentation checks passed; section 12 identifies the final-byte handoff authority.

Deliverables: [PostgreSQL architecture](neon-postgres-architecture.md), [migration and rollback](sqlite-postgres-migration-plan.md), [Render Free architecture](render-free-architecture.md), [security review](phase9-security-review.md), and [file/preservation inventory](phase9-files.md). Platform research date: **2026-11-02**.

## 1. Executive decision and audit scope

Neon can provide the durable transactional store that Render Free's ephemeral filesystem cannot. This requires an asynchronous persistence integration, exact import/serialization contracts, database-wide fencing, remote evidence/backup arrangements and a new authenticated job route. It is a meaningful implementation phase, not a connection-string or Blueprint-only change.

The simplest suitable driver is **`pg` (node-postgres), explicit SQL, no ORM**. Recommend one Render Free Node process for HTTP plus bounded cycles, one Neon database, and a small external Cloudflare Worker Cron trigger. Preserve a single global writer/dispatcher even if two processes overlap. Proposed UTC cadence is **`7,37 * * * *`**, approximately every 30 minutes, with no dependence on dashboard visits.

This recommendation is conditional on approval of slower sampling and measured capacity. It **does not satisfy continuous liquidation monitoring or a guaranteed maximum alert delay**. The fixed 600-second local observation-age budget means results will often be too old between samples. If the prior timing/recovery targets must remain, choose a funded, qualified hosting/recovery plan before implementation/deployment acceptance.

The audit inspected implementation, historical contracts and public platform documentation. Its repository output is exactly six Markdown documents. Source/configuration/dependencies/schema, databases, build outputs, historical evidence and deployment files remain the Phase 9 baseline until separate authorization.

## 2. Preserved baseline and financial constraints

Pre-inspection verification completed **2026-11-02T16:07:56.560Z**. It matched **665 Phase 8 seal bindings**, **221 evidence payloads**, **1,236 unchanged historical originals plus the five authorized Phase 8 differences**, **1,241 historical snapshot originals**, **seven Phase 7 bindings**, and the original Git index. The new baseline binds **1,773 project-owned files**, with **613 initial Git-status entries** and **zero metadata-only private entries**. Preservation includes database bytes, without opening an application/SQLite database.

- Phase 8 seal SHA-256: `44c5d1f4a588a41cb93024575234cce8806f9c9da40463765e9f77da6c64b094`.
- Phase 9 baseline SHA-256: `a75ffbd423db7c5baf63a199b95cdf1de8c262216371324dac07dbf2fbae3bff`.
- Git index SHA-256: `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689`.

The five Phase 8 deliverables were read: report, file inventory, runtime operations, dashboard/API contract and test evidence. Relevant Phase 1–7 architecture, accounting/risk/rounding, monitoring/alerts, oracle/evidence, operational/backup/recovery, security, host acceptance and Render planning documents were reviewed. [The inventory](phase9-files.md) identifies these authorities and the remaining historical hashes. Unexpected mismatch is a stop condition; no historical repair/rewrite was needed in Phase 9.

| Binding | Preserved value |
| --- | --- |
| Chain | **1672** |
| RPC / MCP | `https://rpc.pharos.xyz` / `https://mcp.pharos.xyz/mcp` |
| Morpho market | `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73` |
| Public demonstration account | `0xc6dd9976066f3364b4d6a72cd4f1fa0468327aa7` |
| Warning / critical / target / liquidation boundary | **1.30 / 1.10 / 1.25 / 1.00** |
| Financial arithmetic | Exact **BigInt**, original rounding and snapshot/block provenance |
| Oracle / upstream freshness | **UNVERIFIED / UNKNOWN** |
| Estimates and actionability | **Indicative only; `actionable: false`** |

RPC/MCP agreement still shares an upstream and is not independent oracle validation. Storage/scheduling changes confer no wallet, signing, broadcast, repayment or collateral-management authority.

## 3. SQLite and local-filesystem findings

The current store uses built-in `node:sqlite`, verified **Node v24.14.1 / SQLite 3.51.2**, schema **5**, application ID **`0x4c575033`**, and five checksummed migrations. Its 12 tables are `schema_migrations`, `streams`, `cycles`, `fingerprints`, `alerts`, `deliveries`, `delivery_attempts`, `delivery_events`, `provider_limits`, `oracle_assurance`, `worker_runtime` and `operational_events`.

`BEGIN IMMEDIATE` serializes writes. Observation, revision/state, assurance, fingerprint, alert and channel-outbox creation commit atomically. Cycle start/finish, claims/acknowledgments, recovery, pruning and runtime updates have separate transaction boundaries. Local `<database>-monitor-lock` and `runtime-owner.sqlite` protect monitor/maintenance/workspace ownership. Their scope covers shared outbox and oracle continuity, which can span threshold streams; a future per-stream mutex is insufficient.

SQLite-specific dependencies include `?` parameters, `INSERT … ON CONFLICT`, `STRICT` tables, integer flags, rowid pagination/ties, `json_valid`/`json_extract`, scalar MAX semantics, PRAGMA application/version/checks, WAL/FULL/checkpoint/page/cache settings, local sidecars/locks, path restrictions, synchronous `.get/.all/.iterate/.run`, SQLite online backup and local evidence-copy/restore validation. PostgreSQL requires explicit equivalents, not textual SQL substitution.

Filesystem dependencies include the mandatory persistent Render mount, CWD-relative reviewed evidence, evidence seeding and exclusive manifests, database/WAL/free-space measurements, local backup directories and generated verification outputs. Runtime, monitor/oracle/operator CLIs, dispatcher, diagnostics, configuration, scripts, tests and generated declarations depend on these contracts. The [complete source/script/test and per-table inventory](neon-postgres-architecture.md#1-current-persistence-inventory) records the migration surface.

Retention protects latest/last accepted state, pending work, referenced cycles, latest/bundle-bound assurance and all dedup tombstones. Thirty-day cycle and 180-day terminal-alert retention **do not bound total storage**. No database rows were inspected or pruned to estimate size in this audit.

## 4. Recommended PostgreSQL persistence design

Use a small async adapter behind a shared persistence interface; explicitly await all operations in the monitoring service, dispatcher, CLI and HTTP read model. Keep the SQLite adapter available for preserved fixtures/import/recovery until separately retired. Pin the `pg` version/types and selected Neon-supported GA PostgreSQL major at implementation qualification; no dependency or server was installed in Phase 9.

Preserve raw financial decimal TEXT and all BigInt calculations; store hash-sensitive JSON as original TEXT with validation/size constraints. Use explicit reversible flag/counter codecs, lossless historical timestamp text with qualified typed projections, and TIMESTAMPTZ/database time for new operational deadlines. Avoid floating-point financial columns, ORM/driver number coercion and JSONB reserialization of evidence. Text IDs remain text; stable bigint sequences preserve source rowid ordering and string cursors.

Add a separate checksummed PostgreSQL migration history, database identity/incarnation, a global owner/fence/expiry row, durable unique schedule-slot receipts and evidence-object bindings. Each short write transaction checks the current global fence and expected revision on one checked-out pg client. READ COMMITTED with explicit locks preserves serial writer behavior; dashboard multi-query reads use bounded REPEATABLE READ/READ ONLY snapshots. Network calls never occur inside those SQL transactions.

Start with one writer connection and one read-role connection per instance, lazy/minimum-zero pools and prompt idle release. Use Neon transaction-mode pooling for runtime and direct TLS connections for migrations/dumps. Session advisory locks, session SET, LISTEN/NOTIFY and persistent temporary state cannot be assumed across pooled transactions. Verify TLS certificates/hostnames and sanitize pg errors; connection-string SSL options require explicit review.

Commit-response loss is an unknown outcome resolved by stable cycle/attempt/receipt identity. A lease fences stale database writes, but cannot revoke a provider HTTP request already accepted; external delivery remains at-least-once with explicit ambiguity. Details and failure policies are in the [PostgreSQL architecture](neon-postgres-architecture.md).

## 5. Migration, rollback and recovery design

Recommend a quiesced one-time migration: select/fence the authoritative SQLite source → verified online backup including committed WAL and all evidence → deterministic export → isolated PostgreSQL load → full parity and recovery tests → disabled-service acceptance → explicitly approved cutover. Record the monitoring gap. A rehearsal snapshot must be replaced by a fresh final snapshot after the final source fence.

Compare all 12 tables through a legacy-compatible field/ordering/codec projection, plus separate rowid ordering maps. Preserve exact JSON/time/financial bytes, assurance hashes, fingerprint IDs, state/episodes, known-delivered records, attempt continuity, blocked providers and evidence bindings. Added PostgreSQL metadata receives a separately versioned manifest. Import never recomputes historical risk or silently skips a malformed row. Recovery runs only after lossless-import parity is proven.

Before any new PostgreSQL mutation, an explicitly verified frozen SQLite release/store can be the rollback source. **After the first PostgreSQL mutation, that SQLite snapshot is stale.** Prefer a schema-compatible application rollback using the same current PostgreSQL data. The first pg release has no earlier compatible pg binary; reverse migration or loss of the post-cutover interval needs an explicit, tested/reconciled decision. A Render rollback button cannot restore database semantics.

Restoration uses a fresh target, verified backup/evidence manifests, a new database incarnation, old-writer fencing and default-disabled channels. Reconcile provider receipts after the backup point; restoring a pending row cannot prove its message was never delivered. [The migration plan](sqlite-postgres-migration-plan.md) supplies the ordered procedure and 12 parity/recovery gates.

## 6. Render Free runtime compatibility

Render Free publishes **0.1 CPU / 512 MB**, a **15-minute inbound-idle spin-down**, roughly **one-minute wake**, arbitrary restarts and an ephemeral filesystem. It provides no persistent disk, shell/SSH, one-off jobs or private ingress. The preserved Phase 8 disk/CWD/SQLite bootstrap therefore needs a new backend-specific runtime contract. `config/render.json` and the paid/disk draft `render.yaml` are not ready-made Free configuration.

Proposed startup validates the release/configuration and binds the provided port with trigger/providers disabled by default. Public `/api/health` remains short, in-memory liveness; protected readiness/data expose persisted as-of state. Render probes need a response within five seconds and cannot become database pings or chain-read triggers. Slower sampling must not cause a cold/restart loop simply because observation age is correctly marked old.

The new POST trigger needs route-specific bounds; current GET/HEAD handlers and their five-second socket timeout cannot host a 240-second cycle unchanged. The dashboard's ten-second fetch timeout can expire during cold wake and should display waking/unavailable with manual retry. Async read projections retain exact amount strings, coherent state, bounded pages/response sizes, restrictive headers and credential-free assets.

All durable observations/state/outbox live in Neon. Required reviewed artifacts are immutable release files or verified private-object references. Local files serve only as bounded scratch/cache. Migrations/backups run on an approved external operator runner. Actual Linux resource, TLS/proxy, shutdown, cold-start and deploy-overlap behavior remains to be qualified.

## 7. Scheduling comparison and recommendation

| Option | Audit conclusion |
| --- | --- |
| **A — bounded internally scheduled cycles** | Reuses the existing loop, but timers cannot wake a suspended Render process; short DB cadence also defeats Neon's idle suspension. Unsuitable for independent Free monitoring. |
| **B — external scheduler invokes a protected endpoint** | Provides real-work wakeups independent of viewers. Requires a separate credential, durable slot idempotency, global fencing, finite HTTP execution and visible missed/late/unknown outcomes. **Recommended.** |
| **C — monitoring on incoming application requests** | No visits means no observations; traffic bursts dictate frequency/cost and give reads hidden side effects. Fails monitoring independence from dashboard visits. |

Propose Cloudflare Worker Cron at **30-minute UTC slots**. Its small handler calls only the fixed Render trigger and validates a receipt. Authenticate before DB/RPC, admit a unique current slot, retain one global owner, and hold the request until bounded work completes. Existing cycle budget is **240 seconds**; proposed whole DB-active job **300 seconds**, lease **360 seconds**, HTTP/client deadline **420 seconds**, and total scheduler invocation **600 seconds** with at most one same-key retry/receipt request. These are design budgets requiring actual-host tests.

No keep-awake ping, dashboard visit or Render health check schedules monitoring. No catch-up storm relabels current reads as missed historical observations. Delayed/missing slots and retry timestamps remain visible; outbox work due between jobs can wait until the next job. The 600-second local observation-age rule remains unchanged, so much of the 30-minute interval is explicitly old. An 8,000-block oracle scan cannot prove continuity over arbitrary gaps. Missed conditions/liquidations and unbounded outage delays remain risks.

Cloudflare Free's 10-ms CPU budget must be measured even though network wait does not count as CPU and Cron permits 15-minute wall time. GitHub Actions' documented delays/dropped schedules/default-branch and public inactivity-disable behavior make it a weaker scheduler candidate. [The Render design](render-free-architecture.md) contains the full comparison and request contract.

## 8. Free-tier limits, capacity and costs

Official limits consulted **2026-11-02**:

| Service | Relevant limits / consequences |
| --- | --- |
| Render Free/Hobby | 750 workspace instance-hours/month, 5 GB outbound/month, 500 standard pipeline minutes/month. Hour exhaustion suspends Free services. Traffic/build overage may bill with payment enabled or cause suspension/build blocking. High service-initiated external traffic has an unpublished discretionary suspension threshold. |
| Neon Free | 100 CU-hours/project/month; 1 GB DB/project and 20 GB account total; 5 GB public egress/project/month; 10 branches/project; five-minute mandatory idle suspension. Compute/egress exhaustion suspends; storage exhaustion can fail inserts, updates **and deletes**. |
| Worker Cron Free | 100,000 requests/day, 10 ms CPU/invocation, 50 subrequests, five Cron triggers/account, 15-minute Cron wall time. No prompt-execution guarantee established. |
| R2 Standard | 10 GB-month, 1 million Class A and 10 million Class B operations in allowance; free egress. Extra storage/operations can bill; retained evidence/backups and lock policies consume capacity. |

At 0.25 CU, a continuously active 31-day Neon month costs **186 CU-hours**, exceeding 100. Using 90 seconds of illustrative DB-active work plus the five-minute idle tail, 30-minute slots consume approximately **40.3 CU-hours/month**; at the 300-second work budget, **62**. A 20-minute upper case consumes **93**, leaving little maintenance/read headroom. Require a total forecast ≤75 CU-hours and qualify the actual CU ceiling/usage. At 0.5 CU the 30-minute upper case becomes 124 and fails Free.

There are **48 jobs/day / 1,488 per 31 days**. Illustrative Render active time including wake/work/full idle tail is **434–520.8 instance-hours/month**, but incoming traffic can keep it awake for 744. Database sizing examples for 1,440 retained ordinary cycles range from **70.31 MiB at 50 KiB/cycle** to **703.13 MiB at 500 KiB/cycle**, before other protected records. One 100-KiB alert per cycle retained for 180 days adds **843.75 MiB**. Storage is a measured gate, not an assumed fit.

Measure wire bytes in both directions. Daily 80-MB Neon exports consume **2.48 GB/month**; daily 300-MB exports consume **9.3 GB**, exceeding Free egress. Proposed resource warnings at 60%/70% DB usage and admission stop at 80% preserve headroom; never rely on pruning after full. Qualify RSS/CPU and query plans on 0.1 CPU/512 MB, including readers and oracle scans.

Zero base charges do not establish zero operating cost. Render overage, Neon capacity/backup needs, R2 retained storage and an external backup runner can cost money. A published-price illustration of $7 paid Render + continuously active 0.25-CU Neon Launch + 1 GB storage is about **$27.07/month**, before other costs and qualification. This is a decision input, not an approved purchase or sized production alternative. Full formulas, allowances, traffic directions, memory/build budgets and sources are in [the capacity design](render-free-architecture.md#7-compute-capacity-model).

## 9. Security, evidence and independent backups

Use separate dashboard, scheduler, runtime-read, runtime-write and operator/backup capabilities. Credentials are injected privately on approved infrastructure; no credential-bearing URL, authorization header, secret key or environment secret value belongs in source, logs, manifests or browser assets. Require verified TLS, bounded parameterized SQL, a small pool, schema-qualified privileges, strict projections and allowlisted error codes. The scheduler has neither DB credentials nor arbitrary request authority.

Keep original evidence paths/hashes as logical identities; resolve release/object mappings without rewriting assurance JSON. Verify object bytes/readback before committing a reference. Private content-addressed R2 is the proposed off-Neon destination, subject to retention/billing approval. Bucket locks can prevent ordinary overwrite/delete, but administrators can change lock rules; separately trusted manifests and role separation remain necessary.

PostgreSQL backup needs a new consistent dump + application/evidence manifest over a direct connection, an independent verified receipt and isolated restore/reconciliation. Neon Free's detailed plan provides **six-hour PITR history capped at 1 GB changes**, one manual snapshot and no scheduled backup service. Generic longer-window backup descriptions do not expand Free limits. Snapshot storage has a published **$0.09/GB-month** price requiring entitlement confirmation. Same-provider history/object storage is not an independent recovery copy.

Inherited one-hour RPO/30-minute RTO remain unqualified targets. A Free demonstration could explicitly adopt **24-hour independent-backup RPO / four-hour operator RTO**, with 14 daily verified sets; that is a service-level change requiring approval and actual measurement. Daily backups may themselves need paid egress as data grows. The [security review](phase9-security-review.md) and [recovery plan](sqlite-postgres-migration-plan.md) document the controls and remaining delivery ambiguity.

## 10. Implementation sequence and acceptance gates

Proposed Phase 10 sequence: approve architecture/service-level decisions → implement async interface and pg codec/schema → implement fenced cycle/outbox and slot protocol → add remote evidence/backup/import tools → adapt runtime/auth/readiness/trigger → run isolated parity/fault tests → bind a candidate release → obtain separate resource/migration/host-test approval → perform disabled-target acceptance → review scheduler/production enablement. Each step retains a rollback point and new evidence destination.

| Gate | Meaningful required evidence; all are future tests |
| --- | --- |
| P10-01 — provenance | Exact baseline/source/build/driver/server identity; historical seals preserved; versioned new evidence outputs. |
| P10-02 — exact values | Maximum-size decimal strings, BigInt round-trips, valid zero/null handling, fractional/invalid-encoding rejection, flags/counters, timestamp precision and raw JSON/hash preservation. |
| P10-03 — migration | All 12-table counts/hashes, source rowid ordering, original IDs/assurance/fingerprints, complete evidence and unchanged source snapshot. |
| P10-04 — atomicity | Failures before/during/after observation commit preserve all-or-nothing revision/state/assurance/fingerprint/alert/outbox behavior, including backlog-cap rollback. |
| P10-05 — ownership | Two processes/streams/thresholds, oracle audit and maintenance contend for the same fence; expired/new-incarnation owners cannot mutate or acknowledge newer attempts. |
| P10-06 — uncertain outcomes | Lost commit/response, duplicate HTTP trigger, crash after provider receipt and stale acknowledgment reconcile stable identities; terminal delivered work is not retried. |
| P10-07 — recovery/retention | Interrupted versus persisted cycles, due retries, channel blocks, tombstones and protected evidence/state survive restart, pruning and isolated restore. |
| P10-08 — HTTP/security | Read/trigger capability separation, auth before DB/RPC, wrong TLS peer refusal, redacted errors, coherent snapshots, keyset cursors, time/size/rate/queue limits. |
| P10-09 — real Free lifecycle | Actual cold starts after Render/Neon idle, Worker CPU/wall-time, long-trigger/proxy/client timeouts, disconnects, SIGTERM/kill and deployment overlap. |
| P10-10 — capacity | Representative near-limit data and alert churn, DB plans/wire bytes, event-loop/RSS, quota exhaustion and a proposed finite 72-hour console-only run with ≥25% compute/egress headroom. |
| P10-11 — independent recovery | Consistent dump/manifest, encrypted off-provider receipt, timed provider/host-loss restore, complete evidence and channel-disabled post-backup reconciliation; achieved RPO/RTO recorded. |
| P10-12 — release/operations | Disabled initial deployment, compatible schema release, old-writer fencing, rollback rehearsal, external overdue/backup monitoring and explicit enablement authority. |

Phase 8's **709 unit tests (including 47 runtime tests), 2 live tests, 99 repeated operations tests, 26/26 pipeline checks and 5/5 finalization** remain preserved historical evidence. They were not rerun or presented as PostgreSQL/Render Free acceptance during this documentation audit. Legacy verification writes Phase 5 outputs and must run only in a deliberately isolated/versioned future workflow.

## 11. Blockers, risks and required approvals

The audit has no blocker to documentation completion. Implementation/deployment readiness is blocked by: absent async PostgreSQL/trigger/import/backup implementations; unselected actual source/target/runtime/driver versions; unqualified real Free CPU/timeout/quotas; no independent backup runner/receipt or measured RPO/RTO; a deliberately slower, often-old observation cadence; unknown provider/scheduler outage behavior; no verified deployed Git release; and the unchanged oracle economic/operator/independent-freshness gaps.

| Approval | Required decision before the corresponding action |
| --- | --- |
| **A1 — Phase 10 implementation** | Accept the pg/explicit-SQL design, asynchronous interfaces, schema/type/fencing/outbox/trigger work and new isolated tests/tooling. This is the next requested approval. |
| **A2 — service level/cadence** | Accept 30-minute best-effort sampling, unchanged 600-second age threshold, missed-event risk and job-quantized notification retries; or require a funded tighter-cadence design. |
| **A3 — resources and cost** | Approve specific Render/Neon/Cloudflare/R2 accounts, regions, quotas, payment/overage policy, spending ceiling and backup runner. Documentation does not authorize account creation or purchase. |
| **A4 — migration/cutover** | Name the authoritative source, target and maintenance window; approve snapshot/import/recovery, gap, rollback boundary and retained evidence. |
| **A5 — backup/recovery** | Approve independent destination/retention, encryption-key recovery, either inherited targets or explicit 24-hour/four-hour demo targets, and sufficient egress/storage/runner capacity. |
| **A6 — host tests and scheduler** | Approve finite actual-host acceptance, then separately enable the reviewed external schedule with failure/overdue monitoring. |
| **A7 — real notifications** | Approve exact channels/destinations, end-to-end delivery tests, ambiguity/reconciliation and slower retry behavior. |
| **A8 — production operation** | Review measured acceptance/security/recovery/cost results. No Free-tier calculation or Phase 10 code approval is production authorization. |

No approval in this table is implied by finishing Phase 9. No financial execution capability is proposed. If sampling or recovery concessions are unacceptable, the Free operating recommendation should be rejected rather than weakening data-quality or actionability labels.

## 12. Final preservation check and handoff

The completed-document review passed at **2026-11-02T16:53:06.081Z**, recorded as `validation-review-1.json` in the external validation directory. Its results are:

| Check | Passed review result |
| --- | --- |
| Phase 8 and history | **665** seal bindings, **221** evidence payloads, **1,236** unchanged historical originals, the **five** authorized Phase 8 differences, **1,241** snapshot originals and **seven** Phase 7 bindings matched. |
| Project preservation | All **1,773 original files** unchanged; original directories/private metadata matched. This includes **64 database/sidecar files totaling 7,806,976 bytes**, checked as bytes without a database engine. |
| Exact delta | **Six added Markdown files**, zero modified/missing originals, zero application/dependency/database/historical-evidence/deployment-file changes. |
| Git | Original index byte-identical; complete pre-existing expanded Git status preserved after excluding only the six additions. `git diff --check` passed. |
| Documentation | Exactly **12 numbered report sections**, **87 local file-link targets**, and whitespace checks for **all six documents** passed. A separate read-only session check also verified all **seven local section links** and the total level-two heading count. |
| Secret scan | Read-only scanner passed across **1,257 files / nine rules**, with **zero findings** and the exact authored placeholder template verified. Scope/exclusions are recorded in the result. |

Final-byte certification is kept in `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase9-validation-8LlmKy\validation-final.json`. This record binds the finished six documents and repeats the preservation, section/link, whitespace, index/status and read-only secret checks after these review results are written. Its `passed: true` result and matching document hashes are the handoff authority; the earlier review record remains retained. Full paths, exclusions and the noncircular hashing protocol are in [the inventory](phase9-files.md).

No archive-writing verification/finalization, application test, database operation, resource creation, deployment, real notification, signing/broadcast, commit/push, branch/tag or Git-index mutation was performed in Phase 9. Work remains uncommitted and undeployed.

**Stopping point: Phase 9 audit/design review, awaiting explicit A1/Phase 10 approval.** The preserved Phase 8 implementation remains the locally verified disk-backed implementation; the six documents are the proposed Neon/Render Free design and acceptance contract.
