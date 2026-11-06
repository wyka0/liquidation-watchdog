import type { QualityStatus, Scope } from "./types.js";
export declare class DataError extends Error {
    readonly code: string;
    readonly scope: Scope;
    readonly quality: QualityStatus;
    constructor(code: string, message: string, scope?: Scope, quality?: QualityStatus);
}
export declare class TransientReadError extends Error {
    readonly code: string;
    readonly retryAfterMs: number | null;
    constructor(code: string, retryAfterMs?: number | null);
}
