# Monitoring architecture — Phase 5

The selected oracle remains **UNVERIFIED**. All risk views, alerts and recovery amounts remain **actionable: false**. Operational monitoring does not establish safety, liquidation eligibility, or protection. RPC and MCP share an upstream; their agreement is a consistency check, not independent consensus.

## Components and calculation boundary

- `src/monitoring/reader.ts` constructs the existing RPC/MCP transports with their shared pacer, attributes errors to an access path, and delegates all reads to Phase 1 `inspectPosition`. Both transports are closed after each cycle, including rejected reads.
- Phase 1 continues to select `min(RPC head, MCP head) - 5` for a live read; contract reads are pinned to that block. Its ten-contract inventory, six batch sentinels, 58 comparisons, and before/after block and chain checks remain mandatory.
- `src/monitoring/observation.ts` calls the unchanged Phase 2 `calculateRisk`. Phase 2 owns snapshot validation, accounting, exact threshold comparisons and recovery calculations. Monitoring adds temporal-mode and backwards-block gates, not another risk engine.
- `model.ts` defines strict, sanitized persistent projections. They preserve chain/account/market/oracle identity, mathematical state, effective quality, original Phase 2 quality, oracle data quality, oracle verification, actionability, block/hash/time, snapshot identifier, calculation version/time, threshold configuration and estimate provenance. Financial integers remain decimal strings in storage and bigint in the Phase 2 engine.
- `transitions.ts` is pure. `service.ts` coordinates reads, transitions, transactions, outbox dispatch and shutdown. Nothing schedules work on import or construction.
- `src/storage/` owns SQLite initialization, migrations, atomic writes, outbox state, retention and exclusive process ownership. `src/notifications/` owns formatting and adapter delivery.
- `src/operations/` owns deadlines, sanitized diagnostics, fixed-endpoint connectivity probes and resource guards. A separate supervisor owns restart policy, hard host limits and log rotation; [production architecture](production-architecture.md) documents the single-host model.

Raw HTTP headers, error text, RPC/MCP payloads and arbitrary token metadata are not copied into the monitoring database. The complete snapshot is validated in memory and bound by Phase 2's snapshot identifier. Its public, typed projection is stored; ordinary `risk --save-evidence` remains the separate full-evidence capture interface.

## Opt-in configuration

Copy `config/monitoring.example.json` to a local, ignored `watchdog.config.json` and select it explicitly with `--config`. The JSON is strict, bounded to 32 KiB, and may contain only documented non-secret settings. Production startup additionally validates the exact runtime, absolute local database path and timeout relationships. [Environment and configuration](environment-variables.md) covers operational/resource/notification settings and all bounds.

| Setting | Default | Bounds / behavior |
| --- | --- | --- |
| `monitoring.enabled` | `false` | Required for continuous scheduling; `--enable` overrides it |
| `monitoring.intervalSeconds` | `60` | Integer 5–86400, measured after a completed cycle |
| `monitoring.maxConsecutiveFailures` | `3` | Integer 1–1000; escalates a sustained failure episode, does not stop reads |
| `monitoring.alertOnRecovery` | `true` | Optional mathematical improvement/recovery alerts |
| `monitoring.alertOnDataQualityChanges` | `true` | Optional non-warning restoration notices; new bad/unknown quality is always alerted |
| `monitoring.alertOnEveryCriticalCheck` | `false` | Explicit per-accepted-cycle critical/boundary repeats |
| `monitoring.criticalReminderSeconds` | `null` | Disabled, or integer interval through 604800, at least the cycle interval |
| `storage.path` | `data/watchdog.sqlite` | Local `.sqlite`/`.db`; no evidence directory or symlink traversal |
| `storage.cycleRetentionDays` | `30` | Integer 1–3650 |
| `storage.alertRetentionDays` | `180` | Integer 7–3650 |

Risk thresholds retain the Phase 2 parser and exact decimal-string configuration. A monitor's `--config` controls monitoring; `--risk-config` controls thresholds. `--warning`, `--critical` and `--target` retain Phase 2 meanings. The one-WAD liquidation boundary is unchanged.

```powershell
npm run watchdog -- monitor --once
npm run watchdog -- monitor --enable --interval 60
npm run watchdog -- monitor --config ./watchdog.config.json
npm run watchdog -- monitor --once --risk-config ./config/risk-thresholds.example.json
npm run watchdog -- alerts --limit 20
npm run watchdog -- status
```

The continuous configuration example is disabled until deliberately enabled. `monitor --once` is itself a bounded opt-in request. `inspect`, `risk`, `alerts`, `status` and help never start a scheduler. Optional external channels remain disabled unless separately configured.

## Cycle lifecycle and overlap protection

1. Validate startup configuration; writable store initialization/migration uses temporary maintenance ownership. On first cycle, acquire lifetime monitoring ownership and recover unfinished work in batches of at most 256 cycles, yielding between batches.
2. Generate a unique cycle ID and store its UTC start time as `RUNNING` before network access.
3. Use the existing block-pinned reader and Phase 2 risk engine.
4. Build the current observation and independently compare risk, data quality and oracle quality to durable prior state.
5. In one SQLite transaction, store the observation, advance the state revision and episode counters, insert unique fingerprints/alerts and create pending channel deliveries. The cycle becomes `PERSISTED`.
6. Dispatch due outbox entries, in batches of 10 by default (configurable 1–50). Persist every attempt and outcome; stop requests prevent new sends.
7. Record completion time/duration and mark the cycle `COMPLETED`; apply conservative retention.

The service rejects overlapping `runOnce` calls. Continuous mode uses one awaited loop rather than `setInterval`. The next read starts no earlier than the configured interval after completion, with bounded jitter and failure backoff (default ceiling 900 seconds). During idle time, the loop wakes for pending delivery retries as needed. Slow reads, provider timeouts, backoff and scheduling can extend the observed interval; **60 seconds is not a freshness guarantee**.

A separate SQLite file (`<database>-monitor-lock`) holds an exclusive OS-managed transaction for a worker or writable maintenance owner. Status/history/diagnostics use explicit read-only main-database connections and do not initialize or migrate. A competing writer fails before opening the main store. Process death releases the lock; an existing lock file is not ownership proof. This is a local single-host design; network filesystem/distributed coordination is unsupported.

Ctrl+C/SIGTERM stops new cycles/sends and interrupts idle waits. Active work may settle and commit within the 30-second default shutdown budget; overdue reads/sends are cancelled, late continuations are guarded and the store closes. A separate 240-second whole-cycle budget covers initialization, reading, supplemental inspection and delivery. Hard termination leaves recoverable `RUNNING`, `PERSISTED` or in-flight outbox records. A hard-deadline failure exits the built CLI with code 1. JavaScript timers cannot preempt synchronous SQLite/filesystem calls; actual host supervisor behavior must be accepted separately. Windows graceful tests simulate handler events; forced-process tests kill a real child.

## Current observations and last accepted state

Every stream keeps **latest observation** and **last accepted observation** separately. An incomplete, malformed, inconsistent, unavailable, backwards-block or mode-mismatched snapshot cannot replace the latter. Current failed data produces `DATA_UNAVAILABLE`/`DATA_INVALID`, never a safety or debt-free inference. Diagnostic mathematical values on an unaccepted observation are explicitly labeled; they cannot drive a mathematical recovery transition.

Streams are keyed by deployment, temporal mode and exact threshold configuration. Changing thresholds begins a separate baseline. `monitor --once --block <number>` produces an isolated historical stream; it cannot change live monitoring state. Use matching threshold options and `status --block <number>` to query it. Accidental historical data in live mode is rejected. Fixture acceptance is an injectable test-only option, absent from the CLI.

The production oracle policy still has no verified heartbeat. `oracleVerification` remains `UNVERIFIED`, independently of oracle read quality (`UNAVAILABLE`, `INVALID`, etc.). An inherited `STALE` claim without verified freshness inputs is retained in the Phase 2 diagnostic quality field but rejected by monitoring as unestablished freshness; the monitor does not announce that the oracle is stale. Heartbeat remains `UNKNOWN`.

## SQLite and restart behavior

Node's built-in `node:sqlite` avoids a new dependency/native add-on. The verified runtime and required production profile are Node **24.14.1 / SQLite 3.51.2**. The package's broader Node >=22.18.0 declaration does not certify other runtimes. Node may print its experimental SQLite API warning.

- Application ID, `user_version`, checksummed migration history, exact schema layout, `quick_check`, foreign-key checks and strict JSON schemas guard initialization. Full backup/recovery validation adds integrity and complete record/content bindings. Unknown/incompatible/corrupt databases fail explicitly; no reset, replacement or silent fallback occurs.
- Versions 1–3 introduce streams/cycles/alerts/outbox, persistent provider cooldowns and provider blocking. Version 4 adds oracle assurance/continuity. Version 5 adds runtime/failure records and operational query indexes; migrations 1–4 retain their checksums. Forward migrations are transactional and retain existing state/outbox data; downgrade is unsupported.
- WAL plus `synchronous=FULL`, foreign keys, unique constraints, prepared statements and optimistic state revisions protect writes. Accepted/latest observations and estimate provenance are checked for semantic consistency. Failed reads cannot overwrite the accepted baseline, even through a conflicting store API call.
- Disk/transaction/resource failures stop the service instance, including failures between cycles; subsequent reads are skipped until a new service is opened. Notifications are not sent for rolled-back alerts. Shutdown bounds active cycle/scheduler settlement before closing storage. RSS/WAL/disk checks are boundary checks, while SQLite page limits and pending-delivery admission protect transactions.
- On restart, unfinished pre-persistence cycles become interrupted unavailable observations without discarding the accepted snapshot. Already-persisted cycles retain their committed state/alerts. Known delivered notifications are not re-created. In-flight attempts are ambiguous and consume their existing attempt count.
- Retention deletes old terminal alert payloads/attempt histories and unreferenced completed cycles. Pending/in-flight/retrying deliveries and the latest/last-accepted cycle are retained. Compact fingerprint tombstones and monotonic stream episode counters are retained indefinitely so pruning does not recreate an active alert. SQLite may reuse free pages without shrinking the file.

`status` reports recorded timestamps/provenance, latest observation, last accepted cycle, failure count, delivery status counts and provider cooldown/block records. Stored history is not a fresh chain assessment. A new database has unknown state, never zero debt.

Consistent backups use SQLite's online API and include complete referenced evidence; restoration verification is isolated and preserves the source. See [database operations](database-operations.md), [operations runbook](operations-runbook.md), [alerting](alerting.md), [notification setup](notification-setup.md), the historical [Phase 3 report](phase3-report.md), and the preserved [Phase 2 engine](risk-engine.md).
