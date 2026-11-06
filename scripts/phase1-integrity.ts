import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { stringify } from "../src/domain/serialize.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const archive = join(root, "evidence/phase1");
const output = join(root, CURRENT_EVIDENCE);
const baselinePath = join(root, "evidence/phase2/phase1-evidence-baseline.json");
const fileSchema = z.object({ path: z.string(), bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const baselineSchema = z.object({
  evidenceKind: z.literal("PRE_PHASE2_ARCHIVE_BASELINE"), capturedAt: z.string(),
  files: z.array(fileSchema), projectFiles: z.array(fileSchema)
}).strict();
type FileHash = z.infer<typeof fileSchema>;
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

async function hashFile(path: string): Promise<FileHash> {
  const bytes = await readFile(join(root, path));
  return { path, bytes: bytes.length, sha256: sha256(bytes) };
}

async function archiveHashes(directory = archive): Promise<FileHash[]> {
  const files: FileHash[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error("Archive integrity check refuses symlinks.");
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await archiveHashes(path));
    else {
      if (!/\.(?:json|txt|sol)$/.test(entry.name)) throw new Error("Unexpected archive file type; file was not opened.");
      files.push(await hashFile(relative(root, path).replaceAll("\\", "/")));
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

const args = process.argv.slice(2);
if (args.length !== 1 || !["--capture", "--check"].includes(args[0] ?? "")) throw new Error("Use --capture once before Phase 2, or --check.");
await mkdir(output, { recursive: true });
const files = await archiveHashes();
if (args[0] === "--capture") {
  throw new Error("The Phase 1 baseline is sealed; capture is disabled after Phase 2.");
  /* Historical capture procedure, retained for provenance:
  // The Phase 1 inventory contains only the already-reviewed public project files.
  const inventory = await readFile(join(root, "docs/created-files.md"), "utf8");
  const paths = [...inventory.matchAll(/^- `([^`]+)`$/gm)].map(match => match[1]!);
  if (paths.some(path => !/^[A-Za-z0-9_./-]+$/.test(path) || path.includes("..") || path.startsWith("/"))) {
    throw new Error("Invalid Phase 1 inventory path.");
  }
  const projectFiles = await Promise.all(paths.map(hashFile));
  await writeFile(baselinePath, `${stringify({ evidenceKind: "PRE_PHASE2_ARCHIVE_BASELINE", capturedAt: new Date().toISOString(), files, projectFiles })}\n`, { encoding: "utf8", flag: "wx" });
  console.log(`Captured ${files.length} Phase 1 evidence hashes and ${projectFiles.length} original project hashes; baseline cannot be overwritten.`);
  */
} else {
  const baselineBytes = await readFile(baselinePath);
  const baseline = baselineSchema.parse(JSON.parse(baselineBytes.toString("utf8")));
  const expected = new Map(baseline.files.map(file => [file.path, file]));
  const current = new Map(files.map(file => [file.path, file]));
  const checks = [...new Set([...expected.keys(), ...current.keys()])].sort().map(path => ({
    path, expectedSha256: expected.get(path)?.sha256 ?? null, actualSha256: current.get(path)?.sha256 ?? null,
    unchanged: expected.get(path)?.sha256 === current.get(path)?.sha256 && expected.get(path)?.bytes === current.get(path)?.bytes
  }));
  const passed = checks.length > 0 && checks.every(check => check.unchanged);
  await writeFile(join(output, "phase1-evidence-integrity.json"), `${stringify({
    evidenceKind: "LOCAL_ARCHIVE_INTEGRITY_CHECK", checkedAt: new Date().toISOString(), baselineSha256: sha256(baselineBytes),
    baselineCapturedAt: baseline.capturedAt, originalFileCount: baseline.files.length, currentFileCount: files.length, passed, checks
  })}\n`, "utf8");
  console.log(`Phase 1 evidence preservation: ${passed ? "PASS" : "FAIL"}; ${checks.filter(check => check.unchanged).length}/${checks.length} byte-for-byte unchanged.`);
  if (!passed) process.exitCode = 1;
}
