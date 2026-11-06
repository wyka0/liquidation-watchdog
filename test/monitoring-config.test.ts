import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadMonitoringConfiguration, parseMonitoringConfiguration } from "../src/config/monitoring.js";
import { parseCliOptions } from "../src/cli/options.js";
import { temporaryMonitorDirectory } from "./fixtures/monitoring.js";

const directory = temporaryMonitorDirectory();
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
describe("FIXTURE: explicit bounded monitoring configuration", () => {
  it("defaults to opt-in monitoring and disabled external providers", () => {
    const config = parseMonitoringConfiguration();
    expect(config.monitoring).toEqual({ enabled: false, intervalSeconds: 60, maxConsecutiveFailures: 3,
      alertOnRecovery: true, alertOnDataQualityChanges: true, alertOnEveryCriticalCheck: false, criticalReminderSeconds: null });
    expect(config.notifications.telegram).toBe(false); expect(config.notifications.discord).toBe(false);
  });
  it.each([0, -1, 1, 4, 1.5, 86_401, Infinity, NaN, "60", null])("rejects invalid interval %s", value => {
    expect(() => parseMonitoringConfiguration({ monitoring: { intervalSeconds: value } })).toThrow();
  });
  it.each([5, 60, 86_400])("accepts bounded integer interval %s", intervalSeconds => {
    expect(parseMonitoringConfiguration({ monitoring: { intervalSeconds } }).monitoring.intervalSeconds).toBe(intervalSeconds);
  });
  it.each([
    { monitoring: { maxConsecutiveFailures: 0 } }, { monitoring: { criticalReminderSeconds: 30 } },
    { notifications: { baseDelaySeconds: 100, maxDelaySeconds: 5 } }, { notifications: { maxAttempts: 11 } },
    { notifications: { jitterRatio: 1 } }, { storage: { cycleRetentionDays: 0 } },
    { notifications: { token: "synthetic-credential" } }, { warningRatio: "1.3" }, { monitoring: { enabled: "true" } },
    { storage: { path: "evidence/phase1/state.sqlite" } }, { storage: { path: "../other/state.sqlite" } },
    { storage: { path: "https://example.test/state.sqlite" } }, { storage: { path: "local.txt" } }
  ])("rejects inconsistent, secret-bearing or unknown configuration %#", raw => {
    expect(() => parseMonitoringConfiguration(raw)).toThrow();
  });
  it("loads strict JSON and gives explicit CLI overrides precedence", async () => {
    const path = join(directory, "settings.json");
    writeFileSync(path, JSON.stringify({ monitoring: { intervalSeconds: 120 } }));
    const config = await loadMonitoringConfiguration(path, { intervalSeconds: 30, enabled: true });
    expect(config.monitoring.intervalSeconds).toBe(30); expect(config.monitoring.enabled).toBe(true);
  });
  it.each(["settings.txt", "credentials.json", ".env.json"])("rejects potential secret/config file %s without opening it", async name => {
    await expect(loadMonitoringConfiguration(join(directory, name))).rejects.toThrow();
  });
  it("rejects malformed and oversized JSON with a sanitized error", async () => {
    const path = join(directory, "bad.json"); writeFileSync(path, "synthetic private input");
    await expect(loadMonitoringConfiguration(path)).rejects.toThrow("bounded, regular");
    writeFileSync(path, " ".repeat(32_769));
    await expect(loadMonitoringConfiguration(path)).rejects.toThrow("bounded, regular");
  });
  it.each([
    ["monitor", "--interval", "0"], ["monitor", "--interval", "3.5"], ["monitor", "--interval", "999999"],
    ["monitor", "--once", "--once"], ["monitor", "--block", "1"], ["monitor", "--save-evidence"],
    ["alerts", "--limit", "0"], ["alerts", "--limit", "1001"], ["status", "--once"], ["monitor", "--config"]
  ].map(args => ({ args })))("rejects invalid monitoring CLI options %#", ({ args }) => { expect(() => parseCliOptions(args)).toThrow(); });
  it("keeps threshold and monitor configuration paths separate", () => {
    expect(parseCliOptions(["monitor", "--once", "--config", "monitor.json", "--risk-config", "ratios.json", "--target", "1.4"]))
      .toMatchObject({ configPath: "monitor.json", riskConfigPath: "ratios.json", thresholdOverrides: { targetRatio: "1.4" } });
  });
});
