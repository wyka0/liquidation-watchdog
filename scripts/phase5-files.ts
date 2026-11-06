import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { root, sha256 } from "./phase3-files.js";
export { projectFiles, root, sha256 } from "./phase3-files.js";

const schema = z.object({ evidenceKind: z.literal("PRE_PHASE5_EXCLUSIVE_BASELINE"), capturedAt: z.iso.datetime(), files: z.array(z.object({
  path: z.string().regex(/^[A-Za-z0-9_./-]+$/).refine(path => !path.includes("..") && !path.startsWith("/")),
  bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/)
}).strict()) }).strict();
export async function baseline() {
  const bytes = await readFile(join(root, "evidence/phase5/prior-phases-baseline.json"));
  if (sha256(bytes) !== "043b6c7a7ae68515b7c17379619a090d24a01d361f5ba72816d89da97b93f9e2") throw new Error("Phase 5 baseline hash mismatch.");
  return { baseline: schema.parse(JSON.parse(bytes.toString("utf8"))), sha256: sha256(bytes) };
}
