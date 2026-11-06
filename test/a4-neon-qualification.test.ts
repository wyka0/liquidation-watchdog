import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as CatalogModule from "../src/storage/postgres/catalog.js";
import type * as MigrationsModule from "../src/storage/postgres/migrations.js";

const mocks = vi.hoisted(() => ({
  mode: "preflight" as "preflight" | "absent" | "exact" | "partial" | "active" | "nonempty" | "wrong-target" | "unreachable",
  hang: null as null | "begin" | "settings" | "close", clientCreated: 0, applyCalls: 0,
  applyError: null as Error | null, verifyError: null as Error | null, catalog: "24b4fea1efeab7c49999dd693f59ddc9aa776bcb4d4e262185978c9630c80ba3",
  queries: [] as string[]
}));
vi.mock("pg", () => {
  class Client {
    constructor(_configuration: unknown) { mocks.clientCreated++; }
    async connect() { if (mocks.mode === "unreachable") throw new Error("private network detail"); }
    async query(text: string) {
      mocks.queries.push(text);
      if ((mocks.hang === "begin" && text.startsWith("BEGIN")) || (mocks.hang === "settings" && text.includes("set_config"))) return new Promise(() => {});
      if (text.includes("server_version_num")) {
        if (mocks.mode === "preflight") return { rows: [{ server_version: "170011", database_name: "neondb", schema_name: null, migration_table: null }] };
        if (mocks.mode === "absent") return { rows: [{ server_version: "170011", database_name: "neondb", schema_name: null, migration_table: null, identity_table: null, lease_table: null }] };
        if (mocks.mode === "wrong-target") return { rows: [{ server_version: "180001", database_name: "other", schema_name: null, migration_table: null, identity_table: null, lease_table: null }] };
        return { rows: [{ server_version: "170011", database_name: "neondb", schema_name: "watchdog_pg",
          migration_table: "watchdog_pg.schema_migrations", identity_table: "watchdog_pg.database_identity", lease_table: "watchdog_pg.worker_lease" }] };
      }
      if (text.includes("pg_locks")) return { rows: [{ count: "0" }] };
      if (text.includes("schema_migrations ORDER")) return { rows: mocks.mode === "partial" ? [{ version: 1, checksum: "f".repeat(64) }]
        : [{ version: 1, checksum: "7d682b2267b9d35d0a6ed01511dc0342a3ef801051e0ee0fdf8f0c60a09b015d" },
          { version: 2, checksum: "7b8aa97bf0a386081b79bd5d6eb36c57af91d5c40cd3498302dd4615d4a9eb75" }] };
      if (text.includes("database_identity ORDER")) return { rows: [{ id: 1, backend: "liquidation-watchdog-pg", namespace: "watchdog_free",
        incarnation: "11111111-1111-4111-8111-111111111111" }] };
      if (text.includes("worker_lease ORDER")) return { rows: [{ id: 1, incarnation: "11111111-1111-4111-8111-111111111111",
        fence: mocks.mode === "active" ? "1" : "0", owner: mocks.mode === "active" ? "owner" : null,
        expires_at: null, deadline_at: null, current_execution: null, high_water_slot: null }] };
      if (text.includes("FROM watchdog_pg.cycles) AS cycles")) {
        const value = mocks.mode === "nonempty" ? "1" : "0";
        return { rows: [{ cycles: value, streams: "0", fingerprints: "0", alerts: "0", deliveries: "0", delivery_attempts: "0",
          delivery_events: "0", provider_limits: "0", oracle_assurance: "0", worker_runtime: "0", operational_events: "0", scheduled_executions: "0" }] };
      }
      return { rows: [] };
    }
    async end() { if (mocks.hang === "close") return new Promise(() => {}); }
  }
  const client = { query: async () => ({ rows: [] }), release: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
  class Pool { totalCount = 1; idleCount = 1; waitingCount = 0; connect = async () => client; end = async () => {}; on = vi.fn(); }
  return { Client, Pool, types: { getTypeParser: () => (value: string) => value } };
});
vi.mock("../src/storage/postgres/migrations.js", async importOriginal => {
  const actual = await importOriginal<typeof MigrationsModule>();
  return { ...actual,
    applyPostgresMigrations: async () => { mocks.applyCalls++; if (mocks.applyError) throw mocks.applyError; },
    verifyPostgresSchema: async () => { if (mocks.verifyError) throw mocks.verifyError; return "11111111-1111-4111-8111-111111111111"; }
  };
});
vi.mock("../src/storage/postgres/catalog.js", async importOriginal => {
  const actual = await importOriginal<typeof CatalogModule>();
  return { ...actual, postgresCatalogFingerprint: async () => mocks.catalog };
});

import { A4_APPROVED_CATALOG_FINGERPRINT, A4_APPROVED_MIGRATION_CHECKSUMS, A4_METADATA_FUTURE_SKEW_MS,
  A4_METADATA_MAX_AGE_MS, A4_TARGET, createA4MetadataBinding, inspectA4ProductionUnknownOutcome,
  runA4ProductionQualification } from "../scripts/a4-neon-qualification.js";
import type { A4NeonMetadata } from "../scripts/a4-neon-qualification.js";

const names = ["WATCHDOG_A4_DIRECT_URL", "WATCHDOG_A4_METADATA_BINDING_FILE", "WATCHDOG_A4_METADATA_SHA256",
  "WATCHDOG_A4_ATTEMPT_STATE_FILE", "WATCHDOG_POSTGRES_WRITER_URL", "WATCHDOG_POSTGRES_READER_URL", "DATABASE_URL"] as const;
let directory: string;
const host = "ep-disposable.us-east-2.aws.neon.tech", hostHash = createHash("sha256").update(host).digest("hex");
function metadata(override: Partial<A4NeonMetadata> = {}): A4NeonMetadata {
  return { kind: "A4_NEON_METADATA", schemaVersion: 1, projectId: "quiet-field-12345678", projectName: A4_TARGET.projectName,
    branchId: "br-target123", branchName: A4_TARGET.branchName, parentBranchId: "br-parent123", parentBranchName: A4_TARGET.parentBranchName,
    endpointId: "ep-target123", endpointType: "direct", databaseName: "neondb", postgresMajor: 17,
    directHostnameSha256: hostHash, directPort: 5432, retrievedAt: new Date().toISOString(), ...override };
}
function installAuthority(override: Partial<A4NeonMetadata> = {}, trustedHash?: string) {
  const binding = createA4MetadataBinding(metadata(override)), filename = join(directory, "binding.json"), state = join(directory, "attempt.json");
  writeFileSync(filename, JSON.stringify(binding));
  process.env.WATCHDOG_A4_METADATA_BINDING_FILE = filename;
  process.env.WATCHDOG_A4_METADATA_SHA256 = trustedHash ?? binding.sha256;
  process.env.WATCHDOG_A4_ATTEMPT_STATE_FILE = state;
  const url = new URL(`postgresql://watchdog_operator:${randomBytes(32).toString("base64url")}@${host}:5432/neondb`);
  url.searchParams.set("sslmode", "verify-full"); url.searchParams.set("channel_binding", "require");
  process.env.WATCHDOG_A4_DIRECT_URL = url.href;
  return { binding, filename, state, url };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-04T12:00:00.000Z"));
  const base = join(tmpdir(), "opencode"); mkdirSync(base, { recursive: true }); directory = mkdtempSync(join(base, "a4-safety-"));
  for (const name of names) delete process.env[name];
  Object.assign(mocks, { mode: "preflight", hang: null, clientCreated: 0, applyCalls: 0, applyError: null, verifyError: null,
    catalog: A4_APPROVED_CATALOG_FINGERPRINT, queries: [] });
});
afterEach(() => { vi.useRealTimers(); for (const name of names) delete process.env[name]; rmSync(directory, { recursive: true, force: true }); });
async function settle<T>(promise: Promise<T>, milliseconds = 7_000): Promise<T> { await vi.advanceTimersByTimeAsync(milliseconds); return promise; }

describe("A4.3: protected metadata authority", () => {
  it("rejects a self-supplied binding when the protected hash differs", async () => {
    installAuthority({}, "f".repeat(64));
    expect(await runA4ProductionQualification()).toMatchObject({ status: "STOP", retryAllowed: false });
    expect(mocks.clientCreated).toBe(0); expect(mocks.applyCalls).toBe(0);
  });
  it.each([
    { retrievedAt: new Date(Date.now() - A4_METADATA_MAX_AGE_MS - 1).toISOString() },
    { retrievedAt: new Date(Date.now() + A4_METADATA_FUTURE_SKEW_MS + 1).toISOString() }
  ])("rejects stale or future metadata %#", async override => {
    installAuthority(override);
    expect(await runA4ProductionQualification()).toMatchObject({ status: "STOP", code: "A4_METADATA_EXPIRED" });
    expect(mocks.clientCreated).toBe(0);
  });
});

describe("A4.3: sealed environment and endpoint", () => {
  it.each(["WATCHDOG_POSTGRES_WRITER_URL", "WATCHDOG_POSTGRES_READER_URL", "DATABASE_URL"])("checks actual process.env for %s", async name => {
    installAuthority(); process.env[name] = "";
    expect(await runA4ProductionQualification()).toMatchObject({ status: "STOP" }); expect(mocks.clientCreated).toBe(0);
  });
  it.each([
    ["pooler", (url: URL) => { url.hostname = "ep-disposable-pooler.us-east-2.aws.neon.tech"; }],
    ["port", (url: URL) => { url.port = "5433"; }], ["database", (url: URL) => { url.pathname = "/other"; }],
    ["tls", (url: URL) => { url.searchParams.set("sslmode", "require"); }],
    ["channel", (url: URL) => { url.searchParams.delete("channel_binding"); }]
  ])("rejects %s before connection", async (_name, change) => {
    const configured = installAuthority(); change(configured.url); process.env.WATCHDOG_A4_DIRECT_URL = configured.url.href;
    expect(await runA4ProductionQualification()).toMatchObject({ status: "STOP" }); expect(mocks.clientCreated).toBe(0);
  });
});

describe("A4.3: bounded preflight and one-use attempt", () => {
  it.each(["begin", "settings", "close"] as const)("bounds hanging %s", async hang => {
    installAuthority(); mocks.hang = hang;
    const result = await settle(runA4ProductionQualification());
    expect(result).toMatchObject({ status: "STOP", retryAllowed: false }); expect(mocks.applyCalls).toBe(0);
  });
  it("creates a durable one-use attempt receipt before the exact migration runner", async () => {
    const configured = installAuthority();
    const first = await runA4ProductionQualification();
    expect(first).toMatchObject({ status: "QUALIFIED", retryAllowed: false }); expect(mocks.applyCalls).toBe(1);
    const receipt = JSON.parse(readFileSync(configured.state, "utf8"));
    expect(receipt).toMatchObject({ status: "MIGRATION_STARTED", metadataSha256: configured.binding.sha256,
      projectId: "quiet-field-12345678", branchId: "br-target123", endpointId: "ep-target123", port: 5432 });
    mocks.mode = "preflight";
    const replay = await runA4ProductionQualification();
    expect(replay).toMatchObject({ status: "STOP", retryAllowed: false }); expect(mocks.applyCalls).toBe(1);
  });
  it("blocks replay after a migration failure", async () => {
    installAuthority(); mocks.applyError = new Error("private marker");
    expect(await runA4ProductionQualification()).toEqual({ status: "MIGRATION_OUTCOME_REQUIRES_INSPECTION",
      retryAllowed: false, code: "A4_QUALIFICATION_FAILED" });
    mocks.applyError = null;
    expect(await runA4ProductionQualification()).toMatchObject({ status: "STOP", retryAllowed: false }); expect(mocks.applyCalls).toBe(1);
  });
  it("treats post-verification failure as outcome requiring inspection", async () => {
    installAuthority(); mocks.verifyError = new Error("private marker");
    const result = await runA4ProductionQualification();
    expect(result).toEqual({ status: "MIGRATION_OUTCOME_REQUIRES_INSPECTION", retryAllowed: false, code: "STORE_TRANSACTION_FAILED" });
    expect(JSON.stringify(result)).not.toContain("private marker");
  });
});

describe("A4.3: read-only unknown-outcome inspection", () => {
  it.each([
    ["absent", "FULLY_ABSENT"], ["exact", "EXACT_COMMITTED"], ["partial", "PARTIAL_OR_MISMATCHED"],
    ["active", "PARTIAL_OR_MISMATCHED"], ["nonempty", "PARTIAL_OR_MISMATCHED"],
    ["wrong-target", "INVALID_TARGET_OR_CONFIGURATION"], ["unreachable", "UNREACHABLE"]
  ] as const)("classifies %s as %s", async (mode, status) => {
    installAuthority(); mocks.mode = mode;
    const work = inspectA4ProductionUnknownOutcome();
    const result = mocks.hang ? await settle(work) : await work;
    expect(result).toEqual({ status, retryAllowed: false });
  });
  it("distinguishes invalid configuration from network unavailability", async () => {
    installAuthority({}, "f".repeat(64));
    expect(await inspectA4ProductionUnknownOutcome()).toEqual({ status: "INVALID_TARGET_OR_CONFIGURATION", retryAllowed: false });
    expect(mocks.clientCreated).toBe(0);
  });
  it("can inspect an unknown outcome after execution metadata ages beyond the start window", async () => {
    installAuthority(); mocks.mode = "exact"; vi.advanceTimersByTime(A4_METADATA_MAX_AGE_MS + 60_000);
    expect(await inspectA4ProductionUnknownOutcome()).toEqual({ status: "EXACT_COMMITTED", retryAllowed: false });
  });
});

describe("A4.3: immutable migration sources", () => {
  it("retains approved constants and exposes no production dependency injection", () => {
    expect(A4_APPROVED_MIGRATION_CHECKSUMS).toEqual([
      "7d682b2267b9d35d0a6ed01511dc0342a3ef801051e0ee0fdf8f0c60a09b015d",
      "7b8aa97bf0a386081b79bd5d6eb36c57af91d5c40cd3498302dd4615d4a9eb75"
    ]);
    expect(A4_APPROVED_CATALOG_FINGERPRINT).toBe("24b4fea1efeab7c49999dd693f59ddc9aa776bcb4d4e262185978c9630c80ba3");
    expect(runA4ProductionQualification.length).toBe(0); expect(inspectA4ProductionUnknownOutcome.length).toBe(0);
  });
});
