import { formatUnits } from "viem";
import { DataError } from "../domain/errors.js";
import { uint } from "../morpho/math.js";

export function validateDecimals(decimals: number): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 77) {
    throw new DataError("INVALID_DECIMALS", "Decimals must be an integer from 0 to 77.", "tokens");
  }
  return decimals;
}

export function parseAmount(text: string, decimals: number): bigint {
  validateDecimals(decimals);
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(text)) {
    throw new DataError("INVALID_AMOUNT", "Use an unsigned plain decimal string.", "tokens");
  }
  const [whole = "", fraction = ""] = text.split(".");
  if (fraction.length > decimals) throw new DataError("EXCESS_PRECISION", "Amount exceeds the token's decimal precision.", "tokens");
  // Limit work before BigInt conversion as well as checking the final uint256.
  if (whole.length + decimals > 155) throw new DataError("INTEGER_RANGE", "Amount is too large.", "tokens");
  return uint(BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0"));
}

export function formatAmount(raw: bigint, decimals: number): string {
  return formatUnits(uint(raw), validateDecimals(decimals));
}
