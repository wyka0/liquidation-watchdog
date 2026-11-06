import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";
import { stringify } from "../src/domain/serialize.js";
import { verifyOracleBundle } from "../src/oracle-assurance/evidence.js";
import { assuranceSchema } from "../src/oracle-assurance/model.js";
import { MonitorStore } from "../src/storage/store.js";
import { root } from "./phase5-files.js";

const database = `data/phase5-oracle-smoke-${randomUUID()}/watchdog.sqlite`;
const historicalBlock = "21864844", historicalHash = "0x34bed88e5dcc0890c2087cc2f2c7f71a484e74bd7a140cb5f8449c4196a61f8b";
await mkdir(join(root, CURRENT_EVIDENCE), { recursive: true });
const commands: { command: string[]; exitCode: number; outputFile: string; errorFile: string }[] = [];
async function cli(name: string, args: string[]): Promise<string> {
  const output: string[] = [], errors: string[] = [];
  const exitCode = await new Promise<number>(resolve => {
    const child = spawn(process.execPath, ["dist/cli.js", ...args, "--database", database], { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 240_000, killSignal: "SIGKILL" });
    child.stdout.on("data", (bytes: Buffer) => { output.push(bytes.toString()); });
    child.stderr.on("data", (bytes: Buffer) => { errors.push(bytes.toString()); });
    child.on("error", () => resolve(1)); child.on("close", code => resolve(code ?? 1));
  });
  const text = output.join("").replaceAll("\r\n", "\n"), outputFile = `oracle-smoke-${name}.txt`, errorFile = `oracle-smoke-${name}.stderr.txt`;
  await writeFile(join(root, CURRENT_EVIDENCE, outputFile), text);
  await writeFile(join(root, CURRENT_EVIDENCE, errorFile), errors.join("").replaceAll("\r\n", "\n"));
  commands.push({ command: ["node", "dist/cli.js", ...args, "--database", database], exitCode, outputFile, errorFile });
  assert.equal(exitCode, 0, `${name} failed; see the sanitized command output.`);
  return text;
}
const resultSchema = z.object({ assurance: assuranceSchema, bundle: z.object({ path: z.string().regex(/^evidence\/phase5\/oracle-audit-[A-Za-z0-9_-]+$/), manifestSha256: z.string() }) });
const latest = (context?: string) => {
  const store = new MonitorStore(join(root, database), { readOnly: true });
  try { return store.latestOracleAssurance(context); } finally { store.close(); }
};
try {
  const defaultText = await cli("default", ["oracle-audit"]);
  assert.match(defaultText, /Overall: UNVERIFIED/); assert.match(defaultText, /VERIFIED_HEARTBEAT: UNKNOWN/);
  const defaultAudit = latest("LIVE"); assert.ok(defaultAudit); assert.equal(defaultAudit.bundlePath, null);
  const live = resultSchema.parse(JSON.parse(await cli("saved-live", ["oracle-audit", "--save-evidence", "--json"])));
  assert.equal(live.assurance.evidenceKind, "LIVE_CHAIN_READ"); assert.equal(live.assurance.gate, "DATA_UNVERIFIED");
  assert.equal(live.assurance.actionable, false); assert.equal(live.assurance.independent.eligible, false);
  assert.equal(live.assurance.freshness.verifiedHeartbeatSeconds, null); assert.equal(live.assurance.freshness.upstreamFreshnessGuaranteeSeconds, null);
  assert.equal((await verifyOracleBundle(join(root, live.bundle.path))).manifestSha256, live.bundle.manifestSha256);
  const statusText = await cli("status", ["oracle-status"]); assert.match(statusText, /no fresh chain read/);
  const status = z.object({ status: z.literal("PERSISTED_AS_OF_SNAPSHOT"), latest: z.object({ assurance: assuranceSchema }) })
    .parse(JSON.parse(await cli("status-json", ["oracle-status", "--json"])));
  assert.deepEqual(status.latest.assurance, live.assurance);
  const historical = resultSchema.parse(JSON.parse(await cli("saved-historical", ["oracle-audit", "--block", historicalBlock, "--save-evidence", "--json"])));
  assert.equal(historical.assurance.evidenceKind, "HISTORICAL_SNAPSHOT"); assert.equal(historical.assurance.block?.number, historicalBlock);
  assert.equal(historical.assurance.block.hash, historicalHash); assert.equal(historical.assurance.continuityScope, `HISTORICAL-${historicalBlock}`);
  assert.equal((await verifyOracleBundle(join(root, historical.bundle.path))).manifestSha256, historical.bundle.manifestSha256);
  assert.match(await readFile(join(root, historical.bundle.path, "audit-report.txt"), "utf8"), /HISTORICAL audit/);
  assert.match(await cli("historical-status", ["oracle-status"]), /HISTORICAL audit/);
  assert.deepEqual(latest("LIVE")?.assurance, live.assurance); assert.deepEqual(latest()?.assurance, historical.assurance);
  await writeFile(join(root, CURRENT_EVIDENCE, "oracle-smoke.json"), stringify({
    evidenceKind: "BOUNDED_ORACLE_CLI_LIVE_AND_HISTORICAL_READS", recordedAt: new Date().toISOString(), passed: true, database, commands,
    defaultAudit, live, historical, statusDoesNotReadChain: true, independentSourceQualified: false, externalNotificationsEnabled: false,
    note: "Three bounded audits (default current, saved current, saved historical) and three read-only status processes; SQLite is retained under ignored data/."
  }) + "\n");
  console.log("Oracle CLI smoke: PASS; 3 bounded audits, 3 persisted-status processes, 2 new immutable evidence bundles; overall UNVERIFIED.");
} catch {
  await writeFile(join(root, CURRENT_EVIDENCE, "oracle-smoke.json"), stringify({ passed: false, database, commands }) + "\n");
  console.error("Oracle smoke failed; inspect its sanitized Phase 5 outputs."); process.exitCode = 1;
}
