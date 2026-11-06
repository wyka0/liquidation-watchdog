export declare const MAX_RESPONSE_BYTES = 2000000;
export type Pause = (milliseconds: number) => Promise<void>;
export declare function retryAfter(header: string | null, now?: number): number | null;
export declare function retryRead<T>(operation: () => Promise<T>, options?: {
    attempts?: number;
    pause?: Pause;
    maxDelayMs?: number;
    random?: () => number;
    signal?: AbortSignal;
}): Promise<T>;
/** A shared queue limits both endpoints, including MCP initialization traffic. */
export declare class RequestPacer {
    private readonly intervalMs;
    private readonly wait;
    private readonly now;
    private tail;
    private lastStart;
    constructor(intervalMs?: number, wait?: Pause, now?: () => number);
    run<T>(operation: () => Promise<T>): Promise<T>;
}
export declare function publicEndpoint(value: string, fixture?: boolean): URL;
export declare function pacedFetch(pacer: RequestPacer, fetchImpl?: typeof fetch, external?: AbortSignal): typeof fetch;
export declare function throwServiceError(message: string, scope?: "network" | "snapshot"): never;
