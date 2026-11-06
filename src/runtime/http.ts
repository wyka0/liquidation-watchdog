import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { DataError } from "../domain/errors.js";
import { DASHBOARD_CSS, DASHBOARD_HTML, DASHBOARD_JS } from "./dashboard.js";
import { CACHE_MILLISECONDS, READ_ROUTES } from "./read-model.js";
import type { Lifecycle, Page, ReadApi, ReadReply, ReadRoute } from "./read-model.js";
import { PG_LIMITS } from "../config/postgres.js";
import { sequence } from "../storage/postgres/codec.js";
import { SCHEDULER_PATH, parseSchedulerBody } from "./scheduler-contract.js";
import type { SchedulerEndpoint } from "./scheduler.js";

export const HTTP_LIMITS = Object.freeze({ headerBytes: 8_192, urlBytes: 2_048, responseBytes: 256 * 1_024,
  connections: 64, inFlight: 16, clientInFlight: 4, clientIdentities: 256, globalPerMinute: 300, clientPerMinute: 120,
  readsPerSecond: 8, cacheEntries: 16, cacheBytes: 4 * 1_024 ** 2 });
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer", "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" };
type Encoded = { status: number; bytes: Buffer; type: string };
type Client = { until: number; count: number; inFlight: number };
export interface HttpOptions { api: ReadApi; authenticate: (header: string | undefined) => boolean; lifecycle: () => Lifecycle; now?: () => number; scheduler?: SchedulerEndpoint }

/** No static-file root, upstream client, SQL handle, writable store or request logger. */
export class ReadHttpServer {
  private readonly server = createServer({ maxHeaderSize: HTTP_LIMITS.headerBytes, requestTimeout: 10_000, headersTimeout: 5_000,
    keepAliveTimeout: 1_000, connectionsCheckingInterval: 1_000 }, (request, response) => { this.handle(request, response); });
  private accepting = true;
  private closing: Promise<void> | null = null;
  private readonly sockets = new Set<Socket>();
  private readonly clients = new Map<string, Client>();
  private readonly cache = new Map<string, { until: number; reply: Encoded }>();
  private readonly pendingReads = new Map<string, Promise<Encoded>>();
  private cacheBytes = 0;
  private inFlight = 0;
  private global = { until: 0, count: 0 };
  private reads = { until: 0, count: 0 };
  private scheduled = { until: 0, count: 0, active: 0 };
  private readonly now: () => number;

  constructor(private readonly options: HttpOptions) {
    this.now = options.now ?? Date.now;
    this.server.maxConnections = HTTP_LIMITS.connections; this.server.maxHeadersCount = 32; this.server.maxRequestsPerSocket = 32;
    this.server.setTimeout(5_000, socket => { socket.destroy(); });
    this.server.on("connection", socket => { this.sockets.add(socket); socket.once("close", () => { this.sockets.delete(socket); }); });
    this.server.on("clientError", (_error, socket) => {
      if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"); else socket.destroy();
    });
    this.server.on("checkContinue", (request, response) => { this.error(request, response, 400, "INVALID_REQUEST"); });
    this.server.on("upgrade", (_request, socket) => { socket.destroy(); });
    // Per-request/read-model failures are contained; a failed listener cannot start another monitor.
    this.server.on("error", () => {});
  }

  async listen(host: string, port: number): Promise<AddressInfo> {
    if (!this.accepting || this.server.listening || !Number.isInteger(port) || port < 0 || port > 65_535) throw new DataError("HTTP_START", "Invalid listener startup.");
    await new Promise<void>((resolve, reject) => {
      const failed = () => { this.server.removeListener("listening", ready); reject(new DataError("HTTP_START", "Read listener could not start.")); };
      const ready = () => { this.server.removeListener("error", failed); resolve(); };
      this.server.once("error", failed); this.server.once("listening", ready); this.server.listen(port, host);
    });
    return this.server.address() as AddressInfo;
  }
  private encode(reply: ReadReply): Encoded {
    const bytes = Buffer.from(JSON.stringify(reply.body));
    if (bytes.length > HTTP_LIMITS.responseBytes) throw new DataError("READ_LIMIT", "Read projection exceeds its response budget.");
    return { status: reply.status, bytes, type: "application/json; charset=utf-8" };
  }
  private send(request: IncomingMessage, response: ServerResponse, reply: Encoded): void {
    if (response.destroyed || response.writableEnded) return;
    response.writeHead(reply.status, { ...headers, "Content-Type": reply.type, "Content-Length": reply.bytes.length });
    response.end(request.method === "HEAD" ? undefined : reply.bytes);
  }
  private error(request: IncomingMessage, response: ServerResponse, status: number, code: string): void {
    if (response.destroyed || response.writableEnded || response.headersSent) return;
    response.setHeader("Connection", "close");
    if (status === 401) response.setHeader("WWW-Authenticate", request.url?.split("?")[0] === SCHEDULER_PATH ? 'Bearer realm="Watchdog scheduler"' : 'Basic realm="Watchdog read access", charset="UTF-8"');
    if (status === 405) response.setHeader("Allow", request.url?.split("?")[0] === SCHEDULER_PATH && this.options.scheduler ? "POST" : "GET, HEAD");
    if (status === 429) response.setHeader("Retry-After", "1");
    this.send(request, response, this.encode({ status, body: { error: code } }));
  }
  private admit(identity: string): Client | null {
    const now = this.now();
    if (this.global.until <= now) this.global = { until: now + 60_000, count: 0 };
    for (const [key, client] of this.clients) if (client.until <= now && client.inFlight === 0) this.clients.delete(key);
    let client = this.clients.get(identity);
    if (!client) {
      if (this.clients.size >= HTTP_LIMITS.clientIdentities) return null;
      client = { until: now + 60_000, count: 0, inFlight: 0 }; this.clients.set(identity, client);
    }
    if (client.until <= now) { client.count = 0; client.until = now + 60_000; }
    if (this.inFlight >= HTTP_LIMITS.inFlight || client.inFlight >= HTTP_LIMITS.clientInFlight
      || this.global.count >= HTTP_LIMITS.globalPerMinute || client.count >= HTTP_LIMITS.clientPerMinute) return null;
    this.global.count++; client.count++; this.inFlight++; client.inFlight++;
    return client;
  }
  private async projection(route: ReadRoute, page: Page): Promise<Encoded> {
    const now = this.now(), key = `${this.options.lifecycle()}:${route}:${page.limit}:${page.before ?? ""}`;
    for (const [name, cached] of this.cache) if (cached.until <= now) { this.cache.delete(name); this.cacheBytes -= cached.reply.bytes.length; }
    const cached = this.cache.get(key); if (cached) return cached.reply;
    const pending = this.pendingReads.get(key); if (pending) return pending;
    if (this.reads.until <= now) this.reads = { until: now + 1_000, count: 0 };
    if (this.reads.count >= HTTP_LIMITS.readsPerSecond) throw new DataError("READ_BUSY", "Read capacity is temporarily exhausted.");
    this.reads.count++;
    const reading = (async () => {
      const reply = this.encode(await this.options.api.read(route, page));
      if (this.accepting) {
        while (this.cache.size >= HTTP_LIMITS.cacheEntries || this.cacheBytes + reply.bytes.length > HTTP_LIMITS.cacheBytes) {
          const oldest = this.cache.keys().next().value;
          if (oldest === undefined) break;
          this.cacheBytes -= this.cache.get(oldest)!.reply.bytes.length; this.cache.delete(oldest);
        }
        this.cache.set(key, { until: this.now() + CACHE_MILLISECONDS, reply }); this.cacheBytes += reply.bytes.length;
      }
      return reply;
    })().finally(() => { this.pendingReads.delete(key); });
    this.pendingReads.set(key, reading); return reading;
  }
  private handle(request: IncomingMessage, response: ServerResponse): void {
    const url = request.url ?? "", parts = url.split("?");
    if (parts[0] === SCHEDULER_PATH && this.options.scheduler) {
      void this.handleScheduler(request, response).catch(() => { this.error(request, response, 503, "EXECUTION_UNAVAILABLE"); }); return;
    }
    if (Buffer.byteLength(url) > HTTP_LIMITS.urlBytes || parts.length > 2 || request.headers["transfer-encoding"]
      || (request.headers["content-length"] !== undefined && request.headers["content-length"] !== "0")
      || request.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === "authorization").length > 1) {
      this.error(request, response, 400, "INVALID_REQUEST"); return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") { this.error(request, response, 405, "METHOD_NOT_ALLOWED"); return; }
    const path = parts[0]!;
    if (path === "/api/health" && parts.length === 1) {
      const status = this.options.lifecycle();
      this.send(request, response, this.encode({ status: this.accepting && ["RUNNING", "DISABLED"].includes(status) ? 200 : 503, body: { status } })); return;
    }
    if (!this.accepting || ["STOPPING", "STOPPED", "FAILED"].includes(this.options.lifecycle())) { this.error(request, response, 503, "SERVICE_UNAVAILABLE"); return; }
    // Socket peers only: unverified proxy/forwarded headers cannot manufacture rate-limit identities.
    const client = this.admit(request.socket.remoteAddress ?? "unknown");
    if (!client) { this.error(request, response, 429, "RATE_LIMITED"); return; }
    let released = false;
    const release = () => { if (!released) { released = true; this.inFlight--; client.inFlight--; } };
    response.once("finish", release); response.once("close", release);
    if (!this.options.authenticate(request.headers.authorization)) { this.error(request, response, 401, "AUTHENTICATION_REQUIRED"); return; }
    if (request.headers["sec-fetch-site"] === "cross-site") { this.error(request, response, 403, "ORIGIN_REFUSED"); return; }
    const history = path === "/api/alerts" || path === "/api/observations", page: Page = { limit: 20 };
    const query = new URLSearchParams(parts[1] ?? "");
    for (const [key, value] of query) {
      const exact = key === "before" && this.options.api.cursorKind === "bigint";
      let valid = /^[1-9][0-9]{0,15}$/.test(value) && Number.isSafeInteger(Number(value));
      if (exact) { try { sequence(value); valid = true; } catch { valid = false; } }
      if (!history || !["limit", "before"].includes(key) || query.getAll(key).length !== 1 || !valid || (key === "limit" && Number(value) > 100)) {
        this.error(request, response, 400, "INVALID_QUERY"); return;
      }
      if (key === "limit") page.limit = Number(value); else page.before = exact ? value : Number(value);
    }
    if (parts.length === 2 && query.size === 0) { this.error(request, response, 400, "INVALID_QUERY"); return; }
    const asset = path === "/" ? [DASHBOARD_HTML, "text/html"] : path === "/dashboard.js" ? [DASHBOARD_JS, "text/javascript"]
      : path === "/dashboard.css" ? [DASHBOARD_CSS, "text/css"] : null;
    if (asset) { this.send(request, response, { status: 200, bytes: Buffer.from(asset[0]!), type: `${asset[1]}; charset=utf-8` }); return; }
    if (!READ_ROUTES.includes(path as ReadRoute)) { this.error(request, response, 404, "NOT_FOUND"); return; }
    // Yield before bounded synchronous SQLite work; closing can cancel queued requests.
    setImmediate(() => { void (async () => {
      if (response.destroyed || response.writableEnded) return;
      if (!this.accepting) { this.error(request, response, 503, "SERVICE_UNAVAILABLE"); return; }
      try { this.send(request, response, await this.projection(path as ReadRoute, page)); }
      catch (error) {
        if (error instanceof DataError && error.code === "READ_LIMIT") this.error(request, response, 413, "RESPONSE_LIMIT");
        else if (error instanceof DataError && error.code === "READ_BUSY") this.error(request, response, 429, "RATE_LIMITED");
        else this.error(request, response, 503, "DATA_UNAVAILABLE");
      }
    })(); });
  }
  private async handleScheduler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const length = request.headers["content-length"];
    if (request.url !== SCHEDULER_PATH || request.rawHeaders.filter((value, index) => index % 2 === 0 && ["authorization", "content-type", "content-length"].includes(value.toLowerCase())).length
      !== ["authorization", "content-type", "content-length"].filter(name => request.headers[name] !== undefined).length) {
      this.error(request, response, 400, "INVALID_REQUEST"); return;
    }
    if (request.method !== "POST") { this.error(request, response, 405, "METHOD_NOT_ALLOWED"); return; }
    if (!this.accepting || ["STARTING", "STOPPING", "STOPPED", "FAILED"].includes(this.options.lifecycle())) { this.error(request, response, 503, "SERVICE_UNAVAILABLE"); return; }
    const now = this.now();
    if (this.scheduled.until <= now) { this.scheduled.until = now + 60_000; this.scheduled.count = 0; }
    if (this.scheduled.count++ >= 6 || this.scheduled.active >= 2) { this.error(request, response, 429, "RATE_LIMITED"); return; }
    if (!this.options.scheduler!.authenticate(request.headers.authorization)) { this.error(request, response, 401, "AUTHENTICATION_REQUIRED"); return; }
    if (request.headers.origin || (request.headers["sec-fetch-site"] !== undefined && request.headers["sec-fetch-site"] !== "none")) {
      this.error(request, response, 403, "ORIGIN_REFUSED"); return;
    }
    if (request.headers["content-type"] !== "application/json" || request.headers["transfer-encoding"] || request.headers["content-encoding"]
      || !length || !/^[1-9][0-9]{0,3}$/.test(length) || Number(length) > PG_LIMITS.bodyBytes) {
      this.error(request, response, 400, "INVALID_REQUEST"); return;
    }
    const cancellation = new AbortController();
    const disconnected = () => { if (!response.writableEnded) cancellation.abort(); };
    response.once("close", disconnected);
    this.scheduled.active++;
    // Authenticated bodies still have the short admission timeout. Only validated jobs get 420 s.
    const timer = setTimeout(() => { cancellation.abort(); this.error(request, response, 408, "REQUEST_TIMEOUT"); request.destroy(); }, 5_000);
    try {
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
        bytes += buffer.length;
        if (bytes > PG_LIMITS.bodyBytes || cancellation.signal.aborted) { this.error(request, response, 400, "INVALID_REQUEST"); return; }
        chunks.push(buffer);
      }
      let input: { slot: string };
      try { input = parseSchedulerBody(Buffer.concat(chunks), this.options.scheduler!.periodSeconds); }
      catch { this.error(request, response, 400, "INVALID_REQUEST"); return; }
      if (bytes !== Number(length) || cancellation.signal.aborted) { this.error(request, response, 400, "INVALID_REQUEST"); return; }
      clearTimeout(timer);
      request.socket.setTimeout(PG_LIMITS.httpMs);
      const reply = await this.options.scheduler!.run(input.slot, cancellation.signal);
      // Scheduler responses contain only the allowlisted receipt/coded outcome from the runner.
      if (!response.destroyed && !response.writableEnded) response.setHeader("Connection", "close");
      this.send(request, response, this.encode(reply));
    } finally { clearTimeout(timer); response.removeListener("close", disconnected); this.scheduled.active--; }
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.accepting = false; this.cache.clear(); this.cacheBytes = 0;
    this.closing = new Promise<void>(resolve => {
      const timer = setTimeout(() => { for (const socket of this.sockets) socket.destroy(); }, 2_000);
      this.server.close(() => { clearTimeout(timer); for (const socket of this.sockets) socket.destroy(); this.clients.clear(); resolve(); });
      this.server.closeIdleConnections();
    });
    return this.closing;
  }
}
