export declare const DEFAULT_THRESHOLD_TEXT: Readonly<{
    warningRatio: "1.30";
    criticalRatio: "1.10";
    targetRatio: "1.25";
    liquidationBoundary: "1.00";
}>;
export type ThresholdName = keyof typeof DEFAULT_THRESHOLD_TEXT;
export type ThresholdOverrides = Partial<Record<ThresholdName, string>>;
export interface ThresholdConfiguration {
    readonly scale: bigint;
    readonly decimal: Readonly<Record<ThresholdName, string>>;
    readonly wad: Readonly<Record<ThresholdName, bigint>>;
}
export declare function parseThresholdOverrides(raw: unknown): ThresholdOverrides;
export declare function parseThresholds(overrides?: unknown): ThresholdConfiguration;
export declare function validateThresholds(configuration: ThresholdConfiguration): void;
export declare function canonicalThresholdDecimals(thresholds: ThresholdConfiguration): Readonly<Record<ThresholdName, string>>;
export declare function loadThresholds(path: string | undefined, overrides?: ThresholdOverrides): Promise<ThresholdConfiguration>;
