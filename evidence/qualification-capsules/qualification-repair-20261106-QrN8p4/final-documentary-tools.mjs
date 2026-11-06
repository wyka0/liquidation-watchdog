// Final-documentary helpers only: local bytes/JSON and exclusive new artifact writes.
// No application imports, database opens, network access, test execution or process termination.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const AUDIT = dirname(fileURLToPath(import.meta.url));
export const REPO = "C:/liquidation-watchdog";
export const STAGE2 = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/live-stage2-SGNCxp";
export const ROOTS = { REPAIR: AUDIT, STAGE2, REPOSITORY: REPO };
export const FILES = {
  baseline: "finalization-baseline.json", preservation: "preservation-seal.json",
  report: "FINAL-QUALIFICATION-REPAIR-REPORT.md", evidence: "final-qualification-evidence.json",
  validation: "final-report-validation.json", manifest: "final-artifact-manifest.json",
  manifestHash: "final-artifact-manifest.sha256", manifestVerification: "final-manifest-verification.json",
  completion: "final-completion.json", seal: "final-seal.json", sealHash: "final-seal.sha256"
};
export const ENVELOPE = new Set([FILES.manifest, FILES.manifestHash, FILES.manifestVerification, FILES.completion, FILES.seal, FILES.sealHash]);
export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export const json = path => JSON.parse(readFileSync(path, "utf8"));
export const text = path => readFileSync(path, "utf8");
export const load = (file, root = "REPAIR") => json(join(ROOTS[root], file));
export const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const portable = path => path.replaceAll("\\", "/");
export const norm = path => portable(resolve(path)).toLowerCase();
export const newText = (file, content) => writeFileSync(join(AUDIT, file), content, { flag: "wx" });
export const newJson = (file, content) => newText(file, JSON.stringify(content, null, 2) + "\n");

export function reference(file, root = "REPAIR") {
  const bytes = readFileSync(join(ROOTS[root], file));
  return { root, file: portable(file), bytes: bytes.length, sha256: sha256(bytes) };
}
export function referenceValid(ref) {
  const root = ROOTS[ref.root ?? "REPAIR"];
  if (!root || isAbsolute(ref.file)) return false;
  const path = resolve(root, ref.file);
  if (!norm(path).startsWith(norm(root) + "/") || !existsSync(path)) return false;
  const bytes = readFileSync(path);
  return bytes.length === ref.bytes && sha256(bytes) === ref.sha256;
}
export function absoluteReferenceValid(ref) {
  if (!Object.values(ROOTS).some(root => norm(ref.file).startsWith(norm(root) + "/"))) return false;
  if (!existsSync(ref.file)) return false;
  const bytes = readFileSync(ref.file);
  return bytes.length === ref.bytes && sha256(bytes) === ref.sha256;
}
export function inventory(root, exclusions = new Set()) {
  const entries = [];
  const visit = directory => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name), key = portable(relative(root, path));
      if (exclusions.has(key)) continue;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) {
        const target = readlinkSync(path);
        entries.push({ path: key, type: "SYMLINK", mode: stat.mode, bytes: Buffer.byteLength(target), sha256: sha256(target), target });
      } else if (stat.isDirectory()) visit(path);
      else {
        assert.ok(stat.isFile(), "Unexpected non-file artifact type");
        const bytes = readFileSync(path);
        entries.push({ path: key, type: "FILE", mode: stat.mode, bytes: bytes.length, sha256: sha256(bytes) });
      }
    }
  };
  visit(root);
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
export const totalBytes = entries => entries.reduce((sum, entry) => sum + entry.bytes, 0);
export function changes(before, after) {
  const old = new Map(before.map(entry => [entry.path, entry])), current = new Map(after.map(entry => [entry.path, entry]));
  return [...new Set([...old.keys(), ...current.keys()])].sort().filter(path => !equal(old.get(path), current.get(path)))
    .map(path => ({ path, before: old.get(path) ?? null, after: current.get(path) ?? null }));
}
export function preservedArtifacts() {
  const baseline = load(FILES.baseline), current = inventory(AUDIT), now = new Map(current.map(entry => [entry.path, entry]));
  const changedExistingRepairArtifacts = baseline.repair.files.filter(entry => !equal(entry, now.get(entry.path)));
  const stage2Files = inventory(STAGE2), stage2Changes = changes(baseline.stage2.files, stage2Files);
  return { status: changedExistingRepairArtifacts.length || stage2Changes.length ? "FAIL" : "PASS",
    baseline: reference(FILES.baseline), repairArtifactsRehashed: baseline.repair.files.length,
    repairBytesRehashed: totalBytes(baseline.repair.files), changedExistingRepairArtifacts: changedExistingRepairArtifacts.map(entry => entry.path),
    stage2FilesRehashed: stage2Files.length, stage2BytesRehashed: totalBytes(stage2Files), stage2Changes,
    newlyAddedRepairArtifacts: current.filter(entry => !baseline.repair.files.some(old => old.path === entry.path)).map(entry => entry.path) };
}
export function repositoryPreservation() {
  const baseline = load("baseline.json"), allowed = load("authorized-changes.json").files, current = inventory(REPO);
  const delta = changes(baseline.files, current);
  const unexpected = delta.filter(change => !allowed.some(item => item.path === change.path && item.beforeSha256 === change.before?.sha256
    && item.afterSha256 === change.after?.sha256 && change.before?.type === "FILE" && change.after?.type === "FILE"));
  return { status: current.length === baseline.entries && delta.length === allowed.length && unexpected.length === 0 ? "PASS" : "FAIL",
    entries: current.length, bytes: totalBytes(current), baselineEntries: baseline.entries, baselineBytes: baseline.bytes,
    changes: delta, unexpected, gitIndex: reference(".git/index", "REPOSITORY") };
}
export function testInventory(tests) {
  return tests.testResults.flatMap(file => file.assertionResults.map(test => `${norm(file.name)}|${test.fullName ?? [...(test.ancestorTitles ?? []), test.title].join(" ")}`)).sort();
}
export function retainFailure(mode, error, script) {
  const name = `documentary-operation-failure-${mode}-${Date.now()}.json`;
  newJson(name, { schemaVersion: 1, status: "FAIL_DOCUMENTARY_OPERATION_NOT_SOFTWARE_QUALIFICATION", recordedAt: new Date().toISOString(),
    operation: mode, tool: reference(script), node: process.version, error: { name: error.name, message: error.message, stack: error.stack },
    noTestsOrApplicationOrMonitorInvoked: true, noExistingArtifactOverwritten: true });
  console.error(error.stack);
  process.exitCode = 1;
}
