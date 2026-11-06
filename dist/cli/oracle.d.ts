import type { Snapshot } from "../domain/types.js";
import { saveOracleBundle } from "../oracle-assurance/evidence.js";
import { inspectSupplemental } from "../oracle-assurance/supplemental.js";
import { MonitorStore } from "../storage/store.js";
import type { OracleCommandOptions } from "./oracle-options.js";
export interface OracleCliDependencies {
    openStore: (path: string) => MonitorStore;
    supplemental: typeof inspectSupplemental;
    save: typeof saveOracleBundle;
}
export declare function runOracleCli(options: OracleCommandOptions, inspect: (block?: bigint) => Promise<Snapshot>, write: (text: string) => void, now: () => Date, overrides?: Partial<OracleCliDependencies>): Promise<number>;
