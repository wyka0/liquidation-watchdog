import { RpcClient } from "../chain/rpc.js";
import { RequestPacer } from "../chain/transport.js";
import { PharosMcpClient } from "../mcp/client.js";
import type { ReadClient } from "../chain/client.js";
import { NETWORK } from "../config/deployment.js";
import { validateChainId } from "../validation/market.js";
import { bounded } from "./deadline.js";

export type ConnectivityState = "REACHABLE" | "REACHABLE_AS_OF_ACCEPTED_SNAPSHOT" | "UNAVAILABLE" | "UNKNOWN";
export interface Connectivity { rpc: ConnectivityState; mcp: ConnectivityState; checkedAt: string | null; mode: "EXPLICIT_READ_ONLY_PROBE" | "PERSISTED_AS_OF_SNAPSHOT" }

export async function probeConnectivity(milliseconds: number, factory?: (signal: AbortSignal) => { rpc: ReadClient; mcp: ReadClient }): Promise<Connectivity> {
  const result: Connectivity = { rpc: "UNKNOWN", mcp: "UNKNOWN", checkedAt: null, mode: "EXPLICIT_READ_ONLY_PROBE" };
  let clients: { rpc: ReadClient; mcp: ReadClient } | undefined;
  try {
    await bounded(async signal => {
      const pacer = new RequestPacer();
      clients = factory ? factory(signal) : { rpc: new RpcClient(pacer, NETWORK.rpc, undefined, signal), mcp: new PharosMcpClient(pacer, NETWORK.mcp, undefined, signal) };
      for (const kind of ["rpc", "mcp"] as const) {
        if (signal.aborted) break;
        try {
          validateChainId(await clients[kind].chainId());
          if (signal.aborted) break;
          if (await clients[kind].blockNumber() <= 0n) throw new Error();
          if (!signal.aborted) result[kind] = "REACHABLE";
        } catch { if (!signal.aborted) result[kind] = "UNAVAILABLE"; }
      }
    }, milliseconds, "CONNECTIVITY_TIMEOUT");
  } catch { /* Only the per-path availability enum is retained. */ }
  finally {
    const open = clients;
    if (open) await Promise.allSettled([bounded(() => open.rpc.close(), 1_000, "CLOSE_TIMEOUT"), bounded(() => open.mcp.close(), 1_000, "CLOSE_TIMEOUT")]);
  }
  if (result.rpc === "UNKNOWN") result.rpc = "UNAVAILABLE";
  if (result.mcp === "UNKNOWN") result.mcp = "UNAVAILABLE";
  result.checkedAt = new Date().toISOString();
  return { ...result };
}
