import { createHash } from "node:crypto";
import { DataError } from "../domain/errors.js";
import type { Snapshot } from "../domain/types.js";
import { snapshotIdentitySchema } from "./snapshot-schema.js";
import type { RiskProvenance } from "./types.js";
import { demoPositionConfiguration } from "../config/position.js";
import type { PositionConfiguration } from "../config/position.js";

function canonical(value: unknown, depth = 0): unknown {
  if (depth > 32) throw new DataError("SNAPSHOT_SERIALIZATION", "Snapshot nesting exceeds the identifier limit.");
  if (typeof value === "bigint") return ["bigint", value.toString()];
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  // Tag containers as well: a raw object/array must never impersonate a bigint tag.
  if (Array.isArray(value)) return ["array", value.map(item => canonical(item, depth + 1))];
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return ["object", Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, canonical(item, depth + 1)])];
  }
  throw new DataError("SNAPSHOT_SERIALIZATION", "Snapshot identifiers require finite, JSON-compatible public data and bigint quantities.");
}

export function snapshotIdentifier(snapshot: Snapshot): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical(snapshot))).digest("hex")}`;
}

export function riskProvenance(raw: unknown, identifier: string | null,
  position: PositionConfiguration = demoPositionConfiguration()): RiskProvenance {
  const parsed = snapshotIdentitySchema.safeParse(raw);
  const identity = parsed.success ? parsed.data : null;
  return {
    chainId: identity?.network.chainId ?? position.identity.chainId, protocol: "Morpho Blue", morphoAddress: position.identity.protocolAddress,
    marketId: identity?.marketId ?? position.identity.marketId, account: identity?.account ?? position.identity.account,
    accountRole: identity?.accountRole ?? position.accountRole,
    blockNumber: identity?.block?.number ?? null, blockHash: identity?.block?.hash ?? null, blockTimestamp: identity?.block?.timestamp ?? null,
    evidenceKind: identity?.evidenceKind ?? null,
    temporalContext: identity?.evidenceKind === "FIXTURE" ? "FIXTURE" : identity?.evidenceKind === "HISTORICAL_SNAPSHOT" ? "HISTORICAL"
      : identity?.evidenceKind === "LIVE_CHAIN_READ" ? "LIVE_AS_OF_BLOCK" : "UNAVAILABLE",
    snapshotRetrievedAt: identity?.retrievedAt ?? null, inputSnapshotIdentifier: identifier
  };
}

export function freezeResult<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeResult(child);
    Object.freeze(value);
  }
  return value;
}
