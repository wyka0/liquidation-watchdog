import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { CURRENT_EVIDENCE } from "../config/evidence.js";
import { DataError } from "../domain/errors.js";
import { requireEvidenceCapacity } from "../operations/resources.js";
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const artifactName = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,150}$/).refine(name => !name.includes("..") && !["manifest.json", "manifest.sha256"].includes(name));
const manifestSchema = z.object({ version: z.literal(1), kind: z.literal("IMMUTABLE_ORACLE_EVIDENCE"), createdAt: z.iso.datetime(),
    files: z.array(z.object({ file: artifactName, bytes: z.number().int().nonnegative().max(32 * 1_024 ** 2), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).min(1).max(1_000)
}).strict();
/** No overwrite or merge: a capture is a new directory, and the manifest is the final write. */
export async function saveOracleBundle(artifacts, options = {}) {
    const now = options.now ?? new Date(), prefix = options.prefix ?? "oracle-audit";
    if (!/^[a-z][a-z0-9-]{0,40}$/.test(prefix))
        throw new DataError("EVIDENCE_PATH", "Invalid evidence prefix.");
    const root = resolve(options.root ?? CURRENT_EVIDENCE);
    if (/(?:^|[\\/])evidence[\\/]phase[1234](?:[\\/]|$)/i.test(root))
        throw new DataError("EVIDENCE_PATH", "Prior evidence archives are sealed.");
    // Refuse archive aliases through links, including a symlinked parent.
    for (let part = root;; part = dirname(part)) {
        try {
            if ((await lstat(part)).isSymbolicLink())
                throw new DataError("EVIDENCE_PATH", "Evidence paths must not traverse symbolic links.");
        }
        catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
                throw error;
        }
        if (dirname(part) === part)
            break;
    }
    const entries = Object.entries(artifacts).sort(([a], [b]) => a.localeCompare(b));
    if (!entries.length)
        throw new DataError("EVIDENCE_EMPTY", "An evidence bundle requires artifacts.");
    for (const [name] of entries)
        artifactName.parse(name);
    requireEvidenceCapacity(root, entries.reduce((total, [, text]) => total + Buffer.byteLength(text), 0) + entries.length * 256 + 1_024, entries.length + 2, options.limits);
    if (entries.length > 1_000 || entries.some(([, text]) => Buffer.byteLength(text) > 32 * 1_024 ** 2))
        throw new DataError("RESOURCE_EVIDENCE_LIMIT", "Evidence bundle exceeds its bounded file policy.");
    await mkdir(root, { recursive: true, mode: 0o700 });
    const directory = join(root, `${prefix}-${now.toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID()}`);
    await mkdir(directory, { mode: 0o700 });
    const files = [];
    for (const [file, text] of entries) {
        const bytes = Buffer.from(text, "utf8");
        await writeFile(join(directory, file), bytes, { flag: "wx", mode: 0o600 });
        files.push({ file, bytes: bytes.length, sha256: sha256(bytes) });
    }
    const manifest = JSON.stringify(manifestSchema.parse({ version: 1, kind: "IMMUTABLE_ORACLE_EVIDENCE", createdAt: now.toISOString(), files }), null, 2) + "\n";
    await writeFile(join(directory, "manifest.json"), manifest, { flag: "wx", mode: 0o600 });
    const manifestSha256 = sha256(manifest);
    await writeFile(join(directory, "manifest.sha256"), `${manifestSha256}  manifest.json\n`, { flag: "wx", mode: 0o600 });
    return { directory, manifestSha256, artifactCount: files.length };
}
export async function verifyOracleBundle(directory) {
    for (let part = resolve(directory);; part = dirname(part)) {
        if ((await lstat(part)).isSymbolicLink())
            throw new DataError("EVIDENCE_LINK", "Evidence bundle must not traverse symbolic links.");
        if (dirname(part) === part)
            break;
    }
    const entries = await readdir(directory, { withFileTypes: true });
    if (entries.length > 1_002 || entries.some(entry => !entry.isFile() || entry.isSymbolicLink()))
        throw new DataError("EVIDENCE_LINK", "Bundle contains a non-file entry or exceeds its file limit.");
    for (const entry of entries) {
        const info = await lstat(join(directory, entry.name));
        if (info.nlink > 1 || info.size > (entry.name === "manifest.json" ? 1_048_576 : entry.name === "manifest.sha256" ? 128 : 32 * 1_024 ** 2)) {
            throw new DataError("EVIDENCE_SIZE_OR_LINK", "Evidence must be bounded regular files without hardlink aliases.");
        }
    }
    const manifestBytes = await readFile(join(directory, "manifest.json"));
    const manifest = manifestSchema.parse(JSON.parse(manifestBytes.toString("utf8")));
    const expected = new Set([...manifest.files.map(file => file.file), "manifest.json", "manifest.sha256"]);
    if (expected.size !== manifest.files.length + 2 || expected.size !== entries.length || entries.some(entry => !expected.has(entry.name))) {
        throw new DataError("EVIDENCE_INVENTORY", "Evidence file inventory differs from its manifest.");
    }
    const digest = sha256(manifestBytes);
    if (await readFile(join(directory, "manifest.sha256"), "utf8") !== `${digest}  manifest.json\n`)
        throw new DataError("EVIDENCE_HASH", "Manifest hash mismatch.");
    for (const file of manifest.files) {
        const path = join(directory, file.file), hash = createHash("sha256");
        for await (const bytes of createReadStream(path))
            hash.update(bytes);
        if ((await lstat(path)).size !== file.bytes || hash.digest("hex") !== file.sha256)
            throw new DataError("EVIDENCE_HASH", "An evidence artifact does not match its hash.");
    }
    return { passed: true, artifactCount: manifest.files.length, manifestSha256: digest };
}
//# sourceMappingURL=evidence.js.map