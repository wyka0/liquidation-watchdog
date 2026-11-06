import type { ResourceLimits } from "../config/monitoring.js";
export declare function hashFile(path: string): Promise<string>;
/** Online backup uses sqlite3_backup, never a raw copy of a live database or its WAL. */
export declare function createBackup(source: string, output: string, options?: {
    projectRoot?: string;
    now?: () => Date;
    limits?: ResourceLimits;
}): Promise<{
    created: boolean;
    mechanism: "SQLITE_ONLINE_BACKUP_API";
    passed: true;
    manifestSha256: string;
    schemaVersion: number;
    databaseSha256: string;
    counts: Record<string, number>;
    evidenceBundles: number;
    evidenceFiles: number;
    reviewedReferences: number;
    actionable: false;
}>;
export declare function verifyBackup(directory: string): Promise<{
    passed: true;
    manifestSha256: string;
    schemaVersion: number;
    databaseSha256: string;
    counts: Record<string, number>;
    evidenceBundles: number;
    evidenceFiles: number;
    reviewedReferences: number;
    actionable: false;
}>;
/** Restore only into an exclusively created scratch directory and destroy only that scratch directory. */
export declare function verifyRestore(directory: string, scratchRoot?: string, maxAttempts?: number): Promise<{
    passed: boolean;
    isolated: boolean;
    sourceUnchanged: boolean;
    preservedStateAlertsAndDedup: boolean;
    knownDeliveredNotResent: boolean;
    recoveredAmbiguous: number;
    priorSchemaVersion: number;
    restoredSchemaVersion: number;
    externalCalls: number;
    actionable: boolean;
}>;
