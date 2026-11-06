import { Pool } from "pg";
import type { PoolConfig, QueryResult, QueryResultRow } from "pg";
export interface Sql {
    query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}
export type PoolPort = Pick<Pool, "connect" | "end" | "on" | "totalCount" | "idleCount" | "waitingCount">;
/** One small pool for one configured role. No queries run during construction or while idle. */
export declare class PgConnection {
    private readonly role;
    private readonly pool;
    private pending;
    private closing;
    private readonly aborts;
    private connecting;
    private retryAfter;
    private failures;
    constructor(configuration: PoolConfig, role: "writer" | "reader", injected?: PoolPort);
    private failedConnection;
    private connect;
    transaction<T>(operation: (sql: Sql) => Promise<T>, caller?: AbortSignal): Promise<T>;
    statistics(): {
        total: number;
        idle: number;
        waiting: number;
        admitted: number;
    };
    close(): Promise<void>;
}
