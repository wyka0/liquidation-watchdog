import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import { PostgresFixtureCleanup, rethrowAfterFixtureCleanup } from "./fixtures/postgres.js";

function harness(invoke = vi.fn(async (_name: string, _args: string[]) => {})) {
  const directory = join(tmpdir(), "opencode", `watchdog-phase10-pg-cleanup-${Math.random().toString(16).slice(2)}`);
  const remove = vi.fn(), cleanup = new PostgresFixtureCleanup(directory, join(directory, "data"), invoke, remove);
  return { cleanup, invoke, remove };
}
const primary = (stage: string) => new Error(`synthetic ${stage} failure`);

describe("PHASE10 FIXTURE: adversarial PostgreSQL cleanup", () => {
  it("removes partial initialization without invoking pg_ctl", async () => {
    const h = harness(); await h.cleanup.close();
    expect(h.invoke).not.toHaveBeenCalled(); expect(h.remove).toHaveBeenCalledOnce();
  });
  it("probes an ambiguous startup failure and removes only after status proves not running", async () => {
    const invoke = vi.fn(async (_name: string, args: string[]) => {
      if (args.at(-1) === "status") throw Object.assign(new Error("not running"), { code: 3 });
    }), h = harness(invoke); h.cleanup.startupBeginning();
    await expect(rethrowAfterFixtureCleanup(primary("startup"), h.cleanup)).rejects.toThrow("synthetic startup failure");
    expect(invoke).toHaveBeenCalledExactlyOnceWith("pg_ctl", ["-D", h.cleanup.data, "status"]);
    expect(h.remove).toHaveBeenCalledOnce();
  });
  it("stops a server discovered after an ambiguous startup response before removal", async () => {
    const invoke = vi.fn(async () => {}), h = harness(invoke); h.cleanup.startupBeginning();
    await expect(rethrowAfterFixtureCleanup(primary("startup"), h.cleanup)).rejects.toThrow("synthetic startup failure");
    expect(invoke.mock.calls).toEqual([["pg_ctl", ["-D", h.cleanup.data, "status"]],
      ["pg_ctl", ["-D", h.cleanup.data, "-m", "immediate", "-w", "stop"]]]);
    expect(h.remove).toHaveBeenCalledOnce();
  });
  it.each(["database creation", "role creation", "migration", "test setup", "test execution"])("preserves the original %s failure after full cleanup", async stage => {
    const h = harness(); h.cleanup.startupBeginning(); h.cleanup.startupCompleted();
    const admin = { close: vi.fn(async () => {}) }, database = { close: vi.fn(async () => {}) };
    h.cleanup.setAdmin(admin); h.cleanup.addDatabase(database); const error = primary(stage);
    await expect(rethrowAfterFixtureCleanup(error, h.cleanup)).rejects.toBe(error);
    expect(database.close).toHaveBeenCalledOnce(); expect(admin.close).toHaveBeenCalledOnce();
    expect(h.invoke).toHaveBeenCalledExactlyOnceWith("pg_ctl", ["-D", h.cleanup.data, "-m", "immediate", "-w", "stop"]);
    expect(h.remove).toHaveBeenCalledOnce();
  });
  it("performs normal completion once and makes repeated cleanup safe", async () => {
    const h = harness(); h.cleanup.startupBeginning(); h.cleanup.startupCompleted();
    const first = h.cleanup.close(), second = h.cleanup.close();
    expect(second).toBe(first); await Promise.all([first, second]);
    expect(h.invoke).toHaveBeenCalledOnce(); expect(h.remove).toHaveBeenCalledOnce();
  });
  it("preserves the primary failure, reports cleanup failure and refuses unsafe deletion", async () => {
    const stop = new Error("synthetic stop failure"), h = harness(vi.fn(async () => { throw stop; }));
    h.cleanup.startupBeginning(); h.cleanup.startupCompleted(); const error = primary("test execution");
    let thrown: unknown;
    try { await rethrowAfterFixtureCleanup(error, h.cleanup); } catch (caught) { thrown = caught; }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).cause).toBe(error);
    expect((thrown as AggregateError).errors[0]).toBe(error);
    const cleanupFailure = (thrown as AggregateError).errors[1];
    expect(cleanupFailure).toBeInstanceOf(AggregateError);
    expect((cleanupFailure as AggregateError).errors).toContain(stop);
    expect(h.remove).not.toHaveBeenCalled();
  });
  it("rejects cleanup paths outside the fixture-owned temporary directory", () => {
    expect(() => new PostgresFixtureCleanup(join(tmpdir(), "unrelated"), join(tmpdir(), "unrelated", "data"), async () => {})).toThrow("Unsafe");
  });
});
