import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const schema = z.object({ evidenceKind: z.literal("PRE_PHASE3_EXCLUSIVE_BASELINE"), capturedAt: z.string(), files: z.array(z.object({
  path: z.string().regex(/^[A-Za-z0-9_./-]+$/).refine(path => !path.includes("..") && !path.startsWith("/")),
  bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/)
}).strict()) }).strict();
export async function baseline() {
  const bytes = await readFile(join(root, "evidence/phase3/prior-phases-baseline.json"));
  return { baseline: schema.parse(JSON.parse(bytes.toString("utf8"))), sha256: sha256(bytes) };
}
export async function projectFiles(): Promise<Set<string>> {
  const files = new Set<string>();
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if ([".git", "node_modules", "dist", "coverage", "data", "backups"].includes(entry.name) || entry.isSymbolicLink()) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.add(relative(root, path).replaceAll("\\", "/"));
    }
  }
  await walk(root); return files;
}
