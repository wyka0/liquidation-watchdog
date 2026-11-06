import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const root = "C:/liquidation-watchdog", temp = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode";
execFileSync(process.execPath, [path.join(temp, "phase8-safety.mjs"), "check"], { cwd: root, stdio: "inherit" });
const candidate = fs.mkdtempSync(path.join(temp, "phase8-verification-"));
const sha = bytes => createHash("sha256").update(bytes).digest("hex"), files = [];
const copy = name => {
  const source = path.join(root, name), target = path.join(candidate, name), info = fs.lstatSync(source);
  assert.ok(!info.isSymbolicLink(), "Aliased candidate input refused");
  const base = path.basename(name);
  assert.ok(!/^(?:\.env(?:\..*)?|\.npmrc|\.netrc|id_(?:rsa|ed25519)(?:\.pub)?|.*\.(?:pem|p12|pfx|key)|.*(?:keystore|credentials|secrets).*)$/i.test(base)
    || [".env.example", "check-secrets.ts", "secrets-check.txt"].includes(base), "Potential private input refused before read");
  if (info.isDirectory()) { fs.mkdirSync(target); for (const child of fs.readdirSync(source)) copy(`${name}/${child}`); return; }
  assert.ok(info.isFile() && info.nlink === 1, "Non-regular candidate input refused");
  if (base === ".env.example") assert.equal(sha(fs.readFileSync(source)), "517c936b52b4489029ba6576c553cbfc2b052eebe638511b4d055ace99d22c69");
  fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  const bytes = fs.readFileSync(target); files.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
};
for (const name of ["config", "deploy", "dist", "docs", "evidence", "scripts", "src", "test", ".env.example", ".gitattributes", ".gitignore",
  "eslint.config.mjs", "package.json", "package-lock.json", "README.md", "render.yaml", "tsconfig.json", "tsconfig.build.json", "vitest.config.ts", "vitest.integration.config.ts"]) copy(name);
fs.symlinkSync(path.join(root, "node_modules"), path.join(candidate, "node_modules"), "junction");
// Read-only Git commands use the existing repository metadata. No index or configuration is copied or written.
fs.writeFileSync(path.join(candidate, ".git"), `gitdir: ${root}/.git\n`, { flag: "wx" });
const record = { kind: "PHASE8_ISOLATED_LEGACY_VERIFICATION_CANDIDATE", createdAt: new Date().toISOString(), directory: candidate,
  copiedFiles: files.length, files, dependencies: "Existing installed node_modules through an external junction; no dependency installation or lockfile update",
  git: "Existing metadata referenced by a gitdir pointer; all child checks inherit GIT_OPTIONAL_LOCKS=0. No commit/stage/configuration write.",
  archivePolicy: "Legacy scripts may write candidate Phase 5 copies only. Main-tree Phase 1-7 evidence remains sealed." };
fs.writeFileSync(path.join(root, "evidence/phase8/verification-candidate.json"), JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ candidate, copiedFiles: files.length }));
