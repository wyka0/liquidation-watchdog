import { z } from "zod";
import { idSchema, utcSchema } from "../monitoring/model.js";

export const operationalCodeSchema = z.enum([
  "CYCLE_TIMEOUT", "SHUTDOWN_TIMEOUT", "READ_CANCELLED", "STORE_TRANSACTION_FAILED", "STORE_OPEN_FAILED", "STORE_CORRUPT",
  "RESOURCE_DATABASE_LIMIT", "RESOURCE_WAL_LIMIT", "RESOURCE_DISK_RESERVE", "RESOURCE_BACKLOG_LIMIT", "RESOURCE_MEMORY_LIMIT",
  "RESOURCE_EVIDENCE_LIMIT", "RESOURCE_CHECK_FAILED", "WORKER_FAILED"
]);
export type OperationalCode = z.infer<typeof operationalCodeSchema>;
export const runtimeSchema = z.object({
  runId: idSchema, scope: z.string().regex(/^[a-f0-9]{64}$/), pid: z.number().int().positive(), startedAt: utcSchema, updatedAt: utcSchema,
  rssBytes: z.number().int().positive(),
  status: z.enum(["STARTING", "READING", "DELIVERING", "IDLE", "STOPPED", "FAILED"]), error: operationalCodeSchema.nullable()
}).strict();
export type WorkerRuntime = z.infer<typeof runtimeSchema>;
