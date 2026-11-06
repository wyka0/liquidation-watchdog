import type { QualityStatus, Scope } from "./types.js";

export class DataError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly scope: Scope = "snapshot",
    readonly quality: QualityStatus = "INVALID"
  ) {
    super(message);
    this.name = "DataError";
  }
}

export class TransientReadError extends Error {
  constructor(readonly code: string, readonly retryAfterMs: number | null = null) {
    super(code);
    this.name = "TransientReadError";
  }
}
