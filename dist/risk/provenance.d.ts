import type { Snapshot } from "../domain/types.js";
import type { RiskProvenance } from "./types.js";
import type { PositionConfiguration } from "../config/position.js";
export declare function snapshotIdentifier(snapshot: Snapshot): string;
export declare function riskProvenance(raw: unknown, identifier: string | null, position?: PositionConfiguration): RiskProvenance;
export declare function freezeResult<T>(value: T): T;
