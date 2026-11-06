// Historical files are only read; SQLite inspection is performed on separate copies.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

const audit = dirname(fileURLToPath(import.meta.url));
const stage2 = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/live-stage2-SGNCxp";
const leftover = join(stage2, "unit-tmp/opencode/watchdog-phase3-fixture-aKX2ke");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const inventory = root => {
  const entries = [];
  const visit = directory => { for (const item of readdirSync(directory)) {
    const path = join(directory, item), stat = statSync(path);
    if (stat.isDirectory()) visit(path);
    else entries.push({ path: relative(root, path).replaceAll("\\", "/"), bytes: stat.size, sha256: hash(readFileSync(path)), modifiedAt: stat.mtime.toISOString() });
  } }; visit(root); return entries.sort((a, b) => a.path.localeCompare(b.path));
};
const testResult = name => {
  const path = join(stage2, name), bytes = readFileSync(path), unit = JSON.parse(bytes);
  return { path: name, bytes: bytes.length, sha256: hash(bytes), success: unit.success, files: unit.testResults.length,
    total: unit.numTotalTests, passed: unit.numPassedTests, failed: unit.numFailedTests,
    runtimeProcess: unit.testResults.filter(file => /runtime-process\.test\.ts$/.test(file.name)).map(file => ({ name: file.name,
      startTime: file.startTime, endTime: file.endTime, status: file.status, message: file.message,
      assertions: file.assertionResults.map(test => ({ title: test.title, status: test.status, durationMs: test.duration, failureMessages: test.failureMessages })) })) };
};
const before = inventory(leftover), copies = join(audit, "original-failure-database-copies"); mkdirSync(copies);
const databases = [];
for (const entry of before.filter(entry => entry.path.startsWith("storage/"))) {
  const copy = join(copies, entry.path.slice("storage/".length)); copyFileSync(join(leftover, entry.path), copy);
  assert.equal(hash(readFileSync(copy)), entry.sha256);
  const db = new DatabaseSync(copy, { readOnly: true, allowExtension: false });
  try {
    db.exec("PRAGMA query_only=ON");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row => String(row.name));
    const counts = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT count(*) AS count FROM "${table.replaceAll('"', '""')}"`).get().count]));
    databases.push({ path: entry.path, copiedSha256: entry.sha256, quickCheck: db.prepare("PRAGMA quick_check").all(), counts,
      ...(tables.includes("streams") ? { streams: db.prepare("SELECT scope,revision FROM streams").all(),
        cycles: db.prepare("SELECT id,scope,started_at,observed_at,completed_at,status FROM cycles ORDER BY started_at").all(),
        runtime: db.prepare("SELECT json_extract(runtime_json,'$.status') AS status,json_extract(runtime_json,'$.startedAt') AS startedAt,json_extract(runtime_json,'$.updatedAt') AS updatedAt FROM worker_runtime").all() } : {}) });
  } finally { db.close(); }
}
assert.deepEqual(inventory(leftover), before);
const originalGuardBytes = readFileSync(join(stage2, "test-network-guard.cjs"));
const correctedGuardBytes = readFileSync(join(stage2, "test-network-guard-v2.cjs"));
assert.equal(hash(correctedGuardBytes), "c20447118ed79039c832d6fdd171794659fcd905654e805adcd48ab67c614da6");
writeFileSync(join(audit, "test-network-guard-v2.cjs"), correctedGuardBytes, { flag: "wx" });
writeFileSync(join(audit, "negative-control-network-guard-v1.cjs"), originalGuardBytes, { flag: "wx" });
const guardRecords = readFileSync(join(stage2, "unit-network-guard.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const blocked = guardRecords.filter(record => record.outcome === "EXTERNAL_BLOCKED");
const powershell = spawnSync("powershell", ["-NoProfile", "-Command", "$p = @(Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -match 'phase8-runtime|phase8-import|live-stage2-SGNCxp|liquidation-watchdog' } | Select-Object ProcessId,ParentProcessId,@{Name='TaskClass';Expression={ if ($_.CommandLine -match 'phase8-runtime') { 'PHASE8_RUNTIME_FIXTURE' } elseif ($_.CommandLine -match 'phase8-import') { 'PHASE8_IMPORT_FIXTURE' } elseif ($_.CommandLine -match 'vitest') { 'VITEST' } else { 'OTHER_RELEVANT_NODE_DO_NOT_TOUCH' } }}); ConvertTo-Json -InputObject $p -Depth 3"], { encoding: "utf8", windowsHide: true });
assert.equal(powershell.status, 0);
const result = { schemaVersion: 1, inspectedAt: new Date().toISOString(), node: process.version,
  system: { logicalCpus: os.cpus().length, freeMemoryBytes: os.freemem(), totalMemoryBytes: os.totalmem() },
  originalFull: testResult("unit-tests.json"), originalFocused: testResult("runtime-rerun-tests.json"),
  retainedLeftover: { directory: leftover, files: before, databases, originalsUnchanged: true },
  originalGuard: { sha256: hash(originalGuardBytes), records: guardRecords.length, blockedRecords: blocked.length,
    blockedByKind: Object.fromEntries([...new Set(blocked.map(record => record.kind))].map(kind => [kind, blocked.filter(record => record.kind === kind).length])),
    blockedLocalIPC: blocked.filter(record => record.host === "LOCAL_IPC"),
    limitation: "The v1 log has no timestamps or IPC paths. Blocked LOCAL_IPC records do not demonstrate remote traffic and cannot assign a timeout phase or resource owner." },
  correctedGuard: { path: "test-network-guard-v2.cjs", sha256: hash(correctedGuardBytes), byteIdenticalCopy: true },
  relevantProcessesAtInspection: JSON.parse(powershell.stdout),
  constraints: { realMonitorStopped: true, onlySyntheticFailureDatabaseCopiesOpened: true, noRepositoryWrites: true, noProcessTermination: true } };
writeFileSync(join(audit, "original-failure-inspection.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(result, null, 2));
