import { decodeFunctionData, encodeFunctionData, keccak256, parseAbi, stringToHex, toHex, encodeAbiParameters } from "viem";
import type { Hex } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequestPacer } from "../src/chain/transport.js";
import { DEPLOYMENT, NETWORK } from "../src/config/deployment.js";
import { stringify } from "../src/domain/serialize.js";
import { AUDIT_BOUNDS, AuditRpc, normalizeAuditParameters } from "../src/oracle-assurance/audit-rpc.js";
import type { AUDIT_READ_METHODS } from "../src/oracle-assurance/audit-rpc.js";
import { FORWARDER } from "../src/oracle-assurance/configuration.js";
import { inspectSupplemental, supplementalResultSchema, CONFIGS_STORAGE_SLOT } from "../src/oracle-assurance/supplemental.js";
import { auditSnapshotFixture, auditTraceFixture } from "./fixtures/assurance.js";

const json = (id: number, result: unknown) => new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), { headers: { "content-type": "application/json" } });
const requestBody = (init?: RequestInit) => JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] };
type Record = AuditRpc["trace"][number];
const methods = parseAbi(["function report(address receiver, bytes rawReport, bytes reportContext, bytes[] signatures)",
  "function route(bytes32 transmissionId, address transmitter, address receiver, bytes metadata, bytes validatedReport) returns (bool)"]);
function replay(change?: (record: Record) => unknown) {
  const recorded = auditTraceFixture().trace;
  const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    const body = requestBody(init);
    const record = recorded.find(record => record.method === body.method && JSON.stringify(record.params) === JSON.stringify(body.params));
    if (!record) {
      // The route-only fixture adds this verified view getter to the captured report path.
      if (body.method === "eth_call" && JSON.stringify(body.params).includes(FORWARDER)) return json(body.id, toHex(1n, { size: 32 }));
      throw new Error("Offline replay has no matching read.");
    }
    return json(body.id, change ? change(structuredClone(record)) : record.result);
  });
  return { fetcher, rpc: new AuditRpc(fetcher, new RequestPacer(0)) };
}
afterEach(() => { vi.restoreAllMocks(); });
describe("FIXTURE: bounded read-only supplemental transport", () => {
  it("rejects write methods, unpinned calls, foreign addresses and excessive log ranges before transport", async () => {
    const fetcher = vi.fn<typeof fetch>(), rpc = new AuditRpc(fetcher, new RequestPacer(0));
    await expect(rpc.request("eth_sendTransaction" as typeof AUDIT_READ_METHODS[number], [])).rejects.toMatchObject({ code: "AUDIT_READ_ONLY" });
    await expect(rpc.request("eth_getBlockByNumber", ["latest", false])).rejects.toMatchObject({ code: "AUDIT_PARAMETERS" });
    await expect(rpc.request("eth_getStorageAt", [DEPLOYMENT.morpho, toHex(0n, { size: 32 }), "0x1"])).rejects.toMatchObject({ code: "AUDIT_PARAMETERS" });
    await expect(rpc.request("eth_call", [{ to: DEPLOYMENT.cache, data: "0x" }, "0x1"])).rejects.toMatchObject({ code: "AUDIT_PARAMETERS" });
    await expect(rpc.request("eth_getLogs", [{ address: DEPLOYMENT.cache, topics: [DEPLOYMENT.feedId], fromBlock: "0x1", toBlock: "0x3e9" }])).rejects.toMatchObject({ code: "AUDIT_PARAMETERS" });
    expect(fetcher).not.toHaveBeenCalled(); expect(rpc.trace).toHaveLength(0);
  });
  it("uses the fixed public RPC, forbids redirects and strips provider extension fields from successful records", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => json(requestBody(init).id, {
      number: "0x1", hash: toHex(1n, { size: 32 }), parentHash: toHex(0n, { size: 32 }), timestamp: "0x2", providerSecret: "synthetic_extension"
    }));
    const rpc = new AuditRpc(fetcher, new RequestPacer(0));
    expect(await rpc.request("eth_getBlockByNumber", ["0x1", false])).toEqual({ number: "1", hash: toHex(1n, { size: 32 }), parentHash: toHex(0n, { size: 32 }), timestamp: "2" });
    expect(fetcher).toHaveBeenCalledWith(NETWORK.rpc, expect.objectContaining({ redirect: "error", method: "POST", signal: expect.any(AbortSignal) }));
    expect(stringify(rpc.trace)).not.toContain("synthetic_extension");
  });
  it.each(["http", "timeout", "malformed", "oversized", "rpc-error", "id"])("sanitizes %s failures and records unavailable without a fallback value", async failure => {
    const sentinel = "synthetic_secret_marker";
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const { id } = requestBody(init);
      if (failure === "timeout") throw new DOMException(`token=${sentinel}`, "TimeoutError");
      if (failure === "http") return new Response(`Bearer ${sentinel}`, { status: 429 });
      if (failure === "oversized") return new Response("x".repeat(AUDIT_BOUNDS.responseBytes + 1));
      if (failure === "malformed") return json(id, sentinel);
      if (failure === "rpc-error") return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { message: `secret=${sentinel}` } }));
      return json(id + 1, "0x688");
    });
    const rpc = new AuditRpc(fetcher, new RequestPacer(0));
    await expect(rpc.request("eth_chainId", [])).rejects.toMatchObject({ code: "AUDIT_SOURCE_UNAVAILABLE" });
    expect(rpc.trace).toMatchObject([{ method: "eth_chainId", params: [], result: null, outcome: "UNAVAILABLE" }]);
    expect(stringify(rpc.trace)).not.toContain(sentinel);
  });
  it("caps requests and the wall-clock budget without sending an extra read", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => json(requestBody(init).id, "0x688"));
    const rpc = new AuditRpc(fetcher, new RequestPacer(0));
    for (let i = 0; i < AUDIT_BOUNDS.requests; i++) await rpc.request("eth_chainId", []);
    await expect(rpc.request("eth_chainId", [])).rejects.toMatchObject({ code: "AUDIT_BUDGET" });
    expect(fetcher).toHaveBeenCalledTimes(AUDIT_BOUNDS.requests);
    const wall = new AuditRpc(fetcher, new RequestPacer(0)); vi.spyOn(Date, "now").mockReturnValue(Date.now() + AUDIT_BOUNDS.wallMilliseconds + 1);
    await expect(wall.request("eth_chainId", [])).rejects.toMatchObject({ code: "AUDIT_BUDGET" });
    expect(fetcher).toHaveBeenCalledTimes(AUDIT_BOUNDS.requests);
  });
  it("allows only selector/address-bound bool getters and rejects non-boolean words", async () => {
    const abi = parseAbi(["function isForwarder(address) view returns (bool)"]);
    const data = encodeFunctionData({ abi, functionName: "isForwarder", args: [DEPLOYMENT.morpho] });
    expect(() => normalizeAuditParameters("eth_call", [{ to: DEPLOYMENT.cache, data }, "0x1"])).toThrow();
    const rpc = new AuditRpc(async (_url, init) => json(requestBody(init).id, toHex(2n, { size: 32 })), new RequestPacer(0));
    await expect(rpc.request("eth_call", [{ to: FORWARDER, data }, "0x1"])).rejects.toMatchObject({ code: "AUDIT_SOURCE_UNAVAILABLE" });
  });
});

describe("ARCHIVED INPUT / FIXTURE REPLAY: logs, calldata, signatures and signer storage", () => {
  it("re-extracts both public reports, four distinct signatures each, the workflow and ten current signers", async () => {
    const { rpc, fetcher } = replay(), result = await inspectSupplemental(auditSnapshotFixture(), rpc), archived = auditTraceFixture();
    expect(result.status).toBe("BOUNDED_READ_COMPLETE"); expect(supplementalResultSchema.safeParse(result).success).toBe(true);
    expect(JSON.parse(stringify(result.samples))).toEqual(archived.samples);
    expect(result.signerSets).toEqual(archived.signerSets); expect(result.workflowIds).toEqual(archived.workflowIds);
    expect(result.configuration).toEqual(archived.configuration); expect(result.observations).toEqual(archived.observations);
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(AUDIT_BOUNDS.requests);
    expect(rpc.trace.filter(read => read.method === "eth_getLogs")).toHaveLength(16);
  });
  it.each(["chain", "header-time", "removed", "duplicate", "wrong-address", "wrong-feed", "receipt-status", "receipt-log", "transaction-hash"])("fails closed on %s replay conflicts", async kind => {
    const { rpc } = replay(record => {
      if (kind === "chain" && record.method === "eth_chainId") return "0x1";
      if (kind === "header-time" && record.method === "eth_getBlockByNumber") return { ...(record.result as object), timestamp: "1" };
      if (record.method === "eth_getLogs" && Array.isArray(record.result) && record.result.length) {
        const log = record.result[0] as { address: string; topics: string[] };
        if (kind === "removed") return [{ ...log, removed: true }];
        if (kind === "duplicate") return [log, log];
        if (kind === "wrong-address") return [{ ...log, address: DEPLOYMENT.morpho }];
        if (kind === "wrong-feed") return [{ ...log, topics: [log.topics[0], toHex(0n, { size: 32 }), log.topics[2]] }];
      }
      if (record.method === "eth_getTransactionReceipt") {
        if (kind === "receipt-status") return { ...(record.result as object), status: "0" };
        if (kind === "receipt-log") return { ...(record.result as object), logs: [] };
      }
      if (kind === "transaction-hash" && record.method === "eth_getTransactionByHash") return { ...(record.result as object), hash: toHex(0n, { size: 32 }) };
      return record.result;
    });
    expect((await inspectSupplemental(auditSnapshotFixture(), rpc)).status).toBe("UNAVAILABLE");
  });
  it.each(["duplicate-signature", "answer-mismatch"])("rejects %s between the archived calldata and cache event", async kind => {
    const { rpc } = replay(record => {
      if (record.method !== "eth_getTransactionByHash") return record.result;
      const tx = record.result as { input: Hex }, decoded = decodeFunctionData({ abi: methods, data: tx.input });
      if (decoded.functionName !== "report") throw new Error();
      const [receiver, raw, context, signatures] = decoded.args;
      const input = encodeFunctionData({ abi: methods, functionName: "report", args: [receiver,
        kind === "answer-mismatch" ? `0x${raw.slice(2, -2)}00` : raw, context,
        kind === "duplicate-signature" ? [signatures[0]!, signatures[0]!, ...signatures.slice(2)] : signatures] });
      return { ...tx, input };
    });
    expect((await inspectSupplemental(auditSnapshotFixture(), rpc)).status).toBe("UNAVAILABLE");
  });
  it.each(["count", "disabled"])("refuses unbounded or inactive %s signer storage", async kind => {
    const configId = BigInt(auditTraceFixture().signerSets[0]!.configId);
    const slot = BigInt(keccak256(encodeAbiParameters([{ type: "uint64" }, { type: "uint256" }], [configId, CONFIGS_STORAGE_SLOT])));
    const { rpc } = replay(record => record.method === "eth_getStorageAt" && record.params[0] === FORWARDER
      && record.params[1] === toHex(slot + (kind === "count" ? 1n : 0n), { size: 32 }) ? toHex(kind === "count" ? 32n : 0n, { size: 32 }) : record.result);
    expect((await inspectSupplemental(auditSnapshotFixture(), rpc)).status).toBe("UNAVAILABLE");
  });
  it("applies one aggregate log budget across configuration history and feed observations", async () => {
    const sample = auditTraceFixture().observations[0]!;
    const { rpc } = replay(record => {
      if (record.method !== "eth_getLogs") return record.result;
      const filter = record.params[0] as { address: string | string[]; fromBlock: string; toBlock: string };
      if (!Array.isArray(filter.address) || BigInt(sample.blockNumber) < BigInt(filter.fromBlock) || BigInt(sample.blockNumber) > BigInt(filter.toBlock)) return record.result;
      return Array.from({ length: AUDIT_BOUNDS.logs }, (_, index) => ({ address: DEPLOYMENT.cache, blockNumber: sample.blockNumber, blockHash: sample.blockHash,
        transactionHash: sample.transactionHash, logIndex: String(index), topics: [keccak256(stringToHex("OwnershipTransferred(address,address)"))], data: "0x", removed: false }));
    });
    const result = await inspectSupplemental(auditSnapshotFixture(), rpc);
    expect(result.status).toBe("UNAVAILABLE"); expect(result.events).toHaveLength(AUDIT_BOUNDS.logs); expect(result.samples).toHaveLength(0);
  });
  it("recognizes the separately owner-authorized route path without inventing signatures", async () => {
    const { rpc } = replay(record => {
      if (record.method !== "eth_getTransactionByHash") return record.result;
      const tx = record.result as { input: Hex; from: `0x${string}` }, decoded = decodeFunctionData({ abi: methods, data: tx.input });
      if (decoded.functionName !== "report") throw new Error();
      const [receiver, raw] = decoded.args;
      return { ...tx, input: encodeFunctionData({ abi: methods, functionName: "route", args: [toHex(1n, { size: 32 }), tx.from, receiver,
        `0x${raw.slice(2 + 45 * 2, 2 + 109 * 2)}`, `0x${raw.slice(2 + 109 * 2)}`] }) };
    });
    const result = await inspectSupplemental(auditSnapshotFixture(), rpc);
    expect(result.status).toBe("BOUNDED_READ_COMPLETE"); expect(result.signerSets).toHaveLength(0);
    expect(result.samples).toMatchObject([{ method: "route", authorizedAtTransactionBlock: true, signatureValidationInThisEntrypoint: false },
      { method: "route", signatureValidationInThisEntrypoint: false }]);
  });
  it("does not guess storage layout for changed runtime identity", async () => {
    const { rpc, fetcher } = replay(), snapshot = auditSnapshotFixture(); snapshot.contracts.find(contract => contract.address === FORWARDER)!.sha256 = "0".repeat(64);
    expect((await inspectSupplemental(snapshot, rpc)).status).toBe("UNSUPPORTED_IDENTITY"); expect(fetcher).not.toHaveBeenCalled();
  });
});
