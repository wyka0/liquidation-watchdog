# Phase 10 — Local Neon PostgreSQL implementation (persistence, scheduler, protected reads)

**COMPLETE — local implementation and verification only.** The `pg@8.23.1` backend, the protected externally-triggered scheduler contract, authenticated bounded read APIs and a native PostgreSQL 17.11 test fixture are implemented, tested and byte-preserved against the Phase 9 handoff state. **No Neon provisioning, no real-data migration/cutover, no Render deployment, no external scheduler activation and no production operation occurred** — Phase 9 approvals A2–A8 remain open (see [§7](#7-open-approvals-and-scope-boundary)). The preserved disk-backed Phase 8 SQLite service remains the only locally verified running implementation until a separately approved cutover.

Deliverables: [PostgreSQL schema reference](postgres-schema-reference.md), [scheduler endpoint contract](scheduler-endpoint-contract.md), [PostgreSQL operations reference](postgres-operations.md), [file/preservation inventory](phase10-files.md), and [test evidence](phase10-test-evidence.md).

## 1. Executive decision and implementation scope

Phase 9 approval A1 (the pg/explicit-SQL design) was accepted and is now implemented locally. What exists:

- **Persistence**: a dedicated `watchdog_pg` schema (15 tables, two checksummed idempotent migrations), separate hardened writer/reader roles, exact-value domains (canonical decimal TEXT for every financial amount, original UTC text + generated timestamptz projections, raw JSON bytes + SHA-256, never re-serialized), catalog/identity/version/role verification with `STORE_SCHEMA_DRIFT` fail-closed behavior, and bounded role pools (`max=1`, queue 3, 5 s connect/idle/close, transaction-local server-side timeouts, `synchronous_commit=on`).
- **Atomic state/alert/outbox writes**: revision-conditional stream upserts, exactly-once fingerprints, whole-transaction rollback on backlog overflow, acknowledgment-committer identities, and the delivery outbox with claim fences, sticky ambiguity and allowlisted retry outcomes.
- **Protected scheduler execution**: `POST /internal/monitor/run` with digest-compared bearer auth, literal-body discipline, database-time admission boundary, a 240 s cycle / 300 s job / 360 s lease / 420 s HTTP budget ladder, durable receipt bindings (tamper-evident, `STORE_CORRUPT` on any edit), a non-regressing high-water mark against replay, and `PROCESS_INTERRUPTED`/`CYCLE_FAILED`/`JOB_TIMEOUT` reconciliation derived **from persisted state only**.
- **Authenticated bounded reads**: the Phase 8 read routes on PostgreSQL with REPEATABLE READ read-only snapshots, exclusive exact-bigint (`stable_seq`) pagination cursors transported as decimal strings, and a server-side 1,048,576-byte page budget (`READ_LIMIT`).
- **Entry point**: `npm run start:postgres`, import-safe, configuration consumed only at explicit invocation; SQLite behavior byte-identical when `WATCHDOG_STORAGE_BACKEND` is not `postgres`.

What does **not** exist (by design, awaiting separate approvals): a Neon account or any remote connection; a real-data import/cutover run; any Render/Cloudflare deployment; any externally scheduled invocation; any real notification send. Fixed domain facts unchanged: chain **1672**, `https://rpc.pharos.xyz` / `https://mcp.pharos.xyz/mcp`, the fixed Morpho position, thresholds 1.30/1.10/1.25/1.00, exact BigInt math, the 600-second observation age rule, oracle **UNVERIFIED**, freshness **UNKNOWN**, and `actionable: false` structurally enforced in every persisted and projected estimate.

## 2. Preserved baseline and binding constraints

The implementation began from the exclusive Phase 10 baseline: **1,779 original files** (Phase 8's tree plus the six Phase 9 documents), including **64 SQLite database/sidecar files totaling 7,806,976 bytes**, snapshot-bound at SHA-256 `88d3a445b80328bb09a47168b0bb4e3d485aef98f2c982ec160aba965a2542de` with Git index `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689`.

Preservation rules enforced throughout:

- Exactly **six modified originals** — `package.json`, `package-lock.json`, `src/monitoring/service.ts`, `src/notifications/dispatcher.ts`, `src/runtime/read-model.ts`, `src/runtime/http.ts` — matching the externally pinned authorization list; every other original file byte-unchanged, and the six modified against the frozen pre-implementation snapshot with small, reviewed diffs ([inventory §1](phase10-files.md#1-modified-originals-6-exactly-the-authorized-set)).
- SQLite lineage untouched: the five SQLite migrations, `user_version`, store/validation/paths modules, and all SQLite runtime behavior are unmodified where not in the authorization set; the SQLite monitoring suite (`sqlite-monitoring-01`, 90/90) still passes.
- No commit, push, branch, tag or Git-index mutation; no author/committer config change; historical evidence never restored or overwritten; the archive-writing checks (`test:unit`/`test:integration` reporters, `npm run verify`, whitespace check) ran **only** in an exclusive copied workspace (`phase10-verify-ws-01`), leaving the original `dist/` and evidence directories untouched; the read-only secret scan (`--read-only`) was used in the real repo.
- `phase9-audit.mjs` (Phase 9's verifier) was never rerun against the modified tree; preservation used the separate `phase10-audit.mjs` verifier with a fresh allowlist and validation directory.
- No `.env` or credential file was opened by Phase 10 work; documentation references environment-variable **names only**.

## 3. Persistence architecture and exact-value contracts

Implemented per the Phase 9 design; full detail in [the schema reference](postgres-schema-reference.md) and [operations reference](postgres-operations.md#2-pools-and-bounded-capacity). Verification of the exact-value surface (maximum-size decimal string round-trips, zero/null handling, canonical-counter rejection, microsecond UTC text, raw JSON/hash agreement, `int4` boundary behavior) ran against a **native PostgreSQL 17.11** fixture rather than a shim. Catalog fingerprints recorded in `postgres-catalog-01`:

| Fingerprint | Schema |
| --- | --- |
| `24b4fea1efeab7c49999dd693f59ddc9aa776bcb4d4e262185978c9630c80ba3` | Production review target (real database clock) — compiled into the runtime. |
| `6243896b2824191f9c8fa63dda3fbdf0c050b0e4527a6eae7899078e9a59d3cb` | Disposable test fixture (administrator synthetic clock). |

Any catalog, identity, version (PostgreSQL 17 family required) or role drift is a hard stop — the runtime refuses all reads, writes and scheduling instead of repairing.

## 4. Protected scheduler execution

Implemented per the Phase 9 recommendation (option B: externally triggered, protected 30-minute minutes-7/37 UTC cadence); the exact HTTP contract, statuses and budget ladder are in [the scheduler endpoint contract](scheduler-endpoint-contract.md). Locally verified properties include: single-winner concurrent admission; database-clock admission boundaries under host-clock skew; high-water-mark replay prevention including database-clock rollback; killed-process (real child-process termination) recovery through **durable state only** without duplicate attempts; tampered receipt/`completed_at` bindings refused (`STORE_CORRUPT`); and receipt acceptance always derived from the persisted cycle, never from the HTTP request. No external trigger is connected; the endpoint exists for a future, separately approved Cloudflare Worker [per Phase 9 §7](phase9-report.md#7-scheduling-comparison-and-recommendation).

## 5. Authenticated bounded read model and runtime wiring

The runtime (`src/runtime/postgres-runtime.ts`, entrypoint `src/postgres-service.ts`) reproduces the Phase 8 lifecycle semantics with the shared monitoring service and dispatcher now running against an async persistence interface (`MonitoringPersistence`); `monitoring/transitions.ts`, risk math, oracle assurance and thresholds are untouched. Reads are exposed by [the Phase 8 route set](postgres-operations.md#6-authenticated-read-apis) with information-flow parity (strict `schemaVersion: 1` envelopes, no internal assurance/configuration/path fields, no `SAFE` wording, `actionable: false` structural), REPEATABLE READ snapshot coherence across concurrent writers, and exact bigint cursors with the server-side byte budget. Compression/asset/auth behavior matches Phase 8 except the documented scheduler additions ([http.ts diff](phase10-files.md#1-modified-originals-6-exactly-the-authorized-set)).

## 6. Verification evidence inventory

All runs used the exclusive evidence runner (`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase10-run.mjs`) with unique labels and byte-bound command records under `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase10-validation-6OrEZX\commands`. Authoritative results (full inventory and superseded-run history in [test evidence](phase10-test-evidence.md)):

| Check | Record | Result |
| --- | --- | --- |
| Typecheck (whole tree) | `typecheck-07` | PASSED, 0 errors |
| Full unit suite | `units-01` | **776/776** (38 files) |
| Scheduler units | `scheduler-unit-04` | **67/67** |
| Native PostgreSQL integration | `postgres-06` | **58/58**, zero unhandled rejections |
| SQLite monitoring preservation | `sqlite-monitoring-01` | 90/90 |
| Live chain (real Pharos RPC+MCP, isolated copy) | `live-verify-01` | 2/2 |
| Production build (isolated copy) | `build-verify-01` | PASSED, 297 outputs, original `dist` untouched |
| ESLint (script-exact scope) | `lint-04` | PASSED, 0 problems |
| Dependency audit | `deps-audit-02` | 0 vulnerabilities / 297 dependencies |
| Read-only secret scan | `secrets-scan-01` | 1,277 files, 9 rules, 0 findings |
| Catalog identity | `postgres-catalog-01` | Both fingerprints + PostgreSQL 17.11 recorded |

Gate mapping against the Phase 9 acceptance plan ([Phase 9 §10](phase9-report.md#10-implementation-sequence-and-acceptance-gates)):

| Gate | Phase 10 status |
| --- | --- |
| P10-01 provenance | **PASS (local)** — fresh baseline/verifier, fixture/server/driver identity recorded, historical seals preserved, versioned external records. |
| P10-02 exact values | **PASS (local)** — native-suite round-trips and rejections. |
| P10-03 migration | **PARTIAL** — schema migrations verified natively and idempotently; the real-data import/cutover remains unexecuted (A4 open). |
| P10-04 atomicity | **PASS (local)** — before/during/after-commit failures, backlog-cap rollback. |
| P10-05 ownership | **PASS (local)** — lease/fence/incarnation contention, expired and rotated owners. |
| P10-06 uncertain outcomes | **PASS (local)** — lost COMMIT/ack reconciliation, killed-child recovery, durable receipts. |
| P10-07 recovery/retention | **PASS (local)** — retention protections, restart survival (including immediate server restart), ambiguous-send stickiness. |
| P10-08 HTTP/security | **PASS (local)** — auth separation, body/rate/origin/timeouts, sanitized errors; real-host TLS/proxy behavior unexercised (A6/A8 pending). |
| P10-09 real Free lifecycle | **SKIPPED** — no Render/Worker/Neon host exists. |
| P10-10 capacity | **SKIPPED** — no Free-host quotas or near-limit churn run against real services. |
| P10-11 independent recovery | **SKIPPED** — no independent backup runner (A5 open). |
| P10-12 release/operations | **SKIPPED** — deployment and enablement remain approval-gated. |

## 7. Open approvals and scope boundary

Phase 10 consumed approval A1 only. Still open, unexecuted and deliberately not simulated (definitions in [Phase 9 §11](phase9-report.md#11-blockers-risks-and-required-approvals)):

| Approval | Meaning for the implemented code |
| --- | --- |
| A2 — service level/cadence | The 30-minute slot contract is ready but no cadence decision changed it. |
| A3 — resources and cost | No Neon/Render/Cloudflare account exists; credentials were never requested or stored. |
| A4 — migration/cutover | No source snapshot, import or cutover was run; the SQLite databases remain the system of record. |
| A5 — backup/recovery | No independent backup/restore drill was performed. |
| A6 — host tests and scheduler | The scheduler route has never left local test fixtures; no external schedule is enabled. |
| A7 — real notifications | Only synthetic adapters ran; no real channel was configured. |
| A8 — production operation | Nothing is deployed; the local implementation is not production authorization. |

## 8. Final preservation check and handoff

The completed-tree preservation verdict is produced by `phase10-audit.mjs verify` against the frozen baseline and the external six-file allowlist, recorded as the final `verification-*.json` record in the external validation directory (run after these documents were finalized). Verdict: **1,779 baseline files verified (1,773 byte-unchanged originals + exactly the 6 authorized modifications), 26 additions (20 code files + 6 documents)**, unchanged Git index `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689`, unchanged SQLite bytes (64 files, 7,806,976 bytes), and the historical Phase 8 integrity checks intact (665 seal bindings, 221 evidence payloads, 1,241 snapshot bindings).

Final-byte certification is kept in `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase10-validation-6OrEZX\validation-final.json`, written immediately after these six documents were finished. It binds: a fresh `verify` run over the finished tree; SHA-256 hashes of all six Phase 10 documents; the whitespace check run in the exclusive copied workspace; and a fresh read-only secret scan. Its `passed: true` result and matching document hashes are the Phase 10 handoff authority, exactly like the Phase 9 protocol ([inventory §6](phase10-files.md#6-final-bindings)).

No archive-writing verification, Neon connection, real-data migration, deployment, external scheduling, real notification, signing/broadcast, commit/push, branch/tag or Git-index mutation was performed in Phase 10. Work remains uncommitted and undeployed.

**Stopping point: Phase 10 local implementation complete, awaiting explicit A2–A8 approvals for any remote/production step.**
