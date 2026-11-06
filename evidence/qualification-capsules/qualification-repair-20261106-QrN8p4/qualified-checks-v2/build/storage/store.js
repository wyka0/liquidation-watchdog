import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { backup, DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { DataError } from "../domain/errors.js";
import { alertSchema, channelSchema, hashParts, idSchema, initialState, observationSchema, stateSchema, storedAlertSchema, utcSchema } from "../monitoring/model.js";
import { APPLICATION_ID, MIGRATIONS } from "./migrations.js";
import { assuranceSchema, continuityScopeSchema, digestSchema } from "../oracle-assurance/model.js";
import { sha256 } from "../oracle-assurance/evidence.js";
import { resourceSchema } from "../config/monitoring.js";
import { databasePath } from "./paths.js";
import { validateDatabaseSchema } from "./validation.js";
import { operationalCodeSchema, runtimeSchema } from "../operations/model.js";
export const deliverySchema = z.object({
    id: idSchema, alert_id: idSchema, channel: channelSchema,
    status: z.enum(["PENDING", "IN_FLIGHT", "DELIVERED", "FAILED", "RETRY_SCHEDULED", "PERMANENTLY_FAILED"]),
    attempts: z.number().int().nonnegative(), next_at: utcSchema,
    last_error: z.enum(["TRANSPORT_ERROR", "PROVIDER_HTTP_ERROR", "PROVIDER_REJECTED", "PROVIDER_RESPONSE_INVALID", "PROVIDER_RATE_LIMIT",
        "PROVIDER_TIMEOUT", "ATTEMPT_INTERRUPTED", "CONSOLE_ERROR", "ADAPTER_ERROR", "RETRY_EXHAUSTED"]).nullable(),
    ambiguous: z.union([z.literal(0), z.literal(1)])
});
const cycleRowSchema = z.object({
    id: idSchema, scope: z.string().regex(/^[a-f0-9]{64}$/), started_at: utcSchema,
    status: z.enum(["RUNNING", "PERSISTED", "COMPLETED", "INTERRUPTED"]), completed_at: utcSchema.nullable()
});
const providerLimitSchema = z.object({ channel: channelSchema, next_at: utcSchema, blocked: z.union([z.literal(0), z.literal(1)]) }).strict();
const corrupt = () => new DataError("STORE_CORRUPT", "Persistent monitoring data failed validation; the database was not reset or replaced.");
function parseStored(schema, text) {
    try {
        if (typeof text !== "string")
            throw new Error();
        return schema.parse(JSON.parse(text));
    }
    catch {
        throw corrupt();
    }
}
const bundlePathSchema = z.string().regex(/^evidence\/phase[45]\/[a-zA-Z0-9_-]+$/);
const deliveryStatuses = deliverySchema.shape.status.options;
const tables = ["schema_migrations", "streams", "cycles", "fingerprints", "alerts", "deliveries", "delivery_attempts", "delivery_events",
    "provider_limits", "oracle_assurance", "worker_runtime", "operational_events"];
export class MonitorStore {
    db;
    path;
    lock = null;
    owned = false;
    closed = false;
    schemaVersion;
    readOnly;
    limits;
    constructor(path, options = {}) {
        let database;
        this.readOnly = options.readOnly ?? false;
        this.limits = resourceSchema.parse(options.limits ?? {});
        try {
            this.path = databasePath(path, !this.readOnly && !options.existingOnly);
            if ((this.readOnly || options.existingOnly) && (path === ":memory:" || !existsSync(this.path)))
                throw new DataError("STORE_NOT_FOUND", "Monitoring database is unavailable; explicit initialization is required.");
            // Maintenance ownership precedes every writable open and migration. Readers never create or migrate.
            if (!this.readOnly)
                this.lockFile();
            database = new DatabaseSync(this.path, { readOnly: this.readOnly, enableForeignKeyConstraints: true, allowExtension: false, timeout: 1_000 });
            this.db = database;
            database.exec("PRAGMA trusted_schema=OFF; PRAGMA synchronous=FULL;");
            const version = validateDatabaseSchema(database, !this.readOnly && !options.existingOnly);
            if ((this.readOnly || options.existingOnly) && version !== MIGRATIONS.length && (options.existingOnly || !options.allowLegacy))
                throw new DataError("STORE_SCHEMA_VERSION", "Database requires an explicit database-init migration before operational inspection.");
            if (!this.readOnly && version < MIGRATIONS.length)
                this.transaction(() => {
                    for (let index = version; index < MIGRATIONS.length; index += 1) {
                        database.exec(MIGRATIONS[index]);
                        database.prepare("INSERT INTO schema_migrations VALUES (?,?)").run(index + 1, hashParts(MIGRATIONS[index]));
                    }
                    database.exec(`PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=${MIGRATIONS.length};`);
                });
            this.schemaVersion = this.readOnly ? version : MIGRATIONS.length;
            if (!this.readOnly) {
                database.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA wal_autocheckpoint=1000; PRAGMA journal_size_limit=16777216;");
                const mode = database.prepare("PRAGMA journal_mode").get()?.journal_mode;
                if ((this.path !== ":memory:" && mode !== "wal") || database.prepare("PRAGMA synchronous").get()?.synchronous !== 2
                    || database.prepare("PRAGMA foreign_keys").get()?.foreign_keys !== 1)
                    throw new DataError("STORE_DURABILITY", "Required SQLite durability settings were not applied.");
                const pageSize = Number(database.prepare("PRAGMA page_size").get()?.page_size), pages = Number(database.prepare("PRAGMA page_count").get()?.page_count);
                const cap = Math.max(1, Math.floor(this.limits.databaseBytes / pageSize));
                if (pages > cap)
                    throw new DataError("RESOURCE_DATABASE_LIMIT", "Database exceeds its configured byte budget; required records were retained.");
                database.exec(`PRAGMA max_page_count=${cap};`);
            }
            else
                database.exec("PRAGMA query_only=ON;");
            database.exec("PRAGMA cache_size=-8192; PRAGMA mmap_size=0;");
            validateDatabaseSchema(database);
            // Read critical restart state now, so a malformed state never silently becomes a new baseline.
            for (const row of database.prepare("SELECT revision,state_json FROM streams").iterate()) {
                const state = parseStored(stateSchema, row.state_json);
                if (state.revision !== row.revision)
                    throw corrupt();
            }
            if (this.schemaVersion >= 2)
                this.providerLimits();
            if (this.schemaVersion >= 4)
                this.latestOracleAssurance();
            if (this.schemaVersion >= 5)
                this.runtime();
        }
        catch (error) {
            try {
                database?.close();
            }
            catch { /* retain the original sanitized failure */ }
            if (error instanceof DataError)
                throw error;
            throw new DataError("STORE_OPEN_FAILED", "Cannot open or validate the monitoring database; no corruption recovery was attempted.");
        }
        finally {
            this.lock?.close();
            this.lock = null;
        }
    }
    transaction(operation) {
        let begun = false;
        try {
            this.db.exec("BEGIN IMMEDIATE");
            begun = true;
            const result = operation();
            this.db.exec("COMMIT");
            return result;
        }
        catch (error) {
            if (begun) {
                try {
                    this.db.exec("ROLLBACK");
                }
                catch { /* no reset */ }
            }
            if (error instanceof DataError)
                throw error;
            throw new DataError("STORE_TRANSACTION_FAILED", "Monitoring persistence failed; the transaction was rolled back. Stop and inspect the local store.");
        }
    }
    /** A separate SQLite OS lock permits status readers and is released by the OS on process death. */
    lockFile() {
        try {
            if (this.path !== ":memory:") {
                databasePath(this.path);
                const lockPath = `${this.path}-monitor-lock`;
                this.lock = new DatabaseSync(lockPath, { timeout: 0, allowExtension: false });
                this.lock.exec("BEGIN EXCLUSIVE");
            }
        }
        catch {
            this.lock?.close();
            this.lock = null;
            throw new DataError("MONITOR_ALREADY_RUNNING", "Cannot acquire the exclusive monitor lock; another monitor may be active.");
        }
    }
    acquireMonitor() {
        if (this.readOnly || this.closed)
            throw new DataError("STORE_READ_ONLY", "A read-only or closed store cannot acquire monitor ownership.");
        if (this.owned)
            throw new DataError("MONITOR_ALREADY_RUNNING", "This store already has an active monitor.");
        this.lockFile();
        try {
            validateDatabaseSchema(this.db);
            this.owned = true;
        }
        catch (error) {
            this.lock?.close();
            this.lock = null;
            throw error;
        }
    }
    requireWriter() {
        if (!this.owned || this.closed)
            throw new DataError("STORE_NOT_OWNED", "Acquire the monitor lock before changing monitoring state.");
    }
    close() {
        if (this.closed)
            return;
        try {
            this.db.close();
        }
        finally {
            this.lock?.close();
            this.lock = null;
            this.owned = false;
            this.closed = true;
        }
    }
    get storagePath() { return this.path; }
    state(scope) {
        const row = this.db.prepare("SELECT revision,state_json FROM streams WHERE scope=?").get(scope);
        if (!row)
            return initialState();
        const state = parseStored(stateSchema, row.state_json);
        if (state.revision !== row.revision)
            throw corrupt();
        return state;
    }
    beginCycle(id, scope, startedAt) {
        this.requireWriter();
        idSchema.parse(id);
        utcSchema.parse(startedAt);
        this.transaction(() => { this.db.prepare("INSERT INTO cycles(id,scope,started_at,status) VALUES (?,?,?,'RUNNING')").run(id, scope, startedAt); });
    }
    commitObservation(scope, observation, previousRevision, state, candidates, channels) {
        this.requireWriter();
        const current = observationSchema.parse(observation), next = stateSchema.parse(state);
        const alerts = candidates.map(alert => alertSchema.parse(alert));
        channels.forEach(channel => channelSchema.parse(channel));
        if (next.revision !== previousRevision + 1 || JSON.stringify(next.latest) !== JSON.stringify(current)
            || alerts.some(alert => alert.cycleId !== current.cycleId || alert.scope !== scope))
            throw corrupt();
        return this.transaction(() => {
            const previous = this.state(scope);
            if (previous.revision !== previousRevision)
                throw new DataError("STORE_REVISION_CONFLICT", "Monitoring state changed before this cycle could commit.");
            if (!current.accepted && JSON.stringify(next.lastAccepted) !== JSON.stringify(previous.lastAccepted))
                throw corrupt();
            const r = current.risk;
            const updated = this.db.prepare(`UPDATE cycles SET observed_at=?,status='PERSISTED',accepted=?,observation_json=?,
        block_number=?,block_hash=?,snapshot_id=?,math_state=?,data_quality=?,oracle_quality=?,safety_ratio=?,ltv=?
        WHERE id=? AND scope=? AND status='RUNNING'`).run(current.observedAt, current.accepted ? 1 : 0, JSON.stringify(current), r.blockNumber, r.blockHash, r.snapshotIdentifier, r.mathematicalRiskState, r.dataQuality, r.oracleQuality, r.safetyRatio, r.ltv, current.cycleId, scope);
            if (updated.changes !== 1)
                throw new DataError("STORE_CYCLE_CONFLICT", "Cycle was already committed or does not match its monitoring stream.");
            this.db.prepare("INSERT INTO streams VALUES (?,?,?) ON CONFLICT(scope) DO UPDATE SET revision=excluded.revision,state_json=excluded.state_json")
                .run(scope, next.revision, JSON.stringify(next));
            if (current.assurance)
                this.insertOracleAssurance(`oracle_${current.cycleId}`, current.assurance);
            const created = [];
            for (const alert of alerts) {
                const inserted = this.db.prepare("INSERT INTO fingerprints VALUES (?,?) ON CONFLICT(fingerprint) DO NOTHING").run(alert.fingerprint, alert.createdAt);
                if (!inserted.changes)
                    continue;
                if (this.pendingCount() + new Set(channels).size > this.limits.pendingDeliveries) {
                    throw new DataError("RESOURCE_BACKLOG_LIMIT", "Outbox budget exceeded; observation, alerts and delivery creation were rolled back together.");
                }
                this.db.prepare("INSERT INTO alerts VALUES (?,?,?,?,?,?,?,?)").run(alert.id, alert.fingerprint, alert.cycleId, scope, alert.createdAt, alert.severity, alert.category, JSON.stringify(alert));
                for (const channel of new Set(channels)) {
                    const id = `delivery_${hashParts([alert.id, channel])}`;
                    this.db.prepare("INSERT INTO deliveries(id,alert_id,channel,status,next_at) VALUES (?,?,?,'PENDING',?)").run(id, alert.id, channel, alert.createdAt);
                    this.event(id, "PENDING", alert.createdAt);
                }
                created.push(alert);
            }
            return created;
        });
    }
    finishCycle(id, completedAt, interrupted = false) {
        this.requireWriter();
        utcSchema.parse(completedAt);
        this.transaction(() => {
            const row = this.db.prepare("SELECT started_at FROM cycles WHERE id=?").get(id);
            if (typeof row?.started_at !== "string")
                throw corrupt();
            this.db.prepare("UPDATE cycles SET completed_at=?,duration_ms=?,status=? WHERE id=? AND status IN ('RUNNING','PERSISTED')")
                .run(completedAt, Math.max(0, Date.parse(completedAt) - Date.parse(row.started_at)), interrupted ? "INTERRUPTED" : "COMPLETED", id);
        });
    }
    insertOracleAssurance(id, input, bundle) {
        idSchema.parse(id);
        const result = assuranceSchema.parse(input), text = JSON.stringify(result);
        const prior = this.latestOracleAssurance(result.continuityScope)?.assurance;
        if (prior && result.evaluatedAt < prior.evaluatedAt)
            throw corrupt();
        if (prior?.evidenceInvalidated && !result.evidenceInvalidated)
            throw corrupt();
        if (prior?.baseline && !result.baseline)
            throw corrupt();
        if (prior?.baseline && result.baseline && (BigInt(result.baseline.block.number) < BigInt(prior.baseline.block.number)
            || (result.baseline.block.number === prior.baseline.block.number && result.baseline.block.hash !== prior.baseline.block.hash)))
            throw corrupt();
        if (bundle) {
            digestSchema.parse(bundle.manifestSha256);
            if (!bundlePathSchema.safeParse(bundle.path).success)
                throw new DataError("EVIDENCE_PATH", "Persisted oracle bundles must be validated Phase 4 or Phase 5 paths.");
        }
        this.db.prepare("INSERT INTO oracle_assurance VALUES (?,?,?,?,?,?,?)").run(id, result.evaluatedAt, result.continuityScope, text, sha256(text), bundle?.path ?? null, bundle?.manifestSha256 ?? null);
    }
    saveOracleAssurance(id, result, bundle) {
        this.requireWriter();
        this.transaction(() => { this.insertOracleAssurance(id, result, bundle); });
    }
    latestOracleAssurance(context) {
        if (context !== undefined)
            continuityScopeSchema.parse(context);
        const row = context === undefined ? this.db.prepare("SELECT * FROM oracle_assurance ORDER BY evaluated_at DESC,rowid DESC LIMIT 1").get()
            : this.db.prepare("SELECT * FROM oracle_assurance WHERE context=? ORDER BY evaluated_at DESC,rowid DESC LIMIT 1").get(context);
        if (!row)
            return null;
        const result = parseStored(assuranceSchema, row.result_json);
        if (typeof row.result_json !== "string" || sha256(row.result_json) !== row.result_sha256 || result.evaluatedAt !== row.evaluated_at || result.continuityScope !== row.context
            || !idSchema.safeParse(row.id).success || ((row.bundle_path === null) !== (row.manifest_sha256 === null)))
            throw corrupt();
        if (row.bundle_path !== null && (!bundlePathSchema.safeParse(row.bundle_path).success || !digestSchema.safeParse(row.manifest_sha256).success))
            throw corrupt();
        return { id: row.id, assurance: result, bundlePath: row.bundle_path, manifestSha256: row.manifest_sha256 };
    }
    unfinishedCycles(scope) {
        return this.db.prepare("SELECT id,scope,started_at,status,completed_at FROM cycles WHERE scope=? AND status IN ('RUNNING','PERSISTED') ORDER BY started_at,id LIMIT 256").all(scope)
            .map(row => { const parsed = cycleRowSchema.safeParse(row); if (!parsed.success)
            throw corrupt(); return parsed.data; });
    }
    latestCycle(scope, acceptedOnly = false) {
        const row = this.db.prepare(`SELECT * FROM cycles WHERE scope=? ${acceptedOnly ? "AND accepted=1" : ""} ORDER BY started_at DESC,rowid DESC LIMIT 1`).get(scope);
        if (!row)
            return null;
        const parsed = cycleRowSchema.safeParse(row);
        if (!parsed.success)
            throw corrupt();
        return parsed.data;
    }
    alerts(limit = 20, scope) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 1_000)
            throw new DataError("ALERT_LIMIT", "Alert limit must be an integer from 1 to 1000.");
        if (scope !== undefined)
            digestSchema.parse(scope);
        return this.db.prepare(`SELECT alert_json FROM alerts ${scope === undefined ? "" : "WHERE scope=?"} ORDER BY created_at DESC,rowid DESC LIMIT ?`)
            .all(...(scope === undefined ? [limit] : [scope, limit])).map(row => parseStored(storedAlertSchema, row.alert_json));
    }
    alert(id) {
        return parseStored(storedAlertSchema, this.db.prepare("SELECT alert_json FROM alerts WHERE id=?").get(id)?.alert_json);
    }
    deliveries() {
        return this.db.prepare("SELECT * FROM deliveries ORDER BY rowid").all().map(row => {
            const parsed = deliverySchema.safeParse(row);
            if (!parsed.success)
                throw corrupt();
            return parsed.data;
        });
    }
    deliveriesForAlerts(ids) {
        if (!ids.length)
            return [];
        if (ids.length > 1_000)
            throw new DataError("ALERT_LIMIT", "At most 1000 alerts can be inspected at once.");
        ids.forEach(id => idSchema.parse(id));
        return this.db.prepare(`SELECT * FROM deliveries WHERE alert_id IN (${ids.map(() => "?").join(",")}) ORDER BY rowid`).all(...ids).map(row => deliverySchema.parse(row));
    }
    deliveryCounts() {
        const counts = Object.fromEntries(deliveryStatuses.map(status => [status, 0]));
        for (const row of this.db.prepare("SELECT status,COUNT(*) AS count FROM deliveries GROUP BY status").all()) {
            counts[deliverySchema.shape.status.parse(row.status)] = z.number().int().nonnegative().parse(row.count);
        }
        return counts;
    }
    pendingCount() {
        return Number(this.db.prepare("SELECT COUNT(*) AS count FROM deliveries WHERE status NOT IN ('DELIVERED','PERMANENTLY_FAILED')").get()?.count);
    }
    providerLimits() {
        if (this.schemaVersion < 2)
            return [];
        return this.db.prepare(`SELECT channel,next_at,${this.schemaVersion < 3 ? "0 AS blocked" : "blocked"} FROM provider_limits ORDER BY channel`).all().map(row => {
            const parsed = providerLimitSchema.safeParse(row);
            if (!parsed.success)
                throw corrupt();
            return parsed.data;
        });
    }
    due(now, channels, limit = 50) {
        utcSchema.parse(now);
        if (!channels.length)
            return [];
        return this.db.prepare(`SELECT d.* FROM deliveries d JOIN alerts a ON a.id=d.alert_id
      LEFT JOIN provider_limits p ON p.channel=d.channel
      WHERE d.status IN ('PENDING','FAILED','RETRY_SCHEDULED') AND d.next_at<=?
      AND COALESCE(p.blocked,0)=0 AND (p.next_at IS NULL OR p.next_at<=?) AND d.channel IN (${channels.map(() => "?").join(",")})
      ORDER BY CASE a.severity WHEN 'BOUNDARY' THEN 0 WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END, a.created_at,d.rowid LIMIT ?`)
            .all(now, now, ...channels, limit).map(row => deliverySchema.parse(row));
    }
    nextDeliveryAt(channels) {
        if (!channels.length)
            return null;
        const row = this.db.prepare(`SELECT MIN(MAX(d.next_at,COALESCE(p.next_at,d.next_at))) AS next_at FROM deliveries d
      LEFT JOIN provider_limits p ON p.channel=d.channel WHERE d.status IN ('PENDING','FAILED','RETRY_SCHEDULED')
      AND COALESCE(p.blocked,0)=0 AND d.channel IN (${channels.map(() => "?").join(",")})`).get(...channels);
        if (row?.next_at === null)
            return null;
        return utcSchema.parse(row?.next_at);
    }
    event(id, status, now) {
        this.db.prepare("INSERT INTO delivery_events(delivery_id,occurred_at,status) VALUES (?,?,?)").run(id, now, status);
    }
    startAttempt(id, now) {
        this.requireWriter();
        utcSchema.parse(now);
        return this.transaction(() => {
            const change = this.db.prepare("UPDATE deliveries SET status='IN_FLIGHT',attempts=attempts+1 WHERE id=? AND status IN ('PENDING','FAILED','RETRY_SCHEDULED')").run(id);
            if (change.changes !== 1)
                throw new DataError("DELIVERY_CONFLICT", "Notification is already claimed or terminal.");
            const delivery = deliverySchema.parse(this.db.prepare("SELECT * FROM deliveries WHERE id=?").get(id));
            this.db.prepare("INSERT INTO delivery_attempts(delivery_id,attempt,started_at,outcome) VALUES (?,?,?,'IN_FLIGHT')").run(id, delivery.attempts, now);
            this.event(id, "IN_FLIGHT", now);
            return delivery;
        });
    }
    finishAttempt(id, result, now, retryAt) {
        this.requireWriter();
        utcSchema.parse(now);
        if (retryAt !== null)
            utcSchema.parse(retryAt);
        return this.transaction(() => {
            const delivery = deliverySchema.parse(this.db.prepare("SELECT * FROM deliveries WHERE id=?").get(id));
            if (delivery.status !== "IN_FLIGHT")
                throw new DataError("DELIVERY_CONFLICT", "Notification attempt is not in flight.");
            const status = result.delivered ? "DELIVERED" : retryAt === null ? "PERMANENTLY_FAILED" : "RETRY_SCHEDULED";
            const code = result.delivered ? null : result.code, ambiguous = !result.delivered && result.ambiguous ? 1 : 0;
            this.db.prepare("UPDATE delivery_attempts SET completed_at=?,outcome=?,error_code=?,ambiguous=? WHERE delivery_id=? AND attempt=?")
                .run(now, result.delivered ? "DELIVERED" : "FAILED", code, ambiguous, id, delivery.attempts);
            this.db.prepare("UPDATE deliveries SET status=?,next_at=?,last_error=?,ambiguous=MAX(ambiguous,?) WHERE id=?")
                .run(status, retryAt ?? now, code, ambiguous, id);
            if (!result.delivered)
                this.event(id, "FAILED", now);
            this.event(id, status, now);
            if (!result.delivered && result.code === "PROVIDER_RATE_LIMIT") {
                const until = new Date(Date.parse(now) + (result.retryAfterMs ?? 0)).toISOString();
                // An excessive/unrepresentable delay blocks the provider instead of shortening its restriction.
                const blocked = !result.retryable || result.retryAfterMs === null ? 1 : 0;
                this.db.prepare(`INSERT INTO provider_limits(channel,next_at,blocked) VALUES (?,?,?) ON CONFLICT(channel)
          DO UPDATE SET next_at=MAX(next_at,excluded.next_at),blocked=MAX(blocked,excluded.blocked)`).run(delivery.channel, until, blocked);
            }
            return status;
        });
    }
    recoverDeliveries(now, maxAttempts) {
        this.requireWriter();
        utcSchema.parse(now);
        if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
            throw corrupt();
        return this.transaction(() => {
            let recovered = 0;
            for (;;) {
                const rows = this.db.prepare("SELECT * FROM deliveries WHERE status='IN_FLIGHT' LIMIT 256").all().map(row => deliverySchema.parse(row));
                if (!rows.length)
                    break;
                for (const row of rows) {
                    // A process interruption may occur after provider acceptance. Preserve it as terminal unknown;
                    // never replay automatically and create a duplicate alert.
                    const status = "PERMANENTLY_FAILED";
                    this.db.prepare("UPDATE delivery_attempts SET completed_at=?,outcome='FAILED',error_code='ATTEMPT_INTERRUPTED',ambiguous=1 WHERE delivery_id=? AND attempt=?")
                        .run(now, row.id, row.attempts);
                    this.db.prepare("UPDATE deliveries SET status=?,next_at=?,last_error='ATTEMPT_INTERRUPTED',ambiguous=1 WHERE id=?")
                        .run(status, now, row.id);
                    this.event(row.id, "FAILED", now);
                    this.event(row.id, status, now);
                }
                recovered += rows.length;
            }
            return recovered;
        });
    }
    exhaust(id, now) {
        this.requireWriter();
        this.transaction(() => {
            this.db.prepare("UPDATE deliveries SET status='PERMANENTLY_FAILED',last_error='RETRY_EXHAUSTED' WHERE id=? AND status IN ('PENDING','FAILED','RETRY_SCHEDULED')").run(id);
            this.event(id, "PERMANENTLY_FAILED", now);
        });
    }
    attempts(id) {
        return this.db.prepare("SELECT attempt,started_at,completed_at,outcome,error_code,ambiguous FROM delivery_attempts WHERE delivery_id=? ORDER BY attempt").all(id);
    }
    prune(now, cycleDays, alertDays) {
        this.requireWriter();
        utcSchema.parse(now);
        const cutoff = (days) => new Date(Date.parse(now) - days * 86_400_000).toISOString();
        this.transaction(() => {
            this.db.prepare(`DELETE FROM alerts WHERE created_at<? AND NOT EXISTS
        (SELECT 1 FROM deliveries WHERE alert_id=alerts.id AND status NOT IN ('DELIVERED','PERMANENTLY_FAILED'))`).run(cutoff(alertDays));
            this.db.prepare(`DELETE FROM cycles WHERE completed_at<? AND status IN ('COMPLETED','INTERRUPTED')
        AND NOT EXISTS (SELECT 1 FROM alerts WHERE cycle_id=cycles.id)
        AND NOT EXISTS (SELECT 1 FROM streams WHERE json_extract(state_json,'$.latest.cycleId')=cycles.id
           OR json_extract(state_json,'$.lastAccepted.cycleId')=cycles.id)`).run(cutoff(cycleDays));
            this.db.prepare(`DELETE FROM oracle_assurance WHERE evaluated_at<? AND bundle_path IS NULL
        AND rowid NOT IN (SELECT rowid FROM (SELECT rowid,ROW_NUMBER() OVER(PARTITION BY context ORDER BY evaluated_at DESC,rowid DESC) AS priority
          FROM oracle_assurance) WHERE priority=1)`).run(cutoff(cycleDays));
        });
    }
    summary(scope) {
        return { schemaVersion: this.schemaVersion, latestCycle: this.latestCycle(scope), lastAcceptedCycle: this.latestCycle(scope, true),
            state: this.state(scope), providerLimits: this.providerLimits(), deliveryCounts: this.deliveryCounts() };
    }
    /** One short, read-only snapshot for the HTTP read model. No arbitrary SQL or write callback. */
    readSnapshot(scope, page) {
        if (!this.readOnly || this.closed)
            throw new DataError("STORE_READ_ONLY", "HTTP snapshots require an open read-only connection.");
        digestSchema.parse(scope);
        if (page && (!Number.isSafeInteger(page.limit) || page.limit < 1 || page.limit > 100
            || (page.before !== undefined && (!Number.isSafeInteger(page.before) || page.before < 1)))) {
            throw new DataError("READ_PAGE", "Invalid bounded history page.");
        }
        let budget = 1_048_576;
        const parse = (schema, text) => {
            if (typeof text !== "string" || (budget -= Buffer.byteLength(text)) < 0)
                throw new DataError("READ_LIMIT", "Stored page exceeds the read budget.");
            return parseStored(schema, text);
        };
        this.db.exec("PRAGMA busy_timeout=50; BEGIN");
        try {
            // CASE prevents oversized persisted JSON from being copied into JS. Never silently omit it.
            const stateRow = this.db.prepare("SELECT revision,CASE WHEN length(CAST(state_json AS BLOB))<=1048576 THEN state_json END AS json FROM streams WHERE scope=?").get(scope);
            const state = stateRow ? parse(stateSchema, stateRow.json) : initialState();
            if (stateRow && state.revision !== stateRow.revision)
                throw corrupt();
            const runtimeRow = this.db.prepare("SELECT CASE WHEN length(CAST(runtime_json AS BLOB))<=32768 THEN runtime_json END AS json FROM worker_runtime WHERE id=1").get();
            const runtime = runtimeRow ? parse(runtimeSchema, runtimeRow.json) : null;
            const alerts = [], observations = [];
            let nextCursor = null;
            if (page) {
                const sql = page.kind === "alerts"
                    ? "SELECT rowid,id,CASE WHEN length(CAST(alert_json AS BLOB))<=262144 THEN alert_json END AS json FROM alerts NOT INDEXED WHERE scope=? AND rowid<? ORDER BY rowid DESC LIMIT ?"
                    : "SELECT rowid,id,CASE WHEN length(CAST(observation_json AS BLOB))<=262144 THEN observation_json END AS json FROM cycles NOT INDEXED WHERE scope=? AND observation_json IS NOT NULL AND rowid<? ORDER BY rowid DESC LIMIT ?";
                let count = 0, lastRow = 0;
                for (const row of this.db.prepare(sql).iterate(scope, page.before ?? Number.MAX_SAFE_INTEGER, page.limit + 1)) {
                    if (count++ === page.limit) {
                        nextCursor = String(lastRow);
                        break;
                    }
                    if (typeof row.rowid !== "number" || !Number.isSafeInteger(row.rowid) || row.rowid < 1)
                        throw corrupt();
                    lastRow = row.rowid;
                    if (page.kind === "alerts") {
                        const alert = parse(storedAlertSchema, row.json);
                        if (alert.id !== row.id || alert.scope !== scope)
                            throw corrupt();
                        alerts.push(alert);
                    }
                    else {
                        const observation = parse(observationSchema, row.json);
                        if (observation.cycleId !== row.id)
                            throw corrupt();
                        observations.push(observation);
                    }
                }
            }
            const ids = alerts.map(alert => alert.id);
            const deliveries = ids.length ? this.db.prepare(`SELECT * FROM deliveries WHERE alert_id IN (${ids.map(() => "?").join(",")}) ORDER BY rowid LIMIT 301`)
                .all(...ids).map(row => deliverySchema.parse(row)) : [];
            if (deliveries.length > ids.length * 3)
                throw corrupt();
            const cycle = this.db.prepare("SELECT id,scope,started_at,status,completed_at FROM cycles WHERE scope=? ORDER BY started_at DESC,rowid DESC LIMIT 1").get(scope);
            const latestCycle = cycle ? cycleRowSchema.parse(cycle) : null;
            return { state, runtime: runtime?.scope === scope ? runtime : null, latestCycle, alerts, observations, deliveries, nextCursor };
        }
        finally {
            this.db.exec("ROLLBACK");
        }
    }
    runtime() {
        if (this.schemaVersion < 5)
            return null;
        const row = this.db.prepare("SELECT runtime_json FROM worker_runtime WHERE id=1").get();
        return row ? parseStored(runtimeSchema, row.runtime_json) : null;
    }
    saveRuntime(input) {
        this.requireWriter();
        const runtime = runtimeSchema.parse(input);
        this.transaction(() => {
            this.db.prepare("INSERT INTO worker_runtime VALUES(1,?) ON CONFLICT(id) DO UPDATE SET runtime_json=excluded.runtime_json").run(JSON.stringify(runtime));
            if (runtime.error)
                this.db.prepare("INSERT INTO operational_events(occurred_at,code) VALUES(?,?)").run(runtime.updatedAt, runtime.error);
            this.db.exec("DELETE FROM operational_events WHERE id NOT IN (SELECT id FROM operational_events ORDER BY id DESC LIMIT 100)");
        });
    }
    recentFailures() {
        if (this.schemaVersion < 5)
            return [];
        return this.db.prepare("SELECT occurred_at,code FROM operational_events ORDER BY id DESC LIMIT 20").all()
            .map(row => z.object({ occurred_at: utcSchema, code: operationalCodeSchema }).strict().parse(row));
    }
    ownership() {
        if (this.owned)
            return "HELD";
        if (this.path === ":memory:" || !existsSync(`${this.path}-monitor-lock`))
            return "AVAILABLE";
        let probe;
        try {
            databasePath(this.path);
            probe = new DatabaseSync(`${this.path}-monitor-lock`, { readOnly: true, timeout: 0, allowExtension: false });
            probe.exec("BEGIN EXCLUSIVE; ROLLBACK;");
            return "AVAILABLE";
        }
        catch (error) {
            return error instanceof Error && "errcode" in error && error.errcode === 5 ? "HELD" : "UNKNOWN";
        }
        finally {
            probe?.close();
        }
    }
    statistics() {
        const value = (name) => Number(this.db.prepare(`PRAGMA ${name}`).get()?.[name]);
        return { schemaVersion: this.schemaVersion, sqliteVersion: String(this.db.prepare("SELECT sqlite_version() AS version").get()?.version),
            pageSize: value("page_size"), pageCount: value("page_count"), freePages: value("freelist_count"),
            journalMode: String(this.db.prepare("PRAGMA journal_mode").get()?.journal_mode), foreignKeys: value("foreign_keys") === 1,
            connectionReadOnly: this.readOnly, connectionSynchronous: value("synchronous"), pendingDeliveries: this.pendingCount(),
            counts: Object.fromEntries(this.presentTables().map(table => [table, Number(this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count)])) };
    }
    presentTables() {
        return tables.filter(table => Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)));
    }
    evidenceBundles() {
        if (this.schemaVersion < 4)
            return [];
        const rows = this.db.prepare("SELECT DISTINCT bundle_path,manifest_sha256 FROM oracle_assurance WHERE bundle_path IS NOT NULL ORDER BY bundle_path LIMIT 1001").all();
        if (rows.length > 1_000)
            throw new DataError("BACKUP_EVIDENCE", "Required evidence exceeds the bounded backup inventory.");
        return rows.map(row => ({ path: bundlePathSchema.parse(row.bundle_path), manifestSha256: digestSchema.parse(row.manifest_sha256) }));
    }
    localEvidenceReferences() {
        const references = new Map();
        if (this.schemaVersion >= 4)
            for (const row of this.db.prepare("SELECT result_json FROM oracle_assurance").iterate()) {
                const assurance = parseStored(assuranceSchema, row.result_json);
                const refs = [...assurance.findings.flatMap(finding => finding.evidence), ...assurance.freshness.evidence, ...assurance.independent.evidence];
                for (const ref of refs)
                    if (ref.source.startsWith("evidence/")) {
                        if (!/^evidence\/phase[1-5]\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(ref.source)
                            || ref.source.includes("..") || !ref.artifactSha256 || (references.has(ref.source) && references.get(ref.source) !== ref.artifactSha256))
                            throw corrupt();
                        references.set(ref.source, ref.artifactSha256);
                        if (references.size > 1_000)
                            throw new DataError("BACKUP_EVIDENCE", "Local evidence reference budget exceeded.");
                    }
            }
        return [...references].sort(([a], [b]) => a.localeCompare(b)).map(([path, sha256]) => ({ path, sha256 }));
    }
    knownDeliveredHash() {
        const hash = createHash("sha256");
        for (const row of this.db.prepare("SELECT * FROM deliveries WHERE status='DELIVERED' ORDER BY id").iterate())
            hash.update(JSON.stringify(row) + "\n");
        return hash.digest("hex");
    }
    /** Incremental hashes avoid loading the outbox/history into JS memory. SQL order is deterministic. */
    contentHashes() {
        return Object.fromEntries(this.presentTables().map(table => {
            const hash = createHash("sha256");
            const order = table === "delivery_attempts" ? "delivery_id,attempt" : table === "streams" ? "scope"
                : table === "fingerprints" ? "fingerprint" : table === "provider_limits" ? "channel" : table === "schema_migrations" ? "version" : "id";
            for (const row of this.db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).iterate())
                hash.update(JSON.stringify(row) + "\n");
            return [table, hash.digest("hex")];
        }));
    }
    validateAll() {
        try {
            validateDatabaseSchema(this.db, false, true);
            for (const row of this.db.prepare("SELECT scope FROM streams").iterate())
                this.state(String(row.scope));
            for (const row of this.db.prepare("SELECT * FROM cycles").iterate()) {
                cycleRowSchema.parse(row);
                if (row.observation_json !== null)
                    parseStored(observationSchema, row.observation_json);
            }
            for (const row of this.db.prepare("SELECT * FROM alerts").iterate()) {
                const alert = parseStored(storedAlertSchema, row.alert_json);
                if (alert.id !== row.id || alert.fingerprint !== row.fingerprint || alert.cycleId !== row.cycle_id || alert.scope !== row.scope
                    || alert.createdAt !== row.created_at || alert.severity !== row.severity || alert.category !== row.category)
                    throw corrupt();
            }
            for (const row of this.db.prepare("SELECT * FROM deliveries").iterate())
                deliverySchema.parse(row);
            for (const row of this.db.prepare("SELECT * FROM delivery_attempts").iterate())
                z.object({
                    delivery_id: idSchema, attempt: z.number().int().positive(), started_at: utcSchema, completed_at: utcSchema.nullable(),
                    outcome: z.enum(["IN_FLIGHT", "DELIVERED", "FAILED"]), error_code: deliverySchema.shape.last_error, ambiguous: z.union([z.literal(0), z.literal(1)])
                }).strict().parse(row);
            for (const row of this.db.prepare("SELECT * FROM delivery_events").iterate())
                z.object({
                    id: z.number().int().positive(), delivery_id: idSchema, occurred_at: utcSchema, status: deliverySchema.shape.status
                }).strict().parse(row);
            if (this.db.prepare(`SELECT 1 FROM deliveries d WHERE d.attempts<>(SELECT COUNT(*) FROM delivery_attempts a WHERE a.delivery_id=d.id)
        OR d.attempts<>COALESCE((SELECT MAX(attempt) FROM delivery_attempts a WHERE a.delivery_id=d.id),0)
        OR (d.status IN ('IN_FLIGHT','DELIVERED') AND NOT EXISTS (SELECT 1 FROM delivery_attempts a
          WHERE a.delivery_id=d.id AND a.attempt=d.attempts AND a.outcome=d.status)) LIMIT 1`).get())
                throw corrupt();
            if (this.db.prepare(`SELECT 1 FROM delivery_attempts a JOIN deliveries d ON d.id=a.delivery_id WHERE
        (a.outcome='IN_FLIGHT' AND (a.completed_at IS NOT NULL OR d.status<>'IN_FLIGHT' OR a.attempt<>d.attempts))
        OR (a.outcome<>'IN_FLIGHT' AND a.completed_at IS NULL) LIMIT 1`).get())
                throw corrupt();
            for (const row of this.db.prepare("SELECT fingerprint,created_at FROM fingerprints").iterate())
                z.object({ fingerprint: digestSchema, created_at: utcSchema }).parse(row);
            if (this.schemaVersion >= 4)
                for (const row of this.db.prepare("SELECT * FROM oracle_assurance").iterate()) {
                    idSchema.parse(row.id);
                    const assurance = parseStored(assuranceSchema, row.result_json);
                    if (sha256(String(row.result_json)) !== row.result_sha256 || assurance.continuityScope !== row.context || assurance.evaluatedAt !== row.evaluated_at
                        || ((row.bundle_path === null) !== (row.manifest_sha256 === null)))
                        throw corrupt();
                    if (row.bundle_path !== null) {
                        bundlePathSchema.parse(row.bundle_path);
                        digestSchema.parse(row.manifest_sha256);
                    }
                }
            this.evidenceBundles();
            this.localEvidenceReferences();
            this.recentFailures();
            this.providerLimits();
            this.runtime();
        }
        catch {
            throw corrupt();
        }
    }
    async backupTo(path) {
        const destination = databasePath(path);
        if (destination === this.path || existsSync(destination))
            throw new DataError("BACKUP_EXISTS", "Backup destination must be a new file distinct from the source database.");
        const deadline = Date.now() + 120_000;
        try {
            return await backup(this.db, destination, { rate: 256, progress: () => {
                    if (Date.now() >= deadline)
                        throw new DataError("BACKUP_TIMEOUT", "Backup exceeded its two-minute progress budget; the incomplete artifact is unusable.");
                } });
        }
        catch {
            throw new DataError("BACKUP_FAILED", "Consistent SQLite backup failed; the source database was not replaced.");
        }
    }
}
//# sourceMappingURL=store.js.map