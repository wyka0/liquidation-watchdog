import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";
import { parseThresholds } from "../src/config/risk.js";
import { monitoringScope } from "../src/monitoring/model.js";
import { MonitorStore } from "../src/storage/store.js";
import { root } from "./phase5-files.js";

const database = `data/phase5-monitor-smoke-${randomUUID()}/watchdog.sqlite`, scope = monitoringScope(parseThresholds());
await mkdir(join(root, CURRENT_EVIDENCE), { recursive: true });
const commands: { command: string[]; exitCode: number; outputFile: string }[] = [];
async function cli(name: string, args: string[]) {
  const chunks: string[] = [];
  const exitCode = await new Promise<number>(resolve => {
    const child = spawn(process.execPath, ["dist/cli.js", ...args, "--database", database], { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 240_000, killSignal: "SIGKILL" });
    child.stdout.on("data", (bytes: Buffer) => { chunks.push(bytes.toString()); });
    child.stderr.on("data", (bytes: Buffer) => { chunks.push(bytes.toString()); });
    child.on("error", () => resolve(1)); child.on("close", code => resolve(code ?? 1));
  });
  const outputFile = `monitor-smoke-${name}.txt`;
  await writeFile(join(root, CURRENT_EVIDENCE, outputFile), chunks.join("").replaceAll("\r\n", "\n"));
  commands.push({ command: ["node", "dist/cli.js", ...args, "--database", database], exitCode, outputFile });
  assert.equal(exitCode, 0, `${name} did not complete successfully; see its sanitized output file.`);
}
const summary = () => {
  const store = new MonitorStore(join(root, database), { readOnly: true });
  try { return { ...store.summary(scope), oracleAssurance: store.latestOracleAssurance("LIVE"), deliveries: store.deliveries(), alerts: store.alerts(1_000) }; } finally { store.close(); }
};
try {
  await cli("once", ["monitor", "--once"]);
  const first = summary();
  assert.equal(first.state.revision, 1); assert.equal(first.state.latest?.accepted, true);
  assert.equal(first.state.lastAccepted?.risk.oracleVerification, "UNVERIFIED");
  assert.equal(first.schemaVersion, 5);
  assert.equal(first.state.latest.assurance?.overall, "UNVERIFIED");
  assert.equal(first.state.latest.assurance?.freshness.state, "UNKNOWN");
  assert.equal(first.state.latest.assurance?.freshness.verifiedHeartbeatSeconds, null);
  assert.equal(first.state.latest.assurance?.independent.eligible, false);
  assert.deepEqual(first.oracleAssurance?.assurance, first.state.latest.assurance);
  assert.equal(first.oracleAssurance?.assurance.baseline?.configuration.signerCoverage, "SAMPLED_ACTIVE_CONFIGS");
  assert.ok(first.deliveries.length > 0 && first.deliveries.every(delivery => delivery.channel === "console" && delivery.status === "DELIVERED"));
  await cli("restart", ["monitor", "--once"]);
  const second = summary();
  assert.equal(second.state.revision, 2); assert.equal(second.state.latest?.accepted, true);
  assert.notEqual(second.state.latest?.cycleId, first.state.latest?.cycleId);
  assert.deepEqual(second.oracleAssurance?.assurance, second.state.latest.assurance);
  assert.deepEqual(second.state.assuranceBaseline, second.oracleAssurance?.assurance);
  assert.equal(second.state.latest.assurance?.overall, "UNVERIFIED");
  assert.equal(second.state.latest.assurance?.configurationFingerprint, first.state.latest.assurance?.configurationFingerprint);
  assert.equal(second.state.latest.assurance?.evidenceInvalidated, false);
  assert.ok(BigInt(second.state.latest.assurance!.baseline!.block.number) >= BigInt(first.state.latest.assurance!.baseline!.block.number));
  for (const delivery of first.deliveries) assert.deepEqual(second.deliveries.find(candidate => candidate.id === delivery.id), delivery);
  assert.equal(second.state.lastAccepted?.risk.actionable, false);
  // Recovery estimates are eligibility-gated; production monitoring has none, and absence is never a zero amount.
  assert.equal(second.state.lastAccepted?.risk.repayment, null);
  assert.equal(second.state.lastAccepted?.risk.additionalCollateral, null);
  await cli("alerts", ["alerts", "--limit", "20"]); await cli("status", ["status"]);
  await writeFile(join(root, CURRENT_EVIDENCE, "monitoring-smoke.json"), `${JSON.stringify({
    evidenceKind: "TWO_BOUNDED_LIVE_READS_WITH_PROCESS_RESTART", passed: true, recordedAt: new Date().toISOString(), database,
    commands, first, second, oracleAssurancePersistedAcrossRestart: true, knownDeliveredAlertsNotResent: true, externalNotificationsEnabled: false,
    note: "The local smoke database is retained under ignored data/. Each monitor process ran exactly one cycle."
  }, null, 2)}\n`);
  console.log(`Bounded monitoring/restart smoke: PASS; 2 accepted cycles, ${first.alerts.length} then ${second.alerts.length} stored alerts; 4 built CLI processes completed; console only.`);
} catch {
  await writeFile(join(root, CURRENT_EVIDENCE, "monitoring-smoke.json"), `${JSON.stringify({ passed: false, commands, database }, null, 2)}\n`);
  console.error("Bounded monitoring smoke failed; inspect its sanitized Phase 5 evidence."); process.exitCode = 1;
}
