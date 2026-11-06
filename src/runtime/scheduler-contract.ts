import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { DataError } from "../domain/errors.js";
import type { Fence } from "../storage/postgres/database.js";
import { hashParts, idSchema, utcSchema } from "../monitoring/model.js";

export const SCHEDULER_PATH = "/internal/monitor/run";
/** Frozen schedule/identity lineage: persisted rows and the `scheduled_executions.schedule` CHECK constraint pin this
 * string, so it survives cadence reconfigurations. The live slot grid itself is configured (A2), not named here. */
export const SCHEDULE_ID = "morpho-30m-v1";

const minuteStep = (periodSeconds: number): number => {
  if (!Number.isSafeInteger(periodSeconds) || periodSeconds < 60 || periodSeconds > 3_600
    || periodSeconds % 60 !== 0 || 3_600 % periodSeconds !== 0) {
    throw new DataError("SCHEDULER_CONFIG", "The slot period must be an integer multiple of 60 seconds dividing one hour; the approved A2 interval is 300 seconds (5 minutes).");
  }
  return periodSeconds / 60;
};

/** UTC minutes occupied by dedicated slots for the configured period (minute grid; empty never). */
export function slotUtcMinutes(periodSeconds: number): number[] {
  const step = minuteStep(periodSeconds);
  return Array.from({ length: 60 / step }, (_, index) => index * step);
}
/** One UTC instant with exactly `.000` seconds, on whole minutes of the configured grid. */
export function slotSchemaFor(periodSeconds: number) {
  const step = minuteStep(periodSeconds);
  return z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/).refine(value => {
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString() === value && time / 60_000 % 60 % step === 0;
  });
}
export const schedulerRequestSchemaFor = (periodSeconds: number) => z.object({ slot: slotSchemaFor(periodSeconds) }).strict();
/** One literal JSON member: duplicate keys and escaped aliases never collapse into an accepted slot. */
export function parseSchedulerBody(bytes: Uint8Array, periodSeconds: number): z.infer<ReturnType<typeof schedulerRequestSchemaFor>> {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!/^\s*\{\s*"slot"\s*:\s*"[^"\\]*"\s*\}\s*$/.test(text)) throw new Error();
    return schedulerRequestSchemaFor(periodSeconds).parse(JSON.parse(text));
  } catch { throw new DataError("SCHEDULER_REQUEST", "A single valid UTC slot is required."); }
}
export const receiptSchemaFor = (periodSeconds: number) => z.object({ slot: slotSchemaFor(periodSeconds), cycleId: idSchema,
  status: z.enum(["COMPLETED", "FAILED", "INTERRUPTED"]), completedAt: utcSchema, accepted: z.boolean(),
  missedSlots: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  error: z.enum(["CYCLE_FAILED", "JOB_TIMEOUT", "PROCESS_INTERRUPTED"]).nullable() }).strict().refine(receipt =>
    receipt.status === "COMPLETED" ? receipt.error === null : receipt.status === "INTERRUPTED" ? receipt.error === "PROCESS_INTERRUPTED"
      : receipt.error === "CYCLE_FAILED" || receipt.error === "JOB_TIMEOUT");
export type ExecutionReceipt = z.infer<ReturnType<typeof receiptSchemaFor>>;
export type Admission = { kind: "ACQUIRED"; fence: Fence }
  | { kind: "RECEIPT"; receipt: ExecutionReceipt } | { kind: "IN_PROGRESS"; cycleId: string; slot: string }
  | { kind: "BUSY" | "SLOT_REFUSED" | "OUTCOME_UNKNOWN" };

export function scheduledIdentity(namespace: string, slot: string, periodSeconds: number) {
  slotSchemaFor(periodSeconds).parse(slot);
  const id = hashParts(["schedule-v1", namespace, SCHEDULE_ID, slot]);
  return { id, cycleId: `scheduled_${id}` };
}
export function schedulerAuthenticator(secret: string | undefined, readCredential?: string): (header: string | undefined) => boolean {
  if (!secret || !/^[A-Za-z0-9_-]{43,256}$/.test(secret)) throw new DataError("SCHEDULER_AUTH_CONFIG", "A dedicated scheduler credential of at least 256 generated bits is required.");
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const expected = digest(secret);
  if (readCredential && timingSafeEqual(expected, digest(readCredential))) throw new DataError("SCHEDULER_AUTH_CONFIG", "Scheduler and read credentials must be distinct.");
  return header => {
    if (!header || header.length > 300 || !/^Bearer [A-Za-z0-9_-]{43,256}$/.test(header)) return false;
    return timingSafeEqual(expected, digest(header.slice(7)));
  };
}
