import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import worker, { invokeScheduler, scheduledSlot } from "../cloudflare/monitor-scheduler/src/worker.js";
import type { SchedulerDependencies, WorkerEnvironment } from "../cloudflare/monitor-scheduler/src/worker.js";

const secret = () => randomBytes(32).toString("base64url");
const environment = (): WorkerEnvironment => ({
  WATCHDOG_SCHEDULER_URL: "https://watchdog.example.test/internal/monitor/run",
  WATCHDOG_SCHEDULER_SECRET: secret()
});
const scheduledTime = Date.UTC(2026, 10, 4, 11, 5, 0, 0);
const controller = { scheduledTime };
function harness(fetcher: typeof fetch, timeoutMs = 100) {
  const records: Readonly<Record<string, unknown>>[] = [];
  const dependencies: SchedulerDependencies = { fetch: fetcher, timeoutMs, log: record => { records.push(record); } };
  return { dependencies, records };
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("A3 FIXTURE: thin Cloudflare UTC scheduler", () => {
  it("derives only canonical five-minute UTC slots from scheduledTime", () => {
    expect(scheduledSlot(scheduledTime)).toBe("2026-11-04T11:05:00.000Z");
    expect(() => scheduledSlot(scheduledTime + 60_000)).toThrowError(/SLOT_CONFIG/);
    expect(() => scheduledSlot(Number.NaN)).toThrowError(/SLOT_CONFIG/);
  });
  it("uses the scheduled handler, disables platform retries and delegates one promise", async () => {
    const noRetry = vi.fn(), waits: Promise<unknown>[] = [];
    const originalFetch = globalThis.fetch;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => response({ status: "IN_PROGRESS", slot: scheduledSlot(scheduledTime), cycleId: "scheduled_fixture" })) as typeof fetch;
    try {
      worker.scheduled({ scheduledTime, cron: "*/5 * * * *", noRetry }, environment(), { waitUntil: work => { waits.push(work); } });
      expect(noRetry).toHaveBeenCalledOnce(); expect(waits).toHaveLength(1); await waits[0];
      expect(globalThis.fetch).toHaveBeenCalledOnce();
    } finally { globalThis.fetch = originalFetch; log.mockRestore(); }
  });
  it("refuses a missing or malformed secret before fetch", async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const value of [undefined, "", "short", "x".repeat(257)]) {
      const h = harness(fetcher);
      await expect(invokeScheduler(controller, { ...environment(), WATCHDOG_SCHEDULER_SECRET: value }, h.dependencies)).rejects.toThrowError(/SECRET_CONFIG/);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([undefined, "http://watchdog.example.test/internal/monitor/run", "https://localhost/internal/monitor/run",
    "https://user@watchdog.example.test/internal/monitor/run", "https://watchdog.example.test/other",
    "https://watchdog.example.test/internal/monitor/run?secret=no"])("refuses invalid endpoint URL %j before fetch", async value => {
    const fetcher = vi.fn<typeof fetch>(), h = harness(fetcher);
    await expect(invokeScheduler(controller, { ...environment(), WATCHDOG_SCHEDULER_URL: value }, h.dependencies)).rejects.toThrowError(/ENDPOINT_CONFIG/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("aborts a request at the bounded endpoint timeout", async () => {
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => { reject(new Error("synthetic timeout")); }, { once: true });
    }));
    const h = harness(fetcher, 5);
    await expect(invokeScheduler(controller, environment(), h.dependencies)).rejects.toThrowError(/ENDPOINT_TIMEOUT/);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(h.records).toEqual([{ event: "scheduler_request_failed", code: "ENDPOINT_TIMEOUT", slot: "2026-11-04T11:05:00.000Z" }]);
  });
  it("handles non-2xx once and logs only allowlisted receipt fields", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response({ status: "FAILED", cycleId: "scheduled_fixture", slot: scheduledSlot(scheduledTime),
      accepted: false, missedSlots: 2, error: "CYCLE_FAILED", detail: "must-not-log" }, 500));
    const h = harness(fetcher);
    await expect(invokeScheduler(controller, environment(), h.dependencies)).rejects.toThrowError(/ENDPOINT_NON_2XX/);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(h.records).toEqual([{ event: "scheduler_http_failure", httpStatus: 500, outcome: "FAILED", slot: "2026-11-04T11:05:00.000Z",
      cycleId: "scheduled_fixture", observationAccepted: false, missedSlots: 2, error: "CYCLE_FAILED" }]);
    expect(JSON.stringify(h.records)).not.toContain("must-not-log");
  });
  it("never leaks its secret through network-failure logs", async () => {
    const value = secret(), fetcher = vi.fn<typeof fetch>(async () => { throw new Error(`synthetic ${value}`); }), h = harness(fetcher);
    await expect(invokeScheduler(controller, { ...environment(), WATCHDOG_SCHEDULER_SECRET: value }, h.dependencies)).rejects.toThrowError(/NETWORK_FAILURE/);
    expect(JSON.stringify(h.records)).not.toContain(value);
  });
  it("separates HTTP outcome from persisted observation acceptance", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response({ status: "COMPLETED", cycleId: "scheduled_fixture", slot: scheduledSlot(scheduledTime),
      accepted: false, missedSlots: 0, error: null })), h = harness(fetcher);
    const result = await invokeScheduler(controller, environment(), h.dependencies);
    expect(result).toEqual({ httpStatus: 200, outcome: "COMPLETED", slot: "2026-11-04T11:05:00.000Z", cycleId: "scheduled_fixture",
      observationAccepted: false, missedSlots: 0, error: null });
  });
  it("sends duplicate Cron deliveries with the identical slot for durable endpoint deduplication", async () => {
    const bodies: string[] = [], fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      bodies.push(String(init?.body));
      return response({ status: "IN_PROGRESS", cycleId: "scheduled_fixture", slot: scheduledSlot(scheduledTime) }, 202);
    }), h = harness(fetcher);
    await Promise.all([invokeScheduler(controller, environment(), h.dependencies), invokeScheduler(controller, environment(), h.dependencies)]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bodies).toEqual([JSON.stringify({ slot: "2026-11-04T11:05:00.000Z" }), JSON.stringify({ slot: "2026-11-04T11:05:00.000Z" })]);
  });
});
