# Stage 3 — Product Completion Plan

**Prepared:** 2026-11-05  
**Scope:** evidence-based planning only  
**Executive recommendation:** complete the local product in small safety-preserving stages; keep Neon migration, remote persistence and production deployment **NO-GO**

## 1. Executive recommendation

Liquidation Watchdog has a strong local technical base:

- exact Morpho position/risk arithmetic for one pinned demonstration position;
- strict oracle-assurance, freshness and chain-progression gates;
- fail-closed recovery eligibility and unconditional `actionable:false`;
- durable SQLite monitoring/outbox behavior;
- a PostgreSQL adapter that passes 60/60 native PostgreSQL 17.11 integration tests;
- 933/933 current unit tests;
- configurable warning, critical and target thresholds in CLI and runtime code;
- timestamped alert rendering and bounded console/Telegram/Discord adapters.

It is not yet a complete monitoring product. The main local product gaps are:

1. every alert lacks a typed, mandatory concrete suggested action;
2. the PostgreSQL runtime configures no notification adapters;
3. the product supports only one compiled-in public demonstration position;
4. no current authorized live acceptance run establishes advancing chain/oracle readiness;
5. no one exact runtime has demonstrated multi-position monitoring, configured thresholds, durable state, real delivery and recovery together.

The recommended first implementation stage is **Stage 3A — Typed Suggested Actions**. It is local, bounded, testable without credentials or external services, and directly closes the only unconditional alert-content acceptance failure. It must not add transaction execution or make a financial estimate actionable.

Infrastructure work remains a separate blocked track. No local-product milestone authorizes Neon migration, writer-as-reader substitution, deployment, scheduler activation, real notifications, signing or broadcasting.

## 2. Current verified baseline

### 2.1 Verified implementation and evidence

| Capability | Status | Evidence boundary |
| --- | --- | --- |
| Exact risk/accounting arithmetic | VERIFIED locally | Unit/fixture coverage; historical chain captures; no current acceptance read |
| Threshold parsing/order/config file | VERIFIED locally | Exact decimal/WAD tests and native custom-scope test |
| Monitoring transitions/state/outbox | VERIFIED locally | SQLite/unit and native PostgreSQL tests |
| PostgreSQL schema/roles/persistence | VERIFIED locally | Native PostgreSQL 17.11, 60/60 |
| Progression states and persistence | VERIFIED locally | Phase 12C tests and native JSON round trip |
| Recovery eligibility | VERIFIED locally | Adversarial Phase 12B/12C tests |
| Readiness age/progression/assurance separation | VERIFIED locally | Read-model tests and native integration |
| `actionable:false` | VERIFIED structurally | Zod literals, DB constraint, unit/native tests |
| Writer direct/pooled Neon transport | VERIFIED read-only | Stage 1D only; no remote persistence |
| Reader Neon transport | BLOCKED | No valid qualified reader credential |
| Notification provider adapters | PARTIALLY VERIFIED | Code and mocked HTTP tests; no PostgreSQL runtime wiring/real acceptance |
| Multiple positions | NOT IMPLEMENTED | Identity is compiled in `DEPLOYMENT` |
| Mandatory suggested action | NOT IMPLEMENTED | Alert schema has only code/reason/current/previous |
| Live oracle assurance/freshness | NOT VERIFIED | Production evidence remains `UNVERIFIED`/`UNKNOWN` |
| Production runtime/deployment | NO-GO | Undeployed drafts; scheduler disabled; infrastructure blockers |

### 2.2 Current safety invariants

The following are requirements for every Stage 3 change:

1. `actionable:false` remains unconditional in risk, recovery estimates, observations, alerts and APIs.
2. No signing, transaction construction, simulation-to-send bridge or broadcasting is introduced.
3. A financial amount is never invented, rounded from display text or copied across snapshots.
4. Financial suggestions may reference only strict-gate-qualified estimates bound to the same snapshot/block/hash/configuration.
5. Oracle assurance, oracle freshness, chain progression, block age and retrieval age remain independent dimensions.
6. Missing/conflicting/stale/unverified evidence yields a safe non-financial instruction and no amount.
7. Reader and writer identities remain distinct; no writer-as-reader fallback.
8. Fixtures and historical reads remain explicitly labeled and cannot satisfy live readiness.
9. Existing persisted data remains readable; schema changes require versioning/backward compatibility and separate approval.
10. External side effects require explicit later approval and controlled destinations.

### 2.3 Source behavior relevant to planning

- `src/config/deployment.ts` fixes one chain, market and public demonstration account.
- `src/monitoring/observation.ts` computes assurance and progression independently, then invokes strict assured risk.
- `src/risk/eligibility.ts` requires every data/identity/progression/oracle gate.
- `src/monitoring/transitions.ts` creates alert codes but no suggested action.
- `src/notifications/format.ts` renders timestamp and reason, not a required instruction.
- `src/runtime/service.ts` wires a console adapter for the local SQLite runtime.
- `src/runtime/postgres-runtime.ts` wires `adapters: []`.
- `src/notifications/adapters.ts` has bounded console, Telegram and Discord implementations.
- `src/postgres-service.ts` loads runtime thresholds from an explicit risk-config path.
- current read models expose one compiled-in position identity.

## 3. Product acceptance gap analysis

| Product requirement | Current state | Gap |
| --- | --- | --- |
| Monitor collateral/debt/risk | PARTIALLY VERIFIED | One pinned demonstration position only; no current live acceptance |
| Runtime warning/critical thresholds | VERIFIED locally | Deployment configuration/release binding not demonstrated |
| Timestamped alerts | VERIFIED in schema/formatter | PostgreSQL runtime has no channel adapters; no deployed delivery |
| Concrete suggested action on every alert | FAIL / NOT IMPLEMENTED | Reason text is not an instruction; no typed field |
| At least one working notification channel | PARTIALLY VERIFIED | Local console and mocked HTTP only; no approved real destination |
| Multiple independent positions | NOT IMPLEMENTED | Global deployment constants and one scope/read model |
| Live progression/readiness | PARTIALLY VERIFIED | Correct implementation; no current live acceptance evidence |
| Oracle freshness/independence | NOT VERIFIED | No qualified heartbeat/source/independent comparator evidence |
| Restart/dedup/recovery | VERIFIED locally | Not deployed/remote-qualified |
| Backup/restore | NOT VERIFIED | No product-level recovery acceptance |

## 4. Track A — Local product completion

## A. Mandatory concrete suggested actions

### A.1 Model

Introduce a versioned, strictly bounded action model. Likely new modules:

- `src/actions/model.ts`
- `src/actions/derive.ts`
- optionally `src/actions/render.ts`

Proposed shape:

```text
SuggestedAction {
  schemaVersion: 1
  kind: SAFE_REFRESH | REVIEW_POSITION | VERIFY_ORACLE |
        CONDITIONAL_RECOVERY_OPTIONS | CONTINUE_MONITORING
  instruction: bounded human-readable text
  rationaleCodes: bounded enum[]
  observedAt: UTC
  actionable: false
  evidence: {
    cycleId, snapshotIdentifier, blockNumber, blockHash, blockTimestamp,
    progressionState, progressionReason,
    oracleAssurance, oracleFreshness
  }
  options: SuggestedFinancialOption[]
}

SuggestedFinancialOption {
  type: REPAY | ADD_COLLATERAL
  amountRaw, amountFormatted
  tokenAddress, decimals
  targetRatio
  calculationMethod
  snapshotIdentifier, blockNumber, blockHash, calculatedAt
  instructionQualifier
  actionable: false
}
```

No free-form provider text enters the model. `kind`, rationale and option type are exhaustive enums. Instructions are derived from trusted code and bounded.

### A.2 Generation boundary

Financial calculation remains exclusively in the risk pipeline:

1. `calculateAssuredRisk()` evaluates strict recovery eligibility.
2. `applyRecoveryEstimates()` remains the only solver caller.
3. `observe()` persists only exact validated risk/progression/assurance results.
4. `transition()` chooses an alert code and calls a pure action derivation function using that validated observation.

The action layer never computes an amount. It may only reference an already-present recovery estimate whose provenance matches the current risk view.

To avoid duplicated gate logic, persist a bounded recovery-eligibility summary in the monitored risk view (eligible/status/reason codes), with backward-compatible historical decoding. The action generator requires:

- accepted observation;
- `recoveryEligibility.eligible=true`;
- `progression=ADVANCING`;
- assurance overall/gate/freshness/independent validation verified;
- no invalidation/configuration change/timestamp anomaly;
- action-time block age within the configured rejection bound;
- exact estimate/snapshot/block/hash/calculated-at binding.

Retrieval recency may reject old data but can never establish freshness or progression.

### A.3 Safe fallback actions

Every alert code maps exhaustively to a safe instruction even when no amount exists:

| Condition/code family | Required action kind |
| --- | --- |
| unavailable/invalid/stale/read failure | `SAFE_REFRESH`: do not transact; refresh and independently verify position/oracle |
| oracle/configuration/independent disagreement | `VERIFY_ORACLE`: stop financial interpretation; verify source/configuration |
| warning/critical/boundary with blocked estimates | `REVIEW_POSITION`: review named position now; refresh before considering changes |
| verified/fresh/advancing with eligible estimates | `CONDITIONAL_RECOVERY_OPTIONS`: present exact repayment/collateral options as conditional, non-actionable decision support |
| recovery/no debt/improvement | `CONTINUE_MONITORING`: verify current state and continue monitoring; no “safe” claim |

### A.4 Persistence compatibility

Adding a required field directly to current `alertSchema` would make historical alert JSON fail strict parsing. Implement separate stored/current schemas or a versioned legacy upgrader:

- hash original bytes before parsing;
- accept legacy alerts without action;
- deterministically derive a conservative non-financial legacy action on read;
- require action on every newly emitted alert;
- never rewrite historical rows automatically.

No SQL migration should be needed because alert payloads are JSON text, but SQLite/PostgreSQL schema/catalog fingerprints and release evidence must still be checked.

### A.5 Acceptance

- every alert code produces one nonempty typed action;
- every rendered message includes `Action:` and timestamp;
- no blocked observation contains a financial option;
- no unverified/unknown/stale/conflicting state contains an amount;
- eligible options exactly match persisted recovery estimate provenance;
- all actions remain `actionable:false`;
- historical alerts remain readable and hash-valid.

## B. Notification delivery

### B.1 Architecture

Retain the existing durable outbox and adapter interface. Do not add provider calls to observation transactions.

Likely modules:

- `src/config/monitoring.ts`
- `src/config/runtime.ts`
- `src/notifications/types.ts`
- `src/notifications/adapters.ts`
- `src/notifications/dispatcher.ts`
- `src/notifications/format.ts`
- `src/runtime/postgres-runtime.ts`
- `src/postgres-service.ts`
- `src/runtime/service.ts`
- `src/cli/monitor.ts`
- runtime/deployment config tests

The PostgreSQL entrypoint must resolve one full non-secret monitoring configuration, not reconstruct only cadence/default notifications. It should inject explicitly enabled adapters into `PostgresRuntime`. Provider credentials remain named environment secrets read only when that provider is enabled.

### B.2 Initial channel

Local completion can use console delivery because it has no credential/external cost. Production-capable acceptance later should select Telegram or Discord from existing adapters, or add email as a separate adapter stage.

Do not claim a real channel works from mocks. A real test alert requires separate approval, controlled destination and disposable test identity.

### B.3 Semantics

- observation/state/alert/delivery creation remains atomic;
- deterministic `(alert_id, channel)` uniqueness prevents duplicate outbox rows;
- terminal delivered rows are never resent;
- in-flight claim owner/fence/incarnation/deadline is checked;
- retry remains bounded exponential backoff with jitter and provider Retry-After;
- 429 applies channel-wide cooldown;
- unknown provider acceptance remains explicit `ambiguous=true` and may duplicate;
- messages include alert ID, timestamp and typed suggested action so an operator can identify duplicates;
- missing/invalid credentials fail startup before writable monitoring begins;
- provider outage never changes risk/observation truth.

### B.4 Extensibility

Keep `NotificationAdapter` narrow (`channel`, `send(alert, signal)`). Provider-specific delivery receipts should be normalized without storing secrets/body text. Email should be a future adapter with allowlisted host/TLS and no generic arbitrary webhook transport.

## C. Multiple-position monitoring

### C.1 Identity model

Introduce strict position configuration:

```text
PositionIdentity {
  positionId: digest(chainId, protocol, protocolAddress, marketId, account)
  chainId
  account
  protocol: MORPHO_BLUE
  protocolAddress
  marketId
}
```

Initial local implementation should support multiple explicitly configured Morpho positions on the already reviewed chain/protocol. Cross-chain/arbitrary-contract support should be a later security review.

Likely modules:

- new `src/positions/model.ts`
- new `src/config/positions.ts`
- refactor `src/config/deployment.ts` into reviewed defaults/allowlist
- `src/chain/snapshot.ts`
- `src/monitoring/reader.ts`
- `src/monitoring/model.ts`
- `src/monitoring/service.ts`
- new local coordinator, e.g. `src/monitoring/coordinator.ts`
- risk provenance/validation/read models/dashboard/CLI options
- storage and integration tests

### C.2 Isolation

- monitoring scope includes position identity plus exact threshold configuration;
- per-position state, episodes, fingerprints, latest/accepted baselines and progression never cross;
- cycle IDs include deterministic position identity;
- failures in one position persist a diagnostic for that position and do not suppress others;
- threshold defaults may be shared, but overrides are resolved per position and fingerprinted;
- read API returns a bounded position list and position-specific detail/history.

### C.3 Orchestration

Implement local configured-position orchestration before discovery:

- validate a bounded list at startup (proposed maximum initially 10);
- reuse transport pacing where safe, but pin each position observation independently;
- process sequentially or with very small bounded concurrency;
- enforce total cycle deadline and per-position timeout;
- expose partial completion/failure counts without claiming the whole cycle fresh;
- retain global provider cooldown/backpressure.

PostgreSQL's current `scheduled_executions` links one scheduled execution to one cycle. Do not silently force multiple positions through one cycle identity. Local SQLite orchestration can be completed first; PostgreSQL multi-position scheduling requires a separately reviewed schema/scheduler design and migration authority, so it remains in Track B.

### C.4 Discovery

Add discovery only after configured multi-position monitoring is stable:

- explicit account allowlist;
- reviewed Morpho contract/chain only;
- bounded event-log range or approved indexer;
- deduplicate by canonical position identity;
- discovered positions begin `PENDING_REVIEW`, not automatically monitored/actioned;
- operator approval promotes a discovered identity into configuration;
- removed/closed positions retain history and a tombstone.

Discovery provider failure must not remove configured positions or overwrite accepted state.

## D. Live chain and oracle assurance

### D.1 Chain readiness

Retain and extend current checks:

- exact configured chain ID on RPC and MCP;
- before/after header identity and pinned block reads;
- common head selection and provider-head bounds;
- strict progression states and same-height hash conflict;
- separate block age and retrieval age;
- bounded stalled-observation window;
- no advancement inference from HTTP success or recent retrieval.

For multiple positions on one chain, share only independently validated head/header evidence for the same cycle; each position retains its own observation binding.

### D.2 Oracle assurance

Actual live readiness requires configuration-bound evidence for:

- exact oracle/feed/proxy/cache/forwarder identity and implementation;
- source/operator provenance;
- quote/base units and price semantics;
- verified timestamp meaning;
- verified heartbeat or upstream freshness guarantee;
- on-chain expiry behavior if claimed;
- configuration-control changes and sticky invalidation;
- genuinely independent normalized price source with explicit tolerance.

RPC/MCP agreement remains consistency evidence, not independent oracle validation.

### D.3 Conflicts and missing evidence

- missing provider/head/oracle evidence => `UNKNOWN`/blocked;
- regressed block/timestamp => rejected observation and retained baseline;
- same-height different hash => conflict and unready;
- stale oracle/block => no financial suggested option;
- independent disagreement => assurance failure, alert with `VERIFY_ORACLE` action;
- successful retrieval never upgrades unknown assurance.

### D.4 External qualification boundary

Local fixtures/mocks prove logic only. A current live acceptance run requires separate network approval, fixed evidence directory, exact endpoint/identity binding and no financial side effects. No signing/broadcast is ever part of readiness qualification.

## E. End-to-end product acceptance

One exact candidate release must prove all ten requested outcomes together, not as unrelated fixtures:

1. two or more configured positions are monitored with isolated identities/state;
2. runtime threshold files produce position-specific warning/critical behavior;
3. warning, critical, improvement, recovery and bad-data transitions are correct;
4. every alert contains UTC timestamp and typed suggested action;
5. after separate approval, one controlled supported channel delivers a real test alert;
6. duplicate outbox rows are prevented and ambiguous retry behavior is visible;
7. restart/process death preserves accepted state, episodes, deduplication and delivery ambiguity;
8. stale/unavailable/conflicting/unverified evidence yields no financial action option;
9. oracle assurance/freshness/progression each fail independently;
10. every persisted/API/rendered action and estimate remains `actionable:false`.

Acceptance must also prove no secrets in output, no user-wallet claim for demonstration data, and no signing/broadcast path.

## 5. Track B — Infrastructure readiness (blocked)

Track B is independent from local product completion and cannot be pulled forward by successful local tests.

| Blocker | Required future evidence | Authority/dependency |
| --- | --- | --- |
| Reader credential | Recover valid existing secret or approve a new restricted reader role; direct+pooled read-only qualification | Operator credentials/approval; no writer substitution |
| A4.5 migration authority | Named independent signer, immutable runner, dual credential brokers, CAS/consumed records, WORM/Rekor, adversarial tests, hard budget | External infrastructure/security/budget approval |
| Schema/grants | Exact two migrations/checksums/catalog, separate owner, exact positive/forbidden grant matrix | A4.5 first, then migration/grant approval |
| Remote persistence | Synthetic child-branch writer observation plus true reader projections and post-test inventory | Schema/reader plus explicit write approval |
| TEMP policy | Branch-role/workflow impact review; database-wide PUBLIC decision | DB privilege approval |
| Backup/restore | Pre/post logical backup, independent hash/WORM receipt, restore into separate disposable target | Storage/provider approval, possible cost |
| Free plan | Measured storage/index/TOAST/dead tuples, compute/egress, cold start, quotas, backlog/retention | Operational testing/telemetry |
| Supervision/telemetry | Exact release, process manager, scheduler, DB/pool/backlog/unknown-commit/backup metrics | Deployment/scheduler approval |

If the reader password is not reset, valid alternatives remain recovery of the existing secret or creation of a new restricted reader role under separate approval. Without a distinct reader credential, Neon runtime activation is impossible.

## 6. Proposed staged implementation sequence

## Stage 3A — Typed Suggested Actions (**recommended first**)

**Objective:** make every newly emitted alert contain a safe, meaningful, typed action while preserving unconditional non-actionability.

**Likely files:**

- new `src/actions/model.ts`, `src/actions/derive.ts`, possibly `src/actions/render.ts`;
- `src/risk/types.ts`, `src/monitoring/model.ts`, `src/monitoring/transitions.ts`;
- `src/notifications/format.ts`;
- `src/runtime/read-model.ts`, `src/runtime/dashboard.ts`;
- SQLite/PostgreSQL codecs only if needed for backward-compatible alert parsing;
- tests for actions, transitions, notifications, storage, read model and native PostgreSQL JSON round trip.

**Dependencies:** none external; current Phase 12 gates.

**Acceptance:** exhaustive alert-code mapping; safe fallback always; financial option only through strict eligible estimate; timestamp/provenance/units present; legacy alerts readable; `actionable:false` literal everywhere.

**Automated tests:** pure derivation table, every alert code, each failed gate independently, stale block age, provenance mismatch, legacy decode/hash, formatter/channel payload, SQLite restart, native PostgreSQL round trip, full suite/type/lint/build.

**Manual verification:** render representative warning/critical/data/oracle/recovery alerts; verify no “safe” claim or command to transact.

**Risks:** duplicated gate logic, historical incompatibility, misleading financial wording. Mitigate by consuming persisted eligibility, versioning schemas and using conditional language.

**Rollback:** feature/version gate new alert creation; retain legacy decoder; revert code without rewriting stored rows.

**Approval gate:** explicit local implementation approval only. No network or credentials.

## Stage 3B — Runtime Notification Wiring

**Objective:** inject explicitly configured adapters into PostgreSQL/local runtimes while retaining the durable outbox.

**Likely files:** monitoring/runtime config, notifications modules, `postgres-service.ts`, both runtime constructors, CLI, deployment config tests.

**Dependencies:** Stage 3A message/action schema.

**Acceptance:** console path local; enabled provider requires valid secret before writes; disabled provider reads no secret; outbox atomic; retries/cooldown/ambiguity preserved; every payload includes action/timestamp.

**Tests:** adapter config, provider mock matrix, startup fail-closed, outbox restart, duplicate channel, rate limit, cancellation, PostgreSQL native synthetic console cycle.

**Manual verification:** local console only. Real Telegram/Discord/email test deferred to separate approval.

**Risks:** secret leakage, duplicate external messages, provider outage. Preserve redaction and at-least-once disclosure.

**Rollback:** disable provider flags; console-only local mode; never delete delivery history.

**Approval gate:** local implementation; separate later external-delivery approval/credentials.

## Stage 3C — Position Identity and Configuration Foundation

**Objective:** replace global position assumptions with validated configured identities while retaining the existing position as a backward-compatible default fixture/profile.

**Likely files:** new positions/config modules; deployment defaults; snapshot/validation/provenance; monitoring scope/model; CLI/runtime/read API/dashboard.

**Dependencies:** explicit product decision for initial supported chain/protocol and maximum positions.

**Acceptance:** deterministic identity, strict bounded config, per-position thresholds/scope, no cross-position baseline/fingerprint, historical default compatibility.

**Tests:** malformed/duplicate identities, scope collisions, threshold isolation, serialization, default parity, cross-position rejection.

**Manual verification:** inspect rendered identities/config fingerprints; no chain call.

**Risks:** identity collision, arbitrary-contract reads, history mixing. Start Pharos/Morpho allowlisted only.

**Rollback:** default single-position profile remains supported; do not rewrite history.

**Approval gate:** local design/implementation approval.

## Stage 3D — Local Multi-Position Orchestration

**Objective:** monitor multiple configured positions locally with bounded use and failure isolation.

**Likely files:** monitoring coordinator, service/reader, configuration, SQLite persistence/read APIs/dashboard, tests.

**Dependencies:** Stage 3C; local schema compatibility review.

**Acceptance:** at least two fixture positions, independent transitions/actions/dedup/restart, bounded sequential/small concurrency, one failure does not suppress another, aggregate readiness is conservative.

**Tests:** mixed warning/critical/no-debt, provider failure isolation, restart, rate budget, cancellation, per-position pagination.

**Manual verification:** local fixture/SQLite only.

**Risks:** RPC amplification and scheduler identity. PostgreSQL multi-position scheduling/schema remains blocked in Track B.

**Rollback:** position list max=1 restores prior operation without deleting other histories.

**Approval gate:** local implementation; no live network.

## Stage 3E — Position Discovery (optional, separately bounded)

**Objective:** discover candidate Morpho positions for configured accounts without auto-monitoring them.

**Likely files:** new discovery model/service, chain client log/indexer capability, operator CLI/API, config promotion path.

**Dependencies:** Stage 3C/D and approved discovery provider strategy.

**Acceptance:** bounded range/results, canonical dedup, pending-review state, explicit promotion, no silent deletion, provider failure isolation.

**Tests:** mocked logs/indexer, replay/dedup, bounds, unsupported chain/protocol.

**Manual verification:** no live provider until separate approval.

**Risks:** incomplete discovery, rate cost, malicious indexer. Configured positions remain authoritative.

**Rollback:** disable discovery; retain configured positions and candidate tombstones.

**Approval gate:** local implementation; later network approval.

## Stage 3F — Live Readiness and Oracle Evidence Qualification

**Objective:** establish current chain/oracle readiness for monitored identities without enabling financial action.

**Likely files:** oracle evidence/configuration/freshness/independent modules, chain progression/readiness, config, API/dashboard, evidence capture tests.

**Dependencies:** source/operator/heartbeat/timestamp evidence and eligible independent comparator; separate network approval.

**Acceptance:** current advancing blocks, block-age bound, verified timestamp semantics/heartbeat, independent normalized comparison, each gate independently visible/failing, no amount when any fails.

**Tests:** local fixtures first; authorized live capture later with immutable evidence.

**Manual verification:** independent review of evidence and current capture.

**Risks:** false assurance, shared upstream, stale metadata, provider cost. Default remains unverified/blocked.

**Rollback:** remove/revoke evidence config; sticky invalidation blocks estimates.

**Approval gate:** separate research/network/evidence approval.

## Stage 3G — Local End-to-End Acceptance Candidate

**Objective:** run all Track A capabilities together locally before any infrastructure activation.

**Likely files:** primarily tests/evidence/docs; implementation fixes only under separate sub-approval.

**Dependencies:** 3A–3D; 3E optional; 3F local logic.

**Acceptance:** ten-point matrix in section E passes on exact build with two positions, config thresholds, action-bearing alerts, durable console delivery, restart/dedup and independent gate failures.

**Tests:** full unit, SQLite lifecycle, native PostgreSQL where schema supports candidate, process kill, type/lint/build, preservation.

**Manual verification:** local rendered dashboard/alerts; no external send.

**Risks:** passing disconnected components rather than one runtime. Use one candidate process/evidence bundle.

**Rollback:** candidate remains local/unreleased; no data migration.

**Approval gate:** local acceptance approval only.

## Track B future stages — remain blocked

Only after independent approvals:

- **B0 Reader decision/qualification**
- **B1 A4.5 security infrastructure prototype and adversarial qualification**
- **B2 One-use child-branch migration, grants and backup**
- **B3 Synthetic Neon persistence/read-model qualification**
- **B4 Capacity, backup/restore and operational qualification**
- **B5 Controlled provider notification acceptance**
- **B6 Production deployment and final product acceptance**

None is authorized by this plan.

## 7. Acceptance test matrix

| Requirement | Local automated evidence | Manual/local evidence | External evidence later |
| --- | --- | --- | --- |
| Multiple positions | Two+ configured fixtures, isolated scopes/state | Dashboard/CLI identity review | Optional current-chain reads |
| Runtime thresholds | Per-position config/restart/custom scope | Inspect active config/fingerprint | Exact deployment config |
| Warning/critical transitions | Exact ratio boundary table and multi-position cycles | Render transition examples | Current authorized position if approved |
| Timestamp + action every alert | Schema exhaustiveness, formatter/adapters | Review all code families | One controlled delivered alert |
| Notification delivery | Console/native outbox; mocked HTTP matrix | Local console receipt/history | Telegram/Discord/email controlled destination |
| Duplicate control | Unique delivery identity, retry/ambiguity/restart | Inspect duplicate indicator | Provider ambiguous-response test if approved |
| Restart recovery | SQLite/native PG restart/process kill | Inspect persisted episodes/actions | Deployed process-manager restart |
| Unsafe data blocks financial action | Every gate mutation; stale/conflict/missing cases | Review fallback text | Authorized live failure capture |
| Assurance/progression independence | Cartesian gate tests | Readiness field review | Current independent-source evidence |
| `actionable:false` | Schema literals, DB checks, API/render scans | Report wording review | Exact release acceptance |

## 8. Cost and external dependency assessment

### Local-first stages

Stages 3A, 3C foundation, 3D fixture orchestration and 3G local acceptance require no paid service. They use existing Node, SQLite and verified local PostgreSQL tooling.

Stage 3B local console wiring also has no provider cost. Real Telegram/Discord may be free but requires credentials and controlled external-side-effect approval; email may incur provider/domain cost.

### Provider-dependent stages

- live RPC/MCP use may be public/free but has availability/rate-limit risk;
- a genuinely independent oracle comparator may require a paid or separately operated source;
- A4.5 likely requires independently administered accounts, KMS/secret/WORM components and a hard budget;
- Neon Free suitability is unverified and may require a paid plan if measured storage/compute/egress exceed limits;
- backup storage/restore targets may cost money.

No paid dependency should be introduced merely to finish local product behavior. Cost-bearing Track B decisions remain explicit human approvals.

## 9. Explicit decisions and approval gates

| Decision | Status |
| --- | --- |
| Begin Stage 3A implementation | **RECOMMENDED, but requires separate approval** |
| Add signing/broadcast | **NO-GO / not required** |
| Weaken oracle/progression/freshness gates | **PROHIBITED** |
| Use writer as reader | **PROHIBITED** |
| Neon migration/provisioning | **NO-GO** |
| Production deployment/scheduler | **NO-GO** |
| Real provider notification | **NO-GO until separate controlled-test approval** |
| Paid services | **NO-GO until explicit budget/provider approval** |

## 10. Recommended first implementation stage

**Stage 3A — Typed Suggested Actions**

Dependencies:

- current alert/risk/progression/assurance schemas;
- current strict recovery eligibility;
- explicit approval for local source/test changes;
- no credential, network, database migration or paid service.

Minimum acceptance criteria:

1. every current alert code yields exactly one typed action;
2. every rendered alert starts with timestamp and includes a meaningful `Action:` line;
3. blocked/unverified/stale/conflicting states never include a financial option;
4. financial options only copy strict-gate-qualified exact estimates with asset/units/rationale/time/provenance;
5. all actions/options are `actionable:false`;
6. legacy SQLite/PostgreSQL alerts remain readable and hash-valid;
7. unit, storage, notification, runtime-read-model and native PostgreSQL tests pass;
8. full TypeScript, ESLint and build pass;
9. no external side effect or transaction execution path is added.

Do not begin Stage 3A without a separate implementation authorization.

## 11. Scope limitations

- This plan does not prove current chain/oracle state.
- It does not authorize external-provider tests or request credentials.
- It does not authorize a database schema migration for multi-position PostgreSQL scheduling.
- It does not resolve reader credentials or A4.5.
- It does not create a release commit; repository `HEAD` remains unborn.
- Recommendations reflect current source and evidence, not deployed behavior.

No implementation stage was started.
