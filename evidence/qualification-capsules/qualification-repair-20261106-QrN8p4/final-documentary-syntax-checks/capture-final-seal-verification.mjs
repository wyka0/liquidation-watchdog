// Run only the separate read-only seal validator; retain its full outcome outside the sealed roots.
// The new sibling receipt cannot be included in the seal that it subsequently verifies.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const receipt = join(dirname(root), "final-qualification-seal-verification-QrN8p4.json");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const ref = path => { const bytes = readFileSync(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; };
assert.ok(!existsSync(receipt), "Never overwrite a prior detached verification receipt.");
const validator = join(root, "validate-final-qualification.mjs"), command = [process.execPath, validator, "seal"];
const startedAt = new Date().toISOString();
const run = spawnSync(command[0], command.slice(1), { cwd: "C:/liquidation-watchdog", timeout: 120000, windowsHide: true,
  env: { ...process.env, NODE_OPTIONS: "", NODE_DISABLE_COMPILE_CACHE: "1" }, maxBuffer: 8 * 1024 ** 2 });
const stdout = run.stdout ?? Buffer.alloc(0), stderr = run.stderr ?? Buffer.alloc(0);
let parsed = null;
try { parsed = JSON.parse(stdout.toString("utf8")); } catch { /* Full unparsed stdout is still retained honestly. */ }
const pass = run.status === 0 && !run.error && parsed?.status === "PASS";
const result = { schemaVersion: 1, status: pass ? "PASS" : "FAIL_DOCUMENTARY_SEAL_VERIFICATION_NOT_SOFTWARE_TEST_QUALIFICATION",
  startedAt, completedAt: new Date().toISOString(), command, cwd: "C:/liquidation-watchdog", node: process.version,
  validator: ref(validator), captureTool: ref(fileURLToPath(import.meta.url)), exitCode: run.status, signal: run.signal,
  ...(run.error ? { error: { name: run.error.name, message: run.error.message } } : {}),
  stdout: { bytes: stdout.length, sha256: hash(stdout), text: stdout.toString("utf8") },
  stderr: { bytes: stderr.length, sha256: hash(stderr), text: stderr.toString("utf8") }, verification: parsed,
  coverage: "Post-seal read-only verification receipt outside both manifest roots; not covered by the seal it verifies. No self-reference or independent custody claim.",
  safety: { noApplicationImportDatabaseNetworkTestOrMonitoringCycle: true, noRepositoryOrSealedRootWrite: true,
    receiptIsOnlyNewWrite: true, noExistingArtifactOverwritten: true, monitor: "STOPPED" } };
writeFileSync(receipt, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: result.status, checksPassed: parsed?.checkGroupsPassed ?? null,
  checksFailed: parsed?.checkGroupsFailed ?? null, receipt: ref(receipt), sealedRootsWritten: false,
  software: "PASS", production: "NOT_ACCEPTED_NO_GO", monitor: "STOPPED" }, null, 2));
if (!pass) process.exitCode = 1;
