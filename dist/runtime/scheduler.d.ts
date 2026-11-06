import type { CycleResult } from "../monitoring/service.js";
import type { Fence } from "../storage/postgres/database.js";
import type { PostgresSchedulerStore } from "../storage/postgres/scheduler-store.js";
import type { ReadReply } from "./read-model.js";
export interface ScheduledJob {
    runOnce(): Promise<CycleResult>;
    abort(): void;
    shutdown(): Promise<void>;
}
export interface SchedulerEndpoint {
    authenticate(header: string | undefined): boolean;
    periodSeconds: number;
    run(slot: string, signal: AbortSignal): Promise<ReadReply>;
}
export interface SchedulerOptions {
    enabled: boolean;
    periodSeconds: number;
    store: Pick<PostgresSchedulerStore, "admit" | "finish">;
    createJob(fence: Fence, signal: AbortSignal): ScheduledJob;
    /** May only reduce the production bound; used by deterministic local timeout tests. */
    budgetMs?: number;
}
/** One finite request owns the complete job. No timers/polling initiate background monitoring. */
export declare class SchedulerRunner {
    private readonly options;
    private stopping;
    private readonly active;
    private readonly running;
    private readonly budget;
    private readonly periodSeconds;
    constructor(options: SchedulerOptions);
    run(slot: string, caller: AbortSignal): Promise<ReadReply>;
    private execute;
    stop(): Promise<void>;
}
