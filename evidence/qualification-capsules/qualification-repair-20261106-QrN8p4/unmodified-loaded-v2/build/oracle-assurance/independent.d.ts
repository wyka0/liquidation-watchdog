import type { z } from "zod";
import { independentAssetSchema } from "./model.js";
import type { IndependentResult } from "./model.js";
export { normalizePrice } from "./units.js";
export { candidateSchema } from "./model.js";
export type { IndependentCandidate } from "./model.js";
export declare function compareIndependent(input: {
    candidate?: unknown;
    base: z.infer<typeof independentAssetSchema>;
    quote: z.infer<typeof independentAssetSchema>;
    morphoPrice: bigint | null;
    blockTimestamp: bigint | null;
    selectedTimestamp?: bigint | null;
    selectedUpstreamId?: string;
    toleranceBps?: number;
    maxAgeSeconds?: bigint;
    maxSkewSeconds?: bigint;
    fixture?: boolean;
}): IndependentResult;
