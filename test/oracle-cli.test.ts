import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { parseCliOptions } from "../src/cli/options.js";
import type { OracleCliDependencies } from "../src/cli/oracle.js";
import { runCli } from "../src/cli/run.js";
import type { Snapshot } from "../src/domain/types.js";
import { sha256 } from "../src/oracle-assurance/evidence.js";
import { assuranceSchema } from "../src/oracle-assurance/model.js";
import { MonitorStore } from "../src/storage/store.js";
import { supplementalFixture } from "./fixtures/assurance.js";
import { riskFixture, temporaryMonitorDirectory, testClock } from "./fixtures/phase4.js";

const directory = temporaryMonitorDirectory(); let base: Snapshot;
beforeAll(async () => { base = await riskFixture(); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
function harness(snapshot = structuredClone(base)) {
  const output: string[] = [], inspect = vi.fn(async (_block?: bigint) => snapshot), supplemental = vi.fn(async () => supplementalFixture(snapshot));
  return { output, inspect, supplemental, dependencies: { inspect, now: testClock, write: (text: string) => { output.push(text); }, oracle: { supplemental } } };
}
describe("FIXTURE: bounded oracle audit/status CLI", () => {
  it("executes one audit, persists it and serves text/JSON status across process-style reopen without new reads", async () => {
    const path = join(directory, "status.sqlite"), h = harness();
    expect(await runCli(["oracle-audit", "--database", path], h.dependencies)).toBe(0);
    expect(h.inspect).toHaveBeenCalledTimes(1); expect(h.supplemental).toHaveBeenCalledTimes(1);
    expect(h.output.join("")).toContain("Overall: UNVERIFIED"); expect(h.output.join("")).toContain("VERIFIED_HEARTBEAT: UNKNOWN");
    h.output.length = 0;
    expect(await runCli(["oracle-status", "--database", path, "--json"], h.dependencies)).toBe(0);
    expect(JSON.parse(h.output.join(""))).toMatchObject({ status: "PERSISTED_AS_OF_SNAPSHOT", latest: { assurance: { overall: "UNVERIFIED", actionable: false } } });
    h.output.length = 0; await runCli(["oracle-status", "--database", path], h.dependencies);
    expect(h.output.join("")).toContain("no fresh chain read"); expect(h.inspect).toHaveBeenCalledTimes(1);
  });
  it("reports an empty status without manufacturing a verified state", async () => {
    const h = harness(); await runCli(["oracle-status", "--database", join(directory, "empty.sqlite"), "--json"], h.dependencies);
    expect(JSON.parse(h.output.join(""))).toEqual({ status: "NO_PERSISTED_AUDIT", latest: null, actionable: false }); expect(h.inspect).not.toHaveBeenCalled();
  });
  it("labels explicit historical audits and never mistakes one for current status", async () => {
    const historical = structuredClone(base); historical.evidenceKind = "HISTORICAL_SNAPSHOT";
    const h = harness(historical); await runCli(["oracle-audit", "--block", historical.block!.number.toString(), "--database", join(directory, "historical.sqlite")], h.dependencies);
    expect(h.inspect).toHaveBeenCalledWith(historical.block!.number); expect(h.output.join("")).toContain("HISTORICAL audit");
  });
  it("saves the complete assurance, snapshot, graph and supplemental artifacts and binds the returned manifest to SQLite", async () => {
    const path = join(directory, "saved.sqlite"), h = harness(), save = vi.fn<OracleCliDependencies["save"]>(async () => ({ directory: resolve("evidence/phase4/oracle-audit-unit-fixture"), manifestSha256: "a".repeat(64), artifactCount: 5 }));
    await runCli(["oracle-audit", "--save-evidence", "--database", path, "--json"], { ...h.dependencies, oracle: { ...h.dependencies.oracle, save } });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ "assurance.json": expect.any(String), "snapshot.json": expect.any(String),
      "dependency-graph.json": expect.any(String), "audit-report.txt": expect.any(String), "supplemental.json": expect.any(String) }), expect.anything());
    const artifacts = save.mock.calls[0]![0], assurance = assuranceSchema.parse(JSON.parse(artifacts["assurance.json"]!));
    const snapshotRefs = assurance.findings.flatMap(finding => finding.evidence).filter(ref => ref.source === assurance.snapshotIdentifier);
    expect(snapshotRefs.length).toBeGreaterThan(0);
    expect(snapshotRefs.every(ref => ref.artifactSha256 === sha256(artifacts["snapshot.json"]!))).toBe(true);
    expect(assurance.findings.find(finding => finding.id === "BOUNDED_HISTORY")!.evidence[0]!.artifactSha256).toBe(sha256(artifacts["supplemental.json"]!));
    const store = new MonitorStore(path);
    try { expect(store.latestOracleAssurance()).toMatchObject({ bundlePath: "evidence/phase4/oracle-audit-unit-fixture", manifestSha256: "a".repeat(64) }); }
    finally { store.close(); }
  });
  it("reports local age rejection as invalid without inventing an upstream heartbeat", async () => {
    const h = harness(); expect(await runCli(["oracle-audit", "--database", join(directory, "age.sqlite"), "--local-max-age-seconds", "1", "--json"], h.dependencies)).toBe(2);
    expect(JSON.parse(h.output.join(""))).toMatchObject({ assurance: { gate: "DATA_INVALID", freshness: { policyRejected: true, policyOrigin: "OPERATOR_DEFINED_LOCAL_REJECTION", verifiedHeartbeatSeconds: null } } });
  });
  it("persists unavailable supplemental evidence as unavailable and exits nonzero", async () => {
    const h = harness(); h.supplemental.mockImplementation(async () => ({ ...supplementalFixture(base), status: "UNAVAILABLE" }));
    expect(await runCli(["oracle-audit", "--database", join(directory, "unavailable.sqlite")], h.dependencies)).toBe(2);
    expect(h.output.join("")).toContain("gate: DATA_UNAVAILABLE");
  });
  it.each([
    ["oracle-audit", "--block", "0"], ["oracle-audit", "--block", "1.5"], ["oracle-audit", "--local-max-age-seconds", "-1"],
    ["oracle-status", "--save-evidence"], ["oracle-status", "--block", "1"], ["oracle-audit", "--json", "--json"],
    ["oracle-audit", "--enable"], ["oracle-audit", "--heartbeat", "3600"], ["oracle-audit", "--database"]
  ])("rejects unsupported or ambiguous arguments %j before reading", (...args) => { expect(() => parseCliOptions(args)).toThrow(); });
  it("rejects a requested historical block/mode mismatch and releases the database lock", async () => {
    const path = join(directory, "mismatch.sqlite"), h = harness();
    await expect(runCli(["oracle-audit", "--block", "1", "--database", path], h.dependencies)).rejects.toMatchObject({ code: "ORACLE_AUDIT_MODE" });
    const store = new MonitorStore(path); try { expect(() => store.acquireMonitor()).not.toThrow(); } finally { store.close(); }
  });
});
