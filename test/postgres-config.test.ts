import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { connectionConfiguration, postgresConfiguration, PG_LIMITS, SLOT_PERIOD_DEFAULT_SECONDS } from "../src/config/postgres.js";
import { parseThresholds } from "../src/config/risk.js";
import { parseMonitoringConfiguration } from "../src/config/monitoring.js";
import { counter, sequence, utcText } from "../src/storage/postgres/codec.js";
import { PgConnection } from "../src/storage/postgres/connection.js";
import { PostgresRuntime } from "../src/runtime/postgres-runtime.js";
import { schedulerAuthenticator, slotSchemaFor, slotUtcMinutes } from "../src/runtime/scheduler-contract.js";
import { ConsoleAdapter } from "../src/notifications/adapters.js";
import { demoPositionConfiguration } from "../src/config/position.js";

function input() {
  const url = new URL("postgresql://fixture.invalid/phase10");
  url.username = "fixture_writer"; url.password = randomBytes(32).toString("base64url");
  const writer = url.href; url.username = "fixture_reader";
  return { WATCHDOG_STORAGE_BACKEND: "postgres", WATCHDOG_POSTGRES_NAMESPACE: "fixture",
    WATCHDOG_POSTGRES_WRITER_URL: writer, WATCHDOG_POSTGRES_READER_URL: url.href };
}

describe("PHASE10 FIXTURE: explicit configuration and exact codecs", () => {
  it("requires explicit selection and separate roles, defaults scheduling off, and verifies TLS", () => {
    const environment = input(), parsed = postgresConfiguration(environment);
    expect(parsed.schedulerEnabled).toBe(false);
    expect(parsed.slotPeriodSeconds).toBe(300);
    expect(SLOT_PERIOD_DEFAULT_SECONDS).toBe(300);
    expect(parsed.writer).toMatchObject({ host: "fixture.invalid", user: "fixture_writer", database: "phase10",
      ssl: { rejectUnauthorized: true }, sslnegotiation: "postgres", options: "-c search_path=pg_catalog",
      application_name: "liquidation-watchdog", client_encoding: "UTF8" });
    expect(parsed.reader.user).toBe("fixture_reader");
    expect(() => postgresConfiguration({ ...environment, WATCHDOG_STORAGE_BACKEND: undefined })).toThrowError(/Explicit/);
    expect(() => postgresConfiguration({ ...environment, WATCHDOG_STORAGE_BACKEND: "sqlite" })).toThrowError(/Explicit/);
    expect(() => postgresConfiguration({ ...environment, WATCHDOG_POSTGRES_READER_URL: environment.WATCHDOG_POSTGRES_WRITER_URL })).toThrowError(/Explicit/);
    expect(() => postgresConfiguration({ ...environment, WATCHDOG_SCHEDULER_ENABLED: "yes" })).toThrowError(/Explicit/);
  });
  it.each(["", "0", "-300", "01", "300.0", "3e2", "239", "301", "420", "3601"])("rejects invalid scheduler interval %j at startup", value => {
    expect(() => postgresConfiguration({ ...input(), WATCHDOG_SCHEDULER_SLOT_SECONDS: value })).toThrowError(/POSTGRES_CONFIG|scheduler|SCHEDULER/i);
  });
  it.each(["240", "300", "600", "900", "1800", "3600"])("accepts bounded whole-minute scheduler interval %s", value => {
    expect(postgresConfiguration({ ...input(), WATCHDOG_SCHEDULER_SLOT_SECONDS: value }).slotPeriodSeconds).toBe(Number(value));
  });
  it("builds the approved five-minute UTC grid from the configured interval", () => {
    expect(slotUtcMinutes(300)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    expect(slotSchemaFor(300).safeParse("2026-11-02T12:55:00.000Z").success).toBe(true);
    expect(slotSchemaFor(300).safeParse("2026-11-02T12:57:00.000Z").success).toBe(false);
  });
  it.each(["sslmode=disable", "sslmode=no-verify", "sslrootcert=file", "sslkey=file", "sslcert=file", "options=bad", "channel_binding=disable",
    "channel_binding=require&channel_binding=require", "sslmode=require&sslmode=require"])("rejects URL option %s without reflecting its value", query => {
    const value = `${input().WATCHDOG_POSTGRES_WRITER_URL}?${query}`;
    try { connectionConfiguration(value); throw new Error("Expected configuration refusal"); }
    catch (error) { expect(error).toMatchObject({ code: "POSTGRES_CONFIG" }); expect(String(error)).not.toContain(value); }
  });
  it.each(["require", "verify-full"])("retains peer verification even with sslmode=%s", mode => {
    expect(connectionConfiguration(`${input().WATCHDOG_POSTGRES_WRITER_URL}?sslmode=${mode}`).ssl).toEqual({ rejectUnauthorized: true });
  });
  it("omits only the incompatible startup option for a pooled endpoint", () => {
    const neon = new URL(input().WATCHDOG_POSTGRES_WRITER_URL);
    neon.hostname = "ep-example-pooler.us-east-2.aws.neon.tech"; neon.pathname = "/neondb";
    neon.search = "?sslmode=verify-full&channel_binding=require";
    const value = connectionConfiguration(neon.href);
    expect(value).toMatchObject({ host: "ep-example-pooler.us-east-2.aws.neon.tech", database: "neondb",
      user: "fixture_writer", ssl: { rejectUnauthorized: true }, sslnegotiation: "postgres", enableChannelBinding: true,
      application_name: "liquidation-watchdog", client_encoding: "UTF8" });
    expect(value.options).toBeUndefined();
  });
  it("retains startup search-path hardening for the matching direct endpoint", () => {
    const neon = new URL(input().WATCHDOG_POSTGRES_WRITER_URL);
    neon.hostname = "ep-example.us-east-2.aws.neon.tech"; neon.pathname = "/neondb";
    neon.search = "?sslmode=verify-full&channel_binding=require";
    expect(connectionConfiguration(neon.href)).toMatchObject({ options: "-c search_path=pg_catalog",
      ssl: { rejectUnauthorized: true }, sslnegotiation: "postgres", enableChannelBinding: true,
      application_name: "liquidation-watchdog", client_encoding: "UTF8" });
  });
  it.each(["0", "01", "-1", "1.0", "1e3", "9223372036854775808"])("rejects unsafe/noncanonical bigint cursor %s", value => {
    expect(() => sequence(value)).toThrowError(/cursor/);
  });
  it("round-trips a maximal int8 cursor and converts only safe operational counters", () => {
    expect(sequence("9223372036854775807")).toBe("9223372036854775807");
    expect(counter("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
    expect(counter("0")).toBe(0); expect(() => counter("9007199254740992")).toThrowError(/validation/);
    expect(() => counter(1)).toThrowError(/validation/);
    expect(utcText("2026-11-02T12:07:00.123456Z")).toBe("2026-11-02T12:07:00.123456Z");
    expect(() => utcText("2026-11-02T12:07:00.1234567Z")).toThrowError(/validation/);
  });
  it("requires separate scheduler entropy/format and rejects Basic, malformed and read credentials", () => {
    const read = randomBytes(32).toString("base64url"), secret = randomBytes(32).toString("base64url"), auth = schedulerAuthenticator(secret, read);
    expect(auth(`Bearer ${secret}`)).toBe(true);
    for (const value of [undefined, `Bearer ${read}`, `Basic ${Buffer.from(`watchdog:${secret}`).toString("base64")}`, `bearer ${secret}`, `Bearer ${secret} `, "x".repeat(301)]) expect(auth(value)).toBe(false);
    expect(() => schedulerAuthenticator(read, read)).toThrowError(/distinct/);
    expect(() => schedulerAuthenticator("short")).toThrowError(/dedicated/);
    expect(PG_LIMITS).toMatchObject({ connectionsPerRole: 1, queuedPerRole: 3, connectMs: 5_000, idleMs: 5_000,
      queryMs: 6_000, transactionMs: 10_000, readTransactionMs: 4_000, writerStatementMs: 5_000,
      readerStatementMs: 1_000, lockMs: 1_000, closeMs: 5_000,
      cycleMs: 240_000, jobMs: 300_000, leaseSeconds: 360, httpMs: 420_000 });
  });
  it("starts and serves health without a database query or monitoring job", async () => {
    const transaction = vi.spyOn(PgConnection.prototype, "transaction"), runtime = new PostgresRuntime({ configuration: postgresConfiguration(input()),
      monitoring: parseMonitoringConfiguration(), thresholds: parseThresholds(), position: demoPositionConfiguration(), adapters: [new ConsoleAdapter(() => {})],
      readCredential: randomBytes(32).toString("base64url"), schedulerCredential: randomBytes(32).toString("base64url"), port: 0 });
    try {
      expect(transaction).not.toHaveBeenCalled();
      const address = await runtime.start();
      const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
      expect(await response.json()).toEqual({ status: "DISABLED" }); expect(transaction).not.toHaveBeenCalled();
      await runtime.stop(); expect(await runtime.done).toBe(0); expect(transaction).not.toHaveBeenCalled();
    } finally { await runtime.stop(); transaction.mockRestore(); }
  });
  it("fails closed on tampered injected thresholds before opening any pool, listener or transaction", async () => {
    const transaction = vi.spyOn(PgConnection.prototype, "transaction"), valid = parseThresholds({ warningRatio: "1.5", criticalRatio: "1.2", targetRatio: "1.4" });
    const tampered = { ...valid, wad: { ...valid.wad, warningRatio: valid.wad.criticalRatio } };
    const runtime = new PostgresRuntime({ configuration: postgresConfiguration(input()), thresholds: tampered,
      monitoring: parseMonitoringConfiguration(), position: demoPositionConfiguration(valid), adapters: [new ConsoleAdapter(() => {})],
      readCredential: randomBytes(32).toString("base64url"), schedulerCredential: randomBytes(32).toString("base64url"), port: 0 });
    try {
      await expect(runtime.start()).rejects.toMatchObject({ code: "RUNTIME_STARTUP" });
      expect(transaction).not.toHaveBeenCalled();
    } finally { await runtime.stop(); transaction.mockRestore(); }
  });
});
