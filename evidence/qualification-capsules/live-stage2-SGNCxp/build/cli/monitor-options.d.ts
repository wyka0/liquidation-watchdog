import type { ThresholdOverrides } from "../config/risk.js";
import type { MonitorOverrides } from "../config/monitoring.js";
export interface MonitorCommandOptions {
    command: "monitor" | "alerts" | "status";
    once: boolean;
    limit: number;
    configPath: string | undefined;
    riskConfigPath: string | undefined;
    positionConfigPath: string | undefined;
    block: bigint | undefined;
    monitoringOverrides: MonitorOverrides;
    thresholdOverrides: ThresholdOverrides;
}
export declare function parseMonitorOptions(command: MonitorCommandOptions["command"], input: readonly string[]): MonitorCommandOptions;
