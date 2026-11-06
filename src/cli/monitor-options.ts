import { DataError } from "../domain/errors.js";
import type { ThresholdName, ThresholdOverrides } from "../config/risk.js";
import type { MonitorOverrides } from "../config/monitoring.js";

export interface MonitorCommandOptions {
  command: "monitor" | "alerts" | "status"; once: boolean; limit: number;
  configPath: string | undefined; riskConfigPath: string | undefined; positionConfigPath: string | undefined; block: bigint | undefined;
  monitoringOverrides: MonitorOverrides; thresholdOverrides: ThresholdOverrides;
}
export function parseMonitorOptions(command: MonitorCommandOptions["command"], input: readonly string[]): MonitorCommandOptions {
  const args = [...input];
  const result: MonitorCommandOptions = { command, once: false, limit: 20, configPath: undefined, riskConfigPath: undefined,
    positionConfigPath: undefined, block: undefined, monitoringOverrides: {}, thresholdOverrides: {} };
  const seen = new Set<string>();
  const text = () => {
    const value = args.shift();
    if (!value || value.startsWith("--") || value.length > 2_048) throw new DataError("CLI_ARGUMENT", "An explicit option value is required.");
    return value;
  };
  const integer = (min: number, max: number) => {
    const value = text();
    if (!/^[1-9][0-9]{0,8}$/.test(value) || Number(value) < min || Number(value) > max) throw new DataError("CLI_ARGUMENT", `Expected an integer from ${min} to ${max}.`);
    return Number(value);
  };
  const thresholdFlags: Record<string, ThresholdName> = { "--warning": "warningRatio", "--critical": "criticalRatio", "--target": "targetRatio" };
  while (args.length) {
    const flag = args.shift()!;
    if (seen.has(flag)) throw new DataError("CLI_ARGUMENT", "Duplicate CLI argument.");
    seen.add(flag);
    if (flag === "--config") result.configPath = text();
    else if (flag === "--position-config") result.positionConfigPath = text();
    else if (flag === "--database") result.monitoringOverrides.database = text();
    else if (command === "alerts" && flag === "--limit") result.limit = integer(1, 1_000);
    else if (flag === "--risk-config") result.riskConfigPath = text();
    else if (command !== "alerts" && Object.hasOwn(thresholdFlags, flag)) result.thresholdOverrides[thresholdFlags[flag]!] = text();
    else if (command !== "alerts" && flag === "--block") {
      const value = text();
      if (!/^[1-9][0-9]{0,19}$/.test(value)) throw new DataError("CLI_BLOCK", "Block must be a positive decimal integer.");
      result.block = BigInt(value);
    } else if (command === "monitor" && flag === "--once") result.once = true;
    else if (command === "monitor" && flag === "--enable") result.monitoringOverrides.enabled = true;
    else if (command === "monitor" && flag === "--interval") result.monitoringOverrides.intervalSeconds = integer(5, 86_400);
    else throw new DataError("CLI_ARGUMENT", "Unknown CLI argument for this command.");
  }
  if (command === "monitor" && result.block !== undefined && !result.once) throw new DataError("MONITOR_HISTORICAL", "An explicit historical block requires --once.");
  return result;
}
