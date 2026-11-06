import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resourceSchema } from "../src/config/monitoring.js";
import { DataError } from "../src/domain/errors.js";
import { hashParts, initialState } from "../src/monitoring/model.js";
import type { Observation } from "../src/monitoring/model.js";
import { transition } from "../src/monitoring/transitions.js";
import { saveOracleBundle } from "../src/oracle-assurance/evidence.js";
import { evidenceStatistics, prepareEvidenceCapture, requireEvidenceCapacity, resourceStatus } from "../src/operations/resources.js";
import { createBackup, hashFile, verifyBackup, verifyRestore } from "../src/storage/backup.js";
import { APPLICATION_ID, MIGRATIONS } from "../src/storage/migrations.js";
import { MonitorStore } from "../src/storage/store.js";
import { monitoringFixture, MONITOR_CONFIG, MONITOR_SCOPE, persistFixture, temporaryMonitorDirectory, testClock } from "./fixtures/phase4.js";

const directory = temporaryMonitorDirectory(); let base: Observation, sequence = 0;
beforeAll(async () => { base = await monitoringFixture(); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
const path = (name: string) => join(directory, `${++sequence}-${name}`);
function legacy(file: string, version: number, populated = false) {
  const db = new DatabaseSync(file);
  try {
    for (let index = 0; index < version; index += 1) {
      db.exec(MIGRATIONS[index]!); db.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(index + 1, hashParts(MIGRATIONS[index]));
    }
    db.exec(`PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=${version};`);
    if (!populated) return;
    const observation = { ...base }; delete observation.assurance;
    const next = transition(initialState(), observation, MONITOR_CONFIG.monitoring, MONITOR_SCOPE), alert = next.alerts[0]!;
    db.prepare("INSERT INTO streams VALUES(?,?,?)").run(MONITOR_SCOPE, next.state.revision, JSON.stringify(next.state));
    db.prepare("INSERT INTO cycles(id,scope,started_at,status,observed_at,completed_at,accepted,observation_json) VALUES(?,?,?,'COMPLETED',?,?,1,?)")
      .run(base.cycleId, MONITOR_SCOPE, base.observedAt, base.observedAt, base.observedAt, JSON.stringify(observation));
    db.prepare("INSERT INTO fingerprints VALUES(?,?)").run(alert.fingerprint, alert.createdAt);
    db.prepare("INSERT INTO alerts VALUES(?,?,?,?,?,?,?,?)").run(alert.id, alert.fingerprint, alert.cycleId, alert.scope, alert.createdAt, alert.severity, alert.category, JSON.stringify(alert));
    for (const [index, channel] of ["console", "telegram", "discord"].entries()) {
      const status = index === 0 ? "DELIVERED" : index === 1 ? "IN_FLIGHT" : "PENDING", id = `legacy_${index}`;
      db.prepare("INSERT INTO deliveries(id,alert_id,channel,status,attempts,next_at) VALUES(?,?,?,?,?,?)").run(id, alert.id, channel, status, index < 2 ? 1 : 0, base.observedAt);
      if (index < 2) db.prepare("INSERT INTO delivery_attempts(delivery_id,attempt,started_at,completed_at,outcome) VALUES(?,1,?,?,?)")
        .run(id, base.observedAt, index === 0 ? base.observedAt : null, status);
    }
    if (version >= 2) db.prepare("INSERT INTO provider_limits(channel,next_at) VALUES('discord',?)").run(new Date(testClock().getTime() + 60_000).toISOString());
  } finally { db.close(); }
}

describe("FIXTURE: storage durability, ownership, migration and capacity faults", () => {
  it("refuses an oversized snapshot artifact before creating a capture directory", () => {
    const target = path("oversized-capture");
    expect(() => prepareEvidenceCapture(target, { "snapshot.json": "x".repeat(32 * 1_024 ** 2 + 1) })).toThrow("32 MiB file budget");
    expect(existsSync(target)).toBe(false);
  });
  it("rolls back all migration steps after an injected mid-migration I/O failure", () => {
    const file = path("legacy.sqlite"); legacy(file, 3, true);
    const original = readFileSync(file), exec = DatabaseSync.prototype.exec;
    const spy = vi.spyOn(DatabaseSync.prototype, "exec").mockImplementation(function (this: DatabaseSync, sql: string) {
      if (sql === MIGRATIONS[4]) throw new Error("synthetic migration I/O failure");
      return exec.call(this, sql);
    });
    try { expect(() => new MonitorStore(file)).toThrow("rolled back"); } finally { spy.mockRestore(); }
    expect(readFileSync(file)).toEqual(original);
    const check = new MonitorStore(file, { readOnly: true, allowLegacy: true });
    expect(check.schemaVersion).toBe(3); expect(check.deliveryCounts()).toMatchObject({ PENDING: 1, IN_FLIGHT: 1, DELIVERED: 1 }); check.close();
    const migrated = new MonitorStore(file); expect(migrated.schemaVersion).toBe(5); migrated.validateAll(); migrated.close();
  });
  it("does not migrate legacy storage during read-only inspection", () => {
    const file = path("read-only-legacy.sqlite"); legacy(file, 4);
    const original = readFileSync(file);
    expect(() => new MonitorStore(file, { readOnly: true })).toThrow("explicit database-init");
    expect(readFileSync(file)).toEqual(original);
  });
  it("takes maintenance ownership before writable open while permitting read-only diagnostics", () => {
    const file = path("owner.sqlite"), owner = new MonitorStore(file); owner.acquireMonitor(); persistFixture(owner, base);
    const hashes = owner.contentHashes();
    expect(() => new MonitorStore(file)).toThrow("exclusive monitor lock");
    const reader = new MonitorStore(file, { readOnly: true });
    expect(reader.ownership()).toBe("HELD"); expect(reader.contentHashes()).toEqual(hashes);
    expect(() => reader.acquireMonitor()).toThrow("read-only"); reader.close(); owner.close();
    const resumed = new MonitorStore(file); resumed.acquireMonitor(); expect(resumed.contentHashes()).toEqual(hashes); resumed.close();
  });
  it.each(["CREATE TABLE extra(value TEXT)", "CREATE INDEX unreviewed ON cycles(status)",
    "CREATE TRIGGER unreviewed AFTER INSERT ON cycles BEGIN SELECT 1; END", "DROP INDEX deliveries_alert_id",
    "CREATE TABLE sqliteextra(value TEXT)", "CREATE INDEX sqliteindex ON cycles(status)",
    "CREATE TRIGGER sqlitetrigger AFTER INSERT ON cycles BEGIN SELECT 1; END"])(
    "rejects schema-layout drift before state changes: %s", sql => {
    const file = path("drift.sqlite"); new MonitorStore(file).close();
    const db = new DatabaseSync(file); db.exec(sql); db.close(); const bytes = readFileSync(file);
    expect(() => new MonitorStore(file)).toThrow("supported migration layout"); expect(readFileSync(file)).toEqual(bytes);
  });
  it("refuses initialization over an unversioned user table with a sqlite-like name", () => {
    const file = path("unrecognized.sqlite"), db = new DatabaseSync(file);
    db.exec("CREATE TABLE sqliteextra(value TEXT)"); db.close(); const bytes = readFileSync(file);
    expect(() => new MonitorStore(file)).toThrow("unrecognized database"); expect(readFileSync(file)).toEqual(bytes);
  });
  it("rolls back a real SQLITE_FULL page-limit failure without partial observation/outbox writes", () => {
    const file = path("page-limit.sqlite"), seed = new MonitorStore(file), size = seed.statistics().pageCount * seed.statistics().pageSize; seed.close();
    const store = new MonitorStore(file, { limits: resourceSchema.parse({ databaseBytes: size + 4_096 }) }); store.acquireMonitor();
    store.beginCycle(base.cycleId, MONITOR_SCOPE, base.observedAt); const before = store.contentHashes();
    const next = transition(initialState(), base, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    try {
      expect(() => store.commitObservation(MONITOR_SCOPE, base, 0, next.state, next.alerts, ["console", "telegram"]))
        .toThrow("transaction was rolled back");
      expect(store.contentHashes()).toEqual(before); expect(store.state(MONITOR_SCOPE).revision).toBe(0); expect(store.pendingCount()).toBe(0);
      store.validateAll();
    } finally { store.close(); }
    const resumed = new MonitorStore(file); resumed.acquireMonitor();
    resumed.commitObservation(MONITOR_SCOPE, base, 0, next.state, next.alerts, ["console"]); resumed.finishCycle(base.cycleId, base.observedAt);
    expect(resumed.state(MONITOR_SCOPE).lastAccepted).toEqual(base); resumed.validateAll(); resumed.close();
  });
  it("rolls back the entire new alert batch at the outbox limit and retains existing work", () => {
    const store = new MonitorStore(":memory:", { limits: resourceSchema.parse({ pendingDeliveries: 1 }) }); store.acquireMonitor();
    store.beginCycle(base.cycleId, MONITOR_SCOPE, base.observedAt); const next = transition(initialState(), base, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    const before = store.contentHashes();
    expect(() => store.commitObservation(MONITOR_SCOPE, base, 0, next.state, next.alerts, ["console"])).toThrow("Outbox budget");
    expect(store.contentHashes()).toEqual(before); store.close();
  });
  it.each(["alert-binding", "attempt-count", "attempt-completion"])("rejects corrupt %s records during full recovery/backup validation", kind => {
    const file = path("content.sqlite"), owner = new MonitorStore(file); owner.acquireMonitor(); persistFixture(owner, base);
    const delivery = owner.deliveries()[0]!;
    owner.startAttempt(delivery.id, base.observedAt); owner.close();
    const db = new DatabaseSync(file);
    if (kind === "alert-binding") db.exec("UPDATE alerts SET severity='INFO'");
    if (kind === "attempt-count") db.exec("UPDATE deliveries SET attempts=4 WHERE attempts=1");
    if (kind === "attempt-completion") db.exec("UPDATE delivery_attempts SET outcome='FAILED'");
    db.close(); const check = new MonitorStore(file, { readOnly: true });
    expect(() => check.validateAll()).toThrow("failed validation"); check.close();
  });
  it("fails closed on disk reserve, memory, database, WAL and evidence budgets without deleting records", () => {
    const file = path("resources.sqlite"), store = new MonitorStore(file); store.acquireMonitor(); persistFixture(store, base);
    const before = store.contentHashes(), limits = resourceSchema.parse({ databaseBytes: 1, walBytes: 1, minFreeBytes: Number.MAX_SAFE_INTEGER, rssBytes: 1, pendingDeliveries: 1 });
    expect(resourceStatus(file, store, limits).issues).toEqual(expect.arrayContaining(["RESOURCE_DATABASE_LIMIT", "RESOURCE_WAL_LIMIT", "RESOURCE_DISK_RESERVE", "RESOURCE_BACKLOG_LIMIT", "RESOURCE_MEMORY_LIMIT"]));
    expect(store.contentHashes()).toEqual(before); store.close();
    const evidence = path("evidence-budget"); mkdirSync(evidence); writeFileSync(join(evidence, "fixture.txt"), "12345");
    expect(() => requireEvidenceCapacity(evidence, 1, 1, resourceSchema.parse({ evidenceBytes: 5 }))).toThrow("evidence budget");
    expect(() => evidenceStatistics(evidence, resourceSchema.parse({ evidenceBytes: 4 }))).toThrow("Evidence budget");
    expect(readFileSync(join(evidence, "fixture.txt"), "utf8")).toBe("12345");
  });
});

describe("FIXTURE: consistent SQLite backups and isolated restoration", () => {
  it("captures a live WAL database, all bound evidence and known-delivered/in-flight work while another connection writes", async () => {
    const file = path("live-wal.sqlite"), store = new MonitorStore(file); store.acquireMonitor(); persistFixture(store, base, ["console", "telegram"]);
    const deliveries = store.deliveries(), delivered = deliveries[0]!, interrupted = deliveries[1]!;
    store.startAttempt(delivered.id, base.observedAt); store.finishAttempt(delivered.id, { delivered: true }, base.observedAt, null);
    store.startAttempt(interrupted.id, base.observedAt);
    const project = path("project"); mkdirSync(project);
    const copied = new Set<string>();
    for (const ref of store.localEvidenceReferences()) {
      const item = ref.path.startsWith("evidence/phase4/") ? dirname(ref.path) : ref.path;
      if (copied.has(item)) continue; copied.add(item); mkdirSync(dirname(join(project, item)), { recursive: true });
      cpSync(resolve(item), join(project, item), { recursive: true, errorOnExist: true, force: false });
    }
    const bundle = await saveOracleBundle({ "fixture-assurance.json": JSON.stringify(base.assurance) + "\n" }, { root: join(project, "evidence/phase5"), now: testClock() });
    store.saveOracleAssurance("saved_fixture_audit", base.assurance!, { path: `evidence/phase5/${basename(bundle.directory)}`, manifestSha256: bundle.manifestSha256 });
    const backup = path("online-backup"), scratch = path("scratch"), deliveredHash = store.knownDeliveredHash();
    try {
      const pending = createBackup(file, backup, { projectRoot: project, now: testClock });
      persistFixture(store, { ...base, cycleId: "concurrent_cycle" }, ["console", "telegram"]);
      const result = await pending;
      expect(result).toMatchObject({ passed: true, mechanism: "SQLITE_ONLINE_BACKUP_API", schemaVersion: 5, actionable: false });
      expect(result.evidenceBundles).toBeGreaterThanOrEqual(2); expect(result.reviewedReferences).toBeGreaterThan(0);
      expect(result.evidenceFiles).toBeGreaterThan(result.reviewedReferences); expect([1, 2]).toContain(result.counts.cycles);
      const copy = new MonitorStore(join(backup, "database.sqlite"), { readOnly: true });
      expect(copy.statistics().journalMode).toBe("delete"); expect(copy.knownDeliveredHash()).toBe(deliveredHash);
      expect(copy.deliveries().find(item => item.id === interrupted.id)).toMatchObject({ status: "IN_FLIGHT", attempts: 1 }); copy.close();
      const sourceHash = await hashFile(join(backup, "database.sqlite"));
      expect(await verifyRestore(backup, scratch)).toMatchObject({ passed: true, isolated: true, sourceUnchanged: true, recoveredAmbiguous: 1,
        knownDeliveredNotResent: true, preservedStateAlertsAndDedup: true, restoredSchemaVersion: 5, externalCalls: 0 });
      expect(await hashFile(join(backup, "database.sqlite"))).toBe(sourceHash); expect(readdirSync(scratch)).toEqual([]);
      expect(store.knownDeliveredHash()).toBe(deliveredHash); expect(store.deliveries().find(item => item.id === interrupted.id)?.status).toBe("IN_FLIGHT");
      expect(store.state(MONITOR_SCOPE).lastAccepted?.cycleId).toBe("concurrent_cycle");
    } finally { store.close(); }
  }, 30_000);
  it.each([2, 4])("restores schema %s in isolation, migrates forward and preserves terminal/pending/cooldown history", async version => {
    const file = path("legacy-backup.sqlite"), output = path("legacy-backup"); legacy(file, version, true);
    const original = await hashFile(file); const result = await createBackup(file, output);
    expect(result.schemaVersion).toBe(version);
    expect(await verifyRestore(output, path("legacy-scratch"))).toMatchObject({ passed: true, priorSchemaVersion: version, restoredSchemaVersion: 5, recoveredAmbiguous: 1 });
    expect(await hashFile(file)).toBe(original);
  });
  it.each(["manifest", "database", "extra-nested-file", "missing-file"])("rejects a %s backup integrity failure without restoring", async kind => {
    const file = path("tamper.sqlite"), output = path("tamper-backup"); new MonitorStore(file).close(); await createBackup(file, output);
    if (kind === "manifest") writeFileSync(join(output, "manifest.json"), "{}\n");
    if (kind === "database") writeFileSync(join(output, "database.sqlite"), "not a SQLite database");
    if (kind === "extra-nested-file") { mkdirSync(join(output, "unexpected/nested"), { recursive: true }); writeFileSync(join(output, "unexpected/nested/file"), "fixture"); }
    if (kind === "missing-file") rmSync(join(output, "database.sqlite"));
    const scratch = path("not-created");
    await expect(verifyBackup(output)).rejects.toMatchObject({ code: "BACKUP_INVALID" });
    await expect(verifyRestore(output, scratch)).rejects.toMatchObject({ code: "BACKUP_INVALID" }); expect(existsSync(scratch)).toBe(false);
  });
  it("refuses existing destinations, insufficient reserve and restore paths inside the immutable backup", async () => {
    const file = path("exclusive.sqlite"), output = path("exclusive-backup"); new MonitorStore(file).close(); await createBackup(file, output);
    await expect(createBackup(file, output)).rejects.toMatchObject({ code: "BACKUP_EXISTS" });
    await expect(verifyRestore(output, join(output, "scratch"))).rejects.toMatchObject({ code: "RESTORE_PATH" });
    const lowDisk = path("reserve-not-created");
    await expect(createBackup(file, lowDisk, { limits: resourceSchema.parse({ minFreeBytes: Number.MAX_SAFE_INTEGER }) })).rejects.toMatchObject({ code: "RESOURCE_DISK_RESERVE" });
    expect(existsSync(lowDisk)).toBe(false); expect(await verifyBackup(output)).toMatchObject({ passed: true });
  });
  it("rejects missing required reviewed evidence and retains an explicitly incomplete capture", async () => {
    const file = path("missing-evidence.sqlite"), store = new MonitorStore(file); store.acquireMonitor(); persistFixture(store, base); store.close();
    const output = path("incomplete-backup");
    await expect(createBackup(file, output, { projectRoot: path("missing-project") })).rejects.toBeInstanceOf(DataError);
    expect(existsSync(join(output, "database.sqlite"))).toBe(true); expect(existsSync(join(output, "manifest.sha256"))).toBe(false);
    await expect(verifyBackup(output)).rejects.toMatchObject({ code: "BACKUP_INVALID" });
  });
});
