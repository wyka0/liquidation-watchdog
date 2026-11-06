# Reliability and bounded stability verification

Phase 5 verification separates synthetic failures, real local OS/SQLite behavior and bounded live chain reads. Passing local checks is not a production-duration soak or proof of host durability.

## Reproducible commands

```powershell
npm run test:unit
npm run test:operations
npm run test:integration
npm run test:stability
npm run verify
```

`test:unit` includes all operational tests. `test:operations` repeats the four operational files for explicit release evidence; its total is not additive to the full unit count. The complete orchestrator also builds and invokes the real CLI, verifies source/archive/evidence bindings and checks configuration/backup/restoration. [verification-results.json](../evidence/phase5/verification-results.json) records exact commands, exit codes, times and unique per-attempt transcripts. The [Phase 5 report](phase5-report.md#12-tests-and-exact-verification-results) records final counts.

## Failure-mode matrix

| Coverage | Tests / harness | Required behavior |
| --- | --- | --- |
| Disabled/missing/invalid provider config, fixed chain/position, runtime/absolute path, operational budgets | `operations-config.test.ts` | Fail before writable monitoring; disabled values untouched; safe status only |
| Path traversal, UNC/URI, reserved names, symlink/junction/hardlink aliases, oversized config | `operations-config.test.ts` | Refuse unsafe/secret-like paths without using them |
| Empty/missing/healthy/degraded/fixture/stale state, worker absence/failure/unknown owner/scope mismatch | `operations-config.test.ts` | Read-only diagnostics, no implicit initialization, financial gates retained |
| Maintenance contention, schema layout/checksum/version/corruption, injected mid-migration failure | `operations-storage.test.ts`, `monitoring-storage.test.ts` | Original data/schema preserved; no fallback/reset |
| Actual SQLite page-limit exhaustion and outbox admission rollback | `operations-storage.test.ts` | Entire state/alert/outbox transaction rolls back |
| Disk reserve/RSS/WAL/database/evidence safeguards | `operations-storage.test.ts` | Reject new work without deleting required records; deliberately tiny policy budgets, not a physically full host disk |
| Online WAL backup under writes, schema-2/schema-4 restore, evidence dependencies and tampering | `operations-storage.test.ts` | Point-in-time integrity; pending/ambiguous/delivered continuity; isolated source-preserving restore |
| Active/idle/hung read, supplemental read and notification; duplicate shutdown/overlap calls | `operations-lifecycle.test.ts` | Bounded settle/cancel, first failure retained, no late persistence/acknowledgment |
| Actual child ownership, forced termination and restart | `operations-lifecycle.test.ts`, `helpers/phase5-worker.ts` | OS lock released; delivered rows identical; only ambiguous/pending work retried |
| Graceful SIGINT/SIGTERM handler paths | Same child fixture | On Windows these are explicitly simulated handler events, not a claim about POSIX signal delivery |
| 408/429/5xx/retry exhaustion, jitter edges, redirected/unauthorized endpoints, stalled headers/body, oversized streaming/SSE | `operations-transports.test.ts`, `transport.test.ts` | Same fixed endpoints; bounded attempts/body use; cancellation and no partial accepted value |
| MCP connect/discovery/tool deadlines, four-page discovery cap, session replacement failure | `operations-transports.test.ts` | Bounded one-reconnect behavior; late results do not initiate more work |
| Missing historical state, wrong chain, backwards/mismatched/reorganized blocks and malformed multicalls | Transport, snapshot and monitoring service suites | Refuse weakened snapshots, latest-state substitution and inferred recovery/zero debt |
| Acknowledgment loss, 429 fallback/cooldown/provider blocking, retry exhaustion, disabled channels and local acknowledgment-write failure | `notifications.test.ts`, lifecycle/transport suites | Mocked HTTP only; durable attempts, at-least-once ambiguity and no known-delivered resend |
| Financial arithmetic, oracle assurance/continuity, evidence provenance, read-only allowlists | All retained Phase 1–4 suites and exact replays | No promotion of oracle/freshness/actionability or financial regression |

## Deterministic stability harness

`scripts/phase5-stability.ts` runs **144 sequential fixture cycles**, with 144 deliberate overlap requests, two clean restarts, three synthetic financial states, RPC/MCP outage episodes, mocked rate limits and ambiguous notification errors. It advances a virtual clock by six hours per cycle (**36 virtual days**), then advances 200 more days to exercise retention.

It measures wall time, CPU user/system time, cycle duration percentiles, RSS, database/WAL sizes, backlog and delivery outcomes. Assertions require accepted and rejected reads, multiple error types, no known-console duplicate, preserved accepted state and fingerprints, retained pending work after pruning, valid reopened storage, and zero external calls. The four-minute loop wall budget plus the verification subprocess timeout bounds the experiment. Database content remains isolated local fixture state.

The [stability result](../evidence/phase5/stability-results.json) is labeled `DETERMINISTIC_BOUNDED_FIXTURE_STABILITY`, `productionSoakCompleted=false`. Reusing block data and advancing a synthetic clock cannot establish real chain progress, feed freshness, live notification reliability, a memory-leak absence at production duration or a 36-day real-time soak.

## Live and CLI verification

- `test/integration/live.test.ts` performs one actual position retrieval through fixed RPC and the official MCP SDK. Two assertions groups retain market/identity/sentinel/comparison/quality and indicative recovery proofs. There are no mocks or fallback fixtures in this suite.
- Inspect/current-risk/historical-risk CLI smokes write new Phase 5 evidence. The historical read at block `21853902` is compared with Phase 2's stored proof; three separate offline exact typed-input/full-result replays check all original Phase 2 risk bundles.
- Monitoring smoke runs two console-only one-cycle child processes plus status/history. It checks restart continuity and known-delivered preservation.
- Operational smoke runs 15 bounded built-CLI invocations, including invalid/missing-state exits, production-profile validation, explicit read-only connectivity probing, as-of readiness, backup, backup verification and isolated restore. It follows monitoring immediately to remain within the 600-second as-of policy.
- Oracle smoke runs three bounded audits and three persisted-status processes, retaining live and historical labels and two new immutable bundles. No deprecated tracing or alternate chain is used.

Live endpoint failures, changed runtime/market configuration or unavailable history are real failures. The verifier stops the dependent sequence and preserves exit codes; preservation and local checks still run. It neither skips a failed integration nor relabels fixture output as live evidence. Previous command/test attempts are retained under `verification-runs/` and development failure reports remain available.

## Host acceptance still required

Test the actual supervisor's graceful/forced stop, restart-rate limiter, service-account access and failed permissions; local filesystem fsync/power-loss behavior; long-lived reader/WAL pressure; expected-scale backup and restore duration; low disk; host memory/CPU/descriptor ceilings; log rotation; off-host restore with measured RPO/RTO; and an approved real-duration observation-only soak. Real Telegram/Discord delivery and destination validation require separate approval and remain untested here.

The production profile is deliberately stricter than the package engine range. Cross-platform tests here do not certify a Linux service or container. Record those results as new host evidence rather than rewriting the preserved Phase 1–5 local results.
