export interface OracleCommandOptions {
    command: "oracle-audit" | "oracle-status";
    json: boolean;
    saveEvidence: boolean;
    block: bigint | undefined;
    database: string | undefined;
    localMaxAgeSeconds: bigint | undefined;
}
export declare function parseOracleOptions(command: OracleCommandOptions["command"], input: readonly string[]): OracleCommandOptions;
