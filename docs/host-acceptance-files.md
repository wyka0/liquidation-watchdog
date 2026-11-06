# Phase 6 evidence files

Package: [`evidence/phase6/`](../evidence/phase6/) — **25 files**, SHA-256 listed in [evidence-hashes.json](../evidence/phase6/evidence-hashes.json) (self-excluded). All captures are from the **local development machine** (Windows 11/Node v24.14.1/SQLite 3.51.2) because the intended deployment host is not yet specified; no file claims target-host coverage. In the original captures, `host-inventory.raw.json` and `host-environment-observations.json` record the local username, hostname, operating-system edition/build and hardware observations; the public copy redacts those identifying values with neutral placeholders (the original values exist only in the maintainer's private pre-publication snapshot). No file contains credentials, tokens, webhook URLs, private keys or authorization headers: outputs use bounded internal codes, and the remaining content is public chain identifiers only. The project secret scanner runs over this entire tree as part of final verification.

## Evidence inventory

| File | Bytes | SHA-256 (first 16) | Content — verification label |
| --- | --- | --- | --- |
| `alerts-output.txt` | 3,889 | `91f91a39d67b90f8` | CLI `alerts` output: 3 persisted alerts + delivery JSON records — ACTUAL (local) |
| `backup-1-stdout.txt` | 683 | `8743f68cdac5d598` | Online `backup` command result for capture `phase6-capture-1` — ACTUAL (local) |
| `backup-database-probe.json` | 787 | `387e68fbebe9285f` | Independent read-only probe of the backup's `database.sqlite` (schema 5/app ID/WAL/integrity) — ACTUAL (local) |
| `backup-verify.json` | 621 | `7a4fd9cd70b4a6cb` | `backup-verify` PASS record — ACTUAL (local) |
| `config-check-production-profile.json` | 765 | `6a315edc5ae9a2d6` | Production-profile config validation, exit 0, `secretValues: OMITTED` — ACTUAL (local) |
| `config-check-traversal-refusal.json` | 564 | `15c0229f2b59f9e6` | Traversal-path config refused, `MONITOR_DATABASE_PATH` — ACTUAL fail-closed (local) |
| `database-init-rejected-during-active-cycle.txt` | 566 | `32732820a54a0bfe` | Writable init refused `MONITOR_ALREADY_RUNNING` while a real cycle owned the store — ACTUAL (local) |
| `database-init-schema-drift-refusal.txt` | 562 | `b39f32755a1b3ec2` | `database-init` refusal on drifted copy, `STORE_SCHEMA_LAYOUT` — ACTUAL fail-closed (local) |
| `diagnostics.json` | 4,382 | `c643ed633c366ae5` | Full sanitized diagnostics report — ACTUAL (local) |
| `env-example-hash-check.txt` | 221 | `bd9cb8b5f193bf8a` | `.env.example` byte-hash match vs documented pin; `WATCHDOG_*` names absent (values never read) — ACTUAL (local) |
| `health-after-init.txt` | 3,447 | `d8dd9c69ca634ab4` | Health after database-init — ACTUAL (local) |
| `health-before-init-STORE_NOT_FOUND.txt` | 1,730 | `b3916efbabf9b57e` | Health on missing store, `STORE_NOT_FOUND`, nothing initialized — ACTUAL (local) |
| `health-during-active-cycle.txt` | 4,350 | `4761aee029310ec6` | Health while a cycle held ownership: `RUNNING`/`HELD`, worker RSS sample — ACTUAL (local) |
| `health-schema-drift-refusal.txt` | 1,734 | `18b14c9c41869275` | Health refusal on drifted copy — ACTUAL fail-closed (local) |
| `host-environment-observations.json` | 3,280 | `fb58ac4fd3b1804d` | Time sync, supervisor absence, ACL, DNS, disk/memory observations — ACTUAL discover (local) |
| `host-inventory.raw.json` | 1,485 | `32c621e4d9242bdd` | Host inventory raw record (OS/CPU/memory/Node/SQLite) — ACTUAL discover (local) |
| `monitor-once-invalid-threshold-rejected.txt` | 624 | `680e528eb51a4c3b` | Rejected attempt record (`INVALID_THRESHOLDS`) — ACTUAL fail-closed (local) |
| `monitor-once-invalid-threshold-retry-context.txt` | 625 | `aa54d8ee7762524a` | Context run used for the concurrency test setup — ACTUAL (local) |
| `monitoring-observation-results.json` | 7,563 | `4d80839233f72c6c` | Bounded-observation record: 12/12 accepted cycles with blocks/hashes/durations/quality gating — ACTUAL (local, network read-only) |
| `oracle-status.json` | 78 | `a1621f8d46dd1200` | Persisted oracle status: UNVERIFIED / UNKNOWN — ACTUAL (local) |
| `readiness-probe.json` | 4,334 | `6deb5ec635340c7f` | Readiness with explicit read-only connectivity probe (RPC/MCP REACHABLE) — ACTUAL (local, network) |
| `readiness.json` | 4,382 | `01b2a8e6f09551c2` | Readiness report after clean stop — ACTUAL (local) |
| `release-identity.json` | 1,460 | `4e8efb50435217ba` | Manifest digest re-verification (Phase 5 pre-bind + final Phase 6 re-bind), versions, schema, Git honesty, approval state — ACTUAL (local) |
| `restore-verify.json` | 272 | `af3171412555034a` | Isolated restore verification PASS record — ACTUAL (local) |
| `status.json` | 159,249 | `366e67d1c8c2342f` | Full status report (stored history, cycles, deliveries, provider limits sans destinations) — ACTUAL (local) |
| `evidence-hashes.json` | 25-file manifest | self-excluded | Regenerated 2026-11-02T10:41:13Z (final Phase 6 close-out); authoritative hash chain for this package |

The authoritative SHA-256 list is [evidence-hashes.json](../evidence/phase6/evidence-hashes.json), regenerated at package completion (verify each file against it; the values above record the package state at close-out).

## Backup artifacts (temporary workspace, not archived into the repo)

The consistent capture itself (database + evidence + manifest + checksum) and the disposable restore scratch live only in the temporary acceptance workspace `[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/phase6-acceptance/` and were deliberately **not** copied into the release tree (databases/backup outputs stay excluded from Git and the release binding). Their recorded identities:

- Capture `phase6-capture-1`: `database.sqlite` 1,310,720 B, manifest SHA-256 chain `manifest.sha256` (80 bytes) written last; created 2026-11-02T09:45:15.605Z from the post-series store state (block 21921409).
- The temp workspace contains the acceptance configuration (non-secret JSON, console-only) and all raw transcripts listed above; it is disposable and was left in place only for human review.

## Labeling convention

- **ACTUAL** — command executed for real on this machine with real local/runtime/network effects (all bounded, read-only where network-touching).
- **MOCKED** — behavior defined by Phase 5 mocked-HTTP/fixture suites, cited in the report/findings rather than re-executed.
- **NOT EXECUTED** — target-host items listed in the checklist; never claimed as done.
