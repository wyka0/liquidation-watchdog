/** Enforce the deadline even for a non-cooperative injected provider. Late work never becomes an accepted result. */
export declare function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds: number, code: string, caller?: AbortSignal): Promise<T>;
