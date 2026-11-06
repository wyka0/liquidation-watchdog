import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = "C:/liquidation-watchdog", temp = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode";
const output = "evidence/phase8", candidate = path.join(temp, "phase8-verification-B1B2r7");
const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const allowedPrivateNames = new Set([".env.example", "check-secrets.ts", "secrets-check.txt"]);
function safe(name) {
  assert.ok(/^[A-Za-z0-9_./-]+$/.test(name) && !name.startsWith("/") && !name.split("/").includes(".."), "Unsupported inventory path");
  for (const base of name.split("/")) assert.ok(!/^(?:\.env(?:\..*)?|\.npmrc|\.netrc|id_(?:rsa|ed25519)(?:\.pub)?|.*\.(?:pem|p12|pfx|key)|.*(?:keystore|credentials|secrets).*)$/i.test(base)
    || allowedPrivateNames.has(base), "Potential private input refused before reading");
  return name;
}
function bytes(name, directory = root) {
  const file = path.join(directory, safe(name)), info = fs.lstatSync(file);
  assert.ok(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, "Non-regular inventory input");
  const value = fs.readFileSync(file);
  if (name === ".env.example") assert.equal(sha(value), "517c936b52b4489029ba6576c553cbfc2b052eebe638511b4d055ace99d22c69");
  return value;
}
const json = (name, directory = root) => JSON.parse(bytes(name, directory));
const binding = (name, directory = root) => { const value = bytes(name, directory); return { path: name, bytes: value.length, sha256: sha(value) }; };
const write = (name, value) => {
  const file = path.join(root, safe(name)); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
};
function tree(name, directory = root) {
  safe(name); const info = fs.lstatSync(path.join(directory, name));
  assert.ok(!info.isSymbolicLink(), "Aliased inventory directory");
  if (info.isFile()) return [name];
  assert.ok(info.isDirectory());
  return fs.readdirSync(path.join(directory, name)).sort().flatMap(child => tree(`${name}/${child}`, directory));
}
const command = (program, args, directory = root, timeout = 120_000) => {
  const result = spawnSync(program, args, { cwd: directory, env, encoding: "utf8", windowsHide: true, timeout, maxBuffer: 32 * 1024 ** 2 });
  return { command: [program === process.execPath ? "node" : program, ...args].join(" "), workingDirectory: directory,
    exitCode: result.status, signal: result.signal, runnerError: result.error?.code ?? null, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};
function safety() {
  const result = command(process.execPath, [path.join(temp, "phase8-safety.mjs"), "check"]);
  assert.equal(result.exitCode, 0, "Historical integrity failed; STOP without recovery");
  return { ...JSON.parse(result.stdout), command: result.command };
}
const api = await import(pathToFileURL(path.join(root, "scripts/release-inputs.ts")).href);
const baseline = json(`${output}/pre-phase8-baseline.json`), originals = new Map(baseline.files.map(file => [file.path, file]));
const source = await api.sourceInputs(), build = await api.buildInputs();
const candidateSource = json("evidence/phase5/verification-inputs.json", candidate);
const candidateBuild = json("evidence/phase5/build-artifacts.json", candidate);

function matchInputs() {
  assert.equal(source.sha256, candidateSource.sha256, "Main source differs from the verified candidate");
  assert.deepEqual(source.files, candidateSource.files);
  assert.equal(build.sha256, candidateBuild.sha256, "Main build differs from the verified candidate");
  assert.deepEqual(build.files, candidateBuild.files);
}
const requiredDocuments = ["docs/phase8-report.md", "docs/phase8-files.md", "docs/render-runtime-operations.md", "docs/render-dashboard-api.md", "docs/phase8-test-evidence.md"];

if (process.argv[2] === "collect") {
  const integrity = safety(); matchInputs();
  const verification = json("evidence/phase5/verification-results.json", candidate);
  const finalization = json("evidence/phase5/finalization-results.json", candidate);
  const releaseCheck = json("evidence/phase5/release-manifest-check.json", candidate);
  assert.equal(verification.passed, true); assert.equal(verification.results.length, 26);
  assert.equal(finalization.passed, true); assert.equal(finalization.results.length, 5); assert.equal(releaseCheck.passed, true);
  const initialCandidate = new Map(json(`${output}/verification-candidate.json`).files.map(file => [file.path, file]));
  const paths = [...tree("evidence/phase5", candidate), "docs/phase5-files.md"], files = [];
  for (const name of paths) {
    const current = binding(name, candidate), previous = initialCandidate.get(name);
    if (previous && previous.sha256 === current.sha256 && previous.bytes === current.bytes) continue;
    const destination = `${output}/verification/${name}${name.endsWith(".md") ? ".txt" : ""}`;
    fs.mkdirSync(path.dirname(path.join(root, destination)), { recursive: true });
    fs.copyFileSync(path.join(candidate, name), path.join(root, destination), fs.constants.COPYFILE_EXCL);
    assert.equal(binding(destination).sha256, current.sha256);
    files.push({ originalPath: name, storedPath: destination, bytes: current.bytes, sha256: current.sha256,
      change: previous ? "CANDIDATE_COPY_OVERWRITTEN_BY_LEGACY_CHECK" : "NEW_CANDIDATE_OUTPUT", beforeSha256: previous?.sha256 ?? null });
  }
  for (const name of initialCandidate.keys()) if (name.startsWith("evidence/phase5/") || name === "docs/phase5-files.md") {
    assert.ok(paths.includes(name), "Candidate input was unexpectedly removed");
  }
  const tests = {};
  for (const group of ["unit", "operations", "integration"]) {
    const report = json(`evidence/phase5/${group}-tests.json`, candidate);
    assert.equal(report.success, true); assert.equal(report.numFailedTests, 0); assert.equal(report.numPendingTests, 0); assert.equal(report.numTodoTests, 0);
    tests[group] = { total: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests,
      todo: report.numTodoTests, files: report.testResults.length };
    if (group === "unit") tests.phase8Runtime = report.testResults.filter(file => /[\\/]runtime-(?:storage|http|read-model|lifecycle|process)\.test\.ts$/.test(file.name))
      .map(file => ({ file: file.name.replaceAll("\\", "/").split("/test/").at(-1), passed: file.assertionResults.filter(test => test.status === "passed").length,
        failed: file.assertionResults.filter(test => test.status === "failed").length, tests: file.assertionResults.length }));
  }
  assert.equal(tests.phase8Runtime.reduce((sum, file) => sum + file.passed, 0), 47);
  write(`${output}/verification-provenance.json`, { kind: "PHASE8_ISOLATED_VERIFICATION_OUTPUTS", capturedAt: new Date().toISOString(), candidate,
    passed: true, files, unchangedCandidateOutputsResolvedAgainst: "verification-candidate.json and the preserved main-tree historical files",
    pathRule: "originalPath is relative to the isolated candidate. storedPath is the Phase 8 evidence copy. Markdown copies use .md.txt to retain bytes without advertising relocated links.",
    authority: "Legacy Phase 5 result/manifest labels are retained verbatim as compatibility-check evidence. They do not replace the historical main-tree manifest or serve as the Phase 8 deployment package.",
    tests, verification: { passed: verification.passed, startedAt: verification.startedAt, finishedAt: verification.finishedAt, checks: verification.results.length },
    finalization: { passed: finalization.passed, checks: finalization.results.length }, releaseCheck: { passed: releaseCheck.passed, manifestSha256: releaseCheck.manifestSha256 } });
  write(`${output}/implementation-inputs.json`, { kind: "PHASE8_LOCAL_IMPLEMENTATION_INPUTS", recordedAt: new Date().toISOString(), source, build,
    sourceMatchesFullVerificationCandidate: true, buildMatchesFullVerificationCandidate: true,
    historicalAuthority: { phase5: binding("evidence/phase5/release-manifest.json"), phase6: binding("evidence/phase6/evidence-hashes.json"), phase7: json(`${output}/phase7-file-bindings.json`).files },
    integrity, tests, productionApproval: false, deploymentPerformed: false, actionable: false });
  console.log(JSON.stringify({ passed: true, copiedEvidenceFiles: files.length, sourceFiles: source.files.length, buildFiles: build.files.length,
    sourceSha256: source.sha256, buildSha256: build.sha256, tests }, null, 2));
} else if (process.argv[2] === "archive-tools") {
  const files = [];
  for (const name of ["phase8-safety.mjs", "phase8-command.mjs", "phase8-candidate.mjs", "phase8-evidence.mjs", "phase8-process.mjs", "phase8-built-smoke.mjs", "phase8-signal-hook.mjs"]) {
    const destination = `${output}/tooling/${name}`;
    fs.mkdirSync(path.join(root, output, "tooling"), { recursive: true });
    fs.copyFileSync(path.join(temp, name), path.join(root, destination), fs.constants.COPYFILE_EXCL);
    const file = binding(destination); assert.equal(file.sha256, sha(fs.readFileSync(path.join(temp, name))));
    files.push({ ...file, source: path.join(temp, name) });
  }
  write(`${output}/tooling-provenance.json`, { kind: "PHASE8_EXTERNAL_HELPER_SOURCE_CAPTURE", capturedAt: new Date().toISOString(), files,
    note: "Exact final helper source. Earlier failed command attempts and their corrections are retained separately. Helpers never restore historical files." });
  const status = execFileSync("git", ["status", "--porcelain=v1", "-z"], { cwd: root, env });
  console.log(JSON.stringify({ passed: true, files: files.length, gitStatusEntries: status.toString("utf8").split("\0").filter(Boolean).length,
    gitStatusSha256: sha(status), sourceSha256: source.sha256, buildSha256: build.sha256 }, null, 2));
} else if (process.argv[2] === "checks") {
  const startedAt = new Date().toISOString(), integrity = safety(); matchInputs();
  for (const document of requiredDocuments) bytes(document);
  const report = bytes(requiredDocuments[0]).toString("utf8");
  const sections = [...report.matchAll(/^## (\d+)\. /gm)].map(match => Number(match[1]));
  assert.deepEqual(sections, Array.from({ length: 12 }, (_, index) => index + 1));
  const project = ["README.md", ...tree("docs"), ...tree(output)].filter(name => name.endsWith(".md")), links = [];
  for (const document of project) for (const match of bytes(document).toString("utf8").matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1]; if (/^(?:https?:|#)/.test(target)) continue;
    const resolved = path.resolve(root, path.dirname(document), target.split("#")[0]);
    links.push({ document, target, exists: fs.existsSync(resolved) });
  }
  const secret = command(process.execPath, ["--import", "tsx", "scripts/check-secrets.ts", "--read-only"]);
  const secretScan = JSON.parse(secret.stdout); assert.equal(secret.exitCode, 0); assert.equal(secretScan.passed, true);
  const diff = command("git", ["diff", "--check"]); assert.equal(diff.exitCode, 0); assert.equal(diff.stdout.trim(), ""); assert.equal(diff.stderr.trim(), "");
  const inputs = [...new Map([...source.files, ...build.files, ...requiredDocuments.map(name => binding(name)), ...tree(output).map(name => binding(name))].map(file => [file.path, file])).values()];
  const changed = inputs.filter(file => originals.get(file.path)?.sha256 !== file.sha256);
  const scratch = fs.mkdtempSync(path.join(temp, "phase8-whitespace-")), empty = path.join(scratch, "empty.txt"), whitespace = [];
  fs.writeFileSync(empty, "", { flag: "wx" });
  try {
    for (const file of changed) {
      const check = command("git", ["-c", "core.quotePath=false", "diff", "--no-index", "--check", "--", empty, file.path], root, 15_000);
      whitespace.push({ path: file.path, exitCode: check.exitCode, passed: [0, 1].includes(check.exitCode) && !(check.stdout + check.stderr).trim() });
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
  const passed = links.every(link => link.exists) && whitespace.every(check => check.passed);
  write(`${output}/main-final-checks.json`, { kind: "PHASE8_FINAL_MAIN_TREE_CHECKS", startedAt, finishedAt: new Date().toISOString(), passed,
    integrity, sourceMatchesCandidate: true, buildMatchesCandidate: true, checkedDocuments: requiredDocuments.map(name => binding(name)),
    reportSections: sections, documentationLinks: { passed: links.every(link => link.exists), checks: links },
    secretScan: { command: secret.command, exitCode: secret.exitCode, ...secretScan }, gitDiff: diff,
    whitespace: { command: "git -c core.quotePath=false diff --no-index --check -- <exclusive-empty-file> <each-new-or-modified-Phase8-input>",
      passed: whitespace.every(check => check.passed), filesChecked: whitespace.length, checks: whitespace } });
  console.log(JSON.stringify({ passed, links: links.length, whitespaceFiles: whitespace.length, secretScanFiles: secretScan.filesScanned,
    secretFindings: secretScan.findings.length, reportSections: sections.length }, null, 2));
  assert.equal(passed, true, "Final main-tree checks failed; see preserved result");
} else if (process.argv[2] === "seal") {
  const integrity = safety(); matchInputs(); assert.equal(json(`${output}/main-final-checks.json`).passed, true);
  assert.deepEqual(requiredDocuments.map(name => binding(name)), json(`${output}/main-final-checks.json`).checkedDocuments, "Documentation changed after final checks");
  assert.equal(json(`${output}/process-state-final.json`).passed, true);
  assert.equal(json(`${output}/process-state-post-smoke.json`).passed, true);
  assert.equal(json(`${output}/built-service-smoke.json`).passed, true);
  const provenance = json(`${output}/verification-provenance.json`);
  const helpers = ["phase8-safety.mjs", "phase8-command.mjs", "phase8-candidate.mjs", "phase8-evidence.mjs", "phase8-process.mjs", "phase8-built-smoke.mjs", "phase8-signal-hook.mjs"];
  for (const name of helpers) assert.ok(fs.existsSync(path.join(root, output, "tooling", name)), "Archive helper source before final checks");
  const status = execFileSync("git", ["status", "--porcelain=v1", "-z"], { cwd: root, env });
  const revision = api.gitRevision();
  assert.equal(revision.status, "UNAVAILABLE_NO_VERIFIED_HEAD", "Git HEAD changed during Phase 8; inspect without modifying it");
  fs.writeFileSync(path.join(root, output, "git-status-final.txt"), status, { flag: "wx" });
  const implementationFiles = [...new Map([...source.files, ...build.files, ...requiredDocuments.map(name => binding(name))].map(file => [file.path, file])).values()];
  const modified = implementationFiles.filter(file => originals.has(file.path) && originals.get(file.path).sha256 !== file.sha256)
    .map(file => ({ ...file, beforeSha256: originals.get(file.path).sha256 }));
  const added = implementationFiles.filter(file => !originals.has(file.path));
  write(`${output}/file-changes.json`, { kind: "PHASE8_IMPLEMENTATION_AND_DOCUMENT_DELTA", recordedAt: new Date().toISOString(), baseline: `${output}/pre-phase8-baseline.json`,
    modified, added, missingOriginalFiles: 0, originalFilesPreserved: integrity.immutableOriginalFilesMatched,
    originalSnapshotFilesPreserved: integrity.originalSnapshotFilesMatched, evidenceInventory: `${output}/evidence-index.json`, gitIndexUnchanged: true });
  const exclusions = [`${output}/evidence-index.json`, `${output}/phase8-seal.json`, `${output}/phase8-seal.sha256`, `${output}/seal-verification.json`];
  const evidenceFiles = tree(output).filter(name => !exclusions.includes(name)).map(name => binding(name));
  write(`${output}/evidence-index.json`, { kind: "PHASE8_NEW_EVIDENCE_HASH_INVENTORY", recordedAt: new Date().toISOString(), algorithm: "SHA-256",
    files: evidenceFiles, filesSha256: sha(JSON.stringify(evidenceFiles)), selfExcludedOutputs: exclusions });
  const finalFiles = [...implementationFiles, ...evidenceFiles, binding(`${output}/evidence-index.json`)].sort((a, b) => a.path.localeCompare(b.path));
  write(`${output}/phase8-seal.json`, { kind: "PHASE8_LOCAL_HANDOFF_SEAL", sealedAt: new Date().toISOString(), algorithm: "SHA-256", files: finalFiles,
    filesSha256: sha(JSON.stringify(finalFiles)), sourceSha256: source.sha256, buildSha256: build.sha256, tests: provenance.tests,
    integrity, git: { indexSha256: integrity.gitIndexSha256, statusSha256: sha(status), statusEntries: status.toString("utf8").split("\0").filter(Boolean).length,
      revision: revision.status, workingCopy: revision.workingCopy, indexModified: false, commitPushBranchTagOrIdentityChange: false },
    topology: "ONE_WEB_SERVICE_ONE_INSTANCE_ONE_DISK_ONE_MONITOR_PROCESS", phase8: "COMPLETE_LOCAL_IMPLEMENTATION_AND_VERIFICATION",
    separateDeploymentReviewReady: true, deploymentPerformed: false, productionApproval: false, actionable: false,
    limitations: ["RENDER_LINUX_ACCEPTANCE_OUTSTANDING", "BACKUP_SCHEDULE_AND_OFF_DISK_TRANSFER_AUTOMATION_OUTSTANDING", "PRODUCTION_DURATION_AND_CAPACITY_UNQUALIFIED"],
    selfExcludedOutputs: exclusions.filter(name => !name.endsWith("evidence-index.json")) });
  const seal = binding(`${output}/phase8-seal.json`);
  fs.writeFileSync(path.join(root, output, "phase8-seal.sha256"), `${seal.sha256}  phase8-seal.json\n`, { flag: "wx" });
  for (const file of finalFiles) assert.deepEqual(binding(file.path), file);
  const finalIntegrity = safety(), secret = command(process.execPath, ["--import", "tsx", "scripts/check-secrets.ts", "--read-only"]);
  const secretScan = JSON.parse(secret.stdout); assert.equal(secret.exitCode, 0); assert.equal(secretScan.passed, true);
  write(`${output}/seal-verification.json`, { kind: "PHASE8_DETACHED_SEAL_VERIFICATION", verifiedAt: new Date().toISOString(), passed: true,
    command: "node --import tsx [REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/phase8-evidence.mjs seal", sealSha256: seal.sha256,
    boundFilesMatched: finalFiles.length, finalIntegrity, secretScan: { command: secret.command, exitCode: secret.exitCode, ...secretScan },
    selfExcluded: "This post-seal result and the detached checksum are not recursively bound by the seal.",
    productionApproval: false, deploymentPerformed: false, actionable: false });
  console.log(JSON.stringify({ passed: true, sealSha256: seal.sha256, boundFiles: finalFiles.length, evidenceFiles: evidenceFiles.length,
    modifiedFiles: modified.length, addedImplementationAndDocumentFiles: added.length, gitStatusEntries: status.toString("utf8").split("\0").filter(Boolean).length,
    historicalFilesMatched: finalIntegrity.immutableOriginalFilesMatched, gitIndexUnchanged: true, secretFindings: secretScan.findings.length }, null, 2));
} else throw new Error("Use collect, archive-tools, checks or seal. Completed evidence files are exclusively created; no historical output is repaired.");
