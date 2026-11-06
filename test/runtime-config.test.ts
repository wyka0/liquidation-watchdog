import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { parseCliOptions } from "../src/cli/options.js";
import { parseMonitoringConfiguration } from "../src/config/monitoring.js";
import { parseThresholds } from "../src/config/risk.js";
import { configurationFingerprint, loadRuntimeConfiguration, runtimeConfiguration } from "../src/config/runtime.js";
import { DataError } from "../src/domain/errors.js";
import { monitoringScope } from "../src/monitoring/model.js";
import { observe } from "../src/monitoring/observation.js";
import { transition } from "../src/monitoring/transitions.js";
import { classifyMathematicalRisk } from "../src/risk/thresholds.js";
import { PersistedReadModel } from "../src/runtime/read-model.js";
import { RenderRuntime } from "../src/runtime/service.js";
import { serviceArguments } from "../src/service.js";
import { MonitorStore } from "../src/storage/store.js";
import { monitoringFixture, MONITOR_CONFIG, MONITOR_SCOPE, MONITOR_THRESHOLDS, persistFixture, riskFixture, testClock } from "./fixtures/phase4.js";
import { deferred, runtimeFixture } from "./fixtures/runtime.js";
import { demoPositionConfiguration } from "../src/config/position.js";

const directory = mkdtempSync(join(tmpdir(), "opencode", "watchdog-phase12a-config-"));
const fixtureDirectories: string[] = [], runtimes: RenderRuntime[] = [];
let malformedSequence = 0;
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
afterEach(async () => {
  for (const instance of runtimes.splice(0)) await instance.stop();
  for (const path of fixtureDirectories.splice(0)) rmSync(path, { recursive: true, force: true });
});
const write = (name: string, value: unknown): string => {
  const path = join(directory, name);
  writeFileSync(path, JSON.stringify(value));
  return path;
};
const customThresholds = () => parseThresholds({ warningRatio: "1.5", criticalRatio: "1.2", targetRatio: "1.4" });

describe("PHASE12A FIXTURE: one resolved runtime configuration", () => {
  it("resolves documented defaults when no configuration is supplied and freezes the result", async () => {
    const resolved = await loadRuntimeConfiguration();
    expect(resolved.thresholds).toEqual(parseThresholds());
    expect(resolved.thresholds.decimal).toEqual({ warningRatio: "1.30", criticalRatio: "1.10", targetRatio: "1.25", liquidationBoundary: "1.00" });
    expect(resolved.thresholds.wad).toEqual({ warningRatio: 1_300_000_000_000_000_000n, criticalRatio: 1_100_000_000_000_000_000n,
      targetRatio: 1_250_000_000_000_000_000n, liquidationBoundary: 1_000_000_000_000_000_000n });
    expect(resolved.monitoring).toEqual(parseMonitoringConfiguration());
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(resolved.configurationFingerprint).toBe(configurationFingerprint(parseThresholds(), parseMonitoringConfiguration().monitoring));
  });

  it("resolves monitoring and threshold files together with CLI-style overrides taking documented precedence", async () => {
    const monitoringPath = write("monitoring.json", { monitoring: { intervalSeconds: 120 } });
    const thresholdPath = write("thresholds.json", { warningRatio: "1.6", criticalRatio: "1.2", targetRatio: "1.4" });
    const resolved = await loadRuntimeConfiguration({ monitoringPath, thresholdPath, thresholdOverrides: { warningRatio: "1.7" } });
    expect(resolved.thresholds.decimal).toEqual({ warningRatio: "1.7", criticalRatio: "1.2", targetRatio: "1.4", liquidationBoundary: "1.00" });
    expect(resolved.thresholds.wad.warningRatio).toBe(1_700_000_000_000_000_000n);
    expect(resolved.monitoring.monitoring.intervalSeconds).toBe(120);
    expect(resolved.configurationFingerprint).toBe(configurationFingerprint(resolved.thresholds, resolved.monitoring.monitoring));
  });

  it("parses exact 18-decimal thresholds through the shared loader without floating-point conversion", async () => {
    const path = write("precision.json", { warningRatio: "1.300000000000000001", criticalRatio: "1.100000000000000001", targetRatio: "1.250000000000000001" });
    const resolved = await loadRuntimeConfiguration({ thresholdPath: path });
    expect(resolved.thresholds.wad).toEqual({ warningRatio: 1_300_000_000_000_000_001n, criticalRatio: 1_100_000_000_000_000_001n,
      targetRatio: 1_250_000_000_000_000_001n, liquidationBoundary: 1_000_000_000_000_000_000n });
    expect(resolved.thresholds.decimal.warningRatio).toBe("1.300000000000000001");
  });

  it.each(["1e2", " 1.3", "01.3", ".3", "1.", "1.3000000000000000001", "NaN", "Infinity", "-1", "+1", "0", ""])(
    "rejects malformed threshold decimal %j through the loader", async value => {
      const path = join(directory, `malformed-${malformedSequence++}.json`);
      writeFileSync(path, JSON.stringify({ warningRatio: value }));
      await expect(loadRuntimeConfiguration({ thresholdPath: path })).rejects.toBeInstanceOf(DataError);
    });

  it.each([
    [{ warningRatio: "1.2", criticalRatio: "1.2" }, "INVALID_THRESHOLD_ORDER"],
    [{ warningRatio: "1.2", criticalRatio: "1.4" }, "INVALID_THRESHOLD_ORDER"],
    [{ criticalRatio: "1.00" }, "INVALID_THRESHOLD_ORDER"],
    [{ criticalRatio: "0.99" }, "INVALID_THRESHOLD_ORDER"],
    [{ targetRatio: "1.10" }, "INVALID_THRESHOLD_ORDER"],
    [{ targetRatio: "0" }, "INVALID_THRESHOLDS"],
    [{ liquidationBoundary: "1.01" }, "INVALID_LIQUIDATION_BOUNDARY"],
    [{ liquidationBoundary: "0.95" }, "INVALID_LIQUIDATION_BOUNDARY"]
  ])("rejects equal, reversed, boundary-violating and out-of-order configuration %#", async (overrides, code) => {
    await expect(loadRuntimeConfiguration({ thresholdPath: write(`invalid-${code}-${malformedSequence++}.json`, overrides) }))
      .rejects.toMatchObject({ code });
  });

  it("rejects unknown configuration fields and malformed JSON without opening anything else", async () => {
    await expect(loadRuntimeConfiguration({ thresholdPath: write("unknown-threshold.json", { warningRatio: "1.4", unknown: "x" }) }))
      .rejects.toMatchObject({ code: "INVALID_THRESHOLDS" });
    await expect(loadRuntimeConfiguration({ monitoringPath: write("unknown-monitoring.json", { monitoring: { intervalSeconds: 60 }, unknown: true }) }))
      .rejects.toMatchObject({ code: "MONITOR_CONFIG" });
    await expect(loadRuntimeConfiguration({ monitoringPath: write("unknown-nested.json", { monitoring: { unknown: 1 } }) }))
      .rejects.toMatchObject({ code: "MONITOR_CONFIG" });
    const malformedPath = join(directory, "malformed.json");
    writeFileSync(malformedPath, "{ not json");
    await expect(loadRuntimeConfiguration({ thresholdPath: malformedPath })).rejects.toMatchObject({ code: "CONFIG_FILE" });
  });

  it("keeps the configuration fingerprint canonical, order-independent and sensitive to real changes", () => {
    const policy = parseMonitoringConfiguration().monitoring, baseline = configurationFingerprint(parseThresholds(), policy);
    expect(configurationFingerprint(parseThresholds(), policy)).toBe(baseline);
    // Equivalent decimal representations canonicalize identically.
    expect(configurationFingerprint(parseThresholds({ warningRatio: "1.3" }), policy)).toBe(baseline);
    expect(configurationFingerprint(parseThresholds({ warningRatio: "1.300" }), policy)).toBe(baseline);
    expect(configurationFingerprint(parseThresholds({ targetRatio: "1.250" }), policy)).toBe(baseline);
    // Monitoring policy property order never affects the digest.
    expect(configurationFingerprint(parseThresholds(), parseMonitoringConfiguration({ monitoring: { enabled: true, intervalSeconds: 90 } }).monitoring))
      .toBe(configurationFingerprint(parseThresholds(), parseMonitoringConfiguration({ monitoring: { intervalSeconds: 90, enabled: true } }).monitoring));
    // Real changes do change the digest.
    expect(configurationFingerprint(parseThresholds({ warningRatio: "1.4" }), policy)).not.toBe(baseline);
    expect(configurationFingerprint(parseThresholds(), parseMonitoringConfiguration({ monitoring: { intervalSeconds: 90 } }).monitoring)).not.toBe(baseline);
    // Historical monitoring scopes deliberately stay bound to the authored decimal text, not the canonical form.
    expect(monitoringScope(parseThresholds({ warningRatio: "1.3" }))).not.toBe(monitoringScope(parseThresholds()));
  });

  it("re-validates injected inputs and fails closed when composing a runtime configuration", () => {
    const valid = customThresholds();
    expect(() => runtimeConfiguration({ monitoring: parseMonitoringConfiguration(), thresholds: valid })).not.toThrow();
    const tampered = { ...valid, wad: { ...valid.wad, warningRatio: valid.wad.criticalRatio } };
    expect(() => runtimeConfiguration({ monitoring: parseMonitoringConfiguration(), thresholds: tampered })).toThrow(DataError);
    // An out-of-bounds policy must be rejected at composition even when constructed without the parser.
    const base = parseMonitoringConfiguration();
    const brokenMonitoring = { ...base, monitoring: { ...base.monitoring, intervalSeconds: 3 } };
    expect(() => runtimeConfiguration({ monitoring: brokenMonitoring, thresholds: valid })).toThrow(DataError);
  });

  it("injects resolved thresholds into the SQLite runtime: served stream, classification and scope separation", async () => {
    const custom = customThresholds(), customScope = monitoringScope(custom), h = runtimeFixture(true, true);
    fixtureDirectories.push(h.directory);
    const snapshot = await riskFixture();
    const expected = classifyMathematicalRisk(snapshot.valuation!.maxBorrow, snapshot.accounting!.debt, custom);
    const idle = deferred<void>();
    const instance = new RenderRuntime({ ...h.options, thresholds: custom, position: demoPositionConfiguration(custom), fixture: { read: async () => snapshot, now: testClock,
      pause: async (_milliseconds, signal) => { idle.resolve(); await new Promise<void>(resolve => {
        signal.addEventListener("abort", () => { resolve(); }, { once: true }); if (signal.aborted) resolve(); }); } } });
    runtimes.push(instance);
    const address = await instance.start();
    await idle.promise;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/risk`,
      { headers: { Authorization: `Bearer ${h.credential}` }, signal: AbortSignal.timeout(5_000) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ latest: { risk: { thresholds: custom.decimal, mathematicalRiskState: expected, actionable: false } } });
    await instance.stop();
    const check = new MonitorStore(h.options.database, { readOnly: true });
    try {
      expect(check.state(customScope).revision).toBe(1);
      expect(check.state(customScope).lastAccepted?.risk.thresholds).toEqual(custom.decimal);
      expect(check.state(MONITOR_SCOPE).revision).toBe(0);
    } finally { check.close(); }
  });

  it("fails closed at SQLite startup on thresholds that violate their invariants, without creating the database", async () => {
    const h = runtimeFixture(true);
    fixtureDirectories.push(h.directory);
    const valid = customThresholds(), tampered = { ...valid, wad: { ...valid.wad, warningRatio: valid.wad.criticalRatio } };
    const instance = new RenderRuntime({ ...h.options, thresholds: tampered, fixture: { read: async () => null } });
    runtimes.push(instance);
    await expect(instance.start()).rejects.toMatchObject({ code: "RUNTIME_STARTUP" });
    expect(await instance.done).toBe(1);
    expect(existsSync(h.options.database)).toBe(false);
  });

  it("keeps SQLite read models on exactly the injected threshold stream and rejects tampered injection", async () => {
    const custom = customThresholds(), scope = monitoringScope(custom), h = runtimeFixture();
    fixtureDirectories.push(h.directory);
    const writer = new MonitorStore(h.options.database);
    try {
      writer.acquireMonitor();
      persistFixture(writer, await monitoringFixture());
      const observation = observe(await riskFixture(), "custom_cycle", testClock(), custom, { allowFixture: true });
      const previous = writer.state(scope), next = transition(previous, observation, MONITOR_CONFIG.monitoring, scope);
      writer.beginCycle("custom_cycle", scope, observation.observedAt);
      writer.commitObservation(scope, observation, previous.revision, next.state, next.alerts, ["console"]);
      writer.finishCycle("custom_cycle", observation.observedAt);
    } finally { writer.close(); }
    const reader = new MonitorStore(h.options.database, { readOnly: true });
    try {
      const customApi = new PersistedReadModel(reader, MONITOR_CONFIG, () => "RUNNING", custom, demoPositionConfiguration(custom), testClock);
      const defaultApi = new PersistedReadModel(reader, MONITOR_CONFIG, () => "RUNNING", MONITOR_THRESHOLDS, demoPositionConfiguration(MONITOR_THRESHOLDS), testClock);
      expect(customApi.read("/api/risk")).toMatchObject({ status: 200, body: { latest: { cycleId: "custom_cycle", risk: { thresholds: custom.decimal } } } });
      // The default stream keeps its own seeded observation: streams are separate, never mixed or rewritten.
      expect(defaultApi.read("/api/risk")).toMatchObject({ status: 200, body: { latest: { cycleId: "cycle_1", risk: { thresholds: MONITOR_THRESHOLDS.decimal } } } });
      expect(defaultApi.read("/api/readiness").body).toMatchObject({ ready: false, reasons: expect.arrayContaining(["NON_LIVE_OBSERVATION"]) });
      expect((customApi.read("/api/readiness").body as { reasons: string[] }).reasons).not.toContain("NO_ACCEPTED_OBSERVATION");
      const tampered = { ...custom, wad: { ...custom.wad, warningRatio: custom.wad.criticalRatio } };
      expect(() => new PersistedReadModel(reader, MONITOR_CONFIG, () => "RUNNING", tampered, demoPositionConfiguration(custom), testClock)).toThrow(DataError);
    } finally { reader.close(); }
  });

  it("preserves documented CLI threshold precedence and service argument compatibility", async () => {
    const monitoringPath = write("cli-monitoring.json", { monitoring: { intervalSeconds: 120 } });
    const thresholdPath = write("cli-thresholds.json", { warningRatio: "1.6", criticalRatio: "1.2", targetRatio: "1.4" });
    const resolved = await loadRuntimeConfiguration({ monitoringPath, thresholdPath, thresholdOverrides: { warningRatio: "1.8" } });
    expect(resolved.thresholds.decimal.warningRatio).toBe("1.8");
    expect(parseCliOptions(["monitor", "--once", "--config", "monitoring.json", "--risk-config", "risk.json", "--warning", "1.9"]))
      .toMatchObject({ configPath: "monitoring.json", riskConfigPath: "risk.json", thresholdOverrides: { warningRatio: "1.9" } });
    expect(serviceArguments(["--config", "config/render.json", "--runtime-root", "/tmp/runtime", "--database", "/tmp/storage/watchdog.sqlite",
      "--risk-config", "config/risk.json"])).toEqual({ config: "config/render.json", runtimeRoot: "/tmp/runtime",
      database: "/tmp/storage/watchdog.sqlite", riskConfig: "config/risk.json" });
    expect(serviceArguments(["--config", "config/render.json", "--runtime-root", "/tmp/runtime", "--database", "/tmp/storage/watchdog.sqlite"]))
      .toEqual({ config: "config/render.json", runtimeRoot: "/tmp/runtime", database: "/tmp/storage/watchdog.sqlite", riskConfig: undefined });
    for (const args of [["--risk-config"], ["--config", "a.json", "--config", "b.json", "--runtime-root", "/tmp/runtime", "--database", "/tmp/d.sqlite"],
      ["--url", "https://example.test"], ["--config", "a.json", "--runtime-root", "/tmp/runtime"]]) {
      expect(() => serviceArguments(args)).toThrow();
    }
  });

  it("creates the explicit threshold configuration directory only inside its bounded temporary root", () => {
    mkdirSync(directory, { recursive: true });
    expect(existsSync(directory)).toBe(true);
  });
});
