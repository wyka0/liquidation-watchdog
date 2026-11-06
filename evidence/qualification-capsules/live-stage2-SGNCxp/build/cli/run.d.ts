import type { Snapshot } from "../domain/types.js";
import type { RiskResult } from "../risk/types.js";
import type { MonitoringCliDependencies } from "./monitor.js";
import type { OracleCliDependencies } from "./oracle.js";
export interface CliDependencies {
    inspect: (block?: bigint) => Promise<Snapshot>;
    write: (text: string) => void;
    saveInspection: (snapshot: Snapshot, directory: string) => Promise<void>;
    saveRisk: (snapshot: Snapshot, result: RiskResult, directory: string) => Promise<void>;
    now: () => Date;
    monitoring?: MonitoringCliDependencies;
    oracle?: Partial<OracleCliDependencies>;
}
export declare function runCli(args: readonly string[], overrides?: Partial<CliDependencies>): Promise<number>;
