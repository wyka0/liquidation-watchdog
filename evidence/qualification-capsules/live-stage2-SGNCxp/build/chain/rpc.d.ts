import type { Address, Hex } from "viem";
import type { BlockRef, ReadRecord } from "../domain/types.js";
import type { ReadClient } from "./client.js";
import { RequestPacer } from "./transport.js";
export declare const RPC_READ_METHODS: readonly ["eth_chainId", "eth_blockNumber", "eth_getBlockByNumber", "eth_getCode", "eth_call", "eth_getLogs", "eth_getTransactionReceipt"];
export declare class RpcClient implements ReadClient {
    private readonly signal?;
    readonly kind: "rpc";
    readonly records: ReadRecord[];
    readonly endpoint: string;
    private id;
    private readonly fetcher;
    constructor(pacer?: RequestPacer, endpoint?: string, fetchImpl?: typeof fetch, signal?: AbortSignal | undefined);
    private request;
    chainId(): Promise<bigint>;
    blockNumber(): Promise<bigint>;
    block(number: bigint): Promise<BlockRef>;
    code(address: Address, block: bigint): Promise<Hex>;
    call(to: Address, data: Hex, block: bigint): Promise<Hex>;
    logs(address: Address, topics: readonly (Hex | null)[], from: bigint, to: bigint): Promise<unknown>;
    receipt(hash: Hex): Promise<unknown>;
    close(): Promise<void>;
}
