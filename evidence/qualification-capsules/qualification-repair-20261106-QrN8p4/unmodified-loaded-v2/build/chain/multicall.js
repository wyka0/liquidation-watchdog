import { decodeFunctionResult, encodeFunctionData, keccak256, parseAbi } from "viem";
import { DEPLOYMENT, READ_LIMITS } from "../config/deployment.js";
import { DataError } from "../domain/errors.js";
import { sameHex } from "../validation/schemas.js";
export const multicallAbi = parseAbi([
    "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
    "function getBlockNumber() view returns (uint256)",
    "function getCurrentBlockTimestamp() view returns (uint256)"
]);
export function contractCall(key, target, abi, functionName, args = [], scope = "snapshot") {
    const fragment = abi.find(item => item.type === "function" && item.name === functionName);
    if (!fragment || fragment.type !== "function" || !["view", "pure"].includes(fragment.stateMutability)) {
        throw new DataError("READ_ONLY_ABI", "Only known view or pure contract methods can be batched.");
    }
    return {
        key, target, scope,
        callData: encodeFunctionData({ abi, functionName, args }),
        decode: bytes => decodeFunctionResult({ abi, functionName, data: bytes })
    };
}
function decodeBatch(specs, raw) {
    let result;
    try {
        result = decodeFunctionResult({ abi: multicallAbi, functionName: "aggregate3", data: raw });
    }
    catch {
        throw new DataError("MULTICALL_ENCODING", "Multicall response could not be decoded.", "consistency");
    }
    if (result.length !== specs.length)
        throw new DataError("MULTICALL_LENGTH", "Multicall result count differs from its request.", "consistency");
    return specs.map((spec, index) => {
        const item = result[index];
        if (!item)
            throw new DataError("MULTICALL_LENGTH", "Multicall result is missing.", "consistency");
        if (!item.success)
            return {
                spec, success: false, returnData: item.returnData, value: null,
                finding: { scope: spec.scope, status: "UNAVAILABLE", code: "SUBCALL_FAILED", message: `${spec.key} reverted or failed; no zero value was substituted.` }
            };
        try {
            return { spec, success: true, returnData: item.returnData, value: spec.decode(item.returnData), finding: null };
        }
        catch {
            return {
                spec, success: true, returnData: item.returnData, value: null,
                finding: { scope: spec.scope, status: "INVALID", code: "SUBCALL_ENCODING", message: `${spec.key} returned malformed data.` }
            };
        }
    });
}
export async function readComparedBatch(rpc, mcp, block, label, queries) {
    const specs = [
        contractCall("sentinel.blockNumber", DEPLOYMENT.multicall, multicallAbi, "getBlockNumber", [], "consistency"),
        contractCall("sentinel.timestamp", DEPLOYMENT.multicall, multicallAbi, "getCurrentBlockTimestamp", [], "consistency"),
        ...queries
    ];
    if (specs.length > READ_LIMITS.maxBatchCalls || new Set(specs.map(item => item.key)).size !== specs.length) {
        throw new DataError("MULTICALL_INPUT", "Multicall batch is too large or has duplicate keys.");
    }
    const data = encodeFunctionData({
        abi: multicallAbi, functionName: "aggregate3",
        args: [specs.map(spec => ({ target: spec.target, allowFailure: true, callData: spec.callData }))]
    });
    // Sequential cross-checks share the paced transport; no parallel request flood.
    const rpcRaw = await rpc.call(DEPLOYMENT.multicall, data, block.number);
    const mcpRaw = await mcp.call(DEPLOYMENT.multicall, data, block.number);
    const rpcReads = decodeBatch(specs, rpcRaw);
    const mcpReads = decodeBatch(specs, mcpRaw);
    for (const reads of [rpcReads, mcpReads]) {
        if (reads[0]?.value !== block.number || reads[1]?.value !== block.timestamp || reads[0].finding || reads[1].finding) {
            throw new DataError("MIXED_BLOCK_READ", "Multicall's EVM block number or timestamp differs from the pinned header.", "consistency");
        }
    }
    const comparisons = rpcReads.map((read, index) => {
        const other = mcpReads[index];
        if (!other)
            throw new DataError("MULTICALL_LENGTH", "Provider omitted a subcall.", "consistency");
        return {
            label: `${label}:${read.spec.key}`, blockNumber: block.number,
            matches: read.success === other.success && sameHex(read.returnData, other.returnData),
            rpcDigest: keccak256(read.returnData), mcpDigest: keccak256(other.returnData)
        };
    });
    const findings = rpcReads.flatMap(read => read.finding ? [read.finding] : []);
    for (const comparison of comparisons.filter(item => !item.matches)) {
        findings.push({ scope: "consistency", status: "INVALID", code: "MCP_RPC_DISAGREEMENT", message: `${comparison.label}: MCP and RPC returned different bytes or success flags.` });
    }
    return { reads: new Map(rpcReads.slice(2).map(read => [read.spec.key, read])), comparisons, findings, sentinels: 2 };
}
//# sourceMappingURL=multicall.js.map