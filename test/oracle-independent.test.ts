import { describe, expect, it } from "vitest";
import { DEPLOYMENT } from "../src/config/deployment.js";
import { compareIndependent, normalizePrice } from "../src/oracle-assurance/independent.js";
import { independentSchema } from "../src/oracle-assurance/model.js";
import { evaluateAssurance } from "../src/oracle-assurance/evaluate.js";
import { candidateFixture } from "./fixtures/independent.js";
import { riskFixture, testClock } from "./fixtures/phase4.js";

const compare = (candidate: unknown = candidateFixture(), overrides: Partial<Parameters<typeof compareIndependent>[0]> = {}) => {
  const source = candidateFixture();
  return compareIndependent({ candidate, base: source.base, quote: source.quote, morphoPrice: 10n ** 24n, blockTimestamp: 10_000n,
    selectedTimestamp: 9_000n, selectedUpstreamId: "selected_upstream", toleranceBps: 100, maxAgeSeconds: 1_000n, maxSkewSeconds: 100n, fixture: true, ...overrides });
};
describe("FIXTURE: qualified independent validation and exact price units", () => {
  it("normalizes Morpho and whole-token prices to the same economic rational without replacing either", () => {
    expect(compare()).toMatchObject({ eligible: true, state: "VERIFIED", disagrees: false, morphoPrice: (10n ** 24n).toString(), independentPrice: (10n ** 18n).toString(),
      normalizedMorpho: { numerator: "1", denominator: "1" }, normalizedIndependent: { numerator: "1", denominator: "1" } });
    expect(normalizePrice(10n ** 24n, 36, 18, 6, "QUOTE_BASE_UNITS_PER_BASE_UNIT")).toEqual({ numerator: 1n, denominator: 1n });
  });
  it("uses an exact inclusive tolerance boundary, including one raw unit above it", () => {
    const candidate = candidateFixture(); candidate.price = (101n * 10n ** 16n).toString();
    expect(compare(candidate).disagrees).toBe(false);
    candidate.price = (BigInt(candidate.price) + 1n).toString();
    expect(compare(candidate)).toMatchObject({ state: "FAILED", disagrees: true, eligible: true });
  });
  it.each(["asset", "chain", "quote", "redemption", "operator", "upstream", "frequency", "proof", "rpc"])("refuses unqualified %s metadata", kind => {
    const candidate = candidateFixture();
    if (kind === "asset") candidate.base.address = DEPLOYMENT.loanToken;
    if (kind === "chain") candidate.base.chainId = 1;
    if (kind === "quote") candidate.quote.address = DEPLOYMENT.collateralToken;
    if (kind === "redemption") candidate.kind = "REDEMPTION_RATE";
    if (kind === "operator") candidate.operatorId = null;
    if (kind === "upstream") candidate.upstreamId = "selected_upstream";
    if (kind === "frequency") candidate.frequencySeconds = null;
    if (kind === "proof") candidate.proofs[0]!.evidence.subjectAddress = DEPLOYMENT.morpho;
    if (kind === "rpc") candidate.proofs.forEach(proof => { proof.evidence.sourceKind = "RPC"; });
    expect(compare(candidate).eligible).toBe(false);
    expect(compare(candidate).normalizedIndependent).toBeNull();
  });
  it("requires local temporal bounds and exact alignment without calling them upstream guarantees", () => {
    const candidate = candidateFixture(); candidate.timestamp = "8899";
    expect(compare(candidate).reasons).toEqual(expect.arrayContaining(["CANDIDATE_TOO_OLD_FOR_COMPARISON", "OBSERVATIONS_NOT_ALIGNED"]));
    const result = compareIndependent({ candidate: candidateFixture(), base: candidate.base, quote: candidate.quote, morphoPrice: 10n ** 24n, blockTimestamp: 10_000n });
    expect(result.reasons).toContain("TEMPORAL_POLICY_UNCONFIGURED"); expect(result.eligible).toBe(false);
  });
  it.each(["0", "-1", "1.5", (2n ** 256n).toString(), null])("fails closed on invalid candidate price %s", price => {
    expect(compare({ ...candidateFixture(), price })).toMatchObject({ state: "FAILED", eligible: false });
  });
  it("classifies a timeout as unavailable, and future observation times as invalid", () => {
    expect(compare({ ...candidateFixture(), availability: "UNAVAILABLE", price: null })).toMatchObject({ availability: "UNAVAILABLE", state: "UNKNOWN", eligible: false });
    expect(compare({ ...candidateFixture(), timestamp: "10001" })).toMatchObject({ state: "FAILED", eligible: false });
    expect(compare(candidateFixture(), { morphoPrice: null }).reasons).toContain("SELECTED_SOURCE_UNAVAILABLE");
  });
  it.each(["price", "units", "time", "deviation", "proof", "state"])("rejects tampered retained %s comparison", kind => {
    const result = compare();
    if (kind === "price") result.morphoPrice = "1";
    if (kind === "units") result.normalizedIndependent!.numerator = "2";
    if (kind === "time") result.candidateAgeSeconds = "1";
    if (kind === "deviation") result.deviationBps = "1/1";
    if (kind === "proof") result.candidate!.proofs = [];
    if (kind === "state") result.state = "UNKNOWN";
    expect(independentSchema.safeParse(result).success).toBe(false);
  });
  it("handles wide integer units without float rounding or uint256 intermediate truncation", () => {
    const normalized = normalizePrice((2n ** 256n) - 1n, 77, 77, 0, "QUOTE_BASE_UNITS_PER_BASE_UNIT");
    expect(normalized).toEqual({ numerator: (2n ** 256n) - 1n, denominator: 1n });
    expect(() => normalizePrice(1n, 78, 18, 6, "WHOLE_QUOTE_PER_WHOLE_BASE")).toThrow();
  });
  it("cannot promote the production oracle using self-asserted candidate documents or fixture independence", async () => {
    const candidate = candidateFixture(), snapshot = await riskFixture(); candidate.timestamp = snapshot.oracle.round!.updatedAt.toString();
    const result = evaluateAssurance(snapshot, { now: testClock(), independentCandidate: candidate, independentToleranceBps: 100, independentMaxAgeSeconds: 10_000n, independentMaxSkewSeconds: 100n });
    expect(result.independent.reasons).toContain("INDEPENDENCE_UNESTABLISHED"); expect(result.overall).toBe("UNVERIFIED");
    expect(compare(candidateFixture(), { fixture: false }).eligible).toBe(false);
  });
});
