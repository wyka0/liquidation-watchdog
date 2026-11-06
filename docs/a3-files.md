# A3 files and preservation inventory

**Scope:** local preparation for Neon Free, a Render Free Web Service and a Cloudflare Workers Free Cron Trigger. No account, credential, cloud connection, resource, deployment, Cron activation, migration or real notification exists.

## 1. Modified A2/Phase 10 files (4)

| File | A3 change |
| --- | --- |
| `src/config/postgres.ts` | Accept Neon's reviewed `channel_binding=require` URL option, map it to node-postgres channel binding, retain verified TLS and reject every other new URL option. |
| `src/postgres-service.ts` | Pass the A2 `WATCHDOG_SCHEDULER_SLOT_SECONDS` name through the executable's explicit environment allowlist. |
| `test/postgres-config.test.ts` | Neon pooled URL/channel-binding acceptance and unsafe option refusal coverage. |
| `test/fixtures/postgres.ts` | Raise only disposable native Windows `pg_ctl` process/start allowance (75/60 seconds) after two real restart timeouts; no production connection/query/cycle/job/lease/HTTP bound changes. |

## 2. Added deployment/Worker/test/tool files (6)

| File | Purpose |
| --- | --- |
| `render-a3.yaml` | Separate Free/PostgreSQL Blueprint marked `DRAFT-UNAPPROVED-NOT-DEPLOYED`; one diskless Web Service, auto deploy and scheduler disabled, value-free secret placeholders. |
| `cloudflare/monitor-scheduler/wrangler.toml` | One `*/5 * * * *` UTC trigger; no account, endpoint or secret value. |
| `cloudflare/monitor-scheduler/src/worker.ts` | Thin `scheduled()` handler: one fixed HTTPS POST, 450-second abort, 8 KiB bounded receipt, no retry/direct DB/monitoring logic, safe logs. |
| `scripts/a3-validate-deployment.py` | Read-only official Render JSON-Schema validation plus reviewed Blueprint/TOML boundary assertions. |
| `test/cloudflare-worker.test.ts` | UTC slots, scheduled handler/noRetry, missing secret, URL refusal, timeout, non-2xx, redaction, semantic outcome and duplicate-slot tests. |
| `test/a3-deployment-config.test.ts` | Blueprint/Worker draft marker, Free/diskless/disabled, placeholder, Cron and service-environment checks. |

## 3. Added documents (8)

- [A3 report](a3-report.md)
- [A3 file inventory](a3-files.md) (this file)
- [Neon setup](a3-neon-setup.md)
- [Neon operations](a3-neon-operations.md)
- [Render setup](a3-render-setup.md)
- [Render operations](a3-render-operations.md)
- [Cloudflare setup](a3-cloudflare-setup.md)
- [Cloudflare operations](a3-cloudflare-operations.md)

## 4. Exact delta and historical boundary

Against `verification-a3-preflight-01.json`, A3 has **4 modified existing files and 14 additions** (6 implementation/config/test/tool + 8 documents). No package/lockfile, PostgreSQL migration/schema/catalog fingerprint, financial/oracle/chain/notification module, SQLite file, historical evidence or earlier report was modified.

The raw Git index remains SHA-256 `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689`. Because Phase 1–A2 work is intentionally uncommitted, these paths appear within the expanded untracked working tree; no staging/index operation was used.

## 5. Hash bindings

SHA-256/byte bindings for the four modifications, six non-document additions and all eight final documents are kept in the external final record:

`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\a3-deployment-validation\validation-final.json`

This avoids circular self-hashes. The same record binds the A3 preflight/final preservation records, Phase 10 final seal, A2 history record, SQLite byte count, Git index, tests, official-schema Blueprint validation, Worker validation disposition, secret scan and whitespace results. Its `passed: true` value and matching hashes are the A3 handoff authority.

## 6. Deliberately absent

No `.env`, credentials, account IDs, regions, repository URL/branch, Neon endpoint, Render service URL or Cloudflare binding value is added. There is no Render disk/database resource, Cloudflare KV/D1/queue/route, direct Worker-to-Neon path, migration command, import tool invocation or paid-plan configuration.
