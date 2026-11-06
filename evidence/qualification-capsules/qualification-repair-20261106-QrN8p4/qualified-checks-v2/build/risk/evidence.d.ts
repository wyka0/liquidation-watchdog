import type { Snapshot } from "../domain/types.js";
import type { RiskResult } from "./types.js";
export declare function saveRiskEvidence(snapshot: Snapshot, result: RiskResult, directory: string): Promise<void>;
