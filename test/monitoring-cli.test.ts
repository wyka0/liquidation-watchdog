import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli/run.js";
import type { Snapshot } from "../src/domain/types.js";
import { ConsoleAdapter } from "../src/notifications/adapters.js";
import { temporaryMonitorDirectory, testClock } from "./fixtures/monitoring.js";
import { riskFixture } from "./fixtures/phase4.js";

const directory = temporaryMonitorDirectory(); let base: Snapshot;
beforeAll(async () => { base = await riskFixture(); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
describe("FIXTURE: monitoring CLI and side-effect boundaries", () => {
  it("executes a bounded one-cycle command and reads persisted history/status after reopening", async () => {
    const path = join(directory, "cli.sqlite"), output: string[] = [], cleanup = vi.fn();
    const read = vi.fn(async () => base), adapters = vi.fn((_config, write) => [new ConsoleAdapter(write)]);
    const dependencies = { now: testClock, write: (text: string) => output.push(text), monitoring: { read, adapters, allowFixture: true, onSignal: () => cleanup } };
    expect(await runCli(["monitor", "--once", "--database", path], dependencies)).toBe(0);
    expect(read).toHaveBeenCalledOnce(); expect(cleanup).toHaveBeenCalledOnce();
    expect(await runCli(["alerts", "--limit", "20", "--database", path], dependencies)).toBe(0);
    expect(await runCli(["status", "--database", path], dependencies)).toBe(0);
    expect(adapters).toHaveBeenCalledOnce(); expect(read).toHaveBeenCalledOnce();
    expect(output.join("")).toContain("DELIVERED"); expect(output.join("")).toContain("lastAcceptedCycle");
  });
  it("rejects continuous default before opening a store or reading providers", async () => {
    const openStore = vi.fn(), read = vi.fn(), adapters = vi.fn();
    await expect(runCli(["monitor"], { monitoring: { openStore, read, adapters } })).rejects.toThrow("opt-in");
    expect(openStore).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled(); expect(adapters).not.toHaveBeenCalled();
  });
  it("returns exit 2 for unavailable current data and never prints a safety claim", async () => {
    const output: string[] = [];
    const code = await runCli(["monitor", "--once", "--database", join(directory, "failed.sqlite")], {
      now: testClock, write: text => output.push(text), monitoring: { read: async () => null }
    });
    expect(code).toBe(2); expect(output.join("")).toContain("Current risk cannot be determined"); expect(output.join("")).not.toMatch(/\bSAFE\b/);
  });
  it("shows unknown status for a fresh database without fabricating a heartbeat or risk result", async () => {
    const output: string[] = [];
    expect(await runCli(["status", "--database", join(directory, "empty.sqlite")], { write: text => output.push(text) })).toBe(0);
    expect(output.join("")).toContain('"lastAccepted": null'); expect(output.join("")).toContain("heartbeat: UNKNOWN");
  });
});
