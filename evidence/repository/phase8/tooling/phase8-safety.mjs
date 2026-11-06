import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = "C:/liquidation-watchdog", temp = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const read = name => fs.readFileSync(path.join(root, name));
const json = name => JSON.parse(read(name));
const binding = name => ({ path: name, bytes: read(name).length, sha256: sha(read(name)) });
const check = (file, base = root) => {
  assert.ok(/^[A-Za-z0-9_./-]+$/.test(file.path) && !file.path.includes(".."), "Invalid historical path");
  assert.ok(!/(?:^|\/)\.env(?:$|\.(?!example$))/.test(file.path), "Private file refused");
  const info = fs.lstatSync(path.join(base, file.path));
  assert.ok(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, `Historical alias: ${file.path}`);
  const bytes = fs.readFileSync(path.join(base, file.path));
  assert.equal(bytes.length, file.bytes, `HISTORICAL MISMATCH — STOP: ${file.path}`);
  assert.equal(sha(bytes), file.sha256, `HISTORICAL MISMATCH — STOP: ${file.path}`);
};
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
const output = path.join(root, "evidence/phase8");
if (process.argv[2] === "init") {
  assert.equal(fs.existsSync(output), false, "Phase 8 output already exists; do not overwrite");
  assert.equal(sha(read("evidence/phase5/release-manifest.json")), "f9059fe0ad2fd031a505c79ea0e38397cc4eb624f6a4d7e0caee96463d581f3a");
  assert.equal(sha(read("evidence/phase6/evidence-hashes.json")), "15708b4f1000f1c1859010f6dabfc11c87d96391bcacb60662354ab122c4bda3");
  assert.equal(sha(read("docs/phase7-files.md")), "aeb1616cab83bec411bf2632f42c2b304039fba284d4d4c28dcbe38a8478a34d");
  const m = json("evidence/phase5/release-manifest.json");
  const p7Path = path.join(temp, "phase7-validation-fqzKjQ/phase7-file-bindings.json");
  const phase7 = JSON.parse(fs.readFileSync(p7Path)).files;
  const groups = { source: m.sourceInputs.files, build: m.build.files, documentation: m.documentation.files,
    phase1to4: json("evidence/phase5/prior-phases-baseline.json").files.filter(file => /^evidence\/phase[1-4]\//.test(file.path)),
    phase5: m.evidence.files, phase6: json("evidence/phase6/evidence-hashes.json").files, phase7 };
  for (const files of Object.values(groups)) files.forEach(file => check(file));
  const extras = ["evidence/phase5/release-manifest.json", "evidence/phase5/release-manifest.sha256", "evidence/phase5/release-manifest-check.json", "evidence/phase6/evidence-hashes.json"].map(binding);
  const files = [...new Map([...Object.values(groups).flat(), ...extras].map(file => [file.path, file])).values()].sort((a, b) => a.path.localeCompare(b.path));
  assert.equal(files.length, 1241);
  const snapshot = fs.mkdtempSync(path.join(temp, "phase8-original-"));
  for (const file of files) {
    const destination = path.join(snapshot, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, file.path), destination, fs.constants.COPYFILE_EXCL); check(file, snapshot);
  }
  const status = git(["status", "--porcelain=v1", "-z"]);
  fs.mkdirSync(output);
  const baseline = { kind: "PRE_PHASE8_EXCLUSIVE_BASELINE", capturedAt: new Date().toISOString(), files, originalSnapshot: snapshot,
    historicalBindingGroups: Object.fromEntries(Object.entries(groups).map(([name, entries]) => [name, entries.length])),
    gitIndexSha256: sha(read(".git/index")), gitStatusSha256: sha(status), gitStatusEntries: status.split("\0").filter(Boolean).length,
    runtime: { node: process.version, sqlite: process.versions.sqlite, platform: process.platform },
    policy: "Unexpected historical mismatch is a stop condition; no automatic recovery. Only explicit Phase 8 source/build changes are expected." };
  fs.writeFileSync(path.join(output, "pre-phase8-baseline.json"), JSON.stringify(baseline, null, 2) + "\n", { flag: "wx" });
  fs.writeFileSync(path.join(output, "phase7-file-bindings.json"), fs.readFileSync(p7Path), { flag: "wx" });
  fs.writeFileSync(path.join(snapshot, "git-status-before.txt"), status, { flag: "wx" });
  console.log(JSON.stringify({ passed: true, capturedAt: baseline.capturedAt, snapshot, originalFiles: files.length,
    groups: baseline.historicalBindingGroups, gitIndexSha256: baseline.gitIndexSha256, gitStatusEntries: baseline.gitStatusEntries }, null, 2));
} else if (process.argv[2] === "check") {
  const baseline = json("evidence/phase8/pre-phase8-baseline.json");
  const expectedChanges = new Set(["src/storage/store.ts", "scripts/release-inputs.ts", "dist/storage/store.js", "dist/storage/store.js.map", "dist/storage/store.d.ts"]);
  const modified = [], preserved = [];
  for (const file of baseline.files) {
    check(file, baseline.originalSnapshot);
    if (expectedChanges.has(file.path) && sha(read(file.path)) !== file.sha256) modified.push(binding(file.path));
    else { check(file); preserved.push(file.path); }
  }
  assert.equal(sha(read(".git/index")), baseline.gitIndexSha256, "GIT INDEX CHANGED — STOP");
  const result = { checkedAt: new Date().toISOString(), passed: true, immutableOriginalFilesMatched: preserved.length,
    expectedSourceOrBuildChanges: modified, originalSnapshotFilesMatched: baseline.files.length,
    phase7BindingsMatched: 7, gitIndexUnchanged: true, gitIndexSha256: baseline.gitIndexSha256 };
  console.log(JSON.stringify(result, null, 2));
} else throw new Error("Use init or check. This helper never restores or overwrites historical files.");
