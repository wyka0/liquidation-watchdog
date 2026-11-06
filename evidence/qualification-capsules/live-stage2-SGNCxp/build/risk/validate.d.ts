import type { Snapshot } from "../domain/types.js";
import type { RiskDataQuality } from "./types.js";
import type { PositionConfiguration } from "../config/position.js";
export declare function validateRiskSnapshot(snapshot: Snapshot, calculatedAt: Date, position?: PositionConfiguration): RiskDataQuality;
