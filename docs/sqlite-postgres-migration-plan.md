# SQLite → Neon PostgreSQL migration and recovery plan

**Phase 9 design only.** No database was opened by SQLite/application code, exported, migrated, restored or connected to Neon during this audit. The procedure below is for separately approved implementation and an explicitly selected source store. The [Phase 8 seal](../evidence/phase8/phase8-seal.json) remains the preservation anchor.

Recommended backend: [explicit async `pg` persistence](neon-postgres-architecture.md). Recommended Free operation: [externally triggered 30-minute cycles](render-free-architecture.md), subject to acceptance of their sampling and recovery limitations. Fixed chain **1672**, RPC/MCP, market/account, thresholds **1.30 / 1.10 / 1.25 / 1.00**, exact BigInt arithmetic, oracle **UNVERIFIED**, freshness **UNKNOWN**, indicative estimates and **`actionable: false`** are invariant through export, import, replay and recovery.

## 1. Migration decision and prerequisites

Use a **quiesced, one-time logical migration**, with a separately verified snapshot and an isolated PostgreSQL candidate. This is simpler to verify for the single-position workload than dual writing or change-data replication. There is an explicit monitoring gap during cutover. Preserve its timestamps and last accepted observation; do not manufacture observations to fill the gap.

Before executing any step:

1. Obtain Phase 10 code/dependency/schema permission. Obtain distinct permissions for provider accounts/resources/billing, the selected source database, migration/cutover, external scheduler and any later real notifications or production operation.
2. Identify the authoritative SQLite file and owner. Repository `data/` contains historical smoke/test stores; matching a filename is not proof that a file is the source to migrate. Record the selected source identity privately without recording credentials. Never bulk-import every discovered SQLite file.
3. Bind the reviewed application/configuration/evidence release by content hashes; a verified Git HEAD is currently absent. Verify all historical seals and the selected source's provenance. A historical mismatch stops the procedure for investigation.
4. Fix the PostgreSQL major, driver and new schema version; identify target project/database/region, owner role, import role, runtime read/write roles and evidence namespace through sanitized identifiers. Confirm expected storage, compute, egress and independent backup capacity, including the candidate and a restore test.
5. Implement and pass offline fixture/real-PostgreSQL contract tests first. Existing SQLite unit or live-chain results are not new backend acceptance. Real provider adapters and any financial execution remain disabled.
6. Have a verified immutable source backup, a compatible release and a rehearsed rollback decision available before cutover. Record the operator, window, completion criteria and maximum acceptable data/monitoring gap.

The active SQLite format is schema **5**, application ID **`0x4c575033`**. Versions 1–4 need their original validation and an explicitly approved copy-only migration to 5 before export; do not silently upgrade an original while inspecting it. Unsupported or drifted schemas stop. The PostgreSQL schema has a new independent migration history; SQLite SQL/checksums remain historical provenance.

## 2. Freeze and obtain a consistent source snapshot

For final cutover, stop/fence all SQLite writers: monitor, writable oracle audit, initialization/maintenance and notification dispatch. Disable scheduler/automatic restarts and provider sending, settle or mark uncertain active work, and verify the actual local OS ownership fence is available. A missing process name, old PID or existing lock filename alone is not sufficient ownership evidence.

Use the existing reviewed **SQLite online backup API** through an authorized tool to capture committed state, including the WAL, into a new private exclusive destination. A raw copy of only a live main database is not a consistent backup. Record database version, application ID, source/snapshot hashes, counts and application integrity validation. Existing backup creation converts the isolated output to standalone DELETE journal mode and emits the final manifest last; retain its original manifest format.

Include all transitive saved bundles and reviewed evidence references. Verify actual content hashes, paired bundle/manifest bindings, path constraints, and complete inventories. Preserve the source, all historical archives and the verified source backup as immutable inputs. Partial/new failed capture directories are retained for diagnosis and are never represented as valid backups.

An earlier rehearsal snapshot may be taken from a live source using the online API. Its parity results apply only to that snapshot. Final cutover must repeat capture/import/comparison after the final writer fence; continuing to use an older rehearsal copy would silently discard later observations/acknowledgments.

## 3. Export format and evidence manifest

Export from the verified standalone snapshot in a read-only, consistent transaction. Produce bounded, deterministic per-table streams rather than loading the database or outbox into one JavaScript object. Do not feed records through parsers that reserialize the authoritative JSON text.

The migration manifest must bind:

- Source backup manifest, standalone database bytes/SHA-256, application/schema identity and all five SQLite migration SQL/checksums.
- Exact column order, row count, primary/unique keys and legacy content hash for all **12 tables**.
- Separate rowid-to-ID maps and ordering hashes for rowid-observable tables; maximum imported sequence/event IDs.
- Original JSON text and assurance result hashes, scope/fingerprint/snapshot identities, flag/null representations and timestamp text.
- State revision/episode counters, latest and last-accepted bindings, oracle context/baseline/invalidation state, delivery status/attempt histories and provider cooldown/block records.
- Transitive evidence logical paths, sizes, hashes, bundle manifests and new physical object mappings without rewriting original references.
- Export tool/release identity, format version, source capture/cutover time, qualified runtime and sanitized error/result codes.

Current `contentHashes()` orders rows by `(delivery_id, attempt)` for attempts, `scope` for streams, `fingerprint` for fingerprints, `channel` for provider limits, `version` for migrations, and `id` otherwise. Each source row contributes `JSON.stringify(row) + "\n"` with SQLite's original column order. Preserve this algorithm in a **legacy compatibility projection**. `knownDeliveredHash()` similarly binds the original complete rows with status `DELIVERED`, ordered by ID.

Rowids are absent from those table hashes but affect query behavior. Their separate ordering manifest is mandatory; matching table hashes alone is insufficient. Archive the exact original JSON bytes including key order, whitespace, nulls, case and final-newline conventions in file artifacts. Evidence file SHA-256, assurance JSON SHA-256 and canonical risk snapshot identifiers are different identities and all remain separately checked.

## 4. Target schema and type mapping

Create an isolated target with runtime monitoring/dispatch unavailable. Use the reviewed new PostgreSQL migration runner over a direct connection. Pin expected schema/catalog constraints and migration checksums. Startup/read routes cannot create or repair schema. The import role may load the candidate; the later runtime role has no DDL/role/schema ownership permissions.

Use the complete [table/type mapping](neon-postgres-architecture.md#2-tables-identities-and-ordering). In particular:

- Financial raw values remain canonical decimal TEXT and all financial calculations remain BigInt. Import does not recompute repayment, collateral, accrual, ratios, rounding or historical risk classifications.
- Keep original JSON/time text. Typed PostgreSQL timestamps/booleans/counters have explicit reversible codecs. Refuse unsafe numeric conversion, altered precision or timestamps that cannot preserve required ordering; do not silently normalize imported text.
- Preserve original text IDs, fingerprints, every unique key and foreign key. `actionable` is constrained false; all corresponding JSON literals remain false.
- Preserve SQLite migration rows as read-only provenance; use `pg_schema_migrations` for new DDL history.
- Add stable sequence columns using original rowids, and preserve explicit event IDs. Set every sequence beyond its imported maximum after verification. SQL row order or PostgreSQL `ctid` cannot establish legacy order.
- Add database-incarnation/lease/request/evidence control records. These are new metadata; exclude them from the legacy hash projection and include them in a separate target manifest.

Do not add a naive immediate `cycles.scope → streams.scope` FK that would reject the existing cycle-start-before-first-state lifecycle. Additional constraints must be proved against the lifecycle and source data rather than inferred from names. A rejected source record is a blocker, not permission to skip it, reset it, truncate it or insert a default.

## 5. Load and publish the candidate

For a small source, prefer one explicit import transaction into an empty isolated schema; order parent records before children and validate constraints before commit. A suitable dependency order is migration provenance → streams/cycles/fingerprints → alerts → deliveries → attempts/events → provider limits/assurance/runtime/operational events, with control/evidence bindings validated before publication. Source ordering maps determine inserted sequence values regardless of load order.

If measured size requires batching, use an inaccessible staging schema plus a resumable import ledger keyed by manifest/table/chunk digest. Partial batches do not become a usable runtime database. Validate the complete set and publish only after the final committed import manifest. Never use `ON CONFLICT DO NOTHING` to hide a duplicate/conflicting source row. Restart into the same verified chunk or a new candidate only through an explicit, logged decision; failed targets consume quota and need approved cleanup.

Upload any missing immutable evidence before publishing references. Verify each object's bytes/receipt and preserve logical legacy paths in the mapping. A failed upload leaves the candidate unavailable. A failed DB commit can leave unreferenced immutable objects, which are safer than a committed dangling reference and must be tracked for controlled later retention review.

Import preserves unfinished cycles, pending/retrying/in-flight deliveries, blocked providers and old runtime JSON exactly. **Do not run recovery while comparing the import.** Recovery intentionally changes records and would obscure whether import was lossless.

## 6. Parity and acceptance checks before recovery

All gates require retained machine-readable results in a new authorized evidence destination, outside historical archives.

| Gate | Required comparison |
| --- | --- |
| M1 — structure | All 12 tables, exact counts, source keys/uniqueness/FKs, original migration rows and target checksums. No skipped or extra legacy row. |
| M2 — lossless content | Every legacy table hash matches through the explicit PostgreSQL compatibility projection, with identical JSON/time/financial strings, flags and nulls. |
| M3 — query ordering | Latest-cycle ties, assurance ties, alert history, exclusive history cursors, delivery insertion/priority ordering and sequence continuation match the source. |
| M4 — financial replay | Fixed historical risk/snapshot fixtures yield exact BigInt amounts/rounding and unchanged thresholds/provenance; false actionability is enforced in JSON and SQL. No fresh chain call substitutes for deterministic comparison. |
| M5 — state/dedup | Every revision, episode, latest/last-accepted observation, fingerprint/tombstone and existing alert identity survives. Repeated unchanged conditions do not create duplicates. |
| M6 — oracle/evidence | Original assurance text hashes, context, monotonic baseline, sticky invalidation and all object/file manifest bindings verify. Missing/corrupt/mismatched artifacts fail closed. |
| M7 — outbox | Status counts, complete attempt histories/events, terminal known-delivered hash, ambiguity, next-due times and channel blocks/cooldowns match. |
| M8 — source preservation | Historical seals, source backup/database/evidence hashes and export manifests still match. Validate the candidate without rewriting the source. |
| M9 — operational bounds | Async coherent reads, parameterized keyset plans, size/rate/time limits, pg parser behavior and least-privilege/TLS checks pass on the selected server major. |
| M10 — crash/uncertainty | Inject failures before/after observation commit, attempt claim, provider receipt and acknowledgment; reconcile by stable identity and prove no rolled-back alert is sent. |
| M11 — concurrency | Competing clients/streams/thresholds, expiry/takeover, late old-owner writes/acks and deployment overlap cannot create duplicate cycle commits or bypass global ownership. |
| M12 — recovery | Restore a PostgreSQL backup plus evidence into another isolated target; compare before recovery, rotate incarnation, recover only invalid claims, preserve known-delivered state and run with mock/console-only delivery. |

The current 709 unit tests, 2 live tests, repeated 99-test operational subset and earlier local backup results are historical inputs. Re-run relevant suites in an authorized implementation workspace with new output destinations, then add real PostgreSQL and actual-host acceptance. Legacy `npm run verify`, unit/integration reporter paths, inventory/finalization scripts and default secret scanning write historical Phase 5 outputs; redirect/version that tooling deliberately before any future execution.

## 7. Controlled recovery and final cutover

After exact import parity is signed off, test recovery on a disposable clone. An imported `RUNNING` cycle is closed through the existing interrupted-observation transition; a committed `PERSISTED` observation is finalized without being recreated. Pending/retry history and terminal delivery identities survive; in-flight attempts become ambiguous only through explicit recovery rules. Confirm the known-delivered hash is unchanged and no real provider call occurs.

Final cutover order:

1. Reverify old-writer/scheduler/notification fencing and final immutable source snapshot/import parity. Record the last accepted block/time and the start of the gap.
2. Verify PostgreSQL privileges/TLS, schema identity, release/evidence mappings, independent backup receipt and recovery drill. Confirm capacity for ongoing work, backup and rollback retention.
3. Activate a fresh database incarnation and empty/available global lease under maintenance authority; retain all source monitoring and delivery identities. Imported stale lease/PID data cannot grant runtime ownership.
4. Configure the candidate service with monitoring/trigger acceptance and real providers disabled. Build/start commands perform no migration or evidence rewrite. Verify liveness, authentication, protected persisted data and explicit as-of/stale status from the actual Render host.
5. Authorize a finite console-only trigger test using one schedule identity. Confirm one owner, atomic commit, lease release, small receipt, correct accepted/degraded status, idle suspension and wake recovery.
6. Record the first PostgreSQL mutation/observation after migration. This is the **data-divergence boundary** for rollback. The frozen source is now older than the new authoritative store.
7. After explicit acceptance of cadence, quotas, backup targets and observed bounds, authorize the external schedule. Enable real channels only under their separate permission and reconciliation policy.

No dual active SQLite/PostgreSQL writers or automatic write fallback is proposed. Two independent databases cannot coordinate by their separate lease tables. Stop/disable old processes and schedule sources, revoke obsolete runtime write access where applicable, and verify no older deployment still accepts work. A new database incarnation protects against replay of an old lease token, but cannot by itself stop a process writing to another still-accessible database.

## 8. Rollback decision table

| Point of failure | Safe response |
| --- | --- |
| Before any PostgreSQL runtime mutation | Fence/discard use of the candidate, verify unchanged frozen source and its compatible release, then explicitly resume the sole SQLite owner if its host and operation are approved. Record the monitoring gap. Retain failed import evidence. |
| After PostgreSQL begins recording cycles/attempts | Freeze the PostgreSQL writer and external sending. Prefer an application rollback that is compatible with the **same current PostgreSQL schema/data**. Preserve post-cutover records and receipts. |
| First PostgreSQL release has no prior compatible PostgreSQL binary | There is no automatic application fallback. Keep service degraded while the candidate is repaired or an explicitly reviewed reverse migration/recovery decision is made. Phase 8 binaries require SQLite and cannot open the new backend. |
| Need to return to SQLite after divergence | Requires a separately implemented/tested reverse export/import into a new SQLite file and full semantic reconciliation, or explicit approval to lose the post-cutover interval. The frozen pre-cutover SQLite file is not current truth. Never overwrite it in place. |
| PostgreSQL schema incompatible with the desired binary | Use a tested forward fix/expand-compatible binary or restore into a new target. No untested down migration or Render rollback button can establish compatibility. |
| Backup/PITR predates an acknowledged provider message | Keep channels disabled and reconcile independent receipts/known delivery evidence. A restored pending row may already have been delivered remotely. Record unresolved ambiguity; do not claim that old backup state prevents duplicates. |

Preserve the old release, SQLite backup, manifests and source evidence throughout the approved rollback window, and retain the cutover binding as long-lived provenance. Do not remove them merely because a Free storage budget is approaching its limit. Cleanup scope/time requires an explicit retention decision.

## 9. PostgreSQL backup design

The current backup format `CONSISTENT_SQLITE_BACKUP` and its tools remain specific to SQLite. Introduce a separately versioned PostgreSQL backup set containing:

- A custom-format logical dump made over a **direct/unpooled** TLS connection with a server-compatible `pg_dump` version.
- The PostgreSQL migration/catalog identity and an application-level manifest of counts, stable ordering, known deliveries, evidence references and raw payload hashes.
- Complete referenced immutable evidence, release/configuration identity and restore instructions; secrets are maintained separately through the operator's secret-recovery process.
- Backup start/snapshot/completion time, actual outbound/stored bytes, tool versions, checksums and a verified independent-object receipt. Write/publish the final valid-set manifest only after all parts verify.

For a live backup, obtain one exported REPEATABLE READ snapshot from a direct read-only coordinator transaction. Use that snapshot for `pg_dump` and the manifest/evidence-reference queries, keeping it valid until those readers finish. This prevents a manifest from describing different rows than the dump. Bound duration and monitor MVCC/autovacuum effects. An alternative implementation can briefly quiesce writers, but it must still prove one consistent backup point; ordinary independent queries around a dump do not suffice.

Exclude schema migrations/DDL throughout the live capture. Sequence state is not MVCC-snapshotted like table rows: bind the captured sequence values separately and verify on restore that each next allocation is above all restored IDs/high-water marks. A sequence ahead of the row snapshot can create harmless gaps; one behind it can cause identity reuse and must block activation.

Perform tools and encryption on an approved external operator/backup runner; Render Free shell and one-off jobs are unavailable, and dumping through its public trigger would exceed the endpoint's authority/bounds. Use a least-privilege backup role and a private destination distinct from Neon. Apply reviewed roles/grants on restore rather than exporting credentials or blindly replaying ownership/ACLs. Do not log connection URLs, process arguments containing secrets, environment values or dump contents.

Neon Free's detailed plan provides six hours of restore history capped at 1 GB of changes, one manual snapshot and no scheduled backup service. Generic backup guidance mentions longer windows, but it does not expand this entitlement. Snapshot storage has a separately published $0.09/GB-month price; confirm billing before relying on a permitted manual snapshot. Managed history and a same-provider object copy do not replace independently retained recovery material.

## 10. Recovery targets and capacity tradeoff

Inherited proposals are **one-hour RPO / 30-minute RTO**, with hourly consistent captures, daily off-host transfer and retention of at least 48 hourly and 14 daily sets if storage permits. Earlier phases have not measured or achieved those targets. Daily off-host transfer alone also does not achieve a one-hour independent-provider-loss RPO.

For the explicitly limited Free demonstration, propose **24-hour independent-backup RPO / four-hour operator RTO**, retaining 14 daily verified full sets plus the cutover set and required evidence. This change needs explicit user approval. Automatic backup execution, operator coverage, receipt monitoring and a timed recovery drill are prerequisites; a written schedule is not a completed backup.

Measure RPO from the snapshot time of the most recent independently verified complete set, not its upload-completion time. Capture interval plus dump/transfer/verification/retry margin must fit the approved age target. Exactly one capture every 24 hours can exceed a 24-hour target while its successor is still in progress; qualify a shorter interval or an explicitly approved margin and include any extra captures in the capacity model. Measure RTO through restored, reconciled service availability, including detection and operator response.

Daily full backups can themselves exceed Free. At 80 MB of Neon outbound bytes per export, 31 exports consume 2.48 GB; at 300 MB they consume 9.3 GB. Hourly 80-MB exports consume 59.52 GB/month. A small compressed file on disk does not prove low network egress. Dump queries/verification also consume compute, and an active backup can extend the five-minute idle tail. R2's included storage/operations/egress do not waive Neon's extraction costs. If the approved recovery target cannot fit the measured workload, obtain a budget/hosting decision before enabling operation.

Retain warning/admission headroom for storage failures and recovery. PostgreSQL deletes/updates can need additional space, so reaching Neon's cap is not a reliable point at which to start pruning. Branch clones, restore validation and retained snapshots consume quotas too; a clone on the same project/provider is not an independent backup.

## 11. Disaster-recovery procedure

1. Fence scheduler sources, old writers and all external channels; record the incident and outstanding unknown outcomes outside the failed DB if necessary.
2. Choose the most recent **verified complete** backup/PITR point under the approved RPO. Verify hashes, manifest signature/trusted binding, encryption-key access and every evidence object. Preserve incident stores for diagnosis.
3. Restore to an isolated fresh database/project with the pinned server-compatible tools and reviewed grants. Enforce default-disabled monitoring/dispatch. Do not point the live service at a half-restored target.
4. Compare the dump/restored application manifest before performing recovery. Verify schema, counts, JSON/financial/time bytes, ordering, state/dedup, assurance/evidence, attempts/cooldowns and known-delivered identities.
5. Rotate database incarnation, invalidate restored ownership/claims through approved recovery and ensure old deployments cannot write to the restored destination. Preserve records of the fencing transition.
6. Reconcile messages and observations after the backup point using independent receipts where available. Acknowledge unrecoverable gaps/ambiguity; do not invent an acknowledgment or erase a pending item to quiet the queue.
7. Run a bounded console/mock-only cycle and authenticated read, then reauthorize scheduler/channels only after acceptance. Record actual backup age, restored time, recovery duration and any lost observation/delivery interval.
8. Test loss of the original host/provider path using the independent copy. A successful same-process restore from a file still on the original host does not establish off-host recovery or the stated RPO/RTO.

## 12. Failure handling and stopping criteria

Any historical hash mismatch, source/target count divergence, changed JSON/identity, missing evidence, uncertain duplicate acknowledgment, unqualified ownership race, exceeded quota/deadline or lack of a usable independent backup blocks cutover. Preserve failed artifacts and coded results; corrections require a new labeled validation run. No reset/reseed/skip-row convenience path is part of migration or recovery.

The exact implementation, import/restore tools and actual-host evidence do not yet exist for PostgreSQL. Phase 9 supplies the design and acceptance criteria. Work stops at the [Phase 9 review boundary](phase9-report.md#12-final-preservation-check-and-handoff), before any of these procedures are executed.

References consulted **2026-11-02**: [Neon plans/limits](https://neon.com/docs/introduction/plans), [direct pg_dump/restore guidance](https://neon.com/docs/manage/backup-pg-dump), [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [node-postgres transactions](https://node-postgres.com/features/transactions), [data type parsing](https://node-postgres.com/features/types), [R2 retention locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/). Current source contracts: [database operations](database-operations.md), [rollback/recovery](rollback-and-recovery.md), [alert semantics](alerting.md), [Phase 8 operations](render-runtime-operations.md).
