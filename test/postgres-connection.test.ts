import { EventEmitter } from "node:events";
import type { PoolClient, PoolConfig, QueryResult } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PgConnection } from "../src/storage/postgres/connection.js";
import type { PoolPort, Sql } from "../src/storage/postgres/connection.js";

const configuration: PoolConfig = { host: "fixture.invalid", database: "fixture", user: "fixture", password: async () => "", ssl: true };
const result = (): QueryResult => ({ command: "SELECT", rowCount: 0, oid: 0, rows: [], fields: [] });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function client() {
  const events = new EventEmitter(), query = vi.fn(async (_text: string, _values?: unknown[]) => result()), release = vi.fn();
  return { port: Object.assign(events, { query, release }) as unknown as PoolClient, query, release, events };
}
function pool(connect: () => Promise<PoolClient>) {
  const events = new EventEmitter(), end = vi.fn(async () => {}), checkout = vi.fn(connect);
  return { port: Object.assign(events, { connect: checkout, end, totalCount: 0, idleCount: 0, waitingCount: 0 }) as unknown as PoolPort, checkout, end, events };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("PHASE10 DRIVER INJECTION: bounded ownership, cancellation and unknown commits", () => {
  it("uses one checked-out client and rolls back on operation failure without write replay", async () => {
    const c = client(), p = pool(async () => c.port), connection = new PgConnection(configuration, "writer", p.port), operation = vi.fn(async (sql: Sql) => {
      await sql.query("SELECT $1::text", ["synthetic-value"]); throw new Error("Synthetic driver detail");
    });
    await expect(connection.transaction(operation)).rejects.toMatchObject({ code: "STORE_TRANSACTION_FAILED" });
    expect(operation).toHaveBeenCalledOnce(); expect(p.checkout).toHaveBeenCalledOnce();
    expect(c.query.mock.calls.map(call => call[0])).toEqual(["BEGIN ISOLATION LEVEL READ COMMITTED",
      expect.stringMatching(/set_config\('search_path','pg_catalog',true\).*synchronous_commit/), "SELECT $1::text", "ROLLBACK"]);
    expect(c.query.mock.calls[1]?.[1]).toEqual(["5000"]);
    expect(c.release).toHaveBeenCalledExactlyOnceWith(); await connection.close();
  });
  it("enforces a transaction-local search path before reader callback SQL", async () => {
    const c = client(), p = pool(async () => c.port), connection = new PgConnection(configuration, "reader", p.port);
    await connection.transaction(async sql => { await sql.query("SELECT 1"); });
    expect(c.query.mock.calls.map(call => call[0])).toEqual(["BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
      expect.stringMatching(/set_config\('search_path','pg_catalog',true\).*statement_timeout/), "SELECT 1", "COMMIT"]);
    expect(c.query.mock.calls[1]?.[1]).toEqual(["1000"]);
    await connection.close();
  });
  it("rejects excess queue admission and aborts all admitted clients during close", async () => {
    const clients = Array.from({ length: 4 }, client), wait = deferred<void>(), p = pool(async (): Promise<PoolClient> => clients[p.checkout.mock.calls.length - 1]!.port);
    const connection = new PgConnection(configuration, "writer", p.port);
    const jobs = Array.from({ length: 4 }, () => connection.transaction(async () => { await wait.promise; }).catch(error => error));
    await expect(connection.transaction(async () => {})).rejects.toMatchObject({ code: "READ_BUSY" });
    expect(connection.statistics().admitted).toBe(4);
    await connection.close(); expect((await Promise.all(jobs)).every(error => error instanceof Error)).toBe(true);
    wait.resolve(); expect(p.end).toHaveBeenCalledOnce();
  });
  it("discards a checkout that arrives after cancellation and never begins a transaction", async () => {
    const c = client(), late = deferred<PoolClient>(), entered = deferred<void>(), p = pool(() => { entered.resolve(); return late.promise; });
    const connection = new PgConnection(configuration, "writer", p.port), abort = new AbortController();
    const job = connection.transaction(async () => {}, abort.signal).catch(error => error); await entered.promise; abort.abort();
    expect(await job).toMatchObject({ code: "READ_CANCELLED" }); late.resolve(c.port);
    await new Promise<void>(resolve => { setImmediate(resolve); }); expect(c.query).not.toHaveBeenCalled(); expect(c.release).toHaveBeenCalledExactlyOnceWith(true); await connection.close();
  });
  it("retains admission for cancelled non-cooperative callbacks until their underlying work unwinds", async () => {
    const wait = deferred<void>(), entered = deferred<void>(), c = client(), p = pool(async () => c.port);
    const connection = new PgConnection(configuration, "writer", p.port), cancellation = new AbortController();
    const jobs = Array.from({ length: 4 }, () => connection.transaction(async () => { entered.resolve(); await wait.promise; }, cancellation.signal).catch(error => error));
    await entered.promise;
    await new Promise<void>(resolve => { setImmediate(resolve); }); cancellation.abort(); await Promise.all(jobs);
    expect(connection.statistics().admitted).toBe(4);
    await expect(connection.transaction(async () => {})).rejects.toMatchObject({ code: "READ_BUSY" });
    wait.resolve(); await new Promise<void>(resolve => { setImmediate(resolve); });
    expect(connection.statistics().admitted).toBe(0); await connection.close();
  });
  it("classifies an unacknowledged COMMIT as unknown, destroys the client and does not retry", async () => {
    vi.useFakeTimers(); const c = client(), p = pool(async () => c.port), connection = new PgConnection(configuration, "writer", p.port);
    c.query.mockImplementation(async text => text === "COMMIT" ? new Promise(() => {}) : result());
    const operation = vi.fn(async () => "result"), job = connection.transaction(operation).catch(error => error);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await job).toMatchObject({ code: "POSTGRES_COMMIT_UNKNOWN" }); expect(c.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(operation).toHaveBeenCalledOnce(); expect(c.query.mock.calls.filter(call => call[0] === "COMMIT")).toHaveLength(1); await connection.close();
  });
  it("bounds non-cooperative pool shutdown and exposes no driver text", async () => {
    vi.useFakeTimers(); const p = pool(async () => client().port), connection = new PgConnection(configuration, "reader", p.port);
    p.end.mockImplementationOnce(() => new Promise(() => {})); const closing = connection.close().catch(error => error);
    await vi.advanceTimersByTimeAsync(5_001); expect(await closing).toMatchObject({ code: "POSTGRES_CLOSE_TIMEOUT" });
  });
  it("contains checked-out client errors, returns a coded failure and releases exactly once", async () => {
    const c = client(), p = pool(async () => c.port), connection = new PgConnection(configuration, "writer", p.port);
    await expect(connection.transaction(async sql => {
      c.events.emit("error", new Error("Synthetic untrusted driver failure")); await sql.query("SELECT 1");
    })).rejects.toMatchObject({ code: "POSTGRES_UNAVAILABLE" });
    expect(c.release).toHaveBeenCalledExactlyOnceWith(true); await connection.close();
  });
  it("retries only bounded transient acquisition failures and sanitizes unavailable outcomes", async () => {
    vi.useFakeTimers(); let failures = 0;
    const p = pool(async () => { failures++; throw Object.assign(new Error("Synthetic connection details"), { code: "ECONNREFUSED" }); });
    const connection = new PgConnection(configuration, "writer", p.port), job = connection.transaction(async () => {}).catch(error => error);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await job).toMatchObject({ code: "POSTGRES_UNAVAILABLE" }); expect(String(await job)).not.toContain("Synthetic connection details");
    expect(failures).toBe(2); await connection.close();
  });
});
