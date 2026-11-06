# Render Free architecture and operating envelope

**Recommendation: option B — an external scheduler invokes one protected, bounded monitoring request every 30 minutes.** Use one Render Free Web Service, Neon PostgreSQL, and a small Cloudflare Worker Cron handler as the candidate scheduler. This is a **best-effort, periodically sampled demonstration**, not continuous liquidation monitoring. All implementation, accounts, resources, schedules and deployment remain subject to separate approval.

The [PostgreSQL design](neon-postgres-architecture.md) supplies durable records and global ownership. The [migration plan](sqlite-postgres-migration-plan.md) supplies cutover and recovery. Neither a database nor a scheduler changes the fixed chain/position, exact BigInt calculations, oracle **UNVERIFIED**, freshness **UNKNOWN**, indicative estimates or **`actionable: false`**.

## 1. Compatibility verdict

The existing Phase 8 executable cannot run correctly on Free merely by changing `plan` or adding a database URL. It requires a real writable Linux disk mounted at `/var/data/watchdog`, creates a persistent workspace fence, verifies/seeds relative evidence, changes CWD and opens disk-backed SQLite. Free has no persistent disk and discards local writes on idle suspension, restart and redeploy. Its current production configuration allows a 4 GiB database, while Neon Free allows 1 GB per project. Its current runtime validation requires the verified Node/SQLite pair and a local absolute database path.

Current HTTP handles GET/HEAD persisted reads with a five-second socket timeout; it has no scheduler-trigger route. Current monitoring starts an internal loop and wakes for due outbox retries. Port binding, authenticated dashboard and existing projection rules are reusable foundations, but remote async persistence, bounded request execution and platform-specific startup are new work.

The original draft `render.yaml` proposes paid `1c-2g` compute and a disk. Its historical Phase 7 comments predate the Phase 8 implementation. It remains a preserved draft, not a Free Blueprint or a deployment instruction.

## 2. Published platform constraints

Research date: **2026-11-02**. These are published limits, not observed behavior of a provisioned account. Instance-specific Free restrictions take precedence over generic Hobby/workspace feature tables.

| Platform / constraint | Published allowance or behavior | Consequence |
| --- | --- | --- |
| Render Free compute | **0.1 CPU / 512 MB**, one instance; arbitrary restarts | Qualify CPU, event-loop responsiveness and memory at realistic database/read sizes. Cross-instance overlap still needs fencing for deployments/retries and future topology changes. |
| Idle/wake | Spins down after **15 minutes without inbound traffic**; wake takes about **one minute** | Internal timers and outgoing RPC/database activity cannot establish an independent wake schedule. Cold HTTP clients may see a loading response before the application is ready. |
| Filesystem | Ephemeral; no persistent disk | PostgreSQL/object storage/release artifacts hold durable data. Scratch files and caches are disposable. |
| Monthly hours | **750 Free instance hours per workspace**, reset monthly; spun-down time excluded | Exhaustion suspends all workspace Free web services. One continuously awake 31-day service uses 744 hours and leaves only six; other services and overlap consume the same allowance. |
| Hobby usage | **5 GB outbound/month**, **500 standard pipeline minutes/month** | Allowances are shared across workspace use. Bandwidth overages can bill with a payment method; otherwise Free services suspend. Builds can bill or become blocked by missing payment/spend limits. |
| External traffic policy | Unusually high service-initiated public traffic can suspend Free | RPC/MCP, Neon and object access are explicitly relevant categories. No numeric safe threshold is published; a small bandwidth estimate cannot certify policy acceptance. |
| Operations/network | No Free shell/SSH or one-off jobs; cannot receive private network traffic; SMTP ports 25/465/587 blocked | Perform migrations/backups from an approved external operator runner. The scheduler endpoint is public HTTPS with authentication, not private ingress. |
| Render probes | While running, probes occur every few seconds and need a response within **five seconds** | Use in-memory liveness. Probes are not a durable scheduler and must not perform chain scans or database keepalive work. |
| HTTP duration | Render's web-service comparison advertises responses up to **100 minutes** | Sufficient in principle for a bounded cycle, but the actual Free ingress/cold-start/proxy/client path must be tested. Current application timeouts are much shorter. |
| Neon Free compute | **100 CU-hours/project/month**, autoscaling up to **2 CU**; **0.25 CU** is the smallest documented size | At 0.25 CU the allowance covers 400 active hours, not a full month. Active idle tails, extra branches, retries, backups and dashboard queries count. |
| Neon idle/wake | Mandatory suspension after **five minutes idle**; documented wake usually hundreds of milliseconds | Close idle clients, avoid polling and handle reconnects. Wake latency and stale sockets remain failure cases rather than an assumed fixed latency. |
| Neon storage/egress | **1 GB Postgres/project**, **20 GB account total**, **5 GB public egress/project/month** | Storage/compute/egress constraints are independent. Includes branch effects; egress is shared with other project products. |
| Neon project/branch limits | **100 projects**, **10 branches/project** | Each test/restore branch consumes real quota/compute/storage. More projects are not a proposed way to evade operating limits. |
| Neon quota exhaustion | Compute or egress exhaustion suspends compute until reset/upgrade; storage exhaustion can fail **inserts, updates and deletes** | Reserve space well before full, surface a degraded state and stop retry storms. Published quota behavior says data is not deleted by these limits. |
| Neon recovery/visibility | Free **six-hour PITR history**, capped at **1 GB changes**; **one manual snapshot**; no scheduled backups; **one day** metric history; no Free uptime SLA | Independent backups and longer operational receipts require a separate design. Generic longer-window backup descriptions are not the Free entitlement. |
| Cloudflare Workers Free | **100,000 requests/day**, **10 ms CPU/invocation**, **128 MB**, **50 subrequests**, **five Cron triggers/account** | A small fetch-and-validate scheduler may fit; benchmark CPU, parsing and retry logic. Network waiting is not CPU execution time. |
| Cloudflare Cron | UTC; maximum **15-minute wall time**; schedule changes may take **15 minutes** to propagate | Bound the entire invocation below this limit; delayed/missed jobs must be visible. No guaranteed start latency has been established. |
| R2 Standard | **10 GB-month**, **1 million Class A** and **10 million Class B** operations/month in Free allowance; free egress | Candidate independent evidence/backup destination. Storage/operation overages can bill. Infrequent Access has no corresponding Free allowance. |

Render Free Postgres is not the target database: it expires after 30 days and has different recovery restrictions. Neon does not gain an uptime guarantee by being a managed service. Neon also advertises 5 GB object storage, but it shares the provider/project and egress allowance; it is not an independent recovery copy.

## 3. Compare scheduling options A, B and C

| Option | Trigger and merits | Failure/capacity implications | Decision |
| --- | --- | --- | --- |
| **A. Bounded internally scheduled cycles** | Await one cycle, persist it, then use an internal timer for the next; close outboxes on the same process. Closest to current loop. | Render can suspend the process before the next timer; a timer cannot wake a stopped service. Frequent DB queries prevent Neon suspension and exceed its compute allowance. Genuine crash gaps and delayed sends remain. | Unsuitable as the independent scheduler on Render Free. |
| **B. External scheduler → protected endpoint** | A separate Cron source wakes Render for a real bounded cycle; slot idempotency and the database lease survive restarts. Monitoring has no dependence on a viewer. | Adds scheduler credentials/provider, cold-start latency and an HTTP deadline; cadence must leave Neon idle time. Duplicates, delays and dropped invocations require durable receipts and fail-closed handling. | **Recommended for the explicitly limited Free demonstration.** |
| **C. Monitoring on incoming application requests** | A visit or ordinary API request starts work; superficially simple. | With no visits there is no monitoring; bursts create contention/cost; cold visitors wait for a chain scan. GET reads acquire hidden side effects and traffic controls determine observation frequency. | Fails the requirement that monitoring be independent of dashboard visits. |

Choose **Cloudflare Worker Cron** as the candidate for B, with **`7,37 * * * *` UTC** as the proposed twice-hourly schedule. The offset avoids the exact top of the hour; it is not a latency guarantee. The Worker only calls the fixed Render endpoint and validates a small receipt. It does not contain database/RPC credentials, calculate risk or run `pg_dump`.

GitHub Actions scheduled workflows were evaluated: minimum five-minute schedule, default-branch execution, possible delayed/dropped jobs under load, and automatic disabling after 60 days without activity for public repositories. Those documented behaviors make it a weaker fit for this recurring monitor trigger. Render Cron Jobs are paid resources, so they are not included in the Free recommendation.

## 4. Proposed topology and lifecycle

```text
Cloudflare Cron (UTC slot; dedicated trigger credential)
    └── HTTPS POST /internal/monitor/run
         Render Free: one Node process
           ├── bounded authenticated trigger → one fenced monitor cycle
           │      ├── fixed Pharos RPC/MCP reads → existing BigInt engine
           │      └── pg writer pool → Neon state + atomic outbox + lease
           ├── GET/HEAD dashboard → pg read-role pool → persisted projections
           └── public in-memory /api/health

Approved external operator/backup runner
    ├── direct Neon connection → consistent snapshot/dump + manifest
    └── private R2 → immutable evidence + encrypted verified backup sets
```

Startup resolves an immutable release/configuration, checks runtime/build/schema expectations, validates configured credentials without exposing them, and binds the Render-provided port. No database initialization or monitoring loop runs as an import/startup side effect. Startup checks use bounded work; lazy connections or unavailable database state do not keep a liveness request waiting on an upstream. Missing/corrupt/incompatible storage never silently becomes a new store.

The authenticated trigger is the only automated live-cycle admission in this proposed topology. A runtime feature flag defaults disabled; a separate scheduler-enable approval is needed after migration and host acceptance. Current external Telegram/Discord notifications remain disabled for implementation/acceptance unless separately approved. The dashboard and health routes do not run monitoring, drain notifications or initiate evidence captures.

At the end of a job, publish its durable receipt, release the lease conditionally, return the response and release idle database clients. Render may stay up until its idle threshold; Neon should suspend after its own idle threshold. No periodic keep-awake ping is part of the design. A restart discards caches and local temporary files, then reloads persisted truth on the next admitted request.

During SIGTERM/deploy shutdown, refuse new triggers, abort/cancel work within the measured shutdown bound, close HTTP/pools and leave incomplete durable claims for recovery. Test process termination as well as cooperative cancellation: JavaScript timers cannot preempt CPU/native stalls. A lease plus database incarnation protects replacement writers; the process-local overlap guard remains a useful fast rejection only.

## 5. Protected trigger and timeout contract

This is a new endpoint contract to implement, not a route currently exposed by Phase 8.

- Require HTTPS and a dedicated high-entropy bearer credential distinct from `WATCHDOG_READ_API_TOKEN`. Compare bounded fixed-length digests in constant time. A dashboard Basic/bearer credential has no trigger capability.
- Accept POST with a small, strict JSON body, at most **1 KiB**, describing only the configured schedule's UTC slot. Server configuration fixes schedule, environment and position. Reject arbitrary commands, URLs, SQL, accounts, markets, thresholds and recipient fields.
- Validate authentication, method, path, content type, body/header limits and local rate/concurrency admission **before** a database wake or RPC read. Durable slot/lease admission then occurs in PostgreSQL. Reject inappropriate browser origins; absence of Origin is expected for the server-to-server scheduler. No credential in a query string, redirect or response.
- Derive a deterministic request/cycle identity from the configured deployment namespace, schedule ID and exact scheduled UTC slot. Admit new work only for a current slot no more than **10 minutes late**, never a future slot; recheck database time and the persisted admission high-water mark under the lease-row lock. Retries carry the identical slot/key. After the admission window, an authenticated, rate-bounded receipt-only lookup may resolve an existing key; missing/expired work cannot start. A uniqueness constraint and lease transaction establish the one-cycle rule, including unknown-commit outcomes.
- Hold the initiating request until bounded work finishes. A `202 IN_PROGRESS` reply only describes an already durable, currently owned request; it is not an acknowledgment that unowned background work will run later. A completed duplicate returns its original receipt. A competing slot/owner returns busy without new work.
- Receipt fields are bounded operational data: slot, cycle ID, completion status/time and accepted/degraded outcome. HTTP 200 with `accepted: false` is not successful chain monitoring; the scheduler must inspect the receipt. Authentication/configuration/capacity/storage failures use small coded 4xx/5xx replies, never raw provider/driver output.
- A delayed/missed slot is recorded as a gap. Do not run a catch-up storm or label a newly fetched current block as an observation made at a missed historical time. The next valid slot samples the then-current chain.

| Boundary | Proposed budget |
| --- | --- |
| Request headers/body and unauthenticated sockets | Retain short approximately five-second admission limits; do not give arbitrary clients the long execution timeout. |
| Existing whole monitor cycle | **240 seconds**, including its initialization/recovery, chain/supplemental reads, persistence and bounded delivery work. |
| Complete server database-active job | **300 seconds**, including connection/preflight/final receipt overhead; no new send if its acknowledgment cannot fit. |
| Global lease | **360 seconds** from database acquisition; no unbounded renewal loop. |
| Trigger HTTP/client deadline | **420 seconds**, allowing an illustrative one-minute Render wake plus the job and network margin. Cold-start delay is not a guaranteed ceiling. |
| Scheduler invocation total | **600 seconds**; at most one additional same-key receipt/retry request if time remains, never parallel retries. Stop on an unresolved outcome. |
| Regular read API | Approximately three-second application deadline within its short socket contract, bounded async DB checkout/query; return unavailable on slow cold reads. |
| Dashboard client | Current **10-second** fetch timeout may expire during a roughly one-minute cold start. Show waking/unavailable and permit a later manual retry; don't silently fetch a new chain observation. |

The actual route-specific Node timeout wiring, Render proxy path, cold loading responses, disconnect cancellation and Worker CPU/wall-time behavior are mandatory acceptance tests. The public 100-minute HTTP statement alone does not prove this contract. A disconnect must not permit an unbounded orphan job; stop/cancel bounded work and reconcile the durable identity before retrying.

## 6. Freshness, retry cadence and detection gaps

The fixed local observation-age budget remains **600 seconds**. A 30-minute sampling interval means persisted data is ordinarily outside that budget for much of each interval, approximately twenty minutes even before delays are considered. This is intentional visibility of the tradeoff, not a reason to enlarge the age budget or advertise current safety. Oracle upstream freshness stays **UNKNOWN** even immediately after a successful read.

Display separately:

- Last cycle attempted/completed and its scheduled slot; last accepted snapshot retrieval time, block/hash and evidence kind.
- Latest observation versus last accepted observation; whether local age exceeds 600 seconds.
- Next expected slot and scheduler lag, with missed/late/outcome-unknown states.
- Database availability/as-of time, runtime lifecycle and lease state as operational metadata.
- Permanent `UNVERIFIED`, `UNKNOWN`, indicative and `actionable: false` financial boundaries.

Public `/api/health` means the HTTP process can answer; it must query neither Neon nor Pharos. Protected readiness can report unavailable/stale chain data while liveness remains healthy. Persisted `IDLE` or a successful HTTP fetch does not prove a worker is currently running. Refreshing a dashboard never resets the observation timestamp.

With 30-minute cycles, a condition beginning just after a sample may be unseen for about 30 minutes plus wake/read delay; a missed job adds another interval, and repeated failures have no guaranteed maximum gap. Liquidations or oracle configuration changes can occur and disappear between samples. The bounded **8,000-block** oracle history scan cannot prove coverage over arbitrary outages; compare the actual block gap with coverage, preserve uncertainty and never infer an unchanged history from an unscanned gap.

Outbox exponential retry timestamps and Retry-After restrictions stay exact, but a due retry may wait until the next admitted job. A five-second due time is not a five-second delivery SLA on this topology. Drain only within the cycle budget, preserve priority/cooldowns and record backlog age. Real-notification approval must explicitly accept this extra latency.

An operational overdue threshold such as **45 minutes since the last completed slot** is a candidate alarm policy, not a promise of detection. Worker invocation results plus an independent provider/runner health check or operator review must detect missed execution; a job cannot report that its own scheduler never invoked it. Such external alerting needs its own approved destination. The proposed monitor is independent of dashboard visits even when no viewer is present.

## 7. Compute capacity model

Use a **31-day / 744-hour** month for budgeting. Let `C` be measured average Neon CU, `I` the scheduled interval in seconds, and `D` database-active work from first database use through the last query. Approximate scheduled compute as:

```text
scheduled CU-hours = C × 744 × min(1, (D + 300) / I)
```

The 300 seconds is Neon's idle tail. This is a planning approximation; real metering, overlapping work, cold starts, dashboards and maintenance must be measured. Historical local live cycles were about 64 seconds. Use **90 seconds** as an illustrative work window with overhead and **300 seconds** as the proposed hard application work budget. Neither is a measured Render result.

| Interval | Slots / 31 days | CU-hours at 0.25 CU, 90 s work | CU-hours at 0.25 CU, 300 s work |
| --- | ---: | ---: | ---: |
| Current short cadence / continuously active | Not a fixed UTC-slot loop | 186 | 186 |
| 5 minutes | 8,928 | 186 | 186 |
| 10 minutes | 4,464 | 120.9 | 186 |
| 15 minutes | 2,976 | 80.6 | 124 |
| 20 minutes | 2,232 | 60.45 | 93 |
| **30 minutes** | **1,488** | **40.3** | **62** |
| 60 minutes | 744 | 20.15 | 31 |

The 20-minute worst-budget case leaves only seven CU-hours for all other use; 15-minute work can exceed Free. Thus 30 minutes is the recommended starting experiment, subject to the loss of timeliness described above. At 0.5 CU even the 30-minute upper case becomes **124 CU-hours**. Configure the smallest qualified fixed/min-max compute ceiling and measure actual average CU; leaving autoscaling at 2 CU invalidates a 0.25-CU budget. All branch/replica compute also counts.

Target total projected usage **at most 75 CU-hours/month**, leaving 25% allowance headroom. The 62-CU scheduled case leaves 13 CU-hours inside that operating target for backups, reads, retries and validation. Independently scattered read sessions each add an idle tail; steady dashboard polling can keep Neon awake and drive usage back toward 186 CU-hours. The current manually refreshed dashboard helps, but is not a quota enforcement mechanism. No database heartbeat is allowed solely to make availability appear continuous.

For Render, a conservative per-slot active-time illustration includes a 60-second wake, `D`, and a full 900-second idle tail after work:

- Typical: `1488 × (60 + 90 + 900) / 3600` = **434 instance-hours/month**.
- Work-budget case: `1488 × (60 + 300 + 900) / 3600` = **520.8 instance-hours/month**.

Idle timing/metering can differ, and traffic can merge these windows into 744 hours. Reserve budget for other workspace services/builds and inspect actual billing metrics. These calculations do not override Render's discretionary external-traffic threshold or restart behavior.

## 8. Storage, traffic, memory and build budgets

### Database growth

At 48 cycles/day, 30 days retain approximately **1,440 ordinary cycles**, plus boundary/running records, before protected references and backlog extend retention. The following includes a hypothetical combined per-cycle observation, assurance and index cost; it is not a SQLite-to-PostgreSQL size prediction:

| Combined per-cycle bytes | Thirty-day contribution |
| --- | ---: |
| 50 KiB | 70.31 MiB |
| 100 KiB | 140.63 MiB |
| 250 KiB | 351.56 MiB |
| 500 KiB | 703.13 MiB |

Add stream state, alerts containing prior/current observations, deliveries/attempts/events, permanent fingerprints, runtime/control records, TOAST/index/dead-tuple space and branch deltas. One 100-KiB alert per cycle retained for 180 days would itself be **843.75 MiB** before those additions. The unchanged retention policy can therefore outgrow 1 GB even at this slow cadence. Measure high-churn/alert-storm scenarios, not only quiet successful cycles. Proposed 60/70/80% warning/escalation/admission-stop thresholds and protected retention are described in the PostgreSQL design.

### Network accounting

Keep separate meters for Render outbound and Neon outbound. Render → Neon writes count on Render's side; Neon → Render query results count on Neon's side. Public RPC responses arriving at Render are not Render outbound bytes, but request traffic and provider discretionary traffic policies still matter. Object upload/download, TLS overhead, retries, dashboard responses and backups must be included in their actual directions.

Starting allocation targets, all provisional:

| Meter | Working allocation | Reserve |
| --- | --- | --- |
| Render 5 GB/month | Up to 3 GB job/database/API traffic; up to 0.75 GB dashboard/other | 1.25 GB (25%) |
| Neon 5 GB/month | Up to 2.5 GB backup reads; up to 1.25 GB runtime/dashboard/maintenance reads | 1.25 GB (25%) |
| R2 10 GB-month | Prefer less than 8 GB including evidence, retained backups and locks | 2 GB |

At 1,488 jobs, the 3-GB Render allocation averages only **2.02 MB (1.92 MiB) per job**. Full state serialization and repeated assurance/alert payloads can dominate SQL traffic; count wire bytes rather than assuming a database write is a few kilobytes. R2 free egress does not cancel Neon egress required to extract a backup.

Daily full exports averaging **80 MB of actual Neon outbound data** use **2.48 GB/month**; at **300 MB/export**, they use **9.3 GB/month** and exceed the entire Free allowance before ordinary reads. Client-side dump compression does not retroactively reduce bytes already sent by Neon. Hourly 80-MB exports use **59.52 GB/month**. A daily backup target is therefore conditional on measured size or paid capacity. Skipping required backups to preserve a Free label is not an accepted operating policy.

Fourteen 80-MB daily backup objects occupy **1.12 GB** before evidence/pre-cutover copies and compression effects. Append-only evidence, retention locks and several retained release/migration generations grow this total. Backups need an external machine capable of database tools and encrypted transfer; Worker Cron's small fetch handler does not supply that runner for free.

### CPU, memory, reads and builds

Phase 8 local synthetic runtime tests sampled about **256 MB RSS** including backup/restore; a different historical stability harness reached about **346 MB**. These short Windows measurements do not qualify 512 MB/0.1 CPU on Linux. Proposed acceptance targets are normal peak RSS below **350 MiB**, early pressure at **400 MiB**, and refusal of new heavy work by **450 MiB**, subject to the actual cgroup limit and measured native overhead. Stream imports/exports and object verification; run full backups outside the web service. Test a reviewed V8 heap cap rather than assuming heap size equals RSS.

Keep read responses ≤256 KiB, the existing 1-MiB parse budget, bounded history pages (default 20, maximum 100), bounded cache and parameterized keyset queries. Coalesce concurrent refresh work; admit at most one active database read plus a small bounded queue initially. Existing 64 connections/16 in-flight/8 reads-per-second limits require reevaluation on 0.1 CPU. Measure the public health route below its five-second host deadline under authenticated read pressure and a simultaneous cycle; p99 under one second is a useful acceptance target.

Budget standard pipeline use below **400 minutes/month** to leave headroom under 500. For example, ten 10-minute builds use 100; fifty use 500. Render builds must execute a reviewed build-only command with no live monitoring, archive-writing verification, migration or secret dump. Preserve immutable release artifacts independently of Render's limited rollback history. Automatic and preview deployment settings require explicit review because applying a Blueprint can trigger an initial deployment even when later auto-deploy is off.

## 9. Operations, degraded states and cost exits

Use bounded coded results for `WAKING`, `DATABASE_UNAVAILABLE`, `OBSERVATION_OLD`, `SCHEDULER_LATE`, `LEASE_BUSY`, `CAPACITY_BLOCKED`, `OUTCOME_UNKNOWN` and failed evidence verification in a proposed operational envelope. Preserve the existing financial enums/meaning. A status service can be healthy while monitoring is disabled/stale; neither a 200 response nor a stored lifecycle word certifies an observation.

Collect slot receipts and usage samples outside ephemeral disk. Neon Free retains only one day of its metrics; Cloudflare Cron Events shows the latest 100 invocations (about 50 hours at this cadence); Render Hobby advertises seven days of log retention. These are troubleshooting windows, not the application's evidence or backup retention. Record sanitized long-lived acceptance/backup manifests in the approved external store.

At projected compute/egress above 75% of allowance or database storage reaching the earlier warning thresholds, investigate before exhaustion. At loss of write capacity, stop new cycles/sends rather than risk unrecorded outcomes. Surface the last accepted time and keep external operational receipts because the DB may not accept its own failure event. Retry outages within a bounded budget, then wait for the next slot/operator resolution. Do not generate artificial observations, reset the outbox or delete history to recover quota.

Published cost illustrations, excluding tax and unqualified workload growth:

- Render Hobby + Free instance + Neon Free can have **$0 base compute charges** inside all allowances. Scheduler and R2 can also fit their listed allowances, but account activation, payment requirements, backup runner and overage settings must be reviewed. Total operating cost is not established as $0.
- Render Hobby outbound overage is listed at **$0.15/GB** and standard pipeline overage at **$5/1,000 minutes**; a payment-enabled account can incur charges. Absence of a payment method can replace a bill with suspension/build blocking.
- Neon Launch is listed at **$0.106/CU-hour**, **$0.35/GB-month** database storage, with 500 GB public egress included then $0.10/GB. A continuously active 0.25-CU 31-day month is about **$19.72 compute**, before storage/PITR/backup. The Free allowance is not assumed to be a paid-plan credit.
- Smallest paid Render web compute is listed at **$7/month**. Combined with that Neon compute and 1 GB storage, the illustration is about **$27.07/month** before other costs. This is a budget escape path, not a sized/approved production architecture or purchase.
- Cloudflare Workers Paid starts at **$5/month** if the measured scheduler requires it. R2 Standard storage above allowance is listed at **$0.015/GB-month**, plus applicable operations. Retention locks can retain billable objects.
- Neon's snapshot section lists **$0.09/GB-month**, while Free lists one manual snapshot. Confirm the actual billing entitlement before use; one permitted snapshot is neither a proven zero-cost schedule nor an independent backup.

If the requirement is timely continuous monitoring, an unchanged one-hour independent-backup RPO, strong availability or guaranteed alerts, the Free proposal fails that requirement. Revise hosting/budget and qualify the revised topology rather than presenting slower sampling as equivalent protection. The [explicit approvals](phase9-report.md#11-blockers-risks-and-required-approvals) include this decision.

## 10. Deployment ordering and acceptance

After separate approvals: finish and test the async backend/trigger → bind a release → establish roles/TLS/evidence and a verified migration candidate → fence old writers and perform final import comparison → deploy disabled → verify health/auth/read-only data from the actual host → run finite console-only cycles → verify recovery/backup receipt → approve scheduler enablement. Migrations are explicit off-host maintenance, never build/startup/request work. Use reviewed immutable release IDs; no verified Git HEAD currently exists.

Free deployment can replace or overlap processes. Prove stale-owner rejection with two clients/processes even if steady-state hosting permits only one instance. Schema changes use an expand-compatible approach during any overlap, with old writer shutdown/credential fencing before incompatible changes. A Render application rollback alone does not roll back the database, lease state, sent notifications or object references.

Acceptance must include actual cold starts after >15 minutes Render idle and >5 minutes Neon idle, disconnects/duplicate requests, Worker 10-ms CPU qualification, clock skew/lateness, database sleep and exhaustion, reader pressure, memory/CPU at intended size, explicit stale UI, missed slots, fence takeover, ambiguous commit/provider outcomes and restore with channels disabled. A proposed **72-hour finite, console-only run** at the approved cadence should capture all receipts and extrapolate usage with ≥25% compute/egress headroom. It requires a separately approved scheduler/test environment and does not establish an uptime SLA.

Current recovery targets are one-hour RPO and 30-minute RTO proposals from earlier phases, still unqualified. A Free demonstration might instead accept **24-hour independent-backup RPO and four-hour operator RTO targets**, with 14 daily verified sets. Those are a material service-level change, must be explicitly approved and measured, and may still require paid egress/backup capacity. No target has been achieved in Phase 9.

## 11. Official sources

All consulted **2026-11-02**:

- Render: [Free instances](https://render.com/docs/free), [pricing](https://render.com/pricing), [health checks](https://render.com/docs/health-checks), [web-service HTTP duration](https://render.com/docs/render-vs-vercel-comparison).
- Neon: [detailed plans and quota behavior](https://neon.com/docs/introduction/plans), [scale to zero](https://neon.com/docs/introduction/scale-to-zero), [pooling](https://neon.com/docs/connect/connection-pooling), [secure connections](https://neon.com/docs/connect/connect-securely), [backup strategies](https://neon.com/docs/manage/backups), [pg_dump](https://neon.com/docs/manage/backup-pg-dump).
- Cloudflare: [Cron configuration](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [Worker pricing](https://developers.cloudflare.com/workers/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/).
- GitHub: [scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Recheck limits, terms, region availability and pricing at any approved provisioning step. No provider account, connected console, secret or deployed endpoint was needed for this documentation research.
