import type { AddressInfo } from "node:net";
import type { PostgresConfiguration } from "../config/postgres.js";
import type { ThresholdConfiguration } from "../config/risk.js";
import type { MonitoringConfiguration } from "../config/monitoring.js";
import type { Lifecycle } from "./read-model.js";
import type { NotificationAdapter } from "../notifications/types.js";
import type { MonitorLogger } from "../monitoring/logs.js";
import type { PositionConfiguration } from "../config/position.js";
export interface PostgresRuntimeOptions {
    configuration: PostgresConfiguration; /** Resolved once at startup by config/runtime.ts; the runtime never reconstructs defaults. */
    monitoring: MonitoringConfiguration;
    thresholds: ThresholdConfiguration;
    position: PositionConfiguration;
    adapters: readonly NotificationAdapter[];
    log?: MonitorLogger;
    readCredential: string | undefined;
    schedulerCredential: string | undefined;
    host?: "127.0.0.1" | "0.0.0.0";
    port: number;
}
/** Inert construction and lazy pools; no migration, SQLite open or cycle at startup. */
export declare class PostgresRuntime {
    private readonly options;
    private lifecycle;
    private database;
    private runner;
    private http;
    private started;
    private closing;
    private finish;
    readonly done: Promise<number>;
    readonly notificationChannels: readonly NotificationAdapter["channel"][];
    constructor(options: PostgresRuntimeOptions);
    status(): Lifecycle;
    start(): Promise<AddressInfo>;
    stop(): Promise<void>;
}
