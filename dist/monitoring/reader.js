import { RpcClient } from "../chain/rpc.js";
import { inspectPosition } from "../chain/snapshot.js";
import { RequestPacer } from "../chain/transport.js";
import { DataError } from "../domain/errors.js";
import { PharosMcpClient } from "../mcp/client.js";
/** Attribute failures without changing the Phase 1 reader or retaining provider error text. */
export function attributedClient(client) {
    const read = async (operation) => {
        try {
            return await operation();
        }
        catch (error) {
            const quality = error instanceof DataError && error.quality === "INVALID" ? "INVALID" : "UNAVAILABLE";
            throw new DataError(`${client.kind.toUpperCase()}_${quality}`, `${client.kind.toUpperCase()} read failed; current risk cannot be determined.`, "network", quality);
        }
    };
    return {
        kind: client.kind, endpoint: client.endpoint, records: client.records,
        chainId: () => read(() => client.chainId()), blockNumber: () => read(() => client.blockNumber()),
        block: (number) => read(() => client.block(number)),
        code: (address, block) => read(() => client.code(address, block)),
        call: (to, data, block) => read(() => client.call(to, data, block)), close: () => client.close()
    };
}
export async function readMonitoredPosition(options) {
    try {
        return await inspectPosition({ ...options, rpc: attributedClient(options.rpc), mcp: attributedClient(options.mcp) });
    }
    finally {
        // Attempt both closes even when one fails. Nothing from a transport exception is logged.
        await Promise.allSettled([options.rpc.close(), options.mcp.close()]);
    }
}
export async function inspectMonitored(blockNumber, signal, position) {
    const pacer = new RequestPacer();
    return readMonitoredPosition({ rpc: new RpcClient(pacer, undefined, undefined, signal), mcp: new PharosMcpClient(pacer, undefined, undefined, signal),
        ...(blockNumber === undefined ? {} : { blockNumber }), ...(position ? { position } : {}) });
}
//# sourceMappingURL=reader.js.map