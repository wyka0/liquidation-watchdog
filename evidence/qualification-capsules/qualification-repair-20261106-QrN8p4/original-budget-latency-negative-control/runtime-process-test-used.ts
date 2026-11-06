import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { RenderRuntime } from "../src/runtime/service.js";
import { MonitorStore } from "../src/storage/store.js";
import { MONITOR_SCOPE } from "./fixtures/phase4.js";
import { RELEASE_ROOT, runtimeFixture } from "./fixtures/runtime.js";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function child(directory: string, mode: string) {
  const process = spawn(globalThis.process.execPath, ["--import", "tsx", "test/helpers/phase8-runtime.ts", directory, mode], {
    cwd: RELEASE_ROOT, stdio: ["ignore", "pipe", "pipe", "ipc"], timeout: 30_000, killSignal: "SIGKILL", windowsHide: true
  });
  const events = new Set<string>(), waiters = new Map<string, () => void>();
  process.on("message", (value: unknown) => { if (typeof value === "object" && value !== null && "event" in value && typeof value.event === "string") {
    events.add(value.event); waiters.get(value.event)?.();
  } });
  const closed = new Promise<number | null>((resolve, reject) => { process.once("error", reject); process.once("close", code => { resolve(code); }); });
  const event = (name: string) => Promise.race([new Promise<void>(resolve => { if (events.has(name)) resolve(); else waiters.set(name, resolve); }), closed.then(() => { throw new Error("Child exited before its expected lifecycle event"); })]);
  return { process, event, closed };
}
async function stop(process: ChildProcess) {
  if (process.exitCode !== null || process.signalCode !== null) return;
  const closed = new Promise<void>(resolve => { process.once("close", () => { resolve(); }); }); process.kill("SIGKILL"); await closed;
}

describe("PHASE8 FIXTURE: actual runtime processes", () => {
  it("guards source imports against HTTP construction, SQLite opens and provider requests", async () => {
    const process = spawn(globalThis.process.execPath, ["--import", "tsx", "test/helpers/phase8-import.ts", "src/service.ts"], {
      cwd: RELEASE_ROOT, stdio: ["ignore", "pipe", "pipe"], timeout: 20_000, killSignal: "SIGKILL", windowsHide: true
    });
    let output = ""; process.stdout.on("data", (bytes: Buffer) => { output += bytes.toString(); });
    const code = await new Promise<number | null>((resolve, reject) => { process.once("error", reject); process.once("close", resolve); });
    expect(code).toBe(0); expect(JSON.parse(output) as unknown).toMatchObject({ passed: true, databaseOpens: 0, providerRequests: 0 });
  }, 30_000);
  it.each(["SIGINT", "SIGTERM"] as const)("shuts down a child runtime through %s (Windows: IPC handler simulation)", async signal => {
    const h = runtimeFixture(true, true); directories.push(h.directory); const running = child(h.directory, "idle");
    try {
      await running.event("idle"); const started = performance.now();
      if (process.platform === "win32") running.process.send(signal); else running.process.kill(signal);
      expect(await running.closed).toBe(0); expect(performance.now() - started).toBeLessThan(3_000);
      const check = new MonitorStore(h.options.database); check.acquireMonitor(); expect(check.runtime()?.status).toBe("STOPPED"); check.validateAll(); check.close();
    } finally { await stop(running.process); }
  }, 40_000);
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
      } finally { await stop(resumed.process); }
    } finally { await stop(running.process); }
  }, 40_000);
});
