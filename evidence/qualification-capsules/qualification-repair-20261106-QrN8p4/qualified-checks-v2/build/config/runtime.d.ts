import type { MonitorOverrides, MonitoringConfiguration, MonitoringPolicy } from "./monitoring.js";
import type { ThresholdConfiguration, ThresholdOverrides } from "./risk.js";
import type { PositionConfiguration } from "./position.js";
export interface RuntimeConfiguration {
    readonly monitoring: MonitoringConfiguration;
    readonly thresholds: ThresholdConfiguration;
    readonly position: PositionConfiguration;
    /** Binds canonical thresholds plus the resolved monitoring policy. Storage/notification plumbing and
     * runtime-specific cadence shims are excluded; equivalent threshold representations hash identically.
     * Historical monitoring scopes deliberately keep using the authored decimal text (monitoringScope). */
    readonly configurationFingerprint: string;
}
export declare function configurationFingerprint(thresholds: ThresholdConfiguration, policy: MonitoringPolicy, position?: PositionConfiguration): string;
/** One strict, fail-closed composition point. Re-validates both inputs; no default is reconstructed here. */
export declare function runtimeConfiguration(input: {
    monitoring: MonitoringConfiguration;
    thresholds: ThresholdConfiguration;
    position?: PositionConfiguration;
}): RuntimeConfiguration;
/** Resolve the full runtime configuration once at startup: monitoring JSON (or defaults) plus threshold JSON
 * (or defaults) with explicit overrides taking documented precedence over file values. */
export declare function loadRuntimeConfiguration(input?: {
    monitoringPath?: string | undefined;
    monitoringOverrides?: MonitorOverrides | undefined;
    thresholdPath?: string | undefined;
    thresholdOverrides?: ThresholdOverrides | undefined;
    positionPath?: string | undefined;
}): Promise<RuntimeConfiguration>;
