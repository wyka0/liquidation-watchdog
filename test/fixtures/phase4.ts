import { readFileSync } from "node:fs";
import type { Address, Hex } from "viem";
import { z } from "zod";
import { inspectPosition } from "../../src/chain/snapshot.js";
import { observe } from "../../src/monitoring/observation.js";
import { RESEARCH_BUNDLE } from "../../src/oracle-assurance/reviewed.js";
import { bytesSchema } from "../../src/validation/schemas.js";
import { FixtureClient as OriginalFixtureClient } from "./clients.js";
import type { FixtureOverrides } from "./clients.js";
import { MONITOR_THRESHOLDS, testClock } from "./monitoring.js";
export * from "./monitoring.js";
export { RISK_FIXTURE_TIME } from "./risk.js";

// FIXTURE: synthetic state/time using archived public runtime bytes. The original Phase 1–3
// fixtures are preserved; their short dummy runtimes cannot satisfy Phase 4 identity checks.
const runtimes = new Map(["oracle", "morpho", "forwarder"].map(label => {
  const runtime = z.object({ address: z.string(), code: bytesSchema }).parse(JSON.parse(readFileSync(`${RESEARCH_BUNDLE}/${label}-runtime.json`, "utf8")));
  return [runtime.address.toLowerCase(), runtime.code];
}));
export class FixtureClient extends OriginalFixtureClient {
  override async code(address: Address, block: bigint): Promise<Hex> {
    const original = await super.code(address, block), runtime = runtimes.get(address.toLowerCase());
    if (original !== "0x60006000" || !runtime) return original;
    this.records[this.records.length - 1]!.result = runtime;
    return runtime;
  }
}
export async function riskFixture(rpc: FixtureOverrides = {}, mcp: FixtureOverrides = rpc) {
  return inspectPosition({ rpc: new FixtureClient("rpc", rpc), mcp: new FixtureClient("mcp", mcp), evidenceKind: "FIXTURE", now: testClock });
}
export async function monitoringFixture() {
  return observe(await riskFixture(), "cycle_1", testClock(), MONITOR_THRESHOLDS, { allowFixture: true });
}
