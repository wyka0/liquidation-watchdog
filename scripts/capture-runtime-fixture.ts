import { readFile, writeFile } from "node:fs/promises";
import { DEPLOYMENT } from "../src/config/deployment.js";
import { z } from "zod";
import { bytesSchema } from "../src/validation/schemas.js";
import { stringify } from "../src/domain/serialize.js";

// One-time extraction of public bytes already captured by the real inspection.
// This script performs no network requests and refuses to replace a fixture.
const snapshot = z.object({
  block: z.object({ number: z.string(), hash: z.string(), timestamp: z.string() }),
  retrievedAt: z.string(),
  reads: z.array(z.object({ source: z.string(), method: z.string(), params: z.unknown(), result: z.unknown() }))
}).parse(JSON.parse(await readFile("evidence/phase1/position-snapshot.json", "utf8")));
const code: Record<string, string> = {};
for (const address of [DEPLOYMENT.multicall, DEPLOYMENT.feed, DEPLOYMENT.cache]) {
  const read = snapshot.reads.find(item => item.source === "rpc" && item.method === "eth_getCode" && Array.isArray(item.params)
    && typeof item.params[0] === "string" && item.params[0].toLowerCase() === address.toLowerCase());
  code[address.toLowerCase()] = bytesSchema.parse(read?.result);
}
await writeFile("test/fixtures/runtime.json", `${stringify({
  evidenceKind: "HISTORICAL_SNAPSHOT", purpose: "Archived public runtime bytecode used inside explicitly synthetic failure fixtures.",
  chainId: 1672, source: "https://rpc.pharos.xyz", block: snapshot.block, retrievedAt: snapshot.retrievedAt, code
})}\n`, { encoding: "utf8", flag: "wx" });
console.log("Created historical public runtime fixture.");
