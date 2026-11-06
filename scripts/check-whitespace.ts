import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { root, sha256 } from "./phase5-files.js";

// Include newly authored files without staging or changing the real Git index.
const temporary = await mkdtemp(join(process.platform === "win32" ? join(process.env.LOCALAPPDATA!, "Temp", "opencode") : tmpdir(), "watchdog-whitespace-"));
const empty = join(temporary, "empty.txt"); await writeFile(empty, "");
const git = (args: string[]) => new Promise<{ code: number; output: string }>((resolve, reject) => {
  const output: Buffer[] = [], child = spawn("git", args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 15_000, killSignal: "SIGKILL" });
  child.stdout.on("data", (bytes: Buffer) => { output.push(bytes); }); child.stderr.on("data", (bytes: Buffer) => { output.push(bytes); });
  child.on("error", reject); child.on("close", code => resolve({ code: code ?? 2, output: Buffer.concat(output).toString("utf8") }));
});
let passed: boolean, filesChecked = 0;
const failures: { path: string; code: number }[] = [];
try {
  const listing = await git(["ls-files", "--others", "--exclude-standard", "-z"]);
  if (listing.code !== 0) throw new Error("Cannot enumerate new project files.");
  for (const path of listing.output.split("\0").filter(Boolean)) {
    const name = path.split("/").at(-1)!;
    if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.includes("..") || path.startsWith("/")
      || (/(?:credentials|keystore|secrets)|^\.env/i.test(name) && !["check-secrets.ts", ".env.example", "secrets-check.txt"].includes(name))) {
      failures.push({ path: "REDACTED_UNSUPPORTED_PATH", code: 2 }); continue;
    }
    if (path === ".env.example" && sha256(await readFile(join(root, path))) !== "517c936b52b4489029ba6576c553cbfc2b052eebe638511b4d055ace99d22c69") {
      failures.push({ path, code: 2 }); continue;
    }
    const result = await git(["-c", "core.quotePath=false", "diff", "--no-index", "--check", "--", empty, path]);
    // --no-index may return 1 for differences. --check diagnostics, including whitespace errors, are never ignored.
    if (![0, 1].includes(result.code) || result.output.trim()) failures.push({ path, code: result.code });
    filesChecked += 1;
  }
  passed = failures.length === 0;
} finally { await rm(temporary, { recursive: true, force: true }); }
await writeFile(join(root, "evidence/phase5/project-whitespace.json"), JSON.stringify({ checkedAt: new Date().toISOString(), passed,
  command: "git diff --no-index --check -- <exclusive-empty-file> <each-untracked-project-file>", filesChecked, failures, gitIndexChanged: false }, null, 2) + "\n");
console.log(`New-file Git whitespace: ${passed ? "PASS" : "FAIL"}; ${filesChecked} files; real index unchanged.`);
if (!passed) { console.log(JSON.stringify(failures)); process.exitCode = 1; }
