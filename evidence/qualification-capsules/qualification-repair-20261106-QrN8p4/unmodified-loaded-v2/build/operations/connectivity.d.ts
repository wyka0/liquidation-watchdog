import type { ReadClient } from "../chain/client.js";
export type ConnectivityState = "REACHABLE" | "REACHABLE_AS_OF_ACCEPTED_SNAPSHOT" | "UNAVAILABLE" | "UNKNOWN";
export interface Connectivity {
    rpc: ConnectivityState;
    mcp: ConnectivityState;
    checkedAt: string | null;
    mode: "EXPLICIT_READ_ONLY_PROBE" | "PERSISTED_AS_OF_SNAPSHOT";
}
export declare function probeConnectivity(milliseconds: number, factory?: (signal: AbortSignal) => {
    rpc: ReadClient;
    mcp: ReadClient;
}): Promise<Connectivity>;
