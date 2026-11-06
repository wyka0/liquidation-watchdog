# Render runtime operations — Phase 8, local implementation

**One disk-backed Web Service, one instance, one Node process and one monitoring writer. Deployment and production approval remain NOT GRANTED.** This document describes implemented code and future operator procedures; no Render resource or production service was created.

Companions: [Phase 8 report](phase8-report.md), [API contract](render-dashboard-api.md), [test evidence](phase8-test-evidence.md), [file inventory](phase8-files.md), and the preserved [Phase 7 deployment plan](render-deployment-plan.md).

**Current-reference update — 2026-11-06:** configuration options and delivery recovery below reflect the current implementation. Phase 8 test/deployment statements remain historical qualification scope. The [Phase 8 seal](../evidence/phase8/phase8-seal.json) binds the original version of this document (SHA-256 `284e148662253f307f6433b968099894841affc76875318a75f09ff7ca6c64b0`), whose bytes were preserved externally before this edit; it does not certify this updated document or later implementation. The seal and its evidence were not regenerated.

## 1. Entrypoint and configuration

`src/service.ts` builds to `dist/service.js`. Its command dispatch is guarded by executable identity. Importing it, importing the runtime modules, and constructing `RenderRuntime` do not start monitoring, open SQLite, create a listener, register signals or change the working directory. `start()` is explicit and single-use; `stop()` is idempotent.

The implemented Blueprint argument contract is:

```text
node dist/service.js --config config/render.json --runtime-root /var/data/watchdog/runtime --database /var/data/watchdog/storage/watchdog.sqlite
```

`--config`, `--runtime-root` and `--database` are required. The current executable additionally accepts optional `--risk-config <thresholds.json>` or `--position-config <position.json>`. Unknown/repeated options are refused. There is no HTTP or command-line enable/transaction/provider-URL option. All supplied monitoring, risk and position JSON paths resolve against the release directory before selecting the runtime working directory. The database spelling must match the configured, absolute database location.

Without a position file, the service selects the public demonstration identity and uses default thresholds or the explicit `--risk-config` file. A `--position-config` file selects one reviewed position and owns its thresholds; combining it with `--risk-config` fails as `POSITION_THRESHOLD_AMBIGUOUS`. Per-field threshold flags are not service arguments. The Phase 8 default-threshold-only description predates these supported options; see [position configuration](STAGE-3C-POSITION-CONFIGURATION.md).

`config/render.json` contains:

| Setting | Value |
| --- | --- |
| Monitoring | Disabled initially; interval 60 seconds |
| Notifications | Console only; Telegram and Discord disabled |
| Runtime profile | `production` |
| Shutdown / cycle timeout | 20 / 240 seconds |
| Connectivity timeout / observation maximum age | 30 / 600 seconds |
| Failure backoff maximum | 900 seconds |
| Cycle / alert retention | 30 / 180 days; existing conditional retention rules |
| DB / WAL ceiling | 4 GiB / 256 MiB |
| Free-space reserve / RSS ceiling | 512 MiB / 512 MiB |
| Current evidence budget | 2 GiB and 50,000 files |
| Pending delivery ceiling | 10,000 |

The runtime refuses enabled Telegram/Discord settings and shutdown budgets greater than 20 seconds. Local synthetic dependency injection is rejected under the production profile. Existing CLI mock-provider tests remain available independently. No new dependency was added in Phase 8.

The executable consumes only these named inputs:

| Name | Purpose |
| --- | --- |
| `PORT` | Required listener port, canonical integer 1–65535; listener binds `0.0.0.0` |
| `WATCHDOG_READ_API_TOKEN` | Required protected read credential; no value appears in configuration or documentation |
| `NODE_VERSION` | Render interpreter selection from the preserved draft; application checks the actual runtime separately |

There is no dotenv loader. Disabled provider configuration does not read provider credential values. `WATCHDOG_INTERNAL_API_TOKEN` is not used by this single-service topology.

## 2. Persistent workspace and bootstrap

```text
/var/data/watchdog/                         existing persistent mount; never auto-created
  storage/watchdog.sqlite                   explicitly initialized application DB
  storage/watchdog.sqlite-*                 SQLite and existing monitor-lock sidecars
  storage/runtime-owner.sqlite*             service ownership fence, including disabled mode
  runtime/evidence/phase1/...               pinned reviewed references at original identities
  runtime/evidence/phase4/...               complete required reviewed bundles
  runtime/evidence/phase5/...               required bundles and new runtime captures
  backups/<exclusive-capture>/              operator-controlled backup staging
```

Production bootstrap requires Linux, exactly `/var/data/watchdog`, an explicit writable mount in `/proc/self/mountinfo`, and a non-`tmpfs`/`ramfs`/`overlay` filesystem. An ordinary directory is not accepted as a production mount. Absolute paths, component types, traversal, links/hardlinks, sidecars, free space and actual write/sync probes are checked. Runtime and release trees must be disjoint. There is no ephemeral fallback.

New directories request mode `0700`; seeded files and probes request `0600`. Existing directories must be accessible and writable. Actual Render user/group ownership and permissions remain host-acceptance work; Windows results do not qualify POSIX permissions or durability.

Required reviewed artifacts are selected from the original, SHA-256-pinned Phase 5 release/baseline and checked against the references in `src/oracle-assurance/reviewed.ts`. Required Phase 4/5 bundles are copied completely. Existing target artifacts must already match; new files are created exclusively and synced. A conflict, missing source, capacity failure, cancellation or incomplete prior copy causes refusal. No existing file is repaired or overwritten.

The original Phase 5 manifest is a historical evidence authority for bootstrap, **not the verification authority for Phase 8 source**. Phase 8 source/build/evidence are bound separately in the [Phase 8 inventory](phase8-files.md). Persisted DB evidence references and bundle hashes are verified against the runtime workspace before monitoring starts. The process then changes its working directory to `runtime`, preserving existing relative evidence identities and directing new captures to the disk.

## 3. Startup states and ownership

1. Claim the process-wide runtime slot, validate authentication and non-secret configuration, and validate/prepare the workspace.
2. Acquire the separate OS-backed SQLite workspace fence. It also excludes a second disabled HTTP runtime.
3. If an application DB exists, open and validate one read-only connection and its required references. Enabled monitoring additionally opens the existing DB with `existingOnly: true`.
4. Bind HTTP. Only after a successful bind, start one existing `MonitoringService` scheduler when enabled.
5. The monitoring service acquires its original exclusive writer fence before recovery or mutation. Another monitor/writable maintenance open is refused. Read-only snapshots use a separate connection inside the same process.

The new workspace fence is not a second monitoring database/owner. It is a small local lock file using the same OS-release principle as the original monitor lock. Lock files remain after clean exit; their presence alone does not mean a lock is held. They must not be deleted as a recovery shortcut.

| Condition | Behavior |
| --- | --- |
| Disabled, missing application DB | Start protected HTTP with public `DISABLED` liveness; status is available and readiness/data are unavailable; no DB initialization |
| Enabled, missing DB | Fail startup; explicit operator initialization required |
| Existing legacy, corrupt, drifted or unsupported DB | Fail closed; no migration, replacement, reset or automatic recovery |
| Missing/invalid credential, disk/path failure, duplicate owner or occupied listener | Fail startup, release acquired resources, exit nonzero through the executable |
| Ordinary unavailable/invalid observation | Existing data-quality/failure policy, last-accepted retention and bounded backoff; no financial action |
| Terminal persistence/resource/cycle failure | Runtime becomes `FAILED`, closes HTTP and the worker, and returns a nonzero exit |

Missing storage is opened only at startup. An operator-created DB is not automatically picked up by requests; restart the disabled runtime after explicit initialization. Maintenance/migration/restore promotion belongs to a fenced operator session, not an HTTP route.

## 4. Scheduling, shutdown and restart

With the supplied `config/render.json`, `MonitoringService` schedules the next normal cycle **60–72 seconds after completion**, applies failure backoff, wakes for eligible due outbox work, and rejects overlapping cycles. The process-level guard prevents a second runtime scheduler, including a runtime pointed at another DB. This SQLite completion-relative loop is distinct from the [PostgreSQL configured UTC-slot scheduler](scheduler-endpoint-contract.md).

SIGINT/SIGTERM handlers are installed only by explicit execution. Shutdown marks the runtime stopping, rejects new read work, requests monitor/dispatcher stop, cancels bootstrap between bounded file operations, and awaits the in-flight cycle. HTTP closure and monitoring shutdown run concurrently. Idle connections close immediately; lingering sockets are destroyed after two seconds. The original monitoring shutdown bounds pending reads/delivery, aborts late work, records stopped/failed status and closes its store. The read connection and workspace lock then close; the prior working directory and signal listeners are restored/removed.

The production monitor budget is 20 seconds. The executable adds a **25-second signal-cleanup fallback** returning exit 1, leaving margin against Render's documented 30-second allowance. This fallback cannot guarantee progress while native synchronous I/O or the event loop is blocked. It is not a substitute for Linux/Render shutdown-under-load acceptance.

Tests exercise one-second fixture shutdown deadlines, successful in-flight completion, late-result refusal, signal handlers, process exit, forced OS termination and the 25-second fallback with synthetic timers. Windows SIGINT/SIGTERM tests explicitly simulate handler delivery; forced termination is an actual OS kill. Neither is claimed as Linux signal acceptance.

Restart retains interrupted-cycle recovery, fingerprints, provider cooldowns and known-delivered state. Under the current [Stage 3B contract](STAGE-3B-RUNTIME-NOTIFICATIONS.md#5-delivery-lifecycle), interrupted in-flight attempts become `PERMANENTLY_FAILED` with `ambiguous=1` (terminal logical `UNKNOWN`), preserving attempt history and excluding them from `due()`. They are never automatically resent; only known non-ambiguous retryable failures use bounded retries. The earlier Phase 8 at-least-once ambiguity description is historical and is superseded by this policy. Exactly-once external delivery is not claimed, and no operator resend workflow for unknown outcomes is implemented. External providers were disabled in Phase 8 and remain refused by this SQLite HTTP runtime.

## 5. Operator initialization, backup and recovery

The existing [database operations](database-operations.md) and [rollback procedure](rollback-and-recovery.md) remain authoritative. With the service stopped/fenced, explicit `database-init` is the only initialization/migration route. Resolve the release executable/configuration absolutely and run evidence-sensitive operator commands from `/var/data/watchdog/runtime`.

Future owner-side command forms (not executed against Render in Phase 8):

```text
node /opt/render/project/src/dist/cli.js database-init --config /opt/render/project/src/config/render.json
node /opt/render/project/src/dist/cli.js backup --config /opt/render/project/src/config/render.json --output /var/data/watchdog/backups/EXCLUSIVE_CAPTURE_NAME
node /opt/render/project/src/dist/cli.js backup-verify --backup /var/data/watchdog/backups/EXCLUSIVE_CAPTURE_NAME
```

`EXCLUSIVE_CAPTURE_NAME` is a destination-name placeholder, not a credential. Use a new directory every time. The backup library supports an explicit `projectRoot` and the SQLite online backup API. It includes all DB-bound evidence, hashes, pending/ambiguous state and delivery history; it does not raw-copy a live DB/WAL. Backup verification and `restore-verify --backup ... --restore-root ...` operate on isolated copies and do not promote a replacement.

The historical Phase 8 bounded run verified backup and restore with the persistent runtime layout. Existing suites also cover concurrent WAL backup, corrupt/missing/extra files, interrupted acknowledgments, legacy restore/migration and known-delivered preservation. These are recorded qualification results, not a new execution during this documentation update.

**Scheduled backup/transfer automation is not implemented or enabled.** The Phase 7 hourly schedule, off-disk destination/receipt verification, retention automation and measured RPO/RTO remain deployment-review gaps. No destination or secret was supplied for that integration. Existing backup progress limits are not a hard cancellation bound for total evidence copying/native I/O; a future scheduler must address this before sharing the runtime shutdown budget. The current service starts no backup task and serves no backup-control endpoint.

The inherited RPO ≤1 hour / RTO ≤30 minutes are targets, not achieved results. A same-disk verified capture is staging, not off-disk recovery. No full-capacity, power-loss or host-loss drill was performed.

## 6. Release and deployment-review boundary

`render.yaml` remains the byte-identical **DRAFT-UNAPPROVED-NOT-DEPLOYED** Phase 7 artifact: `web`/`node`, one instance, explicit build/start command, one 20 GB proposed disk, health check, pinned Node version, disabled auto-deploy and private credential-name injection. Its historical “files do not exist” comments describe Phase 7 and are superseded by this Phase 8 implementation record; settings were not reapplied or changed.

Local production-build/import tests do not accept Render/Linux. The actual mount, image/runtime provenance, HTTPS termination and access-log behavior, Basic-auth browser/proxy behavior, ownership/permissions, deployment stop/start ordering, sustained combined capacity, off-disk backups and production-duration monitoring remain unqualified. Review the [test evidence](phase8-test-evidence.md) and [report](phase8-report.md) before any separately authorized deployment phase.
