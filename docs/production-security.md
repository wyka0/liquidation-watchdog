# Production security and secret handling

## Fixed read-only chain boundary

RPC methods and MCP tools remain allowlisted. Main reads require both fixed chain-1672 endpoints and the existing pinned-block, contract, batch-sentinel, header and comparison checks. Real transports enforce exact configured URLs; redirects and alternate hosts/ports/paths/query credentials are rejected. Supplemental oracle reads use their separately constrained read-only methods. There is no signing/broadcast path, execution wallet, repayment transaction or collateral transaction.

Provider text and page/error content are data. They do not change endpoints, enable tools, weaken runtime pins or alter financial policy. Bodies are bounded and malformed results fail closed. An approved host must still validate DNS/TLS trust, egress controls and OS behavior; URL matching alone does not prove a trustworthy provider.

## Secret boundary

Only the three existing optional `WATCHDOG_*` notification variables are supported. Disabled channels do not access them. Startup output reports DISABLED/CONFIGURED/MISSING/INVALID only. `.env.example` is a reviewed placeholder artifact with SHA-256 `517c936b52b4489029ba6576c553cbfc2b052eebe638511b4d055ace99d22c69`; it is not automatically loaded.

Configuration files accept documented non-secret JSON only, with bounded size and strict unknown-field rejection. Credentials stay in the service environment or a privately managed external secret file. The database intentionally contains no notification credential or destination history. Rotation/re-enabling uses the current destination for old queued entries, which requires operator review.

Public operational errors expose a bounded internal code and generic message, not arbitrary exception/provider text. Structured log fields are allowlisted. Human-readable defensive redaction strips URLs, token/auth patterns and control/format characters. Telegram messages use plain text; Discord disables parsed mentions. Header dumps, debug transport logs, shell tracing and environment dumps are inappropriate for production evidence.

## Local files and database

- Dedicated non-administrator account; restrictive directory permissions/umask and validated Windows ACLs. SQLite needs directory access for sidecars, not just main-file writes.
- Code, lockfile, configuration and sealed archives read-only to the worker. Runtime state and backup/recovery destinations are separate and private.
- Local path checks reject traversal, links/junctions, hardlink aliases, URI/UNC/network forms, alternate streams, control characters and reserved Windows names. Private parent directories are necessary against replacement races.
- SQLite extensions are disabled, trusted schema is off, schema layout is compared with reconstructed migrations, and user-derived values use prepared parameters. No migration accepts a newer or unknown schema.
- Consistent backups bind all required evidence and validate counts/content/schema. Digests detect change relative to a protected manifest; neither backup nor release manifests are cryptographic signatures. Preserve independent trusted digests/off-host copies under operator controls.
- No automatic destructive recovery, database recreation, evidence purge, outbox reset or migration downgrade runs.

## Dependency and release integrity

Dependencies and lockfile remain pinned. `npm audit --json` is required by full verification and its exact result is stored. A reported vulnerability is a release decision; this phase does not silently update packages or runtime assumptions. Build and source hashes are captured at verification time; manifest generation refuses source/configuration changes after tests or build changes after compilation.

The release manifest binds the ten Phase 5 documents, completed test/audit/link/preservation evidence, package/configuration and runtime/schema metadata. Finalization must follow the full run, documentation must match its finalization fingerprint, and canonical test/stability reports must match the recorded attempt copies. Self/check outputs are explicitly excluded from self-hashing. Release checking runs a read-only secret scan over the completed manifest/checksum and project, retaining its sanitized result in the manifest-check record. No Git revision is invented when HEAD is unavailable. Future release packaging, commit/sign/tag/publish and host deployment are separately authorized actions.

## Secret scan scope

`npm run secrets:check` scans project-owned source/documents and sanitized evidence, excluding `.git`, dependencies, build/coverage output and private `data/`/`backups/`. Potential key, credential and environment files are named without opening them. The exact authored `.env.example` is hash-verified, not broadly exempted. Only one exact inert `.test` URL from the original transport test is permitted; remaining content is still scanned. Findings contain path/line/rule only, never matched values.

This scoped pattern scan does not establish that private operator storage or installed dependencies contain no secrets. Phase 5 did not inspect actual secret files or use real provider credentials. Synthetic test credentials are constructed inertly and notification HTTP is mocked.

## Outstanding security/evidence gates

Oracle source economics/quote, real-world operators, heartbeat/upstream freshness and independent economic comparison remain unresolved. Six runtime reproductions prove code/source binding, not those facts. Host privilege boundaries, filesystem power loss, secret injection, real provider permissions, backup access/off-host recovery and supervisor resource/log controls require actual host acceptance. The current release status is [not approved for production](release-readiness.md); all estimates remain **indicative and actionable: false**.
