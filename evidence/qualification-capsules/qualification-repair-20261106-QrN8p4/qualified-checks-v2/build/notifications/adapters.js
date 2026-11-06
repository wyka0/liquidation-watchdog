import { z } from "zod";
import { retryAfter } from "../chain/transport.js";
import { DataError } from "../domain/errors.js";
import { renderAlert } from "./format.js";
import { bounded } from "../operations/deadline.js";
export class ConsoleAdapter {
    write;
    channel = "console";
    constructor(write) {
        this.write = write;
    }
    async send(alert) {
        try {
            this.write(renderAlert(alert));
            return { delivered: true };
        }
        catch {
            return { delivered: false, code: "CONSOLE_ERROR", retryable: true, ambiguous: true, retryAfterMs: null };
        }
    }
}
export function validTelegramConfiguration(credential, destination) {
    return /^[0-9]{5,15}:[A-Za-z0-9_-]{20,100}$/.test(credential) && /^(?:-?[0-9]{1,20}|@[A-Za-z0-9_]{5,64})$/.test(destination);
}
export function validDiscordDestination(endpoint) {
    try {
        const url = new URL(endpoint);
        return url.protocol === "https:" && url.hostname === "discord.com" && !url.port && !url.username && !url.password && !url.search && !url.hash
            && /^\/api(?:\/v[0-9]+)?\/webhooks\/[0-9]+\/[A-Za-z0-9._-]{20,200}$/.test(url.pathname);
    }
    catch {
        return false;
    }
}
const MAX_RATE_DELAY = 365 * 86_400_000;
async function bodyJson(response, signal) {
    if (!response.body)
        return null;
    const reader = response.body.getReader();
    const cancel = () => { void reader.cancel().catch(() => { }); };
    signal.addEventListener("abort", cancel, { once: true });
    let bytes = 0, text = "";
    const decoder = new TextDecoder();
    try {
        while (true) {
            if (signal.aborted)
                throw new Error();
            const chunk = await reader.read();
            if (chunk.done)
                break;
            bytes += chunk.value.length;
            if (bytes > 65_536)
                throw new Error();
            text += decoder.decode(chunk.value, { stream: true });
        }
        return JSON.parse(text + decoder.decode());
    }
    finally {
        signal.removeEventListener("abort", cancel);
        cancel();
        reader.releaseLock();
    }
}
function failure(code, retryable, ambiguous = false, retryAfterMs = null) {
    return { delivered: false, code, retryable, ambiguous, retryAfterMs };
}
class HttpAdapter {
    http;
    timeoutMs;
    now;
    constructor(http, timeoutMs, now) {
        this.http = http;
        this.timeoutMs = timeoutMs;
        this.now = now;
    }
    async post(url, payload, signal) {
        try {
            return await bounded(inner => this.performPost(url, payload, inner), this.timeoutMs, "PROVIDER_TIMEOUT", signal);
        }
        catch {
            return failure("PROVIDER_TIMEOUT", true, true);
        }
    }
    async performPost(url, payload, signal) {
        let response;
        try {
            response = await this.http(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
                signal, redirect: "error" });
        }
        catch {
            return failure("TRANSPORT_ERROR", true, true);
        }
        if (signal.aborted) {
            void response.body?.cancel().catch(() => { });
            return failure("PROVIDER_TIMEOUT", true, true);
        }
        let body = null;
        try {
            if (response.status !== 204)
                body = await bodyJson(response, signal);
            else
                void response.body?.cancel().catch(() => { });
        }
        catch {
            if (response.ok)
                return failure("PROVIDER_RESPONSE_INVALID", true, true);
        }
        if (signal.aborted)
            return failure("PROVIDER_TIMEOUT", true, true);
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
            if (!Number.isFinite(delay) || delay > MAX_RATE_DELAY)
                return failure("PROVIDER_RATE_LIMIT", false);
            return failure("PROVIDER_RATE_LIMIT", true, false, Math.ceil(delay) || null);
        }
        if (!response.ok)
            return failure("PROVIDER_HTTP_ERROR", response.status >= 500 || response.status === 408, response.status >= 500 || response.status === 408);
        if (this.channel === "telegram") {
            if (!telegram.success)
                return failure("PROVIDER_RESPONSE_INVALID", true, true);
            if (!telegram.data.ok)
                return failure("PROVIDER_REJECTED", (telegram.data.error_code ?? 0) >= 500);
            if (!telegram.data.result)
                return failure("PROVIDER_RESPONSE_INVALID", true, true);
        }
        else if (response.status !== 204 && !z.object({ id: z.string().regex(/^[0-9]+$/) }).safeParse(body).success) {
            return failure("PROVIDER_RESPONSE_INVALID", true, true);
        }
        return { delivered: true };
    }
}
export class TelegramAdapter extends HttpAdapter {
    credential;
    destination;
    channel = "telegram";
    constructor(credential, destination, http = fetch, timeoutMs = 15_000, now = Date.now) {
        super(http, timeoutMs, now);
        this.credential = credential;
        this.destination = destination;
        if (!validTelegramConfiguration(credential, destination)) {
            throw new DataError("TELEGRAM_CONFIG", "Enabled Telegram requires valid WATCHDOG_TELEGRAM_BOT_TOKEN and WATCHDOG_TELEGRAM_CHAT_ID environment values.");
        }
    }
    send(alert, signal) {
        // Plain text: no parse_mode, so token/position data cannot inject Markdown or HTML formatting.
        return this.post(`https://api.telegram.org/bot${this.credential}/sendMessage`, {
            chat_id: this.destination, text: renderAlert(alert).slice(0, 4_096), link_preview_options: { is_disabled: true }
        }, signal);
    }
}
export class DiscordAdapter extends HttpAdapter {
    channel = "discord";
    endpoint;
    constructor(endpoint, http = fetch, timeoutMs = 15_000, now = Date.now) {
        super(http, timeoutMs, now);
        try {
            const url = new URL(endpoint);
            if (!validDiscordDestination(endpoint))
                throw new Error();
            url.searchParams.set("wait", "true");
            this.endpoint = url.href;
        }
        catch {
            throw new DataError("DISCORD_CONFIG", "Enabled Discord requires a valid WATCHDOG_DISCORD_WEBHOOK_URL environment value.");
        }
    }
    send(alert, signal) {
        return this.post(this.endpoint, { allowed_mentions: { parse: [] }, embeds: [{
                    title: `${alert.severity}: ${alert.code}`, description: renderAlert(alert).slice(0, 4_096)
                }] }, signal);
    }
}
export function notificationAdapters(configuration, write, environment = process.env) {
    const result = [new ConsoleAdapter(write)];
    // Only read the named values for explicitly enabled providers. Never enumerate or log environment data.
    if (configuration.notifications.telegram)
        result.push(new TelegramAdapter(environment.WATCHDOG_TELEGRAM_BOT_TOKEN ?? "", environment.WATCHDOG_TELEGRAM_CHAT_ID ?? "", fetch, configuration.notifications.timeoutSeconds * 1_000));
    if (configuration.notifications.discord)
        result.push(new DiscordAdapter(environment.WATCHDOG_DISCORD_WEBHOOK_URL ?? "", fetch, configuration.notifications.timeoutSeconds * 1_000));
    return result;
}
//# sourceMappingURL=adapters.js.map