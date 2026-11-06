import { beforeAll, describe, expect, it } from "vitest";
import { initialState, mathSchema, qualitySchema } from "../src/monitoring/model.js";
import type { Observation } from "../src/monitoring/model.js";
import { transition } from "../src/monitoring/transitions.js";
import { monitoringFixture, MONITOR_CONFIG, MONITOR_SCOPE } from "./fixtures/monitoring.js";

let base: Observation;
beforeAll(async () => {
  base = await monitoringFixture();
  // This legacy matrix synthesizes independent quality states, as a migrated Phase 3 row can.
  // The Phase 4 integration suite exercises bound assurance/quality transitions separately.
  delete base.assurance;
});
const policy = MONITOR_CONFIG.monitoring;
function observation(id: number, math: Observation["risk"]["mathematicalRiskState"] = "WARNING",
  quality: Observation["risk"]["dataQuality"] = "UNVERIFIED", oracle: Observation["risk"]["oracleQuality"] = "UNVERIFIED"): Observation {
  return { ...structuredClone(base), cycleId: `cycle_${id}`, observedAt: new Date(Date.parse(base.observedAt) + id * 60_000).toISOString(),
    accepted: math !== null && ["VALID", "UNVERIFIED"].includes(quality),
    risk: { ...structuredClone(base.risk), mathematicalRiskState: math, dataQuality: quality, oracleQuality: oracle } };
}
const mathPairs = mathSchema.options.flatMap(from => mathSchema.options.map(to => ({ from, to })));
const qualityPairs = qualitySchema.options.flatMap(from => qualitySchema.options.map(to => ({ from, to })));
describe("FIXTURE: independent transition dimensions", () => {
  it.each(mathPairs)("covers mathematical $from -> $to", ({ from, to }) => {
    const old = transition(initialState(), observation(1, from), policy, MONITOR_SCOPE).state;
    const result = transition(old, observation(2, to), policy, MONITOR_SCOPE);
    const alerts = result.alerts.filter(alert => alert.category === "RISK");
    expect(alerts).toHaveLength(from === to ? 0 : 1);
    if (alerts[0]) {
      expect(alerts[0].previous?.risk.mathematicalRiskState).toBe(from);
      expect(alerts[0].current.risk.mathematicalRiskState).toBe(to);
      expect(alerts[0].current.risk.actionable).toBe(false);
    }
    expect(result.state.lastAccepted?.risk.mathematicalRiskState).toBe(to);
  });
  it.each(qualityPairs)("covers effective quality $from -> $to without losing oracle identity", ({ from, to }) => {
    const old = transition(initialState(), observation(1, "WARNING", from), policy, MONITOR_SCOPE).state;
    const result = transition(old, observation(2, "WARNING", to), policy, MONITOR_SCOPE);
    expect(result.alerts.filter(alert => alert.category === "DATA_QUALITY")).toHaveLength(from === to ? 0 : 1);
    expect(result.state.latest?.risk.oracleVerification).toBe("UNVERIFIED");
  });
  it.each(qualityPairs)("tracks oracle data quality $from -> $to independently", ({ from, to }) => {
    const old = transition(initialState(), observation(1, "WARNING", "UNVERIFIED", from), policy, MONITOR_SCOPE).state;
    const result = transition(old, observation(2, "WARNING", "UNVERIFIED", to), policy, MONITOR_SCOPE);
    expect(result.alerts.filter(alert => alert.category === "ORACLE")).toHaveLength(from === to ? 0 : 1);
    expect(result.alerts.filter(alert => alert.category === "RISK")).toHaveLength(0);
  });
  it("alerts on simultaneous worsening and a quality change", () => {
    const old = transition(initialState(), observation(1, "WARNING", "VALID", "VALID"), policy, MONITOR_SCOPE).state;
    const result = transition(old, observation(2, "CRITICAL", "UNVERIFIED", "UNVERIFIED"), policy, MONITOR_SCOPE);
    expect(result.alerts.map(alert => alert.category)).toEqual(["RISK", "DATA_QUALITY", "ORACLE"]);
  });
  it("does not recover from missing position data or replace the accepted baseline", () => {
    const old = transition(initialState(), observation(1, "CRITICAL"), policy, MONITOR_SCOPE).state;
    const failed = transition(old, observation(2, null, "UNAVAILABLE", "UNAVAILABLE"), policy, MONITOR_SCOPE);
    expect(failed.state.lastAccepted).toEqual(old.lastAccepted);
    expect(failed.alerts.some(alert => alert.code === "RISK_RECOVERY" || alert.code === "NO_DEBT_OBSERVED")).toBe(false);
    const restored = transition(failed.state, observation(3, "CRITICAL"), policy, MONITOR_SCOPE);
    expect(restored.alerts.some(alert => alert.code === "DATA_RESTORED")).toBe(true);
    expect(restored.alerts.some(alert => alert.category === "RISK")).toBe(false);
    expect(restored.state.consecutiveFailures).toBe(0);
  });
  it("issues distinct persistent fingerprints for a recurrence after a recovery", () => {
    const first = transition(initialState(), observation(1, "WARNING"), policy, MONITOR_SCOPE);
    const worsening = transition(first.state, observation(2, "CRITICAL"), policy, MONITOR_SCOPE);
    const recovery = transition(worsening.state, observation(3, "WARNING"), policy, MONITOR_SCOPE);
    const recurrent = transition(recovery.state, observation(4, "CRITICAL"), policy, MONITOR_SCOPE);
    expect(recurrent.alerts[0]?.fingerprint).not.toBe(worsening.alerts[0]?.fingerprint);
    expect(transition(first.state, observation(2, "CRITICAL"), policy, MONITOR_SCOPE)).toEqual(worsening);
  });
  it("emits initial unverified warnings even when optional quality notices are off", () => {
    const quiet = { ...policy, alertOnDataQualityChanges: false };
    expect(transition(initialState(), observation(1), quiet, MONITOR_SCOPE).alerts.map(alert => alert.category)).toContain("DATA_QUALITY");
    const old = transition(initialState(), observation(1), quiet, MONITOR_SCOPE).state;
    expect(transition(old, observation(2, null, "INVALID"), quiet, MONITOR_SCOPE).alerts.some(alert => alert.category === "DATA_QUALITY")).toBe(true);
  });
  it("can disable optional mathematical improvement notices", () => {
    const old = transition(initialState(), observation(1, "CRITICAL"), policy, MONITOR_SCOPE).state;
    expect(transition(old, observation(2, "ABOVE_WARNING"), { ...policy, alertOnRecovery: false }, MONITOR_SCOPE).alerts).toHaveLength(0);
  });
  it("only alerts once when a consecutive failure episode reaches its threshold", () => {
    let state = initialState(); const health: string[] = [];
    for (let cycle = 1; cycle <= 5; cycle += 1) {
      const next = transition(state, observation(cycle, null, "UNAVAILABLE"), policy, MONITOR_SCOPE);
      health.push(...next.alerts.filter(alert => alert.category === "MONITOR_HEALTH").map(alert => alert.cycleId)); state = next.state;
    }
    expect(health).toEqual(["cycle_3"]);
  });
  it("only repeats a critical condition when explicitly configured, with persisted reminder timing", () => {
    const old = transition(initialState(), observation(1, "CRITICAL"), policy, MONITOR_SCOPE).state;
    expect(transition(old, observation(2, "CRITICAL"), policy, MONITOR_SCOPE).alerts).toHaveLength(0);
    expect(transition(old, observation(2, "CRITICAL"), { ...policy, alertOnEveryCriticalCheck: true }, MONITOR_SCOPE).alerts[0]?.code).toBe("CRITICAL_REMINDER");
    const reminding = { ...policy, criticalReminderSeconds: 120 };
    expect(transition(old, observation(2, "CRITICAL"), reminding, MONITOR_SCOPE).alerts).toHaveLength(0);
    const due = transition(old, observation(3, "CRITICAL"), reminding, MONITOR_SCOPE);
    expect(due.alerts[0]?.code).toBe("CRITICAL_REMINDER");
    expect(transition(due.state, observation(4, "CRITICAL"), reminding, MONITOR_SCOPE).alerts).toHaveLength(0);
  });
});
