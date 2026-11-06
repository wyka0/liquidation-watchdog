import { PharosMcpClient } from "../mcp/client.js";
import { RpcClient } from "./rpc.js";
import { RequestPacer } from "./transport.js";
import { inspectPosition } from "./snapshot.js";
import type { Snapshot } from "../domain/types.js";
import type { PositionConfiguration } from "../config/position.js";

export async function inspectLive(blockNumber?: bigint, position?: PositionConfiguration): Promise<Snapshot> {
  const pacer = new RequestPacer();
  const rpc = new RpcClient(pacer);
  const mcp = new PharosMcpClient(pacer);
  try {
    return await inspectPosition({ rpc, mcp, ...(blockNumber === undefined ? {} : { blockNumber }), ...(position ? { position } : {}) });
  } finally {
    await mcp.close();
    await rpc.close();
  }
}
