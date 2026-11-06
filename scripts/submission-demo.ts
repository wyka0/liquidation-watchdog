import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRuntimeConfiguration } from "../src/config/runtime.js";
import { parseMonitoringConfiguration } from "../src/config/monitoring.js";
import { stringify } from "../src/domain/serialize.js";
import { inspectPosition } from "../src/chain/snapshot.js";
import type { Snapshot } from "../src/domain/types.js";
import { MonitoringService } from "../src/monitoring/service.js";
import { initialState, monitoringScope, observationSchema, riskView } from "../src/monitoring/model.js";
import { transition } from "../src/monitoring/transitions.js";
import { ConsoleAdapter } from "../src/notifications/adapters.js";
import { NotificationDispatcher } from "../src/notifications/dispatcher.js";
import { calculateAssuredRisk } from "../src/risk/assured.js";
import { PersistedReadModel } from "../src/runtime/read-model.js";
import { MonitorStore } from "../src/storage/store.js";
import { FixtureClient } from "../test/fixtures/phase4.js";
import { verifiedAssuranceFixture } from "../test/fixtures/recovery.js";
import { historicalBlock, position as fixturePosition } from "../test/fixtures/state.js";
import { testClock } from "../test/fixtures/monitoring.js";

export interface SubmissionDemoOptions { root?: string; outputDirectory?: string; positionPath?: string }

async function snapshot(position: Awaited<ReturnType<typeof loadRuntimeConfiguration>>["position"], critical = false): Promise<Snapshot> {
  const advanced = critical ? {
    headNumber: historicalBlock.number + 6n, headerTimestamp: historicalBlock.timestamp + 1n,
    sentinelTimestampOffset: 1n, initialHash: `0x${"33".repeat(32)}` as const, afterHash: `0x${"33".repeat(32)}` as const,
    values: { position: { ...fixturePosition, borrowShares: fixturePosition.borrowShares * 110n / 100n } }
  } : {};
  return inspectPosition({ rpc: new FixtureClient("rpc", advanced), mcp: new FixtureClient("mcp", advanced),
    evidenceKind: "FIXTURE", now: testClock, position });
}

async function runCycle(database: string, configuration: ReturnType<typeof parseMonitoringConfiguration>,
  resolved: Awaited<ReturnType<typeof loadRuntimeConfiguration>>, input: Snapshot, cycleId: string) {
  const output: string[] = [], logs: unknown[] = [], store = new MonitorStore(database, { limits: configuration.resources });
  const service = new MonitoringService({ configuration, thresholds: resolved.thresholds, position: resolved.position, store,
    adapters: [new ConsoleAdapter(text => output.push(text))], read: async () => structuredClone(input), allowFixture: true,
    now: testClock, id: () => cycleId, log: record => logs.push(record) });
  try {
    const result = await service.runOnce();
    assert.ok("observation" in result, "Fixture cycle was unexpectedly skipped.");
    return { result, output, logs };
  } finally { await service.shutdown(); }
}

export async function runSubmissionDemo(options: SubmissionDemoOptions = {}) {
  const root = resolve(options.root ?? process.cwd());
  const outputDirectory = resolve(root, options.outputDirectory ?? "data/submission-demo");
  const positionPath = resolve(root, options.positionPath ?? "config/submission-position.example.json");
  if (existsSync(outputDirectory)) throw new Error(`Demo output already exists: ${outputDirectory}. Remove it explicitly before rerunning.`);
  await mkdir(resolve(outputDirectory, ".."), { recursive: true }); await mkdir(outputDirectory);

  const resolved = await loadRuntimeConfiguration({ positionPath });
  const database = resolve(outputDirectory, "watchdog.sqlite");
  const configuration = parseMonitoringConfiguration({ ...resolved.monitoring,
    storage: { ...resolved.monitoring.storage, path: database }, monitoring: { ...resolved.monitoring.monitoring, enabled: false } });
  assert.equal(resolved.position.mode, "CONFIGURED"); assert.equal(resolved.position.enabled, true);

  const warningSnapshot = await snapshot(resolved.position);
  const warning = await runCycle(database, configuration, resolved, warningSnapshot, "demo_warning");
  assert.equal(warning.result.observation.risk.mathematicalRiskState, "WARNING");
  assert.ok(warning.result.alerts.length > 0); assert.ok(warning.result.alerts.every(alert => alert.suggestedAction.type === "NON_FINANCIAL"));
  assert.ok(warning.output.join("").includes("actionable: false"));

  const firstStore = new MonitorStore(database, { readOnly: true });
  const firstDeliveries = firstStore.deliveries(); firstStore.close();
  assert.ok(firstDeliveries.length > 0 && firstDeliveries.every(delivery => delivery.status === "DELIVERED" && delivery.attempts === 1));

  // Reopen through a new service instance: known delivered alerts must not be resent, and unchanged risk creates no duplicate alert.
  const restart = await runCycle(database, configuration, resolved, warningSnapshot, "demo_restart");
  assert.equal(restart.output.length, 0); assert.equal(restart.result.alerts.length, 0);
  const restartStore = new MonitorStore(database, { readOnly: true });
  const afterRestart = restartStore.deliveries(); restartStore.close();
  assert.deepEqual(afterRestart, firstDeliveries);

  const criticalSnapshot = await snapshot(resolved.position, true);
  const critical = await runCycle(database, configuration, resolved, criticalSnapshot, "demo_critical");
  assert.equal(critical.result.observation.risk.mathematicalRiskState, "CRITICAL");
  assert.ok(critical.result.alerts.some(alert => alert.code === "RISK_WORSENED"));
  assert.ok(critical.result.alerts.every(alert => alert.suggestedAction.type === "NON_FINANCIAL"));

  // Separate strict-gate accepting path. Every assurance/freshness/independence fact here is synthetic test evidence.
  const assurance = verifiedAssuranceFixture(criticalSnapshot);
  const assured = calculateAssuredRisk(criticalSnapshot, assurance, resolved.thresholds,
    { calculatedAt: testClock(), progression: { state: "ADVANCING" }, position: resolved.position });
  assert.equal(assured.recoveryEligibility.eligible, true); assert.equal(assured.mathematicalRiskState, "CRITICAL");
  assert.equal(assured.repayment?.status, "CALCULATED"); assert.equal(assured.additionalCollateral?.status, "CALCULATED");
  const block = criticalSnapshot.block!;
  const financialObservation = observationSchema.parse({ cycleId: "demo_qualified_financial", observedAt: testClock().toISOString(), accepted: true,
    risk: riskView(assured), diagnostics: [], assurance,
    progression: { state: "ADVANCING", reason: null, advancedBlocks: "1", blockNumber: block.number.toString(), blockHash: block.hash,
      blockTimestamp: block.timestamp.toString(), headNumber: (block.number + 5n).toString(), baselineBlockNumber: (block.number - 1n).toString(),
      baselineBlockHash: block.parentHash, sameBlockStreak: 0, evaluatedAt: testClock().toISOString() } });
  const financialDatabase = resolve(outputDirectory, "qualified-fixture.sqlite"), financialOutput: string[] = [];
  const financialStore = new MonitorStore(financialDatabase); financialStore.acquireMonitor();
  const scope = monitoringScope(resolved.thresholds, undefined, resolved.position), next = transition(initialState(), financialObservation, configuration.monitoring, scope);
  financialStore.beginCycle(financialObservation.cycleId, scope, financialObservation.observedAt);
  const financialAlerts = financialStore.commitObservation(scope, financialObservation, 0, next.state, next.alerts, ["console"]);
  const dispatcher = new NotificationDispatcher(financialStore, [new ConsoleAdapter(text => financialOutput.push(text))], configuration.notifications,
    testClock, () => {}, () => 0.5);
  await dispatcher.drain(); financialStore.finishCycle(financialObservation.cycleId, financialObservation.observedAt);
  assert.equal(financialAlerts.length > 0, true);
  // Risk-transition alerts (INITIAL_RISK/RISK_WORSENED family) carry the qualified option; data/oracle notices stay non-financial by design.
  const qualifiedAlert = financialAlerts.find(alert => alert.suggestedAction.type === "FINANCIAL_OPTION");
  assert.ok(qualifiedAlert, "The qualified fixture scenario did not produce a financial-option alert.");
  assert.ok(["INITIAL_RISK", "RISK_WORSENED", "DEBT_OBSERVED", "CRITICAL_REMINDER"].includes(qualifiedAlert!.code));
  assert.equal(qualifiedAlert!.suggestedAction.actionable, false);
  assert.ok(financialAlerts.every(alert => alert.suggestedAction.actionable === false));
  assert.ok(financialOutput.join("").includes("Action option: REPAY")); assert.ok(financialOutput.join("").includes("actionable: false"));
  const financialDeliveries = financialStore.deliveries(); financialStore.close();
  assert.ok(financialDeliveries.every(delivery => delivery.status === "DELIVERED"));

  const reader = new MonitorStore(database, { readOnly: true });
  const api = new PersistedReadModel(reader, configuration, () => "DISABLED", resolved.thresholds, resolved.position, testClock);
  const risk = api.read("/api/risk"), alerts = api.read("/api/alerts"), readiness = api.read("/api/readiness"), status = api.read("/api/monitoring/status");
  const persistedAlerts = reader.alerts(100, scope), deliveries = reader.deliveries(); reader.close();
  assert.equal(readiness.status, 503); assert.equal(risk.status, 200);
  assert.ok(persistedAlerts.every(alert => alert.suggestedAction.actionable === false));

  const consoleTranscript = [...warning.output, ...critical.output].join("");
  assert.match(consoleTranscript, /^\[\d{4}-\d{2}-\d{2}T.*Z\]/); assert.ok(consoleTranscript.includes("actionable: false"));
  await Promise.all([
    writeFile(resolve(outputDirectory, "console-alerts.txt"), consoleTranscript),
    writeFile(resolve(outputDirectory, "qualified-financial-alert.txt"), financialOutput.join("")),
    writeFile(resolve(outputDirectory, "risk.json"), stringify(risk.body) + "\n"),
    writeFile(resolve(outputDirectory, "alerts.json"), stringify(alerts.body) + "\n"),
    writeFile(resolve(outputDirectory, "readiness.json"), stringify(readiness.body) + "\n"),
    writeFile(resolve(outputDirectory, "status.json"), stringify(status.body) + "\n")
  ]);
  const summary = {
    schemaVersion: 1, evidenceKind: "SYNTHETIC_FIXTURE_DEMO", passed: true,
    position: { positionId: resolved.position.identity.positionId, account: resolved.position.identity.account, mode: resolved.position.mode },
    scenarios: {
      warning: warning.result.observation.risk.mathematicalRiskState,
      critical: critical.result.observation.risk.mathematicalRiskState,
      insufficientEvidenceAction: "NON_FINANCIAL",
      qualifiedFixtureAction: financialAlerts[0]!.suggestedAction.type
    },
    persistence: { alerts: persistedAlerts.length, deliveries: deliveries.length, consoleDelivered: deliveries.every(delivery => delivery.status === "DELIVERED"),
      restartKnownDeliveriesResent: false, qualifiedFixtureDeliveries: financialDeliveries.length },
    readiness: { status: readiness.status, ready: false },
    safety: { actionable: false, liveProviderVerified: false, oracleAssuranceLiveVerified: false, realNotificationsSent: 0,
      note: "All chain, progression, assurance, freshness, independent-price, position and delivery inputs in this demo are deterministic local fixtures." },
    artifacts: ["console-alerts.txt", "qualified-financial-alert.txt", "risk.json", "alerts.json", "readiness.json", "status.json"]
  } as const;
  await writeFile(resolve(outputDirectory, "summary.json"), stringify(summary) + "\n");
  return { summary, outputDirectory };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await runSubmissionDemo();
    console.log("Submission demo: PASS");
    console.log("Evidence: SYNTHETIC FIXTURE ONLY; live provider/oracle readiness was not established.");
    console.log(`Position: ${result.summary.position.positionId} (${result.summary.position.account})`);
    console.log(`Risk scenarios: ${result.summary.scenarios.warning} -> ${result.summary.scenarios.critical}`);
    console.log(`Actions: ${result.summary.scenarios.insufficientEvidenceAction} when evidence is insufficient; ${result.summary.scenarios.qualifiedFixtureAction} only under synthetic complete strict-gate evidence.`);
    console.log(`Persistence: ${result.summary.persistence.alerts} alerts, ${result.summary.persistence.deliveries} delivered console outbox rows; restart resent known deliveries: ${result.summary.persistence.restartKnownDeliveriesResent}.`);
    console.log(`Readiness: HTTP-style status ${result.summary.readiness.status}; ready=false; actionable=false.`);
    console.log(`Artifacts: ${result.outputDirectory}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Submission demo failed."); process.exitCode = 1;
  }
}
