import type { MonitoringConfiguration } from "../config/monitoring.js";
import type { ThresholdConfiguration } from "../config/risk.js";
import { MonitorStore } from "../storage/store.js";
import type { Connectivity } from "./connectivity.js";
import type { PositionConfiguration } from "../config/position.js";
export declare const SAFETY_STATUS: Readonly<{
    oracleAssurance: "UNVERIFIED";
    freshness: "UNKNOWN";
    financialActionability: false;
    estimates: "INDICATIVE_ONLY";
    productionReleaseReady: false;
    blockers: string[];
}>;
export declare function operationalDiagnostics(config: MonitoringConfiguration, thresholds: ThresholdConfiguration, options?: {
    probe?: boolean;
    now?: () => Date;
    environment?: NodeJS.ProcessEnv;
    openStore?: (path: string) => MonitorStore;
    connectivity?: () => Promise<Connectivity>;
    position?: PositionConfiguration;
}): Promise<{
    oracleAssurance: "UNVERIFIED";
    freshness: "UNKNOWN";
    financialActionability: false;
    estimates: "INDICATIVE_ONLY";
    productionReleaseReady: false;
    blockers: string[];
    commandScope: string;
    checkedAt: string;
    processHealth: {
        checker: string;
        healthy: boolean;
        workerStatus: string;
        ownership: "UNKNOWN" | "AVAILABLE" | "HELD";
        worker: {
            runId: string;
            scope: string;
            pid: number;
            startedAt: string;
            updatedAt: string;
            rssBytes: number;
            status: "FAILED" | "STARTING" | "READING" | "DELIVERING" | "IDLE" | "STOPPED";
            error: "READ_CANCELLED" | "RESOURCE_EVIDENCE_LIMIT" | "STORE_CORRUPT" | "CYCLE_TIMEOUT" | "SHUTDOWN_TIMEOUT" | "STORE_TRANSACTION_FAILED" | "STORE_OPEN_FAILED" | "RESOURCE_DATABASE_LIMIT" | "RESOURCE_WAL_LIMIT" | "RESOURCE_DISK_RESERVE" | "RESOURCE_BACKLOG_LIMIT" | "RESOURCE_MEMORY_LIMIT" | "RESOURCE_CHECK_FAILED" | "WORKER_FAILED" | null;
        } | null;
    };
    database: {
        schemaVersion: number;
        sqliteVersion: string;
        pageSize: number;
        pageCount: number;
        freePages: number;
        journalMode: string;
        foreignKeys: boolean;
        connectionReadOnly: boolean;
        connectionSynchronous: number;
        pendingDeliveries: number;
        counts: {
            [k: string]: number;
        };
        available: boolean;
        schemaCurrent: boolean;
        error?: never;
    };
    configuration: {
        valid: boolean;
        profile: "local" | "production";
        errors: string[];
        runtimeVerified: boolean;
        notifications: {
            console: "ENABLED";
            telegram: "INVALID" | "CONFIGURED" | "DISABLED" | "MISSING";
            discord: "INVALID" | "CONFIGURED" | "DISABLED" | "MISSING";
        };
        chain: {
            status: string;
            chainId: 1672;
        };
        secretValues: "OMITTED";
        endpointOverrides: "UNSUPPORTED";
    };
    runtime: {
        node: string;
        sqlite: string;
        platform: NodeJS.Platform;
        architecture: NodeJS.Architecture;
        verified: Readonly<{
            node: "v24.14.1";
            sqlite: "3.51.2";
        }>;
        checkerUptimeSeconds: number;
        checkerRssBytes: number;
    };
    lastCycle: {
        id: string;
        scope: string;
        started_at: string;
        status: "RUNNING" | "PERSISTED" | "COMPLETED" | "INTERRUPTED";
        completed_at: string | null;
    } | null;
    lastSuccessfulChainRead: {
        retrievedAt: string | null;
        blockNumber: string | null;
        blockHash: string | null;
        evidenceKind: "LIVE_CHAIN_READ" | "HISTORICAL_SNAPSHOT" | "FIXTURE" | null;
    } | null;
    pendingDeliveryCount: number | null;
    deliveryCounts: Record<"FAILED" | "PENDING" | "IN_FLIGHT" | "DELIVERED" | "RETRY_SCHEDULED" | "PERMANENTLY_FAILED", number>;
    providerLimits: {
        channel: "telegram" | "discord" | "console";
        next_at: string;
        blocked: 0 | 1;
    }[];
    monitoring: {
        initialized: boolean;
        currentAcceptedRead: boolean;
        latestAccepted: boolean;
        consecutiveFailures: number;
    };
    connectivity: Connectivity;
    resources: {
        memoryMeasurement: string;
        memoryMeasuredAt: string;
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
        memoryMeasurement: string;
        memoryMeasuredAt: string;
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
    evidence: {
        available: boolean;
        bytes?: number;
        files?: number;
        directories?: number;
        code?: string;
    };
    recentFailures: {
        occurred_at: string;
        code: "READ_CANCELLED" | "RESOURCE_EVIDENCE_LIMIT" | "STORE_CORRUPT" | "CYCLE_TIMEOUT" | "SHUTDOWN_TIMEOUT" | "STORE_TRANSACTION_FAILED" | "STORE_OPEN_FAILED" | "RESOURCE_DATABASE_LIMIT" | "RESOURCE_WAL_LIMIT" | "RESOURCE_DISK_RESERVE" | "RESOURCE_BACKLOG_LIMIT" | "RESOURCE_MEMORY_LIMIT" | "RESOURCE_CHECK_FAILED" | "WORKER_FAILED";
    }[];
    latestReadDiagnostics: ("BLOCK_TIMESTAMP_REGRESSION" | "RPC_UNAVAILABLE" | "MCP_UNAVAILABLE" | "RPC_INVALID" | "MCP_INVALID" | "SNAPSHOT_INVALID" | "SNAPSHOT_UNAVAILABLE" | "ORACLE_UNVERIFIED" | "ORACLE_DATA_UNAVAILABLE" | "ORACLE_DATA_INVALID" | "ORACLE_FRESHNESS_UNKNOWN" | "FRESHNESS_UNDETERMINED" | "MONITOR_MODE_MISMATCH" | "PROCESS_INTERRUPTED" | "RISK_CALCULATION_FAILED" | "BLOCK_REGRESSION")[];
    operationalReadiness: {
        readyForObservation: boolean;
        currentChainSnapshotRequired: boolean;
        latestCycleSettled: boolean;
        workerCoherent: boolean;
        monitorRunning: boolean;
    };
} | {
    oracleAssurance: "UNVERIFIED";
    freshness: "UNKNOWN";
    financialActionability: false;
    estimates: "INDICATIVE_ONLY";
    productionReleaseReady: false;
    blockers: string[];
    commandScope: string;
    checkedAt: string;
    runtime: {
        node: string;
        sqlite: string;
        platform: NodeJS.Platform;
        architecture: NodeJS.Architecture;
        verified: Readonly<{
            node: "v24.14.1";
            sqlite: "3.51.2";
        }>;
        checkerUptimeSeconds: number;
        checkerRssBytes: number;
    };
    configuration: {
        valid: boolean;
        profile: "local" | "production";
        errors: string[];
        runtimeVerified: boolean;
        notifications: {
            console: "ENABLED";
            telegram: "INVALID" | "CONFIGURED" | "DISABLED" | "MISSING";
            discord: "INVALID" | "CONFIGURED" | "DISABLED" | "MISSING";
        };
        chain: {
            status: string;
            chainId: 1672;
        };
        secretValues: "OMITTED";
        endpointOverrides: "UNSUPPORTED";
    };
    processHealth: {
        checker: string;
        healthy: boolean;
        workerStatus: string;
        ownership: string;
        worker: null;
    };
    database: {
        available: boolean;
        schemaCurrent: boolean;
        error: string;
    };
    connectivity: Connectivity;
    lastCycle: null;
    lastSuccessfulChainRead: null;
    pendingDeliveryCount: null;
    operationalReadiness: {
        readyForObservation: boolean;
        currentChainSnapshotRequired: boolean;
        monitorRunning: boolean;
        latestCycleSettled?: never;
        workerCoherent?: never;
    };
}>;
