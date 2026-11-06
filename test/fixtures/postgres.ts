import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { Pool } from "pg";
import type { PoolConfig } from "pg";
import { PgConnection } from "../../src/storage/postgres/connection.js";
import { PostgresDatabase } from "../../src/storage/postgres/database.js";
import { applyPostgresMigrations } from "../../src/storage/postgres/migrations.js";
import { POSTGRES_CATALOG_FINGERPRINT } from "../../src/storage/postgres/catalog.js";

const execute = promisify(execFile);
export const PG_NAMESPACE = "phase10-fixture";
/** Full catalog with the administrator-owned synthetic clock function, including its body and grants-independent structure. */
export const PG_FIXTURE_CATALOG = "6243896b2824191f9c8fa63dda3fbdf0c050b0e4527a6eae7899078e9a59d3cb";

type Closeable = { close(): Promise<void> };
type Invoke = (name: string, args: string[]) => Promise<unknown>;

/** Owns only one mkdtemp-created fixture directory and its exact pg_ctl -D process. Cleanup is
 * idempotent; an uncertain/running server always prevents recursive directory removal. */
export class PostgresFixtureCleanup {
  readonly databases = new Set<Closeable>();
  private admin: Closeable | null = null;
  private startupAttempted = false;
  private serverStarted = false;
  private closing: Promise<void> | null = null;
  constructor(readonly directory: string, readonly data: string, private readonly invoke: Invoke,
    private readonly remove: (directory: string) => void = value => { rmSync(value, { recursive: true, force: true }); }) {
    const absolute = resolve(directory), base = resolve(join(tmpdir(), "opencode"));
    if (dirname(absolute) !== base || !basename(absolute).startsWith("watchdog-phase10-pg-")
      || resolve(data) !== resolve(join(absolute, "data"))) throw new Error("Unsafe PostgreSQL fixture cleanup path.");
  }
  setAdmin(admin: Closeable): void { this.admin = admin; }
  addDatabase(database: Closeable): void { this.databases.add(database); }
  startupBeginning(): void { this.startupAttempted = true; this.serverStarted = false; }
  startupCompleted(): void { this.serverStarted = true; }
  serverStopped(): void { this.serverStarted = false; }
  async closeDatabases(): Promise<void> {
    const databases = [...this.databases]; this.databases.clear();
    const outcomes = await Promise.allSettled(databases.map(database => database.close()));
    const failures = outcomes.filter(outcome => outcome.status === "rejected").map(outcome => outcome.reason);
    if (failures.length) throw new AggregateError(failures, "PostgreSQL fixture pool cleanup failed.");
  }
  close(): Promise<void> {
    this.closing ??= this.performClose();
    return this.closing;
  }
  private async performClose(): Promise<void> {
    const failures: unknown[] = [];
    try { await this.closeDatabases(); } catch (error) { failures.push(error); }
    const admin = this.admin; this.admin = null;
    if (admin) { try { await admin.close(); } catch (error) { failures.push(error); } }
    let safeToRemove = !this.startupAttempted;
    if (this.startupAttempted) {
      let running = this.serverStarted;
      if (!running) {
        try { await this.invoke("pg_ctl", ["-D", this.data, "status"]); running = true; this.serverStarted = true; }
        catch (error) {
          // pg_ctl status exit 3 means definitively not running. Other failures leave state uncertain.
          if (typeof error === "object" && error !== null && "code" in error && Number(error.code) === 3) safeToRemove = true;
          else failures.push(error);
        }
      }
      if (running) {
        try {
          await this.invoke("pg_ctl", ["-D", this.data, "-m", "immediate", "-w", "stop"]);
          this.serverStarted = false; safeToRemove = true;
        } catch (error) { failures.push(error); safeToRemove = false; }
      }
    }
    if (safeToRemove) { try { this.remove(this.directory); } catch (error) { failures.push(error); } }
    if (failures.length) throw new AggregateError(failures, "PostgreSQL fixture cleanup failed.");
  }
}

/** Keep the initiating error authoritative while making every cleanup failure inspectable. */
export async function rethrowAfterFixtureCleanup(error: unknown, cleanup: PostgresFixtureCleanup): Promise<never> {
  try { await cleanup.close(); }
  catch (cleanupError) {
    const aggregate = new AggregateError([error, cleanupError], error instanceof Error ? error.message : "PostgreSQL fixture initialization failed.");
    aggregate.cause = error; throw aggregate;
  }
  throw error;
}

/** Native disposable cluster only. Never accepts database URLs, secrets or an existing data directory. */
export async function localPostgresFixture() {
  const bin = process.env.WATCHDOG_PG_TEST_BIN;
  if (!bin) throw new Error("Native PostgreSQL integration unavailable: WATCHDOG_PG_TEST_BIN must name local PostgreSQL executables. No remote database is permitted.");
  const base = join(tmpdir(), "opencode"); mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(join(base, "watchdog-phase10-pg-")), data = join(directory, "data");
  const executable = (name: string) => join(bin, process.platform === "win32" ? `${name}.exe` : name);
  const environment: NodeJS.ProcessEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: directory, TMP: directory, LANG: "C", LC_ALL: "C" };
  // Native Windows startup can exceed 20 seconds under concurrent antivirus/disk load. This fixture-only process
  // allowance does not change any application cycle, job, lease, HTTP, query or connection timeout.
  const invoke = (name: string, args: string[]) => execute(executable(name), args, { env: environment, windowsHide: true, timeout: 75_000, maxBuffer: 1_048_576 });
  const cleanup = new PostgresFixtureCleanup(directory, data, invoke);
  try {
    const version = (await invoke("postgres", ["--version"])).stdout.trim();
    if (!/^postgres \(PostgreSQL\) 17\./.test(version)) throw new Error("Unqualified native PostgreSQL test major.");
    const probe = createServer();
    await new Promise<void>((resolveListen, reject) => {
      probe.once("error", reject); probe.listen(0, "127.0.0.1", () => { probe.removeListener("error", reject); resolveListen(); });
    });
    const address = probe.address();
    if (!address || typeof address === "string") throw new Error("Local port allocation failed.");
    const port = address.port; await new Promise<void>((resolveClose, reject) => {
      probe.close(error => { if (error) reject(error); else resolveClose(); });
    });
    await invoke("initdb", ["-D", data, "--username=watchdog_test_admin", "--auth-local=trust", "--auth-host=trust", "--encoding=UTF8", "--locale=C"]);
    cleanup.startupBeginning();
    await invoke("pg_ctl", ["-D", data, "-l", join(directory, "postgres.log"), "-w", "-t", "60", "-o", `-h 127.0.0.1 -p ${port} -c max_connections=16 -c shared_buffers=16MB`, "start"]);
    cleanup.startupCompleted();
    const configuration = (user: "watchdog_test_admin" | "watchdog_test_writer" | "watchdog_test_reader", database = "watchdog_phase10_fixture"): PoolConfig => ({
      host: "127.0.0.1", port, database, user, password: async () => "", ssl: false, sslnegotiation: "postgres",
      application_name: "watchdog-phase10-fixture", client_encoding: "UTF8", options: "-c search_path=pg_catalog",
      connectionTimeoutMillis: 5_000, max: 1, idleTimeoutMillis: 5_000
    });
    const setup = new Pool(configuration("watchdog_test_admin", "postgres"));
    let setupFailure: unknown;
    try {
      await setup.query("CREATE DATABASE watchdog_phase10_fixture");
      await setup.query("CREATE ROLE watchdog_test_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS");
      await setup.query("CREATE ROLE watchdog_test_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS");
    } catch (error) { setupFailure = error; }
    try { await setup.end(); }
    catch (error) {
      if (setupFailure) {
        const aggregate = new AggregateError([setupFailure, error], setupFailure instanceof Error ? setupFailure.message : "PostgreSQL fixture setup failed.");
        aggregate.cause = setupFailure; throw aggregate;
      }
      throw error;
    }
    if (setupFailure) throw setupFailure;
    const admin = new PgConnection(configuration("watchdog_test_admin"), "writer");
    cleanup.setAdmin(admin);
    await admin.transaction(sql => sql.query("CREATE TABLE public.phase10_clock(id integer PRIMARY KEY,instant timestamptz NOT NULL)"));
    let catalog = PG_FIXTURE_CATALOG;
    const database = () => {
      const db = new PostgresDatabase(new PgConnection(configuration("watchdog_test_writer"), "writer"), new PgConnection(configuration("watchdog_test_reader"), "reader"), PG_NAMESPACE, catalog);
      cleanup.addDatabase(db); return db;
    };
    const reset = async () => {
      try {
        await cleanup.closeDatabases();
        await admin.transaction(sql => sql.query("DROP SCHEMA IF EXISTS watchdog_pg CASCADE"));
        await applyPostgresMigrations(admin, PG_NAMESPACE);
        // Test-only controlled database time. Production clock_now is exactly clock_timestamp().
        // The runtime roles cannot replace this function or write the fixture clock.
        await admin.transaction(async sql => {
          await sql.query("INSERT INTO public.phase10_clock(id,instant) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET instant=excluded.instant", ["2026-11-02T12:07:30.000Z"]);
          await sql.query("CREATE OR REPLACE FUNCTION watchdog_pg.clock_now() RETURNS timestamptz VOLATILE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT instant FROM public.phase10_clock WHERE id=1 $$");
        });
        catalog = PG_FIXTURE_CATALOG;
        await admin.transaction(async sql => {
          await sql.query("GRANT USAGE ON SCHEMA watchdog_pg TO watchdog_test_reader,watchdog_test_writer; GRANT SELECT ON ALL TABLES IN SCHEMA watchdog_pg TO watchdog_test_reader,watchdog_test_writer; GRANT USAGE ON ALL SEQUENCES IN SCHEMA watchdog_pg TO watchdog_test_writer");
          await sql.query(`GRANT INSERT,UPDATE,DELETE ON watchdog_pg.streams,watchdog_pg.cycles,watchdog_pg.fingerprints,watchdog_pg.alerts,
            watchdog_pg.deliveries,watchdog_pg.delivery_attempts,watchdog_pg.delivery_events,watchdog_pg.provider_limits,watchdog_pg.oracle_assurance,
            watchdog_pg.worker_runtime,watchdog_pg.operational_events,watchdog_pg.scheduled_executions TO watchdog_test_writer;
            GRANT UPDATE ON watchdog_pg.worker_lease TO watchdog_test_writer`);
        });
      } catch (error) { return rethrowAfterFixtureCleanup(error, cleanup); }
    };
    const close = () => cleanup.close();
    const guard = async <T>(operation: () => Promise<T>): Promise<T> => {
      try { return await operation(); } catch (error) { return rethrowAfterFixtureCleanup(error, cleanup); }
    };
    const clock = (instant: string) => guard(() => admin.transaction(sql => sql.query("UPDATE public.phase10_clock SET instant=$1", [instant])));
    const productionClock = async () => {
      await guard(() => admin.transaction(sql => sql.query("CREATE OR REPLACE FUNCTION watchdog_pg.clock_now() RETURNS timestamptz VOLATILE LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT clock_timestamp() $$")));
      catalog = POSTGRES_CATALOG_FINGERPRINT;
    };
    const restart = async (mode: "fast" | "immediate" = "fast") => {
      await guard(async () => {
        await invoke("pg_ctl", ["-D", data, "-m", mode, "-w", "stop"]); cleanup.serverStopped();
        cleanup.startupBeginning();
        await invoke("pg_ctl", ["-D", data, "-l", join(directory, "postgres.log"), "-w", "-t", "60", "-o", `-h 127.0.0.1 -p ${port} -c max_connections=16 -c shared_buffers=16MB`, "start"]);
        cleanup.startupCompleted();
      });
    };
    return { admin, database, configuration, reset, close, directory, port, version, invoke, data, clock, productionClock, restart };
  } catch (error) { return rethrowAfterFixtureCleanup(error, cleanup); }
}
export type LocalPostgresFixture = Awaited<ReturnType<typeof localPostgresFixture>>;
