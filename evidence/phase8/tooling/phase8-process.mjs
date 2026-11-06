import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const root = "C:/liquidation-watchdog", filename = process.argv[2] ?? "process-state-final.json";
assert.ok(["process-state-final.json", "process-state-post-smoke.json"].includes(filename));
const patterns = ["%dist%service.js%", "%src%service.ts%", "%dist%cli.js%", "%src%cli.ts%", "%phase5-worker.ts%", "%phase8-runtime.ts%",
  "%monitoring-smoke.ts%", "%oracle-smoke.ts%", "%operations-smoke.ts%", "%phase5-stability.ts%", "%phase8-reliability.ts%"];
// WMI applies fixed process-name/command markers, but only PID/name properties are retrieved.
// No command line, environment value, credential or unrelated seller process is retrieved or stopped.
const filter = `Name = 'node.exe' AND (${patterns.map(pattern => `CommandLine LIKE '${pattern}'`).join(" OR ")})`;
const command = `$ErrorActionPreference = 'Stop'\n$items = @(Get-CimInstance Win32_Process -Filter \"${filter}\" -Property Name,ProcessId | Select-Object Name,ProcessId)\nConvertTo-Json -InputObject $items -Compress`;
const stdout = execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", command], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000 });
const processes = JSON.parse(stdout), result = { kind: "PHASE8_OWNED_RUNTIME_PROCESS_CLEANUP", checkedAt: new Date().toISOString(), passed: processes.length === 0,
  command: `node [REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/phase8-process.mjs${process.argv[2] ? ` ${filename}` : ""}`, query: { provider: "Win32_Process", filter, returnedProperties: ["Name", "ProcessId"] },
  matchingProcesses: processes, count: processes.length, commandLinesRetrieved: false, processesStoppedByThisCheck: 0,
  unrelatedSellerProcess: "NOT_TARGETED_OR_MODIFIED", productionServiceInstalled: false, indefiniteMonitoringStarted: false };
writeFileSync(`${root}/evidence/phase8/${filename}`, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(result, null, 2)); assert.equal(result.passed, true, "A runtime process remains; inspect ownership before any action");
