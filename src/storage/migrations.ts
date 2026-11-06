export const APPLICATION_ID = 0x4c575033;
export const MIGRATIONS = [
  `CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL) STRICT;
   CREATE TABLE streams(scope TEXT PRIMARY KEY, revision INTEGER NOT NULL, state_json TEXT NOT NULL CHECK(json_valid(state_json))) STRICT;
   CREATE TABLE cycles(
     id TEXT PRIMARY KEY, scope TEXT NOT NULL, started_at TEXT NOT NULL, observed_at TEXT, completed_at TEXT,
     status TEXT NOT NULL CHECK(status IN ('RUNNING','PERSISTED','COMPLETED','INTERRUPTED')),
     accepted INTEGER CHECK(accepted IN (0,1)), observation_json TEXT CHECK(observation_json IS NULL OR json_valid(observation_json)),
     block_number TEXT, block_hash TEXT, snapshot_id TEXT, math_state TEXT, data_quality TEXT, oracle_quality TEXT,
     safety_ratio TEXT, ltv TEXT, actionable INTEGER NOT NULL DEFAULT 0 CHECK(actionable=0), duration_ms INTEGER
   ) STRICT;
   CREATE TABLE fingerprints(fingerprint TEXT PRIMARY KEY, created_at TEXT NOT NULL) STRICT;
   CREATE TABLE alerts(
     id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE REFERENCES fingerprints(fingerprint),
     cycle_id TEXT NOT NULL REFERENCES cycles(id), scope TEXT NOT NULL, created_at TEXT NOT NULL,
     severity TEXT NOT NULL, category TEXT NOT NULL, alert_json TEXT NOT NULL CHECK(json_valid(alert_json))
   ) STRICT;
   CREATE TABLE deliveries(
     id TEXT PRIMARY KEY, alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE, channel TEXT NOT NULL,
     status TEXT NOT NULL CHECK(status IN ('PENDING','IN_FLIGHT','DELIVERED','FAILED','RETRY_SCHEDULED','PERMANENTLY_FAILED')),
     attempts INTEGER NOT NULL DEFAULT 0, next_at TEXT NOT NULL, last_error TEXT, ambiguous INTEGER NOT NULL DEFAULT 0,
     UNIQUE(alert_id, channel)
   ) STRICT;
   CREATE TABLE delivery_attempts(
     delivery_id TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE, attempt INTEGER NOT NULL,
     started_at TEXT NOT NULL, completed_at TEXT, outcome TEXT NOT NULL, error_code TEXT, ambiguous INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY(delivery_id, attempt)
   ) STRICT;
   CREATE TABLE delivery_events(
     id INTEGER PRIMARY KEY, delivery_id TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
     occurred_at TEXT NOT NULL, status TEXT NOT NULL
   ) STRICT;`,
  `CREATE TABLE provider_limits(channel TEXT PRIMARY KEY, next_at TEXT NOT NULL) STRICT;
   CREATE INDEX cycles_scope_time ON cycles(scope, started_at);
   CREATE INDEX alerts_time ON alerts(created_at);
   CREATE INDEX deliveries_due ON deliveries(status, next_at);`,
   `ALTER TABLE provider_limits ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN (0,1));`,
   `CREATE TABLE oracle_assurance(
      id TEXT PRIMARY KEY, evaluated_at TEXT NOT NULL, context TEXT NOT NULL,
      result_json TEXT NOT NULL CHECK(json_valid(result_json)), result_sha256 TEXT NOT NULL,
      bundle_path TEXT, manifest_sha256 TEXT
    ) STRICT;
     CREATE INDEX oracle_assurance_time ON oracle_assurance(evaluated_at);`,
    `CREATE TABLE worker_runtime(id INTEGER PRIMARY KEY CHECK(id=1), runtime_json TEXT NOT NULL CHECK(json_valid(runtime_json))) STRICT;
     CREATE TABLE operational_events(id INTEGER PRIMARY KEY, occurred_at TEXT NOT NULL, code TEXT NOT NULL) STRICT;
     CREATE INDEX deliveries_alert_id ON deliveries(alert_id);
     CREATE INDEX oracle_assurance_context_time ON oracle_assurance(context,evaluated_at);
     CREATE INDEX cycles_scope_accepted_time ON cycles(scope,accepted,started_at);`
] as const;
