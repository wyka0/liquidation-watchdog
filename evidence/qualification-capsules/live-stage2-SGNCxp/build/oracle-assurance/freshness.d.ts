import type { EvidenceRef, FreshnessResult } from "./model.js";
export interface VerifiedTiming {
    seconds: bigint;
    evidence: EvidenceRef;
    configurationFingerprint: string;
}
export interface FreshnessInput {
    blockTimestamp: bigint | null;
    observationTimestamp: bigint | null;
    startedAt?: bigint | null;
    cacheTimestamp?: bigint | null;
    previousTimestamp?: bigint | null;
    localMaxAgeSeconds?: bigint | null;
    semanticsVerified: boolean;
    evidence: EvidenceRef[];
    verifiedHeartbeat?: VerifiedTiming;
    upstreamGuarantee?: VerifiedTiming;
    configurationFingerprint?: string;
}
export declare function analyzeFreshness(input: FreshnessInput): FreshnessResult;
