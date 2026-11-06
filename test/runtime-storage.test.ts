import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import * as promises from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseMonitoringConfiguration } from "../src/config/monitoring.js";
import { hashParts } from "../src/monitoring/model.js";
import { APPLICATION_ID, MIGRATIONS } from "../src/storage/migrations.js";
import { MonitorStore } from "../src/storage/store.js";
import { isDiskMount, ownWorkspace, prepareWorkspace, seedBindings, verifyWorkspaceReferences } from "../src/runtime/workspace.js";
import { monitoringFixture, persistFixture } from "./fixtures/phase4.js";
import { runtimeFixture } from "./fixtures/runtime.js";

vi.mock("node:fs/promises", async importOriginal => {
  const original = await importOriginal<typeof promises>();
  return { ...original, access: vi.fn(original.access) };
});

const directories: string[] = [];
const fixture = () => { const result = runtimeFixture(); directories.push(result.directory); return result; };
afterEach(() => { vi.restoreAllMocks(); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("PHASE8 FIXTURE: existing-only storage and persistent workspace", () => {
  it("does not create a missing runtime database or its parents", () => {
    const h = fixture(), path = join(h.directory, "absent/absent.sqlite");
    expect(() => new MonitorStore(path, { existingOnly: true })).toThrow("explicit initialization");
    expect(existsSync(join(h.directory, "absent"))).toBe(false);
  });
  it("preserves an empty or corrupt existing file and refuses implicit initialization", () => {
    const h = fixture();
    for (const text of ["", "synthetic invalid database"]) {
      writeFileSync(h.options.database, text);
      expect(() => new MonitorStore(h.options.database, { existingOnly: true })).toThrow();
      expect(readFileSync(h.options.database, "utf8")).toBe(text);
    }
  });
  it("requires explicit migration and preserves a legacy database byte for byte", () => {
    const h = fixture(), db = new DatabaseSync(h.options.database);
    for (const [index, sql] of MIGRATIONS.slice(0, 4).entries()) { db.exec(sql); db.prepare("INSERT INTO schema_migrations VALUES(?,?)").run(index + 1, hashParts(sql)); }
    db.exec(`PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=4`); db.close();
    const before = readFileSync(h.options.database);
    expect(() => new MonitorStore(h.options.database, { existingOnly: true })).toThrow("explicit database-init");
    expect(readFileSync(h.options.database)).toEqual(before);
  });
  it("preserves current schema/content on existing-only opens and retains the writer fence", async () => {
    const h = fixture(), writer = new MonitorStore(h.options.database); writer.acquireMonitor(); persistFixture(writer, await monitoringFixture());
    const hashes = writer.contentHashes();
    expect(() => new MonitorStore(h.options.database, { existingOnly: true })).toThrow("exclusive monitor lock"); writer.close();
    const reopened = new MonitorStore(h.options.database, { existingOnly: true });
    try { expect(reopened.contentHashes()).toEqual(hashes); reopened.validateAll(); } finally { reopened.close(); }
  });
  it("exclusively seeds pinned evidence, checks existing bytes, and fences a second service", async () => {
    const h = fixture(), workspace = await prepareWorkspace(h.options, h.options.configuration), bindings = seedBindings(h.options.releaseRoot);
    expect(workspace.seededFiles).toBe(bindings.length); expect(bindings.length).toBeGreaterThan(4);
    const before = readFileSync(join(workspace.runtimeRoot, bindings[0]!.path));
    expect((await prepareWorkspace(h.options, h.options.configuration)).seededFiles).toBe(bindings.length);
    expect(readFileSync(join(workspace.runtimeRoot, bindings[0]!.path))).toEqual(before);
    const release = ownWorkspace(workspace);
    try { expect(() => ownWorkspace(workspace)).toThrow("already has an owner"); } finally { release(); release(); }
    ownWorkspace(workspace)(); expect(existsSync(h.options.database)).toBe(false);
  });
  it("refuses a changed runtime evidence copy without replacing it or touching its release source", async () => {
    const h = fixture(); await prepareWorkspace(h.options, h.options.configuration);
    const ref = seedBindings(h.options.releaseRoot)[0]!, source = readFileSync(join(h.options.releaseRoot, ref.path));
    const target = join(h.options.runtimeRoot, ref.path); writeFileSync(target, "synthetic conflict");
    await expect(prepareWorkspace(h.options, h.options.configuration)).rejects.toMatchObject({ code: "RUNTIME_STORAGE" });
    expect(readFileSync(target, "utf8")).toBe("synthetic conflict"); expect(readFileSync(join(h.options.releaseRoot, ref.path))).toEqual(source);
  });
  it("checks persisted evidence references and fails on a missing local artifact", async () => {
    const h = fixture(); await prepareWorkspace(h.options, h.options.configuration);
    const writer = new MonitorStore(h.options.database); writer.acquireMonitor(); persistFixture(writer, await monitoringFixture()); writer.close();
    const reader = new MonitorStore(h.options.database, { readOnly: true });
    try {
      await verifyWorkspaceReferences(reader, h.options.runtimeRoot);
      rmSync(join(h.options.runtimeRoot, reader.localEvidenceReferences()[0]!.path));
      await expect(verifyWorkspaceReferences(reader, h.options.runtimeRoot)).rejects.toMatchObject({ code: "RUNTIME_STORAGE" });
    } finally { reader.close(); }
  });
  it("refuses missing mount roots, relative paths, mismatched DB paths and disk-reserve exhaustion", async () => {
    const h = fixture();
    for (const options of [{ ...h.options, runtimeRoot: "runtime" }, { ...h.options, runtimeRoot: join(h.directory, "missing/runtime") },
      { ...h.options, database: join(h.directory, "wrong.sqlite") }]) {
      await expect(prepareWorkspace(options, h.options.configuration)).rejects.toMatchObject({ code: "RUNTIME_STORAGE" });
    }
    expect(existsSync(join(h.directory, "missing"))).toBe(false);
    const configuration = parseMonitoringConfiguration({ ...h.options.configuration, resources: { ...h.options.configuration.resources, minFreeBytes: Number.MAX_SAFE_INTEGER } });
    await expect(prepareWorkspace(h.options, configuration)).rejects.toMatchObject({ code: "RUNTIME_STORAGE" });
  });
  it("fails a permission-denied writable probe before creating a database (injected EACCES)", async () => {
    const h = fixture(); vi.mocked(promises.access).mockRejectedValueOnce(Object.assign(new Error("synthetic permission denial"), { code: "EACCES" }));
    await expect(prepareWorkspace(h.options, h.options.configuration)).rejects.toMatchObject({ code: "RUNTIME_STORAGE" });
    expect(existsSync(h.options.database)).toBe(false);
  });
  it("refuses symlink/junction directories and hardlinked databases", async () => {
    const h = fixture(), target = join(h.directory, "alias-target"); mkdirSync(target); symlinkSync(target, h.options.runtimeRoot, "junction");
    await expect(prepareWorkspace(h.options, h.options.configuration)).rejects.toMatchObject({ code: "RUNTIME_STORAGE" });
    rmSync(h.options.runtimeRoot); new MonitorStore(h.options.database).close(); linkSync(h.options.database, join(h.directory, "alias.sqlite"));
    expect(() => new MonitorStore(h.options.database, { existingOnly: true })).toThrow();
  });
  it("recognizes only an explicit writable non-ephemeral Linux mount", () => {
    const mount = "/var/data/watchdog", info = `45 26 8:1 / ${mount} rw,relatime - ext4 /dev/sda rw\n`;
    expect(isDiskMount(info, mount)).toBe(true);
    for (const invalid of [info.replace(" rw,", " ro,"), info.replace("ext4", "overlay"), info.replace("ext4", "tmpfs"), info.replace(mount, "/var/data/other")]) expect(isDiskMount(invalid, mount)).toBe(false);
  });
  it("does not accept a local scratch directory as a production Render disk", async () => {
    const h = fixture(), configuration = parseMonitoringConfiguration({ ...h.options.configuration, operations: { ...h.options.configuration.operations, profile: "production" } });
    await expect(prepareWorkspace(h.options, configuration)).rejects.toMatchObject({ code: "RUNTIME_STORAGE" });
  });
  it("bounds a real SQLite competing-write lock and rolls back without partial state", () => {
    const h = fixture(), writer = new MonitorStore(h.options.database); writer.acquireMonitor(); const before = writer.contentHashes();
    const blocker = new DatabaseSync(h.options.database);
    try {
      blocker.exec("BEGIN IMMEDIATE"); const started = performance.now();
      expect(() => writer.beginCycle("locked_write", "a".repeat(64), new Date().toISOString())).toThrow("rolled back");
      expect(performance.now() - started).toBeLessThan(2_000); blocker.exec("ROLLBACK"); expect(writer.contentHashes()).toEqual(before); writer.validateAll();
    } finally { blocker.close(); writer.close(); }
  });
});
