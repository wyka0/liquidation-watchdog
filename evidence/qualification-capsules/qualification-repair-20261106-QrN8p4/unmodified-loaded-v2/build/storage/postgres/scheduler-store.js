import { randomUUID } from "node:crypto";
import { PG_LIMITS } from "../../config/postgres.js";
import { DataError } from "../../domain/errors.js";
import { digestSchema } from "../../oracle-assurance/model.js";
import { receiptSchemaFor, scheduledIdentity, SCHEDULE_ID, slotSchemaFor } from "../../runtime/scheduler-contract.js";
import { corrupt, counter, stored } from "./codec.js";
import { assertFence } from "./database.js";
const dbTime = "to_char(watchdog_pg.clock_now() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')";
const executionColumns = `id,namespace,schedule,slot,cycle_id,status,accepted,missed_slots::text,receipt_json,owner,fence::text,incarnation::text,
  to_char(completed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS completed_at_text`;
/** Only table-backed ownership; no session locks or reliance on a PgBouncer session. */
export class PostgresSchedulerStore {
    db;
    scope;
    slotSchema;
    receiptSchema;
    periodSeconds;
    constructor(db, scope, periodSeconds) {
        this.db = db;
        this.scope = scope;
        digestSchema.parse(scope);
        this.slotSchema = slotSchemaFor(periodSeconds); // grid validation happens once per construction.
        this.receiptSchema = receiptSchemaFor(periodSeconds);
        this.periodSeconds = periodSeconds;
    }
    identity(slot) { return scheduledIdentity(this.db.namespace, slot, this.periodSeconds); }
    receipt(row, slot) {
        const receipt = stored(this.receiptSchema, row.receipt_json, 4_096), identity = this.identity(slot);
        if (row.id !== identity.id || row.namespace !== this.db.namespace || row.schedule !== SCHEDULE_ID || row.slot !== slot
            || row.cycle_id !== identity.cycleId || receipt.slot !== slot || receipt.cycleId !== identity.cycleId
            || receipt.status !== row.status || receipt.accepted !== row.accepted || receipt.completedAt !== row.completed_at_text
            || receipt.missedSlots !== counter(row.missed_slots))
            throw corrupt();
        return receipt;
    }
    async admit(slot, signal) {
        this.slotSchema.parse(slot);
        const identity = this.identity(slot), owner = randomUUID();
        try {
            return await this.db.writer.transaction(async (sql) => {
                const incarnation = await this.db.verifySchema(sql);
                await this.db.verifyRole(sql, false);
                const lease = (await sql.query(`SELECT fence::text,owner,current_execution,
          expires_at>watchdog_pg.clock_now() AS live,deadline_at>watchdog_pg.clock_now() AS working,
          $1::timestamptz<=watchdog_pg.clock_now() AND $1::timestamptz>=watchdog_pg.clock_now()-interval '600 seconds' AS timely,
          high_water_slot IS NULL OR high_water_slot<$1::timestamptz AS increasing,
          CASE WHEN high_water_slot IS NULL THEN '0' ELSE GREATEST(0,FLOOR(EXTRACT(epoch FROM ($1::timestamptz-high_water_slot))/$2)-1)::bigint::text END AS missed
          FROM watchdog_pg.worker_lease WHERE id=1 FOR UPDATE`, [slot, this.periodSeconds])).rows[0];
                if (!lease)
                    throw new DataError("STORE_CORRUPT", "The global PostgreSQL lease record is missing.");
                const prior = (await sql.query(`SELECT ${executionColumns} FROM watchdog_pg.scheduled_executions WHERE id=$1`, [identity.id])).rows[0];
                if (prior) {
                    if (prior.status !== "RUNNING")
                        return { kind: "RECEIPT", receipt: this.receipt(prior, slot) };
                    if (lease.current_execution === identity.id && lease.owner === prior.owner && lease.fence === prior.fence
                        && prior.incarnation === incarnation && lease.live && lease.working)
                        return { kind: "IN_PROGRESS", cycleId: identity.cycleId, slot };
                    return { kind: "OUTCOME_UNKNOWN" };
                }
                // Receipt-only late retries have already been resolved above. No catch-up or future work.
                if (!lease.timely || !lease.increasing)
                    return { kind: "SLOT_REFUSED" };
                if (lease.live)
                    return { kind: "BUSY" };
                const missedSlots = counter(lease.missed);
                if (lease.current_execution) {
                    const abandoned = (await sql.query("SELECT e.slot,e.cycle_id,e.missed_slots::text,c.accepted FROM watchdog_pg.scheduled_executions e JOIN watchdog_pg.cycles c ON c.id=e.cycle_id WHERE e.id=$1 AND e.status='RUNNING'", [lease.current_execution])).rows[0];
                    if (abandoned) {
                        const completedAt = (await sql.query(`SELECT ${dbTime} AS now`)).rows[0].now;
                        const receipt = this.receiptSchema.parse({ slot: abandoned.slot, cycleId: abandoned.cycle_id, status: "INTERRUPTED", completedAt,
                            accepted: abandoned.accepted === 1, missedSlots: counter(abandoned.missed_slots), error: "PROCESS_INTERRUPTED" });
                        await sql.query("UPDATE watchdog_pg.scheduled_executions SET status='INTERRUPTED',completed_at=$4::timestamptz,accepted=$3,receipt_json=$2 WHERE id=$1 AND status='RUNNING'", [lease.current_execution, JSON.stringify(receipt), receipt.accepted, completedAt]);
                    }
                }
                // Recheck time under the lock immediately before advancing the persistent high-water mark.
                const updated = (await sql.query(`UPDATE watchdog_pg.worker_lease SET owner=$1,fence=fence+1,incarnation=$2,
          expires_at=watchdog_pg.clock_now()+$3::integer*interval '1 second',deadline_at=watchdog_pg.clock_now()+interval '300 seconds',
          current_execution=$4,high_water_slot=$5::timestamptz
          WHERE id=1 AND (expires_at IS NULL OR expires_at<=watchdog_pg.clock_now())
            AND $5::timestamptz<=watchdog_pg.clock_now() AND $5::timestamptz>=watchdog_pg.clock_now()-interval '600 seconds'
            AND (high_water_slot IS NULL OR high_water_slot<$5::timestamptz) RETURNING fence::text`, [owner, incarnation, PG_LIMITS.leaseSeconds, identity.id, slot])).rows[0];
                if (!updated)
                    throw new DataError("SCHEDULER_ADMISSION", "The scheduling admission window closed.");
                await sql.query(`INSERT INTO watchdog_pg.cycles(id,scope,started_at,status) VALUES($1,$2,${dbTime},'RUNNING')`, [identity.cycleId, this.scope]);
                await sql.query("INSERT INTO watchdog_pg.scheduled_executions(id,namespace,schedule,slot,cycle_id,owner,fence,incarnation,status,missed_slots,started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'RUNNING',$9,watchdog_pg.clock_now())", [identity.id, this.db.namespace, SCHEDULE_ID, slot, identity.cycleId, owner, updated.fence, incarnation, missedSlots]);
                return { kind: "ACQUIRED", fence: { owner, fence: updated.fence, incarnation, executionId: identity.id, cycleId: identity.cycleId, slot, missedSlots } };
            }, signal);
        }
        catch (error) {
            if (!(error instanceof DataError) || error.code !== "POSTGRES_COMMIT_UNKNOWN")
                throw error;
            // A lost admission acknowledgment never grants permission to execute. Resolve identity only.
            return this.lookup(slot, signal);
        }
    }
    async lookup(slot, signal) {
        const identity = this.identity(slot);
        return this.db.writer.transaction(async (sql) => {
            await this.db.verifySchema(sql);
            await this.db.verifyRole(sql, false);
            const row = (await sql.query(`SELECT ${executionColumns} FROM watchdog_pg.scheduled_executions WHERE id=$1`, [identity.id])).rows[0];
            if (row && row.status !== "RUNNING")
                return { kind: "RECEIPT", receipt: this.receipt(row, slot) };
            return { kind: "OUTCOME_UNKNOWN" };
        }, signal);
    }
    async finish(fence, outcome, signal) {
        try {
            return await this.db.writer.transaction(async (sql) => {
                await assertFence(sql, fence, true);
                const cycle = (await sql.query("SELECT accepted,status FROM watchdog_pg.cycles WHERE id=$1 AND scope=$2", [fence.cycleId, this.scope])).rows[0];
                if (!cycle || (!outcome.error && (cycle.status !== "COMPLETED" || outcome.accepted !== (cycle.accepted === 1)))) {
                    throw new DataError("STORE_CYCLE_CONFLICT", "Execution completion does not match its persisted cycle.");
                }
                const completedAt = (await sql.query(`SELECT ${dbTime} AS now`)).rows[0].now;
                const receipt = this.receiptSchema.parse({ slot: fence.slot, cycleId: fence.cycleId, status: outcome.error ? "FAILED" : "COMPLETED",
                    completedAt, accepted: cycle.accepted === 1, missedSlots: fence.missedSlots, error: outcome.error });
                const result = await sql.query("UPDATE watchdog_pg.scheduled_executions SET status=$2,completed_at=$8::timestamptz,accepted=$3,receipt_json=$4 WHERE id=$1 AND status='RUNNING' AND owner=$5 AND fence=$6::bigint AND incarnation=$7::uuid", [fence.executionId, receipt.status, receipt.accepted, JSON.stringify(receipt), fence.owner, fence.fence, fence.incarnation, completedAt]);
                if (result.rowCount !== 1)
                    throw new DataError("POSTGRES_FENCE_LOST", "Execution completion was already recorded or superseded.");
                await assertFence(sql, fence, true);
                await sql.query("UPDATE watchdog_pg.worker_lease SET owner=NULL,expires_at=NULL,deadline_at=NULL,current_execution=NULL WHERE id=1 AND owner=$1 AND fence=$2::bigint AND incarnation=$3::uuid", [fence.owner, fence.fence, fence.incarnation]);
                return receipt;
            }, signal);
        }
        catch (error) {
            if (!(error instanceof DataError) || error.code !== "POSTGRES_COMMIT_UNKNOWN")
                throw error;
            const resolved = await this.lookup(fence.slot, signal);
            if (resolved.kind === "RECEIPT")
                return resolved.receipt;
            throw error;
        }
    }
}
//# sourceMappingURL=scheduler-store.js.map