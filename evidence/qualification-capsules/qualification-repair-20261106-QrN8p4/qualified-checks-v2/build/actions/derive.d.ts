import type { SuggestedAction } from "./model.js";
import type { Alert, Observation } from "../monitoring/model.js";
type AlertCode = Alert["code"];
export declare function deriveSuggestedAction(code: AlertCode, current: Observation): SuggestedAction;
export {};
