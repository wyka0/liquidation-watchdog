# Stage 3B — Runtime Notification Wiring

**Completed:** 2026-11-05  
**Scope:** local runtime wiring, outbox safety and mocked-provider qualification only  
**Decision:** **GO locally; real provider delivery requires separate approval**

## 1. Runtime wiring

The PostgreSQL entrypoint now resolves one complete monitoring configuration and one threshold configuration:

- `WATCHDOG_MONITORING_CONFIG_PATH` — optional bounded non-secret JSON configuration;
- `WATCHDOG_RISK_CONFIG_PATH` — optional bounded threshold JSON configuration.

Scheduler enablement and slot cadence remain controlled by the existing explicit PostgreSQL scheduler variables. The runtime overrides only monitoring `enabled`/interval and the reviewed PostgreSQL operation budgets; notification policy, retention and resource settings come from the resolved monitoring configuration.

`runPostgresService()` constructs adapters before runtime/database work using only explicitly named values. `PostgresRuntime` validates that injected adapter channels exactly equal configured channels and passes those adapters into each scheduled `MonitoringService`.

The previous PostgreSQL `adapters: []` path is removed.

## 2. Supported channels and configuration

### Console

Console is always present. It requires no secret and writes the fully rendered alert through the runtime's supplied output function.

### Telegram

Enable only with non-secret monitoring configuration:

```json
{
  "notifications": {
    "telegram": true
  }
}
```

Required named secrets:

- `WATCHDOG_TELEGRAM_BOT_TOKEN`
- `WATCHDOG_TELEGRAM_CHAT_ID`

Both values are shape-validated. Missing/invalid values fail startup before a pool query, listener job or monitoring write. A merely present environment variable never enables Telegram.

### Discord

Enable only with:

```json
{
  "notifications": {
    "discord": true
  }
}
```

Required named secret:

- `WATCHDOG_DISCORD_WEBHOOK_URL`

The endpoint must be HTTPS on the exact Discord host with an allowlisted webhook path and no caller-supplied query, fragment, credentials or port.

### Startup behavior

- Disabled providers cause no secret read.
- Adapter construction performs no HTTP request.
- Enabled provider plus bad/missing secret produces a fixed redacted configuration error.
- Runtime adapter/config mismatch fails before database work.
- No credential or destination is logged or persisted.

## 3. Message content

All channels use the same strict `renderAlert()` output. Every delivered message includes:

- UTC alert timestamp;
- alert ID;
- position account and market identity;
- mathematical state transition and safety ratio when available;
- data/oracle/effective risk state;
- snapshot block/hash/ID;
- alert reason;
- exactly one Stage 3A `Action:` instruction;
- action evidence status, rationale and origin;
- explicit `actionable:false`.

Financial amounts are rendered only from a qualified `FINANCIAL_OPTION`. A `NON_FINANCIAL` action renders no amount, even if another internal field historically contained an estimate.

Telegram uses plain text with no Markdown/HTML mode. Discord disables mentions. Both bound payload length.

## 4. Outbox and idempotency

Observation persistence still creates alerts and delivery rows atomically.

Internal idempotency identity:

```text
delivery_<sha256(alertId, channel)>
```

Database uniqueness on `(alert_id, channel)` prevents duplicate outbox rows. Alert fingerprints prevent regeneration of the same episode/code. Delivered rows are terminal and are never selected again.

Provider APIs do not provide a portable exactly-once key. The alert/delivery ID in the message supports operator-side duplicate recognition, but no exactly-once provider claim is made.

## 5. Delivery lifecycle

Persisted statuses remain schema-compatible:

- `PENDING`
- `IN_FLIGHT`
- `FAILED`
- `RETRY_SCHEDULED`
- `DELIVERED`
- `PERMANENTLY_FAILED`

The public read model now adds a logical outcome:

- `PENDING`
- `DELIVERED`
- `FAILED`
- `UNKNOWN`

`PERMANENTLY_FAILED + ambiguous=1` means terminal `UNKNOWN`, not a proven provider rejection.

### Known/unambiguous failure

An explicitly retryable, non-ambiguous failure may be retried within:

- configured attempt limit;
- exponential bounded backoff with jitter;
- configured delay cap;
- provider Retry-After/channel cooldown.

### Ambiguous outcome

Timeout, transport uncertainty, invalid successful acknowledgment, interrupted process or acknowledgment persistence failure may mean the provider accepted the message.

These outcomes now:

1. retain the attempt audit row and `ambiguous=1`;
2. become terminal `PERMANENTLY_FAILED` / logical `UNKNOWN`;
3. are excluded from `due()`;
4. are not automatically replayed after restart;
5. emit structured delivery status `UNKNOWN`.

This intentionally trades availability for duplicate prevention. Operator investigation or a future separately designed manual resolution workflow is required; Stage 3B does not add a resend command.

## 6. Retry and rate-limit behavior

- Unambiguous retryable failures use bounded exponential backoff and jitter.
- Attempt count cannot exceed the configured maximum.
- Telegram/Discord `429` handling uses the longer valid body/header delay.
- Channel-wide cooldown prevents other queued messages on the same provider from bypassing the limit.
- Unreasonable/unrepresentable rate-limit delays permanently block that provider rather than shortening the restriction.
- Other channels remain independent.
- Provider bodies/exceptions are not persisted.

## 7. Lease, fencing and recovery

PostgreSQL delivery claims remain bound to:

- lease owner;
- fence;
- database incarnation;
- claim deadline.

Old owners cannot acknowledge a superseded attempt. A stale/interrupted in-flight claim is now terminalized as unknown rather than requeued. Known delivered attempts and definitely pending rows remain unchanged across restart.

SQLite follows the same conservative ambiguity policy without changing its SQL schema.

No scheduler, lease or database migration was weakened or added.

## 8. Secret handling

- Secrets remain outside source/configuration JSON.
- Only explicitly enabled provider names are read.
- Configuration errors are fixed and redacted.
- HTTP errors and response bodies are normalized to allowlisted codes.
- Credential-bearing Telegram/Discord URLs are never logged.
- Structured logs contain channel, alert ID and bounded delivery outcome only.
- Tests use inert generated fixture values and mocked HTTP.

## 9. Automated verification

Focused runtime/outbox suites:

- PostgreSQL runtime adapter construction and exact channel validation;
- safe console-only behavior;
- Telegram configuration and no startup network call;
- missing-secret failure before database work;
- message timestamp/action/evidence content;
- amount rendering only for qualified financial actions;
- atomic outbox creation and deterministic delivery IDs;
- known retry/backoff/exhaustion;
- timeout/ambiguous terminal unknown behavior;
- rate-limit/cooldown handling;
- restart/process-kill recovery without ambiguous replay;
- SQLite behavior and PostgreSQL fencing.

Result before final full-suite pass: **205/205 focused tests passed** across 9 files.

Native PostgreSQL 17.11 integration:

- **61/61 passed**;
- real outbox claims, known retries, stale-claim terminalization, fencing, process kill and cleanup;
- no residual PostgreSQL process/service/directory/environment variable.

Final verification:

- full unit suite: **47 files, 978/978 passed**;
- TypeScript `--noEmit`: PASS;
- full ESLint: PASS;
- production build: PASS.

## 10. Manual Telegram qualification — separate approval required

Stage 3B sent no real message. A later Telegram qualification must be separately authorized.

Procedure:

1. Operator creates/selects a dedicated test bot and test-only destination.
2. Operator supplies credentials through local process secrets or the approved secret store; never chat, source, docs, command arguments or evidence.
3. Use an explicit monitoring JSON with `notifications.telegram=true`.
4. Validate configuration locally without printing values.
5. Construct a clearly labeled synthetic `FIXTURE / TEST ALERT — NOT A LIVE POSITION` alert.
6. Require a `NON_FINANCIAL` suggested action and no recovery amount.
7. Send exactly once only after explicit approval.
8. Record only sanitized evidence: UTC time, alert/delivery IDs, channel, HTTP/API success classification and recipient-confirmed receipt—never token/chat ID/body secrets.
9. Do not retry an ambiguous result. Record `UNKNOWN` and inspect the test destination manually.
10. Revoke/rotate test credentials if required by the operator's policy.

No real lending position or unverified financial amount may be used.

## 11. Known limitations

- No real Telegram/Discord delivery has been qualified.
- Provider exactly-once delivery is unavailable; ambiguous outcomes are terminal unknown.
- There is no operator resolution/resend workflow for unknown delivery outcomes.
- Email is not implemented.
- PostgreSQL runtime deployment remains blocked by Neon reader/schema/A4.5 requirements.
- Console output is local process output, not guaranteed operator push delivery.
- Stage 3C multi-position work is not started.

## 12. Files changed

Implementation and tests are listed in the final Stage 3B completion response and preservation evidence. No credential, deployment or database schema file is introduced.

## 13. Decision

Local runtime notification wiring and conservative outbox behavior are qualified. **GO for Stage 3B local implementation.**

Real provider qualification, Neon integration, deployment and Stage 3C remain unapproved and unstarted.
