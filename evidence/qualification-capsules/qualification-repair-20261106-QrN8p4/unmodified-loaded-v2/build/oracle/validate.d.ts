import type { BlockRef, ContractEvidence, Finding, OracleRead } from "../domain/types.js";
import type { OraclePolicy } from "./policy.js";
export declare function emptyOracle(): OracleRead;
export declare function assessOracle(oracle: OracleRead, block: BlockRef, contracts: readonly ContractEvidence[], policy?: Readonly<OraclePolicy>): Finding[];
