# A3 — Cloudflare scheduler operations preparation

**DRAFT-UNAPPROVED-NOT-DEPLOYED.** This runbook describes a future thin Cron scheduler; it is not an active service.

## 1. Per-invocation behavior

The `scheduled()` handler calls `controller.noRetry()` and delegates one bounded promise through `waitUntil`. There is no Worker retry loop. A duplicated platform invocation sends the same canonical slot; Render/PostgreSQL returns the existing receipt or in-progress/busy result without starting a second cycle.

The Worker distinguishes:

- HTTP status (`httpStatus`);
- endpoint receipt status (`outcome`);
- persisted observation acceptance (`observationAccepted`);
- durable `cycleId`, slot and missed-slot count.

A 2xx HTTP response proves only that an endpoint response was received. `IN_PROGRESS` is not completion, and `COMPLETED` with `accepted:false` is not a fresh accepted chain observation. The dashboard/readiness remains the view of persisted age and acceptance.

## 2. Safe logs

Allowlisted structured events:

- `scheduler_result` — HTTP status plus validated outcome/slot/cycle ID/acceptance/missed count/error code;
- `scheduler_http_failure` — the same bounded fields for non-2xx;
- `scheduler_request_failed` — fixed `ENDPOINT_TIMEOUT` or `NETWORK_FAILURE` plus slot;
- `scheduler_response_failed` — fixed response error, HTTP status and slot.

Never log secret/binding values, endpoint URL, headers, body, raw response, exception text or Cloudflare environment. Free Workers Logs currently retain up to three days and allow 200,000 written events/day; retention is not an independent audit trail. Durable execution receipts remain in PostgreSQL.

## 3. Failure handling

| Worker observation | Meaning / response |
| --- | --- |
| `SECRET_CONFIG` / `ENDPOINT_CONFIG` | Configuration fault; no fetch occurs. Disable Cron until corrected privately. |
| `SLOT_CONFIG` | Scheduled time is not an exact UTC five-minute boundary; no request and no fabricated slot. |
| `ENDPOINT_TIMEOUT` | Render/Neon/provider work exceeded 450 seconds or connection stalled. No Worker retry; query durable state through protected operations later. |
| `NETWORK_FAILURE` | No trusted response. Outcome is unknown; never assume rollback or observation success. |
| `ENDPOINT_NON_2XX` | Endpoint returned a bounded failure/busy result. Preserve the status; do not retry in the Worker. |
| `RESPONSE_INVALID` | Refuse oversized/malformed output; do not log body. |
| Cloudflare quota/CPU termination | Invocation can disappear without application log. External Cron/receipt overdue monitoring is required before production. |

If Render sleeps, a request should wake it; at five-minute traffic it might instead stay active and consume almost all monthly Render Free hours. If Neon sleeps/wakes slowly or a chain read fails, the endpoint fails or records a rejected/failed cycle. None of these paths create a synthetic observation or bypass the 600-second freshness rule.

## 4. Rotation and incident response

Rotate the scheduler capability by privately creating a new high-entropy value, updating Render and Cloudflare within a finite window, testing one bounded authorized request, then removing the old value and verifying refusal. Do not print either value or comparison digest. Because Render accepts only one current secret, plan ordering to minimize outage and never keep permanent dual credentials.

On suspected Worker compromise: disable/delete the Cron trigger, rotate only the scheduler secret, preserve Cloudflare metadata and PostgreSQL receipts, reconcile slots admitted during the incident, and confirm the Worker held no database/read token. Read-token compromise has a separate Render rotation path.

## 5. Operational review

During an approved finite run, compare expected UTC slots with PostgreSQL receipts and alert on overdue/missed sequences from an independent mechanism. Review Worker invocation outcome/CPU/wall time, Render wake/status and Neon usage. Cron history is not a guarantee: schedule changes can take up to 15 minutes to propagate and Free service availability has no SLA.

Do not add direct Neon, chain reads, notification delivery, catch-up loops, queues, KV or Durable Objects to this Worker without a new architecture/security review. It remains a scheduler, not a second monitoring engine.
