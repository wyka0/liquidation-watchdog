# Phase 6 host acceptance report

**Intended deployment host: NOT YET SPECIFIED — target-host acceptance is BLOCKED.** Everything recorded in this report was executed on the Phase 5 development machine and is labeled accordingly. Local results demonstrate that the acceptance **procedures** and their evidence outputs work and that the release behaves as documented on one concrete Windows runtime; they do **not** constitute acceptance of the intended deployment host, whatever it turns out to be.

Safety state unchanged: **oracle assurance UNVERIFIED, freshness UNKNOWN, recovery estimates indicative and `actionable: false`, production approval NOT GRANTED.**

Companion documents: [host-acceptance-checklist](host-acceptance-checklist.md) (gate-by-gate status and the exact tests that must run on the target host) and [host-acceptance-files](host-acceptance-files.md) (evidence inventory). Evidence: [evidence/phase6/](../evidence/phase6/).

## 1. Intended host identity and availability

- The intended deployment host has **not been specified** (owner decision, 2026-11-02). Per the Phase 6 rules, host-specific gates are therefore classified **BLOCKED**, not PASS or FAIL.
- Host identity, availability and sizing for the target could not be inspected because no target was named. Nothing was assumed; the OpenCode development machine was **not** treated as the deployment host.
- The [Phase 5 architecture](production-architecture.md) prefers a dedicated Linux host with systemd; the reference systemd unit remains an uninstalled example. If the eventual target is that model, the checklist's Linux sections apply; if it is this Windows machine, the owner must say so explicitly, and the same local demonstrations would then be re-run and re-recorded *as host acceptance*.

## 2. Host inventory (local development machine — reference environment only)

Captured read-only; full record: [host-inventory.raw.json](../evidence/phase6/host-inventory.raw.json), [host-environment-observations.json](../evidence/phase6/host-environment-observations.json).

| Item | Local observation |
| --- | --- |
| Operating system | [REDACTED_OS_DETAIL] |
| Host | [REDACTED_HOST_MODEL] laptop (hostname `[REDACTED_HOSTNAME]`) |
| CPU | [REDACTED_CPU_MODEL], 2 cores / 4 logical processors |
| Memory | [REDACTED_MEMORY_OBSERVATION] |
| Disk | C: NTFS, 510,476,152,832 bytes, 204,566,417,408 free; filesystem: NTFS (journaled local) |
| Software | winget available; systemd/nssm/pm2/winsw NOT installed; no watchdog processes, services or scheduled tasks |
| Time sync | W32Time running (source time.windows.com); at capture it reported Leap Indicator 3 "not synchronized", last sync 2026-11-01 22:47:48 |
| Ownership/user | `[REDACTED_USER]`; non-elevated token (Administrators deny-only). No existing directory permissions, shares or privileges were changed. |
| Network | rpc.pharos.xyz → Aliyun ALB CNAME; mcp.pharos.xyz → AWS ELB CNAME; both resolve and are TLS-reachable via the application probe |
| Supervisor | None installed (as the architecture expects an external supervisor, this is a target-host requirement) |

This machine is a personal laptop shared with unrelated work. It is a reasonable **demonstration environment**, and it is not claimed to be production.

## 3. Release candidate identity

Verified **before any Phase 6 testing** (host-independent):

- `npm run release:check` → **PASS**: source, build, documentation and **253** evidence files match the manifest; recorded in the Phase 6 transcript. Manifest digest re-verified during Phase 6: recorded `evidence/phase5/release-manifest.sha256` SHA-256 equals a fresh recomputation; see [release-identity.json](../evidence/phase6/release-identity.json).
- Package version **0.1.0**; kind `LOCAL_PHASE5_RELEASE_CANDIDATE`; Git revision honestly `UNAVAILABLE_NO_VERIFIED_HEAD` — **no revision was fabricated**.
- Runtime requirements (pinned): Node **v24.14.1** / SQLite **3.51.2**. Schema **5** (application ID `0x4C575033`).
- Oracle assurance bound in the manifest: **UNVERIFIED**; `actionable=false`; `productionApproval=false`.
- The candidate was **not rejected**: source/build binding matched.

## 4. Runtime compatibility

| Check | Result | Classification |
| --- | --- | --- |
| `node --version` on host | v24.14.1 (exact match) | LOCAL demonstration |
| `process.versions.sqlite` | 3.51.2 (exact match) | LOCAL demonstration |
| Production build `dist/cli.js` | Built by Phase 5 verification; `--help`, all diagnostics and 12 bounded monitor processes executed successfully | LOCAL demonstration |
| `config-check` (production profile) | exit 0, `runtimeVerified: true`, chain 1672 `FIXED_CONFIGURATION_VALID` | LOCAL demonstration |
| Runtime dependency resolution / SQLite native | 12 accepted live cycles + backup/restore exercised `node:sqlite` natively | LOCAL demonstration |
| **Runtime acceptance of the target host** | Not possible: host unspecified | **BLOCKED** |

No runtime upgrade/downgrade occurred. Binary provenance/digest of the runtime on the *target* host (an owner-documented requirement) cannot be recorded here.

## 5. Filesystem and permissions

Temporary workspace: `[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/phase6-acceptance` (created fresh; no existing directory was touched). LOCAL demonstrations all passed:

- Database directory creation and writes: application created the store and all sidecars (`-wal`, `-shm`, `-monitor-lock`) and cleaned them on close.
- **Schema-layout drift**: one extra user table injected into a disposable copy → `health` exit 2 and `database-init` exit 2 with `STORE_SCHEMA_LAYOUT`; the copy was preserved unmodified (no silent repair, no downgrade, no reset): [health-schema-drift-refusal](../evidence/phase6/health-schema-drift-refusal.txt), [database-init-schema-drift-refusal](../evidence/phase6/database-init-schema-drift-refusal.txt).
- **Path traversal rejection**: config storage path containing `..` refused by `config-check` with `MONITOR_DATABASE_PATH`, exit 2: [config-check-traversal-refusal](../evidence/phase6/config-check-traversal-refusal.json).
- Symlink/junction/hardlink/UNC alternatives are refused by shared validation code; direct CLI demonstrations of those fixtures rely on Phase 5 unit tests (they were not separately re-run in Phase 6).
- Secret hygiene in files: no credentials in any configuration/created file; scan runs in final verification.

| Check | Classification |
| --- | --- |
| Intended service identity ACLs/ownership on real (non-temporary) directories | **BLOCKED** (no target; none changed locally) |
| WAL/shm/journal power-loss durability, fsync semantics, controller cache | Not testable locally; requires target-host fault exercises | **BLOCKED** |
| Lock-contention behavior (SQLite transactions as lock) | Demonstrated locally (§7) | LOCAL demonstration |

## 6. Database acceptance (local, isolated temporary database)

Schema/init/integrity:

- `database-init` created schema **5**; independent probe recorded user_version 5, application ID `1280790579` (`0x4C575033`), `journal_mode=wal`, `quick_check`/`integrity_check` ok, foreign-key check empty: [backup-database-probe](../evidence/phase6/backup-database-probe.json) shows the same for the backup copy.
- Concurrent writable access while a bounded monitor cycle owned the store: `database-init` refused with `MONITOR_ALREADY_RUNNING`, exit 2, while read-only `health` remained available (exit 0, `workerStatus RUNNING`, `ownership HELD`): [database-init-rejected-during-active-cycle](../evidence/phase6/database-init-rejected-during-active-cycle.txt), [health-during-active-cycle](../evidence/phase6/health-during-active-cycle.txt).
- Read-only diagnostics never initialize or migrate: `health` on missing storage returned exit 2 `STORE_NOT_FOUND` and created nothing: [health-before-init-STORE_NOT_FOUND](../evidence/phase6/health-before-init-STORE_NOT_FOUND.txt).
- Transaction rollback, migration-checksum, capacity/`SQLITE_FULL` rollback and retention-safety behaviors are covered by the Phase 5 unit suites (e.g. `test/operations-storage.test.ts`); they were not re-executed separately in Phase 6.

Consistent online backup → verification → isolated restore, on the database state after 12 accepted cycles:

1. `backup` → exit 0 in ~8.5 s; capture `phase6-capture-1` (database.sqlite + bound evidence + manifest + checksum). Snapshot identity: block **21921409**.
2. `backup-verify` → **PASS** (exit 0).
3. `restore-verify` → **PASS** (exit 0): `isolated=true`, `sourceUnchanged=true`, `preservedStateAlertsAndDedup=true`, `knownDeliveredNotResent=true`, schema 5→5, `recoveredAmbiguous=0`, `externalCalls=0`, `actionable=false`; disposable scratch removed. [restore-verify](../evidence/phase6/restore-verify.json)
4. Record comparison original↔restored: all table hashes/counts matched inside `restore-verify` (12 cycles, 3 alerts, 3 deliveries, calendar-consistent fingerprints; alerts/deliveries/ambiguity states preserved).
5. The live database was never overwritten or migrated by any acceptance command.

**No RPO/RTO claim is made.** The proposed 1 h RPO / 30 min RTO remain unmeasured proposals; off-host copy, host-loss recovery and reconciliation are unchecked target-host tests.

## 7. Process lifecycle acceptance

LOCAL demonstrations:

- **13 sequential bounded monitor processes** (12 accepted observations + 1 invalid-configuration attempt that was correctly rejected; §9): each exited cleanly (0) with a persisted `shutdown` record.
- **Ownership fencing**: with a live cycle holding the store, a second writable process was refused (`MONITOR_ALREADY_RUNNING`); the cycle itself completed unperturbed.
- **Restart recovery**: across 13 process starts the store retained accepted baseline, known-delivered alerts (3 deliveries / 3 attempts), dedup fingerprints (3) and produced **no duplicate known-delivered alerts**; `restart_recovery` events recorded at startup.
- **Pending outbox preservation**: pending count 0 throughout; disabled external channels preserved pending-work semantics per Phase 5 tests.
- Windows graceful SIGINT/SIGTERM handling was exercised in Phase 5 as explicit handler simulations plus **actual** forced OS termination of a real child; CLI signal-cleanup is wired through the settling service. These remain local-runtime facts.

| Check | Classification |
| --- | --- |
| Graceful SIGTERM/SIGINT as an external supervisor would deliver them, hard-stop timeout behavior, restart-rate limiting, log rotation on the target OS | **BLOCKED** (no target host; no supervisor installed — by rule nothing was installed) |

## 8. RPC/MCP connectivity and consistency

- Endpoints used: **exactly** `https://rpc.pharos.xyz` and `https://mcp.pharos.xyz/mcp`, chain **1672** — no endpoint, chain or provider change; no deprecated tracing method; no fallback.
- DNS resolution of both hostnames recorded (see §2). TLS/Termination through the application: `readiness --probe` reports RPC **REACHABLE** and MCP **REACHABLE** (`EXPLICIT_READ_ONLY_PROBE`): [readiness-probe](../evidence/phase6/readiness-probe.json).
- Bounded request budgets applied by the application (30 s connectivity/cycle budgets); all 12 accepted cycles completed inside the 240 s whole-cycle budget (max 64.8 s).
- Block-hash consistency: every accepted observation required RPC/MCP agreement on chain ID, head, block hash and contract code; 12/12 cycles satisfied it and are recorded in [monitoring-observation-results.json](../evidence/phase6/monitoring-observation-results.json). Blocks ran monotonically 21920617 → 21921409.
- 429/5xx/malformed response handling: verified previously under **mocked** transport conditions (Phase 5 `operations-transports` suite: bounded same-endpoint retries, no partial retention, no weaker snapshots). A real-provider outage/429 storm was not staged in Phase 6: **NOT_TESTED** (locally by design; target-host outage behavior also requires the target).
- Shared-upstream caveat stands: RPC/MCP agreement is not independence. A reachable, consistent network is not evidence of oracle correctness.

## 9. Monitoring acceptance

**Bounded observation series — 12 accepted single-cycle processes** ([record](../evidence/phase6/monitoring-observation-results.json)):

| Metric | Value |
| --- | --- |
| Cycles executed / accepted | 12 / 12 (monotonic blocks 21920617 → 21921409) |
| Cycle duration (min–max observed) | ~63.6 s–64.8 s (budget 240 s) |
| Total observation wall time | ~12.8 min (cap: 30 min; not exceeded) |
| Data quality / oracle assurance per cycle | UNVERIFIED / UNVERIFIED (every cycle) |
| Mathematical risk state per cycle | WARNING (indicative) |
| Effective quality state | DATA_UNVERIFIED; `actionable=false` (every cycle) |
| Alerting | 3 alerts (initial transition + quality-transition reasons), deduplicated; 3 console deliveries |
| Rejected/unavailable observations | 1 rejected attempt (`INVALID_THRESHOLDS —` operator misconfiguration); it produced no observation and did not overwrite the accepted baseline |
| Database growth | 1,310,720 bytes final; WAL checkpointed to 0 between runs |
| Process RSS | checker ~99 MiB; worker last runtime record ~94 MiB |
| Shutdown behavior | Clean after every cycle; `monitorRunning=false` when stopped; readiness exit 0 |

Design honesty notes:

- Each cycle was an individual `monitor --once` process; the production continuous scheduler path (interval pacing, failure backoff) was verified in Phase 5 by the 144-cycle bounded stability harness, not by this series.
- A ~13-minute series **does not** establish long-term reliability; it is not a soak test. The 30-day/real-duration soak gate remains open.
- No indefinite monitoring was started at any point (explicitly: `monitoring.enabled=false` in every configuration used; nothing was left running).

## 10. Notification acceptance

- Channels used: **console only**. `notifications.telegram=false`, `notifications.discord=false` in every configuration; `config-check` reported `telegram: DISABLED`, `discord: DISABLED` and `secretValues: OMITTED`.
- Verified locally: alert creation (3 persistent alerts with IDs/fingerprints), persistent outbox rows, delivery-attempt recording (3 attempts, 9 delivery events), delivery completion (`DELIVERED` = console write), restart recovery with no duplication of known-delivered alerts, and no secret values anywhere in output.
- Retry scheduling, rate-limit cooldown and provider-blocking paths are covered by Phase 5 **mocked-HTTP** suites; they were not re-driven by a live process in Phase 6.
- **Real Telegram/Discord delivery: NOT tested.** No credentials were inspected, entered or printed; no `WATCHDOG_*` variables exist in this environment (presence-checked only). Real provider delivery requires separate approval and a reviewed destination.

## 11. Host resource acceptance

| Limit (config default) | Observed local value | Status |
| --- | --- | --- |
| database ≤ 4,294,967,296 B | 1,310,720 B | far below cap (limit enforcement is also unit-tested; `max_page_count` ceiling verified in Phase 4/5 tests) |
| WAL ≤ 268,435,456 B | checkpointed to ~0 B between runs | OK |
| min free disk ≥ 536,870,912 B | ~204,589,285,376 B free | OK |
| RSS ≤ 536,870,912 B | checker ≈ 101 MiB; worker record ≈ 94 MiB | OK |
| pending deliveries ≤ 10,000 | 0–3 | OK |
| evidence 2 GiB / 50,000 files | ~24 Phase 6 evidence files | OK |
| artifact ≤ 32 MiB | largest single evidence artifact < 0.5 MiB | OK |

Reaching a configured limit producing a controlled stop rather than silent deletion is verified by Phase 5 fixtures (page-limit transaction rollback, backlog admission, deadlock-free refusal). A real disk/memory exhaustion was deliberately **not** staged on any host; behavior under actual host memory pressure is a target-host test.

## 12. Security results

- Fixed read-method allowlist and endpoint isolation: unchanged; enforced for every request made (unit regressions preserved).
- Secret boundary: `.env.example` byte-exact against documented hash `517c936b…22c69`; `WATCHDOG_*` variable names absent from the environment (presence check only — values never read); disabled channels read nothing; diagnostics report `secretValues: OMITTED`.
- Redaction: operational outputs contain bounded internal codes and generic messages only; no raw provider text, no credential, no webhook URL, no token in any Phase 6 evidence file (also confirmed by the scanner during final verification).
- Path protections: traversal config refused (§5); drift refusal (§5).
- Host-side controls — actual ACL design, UAC/service separation, egress restrictions, secret injection mechanism, disk encryption — were **not** inspected or changed: target-host requirement.

## 13. Acceptance gate table

| # | Gate | Classification | Basis |
| --- | --- | --- | --- |
| 1 | Release identity | **PASS** | `release:check` PASS; manifest digest matches; no Git revision fabricated |
| 2 | Runtime compatibility | **BLOCKED** | Runtime exactly matched **locally**; target host unspecified; owner-proven binary digest required on target |
| 3 | Filesystem and permissions | **BLOCKED** | Local temp-workspace demonstrations passed; ACLs/fsync/power-loss need the target host |
| 4 | Database initialization and integrity | **BLOCKED** | Local demonstrations passed (schema 5, integrity, drift/concurrency/rollback); durability on target is the open item |
| 5 | Backup and restore | **BLOCKED** | Local PASS for online backup + isolated restore; off-host RPO/RTO unknown |
| 6 | Process lifecycle | **BLOCKED** | 13 clean bounded processes locally; supervisor, real signals, restart budgets need target |
| 7 | Network connectivity | **BLOCKED** | Reachable fixed endpoints locally (DNS/TLS/probe); egress/interception controls are target-host facts |
| 8 | RPC/MCP consistency | **BLOCKED** | Per-cycle RPC/MCP agreement locally; shared upstream is by design not independent; outage behavior target-host |
| 9 | Monitoring operation | **BLOCKED** | 12/12 bounded cycles accepted locally with conservative quality gating; not a soak; scheduler path host-shared but target-cycle pacing unmeasured |
| 10 | Notification reliability | **BLOCKED** | Console delivery verified locally; real provider delivery requires approval and is not tested |
| 11 | Resource limits | **BLOCKED** | All measured values far below ceilings locally; real exhaustion/host memory limits untested |
| 12 | Security | **BLOCKED** | Local secret/path/allowlist checks passed; host privilege/egress/secret-injection controls untested |
| 13 | Operational documentation | **PASS** | Ten Phase 5 documents plus these Phase 6 documents exist, cross-linked, link-checked |

Notes: **PASS** is used only for host-independent gates. **BLOCKED** means "cannot be completed on the unidentified target host" — not a failure of a local test. A critical gate cannot be silently waived; none was.

## 14. Evidence inventory and hashes

`evidence/phase6/` — 25 files including [host inventory](../evidence/phase6/host-inventory.raw.json), [environment observations](../evidence/phase6/host-environment-observations.json), [release identity](../evidence/phase6/release-identity.json), diagnostics suite records, refusal records, the bounded-observation record, backup/restore outputs and [evidence-hashes.json](../evidence/phase6/evidence-hashes.json) with per-file SHA-256. Every file is labeled by content; simulated/mocked/actual labels:

- **ACTUAL (read-only network/local runtime)**: all written evidence with live timestamps, live probe/monitor cycles, real process starts/exits, real backup/restore in temporaries.
- **MOCKED (prior Phase 5 suites, cited)**: transport 429/5xx/malformed handling, notification provider paths, certain file-system link fixtures.
- **NOT EXECUTED**: target-host filesystem/power-loss/ACL, real providers, off-host recovery, real outage, resource exhaustion, soak.

Hashes of this report set are recorded in [host-acceptance-files](host-acceptance-files.md). Verification chronology: the first full Phase 6 verification attempt finished **25/26** — a single Git-whitespace failure caused by trailing console-wrap spaces in two freshly captured transcripts; those artifacts were normalized and the subsequent completed attempt passed **26/26 checks on unchanged tested inputs** (2026-11-02T10:13:43Z→10:31:24Z, `sourceInputsUnchanged=true`). One finalize attempt also reported a transient git error exit on an evidence file that direct checking shows clean; the following finalize attempt passed **5/5**. No check was skipped or silently waived.

## 15. Remaining blockers

Set in order; the target-host blockers headline:

1. **Target host not specified** — every host-specific gate in §13 is BLOCKED pending the owner's host decision and availability.
2. Oracle source economics/operators, verified heartbeat/upstream freshness, independent comparator — unchanged (Phase 1–4 scope).
3. Real external notification delivery + reviewed destination/credentials.
4. Off-host backup copy, host-loss drill, measured RPO/RTO.
5. Real-duration production soak with operator and incident review.
6. Supervisor installation/selection, log rotation, restart budgets, stop-then-restart discipline on the target.
7. Production approval (still NOT GRANTED).

## 16. Final host acceptance classification

**TARGET-HOST ACCEPTANCE: BLOCKED (cannot proceed — intended host unspecified).** LOCAL PREPARATION: COMPLETE (procedures and evidence demonstrated to work on one concrete machine). **Production approval: NOT GRANTED.** No gate was failed, waived or silently dropped; every gate in §13 is classified with its basis.

## 17. Prohibited-action confirmation

No sign/broadcast, repayment, collateral change, execution-wallet use, position/market change, oracle/config modification, chain/endpoint change, real Telegram/Discord message, indefinite monitoring run, service/scheduled-job installation, cloud deployment, commit/push/tag, secret inspection/printing, or permission change on existing directories occurred. All monitoring was bounded `--once` cycles; all destructive work ran in freshly created temporary directories; the live application database was never overwritten; no unrelated project was touched. Phase 6 stops here, before target-host acceptance or any production action.
