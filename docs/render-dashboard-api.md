# Protected read-only dashboard/API — Phase 8

**Implemented locally for the single-process Web Service.** Public exposure is limited to tiny in-memory liveness; dashboard and monitoring data require authentication. No endpoint controls monitoring, databases, notifications or transactions.

Companions: [runtime operations](render-runtime-operations.md), [Phase 8 report](phase8-report.md), [tests](phase8-test-evidence.md), [inventory](phase8-files.md), and the preserved [Phase 7 security plan](render-security-plan.md).

## 1. Authentication and transport

The runtime requires an explicitly supplied `WATCHDOG_READ_API_TOKEN`, 32–256 ASCII base64url-style characters (`A–Z`, `a–z`, `0–9`, `_`, `-`). Missing/invalid configuration fails startup. No value is present in the repository, HTML, script, examples, evidence, URLs or logs.

Supported request forms are bearer authentication and HTTP Basic with fixed username `watchdog` and the same read credential as password. Authorization headers are bounded to 1,024 characters; duplicate Authorization headers and malformed/noncanonical Basic encodings are rejected. Credential comparison hashes the candidate and configured credential to fixed-length SHA-256 digests and uses `timingSafeEqual`.

An unauthenticated or invalid-credential data/asset request receives `401` with a Basic challenge and `{"error":"AUTHENTICATION_REQUIRED"}`. API clients can supply bearer headers. A browser can use its native Basic challenge; the application does not store credentials in JavaScript, browser storage or cookies. There is no application logout endpoint; Basic credential retention belongs to the browser.

Future public use relies on Render HTTPS termination. Local tests used synthetic in-memory credentials and loopback HTTP. Actual Render TLS, proxy forwarding, access-log redaction and browser challenge behavior require host acceptance.

## 2. Routes

GET and HEAD are the only reviewed methods. HEAD returns the same status/headers without a body. Other methods receive `405` and `Allow: GET, HEAD`. All data is persisted: requests do not contact RPC/MCP/providers, calculate fresh risk, spawn a CLI or open a new DB.

| Route | Access | Successful response / semantics |
| --- | --- | --- |
| `/api/health` | Public | Only `{"status":"RUNNING"}` or `{"status":"DISABLED"}` with 200; starting/stopping/stopped/failed status uses 503. No DB, filesystem scan, PID, resource metrics or provider probe. |
| `/api/monitoring/status` | Authenticated | Lifecycle, monitoring enablement, revision, bounded worker status/error code, latest cycle, observed times, age, consecutive failures, backoff flag and min/max cadence after completion. A disabled missing DB can still return status. |
| `/api/readiness` | Authenticated | Observation-readiness boolean and fixed reason codes. 200 when ready; 503 when not ready. Operational readiness never means financially actionable. |
| `/api/positions` | Authenticated | Fixed position identity, `latest` and `lastAccepted` projections, exact raw debt/collateral amounts and provenance. |
| `/api/risk` | Authenticated | The same coherent position/risk envelope, including mathematical/effective/quality states, scaled ratios, thresholds and indicative recovery estimates. |
| `/api/observations` | Authenticated | Descending persisted observation history, bounded page and `nextCursor`. |
| `/api/alerts` | Authenticated | Descending alert history, previous/current projections, severity/category/code, selected delivery status/attempt/error/ambiguity fields. |
| `/` | Authenticated | Minimal HTML dashboard. Manual refresh only. |
| `/dashboard.js`, `/dashboard.css` | Authenticated | Fixed same-origin strings compiled into the application; no filesystem/static-file root. |

Unknown authenticated routes return `404`. Database, backup, evidence and repository files are not served. Mutation/transaction routes do not exist. Unauthenticated unknown routes are refused before a data lookup.

## 3. Data contracts and safety

Dedicated strict response schemas validate allowlisted projections. They do not serialize `summary()`, CLI diagnostics, full runtime/configuration objects or full assurance graphs.

Position identity includes chain **1672**, fixed market/account, protocol and public-demonstration account role, fixed token addresses and decimals (loan 6, collateral 18). No caller may choose another chain, market, account, provider, file or query language.

Every data envelope includes schema version, fixed identity and metadata:

- `asOf`: time of the coherent persisted read projection.
- `cacheExpiresAt`: the projection's one-second cache horizon.
- `history`: true for history routes, false for current status/position projections.
- `stale`: true when an accepted snapshot is absent/older than the 600-second configured observation budget or the latest attempt is rejected.
- `lastAcceptedAgeSeconds`: local age of the last accepted snapshot retrieval, or null.
- Safety: **oracle assurance `UNVERIFIED`, freshness `UNKNOWN`, `actionable: false`, estimates `INDICATIVE_ONLY`, RPC/MCP shared upstream not independent**.

`latest` and `lastAccepted` remain separate. A rejected latest attempt does not replace the accepted baseline, and historical/cached data is not relabeled as a fresh observation. Missing estimates stay null. Integer amounts/ratios remain exact decimal strings, with ratio scale and token units. Thresholds remain warning **1.30**, critical **1.10**, target **1.25**, liquidation boundary **1.00**.

Risk provenance includes evidence kind, temporal context, block number/hash/timestamp, snapshot identifier/retrieval time, calculation time/version and estimate provenance. Estimates retain their raw/formatted amounts, decimals, method, target ratio and matching input snapshot/block/time. Each remains indicative and non-actionable. Assurance is reduced to overall/gate/dimension states, fixed configuration-change/timestamp-anomaly codes and the invalidation flag; evidence locators, findings text, operators and internal configuration are omitted.

Readiness reason codes are `MONITOR_DISABLED`, `RUNTIME_NOT_RUNNING`, `DATABASE_UNAVAILABLE`, `NO_ACCEPTED_OBSERVATION`, `LATEST_OBSERVATION_REJECTED`, `OBSERVATION_STALE`, and `NON_LIVE_OBSERVATION`. They are observation-operating conditions, not changes to oracle/freshness assurance. A stored `workerStatus` describes the last persisted worker; the live runtime lifecycle and monitoring-enabled flag must be read alongside it.

Delivery history exposes only channel, state, attempts, next eligible retry time where applicable, controlled error code and ambiguity. It grants no retry/send authority and includes no destination or credential. At-least-once ambiguity remains visible, including after a later successful delivery.

## 4. Pagination and validation

Only history routes accept query parameters:

| Parameter | Rule |
| --- | --- |
| `limit` | Default 20, integer 1–100, canonical positive decimal spelling |
| `before` | Exclusive positive SQLite rowid cursor, safe integer, at most 16 decimal digits |

The server binds cursor/scope/limit parameters; callers cannot supply SQL. Results are ordered by insertion rowid descending. Use the returned `nextCursor` verbatim to fetch older records; null means the bounded page has reached the end. A new concurrent commit does not repeat rows on an older page. Retention can remove history between requests; the API does not promise a historical snapshot across multiple requests.

Duplicate or unknown parameters, noncanonical numbers, excessive limit/cursor, empty query spelling, overlong targets, request bodies/transfer encoding and malformed request metadata are refused. Other routes accept no query parameters. There is no force-refresh, address, chain, URL or path selection.

## 5. Read work and abuse bounds

| Boundary | Implemented bound |
| --- | --- |
| Header bytes / header count | 8 KiB / 32 |
| URL bytes | 2,048 |
| Authorized JSON response | 256 KiB |
| History page | 20 default / 100 maximum |
| Persisted JSON parsing | 1 MiB aggregate per snapshot; state 1 MiB, runtime 32 KiB, individual history JSON 256 KiB |
| Delivery rows | At most 3 per returned alert; query hard stop at 301 rows |
| Read transaction busy wait | 50 ms |
| JSON cache | One second; at most 16 entries / 4 MiB |
| Cache-miss read operations | At most 8/second globally |
| Simultaneous data requests | 16 globally / 4 per socket-peer identity |
| Data request rate | 300/minute globally / 120/minute per socket peer |
| Identity table | 256 entries with expiry; full table refuses new identities |
| Connections / requests per connection | 64 / 32 |
| Header / request / idle timeout | 5 / 10 / 5 seconds; keep-alive 1 second |
| HTTP shutdown | Idle close plus forced socket closure after 2 seconds |

The hot path uses one validated read-only connection, a short coherent transaction, selected SQL columns, parameterized limits and capped parse/output buffers. Expensive startup integrity/reference validation is not run per request. A page that cannot fit returns a fixed `413`; request a smaller `limit` rather than dropping assurance/provenance fields.

Liveness bypasses dashboard rate/read budgets. The transport connection ceiling and event loop are still shared. IP limits use actual socket peers; unverified `X-Forwarded-For` values do not create identities. Render proxy peers may aggregate several clients into one limit until real proxy behavior is accepted.

These are admission/output bounds, not a hard SQLite CPU deadline. The unchanged schema and synchronous engine still need representative large-database/query and flood testing on Render. The short local tests do not establish performance at the 4 GiB ceiling.

## 6. Errors, headers and rendering

Fixed public refusals are `INVALID_REQUEST`, `METHOD_NOT_ALLOWED`, `AUTHENTICATION_REQUIRED`, `ORIGIN_REFUSED`, `INVALID_QUERY`, `NOT_FOUND`, `RATE_LIMITED`, `RESPONSE_LIMIT`, `DATA_UNAVAILABLE` and `SERVICE_UNAVAILABLE`. Storage/schema/transport errors become sanitized refusals; exception text, SQL, stacks, paths and remote responses are never echoed. Malformed HTTP/parser failures receive a minimal 400. Rate limiting includes a retry hint.

Responses use `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, frame denial, no-referrer and restrictive permissions/CSP headers. The CSP permits only same-origin script/style/connect, with no inline scripts, third-party assets, frames or form submissions. No wildcard CORS is emitted; explicitly cross-site fetch metadata is refused for protected routes. Authentication applies independently of CORS.

The dashboard sequentially requests the read projections, displays the safety banner, as-of/stale/history information, and lets the operator manually refresh or fetch older pages. Dynamic content is assigned with `textContent`; provider strings are not rendered as HTML. It contains no transaction controls and never stores or embeds the credential. It does not auto-poll.

API failures are contained in the HTTP layer and do not start/stop monitoring. A terminal worker failure changes the in-memory lifecycle and closes the listener, so healthy HTTP cannot conceal a failed monitor. Detailed local checks and limitations are recorded in [Phase 8 test evidence](phase8-test-evidence.md).
