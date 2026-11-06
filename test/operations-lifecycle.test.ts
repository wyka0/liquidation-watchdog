import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli/run.js";
import { parseMonitoringConfiguration } from "../src/config/monitoring.js";
import type { Snapshot } from "../src/domain/types.js";
import { MonitoringService } from "../src/monitoring/service.js";
import type { ServiceOptions } from "../src/monitoring/service.js";
import { MonitorStore } from "../src/storage/store.js";
import { MONITOR_POSITION, MONITOR_SCOPE, MONITOR_THRESHOLDS, riskFixture, temporaryMonitorDirectory, testClock } from "./fixtures/phase4.js";

const directory = temporaryMonitorDirectory(); let base: Snapshot, sequence = 0;
beforeAll(async () => { base = await riskFixture(); });
afterEach(() => { vi.useRealTimers(); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function harness(overrides: Partial<ServiceOptions> = {}) {
  const path = join(directory, `lifecycle-${++sequence}.sqlite`), store = overrides.store ?? new MonitorStore(path);
  const send = vi.fn(async () => ({ delivered: true as const }));
  const service = new MonitoringService({ store, configuration: parseMonitoringConfiguration({ operations: { cycleTimeoutSeconds: 10, shutdownTimeoutSeconds: 1 },
    notifications: { timeoutSeconds: 20 } }, { database: path }), thresholds: MONITOR_THRESHOLDS, position: MONITOR_POSITION, now: testClock,
    read: async () => base, allowFixture: true, adapters: [{ channel: "console", send }], id: () => `cycle_${sequence}`, ...overrides });
  return { service, store, path, send };
}

describe("FIXTURE: bounded lifecycle and late continuation safety", () => {
  it("settles an active delivery on graceful shutdown, starts no new send and closes exactly once", async () => {
    const entered = deferred<void>(), sent = deferred<{ delivered: true }>();
    const send = vi.fn(() => { entered.resolve(); return sent.promise; });
    const h = harness({ adapters: [{ channel: "console", send }] }), close = vi.spyOn(h.store, "close");
    const cycle = h.service.runOnce(); await entered.promise;
    expect(await h.service.runOnce()).toEqual({ skipped: "OVERLAP" });
    const first = h.service.shutdown(); expect(h.service.shutdown()).toBe(first);
    sent.resolve({ delivered: true }); await cycle; await first;
    expect(send).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
    const check = new MonitorStore(h.path, { readOnly: true });
    expect(check.deliveryCounts()).toMatchObject({ DELIVERED: 1, PENDING: 2 });
    expect(check.runtime()).toMatchObject({ status: "STOPPED", error: null }); expect(check.ownership()).toBe("AVAILABLE"); check.close();
  });
  it("bounds a hung read at shutdown, records the first failure and ignores its late result", async () => {
    vi.useFakeTimers(); const entered = deferred<void>(), late = deferred<Snapshot>();
    const h = harness({ read: async () => { entered.resolve(); return late.promise; } });
    const cycle = h.service.runOnce().catch(error => error as unknown); await entered.promise;
    const shutdown = h.service.shutdown().catch(error => error as unknown);
    await vi.advanceTimersByTimeAsync(1_001);
    expect(await shutdown).toMatchObject({ code: "SHUTDOWN_TIMEOUT" }); expect(await cycle).toMatchObject({ code: "READ_CANCELLED" });
    late.resolve(base); await Promise.resolve(); await Promise.resolve();
    const check = new MonitorStore(h.path, { readOnly: true });
    expect(check.state(MONITOR_SCOPE).revision).toBe(0); expect(check.runtime()).toMatchObject({ status: "FAILED", error: "SHUTDOWN_TIMEOUT" });
    expect(check.ownership()).toBe("AVAILABLE"); expect(check.unfinishedCycles(MONITOR_SCOPE)).toHaveLength(1); check.close();
    expect(h.send).not.toHaveBeenCalled(); expect(await h.service.runOnce()).toEqual({ skipped: "STOPPED" });
  });
  it.each(["read", "supplemental"])("enforces the whole-cycle budget during a non-cooperative %s", async kind => {
    vi.useFakeTimers(); const entered = deferred<void>(), wait = deferred<never>();
    const blocked = async () => { entered.resolve(); return wait.promise; };
    const h = harness({ configuration: parseMonitoringConfiguration({ operations: { cycleTimeoutSeconds: 1 } }),
      ...(kind === "read" ? { read: blocked } : { supplemental: blocked }) });
    const cycle = h.service.runOnce().catch(error => error as unknown); await entered.promise; await vi.advanceTimersByTimeAsync(1_001);
    expect(await cycle).toMatchObject({ code: "CYCLE_TIMEOUT" }); expect(h.store.state(MONITOR_SCOPE).revision).toBe(0);
    expect(h.store.runtime()).toMatchObject({ status: "FAILED", error: "CYCLE_TIMEOUT" }); expect(h.send).not.toHaveBeenCalled(); await h.service.shutdown();
  });
  it("includes notification dispatch in the cycle budget and preserves an interrupted acknowledgment as ambiguous", async () => {
    vi.useFakeTimers(); const entered = deferred<void>(), late = deferred<{ delivered: true }>();
    const h = harness({ configuration: parseMonitoringConfiguration({ operations: { cycleTimeoutSeconds: 1 }, notifications: { timeoutSeconds: 20 } }),
      adapters: [{ channel: "console", send: () => { entered.resolve(); return late.promise; } }] });
    const cycle = h.service.runOnce().catch(error => error as unknown); await entered.promise; await vi.advanceTimersByTimeAsync(1_001);
    expect(await cycle).toMatchObject({ code: "CYCLE_TIMEOUT" });
    const inFlight = h.store.deliveries().find(delivery => delivery.status === "IN_FLIGHT")!;
    expect(h.store.latestCycle(MONITOR_SCOPE)?.status).toBe("PERSISTED"); await h.service.shutdown();
    late.resolve({ delivered: true }); await Promise.resolve(); await Promise.resolve();
    const resumed = new MonitorStore(h.path); resumed.acquireMonitor();
    expect(resumed.recoverDeliveries(testClock().toISOString(), 5)).toBe(1);
    expect(resumed.deliveries().find(delivery => delivery.id === inFlight.id)).toMatchObject({ status: "PERMANENTLY_FAILED", attempts: 1, ambiguous: 1 });
    expect(resumed.state(MONITOR_SCOPE).lastAccepted?.accepted).toBe(true); resumed.close();
  });
  it("wires CLI signal cleanup through the same settling service", async () => {
    const entered = deferred<void>(), late = deferred<Snapshot>(); let signal = () => {}; const remove = vi.fn();
    const path = join(directory, `cli-${++sequence}.sqlite`), output: string[] = [];
    const result = runCli(["monitor", "--once", "--database", path], { now: testClock, write: text => output.push(text), monitoring: {
      read: async () => { entered.resolve(); return late.promise; }, allowFixture: true,
      adapters: () => [{ channel: "console", send: async () => ({ delivered: true }) }],
      onSignal: callback => { signal = callback; return remove; }
    } });
    await entered.promise; signal(); late.resolve(base); expect(await result).toBe(0); expect(remove).toHaveBeenCalledOnce();
    const check = new MonitorStore(path, { readOnly: true }); expect(check.runtime()?.status).toBe("STOPPED"); expect(check.ownership()).toBe("AVAILABLE"); check.close();
    expect(output.join("")).toContain("shutdown");
  });
});

function childFixture(file: string, mode: string) {
  const child = spawn(process.execPath, ["--import", "tsx", "test/helpers/phase5-worker.ts", file, mode],
    { cwd: resolve("."), stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true, timeout: 30_000, killSignal: "SIGKILL" });
  const events: string[] = []; const waiting = new Map<string, () => void>();
  child.on("message", (message: unknown) => {
    if (typeof message !== "object" || message === null || !("event" in message) || typeof message.event !== "string") return;
    events.push(message.event); waiting.get(message.event)?.();
  });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.on("error", reject); child.on("close", (code, signal) => { resolve({ code, signal }); });
  });
  const event = (name: string) => Promise.race([new Promise<void>(resolve => { if (events.includes(name)) resolve(); else waiting.set(name, resolve); }),
    closed.then(() => { throw new Error("Fixture child exited before its lifecycle event"); })]);
  return { child, event, closed };
}
async function stopChild(child: ChildProcess) {
  if (child.exitCode === null && child.signalCode === null) {
    const closed = new Promise<void>(resolve => { child.once("close", () => { resolve(); }); }); child.kill("SIGKILL"); await closed;
  }
}

describe("FIXTURE: actual child-process ownership and termination", () => {
  it.each(["SIGINT", "SIGTERM"] as const)("settles an idle worker via %s handlers (Windows: explicit handler simulation)", async signal => {
    const file = join(directory, `child-idle-${++sequence}.sqlite`), fixture = childFixture(file, "idle");
    try {
      await fixture.event("ready");
      if (process.platform === "win32") fixture.child.send(`simulate-${signal}`); else fixture.child.kill(signal);
      expect((await fixture.closed).code).toBe(0);
      const check = new MonitorStore(file); check.acquireMonitor(); expect(check.runtime()?.status).toBe("STOPPED"); check.validateAll(); check.close();
    } finally { await stopChild(fixture.child); }
  }, 40_000);
  it("settles an active child read through shutdown and releases its OS ownership lock", async () => {
    const file = join(directory, `child-read-${++sequence}.sqlite`), fixture = childFixture(file, "read");
    try {
      await fixture.event("ready"); expect(() => new MonitorStore(file)).toThrow("exclusive monitor lock");
      fixture.child.send("simulate-SIGTERM"); await fixture.event("shutdown-requested"); fixture.child.send("release");
      expect((await fixture.closed).code).toBe(0);
      const check = new MonitorStore(file); check.acquireMonitor();
      expect(check.runtime()?.status).toBe("STOPPED"); expect(check.state(MONITOR_SCOPE).lastAccepted?.accepted).toBe(true);
      expect(check.deliveryCounts()).toMatchObject({ DELIVERED: 0, PENDING: 3 }); check.close();
    } finally { await stopChild(fixture.child); }
  }, 40_000);
  it("recovers after forced termination, preserves known-delivered alerts and sends only definitely pending work", async () => {
    const file = join(directory, `child-force-${++sequence}.sqlite`), fixture = childFixture(file, "send");
    try {
      await fixture.event("ready");
      const reader = new MonitorStore(file, { readOnly: true }), delivered = reader.deliveries().find(item => item.status === "DELIVERED")!;
      expect(reader.deliveryCounts()).toMatchObject({ DELIVERED: 1, IN_FLIGHT: 1, PENDING: 1 }); reader.close();
      expect(fixture.child.kill("SIGKILL")).toBe(true); await fixture.closed;
      const store = new MonitorStore(file), send = vi.fn(async () => ({ delivered: true as const }));
      const service = new MonitoringService({ store, thresholds: MONITOR_THRESHOLDS, position: MONITOR_POSITION, configuration: parseMonitoringConfiguration({}, { database: file }),
        read: async () => base, now: testClock, id: () => "restarted_child_cycle", adapters: [{ channel: "console", send }], allowFixture: true });
      try {
        await service.runOnce(); expect(send).toHaveBeenCalledOnce();
        expect(store.deliveries().find(item => item.id === delivered.id)).toEqual(delivered);
        expect(store.deliveries().filter(item => item.ambiguous === 1)).toEqual([expect.objectContaining({ status: "PERMANENTLY_FAILED", attempts: 1 })]);
        expect(store.unfinishedCycles(MONITOR_SCOPE)).toEqual([]); store.validateAll();
      } finally { await service.shutdown(); }
    } finally { await stopChild(fixture.child); }
  }, 40_000);
});
