import { z } from "zod";
import { PG_LIMITS } from "../../config/postgres.js";
import { DataError } from "../../domain/errors.js";
import { alertSchema, channelSchema, hashParts, idSchema, observationSchema, stateSchema, storedAlertSchema } from "../../monitoring/model.js";
import { assuranceSchema, digestSchema } from "../../oracle-assurance/model.js";
import { runtimeSchema } from "../../operations/model.js";
import { deliverySchema } from "../store.js";
import { corrupt, counter, encoded, stored, textHash, utcText } from "./codec.js";
import { cycleRowSchema, loadAssurance, loadState } from "./database.js";
const resultSchema = z.union([z.object({ delivered: z.literal(true) }).strict(), z.object({ delivered: z.literal(false),
        code: deliverySchema.shape.last_error.unwrap(), retryable: z.boolean(), ambiguous: z.boolean(),
        retryAfterMs: z.number().finite().min(0).max(365 * 86_400_000).nullable() }).strict()]);
/** A job-scoped capability. Closing it revokes late continuations; the runtime owns the pools. */
export class PostgresMonitorStore {
    db;
    fence;
    limits;
    caller;
    owned = false;
    closed = false;
    cancellation = new AbortController();
    onCancel;
    constructor(db, fence, limits, caller) {
        this.db = db;
        this.fence = fence;
        this.limits = limits;
        this.caller = caller;
        this.onCancel = () => this.cancel();
        caller?.addEventListener("abort", this.onCancel, { once: true });
        if (caller?.aborted)
            this.cancel();
    }
    async acquireMonitor() {
        if (this.closed || this.owned)
            throw new DataError("MONITOR_ALREADY_RUNNING", "This PostgreSQL job capability is not available.");
        await this.db.write(this.fence, async () => { }, this.cancellation.signal);
        this.owned = true;
    }
    write(operation) {
        if (!this.owned || this.closed || this.cancellation.signal.aborted)
            throw new DataError("STORE_NOT_OWNED", "An active PostgreSQL writer capability is required.");
        return this.db.write(this.fence, operation, this.cancellation.signal);
    }
    cancel() { this.cancellation.abort(); }
    close() { this.closed = true; this.owned = false; this.cancel(); this.caller?.removeEventListener("abort", this.onCancel); }
    state(scope) { return this.write(sql => loadState(sql, scope)); }
    latestOracleAssurance(context) { return this.write(sql => loadAssurance(sql, context)); }
    async beginCycle(id, scope, startedAt) {
        idSchema.parse(id);
        digestSchema.parse(scope);
        utcText(startedAt);
        if (id !== this.fence.cycleId)
            throw new DataError("STORE_CYCLE_CONFLICT", "A job can begin only its admitted deterministic cycle.");
        await this.write(async (sql) => {
            const row = (await sql.query("SELECT id FROM watchdog_pg.cycles WHERE id=$1 AND scope=$2 AND status='RUNNING' AND observation_json IS NULL", [id, scope])).rows[0];
            if (!row)
                throw new DataError("STORE_CYCLE_CONFLICT", "The admitted cycle is absent or already persisted.");
            // Admission persisted the actual database start time, not the requested slot or host clock.
        });
    }
    async unfinishedCycles(scope) {
        digestSchema.parse(scope);
        return this.write(async (sql) => (await sql.query("SELECT id,scope,started_at,status,completed_at FROM watchdog_pg.cycles WHERE scope=$1 AND id<>$2 AND status IN ('RUNNING','PERSISTED') ORDER BY started_at,id LIMIT 256", [scope, this.fence.cycleId])).rows.map(row => cycleRowSchema.parse(row)));
    }
    async commitObservation(scope, observation, previousRevision, state, candidates, channels) {
        digestSchema.parse(scope);
        const current = observationSchema.parse(observation), next = stateSchema.parse(state), alerts = candidates.map(alert => alertSchema.parse(alert));
        const uniqueChannels = [...new Set(channels.map(channel => channelSchema.parse(channel)))];
        const observationText = encoded(observationSchema, current), stateText = encoded(stateSchema, next, 1_048_576);
        if (!Number.isSafeInteger(previousRevision) || previousRevision < 0 || !Number.isSafeInteger(next.revision)
            || next.revision !== previousRevision + 1 || JSON.stringify(next.latest) !== observationText
            || alerts.length > 32 || alerts.some(alert => alert.cycleId !== current.cycleId || alert.scope !== scope))
            throw corrupt();
        try {
            return await this.write(async (sql) => {
                const previous = await loadState(sql, scope);
                if (previous.revision !== previousRevision)
                    throw new DataError("STORE_REVISION_CONFLICT", "Monitoring state changed before this cycle could commit.");
                if (!current.accepted && JSON.stringify(next.lastAccepted) !== JSON.stringify(previous.lastAccepted))
                    throw corrupt();
                const risk = current.risk;
                const change = await sql.query(`UPDATE watchdog_pg.cycles SET observed_at=$1,status='PERSISTED',accepted=$2,observation_json=$3,observation_sha256=$4,
          block_number=$5,block_hash=$6,snapshot_id=$7,math_state=$8,data_quality=$9,oracle_quality=$10,safety_ratio=$11,ltv=$12
          WHERE id=$13 AND scope=$14 AND status='RUNNING'`, [utcText(current.observedAt), current.accepted ? 1 : 0, observationText, textHash(observationText), risk.blockNumber, risk.blockHash,
                    risk.snapshotIdentifier, risk.mathematicalRiskState, risk.dataQuality, risk.oracleQuality, risk.safetyRatio, risk.ltv, current.cycleId, scope]);
                if (change.rowCount !== 1)
                    throw new DataError("STORE_CYCLE_CONFLICT", "Cycle was already committed or belongs to a different stream.");
                const changedState = await sql.query(`INSERT INTO watchdog_pg.streams(scope,revision,state_json,state_sha256,latest_cycle,last_accepted_cycle)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(scope) DO UPDATE SET revision=excluded.revision,state_json=excluded.state_json,
          state_sha256=excluded.state_sha256,latest_cycle=excluded.latest_cycle,last_accepted_cycle=excluded.last_accepted_cycle
          WHERE watchdog_pg.streams.revision=$7`, [scope, next.revision, stateText, textHash(stateText), current.cycleId, next.lastAccepted?.cycleId ?? null, previousRevision]);
                if (changedState.rowCount !== 1)
                    throw new DataError("STORE_REVISION_CONFLICT", "Monitoring state revision changed.");
                if (current.assurance)
                    await this.insertAssurance(sql, `oracle_${current.cycleId}`, current.assurance);
                let pending = counter((await sql.query("SELECT count(*)::text AS count FROM watchdog_pg.deliveries WHERE status NOT IN ('DELIVERED','PERMANENTLY_FAILED')")).rows[0].count);
                const created = [];
                for (const alert of alerts) {
                    const inserted = await sql.query("INSERT INTO watchdog_pg.fingerprints(fingerprint,created_at) VALUES($1,$2) ON CONFLICT(fingerprint) DO NOTHING", [alert.fingerprint, utcText(alert.createdAt)]);
                    if (!inserted.rowCount)
                        continue;
                    pending += uniqueChannels.length;
                    if (pending > Math.min(this.limits.pendingDeliveries, PG_LIMITS.pendingDeliveries))
                        throw new DataError("RESOURCE_BACKLOG_LIMIT", "Outbox budget exceeded; state, alerts and deliveries were rolled back together.");
                    const text = encoded(alertSchema, alert);
                    await sql.query("INSERT INTO watchdog_pg.alerts(id,fingerprint,cycle_id,scope,created_at,severity,category,alert_json,alert_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [alert.id, alert.fingerprint, current.cycleId, scope, alert.createdAt, alert.severity, alert.category, text, textHash(text)]);
                    for (const channel of uniqueChannels) {
                        const id = `delivery_${hashParts([alert.id, channel])}`;
                        await sql.query("INSERT INTO watchdog_pg.deliveries(id,alert_id,channel,status,next_at) VALUES($1,$2,$3,'PENDING',$4)", [id, alert.id, channel, alert.createdAt]);
                        await this.event(sql, id, "PENDING", alert.createdAt);
                    }
                    created.push(alert);
                }
                return created;
            });
        }
        catch (error) {
            if (!(error instanceof DataError) || error.code !== "POSTGRES_COMMIT_UNKNOWN")
                throw error;
            // Resolve immutable payloads after an uncertain COMMIT; never replay observation/outbox writes.
            return this.write(async (sql) => {
                const cycle = (await sql.query("SELECT observation_sha256 FROM watchdog_pg.cycles WHERE id=$1", [current.cycleId])).rows[0];
                const stateRow = (await sql.query("SELECT state_sha256 FROM watchdog_pg.streams WHERE scope=$1", [scope])).rows[0];
                if (cycle?.observation_sha256 !== textHash(observationText) || stateRow?.state_sha256 !== textHash(stateText))
                    throw error;
                const rows = (await sql.query("SELECT alert_json,alert_sha256 FROM watchdog_pg.alerts WHERE cycle_id=$1 ORDER BY stable_seq LIMIT 33", [current.cycleId])).rows;
                if (rows.length > 32)
                    throw corrupt();
                return rows.map(row => {
                    const value = stored(storedAlertSchema, row.alert_json, 262_144);
                    if (textHash(row.alert_json) !== row.alert_sha256 || !alerts.some(alert => JSON.stringify(alert) === row.alert_json))
                        throw corrupt();
                    return value;
                });
            });
        }
    }
    async insertAssurance(sql, id, assurance) {
        idSchema.parse(id);
        const text = encoded(assuranceSchema, assurance), prior = (await loadAssurance(sql, assurance.continuityScope))?.assurance;
        if (prior && assurance.evaluatedAt < prior.evaluatedAt)
            throw corrupt();
        if (prior?.evidenceInvalidated && !assurance.evidenceInvalidated)
            throw corrupt();
        if (prior?.baseline && (!assurance.baseline || BigInt(assurance.baseline.block.number) < BigInt(prior.baseline.block.number)
            || (assurance.baseline.block.number === prior.baseline.block.number && assurance.baseline.block.hash !== prior.baseline.block.hash)))
            throw corrupt();
        await sql.query("INSERT INTO watchdog_pg.oracle_assurance(id,evaluated_at,context,result_json,result_sha256) VALUES($1,$2,$3,$4,$5)", [id, utcText(assurance.evaluatedAt), assurance.continuityScope, text, textHash(text)]);
    }
    async finishCycle(id, completedAt, interrupted = false) {
        idSchema.parse(id);
        utcText(completedAt);
        await this.write(async (sql) => {
            const result = await sql.query(`UPDATE watchdog_pg.cycles SET completed_at=$2::text,duration_ms=GREATEST(0,FLOOR(EXTRACT(epoch FROM (watchdog_pg.utc_value($2::text)-started_at_ts))*1000))::bigint,status=$3
        WHERE id=$1 AND status IN ('RUNNING','PERSISTED')`, [id, completedAt, interrupted ? "INTERRUPTED" : "COMPLETED"]);
            if (result.rowCount !== 1)
                throw new DataError("STORE_CYCLE_CONFLICT", "Cycle completion conflicts with persisted history.");
        });
    }
    async event(sql, id, status, now) {
        await sql.query("INSERT INTO watchdog_pg.delivery_events(delivery_id,occurred_at,status) VALUES($1,$2,$3)", [id, utcText(now), status]);
    }
    async due(now, channels, limit = 50) {
        utcText(now);
        channels.forEach(channel => channelSchema.parse(channel));
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
            throw new DataError("READ_LIMIT", "Invalid outbox batch size.");
        if (!channels.length)
            return [];
        return this.write(async (sql) => (await sql.query(`SELECT d.* FROM watchdog_pg.deliveries d JOIN watchdog_pg.alerts a ON a.id=d.alert_id
      LEFT JOIN watchdog_pg.provider_limits p ON p.channel=d.channel WHERE d.status IN ('PENDING','FAILED','RETRY_SCHEDULED') AND d.next_at<=$1
      AND COALESCE(p.blocked,0)=0 AND (p.next_at IS NULL OR p.next_at<=$1) AND d.channel=ANY($2::text[])
      ORDER BY CASE a.severity WHEN 'BOUNDARY' THEN 0 WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,a.created_at,d.stable_seq LIMIT $3`, [now, [...channels], limit])).rows.map(row => deliverySchema.parse(row)));
    }
    async nextDeliveryAt(channels) {
        channels.forEach(channel => channelSchema.parse(channel));
        if (!channels.length)
            return null;
        return this.write(async (sql) => {
            const row = (await sql.query(`SELECT MIN(GREATEST(d.next_at,COALESCE(p.next_at,d.next_at))) AS next_at FROM watchdog_pg.deliveries d
        LEFT JOIN watchdog_pg.provider_limits p ON p.channel=d.channel WHERE d.status IN ('PENDING','FAILED','RETRY_SCHEDULED')
        AND COALESCE(p.blocked,0)=0 AND d.channel=ANY($1::text[])`, [[...channels]])).rows[0];
            return row?.next_at === null ? null : utcText(row?.next_at);
        });
    }
    async alert(id) {
        idSchema.parse(id);
        return this.write(async (sql) => {
            const row = (await sql.query("SELECT alert_json,alert_sha256 FROM watchdog_pg.alerts WHERE id=$1", [id])).rows[0];
            const result = stored(storedAlertSchema, row?.alert_json, 262_144);
            if (textHash(row.alert_json) !== row.alert_sha256 || result.id !== id)
                throw corrupt();
            return result;
        });
    }
    async startAttempt(id, now) {
        idSchema.parse(id);
        utcText(now);
        return this.write(async (sql) => {
            const row = (await sql.query(`UPDATE watchdog_pg.deliveries d SET status='IN_FLIGHT',attempts=attempts+1,
        claim_owner=$3,claim_fence=$4::bigint,claim_incarnation=$5::uuid,claim_deadline=watchdog_pg.clock_now()+interval '20 seconds'
        WHERE id=$1 AND status IN ('PENDING','FAILED','RETRY_SCHEDULED') AND next_at<=$2 AND attempts<10
        AND EXISTS(SELECT 1 FROM watchdog_pg.worker_lease WHERE id=1 AND deadline_at>watchdog_pg.clock_now()+interval '20 seconds')
        AND NOT EXISTS(SELECT 1 FROM watchdog_pg.provider_limits p WHERE p.channel=d.channel AND (p.blocked=1 OR p.next_at>$2)) RETURNING d.*`, [id, now, this.fence.owner, this.fence.fence, this.fence.incarnation])).rows[0];
            if (!row)
                throw new DataError("DELIVERY_CONFLICT", "Notification is claimed, not due, terminal, or outside its acknowledgment budget.");
            const delivery = deliverySchema.parse(row);
            await sql.query("INSERT INTO watchdog_pg.delivery_attempts(delivery_id,attempt,started_at,outcome,claim_owner,claim_fence,claim_incarnation) VALUES($1,$2,$3,'IN_FLIGHT',$4,$5,$6)", [id, delivery.attempts, now, this.fence.owner, this.fence.fence, this.fence.incarnation]);
            await this.event(sql, id, "IN_FLIGHT", now);
            return delivery;
        });
    }
    async finishAttempt(id, input, now, retryAt) {
        idSchema.parse(id);
        utcText(now);
        if (retryAt !== null)
            utcText(retryAt);
        const result = resultSchema.parse(input), status = result.delivered ? "DELIVERED" : retryAt === null ? "PERMANENTLY_FAILED" : "RETRY_SCHEDULED";
        let attempt;
        try {
            return await this.write(async (sql) => {
                const row = (await sql.query(`SELECT * FROM watchdog_pg.deliveries WHERE id=$1 AND status='IN_FLIGHT' AND claim_owner=$2
          AND claim_fence=$3::bigint AND claim_incarnation=$4::uuid AND claim_deadline>watchdog_pg.clock_now() FOR UPDATE`, [id, this.fence.owner, this.fence.fence, this.fence.incarnation])).rows[0];
                if (!row)
                    throw new DataError("DELIVERY_CONFLICT", "Notification acknowledgment is expired or superseded.");
                const delivery = deliverySchema.parse(row);
                attempt = delivery.attempts;
                const code = result.delivered ? null : result.code, ambiguous = !result.delivered && result.ambiguous ? 1 : 0;
                await sql.query("UPDATE watchdog_pg.delivery_attempts SET completed_at=$1,outcome=$2,error_code=$3,ambiguous=$4 WHERE delivery_id=$5 AND attempt=$6 AND claim_owner=$7 AND claim_fence=$8::bigint AND claim_incarnation=$9::uuid", [now, result.delivered ? "DELIVERED" : "FAILED", code, ambiguous, id, attempt, this.fence.owner, this.fence.fence, this.fence.incarnation]);
                const changed = await sql.query(`UPDATE watchdog_pg.deliveries SET status=$2,next_at=$3,last_error=$4,ambiguous=GREATEST(ambiguous,$5),
          claim_owner=NULL,claim_fence=NULL,claim_incarnation=NULL,claim_deadline=NULL WHERE id=$1 AND claim_deadline>watchdog_pg.clock_now()`, [id, status, retryAt ?? now, code, ambiguous]);
                if (changed.rowCount !== 1)
                    throw new DataError("DELIVERY_CONFLICT", "Notification acknowledgment deadline expired.");
                if (!result.delivered)
                    await this.event(sql, id, "FAILED", now);
                await this.event(sql, id, status, now);
                if (!result.delivered && result.code === "PROVIDER_RATE_LIMIT") {
                    const until = new Date(Date.parse(now) + (result.retryAfterMs ?? 0)).toISOString(), blocked = !result.retryable || result.retryAfterMs === null ? 1 : 0;
                    await sql.query("INSERT INTO watchdog_pg.provider_limits(channel,next_at,blocked) VALUES($1,$2,$3) ON CONFLICT(channel) DO UPDATE SET next_at=GREATEST(watchdog_pg.provider_limits.next_at,excluded.next_at),blocked=GREATEST(watchdog_pg.provider_limits.blocked,excluded.blocked)", [delivery.channel, until, blocked]);
                }
                return status;
            });
        }
        catch (error) {
            if (!(error instanceof DataError) || error.code !== "POSTGRES_COMMIT_UNKNOWN" || attempt === undefined)
                throw error;
            return this.write(async (sql) => {
                const row = (await sql.query(`SELECT d.status,d.attempts,a.completed_at,a.outcome FROM watchdog_pg.deliveries d
          JOIN watchdog_pg.delivery_attempts a ON a.delivery_id=d.id AND a.attempt=$2
          WHERE d.id=$1 AND a.claim_owner=$3 AND a.claim_fence=$4::bigint AND a.claim_incarnation=$5::uuid`, [id, attempt, this.fence.owner, this.fence.fence, this.fence.incarnation])).rows[0];
                if (row?.status !== status || row.attempts !== attempt || row.completed_at !== now || row.outcome !== (result.delivered ? "DELIVERED" : "FAILED"))
                    throw error;
                return status;
            });
        }
    }
    async recoverDeliveries(now, maxAttempts) {
        utcText(now);
        if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
            throw corrupt();
        let recovered = 0;
        // At most the configured global pending budget; yield/cancellation occurs on each transaction.
        for (let batch = 0; batch < 40; batch++) {
            const count = await this.write(async (sql) => {
                const rows = (await sql.query(`SELECT * FROM watchdog_pg.deliveries WHERE status='IN_FLIGHT' AND
          (claim_owner<>$1 OR claim_fence<>$2::bigint OR claim_incarnation<>$3::uuid OR claim_deadline<=watchdog_pg.clock_now()) ORDER BY stable_seq LIMIT 256 FOR UPDATE`, [this.fence.owner, this.fence.fence, this.fence.incarnation])).rows.map(row => deliverySchema.parse(row));
                for (const delivery of rows) {
                    // A stale in-flight claim has unknown provider acceptance. Terminalize it rather than replaying.
                    const status = "PERMANENTLY_FAILED";
                    await sql.query("UPDATE watchdog_pg.delivery_attempts SET completed_at=$1,outcome='FAILED',error_code='ATTEMPT_INTERRUPTED',ambiguous=1 WHERE delivery_id=$2 AND attempt=$3 AND outcome='IN_FLIGHT'", [now, delivery.id, delivery.attempts]);
                    await sql.query("UPDATE watchdog_pg.deliveries SET status=$2,next_at=$3,last_error='ATTEMPT_INTERRUPTED',ambiguous=1,claim_owner=NULL,claim_fence=NULL,claim_incarnation=NULL,claim_deadline=NULL WHERE id=$1", [delivery.id, status, now]);
                    await this.event(sql, delivery.id, "FAILED", now);
                    await this.event(sql, delivery.id, status, now);
                }
                return rows.length;
            });
            recovered += count;
            if (count < 256)
                return recovered;
        }
        throw new DataError("RESOURCE_BACKLOG_LIMIT", "Recovery exceeded its bounded outbox budget; remaining records were retained.");
    }
    async exhaust(id, now) {
        idSchema.parse(id);
        utcText(now);
        await this.write(async (sql) => {
            const change = await sql.query("UPDATE watchdog_pg.deliveries SET status='PERMANENTLY_FAILED',last_error='RETRY_EXHAUSTED' WHERE id=$1 AND status IN ('PENDING','FAILED','RETRY_SCHEDULED')", [id]);
            if (change.rowCount)
                await this.event(sql, id, "PERMANENTLY_FAILED", now);
        });
    }
    async prune(now, cycleDays, alertDays) {
        utcText(now);
        if (![cycleDays, alertDays].every(days => Number.isInteger(days) && days >= 1 && days <= 3_650) || alertDays < 7)
            throw corrupt();
        const cutoff = (days) => new Date(Date.parse(now) - days * 86_400_000).toISOString();
        await this.write(async (sql) => {
            await sql.query(`DELETE FROM watchdog_pg.alerts WHERE id IN (SELECT a.id FROM watchdog_pg.alerts a WHERE a.created_at<$1
        AND NOT EXISTS(SELECT 1 FROM watchdog_pg.deliveries d WHERE d.alert_id=a.id AND d.status NOT IN ('DELIVERED','PERMANENTLY_FAILED')) ORDER BY a.created_at,a.stable_seq LIMIT 128)`, [cutoff(alertDays)]);
            await sql.query(`DELETE FROM watchdog_pg.cycles WHERE id IN (SELECT c.id FROM watchdog_pg.cycles c WHERE c.completed_at<$1 AND c.status IN ('COMPLETED','INTERRUPTED')
        AND NOT EXISTS(SELECT 1 FROM watchdog_pg.alerts a WHERE a.cycle_id=c.id)
        AND NOT EXISTS(SELECT 1 FROM watchdog_pg.streams s WHERE s.latest_cycle=c.id OR s.last_accepted_cycle=c.id)
        AND NOT EXISTS(SELECT 1 FROM watchdog_pg.scheduled_executions e JOIN watchdog_pg.worker_lease l ON l.current_execution=e.id WHERE e.cycle_id=c.id)
        ORDER BY c.completed_at,c.stable_seq LIMIT 128)`, [cutoff(cycleDays)]);
            await sql.query(`DELETE FROM watchdog_pg.oracle_assurance WHERE id IN (SELECT a.id FROM watchdog_pg.oracle_assurance a WHERE a.evaluated_at<$1 AND a.bundle_path IS NULL
        AND EXISTS(SELECT 1 FROM watchdog_pg.oracle_assurance newer WHERE newer.context=a.context AND (newer.evaluated_at,newer.stable_seq)>(a.evaluated_at,a.stable_seq))
        ORDER BY a.evaluated_at,a.stable_seq LIMIT 128)`, [cutoff(cycleDays)]);
        });
    }
    async saveRuntime(input) {
        const runtime = runtimeSchema.parse(input), text = encoded(runtimeSchema, runtime, 32_768);
        await this.write(async (sql) => {
            await sql.query("INSERT INTO watchdog_pg.worker_runtime(id,runtime_json) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET runtime_json=excluded.runtime_json", [text]);
            if (runtime.error)
                await sql.query("INSERT INTO watchdog_pg.operational_events(occurred_at,code) VALUES($1,$2)", [utcText(runtime.updatedAt), runtime.error]);
            await sql.query("DELETE FROM watchdog_pg.operational_events WHERE id IN (SELECT id FROM watchdog_pg.operational_events ORDER BY id DESC OFFSET 100 LIMIT 128)");
        });
    }
    async requireResources(limits) {
        if (process.memoryUsage().rss >= limits.rssBytes)
            throw new DataError("RESOURCE_MEMORY_LIMIT", "Process memory budget exhausted.");
        await this.write(async (sql) => {
            const size = (await sql.query("SELECT pg_database_size(current_database())::text AS bytes,(SELECT count(*)::text FROM watchdog_pg.deliveries WHERE status NOT IN ('DELIVERED','PERMANENTLY_FAILED')) AS pending")).rows[0];
            if (BigInt(size.bytes) >= BigInt(Math.min(limits.databaseBytes, PG_LIMITS.storageStopBytes)))
                throw new DataError("RESOURCE_DATABASE_LIMIT", "PostgreSQL database storage admission limit reached.");
            if (counter(size.pending) >= Math.min(limits.pendingDeliveries, PG_LIMITS.pendingDeliveries))
                throw new DataError("RESOURCE_BACKLOG_LIMIT", "Pending notification admission limit reached.");
        });
    }
}
//# sourceMappingURL=store.js.map