import { setTimeout as sleep } from "node:timers/promises";
import { Pool, types } from "pg";
import type { PoolClient, PoolConfig, QueryResult, QueryResultRow } from "pg";
import { PG_LIMITS } from "../../config/postgres.js";
import { DataError } from "../../domain/errors.js";
import { bounded } from "../../operations/deadline.js";

export interface Sql {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}
export type PoolPort = Pick<Pool, "connect" | "end" | "on" | "totalCount" | "idleCount" | "waitingCount">;
const transient = (error: unknown): boolean => error instanceof Error && "code" in error
  && /^(?:08[A-Z0-9]{3}|57P0[123]|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE)$/.test(String(error.code));
const unavailable = () => new DataError("POSTGRES_UNAVAILABLE", "PostgreSQL is temporarily unavailable; persisted data was retained.");

/** One small pool for one configured role. No queries run during construction or while idle. */
export class PgConnection {
  private readonly pool: PoolPort;
  private pending = 0;
  private closing: Promise<void> | null = null;
  private readonly aborts = new Set<AbortController>();
  private connecting: Promise<void> = Promise.resolve();
  private retryAfter = 0;
  private failures = 0;

  constructor(configuration: PoolConfig, private readonly role: "writer" | "reader", injected?: PoolPort) {
    this.pool = injected ?? new Pool({ ...configuration, max: PG_LIMITS.connectionsPerRole, min: 0,
      connectionTimeoutMillis: PG_LIMITS.connectMs, idleTimeoutMillis: PG_LIMITS.idleMs, query_timeout: PG_LIMITS.queryMs,
      maxLifetimeSeconds: 60, allowExitOnIdle: true, keepAlive: false,
      types: { getTypeParser: (oid, format) => [20, 1700, 1114, 1184].includes(oid) ? (value: string) => value : types.getTypeParser(oid, format) } });
    // An idle error is observable only as sanitized availability, never raw URL/driver text.
    this.pool.on("error", () => { this.failedConnection(); });
  }
  private failedConnection(): void {
    this.failures = Math.min(this.failures + 1, 5);
    this.retryAfter = Date.now() + Math.min(2_000, 100 * 2 ** this.failures) + Math.floor(Math.random() * 100);
  }
  private async connect(signal: AbortSignal): Promise<PoolClient> {
    // Serialize acquisition/retry across callers so a cold/outage pool cannot create a reconnect storm.
    let unlock!: () => void;
    const previous = this.connecting; this.connecting = new Promise(resolve => { unlock = resolve; });
    try {
      await previous;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (signal.aborted || this.closing) throw unavailable();
        const wait = this.retryAfter - Date.now();
        if (wait > 0) await sleep(wait, undefined, { signal });
        try {
          const client = await this.pool.connect();
          if (signal.aborted || this.closing) { client.release(true); throw unavailable(); }
          this.failures = 0; this.retryAfter = 0; return client;
        } catch (error) {
          this.failedConnection();
          if (!transient(error) || attempt === 1) throw unavailable();
        }
      }
      throw unavailable();
    } finally { unlock(); }
  }

  async transaction<T>(operation: (sql: Sql) => Promise<T>, caller?: AbortSignal): Promise<T> {
    if (this.closing || this.pending >= PG_LIMITS.queuedPerRole + 1) throw new DataError("READ_BUSY", "Bounded PostgreSQL capacity is exhausted.");
    this.pending++;
    const cancellation = new AbortController(), cancel = () => cancellation.abort();
    this.aborts.add(cancellation); caller?.addEventListener("abort", cancel, { once: true });
    if (caller?.aborted) cancellation.abort();
    let commitSent = false, committed = false, started = false;
    const releaseAdmission = () => { this.pending--; this.aborts.delete(cancellation); caller?.removeEventListener("abort", cancel); };
    try {
      return await bounded(async signal => {
        started = true;
        try {
        const client = await this.connect(signal);
        let released = false, begun = false;
        const discard = () => { if (!released) { released = true; client.release(true); } };
        const failed = () => { this.failedConnection(); discard(); };
        client.on("error", failed);
        signal.addEventListener("abort", discard, { once: true });
        const sql: Sql = { query: async (text, values) => {
          if (released || signal.aborted) throw unavailable();
          return client.query(text, values);
        } };
        try {
          await sql.query(this.role === "reader" ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN ISOLATION LEVEL READ COMMITTED"); begun = true;
          await sql.query("SELECT set_config('search_path','pg_catalog',true),set_config('TimeZone','UTC',true),set_config('synchronous_commit','on',true),set_config('lock_timeout','1000',true),set_config('statement_timeout',$1,true),set_config('idle_in_transaction_session_timeout','5000',true)",
            [String(this.role === "reader" ? PG_LIMITS.readerStatementMs : PG_LIMITS.writerStatementMs)]);
          const result = await operation(sql);
          if (signal.aborted || released) throw unavailable();
          commitSent = true; await sql.query("COMMIT"); committed = true;
          return result;
        } catch (error) {
          if (begun && !released && !commitSent) {
            try { await client.query("ROLLBACK"); } catch { discard(); }
          }
          if (commitSent && !committed) { discard(); throw new DataError("POSTGRES_COMMIT_UNKNOWN", "Commit outcome is unknown; reconcile the durable identity before further work."); }
          if (transient(error)) { this.failedConnection(); discard(); }
          if (error instanceof DataError) throw error;
          throw new DataError("STORE_TRANSACTION_FAILED", "PostgreSQL transaction failed; no automatic write replay was attempted.");
        } finally {
          signal.removeEventListener("abort", discard);
          client.removeListener("error", failed);
          if (!released) { released = true; client.release(); }
        }
        } finally { releaseAdmission(); }
      }, this.role === "reader" ? PG_LIMITS.readTransactionMs : PG_LIMITS.transactionMs, "POSTGRES_TIMEOUT", cancellation.signal);
    } catch (error) {
      if (commitSent && !committed) throw new DataError("POSTGRES_COMMIT_UNKNOWN", "Commit outcome is unknown; reconcile the durable identity before further work.");
      if (error instanceof DataError) throw error;
      throw unavailable();
    } finally { if (!started) releaseAdmission(); }
  }
  statistics() { return { total: this.pool.totalCount, idle: this.pool.idleCount, waiting: this.pool.waitingCount, admitted: this.pending }; }
  close(): Promise<void> {
    if (!this.closing) {
      for (const controller of this.aborts) controller.abort();
      this.closing = bounded(() => this.pool.end(), PG_LIMITS.closeMs, "POSTGRES_CLOSE_TIMEOUT").catch(error => {
        if (error instanceof DataError) throw error;
        throw unavailable();
      });
    }
    return this.closing;
  }
}
