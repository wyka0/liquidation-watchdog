import { readFileSync } from "node:fs";
import { toHex, zeroAddress } from "viem";
import type { Snapshot } from "../../src/domain/types.js";
import { accruePosition, valuePosition } from "../../src/morpho/accounting.js";
import { AUDIT_BOUNDS } from "../../src/oracle-assurance/audit-rpc.js";
import type { SupplementalResult } from "../../src/oracle-assurance/supplemental.js";
import { riskSnapshotSchema } from "../../src/risk/snapshot-schema.js";

export const AUDIT_FIXTURE_BUNDLE = "evidence/phase4/oracle-audit-2026-11-01T17-47-35-687Z-5078c30b-6b3f-4325-ad6c-abae354e3d97";
export const auditTraceFixture = (): SupplementalResult => JSON.parse(readFileSync(`${AUDIT_FIXTURE_BUNDLE}/supplemental.json`, "utf8")) as SupplementalResult;
export function auditSnapshotFixture(): Snapshot {
  // Fixed archived input, rehydrated only for offline replay and explicitly relabeled FIXTURE.
  // This is not a reproduction of the type-tagged live snapshot identifier.
  const snapshot = riskSnapshotSchema.parse(JSON.parse(readFileSync(`${AUDIT_FIXTURE_BUNDLE}/snapshot.json`, "utf8"), (_key, value: unknown) =>
    typeof value === "string" && /^-?(?:0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : value));
  snapshot.evidenceKind = "FIXTURE";
  return snapshot;
}
export function supplementalFixture(snapshot: Snapshot): SupplementalResult {
  const block = snapshot.block!;
  return { status: "BOUNDED_READ_COMPLETE", block: { number: block.number.toString(), hash: block.hash, timestamp: block.timestamp.toString() },
    retrievedAt: snapshot.retrievedAt, historyFrom: (block.number - AUDIT_BOUNDS.historyBlocks + 1n).toString(), historyTo: block.number.toString(),
    configuration: { proxyImplementation: zeroAddress, proxyAdmin: zeroAddress, proxyBeacon: zeroAddress,
      signerConfigurationHash: null, workflowConfigurationHash: null, signerCoverage: "UNOBSERVED" },
    events: [], samples: [], observations: [], signerSets: [], workflowIds: [], trace: [], limitations: ["Synthetic bounded configuration fixture; not live chain evidence."] };
}
/** Advance every dependent numerical/header field so fixture tests isolate assurance continuity. */
export function advanceSnapshot(input: Snapshot, blocks = 1n): Snapshot {
  const snapshot = structuredClone(input), block = snapshot.block!;
  const original = block.number;
  block.parentHash = block.hash; block.number += blocks; block.timestamp += blocks;
  block.hash = toHex(block.number, { size: 32 });
  snapshot.retrievedAt = new Date(Date.parse(snapshot.retrievedAt) + Number(blocks) * 1_000).toISOString();
  for (const key of ["rpc", "mcp"] as const) snapshot.heads[key] = block.number + 5n;
  for (const contract of snapshot.contracts) contract.blockNumber = block.number;
  for (const comparison of snapshot.consistency.comparisons) if (comparison.blockNumber === original) comparison.blockNumber = block.number;
  for (const read of snapshot.reads) if (read.blockNumber === original) read.blockNumber = block.number;
  for (const key of ["rpcBefore", "rpcAfter", "mcpBefore", "mcpAfter"] as const) snapshot.consistency[key] = { ...block };
  snapshot.accounting = accruePosition(snapshot.params!, snapshot.market!, snapshot.position!, block.timestamp, snapshot.borrowRatePerSecondWad!);
  snapshot.valuation = valuePosition(snapshot.position!.collateral, snapshot.oracle.price!, snapshot.params!.lltv, snapshot.accounting.debt);
  snapshot.oracle.ageSeconds = block.timestamp - snapshot.oracle.round!.updatedAt;
  return snapshot;
}
