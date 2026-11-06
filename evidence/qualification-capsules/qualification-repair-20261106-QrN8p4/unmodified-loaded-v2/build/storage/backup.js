import { createHash } from "node:crypto";
import { constants, createReadStream, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { chmod, copyFile, lstat, open, readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { resourceSchema } from "../config/monitoring.js";
import { DataError } from "../domain/errors.js";
import { sha256, verifyOracleBundle } from "../oracle-assurance/evidence.js";
import { diskStatistics } from "../operations/resources.js";
import { localPath } from "./paths.js";
import { MonitorStore } from "./store.js";
import { validateDatabaseSchema } from "./validation.js";
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const bundleReference = z.object({ path: z.string().regex(/^evidence\/phase[45]\/[a-zA-Z0-9_-]+$/), manifestSha256: digest }).strict();
const artifactPath = z.string().regex(/^evidence\/phase[1-5]\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,150}$/).refine(path => !path.includes(".."));
const evidenceSchema = z.object({
    databaseBundles: z.array(bundleReference).max(1_000), bundles: z.array(bundleReference).max(1_000),
    references: z.array(z.object({ path: artifactPath, sha256: digest }).strict()).max(1_000),
    files: z.array(z.object({ path: artifactPath, bytes: z.number().int().nonnegative().max(32 * 1_024 ** 2), sha256: digest }).strict()).max(50_000)
}).strict();
const manifestSchema = z.object({
    format: z.literal(1), kind: z.literal("CONSISTENT_SQLITE_BACKUP"), createdAt: z.iso.datetime(),
    nodeVersion: z.string().regex(/^v[0-9]+\.[0-9]+\.[0-9]+$/), sqliteVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
    schemaVersion: z.number().int().positive(),
    database: z.object({ file: z.literal("database.sqlite"), bytes: z.number().int().positive(), sha256: digest,
        tableHashes: z.record(z.string().regex(/^[a-z_]+$/), digest), counts: z.record(z.string().regex(/^[a-z_]+$/), z.number().int().nonnegative()) }).strict(),
    evidence: evidenceSchema,
    semantics: z.literal("POINT_IN_TIME_WITH_PENDING_AND_AMBIGUOUS_DELIVERIES"), actionable: z.literal(false)
}).strict();
export async function hashFile(path) {
    const hash = createHash("sha256");
    for await (const bytes of createReadStream(path))
        hash.update(bytes);
    return hash.digest("hex");
}
async function exclusiveFile(path, text) {
    const file = await open(path, "wx", 0o600);
    try {
        await file.writeFile(text);
        await file.sync();
    }
    finally {
        await file.close();
    }
}
async function evidenceInventory(store, root) {
    const databaseBundles = store.evidenceBundles(), references = store.localEvidenceReferences();
    const bundles = new Map(databaseBundles.map(ref => [ref.path, ref.manifestSha256])), paths = new Set();
    for (const ref of references) {
        artifactPath.parse(ref.path);
        const path = localPath(join(root, ref.path), { allowEvidence: true });
        if ((await lstat(path)).size > 32 * 1_024 ** 2)
            throw new DataError("BACKUP_EVIDENCE", "Reviewed artifact exceeds the bounded file policy.");
        if (await hashFile(path) !== ref.sha256)
            throw new DataError("BACKUP_EVIDENCE", "A reviewed evidence reference differs from its persisted content hash.");
        if (/^evidence\/phase[45]\//.test(ref.path)) {
            const parent = ref.path.slice(0, ref.path.lastIndexOf("/"));
            const checked = await verifyOracleBundle(join(root, parent));
            if (bundles.has(parent) && bundles.get(parent) !== checked.manifestSha256)
                throw new Error();
            bundles.set(parent, checked.manifestSha256);
        }
        paths.add(ref.path);
    }
    for (const [path, manifestSha256] of bundles) {
        const source = localPath(join(root, path), { allowEvidence: true });
        if ((await verifyOracleBundle(source)).manifestSha256 !== manifestSha256)
            throw new DataError("BACKUP_EVIDENCE", "An evidence bundle differs from its database binding.");
        for (const entry of await readdir(source))
            paths.add(`${path}/${entry}`);
    }
    const files = [];
    for (const path of [...paths].sort()) {
        artifactPath.parse(path);
        const absolute = localPath(join(root, path), { allowEvidence: true }), info = await lstat(absolute);
        if (!info.isFile() || info.size > 32 * 1_024 ** 2)
            throw new DataError("BACKUP_EVIDENCE", "Evidence artifact exceeds the bounded regular-file policy.");
        files.push({ path, bytes: info.size, sha256: await hashFile(absolute) });
    }
    return evidenceSchema.parse({ databaseBundles, references, files,
        bundles: [...bundles].sort(([a], [b]) => a.localeCompare(b)).map(([path, manifestSha256]) => ({ path, manifestSha256 })) });
}
async function verifyInventory(root, evidence) {
    const files = new Set(["database.sqlite", "manifest.json", "manifest.sha256", ...evidence.files.map(file => file.path)]);
    const directories = new Set();
    for (const path of files) {
        let parent = path;
        while (parent.includes("/")) {
            parent = parent.slice(0, parent.lastIndexOf("/"));
            directories.add(parent);
        }
    }
    const visited = new Set();
    const walk = async (path) => {
        for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
            const relativePath = path ? `${path}/${entry.name}` : entry.name;
            localPath(join(root, relativePath), { allowEvidence: true });
            if (entry.isDirectory() && directories.has(relativePath))
                await walk(relativePath);
            else if (entry.isFile() && files.has(relativePath))
                visited.add(relativePath);
            else
                throw new Error();
        }
    };
    await walk("");
    if (visited.size !== files.size)
        throw new Error();
}
/** Online backup uses sqlite3_backup, never a raw copy of a live database or its WAL. */
export async function createBackup(source, output, options = {}) {
    const target = localPath(output);
    if (existsSync(target))
        throw new DataError("BACKUP_EXISTS", "Backup directory must be new; existing backups are never overwritten.");
    const store = new MonitorStore(source, { readOnly: true, allowLegacy: true });
    let created = false;
    try {
        const stats = store.statistics(), limits = resourceSchema.parse(options.limits ?? {});
        if (diskStatistics(dirname(target)).freeBytes < stats.pageCount * stats.pageSize + limits.minFreeBytes) {
            throw new DataError("RESOURCE_DISK_RESERVE", "Backup would cross the disk reserve.");
        }
        mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
        mkdirSync(target, { mode: 0o700 });
        created = true;
        const path = join(target, "database.sqlite");
        await store.backupTo(path);
        // The new, private backup is closed to writers. DELETE mode makes a standalone immutable artifact.
        const offline = new DatabaseSync(path, { allowExtension: false });
        try {
            offline.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;");
            validateDatabaseSchema(offline, false, true);
        }
        finally {
            offline.close();
        }
        await chmod(path, 0o600);
        const snapshot = new MonitorStore(path, { readOnly: true, allowLegacy: true });
        let manifest;
        try {
            snapshot.validateAll();
            const snapshotStats = snapshot.statistics(), projectRoot = options.projectRoot ?? process.cwd();
            const evidence = await evidenceInventory(snapshot, projectRoot), evidenceBytes = evidence.files.reduce((total, file) => total + file.bytes, 0);
            if (evidence.files.length > limits.evidenceFiles || evidenceBytes > limits.evidenceBytes)
                throw new DataError("RESOURCE_EVIDENCE_LIMIT", "Required backup evidence exceeds its configured budget.");
            if (diskStatistics(target).freeBytes < evidenceBytes + limits.minFreeBytes)
                throw new DataError("RESOURCE_DISK_RESERVE", "Backup evidence would cross the disk reserve.");
            for (const file of evidence.files) {
                const destination = join(target, file.path);
                mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
                await copyFile(localPath(join(projectRoot, file.path), { allowEvidence: true }), destination, constants.COPYFILE_EXCL);
                await chmod(destination, 0o600);
            }
            manifest = manifestSchema.parse({ format: 1, kind: "CONSISTENT_SQLITE_BACKUP", createdAt: (options.now ?? (() => new Date()))().toISOString(),
                nodeVersion: process.version, sqliteVersion: snapshotStats.sqliteVersion, schemaVersion: snapshot.schemaVersion,
                database: { file: "database.sqlite", bytes: (await lstat(path)).size, sha256: await hashFile(path), tableHashes: snapshot.contentHashes(), counts: snapshotStats.counts },
                evidence, semantics: "POINT_IN_TIME_WITH_PENDING_AND_AMBIGUOUS_DELIVERIES", actionable: false });
        }
        finally {
            snapshot.close();
        }
        const text = JSON.stringify(manifest, null, 2) + "\n", manifestSha256 = sha256(text);
        await exclusiveFile(join(target, "manifest.json"), text);
        await exclusiveFile(join(target, "manifest.sha256"), `${manifestSha256}  manifest.json\n`);
        const verified = await verifyBackup(target);
        return { ...verified, created: true, mechanism: "SQLITE_ONLINE_BACKUP_API" };
    }
    catch (error) {
        // Retain partial captures for investigation. Absence of a verified final manifest means unusable.
        if (error instanceof DataError)
            throw error;
        throw new DataError("BACKUP_FAILED", created ? "Backup failed; the exclusive incomplete directory was retained." : "Backup could not be created.");
    }
    finally {
        store.close();
    }
}
async function readManifest(directory) {
    const path = localPath(join(directory, "manifest.json")), info = await lstat(path);
    if (!info.isFile() || info.size > 32 * 1_024 ** 2)
        throw new Error();
    const bytes = await readFile(path), manifest = manifestSchema.parse(JSON.parse(bytes.toString("utf8"))), manifestSha256 = sha256(bytes);
    const hashPath = localPath(join(directory, "manifest.sha256"));
    if ((await lstat(hashPath)).size > 128 || await readFile(hashPath, "utf8") !== `${manifestSha256}  manifest.json\n`)
        throw new Error();
    return { manifest, manifestSha256 };
}
export async function verifyBackup(directory) {
    const root = localPath(directory);
    try {
        const { manifest, manifestSha256 } = await readManifest(root);
        await verifyInventory(root, manifest.evidence);
        const path = localPath(join(root, "database.sqlite"), { database: true });
        if ((await lstat(path)).size !== manifest.database.bytes || await hashFile(path) !== manifest.database.sha256)
            throw new Error();
        const snapshot = new MonitorStore(path, { readOnly: true, allowLegacy: true });
        try {
            snapshot.validateAll();
            if (snapshot.schemaVersion !== manifest.schemaVersion || JSON.stringify(snapshot.contentHashes()) !== JSON.stringify(manifest.database.tableHashes)
                || JSON.stringify(snapshot.statistics().counts) !== JSON.stringify(manifest.database.counts)
                || JSON.stringify(await evidenceInventory(snapshot, root)) !== JSON.stringify(manifest.evidence))
                throw new Error();
        }
        finally {
            snapshot.close();
        }
        return { passed: true, manifestSha256, schemaVersion: manifest.schemaVersion, databaseSha256: manifest.database.sha256,
            counts: manifest.database.counts, evidenceBundles: manifest.evidence.bundles.length, evidenceFiles: manifest.evidence.files.length,
            reviewedReferences: manifest.evidence.references.length, actionable: false };
    }
    catch {
        throw new DataError("BACKUP_INVALID", "Backup inventory, schema, content, evidence or integrity validation failed; nothing was restored.");
    }
}
/** Restore only into an exclusively created scratch directory and destroy only that scratch directory. */
export async function verifyRestore(directory, scratchRoot = "data/restore-verification", maxAttempts = 5) {
    const source = localPath(directory), root = localPath(scratchRoot);
    const between = relative(source, root);
    if (!between || (!between.startsWith("..") && !/^([A-Za-z]:|[\\/])/.test(between)))
        throw new DataError("RESTORE_PATH", "Restore verification must be outside the backup directory.");
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
        throw new DataError("RESTORE_POLICY", "Restore verification needs the configured retry budget.");
    const verified = await verifyBackup(source), before = await readManifest(source);
    mkdirSync(root, { recursive: true, mode: 0o700 });
    const scratch = mkdtempSync(join(root, "isolated-")), destination = join(scratch, "restored.sqlite");
    let restored;
    try {
        const backup = new MonitorStore(join(source, "database.sqlite"), { readOnly: true, allowLegacy: true });
        try {
            await backup.backupTo(destination);
        }
        finally {
            backup.close();
        }
        const beforeMigration = new MonitorStore(destination, { readOnly: true, allowLegacy: true });
        try {
            if (JSON.stringify(beforeMigration.contentHashes()) !== JSON.stringify(before.manifest.database.tableHashes))
                throw new Error();
        }
        finally {
            beforeMigration.close();
        }
        restored = new MonitorStore(destination);
        restored.acquireMonitor();
        restored.validateAll();
        const hashes = restored.contentHashes();
        for (const table of ["streams", "cycles", "alerts", "fingerprints", "deliveries", "delivery_attempts", "delivery_events", "provider_limits", "oracle_assurance"]) {
            if (table === "provider_limits" && verified.schemaVersion < 3)
                continue; // Migration 3 appends blocked=0; original bytes were checked before migration.
            if (before.manifest.database.tableHashes[table] !== undefined && hashes[table] !== before.manifest.database.tableHashes[table])
                throw new Error();
        }
        const deliveredBefore = restored.knownDeliveredHash(), restoredSchemaVersion = restored.schemaVersion;
        const recoveredAmbiguous = restored.recoverDeliveries(new Date().toISOString(), maxAttempts);
        restored.validateAll();
        if (deliveredBefore !== restored.knownDeliveredHash())
            throw new Error();
        const after = restored.contentHashes();
        if (["streams", "cycles", "alerts", "fingerprints"].some(table => hashes[table] !== after[table]))
            throw new Error();
        restored.close();
        restored = undefined;
        if ((await verifyBackup(source)).manifestSha256 !== verified.manifestSha256)
            throw new Error();
        return { passed: true, isolated: true, sourceUnchanged: true, preservedStateAlertsAndDedup: true, knownDeliveredNotResent: true,
            recoveredAmbiguous, priorSchemaVersion: verified.schemaVersion, restoredSchemaVersion, externalCalls: 0, actionable: false };
    }
    catch (error) {
        if (error instanceof DataError)
            throw error;
        throw new DataError("RESTORE_INVALID", "Isolated restoration failed validation; the live database and backup were not replaced.");
    }
    finally {
        restored?.close();
        await rm(scratch, { recursive: true, force: true });
    }
}
//# sourceMappingURL=backup.js.map