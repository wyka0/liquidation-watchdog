import { z } from "zod";
import type { MonitoringConfiguration } from "../config/monitoring.js";
import type { MonitorLogger } from "../monitoring/logs.js";
import type { Channel } from "../monitoring/model.js";
import { deliverySchema } from "../storage/store.js";
import type { MonitoringPersistence } from "../storage/persistence.js";
import type { DeliveryResult, NotificationAdapter } from "./types.js";
import { bounded } from "../operations/deadline.js";
import { DataError } from "../domain/errors.js";

const resultSchema = z.union([
  z.object({ delivered: z.literal(true) }).strict(),
  z.object({ delivered: z.literal(false), code: deliverySchema.shape.last_error.unwrap(), retryable: z.boolean(), ambiguous: z.boolean(),
    retryAfterMs: z.number().finite().min(0).max(365 * 86_400_000).nullable() }).strict()
]);
export function retryDelay(attempt: number, policy: MonitoringConfiguration["notifications"], random: () => number): number {
  const sample = random();
  const jitter = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5;
  const base = Math.min(policy.maxDelaySeconds, policy.baseDelaySeconds * 2 ** (attempt - 1)) * 1_000;
  return Math.ceil(Math.min(policy.maxDelaySeconds * 1_000, base * (1 + (2 * jitter - 1) * policy.jitterRatio)));
}

export class NotificationDispatcher {
  readonly channels: Channel[];
  private active: Promise<number> | null = null;
  private stopping = false;
  private readonly cancellation = new AbortController();
  constructor(private readonly store: Pick<MonitoringPersistence, "due" | "exhaust" | "alert" | "startAttempt" | "finishAttempt">, private readonly adapters: readonly NotificationAdapter[],
    private readonly policy: MonitoringConfiguration["notifications"], private readonly now: () => Date,
    private readonly log: MonitorLogger, private readonly random: () => number = Math.random) {
    this.channels = [...new Set(adapters.map(adapter => adapter.channel))];
  }
  drain(): Promise<number> {
    if (this.stopping) return this.active ?? Promise.resolve(0);
    if (this.active) return this.active;
    this.active = this.dispatch().finally(() => { this.active = null; });
    return this.active;
  }
  stop(): void { this.stopping = true; }
  abort(): void { this.stop(); this.cancellation.abort(); }
  private async dispatch(): Promise<number> {
    let attempted = 0;
    for (let index = 0; index < this.policy.maxPerDrain && !this.stopping; index += 1) {
      // Requery after every response so a 429 also delays other queued alerts on that provider.
      const next = (await this.store.due(this.now().toISOString(), this.channels, 1))[0];
      if (!next) break;
      if (next.attempts >= this.policy.maxAttempts) { await this.store.exhaust(next.id, this.now().toISOString()); continue; }
      const adapter = this.adapters.find(adapter => adapter.channel === next.channel)!;
      // Store corruption is a persistence failure, never a provider retry.
      const alert = await this.store.alert(next.alert_id);
      const delivery = await this.store.startAttempt(next.id, this.now().toISOString());
      if (this.cancellation.signal.aborted || this.stopping) break;
      let result: DeliveryResult;
      try {
        result = resultSchema.parse(await bounded(signal => adapter.send(alert, signal), this.policy.timeoutSeconds * 1_000, "PROVIDER_TIMEOUT", this.cancellation.signal));
      } catch (error) { result = { delivered: false, code: error instanceof DataError && error.code === "PROVIDER_TIMEOUT" ? "PROVIDER_TIMEOUT" : "ADAPTER_ERROR",
        retryable: true, ambiguous: true, retryAfterMs: null }; }
      // A hard shutdown closes the store; its in-flight attempt is deliberately recovered as ambiguous on restart.
      if (this.cancellation.signal.aborted) break;
      const now = this.now();
      const ambiguous = !result.delivered && result.ambiguous;
      const delay = result.delivered ? 0 : Math.max(retryDelay(delivery.attempts, this.policy, this.random), result.retryAfterMs ?? 0);
      // Even the final attempt must hold the whole channel after a metadata-free/zero-delay 429.
      if (!result.delivered && result.code === "PROVIDER_RATE_LIMIT" && result.retryable) result = { ...result, retryAfterMs: delay };
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
