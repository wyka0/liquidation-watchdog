import type { BlockRef, EvidenceKind, Snapshot } from "../domain/types.js";
import type { ReadClient } from "./client.js";
import type { CallSpec } from "./multicall.js";
import type { PositionConfiguration } from "../config/position.js";
export declare function validateBlock(block: BlockRef, requested: bigint, now: Date): void;
export declare function initialQueries(position?: PositionConfiguration): CallSpec[];
export interface InspectOptions {
    rpc: ReadClient;
    mcp: ReadClient;
    blockNumber?: bigint;
    evidenceKind?: EvidenceKind;
    now?: () => Date;
    position?: PositionConfiguration;
}
export declare function inspectPosition(options: InspectOptions): Promise<Snapshot>;
