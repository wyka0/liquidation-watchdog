import { z } from "zod";
import { retryAfter } from "../chain/transport.js";
import type { MonitoringConfiguration } from "../config/monitoring.js";
import { DataError } from "../domain/errors.js";
import type { Alert } from "../monitoring/model.js";
import { renderAlert } from "./format.js";
import type { DeliveryResult, NotificationAdapter } from "./types.js";
import { bounded } from "../operations/deadline.js";

export class ConsoleAdapter implements NotificationAdapter {
  readonly channel = "console" as const;
  constructor(private readonly write: (text: string) => void) {}
  async send(alert: Alert): Promise<DeliveryResult> {
    try { this.write(renderAlert(alert)); return { delivered: true }; } catch {
      return { delivered: false, code: "CONSOLE_ERROR", retryable: true, ambiguous: true, retryAfterMs: null };
    }
  }
}

type Http = (input: string, init: RequestInit) => Promise<Response>;
export function validTelegramConfiguration(credential: string, destination: string): boolean {
  return /^[0-9]{5,15}:[A-Za-z0-9_-]{20,100}$/.test(credential) && /^(?:-?[0-9]{1,20}|@[A-Za-z0-9_]{5,64})$/.test(destination);
}
export function validDiscordDestination(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && url.hostname === "discord.com" && !url.port && !url.username && !url.password && !url.search && !url.hash
      && /^\/api(?:\/v[0-9]+)?\/webhooks\/[0-9]+\/[A-Za-z0-9._-]{20,200}$/.test(url.pathname);
  } catch { return false; }
}
const MAX_RATE_DELAY = 365 * 86_400_000;
async function bodyJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  let bytes = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      if (signal.aborted) throw new Error();
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 65_536) throw new Error();
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally { signal.removeEventListener("abort", cancel); cancel(); reader.releaseLock(); }
}
function failure(code: Extract<DeliveryResult, { delivered: false }>["code"], retryable: boolean, ambiguous = false, retryAfterMs: number | null = null): DeliveryResult {
  return { delivered: false, code, retryable, ambiguous, retryAfterMs };
}

abstract class HttpAdapter implements NotificationAdapter {
  abstract readonly channel: "telegram" | "discord";
  constructor(private readonly http: Http, private readonly timeoutMs: number, private readonly now: () => number) {}
  protected async post(url: string, payload: unknown, signal?: AbortSignal): Promise<DeliveryResult> {
    try { return await bounded(inner => this.performPost(url, payload, inner), this.timeoutMs, "PROVIDER_TIMEOUT", signal); }
    catch { return failure("PROVIDER_TIMEOUT", true, true); }
  }
  private async performPost(url: string, payload: unknown, signal: AbortSignal): Promise<DeliveryResult> {
    let response: Response;
    try {
      response = await this.http(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
        signal, redirect: "error" });
    } catch { return failure("TRANSPORT_ERROR", true, true); }
    if (signal.aborted) { void response.body?.cancel().catch(() => {}); return failure("PROVIDER_TIMEOUT", true, true); }
    let body: unknown = null;
    try { if (response.status !== 204) body = await bodyJson(response, signal); else void response.body?.cancel().catch(() => {}); } catch {
      if (response.ok) return failure("PROVIDER_RESPONSE_INVALID", true, true);
    }
    if (signal.aborted) return failure("PROVIDER_TIMEOUT", true, true);
    const telegram = z.object({ ok: z.boolean(), error_code: z.number().optional(),
      result: z.object({ message_id: z.number().int().positive() }).optional() }).safeParse(body);
    if (response.status === 429 || (this.channel === "telegram" && telegram.success && telegram.data.error_code === 429)) {
      // Malformed delay metadata must not hide a valid 429 envelope. Preserve excessive numeric values for the block decision.
      const telegramLimit = z.object({ parameters: z.object({ retry_after: z.unknown() }) }).safeParse(body);
      const discordLimit = z.object({ retry_after: z.unknown() }).safeParse(body);
      const supplied = this.channel === "telegram" ? (telegramLimit.success ? telegramLimit.data.parameters.retry_after : undefined)
        : (discordLimit.success ? discordLimit.data.retry_after : undefined);
      const seconds = typeof supplied === "number" && supplied >= 0 ? supplied : 0;
      const header = retryAfter(response.headers.get("retry-after"), this.now());
      const delay = Math.max(header ?? 0, seconds * 1_000);
      if (!Number.isFinite(delay) || delay > MAX_RATE_DELAY) return failure("PROVIDER_RATE_LIMIT", false);
      return failure("PROVIDER_RATE_LIMIT", true, false, Math.ceil(delay) || null);
    }
    if (!response.ok) return failure("PROVIDER_HTTP_ERROR", response.status >= 500 || response.status === 408, response.status >= 500 || response.status === 408);
    if (this.channel === "telegram") {
      if (!telegram.success) return failure("PROVIDER_RESPONSE_INVALID", true, true);
      if (!telegram.data.ok) return failure("PROVIDER_REJECTED", (telegram.data.error_code ?? 0) >= 500);
      if (!telegram.data.result) return failure("PROVIDER_RESPONSE_INVALID", true, true);
    } else if (response.status !== 204 && !z.object({ id: z.string().regex(/^[0-9]+$/) }).safeParse(body).success) {
      return failure("PROVIDER_RESPONSE_INVALID", true, true);
    }
    return { delivered: true };
  }
  abstract send(alert: Alert, signal?: AbortSignal): Promise<DeliveryResult>;
}

export class TelegramAdapter extends HttpAdapter {
  readonly channel = "telegram" as const;
  constructor(private readonly credential: string, private readonly destination: string,
    http: Http = fetch, timeoutMs = 15_000, now: () => number = Date.now) {
    super(http, timeoutMs, now);
    if (!validTelegramConfiguration(credential, destination)) {
      throw new DataError("TELEGRAM_CONFIG", "Enabled Telegram requires valid WATCHDOG_TELEGRAM_BOT_TOKEN and WATCHDOG_TELEGRAM_CHAT_ID environment values.");
    }
  }
  send(alert: Alert, signal?: AbortSignal): Promise<DeliveryResult> {
    // Plain text: no parse_mode, so token/position data cannot inject Markdown or HTML formatting.
    return this.post(`https://api.telegram.org/bot${this.credential}/sendMessage`, {
      chat_id: this.destination, text: renderAlert(alert).slice(0, 4_096), link_preview_options: { is_disabled: true }
    }, signal);
  }
}

export class DiscordAdapter extends HttpAdapter {
  readonly channel = "discord" as const;
  private readonly endpoint: string;
  constructor(endpoint: string, http: Http = fetch, timeoutMs = 15_000, now: () => number = Date.now) {
    super(http, timeoutMs, now);
    try {
      const url = new URL(endpoint);
      if (!validDiscordDestination(endpoint)) throw new Error();
      url.searchParams.set("wait", "true"); this.endpoint = url.href;
    } catch { throw new DataError("DISCORD_CONFIG", "Enabled Discord requires a valid WATCHDOG_DISCORD_WEBHOOK_URL environment value."); }
  }
  send(alert: Alert, signal?: AbortSignal): Promise<DeliveryResult> {
    return this.post(this.endpoint, { allowed_mentions: { parse: [] }, embeds: [{
      title: `${alert.severity}: ${alert.code}`, description: renderAlert(alert).slice(0, 4_096)
    }] }, signal);
  }
}

export function notificationAdapters(configuration: MonitoringConfiguration, write: (text: string) => void,
  environment: NodeJS.ProcessEnv = process.env): NotificationAdapter[] {
  const result: NotificationAdapter[] = [new ConsoleAdapter(write)];
  // Only read the named values for explicitly enabled providers. Never enumerate or log environment data.
  if (configuration.notifications.telegram) result.push(new TelegramAdapter(environment.WATCHDOG_TELEGRAM_BOT_TOKEN ?? "",
    environment.WATCHDOG_TELEGRAM_CHAT_ID ?? "", fetch, configuration.notifications.timeoutSeconds * 1_000));
  if (configuration.notifications.discord) result.push(new DiscordAdapter(environment.WATCHDOG_DISCORD_WEBHOOK_URL ?? "", fetch,
    configuration.notifications.timeoutSeconds * 1_000));
  return result;
}
