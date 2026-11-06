import { createHash, randomUUID } from "node:crypto";
import { constants, existsSync, lstatSync, mkdirSync, readFileSync, statfsSync } from "node:fs";
import { access, open, readFile, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { MonitoringConfiguration } from "../config/monitoring.js";
import { DataError } from "../domain/errors.js";
import { ISSUER_IDENTITY_EVIDENCE, REVIEWED_RECOMPILATION, REVIEWED_SOURCES } from "../oracle-assurance/reviewed.js";
import { verifyOracleBundle } from "../oracle-assurance/evidence.js";
import { requireEvidenceCapacity } from "../operations/resources.js";
import { hashFile } from "../storage/backup.js";
import { databasePath, localPath } from "../storage/paths.js";
import type { MonitorStore } from "../storage/store.js";

export const RENDER_DISK = "/var/data/watchdog";
export interface WorkspaceOptions { runtimeRoot: string; database: string; releaseRoot: string }
export interface RuntimeWorkspace extends WorkspaceOptions { diskRoot: string; seededFiles: number }
const fail = () => new DataError("RUNTIME_STORAGE", "Persistent workspace validation failed; no fallback or recovery was attempted.");
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const bindingSchema = z.object({ path: z.string().regex(/^evidence\/phase[1-5]\/[A-Za-z0-9_./-]+$/).refine(value => !value.includes("..")),
  bytes: z.number().int().nonnegative().max(32 * 1_024 ** 2), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
type Binding = z.infer<typeof bindingSchema>;

export function isDiskMount(mountInfo: string, diskRoot: string): boolean {
  return mountInfo.split("\n").some(line => {
    const fields = line.split(" "), separator = fields.indexOf("-");
    return fields[4] === diskRoot && fields[5]?.split(",").includes("rw") === true && separator > 5
      && !["tmpfs", "ramfs", "overlay"].includes(fields[separator + 1] ?? "");
  });
}

/** Trusted historical source/evidence binding; it is not a claim that old source verifies the new runtime. */
export function seedBindings(releaseRoot: string): Binding[] {
  const load = (name: string, hash: string): unknown => {
    const file = localPath(join(releaseRoot, name), { allowEvidence: true }), info = lstatSync(file);
    if (!info.isFile() || info.size > 2 * 1_024 ** 2) throw fail();
    const bytes = readFileSync(file);
    if (digest(bytes) !== hash) throw fail();
    return JSON.parse(bytes.toString("utf8")) as unknown;
  };
  const list = z.object({ files: z.array(z.object({ path: z.string(), bytes: z.number(), sha256: z.string() })) });
  const manifest = z.object({ evidence: list }).parse(load("evidence/phase5/release-manifest.json", "f9059fe0ad2fd031a505c79ea0e38397cc4eb624f6a4d7e0caee96463d581f3a"));
  const baseline = manifest.evidence.files.find(file => file.path === "evidence/phase5/prior-phases-baseline.json");
  if (!baseline) throw fail();
  const archive = [...list.parse(load(baseline.path, baseline.sha256)).files, ...manifest.evidence.files];
  const refs = [...REVIEWED_SOURCES, ...REVIEWED_RECOMPILATION, ISSUER_IDENTITY_EVIDENCE];
  for (const ref of refs) if (!archive.some(file => file.path === ref.source && file.sha256 === ref.artifactSha256)) throw fail();
  const required = (name: string) => refs.some(ref => name === ref.source || (/^evidence\/phase[45]\//.test(ref.source) && name.startsWith(`${dirname(ref.source).replaceAll("\\", "/")}/`)));
  return [...new Map(archive.filter(file => required(file.path)).map(file => [file.path, bindingSchema.parse(file)])).values()].sort((a, b) => a.path.localeCompare(b.path));
}

async function writableDirectory(directory: string): Promise<void> {
  localPath(directory, { allowEvidence: true });
  if (!lstatSync(directory).isDirectory()) throw fail();
  await access(directory, constants.R_OK | constants.W_OK | constants.X_OK);
  const probe = join(directory, `.watchdog-probe-${randomUUID()}`);
  const file = await open(probe, "wx", 0o600);
  try { await file.writeFile("storage-probe\n"); await file.sync(); }
  finally { await file.close(); await unlink(probe); }
}

export async function prepareWorkspace(options: WorkspaceOptions, configuration: MonitoringConfiguration, signal?: AbortSignal): Promise<RuntimeWorkspace> {
  try {
    const check = () => { if (signal?.aborted) throw fail(); }; check();
    if (![options.runtimeRoot, options.database, options.releaseRoot].every(isAbsolute)) throw fail();
    const runtimeRoot = localPath(options.runtimeRoot), diskRoot = dirname(runtimeRoot), database = databasePath(options.database);
    const releaseRoot = localPath(options.releaseRoot);
    const fromRelease = relative(releaseRoot, diskRoot), fromDisk = relative(diskRoot, releaseRoot);
    const outside = (path: string) => isAbsolute(path) || path === ".." || path.startsWith(`..${sep}`);
    if (basename(runtimeRoot) !== "runtime" || database !== join(diskRoot, "storage", "watchdog.sqlite")
      || configuration.storage.path !== database || !outside(fromRelease) || !outside(fromDisk)) throw fail();
    // Never create the disk root: a missing mount must not become an ephemeral directory.
    if (!lstatSync(diskRoot).isDirectory()) throw fail();
    if (configuration.operations.profile === "production") {
      if (process.platform !== "linux" || diskRoot !== RENDER_DISK
        || !isDiskMount(readFileSync("/proc/self/mountinfo", "utf8"), diskRoot)) throw fail();
    }
    const disk = statfsSync(diskRoot, { bigint: true });
    if (disk.bavail * disk.bsize < BigInt(configuration.resources.minFreeBytes)) throw fail();
    await writableDirectory(diskRoot); check();
    for (const directory of [runtimeRoot, dirname(database), join(diskRoot, "backups")]) {
      check(); localPath(directory); mkdirSync(directory, { recursive: true, mode: 0o700 }); await writableDirectory(directory); check();
    }
    const bindings = seedBindings(releaseRoot), missing: Binding[] = [];
    for (const file of bindings) {
      check();
      const source = localPath(join(releaseRoot, file.path), { allowEvidence: true });
      if (lstatSync(source).size !== file.bytes || await hashFile(source) !== file.sha256) throw fail();
      const target = localPath(join(runtimeRoot, file.path), { allowEvidence: true });
      if (existsSync(target)) {
        if (!lstatSync(target).isFile() || lstatSync(target).size !== file.bytes || await hashFile(target) !== file.sha256) throw fail();
      } else missing.push(file);
    }
    requireEvidenceCapacity(join(runtimeRoot, "evidence"), missing.reduce((sum, file) => sum + file.bytes, 0), missing.length, configuration.resources);
    for (const file of missing) {
      check();
      const target = localPath(join(runtimeRoot, file.path), { allowEvidence: true });
      mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
      const bytes = await readFile(localPath(join(releaseRoot, file.path), { allowEvidence: true }));
      check();
      if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw fail();
      const handle = await open(target, "wx", 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    }
    check();
    // Existing evidence captures live here; no writer is allowed to target the release archive.
    mkdirSync(localPath(join(runtimeRoot, "evidence/phase5"), { allowEvidence: true }), { recursive: true, mode: 0o700 });
    return { diskRoot, runtimeRoot, database, releaseRoot, seededFiles: bindings.length };
  } catch { throw fail(); }
}

/** Also fences disabled HTTP runtimes. SQLite releases this OS lock after process death. */
export function ownWorkspace(workspace: RuntimeWorkspace): () => void {
  let lock: DatabaseSync | undefined;
  try {
    const path = databasePath(join(workspace.diskRoot, "storage", "runtime-owner.sqlite"));
    lock = new DatabaseSync(path, { timeout: 0, allowExtension: false });
    lock.exec("BEGIN EXCLUSIVE");
    let closed = false;
    return () => { if (!closed) { closed = true; lock!.close(); } };
  } catch {
    lock?.close();
    throw new DataError("RUNTIME_ALREADY_RUNNING", "The persistent workspace already has an owner or cannot be locked.");
  }
}

export async function verifyWorkspaceReferences(store: MonitorStore, runtimeRoot: string, signal?: AbortSignal): Promise<void> {
  try {
    for (const ref of store.localEvidenceReferences()) {
      if (signal?.aborted) throw fail();
      const file = localPath(join(runtimeRoot, ref.path), { allowEvidence: true });
      if (!lstatSync(file).isFile() || lstatSync(file).size > 32 * 1_024 ** 2 || await hashFile(file) !== ref.sha256) throw fail();
    }
    for (const ref of store.evidenceBundles()) {
      if (signal?.aborted) throw fail();
      if ((await verifyOracleBundle(join(runtimeRoot, ref.path))).manifestSha256 !== ref.manifestSha256) throw fail();
    }
  } catch { throw fail(); }
}
