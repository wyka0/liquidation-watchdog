# Optional notification setup

Console alerts are enabled for explicit monitoring commands. **Telegram and Discord are disabled by default.** Implementation and verification use mocked HTTP providers only; the bounded live-monitoring smokes use console delivery.

## Local configuration

1. Copy `config/monitoring.example.json` to the ignored `watchdog.config.json`.
2. Set `monitoring.enabled=true` only if continuous monitoring is intended, or use the bounded `monitor --once` command.
3. Set `notifications.telegram=true` and/or `notifications.discord=true` for intended channels.
4. Supply the corresponding values privately in the local process environment or your local secret manager:

   - `WATCHDOG_TELEGRAM_BOT_TOKEN`
   - `WATCHDOG_TELEGRAM_CHAT_ID`
   - `WATCHDOG_DISCORD_WEBHOOK_URL`

Do not put credentials in the JSON configuration, command arguments, evidence, source control or a chat conversation. The application does not load `.env` files automatically. [`.env.example`](../.env.example) contains placeholders only. Configure values privately in the terminal/service environment without printing them or committing shell transcripts. A disabled adapter does not read its environment values. Existing Phase 3/4 variable names remain compatible; see [environment configuration](environment-variables.md).

Telegram expects a Bot API credential and numeric chat ID (including negative group/channel IDs), or an `@channel_username`. Discord expects an HTTPS `discord.com/api[/vN]/webhooks/<id>/<credential>` URL without extra credentials, fragments or query parameters. The adapter adds `wait=true` itself. Invalid provider configuration fails before a monitoring database is opened.

```powershell
npm run watchdog -- config-check --config ./watchdog.config.json
# Run only after privately configuring the intended local environment and channel flags.
npm run watchdog -- monitor --once --config ./watchdog.config.json
npm run watchdog -- alerts --limit 20 --config ./watchdog.config.json
npm run watchdog -- status --config ./watchdog.config.json
```

**An enabled-provider `monitor --once` is a real monitoring run and can send real alerts**, including pending deliveries. It is not a notification dry run. This implementation does not provide an automatic test-message command. For offline verification use `npm test -- test/notifications.test.ts`, whose HTTP responses and credentials are inert fixtures.

## Formatting, error handling and restart behavior

- Telegram uses plain text without a Markdown/HTML `parse_mode`, with link previews disabled.
- Discord sends concise embeds with `allowed_mentions.parse=[]`; controlled fields and numeric/address metadata avoid arbitrary mentions or formatting injection.
- Both use bounded payload lengths, response-body limits, request timeouts and rejected redirects. Provider error bodies and request URLs are never emitted by error handling.
- Default dispatch is 10 attempts per drain (maximum configurable 50). A stop request prevents new sends and permits the active send to settle within shutdown grace. Forced cancellation can leave an `IN_FLIGHT` attempt; recovery records `ATTEMPT_INTERRUPTED` and terminalizes it as `PERMANENTLY_FAILED` with `ambiguous=1` (logical `UNKNOWN`), without resending.
- Rate limits use durable channel cooldowns and retry timestamps, including a local-backoff fallback when 429 metadata is unusable. Excessive/unrepresentable limits persistently block that channel; `status` includes its `providerLimits` record and `blocked` flag. Inspect `alerts`/`status` for `PENDING`, `RETRY_SCHEDULED`, delivered or permanently failed outcomes. Attempt histories and fixed error codes remain in SQLite.
- Turning a provider off holds its pending entries. Re-enabling uses the current environment destination; keep that destination intentional and consistent for outstanding messages. Changing destinations is not a historical backfill feature.
- A timeout, uncertain transport result, HTTP 408/5xx, malformed success acknowledgment, process interruption or failed acknowledgment persistence may conceal provider acceptance. These ambiguous outcomes are terminal `UNKNOWN`, excluded from `due()` and never automatically replayed. Only known, non-ambiguous retryable failures use bounded retries. See the [Stage 3B delivery contract](STAGE-3B-RUNTIME-NOTIFICATIONS.md#5-delivery-lifecycle) and [delivery guarantees](alerting.md).
- Persistent blocks and terminal failures require investigation; restart or credential rotation does not reset them. No operator resend workflow for terminal `UNKNOWN` is implemented. [Notification recovery](operations-runbook.md#notification-recovery) documents disabling, re-enabling, cooldowns, destination changes and maintenance boundaries.

The default database is `data/watchdog.sqlite`, with SQLite sidecars/monitor lock under the same ignored local directory. No bot token, chat ID or webhook URL is stored in the database. Use the provided consistent `backup`, `backup-verify` and isolated `restore-verify` commands; copying only a live main database file can omit committed WAL state. A corrupt or incompatible store is reported explicitly and is not silently recreated. Restoring an older backup loses later delivery acknowledgments and requires reconciliation before re-enabling channels. See [database operations](database-operations.md).

The selected oracle remains **UNVERIFIED**. Enabling notifications does not verify its source or heartbeat and cannot make recovery estimates actionable.
