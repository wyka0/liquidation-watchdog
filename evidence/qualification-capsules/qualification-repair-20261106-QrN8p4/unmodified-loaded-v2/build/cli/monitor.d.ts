import type { MonitoringConfiguration } from "../config/monitoring.js";
import type { NotificationAdapter } from "../notifications/types.js";
import { MonitorStore } from "../storage/store.js";
import type { MonitorCommandOptions } from "./monitor-options.js";
export interface MonitoringCliDependencies {
    read?: (block?: bigint, signal?: AbortSignal) => Promise<unknown>;
    openStore?: (path: string) => MonitorStore;
    adapters?: (configuration: MonitoringConfiguration, write: (text: string) => void) => NotificationAdapter[];
    onSignal?: (callback: () => void) => () => void;
    allowFixture?: boolean;
}
export declare function runMonitoringCli(options: MonitorCommandOptions, write: (text: string) => void, now: () => Date, dependencies?: MonitoringCliDependencies): Promise<number>;
