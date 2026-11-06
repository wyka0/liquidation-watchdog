import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMonitoringConfiguration } from "../../src/config/monitoring.js";
import { parseThresholds } from "../../src/config/risk.js";
import { initialState, monitoringScope } from "../../src/monitoring/model.js";
import type { Channel, Observation } from "../../src/monitoring/model.js";
import { observe } from "../../src/monitoring/observation.js";
import { transition } from "../../src/monitoring/transitions.js";
import type { MonitorStore } from "../../src/storage/store.js";
import { riskFixture, RISK_FIXTURE_TIME } from "./risk.js";
import { demoPositionConfiguration } from "../../src/config/position.js";

export const MONITOR_CONFIG = parseMonitoringConfiguration();
export const MONITOR_THRESHOLDS = parseThresholds();
export const MONITOR_POSITION = demoPositionConfiguration(MONITOR_THRESHOLDS);
export const MONITOR_SCOPE = monitoringScope(MONITOR_THRESHOLDS, undefined, MONITOR_POSITION);
export const testClock = () => new Date(RISK_FIXTURE_TIME);
export async function monitoringFixture(): Promise<Observation> {
  return observe(await riskFixture(), "cycle_1", testClock(), MONITOR_THRESHOLDS, { allowFixture: true, position: MONITOR_POSITION });
}
export function fixtureAlert(observation: Observation) {
  return transition(initialState(), observation, MONITOR_CONFIG.monitoring, MONITOR_SCOPE).alerts[0]!;
}
export function persistFixture(store: MonitorStore, observation: Observation, channels: Channel[] = ["console"]) {
  const previous = store.state(MONITOR_SCOPE);
  const next = transition(previous, observation, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
  store.beginCycle(observation.cycleId, MONITOR_SCOPE, observation.observedAt);
  const alerts = store.commitObservation(MONITOR_SCOPE, observation, previous.revision, next.state, next.alerts, channels);
  store.finishCycle(observation.cycleId, observation.observedAt);
  return alerts;
}
export function temporaryMonitorDirectory(): string {
  const base = join(tmpdir(), "opencode"); mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, "watchdog-phase3-fixture-"));
}
