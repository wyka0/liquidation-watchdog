import { decodeFunctionData, parseAbi, toHex } from "viem";
import { z } from "zod";
import { RequestPacer } from "../chain/transport.js";
import { DEPLOYMENT, NETWORK } from "../config/deployment.js";
import { DataError } from "../domain/errors.js";
import { stringify } from "../domain/serialize.js";
import { addressSchema, blockSchema, bytesSchema, hashSchema, quantitySchema } from "../validation/schemas.js";
import { FORWARDER } from "./configuration.js";

export const AUDIT_READ_METHODS = ["eth_chainId", "eth_getBlockByNumber", "eth_getStorageAt", "eth_getTransactionByHash", "eth_getTransactionReceipt", "eth_getLogs", "eth_call"] as const;
type Method = typeof AUDIT_READ_METHODS[number];
export const AUDIT_BOUNDS = { requests: 96, wallMilliseconds: 120_000, requestMilliseconds: 15_000, responseBytes: 2_000_000,
  historyBlocks: 8_000n, queryBlocks: 1_000n, logs: 512, configurationEventBlocks: 8, updateTransactions: 2, signers: 31 } as const;
export const auditLogSchema = z.object({ address: addressSchema, blockNumber: quantitySchema, blockHash: hashSchema, transactionHash: hashSchema,
  logIndex: quantitySchema, topics: z.array(hashSchema).max(4), data: bytesSchema, removed: z.boolean().optional() });
const transaction = z.object({ hash: hashSchema, blockNumber: quantitySchema, blockHash: hashSchema, from: addressSchema, to: addressSchema, input: bytesSchema });
const receipt = z.object({ transactionHash: hashSchema, blockNumber: quantitySchema, blockHash: hashSchema, status: quantitySchema,
  logs: z.array(auditLogSchema).max(AUDIT_BOUNDS.logs) });
const contracts = [DEPLOYMENT.feed, DEPLOYMENT.cache, FORWARDER];
const contractAddress = addressSchema.refine(value => contracts.some(address => address.toLowerCase() === value.toLowerCase()));
const blockTag = z.string().regex(/^0x(?:0|[1-9a-fA-F][a-fA-F0-9]*)$/).refine(value => BigInt(value) < 2n ** 256n);
const viewCalls = parseAbi(["function isForwarder(address) view returns (bool)", "function isAllowedWorkflowId(bytes32) view returns (bool)"]);

/** Validate before sending; only public, fixed-endpoint read parameters can enter a trace. */
export function normalizeAuditParameters(method: Method, params: readonly unknown[]): readonly unknown[] {
  if (method === "eth_chainId") return z.tuple([]).parse(params);
  if (method === "eth_getBlockByNumber") return z.tuple([blockTag, z.literal(false)]).parse(params);
  if (method === "eth_getTransactionByHash" || method === "eth_getTransactionReceipt") return z.tuple([hashSchema]).parse(params);
  if (method === "eth_getStorageAt") return z.tuple([contractAddress, hashSchema, blockTag]).parse(params);
  if (method === "eth_getLogs") {
    const value = z.tuple([z.object({ address: z.union([contractAddress, z.array(contractAddress).min(1).max(3)]),
      topics: z.array(z.union([hashSchema, z.array(hashSchema).min(1).max(20)])).min(1).max(4), fromBlock: blockTag, toBlock: blockTag }).strict()]).parse(params);
    if (BigInt(value[0].toBlock) < BigInt(value[0].fromBlock) || BigInt(value[0].toBlock) - BigInt(value[0].fromBlock) >= AUDIT_BOUNDS.queryBlocks) throw new Error();
    return value;
  }
  const value = z.tuple([z.object({ to: contractAddress, data: z.string().length(74).pipe(bytesSchema) }).strict(), blockTag]).parse(params);
  const decoded = decodeFunctionData({ abi: viewCalls, data: value[0].data });
  if (value[0].to.toLowerCase() !== (decoded.functionName === "isForwarder" ? FORWARDER : DEPLOYMENT.cache).toLowerCase()) throw new Error();
  return value;
}

/** Drop all provider extension fields and validate the retained fields before recording success. */
function normalizeResult(method: Method, result: unknown): unknown {
  if (method === "eth_chainId") return toHex(quantitySchema.parse(result));
  if (method === "eth_getStorageAt") return hashSchema.parse(result);
  if (method === "eth_call") {
    const word = hashSchema.parse(result);
    if (BigInt(word) > 1n) throw new Error();
    return word;
  }
  const schema = method === "eth_getBlockByNumber" ? blockSchema : method === "eth_getTransactionByHash" ? transaction
    : method === "eth_getTransactionReceipt" ? receipt : z.array(auditLogSchema).max(AUDIT_BOUNDS.logs);
  return JSON.parse(stringify(schema.parse(result))) as unknown;
}

export class AuditRpc {
  readonly trace: { method: Method; params: readonly unknown[]; result: unknown; outcome: "VALIDATED" | "UNAVAILABLE"; retrievedAt: string }[] = [];
  private id = 0;
  private readonly deadline = Date.now() + AUDIT_BOUNDS.wallMilliseconds;
  constructor(private readonly fetcher: typeof fetch = fetch, private readonly pacer = new RequestPacer(750), private readonly signal?: AbortSignal) {}
  async request(method: Method, params: readonly unknown[]): Promise<unknown> {
    if (!(AUDIT_READ_METHODS as readonly string[]).includes(method)) throw new DataError("AUDIT_READ_ONLY", "Supplemental method is not on the read-only allowlist.");
    let safeParams: readonly unknown[];
    try { safeParams = normalizeAuditParameters(method, params); }
    catch { throw new DataError("AUDIT_PARAMETERS", "Supplemental parameters failed the bounded public-read schema."); }
    if (++this.id > AUDIT_BOUNDS.requests || Date.now() >= this.deadline) throw new DataError("AUDIT_BUDGET", "Supplemental audit exhausted its fixed read budget.");
    const id = this.id;
    try {
      return await this.pacer.run(async () => {
        const remaining = this.deadline - Date.now();
        if (remaining <= 0 || this.signal?.aborted) throw new Error();
        const deadline = AbortSignal.timeout(Math.min(remaining, AUDIT_BOUNDS.requestMilliseconds));
        const response = await this.fetcher(NETWORK.rpc, { method: "POST", redirect: "error", signal: this.signal ? AbortSignal.any([deadline, this.signal]) : deadline,
          headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params: safeParams }) });
        if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error(); }
        const chunks: Uint8Array[] = []; let size = 0; const reader = response.body.getReader();
        try { for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > AUDIT_BOUNDS.responseBytes) throw new Error(); chunks.push(next.value); } }
        finally { await reader.cancel(); }
        const envelope = z.object({ jsonrpc: z.literal("2.0"), id: z.literal(id), result: z.unknown(), error: z.unknown().optional() }).parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        if (envelope.error !== undefined || envelope.result === undefined) throw new Error();
        const result = normalizeResult(method, envelope.result);
        this.trace.push({ method, params: safeParams, result, outcome: "VALIDATED", retrievedAt: new Date().toISOString() });
        return result;
      });
    } catch {
      this.trace.push({ method, params: safeParams, result: null, outcome: "UNAVAILABLE", retrievedAt: new Date().toISOString() });
      throw new DataError("AUDIT_SOURCE_UNAVAILABLE", "A supplemental public read failed; remote response bodies are omitted.", "oracle", "UNAVAILABLE");
    }
  }
}
