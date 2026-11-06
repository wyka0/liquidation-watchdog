import { z } from "zod";
import { NETWORK } from "../config/deployment.js";
import { DataError } from "../domain/errors.js";
import { CHAIN_PROGRESSION_STATES } from "../risk/eligibility.js";
/** Bounded chain-progression vocabulary. Only a supplied, independently evaluated state can be ADVANCING;
 * absent progression evidence is UNKNOWN and always blocks recovery estimates (fail closed). */
/** Bounded, deterministic progression reason codes. Never free-form provider text. */
export const PROGRESSION_REASONS = ["FIRST_OBSERVATION", "NO_SNAPSHOT_EVIDENCE", "MISSING_PROVIDER_HEAD",
    "CHAIN_ID_MISMATCH", "PROVIDER_HEAD_BELOW_SELECTED_BLOCK", "INVALID_BLOCK_EVIDENCE", "PROVIDER_HEAD_REGRESSION",
    "BLOCK_NUMBER_REGRESSION", "BLOCK_TIMESTAMP_REGRESSION", "SAME_HEIGHT_HASH_CONFLICT", "SAME_BLOCK_RE_READ",
    "STALL_WINDOW_EXCEEDED", "STRICT_ADVANCE"];
export const progressionStateSchema = z.enum(CHAIN_PROGRESSION_STATES);
export const progressionReasonSchema = z.enum(PROGRESSION_REASONS).nullable();
const unsignedText = z.string().regex(/^(?:0|[1-9][0-9]{0,77})$/);
const hashText = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const utcText = z.iso.datetime();
/** Persisted with the observation that produced it; optional so historical observations stay readable. */
export const progressionSchema = z.object({
    state: progressionStateSchema,
    reason: progressionReasonSchema,
    advancedBlocks: unsignedText.nullable(),
    blockNumber: unsignedText.nullable(), blockHash: hashText.nullable(), blockTimestamp: unsignedText.nullable(),
    headNumber: unsignedText.nullable(),
    baselineBlockNumber: unsignedText.nullable(), baselineBlockHash: hashText.nullable(),
    sameBlockStreak: z.number().int().min(0).max(9007199254740991),
    evaluatedAt: utcText
}).strict();
/** How many consecutive same-block re-reads remain UNCHANGED_WITHIN_WINDOW before the chain is STALLED.
 * Counting observations is clock-free: local-clock age is rejection-only and never establishes any state. */
export const STALL_WINDOW_OBSERVATIONS = 3;
const hashPattern = /^0x[0-9a-fA-F]{64}$/;
function validated(observation, role) {
    if (typeof observation.blockNumber !== "bigint" || typeof observation.blockTimestamp !== "bigint"
        || observation.blockNumber <= 0n || observation.blockTimestamp <= 0n || !hashPattern.test(observation.blockHash)
        || (observation.headNumber !== null && (typeof observation.headNumber !== "bigint" || observation.headNumber < 0n))) {
        throw new DataError("PROGRESSION_EVIDENCE", `${role} progression evidence is missing required block identity fields.`);
    }
}
export function evaluateChainProgression(previous, current) {
    validated(previous, "Previous");
    validated(current, "Current");
    if (current.blockNumber < previous.blockNumber)
        return { state: "REGRESSED", advancedBlocks: null, reason: "BLOCK_NUMBER_REGRESSION" };
    if (current.blockTimestamp < previous.blockTimestamp)
        return { state: "REGRESSED", advancedBlocks: null, reason: "BLOCK_TIMESTAMP_REGRESSION" };
    if (current.headNumber !== null && previous.headNumber !== null && current.headNumber < previous.headNumber) {
        return { state: "REGRESSED", advancedBlocks: null, reason: "PROVIDER_HEAD_REGRESSION" };
    }
    if (current.blockNumber === previous.blockNumber) {
        if (current.blockHash.toLowerCase() !== previous.blockHash.toLowerCase()) {
            return { state: "CONFLICT", advancedBlocks: null, reason: "SAME_HEIGHT_HASH_CONFLICT" };
        }
        // Same height and hash: nothing proves the chain advanced; rereads are never advancement evidence.
        return { state: "UNCHANGED_WITHIN_WINDOW", advancedBlocks: 0n, reason: "SAME_BLOCK_RE_READ" };
    }
    return { state: "ADVANCING", advancedBlocks: current.blockNumber - previous.blockNumber, reason: null };
}
/**
 * Live-observation progression evaluation. Missing evidence, missing provider heads, chain-identity mismatch
 * or a provider head below the selected block are all UNKNOWN: the gate fails closed rather than inferring.
 * The previous cross-checked provider head is not compared against the current one because provider-head
 * jitter between cycles is a lag artifact, not chain regression; block identity comparisons are decisive.
 */
export function evaluateObservedProgression(input) {
    const record = (state, reason, fields = {}) => ({
        state, reason, advancedBlocks: null, blockNumber: null, blockHash: null, blockTimestamp: null, headNumber: null,
        baselineBlockNumber: null, baselineBlockHash: null, sameBlockStreak: 0, ...fields
    });
    const observed = input.observed;
    if (observed === null)
        return record("UNKNOWN", "NO_SNAPSHOT_EVIDENCE", { blockNumber: null, blockHash: null, blockTimestamp: null, headNumber: null, sameBlockStreak: 0 });
    const identityFault = observed.blockNumber <= 0n || observed.blockTimestamp <= 0n || !hashPattern.test(observed.blockHash);
    const identity = { blockNumber: observed.blockNumber, blockHash: observed.blockHash, blockTimestamp: observed.blockTimestamp };
    if (identityFault)
        return record("UNKNOWN", "INVALID_BLOCK_EVIDENCE", { sameBlockStreak: 0 });
    if (input.baseline === null)
        return record("UNKNOWN", "FIRST_OBSERVATION", { ...identity, ...headBound(observed), sameBlockStreak: 0 });
    if (observed.headRpc === null || observed.headMcp === null)
        return record("UNKNOWN", "MISSING_PROVIDER_HEAD", { ...identity, sameBlockStreak: 0, baselineBlockNumber: input.baseline.blockNumber, baselineBlockHash: input.baseline.blockHash });
    if (observed.chainIdRpc === null || observed.chainIdMcp === null || observed.chainIdRpc !== BigInt(NETWORK.chainId)
        || observed.chainIdMcp !== BigInt(NETWORK.chainId))
        return record("UNKNOWN", "CHAIN_ID_MISMATCH", { ...identity, ...headBound(observed), sameBlockStreak: 0, baselineBlockNumber: input.baseline.blockNumber, baselineBlockHash: input.baseline.blockHash });
    const heads = headBound(observed);
    if (heads.headNumber === null || heads.headNumber < observed.blockNumber)
        return record("UNKNOWN", "PROVIDER_HEAD_BELOW_SELECTED_BLOCK", { ...identity, sameBlockStreak: 0, baselineBlockNumber: input.baseline.blockNumber, baselineBlockHash: input.baseline.blockHash });
    const baseline = input.baseline;
    const fields = { ...identity, headNumber: heads.headNumber, baselineBlockNumber: baseline.blockNumber, baselineBlockHash: baseline.blockHash };
    try {
        const progression = evaluateChainProgression({ blockNumber: baseline.blockNumber, blockHash: baseline.blockHash, blockTimestamp: baseline.blockTimestamp, headNumber: null }, { blockNumber: observed.blockNumber, blockHash: observed.blockHash, blockTimestamp: observed.blockTimestamp, headNumber: heads.headNumber });
        if (progression.state === "ADVANCING")
            return record("ADVANCING", progression.reason, { ...fields, advancedBlocks: progression.advancedBlocks, sameBlockStreak: 0 });
        if (progression.state === "UNCHANGED_WITHIN_WINDOW") {
            const streak = baseline.sameBlockStreak + 1;
            return streak > STALL_WINDOW_OBSERVATIONS ? record("STALLED", "STALL_WINDOW_EXCEEDED", { ...fields, advancedBlocks: 0n, sameBlockStreak: streak })
                : record("UNCHANGED_WITHIN_WINDOW", progression.reason, { ...fields, advancedBlocks: 0n, sameBlockStreak: streak });
        }
        return record(progression.state, progression.reason, { ...fields, advancedBlocks: progression.advancedBlocks, sameBlockStreak: 0 });
    }
    catch {
        // Malformed comparator inputs cannot be repaired here: fail closed without fabricating any state.
        return record("UNKNOWN", "INVALID_BLOCK_EVIDENCE", { ...fields, sameBlockStreak: 0 });
    }
}
function headBound(observed) {
    return { headNumber: observed.headRpc !== null && observed.headMcp !== null
            ? (observed.headRpc < observed.headMcp ? observed.headRpc : observed.headMcp) : null };
}
/** Serializes the evaluation result for the observation that produced it; identifiers stay exact decimal text. */
export function persistedProgression(result, evaluatedAt) {
    return progressionSchema.parse({
        state: result.state, reason: result.reason,
        advancedBlocks: result.advancedBlocks?.toString() ?? null,
        blockNumber: result.blockNumber?.toString() ?? null, blockHash: result.blockHash, blockTimestamp: result.blockTimestamp?.toString() ?? null,
        headNumber: result.headNumber?.toString() ?? null,
        baselineBlockNumber: result.baselineBlockNumber?.toString() ?? null, baselineBlockHash: result.baselineBlockHash,
        sameBlockStreak: result.sameBlockStreak, evaluatedAt: evaluatedAt.toISOString()
    });
}
//# sourceMappingURL=progression.js.map