import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const audit = dirname(fileURLToPath(import.meta.url));
const stage2 = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/live-stage2-SGNCxp";
const original = JSON.parse(readFileSync(join(stage2, "unit-tests.json")));
const runtime = original.testResults.find(file => /runtime-process\.test\.ts$/.test(file.name));
const failingStart = runtime.startTime + runtime.assertionResults.slice(0, 3).reduce((sum, test) => sum + test.duration, 0);
const originalOverlap = original.testResults.filter(file => file.name !== runtime.name && file.startTime <= runtime.endTime && file.endTime >= failingStart)
  .map(file => ({ file: file.name, start: new Date(file.startTime).toISOString(), end: new Date(file.endTime).toISOString(),
    tests: file.assertionResults.length, durationMs: file.endTime - file.startTime }));
const runs = process.argv.slice(2).map(name => {
  const records = readFileSync(join(audit, name, "process-lifecycle.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const unit = JSON.parse(readFileSync(join(audit, name, "tests.json")));
  const ms = (a, b) => a && b ? Number(BigInt(b.hrNs) - BigInt(a.hrNs)) / 1e6 : null;
  const children = records.filter(record => record.event === "child_created").map(created => {
    const pid = created.childPid, parent = records.filter(record => record.childPid === pid), local = records.filter(record => record.pid === pid);
    const event = (kind, value) => parent.find(record => record.event === kind && (value === undefined || record.value === value));
    const firstProbe = local.find(record => record.event === "workspace_probe_open"), reading = event("parent_ipc_message", "reading"), idle = event("parent_ipc_message", "idle");
    const sent = event("parent_ipc_send", "SIGTERM") ?? event("parent_ipc_send", "SIGINT"), close = event("child_close");
    return { pid, spawnAt: created.at, firstWorkspaceProbeAt: firstProbe?.at ?? null, readingAt: reading?.at ?? null, idleAt: idle?.at ?? null,
      closedAt: close?.at ?? null, spawnToWorkspaceMs: ms(created, firstProbe), spawnToReadingMs: ms(created, reading), spawnToIdleMs: ms(created, idle),
      signalToCloseMs: ms(sent, close), stateAtClose: close ?? null,
      databaseOpens: local.filter(record => record.event === "sqlite_open_done").length,
      explicitDatabaseCloses: local.filter(record => record.event === "sqlite_close_done").length,
      forcedOSDeath: close?.signal === "SIGKILL", stderrBytes: parent.filter(record => record.event === "child_stderr").reduce((sum, record) => sum + Buffer.byteLength(record.text), 0) };
  });
  return { name, success: unit.success, assertions: unit.testResults.flatMap(file => file.assertionResults.filter(test => test.status !== "pending")
    .map(test => ({ title: test.title, status: test.status, durationMs: test.duration }))), children,
    cleanupTimeline: records.filter(record => ["fixture_remove_call", "fixture_remove_done", "fixture_remove_error"].includes(record.event)) };
});
const result = { generatedAt: new Date().toISOString(), originalForcedTestStartApproximation: new Date(failingStart).toISOString(),
  timingCaveat: "Original assertion start is reconstructed by summing reported durations; small inter-test/hook gaps are not included. Original logs do not record individual child lifecycle times.",
  originalRuntimeFileEnd: new Date(runtime.endTime).toISOString(), originalOverlap, runs };
const output = `timing-analysis-${process.argv.slice(2).join('-')}.json`;
writeFileSync(join(audit, output), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(result, null, 2));
