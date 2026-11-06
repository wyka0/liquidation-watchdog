import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { root, sha256 } from "./phase3-files.js";
export { projectFiles, root, sha256 } from "./phase3-files.js";

const schema = z.object({ evidenceKind: z.literal("PRE_PHASE4_EXCLUSIVE_BASELINE"), capturedAt: z.iso.datetime(), files: z.array(z.object({
  path: z.string().regex(/^[A-Za-z0-9_./-]+$/).refine(path => !path.includes("..") && !path.startsWith("/")),
  bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/)
}).strict()) }).strict();
export async function baseline() {
  const bytes = await readFile(join(root, "evidence/phase4/prior-phases-baseline.json"));
  return { baseline: schema.parse(JSON.parse(bytes.toString("utf8"))), sha256: sha256(bytes) };
}
