import { toHex } from "viem";
import type { Address, Hex } from "viem";
import { z } from "zod";
import { NETWORK, READ_LIMITS } from "../config/deployment.js";
import type { BlockRef, ReadRecord } from "../domain/types.js";
import { DataError, TransientReadError } from "../domain/errors.js";
import { blockSchema, bytesSchema, parseData, quantitySchema } from "../validation/schemas.js";
import { uint } from "../morpho/math.js";
import type { ReadClient } from "./client.js";
import { pacedFetch, publicEndpoint, RequestPacer, retryRead, throwServiceError } from "./transport.js";

export const RPC_READ_METHODS = [
  "eth_chainId", "eth_blockNumber", "eth_getBlockByNumber", "eth_getCode", "eth_call", "eth_getLogs", "eth_getTransactionReceipt"
] as const;
type RpcMethod = typeof RPC_READ_METHODS[number];

const envelopeSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.number().int(),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional()
});

export class RpcClient implements ReadClient {
  readonly kind = "rpc" as const;
  readonly records: ReadRecord[] = [];
  readonly endpoint: string;
  private id = 0;
  private readonly fetcher: typeof fetch;

  constructor(pacer = new RequestPacer(), endpoint: string = NETWORK.rpc, fetchImpl?: typeof fetch, private readonly signal?: AbortSignal) {
    this.endpoint = publicEndpoint(endpoint, fetchImpl !== undefined).href;
    if (this.endpoint !== new URL(NETWORK.rpc).href && this.endpoint !== "https://rpc.fixture.invalid/") throw new DataError("INVALID_ENDPOINT", "RPC must use the configured endpoint.");
    this.fetcher = pacedFetch(pacer, fetchImpl, signal);
  }

  private async request(method: RpcMethod, params: readonly unknown[], blockNumber: bigint | null): Promise<unknown> {
    if (!(RPC_READ_METHODS as readonly string[]).includes(method)) throw new DataError("READ_ONLY", "RPC method is not on the read-only allowlist.");
    const requestId = ++this.id;
    const result = await retryRead(async () => {
      const response = await this.fetcher(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params })
      });
      let json: unknown;
      try { json = await response.json(); } catch (error) {
        if (error instanceof TransientReadError) throw error;
        if (error instanceof DataError && ["RESPONSE_SIZE", "READ_CANCELLED"].includes(error.code)) throw error;
        throw new DataError("RPC_JSON", "RPC response was not bounded valid JSON.", "network");
      }
      const envelope = parseData(envelopeSchema, json, "RPC_ENVELOPE", "network");
      if (envelope.id !== requestId) throw new DataError("RPC_ID_MISMATCH", "RPC response ID does not match the request.", "consistency");
      if (envelope.error) throwServiceError(envelope.error.message);
      if (envelope.result === undefined) throw new DataError("RPC_NO_RESULT", "RPC returned no result.", "network", "UNAVAILABLE");
      return envelope.result;
    }, this.signal ? { signal: this.signal } : {});
    // Deliberately record only public read inputs/results, never transport headers.
    this.records.push({ source: this.kind, endpoint: this.endpoint, method, blockNumber, params, result, retrievedAt: new Date().toISOString() });
    return result;
  }

  async chainId(): Promise<bigint> {
    return parseData(quantitySchema, await this.request("eth_chainId", [], null), "RPC_CHAIN_ID", "network");
  }

  async blockNumber(): Promise<bigint> {
    return parseData(quantitySchema, await this.request("eth_blockNumber", [], null), "RPC_BLOCK_NUMBER", "network");
  }

  async block(number: bigint): Promise<BlockRef> {
    const result = await this.request("eth_getBlockByNumber", [toHex(uint(number)), false], number);
    if (result === null) throw new DataError("BLOCK_UNAVAILABLE", "The requested block is unavailable.", "consistency", "UNAVAILABLE");
    return parseData(blockSchema, result, "RPC_BLOCK", "consistency");
  }

  async code(address: Address, block: bigint): Promise<Hex> {
    return parseData(bytesSchema, await this.request("eth_getCode", [address, toHex(uint(block))], block), "RPC_CODE", "contracts");
  }

  async call(to: Address, data: Hex, block: bigint): Promise<Hex> {
    return parseData(bytesSchema, await this.request("eth_call", [{ to, data }, toHex(uint(block))], block), "RPC_CALL", "snapshot");
  }

  async logs(address: Address, topics: readonly (Hex | null)[], from: bigint, to: bigint): Promise<unknown> {
    uint(from); uint(to);
    if (to < from || to - from + 1n > READ_LIMITS.maxLogBlocks) throw new DataError("LOG_RANGE", "Log ranges are limited to 1,000 blocks.");
    return this.request("eth_getLogs", [{ address, topics, fromBlock: toHex(from), toBlock: toHex(to) }], to);
  }

  async receipt(hash: Hex): Promise<unknown> {
    return this.request("eth_getTransactionReceipt", [hash], null);
  }

  async close(): Promise<void> { /* No long-lived RPC connection owned by this client. */ }
}
