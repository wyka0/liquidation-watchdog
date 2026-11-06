import { z } from "zod";
import { RequestPacer } from "../chain/transport.js";
export declare const AUDIT_READ_METHODS: readonly ["eth_chainId", "eth_getBlockByNumber", "eth_getStorageAt", "eth_getTransactionByHash", "eth_getTransactionReceipt", "eth_getLogs", "eth_call"];
type Method = typeof AUDIT_READ_METHODS[number];
export declare const AUDIT_BOUNDS: {
    readonly requests: 96;
    readonly wallMilliseconds: 120000;
    readonly requestMilliseconds: 15000;
    readonly responseBytes: 2000000;
    readonly historyBlocks: 8000n;
    readonly queryBlocks: 1000n;
    readonly logs: 512;
    readonly configurationEventBlocks: 8;
    readonly updateTransactions: 2;
    readonly signers: 31;
};
export declare const auditLogSchema: z.ZodObject<{
    address: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
    blockNumber: z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<bigint, string | number>>, z.ZodBigInt>;
    blockHash: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
    transactionHash: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
    logIndex: z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<bigint, string | number>>, z.ZodBigInt>;
    topics: z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>>;
    data: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
    removed: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
/** Validate before sending; only public, fixed-endpoint read parameters can enter a trace. */
export declare function normalizeAuditParameters(method: Method, params: readonly unknown[]): readonly unknown[];
export declare class AuditRpc {
    private readonly fetcher;
    private readonly pacer;
    private readonly signal?;
    readonly trace: {
        method: Method;
        params: readonly unknown[];
        result: unknown;
        outcome: "VALIDATED" | "UNAVAILABLE";
        retrievedAt: string;
    }[];
    private id;
    private readonly deadline;
    constructor(fetcher?: typeof fetch, pacer?: RequestPacer, signal?: AbortSignal | undefined);
    request(method: Method, params: readonly unknown[]): Promise<unknown>;
}
export {};
