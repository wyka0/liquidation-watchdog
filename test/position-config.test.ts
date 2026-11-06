import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { inspectPosition } from "../src/chain/snapshot.js";
import { loadPositionConfiguration, parsePositionConfigurationDocument, selectSinglePosition } from "../src/config/position.js";
import { DEPLOYMENT, NETWORK } from "../src/config/deployment.js";
import { parseThresholds } from "../src/config/risk.js";
import { loadRuntimeConfiguration } from "../src/config/runtime.js";
import { hashParts, initialState, monitoringScope } from "../src/monitoring/model.js";
import { observe } from "../src/monitoring/observation.js";
import { transition } from "../src/monitoring/transitions.js";
import { renderAlert } from "../src/notifications/format.js";
import { positionIdentityFingerprint } from "../src/positions/model.js";
import { calculateRisk } from "../src/risk/engine.js";
import { PersistedReadModel } from "../src/runtime/read-model.js";
import { MonitorStore } from "../src/storage/store.js";
import { MonitoringService } from "../src/monitoring/service.js";
import { postgresConfiguration } from "../src/config/postgres.js";
import { PostgresRuntime } from "../src/runtime/postgres-runtime.js";
import { ConsoleAdapter } from "../src/notifications/adapters.js";
import { PgConnection } from "../src/storage/postgres/connection.js";
import { FixtureClient, MONITOR_CONFIG, MONITOR_SCOPE, MONITOR_THRESHOLDS, testClock } from "./fixtures/phase4.js";

const directory = mkdtempSync(join(tmpdir(), "opencode", "watchdog-stage3c-"));
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
const ACCOUNT = "0x1111111111111111111111111111111111111111";
const identity = (account = ACCOUNT) => ({ chainId: NETWORK.chainId, protocol: "MORPHO_BLUE", protocolAddress: DEPLOYMENT.morpho,
  marketId: DEPLOYMENT.marketId, account, oracleAddress: DEPLOYMENT.oracle, irmAddress: DEPLOYMENT.irm,
  loanToken: DEPLOYMENT.loanToken, collateralToken: DEPLOYMENT.collateralToken });
const document = (options: { account?: string; mode?: "DEMO" | "CONFIGURED"; enabled?: boolean; thresholds?: unknown } = {}) => ({
  schemaVersion: 1, positions: [{ enabled: options.enabled ?? true, mode: options.mode ?? "CONFIGURED",
    identity: identity(options.account), ...(options.thresholds === undefined ? {} : { thresholds: options.thresholds }) }]
});
const configured = (options: Parameters<typeof document>[0] = {}) => selectSinglePosition(document(options));
const write = (name: string, value: string | unknown) => {
  const path = join(directory, name); writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value)); return path;
};
const expectCode = (operation: () => unknown, code: string) => {
  try { operation(); } catch (error) { expect(error).toMatchObject({ code }); return; }
  throw new Error(`Expected ${code}`);
};
const postgres = (enabled = false) => {
  const url = new URL("postgresql://fixture.invalid/stage3c"); url.username = "fixture_writer"; url.password = randomBytes(32).toString("base64url");
  const writer = url.href; url.username = "fixture_reader";
  return postgresConfiguration({ WATCHDOG_STORAGE_BACKEND: "postgres", WATCHDOG_POSTGRES_NAMESPACE: "fixture",
    WATCHDOG_POSTGRES_WRITER_URL: writer, WATCHDOG_POSTGRES_READER_URL: url.href,
    WATCHDOG_SCHEDULER_ENABLED: enabled ? "true" : "false" });
};

describe("STAGE3C FIXTURE: canonical position identity and configuration", () => {
  it("accepts one complete supported position and normalizes EVM identity", () => {
    const position = configured({ account: ACCOUNT.toUpperCase().replace("0X", "0x") });
    expect(position).toMatchObject({ schemaVersion: 1, enabled: true, mode: "CONFIGURED",
      accountRole: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET",
      identity: { chainId: 1672, protocol: "MORPHO_BLUE", account: getAddress(ACCOUNT), marketId: DEPLOYMENT.marketId.toLowerCase() } });
    expect(position.identity.positionId).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    [{ ...identity(), account: undefined }, "POSITION_IDENTITY_INVALID"],
    [{ ...identity(), account: "0x0" }, "POSITION_IDENTITY_INVALID"],
    [{ ...identity(), account: "0x0000000000000000000000000000000000000000" }, "POSITION_ACCOUNT_INVALID"],
    [{ ...identity(), collateralToken: undefined }, "POSITION_IDENTITY_INVALID"]
  ])("rejects incomplete or invalid identity %#", (candidate, code) => {
    expectCode(() => selectSinglePosition({ schemaVersion: 1, positions: [{ enabled: true, mode: "CONFIGURED", identity: candidate }] }), code);
  });

  it("derives the same deterministic fingerprint from canonical equivalent identity", () => {
    const first = configured(), second = configured({ account: ACCOUNT.toUpperCase().replace("0X", "0x") });
    expect(first.identity.positionId).toBe(second.identity.positionId);
    const canonical = { chainId: first.identity.chainId, protocol: first.identity.protocol, protocolAddress: first.identity.protocolAddress,
      marketId: first.identity.marketId, account: first.identity.account, oracleAddress: first.identity.oracleAddress,
      irmAddress: first.identity.irmAddress, loanToken: first.identity.loanToken, collateralToken: first.identity.collateralToken };
    expect(positionIdentityFingerprint(canonical)).toBe(first.identity.positionId);
  });

  it("loads valid exact thresholds from the selected position", () => {
    const position = configured({ thresholds: { warningRatio: "1.50", criticalRatio: "1.20", targetRatio: "1.40" } });
    expect(position.thresholds.decimal).toEqual({ warningRatio: "1.50", criticalRatio: "1.20", targetRatio: "1.40", liquidationBoundary: "1.00" });
  });

  it("resolves one complete runtime configuration from the explicit position path", async () => {
    const path = write("runtime-position.json", document({ thresholds: { warningRatio: "1.50", criticalRatio: "1.20", targetRatio: "1.40" } }));
    const resolved = await loadRuntimeConfiguration({ positionPath: path });
    expect(resolved.position).toMatchObject({ mode: "CONFIGURED", enabled: true, identity: { account: getAddress(ACCOUNT) } });
    expect(resolved.thresholds).toEqual(resolved.position.thresholds);
    expect(resolved.configurationFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    { warningRatio: "1.10", criticalRatio: "1.20" },
    { warningRatio: "1.20", criticalRatio: "1.20" },
    { criticalRatio: "1.00" }
  ])("rejects invalid warning/critical ordering %#", thresholds => {
    expectCode(() => configured({ thresholds }), "INVALID_THRESHOLD_ORDER");
  });

  it.each([{ targetRatio: "1.10" }, { targetRatio: "0" }, { liquidationBoundary: "1.01" }])(
    "rejects invalid target or mathematical boundary %#", thresholds => {
      expect(() => configured({ thresholds })).toThrow();
    });

  it.each([
    { ...identity(), chainId: 1 },
    { ...identity(), protocolAddress: DEPLOYMENT.account },
    { ...identity(), marketId: `0x${"12".repeat(32)}` },
    { ...identity(), oracleAddress: DEPLOYMENT.account },
    { ...identity(), loanToken: DEPLOYMENT.collateralToken }
  ])("rejects unsupported chain, protocol, market or asset identity %#", candidate => {
    expectCode(() => selectSinglePosition({ schemaVersion: 1, positions: [{ enabled: true, mode: "CONFIGURED", identity: candidate }] }), "POSITION_UNSUPPORTED");
  });

  it("rejects missing, malformed and ambiguous configuration files", async () => {
    await expect(loadPositionConfiguration(join(directory, "missing.json"), MONITOR_THRESHOLDS)).rejects.toMatchObject({ code: "POSITION_CONFIG_FILE" });
    await expect(loadPositionConfiguration(write("malformed.json", "{ nope"), MONITOR_THRESHOLDS)).rejects.toMatchObject({ code: "POSITION_CONFIG_FILE" });
    await expect(loadPositionConfiguration(write("unknown.json", { ...document(), unexpected: true }), MONITOR_THRESHOLDS)).rejects.toMatchObject({ code: "POSITION_CONFIG_INVALID" });
    const path = write("position.json", document());
    await expect(loadRuntimeConfiguration({ positionPath: path, thresholdPath: write("thresholds.json", {}) }))
      .rejects.toMatchObject({ code: "POSITION_THRESHOLD_AMBIGUOUS" });
  });

  it("rejects duplicate canonical identity before rejecting unsupported orchestration", () => {
    const entry = document().positions[0]!;
    expectCode(() => parsePositionConfigurationDocument({ schemaVersion: 1, positions: [entry, structuredClone(entry)] }), "POSITION_DUPLICATE");
    const other = { ...entry, identity: identity("0x2222222222222222222222222222222222222222") };
    expectCode(() => selectSinglePosition({ schemaVersion: 1, positions: [entry, other] }), "MULTI_POSITION_UNSUPPORTED");
  });

  it("keeps fallback and explicit demo configuration visibly DEMO", async () => {
    const fallback = await loadPositionConfiguration(undefined, MONITOR_THRESHOLDS);
    const explicit = selectSinglePosition(document({ account: DEPLOYMENT.account, mode: "DEMO" }));
    for (const position of [fallback, explicit]) expect(position).toMatchObject({ mode: "DEMO", accountRole: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET",
      identity: { account: DEPLOYMENT.account } });
    expectCode(() => configured({ account: DEPLOYMENT.account }), "POSITION_MODE_MISMATCH");
  });

  it("isolates configured identity and thresholds while preserving the exact legacy demo scope", () => {
    const first = configured(), second = configured({ account: "0x2222222222222222222222222222222222222222" });
    const custom = parseThresholds({ warningRatio: "1.5", criticalRatio: "1.2", targetRatio: "1.4" });
    expect(MONITOR_SCOPE).toBe(hashParts(["monitor-v1", NETWORK.chainId, DEPLOYMENT.marketId, DEPLOYMENT.account, MONITOR_THRESHOLDS.decimal, "LIVE"]));
    expect(monitoringScope(first.thresholds, undefined, first)).not.toBe(MONITOR_SCOPE);
    expect(monitoringScope(first.thresholds, undefined, first)).not.toBe(monitoringScope(second.thresholds, undefined, second));
    expect(monitoringScope(first.thresholds, undefined, first)).not.toBe(monitoringScope(custom, undefined, { ...first, thresholds: custom }));
  });

  it("reads and validates the explicitly configured account without inferring it from RPC data", async () => {
    const position = configured();
    const snapshot = await inspectPosition({ rpc: new FixtureClient("rpc"), mcp: new FixtureClient("mcp"),
      evidenceKind: "FIXTURE", now: testClock, position });
    expect(snapshot).toMatchObject({ account: position.identity.account, accountRole: position.accountRole, marketId: position.identity.marketId });
    const result = calculateRisk(snapshot, position.thresholds, { calculatedAt: testClock(), position });
    expect(result).toMatchObject({ account: position.identity.account, accountRole: position.accountRole, actionable: false });
    expect(result.dataQuality.overall).not.toBe("INVALID");
    const wrong = calculateRisk(snapshot, position.thresholds, { calculatedAt: testClock(), position: configured({ account: "0x2222222222222222222222222222222222222222" }) });
    expect(wrong.dataQuality.overall).toBe("INVALID");
  });

  it("keeps configured history isolated and retains original identity and thresholds", async () => {
    const position = configured({ thresholds: { warningRatio: "1.5", criticalRatio: "1.2", targetRatio: "1.4" } });
    const snapshot = await inspectPosition({ rpc: new FixtureClient("rpc"), mcp: new FixtureClient("mcp"), evidenceKind: "FIXTURE", now: testClock, position });
    const observation = observe(snapshot, "configured_cycle", testClock(), position.thresholds, { allowFixture: true, position });
    const scope = monitoringScope(position.thresholds, undefined, position), path = join(directory, "configured-history.sqlite"), store = new MonitorStore(path); store.acquireMonitor();
    const next = transition(initialState(), observation, MONITOR_CONFIG.monitoring, scope);
    store.beginCycle(observation.cycleId, scope, observation.observedAt);
    store.commitObservation(scope, observation, 0, next.state, next.alerts, ["console"]); store.finishCycle(observation.cycleId, observation.observedAt);
    expect(store.state(scope).lastAccepted?.risk).toMatchObject({ account: position.identity.account, thresholds: position.thresholds.decimal, actionable: false });
    expect(store.state(MONITOR_SCOPE)).toEqual(initialState());
    expect(store.alerts(20, scope)).toHaveLength(next.alerts.length); expect(store.alerts(20, MONITOR_SCOPE)).toHaveLength(0);
    store.close();
    const reader = new MonitorStore(path, { readOnly: true });
    const api = new PersistedReadModel(reader, MONITOR_CONFIG, () => "DISABLED", position.thresholds, position, testClock);
    expect(api.read("/api/risk").body).toMatchObject({ identity: { positionId: position.identity.positionId, mode: "CONFIGURED", account: position.identity.account },
      latest: { risk: { thresholds: position.thresholds.decimal, actionable: false } } });
    reader.close();
  });

  it("never creates a financial suggestion from configuration alone and preserves Stage 3B rendering", () => {
    const position = configured(), observation = observe(null, "missing_cycle", testClock(), position.thresholds,
      { diagnostic: "SNAPSHOT_UNAVAILABLE", position });
    const scope = monitoringScope(position.thresholds, undefined, position);
    const alert = transition(initialState(), observation, MONITOR_CONFIG.monitoring, scope).alerts[0]!;
    expect(alert.suggestedAction).toMatchObject({ type: "NON_FINANCIAL", actionable: false });
    expect(JSON.stringify(alert.suggestedAction)).not.toMatch(/amountRaw|amountFormatted/);
    expect(renderAlert(alert)).toContain("Action:"); expect(renderAlert(alert)).toContain("actionable: false");
  });

  it("fails before database work when an enabled runtime position is disabled", () => {
    const position = configured({ enabled: false }), store = new MonitorStore(":memory:");
    expect(() => new PersistedReadModel(null, MONITOR_CONFIG, () => "DISABLED", position.thresholds, position, testClock)).not.toThrow();
    expectCode(() => new MonitoringService({ configuration: MONITOR_CONFIG, thresholds: position.thresholds, position,
      store, adapters: [], read: async () => null }), "POSITION_DISABLED");
    expect(store.state(monitoringScope(position.thresholds, undefined, position))).toEqual(initialState()); store.close();
  });

  it("preserves inert PostgreSQL startup and validates position before database work", async () => {
    const position = configured(), transaction = vi.spyOn(PgConnection.prototype, "transaction");
    const runtime = new PostgresRuntime({ configuration: postgres(), monitoring: MONITOR_CONFIG, thresholds: position.thresholds, position,
      adapters: [new ConsoleAdapter(() => {})], readCredential: randomBytes(32).toString("base64url"),
      schedulerCredential: randomBytes(32).toString("base64url"), port: 0 });
    try { await runtime.start(); expect(runtime.status()).toBe("DISABLED"); expect(transaction).not.toHaveBeenCalled(); }
    finally { await runtime.stop(); transaction.mockRestore(); }
    const disabled = configured({ enabled: false }), blocked = vi.spyOn(PgConnection.prototype, "transaction");
    const rejected = new PostgresRuntime({ configuration: postgres(true), monitoring: MONITOR_CONFIG, thresholds: disabled.thresholds, position: disabled,
      adapters: [new ConsoleAdapter(() => {})], readCredential: randomBytes(32).toString("base64url"),
      schedulerCredential: randomBytes(32).toString("base64url"), port: 0 });
    try { await expect(rejected.start()).rejects.toMatchObject({ code: "RUNTIME_STARTUP" }); expect(blocked).not.toHaveBeenCalled(); }
    finally { await rejected.stop(); blocked.mockRestore(); }
  });
});
