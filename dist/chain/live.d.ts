import type { Snapshot } from "../domain/types.js";
import type { PositionConfiguration } from "../config/position.js";
export declare function inspectLive(blockNumber?: bigint, position?: PositionConfiguration): Promise<Snapshot>;
