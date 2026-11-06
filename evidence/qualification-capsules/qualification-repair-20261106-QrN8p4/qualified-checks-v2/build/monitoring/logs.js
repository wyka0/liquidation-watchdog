import { z } from "zod";
import { diagnosticSchema, idSchema, utcSchema } from "./model.js";
import { operationalCodeSchema } from "../operations/model.js";
const logSchema = z.object({
    timestamp: utcSchema,
    event: z.enum(["cycle_started", "cycle_observed", "cycle_completed", "alert_created", "notification_delivery", "shutdown", "restart_recovery", "operational_failure", "startup_validated"]),
    code: operationalCodeSchema.optional(),
    cycleId: idSchema.optional(), alertId: idSchema.optional(), durationMs: z.number().int().nonnegative().optional(),
    blockNumber: z.string().regex(/^[0-9]+$/).nullable().optional(), blockHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).nullable().optional(),
    accepted: z.boolean().optional(), mathematicalRiskState: z.string().regex(/^[A-Z_]+$/).nullable().optional(),
    dataQuality: z.enum(["VALID", "UNVERIFIED", "INVALID", "UNAVAILABLE", "STALE"]).optional(),
    oracleQuality: z.enum(["VALID", "UNVERIFIED", "INVALID", "UNAVAILABLE", "STALE"]).optional(),
    diagnostics: z.array(diagnosticSchema).optional(),
    channel: z.enum(["console", "telegram", "discord"]).optional(),
    deliveryStatus: z.enum(["PENDING", "DELIVERED", "FAILED", "RETRY_SCHEDULED", "PERMANENTLY_FAILED", "UNKNOWN"]).optional()
}).strict();
export function structuredLogger(write) {
    return record => { write(`${JSON.stringify(logSchema.parse(record))}\n`); };
}
//# sourceMappingURL=logs.js.map