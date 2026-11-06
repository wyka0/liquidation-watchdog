import type { AddressInfo } from "node:net";
import type { MonitoringConfiguration } from "../config/monitoring.js";
import type { ThresholdConfiguration } from "../config/risk.js";
import type { ServiceOptions } from "../monitoring/service.js";
import type { Lifecycle } from "./read-model.js";
import type { WorkspaceOptions } from "./workspace.js";
import type { PositionConfiguration } from "../config/position.js";
export interface RuntimeOptions extends WorkspaceOptions {
    configuration: MonitoringConfiguration; /** Resolved once at startup by config/runtime.ts; the runtime never reconstructs defaults. */
    thresholds: ThresholdConfiguration;
    position: PositionConfiguration;
    credential: string | undefined;
    port: number;
    host?: "127.0.0.1" | "0.0.0.0";
    write?: (line: string) => void;
    /** Local synthetic tests only; rejected for the production profile. */
    fixture?: Pick<ServiceOptions, "read" | "supplemental" | "now" | "pause" | "random" | "id">;
}
/** Construction is inert. Exactly one explicit runtime may own this process at a time. */
export declare class RenderRuntime {
    private readonly options;
    private lifecycle;
    private started;
    private stopping;
    private starting;
    private closing;
    private service;
    private writer;
    private reader;
    private http;
    private releaseWorkspace;
    private previousDirectory;
    private failed;
    private readonly startupAbort;
    private finish;
    readonly done: Promise<number>;
    constructor(options: RuntimeOptions);
    status(): Lifecycle;
    private event;
    start(): Promise<AddressInfo>;
    private initialize;
    stop(): Promise<void>;
    private cleanup;
}
/** Register only after an explicit invocation, and return exact listener cleanup. */
export declare function installSignals(runtime: Pick<RenderRuntime, "stop">, onDeadline?: () => void): () => void;
