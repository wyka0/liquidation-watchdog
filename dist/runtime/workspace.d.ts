import { z } from "zod";
import type { MonitoringConfiguration } from "../config/monitoring.js";
import type { MonitorStore } from "../storage/store.js";
export declare const RENDER_DISK = "/var/data/watchdog";
export interface WorkspaceOptions {
    runtimeRoot: string;
    database: string;
    releaseRoot: string;
}
export interface RuntimeWorkspace extends WorkspaceOptions {
    diskRoot: string;
    seededFiles: number;
}
declare const bindingSchema: z.ZodObject<{
    path: z.ZodString;
    bytes: z.ZodNumber;
    sha256: z.ZodString;
}, z.core.$strip>;
type Binding = z.infer<typeof bindingSchema>;
export declare function isDiskMount(mountInfo: string, diskRoot: string): boolean;
/** Trusted historical source/evidence binding; it is not a claim that old source verifies the new runtime. */
export declare function seedBindings(releaseRoot: string): Binding[];
export declare function prepareWorkspace(options: WorkspaceOptions, configuration: MonitoringConfiguration, signal?: AbortSignal): Promise<RuntimeWorkspace>;
/** Also fences disabled HTTP runtimes. SQLite releases this OS lock after process death. */
export declare function ownWorkspace(workspace: RuntimeWorkspace): () => void;
export declare function verifyWorkspaceReferences(store: MonitorStore, runtimeRoot: string, signal?: AbortSignal): Promise<void>;
export {};
