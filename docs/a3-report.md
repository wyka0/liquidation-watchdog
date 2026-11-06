# A3 — Free-tier cloud deployment preparation report

**COMPLETE — local preparation and validation only; NOT PROVISIONED, NOT DEPLOYED, NOT SCHEDULED.** The project now contains an unapproved Render Free Blueprint, Neon Free setup/operations procedures, and a thin Cloudflare Workers Free Cron draft for the approved five-minute UTC cadence. No provider account or credential was requested/read, no cloud API/database was contacted, no resource or paid service was created, no migration/import occurred, and no Cron was activated.

Deliverables: [files/hashes](a3-files.md), [Neon setup](a3-neon-setup.md), [Neon operations](a3-neon-operations.md), [Render setup](a3-render-setup.md), [Render operations](a3-render-operations.md), [Cloudflare setup](a3-cloudflare-setup.md), and [Cloudflare operations](a3-cloudflare-operations.md). Platform documentation research date: **2026-11-04**.

## 1. Preflight and authority review

Read Phase 1's inventory, Phase 2–5 reports, Phase 6 host acceptance, Phase 7–10 reports, A2 cadence, PostgreSQL operations, scheduler endpoint contract and all four security documents. Pre-edit checks passed:

- Phase 10 final certificate SHA-256 `d3f9dc224f6bcc59124084f590484c37d65898dc447ef6da501f18a740367b9e`, `passed:true`.
- A2 history record SHA-256 `176111b92b24f5b0c8810fe0648f7a80867bfd5f3b6ce6421fa27008877f81cb`, `passed:true`.
- `verification-a3-preflight-01.json`: 1,773 original files unchanged; six historically authorized originals; 27 then-current additions; 64 SQLite files / 7,806,976 bytes unchanged; 665 seal bindings, 221 evidence payloads and 1,241 Phase 8 snapshot bindings intact.
- Git index SHA-256 `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689`; initial A3 working-tree status 1,284 entries / SHA-256 `5f5681793440efc240c8d771a33511328966973cc573949e1c68c4ba6247ddb9`.

No historical verification failed, so preparation proceeded.

## 2. Prepared architecture

```text
Cloudflare Workers Free Cron (UTC */5, one request, scheduler secret only)
    -> HTTPS POST /internal/monitor/run
Render Free Web Service (Node 24.14.1, 0.0.0.0:$PORT, auto-deploy/scheduler initially off)
    -> pg 8.23.1, max one pooled writer + one pooled reader connection
Neon Free PostgreSQL 17 (separate runtime roles, explicit operator migrations)
```

Cloudflare never receives a database/read credential and runs no monitoring logic. Render has no local durable state and performs no startup migration. Neon supplies durable fencing, slot receipts, observations, state and outbox. Operator direct database authority remains outside all runtime components.

## 3. Neon/pg preparation

The existing strict URL parser now supports Neon's recommended optional `channel_binding=require` alongside `sslmode=require|verify-full`, maps channel binding into node-postgres, and retains certificate verification. Unknown/permissive/duplicated URL options remain rejected. Runtime pools remain lazy, `max=1` per role, bounded, transaction-mode-pooler-safe and scale-to-zero reconnect-aware. No database connection was attempted.

Setup/operations documents define future PostgreSQL 17 selection, direct operator versus pooled runtime endpoints, separate least-privilege roles, no startup migrations, quota headroom, sleep/reconnect behavior and stop conditions. A4 still owns schema application and any real SQLite import/cutover.

## 4. Render preparation

[`render-a3.yaml`](../render-a3.yaml) is independently marked `DRAFT-UNAPPROVED-NOT-DEPLOYED`. It declares one Free Node Web Service, one instance, no disk/database, auto deploy/previews off, build `npm ci --include=dev && npm run build`, start `npm run start:postgres`, health `/api/health`, and value-free placeholders for two database URLs plus read/scheduler credentials. Monitoring starts disabled at the approved 300-second configuration.

The official Render JSON Schema accepted the draft. This validation did not call a Render account/API and did not apply the Blueprint. The Render CLI is not installed, so provider-CLI validation remains unexecuted.

## 5. Cloudflare preparation

The Worker uses the module `scheduled()` handler, exact UTC scheduled time, one HTTPS request, a dedicated secret binding, no redirects/retries, 450-second timeout, 8 KiB response cap and allowlisted status/cycle fields. `controller.noRetry()` prevents platform retry; duplicate delivery remains safe through PostgreSQL's deterministic slot/lease protocol. A successful HTTP result remains distinct from `observationAccepted` and is not represented as proof of a fresh chain read.

Wrangler configuration has exactly `*/5 * * * *`, `workers_dev=false`, no account ID and no binding values. Wrangler is unavailable locally, so neither `wrangler dev --test-scheduled` nor dry-run bundling is claimed. TypeScript/Vitest/TOML validation passed; provider-runtime validation awaits a reviewed Wrangler install and A6.

## 6. Free-tier capacity and failure posture

| Provider | Current Free facts reviewed 2026-11-04 | Failure posture |
| --- | --- | --- |
| Render | 0.1 CPU/512 MB, 750 instance-hours/month, 15-minute idle spin-down, ~1-minute wake, ephemeral files, no disk/Shell/one-off jobs, arbitrary restarts | Five-minute inbound Cron may consume 720 h/30d or 744 h/31d; suspension/restart means no invocation, no local recovery and stale data. |
| Neon | 100 CU-h/project/month, 1 GB DB/project (20 GB/account), 5 GB transfer/project/month, mandatory 5-minute scale-to-zero, six-hour/1-GB-change history, one snapshot, no SLA | 0.25 CU continuously active for five-minute cadence is ~90 CU-h/30d or ~93/31d before overhead. Quota suspension/storage failure is fail-closed. |
| Cloudflare Workers | 100,000 requests/day, 10 ms CPU/Cron, 128 MB, 50 subrequests, five Cron triggers/account, 15-minute Cron wall time | Draft uses 288/day, 8,640/30d (8,928/31d), one trigger/subrequest and no retry. CPU/quota termination can create an externally detectable missing slot only. |

Zero advertised base price is not a service guarantee. No paid plan/overage/payment method is enabled or authorized. Actual compute, wake, transfer and storage behavior must be measured before operation.

## 7. Safety and security invariants

Unchanged: chain 1672; fixed Pharos RPC/MCP and Morpho position; exact BigInt calculations; thresholds 1.30/1.10/1.25/1.00; 600-second freshness limit; oracle `UNVERIFIED`; freshness `UNKNOWN`; `actionable:false`; 240/300/360/420-second cycle/job/lease/HTTP bounds; database fencing, durable receipts, duplicate prevention and at-least-once notification ambiguity.

Secrets remain independently placed in Render and Cloudflare secret stores only. The Worker has no Neon access. Dashboard and scheduler credentials remain separate. Blueprint/TOML/docs/tests contain names or generated in-memory test values only, never a real/static secret. Real notifications remain disabled.

If any provider sleeps, throttles, suspends, misses, restarts or fails: no synthetic observation, no stale-to-fresh promotion, no SQLite fallback, no unlimited retry and no actionability promotion occur.

## 8. Local verification results

| Check | Final result |
| --- | --- |
| Focused A3/scheduler/config suites | **97/97**, five files |
| Full unit/fixture suite | **814/814**, 40 files (single worker, 20-second global test allowance for known Windows process timing) |
| Native PostgreSQL 17.11 integration | **59/59**, including real immediate restart and killed-child recovery |
| TypeScript / exact-scope ESLint | PASS / PASS |
| Production application build | PASS; 297 out-of-tree outputs; repository `dist` untouched |
| Render official JSON-Schema + local Blueprint/TOML assertions | PASS |
| Wrangler local/runtime validation | **UNEXECUTED — tooling unavailable**, explicitly not claimed |
| Read-only secret scan | PASS — final count/finding binding in external validation record |
| A3 file whitespace | PASS — final count in external validation record |
| Historical/SQLite/index verification | PASS — final binding in external validation record |

Two superseded native runs passed 56/59 before the disposable Windows PostgreSQL restart exceeded its old 20-second `pg_ctl` startup allowance; the stopped server caused the next two setup failures. The fixture-only allowance was raised to 60 seconds (outer process 75 seconds); no production bound changed. The final native run passed 59/59, with the real restart completing in ~76 seconds total.

## 9. Remaining account setup and manual work

1. Review/approve specific Neon, Render and Cloudflare accounts, regions, repository identity and zero-paid-spend policy.
2. Provision Neon PostgreSQL 17 and restricted roles; A4 separately authorizes migrations/import/cutover.
3. Install/review Render CLI/Wrangler and repeat schema/dry-run validation without deploying.
4. Enter four Render secrets and two Cloudflare bindings privately; perform credential rotation/refusal checks.
5. Apply the Render Blueprint only after approval, still scheduler-disabled; run A6 host/cold-start/TLS/proxy/shutdown/load acceptance.
6. Deploy Worker and activate Cron only after separate A6 approval and one bounded manual receipt test.
7. Approve independent backup/recovery (A5), real notifications (A7), then production operation (A8) separately.

## 10. Preservation and stop

Final hashes, exact delta/status, test records and historical checks are bound externally by `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\a3-deployment-validation\validation-final.json` and summarized in [the inventory](a3-files.md). No commit, push, stage/index change, cloud login/resource, paid action, Neon connection, Render/Worker deployment, Cron activation, migration/import, real notification or financial transaction occurred.

**Stopping point: A3 local preparation complete. Awaiting review before actual account provisioning or deployment.**
