import { z } from "zod";
import type { Fence } from "../storage/postgres/database.js";
export declare const SCHEDULER_PATH = "/internal/monitor/run";
/** Frozen schedule/identity lineage: persisted rows and the `scheduled_executions.schedule` CHECK constraint pin this
 * string, so it survives cadence reconfigurations. The live slot grid itself is configured (A2), not named here. */
export declare const SCHEDULE_ID = "morpho-30m-v1";
/** UTC minutes occupied by dedicated slots for the configured period (minute grid; empty never). */
export declare function slotUtcMinutes(periodSeconds: number): number[];
/** One UTC instant with exactly `.000` seconds, on whole minutes of the configured grid. */
export declare function slotSchemaFor(periodSeconds: number): z.ZodString;
export declare const schedulerRequestSchemaFor: (periodSeconds: number) => z.ZodObject<{
    slot: z.ZodString;
}, z.core.$strict>;
/** One literal JSON member: duplicate keys and escaped aliases never collapse into an accepted slot. */
export declare function parseSchedulerBody(bytes: Uint8Array, periodSeconds: number): z.infer<ReturnType<typeof schedulerRequestSchemaFor>>;
export declare const receiptSchemaFor: (periodSeconds: number) => z.ZodObject<{
    slot: z.ZodString;
    cycleId: z.ZodString;
    status: z.ZodEnum<{
        FAILED: "FAILED";
        COMPLETED: "COMPLETED";
        INTERRUPTED: "INTERRUPTED";
    }>;
    completedAt: z.ZodISODateTime;
    accepted: z.ZodBoolean;
    missedSlots: z.ZodNumber;
    error: z.ZodNullable<z.ZodEnum<{
        PROCESS_INTERRUPTED: "PROCESS_INTERRUPTED";
        CYCLE_FAILED: "CYCLE_FAILED";
        JOB_TIMEOUT: "JOB_TIMEOUT";
    }>>;
}, z.core.$strict>;
export type ExecutionReceipt = z.infer<ReturnType<typeof receiptSchemaFor>>;
export type Admission = {
    kind: "ACQUIRED";
    fence: Fence;
} | {
    kind: "RECEIPT";
    receipt: ExecutionReceipt;
} | {
    kind: "IN_PROGRESS";
    cycleId: string;
    slot: string;
} | {
    kind: "BUSY" | "SLOT_REFUSED" | "OUTCOME_UNKNOWN";
};
export declare function scheduledIdentity(namespace: string, slot: string, periodSeconds: number): {
    id: string;
    cycleId: string;
};
export declare function schedulerAuthenticator(secret: string | undefined, readCredential?: string): (header: string | undefined) => boolean;
