import type { PoolConfig } from "pg";
export declare const PG_LIMITS: Readonly<{
    connectionsPerRole: 1;
    queuedPerRole: 3;
    connectMs: 5000;
    idleMs: 5000;
    queryMs: 6000;
    transactionMs: 10000;
    readTransactionMs: 4000;
    writerStatementMs: 5000;
    readerStatementMs: 1000;
    lockMs: 1000;
    closeMs: 5000;
    cycleMs: 240000;
    jobMs: 300000;
    leaseSeconds: 360;
    httpMs: 420000;
    bodyBytes: 1024;
    storageStopBytes: 800000000;
    pendingDeliveries: 10000;
}>;
export declare const SLOT_PERIOD_DEFAULT_SECONDS = 300;
export interface PostgresConfiguration {
    backend: "postgres";
    namespace: string;
    schedulerEnabled: boolean;
    slotPeriodSeconds: number;
    writer: PoolConfig;
    reader: PoolConfig;
}
/** No pg environment/default URL discovery, URL-supplied TLS files, or permissive SSL options. */
export declare function connectionConfiguration(value: string | undefined): PoolConfig;
/** Called only by the explicit PostgreSQL entrypoint. It never loads credential files. */
export declare function postgresConfiguration(input: Readonly<Record<string, string | undefined>>): PostgresConfiguration;
