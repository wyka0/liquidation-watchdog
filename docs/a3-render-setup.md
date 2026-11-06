# A3 — Render Free Web Service setup preparation

**DRAFT-UNAPPROVED-NOT-DEPLOYED.** The prepared Blueprint is [`render-a3.yaml`](../render-a3.yaml). It has never been applied, imported into Render or connected to a repository/account. Applying a Blueprint creates a resource even when automatic deploys are off; that action requires separate approval.

## 1. Blueprint contract

The draft defines exactly one native Node **Free Web Service**:

| Field | Prepared value |
| --- | --- |
| Runtime / version | `node`; `NODE_VERSION` is `24.14.1` (locally verified runtime). |
| Plan / instances | `free`; one instance. No scaling or paid resource. |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm run start:postgres` → `node dist/postgres-service.js` |
| Listener | Application binds `0.0.0.0` and Render-provided `PORT`. |
| Health | `/api/health`, in-memory and database/provider independent. |
| Shutdown | Blueprint allows 30 seconds; application retains its bounded scheduler/HTTP/pool shutdown and 10-second configured shutdown path. |
| Deploy control | `autoDeployTrigger: 'off'`; preview generation off. This does not authorize initial apply/deploy. |
| Filesystem | No disk declaration. All authoritative state is PostgreSQL; no SQLite path or write is configured. |
| Migrations | No pre-deploy/startup migration command. |

The historical paid/disk Phase 7 `render.yaml` remains byte-unchanged. `render-a3.yaml` is a separate Free/PostgreSQL draft with the required marker `DRAFT-UNAPPROVED-NOT-DEPLOYED`.

## 2. Environment names

Non-secret values in the draft:

- `NODE_VERSION`
- `WATCHDOG_STORAGE_BACKEND=postgres`
- `WATCHDOG_POSTGRES_NAMESPACE=watchdog_free`
- `WATCHDOG_SCHEDULER_ENABLED=false` (safe initial state)
- `WATCHDOG_SCHEDULER_SLOT_SECONDS=300`

Value-free `sync: false` placeholders:

- `WATCHDOG_POSTGRES_WRITER_URL`
- `WATCHDOG_POSTGRES_READER_URL`
- `WATCHDOG_READ_API_TOKEN`
- `WATCHDOG_SCHEDULER_SECRET`

The two database URLs are distinct role credentials. The scheduler secret is independently generated and must exactly match the secret stored in Cloudflare, while remaining distinct from the read token. Telegram/Discord remain disabled and no notification variable is required.

## 3. Future manual setup (not executed)

After A3 review and later provisioning authorization:

1. Create/select a Render workspace without enabling a paid plan or payment-backed overage.
2. Link the reviewed repository/revision manually. There is currently no verified Git release commit; content hashes remain the release identity.
3. Choose a region based on approved Neon region/latency. No region is hardcoded in the draft.
4. Validate the Blueprint again using Render CLI/API and inspect the final diff. Do **not** apply it as part of validation.
5. Enter the four secret values privately in Render. Never paste them into Blueprint/source/logs.
6. Keep `WATCHDOG_SCHEDULER_ENABLED=false`; deploy acceptance must start disabled and console-only.
7. Verify Node version, health, protected dashboard auth, no local database creation, Neon TLS/roles/catalog, SIGTERM exit and stale/readiness behavior.
8. A4 performs approved migration/cutover separately. A6 alone may enable the scheduler endpoint and then activate Cloudflare Cron.

## 4. Free limitations and cost controls

Official Render Free documentation reviewed **2026-11-04** states: Free Web Service **0.1 CPU / 512 MB**, 750 workspace instance-hours/calendar month, 15 minutes inbound-idle spin-down, about one-minute wake, ephemeral filesystem, arbitrary restarts, one instance, and no persistent disk, SSH/Shell or one-off jobs. Render may suspend unusually high service-initiated public traffic. Outbound bandwidth and build pipeline consume workspace included usage; current Hobby build allowance is 500 minutes/month, while the dashboard is authoritative for included outbound usage.

At `*/5`, authenticated Cron traffic should normally prevent a 15-minute idle interval, potentially consuming about 720 instance-hours in a 30-day month or 744 in 31 days. That narrowly fits the 750-hour allowance only if one Free service is consuming it and does not establish uptime. Other inbound traffic can also keep it active. Exhausting hours suspends all Free web services until reset; without a payment method, exhausted included bandwidth suspends Free services; exhausted build minutes blocks new builds while the old deploy may continue.

No local file is authoritative: restart, redeploy or spin-down loses filesystem changes. The service must fail if PostgreSQL is unavailable; it must never write or restore a SQLite database on ephemeral storage.

Sources: [Render Free](https://render.com/docs/free), [Blueprint reference](https://render.com/docs/blueprint-spec), and [Build Pipeline](https://render.com/docs/build-pipeline).

## 5. Local validation

`scripts/a3-validate-deployment.py` validates the YAML against Render's published JSON Schema (`https://render.com/schema/render.yaml.json`) and asserts the reviewed Free/disabled/diskless/secret-placeholder boundary. This is schema validation only, not account/API acceptance. The local Render CLI is unavailable, so no provider-side Blueprint validation is claimed.
