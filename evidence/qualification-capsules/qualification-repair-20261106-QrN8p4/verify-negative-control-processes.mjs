// Independent OS-level post-control observation. No process is killed and failure remnants are not changed.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const audit = dirname(fileURLToPath(import.meta.url)), control = join(audit, "original-budget-latency-negative-control");
const summary = JSON.parse(readFileSync(join(control, "summary.json")));
assert.equal(summary.status, "FAIL"); assert.equal(summary.tests.failed, 1);
const children = summary.cleanup.children.map(child => child.pid), entries = [];
const visit = directory => { for (const item of readdirSync(directory).sort()) {
  const path = join(directory, item), info = statSync(path); if (info.isDirectory()) visit(path);
  else entries.push({ path: relative(control, path).replaceAll("\\", "/"), bytes: info.size,
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex") });
} }; visit(control);
const ps = `$recorded = @(${children.join(",")}); $all = @(Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\"); $related = @($all | Where-Object { $_.CommandLine -match 'phase8-runtime|phase8-import' } | Select-Object ProcessId,ParentProcessId,CreationDate,@{Name='TaskClass';Expression={'PHASE8_FIXTURE_DO_NOT_TERMINATE'}}); $pids = @($all | Where-Object { $recorded -contains $_.ProcessId } | Select-Object ProcessId,ParentProcessId,CreationDate,@{Name='IsRecordedControl';Expression={ $_.CommandLine -match 'original-budget-latency-negative-control' }}); ConvertTo-Json -InputObject @{ relevantFixtures=$related; recordedPidsStillPresent=$pids } -Depth 5`;
const result = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8", windowsHide: true }); assert.equal(result.status, 0);
const observation = JSON.parse(result.stdout), originalStillPresent = observation.recordedPidsStillPresent.filter(process => process.IsRecordedControl);
const evidence = { schemaVersion: 1, inspectedAt: new Date().toISOString(), status: observation.relevantFixtures.length === 0 && originalStillPresent.length === 0 ? "PASS" : "FAIL",
  recordedChildPids: children, osObservation: observation, failureArtifactsAndRemnant: entries,
  conclusions: { noRecordedControlProcessRemains: originalStillPresent.length === 0, noPhase8FixtureRemains: observation.relevantFixtures.length === 0,
    originalFailureRemnantRetained: summary.cleanup.remainingFixtureDirectories.length === 1,
    missingParentExitCloseTraceNotFabricated: true },
  limitations: ["Post-run CIM proves absence at observation time; it does not recover the resumed child's lost exit/close timestamp or distinguish worker termination from OS shutdown."],
  safety: { noProcessTermination: true, noRemnantModification: true, realMonitorStopped: true, readOnlyProcessAndFileInspection: true } };
writeFileSync(join(audit, "negative-control-independent-process-verification.json"), JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: evidence.status, recordedChildPids: children, osObservation: observation,
  conclusions: evidence.conclusions, retainedControlFiles: entries.length }, null, 2));
if (evidence.status !== "PASS") process.exitCode = 1;
