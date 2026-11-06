import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { RenderRuntime } from "../src/runtime/service.js";
import { MonitorStore } from "../src/storage/store.js";
import { MONITOR_SCOPE } from "./fixtures/phase4.js";
import { RELEASE_ROOT, runtimeFixture } from "./fixtures/runtime.js";

interface ChildHandle { process: ChildProcess; closed: Promise<number | null> }
const CHILD_TIMEOUT_MS = 30_000;
const children: ChildHandle[] = [], directories: string[] = [];
afterEach(async () => {
  // Vitest's deadline does not await the test body's finally. Fence late spawns and reap before removal.
  const removing = directories.splice(0), stopped = await Promise.allSettled(children.splice(0).map(stop));
  for (const directory of removing) {
    rmSync(directory, { recursive: true, force: true }); expect(existsSync(directory)).toBe(false);
  }
  const failures = stopped.flatMap(result => result.status === "rejected" ? [result.reason as unknown] : []);
  if (failures.length) throw new AggregateError(failures, "Child process cleanup failed");
});
function track(process: ChildProcess): ChildHandle {
  const closed = new Promise<number | null>((resolve, reject) => {
    let failure: Error | undefined;
    process.once("error", error => { failure = error; });
    process.once("close", code => { if (failure) reject(failure); else resolve(code); });
  });
  const handle = { process, closed }; children.push(handle); return handle;
}
function child(directory: string, mode: string) {
  if (!directories.includes(directory)) throw new Error("Runtime fixture teardown has already begun");
  const process = spawn(globalThis.process.execPath, ["--import", "tsx", "test/helpers/phase8-runtime.ts", directory, mode], {
    cwd: RELEASE_ROOT, stdio: ["ignore", "pipe", "pipe", "ipc"], timeout: CHILD_TIMEOUT_MS, killSignal: "SIGKILL", windowsHide: true
  });
  const events = new Set<string>(), waiters = new Map<string, () => void>();
  process.on("message", (value: unknown) => { if (typeof value === "object" && value !== null && "event" in value && typeof value.event === "string") {
    events.add(value.event); waiters.get(value.event)?.();
  } });
  const { closed } = track(process);
  const event = (name: string) => Promise.race([new Promise<void>(resolve => { if (events.has(name)) resolve(); else waiters.set(name, resolve); }), closed.then(() => { throw new Error("Child exited before its expected lifecycle event"); })]);
  return { process, event, closed };
}
async function stop(child: ChildHandle) {
  if (child.process.exitCode === null && child.process.signalCode === null) child.process.kill("SIGKILL");
  // exit can precede stdio/IPC close; always await the promise installed at spawn, even after exit.
  await child.closed;
}

describe("PHASE8 FIXTURE: actual runtime processes", () => {
  it("guards source imports against HTTP construction, SQLite opens and provider requests", async () => {
    const process = spawn(globalThis.process.execPath, ["--import", "tsx", "test/helpers/phase8-import.ts", "src/service.ts"], {
      cwd: RELEASE_ROOT, stdio: ["ignore", "pipe", "pipe"], timeout: 20_000, killSignal: "SIGKILL", windowsHide: true
    });
    let output = ""; process.stdout.on("data", (bytes: Buffer) => { output += bytes.toString(); });
    const code = await track(process).closed;
    expect(code).toBe(0); expect(JSON.parse(output) as unknown).toMatchObject({ passed: true, databaseOpens: 0, providerRequests: 0 });
  }, 30_000);
  it.each(["SIGINT", "SIGTERM"] as const)("shuts down a child runtime through %s (Windows: IPC handler simulation)", async signal => {
    const h = runtimeFixture(true, true); directories.push(h.directory); const running = child(h.directory, "idle");
    try {
      await running.event("idle"); const started = performance.now();
      if (process.platform === "win32") running.process.send(signal); else running.process.kill(signal);
      expect(await running.closed).toBe(0); expect(performance.now() - started).toBeLessThan(3_000);
      const check = new MonitorStore(h.options.database); check.acquireMonitor(); expect(check.runtime()?.status).toBe("STOPPED"); check.validateAll(); check.close();
    } finally { await stop(running); }
  }, 40_000);
  // Two sequential unchanged 30s child bounds, plus the normal 10s fencing/storage assertion budget.
  it("fences a second process and recovers after actual forced OS termination with an unfinished cycle", async () => {
    const h = runtimeFixture(true, true); directories.push(h.directory); const running = child(h.directory, "read");
    try {
      await running.event("reading"); const duplicate = new RenderRuntime(h.options);
      await expect(duplicate.start()).rejects.toMatchObject({ code: "RUNTIME_STARTUP" }); await duplicate.stop();
      expect(() => new MonitorStore(h.options.database)).toThrow("exclusive monitor lock");
      expect(running.process.kill("SIGKILL")).toBe(true); await running.closed;
      const interrupted = new MonitorStore(h.options.database, { readOnly: true }); expect(interrupted.unfinishedCycles(MONITOR_SCOPE)).toHaveLength(1); interrupted.close();
      const resumed = child(h.directory, "idle");
      try {
        await resumed.event("idle"); resumed.process.send("SIGTERM"); expect(await resumed.closed).toBe(0);
        const check = new MonitorStore(h.options.database); check.acquireMonitor(); expect(check.unfinishedCycles(MONITOR_SCOPE)).toEqual([]);
        expect(check.state(MONITOR_SCOPE).revision).toBe(2); check.validateAll(); check.close();
      } finally { await stop(resumed); }
    } finally { await stop(running); }
  }, 2 * CHILD_TIMEOUT_MS + 10_000);
});
