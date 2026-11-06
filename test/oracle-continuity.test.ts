import { rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { DEPLOYMENT } from "../src/config/deployment.js";
import { parseThresholds } from "../src/config/risk.js";
import { demoPositionConfiguration } from "../src/config/position.js";
import type { Snapshot } from "../src/domain/types.js";
import { stringify } from "../src/domain/serialize.js";
import { initialState, observationSchema, riskView } from "../src/monitoring/model.js";
import type { Observation } from "../src/monitoring/model.js";
import { observe } from "../src/monitoring/observation.js";
import { MonitoringService } from "../src/monitoring/service.js";
import { transition } from "../src/monitoring/transitions.js";
import { evaluateAssurance } from "../src/oracle-assurance/evaluate.js";
import { sha256 } from "../src/oracle-assurance/evidence.js";
import { compareIndependent } from "../src/oracle-assurance/independent.js";
import { assuranceSchema } from "../src/oracle-assurance/model.js";
import type { OracleAssurance } from "../src/oracle-assurance/model.js";
import { calculateAssuredRisk } from "../src/risk/assured.js";
import { MonitorStore } from "../src/storage/store.js";
import { advanceSnapshot, supplementalFixture } from "./fixtures/assurance.js";
import { candidateFixture } from "./fixtures/independent.js";
import { riskFixture, temporaryMonitorDirectory, testClock, MONITOR_CONFIG, MONITOR_THRESHOLDS, MONITOR_SCOPE, persistFixture } from "./fixtures/phase4.js";

let base: Snapshot;
const directory = temporaryMonitorDirectory();
beforeAll(async () => { base = await riskFixture(); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
const evaluate = (snapshot: Snapshot, previous?: OracleAssurance) => evaluateAssurance(snapshot,
  { now: new Date(snapshot.retrievedAt), supplemental: supplementalFixture(snapshot), ...(previous ? { previous } : {}) });
const observation = (snapshot: Snapshot, id: string, previousAssurance?: OracleAssurance) => observe(snapshot, id, new Date(snapshot.retrievedAt), MONITOR_THRESHOLDS,
  { allowFixture: true, supplemental: supplementalFixture(snapshot), ...(previousAssurance ? { previousAssurance } : {}) });

describe("FIXTURE: configuration continuity, persistent oracle alerts and restart safety", () => {
  it.each(["proxyOwner", "feedId", "description"] as const)("invalidates established assurance on %s changes and never self-restores", field => {
    const before = evaluate(base), changed = advanceSnapshot(base);
    if (field === "proxyOwner") changed.oracle.proxyOwner = DEPLOYMENT.morpho;
    if (field === "feedId") changed.oracle.feedId = `0x${"11".repeat(32)}`;
    if (field === "description") changed.oracle.description = "Changed denomination claim";
    const result = evaluate(changed, before);
    expect(result.evidenceInvalidated).toBe(true); expect(result.invalidationReason).toBe("CONFIGURATION_CHANGE");
    expect(result.dimensions.CONTRACT_IDENTITY.state).not.toBe("VERIFIED");
    const returned = evaluate(advanceSnapshot(base, 2n), result);
    expect(returned.evidenceInvalidated).toBe(true); expect(returned.invalidatedAt).toBe(result.invalidatedAt);
    expect(returned.overall).not.toBe("VERIFIED");
  });
  it("retains the old separately bound baseline through missing data and catches changes after recovery", () => {
    const before = evaluate(base);
    const gap = evaluateAssurance(null, { now: testClock(), previous: before });
    expect(gap).toMatchObject({ gate: "DATA_UNAVAILABLE", block: null, configuration: null, evidenceInvalidated: true, invalidationReason: "OBSERVABILITY_GAP" });
    expect(gap.baseline).toEqual(before.baseline);
    const changed = advanceSnapshot(base); changed.oracle.proxyOwner = DEPLOYMENT.morpho;
    const recovered = evaluate(changed, gap);
    expect(recovered.changes).toContain("ORACLE_OWNER_CHANGED"); expect(recovered.baseline?.block.number).toBe(changed.block!.number.toString());
    expect(recovered.evidenceInvalidated).toBe(true);
  });
  it("invalidates when signer/implementation observability or history coverage is lost", () => {
    const before = evaluate(base), snapshot = advanceSnapshot(base);
    const unavailable = supplementalFixture(snapshot); unavailable.status = "UNAVAILABLE";
    expect(evaluateAssurance(snapshot, { now: new Date(snapshot.retrievedAt), previous: before, supplemental: unavailable }))
      .toMatchObject({ gate: "DATA_UNAVAILABLE", evidenceInvalidated: true, baseline: before.baseline });
    const distant = advanceSnapshot(base, 8_001n), result = evaluate(distant, before);
    expect(result.invalidationReason).toBe("OBSERVABILITY_GAP"); expect(result.overall).not.toBe("VERIFIED");
  });
  it("detects transient configuration events even when current storage returns to its prior value", () => {
    const before = evaluate(base), snapshot = advanceSnapshot(base), supplemental = supplementalFixture(snapshot);
    supplemental.events.push({ code: "ORACLE_SIGNER_CONFIGURATION_CHANGED", address: DEPLOYMENT.cache, blockNumber: snapshot.block!.number.toString(),
      blockHash: snapshot.block!.hash, transactionHash: `0x${"12".repeat(32)}`, logIndex: "0" });
    const result = evaluateAssurance(snapshot, { now: new Date(snapshot.retrievedAt), previous: before, supplemental });
    expect(result.configurationFingerprint).toBe(before.configurationFingerprint);
    expect(result).toMatchObject({ changes: ["ORACLE_SIGNER_CONFIGURATION_CHANGED"], evidenceInvalidated: true });
  });
  it("detects sampled signer and implementation changes without treating unknown configuration as complete", () => {
    const snapshot = advanceSnapshot(base), before = supplementalFixture(base), after = supplementalFixture(snapshot);
    before.signerSets = [{ configId: "1", f: 1, signers: [DEPLOYMENT.oracle, DEPLOYMENT.feed, DEPLOYMENT.cache, DEPLOYMENT.morpho] }];
    before.configuration.signerConfigurationHash = sha256(stringify(before.signerSets)); before.configuration.signerCoverage = "SAMPLED_ACTIVE_CONFIGS";
    after.signerSets = structuredClone(before.signerSets); after.signerSets[0]!.signers[3] = DEPLOYMENT.collateralToken;
    after.configuration.signerConfigurationHash = sha256(stringify(after.signerSets)); after.configuration.signerCoverage = "SAMPLED_ACTIVE_CONFIGS";
    after.configuration.proxyImplementation = DEPLOYMENT.oracle;
    const prior = evaluateAssurance(base, { now: testClock(), supplemental: before });
    const result = evaluateAssurance(snapshot, { now: new Date(snapshot.retrievedAt), previous: prior, supplemental: after });
    expect(result.changes).toEqual(expect.arrayContaining(["PROXY_IMPLEMENTATION_CHANGED", "ORACLE_SIGNER_CONFIGURATION_CHANGED"]));
    expect(result.dimensions.CONFIGURATION_CONTROL.state).not.toBe("VERIFIED");
  });
  it("rejects backwards/conflicting blocks and retains the known baseline", () => {
    const snapshot = advanceSnapshot(base), before = evaluate(snapshot);
    const backwards = evaluate(base, before);
    expect(backwards).toMatchObject({ gate: "DATA_INVALID", evidenceInvalidated: true, baseline: before.baseline });
    const conflicting = structuredClone(snapshot); conflicting.block!.hash = `0x${"ab".repeat(32)}`;
    expect(evaluate(conflicting, before).gate).toBe("DATA_INVALID");
  });
  it("keeps historical block scopes separate from live continuity", () => {
    const live = structuredClone(base); live.evidenceKind = "LIVE_CHAIN_READ";
    const before = evaluate(live), historical = structuredClone(base); historical.evidenceKind = "HISTORICAL_SNAPSHOT";
    const result = evaluate(historical, before);
    expect(result.continuityScope).toBe(`HISTORICAL-${base.block!.number}`); expect(result.evidenceInvalidated).toBe(false);
  });
  it.each([null, {}, { block: { number: "bad" }, limitations: ["secret=synthetic"] }])("rejects malformed supplemental results without retaining their text", supplemental => {
    const result = evaluateAssurance(base, { now: testClock(), supplemental });
    expect(result.gate).toBe("DATA_INVALID"); expect(stringify(result)).not.toContain("secret=synthetic");
  });
  it("deduplicates configuration alerts through a SQLite restart and persists the invalidation latch", () => {
    const path = join(directory, "restart.sqlite"); let store = new MonitorStore(path); store.acquireMonitor();
    const first = observation(base, "initial"); persistFixture(store, first);
    const changed = advanceSnapshot(base); changed.oracle.proxyOwner = DEPLOYMENT.morpho;
    const second = observation(changed, "changed", first.assurance), alerts = persistFixture(store, second);
    expect(alerts.map(alert => alert.code)).toEqual(expect.arrayContaining(["ORACLE_OWNER_CHANGED", "ORACLE_ASSURANCE_INVALIDATED", "ORACLE_ASSURANCE_DETERIORATED"]));
    store.close(); store = new MonitorStore(path); store.acquireMonitor();
    try {
      const persisted = store.latestOracleAssurance("FIXTURE")!.assurance;
      expect(persisted).toEqual(second.assurance);
      const third = observation(advanceSnapshot(changed), "restart", persisted);
      expect(persistFixture(store, third).filter(alert => alert.code.startsWith("ORACLE_ASSURANCE") || alert.code === "ORACLE_OWNER_CHANGED")).toHaveLength(0);
      expect(store.alerts().filter(alert => alert.code === "ORACLE_OWNER_CHANGED")).toHaveLength(1);
      expect(store.state(MONITOR_SCOPE).assuranceBaseline?.evidenceInvalidated).toBe(true);
      expect(store.deliveries().length).toBeGreaterThan(0);
    } finally { store.close(); }
  });
  it("persists timestamp deterioration and improvement alerts while preserving unknown freshness", () => {
    const first = observation(base, "start"), old = transition(initialState(), first, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    const malformed = advanceSnapshot(base); malformed.oracle.round!.updatedAt = malformed.block!.timestamp + 1n;
    const bad = observation(malformed, "future", first.assurance), second = transition(old.state, bad, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    expect(second.alerts.map(alert => alert.code)).toEqual(expect.arrayContaining(["ORACLE_TIMESTAMP_ANOMALY", "ORACLE_ASSURANCE_DETERIORATED"]));
    expect(bad.risk.repayment).toBeNull();
    const third = observation(advanceSnapshot(base, 2n), "restored", bad.assurance);
    const result = transition(second.state, third, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    expect(result.alerts.map(alert => alert.code)).toContain("ORACLE_ASSURANCE_IMPROVED");
    expect(third.assurance?.freshness.state).toBe("UNKNOWN"); expect(third.risk.actionable).toBe(false);
  });
  it("blocks recovery on a qualified fixture disagreement, keeps the Morpho price, and emits one disagreement alert", () => {
    const first = observation(base, "first"), before = transition(initialState(), first, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    const proof = structuredClone(first.assurance!), candidate = candidateFixture(); candidate.timestamp = base.oracle.round!.updatedAt.toString(); candidate.price = (2n * 10n ** 18n).toString();
    proof.independent = compareIndependent({ candidate, base: candidate.base, quote: candidate.quote, morphoPrice: base.oracle.price!,
      blockTimestamp: base.block!.timestamp, selectedTimestamp: base.oracle.round!.updatedAt, selectedUpstreamId: "selected_fixture_upstream",
      toleranceBps: 100, maxAgeSeconds: 10_000n, maxSkewSeconds: 0n, fixture: true });
    proof.dimensions.INDEPENDENT_VALIDATION.state = "FAILED"; proof.overall = "FAILED"; proof.gate = "DATA_INVALID";
    const checked = assuranceSchema.parse(proof), risk = calculateAssuredRisk(base, checked, undefined, { calculatedAt: testClock() });
    expect(risk).toMatchObject({ riskState: "DATA_INVALID", repayment: null, additionalCollateral: null, oraclePrice: base.oracle.price });
    const current: Observation = { cycleId: "disagreement", observedAt: base.retrievedAt, accepted: false, assurance: checked, risk: riskView(risk), diagnostics: [] };
    const second = transition(before.state, current, MONITOR_CONFIG.monitoring, MONITOR_SCOPE);
    expect(second.alerts.filter(alert => alert.code === "INDEPENDENT_PRICE_DISAGREEMENT")).toHaveLength(1);
    expect(transition(second.state, { ...current, cycleId: "repeat" }, MONITOR_CONFIG.monitoring, MONITOR_SCOPE).alerts.filter(alert => alert.code === "INDEPENDENT_PRICE_DISAGREEMENT")).toHaveLength(0);
  });
  it("rejects monitoring observations whose assurance or blocked estimates are mismatched", () => {
    const current = observation(base, "bound"); current.assurance = evaluate(advanceSnapshot(base));
    expect(observationSchema.safeParse(current).success).toBe(false);
  });
  it("refuses a cleared invalidation latch, missing baseline and reversed evaluation clock at the persistence boundary", () => {
    const store = new MonitorStore(":memory:"); store.acquireMonitor();
    try {
      const first = evaluate(base); store.saveOracleAssurance("first", first);
      const changed = advanceSnapshot(base); changed.oracle.proxyOwner = DEPLOYMENT.morpho;
      const invalidated = evaluate(changed, first); store.saveOracleAssurance("changed", invalidated);
      expect(() => store.saveOracleAssurance("cleared", evaluate(advanceSnapshot(changed)))).toThrow();
      expect(() => store.saveOracleAssurance("missing", { ...invalidated, baseline: null })).toThrow();
      expect(() => store.saveOracleAssurance("clock", { ...invalidated, evaluatedAt: base.retrievedAt })).toThrow();
      expect(store.latestOracleAssurance()?.id).toBe("changed");
    } finally { store.close(); }
  });
  it("fails closed when a persisted assurance hash is corrupted", () => {
    const path = join(directory, "corrupt.sqlite"), store = new MonitorStore(path); store.acquireMonitor();
    store.saveOracleAssurance("original", evaluate(base)); store.close();
    const db = new DatabaseSync(path); db.prepare("UPDATE oracle_assurance SET result_sha256=?").run("0".repeat(64)); db.close();
    expect(() => new MonitorStore(path)).toThrow(/validation/);
  });
  it("seeds shared assurance across changed threshold streams after restart", async () => {
    const path = join(directory, "thresholds.sqlite"), firstStore = new MonitorStore(path); firstStore.acquireMonitor();
    const first = evaluate(base), changed = advanceSnapshot(base); changed.oracle.proxyOwner = DEPLOYMENT.morpho;
    const invalidated = evaluate(changed, first); firstStore.saveOracleAssurance("shared", invalidated); firstStore.close();
    const snapshot = advanceSnapshot(changed), store = new MonitorStore(path);
    const thresholds = parseThresholds({ targetRatio: "1.31" });
    const service = new MonitoringService({ store, configuration: MONITOR_CONFIG, thresholds, position: demoPositionConfiguration(thresholds),
      read: async () => snapshot, supplemental: async () => supplementalFixture(snapshot), allowFixture: true, adapters: [], now: () => new Date(snapshot.retrievedAt), id: () => "new_stream" });
    try { const result = await service.runOnce(); expect(result).toMatchObject({ observation: { assurance: { evidenceInvalidated: true, invalidatedAt: invalidated.invalidatedAt } } }); }
    finally { await service.shutdown(); }
  });
  it("retains latest continuity and immutable audit references during pruning", () => {
    const store = new MonitorStore(":memory:"); store.acquireMonitor();
    try {
      const first = evaluate(base); store.saveOracleAssurance("archived", first, { path: "evidence/phase4/oracle-audit-fixture", manifestSha256: "a".repeat(64) });
      const second = evaluate(advanceSnapshot(base), first); store.saveOracleAssurance("latest", second);
      store.prune("2027-01-01T00:00:00.000Z", 1, 1);
      expect(store.latestOracleAssurance("FIXTURE")?.assurance).toEqual(second);
    } finally { store.close(); }
  });
});
