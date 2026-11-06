# Liquidation Watchdog

A read-only TypeScript CLI and opt-in **single-position monitor** for Morpho Blue on **Pharos Pacific Mainnet, chain 1672**. It combines pinned chain reads, exact risk mathematics, typed suggested actions, durable alerts/outbox storage, oracle-assurance gates, and SQLite HTTP or PostgreSQL scheduler runtimes. It does not sign, construct or broadcast transactions.

**Public release (Phase 8B):** this repository is a sanitized public copy of the verified package. It carries **no project-wide reuse license** — see [LICENSE](LICENSE); third-party material remains governed by its own licenses and notices ([third-party notices](THIRD-PARTY-NOTICES.md)). Unverified third-party source evidence, captured website page bodies and historical environment caches were excluded, and personal/machine identifiers were redacted with neutral placeholders; the sanitized snapshot is bound by the [public-release inventory](PUBLIC-RELEASE-INVENTORY.json) and [public-release checksums](PUBLIC-RELEASE-SHA256SUMS.txt). The earlier private-publication preparation records ([package inventory](PACKAGE-INVENTORY.md), [package provenance](PACKAGE-PROVENANCE.md), [publication provenance](PUBLICATION-PROVENANCE.md), [publication report](PUBLICATION-REPORT.md), the original [source-package checksums](SHA256SUMS.txt) and the historical [publication checksums](PUBLICATION-SHA256SUMS.txt)) are retained unmodified as historical records of the pre-sanitization snapshot; they describe an earlier private-visibility decision, not this repository's current status.

## Current status

**Documentation status — 2026-11-06:** core monitoring features were demonstrated in **one finite live cycle**, with three timestamped console alerts, one typed non-financial action per alert, and a clean restart that did not resend known-delivered rows. The run ended with the monitor **STOPPED**. Start with the [submission package](docs/SUBMISSION-PACKAGE.md) for acceptance scope and evidence provenance.

**Oracle assurance remains `UNVERIFIED`; freshness remains `UNKNOWN`.** The [Stage 4 investigation](docs/STAGE-4-ORACLE-ASSURANCE-INVESTIGATION.md) concluded **FAIL**; [Stage 5A discovery](docs/STAGE-5A-QUALIFIED-MARKET-DISCOVERY.md) concluded **NO QUALIFIED MARKET FOUND**. Quantified financial recommendations remain **NOT QUALIFIED**. Every action and any eligible estimate is structurally `actionable:false`.

**Production readiness is not accepted.** A single live cycle and clean known-delivered restart do not establish sustained monitoring, crash-in-flight external delivery or exactly-once provider behavior. Real Telegram/Discord delivery, host/supervisor acceptance, off-host recovery and a production-duration soak remain open gates. Multi-position support is an [architecture review only](docs/STAGE-3D-MULTI-POSITION-ARCHITECTURE.md).

## Demonstrated features

- **Pinned position reads and risk:** collateral, accrued borrower debt and a health-factor-equivalent safety ratio, cross-checked through RPC/MCP at one block. Exact BigInt/WAD arithmetic separates mathematical state, data quality and oracle assurance. The finite live evidence is in the [Stage 2 summary](docs/SUBMISSION-PACKAGE.md#d-live-demonstration-finite-stage-2-run).
- **Configured identity and thresholds:** one reviewed-market account per runtime, explicit `DEMO`/`CONFIGURED` roles, threshold ownership and isolated monitoring scopes. All non-account identity fields remain pinned; a public account is never presented as the user's wallet. See [Stage 3C](docs/STAGE-3C-POSITION-CONFIGURATION.md).
- **Typed suggested actions:** every newly generated alert has exactly one [Stage 3A action](docs/STAGE-3A-TYPED-SUGGESTED-ACTIONS.md). Demonstrated live actions are `NON_FINANCIAL`; a `FINANCIAL_OPTION` requires the strict recovery gate and still remains `actionable:false`.
- **Durable alerts and delivery history:** SQLite schema 5 and PostgreSQL persistence, fingerprints and atomic outbox creation. Known-delivered rows are terminal. Ambiguous delivery becomes terminal logical `UNKNOWN` and is never automatically replayed; only known non-ambiguous retryable failures use bounded retries. See [Stage 3B](docs/STAGE-3B-RUNTIME-NOTIFICATIONS.md).
- **Implemented HTTP runtimes:** the [disk-backed SQLite service](docs/render-runtime-operations.md) combines one monitor with protected read APIs; the [PostgreSQL service](docs/postgres-operations.md) uses fenced, externally triggered jobs with durable receipts. Its [configured UTC slots](docs/scheduler-endpoint-contract.md) default to 300 seconds (minutes 00, 05, …, 55). Local implementation/test evidence does not establish production deployment.

## Reproducible single-position demo (synthetic fixtures)

Verified runtime: **Node.js 24.14.1 / SQLite 3.51.2** on Windows. The SQLite production profile requires those exact versions; the package's broader Node `>=22.18.0` range is not a verified host matrix. The demo uses `tsx` from development dependencies and does not require a build or credentials. Node may emit an experimental `node:sqlite` warning.

For a fresh capture, use a separately authorized workspace with dependencies installed and **no existing `data/submission-demo/` directory**. From that workspace's root:

```powershell
npm ci
npm run demo:submission
```

The demo runs the real monitoring pipeline with deterministic fixtures: `WARNING → CRITICAL`, typed non-financial actions under unverified evidence, a separately labeled synthetic strict-gate financial-option scenario, SQLite persistence, console delivery, known-delivered restart checks and read-model output. All actions remain `actionable:false`; fixture readiness fails closed. It establishes no live chain/provider or production readiness.

**The script refuses to overwrite existing output, including an empty directory.** The current `data/submission-demo/` is preserved evidence. Do not use a blanket deletion as the rerun procedure; retain and hash-verify the complete capture, including databases/sidecars, before any separately approved change. There is no demo CLI output-directory flag. See the [demo guide and preservation-aware rerun procedure](docs/SUBMISSION-SINGLE-POSITION-DEMO.md#re-running-and-cleanup).

## Live CLI and runtime entrypoints

### Inspection and risk

These commands perform real, bounded public chain reads without a wallet or credentials. Run from the project root with dependencies installed. Optional notification providers are independently configured and default off.

```powershell
# Run from this copy's project root in an authorized execution workspace.
npm run watchdog -- inspect
npm run watchdog -- risk
```

Capture a new current-block report and its evidence:

```powershell
npm run watchdog -- inspect --save-evidence
npm run watchdog -- risk --save-evidence
```

Inspect an explicitly historical block:

```powershell
npm run watchdog -- inspect --block 21852148 --save-evidence
npm run watchdog -- risk --block 21853902 --save-evidence
```

`--save-evidence` writes inspection/risk reports to `evidence/phase5/{inspect|risk}/{live|historical-<block>}/`; preserve existing captures before reusing those paths. Oracle audits use new immutable UUID bundles under `evidence/phase5/`. The Phase 5 preservation record covers **391 Phase 1–4 evidence files** against its **550-file** pre-Phase-5 baseline; it is historical evidence, not current source certification. A current inspection selects `min(RPC head, MCP head) - 5`; its result is current **as of that block**. Explicit historical calculations are labeled `HISTORICAL`.

Configure exact decimal-string thresholds without changing source:

```powershell
npm run watchdog -- risk --warning 1.30 --critical 1.10 --target 1.25
npm run watchdog -- risk --config config/risk-thresholds.example.json --target 1.40
```

Defaults are warning `1.30`, critical `1.10`, target `1.25`, boundary `1.00`. The report separates mathematical state, data quality, and actionability. With the selected oracle, a provisional `ABOVE_WARNING` still produces `DATA_UNVERIFIED`, never SAFE. See [thresholds](docs/thresholds.md).

The built CLI equivalents below require a compatible build; `npm run build` writes `dist/`:

```powershell
npm run build
npm start -- inspect
npm start -- risk
```

Exit codes: `inspect` returns `0` for an accepted snapshot and `2` otherwise. `risk` returns `0` when overall data quality is calculable and a non-null mathematical state is available, including indicative `UNVERIFIED` output; **both recovery estimates need not succeed**. It returns `2` when those conditions fail. CLI/configuration/execution errors return `1`. No exit code establishes actionability. `--help` prints usage.

### Oracle audit and assurance

```powershell
npm run watchdog -- oracle-audit
npm run watchdog -- oracle-audit --save-evidence
npm run watchdog -- oracle-audit --block 21864844 --save-evidence --json
npm run watchdog -- oracle-status
npm run watchdog -- oracle-status --json
```

An audit performs one bounded read-only investigation and persists its result in SQLite; `--save-evidence` adds a fully hashed immutable evidence bundle. `--database` selects the local database. Status shows persisted as-of evidence and performs no fresh chain read. A historical result keeps its historical label.

Seven dimensions distinguish contract identity, source/operator provenance, price semantics, freshness, independent validation and configuration control. `OBSERVATION_AGE`, local `POLICY_MAX_AGE`, `VERIFIED_HEARTBEAT` and `UPSTREAM_FRESHNESS_GUARANTEE` are separate. There is no default age threshold; `oracle-audit --local-max-age-seconds <seconds>` is only an explicit local rejection policy. Passing it cannot establish freshness.

Configuration changes and observability gaps persistently invalidate assurance. Invalid prices/timestamps/conflicts fail closed; source failures become unavailable. Independent prices never replace the Morpho answer. See [assurance rules and CLI](docs/oracle-assurance.md), [architecture/source verification](docs/oracle-architecture.md), [freshness](docs/oracle-freshness.md) and [independent-source research](docs/oracle-independent-validation.md).

### Monitoring and alerts

```powershell
npm run watchdog -- monitor --once
npm run watchdog -- monitor --enable --interval 60
npm run watchdog -- alerts --limit 20
npm run watchdog -- status
```

CLI continuous monitoring defaults off; `--enable` or `monitoring.enabled=true` explicitly enables it. `--once` requests one bounded cycle and can deliver pending alerts through enabled channels. A reviewed monitoring JSON is selected with `--config`; there is no automatic local-config loader. The default database is `data/watchdog.sqlite`.

`monitor`, `alerts` and `status` accept `--position-config <position.json>` for a single configured account in the reviewed market. The position file owns its thresholds and cannot be combined with `--risk-config` or threshold flags. Without a position file, the compiled public demo identity remains selected and separate threshold-file/CLI overrides remain available. Standalone `inspect`/`risk` retain the compiled demo account; they do not accept a position file. See [position configuration](docs/STAGE-3C-POSITION-CONFIGURATION.md).

The monitor preserves the latest failed read separately from the last accepted mathematical result and the last complete block-bound oracle configuration. Oracle assurance, invalidation, alerts and pending deliveries persist through restart using SQLite schema **5**. Missing data never becomes a recovery or zero debt. Ctrl+C/SIGTERM stops new work, permits bounded active settlement (30 seconds by default), then cancels overdue work and closes the database. The whole-cycle limit defaults to 240 seconds. Intervals do not guarantee oracle freshness. See [oracle integration](docs/oracle-assurance.md#configuration-continuity-and-persistent-alerts), [monitoring architecture](docs/monitoring-architecture.md), [alerting](docs/alerting.md) and [optional notification setup](docs/notification-setup.md).

### HTTP runtimes

After a compatible build and the runbook's workspace/authentication prerequisites, the SQLite service entrypoint is:

```text
node dist/service.js --config config/render.json --runtime-root /var/data/watchdog/runtime --database /var/data/watchdog/storage/watchdog.sqlite
```

It requires `PORT` and `WATCHDOG_READ_API_TOKEN`, accepts optional `--risk-config` or `--position-config`, and resolves all configuration files against the release root before selecting the runtime working directory. Its supplied configuration keeps monitoring disabled and external channels off. See [SQLite runtime operations](docs/render-runtime-operations.md).

`npm run start:postgres` invokes `node dist/postgres-service.js`. It requires explicit PostgreSQL namespace/writer/reader inputs, `PORT`, and **both** distinct read and scheduler credentials, even when scheduling is disabled. It fails closed without SQLite fallback. Monitoring/position/risk JSON paths use named environment inputs; scheduler cadence defaults to 300 seconds. It starts no internal monitoring timer. See [PostgreSQL operations](docs/postgres-operations.md) and the [scheduler endpoint contract](docs/scheduler-endpoint-contract.md) before invocation.

## Configuration and operations

```powershell
npm run watchdog -- config-check --config config/monitoring.example.json
npm run watchdog -- health
npm run watchdog -- readiness
npm run watchdog -- diagnostics
```

These diagnostics do not initialize a missing database. Operational commands return 0 when their condition passes and 2 when degraded/unavailable; `readiness --probe` explicitly performs bounded RPC/MCP connectivity reads. A recent accepted live snapshot and settled cycle are required for readiness. Operational readiness never changes `productionReleaseReady: false` or financial actionability.

Use explicit `database-init` for a new store or a reviewed forward migration. Consistent backups use SQLite's online API and include all referenced evidence; `backup-verify` checks the complete bundle and `restore-verify` uses a disposable isolated copy. See [database operations](docs/database-operations.md), [operations runbook](docs/operations-runbook.md) and [rollback/recovery](docs/rollback-and-recovery.md) for exact commands and delivery-reconciliation requirements.

[Production configuration](config/production.example.json) requires an absolute local SQLite database path and keeps continuous monitoring and external channels disabled. [`.env.example`](.env.example) contains placeholders only and is not automatically loaded. Notification, HTTP, PostgreSQL, scheduler and position inputs, including entrypoint-specific path resolution, are documented in [environment and configuration](docs/environment-variables.md). Diagnostics must use the worker's same position/threshold scope.

### Selected deployment

| Item | Chain-bound identifier |
| --- | --- |
| Morpho Blue | `0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb` |
| Market | `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73` |
| Public demonstration account | `0xc6dD9976066F3364b4D6A72cD4F1fA0468327Aa7` |
| Loan | USDC, `0xC879C018dB60520F4355C26eD1a6D572cdAC1815`, 6 decimals |
| Collateral | wsrUSD, `0x4809010926aec940b550D34a46A52739f996D75D`, 18 decimals |
| LLTV | 91.5% |

The demonstration account is a public on-chain example, **not the user's wallet**. Address and chain identify the tokens; symbols are display metadata. Full contract and controller addresses are in [the oracle investigation](docs/oracle-investigation.md).

## Qualification evidence and limitations

The final preserved qualification batch of **2026-11-06** recorded **1007/1007 across 49 default test files**, runtime-process **4/4**, focused qualification **31/31**, and **1 independent pass with 3 intentionally unselected/pending**. Focused selections overlap the full suite. Typecheck, lint and an **external-output build** exited 0. These are historical results, not fresh validation from this documentation cleanup. The original Stage 2 **1006/1007** result, subsequent runtime-process correction, failed attempts and negative controls remain preserved.

The portable evidence package is complete. The [submission test-evidence section](docs/SUBMISSION-PACKAGE.md#e-test-and-build-evidence) and [evidence index](docs/SUBMISSION-PACKAGE.md#k-evidence-index) retain the original audit-environment references; their included counterparts are the [finite live-run capsule](evidence/qualification-capsules/live-stage2-SGNCxp/), [final qualification capsule](evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/), [Stage 4 research capsule](evidence/qualification-capsules/stage4-oracle-reads/), and [Stage 5A discovery capsule](evidence/qualification-capsules/stage5a-discovery/). [Package provenance](PACKAGE-PROVENANCE.md) maps historical paths to these local copies. All failures, original/corrected reports, manifests, seals and receipts remain preserved. Neither the tests nor the synthetic qualified scenario override Stage 4 **FAIL**, Stage 5A **NO QUALIFIED MARKET FOUND**, or unaccepted production readiness.

### Verification side effects

- `npm test` selects 49 default files and excludes the two integration files. Fixture tests still create temporary databases/files, local listeners and child processes. `test:unit`/`test:operations` write Phase 5 JSON reports. `test:integration` selects both real RPC/MCP tests and native PostgreSQL tests; the latter require `WATCHDOG_PG_TEST_BIN` and create a disposable local PostgreSQL 17 cluster.
- `npm run verify` plans **26 checks**, including tests/build, live/historical reads, bounded monitoring and oracle smokes, database/backup/restore work, dependency audit and evidence checks. It writes captures/reports under `evidence/phase5/`; it is not a read-only check.
- `npm run verify -- --finalize` performs five local checks but writes finalization/evidence output and regenerates the Phase 5 inventory document. Default secret/link/inventory/preservation scripts also write reports.
- `npm run release:manifest` writes a manifest/checksum; `npm run release:check` writes its check report. Existing historical manifests and seals retain their original bindings and must not be regenerated to make later changes appear historically certified.

None of these workflows was run for the documentation cleanup. Fresh executable validation needs a separately approved, preservation-aware workspace/output plan. See [testing and verification](docs/testing.md) for exact selection and side effects, and [release readiness](docs/release-readiness.md) for remaining acceptance gates.

### Historical captures and manifests

The following Phase 5 and earlier artifacts describe their own recorded source, blocks and attempts. They are preserved history, **not current implementation or release certification**:

- [Historical Phase 5 indicative risk report](evidence/phase5/risk/live/risk-report.txt)
- [Full risk result and assurance](evidence/phase5/risk/live/risk-result.json)
- [Phase 5 verification results](evidence/phase5/verification-results.json)
- [Operational CLI smoke](evidence/phase5/operations-smoke.json)
- [Bounded stability measurements](evidence/phase5/stability-results.json)
- [Release manifest](evidence/phase5/release-manifest.json)
- [Release manifest check](evidence/phase5/release-manifest-check.json)
- [Bounded oracle audits, manifests and status smoke](evidence/phase5/oracle-smoke.json)
- [Oracle evidence integrity and offline reconstruction](evidence/phase5/oracle-evidence-verification.json)
- [Bounded monitoring/restart smoke](evidence/phase5/monitoring-smoke.json)
- [All four archives preserved](evidence/phase5/prior-phases-integrity.json)
- [Exact Phase 2 historical reread](evidence/phase5/historical-regression.json)
- [Phase 4 verification results](evidence/phase4/verification-results.json)
- [Phase 3 verification results](evidence/phase3/verification-results.json)
- [Phase 2 verification results](evidence/phase2/verification-results.json)
- [Phase 1 evidence preservation](evidence/phase2/phase1-evidence-integrity.json)
- [Preserved Phase 1 report](evidence/phase1/cli-report.txt)
- [Evidence guide](docs/evidence.md)

## Documentation and historical index

- [Current submission package and qualification scope](docs/SUBMISSION-PACKAGE.md)
- [Synthetic single-position demo](docs/SUBMISSION-SINGLE-POSITION-DEMO.md)
- [Stage 3A typed suggested actions](docs/STAGE-3A-TYPED-SUGGESTED-ACTIONS.md)
- [Stage 3B runtime notifications and terminal ambiguity](docs/STAGE-3B-RUNTIME-NOTIFICATIONS.md)
- [Stage 3C configured position identity](docs/STAGE-3C-POSITION-CONFIGURATION.md)
- [Stage 3D multi-position architecture review](docs/STAGE-3D-MULTI-POSITION-ARCHITECTURE.md)
- [Stage 4 oracle investigation — FAIL](docs/STAGE-4-ORACLE-ASSURANCE-INVESTIGATION.md)
- [Stage 5A qualified-market discovery — NO QUALIFIED MARKET FOUND](docs/STAGE-5A-QUALIFIED-MARKET-DISCOVERY.md)
- [SQLite HTTP runtime operations](docs/render-runtime-operations.md)
- [PostgreSQL operations](docs/postgres-operations.md)
- [Configured scheduler contract](docs/scheduler-endpoint-contract.md)
- [A2 five-minute cadence](docs/a2-monitoring-cadence.md)
- [Historical Phase 8 report](docs/phase8-report.md)
- [Historical Phase 10 report](docs/phase10-report.md)

- [Historical Phase 5 completion report](docs/phase5-report.md)
- [Pre-implementation readiness gap register](docs/production-readiness-gaps.md)
- [Historical Phase 5 file inventory](docs/phase5-files.md)
- [Production architecture](docs/production-architecture.md)
- [Deployment procedure](docs/deployment.md)
- [Environment and configuration](docs/environment-variables.md)
- [Database operations](docs/database-operations.md)
- [Operations runbook](docs/operations-runbook.md)
- [Reliability testing](docs/reliability-testing.md)
- [Production security](docs/production-security.md)
- [Rollback and recovery](docs/rollback-and-recovery.md)
- [Release readiness](docs/release-readiness.md)
- [Phase 4 completion report](docs/phase4-report.md)
- [Phase 4 file inventory](docs/phase4-files.md)
- [Oracle assurance rules and integration](docs/oracle-assurance.md)
- [Oracle architecture and source reproduction](docs/oracle-architecture.md)
- [Oracle freshness](docs/oracle-freshness.md)
- [Independent oracle validation](docs/oracle-independent-validation.md)
- [Phase 3 completion report](docs/phase3-report.md)
- [Phase 3 file inventory](docs/phase3-files.md)
- [Phase 2 completion report](docs/phase2-report.md)
- [Risk engine, quality and provenance](docs/risk-engine.md)
- [Threshold configuration](docs/thresholds.md)
- [Repayment/collateral mathematics and proofs](docs/recommendation-math.md)
- [Architecture and validation](docs/architecture.md)
- [Official accounting and rounding](docs/accounting.md)
- [Oracle investigation: ten questions](docs/oracle-investigation.md)
- [Testing and verification](docs/testing.md)
- [Evidence and provenance](docs/evidence.md)
- [Security, quality, and read-only boundaries](docs/security-and-quality.md)
- [Prior-project pattern reuse](docs/reuse.md)
- [Phase 2 file inventory](docs/phase2-files.md)
- [Original Phase 1 file inventory](docs/created-files.md)

Historical phase reports and inventories retain their dated scope. The implemented single-position features do not establish qualified financial advice or production readiness.
