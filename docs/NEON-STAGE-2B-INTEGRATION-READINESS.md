# Neon Stage 2B — Integration Readiness and Blocker Resolution

**Prepared:** 2026-11-05  
**Scope:** local investigation, security design and test preparation only  
**Recommendation:** **NO-GO for migration or Neon application integration**

## 1. Scope and evidence boundary

Stage 2B performed no Neon connection, remote SQL, migration, database write, password change, grant/revoke, cloud provisioning, deployment, scheduler activation or notification. It did not start WSL, a container runtime, PostgreSQL or any external service.

Credential investigation was deliberately limited to:

- exact project-local references;
- relevant environment-variable **names only**;
- matching Windows Credential Manager target-name metadata only;
- recognized password-manager CLI/standard installation presence;
- the existing external qualification file through in-memory equality hashes only.

No vault-wide search, browser credential-database access, unrelated user-file search or secret output occurred.

## 2. Reader credential recovery findings

### 2.1 Current state

The `watchdog_reader` PostgreSQL role was previously proven to exist with `LOGIN`, `NOINHERIT`, no elevated attributes, no memberships and no password expiry. Its supplied direct and pooled credentials failed with `28P01`.

The external qualification file remains a regular file and contains two reader entries. In-memory comparison established:

- the direct and pooled reader password bytes agree with each other;
- the reader bytes are still identical to the working writer bytes;
- therefore the file still does not contain a valid reader password.

No hash or credential value was printed or persisted.

### 2.2 Sources investigated

| Potential source | Finding |
| --- | --- |
| Process environment | No relevant Neon/PostgreSQL reader credential variable name present. Values were not enumerated. |
| Windows Credential Manager | No target name matching Neon, Liquidation Watchdog, `watchdog_reader` or PostgreSQL. Secrets are not readable through the metadata command used. |
| 1Password CLI/app standard locations | Not found. No vault search performed. |
| Bitwarden CLI/app standard locations | Not found. No vault search performed. |
| KeePass/KeePassXC standard locations | Not found. No database search performed. |
| `pass` / `gopass` CLIs | Not found. |
| Project source/configuration | Only environment-variable names and synthetic test credentials; no real secret. |
| Project setup/operations documentation | Instructions and variable names only; no reader password. |
| Render draft configuration | Secret placeholder/reference only; no value. No cloud account was inspected. |
| External qualification file | Contains writer-equivalent bytes in reader URLs; not a recoverable reader secret. |

### 2.3 Recovery conclusion

The correct reader password could not be recovered from the authorized local scope. **Reader qualification remains blocked.**

Before resetting anything, the user may manually inspect their own password-manager UI or approved enterprise vault for exact entries named after:

- `liquidation-watchdog-pg17`;
- `a4-migration-test`;
- `watchdog_reader`;
- the known Neon endpoint label.

That inspection must occur outside chat and reports. If an independently retained password is found, update only the two external reader URLs and run read-only direct/pooled authentication. Do not copy it into source or this workspace.

If no correct value exists, a separately approved operator must:

1. open Neon project `liquidation-watchdog-pg17`;
2. select child branch `a4-migration-test` and verify its branch ID;
3. open Roles & Databases;
4. select `watchdog_reader`, not `watchdog_writer`;
5. reset/rotate the reader password;
6. transfer it directly into the approved secret store;
7. update only direct/pooled reader URLs;
8. qualify both URLs in explicit read-only transactions.

Stage 2B does not authorize that reset or secret update.

## 3. A4.5 migration-security remediation architecture

### 3.1 Non-negotiable threat-model decision

The Windows host is untrusted against an administrator/SYSTEM-level attacker. That attacker can replace local binaries, scripts, public keys, trust stores, environment, clocks and logs; read process memory; delete receipts; and directly invoke any credential delivered to Windows.

Therefore:

- local signatures are advisory only;
- NTFS ACLs, local files, process isolation, a local VM/container and local attempt databases do not establish authority;
- no reusable direct migration credential may be delivered to Windows;
- the authoritative verifier, attempt controls, credential custody and migration runner must be outside the Windows administrator's control.

### 3.2 Concrete conditional architecture

The minimum architecture that addresses the A4.5 one-supporting-account-compromise requirement is the existing cross-provider dual-broker design, made concrete as follows. It remains a design, not an implementation approval.

#### Trust domains

| Domain | Responsibility | Must not control |
| --- | --- | --- |
| **TD-S: offline/hardware approval signer** | Two-person-reviewed Ed25519 signatures over canonical target manifest and one-attempt approval | Neon credential, GitHub/runner admin, broker admin, attempt-state mutation |
| **TD-G: GitHub-hosted ephemeral Linux runner** | Verify exact immutable release/workflow and execute one approved attempt | Stored Neon secret, signer key, authority reset credentials |
| **TD-C: Cloudflare Durable Object coordinator** | Linearizable reservation and compare-and-append state coordinator | Sole authority, signer key, complete credential |
| **TD-A: broker A, e.g. AWS** | Validate approval/OIDC/release; durable consumed-attempt record; release credential share A | Share B, signer, GitHub/Cloudflare administration |
| **TD-B: broker B, different provider, e.g. GCP** | Same independently for share B | Share A or administration of TD-A/TD-C/TD-G |
| **TD-W: Rekor plus retained WORM evidence** | Independent audit publication and retained signed receipt digests | Authorization or credential release |
| **TD-N: Neon** | Disposable child branch and least-privilege migration/read roles | Supporting attempt authority or broker recovery |

The domains require distinct custodians, hardware-backed MFA, recovery channels and administration. Different projects under one root account or accounts recoverable through the Windows host do not qualify.

### 3.3 Independent approval authority

TD-S signs two RFC 8785 canonical, domain-separated objects:

1. target manifest binding project/branch/parent/endpoint/database/major/schema/namespace, migration checksums, catalog fingerprint, release digest, Git index digest, purpose, issuance/expiry and monotonically increasing signer sequence;
2. human approval binding manifest hash, exact release/workflow digest, random attempt nonce, purpose and short expiry.

The Ed25519 public key/key ID is pinned in the independently reviewed release. The runner and both brokers obtain signatures from an independently authenticated source and verify them independently. A manifest-supplied key is never trusted.

### 3.4 Immutable release identity

The privileged job uses a dependency-complete artifact or OCI image addressed by digest and signed by the release process. It contains:

- the exact existing migration SQL;
- approved migration checksums;
- approved catalog fingerprint;
- pinned signer/authority verification keys;
- fixed migration/preflight/inspection entrypoints;
- pinned runtime/dependencies.

The privileged job performs no checkout by mutable branch/tag, no `npm install`, no unpinned action, no caller-supplied loader/plugin and no network download of executable code. Brokers validate exact immutable GitHub owner/repository IDs, `workflow_sha`, job/reusable-workflow SHA, event, environment, run ID/attempt and `runner_environment=github-hosted`.

### 3.5 One-use authorization and replay resistance

All three authorities use the same idempotency identity:

```text
(manifestId, signerSequence, releaseDigest, approvalDigest, attemptNonce)
```

Protocol:

1. TD-C atomically creates or returns the existing reservation.
2. TD-A and TD-B independently create their own `RESERVED` records with conditional create.
3. Duplicate/conflicting/started/closed state at any authority stops the attempt.
4. Read-only preflight runs using a separate inspector credential; it cannot unlock migration shares.
5. After successful preflight and child/socket exit, all authorities compare-and-append `PREFLIGHT_PASSED`.
6. The orchestrator irreversibly consumes an in-memory approval.
7. TD-C, TD-A and TD-B each durably append `MIGRATION_STARTED`/`CONSUMED` and return signed receipts.
8. If every signed receipt cannot be proven, no migration process starts. Partial/lost transitions are reconciled by idempotency key and remain blocking.
9. Each broker releases only its own 2-of-2 share to the exact approved runner attempt.
10. The runner reconstructs the branch-scoped direct credential only in private child-process memory, never environment, arguments, logs or artifacts.
11. One migration execution occurs. No wrapper retry exists.

Reset of the Cloudflare coordinator cannot re-enable a consumed attempt because both broker records remain consumed. Compromise of one broker yields one unusable share and cannot make the other broker release.

### 3.6 Credential custody

Future provisioning uses a SQL-defined, child-branch migration login with only required schema ownership/DDL authority. Console/API-created roles that inherit broad provider administration are unsuitable for this migration principal.

An approved independent provisioning custodian generates a high-entropy password outside Windows and the runner, splits it 2-of-2 (for example, equal-length random XOR shares), and sends one share to each broker. No broker, GitHub, Cloudflare or Windows has the complete value at rest.

The unsplit credential exists only during independently controlled provisioning and in the short-lived migration child after all start receipts. After success or unknown outcome it is rotated/revoked under separate human approval; old broker records remain consumed forever.

### 3.7 Migration execution and unknown outcomes

The isolated runner performs:

1. signed release/manifest/approval verification;
2. one-use reservation;
3. bounded direct read-only preflight;
4. signed start transitions;
5. share reconstruction;
6. exact existing `applyPostgresMigrations()` once;
7. exact `verifyPostgresSchema()` and post-commit read-only verification;
8. credential cleanup and signed final receipts.

Any error, timeout, crash, cleanup failure or lost response after start is `OUTCOME_UNKNOWN`. It consumes the attempt and prohibits retry. A separately authorized read-only inspector classifies:

- `EXACT_COMMITTED`;
- `FULLY_ABSENT`;
- `PARTIAL_OR_MISMATCHED`;
- `UNREACHABLE`.

Exact committed proceeds only to later acceptance. Fully absent still requires a new signed manifest/attempt after human closure. Partial/mismatched quarantines the branch; there is no repair/retry path. Unreachable remains blocking.

### 3.8 Independent audit evidence

Every authority signs receipts containing prior receipt hash, attempt identity, state, release/manifest/approval hashes and trusted timestamp. Non-secret receipt digests are:

- published to public Rekor for append-only transparency;
- retained in at least one WORM-capable store with fixed retention;
- exported to independent custodians.

Rekor/WORM are audit and recovery witnesses, not migration authorization. Absence of local evidence never grants permission.

### 3.9 Recovery and failure handling

| Failure | Required result |
| --- | --- |
| Invalid/expired signature or wrong target/release | Stop before credential release or connection |
| Any authority unavailable before start | Stop; reservation remains |
| Concurrent/replayed request | Return existing record; no new attempt/share |
| One start response lost | Read back all authorities by idempotency key; do not execute meanwhile |
| Runner crash after start | Attempt remains consumed; read-only inspection only |
| Neon COMMIT response lost | `OUTCOME_UNKNOWN`; no retry |
| Coordinator reset/compromise | Honest broker consumed records still block; freeze system |
| One broker compromise | One share unusable; freeze, rotate Neon credential and all shares under new signer sequence |
| Windows host loss/local deletion | No authorization effect; remote records remain authoritative |
| Receipt/WORM inconsistency | Security incident; stop all attempts |

### 3.10 A4.5 decision

This architecture is concrete enough for a separately approved prototype/design review but is **not implementation-qualified**. Named custodians, actual accounts/providers, OIDC policies, release packaging, broker code, share lifecycle, WORM retention, recovery and adversarial tests remain absent. A4.5 stays NO-GO.

## 4. Cost and free-tier feasibility

No account was inspected and no service was provisioned. Current A4.5 research indicates:

| Component | Low-volume feasibility | Cost conclusion |
| --- | --- | --- |
| GitHub-hosted standard runner | Rare job fits public free use or private included allowance | Potentially zero incremental spend, but private Free approval features are insufficient; external approval is required |
| Cloudflare Durable Object | Rare attempt is far below Free request/storage limits | Capacity likely free; cannot be sole authority |
| Public Rekor | Public transparency service | No project-specific authorization guarantee; audit only |
| AWS broker example | KMS key about $1/month; Secrets Manager about $0.40/secret/month plus use | Paid/billing required |
| GCP broker example | Software KMS about $0.06/month; Secret Manager may fit free access/version allowances | Billing relationship required; not verified zero spend |
| WORM object storage | Low data volume | Storage/request charges and billing expected |
| Hardware/offline signer | Strong independent custody | Existing contributed hardware may avoid recurring fees; otherwise one-time cost |
| Existing independent Linux host | Possible runner/signer component | Zero incremental cash only if already owned and separately administered; power/operations are still costs |

Example verified recurring floor for one AWS KMS key plus one AWS Secrets Manager secret is approximately **$1.40/month**, before the second broker, WORM storage, compute, logs, network, taxes or hardware. The dual-provider target has **not** been proven permanently free.

Cost decision:

- zero-paid-spend end-to-end feasibility: **not verified**;
- low-volume technical capacity: plausible;
- no paid resource may be enabled without a separate budget/provider approval and hard spend controls;
- if no already-owned independent infrastructure exists, A4 remains blocked rather than weakening the threat model.

## 5. Schema provisioning plan

### 5.1 Immutable migration inputs

Target:

- PostgreSQL major 17;
- database `neondb`;
- direct child-branch endpoint only;
- schema `watchdog_pg`;
- namespace `watchdog_free`;
- backend identity `liquidation-watchdog-pg`.

Migration lineage:

| Version | SHA-256 |
| ---: | --- |
| 1 | `7d682b2267b9d35d0a6ed01511dc0342a3ef801051e0ee0fdf8f0c60a09b015d` |
| 2 | `7b8aa97bf0a386081b79bd5d6eb36c57af91d5c40cd3498302dd4615d4a9eb75` |

Expected catalog fingerprint:

`24b4fea1efeab7c49999dd693f59ddc9aa776bcb4d4e262185978c9630c80ba3`

No new or generated migration is proposed.

### 5.2 Exact schema inventory

Seven domains:

`identifier`, `digest`, `uint_text`, `utc_text`, `object_text`, `delivery_status`, `channel`.

Two SQL functions:

`utc_value(text)`, `clock_now()`.

Fifteen tables:

1. `schema_migrations`
2. `cycles`
3. `streams`
4. `fingerprints`
5. `alerts`
6. `deliveries`
7. `delivery_attempts`
8. `delivery_events`
9. `provider_limits`
10. `oracle_assurance`
11. `worker_runtime`
12. `operational_events`
13. `database_identity`
14. `worker_lease`
15. `scheduled_executions`

Six identity sequences support cycle/alert/delivery/assurance stable ordering and event IDs.

Fifteen explicit indexes:

`cycles_scope_time`, `cycles_history`, `cycles_unfinished`, `cycles_retention`, `alerts_history`, `alerts_time`, `alerts_cycle`, `deliveries_due`, `deliveries_alert`, `delivery_events_delivery`, `assurance_context_time`, `assurance_time`, `streams_latest_cycle`, `streams_accepted_cycle`, `executions_slot`.

Primary/unique constraints create additional required backing indexes. The migration defines all checks, generated columns, foreign keys, deferrable lease/execution links, false-only actionability and size bounds reviewed in Stage 1B/2A.

### 5.3 Required roles and grants

Use a separate migration/schema owner. Runtime roles own no application object and have no owner-role membership.

Writer:

- database `CONNECT`;
- schema `USAGE`, not `CREATE`;
- `SELECT` on all 15 tables;
- `INSERT,UPDATE,DELETE` on `streams`, `cycles`, `fingerprints`, `alerts`, `deliveries`, `delivery_attempts`, `delivery_events`, `provider_limits`, `oracle_assurance`, `worker_runtime`, `operational_events`, `scheduled_executions`;
- `UPDATE` only on `worker_lease`;
- identity sequence `USAGE`, not `UPDATE`;
- required function `EXECUTE`.

Reader:

- database `CONNECT`;
- schema `USAGE`, not `CREATE`;
- `SELECT` on all 15 tables;
- required function `EXECUTE`;
- no table/column writes or sequence mutation/use.

Forbidden for both runtime roles:

- superuser, CREATEDB, CREATEROLE, replication, BYPASSRLS or unexpected memberships;
- schema/object ownership;
- schema `CREATE`;
- table `TRUNCATE`, `REFERENCES`, `TRIGGER`;
- writes to `schema_migrations` or `database_identity`;
- writer `INSERT`/`DELETE` on `worker_lease`;
- reader DML of any kind;
- writer-as-reader substitution.

TEMP remains a separate database-wide policy decision; this plan does not authorize revocation.

### 5.4 Pre-migration verification

The independently authorized read-only preflight must verify and sign/hash:

1. exact project/child/parent/endpoint IDs and direct hostname hash;
2. database `neondb`, PostgreSQL 17.11, TLS/channel binding;
3. exact migration release/checksums/catalog constant/namespace;
4. `watchdog_pg` absent and migration/identity/lease tables absent;
5. no advisory migration lock holder for `(1672,10001)`;
6. no unexpected user objects/data on the disposable branch;
7. approved migration role is child-branch-scoped and has no unrelated authority;
8. reader/inspector credential is separate and read-only;
9. all authority reservation records are new/consistent;
10. pre-migration backup/evidence receipts are durable.

Preflight closes/destroys its read-only connection and exits before migration approval is consumed.

### 5.5 Migration execution

After all independent signed start receipts and share reconstruction, invoke only existing `applyPostgresMigrations(connection, "watchdog_free")` once. It:

- begins one bounded writer transaction with local security/timeouts;
- takes `pg_advisory_xact_lock(1672,10001)`;
- creates/revokes the dedicated schema and creates `schema_migrations`;
- validates existing ordered lineage/checksums;
- applies only missing approved migration SQL;
- records exact migration checksums;
- seeds database identity and singleton lease;
- verifies namespace, PostgreSQL major and complete catalog fingerprint before COMMIT.

Runtime roles and scheduler remain disabled throughout provisioning.

### 5.6 Post-migration verification

Using a fresh read-only connection and separately signed result:

1. verify two exact migration rows/checksums and no extra row;
2. verify backend/namespace/incarnation and PostgreSQL 17.11;
3. compute exact catalog fingerprint;
4. verify seven domains, two functions, 15 tables, six sequences, 15 explicit indexes and all constraint-backed indexes;
5. verify `worker_lease`: singleton, fence 0, no owner/deadlines/current execution/high-water slot;
6. verify all 12 ordinary application data tables are empty and runtime/status tables have expected seed-only rows;
7. apply separately approved grants, then verify positive and forbidden privilege matrices through each true role;
8. verify no active sessions/claims/receipts and scheduler remains disabled;
9. take and verify post-migration backup/evidence;
10. append signed `QUALIFIED` only after every check and credential cleanup succeeds.

### 5.7 Backup and recovery

Before migration:

- capture signed Neon metadata and a direct read-only logical baseline (`pg_dump` custom format where supported, plus schema/ACL/role inventory);
- hash and manifest every artifact;
- retain at least one independently administered WORM copy;
- treat Neon branch history/PITR as supplemental, not sole recovery proof.

After migration:

- capture a second custom-format logical backup including schema, migration/identity/lease rows and grants;
- capture globals/role metadata through an allowed least-privilege method;
- verify checksums and perform a separately approved restore test into a different disposable database/branch;
- never restore over or repair the qualification branch automatically.

No backup was created in Stage 2B.

### 5.8 Failure and unknown-COMMIT procedure

- Before signed start: fail closed; reservation remains and human review decides closure.
- After signed start: every exception/timeout/crash/cleanup problem/lost response is `OUTCOME_UNKNOWN`.
- Do not replay migration, regenerate IDs or infer rollback from socket/process exit.
- Append unknown state where possible; if authority append is unavailable, signed start/consumed records still block.
- Run the independent read-only inspector.
- Exact committed: human-close attempt and proceed only to later gates.
- Fully absent: close old attempt; any retry requires a new manifest/sequence/approval/attempt.
- Partial/mismatched: quarantine branch; no automatic repair or retry.
- Rotate/revoke migration credential/shares before any future authorization.

## 6. Native PostgreSQL 17 testing options

### 6.1 Current host inventory

| Option | Current finding |
| --- | --- |
| Windows PostgreSQL binaries on PATH | None (`postgres`, `initdb`, `pg_ctl`, `psql`) |
| Windows PostgreSQL service | None found |
| `WATCHDOG_PG_TEST_BIN` | Absent |
| Embedded PostgreSQL Node package | None installed |
| Docker / Podman / nerdctl | Not installed/on PATH; no matching service |
| Testcontainers dependency | Not installed |
| WSL2 | Installed; `Ubuntu` and `Ubuntu-22.04` distributions exist and are stopped |
| Existing native fixture | Implemented in `test/fixtures/postgres.ts`, but blocked on executable path |

WSL contents were not inspected because that would start a distribution, which Stage 2B prohibits.

### 6.2 Options assessment

| Option | Fidelity | Cost | Current decision |
| --- | --- | --- | --- |
| Approved existing PostgreSQL 17 in WSL | High if exact 17.x server/client binaries already installed | No new license/cloud cost | First next check: separately approve starting WSL and run version/path checks only; do not install automatically |
| Manually supplied official/approved PostgreSQL 17 portable binaries | Highest match to existing fixture; supports server restart/process-kill tests | PostgreSQL license cost $0; operator download/review time | Recommended deterministic local option after checksum/provenance approval; set `WATCHDOG_PG_TEST_BIN` |
| Restore prior embedded PostgreSQL 17 package used by historical qualification | High if exact reviewed package/version/hashes are reapproved | Package is likely no-license-cost; supply-chain/download cost and review required | Viable only under separate dependency/download approval; do not auto-install |
| Docker/Podman with `postgres:17` pinned by digest | High for SQL/transaction behavior; weaker for native Windows process behavior | Engine licensing/operations vary; image download/storage | Blocked: no runtime installed; future option after runtime/image approval |
| GitHub Actions PostgreSQL 17 service container | High Linux server fidelity; ephemeral and independent | May fit public/free or private included compute | Requires repository/workflow/security approval; not a migration runner or Neon test |
| Temporary managed PostgreSQL/Neon branch | High remote fidelity | Potentially free allowance but cloud/account/security dependencies | Not a substitute for local native qualification; schema writes need separate approval |
| PGlite/WASM or SQL mock | Low for locks, pooler, process kill, restart, server timeout | Low/no cost | Insufficient for acceptance; may supplement unit tests only |

Recommended order:

1. separately approve WSL **inspection only**;
2. if no exact PostgreSQL 17 exists, choose manually supplied checksum-verified binaries for the existing fixture;
3. only then consider a pinned container/CI alternative;
4. never count mocks/PGlite as native PostgreSQL qualification.

## 7. Integration test preparation

### 7.1 Test tiers

#### Tier A — local mocked/unit (already available)

- pool config, TLS flags, pooler option handling and bounds;
- same-client transactions, rollback, cancellation and unknown COMMIT;
- monitoring transitions, progression and recovery gate;
- runtime/API authentication and field projection.

#### Tier B — native disposable PostgreSQL 17

Use only local disposable storage created by `localPostgresFixture()` and synthetic time/data. Required coverage:

1. **Migrations/catalog:** idempotent exact migrations, checksums, drift/gap/future rejection, complete fingerprint.
2. **Roles/permissions:** positive writer/reader operations and rejection of writer control-table/DDL privileges, reader writes, owner memberships, schema create and sequence update.
3. **Writer persistence:** exact observations, state, assurance, alerts, deliveries and hashes.
4. **Reader projections:** coherent repeatable-read snapshots, exact cursors, byte budgets and sanitized public fields through the true reader role.
5. **Progression:** first/advance/unchanged/stalled/regressed/conflict progression survives observation/state/alert JSON round trip.
6. **Atomicity:** observation/state/progression/assurance/outbox commit together; injected failures/backlog overflow leave no partial rows.
7. **Scheduler:** simultaneous admission, fence monotonicity, slot high-water, missed slots, lease expiry, late-writer rejection and durable receipts.
8. **Restart recovery:** immediate PostgreSQL restart, killed mid-read/send worker, interrupted cycle and ambiguous delivery recovery.
9. **Unknown COMMIT:** admission, observation and acknowledgment reconciliation without replay.
10. **Thresholds:** custom thresholds produce isolated scopes and read models; mismatched/tampered thresholds fail before work.
11. **Recovery eligibility:** only advancing chain plus every verified assurance condition can produce indicative amounts; all blocked states persist `null` estimates and `actionable:false`.
12. **Readiness:** retrieval/block ages, progression, assurance/freshness and stale reasons remain separate.
13. **Cleanup:** cancellation drains admissions, pools close, no background process/socket remains.

#### Tier C — post-provision disposable Neon integration

Requires separate write authorization after migration/grants/security gates. Use synthetic fixtures only, true writer and reader credentials, notifications disabled and scheduler disabled except one explicit deterministic invocation.

Coverage:

1. read-only schema/role/catalog preflight through both roles;
2. one deterministic writer admission/cycle with observation and progression;
3. reader projection and readiness parity;
4. atomic rollback fault injection where safely supportable;
5. pooler reconnect/timeout/cleanup;
6. lease/fence and duplicate slot behavior;
7. unknown-outcome protocol through controlled connection interruption only under explicit destructive-test approval;
8. final read-only inventory proving expected rows, no active lease/claim and no catalog drift.

Do not use writer credentials for any reader test.

### 7.2 Evidence requirements

Each executable test stage records:

- exact signed release/test digest;
- PostgreSQL version and fixture/provider identity;
- migration checksums/catalog fingerprint;
- role identity and privilege matrix;
- test command/status/counts and sanitized SQLSTATEs;
- pre/post row-count/hash inventory;
- process/socket cleanup;
- Git index/preservation hashes;
- explicit statement that no live notifications, financial action or production branch access occurred.

## 8. Remaining blockers

1. Correct reader password is unavailable; reader remains unqualified.
2. No selected/approved A4.5 independent custodians, providers, accounts or recovery domains.
3. Dual-broker/attempt-authority/immutable-runner architecture is unimplemented and adversarially untested.
4. Permanent zero-paid-spend feasibility is not established; likely design requires billing or already-owned independent infrastructure.
5. Migration credential provisioning/splitting/revocation path is not approved.
6. No native PostgreSQL 17 executable path is currently available.
7. `watchdog_pg` and runtime grants remain absent.
8. No approved backup/restore receipt or restore test exists.
9. TEMP policy, Neon Free limits and operational monitoring remain unresolved.
10. No remote persistence, reader projection, lease, restart or recovery integration test has run.

## 9. Recommended next executable stage

Do **not** proceed directly to schema provisioning or Stage 3.

The next executable stage should be **Stage 2C — Local Native PostgreSQL 17 Qualification**, separately approved to:

1. start existing WSL only long enough to inspect whether PostgreSQL 17 binaries already exist; or accept an operator-supplied, checksum-verified PostgreSQL 17 binary directory;
2. set `WATCHDOG_PG_TEST_BIN` for the test process only;
3. run the complete existing native PostgreSQL integration suite in a disposable local cluster;
4. make no Neon connection or cloud/database change;
5. produce signed/hash-bound local evidence and remove the disposable cluster normally.

In parallel but non-executable, the user must decide whether to fund/select the A4.5 trust domains and manually recover/reset the reader credential. Neither task may be bypassed by writer credentials or local Windows controls.

## 10. Decision

- **Reader recovery:** NO-GO; no correct local credential found.
- **A4.5 architecture:** CONDITIONAL DESIGN only; NO-GO for implementation/migration.
- **Schema provisioning:** prepared, but NO-GO for execution.
- **Native test preparation:** CONDITIONAL GO once an approved PostgreSQL 17 executable path exists.
- **Real Neon application integration:** NO-GO.

Stage 3 is not authorized or started.
