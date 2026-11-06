import type { Address, Hex } from "viem";
import type { ThresholdConfiguration } from "../config/risk.js";
import type { RecoveryEligibility } from "./eligibility.js";
import type { EvidenceKind, Finding, OracleRead, QualityStatus, TokenMetadata } from "../domain/types.js";
import type { CollateralMath } from "./collateral.js";
import type { RepaymentMath } from "./repayment.js";
import type { MathematicalRiskState, RiskState } from "./thresholds.js";

export interface RiskProvenance {
  chainId: number;
  protocol: "Morpho Blue";
  morphoAddress: Address;
  marketId: Hex;
  account: Address;
  accountRole: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET" | "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
  blockNumber: bigint | null;
  blockHash: Hex | null;
  blockTimestamp: bigint | null;
  evidenceKind: EvidenceKind | null;
  temporalContext: "LIVE_AS_OF_BLOCK" | "HISTORICAL" | "FIXTURE" | "UNAVAILABLE";
  snapshotRetrievedAt: string | null;
  inputSnapshotIdentifier: string | null;
}

export interface RiskDataQuality {
  overall: QualityStatus;
  oracle: QualityStatus;
  sourceSnapshot: QualityStatus;
  findings: Finding[];
}

export interface Actionability {
  actionable: false;
  status: "INDICATIVE_ONLY" | "BLOCKED";
  reasons: string[];
}

export interface CalculationIssue {
  code: string;
  message: string;
}

export interface RecommendationContext extends RiskProvenance {
  inputSnapshotIdentifier: string;
  blockNumber: bigint;
  blockHash: Hex;
  blockTimestamp: bigint;
  calculatedAt: string;
  calculationMethod: string;
  calculationVersion: "1.0.0";
  ratioScale: bigint;
  targetRatio: bigint;
  thresholdConfiguration: ThresholdConfiguration;
  tokens: { loan: TokenMetadata; collateral: TokenMetadata };
  oracleAddress: Address;
  oraclePrice: bigint;
  oracleTimestamp: bigint;
  oraclePolicy: OracleRead["policy"];
  dataQuality: RiskDataQuality;
  actionability: Actionability;
  actionable: false;
  indicative: true;
  roundingMethod: string[];
  assumptions: string[];
  warnings: string[];
}

export interface RecoveryEstimate<T> extends RecommendationContext {
  status: "CALCULATED" | "BLOCKED" | "INVALID";
  amount: { raw: bigint; formatted: string; tokenAddress: Address; symbol: string; decimals: number } | null;
  calculation: T | null;
  issue: CalculationIssue | null;
}

export interface RiskResult extends RiskProvenance {
  schemaVersion: 1;
  calculationVersion: "1.0.0";
  calculatedAt: string;
  ratioScale: bigint;
  collateralAmount: bigint | null;
  collateralValue: bigint | null;
  debtAmount: bigint | null;
  liquidationCapacity: bigint | null;
  ltv: bigint | null;
  safetyRatio: bigint | null;
  capacityRelation: "NO_DEBT" | "BELOW_DEBT" | "EQUAL_TO_DEBT" | "ABOVE_DEBT" | null;
  mathematicalRiskState: MathematicalRiskState | null;
  riskState: RiskState;
  dataQuality: RiskDataQuality;
  actionability: Actionability;
  actionable: false;
  indicative: true;
  oracleAddress: Address;
  oraclePrice: bigint | null;
  oracleTimestamp: bigint | null;
  oraclePolicy: OracleRead["policy"] | null;
  tokens: { loan: TokenMetadata | null; collateral: TokenMetadata | null };
  thresholdConfiguration: ThresholdConfiguration;
  /** Strict eligibility outcome for recovery estimates. Base risk never implies estimates; this field records
   * why they are present or absent. Internal only: it is not part of the persisted public risk view. */
  recoveryEligibility: RecoveryEligibility;
  repayment: RecoveryEstimate<RepaymentMath> | null;
  additionalCollateral: RecoveryEstimate<CollateralMath> | null;
  warnings: string[];
}
