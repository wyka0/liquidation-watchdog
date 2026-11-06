import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Snapshot } from "../src/domain/types.js";
import { parseThresholds } from "../src/config/risk.js";
import { saveRiskEvidence } from "../src/risk/evidence.js";
import { calculateAssuredRisk } from "../src/risk/assured.js";
import { riskFixture, RISK_FIXTURE_TIME } from "./fixtures/phase4.js";
import { verifiedAssuranceFixture } from "./fixtures/recovery.js";

let base: Snapshot;
let directory: string;
beforeAll(async () => {
  base = await riskFixture();
  const parent = join(tmpdir(), "opencode");
  await mkdir(parent, { recursive: true });
  directory = await mkdtemp(join(parent, "watchdog-phase2-fixture-"));
});
afterAll(async () => { if (directory) await rm(directory, { recursive: true, force: true }); });

describe("FIXTURE: risk evidence binding", () => {
  it("saves a self-contained result/estimate set with matching byte hashes on the eligible path", async () => {
    const result = calculateAssuredRisk(base, verifiedAssuranceFixture(base), parseThresholds(),
      { calculatedAt: new Date(RISK_FIXTURE_TIME), progression: { state: "ADVANCING" } });
    expect(result.recoveryEligibility.status).toBe("ELIGIBLE");
    expect(result.repayment?.status).toBe("CALCULATED");
    const path = join(directory, "valid");
    await saveRiskEvidence(base, result, path);
    const manifest = JSON.parse(await readFile(join(path, "manifest.json"), "utf8")) as { inputSnapshotIdentifier: string; files: { file: string; sha256: string }[] };
    expect(manifest.inputSnapshotIdentifier).toBe(result.inputSnapshotIdentifier);
    for (const file of manifest.files) {
      expect(createHash("sha256").update(await readFile(join(path, file.file))).digest("hex")).toBe(file.sha256);
    }
    for (const file of ["repayment-estimate.json", "collateral-estimate.json"]) {
      const text = await readFile(join(path, file), "utf8");
      expect(text).toContain(result.blockHash!);
      expect(text).toContain(result.inputSnapshotIdentifier!);
      expect(text).toContain('"actionable": false');
      expect(text).toContain('"oracle": "UNVERIFIED"');
      expect(text).toContain('"temporalContext": "FIXTURE"');
      expect(text).not.toMatch(/"actionable": true/);
    }
  });

  it("rejects a changed input before creating output files", async () => {
    const result = calculateAssuredRisk(base, verifiedAssuranceFixture(base), parseThresholds(),
      { calculatedAt: new Date(RISK_FIXTURE_TIME), progression: { state: "ADVANCING" } });
    const changed = structuredClone(base);
    changed.startedAt = "2026-11-01T14:04:59.000Z";
    const path = join(directory, "different-input");
    await expect(saveRiskEvidence(changed, result, path)).rejects.toThrow("different or unbound");
    expect(await readdir(directory)).not.toContain("different-input");
  });

  it("rejects a detached recommendation and tampered actionability", async () => {
    const result = structuredClone(calculateAssuredRisk(base, verifiedAssuranceFixture(base), parseThresholds(),
      { calculatedAt: new Date(RISK_FIXTURE_TIME), progression: { state: "ADVANCING" } }));
    result.repayment!.blockHash = `0x${"aa".repeat(32)}`;
    await expect(saveRiskEvidence(base, result, join(directory, "detached"))).rejects.toThrow("different snapshot provenance");
    result.repayment!.blockHash = result.blockHash!;
    Object.assign(result.repayment!, { actionable: true });
    await expect(saveRiskEvidence(base, result, join(directory, "actionable"))).rejects.toThrow("actionability");
  });
});
