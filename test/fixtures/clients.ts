import { readFileSync } from "node:fs";
import { decodeFunctionData, encodeFunctionResult, zeroAddress } from "viem";
import type { Abi, Address, Hex } from "viem";
import { z } from "zod";
import type { ReadClient } from "../../src/chain/client.js";
import type { BlockRef, ReadRecord, SourceKind } from "../../src/domain/types.js";
import { multicallAbi } from "../../src/chain/multicall.js";
import { irmAbi, morphoAbi, tokenAbi } from "../../src/morpho/abi.js";
import { cacheAbi, feedAbi, forwarderAbi, oracleAbi, oracleFactoryAbi } from "../../src/oracle/abi.js";
import { DEPLOYMENT } from "../../src/config/deployment.js";
import { bytesSchema } from "../../src/validation/schemas.js";
import { DataError } from "../../src/domain/errors.js";
import * as f from "./state.js";

const archivedRuntime = z.object({ code: z.record(z.string(), bytesSchema) }).parse(JSON.parse(
  readFileSync(new URL("./runtime.json", import.meta.url), "utf8")
));
const abi: Abi = [...morphoAbi, ...irmAbi, ...tokenAbi, ...oracleAbi, ...oracleFactoryAbi, ...feedAbi, ...cacheAbi, ...forwarderAbi, ...multicallAbi];

export interface FixtureOverrides {
  chainId?: bigint;
  finalChainId?: bigint;
  missingCode?: Address;
  changedMulticallCode?: boolean;
  afterHash?: Hex;
  initialHash?: Hex;
  headerTimestamp?: bigint;
  headNumber?: bigint;
  initialHeaderNumber?: bigint;
  sentinelBlockOffset?: bigint;
  sentinelTimestampOffset?: bigint;
  fail?: string;
  malformed?: string;
  unavailableCall?: boolean;
  values?: Record<string, unknown>;
}

export class FixtureClient implements ReadClient {
  readonly endpoint: string;
  readonly records: ReadRecord[] = [];
  readonly pinnedBlocks: bigint[] = [];
  private headerReads = 0;
  private chainReads = 0;

  constructor(readonly kind: SourceKind, readonly overrides: FixtureOverrides = {}) {
    this.endpoint = `https://${kind}.fixture.invalid`;
  }

  private record(method: string, blockNumber: bigint | null, params: unknown, result: unknown): void {
    this.records.push({ source: this.kind, endpoint: this.endpoint, method, blockNumber, params, result, retrievedAt: "2026-11-01T12:21:42.672Z" });
    if (blockNumber !== null) this.pinnedBlocks.push(blockNumber);
  }

  async chainId(): Promise<bigint> {
    const value = ++this.chainReads > 1 ? this.overrides.finalChainId ?? this.overrides.chainId ?? 1672n : this.overrides.chainId ?? 1672n;
    this.record("chainId", null, {}, value);
    return value;
  }
  async blockNumber(): Promise<bigint> {
    const value = this.overrides.headNumber ?? f.historicalBlock.number + 5n;
    this.record("blockNumber", null, {}, value);
    return value;
  }
  async block(number: bigint): Promise<BlockRef> {
    this.headerReads += 1;
    const value = {
      ...f.historicalBlock,
      // The returned header reproduces the exact requested number (Phase 1 consistency contract);
      // initialHeaderNumber exists only as an explicit invalid-row negative test knob.
      number: this.overrides.initialHeaderNumber ?? number,
      hash: this.headerReads > 1 ? this.overrides.afterHash ?? f.historicalBlock.hash : this.overrides.initialHash ?? f.historicalBlock.hash,
      timestamp: this.overrides.headerTimestamp ?? f.historicalBlock.timestamp
    };
    this.record("block", number, {}, value);
    return value;
  }
  async code(address: Address, block: bigint): Promise<Hex> {
    const value = address.toLowerCase() === this.overrides.missingCode?.toLowerCase() ? "0x"
      : address === DEPLOYMENT.multicall && this.overrides.changedMulticallCode ? "0x6000"
      : archivedRuntime.code[address.toLowerCase()] ?? "0x60006000";
    this.record("code", block, { address }, value);
    return value;
  }
  async call(to: Address, data: Hex, block: bigint): Promise<Hex> {
    if (this.overrides.unavailableCall) throw new DataError("FIXTURE_TIMEOUT", "FIXTURE: simulated transport timeout.", "network", "UNAVAILABLE");
    if (to !== DEPLOYMENT.multicall) throw new Error("FIXTURE: expected a Multicall3 target");
    const decoded = decodeFunctionData({ abi: multicallAbi, data });
    if (decoded.functionName !== "aggregate3") throw new Error("FIXTURE: expected aggregate3");
    const results = decoded.args[0].map(call => {
      const decodedCall = decodeFunctionData({ abi, data: call.callData });
      const method = decodedCall.functionName;
      const target = call.target.toLowerCase();
      const role = Object.entries({ loan: DEPLOYMENT.loanToken, collateral: DEPLOYMENT.collateralToken, oracle: DEPLOYMENT.oracle, feed: DEPLOYMENT.feed, cache: DEPLOYMENT.cache, forwarder: f.forwarder })
        .find(([, address]) => address.toLowerCase() === target)?.[0];
      const key = role ? `${role}.${method}` : method;
      if (key === this.overrides.fail) return { success: false, returnData: "0xdead" as Hex };
      if (key === this.overrides.malformed) return { success: true, returnData: "0x01" as Hex };
      const common: Record<string, unknown> = {
        getBlockNumber: block + (this.overrides.sentinelBlockOffset ?? 0n),
        getCurrentBlockTimestamp: f.historicalBlock.timestamp + (this.overrides.sentinelTimestampOffset ?? 0n),
        idToMarketParams: f.params, market: f.market, position: f.position,
        isIrmEnabled: true, isLltvEnabled: true, isMorphoChainlinkOracleV2: true, borrowRateView: f.rate,
        "loan.decimals": 6, "loan.name": "USD Coin", "loan.symbol": "USDC",
        "collateral.decimals": 18, "collateral.name": "Wrapped Staked Reservoir USD", "collateral.symbol": "wsrUSD",
        "oracle.price": f.price, "oracle.BASE_VAULT": zeroAddress, "oracle.QUOTE_VAULT": zeroAddress,
        "oracle.BASE_FEED_1": DEPLOYMENT.feed, "oracle.BASE_FEED_2": zeroAddress,
        "oracle.QUOTE_FEED_1": zeroAddress, "oracle.QUOTE_FEED_2": zeroAddress,
        "oracle.BASE_VAULT_CONVERSION_SAMPLE": 1n, "oracle.QUOTE_VAULT_CONVERSION_SAMPLE": 1n, "oracle.SCALE_FACTOR": 1_000_000n,
        "feed.latestRoundData": f.round, "feed.latestTimestamp": f.updatedAt, "feed.decimals": 18,
        "feed.description": "SelfManagedFeedsCacheProxy", "feed.typeAndVersion": "SelfManagedFeedsCacheProxy 1.0.0",
        "feed.owner": f.proxyOwner, "feed.aggregator": DEPLOYMENT.cache, "feed.getFeedId": DEPLOYMENT.feedId,
        "cache.owner": f.cacheOwner, "cache.typeAndVersion": "SelfManagedFeedsCache 1.0.0", "cache.getForwarderAddress": f.forwarder,
        "cache.getAllowedWorkflowOwner": zeroAddress, "cache.latestAnswerForFeed": f.answer, "cache.latestAnswerTimestampForFeed": f.updatedAt,
        "forwarder.owner": f.cacheOwner, "forwarder.typeAndVersion": "KeystoneForwarder 1.0.0"
      };
      const result = this.overrides.values && key in this.overrides.values ? this.overrides.values[key] : common[key];
      if (result === undefined) throw new Error(`FIXTURE: missing response for ${key}`);
      return { success: true, returnData: encodeFunctionResult({ abi, functionName: method, result }) };
    });
    const result = encodeFunctionResult({ abi: multicallAbi, functionName: "aggregate3", result: results });
    this.record("eth_call", block, { to, data }, result);
    return result;
  }
  async close(): Promise<void> { /* synthetic client */ }
}
