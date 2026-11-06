import { createHash } from "node:crypto";
import { z } from "zod";
import { DEPLOYMENT, NETWORK } from "../config/deployment.js";
import { U256_MAX } from "../validation/schemas.js";
import { normalizePrice } from "./units.js";

export const DIMENSIONS = ["CONTRACT_IDENTITY", "SOURCE_PROVENANCE", "OPERATOR_PROVENANCE", "PRICE_SEMANTICS", "FRESHNESS", "INDEPENDENT_VALIDATION", "CONFIGURATION_CONTROL"] as const;
export const assuranceStateSchema = z.enum(["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "UNKNOWN", "FAILED"]);
export type AssuranceState = z.infer<typeof assuranceStateSchema>;
export const unsignedSchema = z.string().regex(/^(?:0|[1-9][0-9]{0,77})$/);
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const hash = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
export const blockRefSchema = z.object({ number: unsignedSchema, hash, timestamp: unsignedSchema }).strict();
const safeText = z.string().min(1).max(2_048).refine(value => !/[\p{Cc}\p{Cf}]/u.test(value)
  && !/https?:\/\/[^\s/]+:[^\s/]+@|Bearer\s+\S+|[?&](?:token|key|secret|api_key)=/i.test(value));
const locator = z.string().min(1).max(2_048).refine(value => {
  if (!value.startsWith("https://")) return /^[a-zA-Z0-9_./:#-]+$/.test(value) && !value.includes("..");
  try { const url = new URL(value); return !url.username && !url.password && !url.search && !url.hash; } catch { return false; }
});
export const evidenceRefSchema = z.object({
  subjectAddress: address, chainId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), source: locator,
  sourceKind: z.enum(["SNAPSHOT", "RPC", "MCP", "VERIFIED_SOURCE", "COMPILER", "OFFICIAL_DOCUMENT", "RESEARCH", "LOCAL_POLICY", "FIXTURE"]),
  block: blockRefSchema.nullable(), retrievedAt: z.iso.datetime(), method: safeText,
  artifactSha256: digestSchema.nullable(), confidence: z.enum(["PROVEN", "INTERPRETATION", "UNKNOWN"]), unresolved: z.array(safeText).max(30)
}).strict();
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export const findingSchema = z.object({ id: z.string().regex(/^[A-Z0-9_]+$/), subjectAddress: address, statement: safeText,
  classification: z.enum(["PROVEN", "INTERPRETATION", "UNKNOWN"]), evidence: z.array(evidenceRefSchema).min(1), unresolved: z.array(safeText).max(30)
}).strict();
export type AssuranceFinding = z.infer<typeof findingSchema>;
export const dimensionSchema = z.object({ state: assuranceStateSchema, rule: z.string().regex(/^[A-Z0-9_-]+$/),
  satisfied: z.array(z.string().regex(/^[A-Z0-9_]+$/)), missing: z.array(z.string().regex(/^[A-Z0-9_]+$/)), findingIds: z.array(z.string().regex(/^[A-Z0-9_]+$/))
}).strict().refine(value => value.state !== "VERIFIED" || (value.missing.length === 0 && value.satisfied.length > 0 && value.findingIds.length > 0), "Verified dimensions require fulfilled requirements and referenced evidence.");
export const configurationSchema = z.object({
  oracle: address, feed: address, cache: address.nullable(), forwarder: address.nullable(), feedId: hash.nullable(),
  proxyOwner: address.nullable(), cacheOwner: address.nullable(), forwarderOwner: address.nullable(), allowedWorkflowOwner: address.nullable(),
  proxyImplementation: address.nullable(), proxyAdmin: address.nullable(), proxyBeacon: address.nullable(),
  oracleRuntime: hash.nullable(), proxyRuntime: hash.nullable(), cacheRuntime: hash.nullable(), forwarderRuntime: hash.nullable(),
  compositionHash: digestSchema.nullable(), signerConfigurationHash: digestSchema.nullable(), workflowConfigurationHash: digestSchema.nullable(),
  collateralToken: address.nullable(), loanToken: address.nullable(), collateralDecimals: z.number().int().min(0).max(77).nullable(),
  loanDecimals: z.number().int().min(0).max(77).nullable(), feedDecimals: z.number().int().min(0).max(77).nullable(),
  denomination: z.literal("ECONOMIC_QUOTE_UNVERIFIED"), descriptionHash: digestSchema.nullable(),
  signerCoverage: z.enum(["UNOBSERVED", "SAMPLED_ACTIVE_CONFIGS", "COMPLETE"])
}).strict();
export type OracleConfiguration = z.infer<typeof configurationSchema>;
export const configurationDigest = (value: OracleConfiguration): string => createHash("sha256").update(JSON.stringify(
  Object.fromEntries(Object.entries(configurationSchema.parse(value)).map(([key, item]) => [key, typeof item === "string" ? item.toLowerCase() : item]))
)).digest("hex");
export const continuityScopeSchema = z.string().regex(/^(?:LIVE|FIXTURE|HISTORICAL-[1-9][0-9]{0,77})$/);
export const configurationBaselineSchema = z.object({
  block: blockRefSchema, retrievedAt: z.iso.datetime(), snapshotIdentifier: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  configuration: configurationSchema, configurationFingerprint: digestSchema, observationTimestamp: unsignedSchema.nullable()
}).strict().refine(value => configurationDigest(value.configuration) === value.configurationFingerprint, "Configuration baseline fingerprint mismatch.");
export const changeCodeSchema = z.enum(["ORACLE_CONFIGURATION_CHANGED", "PROXY_IMPLEMENTATION_CHANGED", "ORACLE_OWNER_CHANGED", "ORACLE_FEED_ID_CHANGED", "ORACLE_SIGNER_CONFIGURATION_CHANGED", "ORACLE_DENOMINATION_CHANGED"]);
export type ConfigurationChange = z.infer<typeof changeCodeSchema>;
export const timestampAnomalySchema = z.enum(["ZERO_TIMESTAMP", "FUTURE_TIMESTAMP", "TIMESTAMP_REGRESSION", "TIMESTAMP_MISMATCH"]);
export const freshnessSchema = z.object({ state: assuranceStateSchema, observationTimestamp: unsignedSchema.nullable(),
  observationAgeSeconds: z.string().regex(/^-?(?:0|[1-9][0-9]{0,77})$/).nullable(),
  policyMaxAgeSeconds: unsignedSchema.nullable(), policyOrigin: z.enum(["NONE", "OPERATOR_DEFINED_LOCAL_REJECTION"]),
  policyRejected: z.boolean(), verifiedHeartbeatSeconds: unsignedSchema.nullable(), upstreamFreshnessGuaranteeSeconds: unsignedSchema.nullable(),
  timestampMeaning: z.enum(["WORKFLOW_SUPPLIED_OBSERVATION_TIME", "UNKNOWN"]), onchainExpiryEnforced: z.boolean().nullable(),
  timingConfigurationFingerprint: digestSchema.nullable(),
  anomalies: z.array(timestampAnomalySchema), evidence: z.array(evidenceRefSchema)
}).strict().refine(value => {
  if ((value.policyMaxAgeSeconds === null) !== (value.policyOrigin === "NONE")) return false;
  if (value.policyMaxAgeSeconds !== null && BigInt(value.policyMaxAgeSeconds) <= 0n) return false;
  const age = value.observationAgeSeconds === null ? null : BigInt(value.observationAgeSeconds);
  if (value.policyRejected !== (age !== null && value.policyMaxAgeSeconds !== null && age > BigInt(value.policyMaxAgeSeconds))) return false;
  const failed = value.anomalies.length > 0 || value.policyRejected || (age !== null && value.upstreamFreshnessGuaranteeSeconds !== null && age > BigInt(value.upstreamFreshnessGuaranteeSeconds));
  if (failed && value.state !== "FAILED") return false;
  if (age !== null && age < 0n && !value.anomalies.includes("FUTURE_TIMESTAMP")) return false;
  if (value.observationTimestamp === "0" && !value.anomalies.includes("ZERO_TIMESTAMP")) return false;
  return value.state !== "VERIFIED" || (!failed && age !== null && age >= 0n && value.observationTimestamp !== null && BigInt(value.observationTimestamp) > 0n
    && value.verifiedHeartbeatSeconds !== null && BigInt(value.verifiedHeartbeatSeconds) > 0n && value.upstreamFreshnessGuaranteeSeconds !== null
    && BigInt(value.upstreamFreshnessGuaranteeSeconds) > 0n && value.timestampMeaning !== "UNKNOWN" && value.timingConfigurationFingerprint !== null
    && value.evidence.some(ref => ref.confidence === "PROVEN" && ref.artifactSha256 !== null && ["VERIFIED_SOURCE", "OFFICIAL_DOCUMENT"].includes(ref.sourceKind)
      && ref.chainId === NETWORK.chainId && ref.subjectAddress.toLowerCase() === DEPLOYMENT.feed.toLowerCase()));
}, "Freshness claims contradict their timing evidence or local policy.");
export type FreshnessResult = z.infer<typeof freshnessSchema>;
export const independentAssetSchema = z.object({ chainId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), address, decimals: z.number().int().min(0).max(77) }).strict();
export const INDEPENDENT_PROOFS = ["ASSET", "QUOTE", "DENOMINATION", "TIMESTAMP", "FREQUENCY", "OPERATOR", "PROVENANCE", "INDEPENDENCE"] as const;
export const candidateSchema = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  availability: z.enum(["AVAILABLE", "UNAVAILABLE"]), base: independentAssetSchema, quote: independentAssetSchema,
  kind: z.enum(["MARKET_PRICE", "REDEMPTION_RATE"]), denomination: z.enum(["WHOLE_QUOTE_PER_WHOLE_BASE", "QUOTE_BASE_UNITS_PER_BASE_UNIT"]),
  price: unsignedSchema.nullable(), decimals: z.number().int().min(0).max(77), timestamp: unsignedSchema.nullable(),
  frequencySeconds: unsignedSchema.nullable(), operatorId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).nullable(),
  upstreamId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).nullable(),
  proofs: z.array(z.object({ claim: z.enum(INDEPENDENT_PROOFS), evidence: evidenceRefSchema }).strict()).max(30)
}).strict();
export type IndependentCandidate = z.infer<typeof candidateSchema>;
export const sameIndependentAsset = (a: z.infer<typeof independentAssetSchema>, b: z.infer<typeof independentAssetSchema>): boolean =>
  a.chainId === b.chainId && a.address.toLowerCase() === b.address.toLowerCase() && a.decimals === b.decimals;
export function missingIndependentProofs(source: IndependentCandidate, fixture: boolean): string[] {
  return INDEPENDENT_PROOFS.filter(claim => {
    const subject = claim === "QUOTE" ? source.quote : source.base;
    return !source.proofs.some(proof => proof.claim === claim && proof.evidence.confidence === "PROVEN" && proof.evidence.artifactSha256 !== null
      && proof.evidence.subjectAddress.toLowerCase() === subject.address.toLowerCase() && proof.evidence.chainId === subject.chainId
      && (proof.evidence.sourceKind !== "FIXTURE" || fixture)
      && (!["INDEPENDENCE", "FREQUENCY", "OPERATOR", "PROVENANCE"].includes(claim)
        || ["VERIFIED_SOURCE", "OFFICIAL_DOCUMENT", ...(fixture ? ["FIXTURE"] : [])].includes(proof.evidence.sourceKind)));
  }).map(claim => `UNPROVEN_${claim}`);
}
const rationalSchema = z.object({ numerator: z.string().regex(/^[1-9][0-9]{0,159}$/), denominator: z.string().regex(/^[1-9][0-9]{0,159}$/) }).strict();
export const independentSchema = z.object({ state: assuranceStateSchema,
  availability: z.enum(["NOT_CONFIGURED", "AVAILABLE", "UNAVAILABLE"]), sourceId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).nullable(),
  eligible: z.boolean(), reasons: z.array(z.string().regex(/^[A-Z0-9_]+$/)), toleranceBps: z.number().int().min(0).max(10_000).nullable(),
  morphoPrice: unsignedSchema.nullable(), independentPrice: unsignedSchema.nullable(),
  candidate: candidateSchema.nullable(), selectedUpstreamId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).nullable(),
  base: independentAssetSchema, quote: independentAssetSchema, evidenceMode: z.enum(["PRODUCTION", "FIXTURE"]),
  blockTimestamp: unsignedSchema.nullable(), selectedTimestamp: unsignedSchema.nullable(), candidateAgeSeconds: unsignedSchema.nullable(), timestampSkewSeconds: unsignedSchema.nullable(),
  policyMaxAgeSeconds: unsignedSchema.nullable(), policyMaxSkewSeconds: unsignedSchema.nullable(),
  normalizedMorpho: rationalSchema.nullable(), normalizedIndependent: rationalSchema.nullable(),
  deviationBps: z.string().max(650).regex(/^(?:0|[1-9][0-9]*)\/[1-9][0-9]*$/).nullable(), disagrees: z.boolean(), evidence: z.array(evidenceRefSchema)
}).strict().refine(value => {
  if (value.candidate?.id !== (value.sourceId ?? undefined) || (value.candidate && (value.candidate.availability !== value.availability || value.candidate.price !== value.independentPrice))) return false;
  if (value.disagrees && (!value.eligible || value.state !== "FAILED")) return false;
  if (value.state === "VERIFIED" && (!value.eligible || value.disagrees)) return false;
  if (value.availability === "NOT_CONFIGURED" && value.candidate !== null) return false;
  if (value.candidate && JSON.stringify(value.evidence) !== JSON.stringify(value.candidate.proofs.map(proof => proof.evidence))) return false;
  if (value.candidate?.availability === "AVAILABLE" && (value.candidate.price === null || BigInt(value.candidate.price) <= 0n
    || BigInt(value.candidate.price) > U256_MAX) && value.state !== "FAILED") return false;
  if (!value.eligible) return value.normalizedMorpho === null && value.normalizedIndependent === null && value.deviationBps === null;
  if (!value.candidate || value.availability !== "AVAILABLE" || !value.normalizedMorpho || !value.normalizedIndependent || value.deviationBps === null || value.toleranceBps === null
    || value.policyMaxAgeSeconds === null || value.policyMaxSkewSeconds === null || value.candidateAgeSeconds === null || value.timestampSkewSeconds === null || value.selectedTimestamp === null
    || value.blockTimestamp === null || value.selectedUpstreamId === null || value.selectedUpstreamId === value.candidate.upstreamId
    || value.candidate.kind !== "MARKET_PRICE" || value.candidate.timestamp === null || value.candidate.frequencySeconds === null
    || BigInt(value.candidate.frequencySeconds) <= 0n || value.candidate.operatorId === null || value.candidate.upstreamId === null
    || value.morphoPrice === null || value.independentPrice === null || BigInt(value.morphoPrice) <= 0n || BigInt(value.morphoPrice) > U256_MAX
    || BigInt(value.independentPrice) <= 0n || BigInt(value.independentPrice) > U256_MAX) return false;
  if (!sameIndependentAsset(value.base, value.candidate.base) || !sameIndependentAsset(value.quote, value.candidate.quote)
    || missingIndependentProofs(value.candidate, value.evidenceMode === "FIXTURE").length) return false;
  const candidateTime = BigInt(value.candidate.timestamp), selectedTime = BigInt(value.selectedTimestamp), blockTime = BigInt(value.blockTimestamp);
  const age = blockTime - candidateTime, skew = candidateTime > selectedTime ? candidateTime - selectedTime : selectedTime - candidateTime;
  if (candidateTime <= 0n || selectedTime <= 0n || candidateTime > blockTime || selectedTime > blockTime
    || value.candidateAgeSeconds !== age.toString() || value.timestampSkewSeconds !== skew.toString()
    || BigInt(value.policyMaxAgeSeconds) <= 0n || BigInt(value.policyMaxAgeSeconds) > 31_536_000n || BigInt(value.policyMaxSkewSeconds) > 31_536_000n
    || age > BigInt(value.policyMaxAgeSeconds) || blockTime - selectedTime > BigInt(value.policyMaxAgeSeconds) || skew > BigInt(value.policyMaxSkewSeconds)) return false;
  const a = value.normalizedMorpho, b = value.normalizedIndependent;
  const expectedA = normalizePrice(BigInt(value.morphoPrice), 36, value.base.decimals, value.quote.decimals, "QUOTE_BASE_UNITS_PER_BASE_UNIT");
  const expectedB = normalizePrice(BigInt(value.independentPrice), value.candidate.decimals, value.base.decimals, value.quote.decimals, value.candidate.denomination);
  if (a.numerator !== expectedA.numerator.toString() || a.denominator !== expectedA.denominator.toString()
    || b.numerator !== expectedB.numerator.toString() || b.denominator !== expectedB.denominator.toString()) return false;
  const difference = BigInt(b.numerator) * BigInt(a.denominator) - BigInt(a.numerator) * BigInt(b.denominator);
  const numerator = (difference < 0n ? -difference : difference) * 10_000n, denominator = BigInt(a.numerator) * BigInt(b.denominator);
  return value.deviationBps === `${numerator}/${denominator}` && value.disagrees === (numerator > BigInt(value.toleranceBps) * denominator)
    && value.state === (value.disagrees ? "FAILED" : "VERIFIED") && JSON.stringify(value.reasons) === JSON.stringify(value.disagrees ? ["INDEPENDENT_PRICE_DISAGREEMENT"] : []);
}, "Independent validation must retain consistent units, temporal bounds and comparison evidence.");
export type IndependentResult = z.infer<typeof independentSchema>;
export const assuranceSchema = z.object({ schemaVersion: z.literal(1), policyVersion: z.literal("oracle-assurance-v1"),
  chainId: z.literal(NETWORK.chainId), marketId: z.literal(DEPLOYMENT.marketId), oracleAddress: z.literal(DEPLOYMENT.oracle),
  evaluatedAt: z.iso.datetime(), retrievedAt: z.iso.datetime().nullable(), evidenceKind: z.enum(["LIVE_CHAIN_READ", "HISTORICAL_SNAPSHOT", "FIXTURE", "UNAVAILABLE"]),
  continuityScope: continuityScopeSchema, baseline: configurationBaselineSchema.nullable(),
  block: blockRefSchema.nullable(), snapshotIdentifier: z.string().regex(/^sha256:[a-f0-9]{64}$/).nullable(),
  overall: assuranceStateSchema, actionable: z.literal(false), gate: z.enum(["DATA_UNVERIFIED", "DATA_INVALID", "DATA_UNAVAILABLE", "ASSURANCE_REQUIREMENTS_MET"]),
  dimensions: z.object({ CONTRACT_IDENTITY: dimensionSchema, SOURCE_PROVENANCE: dimensionSchema, OPERATOR_PROVENANCE: dimensionSchema,
    PRICE_SEMANTICS: dimensionSchema, FRESHNESS: dimensionSchema, INDEPENDENT_VALIDATION: dimensionSchema, CONFIGURATION_CONTROL: dimensionSchema }).strict(),
  configuration: configurationSchema.nullable(), configurationFingerprint: digestSchema.nullable(), changes: z.array(changeCodeSchema),
  evidenceInvalidated: z.boolean(), invalidatedAt: z.iso.datetime().nullable(), invalidationReason: z.enum(["CONFIGURATION_CHANGE", "OBSERVABILITY_GAP"]).nullable(),
  freshness: freshnessSchema, independent: independentSchema, findings: z.array(findingSchema),
  limitations: z.array(safeText), providerIndependence: z.literal("RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT")
}).strict().refine(result => {
  const failed = DIMENSIONS.some(dimension => result.dimensions[dimension].state === "FAILED");
  const verified = !result.evidenceInvalidated && DIMENSIONS.every(dimension => result.dimensions[dimension].state === "VERIFIED");
  if (result.overall !== (failed ? "FAILED" : verified ? "VERIFIED" : "UNVERIFIED")) return false;
  if (result.overall === "VERIFIED" && (result.evidenceInvalidated || DIMENSIONS.some(dimension => result.dimensions[dimension].state !== "VERIFIED"))) return false;
  if ((result.gate === "ASSURANCE_REQUIREMENTS_MET") !== (result.overall === "VERIFIED")) return false;
  if ((failed || result.freshness.state === "FAILED" || result.independent.state === "FAILED") && result.gate !== "DATA_INVALID") return false;
  if (result.independent.availability === "UNAVAILABLE" && !["DATA_INVALID", "DATA_UNAVAILABLE"].includes(result.gate)) return false;
  if ((result.configuration === null) !== (result.configurationFingerprint === null)) return false;
  if (result.configuration && configurationDigest(result.configuration) !== result.configurationFingerprint) return false;
  if (result.evidenceInvalidated !== (result.invalidatedAt !== null && result.invalidationReason !== null)) return false;
  if (result.changes.length > 0 && !result.evidenceInvalidated) return false;
  if (result.evidenceInvalidated && DIMENSIONS.some(dimension => result.dimensions[dimension].state === "VERIFIED")) return false;
  if (result.dimensions.FRESHNESS.state === "VERIFIED" && result.freshness.state !== "VERIFIED") return false;
  if (result.dimensions.INDEPENDENT_VALIDATION.state === "VERIFIED" && result.independent.state !== "VERIFIED") return false;
  if (result.freshness.state === "FAILED" && result.dimensions.FRESHNESS.state !== "FAILED") return false;
  if (result.independent.state === "FAILED" && result.dimensions.INDEPENDENT_VALIDATION.state !== "FAILED") return false;
  if (result.freshness.state === "VERIFIED" && result.freshness.timingConfigurationFingerprint !== result.configurationFingerprint) return false;
  if (result.independent.evidenceMode === "FIXTURE" && result.evidenceKind !== "FIXTURE") return false;
  if (result.independent.blockTimestamp !== (result.block?.timestamp ?? null) || result.independent.selectedTimestamp !== result.freshness.observationTimestamp) return false;
  if (result.block && result.freshness.observationTimestamp !== null
    && result.freshness.observationAgeSeconds !== (BigInt(result.block.timestamp) - BigInt(result.freshness.observationTimestamp)).toString()) return false;
  if (result.evidenceKind === "HISTORICAL_SNAPSHOT" && result.block && result.continuityScope !== `HISTORICAL-${result.block.number}`) return false;
  if (result.evidenceKind === "LIVE_CHAIN_READ" && result.continuityScope !== "LIVE") return false;
  if (result.baseline && result.baseline.configuration.oracle.toLowerCase() !== DEPLOYMENT.oracle.toLowerCase()) return false;
  const ids = new Set(result.findings.map(finding => finding.id));
  return result.findings.length === ids.size && DIMENSIONS.every(dimension => result.dimensions[dimension].findingIds.every(id => ids.has(id))
    && (result.dimensions[dimension].state !== "VERIFIED" || result.dimensions[dimension].findingIds.every(id => result.findings.some(finding => finding.id === id
      && finding.classification === "PROVEN" && finding.evidence.some(ref => ref.confidence === "PROVEN" && ref.artifactSha256 !== null)))));
}, "Assurance result does not satisfy its conservative state invariants.");
export type OracleAssurance = z.infer<typeof assuranceSchema>;

/** Diagnostics never persist remote error bodies or secret-bearing URLs. */
export function redactPublicText(value: string): string {
  return value.replace(/https?:\/\/[^\s<>"']+/g, url => {
    try { const parsed = new URL(url); return parsed.username || parsed.password || parsed.search ? "[REDACTED_URL]" : url; } catch { return "[REDACTED_URL]"; }
  }).replace(/Bearer\s+\S+/gi, "[REDACTED_AUTHORIZATION]")
    .replace(/\b(?:password|private[_-]?key|api[_-]?key|token|secret)\s*[:=]\s*\S+/gi, "[REDACTED_VALUE]")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ").slice(0, 2_048);
}
