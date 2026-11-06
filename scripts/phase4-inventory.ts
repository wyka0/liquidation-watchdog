import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { baseline, projectFiles, root, sha256 } from "./phase4-files.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";

if (CURRENT_EVIDENCE !== String("evidence/phase4")) throw new Error("Phase 4 inventory is sealed. Use phase5-inventory.ts.");

const original = await baseline(), files = await projectFiles();
files.add("docs/phase4-files.md"); files.add("evidence/phase4/file-changes.json");
const originals = new Set(original.baseline.files.map(file => file.path));
const changed: { path: string; beforeSha256: string; afterSha256: string }[] = [], unchanged: string[] = [], missing: string[] = [];
for (const file of original.baseline.files) {
  if (!files.has(file.path)) { missing.push(file.path); continue; }
  const bytes = await readFile(join(root, file.path)), hash = sha256(bytes);
  if (hash === file.sha256 && bytes.length === file.bytes) unchanged.push(file.path);
  else changed.push({ path: file.path, beforeSha256: file.sha256, afterSha256: hash });
}
const added = [...files].filter(path => !originals.has(path)).sort();
const corePaths = [...originals].filter(path => /^(?:src\/(?:chain|mcp|morpho|oracle|validation|risk)\/|src\/config\/(?:risk|deployment)\.ts$|test\/fixtures\/)/.test(path));
const calculationAndReaderCoreUnchanged = corePaths.every(path => unchanged.includes(path));
await writeFile(join(root, "evidence/phase4/file-changes.json"), JSON.stringify({
  evidenceKind: "LOCAL_PHASE4_FILE_INVENTORY", generatedAt: new Date().toISOString(), baselineSha256: original.sha256,
  originalFileCount: originals.size, added, changed, unchanged, missing, corePaths, calculationAndReaderCoreUnchanged
}, null, 2) + "\n");
await writeFile(join(root, "docs/phase4-files.md"), [
  "# Phase 4 file inventory", "", "Compared with the exclusive pre-Phase-4 baseline of Phases 1–3.", "",
  `Original files: ${originals.size}; changed: ${changed.length}; unchanged: ${unchanged.length}; missing: ${missing.length}; added: ${added.length}.`,
  `Original reader, validation, oracle-policy and Phase 2 risk core: ${calculationAndReaderCoreUnchanged ? "byte-for-byte unchanged" : "CHECK REQUIRED"}.`, "",
  "Hashes and full lists: [file changes](../evidence/phase4/file-changes.json). Runtime data, dependencies, build output, Git internals and coverage are excluded.", "",
  "## Modified original files", "", ...changed.map(file => `- \`${file.path}\``), "", "## Added files", "", ...added.map(path => `- \`${path}\``), "",
  "## Missing original files", "", ...(missing.length ? missing.map(path => `- \`${path}\``) : ["None."]), ""
].join("\n"));
console.log(`Phase 4 inventory: ${changed.length} changed; ${added.length} added; ${unchanged.length} unchanged; ${missing.length} missing; reader/risk core ${calculationAndReaderCoreUnchanged ? "PASS" : "FAIL"}.`);
if (missing.length || !calculationAndReaderCoreUnchanged) process.exitCode = 1;
