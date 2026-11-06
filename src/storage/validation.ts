import { DatabaseSync } from "node:sqlite";
import { DataError } from "../domain/errors.js";
import { hashParts } from "../monitoring/model.js";
import { APPLICATION_ID, MIGRATIONS } from "./migrations.js";

const layouts = new Map<number, string>();
const layout = (db: DatabaseSync) => JSON.stringify(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' ORDER BY type,name").all());
function expectedLayout(version: number): string {
  const cached = layouts.get(version);
  if (cached !== undefined) return cached;
  const reference = new DatabaseSync(":memory:", { allowExtension: false });
  try {
    for (const migration of MIGRATIONS.slice(0, version)) reference.exec(migration);
    const expected = layout(reference); layouts.set(version, expected); return expected;
  } finally { reference.close(); }
}

export function validateDatabaseSchema(db: DatabaseSync, allowEmpty = false, full = false): number {
  const check = full ? "integrity_check" : "quick_check";
  if (db.prepare(`PRAGMA ${check}`).get()?.[check] !== "ok") throw new DataError("STORE_CORRUPT", "Database integrity check failed; the database was not replaced.");
  const version = db.prepare("PRAGMA user_version").get()?.user_version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0 || version > MIGRATIONS.length || (!allowEmpty && version === 0)) {
    throw new DataError("STORE_SCHEMA_VERSION", "Database schema version is unsupported; no downgrade or reset was attempted.");
  }
  const application = db.prepare("PRAGMA application_id").get()?.application_id;
  if (version === 0) {
    if (db.prepare("SELECT name FROM sqlite_master WHERE name NOT GLOB 'sqlite_*'").all().length || application !== 0) {
      throw new DataError("STORE_CORRUPT", "An unrecognized database cannot be initialized.");
    }
  } else {
    if (application !== APPLICATION_ID) throw new DataError("STORE_CORRUPT", "Database application identity does not match.");
    if (layout(db) !== expectedLayout(version)) throw new DataError("STORE_SCHEMA_LAYOUT", "Database schema differs from its supported migration layout; no migration or write was attempted.");
    const history = db.prepare("SELECT version,checksum FROM schema_migrations ORDER BY version").all();
    if (history.length !== version || history.some((row, index) => row.version !== index + 1 || row.checksum !== hashParts(MIGRATIONS[index]))) {
      throw new DataError("STORE_MIGRATION_CHECKSUM", "Database migration history failed checksum validation.");
    }
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new DataError("STORE_CORRUPT", "Database foreign-key validation failed.");
  }
  return version;
}
