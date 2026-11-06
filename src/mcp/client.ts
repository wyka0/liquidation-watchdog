import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { toHex } from "viem";
import type { Address, Hex } from "viem";
import { z } from "zod";
import { NETWORK, READ_LIMITS } from "../config/deployment.js";
import { DataError } from "../domain/errors.js";
import type { BlockRef, ReadRecord } from "../domain/types.js";
import type { ReadClient } from "../chain/client.js";
import { pacedFetch, publicEndpoint, RequestPacer, retryRead, throwServiceError } from "../chain/transport.js";
import { blockSchema, bytesSchema, parseData, quantitySchema } from "../validation/schemas.js";
import { uint } from "../morpho/math.js";
import { validateChainId } from "../validation/market.js";
import { bounded } from "../operations/deadline.js";

export const MCP_READ_TOOLS = [
  "get_chain_info", "get_block_number", "get_block", "get_code", "eth_call", "get_logs", "get_transaction_receipt"
] as const;
type McpTool = typeof MCP_READ_TOOLS[number];

export interface ToolDefinition {
  name: string;
  annotations?: { readOnlyHint?: boolean | undefined; destructiveHint?: boolean | undefined } | undefined;
}

export interface McpSession {
  connect(): Promise<void>;
  listTools(): Promise<ToolDefinition[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export function assertReadOnlyTool(name: string): asserts name is McpTool {
  if (!(MCP_READ_TOOLS as readonly string[]).includes(name)) {
    throw new DataError("READ_ONLY", "MCP tool is not on the read-only allowlist.", "network");
  }
}

export class SdkMcpSession implements McpSession {
  private readonly client = new Client({ name: "liquidation-watchdog", version: "0.1.0" });
  private readonly transport: StreamableHTTPClientTransport;
  private readonly requestOptions = { timeout: READ_LIMITS.timeoutMs + 5_000, maxTotalTimeout: READ_LIMITS.timeoutMs + 5_000 };

  constructor(endpoint: string, fetcher: typeof fetch) {
    this.transport = new StreamableHTTPClientTransport(publicEndpoint(endpoint, true), {
      fetch: fetcher,
      requestInit: { redirect: "error" }
    });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport, this.requestOptions);
  }

  async listTools(): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 4; page += 1) {
      const response = await this.client.listTools(cursor ? { cursor } : {}, this.requestOptions);
      tools.push(...response.tools);
      cursor = response.nextCursor;
      if (!cursor) return tools;
    }
    throw new DataError("MCP_TOOL_PAGINATION", "MCP tool discovery exceeded its bounded page limit.", "network");
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    assertReadOnlyTool(name);
    return this.client.callTool({ name, arguments: args }, undefined, this.requestOptions);
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

const toolEnvelopeSchema = z.object({
  isError: z.boolean().optional(),
  structuredContent: z.unknown().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional()
});

export function unwrapMcpResult(raw: unknown): unknown {
  const envelope = parseData(toolEnvelopeSchema, raw, "MCP_ENVELOPE", "network");
  const text = (envelope.content ?? []).filter(item => item.type === "text").map(item => item.text ?? "").join("\n");
  let result: unknown = envelope.structuredContent;
  if (result === undefined && text.trim()) {
    try { result = JSON.parse(text) as unknown; } catch {
      if (!envelope.isError) throw new DataError("MCP_JSON", "MCP tool response was not JSON.", "network");
    }
  }
  if (envelope.isError) throwServiceError(text);
  if (result === undefined) throw new DataError("MCP_NO_RESULT", "MCP tool returned no result.", "network", "UNAVAILABLE");
  const error = z.object({ error: z.object({ message: z.string() }) }).safeParse(result);
  if (error.success) throwServiceError(error.data.error.message);
  return result;
}

const chainInfoSchema = z.object({
  chainId: quantitySchema,
  chainIdHex: quantitySchema,
  expectedChainId: quantitySchema,
  chainIdMatches: z.boolean()
});

export class PharosMcpClient implements ReadClient {
  readonly kind = "mcp" as const;
  readonly records: ReadRecord[] = [];
  readonly endpoint: string;
  private session: McpSession | null = null;
  private tools: ToolDefinition[] = [];
  private readonly factory: () => McpSession;

  constructor(pacer = new RequestPacer(), endpoint: string = NETWORK.mcp, factory?: () => McpSession, private readonly signal?: AbortSignal) {
    this.endpoint = publicEndpoint(endpoint, factory !== undefined).href;
    if (this.endpoint !== new URL(NETWORK.mcp).href && this.endpoint !== "https://mcp.fixture.invalid/") throw new DataError("INVALID_ENDPOINT", "MCP must use the configured endpoint.");
    this.factory = factory ?? (() => new SdkMcpSession(this.endpoint, pacedFetch(pacer, globalThis.fetch, signal)));
  }

  private async open(): Promise<void> {
    if (this.session !== null) return;
    await retryRead(async () => {
      const session = this.factory();
      try {
        await bounded(() => session.connect(), 20_000, "MCP_TIMEOUT", this.signal);
        const tools = await bounded(() => session.listTools(), 80_000, "MCP_TIMEOUT", this.signal);
        for (const required of ["get_chain_info", "get_block_number", "get_block", "get_code", "eth_call"]) {
          const tool = tools.find(item => item.name === required);
          if (!tool || tool.annotations?.readOnlyHint === false || tool.annotations?.destructiveHint === true) {
            throw new DataError("MCP_TOOL_UNAVAILABLE", `Required read-only MCP tool ${required} is unavailable.`, "network", "UNAVAILABLE");
          }
        }
        this.session = session;
        this.tools = tools;
      } catch (error) {
        await bounded(() => session.close(), 1_000, "MCP_CLOSE_TIMEOUT").catch(() => undefined);
        throw error;
      }
    }, this.signal ? { signal: this.signal } : {});
  }

  private async invoke(name: McpTool, args: Record<string, unknown>, blockNumber: bigint | null): Promise<unknown> {
    assertReadOnlyTool(name);
    await this.open();
    let reconnected = false;
    const result = await retryRead(async () => {
      for (;;) {
        const tool = this.tools.find(item => item.name === name);
        if (!tool || tool.annotations?.readOnlyHint === false || tool.annotations?.destructiveHint === true) {
          throw new DataError("MCP_TOOL_UNAVAILABLE", "The requested MCP read tool is unavailable.", "network", "UNAVAILABLE");
        }
        if (!this.session) throw new DataError("MCP_NOT_CONNECTED", "MCP is not connected.", "network", "UNAVAILABLE");
        try {
          const session = this.session;
          return unwrapMcpResult(await bounded(() => session.callTool(name, args), 20_000, "MCP_TIMEOUT", this.signal));
        } catch (error) {
          if (error instanceof DataError && error.code === "SESSION_OR_ENDPOINT_NOT_FOUND" && !reconnected) {
            reconnected = true;
            await this.close();
            await this.open();
            // The inspector also revalidates both chain IDs before accepting the snapshot.
            continue;
          }
          throw error;
        }
      }
    }, this.signal ? { signal: this.signal } : {});
    this.records.push({ source: this.kind, endpoint: this.endpoint, method: name, blockNumber, params: args, result, retrievedAt: new Date().toISOString() });
    return result;
  }

  async chainId(): Promise<bigint> {
    const data = parseData(chainInfoSchema, await this.invoke("get_chain_info", {}, null), "MCP_CHAIN_INFO", "network");
    validateChainId(data.chainId);
    if (data.chainIdHex !== data.chainId || data.expectedChainId !== data.chainId || !data.chainIdMatches) {
      throw new DataError("MCP_CHAIN_MISMATCH", "MCP network fields disagree with one another.", "network");
    }
    return data.chainId;
  }

  async blockNumber(): Promise<bigint> {
    const data = parseData(z.object({ blockNumber: quantitySchema }), await this.invoke("get_block_number", {}, null), "MCP_BLOCK_NUMBER", "network");
    return data.blockNumber;
  }

  async block(number: bigint): Promise<BlockRef> {
    const result = await this.invoke("get_block", { block: toHex(uint(number)), includeTransactions: false }, number);
    if (result === null) throw new DataError("BLOCK_UNAVAILABLE", "MCP could not retrieve the requested block.", "consistency", "UNAVAILABLE");
    return parseData(blockSchema, result, "MCP_BLOCK", "consistency");
  }

  async code(address: Address, block: bigint): Promise<Hex> {
    return parseData(z.object({ code: bytesSchema }), await this.invoke("get_code", { address, block: toHex(uint(block)) }, block), "MCP_CODE", "contracts").code;
  }

  async call(to: Address, data: Hex, block: bigint): Promise<Hex> {
    return parseData(z.object({ result: bytesSchema }), await this.invoke("eth_call", { transaction: { to, data }, block: toHex(uint(block)) }, block), "MCP_CALL", "snapshot").result;
  }

  async close(): Promise<void> {
    const session = this.session;
    this.session = null;
    this.tools = [];
    if (session) await bounded(() => session.close(), 1_000, "MCP_CLOSE_TIMEOUT").catch(() => undefined);
  }
}
