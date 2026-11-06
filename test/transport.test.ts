import { describe, expect, it, vi } from "vitest";
import { DataError, TransientReadError } from "../src/domain/errors.js";
import { RpcClient } from "../src/chain/rpc.js";
import { pacedFetch, publicEndpoint, RequestPacer, retryAfter, retryRead } from "../src/chain/transport.js";
import { assertReadOnlyTool, MCP_READ_TOOLS, PharosMcpClient, SdkMcpSession, unwrapMcpResult } from "../src/mcp/client.js";
import type { McpSession, ToolDefinition } from "../src/mcp/client.js";

const content = (value: unknown) => ({ content: [{ type: "text", text: JSON.stringify(value) }] });
const info = { chainId: 1672, chainIdHex: "0x688", expectedChainId: 1672, chainIdMatches: true };

class SessionFixture implements McpSession {
  calls: string[] = [];
  closed = false;
  constructor(readonly result: unknown = content(info), readonly definitions: ToolDefinition[] = MCP_READ_TOOLS.map(name => ({ name, annotations: { readOnlyHint: true } }))) {}
  async connect(): Promise<void> { /* FIXTURE */ }
  async listTools(): Promise<ToolDefinition[]> { return this.definitions; }
  async callTool(name: string): Promise<unknown> { this.calls.push(name); return this.result; }
  async close(): Promise<void> { this.closed = true; }
}

describe("FIXTURE: bounded public read transports", () => {
  it("retries only transient failures and stops after three attempts", async () => {
    const operation = vi.fn(async () => { throw new TransientReadError("RATE_LIMIT"); });
    const pause = vi.fn(async () => undefined);
    await expect(retryRead(operation, { pause, random: () => 0.5 })).rejects.toMatchObject({ quality: "UNAVAILABLE" });
    expect(operation).toHaveBeenCalledTimes(3);
    expect(pause.mock.calls).toEqual([[1_000], [2_000]]);
    const permanent = vi.fn(async () => { throw new DataError("MALFORMED", "FIXTURE"); });
    await expect(retryRead(permanent, { pause })).rejects.toMatchObject({ code: "MALFORMED" });
    expect(permanent).toHaveBeenCalledTimes(1);
  });
  it("honors Retry-After and refuses to retry early when it exceeds the waiting budget", async () => {
    const pause = vi.fn(async () => undefined);
    let attempts = 0;
    expect(await retryRead(async () => {
      if (++attempts < 2) throw new TransientReadError("HTTP_429", 4_000);
      return "ok";
    }, { pause })).toBe("ok");
    expect(pause).toHaveBeenCalledWith(4_000);
    const operation = vi.fn(async () => { throw new TransientReadError("HTTP_429", 60_000); });
    await expect(retryRead(operation, { pause })).rejects.toMatchObject({ quality: "UNAVAILABLE" });
    expect(operation).toHaveBeenCalledTimes(1);
  });
  it("parses integer and HTTP-date rate-limit delays", () => {
    expect(retryAfter("2")).toBe(2_000);
    expect(retryAfter("Sun, 01 Nov 2026 00:00:04 GMT", Date.parse("2026-11-01T00:00:00Z"))).toBe(4_000);
    expect(retryAfter(null)).toBeNull();
    expect(retryAfter("invalid")).toBeNull();
  });
  it("serializes simultaneous callers and spaces their starts", async () => {
    let clock = 0;
    const starts: number[] = [];
    const pacer = new RequestPacer(750, async delay => { clock += delay; }, () => clock);
    await Promise.all([1, 2, 3].map(() => pacer.run(async () => { starts.push(clock); })));
    expect(starts).toEqual([0, 750, 1_500]);
  });
  it("turns HTTP 429/503 and fetch timeouts into bounded retryable errors", async () => {
    for (const status of [429, 503]) {
      const fetcher = pacedFetch(new RequestPacer(0), vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status, headers: { "retry-after": "2" } })));
      await expect(fetcher("https://rpc.fixture.invalid")).rejects.toMatchObject({ retryAfterMs: 2_000 });
    }
    const fetcher = pacedFetch(new RequestPacer(0), vi.fn<typeof fetch>().mockRejectedValue(new DOMException("FIXTURE", "TimeoutError")));
    await expect(fetcher("https://rpc.fixture.invalid")).rejects.toBeInstanceOf(TransientReadError);
  });
  it("rejects endpoints with credentials, query tokens, or non-HTTPS schemes", () => {
    for (const endpoint of ["http://example.test", "https://name:example@example.test", "https://example.test?x=1", "https://example.test#fragment"]) {
      expect(() => publicEndpoint(endpoint)).toThrow();
    }
  });
  it("validates JSON-RPC IDs and never substitutes null results", async () => {
    const good = new RpcClient(new RequestPacer(0), "https://rpc.fixture.invalid", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x688" }))));
    expect(await good.chainId()).toBe(1672n);
    for (const result of [{ jsonrpc: "2.0", id: 99, result: "0x688" }, { jsonrpc: "2.0", id: 1, result: null }]) {
      const rpc = new RpcClient(new RequestPacer(0), "https://rpc.fixture.invalid", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(result))));
      await expect(rpc.chainId()).rejects.toBeInstanceOf(DataError);
    }
  });
  it("rejects oversized log ranges before contacting an endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const rpc = new RpcClient(new RequestPacer(0), "https://rpc.fixture.invalid", fetcher);
    await expect(rpc.logs("0x0000000000000000000000000000000000000001", [], 1n, 1_001n)).rejects.toMatchObject({ code: "LOG_RANGE" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("FIXTURE: official SDK read-only MCP boundary", () => {
  it("accepts exactly the seven specified MCP tools and rejects signing/broadcast tools", async () => {
    expect(MCP_READ_TOOLS).toHaveLength(7);
    for (const name of MCP_READ_TOOLS) expect(() => assertReadOnlyTool(name)).not.toThrow();
    const session = new SdkMcpSession("https://mcp.fixture.invalid", vi.fn<typeof fetch>());
    for (const name of ["send_raw_transaction", "send_transaction", "personal_sign", "eth_sendRawTransaction"]) {
      expect(() => assertReadOnlyTool(name)).toThrow();
      await expect(session.callTool(name, {})).rejects.toMatchObject({ code: "READ_ONLY" });
    }
  });
  it("unwraps text and structured JSON while rejecting malformed envelopes", () => {
    expect(unwrapMcpResult(content({ result: "0x1234" }))).toEqual({ result: "0x1234" });
    expect(unwrapMcpResult({ structuredContent: { code: "0x1234" } })).toEqual({ code: "0x1234" });
    expect(unwrapMcpResult(content(null))).toBeNull();
    for (const invalid of [null, {}, { content: [{ type: "text", text: "not JSON" }] }, { content: "bad" }]) {
      expect(() => unwrapMcpResult(invalid)).toThrow();
    }
  });
  it("treats server tool errors as failures even if a result also appears", () => {
    expect(() => unwrapMcpResult({ ...content({ result: "0x00" }), isError: true })).toThrow();
    expect(() => unwrapMcpResult({ ...content({ error: { message: "cu limit exceeded; Request too fast" } }), isError: true })).toThrow(TransientReadError);
  });
  it("cross-validates all MCP network fields", async () => {
    const session = new SessionFixture();
    const client = new PharosMcpClient(new RequestPacer(0), "https://mcp.fixture.invalid", () => session);
    expect(await client.chainId()).toBe(1672n);
    expect(session.calls).toEqual(["get_chain_info"]);
    await client.close();
    expect(session.closed).toBe(true);
    for (const invalid of [{ ...info, chainIdHex: "0x1" }, { ...info, chainIdMatches: false }, { ...info, chainId: 1 }]) {
      const broken = new PharosMcpClient(new RequestPacer(0), "https://mcp.fixture.invalid", () => new SessionFixture(content(invalid)));
      await expect(broken.chainId()).rejects.toBeInstanceOf(DataError);
      await broken.close();
    }
  });
  it("rejects missing or explicitly destructive required tools before making chain calls", async () => {
    for (const definitions of [[], MCP_READ_TOOLS.map(name => ({ name, annotations: { destructiveHint: true } }))]) {
      const session = new SessionFixture(content(info), definitions);
      const client = new PharosMcpClient(new RequestPacer(0), "https://mcp.fixture.invalid", () => session);
      await expect(client.chainId()).rejects.toMatchObject({ code: "MCP_TOOL_UNAVAILABLE" });
      expect(session.calls).toEqual([]);
      expect(session.closed).toBe(true);
    }
  });
  it("reconnects once after an expired session without an RPC fallback", async () => {
    const first = new SessionFixture();
    first.callTool = async () => { throw new DataError("SESSION_OR_ENDPOINT_NOT_FOUND", "FIXTURE", "network", "UNAVAILABLE"); };
    const second = new SessionFixture();
    let connections = 0;
    const client = new PharosMcpClient(new RequestPacer(0), "https://mcp.fixture.invalid", () => ++connections === 1 ? first : second);
    expect(await client.chainId()).toBe(1672n);
    expect(connections).toBe(2);
    expect(first.closed).toBe(true);
    await client.close();
  });
});
