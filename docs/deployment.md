# Deployment preparation and release procedure

Phase 5 prepares a **local, uncommitted release candidate**. Production deployment and production monitoring require separate approval. Commands below describe an operator procedure; the service example has not been installed or started.

## 1. Review the candidate

1. Review [the gap register](production-readiness-gaps.md), [Phase 5 report](phase5-report.md), [release readiness](release-readiness.md) and the latest verification artifacts.
2. Verify [release-manifest.json](../evidence/phase5/release-manifest.json) against [its SHA-256](../evidence/phase5/release-manifest.sha256), then run `npm run release:check` on the unchanged verified tree. The manifest binds package/lock/config/source, build, documents and recorded evidence. It explicitly records an unavailable Git revision when no HEAD exists; a future approved commit or tag is a separate action.
3. Preserve the whole release, runtime dependencies, package lock and reviewed evidence required by `src/oracle-assurance/reviewed.ts`. Copying only `dist/cli.js` is insufficient. Keep the recorded build artifacts for rollback.
4. The selected account is a public demonstration borrower, not an execution wallet. The release cannot sign, repay, add collateral or broadcast.

## 2. Prepare the approved host

- Install the exact **Node 24.14.1 / SQLite 3.51.2** runtime through the host's reviewed distribution process. Record runtime binary provenance/digest on that host. Verify `node --version` and `node -p "process.versions.sqlite"` before use. An identical version string does not by itself prove an identical binary.
- Create a dedicated non-administrator worker account, a private local database directory, a separate backup directory and a bounded log store. The operator must verify ownership, ACLs, local storage semantics, free space and time synchronization.
- Stage dependencies with the pinned lockfile (`npm ci`) in the approved build/staging environment, then run the checks below. This phase did not update dependency versions or the lockfile. An npm audit is a point-in-time check; new findings are a new release decision.
- Use a stable explicit release directory, not a linked database or evidence path. Keep application code and Phase 1–4 evidence read-only to the worker.
- Egress permits the fixed RPC/MCP HTTPS endpoints and, only when separately approved and enabled, Telegram/Discord. There is no required inbound port. DNS/TLS trust and corporate proxy behavior require host validation.

## 3. Configure without secrets in files under version control

Copy [production.example.json](../config/production.example.json) to an operator-owned JSON file and set an absolute local database path appropriate to that OS. The Unix example path must be adapted deliberately on Windows. Keep `monitoring.enabled=false` and both external channels false during preparation. Configure thresholds through a separate non-secret risk JSON. See [all supported settings](environment-variables.md).

On a prepared Windows staging host, for example:

```powershell
node --version
node -p "process.versions.sqlite"
node dist/cli.js config-check --config C:/watchdog-config/monitoring.json
node dist/cli.js health --config C:/watchdog-config/monitoring.json
```

`config-check` returns 0 for valid configuration; an absent database makes health return 2 without creating one. Neither command sends a notification. With an enabled channel, configuration validation reads only that channel's documented environment values and reports status, never values.

## 4. Protect and initialize storage

For an existing database, take and verify a backup **before forward migration**. Backup can read a supported legacy schema. Stop the old worker before `database-init`; writable initialization requires exclusive maintenance ownership.

```powershell
node dist/cli.js backup --database C:/watchdog-data/watchdog.sqlite --output C:/watchdog-backups/pre-phase5-unique
node dist/cli.js backup-verify --backup C:/watchdog-backups/pre-phase5-unique
node dist/cli.js restore-verify --backup C:/watchdog-backups/pre-phase5-unique --restore-root C:/watchdog-recovery/verification
node dist/cli.js database-init --config C:/watchdog-config/monitoring.json
node dist/cli.js diagnostics --config C:/watchdog-config/monitoring.json
```

For a brand-new database, omit the pre-existing-database backup and run the explicit initialization command. A valid empty schema is not a successful chain observation. Unsupported/corrupt/newer schemas and schema-layout drift fail closed. Never delete or recreate the store merely to make health green. [Database operations](database-operations.md) describes failure handling.

## 5. Run bounded host acceptance after authorization

```powershell
node dist/cli.js readiness --probe --config C:/watchdog-config/monitoring.json --risk-config C:/watchdog-config/risk.json
node dist/cli.js monitor --once --config C:/watchdog-config/monitoring.json --risk-config C:/watchdog-config/risk.json
node dist/cli.js readiness --config C:/watchdog-config/monitoring.json --risk-config C:/watchdog-config/risk.json
```

The probe makes read-only connectivity requests; it does not validate a position or create an accepted snapshot. Before a first accepted live cycle, readiness is expected to return 2. `monitor --once` writes a real observation and dispatches existing work for enabled channels; it is not a dry run. For console-only host acceptance, both external channels must remain false. Review `monitorRunning`, last accepted block/hash/time, latest cycle status, scope, failures and resource measurements, not just the exit code.

Complete the host gates in [release readiness](release-readiness.md): actual service signal behavior, crash recovery, disk/permission faults, restart-rate limits, rotated logs, off-host restoration and a real-duration soak. Real provider delivery needs its own approved destination/credential test. Local fixtures cannot replace those checks.

## 6. Continuous monitoring approval and supervision

After explicit approval, set `monitoring.enabled=true` in the reviewed host config. Run exactly one worker under the accepted supervisor. The reference [systemd unit](../deploy/liquidation-watchdog.service.example) uses:

- 30-second application shutdown grace and a 45-second supervisor stop timeout;
- restart on failure with 30-second delay and at most three starts per ten minutes;
- private account/umask, read-only program tree and writable database directory;
- proposed 640 MiB soft / 768 MiB hard memory limits and bounded process/file-descriptor counts;
- stdout/stderr to the supervisor's rotating log store.

These values must be tested on the actual host. Do not restart forever after corruption, schema failure or a resource safeguard. Investigate through [the operations runbook](operations-runbook.md). Approval to observe does not promote oracle assurance or financial actionability.

## 7. Upgrades and release verification

In the local build workspace:

```powershell
npm run verify
# After completing final documentation against those recorded results:
npm run verify -- --finalize
npm run release:manifest
npm run release:check
```

The full run performs bounded live reads; finalization is local and checks source inputs have not changed since testing. Finalization must follow the completed full run, and manifest generation rejects documentation changes after its fingerprint was checked. Canonical test/stability reports must match that run's saved copies. A source/config/script change requires a new full run. A documentation-only update requires finalization and manifest regeneration. Release checking also performs a read-only secret scan including the generated manifest/checksum. The verification command neither stages nor commits files.

An approved upgrade follows: stop/fence old worker → verified pre-upgrade backup → stage exact candidate → explicit migration → bounded console-only acceptance → readiness review → approved supervised start. Keep the previous release and pre-migration database together. SQLite down-migrations are unsupported; use [rollback and recovery](rollback-and-recovery.md).
