import type { MonitoringPolicy } from "../config/monitoring.js";
import type { Alert, MonitorState, Observation } from "./model.js";
/** Pure transition logic. Revision/episode counters are committed with alerts, never before them. */
export declare function transition(previous: MonitorState, input: Observation, policy: MonitoringPolicy, scope: string): {
    state: MonitorState;
    alerts: Alert[];
};
