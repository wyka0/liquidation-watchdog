import { existsSync, lstatSync, readdirSync, statfsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { resourceSchema } from "../config/monitoring.js";
import type { ResourceLimits } from "../config/monitoring.js";
import { DataError } from "../domain/errors.js";
import { localPath } from "../storage/paths.js";
import type { MonitorStore } from "../storage/store.js";
import type { OperationalCode } from "./model.js";
import { CURRENT_EVIDENCE } from "../config/evidence.js";

export function diskStatistics(path: string) {
  const absolute = localPath(path, { allowEvidence: true });
  let parent = absolute;
  while (!existsSync(parent)) parent = dirname(parent);
  const fs = statfsSync(parent, { bigint: true });
  const size = (file: string) => existsSync(file) ? lstatSync(file).size : 0;
  return { databaseBytes: size(absolute), walBytes: size(`${absolute}-wal`), shmBytes: size(`${absolute}-shm`),
    freeBytes: Number(fs.bavail * fs.bsize), volumeBytes: Number(fs.blocks * fs.bsize) };
}

export function resourceStatus(path: string, store: MonitorStore, limits: ResourceLimits, rssBytes = process.memoryUsage().rss) {
  const issues: OperationalCode[] = [];
  try {
    const stats = store.statistics();
    const disk = path === ":memory:" ? { databaseBytes: stats.pageSize * stats.pageCount, walBytes: 0, shmBytes: 0, freeBytes: null, volumeBytes: null }
      : diskStatistics(path);
    if (Math.max(disk.databaseBytes, stats.pageSize * stats.pageCount) >= limits.databaseBytes) issues.push("RESOURCE_DATABASE_LIMIT");
    if (disk.walBytes >= limits.walBytes) issues.push("RESOURCE_WAL_LIMIT");
    if (disk.freeBytes !== null && disk.freeBytes < limits.minFreeBytes) issues.push("RESOURCE_DISK_RESERVE");
    if (stats.pendingDeliveries >= limits.pendingDeliveries) issues.push("RESOURCE_BACKLOG_LIMIT");
    if (rssBytes >= limits.rssBytes) issues.push("RESOURCE_MEMORY_LIMIT");
    return { ok: issues.length === 0, issues, disk, rssBytes, pendingDeliveries: stats.pendingDeliveries, limits };
  } catch { return { ok: false, issues: ["RESOURCE_CHECK_FAILED" as const], disk: null, rssBytes, pendingDeliveries: null, limits }; }
}

export function requireResources(path: string, store: MonitorStore, limits: ResourceLimits): void {
  const status = resourceStatus(path, store, limits);
  if (!status.ok) throw new DataError(status.issues[0]!, "A resource safeguard stopped new work. Required evidence and pending notifications were retained.");
}

/** Bounded metadata-only walk; existing evidence is never removed to make space. */
export function evidenceStatistics(root: string, limits: ResourceLimits = resourceSchema.parse({})) {
  const absolute = localPath(root, { allowEvidence: true });
  let bytes = 0, files = 0, directories = 0;
  const walk = (directory: string): void => {
    if (++directories > limits.evidenceFiles) throw new DataError("RESOURCE_EVIDENCE_LIMIT", "Evidence directory budget exceeded.");
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new DataError("EVIDENCE_LINK", "Evidence storage must not contain symbolic links.");
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) {
        bytes += lstatSync(path).size; files += 1;
        if (files > limits.evidenceFiles || bytes > limits.evidenceBytes) throw new DataError("RESOURCE_EVIDENCE_LIMIT", "Evidence budget exceeded; existing artifacts were retained.");
      } else throw new DataError("EVIDENCE_LINK", "Evidence storage must contain regular files and directories.");
    }
  };
  if (existsSync(absolute)) walk(absolute);
  return { bytes, files, directories };
}

export function requireEvidenceCapacity(root: string, addedBytes: number, addedFiles: number, limits = resourceSchema.parse({})): void {
  const stats = evidenceStatistics(root, limits), disk = diskStatistics(root);
  if (stats.bytes + addedBytes > limits.evidenceBytes || stats.files + addedFiles > limits.evidenceFiles) {
    throw new DataError("RESOURCE_EVIDENCE_LIMIT", "New capture exceeds the evidence budget; existing evidence was retained.");
  }
  if (disk.freeBytes - addedBytes < limits.minFreeBytes) throw new DataError("RESOURCE_DISK_RESERVE", "Evidence capture would cross the disk reserve.");
}

export function prepareEvidenceCapture(directory: string, documents: Readonly<Record<string, string>>): string {
  const target = localPath(directory, { allowEvidence: true });
  if (/(?:^|[\\/])evidence[\\/]phase[1-4](?:[\\/]|$)/i.test(target)) throw new DataError("EVIDENCE_PATH", "Prior evidence archives are sealed.");
  const current = resolve(CURRENT_EVIDENCE), child = relative(current, target);
  const root = child === "" || (!child.startsWith("..") && !/^(?:[A-Za-z]:|[\\/])/.test(child)) ? current : target;
  for (const [name, text] of Object.entries(documents)) {
    localPath(resolve(target, name), { allowEvidence: true });
    if (Buffer.byteLength(text) > 32 * 1_024 ** 2) throw new DataError("RESOURCE_EVIDENCE_LIMIT", "An evidence artifact exceeds the 32 MiB file budget.");
  }
  requireEvidenceCapacity(root, Object.values(documents).reduce((total, text) => total + Buffer.byteLength(text), 0) + 4_096, Object.keys(documents).length + 1);
  return target;
}
