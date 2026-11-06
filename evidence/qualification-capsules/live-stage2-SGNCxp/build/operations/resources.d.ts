import type { ResourceLimits } from "../config/monitoring.js";
import type { MonitorStore } from "../storage/store.js";
export declare function diskStatistics(path: string): {
    databaseBytes: number;
    walBytes: number;
    shmBytes: number;
    freeBytes: number;
    volumeBytes: number;
};
export declare function resourceStatus(path: string, store: MonitorStore, limits: ResourceLimits, rssBytes?: number): {
    ok: boolean;
    issues: ("READ_CANCELLED" | "RESOURCE_EVIDENCE_LIMIT" | "STORE_CORRUPT" | "CYCLE_TIMEOUT" | "SHUTDOWN_TIMEOUT" | "STORE_TRANSACTION_FAILED" | "STORE_OPEN_FAILED" | "RESOURCE_DATABASE_LIMIT" | "RESOURCE_WAL_LIMIT" | "RESOURCE_DISK_RESERVE" | "RESOURCE_BACKLOG_LIMIT" | "RESOURCE_MEMORY_LIMIT" | "RESOURCE_CHECK_FAILED" | "WORKER_FAILED")[];
    disk: {
        databaseBytes: number;
        walBytes: number;
        shmBytes: number;
        freeBytes: number;
        volumeBytes: number;
    } | {
        databaseBytes: number;
        walBytes: number;
        shmBytes: number;
        freeBytes: null;
        volumeBytes: null;
    };
    rssBytes: number;
    pendingDeliveries: number;
    limits: {
        databaseBytes: number;
        walBytes: number;
        minFreeBytes: number;
        pendingDeliveries: number;
        rssBytes: number;
        evidenceBytes: number;
        evidenceFiles: number;
    };
} | {
    ok: boolean;
    issues: "RESOURCE_CHECK_FAILED"[];
    disk: null;
    rssBytes: number;
    pendingDeliveries: null;
    limits: {
        databaseBytes: number;
        walBytes: number;
        minFreeBytes: number;
        pendingDeliveries: number;
        rssBytes: number;
        evidenceBytes: number;
        evidenceFiles: number;
    };
};
export declare function requireResources(path: string, store: MonitorStore, limits: ResourceLimits): void;
/** Bounded metadata-only walk; existing evidence is never removed to make space. */
export declare function evidenceStatistics(root: string, limits?: ResourceLimits): {
    bytes: number;
    files: number;
    directories: number;
};
export declare function requireEvidenceCapacity(root: string, addedBytes: number, addedFiles: number, limits?: {
    databaseBytes: number;
    walBytes: number;
    minFreeBytes: number;
    pendingDeliveries: number;
    rssBytes: number;
    evidenceBytes: number;
    evidenceFiles: number;
}): void;
export declare function prepareEvidenceCapture(directory: string, documents: Readonly<Record<string, string>>): string;
