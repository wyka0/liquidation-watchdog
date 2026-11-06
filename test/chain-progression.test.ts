import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataError } from "../src/domain/errors.js";
import type { Snapshot } from "../src/domain/types.js";
import { evaluateChainProgression, evaluateObservedProgression, persistedProgression, progressionSchema,
  STALL_WINDOW_OBSERVATIONS } from "../src/chain/progression.js";
import type { ObservedProgressionEvidence } from "../src/chain/progression.js";
import { calculateAssuredRisk } from "../src/risk/assured.js";
import { MonitoringService } from "../src/monitoring/service.js";
import type { CycleResult, ServiceOptions } from "../src/monitoring/service.js";
import { observe } from "../src/monitoring/observation.js";
import { MonitorStore } from "../src/storage/store.js";
import type { FixtureOverrides } from "./fixtures/clients.js";
import { MONITOR_CONFIG, MONITOR_POSITION, MONITOR_SCOPE, MONITOR_THRESHOLDS, temporaryMonitorDirectory, testClock } from "./fixtures/monitoring.js";
import { monitoringFixture, riskFixture } from "./fixtures/phase4.js";
import { verifiedAssuranceFixture } from "./fixtures/recovery.js";
import * as f from "./fixtures/state.js";

const BLOCK = f.historicalBlock, hash = (byte: string) => `0x${byte.repeat(32)}`;
const baseline = { blockNumber: 100n, blockHash: hash("ab"), blockTimestamp: 1_000n, sameBlockStreak: 0 };
const observed = (overrides: Partial<ObservedProgressionEvidence> = {}): ObservedProgressionEvidence =>
  ({ blockNumber: 105n, blockHash: hash("cd"), blockTimestamp: 1_300n, headRpc: 112n, headMcp: 110n,
    chainIdRpc: 1672n, chainIdMcp: 1672n, ...overrides });
const evaluate = (overrides: Partial<ObservedProgressionEvidence> = {}) =>
  evaluateObservedProgression({ baseline, observed: observed(overrides) });

describe("FIXTURE: observed chain-progression evaluation from real block evidence", () => {
  it("marks a first observation UNKNOWN without ever fabricating advancement", () => {
    const result = evaluateObservedProgression({ baseline: null, observed: observed() });
    expect(result).toMatchObject({ state: "UNKNOWN", reason: "FIRST_OBSERVATION", sameBlockStreak: 0,
      blockNumber: 105n, headNumber: 110n });
    expect(result.advancedBlocks).toBeNull();
  });

  it("treats missing snapshot evidence as UNKNOWN with no block claims", () => {
    expect(evaluateObservedProgression({ baseline, observed: null })).toMatchObject({
      state: "UNKNOWN", reason: "NO_SNAPSHOT_EVIDENCE", blockNumber: null, blockHash: null, headNumber: null, sameBlockStreak: 0 });
  });

  it("advances only on a strictly higher cross-checked block and records the exact distance", () => {
    expect(evaluate()).toEqual({ state: "ADVANCING", reason: null, advancedBlocks: 5n, blockNumber: 105n, blockHash: hash("cd"),
      blockTimestamp: 1_300n, headNumber: 110n, baselineBlockNumber: 100n, baselineBlockHash: hash("ab"), sameBlockStreak: 0 });
  });

  it("counts same-block rereads in a bounded window and stalls only beyond it", () => {
    const unchanged = evaluate({ blockNumber: 100n, blockHash: hash("ab"), blockTimestamp: 1_000n });
    expect(unchanged).toMatchObject({ state: "UNCHANGED_WITHIN_WINDOW", reason: "SAME_BLOCK_RE_READ", advancedBlocks: 0n,
      sameBlockStreak: 1, headNumber: 110n });
    expect(evaluateObservedProgression({ baseline: { ...baseline, sameBlockStreak: STALL_WINDOW_OBSERVATIONS },
      observed: observed({ blockNumber: 100n, blockHash: hash("ab"), blockTimestamp: 1_000n }) })).toMatchObject({
      state: "STALLED", reason: "STALL_WINDOW_EXCEEDED", advancedBlocks: 0n, sameBlockStreak: STALL_WINDOW_OBSERVATIONS + 1 });
  });

  it.each([
    ["block regression", { blockNumber: 99n }, "REGRESSED", "BLOCK_NUMBER_REGRESSION"],
    ["timestamp regression", { blockTimestamp: 999n }, "REGRESSED", "BLOCK_TIMESTAMP_REGRESSION"],
    ["same-height hash conflict", { blockNumber: 100n, blockHash: hash("ef"), blockTimestamp: 1_000n }, "CONFLICT", "SAME_HEIGHT_HASH_CONFLICT"]
  ] as const)("classifies %s without using retrieval age", (_name, overrides, state, reason) => {
    const result = evaluate(overrides);
    expect(result).toMatchObject({ state, reason, sameBlockStreak: 0, baselineBlockNumber: 100n });
    expect(result.advancedBlocks).toBeNull();
  });

  it.each([
    ["a missing provider head", { headMcp: null }, "MISSING_PROVIDER_HEAD"],
    ["a provider head below the selected block", { headRpc: 99n, headMcp: 104n }, "PROVIDER_HEAD_BELOW_SELECTED_BLOCK"],
    ["a wrong chain identity on RPC", { chainIdRpc: 1n }, "CHAIN_ID_MISMATCH"],
    ["conflicting observed chain identities", { chainIdMcp: 1n }, "CHAIN_ID_MISMATCH"],
    ["malformed block identity", { blockHash: "not-a-hash" }, "INVALID_BLOCK_EVIDENCE"]
  ] as const)("fails closed as UNKNOWN on %s", (_name, overrides, reason) => {
    const result = evaluate(overrides);
    expect(result).toMatchObject({ state: "UNKNOWN", reason, sameBlockStreak: 0 });
    expect(result.advancedBlocks).toBeNull();
  });

  it("records the cross-checked head lower bound as min(RPC, MCP)", () => {
    expect(evaluate({ headRpc: 130n, headMcp: 118n })).toMatchObject({ state: "ADVANCING", headNumber: 118n });
  });

  it("records malformed identity without leaking unverifiable block fields", () => {
    const result = evaluate({ blockNumber: 0n });
    expect(result).toMatchObject({ state: "UNKNOWN", reason: "INVALID_BLOCK_EVIDENCE", blockNumber: null, blockHash: null });
  });

  it("serializes progression for the observation schema with exact decimal text", () => {
    const persisted = persistedProgression(evaluate(), testClock());
    expect(progressionSchema.parse(persisted)).toEqual(persisted);
    expect(persisted).toMatchObject({ state: "ADVANCING", advancedBlocks: "5", blockNumber: "105", blockTimestamp: "1300",
      headNumber: "110", baselineBlockNumber: "100", baselineBlockHash: hash("ab"), sameBlockStreak: 0 });
    expect(persisted.evaluatedAt).toBe(testClock().toISOString());
  });

  it("preserves the 12B comparator contract between two cross-checked reads", () => {
    const previous = { blockNumber: 100n, blockHash: hash("ab"), blockTimestamp: 1_000n, headNumber: 105n };
    expect(evaluateChainProgression(previous, { blockNumber: 103n, blockHash: hash("cd"), blockTimestamp: 1_200n, headNumber: 108n }))
      .toEqual({ state: "ADVANCING", advancedBlocks: 3n, reason: null });
    expect(evaluateChainProgression(previous, { ...previous, headNumber: 104n }))
      .toEqual({ state: "REGRESSED", advancedBlocks: null, reason: "PROVIDER_HEAD_REGRESSION" });
    expect(evaluateChainProgression(previous, { blockNumber: 100n, blockHash: hash("cd"), blockTimestamp: 1_000n, headNumber: 105n }))
      .toEqual({ state: "CONFLICT", advancedBlocks: null, reason: "SAME_HEIGHT_HASH_CONFLICT" });
    expect(() => evaluateChainProgression(previous, { blockNumber: 0n, blockHash: hash("cd"), blockTimestamp: 1_200n, headNumber: null })).toThrow();
  });
});

// Lifecycle fixtures: each cycle reads a fresh synthetic snapshot through the same phase-4 fixture
// clients; overrides rotate per cycle and the final override repeats for any further cycles.
function rotatingRead(overrides: readonly FixtureOverrides[] = []): () => Promise<Snapshot> {
  let index = 0;
  return async () => riskFixture(overrides[Math.min(index++, overrides.length - 1)] ?? {});
}

function lifecycleHarness(read: () => Promise<Snapshot>, overrides: Partial<ServiceOptions> = {}) {
  const store = overrides.store ?? new MonitorStore(":memory:");
  let sequence = 0;
  const service = new MonitoringService({ store, configuration: MONITOR_CONFIG, thresholds: MONITOR_THRESHOLDS, position: MONITOR_POSITION,
    adapters: [{ channel: "console", send: async () => ({ delivered: true as const }) }], read,
    now: testClock, id: () => `cycle_${++sequence}`, allowFixture: true, ...overrides });
  return { service, store };
}

/** Distinct prefixes keep persisted cycle identifiers unique across a simulated restart on one store file. */
function idSequence(prefix: string): () => string {
  let sequence = 0;
  return () => `${prefix}_${++sequence}`;
}

function cycleObservation(result: CycleResult) {
  if (!("observation" in result)) throw new Error("cycle did not produce an observation");
  return result.observation;
}

const BLOCK_HASH = f.historicalBlock.hash;

describe("FIXTURE: progression integrated into the monitoring lifecycle", () => {
  it("persists FIRST_OBSERVATION progression atomically with the accepted observation and its alerts", async () => {
    const h = lifecycleHarness(rotatingRead());
    const observation = cycleObservation(await h.service.runOnce());
    expect(observation.accepted).toBe(true);
    expect(observation.progression).toMatchObject({ state: "UNKNOWN", reason: "FIRST_OBSERVATION", advancedBlocks: null,
      blockNumber: BLOCK.number.toString(), blockHash: BLOCK_HASH, headNumber: (BLOCK.number + 5n).toString(),
      baselineBlockNumber: null, sameBlockStreak: 0 });
    expect(observation.risk.actionable).toBe(false);
    const state = h.store.state(MONITOR_SCOPE);
    expect(state.lastAccepted?.progression).toEqual(observation.progression);
    expect(state.latest?.progression).toEqual(observation.progression);
    for (const alert of h.store.alerts()) expect(alert.current.progression).toEqual(observation.progression);
    await h.service.shutdown();
  });

  it(`treats same-block rereads as UNCHANGED for ${STALL_WINDOW_OBSERVATIONS} observations and STALLED beyond`, async () => {
    const h = lifecycleHarness(rotatingRead());
    expect(cycleObservation(await h.service.runOnce()).progression?.reason).toBe("FIRST_OBSERVATION");
    for (let streak = 1; streak <= STALL_WINDOW_OBSERVATIONS + 1; streak++) {
      const observation = cycleObservation(await h.service.runOnce());
      expect(observation.accepted).toBe(true);
      expect(observation.progression).toMatchObject({
        state: streak <= STALL_WINDOW_OBSERVATIONS ? "UNCHANGED_WITHIN_WINDOW" : "STALLED",
        reason: streak <= STALL_WINDOW_OBSERVATIONS ? "SAME_BLOCK_RE_READ" : "STALL_WINDOW_EXCEEDED",
        sameBlockStreak: streak, advancedBlocks: "0", blockNumber: BLOCK.number.toString() });
      // A stagnant chain never makes estimates available, whatever the retrieval recency.
      expect(observation.risk.repayment).toBeNull();
      expect(observation.risk.actionable).toBe(false);
    }
    await h.service.shutdown();
  });

  it("records ADVANCING on a strictly higher cross-checked block while estimates stay absent", async () => {
    const h = lifecycleHarness(rotatingRead([{}, { headNumber: BLOCK.number + 8n }, {}, {}]));
    await h.service.runOnce();
    const advanced = cycleObservation(await h.service.runOnce());
    expect(advanced.accepted).toBe(true);
    expect(advanced.progression).toMatchObject({ state: "ADVANCING", reason: null, advancedBlocks: "3",
      blockNumber: (BLOCK.number + 3n).toString(), headNumber: (BLOCK.number + 8n).toString(),
      baselineBlockNumber: BLOCK.number.toString(), baselineBlockHash: BLOCK_HASH, sameBlockStreak: 0 });
    expect(advanced.risk.blockNumber).toBe((BLOCK.number + 3n).toString());
    // ADVANCING alone never enables estimates: the oracle gate is still UNVERIFIED.
    expect(advanced.risk.repayment).toBeNull();
    expect(advanced.risk.actionable).toBe(false);
    await h.service.shutdown();
  });

  it("rejects a same-height hash conflict, keeps the diagnosis bounded and preserves the accepted baseline", async () => {
    const h = lifecycleHarness(rotatingRead([{}, { initialHash: hash("ef") as `0x${string}` }, {}, {}]));
    await h.service.runOnce();
    const conflict = cycleObservation(await h.service.runOnce());
    expect(conflict.accepted).toBe(false);
    expect(conflict.diagnostics).toContain("BLOCK_REGRESSION");
    expect(conflict.progression).toMatchObject({ state: "CONFLICT", reason: "SAME_HEIGHT_HASH_CONFLICT",
      advancedBlocks: null, baselineBlockHash: BLOCK_HASH });
    const state = h.store.state(MONITOR_SCOPE);
    expect(state.lastAccepted?.risk.blockHash).toBe(BLOCK_HASH);
    expect(state.lastAccepted?.accepted).toBe(true);
    await h.service.shutdown();
  });

  it("rejects a timestamp regression with BLOCK_TIMESTAMP_REGRESSION and preserves the baseline", async () => {
    const h = lifecycleHarness(rotatingRead([{}, { headerTimestamp: BLOCK.timestamp - 10n, sentinelTimestampOffset: -10n }, {}, {}]));
    await h.service.runOnce();
    const regressed = cycleObservation(await h.service.runOnce());
    expect(regressed.accepted).toBe(false);
    expect(regressed.diagnostics).toContain("BLOCK_TIMESTAMP_REGRESSION");
    expect(regressed.progression).toMatchObject({ state: "REGRESSED", reason: "BLOCK_TIMESTAMP_REGRESSION", advancedBlocks: null });
    expect(h.store.state(MONITOR_SCOPE).lastAccepted?.risk.blockHash).toBe(BLOCK_HASH);
    await h.service.shutdown();
  });

  it("rejects a backwards selected block as REGRESSED while keeping the last accepted data", async () => {
    const h = lifecycleHarness(rotatingRead([{}, { headNumber: BLOCK.number - 1n }, {}, {}]));
    await h.service.runOnce();
    const regressed = cycleObservation(await h.service.runOnce());
    expect(regressed.accepted).toBe(false);
    expect(regressed.diagnostics).toContain("BLOCK_REGRESSION");
    expect(regressed.progression).toMatchObject({ state: "REGRESSED", reason: "BLOCK_NUMBER_REGRESSION" });
    expect(h.store.state(MONITOR_SCOPE).lastAccepted?.risk.blockNumber).toBe(BLOCK.number.toString());
    await h.service.shutdown();
  });

  it("marks failed reads as UNKNOWN progression without touching the accepted baseline", async () => {
    let attempts = 0;
    const h = lifecycleHarness(async () => {
      if (++attempts === 1) return riskFixture();
      throw new DataError("RPC_UNAVAILABLE", "fixture synthetic RPC failure");
    });
    await h.service.runOnce();
    const failed = cycleObservation(await h.service.runOnce());
    expect(failed.accepted).toBe(false);
    expect(failed.diagnostics).toContain("RPC_UNAVAILABLE");
    expect(failed.progression).toMatchObject({ state: "UNKNOWN", reason: "NO_SNAPSHOT_EVIDENCE", blockNumber: null });
    expect(h.store.state(MONITOR_SCOPE).lastAccepted?.risk.mathematicalRiskState).toBe("WARNING");
    await h.service.shutdown();
  });

  it("treats a missing provider head as UNKNOWN rather than inferring any change", async () => {
    const initial = await riskFixture();
    let attempt = 0;
    const h = lifecycleHarness(async () => {
      attempt += 1;
      return attempt === 1 ? initial : { ...initial, heads: { ...initial.heads, mcp: null } };
    });
    await h.service.runOnce();
    const observation = cycleObservation(await h.service.runOnce());
    expect(observation.progression).toMatchObject({ state: "UNKNOWN", reason: "MISSING_PROVIDER_HEAD", headNumber: null });
    expect(observation.accepted).toBe(false);
    expect(h.store.state(MONITOR_SCOPE).lastAccepted?.risk.blockHash).toBe(BLOCK_HASH);
    await h.service.shutdown();
  });

  it("resumes the same-block streak from persisted progression after a restart", async () => {
    const directory = temporaryMonitorDirectory();
    cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, "progression-restart.sqlite");
    const first = lifecycleHarness(rotatingRead(), { store: new MonitorStore(path), id: idSequence("restart1") });
    await first.service.runOnce();
    await first.service.runOnce();
    expect(first.store.state(MONITOR_SCOPE).lastAccepted?.progression).toMatchObject(
      { state: "UNCHANGED_WITHIN_WINDOW", sameBlockStreak: 1 });
    await first.service.shutdown();
    const second = lifecycleHarness(rotatingRead(), { store: new MonitorStore(path), id: idSequence("restart2") });
    await second.service.runOnce();
    expect(second.store.state(MONITOR_SCOPE).lastAccepted?.progression).toMatchObject(
      { state: "UNCHANGED_WITHIN_WINDOW", sameBlockStreak: 2, blockNumber: BLOCK.number.toString() });
    await second.service.shutdown();
    const reopened = new MonitorStore(path, { readOnly: true });
    expect(reopened.state(MONITOR_SCOPE).lastAccepted?.progression).toMatchObject({ sameBlockStreak: 2 });
    reopened.close();
  });
});

describe("FIXTURE: real progression states keep the 12B recovery gate fail-closed", () => {
  let base: Snapshot;
  beforeAll(async () => { base = await riskFixture(); });

  it("blocks recovery estimates on a same-block reread with the unchanged reason only", async () => {
    const first = await monitoringFixture();
    const second = observe(await riskFixture(), "cycle_2", testClock(), MONITOR_THRESHOLDS, { allowFixture: true, previous: first });
    expect(second.accepted).toBe(true);
    expect(second.progression).toMatchObject({ state: "UNCHANGED_WITHIN_WINDOW", reason: "SAME_BLOCK_RE_READ", sameBlockStreak: 1 });
    const gated = calculateAssuredRisk(base, verifiedAssuranceFixture(structuredClone(base)), MONITOR_THRESHOLDS,
      { calculatedAt: testClock(), progression: { state: second.progression!.state } });
    expect(gated.recoveryEligibility).toEqual({ eligible: false, status: "BLOCKED", reasonCodes: ["RECOVERY_CHAIN_PROGRESSION_UNCHANGED"] });
    expect(gated.repayment).toBeNull();
    expect(gated.actionable).toBe(false);
  });

  it("blocks recovery estimates whenever observed progression is UNKNOWN, whatever the recency of retrieval", async () => {
    const verified = verifiedAssuranceFixture(structuredClone(base));
    for (const progression of [undefined, { state: "UNKNOWN" as const }]) {
      const gated = calculateAssuredRisk(base, verified, MONITOR_THRESHOLDS, { calculatedAt: testClock(), progression });
      expect(gated.recoveryEligibility.eligible).toBe(false);
      expect(gated.recoveryEligibility.reasonCodes).toContain("RECOVERY_CHAIN_PROGRESSION_UNKNOWN");
      expect(gated.repayment).toBeNull();
    }
  });

  it("never lets observed regressed, stalled or conflicting states produce estimates", async () => {
    const verified = verifiedAssuranceFixture(structuredClone(base));
    for (const state of ["STALLED", "REGRESSED", "CONFLICT"] as const) {
      const gated = calculateAssuredRisk(base, verified, MONITOR_THRESHOLDS, { calculatedAt: testClock(), progression: { state } });
      expect(gated.recoveryEligibility.eligible, state).toBe(false);
      expect(gated.recoveryEligibility.reasonCodes, state).toEqual([`RECOVERY_CHAIN_PROGRESSION_${state}`]);
      expect(gated.repayment, state).toBeNull();
    }
  });
});

const cleanup: (() => void)[] = [];
afterAll(() => { for (const done of cleanup.splice(0).reverse()) done(); });
