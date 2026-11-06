# Environment and configuration reference

The application uses strict non-secret JSON configuration and explicitly named, entrypoint-specific environment inputs. These include optional notification credentials, HTTP authentication/port settings, and PostgreSQL connection, scheduler and configuration-path inputs. It does not automatically load `.env` files or support per-field endpoint/chain/account environment overrides. [`.env.example`](../.env.example) contains placeholders only; copying it does not enable or configure a provider.

## Environment variables

### Notification adapters

| Name | Required when | Validation / reporting |
| --- | --- | --- |
| `WATCHDOG_TELEGRAM_BOT_TOKEN` | `notifications.telegram=true` | Bot credential syntax; output is only CONFIGURED/MISSING/INVALID |
| `WATCHDOG_TELEGRAM_CHAT_ID` | `notifications.telegram=true` | Numeric ID, optionally negative, or `@channel_username`; never persisted or printed |
| `WATCHDOG_DISCORD_WEBHOOK_URL` | `notifications.discord=true` | Exact HTTPS `discord.com/api[/vN]/webhooks/<id>/<credential>` destination; no user-info, custom port, query or fragment |

The shared notification adapter factory and CLI provider validation access credential properties only for enabled channels. The PostgreSQL executable captures all of its explicitly named environment inputs, including notification values, at invocation even when providers are disabled; it constructs and validates external adapters only for enabled channels. Existing Phase 3/4 names remain compatible. Set values privately using the host's secret manager or service environment; keep credentials out of command arguments, monitoring JSON, logs, evidence and Git. The systemd example references an external administrator-owned environment file, not an application `.env` loader. On Windows, validate ACLs and the service-account environment explicitly. Rotate credentials through the same channel/destination; queued deliveries use the destination captured when the active adapter is constructed.

`config-check` validates enabled providers before opening a writable monitor database. Syntactic validity does not test delivery permissions, provider availability or destination ownership. `status`/`alerts` inspect stored data without provider credential access. `health`/`readiness`/`diagnostics` include configuration status and thus read values only for enabled channels, then omit them from output.

The monitoring CLI and PostgreSQL runtime can construct enabled external adapters. The disk-backed SQLite HTTP runtime currently refuses enabled Telegram/Discord configuration; see [its runbook](render-runtime-operations.md).

### HTTP services and PostgreSQL

| Name | Entrypoint / requirement | Validation / behavior |
| --- | --- | --- |
| `PORT` | Required by `dist/service.js` and `dist/postgres-service.js` | Canonical integer 1–65535; executable listener binds `0.0.0.0` |
| `WATCHDOG_READ_API_TOKEN` | Required at startup by both HTTP services | `^[A-Za-z0-9_-]{32,256}$`; read requests accept Basic `watchdog:<credential>` or Bearer |
| `WATCHDOG_STORAGE_BACKEND` | Required by PostgreSQL entrypoint | Literal `postgres`; missing/other values fail, with no SQLite fallback |
| `WATCHDOG_POSTGRES_NAMESPACE` | Required by PostgreSQL entrypoint | `^[a-z0-9][a-z0-9_-]{0,63}$`; bound to database identity |
| `WATCHDOG_POSTGRES_WRITER_URL` | Required by PostgreSQL entrypoint | Explicit PostgreSQL writer connection; secret value is never printed |
| `WATCHDOG_POSTGRES_READER_URL` | Required by PostgreSQL entrypoint | Distinct username on the same host/port/database; no inferred/default connection |
| `WATCHDOG_SCHEDULER_SECRET` | Required at PostgreSQL startup, even with scheduling disabled | `^[A-Za-z0-9_-]{43,256}$`, distinct from the read credential; scheduler requests require Bearer |
| `WATCHDOG_SCHEDULER_ENABLED` | Optional, PostgreSQL only | Literal `true` enables scheduler admission; `false` or absent means `DISABLED`; other values fail |
| `WATCHDOG_SCHEDULER_SLOT_SECONDS` | Optional, PostgreSQL only | Default 300; canonical positive integer, multiple of 60, divides 3600, at least 240 and at most 3600 |
| `WATCHDOG_MONITORING_CONFIG_PATH` | Optional, PostgreSQL only | Explicit monitoring-policy JSON; absent selects defaults |
| `WATCHDOG_RISK_CONFIG_PATH` | Optional, PostgreSQL only, without a position file | Separate threshold JSON; absent selects defaults |
| `WATCHDOG_POSITION_CONFIG_PATH` | Optional, PostgreSQL only | One reviewed position JSON; owns thresholds and cannot be combined with `WATCHDOG_RISK_CONFIG_PATH` |

Both PostgreSQL authenticators are validated before pools/listener construction, including disabled scheduling. PostgreSQL URLs accept only single optional `sslmode=require|verify-full` and `channel_binding=require` query parameters. TLS certificate verification remains enabled; pooler-specific startup options and connection bounds are documented in [PostgreSQL operations](postgres-operations.md).

The SQLite service takes configuration paths through arguments, not the PostgreSQL path variables. `NODE_VERSION` in the preserved Render draft selects the host interpreter; the application checks the actual runtime separately. `WATCHDOG_PG_TEST_BIN` is a **native integration-test prerequisite**, not a production database selector; see [testing](testing.md#native-postgresql-integration).

## Configuration files and precedence

- [monitoring.example.json](../config/monitoring.example.json) shows all operational/resource defaults for local use. [production.example.json](../config/production.example.json) chooses the production profile and keeps monitoring/notifications disabled.
- `--config` on monitor/operational commands selects a non-secret monitoring JSON, at most 32 KiB. Unknown fields, links/aliases, traversal and potential secret-file names are rejected. There is no implicit `watchdog.config.json` loader.
- Monitor `--enable`, `--interval` and `--database` override the corresponding JSON fields. Without a position file, `--risk-config` selects a separate threshold file and threshold CLI flags override it. On the standalone `risk` command, `--config` retains its threshold-file meaning; standalone `inspect`/`risk` use the compiled demonstration account.
- `--position-config` selects one position for `monitor`, `alerts`, `status`, `health`, `readiness`, `diagnostics`, `config-check` and `database-init`. Both HTTP services also support position selection through their entrypoint-specific inputs. The [position example](../config/submission-position.example.json) uses a **synthetic** account; [Stage 3C](STAGE-3C-POSITION-CONFIGURATION.md) describes identity validation and account roles.
- A selected position file owns its thresholds. Combining it with a separate threshold file or threshold overrides fails as `POSITION_THRESHOLD_AMBIGUOUS`. Without a position file, the compiled public `DEMO` identity remains selected. No configuration can turn a public account into a claim of wallet ownership.
- Operational diagnostics accept `--risk-config` or `--position-config` so their stream scope matches the worker. They do not accept per-field threshold flags or historical block selection. Use the same position/threshold configuration; inspect historical streams through `status --block`.
- **CLI and PostgreSQL entrypoint:** relative configuration paths resolve against the invocation working directory. **SQLite HTTP service:** required `--config` and optional `--risk-config`/`--position-config` resolve relative to the release root before the service selects its runtime working directory. Required `--runtime-root`/`--database` follow the absolute workspace/database contract in [the service runbook](render-runtime-operations.md#1-entrypoint-and-configuration).
- SQLite production configuration requires an absolute local `.sqlite`/`.db` path outside evidence archives. In-memory stores are test APIs only, not CLI configuration. The PostgreSQL entrypoint uses its explicit role URLs rather than `storage.path` or a SQLite fallback.
- Chain, endpoints and all non-account deployment identity fields remain pinned. An explicit position JSON may select a non-zero account only within the reviewed market; arbitrary chains/markets and per-field `RPC_URL`, `MCP_URL`, chain-ID, private-key or account environment overrides are unsupported.

## Monitoring and retention

These are monitoring JSON defaults. PostgreSQL overrides `monitoring.enabled` and `monitoring.intervalSeconds` from its scheduler inputs; no internal timer creates PostgreSQL jobs. Its default UTC slot minutes are 00, 05, …, 55, as described in the [scheduler contract](scheduler-endpoint-contract.md).

| Setting | Default | Bounds / meaning |
| --- | --- | --- |
| `monitoring.enabled` | `false` | Continuous scheduling opt-in; `--once` requests one cycle |
| `monitoring.intervalSeconds` | `60` | Integer 5–86400; measured after completed cycle |
| `monitoring.maxConsecutiveFailures` | `3` | Integer 1–1000; failure episode escalation/backoff threshold |
| `monitoring.alertOnRecovery` | `true` | Indicative mathematical improvement alerts |
| `monitoring.alertOnDataQualityChanges` | `true` | Optional restoration notices; bad/unknown quality stays visible |
| `monitoring.alertOnEveryCriticalCheck` | `false` | Explicit per-cycle repeats; otherwise deduplicated |
| `monitoring.criticalReminderSeconds` | `null` | Optional 5–604800, at least the cycle interval |
| `monitoring.oracleLocalMaxAgeSeconds` | Absent | Optional 1–31536000 local rejection policy; cannot establish a heartbeat |
| `storage.path` | `data/watchdog.sqlite` | Local regular path; absolute in production |
| `storage.cycleRetentionDays` | `30` | Integer 1–3650; protects latest/accepted/referenced/unfinished cycles |
| `storage.alertRetentionDays` | `180` | Integer 7–3650; protects nonterminal deliveries; fingerprints remain |

Risk defaults remain exact decimal strings: warning `1.30`, critical `1.10`, target `1.25`, mathematical boundary `1.00`. See [thresholds](thresholds.md).

## Notification settings

| Setting | Default | Bounds / meaning |
| --- | --- | --- |
| `notifications.telegram`, `notifications.discord` | `false` | Independently opt-in; console remains enabled |
| `notifications.maxAttempts` | `5` | Integer 1–10; preserved across restarts |
| `notifications.baseDelaySeconds` | `5` | Integer 1–300 |
| `notifications.maxDelaySeconds` | `900` | Integer 1–86400 and at least base delay |
| `notifications.jitterRatio` | `0.2` | 0–0.5; local delay remains within local cap |
| `notifications.timeoutSeconds` | `15` | Integer 1–60; headers and body share this budget |
| `notifications.maxPerDrain` | `10` | Integer 1–50; priority query repeats after each outcome |

Valid server Retry-After can exceed the local retry cap and is never shortened. Excessive/unrepresentable restrictions block the provider persistently. Disabling holds pending work; it does not delete it. Details: [notification operations](operations-runbook.md#notification-recovery).

## Operational settings

| Setting | Default | Bounds / meaning |
| --- | --- | --- |
| `operations.profile` | `local` | `local` or `production` |
| `operations.shutdownTimeoutSeconds` | `30` | Integer 1–300; settling budget after stop request |
| `operations.cycleTimeoutSeconds` | `240` | Integer 1–900; total initialization/read/supplemental/persist/dispatch cycle |
| `operations.connectivityTimeoutSeconds` | `30` | Integer 1–120; explicit two-path probe |
| `operations.chainStatusMaxAgeSeconds` | `600` | Integer 5–86400; local accepted-snapshot age for readiness, not oracle freshness |
| `operations.failureBackoffMaxSeconds` | `900` | Integer 5–86400; scheduler ceiling, never shorter than base interval |

SQLite production-profile validation requires **Node v24.14.1 / SQLite 3.51.2**, an absolute database path, shutdown timeout strictly longer than provider timeout, and cycle timeout at least 120 seconds. These minimum relationships do not guarantee all worst-case retries and sends fit; exceeding the total-cycle budget fails the worker closed. The PostgreSQL runtime fixes cycle timeout to 240 seconds, accepted-observation maximum age to 600 seconds and monitoring shutdown budget to 10 seconds; its job/lease/HTTP bounds are in [PostgreSQL operations](postgres-operations.md). Tune only from measured host/provider behavior.

## Resource settings

| Setting | Default | Enforcement |
| --- | --- | --- |
| `resources.databaseBytes` | 4 GiB (`4294967296`) | SQLite page ceiling plus cycle/diagnostic size checks |
| `resources.walBytes` | 256 MiB (`268435456`) | Fail closed at cycle checks; checkpointing is not a hard byte cap |
| `resources.minFreeBytes` | 512 MiB (`536870912`) | Disk reserve before work/backup/evidence capture |
| `resources.pendingDeliveries` | `10000` | Nonterminal backlog; transactional admission and cycle checks; max configurable 1000000 |
| `resources.rssBytes` | 512 MiB (`536870912`) | RSS sampled at cycle/runtime boundaries; independent host limit needed |
| `resources.evidenceBytes` | 2 GiB (`2147483648`) | Bounded evidence inventory/backup; no automatic evidence deletion |
| `resources.evidenceFiles` | `50000` | Evidence file/directory walk and backup limits; max configurable 1000000 |

Byte settings are positive safe integers. Diagnostics and backup honor the selected monitoring configuration. Standalone inspect/risk/oracle CLI captures use their default capture budgets; they do not load the monitoring JSON. The oracle evidence API also accepts explicitly supplied limits. Verification tools write bounded test/capture outputs but are not a production evidence-rotation service.

Other fixed bounds: read bodies 2,000,000 bytes; notification bodies 65,536 bytes; individual evidence artifacts 32 MiB; oracle manifests 1 MiB / 1,000 artifacts; backup manifests 32 MiB; backup reference/bundle inventories at most 1,000 each. Synchronous filesystem/SQLite calls cannot be interrupted by JavaScript timers; host hard-stop, disk and filesystem acceptance remain required.

## Sanitized validation codes

`MANDATORY_CHAIN_CONFIG_INVALID`, `ENABLED_NOTIFICATION_CONFIG_INVALID`, `PRODUCTION_RUNTIME_MISMATCH`, `PRODUCTION_DATABASE_ABSOLUTE_PATH_REQUIRED`, `PRODUCTION_SHUTDOWN_BUDGET_INVALID` and `PRODUCTION_CYCLE_BUDGET_INVALID` appear in `configuration.errors`. Malformed files use `MONITOR_CONFIG_FILE`, `CONFIG_FILE` or path-validation codes. No validation response prints a secret or turns the oracle into a verified source.
