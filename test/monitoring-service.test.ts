import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseMonitoringConfiguration } from "../src/config/monitoring.js";
import { DataError } from "../src/domain/errors.js";
import type { Snapshot } from "../src/domain/types.js";
import { structuredLogger } from "../src/monitoring/logs.js";
import { monitoringScope } from "../src/monitoring/model.js";
import { readMonitoredPosition } from "../src/monitoring/reader.js";
import { MonitoringService } from "../src/monitoring/service.js";
import type { ServiceOptions } from "../src/monitoring/service.js";
import { MonitorStore } from "../src/storage/store.js";
import { FixtureClient } from "./fixtures/phase4.js";
import { MONITOR_CONFIG, MONITOR_POSITION, MONITOR_SCOPE, MONITOR_THRESHOLDS, temporaryMonitorDirectory, testClock } from "./fixtures/monitoring.js";
import { riskFixture } from "./fixtures/phase4.js";
import { position } from "./fixtures/state.js";

let base: Snapshot; const directory = temporaryMonitorDirectory();
beforeAll(async () => { base = await riskFixture(); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
function harness(overrides: Partial<ServiceOptions> = {}) {
  const store = overrides.store ?? new MonitorStore(":memory:");
  const messages: string[] = [], read = vi.fn(async () => structuredClone(base)); let sequence = 0;
  const send = vi.fn(async () => ({ delivered: true as const }));
  const service = new MonitoringService({ store, configuration: MONITOR_CONFIG, thresholds: MONITOR_THRESHOLDS, position: MONITOR_POSITION,
    adapters: [{ channel: "console", send }], read, now: testClock, id: () => `cycle_${++sequence}`,
    log: structuredLogger(text => messages.push(text)), allowFixture: true, ...overrides });
  return { service, store, messages, read, send };
}
describe("FIXTURE: pinned monitoring lifecycle and conservative failures", () => {
  it("constructs without reading, then persists a complete Phase 2 calculation before dispatch", async () => {
    const h = harness(); expect(h.read).not.toHaveBeenCalled(); expect(h.store.state(MONITOR_SCOPE).revision).toBe(0);
    h.send.mockImplementation(async () => { expect(h.store.alerts().length).toBeGreaterThan(0); return { delivered: true }; });
    const cycle = await h.service.runOnce();
    expect(cycle).toMatchObject({ observation: { accepted: true, risk: { mathematicalRiskState: "WARNING", dataQuality: "UNVERIFIED",
      oracleVerification: "UNVERIFIED", actionable: false, temporalContext: "FIXTURE", blockHash: base.block!.hash } } });
    expect(h.store.latestCycle(MONITOR_SCOPE)?.status).toBe("COMPLETED");
    expect(h.messages.join("")).toContain("cycle_completed"); expect(h.messages.join("")).toContain("ORACLE_FRESHNESS_UNKNOWN");
    await h.service.shutdown();
  });
  it.each(["rpc", "mcp"] as const)("attributes failed %s reads and closes both clients", async source => {
    const rpc = new FixtureClient("rpc"), mcp = new FixtureClient("mcp");
    vi.spyOn(source === "rpc" ? rpc : mcp, "chainId").mockRejectedValue(new Error("synthetic provider secret"));
    const closeRpc = vi.spyOn(rpc, "close"), closeMcp = vi.spyOn(mcp, "close");
    const h = harness({ read: () => readMonitoredPosition({ rpc, mcp, evidenceKind: "FIXTURE", now: testClock }) });
    const cycle = await h.service.runOnce();
    expect(cycle).toMatchObject({ observation: { accepted: false, diagnostics: expect.arrayContaining([`${source.toUpperCase()}_UNAVAILABLE`]),
      risk: { mathematicalRiskState: null, effectiveRiskState: "DATA_UNAVAILABLE" } } });
    expect(closeRpc).toHaveBeenCalledOnce(); expect(closeMcp).toHaveBeenCalledOnce();
    expect(h.messages.join("")).not.toContain("synthetic provider secret"); await h.service.shutdown();
  });
  it("attempts both transport closes even when the first close rejects", async () => {
    const rpc = new FixtureClient("rpc"), mcp = new FixtureClient("mcp");
    vi.spyOn(rpc, "close").mockRejectedValue(new Error("fixture close")); const closeMcp = vi.spyOn(mcp, "close");
    expect((await readMonitoredPosition({ rpc, mcp, now: testClock, evidenceKind: "FIXTURE" })).accepted).toBe(true);
    expect(closeMcp).toHaveBeenCalledOnce();
  });
  it.each([
    { malformed: "position" }, { fail: "position" }, { unavailableCall: true }, { sentinelBlockOffset: 1n },
    { afterHash: `0x${"ab".repeat(32)}` as const }, { chainId: 1n }
  ])("rejects malformed, partial or inconsistent reader snapshot %#", async overrides => {
    const h = harness({ read: () => riskFixture(overrides) });
    const cycle = await h.service.runOnce();
    expect(cycle).toMatchObject({ observation: { accepted: false, risk: { mathematicalRiskState: null, repayment: null, actionable: false } } });
    expect(h.store.state(MONITOR_SCOPE).lastAccepted).toBeNull(); await h.service.shutdown();
  });
  it("does not replace a prior accepted risk snapshot when a later partial read claims acceptance", async () => {
    const h = harness(); await h.service.runOnce(); const accepted = h.store.state(MONITOR_SCOPE).lastAccepted;
    h.read.mockResolvedValue({ ...base, accepted: true, position: null });
    const failure = await h.service.runOnce();
    expect(failure).toMatchObject({ observation: { accepted: false } });
    expect(h.store.state(MONITOR_SCOPE).lastAccepted).toEqual(accepted);
    expect(h.store.state(MONITOR_SCOPE).latest?.risk.mathematicalRiskState).toBeNull(); await h.service.shutdown();
  });
  it("records genuine zero-debt data as NO_DEBT, without treating a missing position as zero", async () => {
    const h = harness({ read: () => riskFixture({ values: { position: { ...position, borrowShares: 0n } } }) });
    const cycle = await h.service.runOnce(); expect(cycle).toMatchObject({ observation: { accepted: true, risk: { mathematicalRiskState: "NO_DEBT", safetyRatio: null } } });
    await h.service.shutdown();
  });
  it("rejects a backwards selected block instead of replacing the accepted live-stream snapshot", async () => {
    const h = harness(); await h.service.runOnce();
    const prior = h.store.state(MONITOR_SCOPE).lastAccepted;
    h.read.mockImplementation(() => readMonitoredPosition({ rpc: new FixtureClient("rpc"), mcp: new FixtureClient("mcp"),
      blockNumber: base.block!.number - 1n, evidenceKind: "FIXTURE", now: testClock }));
    expect(await h.service.runOnce()).toMatchObject({ observation: { accepted: false, diagnostics: expect.arrayContaining(["BLOCK_REGRESSION"]) } });
    expect(h.store.state(MONITOR_SCOPE).lastAccepted).toEqual(prior); await h.service.shutdown();
  });
  it("prevents overlap and waits for the active cycle during graceful shutdown", async () => {
    let release!: (snapshot: Snapshot) => void, entered!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const read = vi.fn(() => { entered(); return new Promise<Snapshot>(resolve => { release = resolve; }); });
    const h = harness({ read }); const first = h.service.runOnce(); await waiting;
    expect(await h.service.runOnce()).toEqual({ skipped: "OVERLAP" });
    const closing = h.service.shutdown(); expect(await h.service.runOnce()).toEqual({ skipped: "STOPPED" });
    release(base); expect(await first).toMatchObject({ observation: { accepted: true } }); await closing;
    expect(read).toHaveBeenCalledOnce();
  });
  it("requires opt-in for continuous mode and stops scheduling during a signal", async () => {
    const disabled = harness(); expect(() => disabled.service.runContinuous()).toThrow("opt-in"); await disabled.service.shutdown();
    let time = testClock().getTime();
    const h = harness({ configuration: parseMonitoringConfiguration({ monitoring: { enabled: true, intervalSeconds: 5 } }),
      now: () => new Date(time), pause: async milliseconds => { time += milliseconds; service.requestStop(); } });
    const service = h.service; await service.runContinuous(); expect(h.read).toHaveBeenCalledOnce(); await service.shutdown();
  });
  it("isolates an explicit historical stream and rejects accidental historical data in live monitoring", async () => {
    const historical = { ...base, evidenceKind: "HISTORICAL_SNAPSHOT" as const }, block = base.block!.number;
    const h = harness({ block, read: async () => historical });
    expect(await h.service.runOnce()).toMatchObject({ observation: { accepted: true, risk: { temporalContext: "HISTORICAL" } } });
    expect(h.service.scope).not.toBe(MONITOR_SCOPE); expect(h.store.state(MONITOR_SCOPE).lastAccepted).toBeNull();
    expect(h.store.state(monitoringScope(MONITOR_THRESHOLDS, block)).lastAccepted).not.toBeNull(); await h.service.shutdown();
    const live = harness({ read: async () => historical });
    expect(await live.service.runOnce()).toMatchObject({ observation: { accepted: false, diagnostics: expect.arrayContaining(["MONITOR_MODE_MISMATCH"]) } });
    await live.service.shutdown();
  });
  it("keeps an unknown oracle heartbeat unknown when a caller supplies an unsupported stale label", async () => {
    const raw = structuredClone(base); raw.quality.overall = "STALE"; raw.oracle.quality = "STALE";
    const h = harness({ read: async () => raw });
    expect(await h.service.runOnce()).toMatchObject({ observation: { accepted: false, risk: {
      dataQuality: "INVALID", phase2DataQuality: "STALE", oracleQuality: "UNVERIFIED", heartbeat: "UNKNOWN", repayment: null
    }, diagnostics: expect.arrayContaining(["FRESHNESS_UNDETERMINED"]) } }); await h.service.shutdown();
  });
  it("reassesses forged oracle verification through Phase 2 and keeps gated estimates absent", async () => {
    const raw = structuredClone(base); raw.oracle.quality = "VALID";
    Object.assign(raw.oracle.policy, { sourceVerified: true, heartbeatVerified: true, heartbeatSeconds: 86_400n, operatorIdentityVerified: true });
    const h = harness({ read: async () => raw });
    expect(await h.service.runOnce()).toMatchObject({ observation: { risk: { oracleQuality: "UNVERIFIED", oracleVerification: "UNVERIFIED",
      actionable: false, repayment: null, additionalCollateral: null } } }); await h.service.shutdown();
  });
  it("recovers an interrupted cycle and then resumes reads without losing alert history", async () => {
    const path = join(directory, "interrupted.sqlite"), original = new MonitorStore(path); original.acquireMonitor();
    original.beginCycle("interrupted_cycle", MONITOR_SCOPE, testClock().toISOString()); original.close();
    const h = harness({ store: new MonitorStore(path) }); await h.service.runOnce();
    expect(h.store.unfinishedCycles(MONITOR_SCOPE)).toHaveLength(0);
    expect(h.store.alerts().some(alert => alert.current.diagnostics.includes("PROCESS_INTERRUPTED"))).toBe(true);
    expect(h.store.state(MONITOR_SCOPE).lastAccepted?.cycleId).toBe("cycle_1"); await h.service.shutdown();
  });
  it("keeps notification failures separate from accepted mathematics", async () => {
    const h = harness({ adapters: [{ channel: "console", send: async () => ({ delivered: false, code: "CONSOLE_ERROR", retryable: true, ambiguous: true, retryAfterMs: null }) }] });
    expect(await h.service.runOnce()).toMatchObject({ observation: { accepted: true, risk: { mathematicalRiskState: "WARNING" } } });
    expect(h.store.deliveries().every(delivery => delivery.status === "PERMANENTLY_FAILED" && delivery.ambiguous === 1)).toBe(true);
    expect(h.store.state(MONITOR_SCOPE).consecutiveFailures).toBe(0); await h.service.shutdown();
  });
  it("stops after a failed observation commit and sends nothing for rolled-back work", async () => {
    const h = harness();
    vi.spyOn(h.store, "commitObservation").mockImplementationOnce(() => { throw new DataError("STORE_TRANSACTION_FAILED", "Fixture persistence failure"); });
    await expect(h.service.runOnce()).rejects.toThrow("Fixture persistence failure");
    expect(await h.service.runOnce()).toEqual({ skipped: "STOPPED" });
    expect(h.read).toHaveBeenCalledOnce(); expect(h.send).not.toHaveBeenCalled();
    expect(h.store.state(MONITOR_SCOPE).revision).toBe(0); expect(h.store.alerts()).toHaveLength(0);
    expect(h.store.unfinishedCycles(MONITOR_SCOPE)[0]?.status).toBe("RUNNING"); await h.service.shutdown();
  });
  it("stops on an acknowledgment-write failure and recovers that in-flight delivery after reopening", async () => {
    const path = join(directory, "failed-ack.sqlite"), h = harness({ store: new MonitorStore(path) });
    vi.spyOn(h.store, "finishAttempt").mockImplementationOnce(() => { throw new DataError("STORE_TRANSACTION_FAILED", "Fixture acknowledgment failure"); });
    await expect(h.service.runOnce()).rejects.toThrow("Fixture acknowledgment failure");
    expect(await h.service.runOnce()).toEqual({ skipped: "STOPPED" }); expect(h.send).toHaveBeenCalledOnce();
    const interrupted = h.store.deliveries().find(delivery => delivery.status === "IN_FLIGHT")!;
    expect(h.store.state(MONITOR_SCOPE).lastAccepted?.accepted).toBe(true); await h.service.shutdown();
    const resumed = harness({ store: new MonitorStore(path), id: () => "cycle_after_restart" });
    await resumed.service.runOnce();
    expect(resumed.store.deliveries().find(delivery => delivery.id === interrupted.id)).toMatchObject({ attempts: 1, ambiguous: 1, status: "PERMANENTLY_FAILED" });
    expect(resumed.store.state(MONITOR_SCOPE).lastAccepted?.risk.mathematicalRiskState).toBe("WARNING"); await resumed.service.shutdown();
  });
  it("stops continuous scheduling on an idle persistence failure and rejects reuse", async () => {
    const h = harness({ configuration: parseMonitoringConfiguration({ monitoring: { enabled: true } }) });
    vi.spyOn(h.store, "nextDeliveryAt").mockImplementationOnce(() => { throw new DataError("STORE_CORRUPT", "Fixture idle store failure"); });
    await expect(h.service.runContinuous()).rejects.toThrow("Fixture idle store failure");
    expect(await h.service.runOnce()).toEqual({ skipped: "STOPPED" }); expect(h.read).toHaveBeenCalledOnce(); await h.service.shutdown();
  });
  it("records a thrown read error without its arbitrary message", async () => {
    const h = harness({ read: async () => { throw new DataError("RPC_UNAVAILABLE", "synthetic-secret-message"); } });
    expect(await h.service.runOnce()).toMatchObject({ observation: { accepted: false, diagnostics: expect.arrayContaining(["RPC_UNAVAILABLE"]) } });
    expect(JSON.stringify(h.store.summary(MONITOR_SCOPE)) + h.messages.join("")).not.toContain("synthetic-secret-message"); await h.service.shutdown();
  });
});
