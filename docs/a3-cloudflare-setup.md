# A3 — Cloudflare Workers Free Cron setup preparation

**DRAFT-UNAPPROVED-NOT-DEPLOYED.** The local Worker draft is [`cloudflare/monitor-scheduler/`](../cloudflare/monitor-scheduler/). No Cloudflare account, Worker, route, text binding, secret or Cron Trigger was created.

## 1. Prepared Worker

`src/worker.ts` exports an ES-module `scheduled()` handler. `wrangler.toml` contains exactly one UTC Cron Trigger:

```text
*/5 * * * *
```

Cloudflare Cron uses UTC. At each event, the Worker validates `controller.scheduledTime` as an exact five-minute boundary, converts it to canonical `YYYY-MM-DDTHH:mm:00.000Z`, and sends exactly one request:

- method/path: `POST /internal/monitor/run` on the fixed configured HTTPS origin;
- headers: dedicated Bearer authorization and `Content-Type: application/json`;
- body: `{"slot":"<scheduled UTC slot>"}` only;
- redirects: refused;
- timeout: 450 seconds;
- response: maximum 8,192 bytes and selected receipt fields only.

The Worker has no Neon URL/role, no dashboard credential, no chain/RPC/MCP code, no state database and no monitoring calculations. PostgreSQL remains the only execution lock/idempotency authority.

## 2. Bindings and secret separation

Future Worker configuration requires names only:

- `WATCHDOG_SCHEDULER_URL` — non-secret text binding containing the exact Render HTTPS endpoint ending `/internal/monitor/run`.
- `WATCHDOG_SCHEDULER_SECRET` — secret binding, independently generated with at least 256 random bits.

The same scheduler secret value is entered privately in Render's `WATCHDOG_SCHEDULER_SECRET`, but it is never the dashboard `WATCHDOG_READ_API_TOKEN`. Never put either value in `wrangler.toml`, source, tests, docs, command history, logs or screenshots. The Worker does not log destination URLs, authorization headers, request bodies, raw response bodies or exceptions.

## 3. Future manual steps (not executed)

Only after A6 approval and a verified disabled Render/Neon target:

1. Create/select a Cloudflare Workers **Free** account without upgrading to Workers Paid.
2. Install/review an approved Wrangler version. No Wrangler package is installed in this repository today.
3. From `cloudflare/monitor-scheduler`, configure the non-secret endpoint binding privately through the dashboard or reviewed Wrangler mechanism.
4. Add the secret with Worker secret storage (for example, the interactive `wrangler secret put` flow); never add a TOML value.
5. Run Wrangler's local scheduled-handler test with a local mock endpoint, then a dry-run bundle. Do not point local validation at Render.
6. Review bundle size/startup/CPU output and verify the single Cron expression.
7. Deploy only after explicit approval. Cron changes can take up to 15 minutes to propagate.
8. Keep Render scheduling disabled until both sides' credentials and endpoint refusal behavior pass. Enable the endpoint, perform one authorized slot, inspect the durable receipt, then separately activate Cron.

Applying/deploying the Worker or Cron is outside A3.

## 4. Free limits and invocation count

Cloudflare documentation reviewed **2026-11-04** lists Workers Free: 100,000 requests/day, 10 ms CPU per invocation (including Cron), 128 MB memory, 50 subrequests/invocation, six simultaneous outgoing connections, five Cron Triggers/account and 15-minute Cron wall time. The draft uses one trigger, one subrequest, one bounded response and no storage/KV/queue.

Five-minute cadence is **288 invocations/day**, **8,640 per 30-day month**, and **8,928 per 31-day month**—well below the request allowance by itself. This does not reserve account-wide capacity: other Workers share limits. CPU is the principal Free constraint; network wait does not count as CPU, but URL/JSON/log processing still must be measured by Wrangler/provider metrics.

Exceeding the Free daily request limit returns Cloudflare Error 1027. CPU/memory excess can terminate the invocation. A missed/terminated Cron produces no synthetic observation and cannot self-report through the missed invocation; independent overdue monitoring remains an A6/A8 requirement.

Sources: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## 5. Local validation status

The source is TypeScript-checked and exercised through local Vitest mocks for UTC slots, missing secret, URL refusal, timeout, non-2xx, redaction and duplicates. TOML structure is parsed by `scripts/a3-validate-deployment.py`.

**Wrangler is unavailable locally** (no global executable or local dependency), so no `wrangler dev --test-scheduled` or dry-run bundle result is claimed. Installing/deploying Wrangler was not authorized; this missing provider-runtime validation remains explicit.
