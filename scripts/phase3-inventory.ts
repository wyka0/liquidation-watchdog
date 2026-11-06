import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { baseline, projectFiles, root, sha256 } from "./phase3-files.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";

if (CURRENT_EVIDENCE !== String("evidence/phase3")) throw new Error("Phase 3 inventory is sealed. Use phase4-inventory.ts.");

const original = await baseline(), files = await projectFiles();
files.add("docs/phase3-files.md"); files.add("evidence/phase3/file-changes.json");
const originalPaths = new Set(original.baseline.files.map(file => file.path));
const changed: { path: string; beforeSha256: string; afterSha256: string }[] = [], unchanged: string[] = [], missing: string[] = [];
for (const file of original.baseline.files) {
  if (!files.has(file.path)) { missing.push(file.path); continue; }
  const bytes = await readFile(join(root, file.path));
  const hash = sha256(bytes);
  if (hash === file.sha256 && bytes.length === file.bytes) unchanged.push(file.path);
  else changed.push({ path: file.path, beforeSha256: file.sha256, afterSha256: hash });
}
const added = [...files].filter(path => !originalPaths.has(path)).sort();
const corePaths = [...originalPaths].filter(path => /^(?:src\/(?:chain|mcp|morpho|oracle|validation|risk)\/|src\/config\/(?:risk|deployment)\.ts$|test\/fixtures\/)/.test(path));
const calculationAndReaderCoreUnchanged = corePaths.every(path => unchanged.includes(path));
await writeFile(join(root, "evidence/phase3/file-changes.json"), `${JSON.stringify({
  evidenceKind: "LOCAL_PHASE3_FILE_INVENTORY", generatedAt: new Date().toISOString(), baselineSha256: original.sha256,
  originalFileCount: originalPaths.size, added, changed, unchanged, missing, corePaths, calculationAndReaderCoreUnchanged,
  excluded: "Dependencies, build output, Git internals, coverage, local runtime data and symlinks. Only baseline public file contents were read."
}, null, 2)}\n`);
await writeFile(join(root, "docs/phase3-files.md"), [
  "# Phase 3 file inventory", "", "Generated against the exclusive pre-Phase-3 baseline of both completed phases.", "",
  `Original files: ${originalPaths.size}; changed: ${changed.length}; unchanged: ${unchanged.length}; missing: ${missing.length}; added: ${added.length}.`,
  `Phase 1 readers/accounting/oracle/validation and Phase 2 risk core: ${calculationAndReaderCoreUnchanged ? "byte-for-byte unchanged" : "CHECK REQUIRED"}.`, "",
  "Hashes and complete unchanged/core lists: `evidence/phase3/file-changes.json`. Runtime databases, dependencies, build output, Git internals, coverage and symlinks are excluded.", "",
  "## Changed original files", "", ...changed.map(file => `- \`${file.path}\``), "", "## Added files", "", ...added.map(path => `- \`${path}\``), "",
  "## Missing original files", "", ...(missing.length ? missing.map(path => `- \`${path}\``) : ["None."]), ""
].join("\n"));
console.log(`Phase 3 inventory: ${changed.length} changed; ${added.length} added; ${unchanged.length} unchanged; ${missing.length} missing; reader/risk core ${calculationAndReaderCoreUnchanged ? "PASS" : "FAIL"}.`);
if (missing.length || !calculationAndReaderCoreUnchanged) process.exitCode = 1;
