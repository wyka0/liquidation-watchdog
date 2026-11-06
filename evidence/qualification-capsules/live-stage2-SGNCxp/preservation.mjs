import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = "C:/liquidation-watchdog";
const audit = dirname(fileURLToPath(import.meta.url));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const save = (name, value) => writeFileSync(join(audit, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const git = args => {
  const result = spawnSync("git", ["--no-optional-locks", ...args], {
    cwd: repo, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" }, maxBuffer: 32 * 1024 ** 2
  });
  if (result.error) throw result.error;
  return { exitCode: result.status, stdoutBytes: result.stdout.length, stdoutSha256: sha256(result.stdout),
    stderrBytes: result.stderr.length, stderrSha256: sha256(result.stderr) };
};
function files() {
  const entries = [];
  const visit = directory => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name), info = lstatSync(path), key = relative(repo, path).replaceAll("\\", "/");
      if (info.isSymbolicLink()) {
        const target = readlinkSync(path);
        entries.push({ path: key, type: "SYMLINK", mode: info.mode, bytes: Buffer.byteLength(target), sha256: sha256(target), target });
      } else if (info.isDirectory()) visit(path);
      else if (info.isFile()) {
        const bytes = readFileSync(path);
        entries.push({ path: key, type: "FILE", mode: info.mode, bytes: bytes.length, sha256: sha256(bytes) });
      } else throw new Error(`Unexpected filesystem object: ${key}`);
    }
  };
  visit(repo);
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
function gitState() {
  const before = readFileSync(join(repo, ".git/index"));
  const result = {
    index: { bytes: before.length, sha256: sha256(before) },
    status: git(["status", "--porcelain=v2", "--untracked-files=all", "-z"]),
    stagedDiff: git(["diff", "--cached", "--no-ext-diff", "--binary", "--"]),
    worktreeDiff: git(["diff", "--no-ext-diff", "--binary", "--"]),
    head: git(["rev-parse", "--verify", "HEAD"]),
    symbolicHead: git(["symbolic-ref", "-q", "HEAD"])
  };
  if (sha256(readFileSync(join(repo, ".git/index"))) !== result.index.sha256) throw new Error("A read-only Git command changed the index.");
  return result;
}

const startedAt = new Date().toISOString();
const entries = files(), gitSnapshot = gitState();
const current = { schemaVersion: 1, repo, startedAt, completedAt: new Date().toISOString(),
  entries: entries.length, bytes: entries.reduce((sum, file) => sum + file.bytes, 0), git: gitSnapshot, files: entries };
if (process.argv[2] === "capture") {
  save("baseline.json", current);
  console.log(JSON.stringify({ status: "BASELINE_CAPTURED", path: join(audit, "baseline.json"), entries: current.entries, bytes: current.bytes,
    index: current.git.index, headExitCode: current.git.head.exitCode, stagedDiffBytes: current.git.stagedDiff.stdoutBytes }));
} else if (process.argv[2] === "verify") {
  const baseline = JSON.parse(readFileSync(join(audit, "baseline.json"), "utf8"));
  const prior = new Map(baseline.files.map(file => [file.path, file]));
  const present = new Map(current.files.map(file => [file.path, file]));
  const added = current.files.filter(file => !prior.has(file.path)).map(file => file.path);
  const removed = baseline.files.filter(file => !present.has(file.path)).map(file => file.path);
  const changed = current.files.filter(file => prior.has(file.path) && JSON.stringify(file) !== JSON.stringify(prior.get(file.path))).map(file => file.path);
  const gitUnchanged = JSON.stringify(current.git) === JSON.stringify(baseline.git);
  const pass = !added.length && !removed.length && !changed.length && gitUnchanged;
  const result = { schemaVersion: 1, status: pass ? "PASS" : "FAIL", startedAt, completedAt: current.completedAt,
    baselineFile: "baseline.json", baselineSha256: sha256(readFileSync(join(audit, "baseline.json"))),
    baselineEntries: baseline.entries, currentEntries: current.entries, baselineBytes: baseline.bytes, currentBytes: current.bytes,
    added, removed, changed, gitUnchanged, git: current.git, indexUnchanged: current.git.index.sha256 === baseline.git.index.sha256 };
  save(process.argv[3] ?? "preservation-report.json", result);
  console.log(JSON.stringify(result));
  if (!pass) process.exitCode = 1;
} else throw new Error("Use capture or verify; this utility only reads repository bytes and read-only Git state.");
