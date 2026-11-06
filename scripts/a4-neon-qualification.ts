import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { Client } from "pg";
import type { PoolConfig, QueryResult, QueryResultRow } from "pg";
import { z } from "zod";
import { connectionConfiguration, PG_LIMITS } from "../src/config/postgres.js";
import { DataError } from "../src/domain/errors.js";
import { POSTGRES_CATALOG_FINGERPRINT, postgresCatalogFingerprint } from "../src/storage/postgres/catalog.js";
import type { Sql } from "../src/storage/postgres/connection.js";
import { PgConnection } from "../src/storage/postgres/connection.js";
import { textHash } from "../src/storage/postgres/codec.js";
import { applyPostgresMigrations, POSTGRES_MIGRATIONS, verifyPostgresSchema } from "../src/storage/postgres/migrations.js";

export const A4_TARGET = Object.freeze({
  projectName: "liquidation-watchdog-pg17", branchName: "a4-migration-test", parentBranchName: "production",
  databaseName: "neondb", postgresMajor: 17, schemaName: "watchdog_pg", namespace: "watchdog_free", directPort: 5432
});
export const A4_APPROVED_MIGRATION_CHECKSUMS = Object.freeze([
  "7d682b2267b9d35d0a6ed01511dc0342a3ef801051e0ee0fdf8f0c60a09b015d",
  "7b8aa97bf0a386081b79bd5d6eb36c57af91d5c40cd3498302dd4615d4a9eb75"
] as const);
export const A4_APPROVED_CATALOG_FINGERPRINT = "24b4fea1efeab7c49999dd693f59ddc9aa776bcb4d4e262185978c9630c80ba3";
export const A4_METADATA_MAX_AGE_MS = 15 * 60_000;
export const A4_METADATA_FUTURE_SKEW_MS = 30_000;
const variables = Object.freeze({ directUrl: "WATCHDOG_A4_DIRECT_URL", bindingFile: "WATCHDOG_A4_METADATA_BINDING_FILE",
  bindingSha256: "WATCHDOG_A4_METADATA_SHA256", attemptFile: "WATCHDOG_A4_ATTEMPT_STATE_FILE" });
const prohibitedVariables = ["WATCHDOG_POSTGRES_WRITER_URL", "WATCHDOG_POSTGRES_READER_URL", "DATABASE_URL"] as const;
const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), branchId = z.string().regex(/^br-[A-Za-z0-9_-]{1,97}$/);
const endpointId = z.string().regex(/^ep-[A-Za-z0-9_-]{1,97}$/), digest = z.string().regex(/^[a-f0-9]{64}$/);
const retrievedAt = z.string().refine(value => { const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value; });
const metadataSchema = z.object({
  kind: z.literal("A4_NEON_METADATA"), schemaVersion: z.literal(1), projectId: id,
  projectName: z.literal(A4_TARGET.projectName), branchId, branchName: z.literal(A4_TARGET.branchName),
  parentBranchId: branchId, parentBranchName: z.literal(A4_TARGET.parentBranchName), endpointId,
  endpointType: z.literal("direct"), databaseName: z.literal(A4_TARGET.databaseName), postgresMajor: z.literal(17),
  directHostnameSha256: digest, directPort: z.literal(A4_TARGET.directPort), retrievedAt
}).strict().refine(value => value.branchId !== value.parentBranchId, { message: "Target and parent branch IDs must differ." });
export type A4NeonMetadata = z.infer<typeof metadataSchema>;
const bindingSchema = z.object({ metadata: metadataSchema, sha256: digest }).strict();
export type A4MetadataBinding = z.infer<typeof bindingSchema>;
const hash = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const sameDigest = (left: string, right: string): boolean => timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
const stop = (code = "A4_QUALIFICATION_STOP"): never => { throw new DataError(code, "A4 qualification stopped without using the target."); };
const errorCode = (error: unknown): string => error instanceof DataError && /^[A-Z0-9_]{2,64}$/.test(error.code) ? error.code : "A4_QUALIFICATION_FAILED";

function metadataBytes(input: A4NeonMetadata): string {
  const value = metadataSchema.parse(input);
  return JSON.stringify({ kind: value.kind, schemaVersion: value.schemaVersion, projectId: value.projectId,
    projectName: value.projectName, branchId: value.branchId, branchName: value.branchName,
    parentBranchId: value.parentBranchId, parentBranchName: value.parentBranchName, endpointId: value.endpointId,
    endpointType: value.endpointType, databaseName: value.databaseName, postgresMajor: value.postgresMajor,
    directHostnameSha256: value.directHostnameSha256, directPort: value.directPort, retrievedAt: value.retrievedAt });
}
/** Offline helper only: production trust comes from a separately injected expected hash. */
export function createA4MetadataBinding(input: A4NeonMetadata): A4MetadataBinding {
  const metadata = metadataSchema.parse(input); return { metadata, sha256: hash(metadataBytes(metadata)) };
}

function outsideProject(absolute: string): boolean {
  const fromProject = relative(realpathSync(process.cwd()), realpathSync(resolve(absolute, "..")));
  return fromProject === ".." || fromProject.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`);
}
function regularExternalFile(name: string, mustExist: boolean): string {
  if (!name || !isAbsolute(name)) return stop();
  const absolute = resolve(name), parent = resolve(absolute, "..");
  if (!existsSync(parent) || !lstatSync(parent).isDirectory() || lstatSync(parent).isSymbolicLink() || !outsideProject(absolute)) return stop();
  if (mustExist && (!existsSync(absolute) || !lstatSync(absolute).isFile() || lstatSync(absolute).isSymbolicLink())) return stop();
  if (!mustExist && existsSync(absolute)) return stop("A4_ATTEMPT_ALREADY_USED");
  return absolute;
}
function loadAuthority(now = Date.now(), requireFresh = true): A4MetadataBinding {
  const expected = process.env[variables.bindingSha256];
  if (!digest.safeParse(expected).success) return stop();
  const filename = regularExternalFile(process.env[variables.bindingFile] ?? "", true);
  const bytes = readFileSync(filename); if (bytes.length > 16_384) return stop();
  let binding: A4MetadataBinding;
  try { binding = bindingSchema.parse(JSON.parse(bytes.toString("utf8"))); } catch { return stop(); }
  if (!sameDigest(binding.sha256, expected!) || !sameDigest(binding.sha256, hash(metadataBytes(binding.metadata)))) return stop();
  const retrieved = Date.parse(binding.metadata.retrievedAt), age = now - retrieved;
  if (requireFresh && (age < -A4_METADATA_FUTURE_SKEW_MS || age > A4_METADATA_MAX_AGE_MS)) return stop("A4_METADATA_EXPIRED");
  return binding;
}
function ensureActualEnvironment(): void {
  for (const name of prohibitedVariables) if (process.env[name] !== undefined) return stop();
}
interface DirectConfiguration { configuration: PoolConfig; hostnameSha256: string; port: number }
function directConfiguration(binding: A4MetadataBinding): DirectConfiguration {
  ensureActualEnvironment();
  const secret = process.env[variables.directUrl]; if (!secret || secret.length > 4_096) return stop();
  let url: URL; try { url = new URL(secret); } catch { return stop(); }
  const port = url.port ? Number(url.port) : 5432;
  if (url.searchParams.getAll("sslmode").length !== 1 || url.searchParams.get("sslmode") !== "verify-full"
    || url.searchParams.getAll("channel_binding").length !== 1 || url.searchParams.get("channel_binding") !== "require"
    || url.hostname.toLowerCase().includes("-pooler") || url.pathname !== `/${A4_TARGET.databaseName}`
    || port !== binding.metadata.directPort || port !== A4_TARGET.directPort) return stop();
  const hostnameSha256 = hash(url.hostname.toLowerCase());
  if (!sameDigest(hostnameSha256, binding.metadata.directHostnameSha256)) return stop();
  const configuration = connectionConfiguration(secret);
  if (configuration.database !== A4_TARGET.databaseName || configuration.port !== A4_TARGET.directPort
    || configuration.enableChannelBinding !== true || typeof configuration.ssl !== "object" || configuration.ssl === null
    || !("rejectUnauthorized" in configuration.ssl) || configuration.ssl.rejectUnauthorized !== true) return stop();
  return { configuration, hostnameSha256, port };
}

async function bounded<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([work, new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { reject(new DataError("A4_IO_TIMEOUT", "A4 bounded I/O did not settle.")); }, milliseconds); timer.unref();
  })]); } finally { if (timer) clearTimeout(timer); }
}
interface QueryPort { query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>; close(): Promise<void> }
async function openReadOnly(configuration: PoolConfig): Promise<QueryPort> {
  const client = new Client({ ...configuration, connectionTimeoutMillis: PG_LIMITS.connectMs, query_timeout: PG_LIMITS.queryMs });
  await bounded(client.connect(), PG_LIMITS.connectMs);
  return { query: (text, values) => bounded(client.query(text, values), PG_LIMITS.queryMs),
    close: () => bounded(client.end(), PG_LIMITS.closeMs) };
}

interface Approval {
  metadataSha256: string; projectId: string; branchId: string; parentBranchId: string; endpointId: string;
  hostnameSha256: string; port: 5432; databaseName: "neondb"; attemptId: string; expiresAt: number;
}
const approvalState = new WeakMap<Approval, "ready" | "consumed">();
async function preflight(binding: A4MetadataBinding, direct: DirectConfiguration): Promise<Approval> {
  const started = performance.now(); let port: QueryPort | undefined, begun = false;
  try {
    port = await openReadOnly(direct.configuration);
    await port.query("BEGIN TRANSACTION READ ONLY"); begun = true;
    await port.query("SELECT set_config('statement_timeout','5000',true),set_config('lock_timeout','1000',true),set_config('idle_in_transaction_session_timeout','5000',true)");
    const target = (await port.query(`SELECT current_setting('server_version_num') AS server_version,current_database() AS database_name,
      to_regnamespace('watchdog_pg')::text AS schema_name,to_regclass('watchdog_pg.schema_migrations')::text AS migration_table`)).rows[0];
    const locks = (await port.query("SELECT count(*)::text AS count FROM pg_locks WHERE locktype='advisory' AND classid=1672 AND objid=10001 AND objsubid=2")).rows[0];
    if (!/^17[0-9]{4}$/.test(String(target?.server_version)) || target?.database_name !== A4_TARGET.databaseName
      || target?.schema_name !== null || target?.migration_table !== null || locks?.count !== "0") return stop();
    await port.query("ROLLBACK"); begun = false;
    const closing = port; port = undefined; await closing.close();
    const now = Date.now(), approval: Approval = Object.freeze({ metadataSha256: binding.sha256,
      projectId: binding.metadata.projectId, branchId: binding.metadata.branchId, parentBranchId: binding.metadata.parentBranchId,
      endpointId: binding.metadata.endpointId, hostnameSha256: direct.hostnameSha256, port: 5432, databaseName: "neondb",
      attemptId: randomUUID(), expiresAt: now + 60_000 });
    if (performance.now() - started > 15_000) return stop("A4_PREFLIGHT_EXPIRED");
    approvalState.set(approval, "ready"); return approval;
  } catch (error) {
    if (error instanceof DataError) throw error; return stop();
  } finally {
    if (begun) { try { await port?.query("ROLLBACK"); } catch { /* sanitized */ } }
    if (port) { try { await port.close(); } catch { /* sanitized */ } }
  }
}
function consumeApproval(approval: Approval, binding: A4MetadataBinding, direct: DirectConfiguration): void {
  if (approvalState.get(approval) !== "ready" || Date.now() > approval.expiresAt
    || approval.metadataSha256 !== binding.sha256 || approval.projectId !== binding.metadata.projectId
    || approval.branchId !== binding.metadata.branchId || approval.parentBranchId !== binding.metadata.parentBranchId
    || approval.endpointId !== binding.metadata.endpointId || approval.hostnameSha256 !== direct.hostnameSha256
    || approval.port !== direct.port || approval.databaseName !== A4_TARGET.databaseName) return stop("A4_APPROVAL_INVALID");
  approvalState.set(approval, "consumed");
}
function verifyApprovedSource(): void {
  const checksums = POSTGRES_MIGRATIONS.map(item => textHash(item.sql));
  if (POSTGRES_MIGRATIONS.length !== 2 || POSTGRES_MIGRATIONS.some((item, index) => item.version !== index + 1)
    || checksums.some((value, index) => value !== A4_APPROVED_MIGRATION_CHECKSUMS[index])
    || POSTGRES_CATALOG_FINGERPRINT !== A4_APPROVED_CATALOG_FINGERPRINT) return stop();
}
function writeAttemptReceipt(binding: A4MetadataBinding, approval: Approval): void {
  const filename = regularExternalFile(process.env[variables.attemptFile] ?? "", false);
  const descriptor = openSync(filename, "wx", 0o600);
  try { writeFileSync(descriptor, `${JSON.stringify({ kind: "A4_MIGRATION_ATTEMPT", schemaVersion: 1,
    metadataSha256: binding.sha256, projectId: binding.metadata.projectId, branchId: binding.metadata.branchId,
    parentBranchId: binding.metadata.parentBranchId, endpointId: binding.metadata.endpointId,
    hostnameSha256: binding.metadata.directHostnameSha256, port: binding.metadata.directPort,
    databaseName: binding.metadata.databaseName, namespace: A4_TARGET.namespace, attemptId: approval.attemptId,
    status: "MIGRATION_STARTED", startedAt: new Date().toISOString() })}\n`, "utf8"); fsyncSync(descriptor); }
  finally { closeSync(descriptor); }
}

export type A4QualificationResult = { status: "QUALIFIED"; retryAllowed: false; migrationMs: number; postVerificationMs: number;
  incarnationSha256: string; attemptId: string } | { status: "STOP" | "MIGRATION_OUTCOME_REQUIRES_INSPECTION"; retryAllowed: false; code: string };
/** Sealed production path: no dependency, environment, binding, migration, verifier or catalog injection. */
export async function runA4ProductionQualification(): Promise<A4QualificationResult> {
  let migrationStarted = false, connection: PgConnection | undefined, result: A4QualificationResult | undefined;
  try {
    verifyApprovedSource(); ensureActualEnvironment();
    const binding = loadAuthority(), direct = directConfiguration(binding), approval = await preflight(binding, direct);
    connection = new PgConnection(direct.configuration, "writer");
    consumeApproval(approval, binding, direct); writeAttemptReceipt(binding, approval);
    migrationStarted = true;
    const migrationAt = performance.now(); await applyPostgresMigrations(connection, A4_TARGET.namespace);
    const migrationMs = performance.now() - migrationAt, verifyAt = performance.now();
    const incarnation = await connection.transaction(sql => verifyPostgresSchema(sql, A4_TARGET.namespace, A4_APPROVED_CATALOG_FINGERPRINT));
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(incarnation)) return stop();
    result = { status: "QUALIFIED", retryAllowed: false, migrationMs, postVerificationMs: performance.now() - verifyAt,
      incarnationSha256: hash(incarnation), attemptId: approval.attemptId };
  } catch (error) {
    result = { status: migrationStarted ? "MIGRATION_OUTCOME_REQUIRES_INSPECTION" : "STOP", retryAllowed: false,
      code: errorCode(error) };
  } finally {
    if (connection) { try { await connection.close(); }
      catch (error) { if (migrationStarted) result = { status: "MIGRATION_OUTCOME_REQUIRES_INSPECTION", retryAllowed: false, code: errorCode(error) }; } }
  }
  return result ?? { status: "STOP", retryAllowed: false, code: "A4_QUALIFICATION_FAILED" };
}

export type A4InspectionResult = { status: "EXACT_COMMITTED" | "FULLY_ABSENT" | "PARTIAL_OR_MISMATCHED"
  | "INVALID_TARGET_OR_CONFIGURATION" | "UNREACHABLE"; retryAllowed: false };
export async function inspectA4ProductionUnknownOutcome(): Promise<A4InspectionResult> {
  let binding: A4MetadataBinding, direct: DirectConfiguration;
  try { ensureActualEnvironment(); binding = loadAuthority(Date.now(), false); direct = directConfiguration(binding); }
  catch { return { status: "INVALID_TARGET_OR_CONFIGURATION", retryAllowed: false }; }
  let port: QueryPort | undefined, begun = false, result: A4InspectionResult;
  try {
    port = await openReadOnly(direct.configuration); await port.query("BEGIN TRANSACTION READ ONLY"); begun = true;
    await port.query("SELECT set_config('statement_timeout','5000',true),set_config('lock_timeout','1000',true),set_config('idle_in_transaction_session_timeout','5000',true)");
    const overview = (await port.query(`SELECT current_setting('server_version_num') AS server_version,current_database() AS database_name,
      to_regnamespace('watchdog_pg')::text AS schema_name,to_regclass('watchdog_pg.schema_migrations')::text AS migration_table,
      to_regclass('watchdog_pg.database_identity')::text AS identity_table,to_regclass('watchdog_pg.worker_lease')::text AS lease_table`)).rows[0];
    const correctTarget = /^17[0-9]{4}$/.test(String(overview?.server_version)) && overview?.database_name === A4_TARGET.databaseName;
    const objects = [overview?.schema_name, overview?.migration_table, overview?.identity_table, overview?.lease_table];
    if (!correctTarget) result = { status: "INVALID_TARGET_OR_CONFIGURATION", retryAllowed: false };
    else if (objects.every(value => value === null)) result = { status: "FULLY_ABSENT", retryAllowed: false };
    else if (objects.some(value => typeof value !== "string")) result = { status: "PARTIAL_OR_MISMATCHED", retryAllowed: false };
    else {
      const versions = (await port.query("SELECT version,checksum FROM watchdog_pg.schema_migrations ORDER BY version LIMIT 4")).rows;
      const identity = (await port.query("SELECT id,backend,namespace,incarnation::text FROM watchdog_pg.database_identity ORDER BY id")).rows;
      const lease = (await port.query(`SELECT id,incarnation::text,fence::text,owner,expires_at,deadline_at,current_execution,high_water_slot
        FROM watchdog_pg.worker_lease ORDER BY id`)).rows;
      const counts = (await port.query(`SELECT (SELECT count(*)::text FROM watchdog_pg.cycles) AS cycles,
        (SELECT count(*)::text FROM watchdog_pg.streams) AS streams,(SELECT count(*)::text FROM watchdog_pg.fingerprints) AS fingerprints,
        (SELECT count(*)::text FROM watchdog_pg.alerts) AS alerts,(SELECT count(*)::text FROM watchdog_pg.deliveries) AS deliveries,
        (SELECT count(*)::text FROM watchdog_pg.delivery_attempts) AS delivery_attempts,
        (SELECT count(*)::text FROM watchdog_pg.delivery_events) AS delivery_events,(SELECT count(*)::text FROM watchdog_pg.provider_limits) AS provider_limits,
        (SELECT count(*)::text FROM watchdog_pg.oracle_assurance) AS oracle_assurance,(SELECT count(*)::text FROM watchdog_pg.worker_runtime) AS worker_runtime,
        (SELECT count(*)::text FROM watchdog_pg.operational_events) AS operational_events,
        (SELECT count(*)::text FROM watchdog_pg.scheduled_executions) AS scheduled_executions`)).rows[0];
      const sql: Sql = { query: (text, values) => port!.query(text, values) }, catalog = await postgresCatalogFingerprint(sql);
      const exactVersions = versions.length === 2 && versions.every((row, index) => row.version === index + 1 && row.checksum === A4_APPROVED_MIGRATION_CHECKSUMS[index]);
      const exactIdentity = identity.length === 1 && identity[0]?.id === 1 && identity[0]?.backend === "liquidation-watchdog-pg"
        && identity[0]?.namespace === A4_TARGET.namespace && typeof identity[0]?.incarnation === "string"
        && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(identity[0].incarnation);
      const exactLease = lease.length === 1 && lease[0]?.id === 1 && lease[0]?.incarnation === identity[0]?.incarnation
        && lease[0]?.fence === "0" && lease[0]?.owner === null && lease[0]?.expires_at === null && lease[0]?.deadline_at === null
        && lease[0]?.current_execution === null && lease[0]?.high_water_slot === null;
      const empty = counts !== undefined && Object.values(counts).length === 12 && Object.values(counts).every(value => value === "0");
      result = { status: exactVersions && exactIdentity && exactLease && empty && catalog === A4_APPROVED_CATALOG_FINGERPRINT
        ? "EXACT_COMMITTED" : "PARTIAL_OR_MISMATCHED", retryAllowed: false };
    }
    await port.query("ROLLBACK"); begun = false;
    const closing = port; port = undefined; await closing.close();
  } catch { result = { status: "UNREACHABLE", retryAllowed: false }; }
  finally { if (begun) { try { await port?.query("ROLLBACK"); } catch { /* sanitized */ } }
    if (port) { try { await port.close(); } catch { /* sanitized */ } } }
  return result;
}
