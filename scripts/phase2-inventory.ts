import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { PHASE2_EVIDENCE } from "../src/config/evidence.js";
import { stringify } from "../src/domain/serialize.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
// The archived inventory is final. Use phase3-inventory.ts for new work.
throw new Error("Phase 2 inventory is sealed; run npm run evidence:inventory for Phase 3.");
const excluded = new Set([".git", "node_modules", "dist", "coverage"]);
const files = new Set<string>();
async function list(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.isSymbolicLink()) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await list(path);
    else files.add(relative(root, path).replaceAll("\\", "/"));
  }
}
await list(root);
// Include these generated outputs on their first run without a self-hash cycle.
files.add("docs/phase2-files.md");
files.add(`${PHASE2_EVIDENCE}/file-changes.json`);
const baselineBytes = await readFile(join(root, PHASE2_EVIDENCE, "phase1-evidence-baseline.json"));
const baseline = z.object({
  projectFiles: z.array(z.object({
    path: z.string().regex(/^[A-Za-z0-9_./-]+$/).refine(path => !path.includes("..") && !path.startsWith("/") && !path.startsWith(".git/")),
    bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/)
  }))
}).parse(JSON.parse(baselineBytes.toString("utf8")));
const originalPaths = new Set(baseline.projectFiles.map(file => file.path));
const changed: { path: string; beforeSha256: string; afterSha256: string }[] = [];
const unchanged: string[] = [];
const missing: string[] = [];
// Only the known, public Phase 1 inventory is opened for comparison. New file
// contents are not needed for an added/changed inventory; secrets are never read.
for (const original of baseline.projectFiles) {
  if (!files.has(original.path)) { missing.push(original.path); continue; }
  const bytes = await readFile(join(root, original.path));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest === original.sha256 && bytes.length === original.bytes) unchanged.push(original.path);
  else changed.push({ path: original.path, beforeSha256: original.sha256, afterSha256: digest });
}
const added = [...files].filter(path => !originalPaths.has(path)).sort();
changed.sort((a, b) => a.path.localeCompare(b.path));
unchanged.sort();
missing.sort();
const corePaths = [...originalPaths].filter(path => /^(?:src\/(?:chain|morpho|oracle|mcp|validation)\/|src\/domain\/types\.ts$|src\/config\/deployment\.ts$|test\/(?:accounting|validation|oracle|snapshot|transport)\.test\.ts$|test\/fixtures\/)/.test(path));
const phase1CoreUnchanged = corePaths.every(path => unchanged.includes(path));
await mkdir(join(root, PHASE2_EVIDENCE), { recursive: true });
await writeFile(join(root, PHASE2_EVIDENCE, "file-changes.json"), `${stringify({
  evidenceKind: "LOCAL_PHASE2_FILE_INVENTORY", generatedAt: new Date().toISOString(),
  baselineSha256: createHash("sha256").update(baselineBytes).digest("hex"),
  originalFileCount: originalPaths.size, added, changed, unchanged, missing,
  phase1CoreUnchanged, corePaths,
  excluded: "Git internals, node_modules, dist, coverage, and symbolic links. Added file names only; hashes compare the public pre-Phase-2 inventory."
})}\n`, "utf8");
await writeFile(join(root, "docs/phase2-files.md"), [
  "# Phase 2 file inventory", "",
  "Generated against the pre-Phase-2 baseline. Dependencies, build output, Git internals, and symlinks are excluded.", "",
  `Original files: ${originalPaths.size}; changed: ${changed.length}; unchanged: ${unchanged.length}; missing: ${missing.length}; added: ${added.length}.`,
  `Phase 1 read/accounting/oracle/validation code and original unit fixtures: ${phase1CoreUnchanged ? "byte-for-byte unchanged" : "CHECK REQUIRED"}.`, "",
  "Full original/current hashes and the preserved-file list: `evidence/phase2/file-changes.json`.", "",
  "## Changed original files", "", ...changed.map(file => `- \`${file.path}\``), "",
  "## Added files", "", ...added.map(path => `- \`${path}\``), "",
  "## Missing original files", "", ...(missing.length ? missing.map(path => `- \`${path}\``) : ["None."]), ""
].join("\n"), "utf8");
console.log(`Phase 2 inventory: ${changed.length} changed, ${added.length} added, ${unchanged.length} original files unchanged; Phase 1 core ${phase1CoreUnchanged ? "PASS" : "FAIL"}.`);
if (missing.length || !phase1CoreUnchanged) process.exitCode = 1;
