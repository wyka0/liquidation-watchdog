import { beforeAll, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli/run.js";
import type { CliDependencies } from "../src/cli/run.js";
import { parseCliOptions } from "../src/cli/options.js";
import { DataError } from "../src/domain/errors.js";
import type { Snapshot } from "../src/domain/types.js";
import { stringify } from "../src/domain/serialize.js";
import { sha256 } from "../src/oracle-assurance/evidence.js";
import type { AssuredRiskResult } from "../src/risk/assured.js";
import { riskFixture, RISK_FIXTURE_TIME } from "./fixtures/phase4.js";

let base: Snapshot;
beforeAll(async () => { base = await riskFixture(); });

function harness(snapshot: Snapshot = structuredClone(base)) {
  const output: string[] = [];
  return {
    output,
    dependencies: {
      inspect: vi.fn(async (_block?: bigint) => snapshot),
      write: (text: string) => { output.push(text); },
      saveInspection: vi.fn(async () => {}), saveRisk: vi.fn(async () => {}),
      now: () => new Date(RISK_FIXTURE_TIME)
    }
  };
}

describe("FIXTURE: Phase 2 CLI with Phase 1 regression behavior", () => {
  it("keeps inspect on the Phase 1 report path and saves new evidence outside its archive", async () => {
    const h = harness();
    expect(await runCli(["inspect", "--save-evidence"], h.dependencies)).toBe(0);
    expect(h.output.join("")).toContain("Phase 1 read-only inspection");
    expect(h.dependencies.inspect).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(h.dependencies.saveInspection).toHaveBeenCalledWith(expect.anything(), "evidence/phase5/inspect/live");
    expect(h.dependencies.saveRisk).not.toHaveBeenCalled();
  });

  it("renders all three layers, blocked recovery reasons and the oracle limitation", async () => {
    const h = harness();
    expect(await runCli(["risk", "--warning", "1.30", "--critical", "1.10", "--target", "1.25", "--save-evidence"], h.dependencies)).toBe(0);
    const report = h.output.join("");
    expect(report).toContain("Mathematical risk state: WARNING");
    expect(report).toContain("Quality-gated risk state: DATA_UNVERIFIED");
    expect(report).toContain("Data quality: UNVERIFIED | oracle: UNVERIFIED");
    expect(report).toContain("actionable=false");
    expect(report).toContain("Recovery estimates: BLOCKED");
    expect(report).toContain("RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED");
    expect(report).toContain("RECOVERY_CHAIN_PROGRESSION_UNKNOWN");
    expect(report).toContain("BLOCKED: no repayment amount was calculated or exposed");
    expect(report).toContain("BLOCKED: no additional-collateral amount was calculated or exposed");
    expect(report).toContain("Thresholds: warning 1.30 | critical 1.10 | target 1.25");
    expect(report).toContain("NON-ACTIONABLE");
    expect(report).not.toMatch(/\bSAFE\b/);
    expect(h.dependencies.saveRisk).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ riskState: "DATA_UNVERIFIED" }), "evidence/phase5/risk/live");
    expect(h.dependencies.saveInspection).not.toHaveBeenCalled();
  });

  it("applies custom CLI thresholds", async () => {
    const h = harness();
    expect(await runCli(["risk", "--warning", "1.5", "--critical", "1.2", "--target", "1.4"], h.dependencies)).toBe(0);
    expect(h.output.join("")).toContain("Mathematical risk state: CRITICAL");
    expect(h.output.join("")).toContain("target 1.4");
  });

  it("saves the exact snapshot serialization referenced by the assurance findings", async () => {
    const h = harness();
    const saveRisk = vi.fn<CliDependencies["saveRisk"]>(async (snapshot, result) => {
      const proof = (result as AssuredRiskResult).oracleAssurance, refs = proof.findings.flatMap(finding => finding.evidence).filter(ref => ref.source === proof.snapshotIdentifier);
      expect(refs.length).toBeGreaterThan(0);
      expect(refs.every(ref => ref.artifactSha256 === sha256(stringify(snapshot) + "\n"))).toBe(true);
    });
    expect(await runCli(["risk", "--save-evidence"], { ...h.dependencies, saveRisk })).toBe(0);
    expect(saveRisk).toHaveBeenCalledTimes(1);
  });

  it("loads an explicit config file and overrides it using flags", async () => {
    const h = harness();
    expect(await runCli(["risk", "--config", "config/risk-thresholds.example.json", "--target", "1.4"], h.dependencies)).toBe(0);
    expect(h.output.join("")).toContain("warning 1.30 | critical 1.10 | target 1.4");
  });

  it("labels an explicitly requested historical block and its estimates HISTORICAL", async () => {
    const h = harness({ ...structuredClone(base), evidenceKind: "HISTORICAL_SNAPSHOT" });
    const block = base.block!.number;
    expect(await runCli(["risk", "--block", block.toString(), "--save-evidence"], h.dependencies)).toBe(0);
    expect(h.dependencies.inspect).toHaveBeenCalledExactlyOnceWith(block);
    expect(h.output.join("")).toContain("Evidence: HISTORICAL");
    expect(h.output.join("")).not.toContain("LIVE_AS_OF_BLOCK");
    expect(h.dependencies.saveRisk).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ temporalContext: "HISTORICAL" }), `evidence/phase5/risk/historical-${block}`);
  });

  it("keeps historical inspect support", async () => {
    const h = harness({ ...structuredClone(base), evidenceKind: "HISTORICAL_SNAPSHOT" });
    const block = base.block!.number;
    expect(await runCli(["inspect", "--block", block.toString()], h.dependencies)).toBe(0);
    expect(h.output.join("")).toContain("HISTORICAL_SNAPSHOT");
  });

  it("does not silently use a historical snapshot or a different requested block", async () => {
    const h = harness({ ...structuredClone(base), evidenceKind: "HISTORICAL_SNAPSHOT" });
    await expect(runCli(["risk"], h.dependencies)).rejects.toThrow("requested block/mode");
    await expect(runCli(["risk", "--block", "1"], h.dependencies)).rejects.toThrow("requested block/mode");
    expect(h.dependencies.saveRisk).not.toHaveBeenCalled();
  });

  it.each([
    ["risk", "--warning", "1.0"], ["risk", "--target", "1e3"], ["risk", "--critical", "0"],
    ["risk", "--target"], ["risk", "--config"], ["risk", "--block", "0"], ["risk", "--block", "01"],
    ["risk", "--target", "1.25", "--target", "1.3"], ["risk", "--save-evidence", "--save-evidence"],
    ["risk", "--unknown"], ["inspect", "--warning", "1.3"]
  ].map(args => ({ args })))("rejects invalid CLI/configuration before any network access %#", async ({ args }) => {
    const h = harness();
    await expect(runCli(args, h.dependencies)).rejects.toThrow(DataError);
    expect(h.dependencies.inspect).not.toHaveBeenCalled();
  });

  it("prints help without reading the chain", async () => {
    const h = harness();
    expect(await runCli(["--help"], h.dependencies)).toBe(0);
    expect(h.output.join("")).toContain("--config");
    expect(h.dependencies.inspect).not.toHaveBeenCalled();
    expect(parseCliOptions(["risk", "--help"]).command).toBe("help");
  });

  it("returns exit 2 and no recovery values on unavailable data", async () => {
    const snapshot = await riskFixture({ unavailableCall: true });
    const h = harness(snapshot);
    expect(await runCli(["risk"], h.dependencies)).toBe(2);
    expect(h.output.join("")).toContain("DATA_UNAVAILABLE");
    expect(h.output.join("")).toContain("Accrued debt: UNAVAILABLE");
    expect(h.output.join("")).not.toContain("Accrued debt: 0 USDC");
  });

  it("keeps base-risk exit 0 when eligibility-gated estimates are absent, including arithmetic-bound overflow", async () => {
    const h = harness();
    expect(await runCli(["risk", "--target", `1${"0".repeat(54)}`], h.dependencies)).toBe(0);
    const report = h.output.join("");
    expect(report).toContain("Recovery estimates: BLOCKED");
    expect(report).toContain("BLOCKED: no repayment amount was calculated or exposed");
    expect(report).not.toMatch(/\bSAFE\b/);
  });
});
