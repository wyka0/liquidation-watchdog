import { z } from "zod";
declare const logSchema: z.ZodObject<{
    timestamp: z.ZodISODateTime;
    event: z.ZodEnum<{
        cycle_started: "cycle_started";
        cycle_observed: "cycle_observed";
        cycle_completed: "cycle_completed";
        alert_created: "alert_created";
        notification_delivery: "notification_delivery";
        shutdown: "shutdown";
        restart_recovery: "restart_recovery";
        operational_failure: "operational_failure";
        startup_validated: "startup_validated";
    }>;
    code: z.ZodOptional<z.ZodEnum<{
        READ_CANCELLED: "READ_CANCELLED";
        RESOURCE_EVIDENCE_LIMIT: "RESOURCE_EVIDENCE_LIMIT";
        STORE_CORRUPT: "STORE_CORRUPT";
        CYCLE_TIMEOUT: "CYCLE_TIMEOUT";
        SHUTDOWN_TIMEOUT: "SHUTDOWN_TIMEOUT";
        STORE_TRANSACTION_FAILED: "STORE_TRANSACTION_FAILED";
        STORE_OPEN_FAILED: "STORE_OPEN_FAILED";
        RESOURCE_DATABASE_LIMIT: "RESOURCE_DATABASE_LIMIT";
        RESOURCE_WAL_LIMIT: "RESOURCE_WAL_LIMIT";
        RESOURCE_DISK_RESERVE: "RESOURCE_DISK_RESERVE";
        RESOURCE_BACKLOG_LIMIT: "RESOURCE_BACKLOG_LIMIT";
        RESOURCE_MEMORY_LIMIT: "RESOURCE_MEMORY_LIMIT";
        RESOURCE_CHECK_FAILED: "RESOURCE_CHECK_FAILED";
        WORKER_FAILED: "WORKER_FAILED";
    }>>;
    cycleId: z.ZodOptional<z.ZodString>;
    alertId: z.ZodOptional<z.ZodString>;
    durationMs: z.ZodOptional<z.ZodNumber>;
    blockNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    blockHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    accepted: z.ZodOptional<z.ZodBoolean>;
    mathematicalRiskState: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dataQuality: z.ZodOptional<z.ZodEnum<{
        VALID: "VALID";
        STALE: "STALE";
        UNAVAILABLE: "UNAVAILABLE";
        INVALID: "INVALID";
        UNVERIFIED: "UNVERIFIED";
    }>>;
    oracleQuality: z.ZodOptional<z.ZodEnum<{
        VALID: "VALID";
        STALE: "STALE";
        UNAVAILABLE: "UNAVAILABLE";
        INVALID: "INVALID";
        UNVERIFIED: "UNVERIFIED";
    }>>;
    diagnostics: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
        RPC_UNAVAILABLE: "RPC_UNAVAILABLE";
        MCP_UNAVAILABLE: "MCP_UNAVAILABLE";
        RPC_INVALID: "RPC_INVALID";
        MCP_INVALID: "MCP_INVALID";
        SNAPSHOT_INVALID: "SNAPSHOT_INVALID";
        SNAPSHOT_UNAVAILABLE: "SNAPSHOT_UNAVAILABLE";
        ORACLE_UNVERIFIED: "ORACLE_UNVERIFIED";
        ORACLE_DATA_UNAVAILABLE: "ORACLE_DATA_UNAVAILABLE";
        ORACLE_DATA_INVALID: "ORACLE_DATA_INVALID";
        ORACLE_FRESHNESS_UNKNOWN: "ORACLE_FRESHNESS_UNKNOWN";
        FRESHNESS_UNDETERMINED: "FRESHNESS_UNDETERMINED";
        MONITOR_MODE_MISMATCH: "MONITOR_MODE_MISMATCH";
        PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
        RISK_CALCULATION_FAILED: "RISK_CALCULATION_FAILED";
        BLOCK_REGRESSION: "BLOCK_REGRESSION";
    }>>>;
    channel: z.ZodOptional<z.ZodEnum<{
        telegram: "telegram";
        discord: "discord";
        console: "console";
    }>>;
    deliveryStatus: z.ZodOptional<z.ZodEnum<{
        UNKNOWN: "UNKNOWN";
        FAILED: "FAILED";
        PENDING: "PENDING";
        DELIVERED: "DELIVERED";
        RETRY_SCHEDULED: "RETRY_SCHEDULED";
        PERMANENTLY_FAILED: "PERMANENTLY_FAILED";
    }>>;
}, z.core.$strict>;
export type LogRecord = z.infer<typeof logSchema>;
export type MonitorLogger = (record: LogRecord) => void;
export declare function structuredLogger(write: (text: string) => void): MonitorLogger;
export {};
