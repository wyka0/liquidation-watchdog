import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { RenderRuntime } from "../src/runtime/service.js";
import { createBackup, verifyBackup, verifyRestore } from "../src/storage/backup.js";
import { MonitorStore } from "../src/storage/store.js";
import { MONITOR_SCOPE, riskFixture, testClock } from "../test/fixtures/phase4.js";
import { deferred, RELEASE_ROOT, runtimeFixture } from "../test/fixtures/runtime.js";

const output = resolve(process.argv[2] ?? join(RELEASE_ROOT, "evidence/phase8/runtime-reliability.json"));
if (existsSync(output)) throw new Error("Use a new Phase 8 evidence output; completed results are immutable.");
const startedAt = new Date().toISOString(), start = performance.now(), cpu = process.cpuUsage(), base = await riskFixture();
const h = runtimeFixture(true, true), startupMs: number[] = [], shutdownMs: number[] = [], samples: unknown[] = [], apiMs: number[] = [];
const apiStatuses: Record<string, number> = {}, initialRssBytes = process.memoryUsage().rss;
let now = testClock().getTime(), cycles = 0, consoleWrites = 0, responseBytes = 0, peakRssBytes = initialRssBytes;
const loop = monitorEventLoopDelay({ resolution: 10 }); loop.enable();
const sampler = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 25); sampler.unref();
let runtime: RenderRuntime | undefined;
try {
  for (let session = 0; session < 3; session++) {
    let checkpoint = deferred<number>(), resume = () => {};
    runtime = new RenderRuntime({ ...h.options, write: () => { consoleWrites++; }, fixture: {
      now: () => new Date(now), random: () => 0, id: () => `reliability_${++cycles}`,
      read: async () => base,
      pause: async (milliseconds, signal) => {
        const gate = deferred<void>(); resume = () => { gate.resolve(); };
        const abort = () => { gate.resolve(); }; signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort(); checkpoint.resolve(milliseconds);
        try { await gate.promise; } finally { signal.removeEventListener("abort", abort); }
      }
    } });
    const startup = performance.now(), address = await runtime.start(); startupMs.push(performance.now() - startup);
    for (let index = 0; index < 8; index++) {
      const delay = await checkpoint.promise; checkpoint = deferred<number>();
      for (const route of ["/api/monitoring/status", "/api/positions", "/api/alerts"]) {
        const started = performance.now(), response = await fetch(`http://127.0.0.1:${address.port}${route}`, {
          headers: { Authorization: `Bearer ${h.credential}` }, signal: AbortSignal.timeout(5_000)
        });
        const body = await response.text(); responseBytes += Buffer.byteLength(body); apiMs.push(performance.now() - started);
        apiStatuses[response.status] = (apiStatuses[response.status] ?? 0) + 1;
        assert.equal(response.status, 200); assert.ok(body.includes('"actionable":false')); assert.equal(body.includes(h.credential), false);
      }
      const memory = process.memoryUsage(); peakRssBytes = Math.max(peakRssBytes, memory.rss);
      samples.push({ cycle: cycles, rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, uptimeMs: Math.round(performance.now() - start) });
      assert.ok(memory.rss < h.options.configuration.resources.rssBytes);
      now += delay;
      if (index < 7) resume();
    }
    const shutdown = performance.now(); await runtime.stop(); shutdownMs.push(performance.now() - shutdown); assert.equal(await runtime.done, 0); runtime = undefined;
  }
  const store = new MonitorStore(h.options.database, { readOnly: true });
  let counts: Record<string, number>, hashes: Record<string, string>, databaseBytes: number;
  try {
    store.validateAll(); assert.equal(store.state(MONITOR_SCOPE).revision, 24); assert.equal(store.unfinishedCycles(MONITOR_SCOPE).length, 0);
    const statistics = store.statistics(); counts = statistics.counts; hashes = store.contentHashes(); databaseBytes = statistics.pageCount * statistics.pageSize;
  } finally { store.close(); }
  const backupStart = performance.now(), backupPath = join(h.directory, "backups/reliability-backup");
  const backup = await createBackup(h.options.database, backupPath, { projectRoot: h.options.runtimeRoot });
  assert.equal((await verifyBackup(backupPath)).passed, true); const backupMs = performance.now() - backupStart;
  const restoreStart = performance.now(), restore = await verifyRestore(backupPath, join(h.directory, "restore-verification")), restoreMs = performance.now() - restoreStart;
  const after = new MonitorStore(h.options.database, { readOnly: true });
  try { assert.deepEqual(after.contentHashes(), hashes); } finally { after.close(); }
  loop.disable();
  const ordered = [...apiMs].sort((a, b) => a - b), finalRssBytes = process.memoryUsage().rss;
  peakRssBytes = Math.max(peakRssBytes, finalRssBytes);
  const result = { evidenceKind: "PHASE8_BOUNDED_SYNTHETIC_LOCAL_RUNTIME", startedAt, finishedAt: new Date().toISOString(), passed: true,
    runtime: { node: process.version, sqlite: process.versions.sqlite, platform: process.platform },
    sessions: 3, restarts: 2, cyclesRequested: 24, cyclesCompleted: cycles, simulatedElapsedSeconds: (now - testClock().getTime()) / 1_000,
    realElapsedMs: performance.now() - start, startupMs, shutdownMs, consoleWrites, databaseBytes, counts,
    api: { requests: apiMs.length, statuses: apiStatuses, responseBytes, maxMs: Math.max(...apiMs), p95Ms: ordered[Math.ceil(ordered.length * 0.95) - 1] },
    memory: { initialRssBytes, finalRssBytes, peakRssBytes, samplingMilliseconds: 25, includesBackupAndRestore: true,
      rssGrowthBytes: finalRssBytes - initialRssBytes, samples }, cpu: process.cpuUsage(cpu),
    eventLoopDelayMs: { mean: loop.mean / 1e6, maximum: loop.max / 1e6, p99: loop.percentile(99) / 1e6 },
    backup: { durationMs: backupMs, ...backup }, restore: { durationMs: restoreMs, ...restore },
    externalProviderCalls: 0, chainCalls: 0, transactions: 0, actionable: false, productionSoakCompleted: false,
    limits: "Synthetic time and a small Windows/local database. No Render/Linux, capacity, power-loss, off-disk RPO/RTO or production-duration qualification." };
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ passed: true, sessions: 3, cycles, apiRequests: apiMs.length, peakRssBytes, backup: backup.passed, restore: restore.passed }));
} finally { clearInterval(sampler); loop.disable(); await runtime?.stop(); rmSync(h.directory, { recursive: true, force: true }); }
