export declare const OPERATION_COMMANDS: readonly ["health", "readiness", "diagnostics", "config-check", "database-init", "backup", "backup-verify", "restore-verify"];
export interface OperationsOptions {
    command: typeof OPERATION_COMMANDS[number];
    database?: string;
    configPath?: string;
    riskConfigPath?: string;
    positionConfigPath?: string;
    output?: string;
    backup?: string;
    restoreRoot?: string;
    probe: boolean;
}
export declare function parseOperationsOptions(command: OperationsOptions["command"], input: readonly string[]): OperationsOptions;
