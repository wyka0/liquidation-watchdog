import { createHash } from "node:crypto";
import { loadMonitoringConfiguration, parseMonitoringConfiguration } from "./monitoring.js";
import type { MonitorOverrides, MonitoringConfiguration, MonitoringPolicy } from "./monitoring.js";
import { canonicalThresholdDecimals, loadThresholds, validateThresholds } from "./risk.js";
import type { ThresholdConfiguration, ThresholdOverrides } from "./risk.js";
import { demoPositionConfiguration, loadPositionConfiguration, validatePositionConfiguration } from "./position.js";
import type { PositionConfiguration } from "./position.js";
import { DataError } from "../domain/errors.js";

/** Single digest primitive; JSON.stringify of an explicitly ordered array keeps the result property-order independent. */
const digest = (parts: unknown): string => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

const FINGERPRINT_VERSION = "runtime-config-v2";
/** Fixed field order: canonical monitoring-policy values, normalized (absent optional age becomes null). */
const MONITORING_POLICY_KEYS = ["enabled", "intervalSeconds", "maxConsecutiveFailures", "alertOnRecovery",
  "alertOnDataQualityChanges", "alertOnEveryCriticalCheck", "criticalReminderSeconds", "oracleLocalMaxAgeSeconds"] as const;
const policyValues = (policy: MonitoringPolicy): unknown[] => MONITORING_POLICY_KEYS.map(key =>
  key === "oracleLocalMaxAgeSeconds" ? policy[key] ?? null : policy[key]);

export interface RuntimeConfiguration {
  readonly monitoring: MonitoringConfiguration;
  readonly thresholds: ThresholdConfiguration;
  readonly position: PositionConfiguration;
  /** Binds canonical thresholds plus the resolved monitoring policy. Storage/notification plumbing and
   * runtime-specific cadence shims are excluded; equivalent threshold representations hash identically.
   * Historical monitoring scopes deliberately keep using the authored decimal text (monitoringScope). */
  readonly configurationFingerprint: string;
}

export function configurationFingerprint(thresholds: ThresholdConfiguration, policy: MonitoringPolicy,
  position: PositionConfiguration = demoPositionConfiguration(thresholds)): string {
  validateThresholds(thresholds);
  return digest([FINGERPRINT_VERSION, position.identity.positionId, position.mode, position.enabled,
    canonicalThresholdDecimals(thresholds), policyValues(policy)]);
}

/** One strict, fail-closed composition point. Re-validates both inputs; no default is reconstructed here. */
export function runtimeConfiguration(input: { monitoring: MonitoringConfiguration; thresholds: ThresholdConfiguration; position?: PositionConfiguration }): RuntimeConfiguration {
  const monitoring = parseMonitoringConfiguration(input.monitoring);
  validateThresholds(input.thresholds);
  const position = input.position ?? demoPositionConfiguration(input.thresholds);
  validatePositionConfiguration(position, input.thresholds);
  return Object.freeze({ monitoring, thresholds: input.thresholds, position,
    configurationFingerprint: configurationFingerprint(input.thresholds, monitoring.monitoring, position) });
}

/** Resolve the full runtime configuration once at startup: monitoring JSON (or defaults) plus threshold JSON
 * (or defaults) with explicit overrides taking documented precedence over file values. */
export async function loadRuntimeConfiguration(input: {
  monitoringPath?: string | undefined; monitoringOverrides?: MonitorOverrides | undefined;
  thresholdPath?: string | undefined; thresholdOverrides?: ThresholdOverrides | undefined;
  positionPath?: string | undefined;
} = {}): Promise<RuntimeConfiguration> {
  if (input.positionPath !== undefined && (input.thresholdPath !== undefined || Object.keys(input.thresholdOverrides ?? {}).length > 0)) {
    throw new DataError("POSITION_THRESHOLD_AMBIGUOUS", "A position file owns its thresholds; do not combine it with a threshold file or threshold flags.");
  }
  const thresholds = input.positionPath === undefined
    ? await loadThresholds(input.thresholdPath, input.thresholdOverrides)
    : await loadThresholds(undefined);
  const position = await loadPositionConfiguration(input.positionPath, thresholds);
  return runtimeConfiguration({
    monitoring: await loadMonitoringConfiguration(input.monitoringPath, input.monitoringOverrides),
    thresholds: position.thresholds, position
  });
}
