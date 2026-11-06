import { decodeAbiParameters, decodeFunctionData, encodeAbiParameters, encodeFunctionData, getAddress, keccak256, parseAbi, recoverAddress, stringToHex, toHex } from "viem";
import type { Address, Hex } from "viem";
import { z } from "zod";
import { DEPLOYMENT, NETWORK } from "../config/deployment.js";
import { DataError } from "../domain/errors.js";
import { stringify } from "../domain/serialize.js";
import type { Snapshot } from "../domain/types.js";
import { addressSchema, blockSchema, bytesSchema, hashSchema, quantitySchema } from "../validation/schemas.js";
import { FORWARDER, validateContractIdentity } from "./configuration.js";
import { sha256 } from "./evidence.js";
import type { ConfigurationChange, OracleConfiguration } from "./model.js";
import { blockRefSchema, changeCodeSchema, configurationSchema, evidenceRefSchema, unsignedSchema } from "./model.js";
import { AUDIT_BOUNDS, AuditRpc, auditLogSchema as logSchema } from "./audit-rpc.js";
export { AUDIT_BOUNDS, AUDIT_READ_METHODS, AuditRpc } from "./audit-rpc.js";
type Log = z.infer<typeof logSchema>;
const forwarderCalls = parseAbi([
  "function report(address receiver, bytes rawReport, bytes reportContext, bytes[] signatures)",
  "function route(bytes32 transmissionId, address transmitter, address receiver, bytes metadata, bytes validatedReport) returns (bool)",
  "function isForwarder(address forwarder) view returns (bool)"
]);
const cacheCalls = parseAbi(["function isAllowedWorkflowId(bytes32 workflowId) view returns (bool)"]);
const reportsAbi = [{ type: "tuple[]", components: [{ name: "feedId", type: "bytes32" }, { name: "validFromTimestamp", type: "uint32" }, { name: "observationsTimestamp", type: "uint32" }, { name: "answer", type: "uint256" }] }] as const;
const topic = (signature: string) => keccak256(stringToHex(signature));
const changes = new Map<Hex, ConfigurationChange>([
  [topic("OwnershipTransferred(address,address)"), "ORACLE_OWNER_CHANGED"], [topic("OwnershipTransferRequested(address,address)"), "ORACLE_CONFIGURATION_CHANGED"],
  [topic("CacheUpdated(address,address)"), "ORACLE_CONFIGURATION_CHANGED"], [topic("FeedIdUpdated(bytes32,bytes32)"), "ORACLE_FEED_ID_CHANGED"],
  [topic("ForwarderAddressUpdated(address,address)"), "ORACLE_CONFIGURATION_CHANGED"], [topic("AllowedWorkflowOwnerUpdated(address,address)"), "ORACLE_OWNER_CHANGED"],
  [topic("AllowedWorkflowIdSet(bytes32,bool)"), "ORACLE_CONFIGURATION_CHANGED"], [topic("ConfigSet(uint32,uint32,uint8,address[])"), "ORACLE_SIGNER_CONFIGURATION_CHANGED"],
  [topic("ForwarderAdded(address)"), "ORACLE_SIGNER_CONFIGURATION_CHANGED"], [topic("ForwarderRemoved(address)"), "ORACLE_SIGNER_CONFIGURATION_CHANGED"]
]);
export const IMPLEMENTATION_SLOT = toHex(BigInt(keccak256(stringToHex("eip1967.proxy.implementation"))) - 1n, { size: 32 });
const ADMIN_SLOT = toHex(BigInt(keccak256(stringToHex("eip1967.proxy.admin"))) - 1n, { size: 32 });
const BEACON_SLOT = toHex(BigInt(keccak256(stringToHex("eip1967.proxy.beacon"))) - 1n, { size: 32 });
export interface ConfigurationEvent { code: ConfigurationChange; address: Address; blockNumber: string; blockHash: Hex; transactionHash: Hex; logIndex: string }
export interface SupplementalResult {
  status: "BOUNDED_READ_COMPLETE" | "UNAVAILABLE" | "UNSUPPORTED_IDENTITY";
  block: { number: string; hash: string; timestamp: string };
  retrievedAt: string; historyFrom: string; historyTo: string;
  configuration: Partial<OracleConfiguration>; events: ConfigurationEvent[];
  samples: unknown[]; observations: { blockNumber: string; blockHash: string; transactionHash: string; timestamp: string; answer: string }[];
  signerSets: { configId: string; f: number; signers: Address[] }[];
  workflowIds: { id: Hex; allowed: boolean }[];
  trace: AuditRpc["trace"]; limitations: string[];
}
// Only these supplemental fields may affect assurance. In particular, a caller cannot
// replace snapshot owners, feed addresses or units through a supplemental configuration.
export const supplementalResultSchema = z.object({
  status: z.enum(["BOUNDED_READ_COMPLETE", "UNAVAILABLE", "UNSUPPORTED_IDENTITY"]), block: blockRefSchema,
  retrievedAt: z.iso.datetime(), historyFrom: unsignedSchema, historyTo: unsignedSchema,
  configuration: configurationSchema.pick({ proxyImplementation: true, proxyAdmin: true, proxyBeacon: true,
    signerConfigurationHash: true, workflowConfigurationHash: true, signerCoverage: true }).partial(),
  events: z.array(z.object({ code: changeCodeSchema, address: addressSchema, blockNumber: unsignedSchema, blockHash: hashSchema,
    transactionHash: hashSchema, logIndex: unsignedSchema }).strict()).max(AUDIT_BOUNDS.logs),
  samples: z.array(z.unknown()).max(AUDIT_BOUNDS.updateTransactions),
  observations: z.array(z.object({ blockNumber: unsignedSchema, blockHash: hashSchema, transactionHash: hashSchema, timestamp: unsignedSchema, answer: unsignedSchema }).strict()).max(AUDIT_BOUNDS.logs),
  signerSets: z.array(z.object({ configId: unsignedSchema, f: z.number().int().min(0).max(255), signers: z.array(addressSchema).max(AUDIT_BOUNDS.signers) }).strict()).max(1),
  workflowIds: z.array(z.object({ id: hashSchema, allowed: z.boolean() }).strict()).max(2),
  trace: z.array(z.unknown()).max(AUDIT_BOUNDS.requests), limitations: evidenceRefSchema.shape.unresolved
}).strict().refine(result => {
  const from = BigInt(result.historyFrom), to = BigInt(result.historyTo);
  if (to !== BigInt(result.block.number) || from > to || to - from >= AUDIT_BOUNDS.historyBlocks) return false;
  if (result.events.length + result.observations.length > AUDIT_BOUNDS.logs) return false;
  if (result.events.some(event => BigInt(event.blockNumber) < from || BigInt(event.blockNumber) > to
    || ![DEPLOYMENT.feed, DEPLOYMENT.cache, FORWARDER].some(address => address === event.address))) return false;
  if (result.status !== "BOUNDED_READ_COMPLETE") return true;
  const config = result.configuration;
  return [config.proxyImplementation, config.proxyAdmin, config.proxyBeacon].every(value => value != null)
    && config.signerConfigurationHash === (result.signerSets.length ? sha256(stringify(result.signerSets)) : null)
    && config.workflowConfigurationHash === (result.workflowIds.length ? sha256(stringify(result.workflowIds)) : null)
    && config.signerCoverage === (result.signerSets.length ? "SAMPLED_ACTIVE_CONFIGS" : "UNOBSERVED")
    && result.signerSets.every(set => BigInt(set.configId) < 2n ** 64n && set.f > 0 && set.signers.length > 3 * set.f
      && new Set(set.signers).size === set.signers.length && set.signers.every(signer => BigInt(signer) !== 0n));
}, "Supplemental evidence must fit its bounded history and configuration summary.");
/** Mapping layout is tied to the reproduced KeystoneForwarder runtime, never guessed for another implementation. */
export const CONFIGS_STORAGE_SLOT = 2n;
export async function inspectSupplemental(snapshot: Snapshot, rpc = new AuditRpc()): Promise<SupplementalResult> {
  if (!snapshot.block) throw new DataError("AUDIT_BLOCK", "A supplemental audit requires a pinned block.");
  const block = snapshot.block, from = block.number >= AUDIT_BOUNDS.historyBlocks ? block.number - AUDIT_BOUNDS.historyBlocks + 1n : 0n;
  const result: SupplementalResult = { status: "UNAVAILABLE", block: { number: block.number.toString(), hash: block.hash, timestamp: block.timestamp.toString() },
    retrievedAt: snapshot.retrievedAt, historyFrom: from.toString(), historyTo: block.number.toString(), configuration: {}, events: [], samples: [], observations: [],
    signerSets: [], workflowIds: [], trace: rpc.trace, limitations: ["History is a bounded window, not a deployment-to-present enumeration.",
      "Sampled DON configurations and workflow IDs do not enumerate all authorized entries.", "Storage and RPC evidence do not identify real-world operators or economic data sources."] };
  if (validateContractIdentity(snapshot) !== "VERIFIED" || !snapshot.oracle.forwarder || !snapshot.oracle.cache || !snapshot.oracle.feedId) {
    result.status = "UNSUPPORTED_IDENTITY"; return result;
  }
  const forwarder = snapshot.oracle.forwarder, cache = snapshot.oracle.cache, feed = snapshot.oracle.feed, feedId = snapshot.oracle.feedId;
  const getBlock = async (number: bigint) => {
    const header = blockSchema.parse(await rpc.request("eth_getBlockByNumber", [toHex(number), false]));
    if (header.number !== number || (number === block.number && (header.timestamp !== block.timestamp || header.parentHash !== block.parentHash))) throw new Error("Header binding failed.");
    return header;
  };
  const storage = async (address: Address, slot: bigint | Hex) => hashSchema.parse(await rpc.request("eth_getStorageAt", [address, typeof slot === "bigint" ? toHex(slot, { size: 32 }) : slot, toHex(block.number)]));
  const boolCall = async (to: Address, data: Hex, at = block.number) => decodeAbiParameters([{ type: "bool" }], bytesSchema.parse(await rpc.request("eth_call", [{ to, data }, toHex(at)])))[0];
  let aggregateLogCount = 0;
  const logs = async (address: Address | Address[], topics: (Hex | Hex[])[]) => {
    const items: Log[] = [];
    for (let start = from; start <= block.number; start += AUDIT_BOUNDS.queryBlocks) {
      const end = start + AUDIT_BOUNDS.queryBlocks - 1n < block.number ? start + AUDIT_BOUNDS.queryBlocks - 1n : block.number;
      const batch = z.array(logSchema).max(AUDIT_BOUNDS.logs).parse(await rpc.request("eth_getLogs", [{ address, topics, fromBlock: toHex(start), toBlock: toHex(end) }]));
      if (batch.some(log => log.removed || !(Array.isArray(address) ? address : [address]).includes(log.address) || log.blockNumber < start || log.blockNumber > end
        || topics.some((filter, index) => !(Array.isArray(filter) ? filter : [filter]).includes(log.topics[index]!)))) throw new Error("Log binding failed.");
      items.push(...batch);
      aggregateLogCount += batch.length;
      if (aggregateLogCount > AUDIT_BOUNDS.logs) throw new Error("Aggregate log limit exceeded.");
    }
    if (new Set(items.map(log => `${log.blockHash}:${log.logIndex}`)).size !== items.length) throw new Error("Duplicate log.");
    return items;
  };
  try {
    if (quantitySchema.parse(await rpc.request("eth_chainId", [])) !== BigInt(NETWORK.chainId) || (await getBlock(block.number)).hash !== block.hash) throw new Error("Anchor mismatch.");
    result.configuration.proxyImplementation = getAddress(`0x${(await storage(feed, IMPLEMENTATION_SLOT)).slice(-40)}`);
    result.configuration.proxyAdmin = getAddress(`0x${(await storage(feed, ADMIN_SLOT)).slice(-40)}`);
    result.configuration.proxyBeacon = getAddress(`0x${(await storage(feed, BEACON_SLOT)).slice(-40)}`);
    const eventBlocks = new Map<bigint, Hex>();
    for (const log of await logs([feed, cache, forwarder], [[...changes.keys()]])) {
      if (!eventBlocks.has(log.blockNumber)) {
        if (eventBlocks.size >= AUDIT_BOUNDS.configurationEventBlocks) throw new Error("Configuration event header budget exceeded.");
        eventBlocks.set(log.blockNumber, (await getBlock(log.blockNumber)).hash);
      }
      if (eventBlocks.get(log.blockNumber) !== log.blockHash) throw new Error("Configuration event header mismatch.");
      result.events.push({ code: changes.get(log.topics[0]!)!, address: log.address,
        blockNumber: log.blockNumber.toString(), blockHash: log.blockHash, transactionHash: log.transactionHash, logIndex: log.logIndex.toString() });
    }
    const updates = await logs(cache, [topic("AnswerUpdated(bytes32,uint256,uint256)"), feedId]);
    updates.sort((a, b) => a.blockNumber === b.blockNumber ? Number(a.logIndex - b.logIndex) : a.blockNumber < b.blockNumber ? -1 : 1);
    for (const log of updates) {
      if (log.topics[1] !== feedId || !log.topics[2]) throw new Error("Feed log binding failed.");
      result.observations.push({ blockNumber: log.blockNumber.toString(), blockHash: log.blockHash, transactionHash: log.transactionHash,
        timestamp: BigInt(log.topics[2]).toString(), answer: decodeAbiParameters([{ type: "uint256" }], log.data)[0].toString() });
    }
    const selected: Log[] = [];
    for (const log of [...updates].reverse()) if (!selected.some(previous => previous.transactionHash === log.transactionHash) && selected.length < AUDIT_BOUNDS.updateTransactions) selected.push(log);
    const configs = new Set<bigint>(), workflows = new Set<Hex>();
    for (const log of selected) {
      const tx = z.object({ hash: hashSchema, blockNumber: quantitySchema, blockHash: hashSchema, from: addressSchema, to: addressSchema, input: bytesSchema })
        .parse(await rpc.request("eth_getTransactionByHash", [log.transactionHash]));
      const receipt = z.object({ transactionHash: hashSchema, blockNumber: quantitySchema, blockHash: hashSchema, status: quantitySchema, logs: z.array(logSchema) })
        .parse(await rpc.request("eth_getTransactionReceipt", [log.transactionHash]));
      const header = await getBlock(log.blockNumber);
      if (tx.hash !== log.transactionHash || tx.blockHash !== log.blockHash || tx.blockNumber !== log.blockNumber || receipt.transactionHash !== tx.hash
        || receipt.blockHash !== tx.blockHash || receipt.blockNumber !== tx.blockNumber || receipt.status !== 1n || header.hash !== tx.blockHash
        || !receipt.logs.some(item => !item.removed && item.blockHash === log.blockHash && item.blockNumber === log.blockNumber && item.transactionHash === log.transactionHash
          && item.logIndex === log.logIndex && item.address === log.address && item.data === log.data && stringify(item.topics) === stringify(log.topics))) throw new Error("Update transaction binding failed.");
      if (tx.to !== forwarder) { result.samples.push({ transactionHash: tx.hash, block: header, method: "INDIRECT_ENTRYPOINT_UNRESOLVED", from: tx.from, to: tx.to }); continue; }
      const decoded = decodeFunctionData({ abi: forwarderCalls, data: tx.input });
      if (decoded.functionName === "report") {
        const [receiver, raw, context, signatures] = decoded.args;
        if (receiver !== cache || raw.length < 2 + 109 * 2 || signatures.length > AUDIT_BOUNDS.signers) throw new Error("Report receiver or metadata mismatch.");
        const slice = (start: number, end: number): Hex => `0x${raw.slice(2 + start * 2, 2 + end * 2)}`;
        const configId = BigInt(slice(37, 45)), workflowId = slice(45, 77);
        configs.add(configId); workflows.add(workflowId);
        const hash = keccak256(`0x${keccak256(raw).slice(2)}${context.slice(2)}`);
        const signers = await Promise.all(signatures.map(signature => {
          if (signature.length !== 132 || BigInt(`0x${signature.slice(-2)}`) > 1n) throw new Error("Signature shape mismatch.");
          return recoverAddress({ hash, signature: `${signature.slice(0, -2)}${(Number.parseInt(signature.slice(-2), 16) + 27).toString(16)}` as Hex });
        }));
        const reports = decodeAbiParameters(reportsAbi, slice(109, (raw.length - 2) / 2))[0];
        if (new Set(signers).size !== signers.length || !reports.some(report => report.feedId === feedId && BigInt(report.observationsTimestamp) === BigInt(log.topics[2]!)
          && report.answer === decodeAbiParameters([{ type: "uint256" }], log.data)[0])) throw new Error("Report/calldata event mismatch.");
        result.samples.push({ transactionHash: tx.hash, block: header, method: "report", receiver, transmitter: tx.from, configId: configId.toString(),
          workflowId, workflowOwner: getAddress(slice(87, 107)), reportMetadataTimestamp: BigInt(slice(33, 37)).toString(),
          distinctRecoveredSigners: [...new Set(signers)], signatureCount: signatures.length, reports,
          workflowAllowedAtTransactionBlock: await boolCall(cache, encodeFunctionData({ abi: cacheCalls, functionName: "isAllowedWorkflowId", args: [workflowId] }), tx.blockNumber),
          publicationTimestamp: header.timestamp.toString(), currentSignerMembershipIsSeparateFromHistoricalSignatureRecovery: true });
      } else if (decoded.functionName === "route") {
        const [, transmitter, receiver, metadata, reports] = decoded.args;
        if (receiver !== cache || metadata.length < 130) throw new Error("Route metadata mismatch.");
        const workflowId = `0x${metadata.slice(2, 66)}` as Hex; workflows.add(workflowId);
        const data = encodeFunctionData({ abi: forwarderCalls, functionName: "isForwarder", args: [tx.from] });
        const decodedReports = decodeAbiParameters(reportsAbi, reports)[0];
        if (!decodedReports.some(report => report.feedId === feedId && BigInt(report.observationsTimestamp) === BigInt(log.topics[2]!)
          && report.answer === decodeAbiParameters([{ type: "uint256" }], log.data)[0])) throw new Error("Route/calldata event mismatch.");
        result.samples.push({ transactionHash: tx.hash, block: header, method: "route", caller: tx.from, transmitter, receiver, workflowId,
          workflowOwner: getAddress(`0x${metadata.slice(86, 126)}`),
          authorizedAtTransactionBlock: await boolCall(forwarder, data, tx.blockNumber), authorizedAtAuditBlock: await boolCall(forwarder, data),
          reports: decodedReports, signatureValidationInThisEntrypoint: false });
      } else throw new Error("Update entrypoint is unsupported.");
    }
    // One sampled active config keeps total reads bounded even for the maximum 31 signers.
    for (const configId of [...configs].slice(0, 1)) {
      const base = BigInt(keccak256(encodeAbiParameters([{ type: "uint64" }, { type: "uint256" }], [configId, CONFIGS_STORAGE_SLOT])));
      const f = Number(BigInt(await storage(forwarder, base)) & 255n), count = BigInt(await storage(forwarder, base + 1n));
      if (count > BigInt(AUDIT_BOUNDS.signers)) throw new Error("Signer enumeration exceeds verified source bounds.");
      const first = BigInt(keccak256(encodeAbiParameters([{ type: "uint256" }], [base + 1n])));
      const signers: Address[] = [];
      for (let index = 0n; index < count; index++) signers.push(getAddress(`0x${(await storage(forwarder, first + index)).slice(-40)}`));
      if (f === 0 || count <= BigInt(3 * f) || new Set(signers).size !== signers.length || signers.some(signer => BigInt(signer) === 0n)) throw new Error("Sampled current config is not an active source-valid signer set.");
      result.signerSets.push({ configId: configId.toString(), f, signers });
    }
    for (const id of [...workflows].sort().slice(0, 2)) result.workflowIds.push({ id, allowed: await boolCall(cache, encodeFunctionData({ abi: cacheCalls, functionName: "isAllowedWorkflowId", args: [id] })) });
    result.configuration.signerConfigurationHash = result.signerSets.length ? sha256(stringify(result.signerSets)) : null;
    result.configuration.workflowConfigurationHash = result.workflowIds.length ? sha256(stringify(result.workflowIds)) : null;
    result.configuration.signerCoverage = result.signerSets.length ? "SAMPLED_ACTIVE_CONFIGS" : "UNOBSERVED";
    if ((await getBlock(block.number)).hash !== block.hash || quantitySchema.parse(await rpc.request("eth_chainId", [])) !== BigInt(NETWORK.chainId)) throw new Error("Anchor changed.");
    result.status = "BOUNDED_READ_COMPLETE";
  } catch { result.status = "UNAVAILABLE"; result.limitations.push("A required supplemental read or binding check failed within the fixed budget; no remote error text is retained."); }
  result.retrievedAt = new Date().toISOString();
  return result;
}
