import type { ThresholdConfiguration } from "./risk.js";
import type { PositionAccountRole, PositionIdentity, PositionMode } from "../positions/model.js";
export interface PositionConfiguration {
    readonly schemaVersion: 1;
    readonly enabled: boolean;
    readonly mode: PositionMode;
    readonly accountRole: PositionAccountRole;
    readonly identity: PositionIdentity;
    readonly thresholds: ThresholdConfiguration;
}
export declare function validatePositionConfiguration(position: PositionConfiguration, runtimeThresholds?: ThresholdConfiguration): void;
export declare function demoPositionConfiguration(thresholds?: ThresholdConfiguration): PositionConfiguration;
export declare function parsePositionConfigurationDocument(raw: unknown): readonly PositionConfiguration[];
export declare function selectSinglePosition(raw: unknown): PositionConfiguration;
export declare function loadPositionConfiguration(path: string | undefined, legacyThresholds: ThresholdConfiguration): Promise<PositionConfiguration>;
