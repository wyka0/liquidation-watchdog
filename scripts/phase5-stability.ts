import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";
import { parseMonitoringConfiguration } from "../src/config/monitoring.js";
import { DataError } from "../src/domain/errors.js";
import { observe } from "../src/monitoring/observation.js";
import { MonitoringService } from "../src/monitoring/service.js";
import type { CycleResult } from "../src/monitoring/service.js";
import type { NotificationAdapter } from "../src/notifications/types.js";
import { diskStatistics } from "../src/operations/resources.js";
import { MonitorStore } from "../src/storage/store.js";
import { MONITOR_POSITION, MONITOR_SCOPE, MONITOR_THRESHOLDS, persistFixture, riskFixture, temporaryMonitorDirectory, testClock } from "../test/fixtures/phase4.js";
import { position } from "../test/fixtures/state.js";
import { root } from "./phase5-files.js";

const startedAt = new Date().toISOString(), started = performance.now(), cpu = process.cpuUsage();
const directory = temporaryMonitorDirectory(), database = join(directory, "bounded-stability.sqlite"), cycles = 144;
const configuration = parseMonitoringConfiguration({ storage: { path: database, cycleRetentionDays: 7, alertRetentionDays: 7 },
  notifications: { maxAttempts: 3, jitterRatio: 0, baseDelaySeconds: 5, maxPerDrain: 4 } });
const snapshots = [await riskFixture(), await riskFixture({ values: { position: { ...position, borrowShares: 0n } } }),
  await riskFixture({ values: { position: { ...position, collateral: position.collateral * 8n / 10n } } })];
let time = testClock().getTime(), current = 0, reads = 0, accepted = 0, rejected = 0, overlapsPrevented = 0, restarts = 0;
let attempts = 0, simulatedRateLimits = 0, simulatedTransportErrors = 0, peakRssBytes = 0, maxDatabaseBytes = 0, maxWalBytes = 0, maxPending = 0;
const knownConsole = new Set<string>(), durations: number[] = [], samples: unknown[] = [];
let service: MonitoringService | undefined, store: MonitorStore | undefined;
let passed = false, errorCode: string | null = null, retention: unknown = null;
try {
  for (let segment = 0; segment < 3; segment += 1) {
    store = new MonitorStore(database, { limits: configuration.resources });
    const adapter: NotificationAdapter = { channel: "discord", send: async () => {
      attempts += 1;
      if (current % 12 === 2) { simulatedRateLimits += 1; return { delivered: false, code: "PROVIDER_RATE_LIMIT", retryable: true, ambiguous: false, retryAfterMs: 60_000 }; }
      if (current % 12 === 3 || current % 12 === 4) { simulatedTransportErrors += 1; return { delivered: false, code: "TRANSPORT_ERROR", retryable: true, ambiguous: true, retryAfterMs: null }; }
      return { delivered: true };
    } };
    service = new MonitoringService({ store, configuration, thresholds: MONITOR_THRESHOLDS, position: MONITOR_POSITION,
      allowFixture: true, now: () => new Date(time), id: () => `stability_${current}`,
      adapters: [{ channel: "console", send: async alert => {
        assert.ok(!knownConsole.has(alert.id), "A known console delivery was repeated"); knownConsole.add(alert.id); attempts += 1; return { delivered: true };
      } }, adapter], random: () => 0.5,
      read: async () => { reads += 1; if ([6, 7, 8, 9].includes(current % 18)) throw new DataError(current % 2 ? "RPC_UNAVAILABLE" : "MCP_UNAVAILABLE", "FIXTURE outage");
        return snapshots[Math.floor(current / 4) % snapshots.length]; }
    });
    for (; current < (segment + 1) * 48; current += 1) {
      assert.ok(performance.now() - started < 240_000, "Bounded stability wall-time budget exhausted");
      const begin = performance.now(), active: Promise<CycleResult> = service.runOnce(); assert.deepEqual(await service.runOnce(), { skipped: "OVERLAP" }); overlapsPrevented += 1;
      const result: CycleResult = await active; assert.ok("observation" in result);
      if (result.observation.accepted) accepted += 1; else rejected += 1;
      assert.equal(result.observation.risk.actionable, false); assert.equal(result.observation.risk.heartbeat, "UNKNOWN");
      assert.equal(result.observation.risk.oracleVerification, "UNVERIFIED");
      if (!result.observation.accepted) assert.equal(result.observation.risk.repayment, null);
      const duration = performance.now() - begin, disk = diskStatistics(database), rss = process.memoryUsage().rss, pending = store.pendingCount();
      durations.push(duration); peakRssBytes = Math.max(peakRssBytes, rss); maxDatabaseBytes = Math.max(maxDatabaseBytes, disk.databaseBytes);
      maxWalBytes = Math.max(maxWalBytes, disk.walBytes); maxPending = Math.max(maxPending, pending);
      assert.ok(rss < configuration.resources.rssBytes && pending < configuration.resources.pendingDeliveries && disk.walBytes < configuration.resources.walBytes);
      if (current % 12 === 0) samples.push({ cycle: current, virtualTime: new Date(time).toISOString(), durationMs: Math.round(duration), rssBytes: rss, ...disk, pending });
      time += 6 * 3_600_000;
    }
    const delivered = store.knownDeliveredHash(), state = store.state(MONITOR_SCOPE);
    await service.shutdown(); service = undefined; store = undefined;
    const check = new MonitorStore(database, { readOnly: true });
    try { assert.equal(check.knownDeliveredHash(), delivered); assert.deepEqual(check.state(MONITOR_SCOPE), state); check.validateAll(); }
    finally { check.close(); }
    if (segment < 2) restarts += 1;
  }
  store = new MonitorStore(database); store.acquireMonitor();
  const previous = store.state(MONITOR_SCOPE), held = observe(null, "held_pending_fixture", new Date(time), MONITOR_THRESHOLDS,
    { diagnostic: "RPC_UNAVAILABLE", ...(previous.assuranceBaseline ? { previousAssurance: previous.assuranceBaseline } : {}) });
  persistFixture(store, held, ["discord"]);
  const pending = store.deliveries().filter(item => !["DELIVERED", "PERMANENTLY_FAILED"].includes(item.status)); assert.ok(pending.length > 0);
  const baseline = store.state(MONITOR_SCOPE).lastAccepted, fingerprints = store.contentHashes().fingerprints;
  const before = store.statistics().counts;
  store.prune(new Date(time + 200 * 86_400_000).toISOString(), 7, 7);
  for (const delivery of pending) assert.deepEqual(store.deliveries().find(item => item.id === delivery.id), delivery);
  assert.deepEqual(store.state(MONITOR_SCOPE).lastAccepted, baseline); assert.equal(store.contentHashes().fingerprints, fingerprints); store.validateAll();
  retention = { simulatedAdvanceDays: 200, before, after: store.statistics().counts, pendingPreserved: pending.length, acceptedBaselinePreserved: true, dedupTombstonesPreserved: true };
  assert.equal(reads, cycles); assert.equal(overlapsPrevented, cycles); assert.ok(accepted > 0 && rejected > 0 && simulatedRateLimits > 0 && simulatedTransportErrors > 0);
  passed = true;
} catch (error) { errorCode = error instanceof DataError ? error.code : "STABILITY_ASSERTION_FAILED"; process.exitCode = 1; }
finally { if (service) await service.shutdown().catch(() => {}); store?.close(); }
const elapsed = performance.now() - started, usedCpu = process.cpuUsage(cpu);
durations.sort((a, b) => a - b);
await mkdir(join(root, CURRENT_EVIDENCE), { recursive: true });
await writeFile(join(root, CURRENT_EVIDENCE, "stability-results.json"), JSON.stringify({ evidenceKind: "DETERMINISTIC_BOUNDED_FIXTURE_STABILITY", startedAt,
  finishedAt: new Date().toISOString(), passed, errorCode, nodeVersion: process.version, sqliteVersion: process.versions.sqlite,
  cyclesRequested: cycles, cyclesCompleted: accepted + rejected, reads, accepted, rejected, overlapsPrevented, restarts,
  virtualCycleSpacingHours: 6, virtualElapsedDays: cycles * 6 / 24, realElapsedMs: Math.round(elapsed), cpuUserMs: usedCpu.user / 1_000, cpuSystemMs: usedCpu.system / 1_000,
  durationMs: { p50: Math.round(durations[Math.floor(durations.length * 0.5)] ?? 0), p95: Math.round(durations[Math.floor(durations.length * 0.95)] ?? 0), max: Math.round(durations.at(-1) ?? 0) },
  peakRssBytes, maxDatabaseBytes, maxWalBytes, maxPending, limits: configuration.resources,
  notifications: { attempts, simulatedRateLimits, simulatedTransportErrors, uniqueConsoleDeliveries: knownConsole.size, realHttpRequests: 0 }, retention, samples,
  externalCalls: 0, actionable: false, productionSoakCompleted: false,
  limitations: ["Synthetic time and provider outcomes; this is not a 36-day real-time soak.", "Fixture chain data are reused; no claim of real chain advancement, feed freshness or production delivery is made.",
    "Host filesystem/power loss, supervisor restart policy, cgroup/ACL enforcement and off-host disaster recovery require deployment-host acceptance." ] }, null, 2) + "\n");
console.log(`Bounded stability: ${passed ? "PASS" : "FAIL"}; ${accepted + rejected}/${cycles} cycles, ${restarts} restarts, ${Math.round(elapsed)}ms real time; 0 external calls.`);
