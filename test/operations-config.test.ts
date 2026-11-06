import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseCliOptions } from "../src/cli/options.js";
import { runCli } from "../src/cli/run.js";
import { DEPLOYMENT, NETWORK } from "../src/config/deployment.js";
import { loadMonitoringConfiguration, parseMonitoringConfiguration } from "../src/config/monitoring.js";
import { notificationConfiguration, validateStartupConfiguration, VERIFIED_RUNTIME } from "../src/config/production.js";
import { loadThresholds } from "../src/config/risk.js";
import { DataError } from "../src/domain/errors.js";
import type { Snapshot } from "../src/domain/types.js";
import { observe } from "../src/monitoring/observation.js";
import { operationalDiagnostics } from "../src/operations/diagnostics.js";
import { publicError, redactText } from "../src/operations/redaction.js";
import { databasePath, localPath } from "../src/storage/paths.js";
import { MonitorStore } from "../src/storage/store.js";
import { MONITOR_SCOPE, MONITOR_THRESHOLDS, persistFixture, riskFixture, temporaryMonitorDirectory, testClock } from "./fixtures/phase4.js";

const directory = temporaryMonitorDirectory(); let base: Snapshot, sequence = 0;
beforeAll(async () => { base = await riskFixture(); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
const config = () => parseMonitoringConfiguration({}, { database: join(directory, `operational-${++sequence}.sqlite`) });
// Synthetic provider credentials are constructed only for validation. No adapter or HTTP request is created.
const environment = { WATCHDOG_TELEGRAM_BOT_TOKEN: [42_000_000, "fixture".repeat(6)].join(":"), WATCHDOG_TELEGRAM_CHAT_ID: "-123456789",
  WATCHDOG_DISCORD_WEBHOOK_URL: ["https://discord.com/api/webhooks", "123456789", "fixture".repeat(6)].join("/") };

describe("FIXTURE: production configuration, redaction and local path boundaries", () => {
  it("does not access disabled notification credentials and distinguishes missing/invalid/enabled values", () => {
    const disabled = new Proxy({}, { get() { throw new Error("Unexpected environment access"); } });
    expect(validateStartupConfiguration(config(), { environment: disabled }).notifications).toEqual({ console: "ENABLED", telegram: "DISABLED", discord: "DISABLED" });
    const enabled = parseMonitoringConfiguration({ notifications: { telegram: true, discord: true } });
    expect(notificationConfiguration(enabled, {})).toMatchObject({ telegram: "MISSING", discord: "MISSING" });
    expect(notificationConfiguration(enabled, { ...environment, WATCHDOG_TELEGRAM_CHAT_ID: "\ninvalid", WATCHDOG_DISCORD_WEBHOOK_URL: "http://localhost/invalid" }))
      .toMatchObject({ telegram: "INVALID", discord: "INVALID" });
    const result = validateStartupConfiguration(enabled, { environment });
    expect(result).toMatchObject({ valid: true, notifications: { telegram: "CONFIGURED", discord: "CONFIGURED" }, secretValues: "OMITTED" });
    for (const value of Object.values(environment)) expect(JSON.stringify(result)).not.toContain(value);
  });
  it("requires the verified runtime, absolute database path and production timeout budgets", () => {
    const production = parseMonitoringConfiguration({ operations: { profile: "production" } });
    expect(validateStartupConfiguration(production, { runtime: { node: "v22.18.0", sqlite: "3.50.0" } }).errors)
      .toEqual(["PRODUCTION_RUNTIME_MISMATCH", "PRODUCTION_DATABASE_ABSOLUTE_PATH_REQUIRED"]);
    production.storage.path = config().storage.path;
    expect(validateStartupConfiguration(production, { runtime: VERIFIED_RUNTIME }).valid).toBe(true);
    production.operations.shutdownTimeoutSeconds = production.notifications.timeoutSeconds; production.operations.cycleTimeoutSeconds = 119;
    expect(validateStartupConfiguration(production, { runtime: VERIFIED_RUNTIME }).errors)
      .toEqual(["PRODUCTION_SHUTDOWN_BUDGET_INVALID", "PRODUCTION_CYCLE_BUDGET_INVALID"]);
  });
  it("rejects every missing fixed deployment field and chain/endpoint substitution", () => {
    for (const key of Object.keys(DEPLOYMENT)) {
      const changed = { ...DEPLOYMENT }; delete changed[key as keyof typeof changed];
      expect(validateStartupConfiguration(config(), { position: changed }).errors).toContain("MANDATORY_CHAIN_CONFIG_INVALID");
    }
    for (const chain of [{ ...NETWORK, chainId: 1 }, { ...NETWORK, rpc: "https://example.invalid" }, { ...NETWORK, mcp: "https://example.invalid" }]) {
      expect(validateStartupConfiguration(config(), { chain }).errors).toContain("MANDATORY_CHAIN_CONFIG_INVALID");
    }
  });
  it.each([
    { resources: { pendingDeliveries: 0 } }, { resources: { evidenceFiles: 1_000_001 } }, { operations: { cycleTimeoutSeconds: 0 } },
    { notifications: { maxPerDrain: 51 } }, { rpc: "https://example.invalid" }, { notifications: { token: "fixture-only" } }
  ])("fails closed on invalid or undocumented operational configuration %#", raw => { expect(() => parseMonitoringConfiguration(raw)).toThrow(DataError); });
  it.each(["../escape.sqlite", "file:local.sqlite", "\\\\server\\share\\local.sqlite", "C:relative.sqlite", "C:/path/local.sqlite:stream",
    "data/NUL.sqlite", "data/file . /x.sqlite", "evidence/phase5/local.sqlite", "data/local.sqlite ", "data/new\nline.sqlite"])(
    "rejects unsafe local database spelling case %#", path => { expect(() => databasePath(path)).toThrow(DataError); });
  it("rejects linked parents, hardlinked configuration and aliased database sidecars", async () => {
    const target = join(directory, "link-target"), junction = join(directory, "link-junction"); mkdirSync(target); symlinkSync(target, junction, "junction");
    expect(() => localPath(join(junction, "configuration.json"))).toThrow(DataError);
    const original = join(directory, "configuration.json"), alias = join(directory, "configuration-alias.json");
    writeFileSync(original, "{}"); linkSync(original, alias);
    await expect(loadMonitoringConfiguration(alias)).rejects.toMatchObject({ code: "MONITOR_CONFIG_FILE" });
    await expect(loadThresholds(alias)).rejects.toMatchObject({ code: "STORE_PATH" });
    const db = join(directory, "aliased.sqlite"), other = join(directory, "aliased-wal"); writeFileSync(other, "fixture"); linkSync(other, `${db}-wal`);
    expect(() => new MonitorStore(db)).toThrow(DataError); expect(existsSync(db)).toBe(false);
  });
  it("rejects potential secret and oversized configuration files without accepting their contents", async () => {
    await expect(loadMonitoringConfiguration(join(directory, "credentials.json"))).rejects.toMatchObject({ code: "MONITOR_CONFIG_FILE" });
    await expect(loadThresholds(join(directory, "keystore.json"))).rejects.toMatchObject({ code: "CONFIG_FILE" });
    const large = join(directory, "oversized.json"); writeFileSync(large, " ".repeat(32_769));
    await expect(loadMonitoringConfiguration(large)).rejects.toMatchObject({ code: "MONITOR_CONFIG_FILE" });
  });
  it("redacts arbitrary exception text, credentials, URLs and log-injection controls", () => {
    const text = `${environment.WATCHDOG_TELEGRAM_BOT_TOKEN} ${environment.WATCHDOG_DISCORD_WEBHOOK_URL} Bearer fixture-secret\n\u001b[31m`;
    const outputs = [redactText(text), JSON.stringify(publicError(new Error(text))), JSON.stringify(publicError(new DataError(text, text)))];
    for (const output of outputs) {
      for (const value of [environment.WATCHDOG_TELEGRAM_BOT_TOKEN, environment.WATCHDOG_DISCORD_WEBHOOK_URL, "fixture-secret"]) expect(output).not.toContain(value);
      expect(output).not.toMatch(/[\p{Cc}\p{Cf}]/u);
    }
    expect(redactText("x".repeat(10_000))).toHaveLength(1_024);
  });
});

describe("FIXTURE: local operational health/readiness and CLI inspection", () => {
  it("reports a missing database without initializing storage or probing the network", async () => {
    const configuration = config(), connectivity = vi.fn();
    const result = await operationalDiagnostics(configuration, MONITOR_THRESHOLDS, { now: testClock, connectivity });
    expect(result).toMatchObject({ database: { available: false, error: "STORE_NOT_FOUND" }, processHealth: { healthy: false },
      operationalReadiness: { readyForObservation: false }, oracleAssurance: "UNVERIFIED", freshness: "UNKNOWN", financialActionability: false, productionReleaseReady: false });
    expect(existsSync(configuration.storage.path)).toBe(false); expect(connectivity).not.toHaveBeenCalled();
  });
  it("reports a valid empty database as healthy but uninitialized and unready", async () => {
    const configuration = config(); new MonitorStore(configuration.storage.path).close();
    const before = readFileSync(configuration.storage.path);
    const result = await operationalDiagnostics(configuration, MONITOR_THRESHOLDS, { now: testClock });
    expect(result).toMatchObject({ processHealth: { healthy: true, ownership: "AVAILABLE", workerStatus: "NOT_RUNNING" },
      database: { available: true, schemaVersion: 5, connectionReadOnly: true }, monitoring: { initialized: false }, operationalReadiness: { readyForObservation: false } });
    expect(readFileSync(configuration.storage.path)).toEqual(before);
  });
  it("keeps fixture observations unready even when a mocked probe reports both providers reachable", async () => {
    const configuration = config(), store = new MonitorStore(configuration.storage.path); store.acquireMonitor();
    persistFixture(store, observe(base, "fixture_cycle", testClock(), MONITOR_THRESHOLDS, { allowFixture: true })); store.close();
    const connectivity = vi.fn(async () => ({ rpc: "REACHABLE" as const, mcp: "REACHABLE" as const, checkedAt: testClock().toISOString(), mode: "EXPLICIT_READ_ONLY_PROBE" as const }));
    const result = await operationalDiagnostics(configuration, MONITOR_THRESHOLDS, { now: testClock, probe: true, connectivity });
    expect(result).toMatchObject({ processHealth: { healthy: true }, monitoring: { currentAcceptedRead: false }, operationalReadiness: { readyForObservation: false } });
    expect(connectivity).toHaveBeenCalledOnce();
  });
  it.each(["RUNNING", "STALE", "UNFINISHED", "FAILED", "UNCLEAN", "STALLED", "UNKNOWN_OWNER", "OTHER_SCOPE"])(
    "separates %s worker/chain operational status from financial safety", async mode => {
    const configuration = config(), store = new MonitorStore(configuration.storage.path); store.acquireMonitor();
    // Synthetic live-mode input exercises the local status gate only. This is not saved as live-chain evidence.
    const observation = observe({ ...base, evidenceKind: "LIVE_CHAIN_READ" }, "synthetic_live_mode", testClock(), MONITOR_THRESHOLDS);
    expect(observation.accepted).toBe(true); persistFixture(store, observation);
    if (mode !== "UNKNOWN_OWNER") store.saveRuntime({ runId: "fixture_worker", scope: mode === "OTHER_SCOPE" ? "e".repeat(64) : MONITOR_SCOPE,
      pid: process.pid, startedAt: testClock().toISOString(), updatedAt: new Date(testClock().getTime() - (mode === "STALLED" ? 2_000_000 : 0)).toISOString(),
      status: mode === "FAILED" ? "FAILED" : "IDLE", error: mode === "FAILED" ? "WORKER_FAILED" : null, rssBytes: 32 * 1_024 ** 2 });
    if (mode === "UNFINISHED") store.beginCycle("unfinished", MONITOR_SCOPE, testClock().toISOString());
    if (mode === "UNCLEAN" || mode === "FAILED") store.close();
    try {
      const result = await operationalDiagnostics(configuration, MONITOR_THRESHOLDS, { now: () => new Date(testClock().getTime() + (mode === "STALE" ? 601_000 : 0)) });
      expect(result.operationalReadiness.readyForObservation).toBe(mode === "RUNNING");
      expect(result).toMatchObject({ oracleAssurance: "UNVERIFIED", freshness: "UNKNOWN", financialActionability: false, productionReleaseReady: false });
      if (mode === "RUNNING") expect(result).toMatchObject({ processHealth: { ownership: "HELD", workerStatus: "RUNNING" },
        resources: { memoryMeasurement: "WORKER_AS_OF_RUNTIME_RECORD", rssBytes: 32 * 1_024 ** 2 } });
      if (mode === "UNCLEAN") expect(result.processHealth.workerStatus).toBe("STOPPED_UNCLEAN");
      if (mode === "STALLED") expect(result.processHealth.workerStatus).toBe("STALLED");
      if (mode === "FAILED") expect(result.processHealth.workerStatus).toBe("FAILED");
      if (mode === "UNKNOWN_OWNER") expect(result.processHealth.workerStatus).toBe("OWNER_PRESENT_IDENTITY_UNKNOWN");
      if (mode === "OTHER_SCOPE") expect(result.operationalReadiness).toMatchObject({ workerCoherent: false });
    } finally { store.close(); }
  });
  it("refuses a connectivity probe when an enabled provider configuration is invalid", async () => {
    const configuration = config(); configuration.notifications.telegram = true;
    const connectivity = vi.fn();
    const result = await operationalDiagnostics(configuration, MONITOR_THRESHOLDS, { probe: true, environment: {}, connectivity });
    expect(result.configuration.errors).toContain("ENABLED_NOTIFICATION_CONFIG_INVALID"); expect(connectivity).not.toHaveBeenCalled();
  });
  it("routes read-only CLI commands without creating a database and rejects ambiguous operational flags", async () => {
    const configuration = config(), output: string[] = [], inspect = vi.fn();
    for (const command of ["health", "readiness", "diagnostics"]) {
      expect(await runCli([command, "--database", configuration.storage.path], { inspect, write: text => output.push(text), now: testClock })).toBe(2);
    }
    expect(await runCli(["oracle-status", "--database", configuration.storage.path], { inspect, write: text => output.push(text), now: testClock })).toBe(0);
    expect(existsSync(configuration.storage.path)).toBe(false); expect(inspect).not.toHaveBeenCalled();
    for (const args of [["health", "--probe"], ["backup"], ["readiness", "--probe", "--probe"], ["restore-verify", "--backup", "fixture", "--database", "live.sqlite"]]) {
      expect(() => parseCliOptions(args)).toThrow(DataError);
    }
    expect(parseCliOptions(["readiness", "--probe"])).toMatchObject({ command: "readiness", probe: true });
  });
});
