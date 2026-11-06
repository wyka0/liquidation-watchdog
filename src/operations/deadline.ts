import { DataError } from "../domain/errors.js";

/** Enforce the deadline even for a non-cooperative injected provider. Late work never becomes an accepted result. */
export async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds: number, code: string,
  caller?: AbortSignal): Promise<T> {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) throw new DataError("DEADLINE_CONFIG", "A positive bounded deadline is required.");
  const controller = new AbortController();
  const cancelled = () => controller.abort();
  caller?.addEventListener("abort", cancelled, { once: true });
  if (caller?.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined, onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new DataError("READ_CANCELLED", "Bounded work was cancelled.", "network", "UNAVAILABLE");
        return operation(controller.signal);
      }),
      new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(new DataError("READ_CANCELLED", "Bounded work was cancelled.", "network", "UNAVAILABLE"));
        controller.signal.addEventListener("abort", onAbort, { once: true });
        if (controller.signal.aborted) onAbort();
        timer = setTimeout(() => {
          reject(new DataError(code, "The operation exceeded its bounded deadline.", "network", "UNAVAILABLE"));
          controller.abort();
        }, milliseconds);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) controller.signal.removeEventListener("abort", onAbort);
    caller?.removeEventListener("abort", cancelled);
  }
}
