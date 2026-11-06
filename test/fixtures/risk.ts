import { inspectPosition } from "../../src/chain/snapshot.js";
import type { Snapshot } from "../../src/domain/types.js";
import { FixtureClient } from "./clients.js";
import type { FixtureOverrides } from "./clients.js";

export const RISK_FIXTURE_TIME = "2026-11-01T14:05:00.000Z";

/** FIXTURE: Phase 1 fake clients, synthetic time/metadata; never a live-chain capture. */
export async function riskFixture(rpc: FixtureOverrides = {}, mcp: FixtureOverrides = rpc): Promise<Snapshot> {
  return inspectPosition({
    rpc: new FixtureClient("rpc", rpc), mcp: new FixtureClient("mcp", mcp),
    evidenceKind: "FIXTURE", now: () => new Date(RISK_FIXTURE_TIME)
  });
}
