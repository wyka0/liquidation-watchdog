import { DEPLOYMENT, NETWORK, RUNTIME_HASHES } from "../config/deployment.js";
import { validateBlock } from "../chain/snapshot.js";
import { DataError } from "../domain/errors.js";
import { stringify } from "../domain/serialize.js";
import type { Finding, QualityStatus, Scope, Snapshot } from "../domain/types.js";
import { accruePosition, valuePosition } from "../morpho/accounting.js";
import { assessOracle, emptyOracle } from "../oracle/validate.js";
import { deriveMarketId, validateChainId, validateMarket, validateMarketParams, validatePosition, validateToken } from "../validation/market.js";
import { sameHex } from "../validation/schemas.js";
import { worstQuality } from "../validation/quality.js";
import type { RiskDataQuality } from "./types.js";
import { demoPositionConfiguration } from "../config/position.js";
import type { PositionConfiguration } from "../config/position.js";

export function validateRiskSnapshot(snapshot: Snapshot, calculatedAt: Date,
  position: PositionConfiguration = demoPositionConfiguration()): RiskDataQuality {
  const identity = position.identity;
  const findings: Finding[] = [...snapshot.quality.findings];
  const add = (scope: Scope, status: Finding["status"], code: string, message: string) => findings.push({ scope, status, code, message });
  const attempt = (fn: () => void) => {
    try { fn(); } catch (error) {
      if (error instanceof DataError && error.quality !== "VALID") add(error.scope, error.quality, error.code, error.message);
      else add("snapshot", "INVALID", "RISK_VALIDATION_FAILED", "Snapshot validation failed; derived results are suppressed.");
    }
  };
  const sourceOracleQuality = snapshot.oracle.quality;
  const sourceStatuses = [snapshot.quality.overall, ...Object.values(snapshot.quality.byScope), sourceOracleQuality];
  const sourceQuality = worstQuality(sourceStatuses);
  for (const [scope, status] of Object.entries(snapshot.quality.byScope) as [Scope, QualityStatus][]) {
    if (status !== "VALID") add(scope, status, "SOURCE_SCOPE_QUALITY", `The Phase 1 ${scope} scope reports ${status}.`);
  }
  if (snapshot.quality.overall !== "VALID") add("snapshot", snapshot.quality.overall, "SOURCE_SNAPSHOT_QUALITY", `The source snapshot reports ${snapshot.quality.overall}.`);
  if (sourceOracleQuality !== "VALID") add("oracle", sourceOracleQuality, "SOURCE_ORACLE_QUALITY", `The source oracle reports ${sourceOracleQuality}.`);

  attempt(() => {
    validateChainId(BigInt(snapshot.network.chainId));
    if (!sameHex(snapshot.marketId, identity.marketId) || !sameHex(snapshot.account, identity.account)
      || snapshot.accountRole !== position.accountRole) {
      throw new DataError("SNAPSHOT_IDENTITY_MISMATCH", "The snapshot market/account differs from the inspected deployment.", "consistency");
    }
    if (!sameHex(snapshot.oracle.address, identity.oracleAddress) || !sameHex(snapshot.oracle.feed, DEPLOYMENT.feed)) {
      throw new DataError("ORACLE_ADDRESS_MISMATCH", "Oracle/feed address differs from the selected market.", "oracle");
    }
    for (const chain of Object.values(snapshot.observedChainIds)) {
      if (chain === null) add("network", "UNAVAILABLE", "CHAIN_ID_UNAVAILABLE", "Both chain IDs are required.");
      else validateChainId(chain);
    }
    if (Date.parse(snapshot.startedAt) > Date.parse(snapshot.retrievedAt) || Date.parse(snapshot.retrievedAt) > calculatedAt.getTime()) {
      throw new DataError("SNAPSHOT_TIME_MISMATCH", "Snapshot retrieval/calculation timestamps are inconsistent.", "consistency");
    }
  });

  const block = snapshot.block;
  if (block === null) {
    add("consistency", "UNAVAILABLE", "BLOCK_UNAVAILABLE", "No validated block is available.");
    snapshot.oracle.policy = emptyOracle().policy;
    add("oracle", "UNVERIFIED", "ORACLE_BINDING_UNAVAILABLE", "Oracle policy binding cannot be established without a snapshot block.");
  }
  else {
    attempt(() => validateBlock(block, block.number, new Date(snapshot.retrievedAt)));
    for (const header of [snapshot.consistency.rpcBefore, snapshot.consistency.mcpBefore, snapshot.consistency.rpcAfter, snapshot.consistency.mcpAfter]) {
      if (!header) add("consistency", "UNAVAILABLE", "HEADER_UNAVAILABLE", "The complete before/after header set is required.");
      else if (header.number !== block.number || !sameHex(header.hash, block.hash) || !sameHex(header.parentHash, block.parentHash) || header.timestamp !== block.timestamp) {
        add("consistency", "INVALID", "SNAPSHOT_BLOCK_MISMATCH", "Block headers do not describe the same pinned snapshot.");
      }
    }
    for (const head of [snapshot.heads.rpc, snapshot.heads.mcp]) {
      if (head === null) add("network", "UNAVAILABLE", "HEAD_UNAVAILABLE", "Both observed chain heads are required.");
      else if (head < block.number) add("consistency", "INVALID", "SNAPSHOT_HEAD_MISMATCH", "The selected block is ahead of an observed head.");
    }
    if (!snapshot.consistency.blockHashesStable || snapshot.consistency.batchSentinelsChecked !== 6 || snapshot.consistency.comparisons.length !== 58) {
      add("consistency", "UNAVAILABLE", "SNAPSHOT_CHECKS_INCOMPLETE", "The Phase 1 consistency checks did not complete.");
    }
    for (const comparison of snapshot.consistency.comparisons) {
      if (!comparison.matches || comparison.rpcDigest !== comparison.mcpDigest || (comparison.blockNumber !== null && comparison.blockNumber !== block.number)) {
        add("consistency", "INVALID", "SNAPSHOT_COMPARISON_MISMATCH", "Provider comparisons disagree or belong to another block.");
      }
    }
    if (snapshot.reads.some(read => read.blockNumber !== null && read.blockNumber !== block.number)) {
      add("consistency", "INVALID", "SNAPSHOT_READ_MISMATCH", "The read trace contains another block.");
    }
    if (!["rpc", "mcp"].every(source => snapshot.reads.some(read => read.source === source))) {
      add("consistency", "UNAVAILABLE", "READ_TRACE_INCOMPLETE", "Both access paths must be represented in the snapshot read trace.");
    }
    if (snapshot.contracts.length !== 10 || new Set(snapshot.contracts.map(contract => contract.address.toLowerCase())).size !== 10) {
      add("contracts", "UNAVAILABLE", "CONTRACT_INVENTORY_INCOMPLETE", "The ten-contract Phase 1 inventory is required.");
    }
    for (const contract of snapshot.contracts) {
      if (contract.blockNumber !== block.number || contract.byteLength === 0 || !contract.mcpMatchesRpc) {
        add("contracts", "INVALID", "CONTRACT_SNAPSHOT_MISMATCH", "Contract code is absent, inconsistent, or bound to another block.");
      }
    }
    for (const address of [DEPLOYMENT.multicall, identity.protocolAddress, identity.irmAddress, DEPLOYMENT.oracleFactory,
      identity.oracleAddress, identity.loanToken, identity.collateralToken, DEPLOYMENT.feed, snapshot.oracle.cache, snapshot.oracle.forwarder]) {
      if (address === null || !snapshot.contracts.some(contract => sameHex(contract.address, address))) {
        add("contracts", "UNAVAILABLE", "REQUIRED_CONTRACT_MISSING", "An address required by the selected market/oracle is missing from the code inventory.");
      }
    }
    const multicall = snapshot.contracts.find(contract => sameHex(contract.address, DEPLOYMENT.multicall));
    if (multicall && !sameHex(multicall.keccak256, RUNTIME_HASHES.multicall)) add("contracts", "INVALID", "MULTICALL_CODE_MISMATCH", "Multicall3 differs from its Phase 1 runtime pin.");
    // Reassess on the parsed copy with the unchanged production policy. Caller-supplied
    // sourceVerified/heartbeat flags cannot promote this selected oracle to verified.
    attempt(() => { findings.push(...assessOracle(snapshot.oracle, block, snapshot.contracts)); });
  }

  if (!snapshot.params || !snapshot.market || !snapshot.position || !snapshot.tokens.loan || !snapshot.tokens.collateral || snapshot.borrowRatePerSecondWad === null) {
    add("snapshot", "UNAVAILABLE", "RISK_INPUT_UNAVAILABLE", "Market, position, token metadata, or borrow rate is unavailable.");
  }
  if (!snapshot.accounting || !snapshot.valuation) {
    add("accounting", sourceQuality === "STALE" ? "STALE" : "UNAVAILABLE", "ACCOUNTING_UNAVAILABLE", "Phase 1 accounting/valuation is absent or suppressed; it is not replaced with zero.");
  }
  attempt(() => {
    if (snapshot.params) {
      validateMarketParams(snapshot.params);
      if (snapshot.derivedMarketId === null || !sameHex(deriveMarketId(snapshot.params), snapshot.marketId) || !sameHex(snapshot.derivedMarketId, snapshot.marketId)) {
        throw new DataError("SNAPSHOT_MARKET_MISMATCH", "Market parameters and derived market ID do not match.", "consistency");
      }
    }
    if (snapshot.market && block) validateMarket(snapshot.market, block);
    if (snapshot.position && snapshot.market) validatePosition(snapshot.position, snapshot.market);
    if (snapshot.tokens.loan) validateToken(snapshot.tokens.loan, "loan");
    if (snapshot.tokens.collateral) validateToken(snapshot.tokens.collateral, "collateral");
    if (snapshot.accounting && snapshot.params && snapshot.market && snapshot.position && block && snapshot.borrowRatePerSecondWad !== null) {
      const expected = accruePosition(snapshot.params, snapshot.market, snapshot.position, block.timestamp, snapshot.borrowRatePerSecondWad);
      if (stringify(expected) !== stringify(snapshot.accounting)) {
        throw new DataError("SNAPSHOT_ACCOUNTING_MISMATCH", "Accrual values do not match the snapshot's market, shares, rate and timestamp.", "accounting");
      }
      if (snapshot.oracle.price !== null && snapshot.valuation) {
        const expectedValue = valuePosition(snapshot.position.collateral, snapshot.oracle.price, snapshot.params.lltv, expected.debt);
        if (stringify(expectedValue) !== stringify(snapshot.valuation)) {
          throw new DataError("SNAPSHOT_VALUATION_MISMATCH", "Valuation does not match this snapshot's collateral, price, LLTV and accrued debt.", "accounting");
        }
      }
    }
  });
  let overall = worstQuality([...sourceStatuses, ...findings.map(finding => finding.status)]);
  if (!snapshot.accepted && (overall === "VALID" || overall === "UNVERIFIED")) {
    add("snapshot", "UNAVAILABLE", "SOURCE_SNAPSHOT_REJECTED", "The read path did not accept this snapshot.");
    overall = "UNAVAILABLE";
  }
  if (snapshot.network.chainId !== NETWORK.chainId) overall = "INVALID";
  return {
    overall, oracle: worstQuality([sourceOracleQuality, ...findings.filter(finding => finding.scope === "oracle").map(finding => finding.status)]),
    sourceSnapshot: snapshot.quality.overall, findings
  };
}
