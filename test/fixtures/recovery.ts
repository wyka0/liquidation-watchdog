import { DEPLOYMENT, NETWORK } from "../../src/config/deployment.js";
import type { Snapshot } from "../../src/domain/types.js";
import { configurationDigest } from "../../src/oracle-assurance/model.js";
import { configurationFromSnapshot } from "../../src/oracle-assurance/configuration.js";
import { compareIndependent } from "../../src/oracle-assurance/independent.js";
import { assuranceSchema, DIMENSIONS } from "../../src/oracle-assurance/model.js";
import type { OracleAssurance } from "../../src/oracle-assurance/model.js";
import { REVIEWED_SOURCES } from "../../src/oracle-assurance/reviewed.js";
import { snapshotIdentifier } from "../../src/risk/provenance.js";
import { candidateFixture } from "./independent.js";

/** Synthetic fully verified assurance bound to the deterministic fixture snapshot.
 * Every dimension, freshness and independence claim is fixture-sourced; this is never production evidence.
 * It exists so the strict recovery-eligibility gate can be exercised on its accepting path offline. */
export function verifiedAssuranceFixture(snapshot: Snapshot): OracleAssurance {
  const configuration = configurationFromSnapshot(snapshot);
  const configurationFingerprint = configurationDigest(configuration);
  const block = snapshot.block!, round = snapshot.oracle.round!;
  const timing = { ...REVIEWED_SOURCES[0]!, subjectAddress: DEPLOYMENT.feed };
  const findings = DIMENSIONS.map(dimension => ({
    id: `FIXTURE_${dimension}`, subjectAddress: snapshot.oracle.address,
    statement: `Synthetic fully verified ${dimension} evidence for the recovery-eligibility fixture only.`,
    classification: "PROVEN" as const,
    evidence: [{ ...timing, method: `Synthetic verified ${dimension} evidence for deterministic unit tests only.` }],
    unresolved: []
  }));
  const dimensions = Object.fromEntries(DIMENSIONS.map(dimension => [dimension, {
    state: "VERIFIED" as const, rule: "FIXTURE_ALL_REQUIREMENTS", satisfied: [`FIXTURE_${dimension}`], missing: [], findingIds: [`FIXTURE_${dimension}`]
  }]));
  const candidate = candidateFixture();
  candidate.price = (snapshot.oracle.price! / 10n ** 6n).toString();
  candidate.timestamp = round.updatedAt.toString();
  const independent = compareIndependent({ candidate, base: { chainId: NETWORK.chainId, address: DEPLOYMENT.collateralToken, decimals: 18 },
    quote: { chainId: NETWORK.chainId, address: DEPLOYMENT.loanToken, decimals: 6 }, morphoPrice: snapshot.oracle.price!,
    blockTimestamp: block.timestamp, selectedTimestamp: round.updatedAt, selectedUpstreamId: "selected_upstream",
    toleranceBps: 100, maxAgeSeconds: 10_000n, maxSkewSeconds: 100n, fixture: true });
  return assuranceSchema.parse({
    schemaVersion: 1, policyVersion: "oracle-assurance-v1", chainId: NETWORK.chainId, marketId: DEPLOYMENT.marketId,
    oracleAddress: DEPLOYMENT.oracle, evaluatedAt: snapshot.retrievedAt, retrievedAt: snapshot.retrievedAt,
    evidenceKind: "FIXTURE", continuityScope: "FIXTURE", baseline: null,
    block: { number: block.number.toString(), hash: block.hash, timestamp: block.timestamp.toString() },
    snapshotIdentifier: snapshotIdentifier(snapshot), overall: "VERIFIED", actionable: false, gate: "ASSURANCE_REQUIREMENTS_MET",
    dimensions, configuration, configurationFingerprint, changes: [], evidenceInvalidated: false,
    invalidatedAt: null, invalidationReason: null,
    freshness: { state: "VERIFIED", observationTimestamp: round.updatedAt.toString(),
      observationAgeSeconds: (block.timestamp - round.updatedAt).toString(), policyMaxAgeSeconds: null, policyOrigin: "NONE",
      policyRejected: false, verifiedHeartbeatSeconds: "300", upstreamFreshnessGuaranteeSeconds: "3600",
      timestampMeaning: "WORKFLOW_SUPPLIED_OBSERVATION_TIME", onchainExpiryEnforced: false,
      timingConfigurationFingerprint: configurationFingerprint, anomalies: [], evidence: [timing] },
    independent, findings, limitations: [], providerIndependence: "RPC_MCP_SHARED_UPSTREAM_NOT_INDEPENDENT"
  });
}
