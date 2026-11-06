import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const [label, cwd, command] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label ?? "") || !cwd || !command) throw new Error("Use label cwd command");
const output = "C:/liquidation-watchdog/evidence/phase8/checks";
mkdirSync(output, { recursive: true });
const file = join(output, `${label}.json`);
if (existsSync(file)) throw new Error("Result already exists; use a new label");
const startedAt = new Date().toISOString(), start = performance.now();
process.env.GIT_OPTIONAL_LOCKS = "0";
const result = spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", command], {
  cwd, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 ** 2, timeout: 1800000
});
const record = { command, workingDirectory: cwd, startedAt, finishedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - start),
  exitCode: result.status, signal: result.signal, runnerError: result.error ? result.error.code ?? "EXECUTION_ERROR" : null,
  stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
writeFileSync(file, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ label, command, exitCode: record.exitCode, durationMs: record.durationMs, evidence: file }));
process.stdout.write(record.stdout); process.stderr.write(record.stderr);
process.exitCode = record.exitCode ?? 1;
