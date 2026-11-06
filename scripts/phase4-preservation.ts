import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { baseline, projectFiles, root, sha256 } from "./phase4-files.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";

const original = await baseline(), files = await projectFiles();
const archive = original.baseline.files.filter(file => /^evidence\/phase[123]\//.test(file.path));
const checks = await Promise.all(archive.map(async file => {
  const bytes = files.has(file.path) ? await readFile(join(root, file.path)) : null;
  return { path: file.path, unchanged: bytes !== null && bytes.length === file.bytes && sha256(bytes) === file.sha256 };
}));
const expected = new Set(archive.map(file => file.path));
const unexpected = [...files].filter(path => /^evidence\/phase[123]\//.test(path) && !expected.has(path));
const passed = checks.every(check => check.unchanged) && unexpected.length === 0;
await writeFile(join(root, CURRENT_EVIDENCE, "phase4-prior-phases-integrity.json"), JSON.stringify({
  evidenceKind: "PHASE1_2_3_ARCHIVE_INTEGRITY", checkedAt: new Date().toISOString(), baselineSha256: original.sha256,
  passed, counts: [1, 2, 3].map(phase => ({ phase, files: archive.filter(file => file.path.startsWith(`evidence/phase${phase}/`)).length })), checks, unexpected
}, null, 2) + "\n");
console.log(`Phase 1–3 evidence: ${checks.filter(check => check.unchanged).length}/${checks.length} unchanged; ${unexpected.length} unexpected.`);
if (!passed) process.exitCode = 1;
