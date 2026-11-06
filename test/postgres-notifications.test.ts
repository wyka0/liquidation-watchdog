import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseMonitoringConfiguration } from "../src/config/monitoring.js";
import { postgresConfiguration } from "../src/config/postgres.js";
import { parseThresholds } from "../src/config/risk.js";
import { ConsoleAdapter, notificationAdapters } from "../src/notifications/adapters.js";
import { PostgresRuntime } from "../src/runtime/postgres-runtime.js";
import { PgConnection } from "../src/storage/postgres/connection.js";
import { demoPositionConfiguration } from "../src/config/position.js";

const telegramCredential = [42_000_000, "fixture".repeat(6)].join(":"), telegramDestination = "-123456789";
function databaseConfiguration() {
  const url = new URL("postgresql://fixture.invalid/phase10");
  url.username = "fixture_writer"; url.password = randomBytes(32).toString("base64url");
  const writer = url.href; url.username = "fixture_reader";
  return postgresConfiguration({ WATCHDOG_STORAGE_BACKEND: "postgres", WATCHDOG_POSTGRES_NAMESPACE: "fixture",
    WATCHDOG_POSTGRES_WRITER_URL: writer, WATCHDOG_POSTGRES_READER_URL: url.href });
}
function credentials() { return { readCredential: randomBytes(32).toString("base64url"), schedulerCredential: randomBytes(32).toString("base64url") }; }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("STAGE3B FIXTURE: PostgreSQL runtime notification wiring", () => {
  it("constructs safe console-only adapters when no provider is configured", async () => {
    const monitoring = parseMonitoringConfiguration(), environment = new Proxy({}, { get() { throw new Error("unexpected secret read"); } });
    const adapters = notificationAdapters(monitoring, () => {}, environment), runtime = new PostgresRuntime({
      configuration: databaseConfiguration(), monitoring, thresholds: parseThresholds(), position: demoPositionConfiguration(), adapters, ...credentials(), port: 0 });
    expect(runtime.notificationChannels).toEqual(["console"]);
    const transaction = vi.spyOn(PgConnection.prototype, "transaction"), address = await runtime.start();
    expect(address.port).toBeGreaterThan(0); expect(runtime.status()).toBe("DISABLED"); expect(transaction).not.toHaveBeenCalled();
    await runtime.stop(); expect(await runtime.done).toBe(0);
  });

  it("constructs exactly the explicitly enabled Telegram and console adapters without a network call", async () => {
    const network = vi.fn(); vi.stubGlobal("fetch", network);
    const monitoring = parseMonitoringConfiguration({ notifications: { telegram: true } });
    const adapters = notificationAdapters(monitoring, () => {}, {
      WATCHDOG_TELEGRAM_BOT_TOKEN: telegramCredential, WATCHDOG_TELEGRAM_CHAT_ID: telegramDestination });
    const runtime = new PostgresRuntime({ configuration: databaseConfiguration(), monitoring, thresholds: parseThresholds(), position: demoPositionConfiguration(),
      adapters, ...credentials(), port: 0 });
    expect(runtime.notificationChannels).toEqual(["console", "telegram"]); expect(network).not.toHaveBeenCalled();
    await runtime.start(); expect(network).not.toHaveBeenCalled(); await runtime.stop();
  });

  it("rejects an enabled provider with missing credentials before runtime or database work", () => {
    const monitoring = parseMonitoringConfiguration({ notifications: { telegram: true } });
    const transaction = vi.spyOn(PgConnection.prototype, "transaction");
    expect(() => notificationAdapters(monitoring, () => {}, {})).toThrowError(/WATCHDOG_TELEGRAM/);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("fails closed when injected adapters do not exactly match explicit configuration", async () => {
    const monitoring = parseMonitoringConfiguration({ notifications: { telegram: true } });
    const transaction = vi.spyOn(PgConnection.prototype, "transaction"), runtime = new PostgresRuntime({
      configuration: databaseConfiguration(), monitoring, thresholds: parseThresholds(), position: demoPositionConfiguration(), adapters: [new ConsoleAdapter(() => {})],
      ...credentials(), port: 0 });
    await expect(runtime.start()).rejects.toMatchObject({ code: "RUNTIME_STARTUP" });
    expect(runtime.status()).toBe("FAILED"); expect(transaction).not.toHaveBeenCalled(); await runtime.stop();
  });
});
