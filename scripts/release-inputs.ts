import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { baseline, projectFiles, root, sha256 } from "./phase5-files.js";

export const FINAL_CHECKS = ["phase5-inventory", "documentation-links", "secrets-check", "project-whitespace-check", "git-diff-check"] as const;
export const VERIFICATION_CHECKS = ["typecheck", "lint", "test-unit", "test-operations", "test-integration", "test-stability", "build",
  "built-cli-smoke", "cli-inspect-smoke", "built-cli-risk-smoke", "built-cli-historical-risk-smoke", "historical-phase2-regression",
  "bounded-monitoring-restart-smoke", "operational-cli-smoke", "bounded-oracle-cli-smoke", "source-runtime-links", "dependency-audit",
  "phase1-evidence-integrity", "prior-phases-integrity", "phase2-exact-replays", "oracle-evidence-verification", ...FINAL_CHECKS] as const;
export const PHASE5_DOCUMENTS = ["docs/production-architecture.md", "docs/deployment.md", "docs/environment-variables.md", "docs/database-operations.md",
  "docs/operations-runbook.md", "docs/reliability-testing.md", "docs/production-security.md", "docs/rollback-and-recovery.md",
  "docs/release-readiness.md", "docs/phase5-report.md"] as const;
export const bindingSchema = z.object({ path: z.string().regex(/^[A-Za-z0-9_./-]+$/).refine(path => !path.includes("..") && !path.startsWith("/")),
  bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type FileBinding = z.infer<typeof bindingSchema>;

export async function bindings(paths: readonly string[]): Promise<FileBinding[]> {
  const result: FileBinding[] = [];
  for (const path of [...new Set(paths)].sort()) {
    bindingSchema.shape.path.parse(path);
    const absolute = join(root, path), info = await lstat(absolute);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink > 1) throw new Error("Release inputs must be regular unaliased project files.");
    const bytes = await readFile(absolute);
    result.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return result;
}
export const bindingHash = (files: readonly FileBinding[]) => sha256(JSON.stringify(files));

export async function documentationInputs() {
  const files = await bindings(["README.md", ...[...await projectFiles()].filter(path => path.startsWith("docs/") && path.endsWith(".md"))]);
  return { sha256: bindingHash(files), files };
}

/** Explicit source/configuration allowlist; never enumerate or open a private environment file. */
export async function sourceInputs() {
  const paths = [...await projectFiles()].filter(path => /^(?:src\/.*\.ts|scripts\/.*\.ts|test\/.*\.(?:ts|json)|config\/[^/]+\.example\.json|deploy\/[^/]+\.example)$/.test(path)
    || ["package.json", "package-lock.json", "tsconfig.json", "tsconfig.build.json", "vitest.config.ts", "vitest.integration.config.ts", "eslint.config.mjs", ".gitattributes", ".gitignore", ".env.example", "render.yaml", "config/render.json"].includes(path));
  if (paths.some(path => /(?:^|\/)(?:.*(?:credentials|keystore|secrets).*|\.env.*)$/i.test(path) && !["scripts/check-secrets.ts", ".env.example"].includes(path))) {
    throw new Error("A potential private file name is present in the release input set; it was not read.");
  }
  const files = await bindings(paths);
  return { sha256: bindingHash(files), files };
}
export async function buildInputs() {
  const paths: string[] = [];
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /\.(?:js|ts|map)$/.test(entry.name)) paths.push(path);
      else throw new Error("Unexpected build artifact.");
    }
  };
  await walk("dist");
  if (!paths.includes("dist/cli.js")) throw new Error("Built CLI is missing.");
  const files = await bindings(paths);
  return { sha256: bindingHash(files), files };
}
export async function assertSourceInputs(): Promise<Awaited<ReturnType<typeof sourceInputs>>> {
  const recorded = z.object({ sha256: z.string(), files: z.array(bindingSchema) }).parse(JSON.parse(await readFile(join(root, "evidence/phase5/verification-inputs.json"), "utf8")));
  const current = await sourceInputs();
  if (recorded.sha256 !== current.sha256 || JSON.stringify(recorded.files) !== JSON.stringify(current.files)) throw new Error("Source/configuration changed after verification began; a full verification is required.");
  await baseline();
  return current;
}
export function gitRevision() {
  try {
    const revision = execFileSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 }).trim();
    if (!/^[a-f0-9]{40,64}$/.test(revision)) throw new Error();
    return { revision, status: "AVAILABLE" as const, workingCopy: "LOCAL_UNCOMMITTED" as const };
  } catch { return { revision: null, status: "UNAVAILABLE_NO_VERIFIED_HEAD" as const, workingCopy: "LOCAL_UNCOMMITTED" as const }; }
}
