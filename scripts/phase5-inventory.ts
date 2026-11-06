import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { baseline, projectFiles, root, sha256 } from "./phase5-files.js";

const original = await baseline(), files = await projectFiles();
files.add("docs/phase5-files.md"); files.add("evidence/phase5/file-changes.json");
const originals = new Set(original.baseline.files.map(file => file.path));
const changed: { path: string; beforeSha256: string; afterSha256: string }[] = [], unchanged: string[] = [], missing: string[] = [];
for (const file of original.baseline.files) {
  if (!files.has(file.path)) { missing.push(file.path); continue; }
  const bytes = await readFile(join(root, file.path)), hash = sha256(bytes);
  if (hash === file.sha256 && bytes.length === file.bytes) unchanged.push(file.path);
  else changed.push({ path: file.path, beforeSha256: file.sha256, afterSha256: hash });
}
const added = [...files].filter(path => !originals.has(path)).sort();
// Phase 5 intentionally hardens transports/storage/config-file loading/evidence writes, without changing financial or assurance decisions.
const corePaths = [...originals].filter(path => /^(?:src\/(?:morpho|oracle|validation)\/|src\/risk\/(?!evidence\.ts)|src\/oracle-assurance\/(?:evaluate|freshness|independent|model|configuration|reviewed|units)\.ts$|src\/chain\/(?:snapshot|multicall)\.ts$|src\/config\/deployment\.ts$|test\/fixtures\/)/.test(path));
const protectedCoreUnchanged = corePaths.every(path => unchanged.includes(path));
const archiveUnchanged = original.baseline.files.filter(file => /^evidence\/phase[1-4]\//.test(file.path)).every(file => unchanged.includes(file.path))
  && !added.some(path => /^evidence\/phase[1-4]\//.test(path));
const passed = missing.length === 0 && protectedCoreUnchanged && archiveUnchanged;
await writeFile(join(root, "evidence/phase5/file-changes.json"), JSON.stringify({ evidenceKind: "PHASE5_FILE_INVENTORY", recordedAt: new Date().toISOString(),
  baselineSha256: original.sha256, passed, counts: { original: originals.size, unchanged: unchanged.length, changed: changed.length, added: added.length, missing: missing.length },
  protectedCoreUnchanged, protectedCore: corePaths.sort(), archiveUnchanged, changed, added, missing, unchanged: unchanged.sort() }, null, 2) + "\n");
const list = (paths: string[]) => paths.map(path => `- \`${path}\``).join("\n");
await writeFile(join(root, "docs/phase5-files.md"), `# Phase 5 file inventory\n\nGenerated against the exclusive pre-Phase-5 baseline (550 original files). See [machine-readable inventory](../evidence/phase5/file-changes.json) for before/after hashes and the full unchanged list. Private runtime databases/backups, dependencies and build output are excluded.\n\n` +
  `Original files: **${unchanged.length} unchanged, ${changed.length} modified, ${missing.length} missing**. New project/evidence files: **${added.length}**. Phase 1–4 archives: **${archiveUnchanged ? "UNCHANGED" : "FAIL"}**. Protected financial/assurance core and original fixtures: **${protectedCoreUnchanged ? "UNCHANGED" : "FAIL"}** (${corePaths.length} files). Authorized operational transport/storage/config-file/evidence-writer edits are listed below.\n\n` +
  `## Modified original files\n\n${list(changed.map(file => file.path).sort())}\n\n## Added files\n\n${list(added)}\n\n## Missing files\n\n${missing.length ? list(missing) : "None."}\n`);
console.log(`Phase 5 inventory: ${passed ? "PASS" : "FAIL"}; ${unchanged.length} unchanged, ${changed.length} modified, ${added.length} added, ${missing.length} missing; protected core ${protectedCoreUnchanged ? "unchanged" : "FAIL"}.`);
if (!passed) process.exitCode = 1;
