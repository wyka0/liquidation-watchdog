# Render security plan — Phase 7

**Proposed posture: one authoritative storage owner, a minimal public liveness endpoint, and authenticated read-only data routes.** A split deployment adds a private, authenticated owner API. No HTTP server, authentication layer or dashboard is implemented yet; no endpoint was deployed in Phase 7.

Companions: [architecture](render-architecture.md), [deployment plan](render-deployment-plan.md), [storage decision](render-storage-decision.md), [existing production security](production-security.md), [Phase 7 report](phase7-report.md).

Oracle assurance remains **UNVERIFIED**, freshness **UNKNOWN**, and every recovery estimate **indicative / `actionable: false`**. Production approval is **NOT GRANTED**.

## 1. Existing security foundation and its limits

- Production chain wiring uses fixed RPC `https://rpc.pharos.xyz` and MCP `https://mcp.pharos.xyz/mcp`, chain **1672**, read-method/tool allowlists, response bounds and fixed market/account identity. Test injection hooks are not end-user URL configuration. Preserve these boundaries.
- Notification adapters are explicitly enabled; disabled providers do not read their credential variables. Existing operational redaction (`src/operations/redaction.ts`) and structured logs reduce provider errors to controlled codes/messages.
- Storage rejects unsupported paths/aliases, schema drift, unsupported versions and invalid stored records. Writable initialization uses maintenance ownership; monitor mutations require long-lived ownership. Read-only opens do not initialize/migrate.
- The project contains financial **calculation** modules for repayment/additional collateral, but no transaction signing, sending, liquidation or position-changing execution feature.
- Existing CLI diagnostics are operator output, **not a reviewed public response schema**. They include runtime, resources, configuration and other internal details; observations may carry full assurance structures. Reusing redaction helpers alone does not make a wholesale object dump suitable for HTTP.

## 2. Endpoint exposure and authorization — proposed

| Surface | Exposure | Data / authority |
| --- | --- | --- |
| `GET /api/health` | Public, unauthenticated for Render | Tiny in-memory liveness/startup/terminal-status response. No PID, memory/disk details, configuration, database open, evidence walk or provider request. |
| `GET /api/readiness` | Authenticated operator read | Bounded, cached observation-readiness status with as-of time and fixed reason codes; distinct from financial actionability. |
| `GET /api/positions`, `/api/risk` | Authenticated operator read | Fixed identity and explicitly selected persisted numeric/quality/provenance fields. No arbitrary chain/address/URL selection. |
| `GET /api/alerts`, `/api/observations` | Authenticated operator read | Bounded historical pages, stable cursor, selected delivery/ambiguity fields. History is labeled as history. |
| `GET /api/monitoring/status` | Authenticated operator read | Sanitized monitoring lifecycle, last-cycle/age/backoff facts; no full runtime/config/assurance objects. |
| Minimal HTML dashboard | Same protected origin | Escaped rendering of these read projections; credentials are never embedded in HTML/JavaScript. |
| Topology 2 owner API | Private Service internal listener, authenticated server-to-server | Same bounded read contracts; no public listener/domain and no database-control routes. |

Read-only does not by itself authorize public disclosure of operational history. Recommended default is protected data access using a **new proposed `WATCHDOG_READ_API_TOKEN`**: bearer access for API clients and a fixed-user HTTP Basic gate over HTTPS for the initial browser dashboard. The token is the read-only password, never a wallet key or provider credential. Bound header lengths and compare fixed-length credential digests in constant time. Missing/invalid credentials must return a small refusal and no data; missing configuration must never silently enable public data access. This auth implementation and browser behavior require Phase 8 tests.

For Topology 2, use a distinct **proposed `WATCHDOG_INTERNAL_API_TOKEN`** in the frontend backend and `pserv`. Keep requests on Render's same-region private network with a fixed configured owner hostname/port; reject arbitrary hosts/redirects. Private networking narrows exposure but is not a substitute for authentication. Confirm internal transport protection during implementation; do not assume that a private HTTP hostname supplies TLS automatically. The browser receives only the frontend's sanitized response, never the internal credential.

## 3. Read access and payload isolation

- Pass a narrow read interface into HTTP routes. Use `new MonitorStore(path, { readOnly: true })` explicitly, outside request hot paths; never expose a default writable constructor or a raw SQL handle to routes. Validate existing storage at startup/reopen and use short coherent read transactions. Missing/corrupt data yields unavailable status, not initialization.
- Construct and validate dedicated response schemas. Retain exact integer strings/scales, `latest` versus `lastAccepted`, quality/effective/mathematical states, snapshot/block/hash/time and **`actionable: false`**. Reduce assurance to approved status/diagnostic fields rather than publishing its full evidence graph.
- Omit database paths, filenames/download paths, process IDs, environment values, configuration objects, stack traces, raw provider responses/errors, notification destinations, internal hosts and unrestricted administrative metadata. Alert delivery health needs status/count/ambiguity, not tokens or webhook URLs.
- Use bounded cursor queries (proposed default **20**, maximum **100** rows), deterministic ordering and parameter binding. Never call unbounded `deliveries()` for a page. New observation-history queries require read-only tests.
- Proposed response cap **256 KiB**, a bounded cache and bounded in-flight requests. Reduce page size or return a fixed error if a page cannot fit; never remove assurance/provenance fields to fit an oversized result. Cache timestamps and stale/unavailable semantics travel with the response.
- `operationalDiagnostics({ probe: true })`, CLI spawning, live risk calculations and upstream requests are excluded from request handlers. A controlled background read projection may reuse existing facts, but must not leak the operator diagnostic object or start another monitoring loop.

## 4. HTTP, abuse limits and rendering

- Bind the proposed Web Service to `0.0.0.0:$PORT`; use Render's public HTTPS termination. Trust forwarded headers only according to verified platform proxy behavior; do not accept arbitrary client-supplied IPs as a rate-limit identity.
- Allow only reviewed GET/HEAD routes. Reject mutation methods and unknown parameters/routes; no user-selected SQL, file, provider, chain, account or market. GET requests must never start/stop/reconfigure monitoring, initialize storage or trigger sends.
- Same-origin dashboard, no wildcard CORS. CORS is not authentication and does not prevent direct HTTP clients; auth applies independently. A separate Topology 2 frontend proxies on its backend rather than sharing internal credentials with browser code.
- Proposed bounded global/client concurrency and rate limits, with capped identity tables/expiry. Reserve a lightweight liveness path so normal platform probes are not throttled by dashboard usage. Bounded caching/read work must protect the monitoring event loop from HTTP floods.
- Emit `Cache-Control: no-store` for protected monitoring responses, `X-Content-Type-Options: nosniff`, a restrictive content security policy and frame restrictions. Avoid third-party scripts. Escape all output; never render provider-derived text as HTML.
- Fixed chain egress stays unchanged. New internal-read or backup-transfer destinations are separately configured trusted service destinations, never user-controlled proxies. No `url`, `file` or “force refresh” query parameter is proposed.

All HTTP policies above are **implementation requirements**, not existing verified behavior. Render's advertised TLS/DDoS features do not prove application-level authorization, memory bounds or responsiveness.

## 5. Secrets and notifications

Existing optional provider variables are `WATCHDOG_TELEGRAM_BOT_TOKEN`, `WATCHDOG_TELEGRAM_CHAT_ID`, and `WATCHDOG_DISCORD_WEBHOOK_URL`. Telegram and Discord remain **disabled by default**, regardless of whether environment variables exist. The monitoring engine requires no provider secret while they are disabled; proposed protected HTTP access introduces its own separate read credential.

Use Render's private environment injection for any future secret (`sync: false` in the unapproved draft). Never put values in source, JSON config, URLs, logs, evidence, browser storage, screenshots or command output. Avoid generated example tokens. `.env.example` remains the existing byte-pinned placeholder file; Phase 7 does not extend or read any private environment file.

When separately approved, enabled providers retain destination validation, timeout/retry, durable outbox and cooldown/block behavior. Real delivery and credential injection remain untested on Render. Status pages report delivery health without granting send/retry authority. At-least-once ambiguity and post-backup acknowledgment loss must stay visible, not be advertised as exactly-once delivery.

## 6. Operator, disk and recovery boundary

The monitoring process owns the database; maintenance runs through the owner's controlled CLI/Render Shell or SSH with the writer fenced. Configuration changes, runtime enablement, backups, restore promotion and migrations remain operator operations. The public app gets no Render API credentials or administrative HTTP endpoint.

Place DB and all sidecars, persistent runtime evidence and bounded backup staging on the one disk. Use private regular directories/files and least necessary OS permissions; verify actual Render ownership/access. Reject link aliases and path traversal. Serve only explicit response routes/assets; do not expose the repository, database, backups or evidence directories through a static-file root.

Backups include private operational history even when the monitored address is public. Restrict off-disk read/write access, verify complete content/evidence hashes, retain an immutable matching release/configuration identity and test isolated recovery. Render daily snapshots are supplementary platform storage protection; follow application-consistent backup/restore rather than treating raw disk snapshots as verified SQLite recovery.

## 7. Logs, probes and failure handling

Use the existing structured logger/code reduction for cycle and delivery events. Add bounded request metadata without authorization headers, credential values, query bodies, stacks or raw remote errors. Map failures to a fixed public API error vocabulary; keep detailed operator diagnostics protected and sanitized. Validate both app stdout and Render access-log behavior before acceptance.

Liveness is in-memory responsiveness plus startup/terminal lifecycle state. Readiness reflects cached database/observation facts with timestamps. Stale chain data, oracle **UNVERIFIED** and freshness **UNKNOWN** remain explicit observation/assurance states; they must not produce an uncontrolled restart loop. Fatal worker failure must not be hidden behind a healthy HTTP listener. Test total shutdown under HTTP/storage load within the platform's 30-second limit.

## 8. Phase 8 security acceptance and remaining risks

Required evidence: missing/invalid credential refusal; no secret/path/runtime-object leakage; no writable store/request-triggered monitoring or provider calls; size/cursor/concurrency limits; escaping/CORS/cache behavior; fatal/disabled lifecycle behavior; read concurrency and shutdown under load; and, for Topology 2, private ingress/token rejection/owner-outage behavior. Verify new credentials with presence/status reporting rather than recording values.

Residual risks are the co-located HTTP/worker failure domain, a single disk/owner, untested Render/Linux durability and signals, unimplemented access/bootstrap code, unmeasured real load/backup RPO/RTO, and untested real notification delivery. Workspace access, platform controls and off-disk recovery need actual host acceptance. The [deployment sequence](render-deployment-plan.md) carries these forward without changing financial or assurance status.
