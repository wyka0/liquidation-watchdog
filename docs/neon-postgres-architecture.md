# Neon PostgreSQL persistence architecture

**Phase 9 design recommendation — implementation and deployment require separate approval.** Recommend the small `pg` (node-postgres) driver, explicit SQL and a shared asynchronous persistence interface. The target is one bounded writer at a time, with PostgreSQL-backed ownership and a protected, persisted-data dashboard. The scheduling recommendation is [option B, every 30 minutes](render-free-architecture.md).

Chain **1672**, the fixed Pharos RPC/MCP and Morpho position, thresholds **1.30 / 1.10 / 1.25 / 1.00**, exact BigInt calculations, oracle **UNVERIFIED**, freshness **UNKNOWN**, indicative estimates and **`actionable: false`** remain binding. A remote database does not qualify the oracle or establish financial actionability. This document describes a future backend; the sealed Phase 8 backend is SQLite.

## 1. Current persistence inventory

Inspection covered source, configuration, entrypoints, scripts, tests, generated-output dependencies and the historical operational contracts. No application database was opened. Schema and behavior below are established from implementation and previously sealed evidence, not new database queries.

| Current location | SQLite or filesystem dependency / migration consequence |
| --- | --- |
| `src/storage/store.ts` | Synchronous `DatabaseSync`; constructor validation/migration; every state, cycle, assurance, alert, outbox, runtime, retention, statistics and backup operation. Owns a separate `<database>-monitor-lock` SQLite transaction. All callers need an awaited interface and explicit error propagation. |
| `src/storage/migrations.ts` | Five checksummed migrations, application ID `0x4c575033`, schema version 5, 12 tables and seven explicit indexes. A separate PostgreSQL migration lineage is required. |
| `src/storage/validation.ts` | `sqlite_schema`/`sqlite_master`, a reference in-memory SQLite database, exact SQL layout comparison, application/user versions, migration checksums, quick/full integrity and foreign-key checks. PostgreSQL needs catalog/constraint/version validation plus application-record validation. |
| `src/storage/paths.ts` | Local regular `.sqlite`/`.db` paths, sidecar/link checks, directory creation and exclusion of evidence paths. A PostgreSQL URL is deliberately rejected by this contract; adding an environment variable alone cannot switch backends. |
| `src/storage/backup.ts` | SQLite online backup, private exclusive directories/files, standalone DELETE-journal snapshot, deterministic table hashes, exact evidence inventory and isolated local restore. These commands cannot back up PostgreSQL. |
| `src/monitoring/service.ts` | Synchronous ownership, restart recovery, state reads and writes; one process-local overlap guard; loop sleeps and outbox wakeups; resource checks before work. Must await the store, carry ownership through every mutation and expose a truly bounded cycle. |
| `src/monitoring/model.ts`, `transitions.ts`, `observation.ts` | Scope/fingerprint identities, latest versus last accepted state, episode/revision counters, validated serialized observations and exact amount strings. These are preservation contracts, not replacement calculation logic. |
| `src/notifications/dispatcher.ts` | Synchronous due query, claim, attempt completion, exhaustion and provider cooldowns. Network sends already occur outside the observation transaction. Remote claims/acknowledgments need fencing and uncertain-commit handling. |
| `src/runtime/service.ts`, `workspace.ts`, `src/service.ts` | Disk-backed bootstrap at `/var/data/watchdog`, `runtime-owner.sqlite`, write/sync and mount probes, evidence seeding/verification, CWD changes, separate reader/writer stores and an explicit disk-oriented executable contract. All are integration dependencies. |
| `src/runtime/read-model.ts`, `http.ts`, `dashboard.ts`, `auth.ts` | Synchronous coherent read snapshots, SQLite rowid cursors, one-second cache, bounded projections, GET/HEAD routes and authentication. Async reads must preserve coherence, limits and cancellation. HTTP changes are detailed in the Render design. |
| `src/operations/resources.ts`, `diagnostics.ts` | Local `statfs`, DB/WAL/file sizes, evidence-directory walks, SQLite statistics and lock probes. Replace remote-storage health with quota, pool, transaction, backlog and last-success metrics; retain local RSS/temporary-file limits. |
| `src/config/monitoring.ts`, `production.ts`, `risk.ts`, `evidence.ts` | JSON configuration files, local path validators, verified Node/SQLite pair, 4 GiB DB/256 MiB WAL/512 MiB free-space defaults, relative evidence root `evidence/phase5`. A versioned backend-specific configuration is required. |
| `src/cli/monitor.ts`, `oracle.ts`, `operations.ts`; their option parsers and `src/cli/run.ts` | Monitor/status/history, writable oracle audit, initialization, diagnostics, backup and restore open or consume the store. Inspect/risk/oracle evidence options write files. Operator paths must obey the same global fence; HTTP cannot invoke arbitrary CLI operations. |
| `src/domain/evidence.ts`, `src/risk/evidence.ts`, `src/oracle-assurance/evidence.ts`, `reviewed.ts` | Snapshot/risk files, immutable oracle bundles, exclusive manifests/checksums and historical relative references. Persisted assurance hashes bind original JSON and evidence bytes. Release files and remote object mappings replace disk durability, not those identities. |
| `config/render.json`, `render.yaml`, `package.json`, lockfile and `dist/` | The configuration and draft Blueprint are disk-oriented; `npm start` is the CLI, not the HTTP service. Package engines allow more Node versions than the verified production pin. Generated JS/declarations and release-input hashes follow any future interface change. |

### SQLite feature conversion checklist

| Existing mechanism | PostgreSQL equivalent / qualification |
| --- | --- |
| `STRICT`, integer flags, `json_valid`, foreign keys | Native checked types, reversible booleans, JSON-validity plus application-schema checks, equivalent PK/unique/FK/cascade constraints. Preserve defaults/nulls and source-valid lifecycle states. |
| `?` bindings and synchronous `.get/.all/.iterate/.run` / `.changes` | Parameterized `$1` values, awaited queries, explicit first-row handling, bounded streaming/keyset batches, checked `rowCount`/`RETURNING`. SQL NULL/no-row/zero-change behavior must stay distinct. |
| `json_extract`, BLOB byte length, scalar `MAX`, `NOT INDEXED` | Validated extracted projections or explicit JSON casts; `octet_length` before transporting oversized payloads; reviewed `GREATEST`/`COALESCE` semantics; measured PostgreSQL plans instead of SQLite hints. Do not assume NULL semantics or query order transfer automatically. |
| `application_id`, `user_version`, checksummed SQL and exact `sqlite_schema` layout | Separate backend identity/version/history and verified PostgreSQL columns, constraints, indexes, defaults and permissions. Preserve original SQLite SQL/checksums as provenance. |
| `quick_check`, `integrity_check`, `foreign_key_check` | Managed PostgreSQL integrity/durability contract, enforced constraints, bounded application-record/hash audits and verified dump/restore. There is no single equivalent PRAGMA that proves all of these. |
| WAL, `synchronous=FULL`, checkpoint/journal-size settings | Logged PostgreSQL tables and `synchronous_commit=on`, with managed WAL/durability settings and acknowledged-commit behavior verified for the chosen service. Never use unlogged monitoring/outbox tables or relax commit durability for speed. Managed replication/PITR does not prove independent recovery or power-loss acceptance. |
| `trusted_schema=OFF`, `query_only=ON`, busy timeout | Restricted schema/search-path/DDL privileges, read-only role/transactions, explicit lock/statement/acquisition deadlines. Runtime cannot grant itself maintenance access. |
| `max_page_count`, page/free-list/cache PRAGMAs, `mmap_size=0`, local WAL/free-space probes | Remote database/project quota and growth metrics, small pools/bounded reads, RSS controls and maintenance reserve. There is no application-controlled local PostgreSQL WAL file to prune. |
| Local exclusive SQLite transaction/file and online backup API | Durable globally fenced lease; direct PostgreSQL snapshot/dump and independent evidence-bound backup procedure. |

### Script and test consumers

Direct store/backup consumers are `scripts/monitoring-smoke.ts`, `oracle-smoke.ts`, `phase5-stability.ts` and `phase8-reliability.ts`. `scripts/operations-smoke.ts` invokes built CLI operations and consumes the monitoring smoke database. `scripts/verify.ts`, `release-manifest.ts` and `release-inputs.ts` orchestrate/bind these results and import persistence-related diagnostics or configuration. Legacy verification, inventory, link, secret-scan and capture commands can write `evidence/phase5`, `docs/phase5-files.md`, other historical evidence, fixtures or `dist/`. They are unsuitable for execution in the preserved main tree during this audit.

Direct or type-level persistence test consumers are `test/monitoring-storage.test.ts`, `monitoring-service.test.ts`, `notifications.test.ts`, `operations-storage.test.ts`, `operations-config.test.ts`, `operations-lifecycle.test.ts`, `oracle-continuity.test.ts`, `oracle-cli.test.ts`, `runtime-storage.test.ts`, `runtime-read-model.test.ts`, `runtime-process.test.ts`, `runtime-lifecycle.test.ts`, `test/fixtures/monitoring.ts`, `test/fixtures/runtime.ts`, `test/helpers/phase5-worker.ts` and `test/helpers/phase8-import.ts`. `test/helpers/phase8-runtime.ts` drives the runtime indirectly. CLI tests, `runtime-http.test.ts`, configuration/safety tests, evidence tests and the smoke/release wrappers also depend on the store's observable behavior. Retain the pure financial/assurance/transport suites; add a real PostgreSQL contract suite rather than relabeling SQLite fixtures as PostgreSQL coverage. The complete suite inventory remains under `test/` and in the Phase 8 seal.

## 2. Tables, identities and ordering

Retain the logical records below. Proposed additional columns/tables are new migration work, not changes to the archived SQLite DDL.

| SQLite table | Current role and constraints | PostgreSQL mapping and required preservation |
| --- | --- | --- |
| `schema_migrations` | Integer version PK, SQL checksum; five original entries | Preserve as read-only SQLite provenance. Use a separate `pg_schema_migrations` table for new ordered SQL checksums and schema versions. |
| `streams` | Scope PK, revision, `state_json` | Scope text PK; checked nonnegative counter; authoritative JSON text. Preserve revision, all episode counters, latest, last accepted and assurance baseline. |
| `cycles` | Text ID PK; scope/time/status; accepted flag; observation JSON; block/hash/snapshot; mathematical/data/oracle quality; ratio/LTV; `actionable=0`; duration | Keep IDs as text, status and binding checks, original JSON and scalar values. Add explicit stable sequence, ownership provenance and typed time projections. Boolean actionability must be constrained false. Accepted is nullable boolean with a reversible 0/1 codec. |
| `fingerprints` | Fingerprint PK, creation time | Unique digest and original creation time. Tombstones survive alert pruning and migration indefinitely. |
| `alerts` | ID PK; unique fingerprint FK; cycle FK; scope/time/severity/category/JSON | Preserve both identities and original payload bytes. Keep FK and uniqueness semantics. Add stable sequence for history/ties. |
| `deliveries` | ID PK; alert FK with delete cascade; unique `(alert_id, channel)`; status/attempt count/due/error/ambiguity | Retain deterministic IDs, all statuses, attempt counts, due times and monotonic ambiguity. Add owner/incarnation/fence, attempt claim deadline and stable sequence. |
| `delivery_attempts` | Composite PK `(delivery_id, attempt)`; cascading FK; start/end/outcome/error/ambiguity | Same logical key and attempt continuity/completion invariants. Add claim provenance without changing historical attempt records. |
| `delivery_events` | Integer PK; cascading delivery FK; time/status | Explicit PostgreSQL bigint identity; preserve imported IDs/order and advance the sequence above the imported maximum. |
| `provider_limits` | Channel PK, `next_at`, blocked flag introduced by migration 3 | Preserve complete channel cooldown and permanent block state. Boolean codec must round-trip to original integers for legacy hashing. |
| `oracle_assurance` | ID PK; evaluated time, continuity context, `result_json` and SHA-256; nullable paired bundle path/manifest hash | Original JSON text/hash and logical bundle path remain authoritative. Preserve latest-per-context tie order, monotonic baseline, sticky invalidation and evidence bindings. |
| `worker_runtime` | Singleton ID 1 and runtime JSON | Preserve imported JSON; new runtime updates use a versioned operational envelope with instance/run/lease identity. Historical PID is diagnostic only. |
| `operational_events` | Integer PK; time and allowlisted code; last 100 retained | Preserve IDs/order; explicit identity sequence. Continue bounded operational diagnostics without storing exception text. |

The seven current indexes cover cycle scope/time, alert time, delivery due status/time, assurance time, delivery alert ID, assurance context/time and accepted cycle scope/time. PostgreSQL additionally needs `(scope, stable_seq DESC)` for history, `(context, evaluated_at, stable_seq)` for assurance ties, and a bounded due-work index. Validate plans on representative data; avoid speculative indexes that consume the 1 GB allowance.

SQLite `rowid` is observable in history pagination, latest-record ties, delivery insertion order and delivery priority. PostgreSQL `ctid`, unordered results or sorting solely by timestamp are not replacements. Import the original rowid into each applicable `stable_seq BIGINT UNIQUE` and start subsequent values above its maximum. Preserve explicit integer IDs for the two event tables. For source-valid unusual/negative/unsafe rowids, stop and resolve the mapping instead of silently renumbering. Sequence gaps after rollback are harmless; sequence reuse is not. Keyset cursors travel as decimal strings, are validated/range-checked with BigInt and are bound as parameters. Cross-backend numeric cursor conversion must not pass through an unsafe JavaScript Number. Use deterministic `COLLATE "C"` ordering for legacy text keys as well as times so locale-sensitive PostgreSQL ordering cannot change SQLite BINARY-ordered hashes or ties.

Additional control records are deliberately small:

- `database_identity`: backend/schema identity, immutable import binding, and a database-incarnation identifier. Restore/cutover control rotates the incarnation before enabling a new writer.
- `worker_lease`: one global logical owner, incarnation, monotonically increasing fence and database-time expiry. It coordinates monitoring, outbox, writable oracle audit and maintenance across all streams.
- `cycle_requests`: unique configured schedule/UTC slot, deterministic request/cycle identity, owner fence and durable completion receipt. Request replay cannot create a second observation.
- `evidence_bindings`: logical reference, content hash, size, manifest binding and configured private-object key when a referenced artifact is not in the immutable release. It contains no credentials or signed download URLs.

## 3. Lossless type and serialization contract

| Value | Recommended representation / codec |
| --- | --- |
| Base-unit balances, debt, collateral, repayment, additional collateral, WAD ratios/LTV/scale, block number/timestamp | Canonical unsigned decimal **TEXT**, matching the current `0` or 1–78-digit format. Apply the existing domain-specific BigInt range checks; a derived ratio need not share an input uint256's range. These fields need no SQL financial arithmetic in the current workload. |
| Complete observation/state/alert/assurance/runtime payloads | **TEXT** with a JSON-validity/object check and size bound, followed by the existing strict application validation. Keep the original UTF-8 serialization; parsing for validation must not replace stored bytes. |
| Hashes, addresses, market/snapshot/scope IDs, alert/delivery/cycle IDs | Checked TEXT. Existing IDs include hashes and underscores; a PostgreSQL UUID column would reject valid IDs. Preserve case and prefixes where identities already bind them. |
| Existing UTC timestamps | Preserve original `*_at` TEXT exactly; use C/BINARY-equivalent collation for legacy ordering. Add `*_at_ts TIMESTAMPTZ(6)` projections for temporal queries only after lossless validation. Imported text beyond supported precision or with non-equivalent ordering is a migration blocker, not permission to round it. |
| New lease deadlines, scheduler slots and server receipt times | `TIMESTAMPTZ(6)`, UTC presentation, database `clock_timestamp()` for current ownership decisions. Keep scheduler time, retrieval/block time and completion time distinct. |
| Revisions, episodes, attempts, durations and sequence IDs | Checked INTEGER/BIGINT according to range. Preserve legacy safe-number counters in JSON. Parse pg int8 as string/BigInt; convert to Number only after explicit safe-range checks for non-financial APIs. |
| Accepted/blocked/ambiguous/actionable flags | Nullable or non-null BOOLEAN as appropriate, with a fixed legacy 0/1 conversion. `actionable` has a database false-only constraint and application literal-false validation. |

`NUMERIC(78,0)` can represent the current unsigned magnitude range, but its scale coercion can round a fractional input before a later check sees it. It is unnecessary for this workload's financial columns. A later numeric projection would require canonical-string validation before conversion and explicit rejection tests. PostgreSQL FLOAT/REAL/DOUBLE, JavaScript `parseFloat`, ORM decimal-to-number coercion and arithmetic on display strings are inappropriate.

The `pg` JSON/JSONB defaults parse objects, and default timestamp parsing produces JavaScript `Date` values with millisecond precision. Use TEXT results for the authoritative payloads and explicit string parsers/casts for timestamp/int8/numeric metadata. Do not install a global numeric-to-Number parser. JSONB may be used to validate or derive a disposable projection, but cannot replace the bytes used by `result_sha256`, assurance comparisons, fingerprint construction or migration evidence.

Legacy table hashes use `JSON.stringify(row) + "\n"` in a fixed table-specific order and the original SQLite column insertion order. They are not PostgreSQL physical hashes. A PostgreSQL compatibility exporter must select original fields explicitly, apply the reversible flag/counter codecs, exclude added columns and use original timestamp/payload text. [The migration plan](sqlite-postgres-migration-plan.md) defines two separately versioned manifests instead of pretending a `pg_dump` has SQLite's file identity.

## 4. Driver and application boundaries

**Select `pg`, with a pinned version and matching types reviewed during Phase 10. No ORM is recommended.** Existing persistence is explicit SQL over a small fixed schema; its transaction, serialization, ordering and fencing requirements are easier to inspect directly. An ORM would add migration/type conventions without removing any of those obligations. Standard TCP/TLS `pg` supports checked-out-client transactions, direct maintenance connections and the Neon transaction pooler. This Node service does not need an HTTP-only database driver or a separate data API.

Introduce a persistence interface whose operations return promises. Keep the SQLite adapter available for preserved fixtures, export and rollback tooling until a separately approved retirement. Avoid an async wrapper that still performs hidden synchronous database work. Update every listed runtime/CLI/dispatcher consumer to await writes before acknowledging, updating in-memory state, sending or closing resources. Expose a narrow async read interface to the HTTP layer; no arbitrary SQL, transaction callback or writer object reaches a route handler.

Keep the verified Node **v24.14.1 / SQLite 3.51.2** baseline identifiable. Pin a Neon-supported GA PostgreSQL major and driver version at implementation qualification; prefer PostgreSQL 18 if offered in the selected region, but do not silently select a moving `latest`. Server/driver/runtime compatibility is an acceptance result still to be obtained. PostgreSQL identity replaces the SQLite runtime gate only for the new backend; it does not retroactively verify a different runtime or remove SQLite import verification.

## 5. Transaction and ownership protocol

### Current boundaries to preserve

`commitObservation` atomically updates the running cycle, advances the expected stream revision, saves assurance, creates fingerprint/alert records and enqueues all configured channels. Exceeding the outbox budget rolls back the whole transaction. Cycle start/finish, standalone assurance save, attempt claim/acknowledgment, recovery, pruning and runtime writes have separate transactions. Startup has two additional local fences: the monitor lock and the runtime workspace lock. A per-stream PostgreSQL mutex would lose their database-wide exclusion: outbox work is shared, and oracle continuity can span threshold streams.

### Proposed global fenced lease

1. Authenticate/validate a scheduler request before any database or chain work. In one short transaction lock the singleton lease row. Re-read the actual database clock **after** acquiring the row lock. A valid other owner causes a bounded busy response.
2. Resolve an existing request identity before considering new work. For a new slot and an available/expired lease, revalidate slot freshness and the admission high-water mark against database time, increment the bigint fence, bind the database incarnation and fresh owner ID, and set expiry **360 seconds** ahead. Atomically advance the high-water mark and admit the unique schedule slot and `RUNNING` cycle. Repeated requests resolve the existing identity instead of allocating another cycle; a receipt lookup grants no execution ownership.
3. Release the SQL transaction before network reads. The server's complete database-active work window is at most **300 seconds**, including the existing **240-second whole-cycle** budget and bounded surrounding coordination. Initial design needs no idle heartbeat/renewal loop. If this budget is inadequate on Free, fail qualification instead of extending a lease indefinitely.
4. Every mutating transaction, including recovery, pruning, runtime and delivery updates, first locks the singleton row and validates incarnation/owner/fence/expiry. It holds that row lock until commit/rollback. Stream revision is checked under lock and updated with compare-and-set semantics. A newer fence makes all old-owner writes fail. Only trusted maintenance tooling can change identity/migrations.
5. Admission/lease release and terminal request receipts use the same identity. Release is conditional on the still-current owner/fence; an old owner cannot clear a successor's lease. Process death needs no file cleanup. Recovery waits for expiry or a verified release.

Use **READ COMMITTED plus those explicit locks and revision checks** for writes. The global row serializes cooperative writers, including the pending-delivery count/admission predicate. Lock ordering is lease → stream/continuity state → provider → delivery; consistently order multiple keys. Read a current predecessor under this discipline before committing a transition. A proposed change allowing independent writers would require a new isolation/partitioning proof.

The 300/360-second job/lease budgets apply to scheduled runtime work. Offline schema creation, import and restore run with runtime writers disabled and fenced under explicit maintenance authority; their duration/lock budgets need separate qualification. A read-only live backup needs a consistent snapshot and exclusion of concurrent DDL, not ownership of the runtime write lease for the whole dump. Standalone writable oracle audits and ordinary online maintenance must use the same runtime ownership protocol or a separately approved, writer-disabled maintenance window.

Use a short **REPEATABLE READ, READ ONLY** transaction for multi-query dashboard snapshots so state, cycle, alerts and deliveries come from one MVCC snapshot. READ COMMITTED alone gives each statement a new snapshot. Never hold either transaction type across RPC/MCP, object storage, notification HTTP, a scheduler wait or dashboard rendering.

The lease is a coordination protocol, not authority to transact financially. It fences database effects after takeover. It cannot revoke an HTTP request already received by a notification provider. Short transactions and finite provider deadlines reduce this window; they do not establish exactly-once external delivery.

### Unknown commit outcomes

Classify connection loss during COMMIT as **outcome unknown**, not automatically rolled back. Reconnect within a bounded budget and query by the same request/cycle/attempt identity. A matching committed payload/receipt is success; an incompatible payload is corruption/conflict; an unavailable answer remains unknown and stops new sends. A proven aborted transaction may retry with the same identities and expected revision. Retry serialization failures/deadlocks at most twice with jitter within the existing deadline. Do not regenerate IDs, refetch a different snapshot into the same committed cycle, or blindly rerun provider sends.

## 6. Outbox, recovery and retention

Keep one dispatcher under the global lease. In a short transaction select the highest-priority due delivery and lock it; recheck current due time, terminal status, attempt budget, enabled channel and provider cooldown/block. Increment the attempt and insert its history/event atomically with an owner/fence and claim deadline. A conditional update plus `RETURNING` proves that one claim won. `SKIP LOCKED` is available for a future partitioned dispatcher but is not a reason to introduce multiple dispatchers now.

Send outside SQL, with the existing **15-second** provider limit and enough remaining lease/whole-cycle time to record the result. Acknowledge only the claimed attempt with matching incarnation/owner/fence. An expired or superseded acknowledgment cannot mark a newer attempt delivered. Preserve maximum Retry-After, retry exhaustion, channel-wide cooldowns, blocked channels, severity ordering and sticky ambiguity. A terminal known-delivered record is never selected for retry.

On takeover, recover only work whose owner/claim is no longer valid. An uncommitted `RUNNING` cycle becomes an interrupted diagnostic through the normal transition path; a `PERSISTED` cycle closes without recalculating or re-enqueuing its observation. Recover in bounded batches within the job deadline. Existing imported in-flight attempts are evaluated only after import parity is proven and exclusive cutover is authorized. Ambiguous provider acceptance remains at-least-once: a retry can duplicate a remote message.

Retain the existing 30-day completed-cycle and 180-day terminal-alert policies as semantic defaults. Pending/retrying/in-flight deliveries, referenced cycles, latest/last-accepted state, latest assurance per context, bundle-bound assurance and all fingerprint tombstones remain protected. The old implementation retains the latest 100 operational events. These policies **do not establish bounded storage**: linked old cycles, tombstones, evidence and persistent backlog can grow indefinitely. Use bounded indexed maintenance and autovacuum monitoring. Do not purge tombstones, reset streams, shorten history or erase delivery ambiguity to fit a quota.

Slot receipts must outlive the entire admission/retry window and survive crashes. A receipt tied to a terminal cycle may cascade only when that cycle is legitimately pruned under the existing retention policy; it must not accidentally prevent all cycle pruning. Old slots remain rejected by the age/monotonic slot-admission policy after receipt pruning. Persist the admission high-water mark, retain required operational receipts in backup/audit storage, and test clock rollback, restore and replay. Financial fingerprint tombstones have a different lifetime and remain indefinite.

## 7. Pooling, TLS, deadlines and reconnects

| Proposed starting setting | Rationale / acceptance condition |
| --- | --- |
| Runtime connection address | Neon **pooled** endpoint using transaction-mode PgBouncer; certificate/hostname-verified TLS. Explicitly configured host/database/role; no request-supplied connection address. |
| Application pools | One writer pool `max=1`, one read-only-role pool `max=1`; `min=0`, idle release approximately 5 seconds, bounded lifetime, no database keepalive queries. Two app connections per instance, four during two-instance deploy overlap; count direct maintenance connections separately. |
| Connection/read bounds | Writer connect/checkout at most 10 seconds within the job deadline. Read API total deadline about 3 seconds, bounded checkout and statement work; a slow cold read returns unavailable rather than holding HTTP indefinitely. Destroy/release clients that finish after cancellation. |
| Transaction bounds | Writer lock timeout about 1 second, statement timeout about 5 seconds, whole transaction about 10 seconds; read statements about 1 second. Set transaction-local server timeouts and idle-in-transaction timeout. Test genuine server cancellation; a JavaScript race alone is not cancellation. |
| Queue bounds | One active writer; only a small bounded read queue; excess admission receives busy/unavailable. Inspect `waitingCount`, pool usage and query latency. Default pg pool size 10 and unlimited waiting are inappropriate here. |
| Maintenance | Direct/unpooled connection, isolated operator/backup roles and separately bounded job timeouts. Migrations and `pg_dump`/`pg_restore` are off the Render request path. |

Every transaction uses **the same checked-out pg client** for BEGIN, queries, COMMIT/ROLLBACK and release. `pool.query` across an interactive transaction can use different connections and is incorrect. On pool/client error, sanitize the failure, discard the broken connection, reconcile uncertain work and reconnect with bounded jitter. No fallback database or empty replacement is created.

PgBouncer transaction mode does not promise session advisory-lock ownership, persistent `SET`, LISTEN/NOTIFY or session temporary state. Use explicit transactions and `SET LOCAL`; use unnamed queries until named-prepared-statement behavior is qualified. The lease lives in tables rather than a pooled session. A small app pool is still required even though Neon advertises up to **10,000 client connections**; this is not simultaneous query capacity. At **0.25 CU**, the documented PostgreSQL connection allowance is **104**, with **seven reserved**.

Neon requires TLS. Also verify the server certificate and hostname: encryption without authentication is insufficient. Use a reviewed pg SSL configuration; its connection-string SSL parameters can replace an explicit `ssl` object. Test the actual merged configuration with wrong-host/untrusted-certificate failures. No `rejectUnauthorized: false`, connection-URL logging or credential-bearing exception output belongs in the implementation. Idle network sockets, even if harmless, must not be used as a supposed availability guarantee.

## 8. Evidence and ephemeral files

The immutable release includes the small set of already reviewed historical artifacts with their exact relative identities and hashes. Runtime may cache verified copies locally; loss of that cache on restart cannot lose the only copy. Migration carries every persisted bundle/reference, not just the currently imported release's seed list.

Use private, content-addressed object storage for evidence not shipped in the release and for independent database backups. The recommended candidate is R2 Standard, subject to account/billing/retention approval. Retain the original `evidence/phase1`…`phase5` strings in imported JSON and `bundle_path`; resolve them through a trusted logical-reference/hash mapping. Do not edit hash-sensitive JSON to substitute a URL. New evidence formats require an explicit version and validator update because current bundle/path validators accept only particular historical phase paths.

Publish an evidence object with exclusive/conditional creation, compute SHA-256 over the bytes and verify durable receipt/readback before a database transaction references it. Upload-before-commit can leave an unreferenced object; commit-before-upload can leave broken evidence and is unacceptable. Record size, hash and manifest binding; ETag is not a general SHA-256 substitute. Expired caches and object-service outages produce explicit unavailable evidence status; hash mismatch is a fail-closed incident, never a reseed/overwrite instruction.

The regular monitoring cycle currently persists assurance in the database without saving a new oracle bundle every time. Keep that efficient behavior; arbitrary filesystem evidence captures remain explicit operator work. Backup correctness still includes the complete transitive evidence set. Retention locks and separately held release/manifest hashes protect provenance, with their limitations in the [security review](phase9-security-review.md).

## 9. Resource and failure policy

The [Render capacity model](render-free-architecture.md) is the operational budget. The old 4 GiB SQLite limit exceeds Neon's 1 GB Free storage allowance. Proposed initial remote-storage signals are warning at **60%** used, escalation at **70%**, and stop admitting new cycles at **80%** or earlier if the next bounded write cannot fit. These are conservative application thresholds, not an allocation guarantee. Include indexes, TOAST, dead tuples, project branches and recovery space; use provider usage as well as `pg_database_size`/relation statistics. Quota telemetry can lag.

| Failure | Required behavior |
| --- | --- |
| Database sleeping / stale pooled socket | Bounded connect retry; no empty-state substitution. Expected idle suspension is not corruption. |
| Compute/egress quota or storage exhausted | Stop useful-work claims, new sends and unsafe write retries; retain prior accepted data with its old time. A failure event may itself be unwritable, so preserve external scheduler receipts/metrics. Restore capacity deliberately. |
| Lease unavailable / newer fence | Return busy or stop the old job; no new RPC scan, state update or delivery claim by the refused owner. |
| Schema drift, invalid JSON/binding/hash or identity mismatch | Reject startup/read/commit as appropriate, preserve the database and inspect. Full historical validation belongs in bounded maintenance, not every HTTP request. |
| Read deadline or oversized persisted page | Return a bounded unavailable/limit response; do not return a partial, internally inconsistent success. |
| Provider timeout/ambiguous acknowledgment | Persist ambiguity if possible and apply durable retry policy; never assert exactly-once delivery. |
| Process death/restore | Lease/claim recovery plus database-incarnation fencing, evidence verification and channel-disabled reconciliation. |

Metrics should include admitted/completed/accepted slots, last accepted as-of time, scheduler lag, owner/fence age, cycle duration, pool waits, query/transaction duration, unknown commits, reconnects, backlog age/count, ambiguous attempts, DB bytes/growth, compute/egress forecasts, object receipt and last verified backup/restore. Query on work or explicit operator inspection; background database pings would defeat scale-to-zero.

## 10. Sources and qualification boundary

Official documentation consulted **2026-11-02**: [Neon plans](https://neon.com/docs/introduction/plans), [pooling](https://neon.com/docs/connect/connection-pooling), [scale to zero](https://neon.com/docs/introduction/scale-to-zero), [TLS](https://neon.com/docs/connect/connect-securely), [pg_dump backups](https://neon.com/docs/manage/backup-pg-dump), [pg transactions](https://node-postgres.com/features/transactions), [pg types](https://node-postgres.com/features/types), [pg pools](https://node-postgres.com/apis/pool), [pg SSL](https://node-postgres.com/features/ssl), and [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

Published capabilities inform this design. They are not a Neon connection test, a selected-region qualification, a concurrency proof, a backup receipt or achieved availability. [Phase 10 acceptance gates](phase9-report.md#10-implementation-sequence-and-acceptance-gates) must establish those facts after approval.
