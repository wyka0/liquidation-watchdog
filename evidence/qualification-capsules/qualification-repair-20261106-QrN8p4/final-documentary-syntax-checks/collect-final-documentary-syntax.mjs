// Syntax qualification of documentary tools only. Never executes their action modes or application code.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)), output = join(root, "final-documentary-syntax-checks");
const hash = value => createHash("sha256").update(value).digest("hex");
const startedAt = new Date().toISOString(), scripts = ["final-documentary-tools.mjs", "complete-qualification-report.mjs",
  "validate-final-qualification.mjs", "capture-final-seal-verification.mjs", "collect-final-documentary-syntax.mjs",
  "inspect-final-documentary-inputs.mjs", "retain-documentary-input-review-failure.mjs"];
mkdirSync(output);
const results = [];
for (const script of scripts) {
  const source = readFileSync(join(root, script));
  writeFileSync(join(output, script), source, { flag: "wx" });
  const command = [process.execPath, "--check", join(root, script)], beganAt = new Date().toISOString();
  const run = spawnSync(command[0], command.slice(1), { cwd: "C:/liquidation-watchdog", windowsHide: true, timeout: 20000,
    env: { ...process.env, NODE_OPTIONS: "", NODE_DISABLE_COMPILE_CACHE: "1" }, maxBuffer: 1024 ** 2 });
  const stdout = run.stdout ?? Buffer.alloc(0), stderr = run.stderr ?? Buffer.alloc(0);
  writeFileSync(join(output, `${script}.stdout.txt`), stdout, { flag: "wx" });
  writeFileSync(join(output, `${script}.stderr.txt`), stderr, { flag: "wx" });
  results.push({ script, bytes: source.length, sha256: hash(source), sourceCapsule: script, command, startedAt: beganAt,
    completedAt: new Date().toISOString(), exitCode: run.status, signal: run.signal,
    ...(run.error ? { error: { name: run.error.name, message: run.error.message } } : {}),
    stdout: { file: `${script}.stdout.txt`, bytes: stdout.length, sha256: hash(stdout) },
    stderr: { file: `${script}.stderr.txt`, bytes: stderr.length, sha256: hash(stderr) } });
}
const pass = results.every(result => result.exitCode === 0 && !result.error);
const result = { schemaVersion: 1, status: pass ? "PASS" : "FAIL_DOCUMENTARY_SYNTAX_NOT_SOFTWARE_TESTS", startedAt,
  completedAt: new Date().toISOString(), node: process.version, scripts: results,
  safety: { nodeCheckOnly: true, actionModesNotInvoked: true, applicationImports: 0, databaseOpens: 0, networkRequests: 0,
    qualificationTestsRestarted: false, monitor: "STOPPED", noRepositoryWrite: true, exclusiveSourceCapsulesAndOutputWrites: true } };
writeFileSync(join(output, "summary.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: result.status, syntaxChecks: results.length, exitCodes: results.map(item => item.exitCode),
  summary: join(output, "summary.json"), actionModesInvoked: 0 }, null, 2));
assert.ok(pass, "Retained documentary-tool syntax failure; do not use failed tool bytes.");
