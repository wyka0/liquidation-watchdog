import { z } from "zod";
export declare const resourceSchema: z.ZodObject<{
    databaseBytes: z.ZodDefault<z.ZodNumber>;
    walBytes: z.ZodDefault<z.ZodNumber>;
    minFreeBytes: z.ZodDefault<z.ZodNumber>;
    pendingDeliveries: z.ZodDefault<z.ZodNumber>;
    rssBytes: z.ZodDefault<z.ZodNumber>;
    evidenceBytes: z.ZodDefault<z.ZodNumber>;
    evidenceFiles: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
export type ResourceLimits = z.infer<typeof resourceSchema>;
declare const configurationSchema: z.ZodObject<{
    monitoring: z.ZodPrefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        intervalSeconds: z.ZodDefault<z.ZodNumber>;
        maxConsecutiveFailures: z.ZodDefault<z.ZodNumber>;
        alertOnRecovery: z.ZodDefault<z.ZodBoolean>;
        alertOnDataQualityChanges: z.ZodDefault<z.ZodBoolean>;
        alertOnEveryCriticalCheck: z.ZodDefault<z.ZodBoolean>;
        criticalReminderSeconds: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        oracleLocalMaxAgeSeconds: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    storage: z.ZodPrefault<z.ZodObject<{
        path: z.ZodDefault<z.ZodString>;
        cycleRetentionDays: z.ZodDefault<z.ZodNumber>;
        alertRetentionDays: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>>;
    notifications: z.ZodPrefault<z.ZodObject<{
        telegram: z.ZodDefault<z.ZodBoolean>;
        discord: z.ZodDefault<z.ZodBoolean>;
        maxAttempts: z.ZodDefault<z.ZodNumber>;
        baseDelaySeconds: z.ZodDefault<z.ZodNumber>;
        maxDelaySeconds: z.ZodDefault<z.ZodNumber>;
        jitterRatio: z.ZodDefault<z.ZodNumber>;
        timeoutSeconds: z.ZodDefault<z.ZodNumber>;
        maxPerDrain: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>>;
    operations: z.ZodPrefault<z.ZodObject<{
        profile: z.ZodDefault<z.ZodEnum<{
            local: "local";
            production: "production";
        }>>;
        shutdownTimeoutSeconds: z.ZodDefault<z.ZodNumber>;
        cycleTimeoutSeconds: z.ZodDefault<z.ZodNumber>;
        connectivityTimeoutSeconds: z.ZodDefault<z.ZodNumber>;
        chainStatusMaxAgeSeconds: z.ZodDefault<z.ZodNumber>;
        failureBackoffMaxSeconds: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>>;
    resources: z.ZodPrefault<z.ZodObject<{
        databaseBytes: z.ZodDefault<z.ZodNumber>;
        walBytes: z.ZodDefault<z.ZodNumber>;
        minFreeBytes: z.ZodDefault<z.ZodNumber>;
        pendingDeliveries: z.ZodDefault<z.ZodNumber>;
        rssBytes: z.ZodDefault<z.ZodNumber>;
        evidenceBytes: z.ZodDefault<z.ZodNumber>;
        evidenceFiles: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type MonitoringConfiguration = z.infer<typeof configurationSchema>;
export type MonitoringPolicy = MonitoringConfiguration["monitoring"];
export interface MonitorOverrides {
    enabled?: boolean;
    intervalSeconds?: number;
    database?: string;
}
export declare function parseMonitoringConfiguration(raw?: unknown, overrides?: MonitorOverrides): MonitoringConfiguration;
export declare function loadMonitoringConfiguration(path?: string, overrides?: MonitorOverrides): Promise<MonitoringConfiguration>;
export {};
