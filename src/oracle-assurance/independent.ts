import type { z } from "zod";
import { DataError } from "../domain/errors.js";
import { U256_MAX } from "../validation/schemas.js";
import { candidateSchema, independentAssetSchema, independentSchema, missingIndependentProofs, sameIndependentAsset } from "./model.js";
import type { IndependentResult } from "./model.js";
import { normalizePrice } from "./units.js";
export { normalizePrice } from "./units.js";
export { candidateSchema } from "./model.js";
export type { IndependentCandidate } from "./model.js";
export function compareIndependent(input: {
  candidate?: unknown; base: z.infer<typeof independentAssetSchema>; quote: z.infer<typeof independentAssetSchema>; morphoPrice: bigint | null;
  blockTimestamp: bigint | null; selectedTimestamp?: bigint | null; selectedUpstreamId?: string; toleranceBps?: number;
  maxAgeSeconds?: bigint; maxSkewSeconds?: bigint; fixture?: boolean;
}): IndependentResult {
  independentAssetSchema.parse(input.base); independentAssetSchema.parse(input.quote);
  const tolerance = input.toleranceBps ?? null;
  if (tolerance !== null && (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 10_000)) throw new DataError("INDEPENDENT_TOLERANCE", "Tolerance must be explicit integer basis points from 0 to 10000.");
  const maximumAge = input.maxAgeSeconds ?? null, maximumSkew = input.maxSkewSeconds ?? null;
  if ((maximumAge !== null && (maximumAge <= 0n || maximumAge > 31_536_000n)) || (maximumSkew !== null && (maximumSkew < 0n || maximumSkew > 31_536_000n))) {
    throw new DataError("INDEPENDENT_TIME_POLICY", "Comparison age and alignment bounds must be explicit bounded local policies.");
  }
  const selectedTimestamp = input.selectedTimestamp ?? null;
  const result: IndependentResult = { state: "UNKNOWN", availability: "NOT_CONFIGURED", sourceId: null, eligible: false,
    reasons: [], toleranceBps: tolerance, morphoPrice: input.morphoPrice !== null && input.morphoPrice >= 0n ? input.morphoPrice.toString() : null,
    independentPrice: null, candidate: null, selectedUpstreamId: input.selectedUpstreamId ?? null,
    base: input.base, quote: input.quote, evidenceMode: input.fixture ? "FIXTURE" : "PRODUCTION",
    blockTimestamp: input.blockTimestamp?.toString() ?? null, selectedTimestamp: selectedTimestamp?.toString() ?? null,
    candidateAgeSeconds: null, timestampSkewSeconds: null, policyMaxAgeSeconds: maximumAge?.toString() ?? null, policyMaxSkewSeconds: maximumSkew?.toString() ?? null,
    normalizedMorpho: null, normalizedIndependent: null, deviationBps: null, disagrees: false, evidence: [] };
  if (!input.candidate) { result.reasons.push("NO_QUALIFIED_INDEPENDENT_SOURCE"); return independentSchema.parse(result); }
  const parsed = candidateSchema.safeParse(input.candidate);
  if (!parsed.success) {
    result.state = "FAILED"; result.availability = "AVAILABLE"; result.reasons.push("MALFORMED_INDEPENDENT_CANDIDATE"); return independentSchema.parse(result);
  }
  const source = parsed.data;
  result.sourceId = source.id; result.availability = source.availability; result.independentPrice = source.price; result.candidate = source;
  result.evidence = source.proofs.map(proof => proof.evidence);
  if (source.availability === "UNAVAILABLE") { result.reasons.push("INDEPENDENT_SOURCE_UNAVAILABLE"); return independentSchema.parse(result); }
  if (!sameIndependentAsset(source.base, input.base)) result.reasons.push("ECONOMIC_ASSET_MISMATCH");
  if (!sameIndependentAsset(source.quote, input.quote)) result.reasons.push("QUOTE_MISMATCH");
  if (source.kind !== "MARKET_PRICE") result.reasons.push("REDEMPTION_RATE_IS_NOT_MARKET_PRICE");
  result.reasons.push(...missingIndependentProofs(source, input.fixture === true));
  if (!input.selectedUpstreamId || !source.upstreamId || source.upstreamId === input.selectedUpstreamId) result.reasons.push("INDEPENDENCE_UNESTABLISHED");
  if (!source.operatorId) result.reasons.push("OPERATOR_UNKNOWN");
  if (source.frequencySeconds === null || BigInt(source.frequencySeconds) <= 0n) result.reasons.push("FREQUENCY_UNKNOWN");
  if (source.timestamp === null || input.blockTimestamp === null || BigInt(source.timestamp) <= 0n || BigInt(source.timestamp) > input.blockTimestamp) result.reasons.push("INVALID_OBSERVATION_TIME");
  if (selectedTimestamp === null || input.blockTimestamp === null || input.morphoPrice === null) result.reasons.push("SELECTED_SOURCE_UNAVAILABLE");
  else if (selectedTimestamp <= 0n || selectedTimestamp > input.blockTimestamp) result.reasons.push("INVALID_SELECTED_OBSERVATION_TIME");
  if (maximumAge === null || maximumSkew === null) result.reasons.push("TEMPORAL_POLICY_UNCONFIGURED");
  if (source.timestamp !== null && input.blockTimestamp !== null && BigInt(source.timestamp) <= input.blockTimestamp) {
    const age = input.blockTimestamp - BigInt(source.timestamp);
    result.candidateAgeSeconds = age.toString();
    if (maximumAge !== null && age > maximumAge) result.reasons.push("CANDIDATE_TOO_OLD_FOR_COMPARISON");
    if (selectedTimestamp !== null) {
      const signed = BigInt(source.timestamp) - selectedTimestamp, skew = signed < 0n ? -signed : signed;
      result.timestampSkewSeconds = skew.toString();
      if (maximumSkew !== null && skew > maximumSkew) result.reasons.push("OBSERVATIONS_NOT_ALIGNED");
      if (maximumAge !== null && input.blockTimestamp - selectedTimestamp > maximumAge) result.reasons.push("SELECTED_TOO_OLD_FOR_COMPARISON");
    }
  }
  if (source.price === null || BigInt(source.price) <= 0n || BigInt(source.price) > U256_MAX
    || (input.morphoPrice !== null && (input.morphoPrice <= 0n || input.morphoPrice > U256_MAX))) result.reasons.push("INVALID_PRICE");
  if (tolerance === null) result.reasons.push("TOLERANCE_UNCONFIGURED");
  if (result.reasons.length) {
    if (result.reasons.some(reason => ["INVALID_PRICE", "INVALID_OBSERVATION_TIME", "INVALID_SELECTED_OBSERVATION_TIME"].includes(reason))) result.state = "FAILED";
    return independentSchema.parse(result);
  }
  const selected = normalizePrice(input.morphoPrice!, 36, input.base.decimals, input.quote.decimals, "QUOTE_BASE_UNITS_PER_BASE_UNIT");
  const independent = normalizePrice(BigInt(source.price!), source.decimals, source.base.decimals, source.quote.decimals, source.denomination);
  const signedDifference = independent.numerator * selected.denominator - selected.numerator * independent.denominator;
  const difference = signedDifference < 0n ? -signedDifference : signedDifference;
  const numerator = difference * 10_000n, denominator = selected.numerator * independent.denominator;
  const wire = (ratio: ReturnType<typeof normalizePrice>) => ({ numerator: ratio.numerator.toString(), denominator: ratio.denominator.toString() });
  result.eligible = true; result.normalizedMorpho = wire(selected); result.normalizedIndependent = wire(independent);
  result.deviationBps = `${numerator}/${denominator}`;
  result.disagrees = numerator > BigInt(tolerance!) * denominator;
  result.state = result.disagrees ? "FAILED" : "VERIFIED";
  if (result.disagrees) result.reasons.push("INDEPENDENT_PRICE_DISAGREEMENT");
  return independentSchema.parse(result);
}
