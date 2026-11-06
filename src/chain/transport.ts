import { setTimeout as sleep } from "node:timers/promises";
import { NETWORK, READ_LIMITS } from "../config/deployment.js";
import { DataError, TransientReadError } from "../domain/errors.js";
import { bounded } from "../operations/deadline.js";

export const MAX_RESPONSE_BYTES = 2_000_000;

export type Pause = (milliseconds: number) => Promise<void>;
const pause: Pause = async milliseconds => { await sleep(milliseconds); };

export function retryAfter(header: string | null, now = Date.now()): number | null {
  if (header === null) return null;
  if (/^[0-9]+(?:\.[0-9]+)?$/.test(header.trim())) return Math.ceil(Number(header) * 1_000);
  const parsed = Date.parse(header);
  return Number.isFinite(parsed) ? Math.max(0, parsed - now) : null;
}

export async function retryRead<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; pause?: Pause; maxDelayMs?: number; random?: () => number; signal?: AbortSignal } = {}
): Promise<T> {
  const attempts = options.attempts ?? READ_LIMITS.attempts;
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) throw new DataError("RETRY_CONFIG", "Retry attempts must be from 1 to 3.");
  for (let attempt = 0; ; attempt += 1) {
    if (options.signal?.aborted) throw new DataError("READ_CANCELLED", "Read was cancelled.", "network", "UNAVAILABLE");
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof TransientReadError)) throw error;
      const sample = (options.random ?? Math.random)(), jitter = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5;
      const delay = Math.max(error.retryAfterMs ?? 0, Math.ceil(2 ** attempt * (800 + 400 * jitter)));
      // Refuse rather than retry before a long server-mandated Retry-After.
      if (attempt + 1 >= attempts || !Number.isFinite(delay) || delay > (options.maxDelayMs ?? READ_LIMITS.maxRetryDelayMs)) {
        throw new DataError(error.code, "Read service remained unavailable within the bounded retry budget.", "network", "UNAVAILABLE");
      }
      if (options.pause) await options.pause(delay);
      else await sleep(delay, undefined, options.signal ? { signal: options.signal } : {});
    }
  }
}

/** A shared queue limits both endpoints, including MCP initialization traffic. */
export class RequestPacer {
  private tail: Promise<void> = Promise.resolve();
  private lastStart = -Infinity;

  constructor(
    private readonly intervalMs: number = READ_LIMITS.minIntervalMs,
    private readonly wait: Pause = pause,
    private readonly now: () => number = Date.now
  ) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release: () => void = () => undefined;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      const delay = Math.max(0, this.intervalMs - (this.now() - this.lastStart));
      if (delay > 0) await this.wait(delay);
      this.lastStart = this.now();
      return await operation();
    } finally {
      release();
    }
  }
}

export function publicEndpoint(value: string, fixture = false): URL {
  try {
    const url = new URL(value);
    const allowed = [new URL(NETWORK.rpc).href, new URL(NETWORK.mcp).href,
      ...(fixture ? ["https://rpc.fixture.invalid/", "https://mcp.fixture.invalid/"] : [])];
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !allowed.includes(url.href)) throw new Error();
    return url;
  } catch { throw new DataError("INVALID_ENDPOINT", "Only the fixed public HTTPS RPC/MCP endpoints are allowed.", "network"); }
}

export function pacedFetch(pacer: RequestPacer, fetchImpl: typeof fetch = globalThis.fetch, external?: AbortSignal): typeof fetch {
  return async (input, init) => pacer.run(async () => {
    const requested = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const callerSignal = external && requested ? AbortSignal.any([external, requested]) : external ?? requested;
    const deadline = AbortSignal.timeout(READ_LIMITS.timeoutMs);
    const cancellation = new AbortController();
    const signal = AbortSignal.any([cancellation.signal, deadline, ...(callerSignal ? [callerSignal] : [])]);
    const expires = Date.now() + READ_LIMITS.timeoutMs;
    let response: Response;
    try {
      publicEndpoint(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, fetchImpl !== globalThis.fetch);
      response = await bounded(async () => {
        const result = await fetchImpl(input, { ...init, redirect: "error", signal });
        if (signal.aborted) { void result.body?.cancel().catch(() => {}); throw new Error(); }
        return result;
      }, READ_LIMITS.timeoutMs, "TRANSPORT_TIMEOUT", signal);
    } catch (error) {
      cancellation.abort();
      if (callerSignal?.aborted) throw new DataError("READ_CANCELLED", "Read request was cancelled.", "network", "UNAVAILABLE");
      if (deadline.aborted || (error instanceof DataError && error.code === "TRANSPORT_TIMEOUT") || (error instanceof Error && ["TypeError", "TimeoutError", "AbortError"].includes(error.name))) {
        throw new TransientReadError("TRANSPORT_UNAVAILABLE");
      }
      if (error instanceof DataError && error.code === "INVALID_ENDPOINT") throw error;
      throw new DataError("TRANSPORT_UNAVAILABLE", "The read transport failed.", "network", "UNAVAILABLE");
    }
    if (response.status === 429 || response.status === 408 || response.status >= 500) {
      const delay = retryAfter(response.headers.get("retry-after"));
      cancellation.abort(); void response.body?.cancel().catch(() => {});
      throw new TransientReadError(`HTTP_${response.status}`, delay);
    }
    if (response.status === 404) {
      cancellation.abort(); void response.body?.cancel().catch(() => {});
      throw new DataError("SESSION_OR_ENDPOINT_NOT_FOUND", "The endpoint or MCP session was not found.", "network", "UNAVAILABLE");
    }
    if (!response.ok) {
      cancellation.abort(); void response.body?.cancel().catch(() => {});
      throw new DataError(`HTTP_${response.status}`, "The read service rejected the request.", "network", "UNAVAILABLE");
    }
    if (!response.body) return response;
    if (Number(response.headers.get("content-length") ?? 0) > MAX_RESPONSE_BYTES) {
      cancellation.abort(); void response.body.cancel().catch(() => {});
      throw new DataError("RESPONSE_SIZE", "Read response exceeded its byte budget.", "network");
    }
    // Stream MCP SSE as well as JSON; pre-buffering SSE would block tool requests.
    const reader = response.body.getReader(); let bytes = 0, ended = false;
    let onAbort = () => {};
    const cleanup = (cancel: boolean) => {
      ended = true; signal.removeEventListener("abort", onAbort);
      if (cancel) { cancellation.abort(); void reader.cancel().catch(() => {}); }
      reader.releaseLock();
    };
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        onAbort = () => {
          if (ended) return;
          controller.error(callerSignal?.aborted ? new DataError("READ_CANCELLED", "Read was cancelled.", "network", "UNAVAILABLE")
            : new TransientReadError("TRANSPORT_UNAVAILABLE"));
          cleanup(true);
        };
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
      },
      async pull(controller) {
        if (ended) return;
        try {
          const remaining = expires - Date.now();
          if (remaining <= 0) throw new TransientReadError("TRANSPORT_UNAVAILABLE");
          const next = await bounded(() => reader.read(), remaining, "RESPONSE_TIMEOUT", signal);
          if (ended) return;
          if (next.done) { controller.close(); cleanup(false); return; }
          bytes += next.value.length;
          if (bytes > MAX_RESPONSE_BYTES) throw new DataError("RESPONSE_SIZE", "Read response exceeded its byte budget.", "network");
          controller.enqueue(next.value);
        } catch (error) {
          if (ended) return;
          controller.error(error instanceof DataError && error.code === "RESPONSE_TIMEOUT" ? new TransientReadError("TRANSPORT_UNAVAILABLE") : error);
          cleanup(true);
        }
      },
      cancel() { if (!ended) cleanup(true); }
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  });
}

export function throwServiceError(message: string, scope: "network" | "snapshot" = "network"): never {
  if (/rate.?limit|too fast|cu limit|request limit|temporar|timeout|timed out|overload|unavailable/i.test(message)) {
    throw new TransientReadError("SERVICE_RATE_OR_TRANSIENT_ERROR");
  }
  if (/unknown mcp session|session.*expired/i.test(message)) {
    throw new DataError("SESSION_OR_ENDPOINT_NOT_FOUND", "The MCP session expired.", "network", "UNAVAILABLE");
  }
  throw new DataError("SERVICE_READ_FAILED", "The read service returned an error; no value was substituted.", scope, "UNAVAILABLE");
}
