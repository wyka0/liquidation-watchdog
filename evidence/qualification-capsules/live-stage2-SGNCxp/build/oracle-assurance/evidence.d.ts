import type { ResourceLimits } from "../config/monitoring.js";
export declare const sha256: (bytes: string | Uint8Array) => string;
/** No overwrite or merge: a capture is a new directory, and the manifest is the final write. */
export declare function saveOracleBundle(artifacts: Readonly<Record<string, string>>, options?: {
    root?: string;
    now?: Date;
    prefix?: string;
    limits?: ResourceLimits;
}): Promise<{
    directory: string;
    manifestSha256: string;
    artifactCount: number;
}>;
export declare function verifyOracleBundle(directory: string): Promise<{
    passed: true;
    artifactCount: number;
    manifestSha256: string;
}>;
