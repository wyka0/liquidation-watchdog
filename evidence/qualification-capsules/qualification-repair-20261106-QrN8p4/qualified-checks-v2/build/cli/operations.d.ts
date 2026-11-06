import type { OperationsOptions } from "./operations-options.js";
export declare function runOperationsCli(options: OperationsOptions, write: (text: string) => void, now: () => Date): Promise<number>;
