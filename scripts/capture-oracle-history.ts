import { mkdir, readFile, writeFile } from "node:fs/promises";
import { decodeEventLog, toEventSelector } from "viem";
import type { Hex } from "viem";
import { z } from "zod";
import { RpcClient } from "../src/chain/rpc.js";
import { DEPLOYMENT } from "../src/config/deployment.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";
import { DataError } from "../src/domain/errors.js";
import { stringify } from "../src/domain/serialize.js";
import { cacheAbi, forwarderAbi } from "../src/oracle/abi.js";
import { addressSchema, bytesSchema, hashSchema, quantitySchema, sameHex } from "../src/validation/schemas.js";
import { validateChainId } from "../src/validation/market.js";

const anchor = z.object({
  block: z.object({ number: quantitySchema, hash: hashSchema }),
  oracle: z.object({ cache: addressSchema, forwarder: addressSchema, feedId: hashSchema })
}).parse(JSON.parse(await readFile("evidence/phase1/position-snapshot.json", "utf8")));
const rpc = new RpcClient();
const logSchema = z.object({
  address: addressSchema, blockNumber: quantitySchema, blockHash: hashSchema, transactionHash: hashSchema,
  logIndex: quantitySchema, data: bytesSchema, topics: z.array(hashSchema).min(1), removed: z.boolean().optional()
});
const start = anchor.block.number > 7_999n ? anchor.block.number - 7_999n : 1n;
const observations: {
  blockNumber: bigint; blockHash: Hex; blockTimestamp: bigint; transactionHash: Hex;
  logIndex: bigint; observationTimestamp: bigint; answer: bigint; inclusionDelaySeconds: bigint;
}[] = [];
const ranges = [];
try {
  validateChainId(await rpc.chainId());
  const before = await rpc.block(anchor.block.number);
  if (!sameHex(before.hash, anchor.block.hash)) throw new DataError("HISTORY_REORG", "Historical anchor no longer matches the captured snapshot.");
  for (let from = start; from <= anchor.block.number; from += 1_000n) {
    const to = from + 999n < anchor.block.number ? from + 999n : anchor.block.number;
    const result = await rpc.logs(anchor.oracle.cache, [toEventSelector("AnswerUpdated(bytes32,uint256,uint256)"), anchor.oracle.feedId], from, to);
    const logs = z.array(logSchema).max(10_000).parse(result);
    ranges.push({ from, to, count: logs.length });
    for (const log of logs) {
      if (log.removed || log.blockNumber < from || log.blockNumber > to || !sameHex(log.address, anchor.oracle.cache)) throw new DataError("HISTORY_LOG_MISMATCH", "Unexpected or removed historical log.");
      const event = decodeEventLog({ abi: cacheAbi, eventName: "AnswerUpdated", topics: log.topics as [Hex, ...Hex[]], data: log.data });
      const header = await rpc.block(log.blockNumber);
      if (!sameHex(header.hash, log.blockHash) || header.timestamp < event.args.timestamp || event.args.feedId !== DEPLOYMENT.feedId) throw new DataError("HISTORY_TIMESTAMP_MISMATCH", "Log block or observation timestamp is inconsistent.");
      observations.push({
        blockNumber: log.blockNumber, blockHash: log.blockHash, blockTimestamp: header.timestamp,
        transactionHash: log.transactionHash, logIndex: log.logIndex, observationTimestamp: event.args.timestamp,
        answer: event.args.answer, inclusionDelaySeconds: header.timestamp - event.args.timestamp
      });
    }
  }
  observations.sort((a, b) => a.observationTimestamp < b.observationTimestamp ? -1 : a.observationTimestamp > b.observationTimestamp ? 1 : 0);
  const intervalsSeconds = observations.slice(1).map((item, index) => item.observationTimestamp - observations[index]!.observationTimestamp);
  const last = observations.at(-1);
  let latestDelivery: unknown = null;
  if (last) {
    const receipt = z.object({ from: addressSchema, to: addressSchema.nullable(), blockNumber: quantitySchema, blockHash: hashSchema, status: quantitySchema, logs: z.array(logSchema) }).parse(await rpc.receipt(last.transactionHash));
    if (receipt.blockNumber !== last.blockNumber || receipt.blockHash !== last.blockHash || receipt.status !== 1n) throw new DataError("RECEIPT_MISMATCH", "Update receipt does not match the observed successful update.");
    const deliveryEvents = receipt.logs.filter(log => sameHex(log.address, anchor.oracle.forwarder)).flatMap(log => {
      try {
        const decoded = decodeEventLog({ abi: forwarderAbi, eventName: "ReportProcessed", topics: log.topics as [Hex, ...Hex[]], data: log.data });
        return [{ ...decoded.args }];
      } catch { return []; }
    });
    latestDelivery = { transactionHash: last.transactionHash, sender: receipt.from, to: receipt.to, blockHash: receipt.blockHash, deliveryEvents };
  }
  const after = await rpc.block(anchor.block.number);
  if (before.hash !== after.hash) throw new DataError("HISTORY_REORG", "History anchor hash changed while reading logs.");
  await mkdir(CURRENT_EVIDENCE, { recursive: true });
  await writeFile(`${CURRENT_EVIDENCE}/oracle-update-history.json`, `${stringify({
    evidenceKind: "HISTORICAL_SNAPSHOT", capturedVia: "Live read-only RPC queries of bounded historical ranges",
    retrievedAt: new Date().toISOString(), chainId: 1672, cache: anchor.oracle.cache, feedId: anchor.oracle.feedId,
    anchor: before, ranges, observations, intervalsSeconds, latestDelivery, blockHashRecheckMatches: true,
    inference: "Observed intervals are a small historical sample, not an enforceable heartbeat or expected-frequency policy. The sender address does not identify the real-world feed operator.",
    reads: rpc.records
  })}\n`, "utf8");
  console.log(`Captured ${observations.length} oracle updates across ${ranges.length} bounded ranges; no heartbeat inferred.`);
} finally {
  await rpc.close();
}
