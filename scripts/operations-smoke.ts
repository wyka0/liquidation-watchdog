import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";
import { root } from "./phase5-files.js";

const directory = join(root, "data", `phase5-operations-smoke-${randomUUID()}`), database = join(directory, "empty.sqlite");
await mkdir(directory, { recursive: true });
const commands: { command: string[]; exitCode: number; expectedExitCode: number; outputFile: string; errorFile: string }[] = [];
async function cli(name: string, args: string[], expectedExitCode: number): Promise<Record<string, unknown>> {
  const output: string[] = [], errors: string[] = [];
  const code = await new Promise<number>(resolve => {
    const child = spawn(process.execPath, ["dist/cli.js", ...args], { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 180_000, killSignal: "SIGKILL" });
    child.stdout.on("data", (bytes: Buffer) => { output.push(bytes.toString()); }); child.stderr.on("data", (bytes: Buffer) => { errors.push(bytes.toString()); });
    child.on("error", () => resolve(1)); child.on("close", code => resolve(code ?? 1));
  });
  const outputFile = `operations-smoke-${name}.json`, errorFile = `operations-smoke-${name}-stderr.txt`;
  await writeFile(join(root, CURRENT_EVIDENCE, outputFile), output.join("").replaceAll("\r\n", "\n"));
  await writeFile(join(root, CURRENT_EVIDENCE, errorFile), errors.join("").replaceAll("\r\n", "\n"));
  commands.push({ command: ["node", "dist/cli.js", ...args], exitCode: code, expectedExitCode, outputFile, errorFile });
  assert.equal(code, expectedExitCode, `Unexpected ${name} exit code; see its sanitized transcript.`);
  return z.record(z.string(), z.unknown()).parse(JSON.parse(output.join("")));
}
let passed = false;
try {
  const profile = join(directory, "production.json");
  await writeFile(profile, JSON.stringify({ operations: { profile: "production" }, storage: { path: database }, notifications: { telegram: false, discord: false } }));
  const args = ["--config", profile];
  assert.equal((await cli("config", ["config-check", ...args], 0)).productionReleaseReady, false);
  await cli("missing-health", ["health", ...args], 2); assert.equal(existsSync(database), false);
  await cli("missing-readiness", ["readiness", ...args], 2); assert.equal(existsSync(database), false);
  await cli("init", ["database-init", ...args], 0); assert.equal(existsSync(database), true);
  const health = await cli("healthy-empty", ["health", ...args], 0); assert.equal(health.financialActionability, false);
  await cli("uninitialized-readiness", ["readiness", ...args], 2);
  const probe = await cli("probe", ["readiness", "--probe", ...args], 2);
  assert.deepEqual(z.object({ rpc: z.string(), mcp: z.string() }).parse(probe.connectivity), { rpc: "REACHABLE", mcp: "REACHABLE" });
  await cli("diagnostics", ["diagnostics", ...args], 0);
  const invalid = join(directory, "invalid.json"); await writeFile(invalid, JSON.stringify({ operations: { profile: "production" }, storage: { path: "data/relative-production.sqlite" } }));
  await cli("invalid-config", ["config-check", "--config", invalid], 2); await cli("invalid-init", ["database-init", "--config", invalid], 2);
  // Use the preceding two explicitly bounded monitor reads, not a new continuous monitor.
  const monitoring = z.object({ passed: z.literal(true), database: z.string() }).parse(JSON.parse(await readFile(join(root, CURRENT_EVIDENCE, "monitoring-smoke.json"), "utf8")));
  const liveDatabase = join(root, monitoring.database), backup = join(directory, "verified-backup");
  await cli("as-of-readiness", ["readiness", "--database", liveDatabase], 0);
  const created = await cli("backup", ["backup", "--database", liveDatabase, "--output", backup], 0);
  assert.ok(Number(created.evidenceFiles) > 0); assert.equal(created.actionable, false);
  await cli("backup-check", ["backup-verify", "--backup", backup], 0);
  const restored = await cli("restore-check", ["restore-verify", "--backup", backup, "--restore-root", join(directory, "scratch")], 0);
  assert.equal(restored.sourceUnchanged, true); assert.equal(restored.externalCalls, 0);
  await cli("exclusive-backup", ["backup", "--database", liveDatabase, "--output", backup], 2);
  passed = true;
} catch { console.error("Operational CLI smoke failed; consult its sanitized Phase 5 transcripts."); process.exitCode = 1; }
await writeFile(join(root, CURRENT_EVIDENCE, "operations-smoke.json"), JSON.stringify({ evidenceKind: "BOUNDED_OPERATIONAL_CLI_WITH_EXPLICIT_READ_ONLY_PROBE",
  recordedAt: new Date().toISOString(), passed, commands, commandCount: commands.length,
  realExternalNotifications: 0, transactions: 0, continuousMonitoring: false, productionReleaseReady: false, actionable: false }, null, 2) + "\n");
console.log(`Operational built-CLI smoke: ${passed ? "PASS" : "FAIL"}; ${commands.length} bounded commands with explicit expected exit codes.`);
