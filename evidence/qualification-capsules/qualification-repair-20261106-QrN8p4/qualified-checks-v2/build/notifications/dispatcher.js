import { z } from "zod";
import { deliverySchema } from "../storage/store.js";
import { bounded } from "../operations/deadline.js";
import { DataError } from "../domain/errors.js";
const resultSchema = z.union([
    z.object({ delivered: z.literal(true) }).strict(),
    z.object({ delivered: z.literal(false), code: deliverySchema.shape.last_error.unwrap(), retryable: z.boolean(), ambiguous: z.boolean(),
        retryAfterMs: z.number().finite().min(0).max(365 * 86_400_000).nullable() }).strict()
]);
export function retryDelay(attempt, policy, random) {
    const sample = random();
    const jitter = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5;
    const base = Math.min(policy.maxDelaySeconds, policy.baseDelaySeconds * 2 ** (attempt - 1)) * 1_000;
    return Math.ceil(Math.min(policy.maxDelaySeconds * 1_000, base * (1 + (2 * jitter - 1) * policy.jitterRatio)));
}
export class NotificationDispatcher {
    store;
    adapters;
    policy;
    now;
    log;
    random;
    channels;
    active = null;
    stopping = false;
    cancellation = new AbortController();
    constructor(store, adapters, policy, now, log, random = Math.random) {
        this.store = store;
        this.adapters = adapters;
        this.policy = policy;
        this.now = now;
        this.log = log;
        this.random = random;
        this.channels = [...new Set(adapters.map(adapter => adapter.channel))];
    }
    drain() {
        if (this.stopping)
            return this.active ?? Promise.resolve(0);
        if (this.active)
            return this.active;
        this.active = this.dispatch().finally(() => { this.active = null; });
        return this.active;
    }
    stop() { this.stopping = true; }
    abort() { this.stop(); this.cancellation.abort(); }
    async dispatch() {
        let attempted = 0;
        for (let index = 0; index < this.policy.maxPerDrain && !this.stopping; index += 1) {
            // Requery after every response so a 429 also delays other queued alerts on that provider.
            const next = (await this.store.due(this.now().toISOString(), this.channels, 1))[0];
            if (!next)
                break;
            if (next.attempts >= this.policy.maxAttempts) {
                await this.store.exhaust(next.id, this.now().toISOString());
                continue;
            }
            const adapter = this.adapters.find(adapter => adapter.channel === next.channel);
            // Store corruption is a persistence failure, never a provider retry.
            const alert = await this.store.alert(next.alert_id);
            const delivery = await this.store.startAttempt(next.id, this.now().toISOString());
            if (this.cancellation.signal.aborted || this.stopping)
                break;
            let result;
            try {
                result = resultSchema.parse(await bounded(signal => adapter.send(alert, signal), this.policy.timeoutSeconds * 1_000, "PROVIDER_TIMEOUT", this.cancellation.signal));
            }
            catch (error) {
                result = { delivered: false, code: error instanceof DataError && error.code === "PROVIDER_TIMEOUT" ? "PROVIDER_TIMEOUT" : "ADAPTER_ERROR",
                    retryable: true, ambiguous: true, retryAfterMs: null };
            }
            // A hard shutdown closes the store; its in-flight attempt is deliberately recovered as ambiguous on restart.
            if (this.cancellation.signal.aborted)
                break;
            const now = this.now();
            const ambiguous = !result.delivered && result.ambiguous;
            const delay = result.delivered ? 0 : Math.max(retryDelay(delivery.attempts, this.policy, this.random), result.retryAfterMs ?? 0);
            // Even the final attempt must hold the whole channel after a metadata-free/zero-delay 429.
            if (!result.delivered && result.code === "PROVIDER_RATE_LIMIT" && result.retryable)
                result = { ...result, retryAfterMs: delay };
            // Ambiguous acceptance is terminal-unknown: never replay blindly and risk a duplicate provider message.
            const retryAt = !result.delivered && result.retryable && !ambiguous && delivery.attempts < this.policy.maxAttempts
                ? new Date(now.getTime() + delay).toISOString() : null;
            const status = await this.store.finishAttempt(next.id, result, now.toISOString(), retryAt);
            this.log({ timestamp: now.toISOString(), event: "notification_delivery", alertId: next.alert_id, channel: next.channel,
                deliveryStatus: status === "DELIVERED" ? "DELIVERED" : ambiguous ? "UNKNOWN" : retryAt === null ? "PERMANENTLY_FAILED" : "RETRY_SCHEDULED" });
            attempted += 1;
        }
        return attempted;
    }
}
//# sourceMappingURL=dispatcher.js.map