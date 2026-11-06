# Operations runbook

Use the same release root, monitoring JSON, database and threshold or position configuration as the worker. The CLI diagnostics described here open no HTTP listener; `readiness --probe` alone adds explicit connectivity reads. The separately invoked [SQLite HTTP runtime](render-runtime-operations.md) and [PostgreSQL runtime](postgres-operations.md) provide health and protected read endpoints. Runtime output stays **oracle UNVERIFIED / freshness UNKNOWN / financialActionability false / productionReleaseReady false**.

## Daily inspection

```powershell
node dist/cli.js health --config C:/watchdog-config/monitoring.json --risk-config C:/watchdog-config/risk.json
node dist/cli.js readiness --config C:/watchdog-config/monitoring.json --risk-config C:/watchdog-config/risk.json
node dist/cli.js diagnostics --config C:/watchdog-config/monitoring.json --risk-config C:/watchdog-config/risk.json
node dist/cli.js status --config C:/watchdog-config/monitoring.json --risk-config C:/watchdog-config/risk.json
node dist/cli.js alerts --limit 20 --config C:/watchdog-config/monitoring.json
```

For a configured position, use the worker's `--position-config` instead of `--risk-config` on diagnostics/history commands; the position file owns its thresholds and combining the two is rejected.

| Command | Meaning of success | Mutation / network |
| --- | --- | --- |
| `config-check` | Required compiled/configured settings and enabled-provider syntax valid | No DB creation or network |
| `health` | Configuration, storage/resource checks and worker coherence healthy | Read-only, no network |
| `diagnostics` | Same health exit decision, with full sanitized operational report | Read-only, no network |
| `readiness` | Current accepted live observation, settled latest cycle, schema/resources/evidence/connectivity and worker coherence meet local gates | Read-only, persisted as-of connectivity |
| `readiness --probe` | Same readiness gates plus bounded live connectivity results | Explicit read-only RPC/MCP calls; no observation persistence |
| `status`, `alerts`, `oracle-status` | Stored as-of information displayed | Read-only, no notification dispatch |

Operational commands return **0** for their successful condition and **2** for invalid/degraded/unavailable results; invalid CLI syntax can return **1**. Monitor `--once` returns 0 for an accepted indicative observation, 2 for a rejected/stopped observation, and 1 for a fatal CLI/configuration/operational exception. Continuous monitoring logs failed reads and continues with bounded backoff unless an operational failure stops it. No exit code authorizes financial action.

## Interpret the report

- `runtime` identifies the checker process separately from the worker. Checker uptime/RSS is not worker uptime/RSS.
- `processHealth.worker` is a durable last runtime record, including run ID, PID, status, update time and sampled RSS. PID is diagnostic, not ownership proof.
- `ownership=HELD` with a coherent current active runtime record means `RUNNING`; a stale record beyond the configured grace is `STALLED`. `OWNER_PRESENT_IDENTITY_UNKNOWN`, `STOPPED_UNCLEAN`, `FAILED`, unknown ownership and mismatched threshold scope reject readiness.
- `NOT_RUNNING` after a clean stop can still be healthy. `operationalReadiness.monitorRunning` distinguishes an active scheduler. Supervisors must check this field if continuous monitoring is expected.
- `lastSuccessfulChainRead` is the accepted snapshot's time/block/hash and evidence kind. The default 600-second local age window is separate from oracle freshness. An explicit probe proves access only, not economic correctness or a current position.
- A latest unaccepted read or unfinished latest cycle rejects readiness even if the older accepted baseline is retained. Historical and fixture inputs cannot satisfy current live readiness.
- `resources.memoryMeasurement=WORKER_AS_OF_RUNTIME_RECORD` uses the worker's last RSS sample; without a worker record it is `CHECKER_ONLY`. Disk/WAL/backlog are local current measurements. Consult the supervisor for continuous CPU/RSS/file-descriptor monitoring.
- `deliveryCounts` and `pendingDeliveryCount` are SQL aggregates. `providerLimits` exposes channel cooldown/block status without destinations or credentials. The queue is database-wide, including other threshold/historical streams; alerts retain their original labels.

During an active cycle the latest cycle can be RUNNING/PERSISTED, so a readiness check may temporarily return 2. Use status transitions and the stall grace; do not restart a healthy process merely because it is currently reading.

## Provider outage and invalid data

| Signal | Response |
| --- | --- |
| RPC/MCP unavailable, timeout, 408/429/5xx | Inspect fixed diagnostics and probe intentionally if needed. Bounded retries/backoff retain the accepted baseline. Do not add a fallback endpoint. |
| Long Retry-After | Respect it; the read attempt fails if the mandatory delay exceeds the bounded retry budget. Notification cooldowns persist separately. |
| Malformed/null/oversized response, wrong chain or block/hash mismatch | Treat the current observation as unavailable/invalid; investigate the provider and saved block-bound evidence. Do not weaken checks. |
| Historical state pruned / missing trie node | The requested historical read fails. Keep the archived evidence and record that exact re-read is unavailable; do not silently read latest instead. |
| Reorganization/backwards head | Reject inconsistent snapshots; preserve last accepted state. Later canonical, fully checked reads may resume indicative reporting. |
| Oracle config/history observability change | Preserve assurance invalidation. Review a new bounded audit and evidence; restarting does not verify the source or clear the invalidation. |

Read methods stay allowlisted; no deprecated tracing method, alternate network, partial-snapshot acceptance or price substitution is an incident workaround. RPC/MCP sharing an upstream limits outage independence.

## Shutdown, restart and fatal failures

Request graceful stop through the accepted supervisor (SIGTERM/SIGINT handlers). New cycles and new notification sends stop; idle waits wake. The current read/send may settle and commit within the **30-second** default grace. The **240-second** total-cycle limit covers reading, supplemental inspection and dispatch as well as initialization. Overdue work is cancelled and late continuations cannot mutate accepted state or acknowledge delivery after closure. The store closes and the ownership lock is released; failures retain the first operational cause.

On a hard cycle/shutdown timeout the built CLI exits 1 to terminate non-cooperative transport handles. Synchronous SQLite/filesystem calls cannot be preempted by these timers; the independent supervisor stop timeout is essential. Windows graceful-handler tests are explicit simulations; only actual forced-process termination was exercised at the OS level in local verification.

After a crash, stop a restart storm and inspect health/storage first. Restart with the same database and intended threshold/config scope after capacity/integrity issues are resolved. Unfinished pre-persistence cycles become interrupted unavailable observations; persisted cycles retain their data. Interrupted in-flight notifications become terminal `PERMANENTLY_FAILED` with `ambiguous=1` (logical `UNKNOWN`), retaining attempt history and remaining excluded from `due()`; they are not automatically resent. Known-delivered rows remain terminal, and only known non-ambiguous retryable failures can resume bounded retries. A restarted service never treats missing data as zero debt.

For `STORE_CORRUPT`, `STORE_SCHEMA_LAYOUT`, `STORE_SCHEMA_VERSION`, `STORE_TRANSACTION_FAILED` or `STORE_OPEN_FAILED`, preserve the files and use [database recovery](database-operations.md). For `RESOURCE_*`, inspect database pages, WAL readers, disk reserve, backlog and RSS; provide capacity or repair the actual cause. Retrying the same full resource limit cannot resolve it.

## Notification recovery

The [Stage 3B provider qualification](STAGE-3B-RUNTIME-NOTIFICATIONS.md) uses mocked HTTP; the finite live demonstration proves console delivery only. `DELIVERED` means a recorded provider acknowledgment or console write, not human receipt. Timeouts, transport uncertainty, HTTP 408/5xx, invalid successful acknowledgments, process death and failed local acknowledgment commits may conceal acceptance. They become terminal logical `UNKNOWN` (`PERMANENTLY_FAILED` with `ambiguous=1`), never automatic retries. Only known non-ambiguous retryable failures receive bounded retries. Exactly-once external delivery and eventual delivery are not guaranteed.

1. Inspect `status`, `alerts` and diagnostics before changes. For detailed forensics, preserve a verified backup and inspect `delivery_attempts`/`delivery_events` read-only on an isolated copy; record alert/delivery IDs and timestamps, not credentials.
2. To disable a channel, set its JSON boolean false, gracefully stop and restart with that reviewed config. Current sends may already have reached the provider. Disabled-channel pending work stays stored; new alerts do not get entries for that channel. Re-enabling resumes old pending work using the current destination and can send historical alerts. It does not backfill alerts created while the channel was disabled.
3. `RETRY_SCHEDULED` normally needs no manual action after a known non-ambiguous retryable failure. Wait until both delivery and provider next-at timestamps permit sending. Changing credentials does not reset attempts or a persisted provider block.
4. `blocked=1` requires manual review of the provider restriction. Never simply clear it and send early. Keep the channel disabled while the provider confirms the restriction/destination is corrected. `PERMANENTLY_FAILED` is not automatically retried or reset by restart.
5. Terminal `UNKNOWN` requires investigation and preservation of the original delivery/attempt/event records. There is **no implemented operator resend or resolution workflow** for it. Exceptional maintenance language is not authorization to requeue an ambiguous row; any future resolution workflow needs its own design and qualification. Never bulk-reset the outbox or lower attempt counters.
6. A separately approved provider-unblock or other database maintenance change must stop/fence all writers, preserve a verified backup, and be evaluated on an isolated candidate. Preserve known-delivered rows, fingerprints, state, attempts, events and any still-effective provider next-at time. Validate backup/restore continuity and follow the approved replacement procedure before promotion. This guide does not supply a reset command or qualify manual SQL maintenance or real provider confirmation.

Restoring an older backup loses knowledge of later acknowledgments. Reconcile against independently retained operational records/provider evidence before enabling channels; unresolved cases remain ambiguous. A changed destination needs explicit review because the database intentionally contains no credential or destination history.

## Logs, evidence and alerts for operators

The worker writes bounded allowlisted JSON events (`startup_validated`, `cycle_started`, `cycle_observed`, `alert_created`, `notification_delivery`, `cycle_completed`, `restart_recovery`, `operational_failure`, `shutdown`) plus formatted console alerts to stdout. Error output exposes a fixed code and generic message; it does not dump raw exceptions or request URLs. The application creates no unbounded runtime log file.

Configure and test supervisor rotation and disk limits. Proposed operational alerts: worker unexpectedly absent/stalled, repeated rejected reads, latest accepted snapshot older than policy, blocked provider or growing backlog, failed backup, low disk/WAL growth and approaching RSS/database limits. Thresholds are operational policies, not established production SLAs.

Archive verified evidence and backups according to the operator's retention policy without deleting referenced files. Run explicit captures only when required; ordinary cycles do not generate full snapshot bundles. Use [rollback/recovery](rollback-and-recovery.md) and [release readiness](release-readiness.md) for escalation and approval decisions.
