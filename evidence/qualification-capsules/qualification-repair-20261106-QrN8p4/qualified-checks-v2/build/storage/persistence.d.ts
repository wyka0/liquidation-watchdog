import type { ResourceLimits } from "../config/monitoring.js";
import type { MonitorStore } from "./store.js";
export type Awaitable<T> = T | Promise<T>;
type Methods = Pick<MonitorStore, "acquireMonitor" | "state" | "beginCycle" | "commitObservation" | "finishCycle" | "latestOracleAssurance" | "unfinishedCycles" | "recoverDeliveries" | "due" | "exhaust" | "alert" | "startAttempt" | "finishAttempt" | "nextDeliveryAt" | "prune" | "saveRuntime" | "close">;
type AwaitableMethods<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Awaitable<R> : never;
};
/** Only the operations consumed by monitoring; SQL and backend lifecycle stay outside business logic. */
export interface MonitoringPersistence extends AwaitableMethods<Methods> {
    requireResources(limits: ResourceLimits): Awaitable<void>;
    /** Remote adapters revoke queued/in-flight work when the whole-cycle deadline expires. */
    cancel?(): void;
}
export type ReadSnapshot = ReturnType<MonitorStore["readSnapshot"]>;
export interface SnapshotPage {
    kind: "alerts" | "observations";
    limit: number;
    before?: string;
}
export interface SnapshotReader {
    readSnapshot(scope: string, page?: SnapshotPage): Promise<ReadSnapshot>;
}
/** SQLite remains synchronous and retains its existing lock, resource checks and backup implementation. */
export declare function monitoringPersistence(store: MonitorStore | MonitoringPersistence): MonitoringPersistence;
export {};
