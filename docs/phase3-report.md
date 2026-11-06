# Liquidation Watchdog — Phase 3 report

Project: `C:\liquidation-watchdog`. Scope: read-only continuous monitoring, durable alerts/deduplication, optional notifications and restart recovery. All work remains local and uncommitted.

**Selected oracle verification remains UNVERIFIED. Mathematical state, effective quality, oracle quality, actionability and snapshot provenance are retained independently. All recovery estimates remain indicative and actionable: false.**

**Phase 3 is complete.** The final `npm run verify` passed all 20 commands, with 422/422 unit tests and 2/2 live integration tests. It ran from `2026-11-01T15:54:26.718Z` to `2026-11-01T15:59:16.792Z`; command outcomes and output paths are recorded in `evidence/phase3/verification-results.json`.

## 1. Files added and modified

| Area | Added implementation |
| --- | --- |
| Configuration | `src/config/monitoring.ts`, `config/monitoring.example.json` |
| Monitoring | `src/monitoring/{model,reader,observation,transitions,service,logs}.ts` |
| Persistence | `src/storage/{migrations,store}.ts` |
| Notifications | `src/notifications/{types,format,adapters,dispatcher}.ts` |
| CLI | `src/cli/{monitor-options,monitor}.ts` |
| Tests | Seven Phase 3 suites plus `test/fixtures/monitoring.ts` |
| Evidence tooling | Preservation/replay, inventory, historical reread, bounded restart smoke and local-documentation-link scripts |

Updated existing CLI dispatch/help, evidence routing, package scripts, ignore rules and current documentation. Prior test changes are limited to Phase 3 evidence destinations. Exact original/current hashes and the complete file list are in the generated [Phase 3 files](phase3-files.md) inventory.

Against 213 original files: **112 added, 19 modified, 194 unchanged and 0 missing**. All 33 original reader/risk/configuration/fixture core files in the preservation inventory remain byte-for-byte unchanged.

The five required documents are [monitoring architecture](monitoring-architecture.md), [alerting](alerting.md), [notification setup](notification-setup.md), this report, and the file inventory.

## 2. Monitoring architecture

The Phase 1 block-pinned reader and Phase 2 risk engine remain the calculation boundary. The flow is reader → validated risk result → monitoring observation → independent transitions → SQLite transaction → notification outbox. It retains the ten-contract inventory, six EVM batch sentinels and 58 RPC/MCP comparisons.

Monitoring stores strict public projections with separate latest/last-accepted observations and durable transition state. Each projection retains mathematical state, effective/Phase 2 quality, oracle read quality and verification, false actionability, exact amounts, thresholds, block/hash/time, snapshot identifier, temporal context and estimate provenance. Streams are keyed by deployment, exact threshold configuration and live/historical mode. [Architecture](monitoring-architecture.md) documents the gates.

## 3. Cycle behavior and overlap protection

Each cycle records a unique ID and UTC start, performs pinned validation/calculation, commits its observation/state/alerts/outbox atomically, dispatches due deliveries and records completion/duration. An incomplete read leaves current risk unknown and preserves the last accepted snapshot.

Continuous mode defaults off; `--enable` or `monitoring.enabled=true` enables it. `--once` explicitly requests one cycle. The default interval is 60 seconds after completion, with integer bounds 5–86400. One awaited scheduler and an active-cycle guard prevent overlap; an OS-released SQLite monitor lock excludes another process. SIGINT/SIGTERM stops scheduling and finishes active bounded work. Fatal persistence errors stop the service instance. Monitoring settings and risk thresholds use separate configuration files. Historical monitoring requires `--once` and cannot replace live risk state.

CLI support includes `monitor`, `monitor --once`, `--interval`, monitoring `--config`, `--database`, separate `--risk-config`, `alerts --limit` and `status`. Existing `inspect` and `risk` commands remain available. History/status commands read persisted observations without dispatching notifications. Importing modules does not start monitoring. Structured logs retain UTC cycle/alert identifiers, durations and fixed diagnostic codes without raw provider errors or credentials.

## 4. State-transition coverage

| Dimension | Behavior |
| --- | --- |
| Mathematical state | Initial assessment; worsening warning/critical/boundary bands; optional improvement/recovery; validated `NO_DEBT` and subsequent debt observations |
| Effective data quality | Independent change/restoration notices; new bad or unknown quality remains visible even when optional restoration notices are disabled |
| Oracle quality | Independent read-quality alerts; source verification remains `UNVERIFIED` and heartbeat remains `UNKNOWN` |
| Read failures | Escalation after the configured consecutive-failure threshold, default 3; one escalation per uninterrupted failure episode |

Tests cover every mathematical state pair (including `NO_DEBT`), every effective-quality pair, every oracle-quality pair, missing baselines, simultaneous changes, restoration, recovery, sustained failures and rejected data. Mathematics compares against the last accepted observation; quality compares against the latest observation. Missing/invalid/unavailable data cannot create mathematical recovery or zero debt. Notification failures do not change accepted mathematics. Historical streams are isolated. See [alerting](alerting.md).

## 5. Alert deduplication

Versioned SHA-256 fingerprints include stream, dimension, persisted episode and alert code; unique keys and atomic state changes suppress identical conditions across restarts. New severity, independent quality changes and genuine recurrences remain alertable. Critical repeats/reminders are disabled by default and explicitly configurable. Fingerprint tombstones and episode counters survive payload retention. Known delivered entries are not sent again during restart recovery.

## 6. Persistence and restart behavior

Built-in `node:sqlite` adds no dependency. The default database is `data/watchdog.sqlite`; migrations 1–3 are checksummed and transactional. WAL/FULL durability, foreign keys, unique constraints, optimistic revisions and semantic state/provenance checks protect persisted records. Incompatible or corrupt stores fail explicitly without reset.

Restart recovery distinguishes pre-persistence interrupted cycles, committed cycles and interrupted delivery attempts. Failed reads cannot replace the accepted baseline. In-flight delivery consumes its prior attempt count and is marked ambiguous; known completed delivery is retained. Cycle retention defaults to 30 days and alert retention to 180 days, protecting pending work, latest/accepted cycles and deduplication tombstones. The outbox is database-wide; risk-transition baselines remain stream-specific. Bounded CLI/restart smoke results are recorded under `evidence/phase3/`.

The completed restart smoke reopened the same schema-v3 database for two accepted cycles. It retained **3 alerts after each cycle**; all three console deliveries stayed `DELIVERED` at one attempt. Known deliveries were not resent. Migration tests also passed for v1/v2-to-v3 databases, preserving accepted state, alerts, pending deliveries and existing cooldowns.

## 7. Notification adapter status

Console, Telegram and Discord adapters are implemented. Telegram/Discord default off and, when enabled, read only `WATCHDOG_TELEGRAM_BOT_TOKEN`, `WATCHDOG_TELEGRAM_CHAT_ID` and `WATCHDOG_DISCORD_WEBHOOK_URL`. Telegram uses plain text; Discord disables mentions. Provider tests use mocked HTTP only; live monitor smokes use console.

Defaults are five attempts, 5-second exponential backoff capped at 900 seconds, ±20% jitter and a 15-second timeout. 429 responses create durable channel-wide cooldowns; unusable delay metadata uses local backoff even on the final attempt. Excessive/unrepresentable delays persistently block that provider and appear in status. Other channels and risk reads continue. Attempts, failures, retry times and permanent outcomes are persisted using fixed error codes. Ambiguous delivery is explicitly at-least-once and can duplicate a message. See [notification setup](notification-setup.md).

## 8. Test counts and results

| Completed check | Result |
| --- | --- |
| Unit tests | **422/422 passed**, 18 files, 0 failures |
| Prior-phase unit regressions | **205/205 passed**, 11 existing files |
| Phase 3 unit tests | **217/217 passed**, 7 new files |
| Live read-only integration | **2/2 passed** |
| CLI help, inspect, live risk and historical risk | All completed successfully |
| Bounded monitor/restart/history/status | All 4 built CLI processes completed successfully |
| Full verification pipeline | **20/20 commands passed** |

The seven new suites contain 43 configuration, 82 transition, 23 storage, 24 service, 40 notification, 4 CLI and 1 safety-boundary tests. Coverage includes transactional rollback, corruption, restart recovery, fatal persistence failures, graceful non-overlapping scheduling, failed-read baseline preservation, mocked provider acknowledgments/errors, retry budgets, channel-wide cooldowns and persistent rate-limit blocking. Evidence: `evidence/phase3/unit-tests.json`, `integration-tests.json` and `monitoring-smoke.json`.

The two final smoke observations were accepted for indicative reporting:

| Cycle | Block | Mathematical state | Effective state | Oracle verification | Heartbeat | Actionable | Stored alerts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Initial process | `21859975` | `WARNING` | `DATA_UNVERIFIED` | `UNVERIFIED` | `UNKNOWN` | `false` | 3 |
| Restarted process | `21860003` | `WARNING` | `DATA_UNVERIFIED` | `UNVERIFIED` | `UNKNOWN` | `false` | 3 |

- Initial block hash: `0xa909ea40456353497d9d2c10fc94d8c3b59ce9c5418354e95889681ad908c823`; snapshot: `sha256:11621ae1efd83d0bf05d198288c41c17a54e505678585809a49eb87b47f26d3d`.
- Restart block hash: `0xf76cfd3fb27172a783e1827fa4758421195afe892a614daa1b9c875084f9b416`; snapshot: `sha256:746da1694f6e214eb51effdab45c1edf07ad1708b115198ec4ab42471aaf8e49`.

Both cycles completed; the last completion was `2026-11-01T15:58:59.903Z`. The retained alerts were `INITIAL_RISK`, `DATA_QUALITY_CHANGED` and `ORACLE_QUALITY_CHANGED`. External notifications were disabled; delivery was console-only. These are recorded as-of-block results, not a current position assessment.

## 9. Phase 1 and Phase 2 regressions

The exclusive pre-Phase-3 baseline records 213 original files, including 54 Phase 1 and 73 Phase 2 evidence files. The completed preservation check found **127/127 archived evidence files unchanged**, 0 unexpected archive files, **15/15 risk-artifact hashes valid**, and **3/3 exact typed-input/full-result replays identical**. All 205 prior-phase unit tests and both live integration tests passed.

The historical chain reread reproduced identity, debt, collateral value, liquidation capacity, LTV, safety ratio and both complete recovery calculations/proofs. Source checks passed **23/23 archived hashes** and **5/5 source/runtime links**, with an exact oracle-library text match. Evidence is in `evidence/phase3/prior-phases-integrity.json`, `historical-regression.json` and `source-runtime-matches.json`.

The preserved historical regression anchor is block `21853902`, hash `0xfe044ec9c464d3899f431b23efc307e9ccb619a71d42fdfe4c0b7a2e346c88d3`. Its indicative Phase 2 values are:

| Quantity | Exact stored integer |
| --- | --- |
| Accrued debt, loan base units | `273629792897` |
| Collateral value, loan base units | `350480669854` |
| Liquidation capacity, loan base units | `320689812916` |
| LTV, WAD | `780727202475920202` |
| Safety ratio, WAD | `1171984269405613955` |
| Minimum repayment to target 1.25, loan base units | `17077942565` |
| Minimum additional collateral to target 1.25, collateral base units | `21091061440441662813831` |

Each recovery calculation remains a separate hypothetical, snapshot-bound estimate with `actionable: false`. Exact archived replays reproduce the original typed input identifier and full result; a new historical reread has a new retrieval-bound identifier and is compared by chain identity, financial values and complete recovery proofs.

## 10. Typecheck, lint, build and security

| Check | Completed result |
| --- | --- |
| TypeScript typecheck | PASS |
| ESLint | PASS |
| Production build | PASS |
| Dependency audit | PASS — 0 vulnerabilities |
| Secret scan | PASS — 329 files, 9 rules, 0 findings; one exact synthetic fixture exception |
| Local documentation targets | PASS — 71/71 exist |
| `git diff --check` | PASS, including new files represented by intent-to-add entries |

The scanner reports only paths/rules and does not open potential credential/key files. Provider exceptions, response bodies and secret-bearing transport details are excluded from persisted monitoring projections, alerts and logs. Tests supplied inert credentials through mocked HTTP; no real provider secrets were inspected. All new evidence is under `evidence/phase3/`; both earlier evidence archives are preserved. Full command output paths are in `evidence/phase3/verification-results.json`, with structured audit/scanner results in `dependency-audit.json` and `secret-scan.json`.

## 11. Remaining limitations

- Oracle source, real-world operators and heartbeat remain unverified. RPC/MCP agreement is not independent consensus. No acceptable oracle age is assumed.
- Polling and notifications are best-effort, as-of-block observations; read duration and delivery backlog can extend the configured interval. Hard termination can create ambiguous delivery and duplicates.
- Storage is local/single-host. Node's SQLite API may emit an experimental warning. The tested runtime is Node 24.14.1 / SQLite 3.51.2.
- External providers were exercised through mocks, not real delivery. No production-duration soak run was performed.
- Pending deliveries use the current environment destination. Disabling a channel holds pending entries; excessive rate limits persistently block it. Enabling a new channel does not backfill old alerts.
- Pending records and compact fingerprint tombstones are retained; retention does not guarantee a shrinking database file. Recovery amounts remain snapshot-bound, indicative and non-actionable.

## 12. Scope and prohibited-action confirmation

Phase 3 only. No signing, broadcasting, repayment or collateral execution, execution-wallet connection, oracle promotion, real Telegram/Discord message, commit, push, deployment or unrelated-project modification occurred. Verification used bounded read-only chain access; no long-running production monitor was started. All work remains local and uncommitted. Phase 3 is complete; further work awaits separate approval.
