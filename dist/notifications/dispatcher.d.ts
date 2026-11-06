import type { MonitoringConfiguration } from "../config/monitoring.js";
import type { MonitorLogger } from "../monitoring/logs.js";
import type { Channel } from "../monitoring/model.js";
import type { MonitoringPersistence } from "../storage/persistence.js";
import type { NotificationAdapter } from "./types.js";
export declare function retryDelay(attempt: number, policy: MonitoringConfiguration["notifications"], random: () => number): number;
export declare class NotificationDispatcher {
    private readonly store;
    private readonly adapters;
    private readonly policy;
    private readonly now;
    private readonly log;
    private readonly random;
    readonly channels: Channel[];
    private active;
    private stopping;
    private readonly cancellation;
    constructor(store: Pick<MonitoringPersistence, "due" | "exhaust" | "alert" | "startAttempt" | "finishAttempt">, adapters: readonly NotificationAdapter[], policy: MonitoringConfiguration["notifications"], now: () => Date, log: MonitorLogger, random?: () => number);
    drain(): Promise<number>;
    stop(): void;
    abort(): void;
    private dispatch;
}
