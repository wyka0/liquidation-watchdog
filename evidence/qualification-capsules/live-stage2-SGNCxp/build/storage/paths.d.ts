/** Check the original spelling before normalization, including Windows paths when tested on POSIX. */
export declare function localPath(path: string, options?: {
    database?: boolean;
    allowEvidence?: boolean;
}): string;
export declare function databasePath(path: string, createParents?: boolean): string;
