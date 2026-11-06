import { randomBytes } from "node:crypto";
import { request } from "node:http";
import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readAuthenticator } from "../src/runtime/auth.js";
import { ReadHttpServer } from "../src/runtime/http.js";
import type { ReadApi, ReadReply } from "../src/runtime/read-model.js";
import { SCHEDULER_PATH, schedulerAuthenticator } from "../src/runtime/scheduler-contract.js";

const SLOT = "2026-11-02T12:05:00.000Z", SLOT_PERIOD = 300, body = JSON.stringify({ slot: SLOT }), servers: ReadHttpServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => server.close())); vi.restoreAllMocks(); });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function fixture(run = vi.fn(async (_slot: string, _signal: AbortSignal): Promise<ReadReply> => ({ status: 200, body: { status: "COMPLETED" } })), api?: ReadApi) {
  const readToken = randomBytes(32).toString("base64url"), secret = randomBytes(32).toString("base64url");
  const read = vi.fn(async () => ({ status: 200, body: { fixture: true } })); let now = Date.now();
  const server = new ReadHttpServer({ api: api ?? { read }, authenticate: readAuthenticator(readToken), lifecycle: () => "RUNNING", now: () => now,
    scheduler: { authenticate: schedulerAuthenticator(secret, readToken), periodSeconds: SLOT_PERIOD, run } }); servers.push(server);
  const address = await server.listen("127.0.0.1", 0);
  const call = (options: { path?: string; method?: string; body?: string | Buffer; headers?: OutgoingHttpHeaders } = {}) => new Promise<{ status: number; text: string; headers: IncomingHttpHeaders }>((resolve, reject) => {
    const bytes = Buffer.from(options.body ?? body);
    const headers = Object.fromEntries(Object.entries({ Authorization: `Bearer ${secret}`, "Content-Type": "application/json",
      "Content-Length": bytes.length, ...options.headers }).filter(([, value]) => value !== undefined));
    const req = request({ host: "127.0.0.1", port: address.port, path: options.path ?? SCHEDULER_PATH, method: options.method ?? "POST", agent: false,
      headers }, response => {
      const chunks: Buffer[] = []; response.on("data", (chunk: Buffer) => { chunks.push(chunk); });
      response.on("end", () => { resolve({ status: response.statusCode!, text: Buffer.concat(chunks).toString("utf8"), headers: response.headers }); });
      response.on("error", reject);
    }); req.on("error", reject); req.end(bytes);
  });
  return { call, read, run, secret, readToken, address, advance: () => { now += 60_001; } };
}

describe("PHASE10 FIXTURE: authenticated, finite scheduler HTTP capability", () => {
  it("separates read and trigger credentials and authenticates before any work", async () => {
    const h = await fixture();
    for (const authorization of [undefined, `Bearer ${h.readToken}`, `Basic ${Buffer.from(`watchdog:${h.secret}`).toString("base64")}`]) {
      const result = await h.call({ headers: { Authorization: authorization } });
      expect(result.status).toBe(401); expect(result.headers["www-authenticate"]).toMatch(/^Bearer/);
      expect(result.text).not.toContain(h.secret); expect(result.text).not.toContain(h.readToken);
    }
    expect((await h.call({ path: "/api/risk", method: "GET", body: "", headers: { "Content-Length": 0 } })).status).toBe(401);
    expect(h.run).not.toHaveBeenCalled(); expect(h.read).not.toHaveBeenCalled();
    expect((await h.call()).status).toBe(200); expect(h.run).toHaveBeenCalledOnce();
  });
  it.each([
    { method: "GET" }, { method: "PUT" }, { method: "HEAD" }, { path: `${SCHEDULER_PATH}?slot=ignored` },
    { headers: { Origin: "https://fixture.invalid" } }, { headers: { "Sec-Fetch-Site": "same-origin" } },
    { headers: { "Content-Type": "text/plain" } }, { headers: { "Content-Encoding": "gzip" } },
    { headers: { "Content-Length": 1025 }, body: "x".repeat(1025) }, { body: "" }
  ])("rejects method, origin, query, media or size violation %# before admission", async options => {
    const h = await fixture(), response = await h.call(options);
    expect([400, 403, 405]).toContain(response.status); expect(h.run).not.toHaveBeenCalled(); expect(h.read).not.toHaveBeenCalled();
  });
  it.each([
    "null", "[]", "{}", '{"slot":123}', '{"slot":"2026-11-02T12:07:00.000Z"}', '{"slot":"2026-02-30T12:05:00.000Z"}',
    '{"slot":"2026-11-02T12:05:01.000Z"}', '{"slot":"2026-11-02T12:05:00Z"}', '{"slot":"2026-11-02T12:05:00.000+00:00"}',
    `{"slot":"${SLOT}","slot":"${SLOT}"}`, `{"slot":"${SLOT}","sql":"SELECT 1"}`, `{"slot":"${SLOT}","threshold":2}`,
    `{"slot":"${SLOT}","url":"https://fixture.invalid"}`, `{"slo\\u0074":"${SLOT}"}`
  ])("rejects malformed/noncanonical JSON or additional authority %#", async payload => {
    const h = await fixture(), response = await h.call({ body: payload });
    expect(response.status).toBe(400); expect(h.run).not.toHaveBeenCalled();
  });
  it("rejects invalid UTF-8 and duplicate Authorization headers", async () => {
    const h = await fixture();
    expect((await h.call({ body: Buffer.from([0xff, 0xfe]) })).status).toBe(400);
    expect((await h.call({ headers: { Authorization: [`Bearer ${h.secret}`, `Bearer ${h.secret}`] } })).status).toBe(400);
    expect(h.run).not.toHaveBeenCalled();
  });
  it("keeps health and read traffic free of monitoring side effects", async () => {
    const h = await fixture();
    for (const path of ["/api/health", "/", "/dashboard.js", "/api/monitoring/status", "/api/observations"]) {
      expect((await h.call({ path, method: "GET", body: "", headers: { Authorization: `Bearer ${h.readToken}`, "Content-Length": 0 } })).status).toBe(200);
    }
    expect(h.run).not.toHaveBeenCalled();
    expect(h.read).toHaveBeenCalledTimes(2);
  });
  it("bounds trigger concurrency, rejects forwarded-identity rate bypass, and leaves health available", async () => {
    const work = deferred<ReadReply>(), entered = deferred<void>(); let count = 0;
    const run = vi.fn(async (_slot: string, _signal: AbortSignal) => { if (++count === 2) entered.resolve(); return work.promise; });
    const h = await fixture(run), first = h.call(), second = h.call(); await entered.promise;
    expect((await h.call({ headers: { "X-Forwarded-For": "192.0.2.1" } })).status).toBe(429); expect(run).toHaveBeenCalledTimes(2);
    expect((await h.call({ path: "/api/health", method: "GET", body: "", headers: { "Content-Length": 0 } })).status).toBe(200);
    work.resolve({ status: 200, body: { status: "COMPLETED" } }); await Promise.all([first, second]);
    for (let index = 0; index < 4; index++) await h.call();
    expect((await h.call()).status).toBe(429); h.advance(); expect((await h.call()).status).toBe(200);
  });
  it("uses the longer socket budget only after a complete authenticated body", async () => {
    const run = vi.fn(async (_slot: string, _signal: AbortSignal) => { await sleep(5_200); return { status: 200, body: { completed: true } }; });
    const h = await fixture(run); expect((await h.call()).status).toBe(200); expect(run).toHaveBeenCalledOnce();
  }, 15_000);
  it("propagates a client disconnect to the admitted job", async () => {
    const entered = deferred<void>(), aborted = deferred<void>();
    const h = await fixture(vi.fn(async (_slot: string, signal: AbortSignal) => {
      entered.resolve(); await new Promise<void>(resolve => { signal.addEventListener("abort", () => { aborted.resolve(); resolve(); }, { once: true }); });
      return { status: 503, body: { error: "CANCELLED" } };
    }));
    const req = request({ host: "127.0.0.1", port: h.address.port, method: "POST", path: SCHEDULER_PATH, agent: false,
      headers: { Authorization: `Bearer ${h.secret}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } });
    req.on("error", () => {}); req.end(body); await entered.promise; req.destroy(); await aborted.promise;
    expect(h.run).toHaveBeenCalledOnce();
  });
  it("sanitizes scheduler failures and coalesces bounded async reads with exact bigint cursors", async () => {
    const marker = randomBytes(32).toString("hex"), pending = deferred<ReadReply>(), entered = deferred<void>();
    const read = vi.fn(async () => { entered.resolve(); return pending.promise; });
    const h = await fixture(vi.fn(async (_slot: string, _signal: AbortSignal): Promise<ReadReply> => { throw new Error(marker); }), { cursorKind: "bigint", read });
    const failure = await h.call(); expect(failure.status).toBe(503); expect(failure.text).not.toContain(marker);
    const options = { path: "/api/observations?before=9007199254740993&limit=1", method: "GET", body: "", headers: { Authorization: `Bearer ${h.readToken}`, "Content-Length": 0 } };
    const a = h.call(options), b = h.call(options); await entered.promise;
    pending.resolve({ status: 200, body: { safe: true } });
    expect((await Promise.all([a, b])).map(reply => reply.status)).toEqual([200, 200]);
    expect(read).toHaveBeenCalledExactlyOnceWith("/api/observations", { limit: 1, before: "9007199254740993" });
  });
});
