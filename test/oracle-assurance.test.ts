import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { DEPLOYMENT } from "../src/config/deployment.js";
import type { Snapshot } from "../src/domain/types.js";
import { configurationChanges, configurationFingerprint, configurationFromSnapshot, IDENTITY_PINS, validateContractIdentity, verifyRuntimeBytecode } from "../src/oracle-assurance/configuration.js";
import { evaluateAssurance, evaluateRule, overallAssurance } from "../src/oracle-assurance/evaluate.js";
import { assuranceSchema, DIMENSIONS, evidenceRefSchema } from "../src/oracle-assurance/model.js";
import { REVIEWED_SOURCES } from "../src/oracle-assurance/reviewed.js";
import { calculateAssuredRisk } from "../src/risk/assured.js";
import { calculateRisk } from "../src/risk/engine.js";
import { riskFixture, testClock } from "./fixtures/phase4.js";

let base: Snapshot;
beforeAll(async () => { base = await riskFixture(); });
const evaluate = (raw: unknown) => evaluateAssurance(raw, { now: testClock() });
describe("FIXTURE: evidence-based oracle assurance and unchanged mathematics", () => {
  it("verifies only runtime identity and keeps missing economics, heartbeat and independence explicit", () => {
    const result = evaluate(base);
    expect(result).toMatchObject({ overall: "UNVERIFIED", gate: "DATA_UNVERIFIED", actionable: false,
      dimensions: { CONTRACT_IDENTITY: { state: "VERIFIED" }, SOURCE_PROVENANCE: { state: "UNVERIFIED" }, OPERATOR_PROVENANCE: { state: "UNVERIFIED" },
        PRICE_SEMANTICS: { state: "PARTIALLY_VERIFIED" }, FRESHNESS: { state: "UNKNOWN" }, INDEPENDENT_VALIDATION: { state: "UNKNOWN" } } });
    expect(result.findings.every(finding => finding.evidence.length && finding.subjectAddress)).toBe(true);
    expect(Object.isFrozen(result.dimensions)).toBe(true);
  });
  it("preserves every Phase 2 financial value and gates recovery estimates identically on both paths", () => {
    const before = calculateRisk(base, undefined, { calculatedAt: testClock() });
    const after = calculateAssuredRisk(base, evaluate(base), undefined, { calculatedAt: testClock() });
    for (const field of ["collateralAmount", "collateralValue", "debtAmount", "liquidationCapacity", "ltv", "safetyRatio", "oraclePrice", "mathematicalRiskState"] as const) expect(after[field]).toEqual(before[field]);
    // Both paths are gate-blocked with unverified assurance: no amounts on either side.
    expect(after.repayment).toBeNull();
    expect(after.additionalCollateral).toBeNull();
    expect(before.repayment).toBeNull();
    expect(before.additionalCollateral).toBeNull();
    expect(after.recoveryEligibility).toMatchObject({ status: "BLOCKED", reasonCodes: expect.arrayContaining(["RECOVERY_ORACLE_ASSURANCE_NOT_VERIFIED", "RECOVERY_CHAIN_PROGRESSION_UNKNOWN"]) });
    expect(after.actionability).toMatchObject({ actionable: false, status: "INDICATIVE_ONLY" });
    expect(base.oracle.policy.sourceVerified).toBe(false);
  });
  it.each(IDENTITY_PINS)("detects a changed runtime for $address", pin => {
    const snapshot = structuredClone(base), contract = snapshot.contracts.find(item => item.address.toLowerCase() === pin.address.toLowerCase())!;
    contract.sha256 = "a".repeat(64);
    expect(validateContractIdentity(snapshot)).toBe("FAILED");
    expect(calculateAssuredRisk(snapshot, evaluate(snapshot), undefined, { calculatedAt: testClock() })).toMatchObject({ riskState: "DATA_INVALID", repayment: null, additionalCollateral: null });
  });
  it("requires both bytecode hashes and nonempty code", () => {
    const pin = IDENTITY_PINS[2]!, archived = JSON.parse(readFileSync("test/fixtures/runtime.json", "utf8")) as { code: Record<string, `0x${string}`> };
    expect(verifyRuntimeBytecode(archived.code[pin.address.toLowerCase()]!, pin).verified).toBe(true);
    expect(verifyRuntimeBytecode("0x6000", pin).verified).toBe(false);
    expect(verifyRuntimeBytecode("0x", pin).verified).toBe(false);
    expect(verifyRuntimeBytecode(archived.code[pin.address.toLowerCase()]!, { ...pin, sha256: "0".repeat(64) }).verified).toBe(false);
  });
  it.each(["market", "oracle", "block", "chain", "source"])("rejects mismatched %s identity", kind => {
    const snapshot = structuredClone(base);
    if (kind === "market") snapshot.params!.lltv += 1n;
    if (kind === "oracle") snapshot.oracle.address = DEPLOYMENT.morpho;
    if (kind === "block") snapshot.contracts[0]!.blockNumber += 1n;
    if (kind === "chain") snapshot.network.chainId = 1;
    if (kind === "source") snapshot.contracts.find(item => item.address === DEPLOYMENT.oracle)!.mcpMatchesRpc = false;
    expect(evaluate(snapshot).gate).toBe("DATA_INVALID");
  });
  it.each([0n, -1n, 2n ** 256n])("fails closed on invalid selected price %s", price => {
    const snapshot = structuredClone(base); snapshot.oracle.price = price;
    expect(calculateAssuredRisk(snapshot, evaluate(snapshot), undefined, { calculatedAt: testClock() })).toMatchObject({ riskState: "DATA_INVALID", repayment: null, additionalCollateral: null });
  });
  it("distinguishes unavailable input from malformed data and does not substitute zero", async () => {
    expect(evaluate(null).gate).toBe("DATA_UNAVAILABLE");
    expect(evaluate({ price: "0" }).gate).toBe("DATA_INVALID");
    const unavailable = await riskFixture({ unavailableCall: true });
    expect(calculateAssuredRisk(unavailable, evaluate(unavailable), undefined, { calculatedAt: testClock() })).toMatchObject({ riskState: "DATA_UNAVAILABLE", repayment: null, debtAmount: null });
  });
  it("rejects assurance bound to a different snapshot or a substituted selected price", () => {
    const changed = structuredClone(base); changed.retrievedAt = "2026-11-01T14:04:59.000Z";
    expect(calculateAssuredRisk(changed, evaluate(base), undefined, { calculatedAt: testClock() }).repayment).toBeNull();
    const proof = structuredClone(evaluate(base)); proof.independent.morphoPrice = "1";
    expect(calculateAssuredRisk(base, proof, undefined, { calculatedAt: testClock() }).riskState).toBe("DATA_INVALID");
  });
  it("does not trust caller verification flags or partial requirements", () => {
    const snapshot = structuredClone(base);
    Object.assign(snapshot.oracle.policy, { sourceVerified: true, heartbeatVerified: true, heartbeatSeconds: 1n, operatorIdentityVerified: true });
    expect(evaluate(snapshot).overall).toBe("UNVERIFIED");
    expect(evaluateRule("TEST", ["SOURCE", "OPERATOR"], ["SOURCE"], ["SOURCE_PROVENANCE"]).state).toBe("PARTIALLY_VERIFIED");
    const dimensions = structuredClone(evaluate(base).dimensions);
    for (const dimension of DIMENSIONS) dimensions[dimension].state = "VERIFIED";
    expect(overallAssurance(dimensions, true)).toBe("UNVERIFIED");
    dimensions.SOURCE_PROVENANCE.state = "UNKNOWN"; expect(overallAssurance(dimensions)).toBe("UNVERIFIED");
  });
  it("rejects forged state promotion and unauthenticated finding references", () => {
    const proof = structuredClone(evaluate(base)); proof.overall = "VERIFIED";
    expect(assuranceSchema.safeParse(proof).success).toBe(false);
    const missing = structuredClone(evaluate(base)); missing.dimensions.CONTRACT_IDENTITY.findingIds = ["NO_SUCH_EVIDENCE"];
    expect(assuranceSchema.safeParse(missing).success).toBe(false);
    expect(evidenceRefSchema.safeParse({ ...REVIEWED_SOURCES[0], source: "https://example.test/?token=synthetic" }).success).toBe(false);
  });
  it("fingerprints casing consistently but detects all economic and control fields", () => {
    const config = configurationFromSnapshot(base), lower = { ...config, oracle: config.oracle.toLowerCase() };
    expect(configurationFingerprint(lower)).toBe(configurationFingerprint(config));
    expect(configurationChanges(config, { ...config, feedId: `0x${"11".repeat(32)}`, proxyOwner: DEPLOYMENT.morpho, feedDecimals: 6 }))
      .toEqual(["ORACLE_OWNER_CHANGED", "ORACLE_FEED_ID_CHANGED", "ORACLE_DENOMINATION_CHANGED"]);
  });
});
