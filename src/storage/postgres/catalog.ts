import type { Sql } from "./connection.js";

/** PostgreSQL 17 catalog after the reviewed migration lineage; captured on native 17.11. */
export const POSTGRES_CATALOG_FINGERPRINT = "24b4fea1efeab7c49999dd693f59ddc9aa776bcb4d4e262185978c9630c80ba3";

/** Stable structural inventory: no OIDs, owners, grants, sequence values or user data. */
export const CATALOG_RECORDS_SQL = `
SELECT record FROM (
  SELECT json_build_array('relation',c.relname,c.relkind,c.relpersistence,c.relrowsecurity,c.relforcerowsecurity,c.relispartition,c.reloptions)::text AS record
    FROM pg_class c WHERE c.relnamespace='watchdog_pg'::regnamespace AND c.relkind IN ('r','p','S','v','m','f')
  UNION ALL SELECT json_build_array('column',c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,
    a.attidentity,a.attgenerated,coll.collname,pg_get_expr(d.adbin,d.adrelid))::text
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    LEFT JOIN pg_collation coll ON coll.oid=a.attcollation
    WHERE c.relnamespace='watchdog_pg'::regnamespace AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL SELECT json_build_array('constraint',conname,COALESCE(c.relname,t.typname),convalidated,pg_get_constraintdef(co.oid,true))::text
    FROM pg_constraint co LEFT JOIN pg_class c ON c.oid=co.conrelid LEFT JOIN pg_type t ON t.oid=co.contypid
    WHERE co.connamespace='watchdog_pg'::regnamespace
  UNION ALL SELECT json_build_array('index',c.relname,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid))::text
    FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='watchdog_pg'::regnamespace
  UNION ALL SELECT json_build_array('domain',t.typname,format_type(t.typbasetype,t.typtypmod),t.typnotnull,coll.collname,t.typdefault)::text
    FROM pg_type t LEFT JOIN pg_collation coll ON coll.oid=t.typcollation WHERE t.typnamespace='watchdog_pg'::regnamespace AND t.typtype='d'
  UNION ALL SELECT json_build_array('function',p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),p.provolatile,pg_get_functiondef(p.oid))::text
    FROM pg_proc p WHERE p.pronamespace='watchdog_pg'::regnamespace
  UNION ALL SELECT json_build_array('sequence',c.relname,format_type(s.seqtypid,NULL),s.seqstart::text,s.seqincrement::text,s.seqmin::text,s.seqmax::text,s.seqcache::text,s.seqcycle)::text
    FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid WHERE c.relnamespace='watchdog_pg'::regnamespace
  UNION ALL SELECT json_build_array('trigger',c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true))::text
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='watchdog_pg'::regnamespace AND NOT t.tgisinternal
  UNION ALL SELECT json_build_array('rule',c.relname,r.rulename,pg_get_ruledef(r.oid,true))::text
    FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class WHERE c.relnamespace='watchdog_pg'::regnamespace
) records ORDER BY record COLLATE "C" LIMIT 1025`;

/** Compute server-side so a bounded read does not transport the entire catalog each time. */
export async function postgresCatalogFingerprint(sql: Sql): Promise<string | null> {
  const row = (await sql.query(`SELECT CASE WHEN count(*)<=1024 AND sum(octet_length(record))<=262144
    THEN encode(sha256(convert_to(string_agg(record,E'\\n' ORDER BY record COLLATE "C"),'UTF8')),'hex') ELSE NULL END AS hash
    FROM (${CATALOG_RECORDS_SQL}) inventory`)).rows[0];
  return typeof row?.hash === "string" ? row.hash : null;
}
