import { z } from "zod";
import type { ChainProgressionState } from "../risk/eligibility.js";
/** Bounded chain-progression vocabulary. Only a supplied, independently evaluated state can be ADVANCING;
 * absent progression evidence is UNKNOWN and always blocks recovery estimates (fail closed). */
/** Bounded, deterministic progression reason codes. Never free-form provider text. */
export declare const PROGRESSION_REASONS: readonly ["FIRST_OBSERVATION", "NO_SNAPSHOT_EVIDENCE", "MISSING_PROVIDER_HEAD", "CHAIN_ID_MISMATCH", "PROVIDER_HEAD_BELOW_SELECTED_BLOCK", "INVALID_BLOCK_EVIDENCE", "PROVIDER_HEAD_REGRESSION", "BLOCK_NUMBER_REGRESSION", "BLOCK_TIMESTAMP_REGRESSION", "SAME_HEIGHT_HASH_CONFLICT", "SAME_BLOCK_RE_READ", "STALL_WINDOW_EXCEEDED", "STRICT_ADVANCE"];
export type ProgressionReason = typeof PROGRESSION_REASONS[number];
export declare const progressionStateSchema: z.ZodEnum<{
    UNKNOWN: "UNKNOWN";
    ADVANCING: "ADVANCING";
    UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
    STALLED: "STALLED";
    REGRESSED: "REGRESSED";
    CONFLICT: "CONFLICT";
}>;
export declare const progressionReasonSchema: z.ZodNullable<z.ZodEnum<{
    FIRST_OBSERVATION: "FIRST_OBSERVATION";
    NO_SNAPSHOT_EVIDENCE: "NO_SNAPSHOT_EVIDENCE";
    MISSING_PROVIDER_HEAD: "MISSING_PROVIDER_HEAD";
    CHAIN_ID_MISMATCH: "CHAIN_ID_MISMATCH";
    PROVIDER_HEAD_BELOW_SELECTED_BLOCK: "PROVIDER_HEAD_BELOW_SELECTED_BLOCK";
    INVALID_BLOCK_EVIDENCE: "INVALID_BLOCK_EVIDENCE";
    PROVIDER_HEAD_REGRESSION: "PROVIDER_HEAD_REGRESSION";
    BLOCK_NUMBER_REGRESSION: "BLOCK_NUMBER_REGRESSION";
    BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
    SAME_HEIGHT_HASH_CONFLICT: "SAME_HEIGHT_HASH_CONFLICT";
    SAME_BLOCK_RE_READ: "SAME_BLOCK_RE_READ";
    STALL_WINDOW_EXCEEDED: "STALL_WINDOW_EXCEEDED";
    STRICT_ADVANCE: "STRICT_ADVANCE";
}>>;
/** Persisted with the observation that produced it; optional so historical observations stay readable. */
export declare const progressionSchema: z.ZodObject<{
    state: z.ZodEnum<{
        UNKNOWN: "UNKNOWN";
        ADVANCING: "ADVANCING";
        UNCHANGED_WITHIN_WINDOW: "UNCHANGED_WITHIN_WINDOW";
        STALLED: "STALLED";
        REGRESSED: "REGRESSED";
        CONFLICT: "CONFLICT";
    }>;
    reason: z.ZodNullable<z.ZodEnum<{
        FIRST_OBSERVATION: "FIRST_OBSERVATION";
        NO_SNAPSHOT_EVIDENCE: "NO_SNAPSHOT_EVIDENCE";
        MISSING_PROVIDER_HEAD: "MISSING_PROVIDER_HEAD";
        CHAIN_ID_MISMATCH: "CHAIN_ID_MISMATCH";
        PROVIDER_HEAD_BELOW_SELECTED_BLOCK: "PROVIDER_HEAD_BELOW_SELECTED_BLOCK";
        INVALID_BLOCK_EVIDENCE: "INVALID_BLOCK_EVIDENCE";
        PROVIDER_HEAD_REGRESSION: "PROVIDER_HEAD_REGRESSION";
        BLOCK_NUMBER_REGRESSION: "BLOCK_NUMBER_REGRESSION";
        BLOCK_TIMESTAMP_REGRESSION: "BLOCK_TIMESTAMP_REGRESSION";
        SAME_HEIGHT_HASH_CONFLICT: "SAME_HEIGHT_HASH_CONFLICT";
        SAME_BLOCK_RE_READ: "SAME_BLOCK_RE_READ";
        STALL_WINDOW_EXCEEDED: "STALL_WINDOW_EXCEEDED";
        STRICT_ADVANCE: "STRICT_ADVANCE";
    }>>;
    advancedBlocks: z.ZodNullable<z.ZodString>;
    blockNumber: z.ZodNullable<z.ZodString>;
    blockHash: z.ZodNullable<z.ZodString>;
    blockTimestamp: z.ZodNullable<z.ZodString>;
    headNumber: z.ZodNullable<z.ZodString>;
    baselineBlockNumber: z.ZodNullable<z.ZodString>;
    baselineBlockHash: z.ZodNullable<z.ZodString>;
    sameBlockStreak: z.ZodNumber;
    evaluatedAt: z.ZodISODateTime;
}, z.core.$strict>;
export type PersistedProgression = z.infer<typeof progressionSchema>;
/** How many consecutive same-block re-reads remain UNCHANGED_WITHIN_WINDOW before the chain is STALLED.
 * Counting observations is clock-free: local-clock age is rejection-only and never establishes any state. */
export declare const STALL_WINDOW_OBSERVATIONS = 3;
/** Pure comparator between two cross-checked block observations. It never reads wall clocks, never uses
 * retrieval timestamps, and never fabricates ADVANCING: only a strictly higher, equally valid block advances. */
export interface ProgressionObservation {
    readonly blockNumber: bigint;
    readonly blockHash: string;
    readonly blockTimestamp: bigint;
    /** Observed provider head bound for this observation; null disables the head-to-head comparison. */
    readonly headNumber: bigint | null;
}
export interface ChainProgression {
    readonly state: ChainProgressionState;
    readonly advancedBlocks: bigint | null;
    readonly reason: ProgressionReason | null;
}
export declare function evaluateChainProgression(previous: ProgressionObservation, current: ProgressionObservation): ChainProgression;
/** Snapshot-derived observation evidence (already Phase-1 validated fields; never a retrieval timestamp). */
export interface ObservedProgressionEvidence {
    readonly blockNumber: bigint;
    readonly blockHash: string;
    readonly blockTimestamp: bigint;
    readonly headRpc: bigint | null;
    readonly headMcp: bigint | null;
    readonly chainIdRpc: bigint | null;
    readonly chainIdMcp: bigint | null;
}
/** The last accepted observation's block plus its accumulated same-block streak. */
export interface ObservedProgressionBaseline {
    readonly blockNumber: bigint;
    readonly blockHash: string;
    readonly blockTimestamp: bigint;
    readonly sameBlockStreak: number;
}
export interface ObservedProgression {
    readonly state: ChainProgressionState;
    readonly reason: ProgressionReason | null;
    readonly advancedBlocks: bigint | null;
    readonly blockNumber: bigint | null;
    readonly blockHash: string | null;
    readonly blockTimestamp: bigint | null;
    /** Cross-checked provider-head lower bound: min(RPC, MCP) when both exist and cover the selected block. */
    readonly headNumber: bigint | null;
    readonly baselineBlockNumber: bigint | null;
    readonly baselineBlockHash: string | null;
    readonly sameBlockStreak: number;
}
/**
 * Live-observation progression evaluation. Missing evidence, missing provider heads, chain-identity mismatch
 * or a provider head below the selected block are all UNKNOWN: the gate fails closed rather than inferring.
 * The previous cross-checked provider head is not compared against the current one because provider-head
 * jitter between cycles is a lag artifact, not chain regression; block identity comparisons are decisive.
 */
export declare function evaluateObservedProgression(input: {
    baseline: ObservedProgressionBaseline | null;
    observed: ObservedProgressionEvidence | null;
}): ObservedProgression;
/** Serializes the evaluation result for the observation that produced it; identifiers stay exact decimal text. */
export declare function persistedProgression(result: ObservedProgression, evaluatedAt: Date): PersistedProgression;
