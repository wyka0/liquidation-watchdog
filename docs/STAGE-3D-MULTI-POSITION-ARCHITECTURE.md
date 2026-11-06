# Stage 3D — Multi-Position Architecture and Implementation-Readiness Review

**Prepared:** 2026-11-05  
**Scope:** architecture and readiness review only  
**Implementation status:** not implemented  
**Recommendation:** **CONDITIONAL GO** — pure local interfaces and deterministic coordinator tests may be designed next; no persisted multi-position runtime may be enabled until separately approved SQLite and PostgreSQL migration work is resolved.

## 1. Executive conclusion

Liquidation Watchdog already has a strong per-position isolation key: `monitoringScope()` binds the canonical position identity and authored thresholds, and alerts bind that scope into their fingerprints. That is necessary but not sufficient for safe multi-position monitoring.

The current runtime remains structurally single-position:

- configuration selects exactly one position;
- one `MonitoringService` owns one scope, loop, store lifecycle, and dispatcher;
- SQLite permits one writable monitor owner and stores one worker-runtime record;
- oracle-assurance audit rows are keyed by `LIVE`, `FIXTURE`, or historical context, not by position scope;
- the HTTP/CLI read models bind one position and one scope at construction;
- PostgreSQL has one singleton worker lease and one scheduled execution/cycle per namespace/schedule/slot;
- PostgreSQL notification claims are tied to that one scheduler fence.

Creating several `MonitoringService` instances or looping over positions would therefore be unsafe. It could mix oracle-assurance baselines, conflict on writer ownership/runtime records, exceed the scheduler job budget, and make partial completion impossible to represent.

The recommended architecture is:

1. one **multi-position coordinator** owns configuration generation, scheduling, the database lifecycle, resource controls, shutdown, and a shared outbox dispatcher;
2. one isolated **position work item** produces at most one position cycle and is bound to one immutable position configuration, monitoring scope, and configuration generation;
3. a conservative **bounded work queue** processes one position at a time initially;
4. SQLite uses the same logical round/work model in one process;
5. PostgreSQL uses **Design C: a bounded worker pool claiming position-specific work items**, with independent work-item fences and a separate global outbox lease;
6. existing single-position tables and history remain readable; new scheduler/assurance/runtime records use additive versioned tables rather than repurposing the old singleton records.

No migration SQL is provided or authorized by this review.

## 2. Current configured-position lifecycle

### 2.1 Configuration and identity

| Boundary | Current source | Current behavior | Single-position assumption |
| --- | --- | --- | --- |
| Raw document | `src/config/position.ts` — `documentSchema`, `parsePositionConfigurationDocument()` | Strict version 1 array, maximum 10, complete validation, duplicate `positionId` rejection | The parser can validate a list, but the runtime does not consume it |
| Selection | `src/config/position.ts` — `selectSinglePosition()` | Requires exactly one entry | Explicit `MULTI_POSITION_UNSUPPORTED` gate |
| Loader | `src/config/position.ts` — `loadPositionConfiguration()` | Returns one `PositionConfiguration`; absent path becomes explicit demo configuration | One selected position and one threshold set |
| Runtime composition | `src/config/runtime.ts` — `RuntimeConfiguration`, `loadRuntimeConfiguration()` | Holds singular `position` and `thresholds` | Configuration fingerprint represents one position |
| Canonical identity | `src/positions/model.ts` — `parsePositionIdentity()`, `positionIdentityFingerprint()` | Canonical addresses, market ID, account, and deterministic `positionId` | Identity itself is suitable for multiple positions |

Every entry is currently restricted to the same reviewed Pharos/Morpho market. Stage 3D does not recommend expanding that allowlist.

### 2.2 Scope, reader, assurance, risk, and actions

| Lifecycle step | Current source and function | Isolation already present | Remaining assumption/risk |
| --- | --- | --- | --- |
| Scope | `src/monitoring/model.ts` — `monitoringScope()` | Configured scopes bind `positionId`, authored thresholds, and live/historical context; demo `monitor-v1` is preserved | Callers construct one scope |
| Snapshot | `src/chain/snapshot.ts` — `inspectPosition()`, `initialQueries()` | Snapshot account comes from the selected `PositionConfiguration`; market dependencies remain pinned | One full RPC/MCP reader lifecycle per invocation |
| Live reader | `src/monitoring/reader.ts` — `inspectMonitored()` | Position is explicitly injected | Creates a new `RequestPacer`, RPC client, and MCP client for one position |
| Request pacing | `src/chain/transport.ts` — `RequestPacer`, `pacedFetch()` | Requests inside one reader are serialized with the reviewed minimum interval | Concurrent position readers would each create a pacer and multiply aggregate load |
| Progression | `src/monitoring/observation.ts` — `acceptedBaseline()`; `src/chain/progression.ts` | Baseline is taken from the position stream's previous accepted observation | Safe only if each runner receives the correct scoped state |
| Assurance evaluation | `src/oracle-assurance/evaluate.ts` — `evaluateAssurance()` | Caller supplies the selected position for snapshot validation | Continuity scope is only `LIVE`, `FIXTURE`, or historical block; it does not include position identity |
| Risk | `src/risk/assured.ts`, `src/risk/engine.ts`, `src/risk/validate.ts` | Expected position is explicitly passed; snapshot identity must match | Suitable for isolated runners |
| Recovery eligibility | `src/risk/eligibility.ts` — `evaluateRecoveryEligibility()` | Expected canonical identity, progression, assurance, freshness, independent validation, invalidation, and configuration gates remain separate | Suitable if the supplied assurance/progression belongs to the same position work item |
| Observation | `src/monitoring/observation.ts` — `observe()` | Observation embeds account, market, thresholds, progression, assurance, and `actionable:false` | Cycle ID must be globally unique and position-bound |
| Transition | `src/monitoring/transitions.ts` — `transition()` | One `MonitorState` and episode set per scope; alert fingerprints include scope | Caller must never pass state from another scope |
| Suggested action | `src/actions/derive.ts` — `deriveSuggestedAction()` | Action evidence includes account/market/snapshot; strict financial gate; exactly one typed action | No architectural weakening is needed |

### 2.3 Persistence and notifications

| Boundary | Current source | Existing behavior | Multi-position issue |
| --- | --- | --- | --- |
| SQLite stream | `src/storage/migrations.ts` — `streams(scope PRIMARY KEY)` | State is naturally scope-isolated | Reusable without table change |
| Cycles | `cycles(id PRIMARY KEY, scope)` | Observation history carries scope | Cycle IDs are globally unique; coordinator must derive position-bound IDs |
| Alerts | `alerts(id, fingerprint UNIQUE, cycle_id, scope)` | Scope is persisted; fingerprint includes scope | Reusable if cycle IDs remain unique |
| Outbox | `deliveries`, `delivery_attempts`, `delivery_events` | Delivery ID is derived from alert ID/channel; alert carries scope | Core idempotency is reusable; dispatch is global and currently owned by each service |
| Oracle assurance | `oracle_assurance(id, context, ...)` and `latestOracleAssurance(context)` | Audit history is selected only by continuity context | **Unsafe across positions:** `LIVE` rows can be read as another position's baseline |
| Runtime | `worker_runtime(id=1)` | One process/runtime record | Cannot expose independent position work status |
| SQLite ownership | `MonitorStore.acquireMonitor()` and OS lock | One writable monitor owns the database | Several `MonitoringService` instances cannot independently acquire/close it |
| Dispatcher | `src/notifications/dispatcher.ts` — `NotificationDispatcher` | `due()` selects globally; provider cooldown is global; ambiguous outcomes become terminal unknown | Multiple dispatchers would compete; one shared dispatcher is required |

Alert/outbox identity is already adequate: `transition()` includes scope in the alert fingerprint, and both stores derive `delivery_<hash(alertId, channel)>`. Provider exactly-once remains unavailable; ambiguous outcomes must remain terminal `UNKNOWN` and must never be blindly replayed.

### 2.4 Runtime, CLI, HTTP, and operations

- `src/runtime/service.ts` constructs one writer, one `MonitoringService`, one `PersistedReadModel`, and enforces one process owner.
- `src/runtime/postgres-runtime.ts` constructs one `PostgresSchedulerStore`, one scope, one position job factory, and one `AsyncPersistedReadModel`.
- `src/cli/monitor.ts` loads one resolved position, runs one service, and selects one scope for status/alerts.
- `src/runtime/read-model.ts` binds one identity and scope in each read-model constructor. `/api/positions` currently returns one position envelope rather than a list.
- `src/runtime/http.ts` accepts only fixed routes and allows only pagination query parameters. Its cache key does not contain `positionId` because the API instance represents one position.
- `src/operations/diagnostics.ts` computes health/readiness for one scope and compares the singleton runtime record with that scope.
- The dashboard is constructed around the same single read API.

## 3. Current PostgreSQL scheduler and fencing model

### 3.1 Persisted identity

`src/runtime/scheduler-contract.ts` derives:

```text
executionId = hash("schedule-v1", namespace, "morpho-30m-v1", slot)
cycleId     = "scheduled_" + executionId
```

Position identity and monitoring scope are absent. One slot therefore has exactly one execution and cycle identity.

### 3.2 Lease and execution

The PostgreSQL migration in `src/storage/postgres/migrations.ts` creates:

- `worker_lease` with `id=1`;
- a monotonically increasing global `fence`;
- one owner, database incarnation, expiry, deadline, current execution, and high-water slot;
- `scheduled_executions` with `UNIQUE(namespace,schedule,slot)`;
- one non-null, unique `cycle_id` per execution.

`PostgresSchedulerStore.admit()` locks the singleton lease, resolves duplicate slot requests, interrupts an abandoned global execution, advances one high-water mark, inserts one cycle, and returns one `Fence`.

`PostgresDatabase.assertFence()` checks the singleton lease (`id=1`), owner, fence, incarnation, current execution, expiry, and deadline before and after every writer transaction.

`PostgresMonitorStore` is a job-scoped capability:

- `beginCycle()` accepts only `fence.cycleId`;
- every observation/outbox write uses the global fence;
- delivery attempts copy that same owner/fence/incarnation;
- stale delivery claims are recovered as terminal ambiguous failures;
- late continuations fail after cancellation, lease loss, deadline expiry, or fence supersession.

`SchedulerRunner` permits at most two HTTP executions in memory, but the singleton lease means only one can be admitted. One authenticated HTTP request owns the complete cycle and has a 300-second job budget; PostgreSQL's reviewed cycle budget is 240 seconds.

This model cannot safely represent several position cycles in one slot without a migration and scheduler-contract redesign.

## 4. Proposed multi-position lifecycle

### 4.1 Terminology and components

**Configuration generation**  
A canonical, non-secret snapshot of the validated position list, monitoring policy, and per-position thresholds. It has a deterministic `generationId`. Work never substitutes values from a newer generation.

**Coordinator round**  
A persisted manifest of enabled positions that became due together. A round is operational aggregation only; it is never a financial observation and has no global `accepted` value.

**Position work item**  
The independently claimable unit for one `positionId`, monitoring scope, and configuration generation. It creates at most one position cycle.

**Position cycle runner**  
The existing read → assurance → progression → risk → transition → atomic observation/alert/outbox pipeline, separated from global store acquisition, dispatcher draining, pruning, runtime status, and shutdown.

**Shared outbox dispatcher**  
One runtime-level component for all positions. It retains global provider cooldown and ambiguous terminal-unknown semantics.

### 4.2 Loading and validation

1. Read the bounded position document once.
2. Parse every entry with the existing identity and threshold validators.
3. Reject the **entire** document before database work if any entry is malformed, unsupported, contradictory, or duplicated.
4. Preserve disabled entries in the configuration generation but create no work for them.
5. Require at least one enabled position before monitoring can be enabled.
6. Sort entries by canonical `positionId` solely for deterministic fingerprinting; retain an explicit stable ordinal for fairness/display.
7. Compute:
   - each existing `positionId`;
   - each existing `monitoringScope(position.thresholds, context, position)`;
   - a per-position runtime fingerprint;
   - one generation fingerprint over the ordered canonical entries and monitoring policy.
8. Persist the generation before creating a round or work item.

No raw RPC response may add, remove, or alter a configured position.

### 4.3 Round and work states

Recommended round states:

```text
PLANNED     manifest persisted; work not yet started
RUNNING     at least one work item started; others may be pending
COMPLETED   every enabled item completed with an accepted or rejected observation
PARTIAL     every item is terminal, but at least one failed/interrupted/superseded before an observation commit
INTERRUPTED coordinator stopped before all items became terminal
SUPERSEDED  no work may start because the generation was replaced before execution
```

Recommended position-work states:

```text
PENDING
RUNNING
COMPLETED_ACCEPTED
COMPLETED_REJECTED
FAILED
INTERRUPTED
SUPERSEDED
```

`COMPLETED_REJECTED` means a complete rejected diagnostic observation was atomically persisted (for example, stale/unavailable/invalid evidence). `FAILED` means infrastructure failed before such an observation could be committed. These states must not be conflated.

A round's result exposes bounded counts for every work state. `PARTIAL` must never be projected as a fresh or accepted aggregate state. Aggregate readiness is true only when every enabled position is independently ready; per-position readiness remains authoritative.

### 4.4 Scheduling and processing

1. The coordinator identifies enabled positions due under their own last completion/backoff state.
2. It persists one round and one immutable work item per due position.
3. Work ordering is oldest-last-completed first, then stable ordinal/`positionId` as a deterministic tie-breaker.
4. A worker claims one item and its position-specific fence/deadline.
5. The runner loads only that work item's scoped state and scoped assurance baseline.
6. The runner performs a full position read. The first implementation must not share financial or assurance results between accounts, even though all accounts currently use one market.
7. Progression compares only with the same scope's last accepted observation.
8. Observation, state, alerts, suggested actions, and outbox rows commit atomically for that scope.
9. The work item transitions to `COMPLETED_ACCEPTED` or `COMPLETED_REJECTED` only after the cycle is completed.
10. Infrastructure failure updates only that work item/cycle. Other pending positions remain eligible.
11. A single shared dispatcher drains global due deliveries independently of position work.
12. The coordinator updates round counts/status transactionally from terminal work states.

### 4.5 Restart recovery

On startup, before creating new work:

1. validate the current configuration generation;
2. acquire coordinator/store ownership;
3. recover stale outbox claims as terminal unknown exactly as Stage 3B requires;
4. inspect bounded batches of non-terminal rounds/work items;
5. for each stale `RUNNING` item, verify its persisted generation, position, scope, cycle, and fence;
6. if its observation commit is present and hash-valid, complete the work from persisted truth;
7. if a cycle exists without an observation, mark it interrupted and, only when the original canonical configuration is available, persist the existing conservative `PROCESS_INTERRUPTED` observation under its original scope;
8. if the original generation cannot be reconstructed and verified, mark the item `SUPERSEDED`/`INTERRUPTED` without creating an observation from newer thresholds;
9. leave definitely pending, never-started work eligible under fairness rules;
10. do not resend ambiguous notification attempts.

Recovery is per work item. A bad row or lost fence for one position must not rewrite another stream. Structural database corruption remains a global stop condition.

### 4.6 Configuration changes

- New configuration creates a new immutable generation.
- Existing observations, alerts, deliveries, and cycles are never rewritten.
- A changed account or threshold naturally selects a new monitoring scope.
- Removed/disabled positions receive no new work; their history and pending/terminal deliveries remain readable.
- Pending work from an older generation is not executed with newer configuration values.
- Running work may finish only while its original generation/fence remains valid; otherwise stale writes are rejected and recovery resolves it.
- Multiple entries with one canonical `positionId` reject the complete configuration before any generation or round is persisted.

## 5. Bounded concurrency and resource controls

The values below are conservative architecture recommendations, not provider-capacity claims.

| Control | Initial recommendation | Basis and behavior |
| --- | --- | --- |
| Configured positions | Hard maximum **10**, including disabled entries | Already enforced by Stage 3C parser; higher limits require a separate resource review |
| Concurrent position cycles | **1** | Current reader is expensive, current SQLite ownership is serial, PostgreSQL has one writer connection, and no multi-position throughput is qualified |
| Future concurrency ceiling | At most **2**, disabled until separately qualified | Matches current in-memory scheduler admission ceiling but does not imply provider or database capacity |
| Aggregate RPC/MCP request starts | **1 at a time** through one shared pacer; retain at least 750 ms between starts | Current `RequestPacer` serializes one reader; concurrent independent pacers would multiply load |
| Read retries | Existing maximum **3** per transient operation | Do not multiply attempts for multi-position mode |
| Individual transport timeout | Existing **15 seconds** | `READ_LIMITS.timeoutMs`; no evidence supports raising it |
| Per-position cycle timeout | Existing **240 seconds** | Reuse the qualified cycle bound until measurements justify reduction |
| Coordinator round budget | **600 seconds** local maximum; PostgreSQL parent request remains **300 seconds** and therefore may only materialize/claim bounded work | A round reaching its budget persists remaining items; it does not mark them successful or fabricate failures |
| Pending work per position | At most **1** unstarted item | Coalesce missed due events into a bounded missed-count; never create an unbounded slot backlog |
| Notification drain | Existing maximum per drain and global pending-delivery budget | One shared dispatcher and shared provider cooldown |

### 5.1 Backpressure

- Stop creating new rounds when database, WAL, memory, free-space, or outbox budgets fail.
- Do not cancel already committed observations because another position is backpressured.
- If one position already has `PENDING`/`RUNNING` work, increment a bounded missed/deferred count rather than append another item.
- Prioritize stale unprocessed positions by least-recent completion, not by configuration order alone.
- Provider `Retry-After` remains a global channel cooldown because all positions share the same provider credential/destination.
- Notification severity may prioritize within a fairness window, but one repeatedly critical position must not indefinitely starve other positions' old deliveries.

### 5.2 Slow/unavailable positions

A slow position holds only its one worker slot. With initial concurrency one, it may delay others until its 240-second bound; after timeout it produces a position-specific rejected/failed outcome and the fairness cursor advances. It cannot extend the whole round past 600 seconds. Unstarted items remain persisted and visible as pending/deferred.

### 5.3 Shutdown and cancellation

1. stop admitting rounds and work;
2. abort active position reads and supplemental reads;
3. stop starting notification attempts;
4. allow already returned provider acknowledgments and database commits only within existing shutdown/fence deadlines;
5. mark unresolved work interrupted on recovery, not by unsafe late callbacks;
6. terminalize stale in-flight notification attempts as ambiguous/unknown;
7. close the shared store/pools only after all worker and dispatcher promises settle or are fenced out.

## 6. PostgreSQL scheduler design comparison

### Design A — independent scheduler stream per position

**Shape:** one lease/high-water stream and one externally triggered slot execution for every `positionId`.

| Dimension | Assessment |
| --- | --- |
| Correctness/isolation | Strong if every lease, execution, cycle, and fence key includes `positionId` and scope |
| Concurrency | Natural parallelism; difficult to cap globally across streams |
| Lease/fencing | Requires replacing `worker_lease(id=1)` with a position-keyed lease or new table |
| Crash recovery | Straightforward per position, but coordinator-wide configuration changes are harder to reconcile |
| Fairness | Delegated to external scheduler calls; a missing call can starve one position invisibly |
| Operations | Requires up to ten scheduled invocations or a request containing position identity; expands scheduler attack/configuration surface |
| Schema | Existing lease/execution checks and uniqueness cannot be reused in place safely; additive replacement tables or incompatible key changes required |
| Tests | Per-position duplicate slots, cross-position lease contention, external-call omission, and global capacity tests |

**Decision:** not recommended. It leaks fairness and capacity control into deployment configuration and multiplies external scheduler operations.

### Design B — one global coordinator lease with child position work

**Shape:** one slot request and global fence create a round, then the coordinator processes all child positions under that fence.

| Dimension | Assessment |
| --- | --- |
| Correctness/isolation | Better than a simple loop if child work is persisted, but one global fence couples all writes |
| Concurrency | Simple sequential execution; parallel child work needs subordinate fences anyway |
| Lease/fencing | Existing singleton lease can protect coordinator materialization, but current execution has exactly one `cycle_id` |
| Crash recovery | Parent can recover a manifest; child status tables are still required |
| Fairness | Coordinator can enforce deterministic order |
| Operations | One external call per slot; simplest deployment model |
| Schema | Needs round/work tables and must stop treating `scheduled_executions.cycle_id` as the only cycle; changing the existing non-null unique FK in place is incompatible |
| Tests | Partial parent completion, global lease expiry during child work, and long-round budget exhaustion |

**Decision:** useful as a materialization layer, but insufficient as the complete worker architecture. A global 300-second request cannot safely own ten independently bounded 240-second cycles.

### Design C — bounded worker pool claiming position-specific work

**Shape:** a short global coordinator admission materializes one immutable round and position work items. Workers claim work items using per-item owner/fence/incarnation/deadline. Pool size is one initially. Outbox dispatch has a separate global lease.

| Dimension | Assessment |
| --- | --- |
| Correctness/isolation | Strongest: every write capability is bound to one work item, position, scope, generation, and cycle |
| Concurrency | Explicit bounded pool; initial size one, separately qualifiable up to two |
| Lease/fencing | Requires new per-work claim/fence columns or a position-work lease table; stale workers cannot persist |
| Crash recovery | Deterministic from persisted work state; unfinished positions recover independently |
| Fairness | Central oldest-first/round-robin claim order, bounded missed counts, no dependence on one external call per position |
| Operations | One scheduler admission can materialize work; subsequent bounded claims can occur in the same process/request budget or later approved worker invocations |
| Schema | Additive versioned coordinator/work/outbox lease tables recommended; existing singleton scheduler remains for legacy single-position mode |
| Tests | Largest suite, but ownership and failure semantics are explicit and testable |

**Recommendation:** **Design C**, with Design B's singleton lease retained only for short round materialization. Do not reuse the coordinator fence as a position-work fence.

The scheduler receipt contract must change: a parent receipt reports durable round materialization and bounded work counts, not a single global accepted observation. Per-position cycle acceptance is read separately.

## 7. Persistence and migration assessment

### 7.1 Existing tables that can be reused

| Object | Classification | Assessment |
| --- | --- | --- |
| `streams` | No schema change | Scope primary key already isolates position + thresholds |
| `cycles` | No schema change for position cycles | Existing scope/FK structure works if cycle IDs include work identity and remain globally unique |
| `fingerprints` | No schema change | Alert fingerprint already includes monitoring scope |
| `alerts` | No schema change | Scope and cycle linkage already preserve identity/history |
| `deliveries`, attempts, events | No core schema change | Alert linkage gives position provenance; deterministic delivery identity remains valid |
| `provider_limits` | No schema change | Global channel cooldown is desirable across positions |

Additional indexes may still be required, particularly SQLite scope/history and fair outbox selection indexes.

### 7.2 Required new persistence concepts

| Proposed object/change | SQLite | PostgreSQL | Classification |
| --- | --- | --- | --- |
| Immutable configuration generations | New table | New table | Additive migration |
| Coordinator rounds | New table | New table/versioned scheduler execution | Additive migration |
| Position work items with generation, position, scope, cycle, ordinal, status, counts | New table | New table | Additive migration |
| Position work claims/fences | Not required for a single-process writer; status/version checks still required | Owner, fence, incarnation, claim/deadline on work item or new lease table | Additive migration |
| Scoped assurance audit | New `oracle_assurance_v2` keyed by monitoring scope + continuity context | Same | Additive migration; required for safety |
| Per-position runtime/status | New scope-keyed runtime table or derive from work plus a global coordinator record | Same | Additive migration |
| Scoped operational failures | New versioned event table with scope/work ID | Same | Additive migration |
| Global outbox lease | Process ownership is sufficient locally | New singleton outbox lease independent of position-work fences | Additive migration |
| Fairness indexes | Add scope/age indexes without replacing existing ones | Add work-claim and outbox join/order indexes | Additive migration |

### 7.3 Why scoped assurance is mandatory

Both stores currently query `latestOracleAssurance(context)`, where context is only `LIVE`, `FIXTURE`, or `HISTORICAL-<block>`. In one database, position A's `LIVE` result can become position B's previous assurance. That can create false configuration-change/invalidation behavior or incorrectly carry a sticky baseline.

The runtime must not work around this by encoding position IDs into the existing context string: `continuityScopeSchema` and persisted assurance schemas deliberately constrain that field, and changing it would break historical decoding. A versioned scope column/table is safer.

Existing assurance rows must not be backfilled. The exact legacy demo scope may use old rows only through an explicit legacy reader; all new multi-position writes use the scoped table.

### 7.4 PostgreSQL scheduler incompatibility

Repurposing existing objects in place would be incompatible:

- `worker_lease` has `id=1` and one current execution;
- `scheduled_executions` has one unique namespace/schedule/slot and one required unique cycle FK;
- `Fence` and `assertFence()` target that singleton lease;
- `scheduledIdentity()` omits position/generation;
- delivery claims require the singleton worker lease deadline.

Recommended migration strategy: leave these tables and checks intact for legacy single-position compatibility, and add a versioned coordinator/work lineage. Altering the old primary/check/foreign/unique keys in place is classified **incompatible migration** and is not recommended.

### 7.5 Migration mechanics and compatibility

No executable SQL is authorized. A future migration review must cover:

**SQLite**

- exclusive maintenance ownership and a pre-migration verified backup;
- new migration checksum and `user_version`;
- additive tables/indexes only; no old-row rewrite;
- old binaries will reject a newer schema, so rollback requires restoring the pre-migration database and binary together;
- index/table creation time, WAL growth, free-space reserve, and interruption testing;
- explicit legacy demo assurance fallback tests.

**PostgreSQL**

- new migration version/checksum and a new catalog fingerprint;
- catalog/DDL locks and transaction duration on PostgreSQL 17;
- whether indexes touching existing large tables need a separately planned non-transactional/concurrent procedure (not yet determinable);
- old runtime rejection of catalog drift and new runtime rejection of old migration lineage;
- rollback by restore or forward repair only; dropping new tables after writes would lose coordinator/work history;
- native PostgreSQL fault, fencing, role, and pooler tests before any remote migration.

### 7.6 Grants

Future restricted writer grants should be limited to `SELECT` plus required `INSERT/UPDATE/DELETE` on new runtime tables and sequence usage. The writer must retain no DDL, schema creation, migration-table mutation, database-identity mutation, or ownership rights. The reader receives `SELECT` only. The maintenance authority remains separate.

Actual Neon grants, capacity, and credentials are **not yet determinable** and remain blocked. Reader/writer separation must not be weakened.

## 8. Failure and safety analysis

| Scenario | Expected isolated behavior | Persisted state and recovery | Alerts and financial actions |
| --- | --- | --- | --- |
| Invalid position configuration | Reject complete generation before database/provider work | No generation, round, cycle, observation, or delivery | No alert; no financial action |
| Same position twice | Reject complete generation with duplicate identity error | Nothing persisted | No alert; no financial action |
| One RPC request times out | Only that work item produces unavailable/rejected observation when possible | Position cycle completes rejected; prior accepted baseline survives; fairness advances | Data/read-failure transitions may alert; non-financial only |
| One position is stale | Reject that position's current observation under existing freshness rules | Scoped latest rejected; scoped last accepted unchanged | Data-quality alert as policy dictates; no financial option |
| One position's block regresses/conflicts | Reject only that scope; never replace accepted baseline | Progression reason and diagnostic persisted in that observation | Position-specific warning; no financial option |
| Oracle assurance fails for one position | Assurance gate fails only for that scope | Scoped assurance/invalidation baseline persists | Oracle alerts may be produced; strict recovery eligibility blocks amounts |
| Worker crashes during a cycle | Other work items remain valid; claim eventually expires | Resolve committed hashes if present; otherwise interrupt only its cycle/work item | Recovery may emit conservative `PROCESS_INTERRUPTED` observation under original config; no financial option |
| Lease expires while worker still runs | Abort/cancel worker; all late writes rejected by work-item fence | New worker/recovery owns higher fence | No stale alert/outbox write; no financial option from stale work |
| Stale worker attempts to persist | Before/after fence check fails atomically | No observation/state/outbox mutation | None from stale worker |
| Notification delivery ambiguous | Global dispatcher terminalizes as `PERMANENTLY_FAILED + ambiguous=1`, public `UNKNOWN` | Never automatically due again; manual investigation required | Original alert/action unchanged; no resend-derived duplicate |
| Restart with several incomplete positions | Recover in bounded fair batches by work identity | Each item independently completed/interrupted/superseded; global corruption still stops runtime | Only position-specific conservative recovery alerts; no financial options |
| Configuration changes with pending work | Old work remains bound to old generation; no substitution | Pending old work becomes superseded or runs only under verified old generation; new generation gets new work/scopes | Existing alerts remain; no synthetic financial action from config |
| One persistence transaction fails | Roll back that position's observation/state/alerts/outbox atomically | Work item failed/interrupted; other committed scopes unchanged | No partially persisted alert; no fabricated action |
| Outbox/backlog resource limit reached | Stop admission globally because notification durability is shared | Position transaction rolls back if its alerts cannot enqueue; other history retained | No undeliverable committed alert from that transaction |

For every scenario:

- exactly one Stage 3A suggested action remains required per new alert;
- `actionable:false` remains structural and unconditional;
- amounts appear only in strictly qualified `FINANCIAL_OPTION` actions;
- assurance, freshness, progression, retrieval age, block age, and independent validation remain separate gates;
- one position's latest data is never substituted for another's;
- provider ambiguity is never blindly replayed.

## 9. Read API and operational model

Recommended bounded API shape:

- `GET /api/positions` — maximum 10 summaries, identity and per-position readiness/status only;
- `GET /api/positions/<positionId>` — one position's latest/accepted observation;
- `GET /api/positions/<positionId>/risk`;
- `GET /api/positions/<positionId>/observations?limit=&before=`;
- `GET /api/positions/<positionId>/alerts?limit=&before=`;
- `GET /api/monitoring/status` — coordinator/round counts, never a substitute for per-position readiness;
- `GET /api/readiness` — aggregate false unless every enabled position is independently ready, with bounded position reason summaries.

The HTTP parser must validate a lowercase 64-character `positionId`, reject duplicate/unknown query fields, include `positionId` in cache and in-flight keys, and keep response/page byte limits. It must not accept arbitrary scope digests directly from callers.

CLI compatibility:

- one-position configuration preserves existing commands/output behavior;
- multi-position `status` should list bounded summaries;
- position detail/history commands require an explicit `--position-id` when more than one configured position exists;
- ambiguous omission must fail rather than select the first position;
- the demo fallback remains explicit and keeps `monitor-v1`.

Operational diagnostics must separate:

- process/coordinator health;
- global database/outbox/resource health;
- per-position latest work, freshness, progression, and readiness;
- round partial/pending counts.

A healthy coordinator does not imply every position is current or safe.

## 10. Compatibility strategy

1. Preserve legacy demo scope bytes exactly (`monitor-v1`).
2. Preserve existing configured `monitor-v2` scope derivation.
3. Never rewrite/backfill streams, cycles, observations, alerts, actions, or deliveries.
4. Keep historical alert decoding and legacy action derivation unchanged.
5. Keep existing single-position configuration accepted and route it through compatibility mode with identical public behavior.
6. New multi-position generations reference existing scopes; they do not redefine identity.
7. Existing SQLite/PostgreSQL tables remain readable; new coordinator/assurance/runtime records live in versioned additive tables.
8. Retain old PostgreSQL singleton scheduler tables for the single-position lineage. Do not reinterpret old receipts as multi-position rounds.
9. Pending/delivered/unknown notification records retain their current lifecycle regardless of whether a position is later disabled or removed.
10. Old database versions require explicit maintenance migration before multi-position runtime activation.

Compatibility risks requiring separate approval:

- SQLite schema version increase and rollback-by-restore behavior;
- PostgreSQL migration/catalog fingerprint/grant changes;
- scheduler receipt/API contract versioning;
- old/new binary coexistence is not supported during schema transition;
- scoped assurance cannot be safely implemented from existing context-only rows without a new persistence boundary.

## 11. Test and qualification plan

### 11.1 Required automated tests

**Configuration and identity**

- 2 and 10 valid positions; 11 rejected;
- malformed entry rejects complete generation before store access;
- duplicate canonical identity rejection across case-equivalent addresses;
- disabled entries create no work;
- deterministic generation and work identities independent of property order.

**Isolation**

- two positions with different accounts never share stream state, episodes, progression, assurance baseline, cycles, alerts, or actions;
- different thresholds for the same canonical position create distinct scopes without rewriting history;
- oracle invalidation/sticky baseline for A never appears in B;
- block regression/stall/failure for A leaves B's last accepted state unchanged;
- every financial option exactly matches its own position/snapshot/block/configuration.

**Coordinator and resources**

- three and ten positions schedule in deterministic fair order;
- concurrency never exceeds one initially;
- one slow position times out and the fairness cursor advances;
- shared pacer enforces aggregate request spacing across positions;
- no more than one pending work item per position;
- whole-round timeout persists partial counts and leaves unstarted work visible;
- outbox/database/memory pressure stops admission without corrupting committed scopes;
- shutdown cancels active work and starts no new work.

**Persistence and recovery**

- atomic per-position observation/state/alert/outbox commit;
- crash before cycle creation, during read, during commit, after commit acknowledgment loss, and during round completion;
- several incomplete positions recover independently in bounded batches;
- old configuration generation is never resumed with new thresholds;
- stale work fence cannot write state, alerts, deliveries, runtime, or completion;
- pruning retains each scope's latest/accepted references and newest scoped assurance baseline;
- legacy unscoped assurance remains readable only through explicit compatibility behavior.

**Notifications**

- independent alert/delivery identities across positions;
- one shared dispatcher and provider cooldown;
- fair due selection under repeated critical alerts;
- unambiguous bounded retries unchanged;
- timeout/interruption/acknowledgment uncertainty remains terminal unknown and is never automatically replayed.

**Read/operations**

- bounded position list and exact position detail/history;
- unknown/invalid position IDs rejected;
- cache keys cannot cross positions;
- aggregate readiness fails when any enabled position is unready and preserves per-position reasons;
- one-position CLI/API snapshots remain byte/shape compatible where promised.

### 11.2 Native PostgreSQL evidence

Minimum native PostgreSQL 17 evidence:

- concurrent claims never assign one work item twice;
- different work items may be processed only up to configured pool size;
- lease expiry and higher fence reject stale writers;
- round materialization is idempotent after commit-unknown;
- position observation commit is idempotently resolvable after commit-unknown;
- worker crash/restart recovery for multiple items;
- outbox lease is independent of position-work leases;
- ambiguous delivery remains terminal unknown after worker/coordinator death;
- reader/writer role matrix for every new table/sequence;
- migration checksum and catalog fingerprint validation;
- direct and transaction-pooler behavior using local fixtures;
- no residual PostgreSQL processes/directories after tests.

### 11.3 Minimum GO evidence

Implementation cannot receive GO until all of the following are true:

1. focused multi-position suites pass with zero failures;
2. the complete existing unit suite passes unchanged except intentional additions;
3. native PostgreSQL integration passes all old and new lease/fence/fault cases;
4. TypeScript, full ESLint, production build, schema/catalog checks, and secret scan pass;
5. exact migration preservation/rollback evidence is reviewed separately;
6. no test shows cross-position assurance, progression, history, action, or delivery contamination;
7. ambiguous delivery replay remains impossible;
8. single-position demo/configured regression behavior remains qualified;
9. no real provider, Neon, deployment, or scheduler activation is required for local acceptance.

## 12. Phased implementation proposal

Effort estimates are engineering ranges, not delivery commitments. They assume the current reviewed market only.

### Phase D1 — Multi-position configuration set and pure planning model

- **Objective:** replace singular runtime composition with a bounded immutable position set/generation while retaining a one-position compatibility adapter.
- **Likely source areas:** `src/config/position.ts`, `src/config/runtime.ts`, `src/positions/model.ts`, new pure coordinator model modules.
- **Dependencies:** none beyond Stage 3C.
- **Tests:** list validation, duplicate rejection, generation fingerprint, deterministic work identities, legacy one-position composition.
- **Acceptance:** no store/network access; multi-position runtime remains disabled.
- **Migration:** none.
- **Risk:** accidentally changing legacy scope/fingerprint semantics.
- **Effort:** 2–3 engineering days.

### Phase D2 — Coordinator/runner separation with fake persistence

- **Objective:** extract position-cycle processing from store ownership, dispatcher, pruning, runtime status, and shutdown; define round/work state machines.
- **Likely source areas:** `src/monitoring/service.ts`, new `src/monitoring/coordinator.ts`, new position runner/work model, `src/storage/persistence.ts` interfaces.
- **Dependencies:** D1.
- **Tests:** in-memory/fake two-position isolation, fairness, bounded concurrency one, cancellation, partial outcomes, no external reads.
- **Acceptance:** no production runtime path can enable multiple positions; all Stage 3A/B gates unchanged.
- **Migration:** none for pure/fake tests.
- **Risk:** separating dispatcher/store lifecycle without changing single-position behavior.
- **Effort:** 4–6 engineering days.

### Phase D3 — SQLite additive persistence migration

- **Objective:** persist generations, rounds, position work, scoped assurance, and per-position runtime/failures.
- **Likely source areas:** `src/storage/migrations.ts`, `src/storage/store.ts`, schema validation, backup/restore/integrity tests.
- **Dependencies:** separate migration approval, D2.
- **Tests:** migration on exact legacy fixtures, interruption, rollback-by-restore, pruning, multi-position restart, lock/WAL/resource limits.
- **Acceptance:** no old row rewritten; old single-position history readable; scoped assurance proved isolated.
- **Migration:** **required; separately approved**.
- **Risk:** schema-version compatibility and inability to downgrade without restore.
- **Effort:** 5–8 engineering days plus review.

### Phase D4 — Local coordinator, CLI, HTTP, dashboard demonstration

- **Objective:** enable a submission-ready local two-position sequential demonstration.
- **Likely source areas:** `src/runtime/service.ts`, `src/cli/monitor.ts`, option parsing, `src/runtime/read-model.ts`, `src/runtime/http.ts`, dashboard, diagnostics.
- **Dependencies:** D2–D3.
- **Tests:** local two/three-position lifecycle, APIs, one-position regression, fair scheduling, shared pacer/dispatcher, bounded shutdown.
- **Acceptance:** maximum concurrency one; no real notifications; synthetic/fixture demonstration; aggregate readiness conservative.
- **Migration:** SQLite D3 required.
- **Risk:** response-size/cache isolation and long rounds.
- **Effort:** 4–6 engineering days.

### Phase D5 — Shared transport and measured resource qualification

- **Objective:** enforce one aggregate pacer across positions and collect local evidence for queue latency/resource bounds without sharing financial evidence.
- **Likely source areas:** `src/monitoring/reader.ts`, `src/chain/transport.ts`, coordinator dependency injection, resource diagnostics.
- **Dependencies:** D4.
- **Tests:** aggregate spacing, timeout/fairness, ten configured positions with bounded synthetic reads, memory/database/outbox budgets.
- **Acceptance:** no claim of provider capacity; concurrency remains one unless a separate two-worker qualification passes.
- **Migration:** none beyond D3.
- **Risk:** MCP session/client lifecycle under shared pacing.
- **Effort:** 3–5 engineering days.

### Phase D6 — PostgreSQL v3 coordinator/work/outbox migration

- **Objective:** implement Design C with parent materialization, per-work fences, scoped assurance, and independent outbox lease.
- **Likely source areas:** `src/storage/postgres/migrations.ts`, catalog fingerprint, database/store/scheduler-store, scheduler contract/runner, role fixtures, PostgreSQL runtime.
- **Dependencies:** separate PostgreSQL migration authority, D1–D5 architecture proven locally.
- **Tests:** full native PostgreSQL matrix in §11.2.
- **Acceptance:** legacy scheduler lineage remains readable; stale work cannot write; commit-unknown resolution proved; writer/reader separation preserved.
- **Migration:** **required; separately approved**.
- **Risk:** highest—lease correctness, catalog drift, role grants, pool limits, and receipt compatibility.
- **Effort:** 10–15 engineering days plus migration/security review.

### Phase D7 — Qualification and release evidence

- **Objective:** complete regression, fault, preservation, migration, and local demonstration evidence.
- **Likely source areas:** tests, local fixtures, documentation, evidence scripts only after implementation approval.
- **Dependencies:** applicable prior phases.
- **Acceptance:** minimum GO evidence in §11.3.
- **Migration:** validates but does not authorize remote migration.
- **Risk:** untested performance/backpressure assumptions.
- **Effort:** 5–8 engineering days.

### Effort summary

- Pure code/design foundation before migrations: approximately **6–9 engineering days**.
- Submission-ready local two-position demonstration after approved SQLite migration: approximately **15–23 engineering days total**.
- Full PostgreSQL-capable implementation and qualification: approximately **30–46 engineering days total**, excluding remote operations, credential remediation, deployment, or real-provider qualification.

## 13. Authorization boundaries

### Recommended next authorization

**CONDITIONAL GO** for Phase D1 and Phase D2 only, after a separate implementation request:

- pure multi-position configuration-set model;
- pure coordinator/work state machines;
- position-cycle runner interface separation;
- deterministic fake/in-memory tests;
- no multi-position production/runtime activation;
- no schema changes.

### Separate approval required

- any SQLite migration or database-init behavior change;
- any PostgreSQL migration, catalog fingerprint, grant, scheduler, lease, fence, or receipt change;
- enabling multi-position monitoring in CLI/runtime;
- remote database access, Neon, DDL/DML, or credential use;
- deployment or scheduler activation;
- real Telegram/Discord qualification;
- concurrency greater than one;
- new chains, markets, protocols, assets, discovery, signing, or broadcasting.

## 14. Final recommendation

**CONDITIONAL GO.**

The identity/scope/risk/action/outbox foundations are suitable, and limited code-only architecture work can begin without a migration. A safe persisted multi-position runtime cannot begin without resolving scoped assurance, round/work persistence, runtime status, and PostgreSQL scheduler/fencing through separately reviewed additive migrations.

Do not implement a multi-position loop around the current `MonitoringService`. Do not alter or bypass the singleton PostgreSQL lease. Do not activate multiple positions until migration, recovery, fairness, read-model, and notification-isolation tests meet the evidence gate in §11.
