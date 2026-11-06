/** Import-safe, separately selected entrypoint. Configuration is consumed only on explicit invocation. */
export declare function runPostgresService(input: Readonly<Record<string, string | undefined>>, write?: (text: string) => void): Promise<number>;
