import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadThresholds, parseThresholds, validateThresholds } from "../src/config/risk.js";
import { classifyMathematicalRisk, effectiveRiskState } from "../src/risk/thresholds.js";
import { WAD } from "../src/morpho/math.js";
import { U256_MAX } from "../src/validation/schemas.js";

describe("FIXTURE: exact risk configuration and threshold precedence", () => {
  it("parses decimal text to exact WAD values and retains the configured text", () => {
    const t = parseThresholds();
    expect(t.wad).toEqual({ warningRatio: 1_300_000_000_000_000_000n, criticalRatio: 1_100_000_000_000_000_000n, targetRatio: 1_250_000_000_000_000_000n, liquidationBoundary: WAD });
    expect(t.decimal.targetRatio).toBe("1.25");
    expect(parseThresholds({ targetRatio: "1.250000000000000001" }).wad.targetRatio).toBe(1_250_000_000_000_000_001n);
    expect(Object.isFrozen(t.wad)).toBe(true);
  });

  it.each(["0", "-1", "+1", "1e2", " 1.3", "01.3", ".3", "1.", "1.3000000000000000001", "NaN", "Infinity"])("rejects invalid decimal ratio %s", warningRatio => {
    expect(() => parseThresholds({ warningRatio })).toThrow();
  });

  it.each([
    { warningRatio: 1.3 }, { unexpected: "1.3" }, [], null,
    { warningRatio: "1.1" }, { criticalRatio: "1.00" }, { criticalRatio: "0.99" },
    { criticalRatio: "1.30" }, { targetRatio: "1.10" }, { targetRatio: "0" },
    { liquidationBoundary: "0.95" }, { liquidationBoundary: "1.01" }, { targetRatio: (U256_MAX + 1n).toString() }
  ])("rejects malformed/incorrectly ordered configuration %#", overrides => {
    expect(() => parseThresholds(overrides)).toThrow();
  });

  it("allows a target between critical and warning, and rejects tampered fixed-point values", () => {
    const t = parseThresholds({ warningRatio: "1.5", criticalRatio: "1.2", targetRatio: "1.25" });
    expect(t.wad.targetRatio).toBeLessThan(t.wad.warningRatio);
    expect(() => validateThresholds({ ...t, wad: { ...t.wad, targetRatio: 0n } })).toThrow();
    expect(() => validateThresholds({ ...t, scale: 1n })).toThrow();
  });

  it("loads an explicit JSON file and gives CLI overrides precedence", async () => {
    const path = fileURLToPath(new URL("../config/risk-thresholds.example.json", import.meta.url));
    const t = await loadThresholds(path, { warningRatio: "1.60", targetRatio: "1.40" });
    expect(t.decimal).toEqual({ warningRatio: "1.60", criticalRatio: "1.10", targetRatio: "1.40", liquidationBoundary: "1.00" });
  });

  it("rejects a non-JSON or absent configuration file without reading another file", async () => {
    await expect(loadThresholds(".env")).rejects.toThrow(".json");
    await expect(loadThresholds("test/fixtures/absent-risk-config.json")).rejects.toThrow("readable");
  });

  it.each([
    [1_300_000_000_000_000_001n, "ABOVE_WARNING"],
    [1_300_000_000_000_000_000n, "WARNING"],
    [1_299_999_999_999_999_999n, "WARNING"],
    [1_100_000_000_000_000_000n, "CRITICAL"],
    [1_099_999_999_999_999_999n, "CRITICAL"],
    [1_000_000_000_000_000_000n, "LIQUIDATION_BOUNDARY"],
    [999_999_999_999_999_999n, "LIQUIDATION_BOUNDARY"],
    [0n, "LIQUIDATION_BOUNDARY"]
  ] as const)("classifies exact capacity %s / one-WAD debt as %s", (capacity, expected) => {
    expect(classifyMathematicalRisk(capacity, WAD, parseThresholds())).toBe(expected);
  });

  it("compares the exact ratio when its displayed WAD would round down to warning", () => {
    const debt = 100n * WAD;
    const capacity = 130n * WAD + 1n;
    expect(capacity * WAD / debt).toBe(parseThresholds().wad.warningRatio);
    expect(classifyMathematicalRisk(capacity, debt, parseThresholds())).toBe("ABOVE_WARNING");
  });

  it("honors custom thresholds and returns NO_DEBT only for actual zero debt", () => {
    const t = parseThresholds({ warningRatio: "2", criticalRatio: "1.5", targetRatio: "1.8" });
    expect(classifyMathematicalRisk(16n, 10n, t)).toBe("WARNING");
    expect(classifyMathematicalRisk(15n, 10n, t)).toBe("CRITICAL");
    expect(classifyMathematicalRisk(0n, 0n, t)).toBe("NO_DEBT");
  });

  it("rejects negative inputs and cross-product overflow", () => {
    expect(() => classifyMathematicalRisk(-1n, 1n, parseThresholds())).toThrow();
    expect(() => classifyMathematicalRisk(U256_MAX, 1n, parseThresholds())).toThrow();
    expect(() => classifyMathematicalRisk(1n, U256_MAX, parseThresholds())).toThrow();
  });

  it("gates the mathematical state with data quality, retaining STALE outside the state enum", () => {
    expect(effectiveRiskState("VALID", "ABOVE_WARNING")).toBe("ABOVE_WARNING");
    expect(effectiveRiskState("UNVERIFIED", "ABOVE_WARNING")).toBe("DATA_UNVERIFIED");
    expect(effectiveRiskState("STALE", "NO_DEBT")).toBe("DATA_UNVERIFIED");
    expect(effectiveRiskState("UNAVAILABLE", "ABOVE_WARNING")).toBe("DATA_UNAVAILABLE");
    expect(effectiveRiskState("INVALID", "NO_DEBT")).toBe("DATA_INVALID");
    expect(effectiveRiskState("VALID", null)).toBe("DATA_UNAVAILABLE");
  });
});
