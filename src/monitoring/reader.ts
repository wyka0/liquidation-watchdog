import type { Address, Hex } from "viem";
import type { ReadClient } from "../chain/client.js";
import { RpcClient } from "../chain/rpc.js";
import { inspectPosition } from "../chain/snapshot.js";
import type { InspectOptions } from "../chain/snapshot.js";
import { RequestPacer } from "../chain/transport.js";
import { DataError } from "../domain/errors.js";
import type { Snapshot } from "../domain/types.js";
import { PharosMcpClient } from "../mcp/client.js";
import type { PositionConfiguration } from "../config/position.js";

/** Attribute failures without changing the Phase 1 reader or retaining provider error text. */
export function attributedClient(client: ReadClient): ReadClient {
  const read = async <T>(operation: () => Promise<T>): Promise<T> => {
    try { return await operation(); } catch (error) {
      const quality = error instanceof DataError && error.quality === "INVALID" ? "INVALID" : "UNAVAILABLE";
      throw new DataError(`${client.kind.toUpperCase()}_${quality}`, `${client.kind.toUpperCase()} read failed; current risk cannot be determined.`, "network", quality);
    }
  };
  return {
    kind: client.kind, endpoint: client.endpoint, records: client.records,
    chainId: () => read(() => client.chainId()), blockNumber: () => read(() => client.blockNumber()),
    block: (number: bigint) => read(() => client.block(number)),
    code: (address: Address, block: bigint) => read(() => client.code(address, block)),
    call: (to: Address, data: Hex, block: bigint) => read(() => client.call(to, data, block)), close: () => client.close()
  };
}

export async function readMonitoredPosition(options: InspectOptions): Promise<Snapshot> {
  try {
    return await inspectPosition({ ...options, rpc: attributedClient(options.rpc), mcp: attributedClient(options.mcp) });
  } finally {
    // Attempt both closes even when one fails. Nothing from a transport exception is logged.
    await Promise.allSettled([options.rpc.close(), options.mcp.close()]);
  }
}

export async function inspectMonitored(blockNumber?: bigint, signal?: AbortSignal, position?: PositionConfiguration): Promise<Snapshot> {
  const pacer = new RequestPacer();
  return readMonitoredPosition({ rpc: new RpcClient(pacer, undefined, undefined, signal), mcp: new PharosMcpClient(pacer, undefined, undefined, signal),
    ...(blockNumber === undefined ? {} : { blockNumber }), ...(position ? { position } : {}) });
}
