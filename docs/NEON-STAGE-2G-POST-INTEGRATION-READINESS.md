# Neon Stage 2G — Post-Integration Architecture and Release Readiness Review

**Review date:** 2026-11-05  
**Scope:** read-only architecture, evidence and release-readiness assessment  
**Executive decision:** **NO-GO for Neon migration, Neon application integration, deployment and product acceptance**

## 1. Executive decision

Liquidation Watchdog's local PostgreSQL implementation is substantially qualified. A disposable native PostgreSQL 17.11 cluster ran the full 60-test PostgreSQL integration suite, including real schema creation, exact persistence, true writer/reader isolation, leases, fencing, restart, killed-process recovery and read projections. The current non-integration suite also passes 933 tests.

That evidence supports a **GO for the local PostgreSQL adapter/application integration implementation**. It does not support a Neon or production GO.

The decisive blockers remain:

1. no working/qualified Neon reader credential;
2. A4.5 migration authority and credential custody remain NO-GO;
3. the child branch remains schema-empty and ungranted;
4. no remote persistence/read-model/lease/recovery integration test exists;
5. TEMP inherited through `PUBLIC` remains an unresolved policy decision;
6. no backup/restore evidence exists;
7. Neon Free capacity and operational suitability are unqualified;
8. the PostgreSQL runtime has no notification adapters configured;
9. alerts have timestamp/reason fields but no required concrete suggested action.

The product must remain non-actionable. No blocker may be resolved by weakening oracle assurance, freshness, progression, reader separation or A4.5.

## 2. Workspace preservation at review start

The repository has no valid `HEAD` revision (`git rev-parse --verify HEAD` returned “Needed a single revision”); it remains an unborn repository with a pre-existing intent-to-add-style index/worktree state.

Pre-review record:

- entries inventoried: 21,987;
- Git `HEAD`: absent/unborn;
- index size: 65,736 bytes;
- index SHA-256: `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689`;
- working-status bytes: 85,593;
- working-status SHA-256: `d30fa8669588de75b03ac61fd18692bf7a70ad6eb1d4863798a525838463f1ec`;
- staged diff: empty;
- empty staged-diff SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

The complete baseline is outside the workspace at:

`[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/neon-stage2g-32b70685/baseline.json`

## 3. Evidence reviewed

### 3.1 Repository reports present and reviewed

- `docs/NEON-STAGE-2F-NATIVE-POSTGRESQL-INTEGRATION.md`
- `docs/NEON-STAGE-2E-POSTGRESQL-17-PREPARATION.md`
- `docs/NEON-STAGE-2D-WSL-POSTGRESQL-PRESENCE.md`
- `docs/NEON-STAGE-2C-POSTGRESQL-ENVIRONMENT-INSPECTION.md`
- `docs/NEON-STAGE-2B-INTEGRATION-READINESS.md`
- `docs/NEON-STAGE-2A-APPLICATION-INTEGRATION.md`
- `docs/NEON-STAGE-1D-WRITER-QUALIFICATION.md`
- `docs/NEON-STAGE-1C-CONNECTION-REMEDIATION.md`
- `docs/A4.4-SECURITY-REMEDIATION-PROPOSAL.md`
- `docs/A4.5-PROVIDER-ARCHITECTURE-EVALUATION.md`
- `docs/PHASE-11-PRODUCT-ACCEPTANCE-AUDIT.md`

Only A4.4 and A4.5 exist under the requested A4 report naming. No A4.1, A4.2 or A4.3 report file exists in `docs/`; their findings are referenced by A4.4 and exercised in `scripts/a4-neon-qualification.ts` and its tests, but missing files were not assumed.

No formal repository report named for Phase 12A, 12B or 12C exists. Phase 12 evidence was reconciled from current source/tests and retained external records where present:

- Phase 12B external unit result: 43 files, 891/891 passed;
- Phase 12C external final result: 44 files, 920/920 passed;
- Phase 12C preservation report identifies the authorized progression/readiness/recovery source and test changes;
- current Stage 2F result supersedes counts for the current tree: native 60/60 and unit 933/933.

Absence of formal Phase 12 repository reports is a documentation/evidence-chain limitation, not evidence that current code is missing.

### 3.2 Raw external Stage 2F evidence checked

- `native-result.json`: exit 0, no signal/error, exact test filter `test/integration/postgres.test.ts`;
- `native-stdout.log`: 1/1 file, 60/60 tests, 253.06 seconds;
- Stage 2F preservation: only its report added, no changed/deleted baseline file, index unchanged, staged diff empty.

No test was rerun for Stage 2G because the existing current-tree evidence was sufficient and this stage is assessment-only.

### 3.3 Current implementation inspected

Review included current:

- PostgreSQL configuration/pooling, connection, codec, migrations, catalog, database, scheduler store and monitor store;
- runtime entrypoint, scheduler, authentication, HTTP and read model;
- monitoring observation/model/transitions/service;
- oracle-assurance evaluation and freshness/independence contracts;
- Phase 12 progression and recovery eligibility;
- notification formatter, dispatcher and adapters;
- threshold loading and deployment draft;
- native fixture hardening and native integration tests.

## 4. Local PostgreSQL qualification

### 4.1 Verified on native PostgreSQL 17.11

**Status: VERIFIED.**

The 60-test native suite performed real database operations and established:

- PostgreSQL 17.11 initialization, startup, connection and clean shutdown;
- exact two-migration lineage, 15-table schema and catalog fingerprints;
- domains, identity sequences, generated timestamps, partial indexes, checks and foreign keys;
- writer `READ COMMITTED` and reader `REPEATABLE READ READ ONLY` transactions;
- transaction-local `pg_catalog`, UTC, durability and timeout settings;
- real rollback and connection reuse after SQL failure;
- real server statement timeout;
- backend termination and bounded reconnection;
- true restricted writer and reader roles, including forbidden grant/owner/DDL cases;
- exact JSON/hash persistence and corruption rejection;
- exact BigInt/decimal/UTC/cursor handling;
- atomic cycle/observation/state/progression/assurance/alert/outbox persistence;
- rollback on backlog overflow and serialization of competing transitions;
- scheduler admission concurrency, leases, fences, incarnation and high-water replay protection;
- immediate server restart durability;
- killed mid-read and killed in-flight-send recovery;
- application-level unknown-COMMIT reconciliation for observation, admission and delivery identities;
- coherent reader projections, threshold stream isolation, readiness and retention;
- cleanup with no residual process, service or fixture directory.

### 4.2 Application-level versus isolated-adapter evidence

**Status: VERIFIED locally, not production-like.**

The native suite is not merely SQL-adapter unit coverage. It runs shared `MonitoringService`, `PostgresSchedulerStore`, `PostgresMonitorStore`, `PostgresDatabase`, transitions, observations, assurance, progression and `AsyncPersistedReadModel` against a real PostgreSQL server. One test executes a full synthetic scheduled monitoring cycle with durable receipt and synthetic console delivery.

Limits:

- chain/oracle inputs and clock are deterministic fixtures;
- external notification providers are not contacted;
- the native server is loopback, not Neon/PgBouncer;
- the test superuser creates schema/roles/grants in a disposable cluster;
- resource behavior does not model Neon Free compute/storage/egress/scale-to-zero;
- no production process manager, scheduler provider or HTTP deployment participates.

### 4.3 Unit/mock-only or partially simulated behaviors

| Behavior | Status | Limitation |
| --- | --- | --- |
| Pooled Neon writer TLS/channel binding | VERIFIED read-only in Stage 1D | Connection/catalog only; no pooled write transaction or reconnect load |
| Neon reader behavior | NOT VERIFIED | Credential unavailable |
| Neon schema/role grants | NOT VERIFIED | Schema absent |
| Real notification provider delivery | NOT VERIFIED | HTTP adapters tested with mocks; PostgreSQL runtime uses no adapters |
| Current live chain progression/oracle state | NOT VERIFIED | Current acceptance read not performed; prior captures are historical |
| Unknown COMMIT | PARTIALLY VERIFIED | Native tests commit real data then inject the unknown outcome at the transaction wrapper; no real wire-level COMMIT-response loss/network partition |
| Cleanup after initialization faults | VERIFIED by adversarial unit tests | Native Stage 2F observed normal/restart/process-kill cleanup, not every injected pre-return failure on a real server |
| Deployment supervision | NOT VERIFIED | No Render/service process deployment or crash-loop acceptance |
| Backup/restore | NOT VERIFIED | No dump/restore or provider recovery receipt |
| Scheduler provider cadence | NOT VERIFIED | Runner/store tested locally; Cloudflare/Render drafts are undeployed |
| Concurrent production scale | PARTIALLY VERIFIED | Two-admitter/revision/fence tests exist; pool is intentionally one connection per role and no remote load test exists |

### 4.4 Local engineering decision

**GO for the local PostgreSQL adapter and shared application persistence implementation.**

This GO is limited to code/schema/test correctness on native PostgreSQL 17.11. It is not a release, Neon, deployment, notification or financial-action GO.

## 5. Neon readiness matrix

| Item | Classification | Confirmed facts | Missing evidence / blocker |
| --- | --- | --- | --- |
| Project/branch/region/major identity | VERIFIED | Read-only API metadata bound `liquidation-watchdog-pg17`, `a4-migration-test`, parent `production`, Ohio, PG 17 | Must be re-bound immediately before any future authorized operation |
| Direct writer transport | VERIFIED | TLS 1.3, authorized certificate, `SCRAM-SHA-256-PLUS`, PG 17.11, correct DB/role, read-only transaction | No remote writer persistence |
| Pooled writer transport | VERIFIED | Stage 1C fix passed Stage 1D pooled read-only connection | No pooled write/runtime load/reconnect qualification |
| Reader credential/transport | BLOCKED | Role exists and is restricted; supplied reader URLs used writer-equivalent bytes and failed `28P01` | Correct existing secret or newly approved distinct reader credential required |
| A4.5 migration authority | NO-GO | Threat model and conditional dual-broker architecture documented | No selected custodians/providers, immutable runner, brokers, signed authority, WORM, budget or adversarial proof |
| Child-branch schema/grants | BLOCKED | Read-only baseline proved schema absent and branch empty | Migration and grant execution require A4.5 resolution and explicit approval |
| Remote persistence integration | NOT VERIFIED | Local native persistence passes | Requires provisioned schema, true reader, separately approved synthetic remote writes and post-test inventory |
| TEMP privilege | PARTIALLY VERIFIED | Effective TEMP comes from `PUBLIC`; runtime does not need temp objects | Database-wide impact decision and separate privilege-change approval |
| Backup/restore | NOT VERIFIED | Procedures are designed | No pre/post dump, WORM receipt, independent restore test or provider recovery evidence |
| Neon Free capacity | NOT VERIFIED | App stop threshold is 800 MB; pools are small | No actual storage/index/TOAST/dead-tuple growth, cold start, compute/egress, quota or scale-to-zero qualification |
| Operational monitoring | NOT VERIFIED | Bounded runtime/error model exists | No deployed metrics/alerts for DB bytes, lag, backlog, pool waits, unknown commits or backup age |

### 5.1 Reader alternatives without assuming password reset

The current reader blocker cannot be solved without a valid distinct reader authentication capability.

Options preserving a preference not to reset the current password:

1. recover the correct existing `watchdog_reader` secret from a user-controlled/enterprise vault and qualify it;
2. under separate approval, create a new restricted reader role/credential, apply the exact reader grants after schema provisioning and update the application secret; this creates new credentials/grants but does not reset the old role;
3. abandon PostgreSQL runtime activation.

Writer-as-reader substitution is prohibited by configuration and security design. There is no passwordless or local-only alternative established for Neon. If neither recovery nor creation of a distinct reader credential is acceptable, Neon integration remains permanently blocked.

## 6. Security safeguards and product acceptance

### 6.1 Safety gates

| Safeguard | Classification | Assessment |
| --- | --- | --- |
| Oracle assurance independent from progression | VERIFIED | `observe()` computes progression separately; recovery eligibility independently evaluates assurance, gate, freshness, independence, invalidation, anomalies and configuration |
| Freshness not interchangeable with progression | VERIFIED | Readiness exposes retrieval age, block age, progression, assurance and oracle freshness separately; eligibility never infers progression from retrieval age |
| Every recovery gate required | VERIFIED | Unit/adversarial tests cover absent/unchanged/stalled/regressed/conflicting progression and all oracle/evidence gates; amounts remain null unless all pass |
| `actionable:false` unconditional | VERIFIED | Literal schemas, risk/recovery contexts, API safety envelope and database `actionable=0` constraint; native tests pass |
| No fabricated chain/financial values | VERIFIED in implementation | Snapshot reader pins/compares validated provider reads; fixtures are labeled; calculations use exact inputs. Current production chain truth remains unverified because no current acceptance read exists |
| No transaction signing/broadcast | VERIFIED | No signing/private-key/send-transaction/broadcast implementation under `src/` |
| Recovery amount not presented as verified without gates | VERIFIED | Blocked amounts are null; calculated values remain explicitly snapshot-bound, indicative and non-actionable |

### 6.2 Alerts and suggested actions

| Requirement | Classification | Assessment |
| --- | --- | --- |
| Alert timestamp | VERIFIED in schema/formatter | `createdAt` is mandatory and is first in rendered alert text |
| Delivered alert from deployable PostgreSQL runtime | NOT VERIFIED / product blocker | `PostgresRuntime` constructs `MonitoringService` with `adapters: []`; no delivery rows/channel from that runtime |
| Concrete suggested action on every alert | NOT VERIFIED / FAIL | Alert schema has no suggested-action field; formatter emits `Reason:` text, not a mandatory action; many codes have no instruction |
| Warning/critical thresholds configurable | VERIFIED locally, PARTIAL operationally | Exact threshold file path is loaded at PostgreSQL entrypoint and native custom-stream tests pass; deployment draft does not supply `WATCHDOG_RISK_CONFIG_PATH` and no deployed config evidence exists |
| Financial suggestion qualified/fresh | VERIFIED fail-closed | Recovery numbers appear only through strict eligibility and remain `actionable:false`; no real current verified/fresh production evidence exists |

A concrete suggested action can be a safe human instruction without making a financial estimate actionable. Examples remain:

- invalid/stale/unavailable: “Do not transact from this alert; independently verify current chain and oracle state.”
- warning/critical: “Review this named position now; refresh and independently verify state before considering debt reduction or collateral.”

This is local product work, not authorization to sign or broadcast.

### 6.3 Remaining Phase 11 acceptance requirements

Subsequent work fixed the Phase 11 retrieval/progression-readiness gap and PostgreSQL threshold injection gap. These acceptance requirements remain undemonstrated:

1. one authorized runtime joining current advancing chain reads, configured thresholds, durable PostgreSQL state, scheduler and notification delivery;
2. required suggested action on every alert code;
3. real supported-channel delivery from the PostgreSQL runtime;
4. current oracle freshness/independence sufficient for anything beyond non-actionable indicative output;
5. explicit product decision accepting the single pinned demonstration position or implementing validated multi-position identity;
6. deployed restart/missed-slot/ambiguous-delivery behavior;
7. end-to-end backup/restore and incident recovery.

## 7. Outstanding risks

### Security

- Migration credential on Windows would violate the accepted administrator-compromise threat model.
- Conditional A4.5 architecture is complex, likely non-zero-cost and unimplemented.
- Reader secret remains unavailable; bypassing with writer would collapse least privilege.
- TEMP via `PUBLIC` adds unnecessary capability until reviewed.
- Runtime schema/role checks are lazy; `/api/health` can report runtime lifecycle before database readiness is established.

### Reliability and operations

- No Neon write/read integration, pooler write, failover, cold-start or quota test exists.
- Unknown-COMMIT real network-loss behavior is not physically fault-injected at COMMIT.
- No backup/restore or branch recovery drill exists.
- No deployed process supervision, scheduler or notification destination exists.
- At-least-once external notifications can duplicate after ambiguous provider acceptance.
- Free-plan capacity estimates do not include measured indexes, TOAST, dead tuples and retained deduplication tombstones.

### Product

- PostgreSQL runtime persists alerts but configures no adapters.
- Every alert lacks a schema-enforced suggested action.
- Product identity remains one compiled-in public demonstration account/market.
- Oracle remains `UNVERIFIED`, freshness `UNKNOWN` for production evidence and RPC/MCP are not independent.
- No current live acceptance read establishes present risk.

### Evidence and release

- Repository `HEAD` is unborn; release identity cannot be anchored to a commit until a separately authorized repository/release process exists.
- Formal A4.1–A4.3 and Phase 12A/B/C repository reports are missing; current source/tests and external artifacts partially fill the evidence chain.
- Extracted PostgreSQL binaries are temporary test tooling, not a production dependency or packaged release.

## 8. Prioritized remediation roadmap

### Priority 0 — Decisions that gate every Neon operation

| Item | Status | Exact blocker/evidence needed | Authority/resources | Security/cost/dependencies |
| --- | --- | --- | --- | --- |
| Decide reader path | BLOCKED | Recover correct reader secret or explicitly approve a new distinct restricted reader role; pass direct/pooled TLS/role/read-only checks | Operator action, credentials, explicit approval | No writer bypass; new role needs grants after schema; depends on user preference |
| A4.5 G0 selection | NO-GO | Named independent custodians/recovery domains; exact providers/accounts; immutable runner/release; dual broker/CAS; signer/WORM; scenario-10 adversarial plan; hard budget | External infrastructure and explicit security/budget approval | Likely non-zero recurring cost; must precede migration credential or schema creation |
| Product scope decision | PARTIALLY VERIFIED | Explicitly accept single pinned demonstration position or approve validated multi-position design | Product decision; local engineering if expanded | Prevents presenting a demonstration account as user's wallet |

### Priority 1 — Local product acceptance work

| Item | Status | Exact blocker/evidence needed | Authority/resources | Security/cost/dependencies |
| --- | --- | --- | --- | --- |
| Mandatory suggested action | NOT VERIFIED | Add bounded action code/text to alert schema and every transition/renderer; tests proving every code has safe instruction | Local engineering + approval | No cloud cost; must preserve `actionable:false` and avoid transactional advice |
| PostgreSQL runtime adapters | NOT VERIFIED | Inject explicitly configured adapters instead of `[]`; validate secrets; atomically create deliveries; controlled destination acceptance later | Local work, operator channel credentials, external-test approval | Secret handling and duplicate disclosure; provider may be free/paid |
| Startup database readiness | PARTIALLY VERIFIED | Add/approve explicit non-mutating schema/role/readiness preflight before advertising ready lifecycle, without creating/fixing DB | Local engineering | Prevents health-only false confidence; reader/schema dependency |
| Release/config binding | PARTIALLY VERIFIED | Bind threshold config and active stream fingerprint into immutable release/deployment evidence | Local/release work | No necessary cloud cost; deployment draft currently omits threshold path |
| Evidence documentation | PARTIALLY VERIFIED | Consolidate A4.1–A4.3/Phase 12 decisions or explicitly record absence and external artifact hashes | Local documentation | Improves audit continuity; no functional bypass |

### Priority 2 — Neon provisioning after Priority 0 approval

| Item | Status | Exact blocker/evidence needed | Authority/resources | Security/cost/dependencies |
| --- | --- | --- | --- | --- |
| Pre-migration backup/baseline | NOT VERIFIED | Signed read-only metadata, logical baseline, ACL/object inventory, independent WORM receipt | Approved inspector/storage | Depends on A4.5; storage may cost money |
| One-use migration | BLOCKED | Exact signed manifest/release/start receipts; direct branch-scoped migration credential; run existing two checksummed migrations once | Independent A4.5 runner/brokers | Highest-risk step; no retry after start |
| Runtime grants/TEMP | BLOCKED/PARTIAL | Apply exact writer/reader grants, verify positives/forbidden rights; decide database-wide TEMP policy | DB operator approval | TEMP revoke impacts all roles; depends on schema and reader decision |
| Post-migration catalog/backup | NOT VERIFIED | Exact fingerprint/identity/empty data/lease verification, post-backup and independent restore test | Operator + storage + separate disposable restore target | Must precede application writes |

### Priority 3 — Remote integration and operational qualification

| Item | Status | Exact blocker/evidence needed | Authority/resources | Security/cost/dependencies |
| --- | --- | --- | --- | --- |
| Synthetic Neon persistence test | NOT VERIFIED | One bounded synthetic observation/progression write, true reader projection, atomic row/hash inventory, no active lease afterward | Explicit remote-write approval | Depends on reader/schema/grants; child branch only |
| Pooler/runtime reliability | PARTIALLY VERIFIED | Pooled writer+reader transactions, cold start/reconnect, cancellation, bounded load and cleanup | Remote-test approval | Free-plan compute/egress effects |
| Backup/restore drill | NOT VERIFIED | Restore signed backup into separate disposable target and verify identity/data/catalog | Infrastructure/approval | May require additional branch/storage and cost |
| Capacity/retention | NOT VERIFIED | Measured DB/index/TOAST/dead-tuple growth, backlog/tombstones, quota stop behavior | Operational test/telemetry | Free-plan limits may force redesign or paid plan |
| Deployed supervision/scheduler | NOT VERIFIED | Exact release under process manager, scheduler slots/missed slots, shutdown/restart evidence | Deployment/scheduler approval | Cloud operations and possible paid usage |
| Real notification acceptance | NOT VERIFIED | Timestamped alert with mandatory action delivered to controlled configured channel; ambiguity documented | Credentials/destination/approval | External side effect and duplicate risk |

### Priority 4 — Final product acceptance

Required evidence from one exact authorized runtime:

1. current advancing block-bound chain reads for the accepted product identity;
2. active configured thresholds reflected in served scope;
3. PostgreSQL persistence plus true reader readiness;
4. timestamped alert delivered through a configured channel;
5. concrete safe suggested action on every alert;
6. explicit oracle assurance/freshness/progression without interchange;
7. scheduler/restart/missed-slot/ambiguous-delivery evidence;
8. backup/restore and incident recovery;
9. unchanged `actionable:false` and no signing/broadcast path.

## 9. Explicit GO / NO-GO decisions

| Scope | Decision |
| --- | --- |
| Native PostgreSQL 17.11 adapter/application integration | **GO** |
| Phase 12 progression/recovery safety gates | **GO locally** |
| Direct/pooled Neon writer transport | **GO for read-only transport only** |
| Neon reader | **NO-GO / BLOCKED** |
| A4.5 migration execution | **NO-GO** |
| Neon schema/grants | **NO-GO / absent** |
| Neon remote persistence integration | **NO-GO / not verified** |
| PostgreSQL runtime notifications | **NO-GO / no adapters configured** |
| Product acceptance | **NO-GO** |
| Production deployment/scheduler | **NO-GO** |
| Transaction signing/broadcast | **OUT OF SCOPE and must remain absent** |

## 10. Scope limitations

- No network connection or external service was used by Stage 2G.
- No tests, PostgreSQL process or cluster were started.
- No Neon/cloud/credential account was inspected.
- Reported remote facts come from prior authorized Stage 1 evidence, not a new check.
- Provider prices/free-tier conditions are inherited from A4.5 research dated 2026-11-04 and require refresh before any approval.
- Current source/test review cannot prove live chain/oracle state or production operations.
- This report authorizes no implementation, migration, credential action, provisioning, deployment, notification or later stage.

Stage 3 is not started. Every roadmap item requires separate approval.
