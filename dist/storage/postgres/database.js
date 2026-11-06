import { z } from "zod";
import { DataError } from "../../domain/errors.js";
import { idSchema, initialState, observationSchema, stateSchema, storedAlertSchema, utcSchema } from "../../monitoring/model.js";
import { assuranceSchema, continuityScopeSchema, digestSchema } from "../../oracle-assurance/model.js";
import { runtimeSchema } from "../../operations/model.js";
import { deliverySchema } from "../store.js";
import { corrupt, counter, sequence, stored, textHash } from "./codec.js";
import { POSTGRES_CATALOG_FINGERPRINT } from "./catalog.js";
import { verifyPostgresSchema } from "./migrations.js";
export const cycleRowSchema = z.object({ id: idSchema, scope: digestSchema, started_at: utcSchema,
    status: z.enum(["RUNNING", "PERSISTED", "COMPLETED", "INTERRUPTED"]), completed_at: utcSchema.nullable() });
export async function loadState(sql, scope) {
    digestSchema.parse(scope);
    const row = (await sql.query("SELECT revision::text,state_json,state_sha256,latest_cycle,last_accepted_cycle FROM watchdog_pg.streams WHERE scope=$1", [scope])).rows[0];
    if (!row)
        return initialState();
    const state = stored(stateSchema, row.state_json);
    if (state.revision !== counter(row.revision) || textHash(row.state_json) !== row.state_sha256
        || (state.latest?.cycleId ?? null) !== row.latest_cycle || (state.lastAccepted?.cycleId ?? null) !== row.last_accepted_cycle)
        throw corrupt();
    return state;
}
export async function loadAssurance(sql, context) {
    if (context !== undefined)
        continuityScopeSchema.parse(context);
    const row = (await sql.query(`SELECT id,evaluated_at,context,result_json,result_sha256,bundle_path,manifest_sha256 FROM watchdog_pg.oracle_assurance
    ${context === undefined ? "" : "WHERE context=$1"} ORDER BY evaluated_at DESC,stable_seq DESC LIMIT 1`, context === undefined ? [] : [context])).rows[0];
    if (!row)
        return null;
    const result = stored(assuranceSchema, row.result_json, 262_144);
    if (textHash(row.result_json) !== row.result_sha256 || result.evaluatedAt !== row.evaluated_at || result.continuityScope !== row.context
        || !idSchema.safeParse(row.id).success || ((row.bundle_path === null) !== (row.manifest_sha256 === null)))
        throw corrupt();
    if (row.bundle_path !== null && (typeof row.bundle_path !== "string" || !/^evidence\/phase[45]\/[a-zA-Z0-9_-]+$/.test(row.bundle_path)
        || !digestSchema.safeParse(row.manifest_sha256).success))
        throw corrupt();
    return { id: row.id, assurance: result, bundlePath: row.bundle_path, manifestSha256: row.manifest_sha256 };
}
export async function assertFence(sql, fence, completion = false) {
    const row = (await sql.query(`SELECT l.id FROM watchdog_pg.worker_lease l JOIN watchdog_pg.database_identity d ON d.id=l.id
    WHERE l.id=1 AND l.owner=$1 AND l.fence=$2::bigint AND l.incarnation=$3::uuid AND d.incarnation=l.incarnation
      AND l.current_execution=$4 AND l.expires_at>watchdog_pg.clock_now() ${completion ? "" : "AND l.deadline_at>watchdog_pg.clock_now()"} FOR UPDATE OF l`, [fence.owner, fence.fence, fence.incarnation, fence.executionId])).rows[0];
    if (!row)
        throw new DataError("POSTGRES_FENCE_LOST", "The PostgreSQL writer lease is no longer valid.");
}
export class PostgresDatabase {
    writer;
    reader;
    namespace;
    catalogFingerprint;
    /** The optional catalog binding is dependency injection for administrator-controlled local fixtures only. */
    constructor(writer, reader, namespace, catalogFingerprint = POSTGRES_CATALOG_FINGERPRINT) {
        this.writer = writer;
        this.reader = reader;
        this.namespace = namespace;
        this.catalogFingerprint = catalogFingerprint;
        if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(namespace))
            throw new DataError("POSTGRES_CONFIG", "Invalid deployment namespace.");
    }
    verifySchema(sql) { return verifyPostgresSchema(sql, this.namespace, this.catalogFingerprint); }
    async verifyRole(sql, readOnly) {
        const role = (await sql.query(`SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,
      has_schema_privilege(current_user,'watchdog_pg','CREATE') AS schema_create FROM pg_roles WHERE rolname=current_user`)).rows[0];
        const rights = (await sql.query(`SELECT bool_or(has_table_privilege(current_user,oid,$1)
        OR ($2::boolean AND has_any_column_privilege(current_user,oid,'INSERT,UPDATE,REFERENCES'))) AS forbidden,
      bool_or(pg_has_role(current_user,relowner,'MEMBER')) AS owner FROM pg_class WHERE relnamespace='watchdog_pg'::regnamespace AND relkind IN ('r','p')`, [readOnly ? "INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER" : "TRUNCATE,REFERENCES,TRIGGER", readOnly])).rows[0];
        const objects = (await sql.query(`SELECT
      EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='watchdog_pg'::regnamespace AND pg_has_role(current_user,proowner,'MEMBER'))
      OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='watchdog_pg' AND pg_has_role(current_user,nspowner,'MEMBER'))
      OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='watchdog_pg'::regnamespace AND relkind='S'
        AND (pg_has_role(current_user,relowner,'MEMBER') OR has_sequence_privilege(current_user,oid,$1))) AS forbidden`, [readOnly ? "USAGE,UPDATE" : "UPDATE"])).rows[0];
        const control = readOnly ? false : (await sql.query(`SELECT has_table_privilege(current_user,'watchdog_pg.schema_migrations','INSERT,UPDATE,DELETE')
      OR has_table_privilege(current_user,'watchdog_pg.database_identity','INSERT,UPDATE,DELETE')
      OR has_table_privilege(current_user,'watchdog_pg.worker_lease','INSERT,DELETE')
      OR has_any_column_privilege(current_user,'watchdog_pg.schema_migrations','INSERT,UPDATE,REFERENCES')
      OR has_any_column_privilege(current_user,'watchdog_pg.database_identity','INSERT,UPDATE,REFERENCES') AS forbidden`)).rows[0]?.forbidden;
        if (!role || Object.values(role).some(Boolean) || rights?.forbidden !== false || rights.owner !== false || objects?.forbidden !== false || control !== false) {
            throw new DataError(readOnly ? "POSTGRES_READ_ROLE" : "POSTGRES_WRITE_ROLE", "A separately restricted PostgreSQL runtime role is required.");
        }
    }
    write(fence, operation, signal) {
        return this.writer.transaction(async (sql) => {
            await assertFence(sql, fence);
            const result = await operation(sql);
            await assertFence(sql, fence);
            return result;
        }, signal);
    }
    async readSnapshot(scope, page) {
        digestSchema.parse(scope);
        if (page && (!Number.isSafeInteger(page.limit) || page.limit < 1 || page.limit > 100))
            throw new DataError("READ_PAGE", "Invalid bounded history page.");
        if (page?.before !== undefined)
            sequence(page.before);
        return this.reader.transaction(async (sql) => {
            await this.verifySchema(sql);
            await this.verifyRole(sql, true);
            let budget = 1_048_576;
            const parse = (schema, text, hash) => {
                if (typeof text !== "string" || (budget -= Buffer.byteLength(text)) < 0)
                    throw new DataError("READ_LIMIT", "Stored page exceeds the read budget.");
                if (hash !== undefined && textHash(text) !== hash)
                    throw corrupt();
                return stored(schema, text);
            };
            const stateRow = (await sql.query("SELECT revision::text,state_json,state_sha256,latest_cycle,last_accepted_cycle FROM watchdog_pg.streams WHERE scope=$1", [scope])).rows[0];
            const state = stateRow ? parse(stateSchema, stateRow.state_json, stateRow.state_sha256) : initialState();
            if (stateRow && (state.revision !== counter(stateRow.revision) || (state.latest?.cycleId ?? null) !== stateRow.latest_cycle
                || (state.lastAccepted?.cycleId ?? null) !== stateRow.last_accepted_cycle))
                throw corrupt();
            const runtimeRow = (await sql.query("SELECT runtime_json FROM watchdog_pg.worker_runtime WHERE id=1")).rows[0];
            const runtime = runtimeRow ? parse(runtimeSchema, runtimeRow.runtime_json) : null;
            const alerts = [], observations = [];
            let nextCursor = null;
            if (page) {
                const selected = page.kind === "alerts"
                    ? "SELECT stable_seq,id,alert_json AS json,alert_sha256 AS hash FROM watchdog_pg.alerts WHERE scope=$1 AND ($2::bigint IS NULL OR stable_seq<$2::bigint) ORDER BY stable_seq DESC LIMIT ($3::integer+1)"
                    : "SELECT stable_seq,id,observation_json AS json,observation_sha256 AS hash FROM watchdog_pg.cycles WHERE scope=$1 AND observation_json IS NOT NULL AND ($2::bigint IS NULL OR stable_seq<$2::bigint) ORDER BY stable_seq DESC LIMIT ($3::integer+1)";
                // Bound bytes on the server before they cross the wire; the extra key never transports JSON.
                const rows = (await sql.query(`WITH page AS (${selected}) SELECT stable_seq::text,id,hash,
          CASE WHEN row_number() OVER (ORDER BY stable_seq DESC)<=$3::integer
            AND sum(octet_length(json)) OVER (ORDER BY stable_seq DESC)<=$4::integer THEN json ELSE NULL END AS json
          FROM page ORDER BY stable_seq DESC`, [scope, page.before ?? null, page.limit, budget])).rows;
                if (rows.length > page.limit)
                    nextCursor = sequence(rows[page.limit - 1].stable_seq);
                for (const row of rows.slice(0, page.limit)) {
                    sequence(row.stable_seq);
                    if (page.kind === "alerts") {
                        const alert = parse(storedAlertSchema, row.json, row.hash);
                        if (alert.id !== row.id || alert.scope !== scope)
                            throw corrupt();
                        alerts.push(alert);
                    }
                    else {
                        const observation = parse(observationSchema, row.json, row.hash);
                        if (observation.cycleId !== row.id)
                            throw corrupt();
                        observations.push(observation);
                    }
                }
            }
            const deliveries = alerts.length ? (await sql.query("SELECT id,alert_id,channel,status,attempts,next_at,last_error,ambiguous FROM watchdog_pg.deliveries WHERE alert_id=ANY($1::text[]) ORDER BY stable_seq LIMIT 301", [alerts.map(alert => alert.id)])).rows.map(row => deliverySchema.parse(row)) : [];
            if (deliveries.length > alerts.length * 3)
                throw corrupt();
            const cycle = (await sql.query("SELECT id,scope,started_at,status,completed_at FROM watchdog_pg.cycles WHERE scope=$1 ORDER BY started_at DESC,stable_seq DESC LIMIT 1", [scope])).rows[0];
            return { state, runtime: runtime?.scope === scope ? runtime : null, latestCycle: cycle ? cycleRowSchema.parse(cycle) : null, alerts, observations, deliveries, nextCursor };
        });
    }
    async close() {
        const results = await Promise.allSettled([this.writer.close(), this.reader.close()]);
        if (results.some(result => result.status === "rejected"))
            throw new DataError("POSTGRES_CLOSE", "PostgreSQL shutdown did not complete normally.");
    }
}
//# sourceMappingURL=database.js.map