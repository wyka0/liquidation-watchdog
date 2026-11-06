import type { Abi, Address, Hex } from "viem";
import type { BlockRef, Comparison, Finding, Scope } from "../domain/types.js";
import type { ReadClient } from "./client.js";
export declare const multicallAbi: readonly [{
    readonly name: "aggregate3";
    readonly type: "function";
    readonly stateMutability: "payable";
    readonly inputs: readonly [{
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "target";
        }, {
            readonly type: "bool";
            readonly name: "allowFailure";
        }, {
            readonly type: "bytes";
            readonly name: "callData";
        }];
        readonly name: "calls";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly type: "bool";
            readonly name: "success";
        }, {
            readonly type: "bytes";
            readonly name: "returnData";
        }];
        readonly name: "returnData";
    }];
}, {
    readonly name: "getBlockNumber";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getCurrentBlockTimestamp";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}];
export interface CallSpec {
    key: string;
    target: Address;
    callData: Hex;
    scope: Scope;
    decode: (bytes: Hex) => unknown;
}
export interface Subcall {
    spec: CallSpec;
    success: boolean;
    returnData: Hex;
    value: unknown;
    finding: Finding | null;
}
export declare function contractCall(key: string, target: Address, abi: Abi, functionName: string, args?: readonly unknown[], scope?: Scope): CallSpec;
export declare function readComparedBatch(rpc: ReadClient, mcp: ReadClient, block: BlockRef, label: string, queries: readonly CallSpec[]): Promise<{
    reads: Map<string, Subcall>;
    comparisons: Comparison[];
    findings: Finding[];
    sentinels: number;
}>;
