import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RPC_READ_METHODS } from "../src/chain/rpc.js";
import { MCP_READ_TOOLS } from "../src/mcp/client.js";

describe("LOCAL SOURCE CHECK: read-only monitoring boundary", () => {
  it("does not add an execution wallet, signing or chain-write call path", () => {
    const sources: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path); else if (entry.name.endsWith(".ts")) sources.push(readFileSync(path, "utf8"));
      }
    };
    walk("src");
    expect(sources.join("\n")).not.toMatch(/\b(?:createWalletClient|privateKeyToAccount|signTransaction|signTypedData|sendRawTransaction|writeContract|sendTransaction)\b|eth_sendRawTransaction|eth_sendTransaction|eth_sign/);
    expect(RPC_READ_METHODS).toEqual(["eth_chainId", "eth_blockNumber", "eth_getBlockByNumber", "eth_getCode", "eth_call", "eth_getLogs", "eth_getTransactionReceipt"]);
    expect(MCP_READ_TOOLS).toEqual(["get_chain_info", "get_block_number", "get_block", "get_code", "eth_call", "get_logs", "get_transaction_receipt"]);
  });
});
