import type { Address, Hex } from "viem";
import type { BlockRef, ReadRecord } from "../domain/types.js";
import type { ReadClient } from "../chain/client.js";
import { RequestPacer } from "../chain/transport.js";
export declare const MCP_READ_TOOLS: readonly ["get_chain_info", "get_block_number", "get_block", "get_code", "eth_call", "get_logs", "get_transaction_receipt"];
type McpTool = typeof MCP_READ_TOOLS[number];
export interface ToolDefinition {
    name: string;
    annotations?: {
        readOnlyHint?: boolean | undefined;
        destructiveHint?: boolean | undefined;
    } | undefined;
}
export interface McpSession {
    connect(): Promise<void>;
    listTools(): Promise<ToolDefinition[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
    close(): Promise<void>;
}
export declare function assertReadOnlyTool(name: string): asserts name is McpTool;
export declare class SdkMcpSession implements McpSession {
    private readonly client;
    private readonly transport;
    private readonly requestOptions;
    constructor(endpoint: string, fetcher: typeof fetch);
    connect(): Promise<void>;
    listTools(): Promise<ToolDefinition[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
    close(): Promise<void>;
}
export declare function unwrapMcpResult(raw: unknown): unknown;
export declare class PharosMcpClient implements ReadClient {
    private readonly signal?;
    readonly kind: "mcp";
    readonly records: ReadRecord[];
    readonly endpoint: string;
    private session;
    private tools;
    private readonly factory;
    constructor(pacer?: RequestPacer, endpoint?: string, factory?: () => McpSession, signal?: AbortSignal | undefined);
    private open;
    private invoke;
    chainId(): Promise<bigint>;
    blockNumber(): Promise<bigint>;
    block(number: bigint): Promise<BlockRef>;
    code(address: Address, block: bigint): Promise<Hex>;
    call(to: Address, data: Hex, block: bigint): Promise<Hex>;
    close(): Promise<void>;
}
export {};
