# Rollback and disaster recovery

Rollback is an operator procedure after separate approval. This project supplies backup/verification and forward migration, **not** an automatic live-database replacement or downgrade command. Keep the original database, sidecars, release and evidence available until the replacement has been independently accepted.

## Stop and preserve first

1. Stop new scheduled starts and fence the old worker through the accepted supervisor. Request graceful shutdown, record its outcome and verify ownership is no longer held. A dead PID alone is not sufficient if another worker may own the database.
2. Record sanitized diagnostics, release-manifest digest, configuration/threshold identity, schema version, latest/accepted block/hash/time and delivery/cooldown counts. Do not export secrets or raw provider response bodies.
3. If the database is readable and capacity permits, create a new consistent backup with the Phase 5 CLI. Verify it and its isolated restore. If unreadable, preserve the entire original database directory including sidecars as incident evidence; never delete WAL/SHM or initialize over it.
4. Keep external channels disabled while evaluating recovery candidates. Previously in-flight sends and events after any selected backup can already have reached their destinations.

## Release rollback with a compatible schema

Use a known verified earlier **Phase 5** release only if its schema and migration checksums exactly match the current database. Validate its runtime and dependencies and verify the candidate database with its own tooling before starting it. A mismatch is a failed compatibility check, not permission to edit `user_version` or migration checksums.

Once prepared: stop/fence current worker → preserve incident backup → stage the known compatible executable/configuration → bounded console-only observation and diagnostics → explicit readiness/approval review → supervised start. Keep the previous release path intact; use explicit paths rather than linked database aliases.

## Rollback from schema 5 to a Phase 4 executable

Phase 4 understands schema 4. It must not open a schema-5 store. The safe rollback input is a **verified pre-Phase-5 schema-4 backup plus its corresponding release/configuration/evidence**. There is no in-place downgrade.

Restoring that backup discards knowledge of cycles, alerts and acknowledgments after its timestamp. Preserve the newer database and reconcile those events; do not describe rollback as lossless for post-backup work. If a suitable pre-migration backup is absent, rollback is blocked. Prefer repairing/releasing a compatible schema-5 implementation rather than attempting an ad hoc down-migration.

## Validate a recovery source

```powershell
node dist/cli.js backup-verify --backup C:/watchdog-backups/selected-verified-set
node dist/cli.js restore-verify --backup C:/watchdog-backups/selected-verified-set --restore-root C:/watchdog-recovery/verification --config C:/watchdog-config/monitoring.json
```

The verification copy is disposable and automatically removed. It checks pre-migration hashes, supported forward migration, state/alert/fingerprint preservation, ambiguous attempt recovery, unchanged known-delivered rows and an unchanged source backup. It never dispatches notifications or replaces live storage.

## Prepare an actual replacement after approval

1. Create a new private local recovery-candidate directory with exclusive creation. Copy the verified **standalone** `database.sqlite` from the immutable backup into a new candidate filename; never overlay the current main file or mix it with current sidecars. Preserve the immutable source backup.
2. Restore every manifest-listed evidence file at its recorded relative path in the intended release workspace. If that path already exists, require the recorded hash to agree; do not overwrite sealed evidence. Preserve the matching application release, lockfile and non-secret config independently. Reinject provider credentials privately only when later approved.
3. Using the intended Phase 5 release, run `database-init --database <absolute-candidate.sqlite> --config <reviewed-config>` for explicit forward migration. Run diagnostics and create a **new** backup of the candidate, then `backup-verify` and `restore-verify` against that backup. Use the selected retry policy; do not mutate the immutable recovery source.
4. Compare counts/hashes/accepted baseline, fingerprints, queued entries, provider blocks/cooldowns and delivery history. The copied runtime record may describe the old process; it is not proof that a worker is running. The first authorized start installs a new run identity and performs restart recovery.
5. Reconcile alerts delivered after the backup timestamp using preserved later database/log/provider evidence. Never replay known-delivered rows or reset attempt counters to suppress the ambiguity. If reconciliation is incomplete, keep the affected channels disabled and record the uncertainty.
6. With all old writers fenced, point the reviewed config at the new candidate path or promote its whole directory through the operator's atomic same-filesystem procedure. Keep the former directory quarantined intact. Do not use the mere presence/absence of a lock file as a fencing mechanism.
7. After approval, run one console-only bounded monitor cycle, inspect readiness and record its result. Enable continuous monitoring and any external channels only through the separately approved supervisor/channel procedure.

The concrete file promotion, ACL restoration, actual service restart and manual delivery reconciliation must be tested on the deployment host. They were not performed against production in Phase 5.

## Scenario decisions

| Incident | Recovery direction |
| --- | --- |
| Provider outage / unknown oracle freshness | Preserve database and quality gates; wait/investigate fixed providers. A database rollback does not repair upstream evidence. |
| Disk reserve / WAL growth | Stop restart storm, investigate readers/capacity and preserve required records; do not delete pending work. |
| DB corruption or lost host | Select latest independently verified complete backup; restore all evidence, measure data-loss window and reconcile notifications. |
| Failed forward migration | Transaction should roll back; verify original schema/content before restarting the old release. Retain failure evidence. |
| Newer schema / checksum / layout drift | Use the matching approved release or a verified pre-migration backup; never force version fields. |
| Wrong notification destination | Disable channel, preserve attempts and review exposure/replay with operator; changing config does not undo already delivered messages. |

Hourly-backup RPO of one hour and RTO of 30 minutes are **proposed targets**, not measured outcomes. Off-host restoration, host-loss recovery and reconciliation need acceptance evidence. [Database operations](database-operations.md) explains backup contents and [release readiness](release-readiness.md) tracks remaining gates.
