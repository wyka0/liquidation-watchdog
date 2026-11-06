// Baseline and allowlisted verification; repository and Git reads only. No Git index writes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = "C:/liquidation-watchdog", audit = dirname(fileURLToPath(import.meta.url));
const sha256 = content => createHash("sha256").update(content).digest("hex");
const save = (file, value) => writeFileSync(join(audit, file), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const git = args => {
  const result = spawnSync("git", ["--no-optional-locks", ...args], { cwd: repo,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" }, maxBuffer: 32 * 1024 ** 2 });
  if (result.error) throw result.error;
  return { exitCode: result.status, stdoutBytes: result.stdout.length, stdoutSha256: sha256(result.stdout),
    stderrBytes: result.stderr.length, stderrSha256: sha256(result.stderr) };
};
const files = root => {
  const result = [];
  const visit = directory => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name), info = lstatSync(path), key = relative(root, path).replaceAll("\\", "/");
      if (info.isSymbolicLink()) { const target = readlinkSync(path); result.push({ path: key, type: "SYMLINK", mode: info.mode, bytes: Buffer.byteLength(target), sha256: sha256(target), target }); }
      else if (info.isDirectory()) visit(path);
      else { assert.ok(info.isFile(), key); const content = readFileSync(path); result.push({ path: key, type: "FILE", mode: info.mode, bytes: content.length, sha256: sha256(content) }); }
    }
  };
  visit(root); return result.sort((a, b) => a.path.localeCompare(b.path));
};
const gitState = () => {
  const before = readFileSync(join(repo, ".git/index"));
  const state = { index: { bytes: before.length, sha256: sha256(before) }, status: git(["status", "--porcelain=v2", "--untracked-files=all", "-z"]),
    stagedDiff: git(["diff", "--cached", "--no-ext-diff", "--binary", "--"]), worktreeDiff: git(["diff", "--no-ext-diff", "--binary", "--"]),
    head: git(["rev-parse", "--verify", "HEAD"]), symbolicHead: git(["symbolic-ref", "-q", "HEAD"]) };
  assert.equal(sha256(readFileSync(join(repo, ".git/index"))), state.index.sha256); return state;
};
const startedAt = new Date().toISOString(), entries = files(repo), gitSnapshot = gitState();
const current = { schemaVersion: 1, repo, startedAt, completedAt: new Date().toISOString(), entries: entries.length,
  bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), files: entries, git: gitSnapshot };
if (process.argv[2] === "capture") {
  const stage2 = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/live-stage2-SGNCxp";
  current.priorStage2 = { directory: stage2, files: files(stage2), meaning: "Prior artifacts remain immutable historical evidence, including failed-run cleanup remnants." };
  save("baseline.json", current);
  console.log(JSON.stringify({ status: "BASELINE_CAPTURED", directory: audit, entries: current.entries, bytes: current.bytes,
    index: current.git.index, priorStage2Files: current.priorStage2.files.length, headExitCode: current.git.head.exitCode }, null, 2));
} else if (process.argv[2] === "verify") {
  const baselineBytes = readFileSync(join(audit, "baseline.json")), baseline = JSON.parse(baselineBytes);
  const allowed = existsSync(join(audit, "authorized-changes.json")) ? JSON.parse(readFileSync(join(audit, "authorized-changes.json"))).files : [];
  const prior = new Map(baseline.files.map(entry => [entry.path, entry])), now = new Map(current.files.map(entry => [entry.path, entry]));
  const changes = [...new Set([...prior.keys(), ...now.keys()])].filter(path => JSON.stringify(prior.get(path)) !== JSON.stringify(now.get(path)))
    .map(path => ({ path, before: prior.get(path) ?? null, after: now.get(path) ?? null }));
  const unexpected = changes.filter(change => !allowed.some(entry => entry.path === change.path
    && entry.beforeSha256 === change.before?.sha256 && entry.afterSha256 === change.after?.sha256));
  const missing = allowed.filter(entry => !changes.some(change => change.path === entry.path));
  const protectedGitUnchanged = ["index", "stagedDiff", "head", "symbolicHead"].every(field => JSON.stringify(current.git[field]) === JSON.stringify(baseline.git[field]));
  const priorStage2Unchanged = JSON.stringify(files(baseline.priorStage2.directory)) === JSON.stringify(baseline.priorStage2.files);
  const pass = unexpected.length === 0 && missing.length === 0 && protectedGitUnchanged && priorStage2Unchanged;
  const result = { schemaVersion: 1, status: pass ? "PASS" : "FAIL", startedAt, completedAt: new Date().toISOString(), baselineSha256: sha256(baselineBytes),
    baselineEntries: baseline.entries, currentEntries: current.entries, baselineBytes: baseline.bytes, currentBytes: current.bytes, changes,
    unexpected, missing, protectedGitUnchanged, priorStage2Unchanged, git: current.git,
    statusUnchanged: JSON.stringify(current.git.status) === JSON.stringify(baseline.git.status),
    worktreeDiffUnchanged: JSON.stringify(current.git.worktreeDiff) === JSON.stringify(baseline.git.worktreeDiff),
    preservationMeaning: "Every repository regular file/symlink outside the explicit before/after SHA-256 allowlist is unchanged, including .git and ignored artifacts. Index/staged diff/HEAD are unchanged. Existing unrelated user modifications remain preserved." };
  save(process.argv[3] ?? "preservation-report.json", result); console.log(JSON.stringify(result, null, 2)); if (!pass) process.exitCode = 1;
} else throw new Error("Use capture or verify.");
