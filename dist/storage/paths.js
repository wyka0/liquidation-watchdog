import { existsSync, lstatSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DataError } from "../domain/errors.js";
const invalid = () => new DataError("STORE_PATH", "Use local regular paths outside evidence archives, without traversal, links, URI or network paths.");
/** Check the original spelling before normalization, including Windows paths when tested on POSIX. */
export function localPath(path, options = {}) {
    const normalized = path.replaceAll("\\", "/");
    if (!path || path.length > 2_048 || /[\p{Cc}\p{Cf}@]/u.test(path) || normalized.startsWith("//")
        || normalized.split("/").includes("..") || /:/.test(normalized.replace(/^[A-Za-z]:\//, ""))
        || normalized.split("/").some(part => /[. ]$/.test(part) && part !== ".")
        || normalized.split("/").some(part => /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))
        || (!options.allowEvidence && /(?:^|\/)evidence(?:\/|$)/i.test(normalized))
        || (options.database && !/\.(?:sqlite|db)$/i.test(normalized)))
        throw invalid();
    const absolute = resolve(path);
    if (!options.allowEvidence && /(?:^|[\\/])evidence(?:[\\/]|$)/i.test(absolute))
        throw invalid();
    for (let part = absolute;; part = dirname(part)) {
        if (existsSync(part)) {
            const info = lstatSync(part);
            if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()) || (info.isFile() && info.nlink > 1))
                throw invalid();
            if (part !== absolute && !info.isDirectory())
                throw invalid();
        }
        else {
            // lstat detects dangling symbolic links, unlike existsSync.
            try {
                if (lstatSync(part).isSymbolicLink())
                    throw invalid();
            }
            catch (error) {
                if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
                    throw error;
            }
        }
        if (dirname(part) === part)
            break;
    }
    return absolute;
}
export function databasePath(path, createParents = false) {
    if (path === ":memory:")
        return path;
    const absolute = localPath(path, { database: true });
    for (const suffix of ["", "-wal", "-shm", "-journal", "-monitor-lock", "-monitor-lock-journal"]) {
        localPath(`${absolute}${suffix}`);
        if (existsSync(`${absolute}${suffix}`) && !lstatSync(`${absolute}${suffix}`).isFile())
            throw invalid();
    }
    if (createParents)
        mkdirSync(dirname(absolute), { recursive: true, mode: 0o700 });
    return absolute;
}
//# sourceMappingURL=paths.js.map