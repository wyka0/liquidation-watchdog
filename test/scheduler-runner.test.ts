import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CycleResult } from "../src/monitoring/service.js";
import { SchedulerRunner } from "../src/runtime/scheduler.js";
import type { ScheduledJob } from "../src/runtime/scheduler.js";
import { scheduledIdentity } from "../src/runtime/scheduler-contract.js";
import type { Admission, ExecutionReceipt } from "../src/runtime/scheduler-contract.js";
import type { Fence } from "../src/storage/postgres/database.js";

const slot = "2026-11-02T12:05:00.000Z", periodSeconds = 300, identity = scheduledIdentity("fixture", slot, periodSeconds);
const fence: Fence = { owner: randomUUID(), fence: "1", incarnation: randomUUID(), executionId: identity.id, cycleId: identity.cycleId, slot, missedSlots: 0 };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function fixture(job?: ScheduledJob) {
  const admit = vi.fn(async (): Promise<Admission> => ({ kind: "ACQUIRED", fence }));
  const finish = vi.fn(async (_fence: Fence, outcome: { accepted: boolean; error: ExecutionReceipt["error"] }): Promise<ExecutionReceipt> => ({
    slot, cycleId: fence.cycleId, status: outcome.error ? "FAILED" : "COMPLETED", completedAt: slot, accepted: outcome.accepted, missedSlots: 0, error: outcome.error
  }));
  const createJob = vi.fn(() => job ?? { runOnce: async (): Promise<CycleResult> => ({ skipped: "STOPPED" }), abort: vi.fn(), shutdown: vi.fn(async () => {}) });
  const runner = new SchedulerRunner({ enabled: true, periodSeconds, store: { admit, finish }, createJob, budgetMs: 300 });
  return { runner, admit, finish, createJob };
}

describe("PHASE10 FIXTURE: finite scheduler execution and cleanup", () => {
  it("does not admit disabled or stopped work", async () => {
    const h = fixture(), disabled = new SchedulerRunner({ enabled: false, periodSeconds, store: h, createJob: h.createJob });
    expect((await disabled.run(slot, new AbortController().signal)).status).toBe(503); expect(h.admit).not.toHaveBeenCalled();
    await h.runner.stop(); expect((await h.runner.run(slot, new AbortController().signal)).status).toBe(503);
  });
  it.each(["BUSY", "OUTCOME_UNKNOWN", "SLOT_REFUSED"] as const)("returns %s without constructing a job", async kind => {
    const h = fixture(); h.admit.mockResolvedValueOnce({ kind });
    expect(await h.runner.run(slot, new AbortController().signal)).toEqual({ status: 409, body: { error: kind } });
    expect(h.createJob).not.toHaveBeenCalled(); expect(h.finish).not.toHaveBeenCalled(); await h.runner.stop();
  });
  it("returns an existing receipt or active identity without starting another cycle", async () => {
    const h = fixture(), receipt: ExecutionReceipt = { slot, cycleId: fence.cycleId, status: "COMPLETED", completedAt: slot, accepted: false, missedSlots: 0, error: null };
    h.admit.mockResolvedValueOnce({ kind: "RECEIPT", receipt }).mockResolvedValueOnce({ kind: "IN_PROGRESS", cycleId: fence.cycleId, slot });
    expect(await h.runner.run(slot, new AbortController().signal)).toEqual({ status: 200, body: receipt });
    expect((await h.runner.run(slot, new AbortController().signal)).status).toBe(202);
    expect(h.createJob).not.toHaveBeenCalled(); expect(h.finish).not.toHaveBeenCalled();
  });
  it("aborts a non-cooperative cycle at the total-work deadline and records a failed receipt", async () => {
    vi.useFakeTimers();
    const work = deferred<CycleResult>(), abort = vi.fn(), shutdown = vi.fn(async () => {}), h = fixture({ runOnce: () => work.promise, abort, shutdown });
    const response = h.runner.run(slot, new AbortController().signal); await vi.advanceTimersByTimeAsync(201);
    expect(await response).toMatchObject({ status: 500, body: { status: "FAILED", error: "JOB_TIMEOUT", accepted: false } });
    expect(abort).toHaveBeenCalled(); expect(shutdown).toHaveBeenCalledOnce(); expect(h.finish).toHaveBeenCalledOnce();
    work.resolve({ skipped: "STOPPED" }); await vi.advanceTimersByTimeAsync(0); expect(h.finish).toHaveBeenCalledOnce(); await h.runner.stop();
  });
  it("bounds non-cooperative shutdown and receipt writes inside the total job budget", async () => {
    vi.useFakeTimers();
    const h = fixture({ runOnce: async () => ({ skipped: "STOPPED" }), abort: vi.fn(), shutdown: () => new Promise(() => {}) });
    h.finish.mockImplementationOnce(() => new Promise(() => {}));
    const response = h.runner.run(slot, new AbortController().signal); await vi.advanceTimersByTimeAsync(301);
    expect(await response).toEqual({ status: 503, body: { error: "EXECUTION_UNAVAILABLE" } }); await h.runner.stop();
  });
  it("never creates work after an admission response arrives past its deadline", async () => {
    vi.useFakeTimers(); const h = fixture(), admission = deferred<Admission>(); h.admit.mockReturnValueOnce(admission.promise);
    const response = h.runner.run(slot, new AbortController().signal); await vi.advanceTimersByTimeAsync(201);
    expect((await response).status).toBe(503);
    admission.resolve({ kind: "ACQUIRED", fence }); await vi.advanceTimersByTimeAsync(0);
    expect(h.createJob).not.toHaveBeenCalled(); expect(h.finish).not.toHaveBeenCalled(); await h.runner.stop();
  });
  it("cancels on disconnect or shutdown and refuses new work", async () => {
    const entered = deferred<void>(), cancellation = new AbortController(), abort = vi.fn();
    const h = fixture({ runOnce: () => { entered.resolve(); return new Promise(() => {}); }, abort, shutdown: async () => {} });
    const response = h.runner.run(slot, cancellation.signal); await entered.promise; cancellation.abort();
    expect((await response).status).toBe(500); expect(abort).toHaveBeenCalled(); await h.runner.stop();
    expect((await h.runner.run(slot, new AbortController().signal)).status).toBe(503);
  });
});
