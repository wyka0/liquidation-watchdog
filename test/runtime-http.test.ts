import { randomBytes } from "node:crypto";
import { request } from "node:http";
import { connect } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataError } from "../src/domain/errors.js";
import { readAuthenticator } from "../src/runtime/auth.js";
import { HTTP_LIMITS, ReadHttpServer } from "../src/runtime/http.js";
import { READ_ROUTES } from "../src/runtime/read-model.js";
import type { Lifecycle, ReadApi } from "../src/runtime/read-model.js";

const servers: ReadHttpServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => server.close())); vi.restoreAllMocks(); });
async function fixture(api: ReadApi = { read: () => ({ status: 200, body: { safe: true } }) }) {
  const credential = randomBytes(32).toString("base64url"), read = vi.spyOn(api, "read"); let time = Date.now(), lifecycle: Lifecycle = "RUNNING";
  const server = new ReadHttpServer({ api, authenticate: readAuthenticator(credential), lifecycle: () => lifecycle, now: () => time }); servers.push(server);
  const address = await server.listen("127.0.0.1", 0), url = `http://127.0.0.1:${address.port}`;
  return { server, read, url, address, credential, advance: (ms: number) => { time += ms; }, lifecycle: (value: Lifecycle) => { lifecycle = value; },
    get: (path: string, options: RequestInit = {}) => fetch(url + path, { ...options, headers: { Authorization: `Bearer ${credential}`, ...options.headers }, signal: AbortSignal.timeout(5_000) }) };
}

describe("PHASE8 FIXTURE: authenticated read-only HTTP boundaries", () => {
  it("requires a bounded explicit credential and compares bearer/Basic digests", () => {
    for (const value of [undefined, "", "x".repeat(31), "x".repeat(257), " ".repeat(40)]) expect(() => readAuthenticator(value)).toThrow("credential");
    const credential = randomBytes(32).toString("base64url"), authenticate = readAuthenticator(credential);
    expect(authenticate(`Bearer ${credential}`)).toBe(true); expect(authenticate(`Basic ${Buffer.from(`watchdog:${credential}`).toString("base64")}`)).toBe(true);
    for (const header of [undefined, `Bearer ${credential}x`, `Basic ${Buffer.from(`wrong:${credential}`).toString("base64")}`, "Basic !!!", "Bearer x", "x".repeat(1_025)]) expect(authenticate(header)).toBe(false);
  });
  it("serves tiny in-memory public health, including disabled and terminal status, without read-model calls", async () => {
    const h = await fixture();
    for (const state of ["RUNNING", "DISABLED", "STARTING", "FAILED", "STOPPING"] as const) {
      h.lifecycle(state); const response = await fetch(h.url + "/api/health");
      expect(response.status).toBe(["RUNNING", "DISABLED"].includes(state) ? 200 : 503); expect(await response.json()).toEqual({ status: state });
    }
    expect(h.read).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated data, dashboard and asset requests before any read", async () => {
    const h = await fixture();
    for (const path of [...READ_ROUTES, "/", "/dashboard.js", "/dashboard.css"]) {
      const response = await fetch(h.url + path); expect(response.status).toBe(401); expect(response.headers.get("www-authenticate")).toContain("Basic realm");
      expect(await response.json()).toEqual({ error: "AUTHENTICATION_REQUIRED" });
    }
    expect(h.read).not.toHaveBeenCalled();
  });
  it("allows GET/HEAD, rejects mutation methods and exposes no transaction/admin routes", async () => {
    const h = await fixture();
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) expect((await h.get("/api/positions", { method })).status).toBe(405);
    for (const path of ["/api/repay", "/api/collateral", "/api/sign", "/api/broadcast", "/api/database-init", "/api/monitor/start", "/storage/watchdog.sqlite", "/evidence/phase1", "/api/%72isk"]) expect((await h.get(path)).status).toBe(404);
    const head = await h.get("/api/risk", { method: "HEAD" }); expect(head.status).toBe(200); expect(await head.text()).toBe("");
  });
  it("validates canonical pagination, rejects duplicate/unknown/body requests, and never selects arbitrary providers or SQL", async () => {
    const h = await fixture();
    for (const query of ["limit=0", "limit=101", "limit=01", "limit=1.5", "limit=-1", "limit=1&limit=2", "before=9007199254740992", "before=-1", "file=db", "url=https://example.test", "sql=SELECT", "chain=1"]) {
      expect((await h.get(`/api/alerts?${query}`)).status).toBe(400);
    }
    expect((await h.get("/api/risk?limit=2")).status).toBe(400);
    expect((await h.get("/api/alerts?limit=100&before=42")).status).toBe(200); expect(h.read).toHaveBeenLastCalledWith("/api/alerts", { limit: 100, before: 42 });
    const bodyStatus = await new Promise<number>(resolve => {
      const req = request(h.url + "/api/risk", { method: "GET", headers: { "Content-Length": "1" } }, res => { res.resume(); resolve(res.statusCode!); }); req.end("x");
    });
    expect(bodyStatus).toBe(400);
  });
  it("sets restrictive headers, supports browser Basic auth, and serves no embedded credential or unescaped dynamic HTML", async () => {
    const h = await fixture(), basic = `Basic ${Buffer.from(`watchdog:${h.credential}`).toString("base64")}`;
    const response = await h.get("/", { headers: { Authorization: basic } }), html = await response.text();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'"); expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("access-control-allow-origin")).toBeNull(); expect(html.includes(h.credential)).toBe(false);
    const script = await (await h.get("/dashboard.js")).text();
    expect(script).toContain("textContent"); expect(/innerHTML|document\.write|localStorage|sessionStorage/.test(script)).toBe(false);
    expect(script.includes(h.credential)).toBe(false); expect(h.read).not.toHaveBeenCalled();
    expect((await h.get("/api/risk", { headers: { "Sec-Fetch-Site": "cross-site" } })).status).toBe(403);
  });
  it("caps responses and sanitizes even secret-like or path-bearing exceptions", async () => {
    const h = await fixture({ read: () => { throw new Error("synthetic-internal-location"); } });
    const response = await h.get("/api/risk"); expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "DATA_UNAVAILABLE" });
    h.read.mockImplementation(() => ({ status: 200, body: { value: "x".repeat(HTTP_LIMITS.responseBytes) } }));
    expect((await h.get("/api/risk")).status).toBe(413);
    h.read.mockImplementation(() => { throw new DataError("READ_LIMIT", "synthetic detail"); });
    expect(await (await h.get("/api/risk")).json()).toEqual({ error: "RESPONSE_LIMIT" });
  });
  it("caches bounded read work, expires it, and limits unique cache-miss queries", async () => {
    const h = await fixture();
    await (await h.get("/api/risk")).arrayBuffer(); await (await h.get("/api/risk")).arrayBuffer(); expect(h.read).toHaveBeenCalledTimes(1);
    h.advance(1_001); await (await h.get("/api/risk")).arrayBuffer(); expect(h.read).toHaveBeenCalledTimes(2);
    const statuses = [];
    for (let before = 1; before <= 12; before++) statuses.push((await h.get(`/api/alerts?before=${before}`)).status);
    expect(statuses).toContain(429); expect(h.read.mock.calls.length).toBeLessThanOrEqual(1 + HTTP_LIMITS.readsPerSecond);
  });
  it("bounds concurrent/API-rate work while health remains available; forwarded headers cannot bypass it", async () => {
    const h = await fixture();
    const concurrent = await Promise.all(Array.from({ length: 40 }, (_, index) => h.get("/api/risk", { headers: { "X-Forwarded-For": `192.0.2.${index}` } })));
    expect(concurrent.some(response => response.status === 429)).toBe(true);
    for (const response of concurrent) await response.arrayBuffer();
    for (let index = 0; index <= HTTP_LIMITS.clientPerMinute; index++) await (await h.get("/api/risk")).arrayBuffer();
    expect((await h.get("/api/risk", { headers: { "X-Forwarded-For": "198.51.100.1" } })).status).toBe(429);
    expect((await fetch(h.url + "/api/health")).status).toBe(200); h.advance(60_001); expect((await h.get("/api/risk")).status).toBe(200);
  });
  it("rejects oversized headers and destroys idle partial requests within bounded HTTP shutdown", async () => {
    const h = await fixture();
    const status = await new Promise<number>(resolve => {
      const req = request(h.url + "/api/risk", { headers: { Authorization: "x".repeat(9_000) } }, res => { res.resume(); resolve(res.statusCode!); }); req.end();
    }); expect(status).toBe(400);
    const socket = connect(h.address.port, "127.0.0.1"); await new Promise<void>(resolve => { socket.once("connect", resolve); });
    socket.write("GET /api/risk HTTP/1.1\r\nHost: localhost\r\n");
    const closed = new Promise<void>(resolve => { socket.once("close", () => { resolve(); }); });
    const start = performance.now(); const stop = h.server.close(); expect(h.server.close()).toBe(stop); await stop; await closed;
    expect(performance.now() - start).toBeLessThan(3_000);
  });
});
