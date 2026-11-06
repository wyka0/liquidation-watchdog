import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConsoleAdapter, DiscordAdapter, notificationAdapters, TelegramAdapter } from "../src/notifications/adapters.js";
import { NotificationDispatcher, retryDelay } from "../src/notifications/dispatcher.js";
import { renderAlert } from "../src/notifications/format.js";
import type { NotificationAdapter } from "../src/notifications/types.js";
import type { Alert, Observation } from "../src/monitoring/model.js";
import { MonitorStore } from "../src/storage/store.js";
import { fixtureAlert, monitoringFixture, MONITOR_CONFIG, MONITOR_SCOPE, persistFixture, temporaryMonitorDirectory, testClock } from "./fixtures/phase4.js";

// Generated, inert fixture credentials. All HTTP is mocked; these are never sent to a provider.
const credential = [42_000_000, "fixture".repeat(6)].join(":"), destination = "-123456789";
const endpoint = ["https://discord.com/api/webhooks", "123456789", "fixture".repeat(6)].join("/");
const directory = temporaryMonitorDirectory(); let alert: Alert, base: Observation;
beforeAll(async () => { base = await monitoringFixture(); alert = fixtureAlert(base); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
const json = (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, ...(headers ? { headers } : {}) });

describe("FIXTURE: console and mocked external notification adapters", () => {
  it("renders UTC identity, dimensions, exact ratio, provenance and no ungated estimates", async () => {
    const lines: string[] = [], adapter = new ConsoleAdapter(text => lines.push(text));
    expect(await adapter.send(alert)).toEqual({ delivered: true });
    const text = lines.join("");
    for (const required of [alert.createdAt, alert.id, alert.current.risk.account, alert.current.risk.marketId,
      "WARNING", "UNVERIFIED", "Actionability: false", alert.current.risk.blockHash!, "non-actionable", "FIXTURE", "heartbeat: UNKNOWN"]) expect(text).toContain(required);
    // Recovery estimates are eligibility-gated: production observations carry none, and absence is not a zero amount.
    expect(text).not.toContain("Indicative repayment");
    expect(text).not.toContain("Indicative additional collateral");
    expect(text).not.toMatch(/\bSAFE\b/);
  });
  it("sanitizes a console sink failure", async () => {
    expect(await new ConsoleAdapter(() => { throw new Error(credential); }).send(alert)).toMatchObject({ code: "CONSOLE_ERROR", ambiguous: true });
  });
  it("uses Telegram plain text without formatting interpretation and validates acknowledgment", async () => {
    const http = vi.fn(async (_url: string, _options: RequestInit) => json({ ok: true, result: { message_id: 123 } }));
    expect(await new TelegramAdapter(credential, destination, http).send(alert)).toEqual({ delivered: true });
    const init = http.mock.calls[0]![1], body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.parse_mode).toBeUndefined(); expect(body.text).toBe(renderAlert(alert)); expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it.each([400, 401, 403])("treats Telegram HTTP %s as a permanent failure without raw provider text", async status => {
    const result = await new TelegramAdapter(credential, destination, async () => json({ description: credential }, status)).send(alert);
    expect(result).toMatchObject({ delivered: false, retryable: false }); expect(JSON.stringify(result)).not.toContain(credential);
  });
  it.each([408, 500, 502, 503])("retries ambiguous Telegram HTTP %s within its persisted budget", async status => {
    expect(await new TelegramAdapter(credential, destination, async () => json({}, status)).send(alert)).toMatchObject({ delivered: false, retryable: true, ambiguous: true });
  });
  it("handles a Telegram HTTP-200 API rejection", async () => {
    expect(await new TelegramAdapter(credential, destination, async () => json({ ok: false, error_code: 400, description: credential })).send(alert))
      .toMatchObject({ delivered: false, code: "PROVIDER_REJECTED", retryable: false });
  });
  it("respects the longer Telegram body/header 429 retry delay", async () => {
    const result = await new TelegramAdapter(credential, destination, async () => json({ ok: false, error_code: 429, parameters: { retry_after: 12 } }, 429, { "retry-after": "20" })).send(alert);
    expect(result).toMatchObject({ code: "PROVIDER_RATE_LIMIT", retryAfterMs: 20_000, ambiguous: false });
  });
  it("recognizes Telegram rate limits in an HTTP-200 envelope", async () => {
    expect(await new TelegramAdapter(credential, destination, async () => json({ ok: false, error_code: 429, parameters: { retry_after: 12 } })).send(alert))
      .toMatchObject({ code: "PROVIDER_RATE_LIMIT", retryAfterMs: 12_000 });
  });
  it("retains a Telegram 429 classification when its retry metadata is malformed", async () => {
    expect(await new TelegramAdapter(credential, destination, async () => json({ ok: false, error_code: 429, parameters: { retry_after: "unusable" } })).send(alert))
      .toMatchObject({ code: "PROVIDER_RATE_LIMIT", retryable: true, retryAfterMs: null });
  });
  it.each([200, 204])("delivers Discord HTTP %s with mentions disabled and wait=true", async status => {
    const http = vi.fn(async (_url: string, _options: RequestInit) => status === 204 ? new Response(null, { status }) : json({ id: "1234" }));
    expect(await new DiscordAdapter(endpoint, http).send(alert)).toEqual({ delivered: true });
    expect(http.mock.calls[0]![0]).toContain("wait=true");
    expect(JSON.parse(http.mock.calls[0]![1].body as string)).toMatchObject({ allowed_mentions: { parse: [] } });
  });
  it.each([400, 401, 403, 404])("handles permanent Discord HTTP %s failures", async status => {
    expect(await new DiscordAdapter(endpoint, async () => json({ message: endpoint }, status)).send(alert)).toMatchObject({ delivered: false, retryable: false });
  });
  it("handles Discord fractional rate limits and HTTP-date headers", async () => {
    const time = testClock().getTime();
    const result = await new DiscordAdapter(endpoint, async () => json({ retry_after: 2.5 }, 429, { "retry-after": new Date(time + 10_000).toUTCString() }), 15_000, () => time).send(alert);
    expect(result).toMatchObject({ code: "PROVIDER_RATE_LIMIT", retryAfterMs: 10_000 });
  });
  it("does not shorten an unreasonable provider limit into a rapid retry", async () => {
    expect(await new DiscordAdapter(endpoint, async () => json({ retry_after: 1e20 }, 429)).send(alert)).toMatchObject({ delivered: false, retryable: false });
  });
  it("treats a timeout/network exception containing a credential as ambiguous and sanitized", async () => {
    const http = async () => { throw new Error(`${credential} ${endpoint}`); };
    for (const adapter of [new TelegramAdapter(credential, destination, http), new DiscordAdapter(endpoint, http)]) {
      const result = await adapter.send(alert);
      expect(result).toMatchObject({ code: "TRANSPORT_ERROR", ambiguous: true, retryable: true });
      expect(JSON.stringify(result)).not.toContain(credential); expect(JSON.stringify(result)).not.toContain(endpoint);
    }
  });
  it.each(["malformed", "too-large", "missing-ack"])("treats a successful HTTP response with %s acknowledgment as ambiguous", async kind => {
    const response = () => kind === "malformed" ? new Response("not json") : kind === "too-large" ? json({ text: "x".repeat(65_537) }) : json({ ok: true });
    expect(await new TelegramAdapter(credential, destination, async () => response()).send(alert)).toMatchObject({ code: "PROVIDER_RESPONSE_INVALID", ambiguous: true });
  });
  it("does not read environment credentials for disabled providers", () => {
    const environment = new Proxy({}, { get() { throw new Error("Unexpected environment access"); } });
    expect(notificationAdapters(MONITOR_CONFIG, () => {}, environment).map(adapter => adapter.channel)).toEqual(["console"]);
  });
  it("rejects invalid credentials/endpoints with fixed, redacted messages", () => {
    expect(() => new TelegramAdapter("fixture-invalid-value", destination, vi.fn())).toThrow("environment values");
    expect(() => new DiscordAdapter("https://example.test/fixture-invalid-value", vi.fn())).toThrow("environment value");
  });
});

describe("FIXTURE: durable delivery attempts, bounded retries and rate limits", () => {
  it("bounds exponential jitter and the configured cap", () => {
    const policy = MONITOR_CONFIG.notifications;
    expect(retryDelay(1, policy, () => 0)).toBe(4_000); expect(retryDelay(1, policy, () => 1)).toBe(6_000);
    expect(retryDelay(10, policy, () => 1)).toBe(900_000);
  });
  it("persists a retry, exhausts the budget, and never changes accepted mathematics", async () => {
    const store = new MonitorStore(":memory:"); store.acquireMonitor(); persistFixture(store, base, ["telegram"]);
    let time = testClock().getTime(); const before = store.state(MONITOR_SCOPE);
    const send = vi.fn(async () => ({ delivered: false as const, code: "PROVIDER_HTTP_ERROR" as const, retryable: true, ambiguous: false, retryAfterMs: null }));
    const dispatcher = new NotificationDispatcher(store, [{ channel: "telegram", send }], { ...MONITOR_CONFIG.notifications, maxAttempts: 2 },
      () => new Date(time), () => {}, () => 0.5);
    const count = store.deliveries().length;
    expect(await dispatcher.drain()).toBe(count); expect(store.deliveries().every(delivery => delivery.status === "RETRY_SCHEDULED")).toBe(true);
    expect(await dispatcher.drain()).toBe(0); time += 5_000;
    expect(await dispatcher.drain()).toBe(count); expect(store.deliveries().every(delivery => delivery.status === "PERMANENTLY_FAILED" && delivery.attempts === 2)).toBe(true);
    time += 1_000_000; expect(await dispatcher.drain()).toBe(0); expect(store.state(MONITOR_SCOPE)).toEqual(before); store.close();
  });
  it("holds all queued provider messages after a 429, including across a process restart", async () => {
    const path = join(directory, "ratelimit.sqlite"); let store = new MonitorStore(path); store.acquireMonitor(); persistFixture(store, base, ["discord"]);
    let time = testClock().getTime();
    const send = vi.fn(async () => ({ delivered: false as const, code: "PROVIDER_RATE_LIMIT" as const, retryable: true, ambiguous: false, retryAfterMs: 120_000 }));
    let dispatcher = new NotificationDispatcher(store, [{ channel: "discord", send }], MONITOR_CONFIG.notifications, () => new Date(time), () => {}, () => 0.5);
    expect(await dispatcher.drain()).toBe(1); expect(send).toHaveBeenCalledOnce(); store.close();
    store = new MonitorStore(path); store.acquireMonitor();
    const success = vi.fn(async () => ({ delivered: true as const }));
    dispatcher = new NotificationDispatcher(store, [{ channel: "discord", send: success }], MONITOR_CONFIG.notifications, () => new Date(time), () => {});
    time += 119_999; expect(await dispatcher.drain()).toBe(0); time += 1;
    expect(await dispatcher.drain()).toBe(store.deliveries().length); expect(store.deliveries().every(delivery => delivery.status === "DELIVERED")).toBe(true); store.close();
  });
  it.each([1, 5])("persists a channel-wide fallback for a metadata-free 429 with an attempt budget of %s", async maxAttempts => {
    const path = join(directory, `fallback-${maxAttempts}.sqlite`); let store = new MonitorStore(path); store.acquireMonitor(); persistFixture(store, base, ["discord", "console"]);
    let time = testClock().getTime(); const policy = { ...MONITOR_CONFIG.notifications, maxAttempts };
    const http = vi.fn(async () => json({}, 429)), consoleSend = vi.fn(async () => ({ delivered: true as const }));
    let dispatcher = new NotificationDispatcher(store, [new DiscordAdapter(endpoint, http), { channel: "console", send: consoleSend }], policy, () => new Date(time), () => {}, () => 0.5);
    expect(await dispatcher.drain()).toBe(4); expect(http).toHaveBeenCalledOnce(); expect(consoleSend).toHaveBeenCalledTimes(3);
    expect(store.providerLimits()).toEqual([{ channel: "discord", next_at: new Date(time + 5_000).toISOString(), blocked: 0 }]);
    expect(store.deliveries().find(delivery => delivery.channel === "discord" && delivery.attempts === 1)?.status)
      .toBe(maxAttempts === 1 ? "PERMANENTLY_FAILED" : "RETRY_SCHEDULED"); store.close();
    store = new MonitorStore(path); store.acquireMonitor(); const send = vi.fn(async () => ({ delivered: true as const }));
    dispatcher = new NotificationDispatcher(store, [{ channel: "discord", send }], policy, () => new Date(time), () => {});
    time += 4_999; expect(await dispatcher.drain()).toBe(0); time += 1;
    expect(await dispatcher.drain()).toBe(maxAttempts === 1 ? 2 : 3); store.close();
  });
  it.each(["body", "header", "numeric-overflow"])("persistently blocks excessive %s 429 delays without preventing other channels", async source => {
    const path = join(directory, `blocked-${source}.sqlite`); let store = new MonitorStore(path); store.acquireMonitor(); persistFixture(store, base, ["discord", "console"]);
    let time = testClock().getTime();
    const http = vi.fn(async () => source === "body" ? json({ retry_after: 1e20 }, 429)
      : source === "header" ? json({}, 429, { "retry-after": "9".repeat(310) }) : new Response('{"retry_after":1e400}', { status: 429 }));
    const consoleSend = vi.fn(async () => ({ delivered: true as const }));
    const dispatcher = new NotificationDispatcher(store, [new DiscordAdapter(endpoint, http), { channel: "console", send: consoleSend }], MONITOR_CONFIG.notifications,
      () => new Date(time), () => {});
    expect(await dispatcher.drain()).toBe(4); expect(http).toHaveBeenCalledOnce(); expect(consoleSend).toHaveBeenCalledTimes(3);
    expect(store.summary(MONITOR_SCOPE).providerLimits).toEqual([{ channel: "discord", next_at: new Date(time).toISOString(), blocked: 1 }]);
    expect(store.nextDeliveryAt(["discord"])).toBeNull(); store.close();
    store = new MonitorStore(path); store.acquireMonitor(); time += 2 * 365 * 86_400_000;
    const send = vi.fn(async () => ({ delivered: true as const }));
    expect(await new NotificationDispatcher(store, [{ channel: "discord", send }], MONITOR_CONFIG.notifications, () => new Date(time), () => {}).drain()).toBe(0);
    expect(send).not.toHaveBeenCalled(); expect(store.deliveries().filter(delivery => delivery.status === "PENDING")).toHaveLength(2); store.close();
  });
  it("resumes pending deliveries without regenerating known delivered ones", async () => {
    const path = join(directory, "delivery-restart.sqlite"); let store = new MonitorStore(path); store.acquireMonitor(); persistFixture(store, base);
    const first = store.deliveries()[0]!; store.startAttempt(first.id, base.observedAt); store.finishAttempt(first.id, { delivered: true }, base.observedAt, null); store.close();
    store = new MonitorStore(path); store.acquireMonitor(); const send = vi.fn(async () => ({ delivered: true as const }));
    const dispatcher = new NotificationDispatcher(store, [{ channel: "console", send }], MONITOR_CONFIG.notifications, testClock, () => {});
    const pending = store.deliveries().filter(delivery => delivery.status === "PENDING").length;
    expect(await dispatcher.drain()).toBe(pending); expect(send).toHaveBeenCalledTimes(pending);
    expect(store.deliveries().find(delivery => delivery.id === first.id)?.attempts).toBe(1); store.close();
  });
  it("holds pending external deliveries when that adapter is disabled", async () => {
    const store = new MonitorStore(":memory:"); store.acquireMonitor(); persistFixture(store, base, ["telegram"]);
    expect(await new NotificationDispatcher(store, [], MONITOR_CONFIG.notifications, testClock, () => {}).drain()).toBe(0);
    expect(store.deliveries().every(delivery => delivery.status === "PENDING")).toBe(true); store.close();
  });
  it("records interrupted ambiguous delivery outcomes as terminal unknown without replay", async () => {
    const store = new MonitorStore(":memory:"); store.acquireMonitor(); persistFixture(store, base);
    const first = store.deliveries()[0]!; store.startAttempt(first.id, base.observedAt); store.recoverDeliveries(base.observedAt, 5);
    const send = vi.fn(async () => ({ delivered: true as const }));
    const definitelyPending = store.deliveries().filter(delivery => delivery.status === "PENDING").length;
    expect(await new NotificationDispatcher(store, [{ channel: "console", send }], MONITOR_CONFIG.notifications, testClock, () => {}).drain()).toBe(definitelyPending);
    expect(send).toHaveBeenCalledTimes(definitelyPending);
    expect(store.deliveries().find(delivery => delivery.id === first.id)).toMatchObject({ status: "PERMANENTLY_FAILED", attempts: 1, ambiguous: 1 });
    expect(store.attempts(first.id)).toEqual([expect.objectContaining({ error_code: "ATTEMPT_INTERRUPTED", outcome: "FAILED", ambiguous: 1 })]); store.close();
  });
  it("terminalizes an ambiguous provider timeout and logs UNKNOWN without retry", async () => {
    const store = new MonitorStore(":memory:"); store.acquireMonitor(); persistFixture(store, base, ["telegram"]);
    const send = vi.fn(async () => ({ delivered: false as const, code: "PROVIDER_TIMEOUT" as const, retryable: true, ambiguous: true, retryAfterMs: null }));
    const logs: unknown[] = [], dispatcher = new NotificationDispatcher(store, [{ channel: "telegram", send }], MONITOR_CONFIG.notifications,
      testClock, record => logs.push(record));
    const count = store.deliveries().length; expect(await dispatcher.drain()).toBe(count);
    expect(store.deliveries().every(delivery => delivery.status === "PERMANENTLY_FAILED" && delivery.ambiguous === 1)).toBe(true);
    expect(await dispatcher.drain()).toBe(0); expect(send).toHaveBeenCalledTimes(count);
    expect(logs).toEqual(expect.arrayContaining([expect.objectContaining({ deliveryStatus: "UNKNOWN" })])); store.close();
  });
  it("does not persist arbitrary adapter exception details or provider credentials", async () => {
    const path = join(directory, "redaction.sqlite"), store = new MonitorStore(path); store.acquireMonitor(); persistFixture(store, base, ["telegram"]);
    const adapter: NotificationAdapter = { channel: "telegram", send: async () => { throw new Error(`${credential} ${endpoint} ${destination}`); } };
    const logs: unknown[] = [];
    await new NotificationDispatcher(store, [adapter], MONITOR_CONFIG.notifications, testClock, record => logs.push(record)).drain();
    const publicOutput = JSON.stringify({ logs, status: store.summary(MONITOR_SCOPE), deliveries: store.deliveries() });
    store.close(); const bytes = readFileSync(path).toString("utf8");
    for (const value of [credential, endpoint, destination]) { expect(publicOutput).not.toContain(value); expect(bytes).not.toContain(value); }
  });
});
