import { rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { parseMonitoringConfiguration } from "../src/config/monitoring.js";
import { observe } from "../src/monitoring/observation.js";
import { PersistedReadModel } from "../src/runtime/read-model.js";
import { MonitorStore } from "../src/storage/store.js";
import { monitoringFixture, MONITOR_POSITION, MONITOR_SCOPE, MONITOR_THRESHOLDS, persistFixture, testClock } from "./fixtures/phase4.js";
import { runtimeFixture } from "./fixtures/runtime.js";

const cleanup: (() => void)[] = [];
afterEach(() => { for (const close of cleanup.splice(0).reverse()) close(); });
async function fixture() {
  const h = runtimeFixture(); cleanup.push(() => { rmSync(h.directory, { recursive: true, force: true }); });
  const writer = new MonitorStore(h.options.database); writer.acquireMonitor(); cleanup.push(() => { writer.close(); });
  const base = await monitoringFixture(); persistFixture(writer, base);
  const reader = new MonitorStore(h.options.database, { readOnly: true }); cleanup.push(() => { reader.close(); });
  return { ...h, writer, reader, base, api: new PersistedReadModel(reader, h.options.configuration, () => "DISABLED", h.options.thresholds, h.options.position, testClock) };
}

describe("PHASE8 FIXTURE: coherent, sanitized persisted read projections", () => {
  it("preserves exact risk/estimate provenance and omits internal assurance/configuration/path fields", async () => {
    const h = await fixture(), reply = h.api.read("/api/risk"), body = JSON.stringify(reply.body);
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ schemaVersion: 1, identity: { chainId: 1672 }, meta: { history: false, safety: { actionable: false, oracleAssurance: "UNVERIFIED", freshness: "UNKNOWN" } },
      latest: { cycleId: h.base.cycleId, risk: { actionable: false, safetyRatio: h.base.risk.safetyRatio, ltv: h.base.risk.ltv,
        blockHash: h.base.risk.blockHash, snapshotIdentifier: h.base.risk.snapshotIdentifier, repayment: h.base.risk.repayment, additionalCollateral: h.base.risk.additionalCollateral } },
      lastAccepted: { cycleId: h.base.cycleId } });
    expect(/"(?:pid|rssBytes|path|storagePath|configuration|findings|environment|evidence|source|runId|scope)"/.test(body)).toBe(false);
    expect(body.includes(h.options.database)).toBe(false); expect(body.includes(h.credential)).toBe(false);
  });
  it("keeps rejected latest data distinct from lastAccepted and reports stale/not-ready reasons", async () => {
    const h = await fixture(), rejected = observe(null, "rejected_read", testClock(), MONITOR_THRESHOLDS, { diagnostic: "SNAPSHOT_UNAVAILABLE", previousAssurance: h.base.assurance! });
    persistFixture(h.writer, rejected);
    expect(h.api.read("/api/positions").body).toMatchObject({ meta: { stale: true }, latest: { accepted: false, cycleId: "rejected_read" }, lastAccepted: { accepted: true, cycleId: h.base.cycleId } });
    const readiness = h.api.read("/api/readiness"); expect(readiness.status).toBe(503);
    expect(readiness.body).toMatchObject({ ready: false, reasons: expect.arrayContaining(["MONITOR_DISABLED", "LATEST_OBSERVATION_REJECTED", "NON_LIVE_OBSERVATION"]) });
    const old = new PersistedReadModel(h.reader, parseMonitoringConfiguration(), () => "RUNNING", MONITOR_THRESHOLDS, MONITOR_POSITION, () => new Date(testClock().getTime() + 601_000));
    expect(old.read("/api/readiness").body).toMatchObject({ meta: { stale: true }, reasons: expect.arrayContaining(["OBSERVATION_STALE"]) });
  });
  it("projects retrieval age, block age, progression and oracle evidence as separate readiness fields", async () => {
    const h = await fixture(), readiness = h.api.read("/api/readiness");
    expect(readiness.status).toBe(503);
    const body = readiness.body as { ages: { retrievalAgeSeconds: number | null; blockAgeSeconds: number | null };
      progression: { state: string; reason: string | null }; oracleAssurance: string; oracleFreshness: string; reasons: string[] };
    // The fixture block is deliberately old relative to the fixture clock: local-clock block age is rejection-only
    // evidence, and a recent fixture retrieval never upgrades readiness or establishes chain progression.
    expect(body.ages.retrievalAgeSeconds).toBe(0);
    expect(body.ages.blockAgeSeconds).toBeGreaterThan(600);
    expect(body.progression).toEqual({ state: "UNKNOWN", reason: "FIRST_OBSERVATION" });
    expect(body.oracleAssurance).toBe("UNVERIFIED"); expect(body.oracleFreshness).toBe("UNKNOWN");
    expect(body.reasons).toEqual(expect.arrayContaining(["CHAIN_PROGRESS_UNKNOWN", "BLOCK_TOO_OLD",
      "ORACLE_ASSURANCE_UNVERIFIED", "ORACLE_FRESHNESS_UNKNOWN"]));
    for (const absent of ["CHAIN_STALLED", "CHAIN_REGRESSED", "CHAIN_CONFLICT"]) expect(body.reasons).not.toContain(absent);
  });
  it("paginates deterministically across new commits without repeating rows and retains delivery ambiguity", async () => {
    const h = await fixture();
    for (let index = 2; index <= 5; index++) persistFixture(h.writer, { ...h.base, cycleId: `page_${index}` });
    const first = h.reader.readSnapshot(MONITOR_SCOPE, { kind: "observations", limit: 2 });
    expect(first.observations.map(item => item.cycleId)).toEqual(["page_5", "page_4"]); expect(first.nextCursor).not.toBeNull();
    persistFixture(h.writer, { ...h.base, cycleId: "page_6" });
    const second = h.reader.readSnapshot(MONITOR_SCOPE, { kind: "observations", limit: 2, before: Number(first.nextCursor) });
    expect(second.observations.map(item => item.cycleId)).toEqual(["page_3", "page_2"]);
    const final = h.reader.readSnapshot(MONITOR_SCOPE, { kind: "observations", limit: 2, before: Number(second.nextCursor) });
    expect(final.observations.map(item => item.cycleId)).toEqual([h.base.cycleId]); expect(final.nextCursor).toBeNull();
    const pending = h.writer.deliveries()[0]!; h.writer.startAttempt(pending.id, testClock().toISOString()); h.writer.recoverDeliveries(testClock().toISOString(), 5);
    expect(h.api.read("/api/alerts").body).toMatchObject({ meta: { history: true }, items: expect.arrayContaining([expect.objectContaining({ deliveries: expect.arrayContaining([expect.objectContaining({ ambiguous: true, attempts: 1, status: "PERMANENTLY_FAILED", outcome: "UNKNOWN" })]) })]) });
  });
  it("reads only committed WAL snapshots during a competing transaction and never mutates tables", async () => {
    const h = await fixture(), hashes = h.writer.contentHashes(), db = new DatabaseSync(h.options.database);
    try {
      db.exec("BEGIN IMMEDIATE; UPDATE streams SET state_json='{}'");
      for (let index = 0; index < 10; index++) expect(h.api.read("/api/monitoring/status").body).toMatchObject({ revision: 1 });
      expect(() => h.writer.readSnapshot(MONITOR_SCOPE)).toThrow("read-only");
      db.exec("ROLLBACK"); expect(h.writer.contentHashes()).toEqual(hashes);
    } finally { db.close(); }
  });
  it("rejects invalid pages and oversized persisted JSON without silently omitting safety fields", async () => {
    const h = await fixture();
    for (const page of [{ kind: "observations" as const, limit: 101 }, { kind: "alerts" as const, limit: 0 }, { kind: "observations" as const, limit: 20, before: -1 }]) expect(() => h.reader.readSnapshot(MONITOR_SCOPE, page)).toThrow();
    const db = new DatabaseSync(h.options.database), original = h.writer.state(MONITOR_SCOPE);
    try {
      db.prepare("UPDATE streams SET state_json=?").run(JSON.stringify({ ...original, oversize: "x".repeat(1_048_577) }));
      expect(() => h.reader.readSnapshot(MONITOR_SCOPE)).toThrow("read budget");
      db.prepare("UPDATE streams SET state_json=?").run(JSON.stringify(original));
      expect(h.reader.readSnapshot(MONITOR_SCOPE).state.revision).toBe(1);
    } finally { db.close(); }
  });
  it("returns disabled status and fixed unavailable data without initializing missing storage", () => {
    const api = new PersistedReadModel(null, parseMonitoringConfiguration(), () => "DISABLED", MONITOR_THRESHOLDS, MONITOR_POSITION, testClock);
    expect(api.read("/api/monitoring/status").body).toMatchObject({ lifecycle: "DISABLED", revision: 0, workerStatus: null });
    expect(api.read("/api/readiness").body).toMatchObject({ ready: false, reasons: expect.arrayContaining(["DATABASE_UNAVAILABLE"]) });
    expect(api.read("/api/positions")).toEqual({ status: 503, body: { error: "DATA_UNAVAILABLE" } });
  });
});
