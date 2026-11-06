import type { ThresholdOverrides } from "../config/risk.js";
import type { MonitorCommandOptions } from "./monitor-options.js";
import type { OracleCommandOptions } from "./oracle-options.js";
import type { OperationsOptions } from "./operations-options.js";
export declare const CLI_USAGE: string;
export interface CommandOptions {
    command: "inspect" | "risk";
    block: bigint | undefined;
    saveEvidence: boolean;
    configPath: string | undefined;
    thresholdOverrides: ThresholdOverrides;
}
export declare function parseCliOptions(input: readonly string[]): CommandOptions | MonitorCommandOptions | OracleCommandOptions | OperationsOptions | {
    command: "help";
};
