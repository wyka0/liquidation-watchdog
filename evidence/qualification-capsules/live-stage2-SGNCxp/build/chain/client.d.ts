import type { Address, Hex } from "viem";
import type { BlockRef, ReadRecord, SourceKind } from "../domain/types.js";
export interface ReadClient {
    readonly kind: SourceKind;
    readonly endpoint: string;
    readonly records: ReadRecord[];
    chainId(): Promise<bigint>;
    blockNumber(): Promise<bigint>;
    block(number: bigint): Promise<BlockRef>;
    code(address: Address, block: bigint): Promise<Hex>;
    call(to: Address, data: Hex, block: bigint): Promise<Hex>;
    close(): Promise<void>;
}
