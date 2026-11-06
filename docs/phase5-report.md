# Phase 5 completion report

Scope: production hardening, deployment preparation, local recovery/diagnostics, bounded stability verification and release assessment. All changes are local and uncommitted. **Production approval is absent. Oracle assurance is UNVERIFIED, freshness UNKNOWN, and recovery estimates remain indicative / actionable: false.**

The complete planned verification passed **26/26 commands** on 2026-11-02 between 08:53:52Z and 09:05:33Z on unchanged tested inputs (Node v24.14.1 / SQLite 3.51.2, Windows, `sourceInputsUnchanged=true`). Post-run finalization and the release binding are machine-checked against those recorded results; see [verification results](../evidence/phase5/verification-results.json) and [finalization results](../evidence/phase5/finalization-results.json).

## 1. Gaps and dispositions

The [G01–G18 gap register](production-readiness-gaps.md) was sealed before implementation against the exclusive 550-file baseline. Its original assessment remains unchanged.

| Gap | Phase 5 disposition |
| --- | --- |
| G01 | Oracle economics/operators/freshness/independence remain unresolved; financial gate retained |
| G02 | Single-host dedicated-worker architecture and supervisor/OS evaluation documented; target-host gate remains |
| G03–G04 | Exact production runtime, fixed configuration, timeout/path/provider validation and placeholder/redacted environment handling implemented |
| G05–G06 | Maintenance ownership before writes, read-only diagnostics, schema/content validation, online backup and isolated restore implemented |
| G07–G08 | Bounded settle/cancel, restart continuity, batched recovery, SQL summaries and transactional capacity safeguards implemented |
| G09 | Local health/readiness/diagnostics with coherent worker/as-of/resource states implemented |
| G10–G11 | Exact endpoints, streaming body caps, bounded retry/jitter/discovery/session/cycle behavior; invalid/partial/reorg/history failures remain rejected |
| G12 | Durable notification attempts/cooldowns/blocks and stop semantics verified with mocks; manual recovery/duplicate/disable procedures documented |
| G13–G14 | Central path checks, database/WAL/RSS/backlog/evidence safeguards and deterministic bounded stability harness implemented |
| G15 | New captures/checks routed to Phase 5; all four prior archives and core financial/assurance logic remain protected |
| G16 | Hash-bound release candidate, deployment/rollback/restoration runbooks and separate production approval decision prepared |
| G17 | Actual host, supervisor, permissions, durability, off-host recovery, real notifications and real-duration soak remain external gates |
| G18 | Full current verification and finalization required; exact outcome recorded below |

## 2. Production architecture

One Node worker owns one local SQLite database, supervised externally, with a local CLI and no inbound service. The selected public borrower, chain 1672, RPC and MCP stay fixed. Both provider paths share an upstream. Linux systemd, Windows supervision and container tradeoffs are evaluated in [production architecture](production-architecture.md); the reference unit is uninstalled.

## 3. Configuration and environment

Production startup requires **Node v24.14.1 / SQLite 3.51.2**, an absolute database path, mandatory compiled chain/position fields and consistent minimum timeout budgets. Existing three notification variables remain compatible and disabled providers do not access them. `.env.example` contains placeholders only. Config files are strict, bounded and non-secret. [Configuration reference](environment-variables.md) lists all defaults/bounds and safe status codes.

## 4. Database durability and recovery

Schema **5** adds runtime/failure records and indexes; migrations 1–4 retain their checksums. Maintenance ownership precedes writable initialization/migration. Read-only operations do not initialize/migrate. WAL/FULL/foreign-key checks, exact schema layout, full record validation, transactional page/backlog failures, online backup, complete evidence inventories and isolated legacy/current restoration preserve committed state and pending work. Native-I/O and actual filesystem/power-loss acceptance remain open. See [database operations](database-operations.md).

## 5. Lifecycle and restart

Default whole-cycle/shutdown budgets are **240/30 seconds**. Stop requests prevent new work and permit bounded active settlement. Overdue work is cancelled; late results cannot persist or acknowledge after closure. First failure is retained, close is idempotent and a hard-deadline CLI failure exits 1. Restart preserves accepted state and known-delivered rows, recovers unfinished cycles and treats interrupted sends as ambiguous. Windows graceful handler coverage is explicitly simulated; forced termination kills a real child.

## 6. Provider resilience

Fixed endpoints, 2,000,000-byte bodies, streaming SSE support, header/body cancellation, same-endpoint retry bounds, capped jitter, four-page MCP discovery and bounded session replacement are enforced. Missing history, malformed/partial/mismatched/reorganized blocks and provider disagreement cannot become weaker snapshots or zero debt. No fallback chain or deprecated tracing is introduced. Live integration remains an independent required check.

## 7. Notification behavior

All Telegram/Discord verification uses mocked HTTP. Pending/attempt/outcome/cooldown/block state is durable; the default dispatch batch is 10. Known-delivered messages are not resent on ordinary restart. Lost acknowledgment or restored older state can duplicate an externally accepted message; exactly-once and human receipt are not claimed. Permanent failure, rate limits, retry exhaustion, disabled/re-enabled channels, destination changes and approved manual recovery are documented in [operations](operations-runbook.md#notification-recovery).

## 8. Diagnostics and operations

`config-check`, `database-init`, `health`, `readiness`, `diagnostics`, `backup`, `backup-verify` and `restore-verify` are implemented. Status/alerts remain read-only. Readiness rejects stale/unaccepted/fixture/historical/unfinished observations and incoherent worker/scope/ownership states. An optional probe performs explicit read-only connectivity only. Worker RSS is labeled as-of its runtime record. Operational success never promotes oracle or financial status.

## 9. Resources and stability

Defaults: database **4 GiB**, WAL **256 MiB**, free-space reserve **512 MiB**, RSS **512 MiB**, nonterminal deliveries **10,000**, evidence **2 GiB / 50,000 files**. Page limits and outbox admission are transactional; RSS/WAL/free-space checks occur at boundaries. Retention preserves pending work, accepted baselines and dedup tombstones. A deterministic 144-cycle, two-restart, 36-virtual-day harness plus a 200-day retention advance measures local behavior; it is not a production soak. The final local run measured 144/144 cycles (112 accepted, 32 rejected) with 2 restarts, ~8.9 s wall time (~8.3 s CPU), peak process RSS ~292 MiB, peak database ~3.8 MiB, peak WAL ~4.3 MiB, at most 6 pending nonterminal deliveries, and **0 external calls**; simulated delivery attempts included rate-limit and ambiguous transport outcomes, with 91 unique console deliveries. Pending work, the accepted baseline and dedup fingerprints survived the 200-day retention advance. Exact times/limits are in [stability results](../evidence/phase5/stability-results.json).

## 10. Security and quality

Secret values/provider URLs/raw exceptions are excluded from operational output. Paths, redirects, response sizes and read methods are constrained; database schema/record bindings are validated. Source/runtime/evidence digests and current audit/secret checks are required. No actual secrets were inspected or printed. See [production security](production-security.md) for scoped scanner limitations and host controls.

## 11. Release, deployment and rollback

The manifest binds actual tested source/configuration, emitted build, completed evidence and the ten Phase 5 documents. Package version remains **0.1.0**; no Git revision is invented when HEAD is unavailable. Source changes require full re-verification; documentation changes require finalization/rebinding. Finalization must follow the completed full run, its documentation fingerprint must still match, and test/stability reports must match the run's saved copies. Release checking also scans the generated manifest/checksum read-only for secrets. [Deployment](deployment.md) and [rollback/recovery](rollback-and-recovery.md) require verified pre-migration backups, fencing, isolated validation and separate production approval. Schema downgrade is unsupported.

## 12. Tests and exact verification results

Completed full verification: **26/26 commands PASS** between 2026-11-02T08:53:52Z and 2026-11-02T09:05:33Z with `sourceInputsUnchanged=true`; per-command exit codes and times are in [verification results](../evidence/phase5/verification-results.json). The five post-run local checks and the release binding are machine-readable in [finalization results](../evidence/phase5/finalization-results.json), the [release manifest](../evidence/phase5/release-manifest.json) and its [check](../evidence/phase5/release-manifest-check.json).

Measured final counts: unit **662/662** tests across **29** files; repeated operational subset **99/99** across **4** files; live integration **2/2**; bounded stability **144/144** cycles, 2 restarts, 0 external calls; dependency audit **0** findings across 282 dependencies; secret scan **839 files / 0 findings**; documentation links **239/239**; new-file Git whitespace **289 files** clean with the real index untouched; built-CLI operational smoke **15/15** expected-exit commands; monitoring/restart smoke **2 accepted cycles** and **4** built-CLI processes (console only); oracle smoke **3 audits / 3 persisted-status processes / 2 new immutable bundles**; Phase 1 evidence **54/54** unchanged; Phase 1–4 archives **391/391** unchanged; Phase 2 replays **3/3** with **15/15** artifact hashes; oracle evidence **12 bundles, 6/6 reconstructed runtimes, 8 audit dispositions**.

The exact planned full command sequence (with the actual Node executable normalized to `node` and npm launcher to `npm-cli.js`) is:

```text
node npm-cli.js run typecheck
node npm-cli.js run lint
node npm-cli.js run test:unit
node npm-cli.js run test:operations
node npm-cli.js run test:integration
node npm-cli.js run test:stability
node npm-cli.js run build
node dist/cli.js --help
node --import tsx src/cli.ts inspect --save-evidence
node dist/cli.js risk --save-evidence
node dist/cli.js risk --block 21853902 --warning 1.30 --critical 1.10 --target 1.25 --save-evidence
node --import tsx scripts/phase3-live-regression.ts
node --import tsx scripts/monitoring-smoke.ts
node npm-cli.js run smoke:operations
node --import tsx scripts/oracle-smoke.ts
node --import tsx scripts/link-source-evidence.ts
node npm-cli.js audit --json
node --import tsx scripts/phase1-integrity.ts --check
node --import tsx scripts/phase5-preservation.ts
node --import tsx scripts/phase3-preservation.ts
node --import tsx scripts/check-oracle-evidence.ts
node --import tsx scripts/phase5-inventory.ts
node --import tsx scripts/check-doc-links.ts
node npm-cli.js run secrets:check
node --import tsx scripts/check-whitespace.ts
git diff --check
```

Finalization reruns the last five local checks after confirming tested source inputs are unchanged. Manifest generation/check commands are `npm run release:manifest` and `npm run release:check`. New-file whitespace is checked via read-only `git diff --no-index --check` against an exclusive empty file; existing Phase 1–4 intent-to-add entries are retained and the real Git index is not modified.

Development findings are retained: the first 94-test operational run had two failures (a 1 ms jitter rounding edge and a threshold-path expected code), then the corrected configuration/transport subset passed 62/62. Four test formatting lint errors and the stability script's explicit-type annotation errors were corrected. The development stability run passed 144/144 cycles in 47,530 ms with zero external calls; final evidence is distinct. [Reliability coverage](reliability-testing.md) explains fixtures versus actual OS/SQLite/live behavior.

Final review also confirmed that SQL `LIKE 'sqlite_%'` hid legitimate user-defined names such as `sqliteextra` because `_` is a wildcard. The schema filter now uses a literal-prefix GLOB; table/index/trigger and unversioned-store regressions cover the refusal. Snapshot/risk captures also enforce the documented 32 MiB artifact cap before creating a directory. Those executable-input corrections invalidated the first 26/26 command attempt, which is preserved with its frozen input/build transcripts under `verification-runs/`; the subsequent completed run on unchanged corrections passed all 26 commands and is the canonical verification. Interrupted partial attempts are likewise retained and not used as evidence.

## 13. Phase 1–4 preservation

The exclusive pre-Phase-5 baseline covers **550 files**, including **391 evidence files: 54 / 73 / 77 / 187**. Baseline SHA-256 is `043b6c7a7ae68515b7c17379619a090d24a01d361f5ba72816d89da97b93f9e2`. All archive hashes, source hashes, exact Phase 2 replays and protected financial/assurance core checks are required by release generation. The completed run's inventory records **506 unchanged, 44 modified, 289 added, 0 missing** baseline originals, with the protected financial/assurance core unchanged; see the [file inventory](phase5-files.md), [machine-readable inventory](../evidence/phase5/file-changes.json) and [archive check](../evidence/phase5/prior-phases-integrity.json).

## 14. Remaining blockers

Unverified upstream economic source/quote/operators; unknown heartbeat/upstream freshness; no qualified independent comparator; untested target host/supervisor/ACL/fsync/power-loss/resource/log assumptions; no real provider delivery test; no off-host disaster-recovery/RPO/RTO proof; no real-duration production soak; and no production approval. The backup callback budget does not prove a hard native-I/O deadline. Digests are integrity bindings, not signed release authorization.

## 15. Readiness decision

**Production: NOT READY / NOT APPROVED. Financial actionability: false.** The local candidate completed the planned 26-command verification (**26/26 commands, PASS**) on 2026-11-02 on unchanged tested inputs. That passing disposition permits review for separately authorized host acceptance, not unattended production monitoring. [Release readiness](release-readiness.md) lists the exact remaining gates.

## 16. Prohibited-action confirmation

No signing/broadcasting, repayment/collateral transaction, execution-wallet connection, real Telegram/Discord message, deployment, service installation, production monitoring, endpoint/chain change, dependency/runtime change, commit/push/tag, unrelated-project modification or actual-secret inspection/printing occurred. Only bounded read-only chain verification, mocked notifications and isolated local code/data/evidence work were performed. Phase 5 stops before production approval or operation.
