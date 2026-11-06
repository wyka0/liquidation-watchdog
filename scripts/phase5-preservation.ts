import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { baseline, projectFiles, root, sha256 } from "./phase5-files.js";

const original = await baseline(), files = await projectFiles();
const archive = original.baseline.files.filter(file => /^evidence\/phase[1234]\//.test(file.path));
const checks = await Promise.all(archive.map(async file => {
  const bytes = files.has(file.path) ? await readFile(join(root, file.path)) : null;
  return { path: file.path, unchanged: bytes !== null && bytes.length === file.bytes && sha256(bytes) === file.sha256 };
}));
const expected = new Set(archive.map(file => file.path));
const unexpected = [...files].filter(path => /^evidence\/phase[1234]\//.test(path) && !expected.has(path));
const gap = JSON.parse(await readFile(join(root, "evidence/phase5/gap-register-record.json"), "utf8")) as { sha256: string };
const gapRegisterUnchanged = sha256(await readFile(join(root, "docs/production-readiness-gaps.md"))) === gap.sha256;
const passed = checks.every(check => check.unchanged) && unexpected.length === 0 && gapRegisterUnchanged;
await writeFile(join(root, "evidence/phase5/prior-phases-integrity.json"), JSON.stringify({
  evidenceKind: "PHASE1_2_3_4_ARCHIVE_INTEGRITY", checkedAt: new Date().toISOString(), baselineSha256: original.sha256,
  passed, gapRegisterUnchanged, counts: [1, 2, 3, 4].map(phase => ({ phase, files: archive.filter(file => file.path.startsWith(`evidence/phase${phase}/`)).length })), checks, unexpected
}, null, 2) + "\n");
console.log(`Phase 1–4 evidence: ${checks.filter(check => check.unchanged).length}/${checks.length} unchanged; ${unexpected.length} unexpected; pre-implementation gap register ${gapRegisterUnchanged ? "PASS" : "FAIL"}.`);
if (!passed) process.exitCode = 1;
