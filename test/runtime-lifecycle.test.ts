import { existsSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseMonitoringConfiguration } from "../src/config/monitoring.js";
import type { Snapshot } from "../src/domain/types.js";
import { RenderRuntime, installSignals } from "../src/runtime/service.js";
import { MonitorStore } from "../src/storage/store.js";
import { serviceArguments } from "../src/service.js";
import { MONITOR_SCOPE, monitoringFixture, persistFixture, riskFixture, testClock } from "./fixtures/phase4.js";
import { deferred, RELEASE_ROOT, runtimeFixture } from "./fixtures/runtime.js";

const runtimes: RenderRuntime[] = [], directories: string[] = [];
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.stop();
  vi.restoreAllMocks(); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
const fixture = (enabled = false, initialized = false) => { const h = runtimeFixture(enabled, initialized); directories.push(h.directory); return h; };
const runtime = (options: ConstructorParameters<typeof RenderRuntime>[0]) => { const value = new RenderRuntime(options); runtimes.push(value); return value; };

describe("PHASE8 FIXTURE: explicit single-process runtime lifecycle", () => {
  it("imports and constructs without sockets, signal handlers, monitoring, environment access or cwd changes", async () => {
    const h = fixture(), cwd = process.cwd(), before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
    const read = vi.fn(async () => null), created = runtime({ ...h.options, fixture: { read } });
    await import("../src/service.js"); expect(created.status()).toBe("STOPPED"); expect(read).not.toHaveBeenCalled();
    expect(process.cwd()).toBe(cwd); expect(existsSync(h.options.runtimeRoot)).toBe(false); expect(existsSync(h.options.database)).toBe(false);
    expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(before);
  });
  it("accepts only the reviewed explicit startup argument contract", () => {
    expect(serviceArguments(["--config", "config/render.json", "--runtime-root", "/var/data/watchdog/runtime", "--database", "/var/data/watchdog/storage/watchdog.sqlite"]))
      .toMatchObject({ config: "config/render.json" });
    for (const args of [[], ["--enable"], ["--config", "x", "--config", "y"], ["--url", "https://example.test"]]) expect(() => serviceArguments(args)).toThrow();
  });
  it("starts disabled without creating the database, rejects a duplicate process runtime, and closes cleanly", async () => {
    const h = fixture(), first = runtime(h.options), second = runtime(h.options), address = await first.start();
    await expect(second.start()).rejects.toMatchObject({ code: "RUNTIME_ALREADY_RUNNING" });
    await expect(first.start()).rejects.toMatchObject({ code: "RUNTIME_ALREADY_RUNNING" });
    expect(first.status()).toBe("DISABLED"); expect(process.cwd()).toBe(h.options.runtimeRoot); expect(existsSync(h.options.database)).toBe(false);
    const url = `http://127.0.0.1:${address.port}`;
    expect(await (await fetch(url + "/api/health")).json()).toEqual({ status: "DISABLED" });
    expect((await fetch(url + "/api/positions")).status).toBe(401);
    expect((await fetch(url + "/api/positions", { headers: { Authorization: `Bearer ${h.credential}` } })).status).toBe(503);
    const closing = first.stop(); expect(first.stop()).toBe(closing); await closing; expect(await first.done).toBe(0);
    expect(process.cwd()).toBe(RELEASE_ROOT.replace(/[\\/]$/, ""));
  });
  it("fails closed without authentication, on missing enabled DB, enabled providers, invalid path, and oversized shutdown budget", async () => {
    const h = fixture(true);
    for (const options of [{ ...h.options, credential: undefined }, h.options,
      { ...h.options, configuration: parseMonitoringConfiguration({ ...h.options.configuration, notifications: { telegram: true } }) },
      { ...h.options, runtimeRoot: "relative-runtime" },
      { ...h.options, configuration: parseMonitoringConfiguration({ ...h.options.configuration, operations: { shutdownTimeoutSeconds: 21 } }) }]) {
      const candidate = runtime(options); await expect(candidate.start()).rejects.toMatchObject({ code: "RUNTIME_STARTUP" }); expect(await candidate.done).toBe(1);
    }
    expect(existsSync(h.options.database)).toBe(false);
  });
  it("cancels startup on an immediate stop and releases the process owner without creating a database", async () => {
    const h = fixture(true), candidate = runtime(h.options), started = candidate.start().catch(() => "cancelled");
    const time = performance.now(); await candidate.stop(); expect(await started).toBe("cancelled");
    expect(performance.now() - time).toBeLessThan(3_000); expect(existsSync(h.options.database)).toBe(false);
    const disabled = runtime({ ...h.options, configuration: parseMonitoringConfiguration({ ...h.options.configuration, monitoring: { enabled: false } }) });
    await disabled.start(); await disabled.stop(); expect(await disabled.done).toBe(0);
  });
  it("refuses an occupied HTTP port before starting monitoring and releases all acquired ownership", async () => {
    const h = fixture(true, true), blocker = createServer(); await new Promise<void>(resolve => { blocker.listen(0, "127.0.0.1", resolve); });
    const address = blocker.address(); if (!address || typeof address === "string") throw new Error("Missing fixture listener");
    const read = vi.fn(async () => null), candidate = runtime({ ...h.options, port: address.port, fixture: { read } });
    try { await expect(candidate.start()).rejects.toMatchObject({ code: "RUNTIME_STARTUP" }); expect(read).not.toHaveBeenCalled(); }
    finally { await new Promise<void>(resolve => { blocker.close(() => { resolve(); }); }); }
    const owner = new MonitorStore(h.options.database); owner.acquireMonitor(); owner.close();
  });
  it("serves API during an in-flight read, prevents overlap, settles the read on shutdown and preserves the database", async () => {
    const h = fixture(true, true), snapshot = await riskFixture(), entered = deferred<void>(), pending = deferred<Snapshot>(), read = vi.fn(() => { entered.resolve(); return pending.promise; });
    const first = runtime({ ...h.options, fixture: { read, now: testClock } }), address = await first.start(); await entered.promise;
    expect(() => new MonitorStore(h.options.database)).toThrow("exclusive monitor lock");
    const statuses = await Promise.all(Array.from({ length: 8 }, async () => {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/monitoring/status`, { headers: { Authorization: `Bearer ${h.credential}` } });
      await response.arrayBuffer(); return response.status;
    })); expect(statuses).toContain(200); expect(read).toHaveBeenCalledOnce();
    const stop = first.stop(); pending.resolve(snapshot); await stop; expect(await first.done).toBe(0);
    const check = new MonitorStore(h.options.database, { readOnly: true });
    try { expect(check.runtime()?.status).toBe("STOPPED"); expect(check.state(MONITOR_SCOPE).revision).toBe(1); check.validateAll(); } finally { check.close(); }
  });
  it.each(["SIGINT", "SIGTERM"] as const)("wires %s to the same bounded shutdown and removes listeners (explicit Windows handler simulation)", async signal => {
    const h = fixture(), candidate = runtime(h.options), before = process.listenerCount(signal), remove = installSignals(candidate);
    try { await candidate.start(); expect(process.listenerCount(signal)).toBe(before + 1); process.emit(signal); expect(await candidate.done).toBe(0); }
    finally { remove(); } expect(process.listenerCount(signal)).toBe(before);
  });
  it("invokes the executable's 25-second fallback if cleanup does not settle", async () => {
    vi.useFakeTimers(); const deadline = vi.fn(), stop = vi.fn(() => new Promise<void>(() => {})), remove = installSignals({ stop }, deadline);
    try {
      process.emit("SIGTERM"); await vi.advanceTimersByTimeAsync(24_999); expect(deadline).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1); expect(deadline).toHaveBeenCalledOnce(); expect(stop).toHaveBeenCalledOnce();
    } finally { remove(); vi.useRealTimers(); }
  });
  it("bounds a non-cooperative read, preserves interrupted state and discards its late result", async () => {
    const h = fixture(true, true), entered = deferred<void>(), pending = deferred<Snapshot>(), snapshot = await riskFixture();
    const candidate = runtime({ ...h.options, fixture: { read: () => { entered.resolve(); return pending.promise; }, now: testClock } });
    await candidate.start(); await entered.promise; const start = performance.now(); await candidate.stop();
    expect(await candidate.done).toBe(1); expect(performance.now() - start).toBeLessThan(2_500); pending.resolve(snapshot); await new Promise<void>(resolve => { setImmediate(resolve); });
    const check = new MonitorStore(h.options.database, { readOnly: true });
    try { expect(check.state(MONITOR_SCOPE).revision).toBe(0); expect(check.runtime()).toMatchObject({ status: "FAILED", error: "SHUTDOWN_TIMEOUT" }); expect(check.unfinishedCycles(MONITOR_SCOPE)).toHaveLength(1); }
    finally { check.close(); }
  });
  it("does not hide terminal worker failure behind a healthy listener", async () => {
    const h = fixture(true, true), configuration = parseMonitoringConfiguration({ ...h.options.configuration, resources: { rssBytes: 1 } });
    const candidate = runtime({ ...h.options, configuration, fixture: { read: async () => null } });
    const address = await candidate.start(); expect(await candidate.done).toBe(1); expect(candidate.status()).toBe("FAILED");
    await expect(fetch(`http://127.0.0.1:${address.port}/api/health`)).rejects.toThrow();
  });
  // Each of these tests performs multiple full evidence-seeded runtime rounds; per-round cost on Windows can
  // approach 5s, so the harness budget matches the multi-process tests above without changing any assertion.
  it("recovers interrupted cycles/outbox and preserves known-delivered records and dedup across restarts", async () => {
    const h = fixture(true, true), observation = await monitoringFixture(), snapshot = await riskFixture(), seed = new MonitorStore(h.options.database);
    seed.acquireMonitor(); persistFixture(seed, observation); const deliveries = seed.deliveries(), delivered = deliveries[0]!, ambiguous = deliveries[1]!;
    seed.startAttempt(delivered.id, observation.observedAt); seed.finishAttempt(delivered.id, { delivered: true }, observation.observedAt, null);
    seed.startAttempt(ambiguous.id, observation.observedAt); seed.beginCycle("interrupted_cycle", MONITOR_SCOPE, observation.observedAt); const known = seed.knownDeliveredHash(); seed.close();
    for (let index = 0; index < 2; index++) {
      const idle = deferred<void>(), candidate = runtime({ ...h.options, fixture: { read: async () => snapshot, now: testClock,
        pause: async (_ms, signal) => { idle.resolve(); await new Promise<void>(resolve => { signal.addEventListener("abort", () => { resolve(); }, { once: true }); if (signal.aborted) resolve(); }); } } });
      await candidate.start(); await idle.promise; await candidate.stop(); expect(await candidate.done).toBe(0);
    }
    const check = new MonitorStore(h.options.database, { readOnly: true });
    try {
      expect(check.unfinishedCycles(MONITOR_SCOPE)).toEqual([]); expect(check.deliveries().find(item => item.id === delivered.id)).toMatchObject({ status: "DELIVERED", attempts: 1 });
      expect(check.deliveries().find(item => item.id === ambiguous.id)).toMatchObject({ status: "PERMANENTLY_FAILED", attempts: 1, ambiguous: 1 });
      expect(check.knownDeliveredHash()).not.toBe(known); check.validateAll();
    } finally { check.close(); }
  }, 30_000);
  it("preserves an existing database byte-for-byte through repeated disabled starts and shutdowns", async () => {
    const h = fixture(false, true), before = readFileSync(h.options.database);
    for (let index = 0; index < 3; index++) { const candidate = runtime(h.options); await candidate.start(); await candidate.stop(); expect(await candidate.done).toBe(0); }
    expect(readFileSync(h.options.database)).toEqual(before);
  }, 30_000);
});
