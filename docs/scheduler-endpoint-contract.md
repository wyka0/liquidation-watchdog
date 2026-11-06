# Scheduler endpoint contract (`POST /internal/monitor/run` — Phase 10)

This contract originated in the locally verified Phase 10 implementation. Nothing in Phase 10 deployed an external trigger, enabled scheduling or caused a real notification. **Current-reference update — 2026-11-06:** cadence follows the later [A2 configuration](a2-monitoring-cadence.md), rather than the historical 30-minute grid. Implemented admission and local tests do not establish deployed scheduling or production-duration operation; see the [submission qualification limits](SUBMISSION-PACKAGE.md#g-production-readiness).

## 1. Endpoint summary

| Property | Requirement |
| --- | --- |
| Path / method | `POST https://<runtime-host>/internal/monitor/run` |
| Authentication | `Authorization: Bearer <WATCHDOG_SCHEDULER_SECRET>` — compared as **SHA-256 digests** via `timingSafeEqual`; the secret must be `^[A-Za-z0-9_-]{43,256}$` (≥256 generated bits). The scheduler credential must differ from the dashboard read credential (`WATCHDOG_READ_API_TOKEN`), refused as `SCHEDULER_AUTH_CONFIG`. |
| Body | Exactly one JSON member: `{"slot":"<UTC slot>"}`, `Content-Type: application/json`, no `Transfer-Encoding`/`Content-Encoding`, `Content-Length` 1–1,024 bytes (`PG_LIMITS.bodyBytes`). The literal-text regex forbids duplicate keys, escaped aliases and extra members before Zod parses the value. |
| Request limits | max 2 concurrent executions, max 6 invocations/minute (429 `RATE_LIMITED`); response header `Connection: close`; no `Origin`/non-`none` `Sec-Fetch-Site` (403 `ORIGIN_REFUSED`). |
| Timeouts | 5 s admission timeout with a 1,024-byte body cap **before** authentication cost; accepted jobs get the 420,000 ms socket budget (`PG_LIMITS.httpMs`). |
| Lifecycle | Callable only while `RUNNING` (with `WATCHDOG_SCHEDULER_ENABLED=true`); 503 `SERVICE_UNAVAILABLE` otherwise. |

The scheduler never receives, stores or smells the database URLs: it holds one secret only. IP-note: forwarded proxy headers cannot manufacture rate-limit identities; identities are socket peers only.

## 2. Slot rule and receipts

`slotSchemaFor(periodSeconds)` accepts canonical UTC timestamps exactly as `YYYY-MM-DDTHH:mm:00.000Z`: a real calendar instant, seconds `00`, milliseconds `.000`, and a whole-minute position on the configured UTC grid. `WATCHDOG_SCHEDULER_SLOT_SECONDS` defaults to **300 seconds**, giving UTC minutes **00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50 and 55**. Startup accepts only canonical positive integers that are multiples of 60, divide 3600, are at least the 240-second cycle budget and are at most 3600.

One deterministic `cycleId`/`executionId` pair is derived per `(namespace, morpho-30m-v1, slot)` by SHA-256, so duplicate trigger invocations for the same slot converge instead of creating parallel work. `morpho-30m-v1` is the frozen database/identity lineage label, retained across cadence configuration changes; it is not a 30-minute scheduling rule.

Response statuses (allowlisted; any unexpected runner state is sanitized to 503 `EXECUTION_UNAVAILABLE`):

| HTTP | Body | Meaning |
| --- | --- | --- |
| 200 | `{"status":"COMPLETED","slot","cycleId","completedAt","accepted":bool,"missedSlots":n,"error":null}` | The job ran to a persisted, receipt-published terminal state this invocation. |
| 200 | same shape with `"status":"INTERRUPTED","error":"PROCESS_INTERRUPTED"` | A previous attempt on this slot was killed/superseded; this call derived the interrupt receipt from durable state (never from a live guess). |
| 202 | `{"status":"BUSY"}` / `{"status":"SLOT_REFUSED"}` | Another slot owns the global lease, or this slot is not admissible (already terminal, in the future, or before the high-water mark). |
| 200 | `{"status":"IN_PROGRESS","slot","cycleId"}` | The losing side of a concurrent admit: the durable admission exists and its owner still holds the lease. |
| 500 | `{"status":"FAILED","error":"JOB_TIMEOUT","accepted":false,"missedSlots":n,"completedAt":...}` | The 300 s job budget expired; the cycle and receipt reflect the timeout decision, not the late work. |
| 500 | `{"status":"FAILED","error":"CYCLE_FAILED","accepted":true,"missedSlots":n}` | The cycle persisted a real failure outcome; acceptance is **derived from the persisted cycle**, not from the request. |
| 200 | `{"status":"OUTCOME_UNKNOWN"}` | A bounded uncertainty window redacted as an explicit unknown; the durable execution row defines the truth (verified by the lost-acknowledgment/lost-COMMIT tests). |

`accepted` in every receipt is computed from the persisted `cycles.accepted` row; `completedAt` is the database-clock `utc_text` recorded with the receipt binding. `missedSlots` is 0 for the first admitted slot; otherwise it is `max(0, floor(elapsedSeconds / periodSeconds) - 1)` between the lease high-water mark and this slot. Contiguous configured slots therefore report 0; with the 300-second default, admission at 12:15 after a 12:05 high-water slot reports one missed slot (12:10). No catch-up observation is invented.

The stored binding is also tamper-evident: `receipt_json` must equal the Zod-validated receipt **and** the stored `completed_at` must equal `receipt.completedAt` (binding committed in the same transaction). Any DBA edit to receipt bytes, acceptance, or `completed_at` shifts later calls of the same slot to `STORE_CORRUPT`, surfaced as sanitized failures, never as a fresh baseline or a replausible slot.

Receipt retention note: a pruned (or otherwise absent) `scheduled_executions` row for an old slot plus a non-regressing `worker_lease.high_water_slot` prevents replay: admitting that slot returns `SLOT_REFUSED` even if database time rolls backward, and the high-water mark never moves backward.

## 3. Request behavior under the scheduler budget model (Phase 9 §7, implemented)

- Cycle budget remains **240 s**. The DB-active job budget is **300 s** (`jobMs`), the lease expiry **360 s** (`leaseSeconds`), and the whole HTTP trigger invocation **420 s** — accepted jobs stay inside the Worker Cron 15-minute wall budget with margin.
- At most one in-flight execution per slot; the trigger may poll the same slot for its receipt at most once after the first unknown/late reply.
- `Connection: close` prevents proxy connection reuse from idolizing a finished trigger.
