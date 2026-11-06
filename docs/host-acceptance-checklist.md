# Phase 6 host acceptance checklist

Statuses: **PASS** (completed with evidence), **BLOCKED** (cannot proceed on the unidentified target host), **NOT_TESTED** (not executed locally; no false waivers).

## Gate-by-gate checklist

| Gate | Status | What was executed (local development machine only) | What must still be executed on the target host |
| --- | --- | --- | --- |
| 1. Release identity | **PASS** | `npm run release:check` PASS before testing; manifest digest recomputed and matched; version/schema/runtime/git status recorded in [release-identity.json](../evidence/phase6/release-identity.json) | Re-verify the exact manifest against the staged copy at install time; record the owner-approved revision/immutable package identity when one exists |
| 2. Runtime compatibility | **BLOCKED** | `node --version` = v24.14.1 and SQLite 3.51.2 exactly matched on the dev machine; production build executed; `config-check` exit 0 (`runtimeVerified: true`) | Record installed-runtime binary provenance/digest via the host's reviewed distribution process; verify `node --version` + `node -p "process.versions.sqlite"`; confirm identical version ≠ identical binary |
| 3. Filesystem & permissions | **BLOCKED** | Temp workspace created; store + `-wal`/`-shm`/`-journal`/`-monitor-lock` created and removed; schema-drift DB refused by `health` and `database-init` (`STORE_SCHEMA_LAYOUT`); traversal config refused (`MONITOR_DATABASE_PATH`) | Dedicated worker account ACLs/umask on release/config/database/backup/log/recovery directories; sidecar/fsync/locking behavior; read-only-directory, full-disk and power-loss exercises |
| 4. Database init & integrity | **BLOCKED** | Isolated temp DB: schema 5/app ID/quick+integrity/FK checks ok; concurrent writable init refused (`MONITOR_ALREADY_RUNNING`) while read-only health stayed available; read-only diagnostics never initialized storage | Repeat the gated set on actual storage (durable disk paths) and record sizes/growth; verify the actual maintenance-ownership behavior under the chosen service identity |
| 5. Backup & restore | **BLOCKED** | Online `backup` exit 0 (~8.5 s); `backup-verify` PASS; `restore-verify` PASS (isolated, source unchanged, state/alerts/dedup preserved, known-delivered not resent, 0 external calls); scratch removed | Hourly schedule executed operationally, independent off-host copy, full-size/perf measurement at expected evidence size, host-loss drill, measured RPO/RTO and reconciliation |
| 6. Process lifecycle | **BLOCKED** | 13 sequential bounded monitor processes, clean exits, ownership fencing, restart continuity, no duplicate known-delivered alerts; Phase 5 handler-simulated/actual-forced-termination coverage cited | Actual supervisor stop/timeout/restart-rate behavior (SIGTERM on Linux or chosen Windows wrapper), log rotation, crash-restart discipline |
| 7. Network connectivity | **BLOCKED** | Both fixed hostnames resolve (CNAME records recorded); `readiness --probe`: RPC REACHABLE + MCP REACHABLE; 12 accepted cycles within read/whole-cycle bounded budgets; no endpoint/chain/provider modification | Egress/firewall/proxy/TLS trust acceptance for both endpoints; actual DNS/TLS failure and reconnect behavior |
| 8. RPC/MCP consistency | **BLOCKED** | Per-cycle RPC/MCP chain/head/hash/contract agreement: 12/12 accepted cycles; monotonic blocks 21920617→21921409 | Block-hash agreement under provider outage/429/5xx storms on the target network; acceptance of the shared-upstream (non-independent) limitation as an operational risk |
| 9. Monitoring operation | **BLOCKED** | ≥10 (12) bounded single-cycle observations, all accepted; cycles 63.6–64.8 s (≤240 s budget) for ~12.8 min total ≤ 30 min cap; UNVERIFIED quality gating every cycle; rejected attempt did not clobber accepted baseline | Continuous monitored pacing on the actual host interval/budgets; approved real-duration soak with operator and exit criteria |
| 10. Notification reliability | **BLOCKED** | Console-only deliveries verified (3 alerts / 3 attempts / 9 events / dedup); secret redaction in outputs; no `WATCHDOG_*` variables present (names only) | Approved destination/credential test with real providers only after separate approval; channel-enable/disable and block/cooldown recovery drills |
| 11. Resource limits | **BLOCKED** | All measured values far below ceilings (DB 1.25 MiB/4 GiB; WAL ≈0/256 MiB; RSS ~101 MiB/512 MiB; pending 0–3/10,000); limit-stopping behavior from Phase 5 fixtures | Independent host memory/process limits (RLM/equivalent), free-space monitoring, evaluated log growth; repeat measurements at expected production size |
| 12. Security | **BLOCKED** | `.env.example` hash matches documented pin; no endpoint/oracle/config change; secret-redacted outputs; drift/traversal refusals enforced | Privilege boundary verification (own service identity vs operator), secret injection mechanism, egress allowlist, disk encryption, backup media protection |
| 13. Operational documentation | **PASS** | Ten Phase 5 docs + Phase 6 report/checklist/files documents exist; documentation link check runs in the final verification | Confirm runbook reflects the host's actual paths, supervisor config and contact/escalation procedures at deployment time |

## Reference command sequence executed locally (do NOT rerun on target without ownership review)

```powershell
node dist/cli.js config-check      --config <monitoring.json>
node dist/cli.js health            --config <monitoring.json>
node dist/cli.js database-init     --config <monitoring.json>
node dist/cli.js monitor --once    --config <monitoring.json> --risk-config <risk.json>
node dist/cli.js health            --config <monitoring.json>          # during an active cycle: read-only view
node dist/cli.js database-init     --config <monitoring.json>          # expect refusal: MONITOR_ALREADY_RUNNING
node dist/cli.js readiness         [--probe] --config <monitoring.json> --risk-config <risk.json>
node dist/cli.js diagnostics       --config <monitoring.json> --risk-config <risk.json>
node dist/cli.js status            --config <monitoring.json> --risk-config <risk.json>
node dist/cli.js alerts --limit 20 --config <monitoring.json>
node dist/cli.js oracle-status --json
node dist/cli.js backup            --config <monitoring.json> --output <new exclusive directory>
node dist/cli.js backup-verify     --backup  <that directory>
node dist/cli.js restore-verify    --backup  <that directory> --restore-root <scratch parent> [--config <monitoring.json>]
```

Notes
- `--once` only. `monitoring.enabled` stays `false` until separate approval. Both external channels stay `false`.
- Never target an existing/production database with destructive or writable acceptance commands; init/migration/backup destinations must be exclusive new paths in private local directories.
- Readiness success on an empty store is expected to be 2 and is not a pass/fail of the host itself.

## Fail-closed demonstrations recorded locally

| Attempt | Expected | Observed |
| --- | --- | --- |
| Extra table on a schema-5 copy → any writable command | Refusal before writes, original preserved | `STORE_SCHEMA_LAYOUT`, exit 2, copy byte-intact |
| Config storage path with `..` traversal | Rejection | `MONITOR_DATABASE_PATH`, exit 2 |
| Writable init while a real cycle owns the store | Explicit ownership failure | `MONITOR_ALREADY_RUNNING`, exit 2 (read-only health remained usable) |
| Invalid risk config (monitoring JSON passed to `--risk-config`) | Fast, conservative failure | `INVALID_THRESHOLDS`, no observation accepted, baseline untouched |

## Target-host test package (ready to execute once the host is named)

1. Owner names the host (role, OS, account, sizing, network zone) and approves a bounded acceptance window.
2. Stage this exact release candidate; verify manifest + digest + runtime pins per the checklist row 2 (Runtime Compatibility).
3. Run the checklist rows 2–12 in order, capturing sanitized transcripts to `evidence/phase6/target-host/`, with host-specific redaction.
4. Owner-led supervisor/channel drill only after approval (rows 6, 10).
5. Update this checklist/report and rebind the release per the Phase 5 finalization procedure ([deployment.md](deployment.md) §7).
