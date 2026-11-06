import { lstat, readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { z } from "zod";
import { DataError } from "../domain/errors.js";
import { databasePath, localPath } from "../storage/paths.js";
const bytes = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const resourceSchema = z.object({
    databaseBytes: bytes.default(4 * 1_024 ** 3), walBytes: bytes.default(256 * 1_024 ** 2),
    minFreeBytes: bytes.default(512 * 1_024 ** 2), pendingDeliveries: z.number().int().min(1).max(1_000_000).default(10_000),
    rssBytes: bytes.default(512 * 1_024 ** 2), evidenceBytes: bytes.default(2 * 1_024 ** 3),
    evidenceFiles: z.number().int().min(1).max(1_000_000).default(50_000)
}).strict();
const interval = z.number().int().min(5).max(86_400);
const monitoringSchema = z.object({
    enabled: z.boolean().default(false), intervalSeconds: interval.default(60),
    maxConsecutiveFailures: z.number().int().min(1).max(1_000).default(3),
    alertOnRecovery: z.boolean().default(true), alertOnDataQualityChanges: z.boolean().default(true),
    alertOnEveryCriticalCheck: z.boolean().default(false),
    criticalReminderSeconds: z.number().int().min(5).max(604_800).nullable().default(null),
    oracleLocalMaxAgeSeconds: z.number().int().min(1).max(31_536_000).optional()
}).strict();
const configurationSchema = z.object({
    monitoring: monitoringSchema.prefault({}),
    storage: z.object({
        path: z.string().min(1).max(2_048).default("data/watchdog.sqlite"),
        cycleRetentionDays: z.number().int().min(1).max(3_650).default(30),
        alertRetentionDays: z.number().int().min(7).max(3_650).default(180)
    }).strict().prefault({}),
    notifications: z.object({
        telegram: z.boolean().default(false), discord: z.boolean().default(false),
        maxAttempts: z.number().int().min(1).max(10).default(5),
        baseDelaySeconds: z.number().int().min(1).max(300).default(5),
        maxDelaySeconds: z.number().int().min(1).max(86_400).default(900),
        jitterRatio: z.number().min(0).max(0.5).default(0.2),
        timeoutSeconds: z.number().int().min(1).max(60).default(15),
        maxPerDrain: z.number().int().min(1).max(50).default(10)
    }).strict().prefault({}),
    operations: z.object({
        profile: z.enum(["local", "production"]).default("local"),
        shutdownTimeoutSeconds: z.number().int().min(1).max(300).default(30),
        cycleTimeoutSeconds: z.number().int().min(1).max(900).default(240),
        connectivityTimeoutSeconds: z.number().int().min(1).max(120).default(30),
        chainStatusMaxAgeSeconds: z.number().int().min(5).max(86_400).default(600),
        failureBackoffMaxSeconds: z.number().int().min(5).max(86_400).default(900)
    }).strict().prefault({}),
    resources: resourceSchema.prefault({})
}).strict();
export function parseMonitoringConfiguration(raw = {}, overrides = {}) {
    const parsed = configurationSchema.safeParse(raw);
    if (!parsed.success)
        throw new DataError("MONITOR_CONFIG", "Invalid monitoring configuration; only documented non-secret fields are allowed.");
    const result = parsed.data;
    if (overrides.enabled !== undefined)
        result.monitoring.enabled = overrides.enabled;
    if (overrides.intervalSeconds !== undefined)
        result.monitoring.intervalSeconds = overrides.intervalSeconds;
    if (overrides.database !== undefined)
        result.storage.path = overrides.database;
    if (!configurationSchema.safeParse(result).success
        || (result.monitoring.criticalReminderSeconds !== null && result.monitoring.criticalReminderSeconds < result.monitoring.intervalSeconds)
        || result.notifications.maxDelaySeconds < result.notifications.baseDelaySeconds) {
        throw new DataError("MONITOR_CONFIG", "Intervals must be integers from 5 to 86400 seconds; reminders and retry bounds must be consistent.");
    }
    try {
        if (result.storage.path === ":memory:")
            throw new Error();
        databasePath(result.storage.path);
    }
    catch {
        throw new DataError("MONITOR_DATABASE_PATH", "Use a local .sqlite or .db file outside evidence archives, without parent traversal.");
    }
    return result;
}
export async function loadMonitoringConfiguration(path, overrides = {}) {
    if (path === undefined)
        return parseMonitoringConfiguration({}, overrides);
    if (extname(path).toLowerCase() !== ".json" || /^(?:\.env|.*(?:secret|credential|keystore))/i.test(basename(path))) {
        throw new DataError("MONITOR_CONFIG_FILE", "Monitoring configuration must be an explicit non-secret JSON file.");
    }
    let raw;
    try {
        path = localPath(path);
        const info = await lstat(path);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 32_768)
            throw new Error();
        raw = JSON.parse(await readFile(path, "utf8"));
    }
    catch {
        throw new DataError("MONITOR_CONFIG_FILE", "Cannot read a bounded, regular monitoring JSON configuration file.");
    }
    return parseMonitoringConfiguration(raw, overrides);
}
//# sourceMappingURL=monitoring.js.map