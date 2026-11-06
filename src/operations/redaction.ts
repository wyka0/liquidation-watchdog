import { DataError } from "../domain/errors.js";

/** Public errors contain a bounded internal code, never arbitrary exception/provider text. */
export function publicError(error: unknown): { code: string; message: string } {
  const code = error instanceof DataError && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) ? error.code : "OPERATION_FAILED";
  return { code, message: "Operation failed; consult the documented code and sanitized diagnostics. No failed result was accepted." };
}

/** Defense in depth for human-readable text. Structured operational output uses allowlists instead. */
export function redactText(input: string): string {
  return input.replace(/https?:\/\/[^\s<>"']+/gi, "[REDACTED_URL]")
    .replace(/\b[0-9]{5,15}:[A-Za-z0-9_-]{20,100}\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_.=~:-]+/gi, "[REDACTED_AUTH]")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ").slice(0, 1_024);
}
