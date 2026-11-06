# Phase 9 security and durability review

**Audit/design complete; PostgreSQL, scheduler, deployment and production security acceptance remain pending.** The recommended [Neon backend](neon-postgres-architecture.md) and [Render Free topology](render-free-architecture.md) introduce network credentials, a job-trigger capability and remote recovery dependencies. Their controls must be implemented and verified before activation.

The fixed Pharos **chain 1672**, RPC/MCP, Morpho market/account and thresholds **1.30 / 1.10 / 1.25 / 1.00** retain the existing financial boundary: BigInt calculations only, oracle **UNVERIFIED**, freshness **UNKNOWN**, recovery estimates **indicative**, and **`actionable: false`**. Hosting/database availability never grants transaction authority.

## 1. Assets and trust boundaries

Protect accepted observations and provenance, exact risk/assurance bytes, state revisions/episode counters, permanent fingerprints, alert/outbox/attempt history, provider cooldowns, ownership and schedule receipts, evidence manifests and independent backups. Public chain data is not a reason to publish operational history, internal paths, process IDs, roles or destination metadata.

Trust boundaries are: browser → Render read API; external scheduler → Render trigger; Render → Neon pooled endpoint; operator → Neon direct maintenance endpoint; application/operator → private object store; and read-only RPC/MCP responses → strict domain validation. The scheduler holds only the trigger credential. Browsers hold only their read credential. Operator migration/backup credentials are absent from the runtime image. The shared Render process still contains writer and reader capabilities; two SQL roles reduce accidental privilege use, not the consequences of full process compromise.

## 2. Principal findings and required controls

Severity describes the consequence **if the proposed integration omits the control**. This is not a claim that an unimplemented PostgreSQL feature is already vulnerable.

| Finding | Priority | Required control / acceptance evidence |
| --- | --- | --- |
| Ephemeral SQLite/evidence would disappear on Free suspension | Critical durability blocker | Remote durable state, immutable release/object evidence and independent verified backups. Destruction of local cache must preserve all authoritative records. |
| Process-local/file locking does not fence remote overlapping writers | High | Database-wide lease with incarnation/epoch; every mutation guarded on the same client/transaction. Test competing streams, maintenance, restart, deploy overlap and late acknowledgments. |
| Lost COMMIT response can cause duplicated state or sends | High | Stable request/cycle/attempt IDs, unique constraints, result reconciliation and no provider send until a persisted claim is known. |
| JSONB/driver/ORM coercion can alter financial or evidence bytes | High | Canonical decimal TEXT, BigInt math, original JSON/time text, explicit codecs and complete import/hash/replay tests. |
| Public trigger can become a compute/RPC abuse surface | High | Separate capability, authentication before DB/RPC, fixed route/body/configuration, current-slot admission, durable idempotency and bounded concurrency/retries. |
| Transport encryption without peer verification or leaked DB URL | High | Verified TLS/hostname, tested pg SSL configuration, server-side secrets, fixed endpoint configuration and allowlisted errors. |
| Old backup restores a pending row after remote delivery | High | Channel-disabled restoration, independent receipt reconciliation, immutable identities and explicit at-least-once ambiguity. |
| Slow sampling or quota suspension falsely appears healthy | High operational risk | Distinct liveness, observed-age and scheduler status; unchanged 600-second age limit, explicit gaps, external receipt/overdue monitoring. |
| Storage exhaustion prevents recording failure or pruning | High durability risk | Headroom forecasting, stop admission before full, bounded retry policy, external failure receipts and approved recovery capacity. |
| Object overwrite/deletion breaks historical assurance bindings | High | Content-addressed/conditional writes, readback SHA-256, retention controls, separately trusted manifests and fail-closed missing/mismatch handling. |
| Dashboard floods compete with the one worker | Medium/high availability risk | Small pool/read queue, bounded parse/page/response/cache sizes, route deadlines, pre-DB admission and actual 0.1-CPU/512-MB load tests. |
| Operator or automatic deployment bypasses the migration window | High | Explicit maintenance authority, disabled initial runtime, reviewed release/schema compatibility, old-writer fencing and no startup/build migrations. |

## 3. Credential and role separation

The following distinguishes the existing read capability from **proposed configuration names/capabilities**. It contains identifiers only:

| Capability | Placement and permissions |
| --- | --- |
| Existing `WATCHDOG_READ_API_TOKEN` | Runtime secret input; only read routes/dashboard. Existing bounded bearer or Basic `watchdog` access is preserved as a contract to qualify through Render TLS/proxy behavior. |
| Proposed `WATCHDOG_SCHEDULER_TOKEN` | Independently generated high-entropy credential, at least 256 random bits, configured privately in the Worker and Render. Only bounded trigger capability; no Basic/browser equivalence. |
| Proposed `WATCHDOG_DATABASE_URL` | Pooled runtime writer connection; DML on reviewed tables/sequences only, no DDL, role creation, schema ownership, replication or backup deletion. |
| Proposed `WATCHDOG_READ_DATABASE_URL` | Pooled read-only role, SELECT only on explicitly required tables/views; no write grants or writable function escape. Read handler receives only a narrow read interface. |
| Direct migration/backup connection | Approved external operator secret provider. Migration authority used only in a fenced maintenance window; backup authority is read-only over the necessary data. Neither URL belongs in the web process or scheduler. |
| Object-store capabilities | Runtime read access restricted to required evidence objects; upload/backup authority on the operator runner; retention/delete administration separate from routine upload. Private bucket, no public listing. |
| Notification credentials | Current disabled channels do not read their environment values. Any later enabled provider has separately approved recipients, deployment and delivery tests. |

Use secrets injection on the approved host/provider, with a private recovery mechanism for credentials and encryption keys. Examples, manifests, source control, images, build arguments, URLs, command-line transcripts and browser JavaScript contain names only. Reject connection URLs or provider endpoints supplied through HTTP. No real secret is needed to implement fixtures or review these documents.

Use schema-qualified SQL, parameterized values, a fixed reviewed search path and no untrusted schema CREATE privilege. DDL and migrations are unavailable to runtime roles. Read-only SQL grants complement application route restrictions. Hash checks and false-only SQL constraints do not protect arbitrary data against a compromised DB owner; independently retained manifests and operator access controls matter.

Coordinate credential rotation: issue a new scoped credential privately, update both legitimate endpoints, verify a bounded authorized operation, remove the old credential, close old pools and verify old access is refused. Any overlap must be finite and role-specific. Record rotation events, never credential text or its comparison digest. Suspected compromise disables the affected trigger/role and requires reconciliation of work admitted during the incident.

## 4. Trigger authentication, replay and abuse

Before database access, enforce route/method/body/header bounds, constant-time credential comparison, fixed schedule and local admission limits. Reject malformed/future slots and forbid new work for too-old slots. Recheck new-slot freshness and the persisted high-water mark under the database lease-row lock. A late authenticated receipt-only lookup can resolve an existing key but cannot execute missing/expired work. Unique schedule-slot identity plus the global lease, rather than an in-memory nonce set, survives cold starts. A request retry returns an existing receipt or bounded busy/unknown status without creating another observation.

Avoid token-bearing query strings, redirects and verbose request logging. Do not log Authorization, Basic credentials, request bodies or secrets-containing exception objects. Scheduler responses contain small operational receipts, not full financial data, database hosts or evidence paths. Enforce a fixed destination in the Worker and reject redirects that could forward its authorization elsewhere.

Browser read credentials cannot invoke the trigger. Require JSON and reject unexpected browser Origin on that route; no wildcard CORS. Public GET/HEAD requests keep their read-only meaning. No runtime route exposes migration, backup, SQL, shell, configuration, signing, transaction submission or arbitrary RPC operations.

Unauthenticated traffic can still wake Render and consume its service hours even when application authentication prevents a Neon query. Process-local rate limits reset on restart and do not provide a cross-instance quota or DDoS guarantee. Use the provider's available edge protections and aggregate admission metrics; do not trust caller-supplied forwarding headers to manufacture independent rate-limit identities. Free private ingress/IP restrictions cannot be assumed from generic workspace feature tables.

## 5. Database transport, transactions and errors

Use encrypted **and certificate/hostname-verified** TLS for Neon and object storage. Neon's refusal of plaintext does not prove that the client verifies peer identity. node-postgres connection-string SSL parameters can override an explicit SSL object; test the final constructed configuration, including wrong certificate, wrong host and stale socket cases. No insecure certificate bypass is acceptable.

A transaction uses one checked-out pg client throughout. Server statement/lock/idle-in-transaction timeouts and bounded client lifetimes must supplement application timers. Roll back/release every client, destroy broken/late connections, and install a sanitized pool error handler. Parameterize values and allowlist any table/index/column selection used by maintenance; never splice request identifiers into SQL.

Guard every write, including pruning, recovery and runtime metadata, with current database incarnation, owner and fence. Compare time after obtaining locks, not from a stale transaction-start timestamp. Application role permissions assume trusted adapter code obeys this protocol; independently written maintenance scripts must obey it too. A new database restored from a snapshot needs a fresh incarnation and old-deployment fencing to avoid reusing an old token.

Never report network-lost COMMIT as known rollback. Inspect durable identity and payload hash before retrying; preserve unknown outcome if the DB is still unreachable. Notification providers do not participate in the SQL transaction. A timeout or failed acknowledgment can remain ambiguous even when database fencing is correct. The system offers atomic outbox creation and at-least-once attempts, not exactly-once remote delivery.

Allowlist PostgreSQL/operational error categories for responses and logs. Connection strings, SQL parameter dumps, authentication failures, provider bodies and stack traces can contain sensitive material. Log correlation IDs and bounded codes instead. Health responses remain minimal and do not reveal database/secret configuration.

## 6. Financial and evidence integrity

- All financial raw values remain exact decimal strings at storage/transport boundaries and BigInt in calculations. Counts/time presentation may use Number only after safe-range checks. `NUMERIC` capacity is not permission to apply floating-point arithmetic or round fractions.
- Preserve the current latest/last-accepted separation, episode/revision monotonicity, fingerprint tombstones and every snapshot/block binding. An unavailable current observation never becomes a debt-free/safe or accepted recovery state.
- Preserve all thresholds and calculation versions. Strict row/application validation rejects mismatched ID/scope/cycle/alert/assurance bindings. Oracle invalidation cannot reset merely because the database changed or a cache was rebuilt.
- Keep original assurance/state/alert/observation JSON text, historical UTC text and evidence bytes. JSON validity alone does not validate provenance. Do not use driver-generated objects or JSONB reserialization to reproduce a stored hash.
- A stored path is a validated logical reference, not a filesystem or URL instruction. Resolve only through reviewed release bindings/private-object mappings. Reject traversal, arbitrary hosts, unbounded files/manifests and unexpected object keys. Preserve legacy strings and their hashes.
- Uploaded evidence is verified before referencing it from a committed record. Verify SHA-256 and complete manifest contents after retrieval. Missing/hash-mismatched evidence produces an explicit failure; it is never replaced from an untrusted URL or overwritten to match a current guess.

R2 bucket locks prevent overwrite/deletion during a configured retention period, including lifecycle deletion, but a sufficiently privileged administrator can remove/change lock rules. They are not an immutable trust anchor against that administrator. Hold original release/seal/backup-manifest bindings separately, separate deletion administration, and test actual token/retention behavior before claiming immutability. A hash in the same mutable database as its payload is useful validation but not independent tamper evidence.

## 7. Backup privacy and recovery safety

Use private encrypted backup sets with a separately recoverable encryption key and verified off-provider receipt. Backup metadata can reveal public accounts plus operational history, delivery timing and internal identities. It is not a public download API. Give the web process no backup deletion or restore authority, and keep credentials out of dump/manifests.

The [migration/recovery procedure](sqlite-postgres-migration-plan.md) requires one consistent snapshot for dump and manifest, complete transitive evidence, isolated restore, source preservation, raw-hash/ordering parity and channel-disabled recovery. Reconcile post-backup provider receipts before re-enabling sends. Restoring an old pending record cannot prove a message was never delivered. Preserve unresolved ambiguity and disclose the actual recovery point/gap.

Neon Free's six-hour/1-GB-change history and manual snapshot entitlement are bounded same-provider recovery aids. They do not establish off-provider RPO or availability. The inherited one-hour RPO/30-minute RTO are still targets, and changing to proposed Free-demo 24-hour/four-hour targets requires explicit approval. Daily full exports may require paid egress as data grows. Missing required backup capacity blocks operation; silent backup omission or destructive history pruning is not an acceptable quota response.

No automatic rollback to an empty database, pre-cutover SQLite store or latest cached JSON is permitted. Following the first PostgreSQL mutation, reverting binaries/connection settings can lose state and resend messages; use schema-compatible rollback or explicit reconciled recovery into a fresh target.

## 8. Platform and operational risk acceptance

Render/Neon/Cron Free limits can cause restarts, delays or suspension. Longer sampling increases missed-event risk; no finite maximum delay or continuous protection is established. Preserve the 600-second local age rule and show old data honestly rather than making a 30-minute sample appear fresh. The 8,000-block history window does not establish continuity over arbitrary downtime.

Protect against CPU/memory/read amplification and billing exhaustion with small pools, bounded queries/queues/pages, strict response sizes, measured RSS, budget forecasts and independent job receipts. External operational alarms need approved destinations. A monitor cannot reliably report the absence of its own scheduled invocation using that same invocation alone.

Keep migrations, secret configuration and live-chain tests out of build/startup. Initial deployment and auto-deploy are distinct actions; disabling auto-deploy does not authorize applying a Blueprint. Use immutable reviewed release/schema identity and default-disabled triggers/providers. Production qualification must examine actual Render TLS/proxy/access logs, Linux termination, database sleep/reconnect, quota failures, leaked-credential rejection and restore behavior.

## 9. Phase 9 audit controls and verification

The pre-inspection check passed against the Phase 8 seal, all historical bindings, the original Git index and **1,773 project-owned file hashes**. Private-name handling was metadata-only; the baseline found **zero** such entries. Database preservation uses byte hashing only, without loading a database engine or application runtime. The only repository additions permitted by the final verifier are the six Phase 9 Markdown documents.

The read-only secret check is `node --import tsx scripts/check-secrets.ts --read-only`. It scans project-owned text/evidence, verifies the exact authored placeholder template, and reports potential credential filenames without opening them. It excludes dependencies/build/Git/private runtime data/backups, which are separately preserved as applicable rather than read for secrets. It emits paths/rule IDs, not matched values. A passing scan is a bounded static check, not a claim that a future host is secure.

No credential/environment secret/private key was requested, inspected or emitted for this audit. No connected provider account was used. Official public platform documentation supplied the limits/TLS/backup research. Final preservation, link/whitespace/index and scanner results are recorded by the external verifier identified in [the file inventory](phase9-files.md); these are Phase 9 documentation checks, distinct from planned PostgreSQL security tests.

## 10. Required Phase 10 security acceptance

Before enabling an approved target, demonstrate: least-privilege read/write/migration/backup roles; verified TLS; redaction under real driver errors; trigger/read-token separation and replay bounds; no unauthorized DB/RPC side effects; atomic observation/outbox; stale-owner/late-ack rejection; raw financial/JSON/hash parity; coherent bounded reads; evidence tamper/missing rejection; quota/cold-start failures; isolated off-provider restore and delivery reconciliation. Retain sanitized evidence in a new authorized destination.

References consulted **2026-11-02**: [Render Free](https://render.com/docs/free), [Neon plans](https://neon.com/docs/introduction/plans), [Neon secure connections](https://neon.com/docs/connect/connect-securely), [pooling](https://neon.com/docs/connect/connection-pooling), [pg SSL](https://node-postgres.com/features/ssl), [pg types](https://node-postgres.com/features/types), [pg transactions](https://node-postgres.com/features/transactions), [R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/). Preserved inputs include [production security](production-security.md), [Render security plan](render-security-plan.md), [oracle assurance](oracle-assurance.md) and [Phase 8 report](phase8-report.md).
