# A3 — Neon Free operations preparation

**DRAFT-UNAPPROVED-NOT-DEPLOYED.** These are proposed operating procedures for a future Free demonstration. No Neon service was contacted or operated in A3.

## 1. Normal runtime behavior

Render uses the two pooled runtime URLs; migration, dump and restore use a separately held direct operator URL. Pools are lazy (`min=0`, `max=1` each), release idle connections after five seconds and recycle connections after 60 seconds. Every transaction checks schema/catalog and role boundaries; writer transactions use `synchronous_commit=on`; connection/statement/lock/transaction limits remain bounded.

Neon Free suspends compute after five idle minutes. A scheduler request can therefore encounter both a Render cold start and a Neon wake. The application serializes connection acquisition, makes at most two transient acquisition attempts, discards broken connections and returns only sanitized codes. No automatic transaction replay occurs after an unknown COMMIT; stable execution/cycle/attempt identities reconcile the durable result.

The 300-second schedule does not guarantee a completed observation every five minutes. A wake or provider read that misses the bounded cycle/job window produces a failed/unknown receipt. The previous observation ages normally and becomes stale after 600 seconds.

## 2. Monitoring and capacity controls

Review at least daily during any finite acceptance run:

- Neon compute CU-hours, current compute size and wake frequency;
- database size against the 1 GB project cap and application 800,000,000-byte admission stop;
- public transfer against 5 GB/project/month;
- connection/wait/error metrics and pooler client/server connections;
- scheduled receipt counts, missed slots, failed/unknown outcomes and last accepted observation age;
- protected rows that cannot be pruned: stream bindings, pending deliveries and fingerprint tombstones.

Suggested operational thresholds require later approval: warning at 60% of each provider quota, escalation at 70%, and disabling new monitoring before 80% if the application has not already stopped. These are headroom proposals, not implemented provider alarms. Never delete evidence, fingerprints, pending outbox rows or state blindly to recover quota.

## 3. Failure and exhaustion behavior

| Condition | Required behavior |
| --- | --- |
| Compute asleep/waking | Bounded reconnect; no fallback backend; keep last persisted observation and age it honestly. |
| CU/egress quota exhausted | Neon may suspend compute. Record external scheduler/network failures; disable the schedule if repeated calls only consume other quotas; wait for approved remediation/reset. |
| Storage near application stop | New cycles fail closed with `RESOURCE_DATABASE_LIMIT`; investigate growth before Neon reaches its hard cap. |
| Storage hard cap | Writes, including some updates/deletes, can fail. Do not loop pruning or recreate the database. Fence writers and execute an approved capacity/recovery plan. |
| Connection/pool wait failure | Return sanitized unavailability; Cloudflare performs no automatic retry; next UTC slot is independent and durably fenced. |
| Lost COMMIT response | Reconcile by stable identity; do not blindly repeat writes or provider sends. |
| Catalog/role/major drift | Runtime hard-stops. An operator corrects infrastructure outside startup, then reruns verification. |
| Provider suspension/maintenance | Liveness may remain up while readiness becomes unavailable/stale. Do not label old data fresh. |

## 4. Maintenance, backup and recovery boundary

No DDL, migration, dump, restore, role change or automatic repair occurs during web startup. Maintenance requires a separately approved window, direct connection, global writer fence and verified release/schema identity. A new restored database needs a new incarnation before runtime access.

Free history (six hours/1 GB changes) and the one manual snapshot do not meet an independent RPO/RTO. A5 must approve destination, encryption-key recovery, retention, egress and a tested isolated restore. Restored notification rows remain at-least-once and require reconciliation before channels are enabled.

## 5. Rotation and incident response

For a suspected writer/reader credential leak: disable the affected role or service, preserve receipts/logs, reconcile admitted work, issue a new role credential privately, update only the corresponding Render secret, force old pools closed, verify old access fails, and rerun role/catalog/TLS tests. Never log URLs or password/digest text.

For a Neon outage: do not switch to the historical SQLite files. Keep Cloudflare outcomes/missed-slot evidence, preserve the 600-second freshness gate, and resume only when the same reviewed database identity and role restrictions verify. Any restore or project replacement is an A5/A8 decision.

Sources and current Free limits are recorded in [Neon setup](a3-neon-setup.md). No uptime or production SLA is claimed.
