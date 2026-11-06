import type { Finding, QualityStatus, Scope } from "../domain/types.js";
export declare function worstQuality(statuses: readonly QualityStatus[]): QualityStatus;
export declare function summarizeQuality(findings: Finding[]): {
    overall: QualityStatus;
    byScope: Record<Scope, QualityStatus>;
    findings: Finding[];
};
export declare function canCalculate(status: QualityStatus): boolean;
