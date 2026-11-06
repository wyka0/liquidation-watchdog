import type { Snapshot } from "./types.js";
import { utcFromSeconds } from "./serialize.js";
import { formatAmount } from "../validation/decimals.js";
import { DEPLOYMENT } from "../config/deployment.js";

const missing = "UNAVAILABLE";

export function renderReport(snapshot: Snapshot): string {
  const s = snapshot;
  const loan = s.tokens.loan;
  const collateral = s.tokens.collateral;
  const a = s.accounting;
  const v = s.valuation;
  const o = s.oracle;
  const loanAmount = (value: bigint | null | undefined) => value == null || !loan ? missing : `${formatAmount(value, loan.decimals)} ${loan.symbol}`;
  const ratio = (value: bigint | null | undefined) => value == null ? "not defined" : formatAmount(value, 18);
  const time = (value: bigint | null | undefined) => value == null ? missing
    : value <= 0n || value > 8_640_000_000_000n ? `INVALID (${value})` : utcFromSeconds(value);
  const output = [
    "Liquidation Watchdog — Phase 1 read-only inspection",
    `Network: ${s.network.name} (chain ${s.network.chainId})`,
    `Evidence: ${s.evidenceKind} — as of the block below`,
    `Block: ${s.block?.number ?? missing} | ${time(s.block?.timestamp)}`,
    `Block hash: ${s.block?.hash ?? missing}`,
    `Observed heads: RPC ${s.heads.rpc ?? missing} | MCP ${s.heads.mcp ?? missing}`,
    `Morpho Blue (configured): ${DEPLOYMENT.morpho}`,
    `Market: ${s.marketId}`,
    `Parameter-derived market ID: ${s.derivedMarketId ?? missing}`,
    `IRM: ${s.params?.irm ?? missing}`,
    `Loan token: ${loan ? `${loan.name} (${loan.symbol}) | ${loan.address} | ${loan.decimals} decimals` : missing}`,
    `Collateral token: ${collateral ? `${collateral.name} (${collateral.symbol}) | ${collateral.address} | ${collateral.decimals} decimals` : missing}`,
    `Account: ${s.account} (public demonstration account; NOT the user's wallet)`,
    `Collateral: ${s.position && collateral ? `${formatAmount(s.position.collateral, collateral.decimals)} ${collateral.symbol}` : missing}`,
    `Borrow shares: ${s.position?.borrowShares ?? missing}`,
    `Supply shares (stored): ${s.position?.supplyShares ?? missing}`,
    `Accrued debt: ${a && loan ? `${formatAmount(a.debt, loan.decimals)} ${loan.symbol}` : missing}`,
    `Stored market assets (raw loan units): supply ${s.market?.totalSupplyAssets ?? missing} | borrow ${s.market?.totalBorrowAssets ?? missing}`,
    `Stored market shares: supply ${s.market?.totalSupplyShares ?? missing} | borrow ${s.market?.totalBorrowShares ?? missing}`,
    `Market lastUpdate: ${time(s.market?.lastUpdate)} | fee: ${s.market ? `${formatAmount(s.market.fee, 16)}%` : missing}`,
    `Accrued market borrow assets (raw): ${a?.accruedBorrowAssets ?? missing}`,
    `Accrued market supply assets (raw): ${a?.accruedSupplyAssets ?? missing} | supply shares: ${a?.accruedSupplyShares ?? missing}`,
    `Accrued fee amount (raw): ${a?.feeAmount ?? missing} | fee shares: ${a?.feeShares ?? missing}`,
    `Oracle: ${o.address} | feed proxy: ${o.feed}`,
    `Feed ID: ${o.feedId ?? missing} | cache: ${o.cache ?? missing}`,
    `Feed version: ${o.typeAndVersion ?? missing} | description: ${o.description ?? missing}`,
    `Oracle price (raw; scale 1e36 in loan/collateral base units): ${o.price ?? missing}`,
    `Feed answer (${o.decimals ?? missing} decimals): ${o.round ? o.round.answer > 0n && o.decimals !== null ? formatAmount(o.round.answer, o.decimals) : `${o.round.answer} [raw; inspect quality findings]` : missing}`,
    `Feed rounds: roundId ${o.round?.roundId ?? missing} | answeredInRound ${o.round?.answeredInRound ?? missing}`,
    `Feed updatedAt: ${time(o.round?.updatedAt)} | age at block: ${o.ageSeconds ?? missing}s`,
    `Timestamp meaning: ${o.policy.timestampMeaning}`,
    `Heartbeat: ${o.policy.heartbeatVerified ? `${o.policy.heartbeatSeconds}s (verified)` : "UNVERIFIED — no acceptable age assumed"}`,
    `On-chain age enforcement: ${o.policy.stalenessEnforcedOnchain === null ? "UNVERIFIED" : o.policy.stalenessEnforcedOnchain ? "present" : "absent in the investigated adapter"}`,
    `Controllers: proxy owner ${o.proxyOwner ?? missing} | cache owner ${o.cacheOwner ?? missing}`,
    `Forwarder: ${o.forwarder ?? missing} | owner ${o.forwarderOwner ?? missing}`,
    `Borrow rate: ${s.borrowRatePerSecondWad ?? missing} WAD/second | ${ratio(s.borrowRatePerSecondWad)} per second`,
    `Accrual elapsed: ${a?.elapsedSeconds ?? missing}s | market interest (raw): ${a?.interest ?? missing}`,
    `Collateral value (indicative): ${loanAmount(v?.collateralValue)}`,
    `LLTV-adjusted maximum borrow (indicative): ${loanAmount(v?.maxBorrow)}`,
    `LLTV: ${s.params ? `${formatAmount(s.params.lltv, 16)}%` : missing}`,
    `LTV: ${v?.ltvWad != null ? `${formatAmount(v.ltvWad, 16)}%` : "not available/defined"}`,
    `Provisional Morpho safety ratio (maxBorrow/accruedDebt): ${ratio(v?.safetyRatioWad)}`,
    `Debt state: ${v?.debtState ?? missing}`,
    "Calculations: INDICATIVE AND NON-ACTIONABLE; no risk classification is assigned.",
    `Oracle quality: ${o.quality}`,
    `Overall snapshot quality: ${s.quality.overall}`,
    `Quality by scope: ${Object.entries(s.quality.byScope).map(([scope, quality]) => `${scope}=${quality}`).join(" | ")}`,
    `Snapshot: ${s.accepted ? "accepted for read-only indicative reporting" : "REJECTED — derived results suppressed"}`,
    `MCP/RPC comparisons: ${s.consistency.comparisons.filter(item => item.matches).length}/${s.consistency.comparisons.length} matched`,
    `Block hash recheck: ${s.consistency.blockHashesStable ? "matched on both endpoints" : "not established"}`,
    `EVM block/timestamp sentinels: ${s.consistency.batchSentinelsChecked} checked on both paths`,
    `Contract code: ${s.contracts.filter(item => item.byteLength > 0 && item.mcpMatchesRpc).length}/${s.contracts.length} present and matched`,
    `RPC: ${s.network.rpc}`,
    `Chain MCP: ${s.network.mcp}`,
    "Provider relationship: hosted MCP reports the same upstream RPC; agreement is not independent consensus.",
    `Read trace: ${s.reads.length} public responses | started (UTC): ${s.startedAt}`,
    `Retrieved (UTC): ${s.retrievedAt}`
  ];
  if (s.quality.findings.length) {
    output.push("", "Data-quality findings:", ...s.quality.findings.map(item => `- ${item.status} [${item.scope}/${item.code}]: ${item.message}`));
  }
  return `${output.join("\n")}\n`;
}
