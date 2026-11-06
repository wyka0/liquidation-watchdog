import { z } from "zod";
import type { MonitoringConfiguration } from "../config/monitoring.js";
import type { ThresholdConfiguration } from "../config/risk.js";
import type { MonitorStore } from "../storage/store.js";
import type { Awaitable, SnapshotReader } from "../storage/persistence.js";
import type { PositionConfiguration } from "../config/position.js";
export declare const lifecycleSchema: z.ZodEnum<{
    FAILED: "FAILED";
    STARTING: "STARTING";
    STOPPED: "STOPPED";
    RUNNING: "RUNNING";
    DISABLED: "DISABLED";
    STOPPING: "STOPPING";
}>;
export type Lifecycle = z.infer<typeof lifecycleSchema>;
export declare const READ_ROUTES: readonly ["/api/readiness", "/api/monitoring/status", "/api/positions", "/api/risk", "/api/observations", "/api/alerts"];
export type ReadRoute = typeof READ_ROUTES[number];
export interface Page {
    limit: number;
    before?: number | string;
}
export interface ReadReply {
    status: number;
    body: unknown;
}
export interface ReadApi {
    readonly cursorKind?: "bigint";
    read(route: ReadRoute, page?: Page): Awaitable<ReadReply>;
}
export declare const CACHE_MILLISECONDS = 1000;
/** Uses only the one existing read-only connection. No probes, provider calls, paths or mutations.
 * Thresholds are injected once at startup; the served scope is exactly the configured runtime scope. */
export declare class PersistedReadModel implements ReadApi {
    private readonly store;
    private readonly configuration;
    private readonly lifecycle;
    private readonly now;
    private readonly scope;
    private readonly identity;
    constructor(store: Pick<MonitorStore, "readSnapshot"> | null, configuration: MonitoringConfiguration, lifecycle: () => Lifecycle, thresholds: ThresholdConfiguration, position: PositionConfiguration, now?: () => Date);
    read(route: ReadRoute, page?: Page): ReadReply;
}
/** The PostgreSQL adapter shares every field-selection and safety projection with SQLite. */
export declare class AsyncPersistedReadModel implements ReadApi {
    private readonly store;
    private readonly configuration;
    private readonly lifecycle;
    private readonly periodSeconds;
    private readonly now;
    readonly cursorKind: "bigint";
    private readonly scope;
    private readonly identity;
    constructor(store: SnapshotReader, configuration: MonitoringConfiguration, lifecycle: () => Lifecycle, thresholds: ThresholdConfiguration, position: PositionConfiguration, periodSeconds: number, now?: () => Date);
    read(route: ReadRoute, page?: Page): Promise<ReadReply>;
}
