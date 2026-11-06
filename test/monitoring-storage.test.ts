import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEPLOYMENT } from "../src/config/deployment.js";
import { hashParts, initialState } from "../src/monitoring/model.js";
import type { Observation } from "../src/monitoring/model.js";
import { transition } from "../src/monitoring/transitions.js";
import { MonitorStore } from "../src/storage/store.js";
import { APPLICATION_ID, MIGRATIONS } from "../src/storage/migrations.js";
import { monitoringFixture, MONITOR_CONFIG, MONITOR_SCOPE, persistFixture, temporaryMonitorDirectory } from "./fixtures/phase4.js";

const directory = temporaryMonitorDirectory(); let base: Observation;
beforeAll(async () => { base = await monitoringFixture(); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
describe("FIXTURE: transactional SQLite persistence and restarts", () => {
  it("initializes a new database and reads the same accepted state and outbox after reopening", () => {
    const path = join(directory, "restart.sqlite"); let store = new MonitorStore(path);
    store.acquireMonitor(); const alerts = persistFixture(store, base); store.close();
    store = new MonitorStore(path);
    expect(store.state(MONITOR_SCOPE).lastAccepted).toEqual(base);
    expect(store.alerts()).toHaveLength(alerts.length);
    expect(store.deliveries().every(delivery => delivery.status === "PENDING")).toBe(true);
    store.acquireMonitor(); persistFixture(store, { ...base, cycleId: "cycle_2" });
    expect(store.alerts()).toHaveLength(alerts.length); store.close();
  });
  it.each([1, 2, 3, 4])("migrates v%s to v5 while preserving accepted data, alerts, pending deliveries and cooldowns", version => {
    const path = join(directory, `migration-${version}.sqlite`), db = new DatabaseSync(path);
    for (let index = 0; index < version; index += 1) {
      db.exec(MIGRATIONS[index]!); db.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(index + 1, hashParts(MIGRATIONS[index]));
    }
    db.exec(`PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=${version};`);
    const next = transition(initialState(), base, MONITOR_CONFIG.monitoring, MONITOR_SCOPE), alert = next.alerts[0]!;
    db.prepare("INSERT INTO streams VALUES(?,?,?)").run(MONITOR_SCOPE, next.state.revision, JSON.stringify(next.state));
    db.prepare("INSERT INTO cycles(id,scope,started_at,status,observed_at,completed_at,accepted,observation_json) VALUES(?,?,?,'COMPLETED',?,?,1,?)")
      .run(base.cycleId, MONITOR_SCOPE, base.observedAt, base.observedAt, base.observedAt, JSON.stringify(base));
    db.prepare("INSERT INTO fingerprints VALUES(?,?)").run(alert.fingerprint, alert.createdAt);
    db.prepare("INSERT INTO alerts VALUES(?,?,?,?,?,?,?,?)").run(alert.id, alert.fingerprint, alert.cycleId, alert.scope,
      alert.createdAt, alert.severity, alert.category, JSON.stringify(alert));
    db.prepare("INSERT INTO deliveries(id,alert_id,channel,status,next_at) VALUES(?,?,'discord','PENDING',?)").run("migration_pending", alert.id, base.observedAt);
    const cooldown = new Date(Date.parse(base.observedAt) + 60_000).toISOString();
    if (version >= 2) db.prepare("INSERT INTO provider_limits(channel,next_at) VALUES(?,?)").run("discord", cooldown);
    db.close();
    const store = new MonitorStore(path); expect(store.summary(MONITOR_SCOPE).schemaVersion).toBe(5);
    expect(store.state(MONITOR_SCOPE)).toEqual(next.state); expect(store.alerts()).toEqual([alert]);
    expect(store.deliveries()).toEqual([expect.objectContaining({ id: "migration_pending", status: "PENDING", attempts: 0 })]);
    expect(store.providerLimits()).toEqual(version >= 2 ? [{ channel: "discord", next_at: cooldown, blocked: 0 }] : []);
    expect(store.due(base.observedAt, ["discord"])).toHaveLength(version >= 2 ? 0 : 1); store.close();
  });
  it("fails explicitly for a corrupt file and does not replace its bytes", () => {
    const path = join(directory, "corrupt.sqlite"), original = Buffer.from("not a sqlite database"); writeFileSync(path, original);
    expect(() => new MonitorStore(path)).toThrow("no corruption recovery"); expect(readFileSync(path)).toEqual(original);
  });
  it("rejects unexpected schema objects before migration and retains the original schema version and data", () => {
    const path = join(directory, "migration-failed.sqlite"), db = new DatabaseSync(path);
    db.exec(MIGRATIONS[0]); db.prepare("INSERT INTO schema_migrations VALUES(1,?)").run(hashParts(MIGRATIONS[0]));
    db.exec(`PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=1; CREATE TABLE provider_limits(existing TEXT);`);
    db.prepare("INSERT INTO streams VALUES(?,?,?)").run(MONITOR_SCOPE, 0, JSON.stringify(initialState())); db.close();
    expect(() => new MonitorStore(path)).toThrow("supported migration layout");
    const reopened = new DatabaseSync(path);
    expect(reopened.prepare("PRAGMA user_version").get()?.user_version).toBe(1);
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()?.count).toBe(1);
    expect(reopened.prepare("SELECT state_json FROM streams").get()?.state_json).toBe(JSON.stringify(initialState())); reopened.close();
  });
  it.each(["newer", "foreign", "checksum", "state"])("fails closed on incompatible or malformed %s database", kind => {
    const path = join(directory, `${kind}.sqlite`);
    if (kind !== "foreign") new MonitorStore(path).close();
    const db = new DatabaseSync(path);
    if (kind === "newer") db.exec("PRAGMA user_version=99");
    if (kind === "foreign") db.exec("CREATE TABLE foreign_data(value TEXT)");
    if (kind === "checksum") db.exec("UPDATE schema_migrations SET checksum='wrong'");
    if (kind === "state") db.prepare("INSERT INTO streams VALUES(?,?,?)").run(MONITOR_SCOPE, 1, JSON.stringify({ actionable: true }));
    db.close(); expect(() => new MonitorStore(path)).toThrow();
  });
  it.each(["unaccepted-baseline", "missing-baseline", "missing-latest", "failure-counter", "detached-estimate"])("rejects semantically inconsistent stored %s without resetting it", kind => {
    const path = join(directory, `${kind}.sqlite`), store = new MonitorStore(path); store.acquireMonitor(); persistFixture(store, base);
    const state = store.state(MONITOR_SCOPE); store.close();
    if (kind === "unaccepted-baseline") state.lastAccepted!.accepted = false;
    if (kind === "missing-baseline") state.lastAccepted = null;
    if (kind === "missing-latest") state.latest = null;
    if (kind === "failure-counter") state.consecutiveFailures = 1;
    if (kind === "detached-estimate") {
      // Inject a well-formed but provably detached estimate: the provenance refine must reject it.
      const risk = state.lastAccepted!.risk;
      risk.repayment = { raw: "1", formatted: "0.000001", tokenAddress: DEPLOYMENT.loanToken, decimals: 6,
        targetRatio: "1250000000000000000", calculationMethod: "morpho-v1.0.0/minimum-assets-binary-search/full-share-endpoint",
        actionable: false, indicative: true, inputSnapshotIdentifier: risk.snapshotIdentifier!,
        blockNumber: risk.blockNumber!, blockHash: `0x${"ef".repeat(32)}`, calculatedAt: risk.calculatedAt };
    }
    const text = JSON.stringify(state), db = new DatabaseSync(path);
    db.prepare("UPDATE streams SET state_json=? WHERE scope=?").run(text, MONITOR_SCOPE); db.close();
    expect(() => new MonitorStore(path)).toThrow("failed validation");
    const reopened = new DatabaseSync(path);
    expect(reopened.prepare("SELECT state_json FROM streams WHERE scope=?").get(MONITOR_SCOPE)?.state_json).toBe(text); reopened.close();
  });
  it("rejects corrupt persisted provider cooldown metadata before dispatch", () => {
    const path = join(directory, "corrupt-cooldown.sqlite"); new MonitorStore(path).close();
    const db = new DatabaseSync(path); db.prepare("INSERT INTO provider_limits VALUES(?,?,0)").run("discord", "not-a-timestamp"); db.close();
    expect(() => new MonitorStore(path)).toThrow("failed validation");
  });
  it("rejects a failed-read commit that would erase the existing accepted baseline", () => {
    const store = new MonitorStore(":memory:"); store.acquireMonitor(); persistFixture(store, base);
    const before = store.state(MONITOR_SCOPE), failure = { ...base, cycleId: "failed_read", accepted: false };
    const next = transition(before, failure, MONITOR_CONFIG.monitoring, MONITOR_SCOPE); next.state.lastAccepted = null;
    store.beginCycle(failure.cycleId, MONITOR_SCOPE, failure.observedAt);
    expect(() => store.commitObservation(MONITOR_SCOPE, failure, before.revision, next.state, next.alerts, ["console"])).toThrow("failed validation");
    expect(store.state(MONITOR_SCOPE)).toEqual(before); store.close();
  });
  it("rolls back state, fingerprints, alerts and outbox together if any alert insert fails", () => {
    const store = new MonitorStore(":memory:"); store.acquireMonitor(); store.beginCycle(base.cycleId, MONITOR_SCOPE, base.observedAt);
    const next = transition(initialState(), base, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    const first = next.alerts[0]!;
    const duplicateId = { ...next.alerts[1]!, id: first.id };
    expect(() => store.commitObservation(MONITOR_SCOPE, base, 0, next.state, [first, duplicateId], ["console"])).toThrow("rolled back");
    expect(store.alerts()).toHaveLength(0); expect(store.deliveries()).toHaveLength(0); expect(store.state(MONITOR_SCOPE).revision).toBe(0);
    expect(store.unfinishedCycles(MONITOR_SCOPE)[0]?.status).toBe("RUNNING");
    expect(store.commitObservation(MONITOR_SCOPE, base, 0, next.state, next.alerts, ["console"])).toHaveLength(next.alerts.length);
    store.close();
  });
  it("uniquely constrains duplicate fingerprints while allowing a new episode", () => {
    const store = new MonitorStore(":memory:"); store.acquireMonitor();
    store.beginCycle(base.cycleId, MONITOR_SCOPE, base.observedAt);
    const next = transition(initialState(), base, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    expect(store.commitObservation(MONITOR_SCOPE, base, 0, next.state, [next.alerts[0]!, next.alerts[0]!], ["console"])).toHaveLength(1);
    expect(store.deliveries()).toHaveLength(1); store.close();
  });
  it("rejects a revision race and a second cycle commit", () => {
    const store = new MonitorStore(":memory:"); store.acquireMonitor(); persistFixture(store, base);
    const second = { ...base, cycleId: "second" }, next = transition(initialState(), second, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    store.beginCycle(second.cycleId, MONITOR_SCOPE, second.observedAt);
    expect(() => store.commitObservation(MONITOR_SCOPE, second, 0, next.state, next.alerts, ["console"])).toThrow("state changed");
    expect(store.state(MONITOR_SCOPE).latest?.cycleId).toBe(base.cycleId); store.close();
  });
  it("excludes a second process owner while allowing status readers, and releases the OS lock", () => {
    const path = join(directory, "lock.sqlite"), first = new MonitorStore(path), second = new MonitorStore(path);
    first.acquireMonitor(); expect(second.summary(MONITOR_SCOPE).state.revision).toBe(0);
    expect(() => second.acquireMonitor()).toThrow("exclusive monitor lock"); first.close();
    second.acquireMonitor(); second.close();
  });
  it("recovers an interrupted in-flight attempt as ambiguous without resetting its attempt budget", () => {
    const path = join(directory, "pending.sqlite"); let store = new MonitorStore(path); store.acquireMonitor(); persistFixture(store, base);
    const id = store.deliveries()[0]!.id; store.startAttempt(id, base.observedAt); store.close();
    store = new MonitorStore(path); store.acquireMonitor(); expect(store.recoverDeliveries(base.observedAt, 5)).toBe(1);
    expect(store.deliveries().find(delivery => delivery.id === id)).toMatchObject({ attempts: 1, ambiguous: 1, status: "PERMANENTLY_FAILED", last_error: "ATTEMPT_INTERRUPTED" });
    expect(store.attempts(id)).toEqual([expect.objectContaining({ outcome: "FAILED", ambiguous: 1 })]); store.close();
  });
  it("keeps undelivered alerts through retention and preserves restart dedup after terminal history is pruned", () => {
    const store = new MonitorStore(":memory:"); store.acquireMonitor(); persistFixture(store, base);
    const later = new Date(Date.parse(base.observedAt) + 200 * 86_400_000).toISOString();
    store.prune(later, 30, 180); expect(store.alerts().length).toBeGreaterThan(0);
    for (const delivery of store.deliveries()) { store.startAttempt(delivery.id, base.observedAt); store.finishAttempt(delivery.id, { delivered: true }, base.observedAt, null); }
    store.prune(later, 30, 180); expect(store.alerts()).toHaveLength(0); expect(store.state(MONITOR_SCOPE).lastAccepted).toEqual(base);
    persistFixture(store, { ...base, cycleId: "after_retention", observedAt: later }); expect(store.alerts()).toHaveLength(0); store.close();
  });
  it("refuses evidence archive paths", () => { expect(() => new MonitorStore("evidence/phase2/forbidden.sqlite")).toThrow("outside evidence"); });
});
