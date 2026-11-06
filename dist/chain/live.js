import { PharosMcpClient } from "../mcp/client.js";
import { RpcClient } from "./rpc.js";
import { RequestPacer } from "./transport.js";
import { inspectPosition } from "./snapshot.js";
export async function inspectLive(blockNumber, position) {
    const pacer = new RequestPacer();
    const rpc = new RpcClient(pacer);
    const mcp = new PharosMcpClient(pacer);
    try {
        return await inspectPosition({ rpc, mcp, ...(blockNumber === undefined ? {} : { blockNumber }), ...(position ? { position } : {}) });
    }
    finally {
        await mcp.close();
        await rpc.close();
    }
}
//# sourceMappingURL=live.js.map