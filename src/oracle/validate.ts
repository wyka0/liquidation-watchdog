import { zeroAddress } from "viem";
import type { BlockRef, ContractEvidence, Finding, OracleRead } from "../domain/types.js";
import { DEPLOYMENT, NETWORK } from "../config/deployment.js";
import { sameHex, U256_MAX } from "../validation/schemas.js";
import { worstQuality } from "../validation/quality.js";
import type { OraclePolicy } from "./policy.js";
import { SELECTED_ORACLE_POLICY } from "./policy.js";

export function emptyOracle(): OracleRead {
  return {
    address: DEPLOYMENT.oracle, feed: DEPLOYMENT.feed, price: null, composition: null,
    feedId: null, decimals: null, description: null, typeAndVersion: null, round: null,
    latestTimestamp: null, proxyOwner: null, cache: null, cacheTypeAndVersion: null,
    cacheOwner: null, forwarder: null, forwarderOwner: null, forwarderTypeAndVersion: null,
    allowedWorkflowOwner: null, cacheAnswer: null, cacheTimestamp: null, ageSeconds: null,
    quality: "UNAVAILABLE",
    policy: {
      sourceVerified: false, operatorIdentityVerified: false, timestampSemanticsVerified: false,
      timestampMeaning: "Unavailable until the bound proxy and cache are verified.",
      heartbeatSeconds: null, heartbeatVerified: false, expectedUpdateFrequency: "UNVERIFIED",
      stalenessEnforcedOnchain: null, references: SELECTED_ORACLE_POLICY.references
    }
  };
}

export function assessOracle(oracle: OracleRead, block: BlockRef, contracts: readonly ContractEvidence[], policy: Readonly<OraclePolicy> = SELECTED_ORACLE_POLICY): Finding[] {
  const findings: Finding[] = [];
  const add = (status: Finding["status"], code: string, message: string) => findings.push({ scope: "oracle", status, code, message });
  const codeHash = (address: string) => contracts.find(item => sameHex(item.address, address))?.keccak256;
  const bound = policy.chainId === NETWORK.chainId && sameHex(oracle.address, policy.oracle) && sameHex(oracle.feed, policy.feed)
    && oracle.cache !== null && sameHex(oracle.cache, policy.cache) && oracle.feedId !== null && sameHex(oracle.feedId, policy.feedId)
    && codeHash(oracle.feed) === policy.feedRuntimeHash && codeHash(oracle.cache) === policy.cacheRuntimeHash
    && oracle.typeAndVersion === "SelfManagedFeedsCacheProxy 1.0.0" && oracle.cacheTypeAndVersion === "SelfManagedFeedsCache 1.0.0";

  oracle.policy = {
    sourceVerified: bound && policy.sourceVerified,
    operatorIdentityVerified: bound && policy.operatorIdentityVerified,
    timestampSemanticsVerified: bound && policy.timestampSemanticsVerified,
    timestampMeaning: bound ? "Report observationsTimestamp supplied by the authorized workflow; not block inclusion or independent price validation time." : "UNVERIFIED: source binding is incomplete.",
    heartbeatSeconds: bound && policy.heartbeatVerified ? policy.heartbeatSeconds : null,
    heartbeatVerified: bound && policy.heartbeatVerified && policy.heartbeatSeconds !== null && policy.heartbeatSeconds > 0n,
    expectedUpdateFrequency: bound && policy.heartbeatVerified && policy.heartbeatSeconds !== null ? `Verified maximum age ${policy.heartbeatSeconds}s` : "UNVERIFIED; sample update intervals do not establish a heartbeat.",
    stalenessEnforcedOnchain: bound ? false : null,
    references: policy.references
  };
  if (!bound) add("UNVERIFIED", "ORACLE_ADAPTER_UNVERIFIED", "Current feed/cache address, bytecode, feed ID or version is outside the investigated adapter binding.");
  if (!oracle.policy.sourceVerified) add("UNVERIFIED", "ORACLE_SOURCE_UNVERIFIED", "The upstream workflow and exact feed identity are not independently established.");
  if (!oracle.policy.operatorIdentityVerified) add("UNVERIFIED", "ORACLE_OPERATOR_UNVERIFIED", "On-chain controller addresses are observable; their operator identities are unverified.");
  if (!oracle.policy.timestampSemanticsVerified) add("UNVERIFIED", "TIMESTAMP_SEMANTICS_UNVERIFIED", "Timestamp semantics are not verified for the active adapter.");
  if (!oracle.policy.heartbeatVerified) add("UNVERIFIED", "HEARTBEAT_UNVERIFIED", "No verified heartbeat or maximum acceptable price age exists for this feed.");

  if (oracle.price === null || oracle.round === null || oracle.latestTimestamp === null || oracle.cacheAnswer === null || oracle.cacheTimestamp === null) {
    add("UNAVAILABLE", "ORACLE_INPUT_UNAVAILABLE", "One or more price, round, or cache reads are unavailable.");
  }
  if (oracle.price !== null && (oracle.price <= 0n || oracle.price > U256_MAX)) add("INVALID", "INVALID_ORACLE_PRICE", "Oracle price must be a positive uint256.");
  if (oracle.decimals === null) add("UNAVAILABLE", "FEED_DECIMALS_UNAVAILABLE", "Feed decimals could not be read.");
  else if (oracle.decimals !== DEPLOYMENT.feedDecimals) add("INVALID", "FEED_DECIMALS_MISMATCH", "Feed decimals must match the verified 18-decimal adapter.");
  const c = oracle.composition;
  if (!c) {
    add("UNAVAILABLE", "ORACLE_COMPOSITION_UNAVAILABLE", "Oracle feed/vault composition could not be read.");
  } else {
    const allOmitted = [c.baseVault, c.quoteVault, c.baseFeed2, c.quoteFeed1, c.quoteFeed2].every(item => sameHex(item, zeroAddress));
    const exponent = 36 + DEPLOYMENT.loanDecimals - DEPLOYMENT.collateralDecimals - DEPLOYMENT.feedDecimals;
    if (!allOmitted || !sameHex(c.baseFeed1, DEPLOYMENT.feed) || c.baseVaultConversionSample !== 1n || c.quoteVaultConversionSample !== 1n || c.scaleFactor !== 10n ** BigInt(exponent)) {
      add("INVALID", "ORACLE_COMPOSITION_MISMATCH", "Oracle input composition or decimal scale differs from the verified single-feed market.");
    }
  }
  const r = oracle.round;
  if (r) {
    if (r.answer <= 0n || r.answer > (1n << 255n) - 1n) add("INVALID", "INVALID_FEED_ANSWER", "Feed answer must be positive and fit int256.");
    const invalidTimestamp = r.updatedAt <= 0n || r.startedAt <= 0n || r.updatedAt > block.timestamp || r.startedAt > r.updatedAt;
    if (invalidTimestamp || (bound && (r.updatedAt > (1n << 32n) - 1n || r.startedAt !== r.updatedAt))) {
      add("INVALID", "INVALID_FEED_TIMESTAMP", "Feed timestamp is zero, future, out of range, or inconsistent with the adapter semantics.");
      oracle.ageSeconds = null;
    } else {
      oracle.ageSeconds = block.timestamp - r.updatedAt;
      if (oracle.policy.heartbeatVerified && policy.heartbeatSeconds !== null && oracle.ageSeconds > policy.heartbeatSeconds) {
        add("STALE", "VERIFIED_POLICY_STALE", "Price age exceeds the bound, verified maximum-age policy.");
      }
    }
    // Zero rounds are REQUIRED for this adapter; Chainlink OCR round rules do not apply.
    if (bound && (r.roundId !== 0n || r.answeredInRound !== 0n)) add("INVALID", "FEED_ROUND_MISMATCH", "SelfManagedFeedsCacheProxy is expected to return zero round IDs.");
    if (oracle.latestTimestamp !== null && r.updatedAt !== oracle.latestTimestamp) add("INVALID", "FEED_TIMESTAMP_MISMATCH", "Feed timestamp getters disagree.");
    if (oracle.cacheTimestamp !== null && r.updatedAt !== oracle.cacheTimestamp) add("INVALID", "CACHE_TIMESTAMP_MISMATCH", "Proxy and cache timestamps disagree.");
    if (oracle.cacheAnswer !== null && r.answer !== oracle.cacheAnswer) add("INVALID", "CACHE_ANSWER_MISMATCH", "Proxy and cache answers disagree.");
    if (r.answer > 0n && c && oracle.price !== null) {
      const expected = r.answer * c.scaleFactor;
      if (expected > U256_MAX || oracle.price !== expected) add("INVALID", "ORACLE_SCALE_MISMATCH", "Oracle price does not equal the single feed answer times its scale factor.");
    }
  }
  oracle.quality = worstQuality(findings.map(item => item.status));
  return findings;
}
