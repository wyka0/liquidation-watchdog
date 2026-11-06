import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RpcClient } from "../src/chain/rpc.js";
import { MAX_RESPONSE_BYTES, pacedFetch, publicEndpoint, RequestPacer, retryRead } from "../src/chain/transport.js";
import { NETWORK, READ_LIMITS } from "../src/config/deployment.js";
import { DataError, TransientReadError } from "../src/domain/errors.js";
import { MCP_READ_TOOLS, PharosMcpClient, SdkMcpSession } from "../src/mcp/client.js";
import type { McpSession } from "../src/mcp/client.js";
import type { Alert } from "../src/monitoring/model.js";
import { DiscordAdapter } from "../src/notifications/adapters.js";
import { probeConnectivity } from "../src/operations/connectivity.js";
import { FixtureClient, fixtureAlert, monitoringFixture } from "./fixtures/phase4.js";

let alert: Alert;
beforeAll(async () => { alert = fixtureAlert(await monitoringFixture()); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const endpoint = ["https://discord.com/api/webhooks", "123456789", "fixture".repeat(6)].join("/");
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const session = (): McpSession => ({
  connect: vi.fn(async () => {}), listTools: vi.fn(async () => MCP_READ_TOOLS.map(name => ({ name, annotations: { readOnlyHint: true } }))),
  callTool: vi.fn(async () => ({ structuredContent: { chainId: 1672, chainIdHex: "0x688", expectedChainId: 1672, chainIdMatches: true } })), close: vi.fn(async () => {})
});

describe("FIXTURE: bounded streaming reads and endpoint isolation", () => {
  it.each(["https://127.0.0.1/", "https://169.254.169.254/", "https://rpc.pharos.xyz.evil.invalid/", "https://rpc.pharos.xyz/private",
    "https://rpc.pharos.xyz/?key=fixture", "https://rpc.pharos.xyz:8443/", "https://mcp.pharos.xyz/other", "https://rpc.fixture.invalid/"])(
    "rejects unauthorized production endpoint %s", url => { expect(() => publicEndpoint(url)).toThrow("fixed public"); });
  it("rejects redirect responses and overrides redirect-following request options", async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://127.0.0.1" } }));
    const fetcher = pacedFetch(new RequestPacer(0), http);
    await expect(fetcher(NETWORK.rpc, { redirect: "follow" })).rejects.toMatchObject({ code: "HTTP_302" });
    expect(http).toHaveBeenCalledOnce(); expect(http.mock.calls[0]?.[1]?.redirect).toBe("error");
  });
  it.each(["declared", "streamed"])("rejects %s oversized bodies and cancels the underlying stream", async mode => {
    const cancel = vi.fn(), stream = new ReadableStream<Uint8Array>({ start(controller) { if (mode === "streamed") controller.enqueue(new Uint8Array(MAX_RESPONSE_BYTES + 1)); }, cancel });
    const http = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream, { headers: mode === "declared" ? { "content-length": String(MAX_RESPONSE_BYTES + 1) } : {} }));
    const read = async () => (await pacedFetch(new RequestPacer(0), http)(NETWORK.rpc)).text();
    await expect(read()).rejects.toMatchObject({ code: "RESPONSE_SIZE" }); expect(cancel).toHaveBeenCalledOnce();
  });
  it("streams an MCP SSE event before the server closes and cleans up on caller cancellation", async () => {
    const cancel = vi.fn(), stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("event: message\ndata: {}\n\n")); }, cancel });
    const cancellation = new AbortController(), http = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream, { headers: { "content-type": "text/event-stream" } }));
    const response = await pacedFetch(new RequestPacer(0), http, cancellation.signal)(NETWORK.mcp), reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain("event: message");
    cancellation.abort(); await expect(reader.read()).rejects.toMatchObject({ code: "READ_CANCELLED" });
    expect(cancel).toHaveBeenCalledOnce(); reader.releaseLock();
  });
  it.each(["headers", "body"])("terminates stalled %s within the read budget even if the fake ignores cancellation", async mode => {
    vi.useFakeTimers(); const entered = deferred<void>(), late = deferred<Response>(), cancel = vi.fn();
    const http = vi.fn<typeof fetch>(async () => {
      entered.resolve(); return mode === "headers" ? late.promise : new Response(new ReadableStream<Uint8Array>({ cancel }));
    });
    const result = (async () => (await pacedFetch(new RequestPacer(0), http)(NETWORK.rpc)).text())().catch(error => error as unknown);
    await entered.promise; await vi.advanceTimersByTimeAsync(READ_LIMITS.timeoutMs + 1);
    expect(await result).toBeInstanceOf(TransientReadError);
    if (mode === "headers") { late.resolve(new Response(new ReadableStream<Uint8Array>({ cancel }))); await Promise.resolve(); await Promise.resolve(); }
    expect(cancel).toHaveBeenCalledOnce(); expect(http.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
  it("uses exactly three same-endpoint read attempts after 5xx exhaustion and retains no partial result", async () => {
    vi.useFakeTimers(); const http = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 503 }));
    const rpc = new RpcClient(new RequestPacer(0), NETWORK.rpc, http), result = rpc.chainId().catch(error => error as unknown);
    await vi.advanceTimersByTimeAsync(10_000); expect(await result).toMatchObject({ code: "HTTP_503", quality: "UNAVAILABLE" });
    expect(http).toHaveBeenCalledTimes(3); expect(rpc.records).toEqual([]);
    for (const [url, request] of http.mock.calls) {
      expect(url).toBe(new URL(NETWORK.rpc).href); expect(JSON.parse(String(request?.body))).toMatchObject({ method: "eth_chainId", params: [] });
    }
  });
  it("bounds jitter and refuses excessive Retry-After without retrying early", async () => {
    for (const [sample, delay] of [[-1, 800], [2, 1_200], [NaN, 1_000]] as const) {
      const wait = vi.fn(async () => {}); let attempts = 0;
      expect(await retryRead(async () => { if (++attempts === 1) throw new TransientReadError("HTTP_429"); return 1672; }, { pause: wait, random: () => sample })).toBe(1672);
      expect(wait).toHaveBeenCalledWith(delay);
    }
    const wait = vi.fn(async () => {}), operation = vi.fn(async () => { throw new TransientReadError("HTTP_429", 1_000_000); });
    await expect(retryRead(operation, { pause: wait })).rejects.toMatchObject({ code: "HTTP_429" });
    expect(operation).toHaveBeenCalledOnce(); expect(wait).not.toHaveBeenCalled();
  });
  it("does not substitute a network or value for unavailable historical state", async () => {
    const http = vi.fn<typeof fetch>().mockImplementation(async (_input, request) => {
      const body = JSON.parse(String(request?.body)) as { id: number };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "missing trie node: fixture pruned history" } }));
    });
    const rpc = new RpcClient(new RequestPacer(0), NETWORK.rpc, http);
    await expect(rpc.call("0x0000000000000000000000000000000000000001", "0x1234", 12n)).rejects.toMatchObject({ code: "SERVICE_READ_FAILED" });
    expect(http).toHaveBeenCalledOnce(); expect(JSON.parse(String(http.mock.calls[0]?.[1]?.body)).params[1]).toBe("0xc"); expect(rpc.records).toEqual([]);
  });
});

describe("FIXTURE: MCP/session and connectivity failure recovery", () => {
  it.each(["connect", "listTools", "callTool"] as const)("bounds a stalled MCP %s and prevents late tool use", async step => {
    vi.useFakeTimers(); const fixture = session(), entered = deferred<void>(), waiting = deferred<never>();
    vi.mocked(fixture[step]).mockImplementation(() => { entered.resolve(); return waiting.promise; });
    const client = new PharosMcpClient(new RequestPacer(0), NETWORK.mcp, () => fixture);
    const result = client.chainId().catch(error => error as unknown); await entered.promise;
    await vi.advanceTimersByTimeAsync((step === "listTools" ? 80_000 : 20_000) + 1);
    expect(await result).toMatchObject({ code: "MCP_TIMEOUT" }); await client.close();
    expect(fixture.close).toHaveBeenCalledOnce(); expect(client.records).toEqual([]);
    if (step !== "callTool") expect(fixture.callTool).not.toHaveBeenCalled();
  });
  it("bounds official SDK tool-discovery pagination to four pages", async () => {
    const list = vi.spyOn(Client.prototype, "listTools").mockResolvedValue({ tools: [], nextCursor: "fixture-next" });
    const sdk = new SdkMcpSession(NETWORK.mcp, vi.fn<typeof fetch>());
    await expect(sdk.listTools()).rejects.toMatchObject({ code: "MCP_TOOL_PAGINATION" }); expect(list).toHaveBeenCalledTimes(4);
  });
  it("stops after one reconnect if the replacement session also expires", async () => {
    const first = session(), second = session();
    for (const fixture of [first, second]) vi.mocked(fixture.callTool).mockRejectedValue(new DataError("SESSION_OR_ENDPOINT_NOT_FOUND", "fixture"));
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second), client = new PharosMcpClient(new RequestPacer(0), NETWORK.mcp, factory);
    await expect(client.chainId()).rejects.toMatchObject({ code: "SESSION_OR_ENDPOINT_NOT_FOUND" }); await client.close();
    expect(factory).toHaveBeenCalledTimes(2); expect(first.close).toHaveBeenCalledOnce(); expect(second.close).toHaveBeenCalledOnce();
  });
  it("marks chain mismatch unavailable while probing and closing the other path", async () => {
    const rpc = new FixtureClient("rpc", { chainId: 1n }), mcp = new FixtureClient("mcp"), closes = [vi.spyOn(rpc, "close"), vi.spyOn(mcp, "close")];
    const result = await probeConnectivity(1_000, () => ({ rpc, mcp }));
    expect(result).toMatchObject({ rpc: "UNAVAILABLE", mcp: "REACHABLE", mode: "EXPLICIT_READ_ONLY_PROBE" });
    closes.forEach(close => { expect(close).toHaveBeenCalledOnce(); });
  });
  it("closes timed-out probes, starts no follow-on read and does not mutate the returned status on a late answer", async () => {
    vi.useFakeTimers(); const rpc = new FixtureClient("rpc"), mcp = new FixtureClient("mcp"), entered = deferred<void>(), late = deferred<bigint>();
    vi.spyOn(rpc, "chainId").mockImplementation(() => { entered.resolve(); return late.promise; });
    const block = vi.spyOn(rpc, "blockNumber"), other = vi.spyOn(mcp, "chainId"), closes = [vi.spyOn(rpc, "close"), vi.spyOn(mcp, "close")];
    const probe = probeConnectivity(1_000, () => ({ rpc, mcp })); await entered.promise; await vi.advanceTimersByTimeAsync(1_001);
    const result = await probe, before = JSON.stringify(result); late.resolve(1672n); await Promise.resolve(); await Promise.resolve();
    expect(result).toMatchObject({ rpc: "UNAVAILABLE", mcp: "UNAVAILABLE" }); expect(JSON.stringify(result)).toBe(before);
    expect(block).not.toHaveBeenCalled(); expect(other).not.toHaveBeenCalled(); closes.forEach(close => { expect(close).toHaveBeenCalledOnce(); });
  });
});

describe("FIXTURE: mocked notification cancellation", () => {
  it.each(["headers", "body"])("records a stalled %s acknowledgment as ambiguous and cancels its stream", async mode => {
    vi.useFakeTimers(); const entered = deferred<void>(), late = deferred<Response>(), cancel = vi.fn();
    const http = vi.fn(async () => { entered.resolve(); return mode === "headers" ? late.promise : new Response(new ReadableStream<Uint8Array>({ cancel })); });
    const result = new DiscordAdapter(endpoint, http, 25).send(alert); await entered.promise; await vi.advanceTimersByTimeAsync(26);
    expect(await result).toMatchObject({ delivered: false, code: "PROVIDER_TIMEOUT", ambiguous: true, retryable: true });
    if (mode === "headers") { late.resolve(new Response(new ReadableStream<Uint8Array>({ cancel }))); await Promise.resolve(); await Promise.resolve(); }
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("does not start an HTTP request when the caller has already cancelled dispatch", async () => {
    const cancellation = new AbortController(); cancellation.abort(); const http = vi.fn();
    expect(await new DiscordAdapter(endpoint, http).send(alert, cancellation.signal)).toMatchObject({ delivered: false, ambiguous: true });
    expect(http).not.toHaveBeenCalled();
  });
});
