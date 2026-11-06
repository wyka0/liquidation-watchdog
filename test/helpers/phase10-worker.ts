import type { PoolConfig } from "pg";
import { MonitoringService } from "../../src/monitoring/service.js";
import { SchedulerRunner } from "../../src/runtime/scheduler.js";
import { PgConnection } from "../../src/storage/postgres/connection.js";
import { PostgresDatabase } from "../../src/storage/postgres/database.js";
import { PostgresSchedulerStore } from "../../src/storage/postgres/scheduler-store.js";
import { PostgresMonitorStore } from "../../src/storage/postgres/store.js";
import { PG_FIXTURE_CATALOG, PG_NAMESPACE } from "../fixtures/postgres.js";
import { MONITOR_CONFIG, MONITOR_POSITION, MONITOR_SCOPE, MONITOR_THRESHOLDS, riskFixture, testClock } from "../fixtures/phase4.js";

// Disposable native-cluster child fixture: a loopback port, fixed database/roles and synthetic reads/sends only.
const [portText, mode] = process.argv.slice(2), port = Number(portText);
if (!process.send || !/^[1-9][0-9]{0,4}$/.test(portText ?? "") || port > 65_535 || !["read", "send"].includes(mode ?? "")) {
  throw new Error("An IPC local PostgreSQL fixture is required.");
}
const configuration = (user: string): PoolConfig => ({ host: "127.0.0.1", port, database: "watchdog_phase10_fixture", user,
  password: async () => "", ssl: false, application_name: "watchdog-phase10-child-fixture", options: "-c search_path=pg_catalog" });
const db = new PostgresDatabase(new PgConnection(configuration("watchdog_test_writer"), "writer"),
  new PgConnection(configuration("watchdog_test_reader"), "reader"), PG_NAMESPACE, PG_FIXTURE_CATALOG);
const raw = await riskFixture(); let sends = 0;
const ready = () => { process.send?.({ fixture: true, event: "ready", mode }); };
const slotPeriodSeconds = 300;
const runner = new SchedulerRunner({ enabled: true, periodSeconds: slotPeriodSeconds,
  store: new PostgresSchedulerStore(db, MONITOR_SCOPE, slotPeriodSeconds), createJob: (fence, signal) =>
  new MonitoringService({ configuration: MONITOR_CONFIG, thresholds: MONITOR_THRESHOLDS, position: MONITOR_POSITION,
    store: new PostgresMonitorStore(db, fence, MONITOR_CONFIG.resources, signal), id: () => fence.cycleId, now: testClock, allowFixture: true,
    read: async () => { if (mode === "read") { ready(); await new Promise<void>(() => {}); } return raw; },
    adapters: [{ channel: "console", send: async () => {
      if (mode === "send" && ++sends === 1) { ready(); await new Promise<void>(() => {}); }
      return { delivered: true };
    } }]
  }) });
try {
  await runner.run("2026-11-02T12:05:00.000Z", new AbortController().signal);
  process.send?.({ fixture: true, event: "unexpected-completion" }); process.exitCode = 1;
} finally {
  await runner.stop(); await db.close(); process.disconnect();
}
