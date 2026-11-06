import type { MonitoringConfiguration } from "../config/monitoring.js";
import type { ThresholdConfiguration } from "../config/risk.js";
import type { NotificationAdapter } from "../notifications/types.js";
import type { MonitorStore } from "../storage/store.js";
import type { MonitoringPersistence } from "../storage/persistence.js";
import type { MonitorLogger } from "./logs.js";
import type { Alert, Observation } from "./model.js";
import type { SupplementalResult } from "../oracle-assurance/supplemental.js";
import type { PositionConfiguration } from "../config/position.js";
export interface ServiceOptions {
    configuration: MonitoringConfiguration;
    thresholds: ThresholdConfiguration;
    store: MonitorStore;
    position: PositionConfiguration;
    adapters: readonly NotificationAdapter[];
    log?: MonitorLogger;
    now?: () => Date;
    id?: () => string;
    read?: (block?: bigint, signal?: AbortSignal) => Promise<unknown>;
    block?: bigint;
    allowFixture?: boolean;
    supplemental?: (snapshot: unknown) => Promise<SupplementalResult>;
    pause?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
    random?: () => number;
}
export type AsyncServiceOptions = Omit<ServiceOptions, "store"> & {
    store: MonitoringPersistence;
};
export type CycleResult = {
    skipped: "OVERLAP" | "STOPPED";
} | {
    observation: Observation;
    alerts: Alert[];
};
export declare class MonitoringService {
    private readonly options;
    readonly scope: string;
    private readonly dispatcher;
    private readonly now;
    private readonly log;
    private readonly configuration;
    private active;
    private initialized;
    private stopped;
    private readonly wake;
    private loop;
    private closing;
    private readonly abortReads;
    private runtime;
    private closed;
    private readonly store;
    constructor(options: ServiceOptions | AsyncServiceOptions);
    private initialize;
    runOnce(): Promise<CycleResult>;
    private cycle;
    runContinuous(): Promise<void>;
    private schedule;
    private updateRuntime;
    private fail;
    requestStop(): void;
    /** Scheduler/job cancellation also fences the asynchronous persistence adapter. */
    abort(): void;
    shutdown(): Promise<void>;
    private settleAndClose;
}
