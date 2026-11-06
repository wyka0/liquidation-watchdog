import { DataError } from "./errors.js";

export function stringify(value: unknown, space = 2): string {
  return JSON.stringify(value, (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item, space);
}

export function utcFromSeconds(seconds: bigint): string {
  if (seconds < 0n || seconds > 8_640_000_000_000n) {
    throw new DataError("TIMESTAMP_RANGE", "Timestamp cannot be represented as a UTC date.");
  }
  // Only date presentation uses Number; amounts, rates and ratios stay bigint.
  return new Date(Number(seconds) * 1_000).toISOString();
}
