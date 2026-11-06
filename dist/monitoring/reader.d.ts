import type { ReadClient } from "../chain/client.js";
import type { InspectOptions } from "../chain/snapshot.js";
import type { Snapshot } from "../domain/types.js";
import type { PositionConfiguration } from "../config/position.js";
/** Attribute failures without changing the Phase 1 reader or retaining provider error text. */
export declare function attributedClient(client: ReadClient): ReadClient;
export declare function readMonitoredPosition(options: InspectOptions): Promise<Snapshot>;
export declare function inspectMonitored(blockNumber?: bigint, signal?: AbortSignal, position?: PositionConfiguration): Promise<Snapshot>;
