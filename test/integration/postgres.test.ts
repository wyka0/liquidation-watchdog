import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parseMonitoringConfiguration } from "../../src/config/monitoring.js";
import { parseThresholds } from "../../src/config/risk.js";
import { DataError } from "../../src/domain/errors.js";
import { initialState, monitoringScope } from "../../src/monitoring/model.js";
import type { Observation } from "../../src/monitoring/model.js";
import { MonitoringService } from "../../src/monitoring/service.js";
import { observe } from "../../src/monitoring/observation.js";
import { transition } from "../../src/monitoring/transitions.js";
import { AsyncPersistedReadModel } from "../../src/runtime/read-model.js";
import { SchedulerRunner } from "../../src/runtime/scheduler.js";
import { textHash } from "../../src/storage/postgres/codec.js";
import { PgConnection } from "../../src/storage/postgres/connection.js";
import { PostgresDatabase } from "../../src/storage/postgres/database.js";
import type { Fence } from "../../src/storage/postgres/database.js";
import { PostgresSchedulerStore } from "../../src/storage/postgres/scheduler-store.js";
import { PostgresMonitorStore } from "../../src/storage/postgres/store.js";
import { applyPostgresMigrations, POSTGRES_MIGRATIONS } from "../../src/storage/postgres/migrations.js";
import { localPostgresFixture, PG_FIXTURE_CATALOG, PG_NAMESPACE } from "../fixtures/postgres.js";
import type { LocalPostgresFixture } from "../fixtures/postgres.js";
import { MONITOR_CONFIG, MONITOR_POSITION, MONITOR_SCOPE, MONITOR_THRESHOLDS, monitoringFixture, riskFixture, testClock } from "../fixtures/phase4.js";
import { demoPositionConfiguration } from "../../src/config/position.js";

let cluster: LocalPostgresFixture;
let observation: Observation;
const SLOT = "2026-11-02T12:05:00.000Z", NEXT_SLOT = "2026-11-02T12:10:00.000Z", SLOT_PERIOD = 300;
beforeAll(async () => { cluster = await localPostgresFixture(); observation = await monitoringFixture(); });
beforeEach(async () => { await cluster.reset(); });
afterAll(async () => { await cluster?.close(); });

async function own(slot = SLOT, db = cluster.database(), limits = MONITOR_CONFIG.resources) {
  const scheduler = new PostgresSchedulerStore(db, MONITOR_SCOPE, SLOT_PERIOD), admission = await scheduler.admit(slot);
  expect(admission.kind).toBe("ACQUIRED"); if (admission.kind !== "ACQUIRED") throw new Error("Fixture admission failed");
  const fence = admission.fence, store = new PostgresMonitorStore(db, fence, limits); await store.acquireMonitor();
  return { db, scheduler, fence, store };
}
type Owned = Awaited<ReturnType<typeof own>>;
async function persist(h: Owned, input: Observation = observation, finish = true) {
  const current = { ...input, cycleId: h.fence.cycleId }, previous = await h.store.state(MONITOR_SCOPE);
  const next = transition(previous, current, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
  await h.store.beginCycle(current.cycleId, MONITOR_SCOPE, current.observedAt);
  const alerts = await h.store.commitObservation(MONITOR_SCOPE, current, previous.revision, next.state, next.alerts, ["console"]);
  if (finish) await h.store.finishCycle(current.cycleId, current.observedAt);
  return { current, alerts, state: next.state };
}
async function sqlFailure(text: string, values: unknown[], state: string) {
  let code: unknown;
  await expect(cluster.admin.transaction(async sql => {
    try { await sql.query(text, values); }
    catch (error) { if (error instanceof Error && "code" in error) code = error.code; throw error; }
  })).rejects.toMatchObject({ code: "STORE_TRANSACTION_FAILED" });
  expect(code).toBe(state);
}
/** Captures an exception that is thrown synchronously instead of through a rejected promise. */
function captureThrow<T>(attempt: () => T): unknown {
  try { return attempt(); } catch (error) { return error; }
}

describe("PHASE10 NATIVE POSTGRESQL: isolated schema and migration contracts", () => {
  it("creates the complete separate schema on native PostgreSQL and migrates idempotently", async () => {
    await cluster.productionClock();
    const original = await cluster.admin.transaction(sql => sql.query("SELECT * FROM watchdog_pg.schema_migrations ORDER BY version"));
    await applyPostgresMigrations(cluster.admin, PG_NAMESPACE);
    expect((await cluster.admin.transaction(sql => sql.query("SELECT * FROM watchdog_pg.schema_migrations ORDER BY version"))).rows).toEqual(original.rows);
    expect(original.rows.map(row => row.version)).toEqual(POSTGRES_MIGRATIONS.map(item => item.version));
    const tables = await cluster.admin.transaction(sql => sql.query("SELECT tablename FROM pg_tables WHERE schemaname='watchdog_pg' ORDER BY tablename"));
    expect(tables.rows).toHaveLength(15);
    const db = cluster.database(); expect((await db.readSnapshot("a".repeat(64))).state.revision).toBe(0);
  });
  it.each(["checksum", "gap", "future"])("refuses a %s migration lineage without repairing it", async kind => {
    await cluster.admin.transaction(sql => sql.query(kind === "checksum" ? "UPDATE watchdog_pg.schema_migrations SET checksum=repeat('0',64) WHERE version=1"
      : kind === "gap" ? "DELETE FROM watchdog_pg.schema_migrations WHERE version=1" : "INSERT INTO watchdog_pg.schema_migrations(version,checksum) VALUES(99,repeat('0',64))"));
    const before = (await cluster.admin.transaction(sql => sql.query("SELECT * FROM watchdog_pg.schema_migrations ORDER BY version"))).rows;
    await expect(applyPostgresMigrations(cluster.admin, PG_NAMESPACE)).rejects.toMatchObject({ code: "STORE_SCHEMA_VERSION" });
    expect((await cluster.admin.transaction(sql => sql.query("SELECT * FROM watchdog_pg.schema_migrations ORDER BY version"))).rows).toEqual(before);
  });
  it("rolls back failed SQL and makes the same connection reusable", async () => {
    await expect(cluster.admin.transaction(async sql => {
      await sql.query("INSERT INTO watchdog_pg.fingerprints(fingerprint,created_at) VALUES($1,$2)", ["a".repeat(64), SLOT]);
      await sql.query("SELECT 1/0");
    })).rejects.toMatchObject({ code: "STORE_TRANSACTION_FAILED" });
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.fingerprints"))).rows[0]!.count).toBe("0");
  });
  it("binds hostile values as data and preserves the schema", async () => {
    const payload = "x'; DROP SCHEMA watchdog_pg CASCADE; --";
    expect((await cluster.admin.transaction(sql => sql.query("SELECT $1::text AS value", [payload]))).rows[0]!.value).toBe(payload);
    expect((await cluster.database().readSnapshot(MONITOR_SCOPE)).state.revision).toBe(0);
  });
  it.each(["0", "9007199254740993", "115792089237316195423570985008687907853269984665640564039457584007913129639935", "9".repeat(78)])("round-trips exact decimal TEXT %s", async value => {
    const row = (await cluster.admin.transaction(sql => sql.query("SELECT $1::watchdog_pg.uint_text AS exact,$1::numeric::text AS numeric_exact", [value]))).rows[0]!;
    expect(row).toEqual({ exact: value, numeric_exact: value }); expect(BigInt(row.exact as string)).toBe(BigInt(value));
  });
  it.each(["01", "-1", "1.1", "1e18", "9".repeat(79)])("rejects noncanonical/out-of-range decimal representation %s", async value => {
    await sqlFailure("SELECT $1::watchdog_pg.uint_text", [value], "23514");
  });
  it("preserves original six-digit UTC text and exposes an exact microsecond timestamp projection", async () => {
    const value = "2026-11-02T12:07:00.123456Z";
    const row = (await cluster.admin.transaction(sql => sql.query("SELECT $1::watchdog_pg.utc_text AS original,to_char(watchdog_pg.utc_value($1) AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS projected", [value]))).rows[0]!;
    expect(row).toEqual({ original: value, projected: value });
  });
  it("allows absent optional timestamps while enforcing required cycle timestamps", async () => {
    expect((await cluster.admin.transaction(sql => sql.query("SELECT NULL::watchdog_pg.utc_text AS absent"))).rows[0]!.absent).toBeNull();
    await sqlFailure("INSERT INTO watchdog_pg.cycles(id,scope,started_at,status) VALUES('required_time',$1,NULL,'RUNNING')", [MONITOR_SCOPE], "23502");
    const h = await own();
    expect((await h.db.readSnapshot(MONITOR_SCOPE)).latestCycle).toMatchObject({ id: h.fence.cycleId, status: "RUNNING", completed_at: null });
  });
  it.each(["2026-11-02T12:07:00.1234567Z", "2026-11-02T12:07:00+00:00"])("refuses lossy/non-UTC timestamp %s", async value => {
    await sqlFailure("SELECT $1::watchdog_pg.utc_text", [value], "23514");
  });
  it("enforces primary key, foreign key, channel uniqueness, actionability and counter constraints", async () => {
    const h = await own(), saved = await persist(h), delivery = (await h.store.due(testClock().toISOString(), ["console"], 1))[0]!;
    await sqlFailure("INSERT INTO watchdog_pg.deliveries(id,alert_id,channel,status,next_at) VALUES($1,$2,'console','PENDING',$3)", ["duplicate_channel", saved.alerts[0]!.id, SLOT], "23505");
    await sqlFailure("INSERT INTO watchdog_pg.deliveries(id,alert_id,channel,status,next_at) VALUES($1,'absent','console','PENDING',$2)", ["orphan", SLOT], "23503");
    await sqlFailure("UPDATE watchdog_pg.cycles SET actionable=1 WHERE id=$1", [h.fence.cycleId], "23514");
    await sqlFailure("UPDATE watchdog_pg.deliveries SET attempts=11 WHERE id=$1", [delivery.id], "23514");
    await sqlFailure("UPDATE watchdog_pg.streams SET revision=9007199254740992 WHERE scope=$1", [MONITOR_SCOPE], "23514");
    await sqlFailure("INSERT INTO watchdog_pg.fingerprints(fingerprint,created_at) VALUES($1,$2)", [saved.alerts[0]!.fingerprint, SLOT], "23505");
  });
  it("rejects namespace mismatches and runtime DDL/migration mutation privileges", async () => {
    await expect(applyPostgresMigrations(cluster.admin, "wrong-namespace")).rejects.toMatchObject({ code: "POSTGRES_IDENTITY" });
    const db = cluster.database();
    await expect(db.writer.transaction(sql => sql.query("UPDATE watchdog_pg.schema_migrations SET checksum=repeat('0',64)"))).rejects.toMatchObject({ code: "STORE_TRANSACTION_FAILED" });
    await expect(db.writer.transaction(sql => sql.query("CREATE TABLE watchdog_pg.forbidden(id integer)"))).rejects.toMatchObject({ code: "STORE_TRANSACTION_FAILED" });
    await expect(db.reader.transaction(sql => sql.query("DELETE FROM watchdog_pg.fingerprints"))).rejects.toMatchObject({ code: "STORE_TRANSACTION_FAILED" });
  });
});

describe("PHASE10 NATIVE POSTGRESQL: global ownership, slots and atomic persistence", () => {
  it("admits only one of two simultaneous requests, prevents overlap and publishes the original durable receipt", async () => {
    const a = new PostgresSchedulerStore(cluster.database(), MONITOR_SCOPE, SLOT_PERIOD), b = new PostgresSchedulerStore(cluster.database(), MONITOR_SCOPE, SLOT_PERIOD);
    const results = await Promise.all([a.admit(SLOT), b.admit(SLOT)]);
    expect(results.map(result => result.kind).sort()).toEqual(["ACQUIRED", "IN_PROGRESS"]);
    const admitted = results.find(result => result.kind === "ACQUIRED")!; if (admitted.kind !== "ACQUIRED") throw new Error();
    const receipt = await a.finish(admitted.fence, { accepted: false, error: "CYCLE_FAILED" });
    expect(await b.admit(SLOT)).toEqual({ kind: "RECEIPT", receipt });
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.cycles"))).rows[0]!.count).toBe("1");
  });
  it("rejects future and missing expired slots, but permits receipt-only late retries", async () => {
    const h = await own(); await persist(h);
    const receipt = await h.scheduler.finish(h.fence, { accepted: true, error: null });
    expect(await h.scheduler.admit(NEXT_SLOT)).toEqual({ kind: "SLOT_REFUSED" });
    await cluster.clock("2026-11-02T13:10:00.000Z");
    expect(await h.scheduler.admit(SLOT)).toEqual({ kind: "RECEIPT", receipt });
    expect(await h.scheduler.admit(NEXT_SLOT)).toEqual({ kind: "SLOT_REFUSED" });
  });
  it("counts missed five-minute slots without inventing observations or catch-up cycles", async () => {
    const first = await own();
    await first.scheduler.finish(first.fence, { accepted: false, error: "CYCLE_FAILED" });
    await cluster.clock("2026-11-02T12:26:00.000Z");
    const current = await own("2026-11-02T12:25:00.000Z");
    expect(current.fence.missedSlots).toBe(3);
    const snapshot = await current.db.readSnapshot(MONITOR_SCOPE, { kind: "observations", limit: 100 });
    expect(snapshot.state.revision).toBe(0);
    expect(snapshot.observations).toEqual([]);
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.cycles"))).rows[0]!.count).toBe("2");
  });
  it("enforces admission boundary using database time even after host-clock skew", async () => {
    await cluster.clock("2026-11-02T12:15:00.000001Z");
    const scheduler = new PostgresSchedulerStore(cluster.database(), MONITOR_SCOPE, SLOT_PERIOD);
    expect(await scheduler.admit(SLOT)).toEqual({ kind: "SLOT_REFUSED" });
    await cluster.clock("2026-11-02T12:15:00.000000Z");
    expect((await scheduler.admit(SLOT)).kind).toBe("ACQUIRED");
  });
  it("prevents replay after receipt pruning and database clock rollback using the high-water mark", async () => {
    const h = await own(); await h.scheduler.finish(h.fence, { accepted: false, error: "CYCLE_FAILED" });
    await cluster.admin.transaction(sql => sql.query("DELETE FROM watchdog_pg.cycles WHERE id=$1", [h.fence.cycleId]));
    await cluster.clock("2026-11-02T12:07:10.000Z");
    expect(await h.scheduler.admit(SLOT)).toEqual({ kind: "SLOT_REFUSED" });
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.cycles"))).rows[0]!.count).toBe("0");
  });
  it("recovers an expired global owner, records missed slots and rejects its late writes/releases", async () => {
    const old = await own();
    await cluster.clock("2026-11-02T13:07:30.000Z");
    const next = await own("2026-11-02T13:05:00.000Z");
    expect(BigInt(next.fence.fence)).toBeGreaterThan(BigInt(old.fence.fence)); expect(next.fence.missedSlots).toBe(11);
    await expect(old.store.state(MONITOR_SCOPE)).rejects.toMatchObject({ code: "POSTGRES_FENCE_LOST" });
    await expect(old.scheduler.finish(old.fence, { accepted: true, error: null })).rejects.toMatchObject({ code: "POSTGRES_FENCE_LOST" });
    expect(await next.scheduler.admit(SLOT)).toMatchObject({ kind: "RECEIPT", receipt: { status: "INTERRUPTED", error: "PROCESS_INTERRUPTED" } });
    expect(await next.store.state(MONITOR_SCOPE)).toEqual(initialState());
  });
  it("refuses new work after the 300-second job budget and never calls an expired owner IN_PROGRESS", async () => {
    const h = await own(); await cluster.clock("2026-11-02T12:12:30.001Z");
    await expect(h.store.state(MONITOR_SCOPE)).rejects.toMatchObject({ code: "POSTGRES_FENCE_LOST" });
    expect(await h.scheduler.admit(SLOT)).toEqual({ kind: "OUTCOME_UNKNOWN" });
    expect((await h.scheduler.finish(h.fence, { accepted: false, error: "JOB_TIMEOUT" })).status).toBe("FAILED");
  });
  it("rejects old-incarnation writers after an isolated restore-style identity rotation", async () => {
    const h = await own(), incarnation = randomUUID();
    await cluster.admin.transaction(async sql => {
      await sql.query("UPDATE watchdog_pg.database_identity SET incarnation=$1 WHERE id=1", [incarnation]);
      await sql.query("UPDATE watchdog_pg.worker_lease SET incarnation=$1 WHERE id=1", [incarnation]);
    });
    await expect(h.store.state(MONITOR_SCOPE)).rejects.toMatchObject({ code: "POSTGRES_FENCE_LOST" });
  });
  it("atomically persists state, exact risk, assurance hashes, fingerprints, alerts and outbox", async () => {
    const h = await own(), saved = await persist(h), snapshot = await h.db.readSnapshot(MONITOR_SCOPE, { kind: "alerts", limit: 100 });
    expect(snapshot.state).toEqual(saved.state); expect(snapshot.alerts.length).toBeGreaterThan(0);
    expect(snapshot.deliveries).toHaveLength(saved.alerts.length);
    expect(snapshot.alerts.every(alert => alert.suggestedAction.origin === "GENERATED" && alert.suggestedAction.actionable === false)).toBe(true);
    expect(snapshot.alerts.map(alert => alert.suggestedAction)).toEqual(saved.alerts.slice().reverse().map(alert => alert.suggestedAction));
    expect(snapshot.state.latest?.risk).toMatchObject({ actionable: false, oracleVerification: "UNVERIFIED", heartbeat: "UNKNOWN",
      safetyRatio: observation.risk.safetyRatio, debtAmount: observation.risk.debtAmount, repayment: observation.risk.repayment });
    const bytes = (await cluster.admin.transaction(sql => sql.query("SELECT observation_json,observation_sha256 FROM watchdog_pg.cycles WHERE id=$1", [h.fence.cycleId]))).rows[0]!;
    expect(bytes.observation_json).toBe(JSON.stringify(saved.current)); expect(bytes.observation_sha256).toBe(textHash(JSON.stringify(saved.current)));
    expect((await h.store.latestOracleAssurance("FIXTURE"))?.assurance).toEqual(saved.current.assurance);
  });
  it("rolls back observation, revision, fingerprints, assurance, alerts and outbox on backlog overflow", async () => {
    const h = await own(SLOT, cluster.database(), { ...MONITOR_CONFIG.resources, pendingDeliveries: 1 });
    await expect(persist(h)).rejects.toMatchObject({ code: "RESOURCE_BACKLOG_LIMIT" });
    expect(await h.store.state(MONITOR_SCOPE)).toEqual(initialState());
    for (const table of ["alerts", "fingerprints", "deliveries", "oracle_assurance"] as const) {
      const statement = { alerts: "SELECT count(*)::text AS count FROM watchdog_pg.alerts", fingerprints: "SELECT count(*)::text AS count FROM watchdog_pg.fingerprints",
        deliveries: "SELECT count(*)::text AS count FROM watchdog_pg.deliveries", oracle_assurance: "SELECT count(*)::text AS count FROM watchdog_pg.oracle_assurance" }[table];
      expect((await cluster.admin.transaction(sql => sql.query(statement))).rows[0]!.count).toBe("0");
    }
    expect((await h.db.readSnapshot(MONITOR_SCOPE)).latestCycle?.status).toBe("RUNNING");
  });
  it("serializes competing state transitions and never creates duplicate alert channels", async () => {
    const h = await own(), current = { ...observation, cycleId: h.fence.cycleId }, next = transition(initialState(), current, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    const commit = () => h.store.commitObservation(MONITOR_SCOPE, current, 0, next.state, [...next.alerts, ...next.alerts], ["console", "console"]);
    const results = await Promise.allSettled([commit(), commit()]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { code: "STORE_REVISION_CONFLICT" } });
    const snapshot = await h.db.readSnapshot(MONITOR_SCOPE, { kind: "alerts", limit: 100 });
    expect(snapshot.state.revision).toBe(1); expect(snapshot.alerts).toHaveLength(next.alerts.length); expect(snapshot.deliveries).toHaveLength(next.alerts.length);
  });
  it("reconciles a lost observation commit acknowledgment without replaying the transaction", async () => {
    const h = await own(), current = { ...observation, cycleId: h.fence.cycleId }, next = transition(initialState(), current, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    const original = h.db.writer.transaction.bind(h.db.writer);
    vi.spyOn(h.db.writer, "transaction").mockImplementationOnce(async operation => { await original(operation); throw new DataError("POSTGRES_COMMIT_UNKNOWN", "Synthetic lost acknowledgment"); });
    const alerts = await h.store.commitObservation(MONITOR_SCOPE, current, 0, next.state, next.alerts, ["console"]);
    expect(alerts).toEqual(next.alerts); expect((await h.store.state(MONITOR_SCOPE)).revision).toBe(1);
    expect((await h.db.readSnapshot(MONITOR_SCOPE, { kind: "alerts", limit: 100 })).deliveries).toHaveLength(next.alerts.length);
  });
  it("never executes a lost admission acknowledgment and resolves the durable identity on retry", async () => {
    const db = cluster.database(), scheduler = new PostgresSchedulerStore(db, MONITOR_SCOPE, SLOT_PERIOD), original = db.writer.transaction.bind(db.writer);
    vi.spyOn(db.writer, "transaction").mockImplementationOnce(async operation => { await original(operation); throw new DataError("POSTGRES_COMMIT_UNKNOWN", "Synthetic lost acknowledgment"); });
    expect(await scheduler.admit(SLOT)).toEqual({ kind: "OUTCOME_UNKNOWN" });
    expect((await scheduler.admit(SLOT)).kind).toBe("IN_PROGRESS");
    expect((await db.readSnapshot(MONITOR_SCOPE)).state.revision).toBe(0);
  });
});

describe("PHASE10 NATIVE POSTGRESQL: outbox, API snapshots and driver failures", () => {
  it("claims concurrently once, preserves retry history, and never retries a known delivery", async () => {
    const h = await own(); await persist(h);
    const due = (await h.store.due(testClock().toISOString(), ["console"], 1))[0]!;
    const attempts = await Promise.allSettled([h.store.startAttempt(due.id, testClock().toISOString()), h.store.startAttempt(due.id, testClock().toISOString())]);
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await h.store.finishAttempt(due.id, { delivered: false, code: "PROVIDER_HTTP_ERROR", retryable: true, ambiguous: false, retryAfterMs: null }, testClock().toISOString(), testClock().toISOString())).toBe("RETRY_SCHEDULED");
    expect((await h.store.startAttempt(due.id, testClock().toISOString())).attempts).toBe(2);
    await h.store.finishAttempt(due.id, { delivered: true }, testClock().toISOString(), null);
    expect((await h.store.due(testClock().toISOString(), ["console"])).some(item => item.id === due.id)).toBe(false);
    const history = (await cluster.admin.transaction(sql => sql.query("SELECT attempt,outcome,ambiguous FROM watchdog_pg.delivery_attempts WHERE delivery_id=$1 ORDER BY attempt", [due.id]))).rows;
    expect(history).toEqual([{ attempt: 1, outcome: "FAILED", ambiguous: 0 }, { attempt: 2, outcome: "DELIVERED", ambiguous: 0 }]);
    expect((await h.db.readSnapshot(MONITOR_SCOPE, { kind: "alerts", limit: 100 })).deliveries.find(item => item.id === due.id)).toMatchObject({ status: "DELIVERED", attempts: 2, ambiguous: 0 });
  });
  it("honors whole-provider cooldown and permanent blocking without shortening Retry-After", async () => {
    const h = await own(); await persist(h);
    const due = (await h.store.due(testClock().toISOString(), ["console"], 1))[0]!;
    await h.store.startAttempt(due.id, testClock().toISOString());
    await h.store.finishAttempt(due.id, { delivered: false, code: "PROVIDER_RATE_LIMIT", retryable: false, ambiguous: false, retryAfterMs: null }, testClock().toISOString(), null);
    expect(await h.store.due("2027-11-01T00:00:00.000Z", ["console"])).toEqual([]);
    expect(await h.store.nextDeliveryAt(["console"])).toBeNull();
    expect((await cluster.admin.transaction(sql => sql.query("SELECT blocked FROM watchdog_pg.provider_limits WHERE channel='console'"))).rows[0]!.blocked).toBe(1);
  });
  it("recovers only stale claims, keeps ambiguity sticky and rejects old acknowledgments", async () => {
    const old = await own(); await persist(old);
    const due = (await old.store.due(testClock().toISOString(), ["console"], 1))[0]!; await old.store.startAttempt(due.id, testClock().toISOString());
    expect(await old.store.recoverDeliveries(testClock().toISOString(), 5)).toBe(0);
    await cluster.clock("2026-11-02T12:16:30.000Z"); const next = await own(NEXT_SLOT);
    expect(await next.store.recoverDeliveries(testClock().toISOString(), 5)).toBe(1);
    await expect(old.store.finishAttempt(due.id, { delivered: true }, testClock().toISOString(), null)).rejects.toMatchObject({ code: "POSTGRES_FENCE_LOST" });
    await expect(next.store.startAttempt(due.id, testClock().toISOString())).rejects.toMatchObject({ code: "DELIVERY_CONFLICT" });
    expect((await next.db.readSnapshot(MONITOR_SCOPE, { kind: "alerts", limit: 100 })).deliveries.find(item => item.id === due.id)).toMatchObject({ ambiguous: 1, status: "PERMANENTLY_FAILED" });
  });
  it("refuses a send without acknowledgment headroom and refuses expired claims", async () => {
    const h = await own(); await persist(h);
    const due = (await h.store.due(testClock().toISOString(), ["console"], 1))[0]!; await h.store.startAttempt(due.id, testClock().toISOString());
    await cluster.clock("2026-11-02T12:07:51.000Z");
    await expect(h.store.finishAttempt(due.id, { delivered: true }, testClock().toISOString(), null)).rejects.toMatchObject({ code: "DELIVERY_CONFLICT" });
    await h.store.recoverDeliveries(testClock().toISOString(), 5); await cluster.clock("2026-11-02T12:12:11.000Z");
    await expect(h.store.startAttempt(due.id, testClock().toISOString())).rejects.toMatchObject({ code: "DELIVERY_CONFLICT" });
  });
  it("reconciles an acknowledgment committed before its response was lost", async () => {
    const h = await own(); await persist(h); const due = (await h.store.due(testClock().toISOString(), ["console"], 1))[0]!;
    await h.store.startAttempt(due.id, testClock().toISOString());
    const original = h.db.writer.transaction.bind(h.db.writer);
    vi.spyOn(h.db.writer, "transaction").mockImplementationOnce(async operation => { await original(operation); throw new DataError("POSTGRES_COMMIT_UNKNOWN", "Synthetic lost acknowledgment"); });
    expect(await h.store.finishAttempt(due.id, { delivered: true }, testClock().toISOString(), null)).toBe("DELIVERED");
    expect((await h.store.due(testClock().toISOString(), ["console"])).some(item => item.id === due.id)).toBe(false);
  });
  it("preserves exact bigint cursors beyond Number.MAX_SAFE_INTEGER and original observation bytes", async () => {
    const h = await own(); await persist(h);
    await cluster.admin.transaction(sql => sql.query("UPDATE watchdog_pg.cycles SET stable_seq=9007199254740993 WHERE id=$1", [h.fence.cycleId]));
    const row = await h.db.readSnapshot(MONITOR_SCOPE, { kind: "observations", limit: 1, before: "9007199254740994" });
    expect(row.observations[0]?.cycleId).toBe(h.fence.cycleId);
    expect((await h.db.readSnapshot(MONITOR_SCOPE, { kind: "observations", limit: 1, before: "9007199254740993" })).observations).toEqual([]);
    await expect(h.db.readSnapshot(MONITOR_SCOPE, { kind: "observations", limit: 1, before: "9223372036854775808" })).rejects.toMatchObject({ code: "READ_PAGE" });
  });
  it("keeps read snapshots coherent across an uncommitted writer transaction", async () => {
    const h = await own(); await persist(h);
    await cluster.admin.transaction(async sql => {
      await sql.query("UPDATE watchdog_pg.streams SET revision=2 WHERE scope=$1", [MONITOR_SCOPE]);
      expect((await h.db.readSnapshot(MONITOR_SCOPE)).state.revision).toBe(1);
      throw new DataError("SYNTHETIC_ROLLBACK", "Fixture rollback");
    }).catch(error => { expect(error).toMatchObject({ code: "SYNTHETIC_ROLLBACK" }); });
    expect((await h.db.readSnapshot(MONITOR_SCOPE)).state.revision).toBe(1);
  });
  it("shows 601-second-old observations as stale, with UNKNOWN freshness and non-actionable exact estimates", async () => {
    const h = await own(), saved = await persist(h), configuration = parseMonitoringConfiguration({ monitoring: { enabled: true, intervalSeconds: SLOT_PERIOD } });
    const api = new AsyncPersistedReadModel(h.db, configuration, () => "RUNNING", MONITOR_THRESHOLDS, MONITOR_POSITION, SLOT_PERIOD, () => new Date(testClock().getTime() + 601_000));
    expect((await api.read("/api/risk")).body).toMatchObject({ meta: { stale: true, safety: { oracleAssurance: "UNVERIFIED", freshness: "UNKNOWN", actionable: false } },
      latest: { risk: { actionable: false, safetyRatio: saved.current.risk.safetyRatio, debtAmount: saved.current.risk.debtAmount } } });
    expect((await api.read("/api/readiness")).status).toBe(503);
    expect((await api.read("/api/monitoring/status")).body).toMatchObject({ cadence: null, schedule: { mode: "EXTERNAL_UTC_SLOTS", periodSeconds: 300,
      utcMinutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] } });
    expect(JSON.stringify((await api.read("/api/risk")).body)).not.toMatch(/"(?:password|scope|pid|rssBytes|configuration|owner|incarnation)"/);
  });
  it("serves exactly the injected threshold stream: custom-scope data is visible to its own read model and invisible to the default one", async () => {
    const custom = parseThresholds({ warningRatio: "1.5", criticalRatio: "1.2", targetRatio: "1.4" }), scope = monitoringScope(custom), db = cluster.database();
    const scheduler = new PostgresSchedulerStore(db, scope, SLOT_PERIOD), admission = await scheduler.admit(SLOT);
    expect(admission.kind).toBe("ACQUIRED"); if (admission.kind !== "ACQUIRED") throw new Error("Fixture admission failed");
    const store = new PostgresMonitorStore(db, admission.fence, MONITOR_CONFIG.resources);
    try {
      await store.acquireMonitor();
      const observation = observe(await riskFixture(), admission.fence.cycleId, testClock(), custom, { allowFixture: true });
      const previous = await store.state(scope), next = transition(previous, observation, MONITOR_CONFIG.monitoring, scope);
      await store.beginCycle(observation.cycleId, scope, observation.observedAt);
      await store.commitObservation(scope, observation, previous.revision, next.state, next.alerts, ["console"]);
      await store.finishCycle(observation.cycleId, observation.observedAt);
      const configuration = parseMonitoringConfiguration({ monitoring: { enabled: true, intervalSeconds: SLOT_PERIOD } });
      const customApi = new AsyncPersistedReadModel(db, configuration, () => "RUNNING", custom, demoPositionConfiguration(custom), SLOT_PERIOD, testClock);
      const defaultApi = new AsyncPersistedReadModel(db, configuration, () => "RUNNING", MONITOR_THRESHOLDS, MONITOR_POSITION, SLOT_PERIOD, testClock);
      const served = await customApi.read("/api/risk");
      expect(served).toMatchObject({ status: 200, body: { latest: { cycleId: admission.fence.cycleId, risk: { thresholds: custom.decimal } } } });
      expect((await defaultApi.read("/api/risk")).body).toMatchObject({ latest: null, lastAccepted: null, meta: { stale: true } });
      expect((await defaultApi.read("/api/readiness")).body).toMatchObject({ ready: false, reasons: expect.arrayContaining(["NO_ACCEPTED_OBSERVATION", "OBSERVATION_STALE"]) });
      expect(((await customApi.read("/api/readiness")).body as { reasons: string[] }).reasons).not.toContain("NO_ACCEPTED_OBSERVATION");
    } finally {
      await scheduler.finish(admission.fence, { accepted: true, error: null });
      await store.close();
    }
  });
  it("detects corrupted JSON bindings instead of presenting it as a fresh empty baseline", async () => {
    const h = await own(); await persist(h);
    await cluster.admin.transaction(sql => sql.query("UPDATE watchdog_pg.streams SET state_sha256=repeat('0',64) WHERE scope=$1", [MONITOR_SCOPE]));
    await expect(h.db.readSnapshot(MONITOR_SCOPE)).rejects.toMatchObject({ code: "STORE_CORRUPT" });
  });
  it("upgrades a hash-valid legacy alert in memory without rewriting or inventing a financial action", async () => {
    const h = await own(), saved = await persist(h), id = saved.alerts[0]!.id;
    const row = (await cluster.admin.transaction(sql => sql.query("SELECT alert_json FROM watchdog_pg.alerts WHERE id=$1", [id]))).rows[0]!;
    const legacy = JSON.parse(row.alert_json as string) as Record<string, unknown>; delete legacy.suggestedAction;
    const text = JSON.stringify(legacy), hash = textHash(text);
    await cluster.admin.transaction(sql => sql.query("UPDATE watchdog_pg.alerts SET alert_json=$2,alert_sha256=$3 WHERE id=$1", [id, text, hash]));
    const snapshot = await h.db.readSnapshot(MONITOR_SCOPE, { kind: "alerts", limit: 100 });
    expect(snapshot.alerts.find(alert => alert.id === id)?.suggestedAction).toMatchObject({
      origin: "LEGACY_DERIVED", type: "NON_FINANCIAL", actionable: false, financialOptions: [] });
    const retained = (await cluster.admin.transaction(sql => sql.query("SELECT alert_json,alert_sha256 FROM watchdog_pg.alerts WHERE id=$1", [id]))).rows[0]!;
    expect(retained).toEqual({ alert_json: text, alert_sha256: hash });
  });
  it("bounds storage admission without SQLite disk probing", async () => {
    const h = await own(); await expect(h.store.requireResources({ ...MONITOR_CONFIG.resources, databaseBytes: 1 })).rejects.toMatchObject({ code: "RESOURCE_DATABASE_LIMIT" });
    expect((await h.db.readSnapshot(MONITOR_SCOPE)).state.revision).toBe(0);
  });
  it("terminates actual long-running read statements on the server and reuses the connection safely", async () => {
    const db = cluster.database(), start = performance.now();
    await expect(db.reader.transaction(sql => sql.query("SELECT pg_sleep(5)"))).rejects.toMatchObject({ code: "STORE_TRANSACTION_FAILED" });
    expect(performance.now() - start).toBeLessThan(4_000);
    expect((await db.reader.transaction(sql => sql.query("SELECT 1 AS value"))).rows[0]!.value).toBe(1);
  });
  it("recovers from a real terminated idle backend with bounded reconnection and closes pools", async () => {
    const db = cluster.database(), pid = (await db.writer.transaction(sql => sql.query("SELECT pg_backend_pid() AS pid"))).rows[0]!.pid;
    await cluster.admin.transaction(sql => sql.query("SELECT pg_terminate_backend($1)", [pid]));
    await new Promise<void>(resolve => { setImmediate(resolve); });
    expect((await db.writer.transaction(sql => sql.query("SELECT 1 AS value"))).rows[0]!.value).toBe(1);
    await db.close(); expect(db.writer.statistics().total).toBe(0); expect(db.reader.statistics().total).toBe(0);
    await expect(db.writer.transaction(sql => sql.query("SELECT 1"))).rejects.toMatchObject({ code: "READ_BUSY" });
  });
  it("runs the shared monitoring service with only synthetic notification delivery and a durable receipt", async () => {
    const db = cluster.database(), scheduler = new PostgresSchedulerStore(db, MONITOR_SCOPE, SLOT_PERIOD), raw = await riskFixture(), sent = vi.fn(async () => ({ delivered: true as const }));
    const runner = new SchedulerRunner({ enabled: true, periodSeconds: SLOT_PERIOD, store: scheduler, createJob: (fence: Fence, signal) => new MonitoringService({
      position: MONITOR_POSITION,
      configuration: MONITOR_CONFIG, thresholds: MONITOR_THRESHOLDS, store: new PostgresMonitorStore(db, fence, MONITOR_CONFIG.resources, signal),
      adapters: [{ channel: "console", send: sent }], read: async () => raw, now: testClock, allowFixture: true, id: () => fence.cycleId
    }) });
    const reply = await runner.run(SLOT, new AbortController().signal);
    expect(reply).toMatchObject({ status: 200, body: { status: "COMPLETED", accepted: true } }); expect(sent).toHaveBeenCalled();
    const calls = sent.mock.calls.length;
    expect(await runner.run(SLOT, new AbortController().signal)).toEqual(reply); expect(sent).toHaveBeenCalledTimes(calls);
    expect((await db.readSnapshot(MONITOR_SCOPE)).latestCycle?.status).toBe("COMPLETED"); await runner.stop();
  });
  it("rejects a writer-role connection used for dashboard snapshots", async () => {
    const db = new PostgresDatabase(new PgConnection(cluster.configuration("watchdog_test_writer"), "writer"), new PgConnection(cluster.configuration("watchdog_test_writer"), "reader"), PG_NAMESPACE, PG_FIXTURE_CATALOG);
    try { await expect(db.readSnapshot(MONITOR_SCOPE)).rejects.toMatchObject({ code: "POSTGRES_READ_ROLE" }); } finally { await db.close(); }
  });
});

describe("PHASE10 NATIVE POSTGRESQL: hardened roles, bound receipts, retention and recovery", () => {
  it("rejects an injected catalog drift and privileged runtime connections", async () => {
    const drifted = new PostgresDatabase(new PgConnection(cluster.configuration("watchdog_test_writer"), "writer"),
      new PgConnection(cluster.configuration("watchdog_test_reader"), "reader"), PG_NAMESPACE, "f".repeat(64));
    try {
      await expect(drifted.readSnapshot(MONITOR_SCOPE)).rejects.toMatchObject({ code: "STORE_SCHEMA_DRIFT" });
      await expect(new PostgresSchedulerStore(drifted, MONITOR_SCOPE, SLOT_PERIOD).admit(SLOT)).rejects.toMatchObject({ code: "STORE_SCHEMA_DRIFT" });
    } finally { await drifted.close(); }
    const privileged = new PostgresDatabase(new PgConnection(cluster.configuration("watchdog_test_admin"), "writer"),
      new PgConnection(cluster.configuration("watchdog_test_admin"), "reader"), PG_NAMESPACE, PG_FIXTURE_CATALOG);
    try {
      await expect(privileged.readSnapshot(MONITOR_SCOPE)).rejects.toMatchObject({ code: "POSTGRES_READ_ROLE" });
      await expect(new PostgresSchedulerStore(privileged, MONITOR_SCOPE, SLOT_PERIOD).admit(SLOT)).rejects.toMatchObject({ code: "POSTGRES_WRITE_ROLE" });
    } finally { await privileged.close(); }
  });
  it("rejects drifted runtime grants and restores access only after revocation", async () => {
    const db = cluster.database();
    await cluster.admin.transaction(sql => sql.query("GRANT CREATE ON SCHEMA watchdog_pg TO watchdog_test_writer"));
    try {
      await expect(new PostgresSchedulerStore(db, MONITOR_SCOPE, SLOT_PERIOD).admit(SLOT)).rejects.toMatchObject({ code: "POSTGRES_WRITE_ROLE" });
    } finally { await cluster.admin.transaction(sql => sql.query("REVOKE CREATE ON SCHEMA watchdog_pg FROM watchdog_test_writer")); }
    await cluster.admin.transaction(sql => sql.query("GRANT UPDATE ON watchdog_pg.deliveries TO watchdog_test_reader"));
    try {
      await expect(db.readSnapshot(MONITOR_SCOPE)).rejects.toMatchObject({ code: "POSTGRES_READ_ROLE" });
    } finally { await cluster.admin.transaction(sql => sql.query("REVOKE UPDATE ON watchdog_pg.deliveries FROM watchdog_test_reader")); }
    await cluster.admin.transaction(sql => sql.query("GRANT INSERT,UPDATE(applied_at) ON watchdog_pg.schema_migrations TO watchdog_test_writer"));
    try {
      await expect(new PostgresSchedulerStore(db, MONITOR_SCOPE, SLOT_PERIOD).admit(SLOT)).rejects.toMatchObject({ code: "POSTGRES_WRITE_ROLE" });
    } finally {
      await cluster.admin.transaction(sql => sql.query("REVOKE INSERT,UPDATE(applied_at) ON watchdog_pg.schema_migrations FROM watchdog_test_writer"));
    }
    await cluster.admin.transaction(sql => sql.query("GRANT UPDATE(applied_at) ON watchdog_pg.schema_migrations TO watchdog_test_reader"));
    try {
      await expect(db.readSnapshot(MONITOR_SCOPE)).rejects.toMatchObject({ code: "POSTGRES_READ_ROLE" });
    } finally {
      await cluster.admin.transaction(sql => sql.query("REVOKE UPDATE(applied_at) ON watchdog_pg.schema_migrations FROM watchdog_test_reader"));
    }
    await cluster.admin.transaction(sql => sql.query("GRANT UPDATE ON ALL SEQUENCES IN SCHEMA watchdog_pg TO watchdog_test_reader"));
    try {
      await expect(db.readSnapshot(MONITOR_SCOPE)).rejects.toMatchObject({ code: "POSTGRES_READ_ROLE" });
    } finally {
      await cluster.admin.transaction(sql => sql.query("REVOKE UPDATE ON ALL SEQUENCES IN SCHEMA watchdog_pg FROM watchdog_test_reader"));
    }
    expect((await new PostgresSchedulerStore(cluster.database(), MONITOR_SCOPE, SLOT_PERIOD).admit(SLOT)).kind).toBe("ACQUIRED");
    expect((await db.readSnapshot(MONITOR_SCOPE)).state.revision).toBe(0);
  });
  it("publishes only bound receipts and refuses every tampered binding", async () => {
    const h = await own(); await persist(h);
    const good = await h.scheduler.finish(h.fence, { accepted: true, error: null });
    expect(await h.scheduler.admit(SLOT)).toEqual({ kind: "RECEIPT", receipt: good });
    await cluster.admin.transaction(sql => sql.query("UPDATE watchdog_pg.scheduled_executions SET receipt_json='{}' WHERE id=$1", [h.fence.executionId]));
    await expect(h.scheduler.admit(SLOT)).rejects.toMatchObject({ code: "STORE_CORRUPT" });
    await cluster.admin.transaction(sql => sql.query("UPDATE watchdog_pg.scheduled_executions SET receipt_json=$2 WHERE id=$1",
      [h.fence.executionId, JSON.stringify({ ...good, accepted: !good.accepted })]));
    await expect(h.scheduler.admit(SLOT)).rejects.toMatchObject({ code: "STORE_CORRUPT" });
    await cluster.admin.transaction(sql => sql.query("UPDATE watchdog_pg.scheduled_executions SET receipt_json=$2 WHERE id=$1", [h.fence.executionId, JSON.stringify(good)]));
    expect(await h.scheduler.admit(SLOT)).toEqual({ kind: "RECEIPT", receipt: good });
    await cluster.admin.transaction(sql => sql.query("UPDATE watchdog_pg.scheduled_executions SET completed_at=completed_at+interval '1 second' WHERE id=$1", [h.fence.executionId]));
    await expect(h.scheduler.admit(SLOT)).rejects.toMatchObject({ code: "STORE_CORRUPT" });
  });
  it("derives receipt acceptance from the persisted cycle even after later failures", async () => {
    const h = await own(); await persist(h);
    const receipt = await h.scheduler.finish(h.fence, { accepted: false, error: "CYCLE_FAILED" });
    expect(receipt).toMatchObject({ status: "FAILED", accepted: true, error: "CYCLE_FAILED", missedSlots: 0 });
    expect(await h.scheduler.admit(SLOT)).toEqual({ kind: "RECEIPT", receipt });
  });
  it("prunes only terminal, unprotected history and preserves tombstones and stream bindings", async () => {
    const h = await own(), saved = await persist(h), alertId = saved.alerts[0]!.id;
    await cluster.admin.transaction(sql => sql.query("INSERT INTO watchdog_pg.cycles(id,scope,started_at,completed_at,status) VALUES('prunable',$1,$2,$2,'COMPLETED')",
      [MONITOR_SCOPE, "2027-06-01T00:00:00.000Z"]));
    const oldNow = "2037-01-01T00:00:00.000Z";
    await expect(h.store.prune(oldNow, 30, 6)).rejects.toMatchObject({ code: "STORE_CORRUPT" });
    await h.store.prune(oldNow, 30, 7);
    // The pruned completed cycle had no alerts or bindings; the still-pending alert and its cycle survive.
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.alerts WHERE id=$1", [alertId]))).rows[0]!.count).toBe("1");
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.cycles WHERE id<>$1", [h.fence.cycleId]))).rows[0]!.count).toBe("0");
    const due = (await h.store.due("2026-11-02T12:07:30.000Z", ["console"], 1))[0]!;
    await h.store.startAttempt(due.id, "2026-11-02T12:07:31.000Z");
    expect(await h.store.finishAttempt(due.id, { delivered: true }, "2026-11-02T12:07:32.000Z", null)).toBe("DELIVERED");
    await h.store.prune(oldNow, 30, 7);
    // Exactly the terminal, unprotected alert (delivered on its only channel) is pruned with its delivery; still-pending alerts, tombstones and stream-bound cycles survive.
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.alerts WHERE id=$1", [alertId]))).rows[0]!.count).toBe("0");
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.alerts"))).rows[0]!.count).toBe("2");
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.deliveries"))).rows[0]!.count).toBe("2");
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.fingerprints"))).rows[0]!.count).toBe("3");
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.cycles"))).rows[0]!.count).toBe("1");
    expect((await h.db.readSnapshot(MONITOR_SCOPE)).state.revision).toBe(1);
  });
  it("paginates exclusive bigint cursors and enforces the server-side read budget", async () => {
    const h = await own(); await persist(h);
    const baseText = (await cluster.admin.transaction(sql => sql.query("SELECT observation_json FROM watchdog_pg.cycles WHERE id=$1", [h.fence.cycleId])))
      .rows[0]!.observation_json as string;
    const base = JSON.parse(baseText) as Record<string, unknown>;
    const widths = [256, 200, 160, 128, 96, 64, 48, 32, 24, 16, 12, 8, 4, 2, 0];
    const sample = (width: number) => Buffer.byteLength(JSON.stringify({ ...base, cycleId: "x".repeat(64) }, null, width ? " ".repeat(width) : undefined));
    const width = widths.find(value => sample(value) <= 260_000);
    expect(width).toBeDefined();
    const length = sample(width!);
    const count = Math.min(100, Math.ceil(1_200_000 / length));
    expect(count * length).toBeGreaterThan(1_048_576);
    const identifiers = Array.from({ length: count }, (_, index) => `clone_${String(index).padStart(3, "0")}`);
    for (const id of identifiers) {
      const text = JSON.stringify({ ...base, cycleId: id }, null, width === 0 ? undefined : " ".repeat(width!));
      expect(Buffer.byteLength(text)).toBeLessThanOrEqual(262_144);
      await cluster.admin.transaction(sql => sql.query(`INSERT INTO watchdog_pg.cycles(id,scope,started_at,completed_at,status,accepted,observation_json,observation_sha256)
        VALUES($1,$2,$3,$3,'COMPLETED',1,$4,$5)`, [id, MONITOR_SCOPE, SLOT, text, textHash(text)]));
    }
    // Exclusive one-continuation cursor over arbitrarily many real observation rows.
    const first = await h.db.readSnapshot(MONITOR_SCOPE, { kind: "observations", limit: 1 });
    expect(first.observations).toHaveLength(1);
    expect(first.nextCursor).toMatch(/^[1-9][0-9]{0,18}$/);
    const second = await h.db.readSnapshot(MONITOR_SCOPE, { kind: "observations", limit: 1, before: first.nextCursor! });
    expect(second.observations).toHaveLength(1);
    expect(second.observations[0]!.cycleId).not.toBe(first.observations[0]!.cycleId);
    expect(second.nextCursor).toMatch(/^[1-9][0-9]{0,18}$/);
    expect(BigInt(second.nextCursor!)).toBeLessThan(BigInt(first.nextCursor!));
    // Cumulative payload cost is bounded on the server before rows cross the wire.
    await expect(h.db.readSnapshot(MONITOR_SCOPE, { kind: "observations", limit: 100 }))
      .rejects.toMatchObject({ code: "READ_LIMIT" });
  });
  it("survives an immediate server restart with one durable receipt and unchanged identity", async () => {
    const h = await own(), saved = await persist(h, observation, false);
    await cluster.restart("immediate");
    expect((await cluster.admin.transaction(sql => sql.query("SELECT incarnation::text AS value FROM watchdog_pg.database_identity WHERE id=1"))).rows[0]!.value)
      .toBe(h.fence.incarnation);
    await h.store.finishCycle(h.fence.cycleId, "2026-11-02T12:07:04.000Z");
    const receipt = await h.scheduler.finish(h.fence, { accepted: true, error: null });
    expect(receipt).toMatchObject({ status: "COMPLETED", accepted: true, error: null, slot: SLOT, missedSlots: 0 });
    const snapshot = await h.db.readSnapshot(MONITOR_SCOPE, { kind: "alerts", limit: 100 });
    expect(snapshot.latestCycle).toMatchObject({ id: h.fence.cycleId, status: "COMPLETED" });
    expect(snapshot.state.revision).toBe(1);
    expect(snapshot.alerts.map(alert => alert.suggestedAction)).toEqual(saved.alerts.slice().reverse().map(alert => alert.suggestedAction));
    expect(await h.scheduler.admit(SLOT)).toEqual({ kind: "RECEIPT", receipt });
  });
  it("cancels queued persistence while an in-flight owner transaction stays intact", async () => {
    const h = await own();
    const occupant = h.db.writer.transaction(async sql => { await sql.query("SELECT pg_sleep(1)"); return (await sql.query("SELECT 1 AS value")).rows[0]!.value; });
    await new Promise<void>(done => { setImmediate(done); });
    const queued = h.store.state(MONITOR_SCOPE);
    h.store.cancel();
    await expect(queued).rejects.toMatchObject({ code: "READ_CANCELLED" });
    expect(h.db.writer.statistics().admitted).toBeGreaterThan(0);
    expect(await occupant).toBe(1);
    for (let waited = 0; h.db.writer.statistics().admitted !== 0 && waited < 100; waited++) await new Promise<void>(done => { setImmediate(done); });
    expect(h.db.writer.statistics().admitted).toBe(0);
    // A cancelled capability refuses synchronously; late work never enters a queue or the database.
    expect((captureThrow(() => h.store.state(MONITOR_SCOPE)) as DataError).code).toBe("STORE_NOT_OWNED");
  });
  it("immediately aborts and refuses work for a capability whose signal was already cancelled", async () => {
    const signal = new AbortController(); signal.abort();
    const admission = await new PostgresSchedulerStore(cluster.database(), MONITOR_SCOPE, SLOT_PERIOD).admit(SLOT);
    expect(admission.kind).toBe("ACQUIRED"); if (admission.kind !== "ACQUIRED") throw new Error("Fixture admission failed");
    const store = new PostgresMonitorStore(cluster.database(), admission.fence, MONITOR_CONFIG.resources, signal.signal);
    await expect(store.acquireMonitor()).rejects.toMatchObject({ code: "READ_CANCELLED" });
    expect((captureThrow(() => store.state(MONITOR_SCOPE)) as DataError).code).toBe("STORE_NOT_OWNED");
    await store.close();
  });
});

describe("PHASE10 NATIVE POSTGRESQL: killed child processes recover through persisted state only", () => {
  function childFixture(port: number, mode: "read" | "send") {
    const child = spawn(process.execPath, ["--import", "tsx", "test/helpers/phase10-worker.ts", String(port), mode],
      { cwd: resolve("."), stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true, timeout: 120_000, killSignal: "SIGKILL" });
    child.on("error", () => {});
    const ready = new Promise<void>(done => child.on("message", (message: unknown) => {
      if (typeof message === "object" && message !== null && (message as { event?: string }).event === "ready") done();
    }));
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(done =>
      child.on("close", (code, signal) => done({ code, signal })));
    return { child, ready, exited };
  }

  it("interrupts a killed mid-read owner through the durable admission identity", async () => {
    const run = childFixture(cluster.port, "read");
    await run.ready;
    const before = new PostgresSchedulerStore(cluster.database(), MONITOR_SCOPE, SLOT_PERIOD);
    expect((await before.admit(SLOT)).kind).toBe("IN_PROGRESS");
    run.child.kill();
    const exit = await run.exited;
    expect(exit).toMatchObject({ code: null });
    expect([null, "SIGTERM", "SIGKILL"]).toContain(exit.signal);
    await cluster.clock("2026-11-02T12:16:00.000Z");
    const next = await own(NEXT_SLOT);
    expect(next.fence.missedSlots).toBe(0);
    expect(await next.scheduler.admit(SLOT)).toMatchObject({ kind: "RECEIPT",
      receipt: { status: "INTERRUPTED", error: "PROCESS_INTERRUPTED", accepted: false, missedSlots: 0 } });
    expect(await next.store.state(MONITOR_SCOPE)).toEqual(initialState());
    await next.store.close();
  });
  it("recovers an ambiguous killed in-flight send without a duplicate attempt", async () => {
    const run = childFixture(cluster.port, "send");
    await run.ready;
    expect((await cluster.admin.transaction(sql => sql.query("SELECT count(*)::text AS count FROM watchdog_pg.deliveries WHERE status='IN_FLIGHT'"))).rows[0]!.count).toBe("1");
    run.child.kill();
    const exit = await run.exited;
    expect(exit).toMatchObject({ code: null });
    expect([null, "SIGTERM", "SIGKILL"]).toContain(exit.signal);
    await cluster.clock("2026-11-02T12:15:00.000Z");
    const next = await own(NEXT_SLOT);
    expect(await next.store.recoverDeliveries("2026-11-02T12:39:00.000Z", 5)).toBe(1);
    const delivery = (await cluster.admin.transaction(sql => sql.query("SELECT id,status,ambiguous,attempts::text AS attempts FROM watchdog_pg.deliveries WHERE status='PERMANENTLY_FAILED' AND ambiguous=1"))).rows[0]!;
    expect(delivery).toMatchObject({ status: "PERMANENTLY_FAILED", ambiguous: 1, attempts: "1" });
    expect(await next.store.due("2026-11-02T12:39:00.000Z", ["console"], 50)).not.toContainEqual(expect.objectContaining({ id: delivery.id }));
    const history = (await cluster.admin.transaction(sql => sql.query("SELECT attempt,outcome,error_code,ambiguous FROM watchdog_pg.delivery_attempts WHERE delivery_id=$1 ORDER BY attempt", [delivery.id]))).rows;
    expect(history).toEqual([{ attempt: 1, outcome: "FAILED", error_code: "ATTEMPT_INTERRUPTED", ambiguous: 1 }]);
  });
});
