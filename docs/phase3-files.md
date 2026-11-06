# Phase 3 file inventory

Generated against the exclusive pre-Phase-3 baseline of both completed phases.

Original files: 213; changed: 19; unchanged: 194; missing: 0; added: 112.
Phase 1 readers/accounting/oracle/validation and Phase 2 risk core: byte-for-byte unchanged.

Hashes and complete unchanged/core lists: `evidence/phase3/file-changes.json`. Runtime databases, dependencies, build output, Git internals, coverage and symlinks are excluded.

## Changed original files

- `.gitignore`
- `README.md`
- `docs/architecture.md`
- `docs/evidence.md`
- `docs/security-and-quality.md`
- `docs/testing.md`
- `package.json`
- `scripts/capture-oracle-history.ts`
- `scripts/capture-sources.ts`
- `scripts/check-secrets.ts`
- `scripts/link-source-evidence.ts`
- `scripts/phase1-integrity.ts`
- `scripts/phase2-inventory.ts`
- `scripts/verify.ts`
- `src/cli/options.ts`
- `src/cli/run.ts`
- `src/config/evidence.ts`
- `test/integration/live.test.ts`
- `test/risk-cli.test.ts`

## Added files

- `config/monitoring.example.json`
- `docs/alerting.md`
- `docs/monitoring-architecture.md`
- `docs/notification-setup.md`
- `docs/phase3-files.md`
- `docs/phase3-report.md`
- `evidence/phase3/bounded-monitoring-restart-smoke.txt`
- `evidence/phase3/build.txt`
- `evidence/phase3/built-cli-historical-risk-smoke.txt`
- `evidence/phase3/built-cli-risk-smoke.txt`
- `evidence/phase3/built-cli-smoke.txt`
- `evidence/phase3/cli-inspect-smoke.txt`
- `evidence/phase3/dependency-audit.json`
- `evidence/phase3/dependency-audit.txt`
- `evidence/phase3/documentation-links.json`
- `evidence/phase3/documentation-links.txt`
- `evidence/phase3/file-changes.json`
- `evidence/phase3/git-diff-check.txt`
- `evidence/phase3/git-intent-to-add.txt`
- `evidence/phase3/historical-phase2-regression.txt`
- `evidence/phase3/historical-regression.json`
- `evidence/phase3/inspect/live/accounting.json`
- `evidence/phase3/inspect/live/block-consistency.json`
- `evidence/phase3/inspect/live/cli-report.txt`
- `evidence/phase3/inspect/live/contract-verification.json`
- `evidence/phase3/inspect/live/market-id-verification.json`
- `evidence/phase3/inspect/live/market-parameters.json`
- `evidence/phase3/inspect/live/mcp-rpc-comparison.json`
- `evidence/phase3/inspect/live/network-verification.json`
- `evidence/phase3/inspect/live/oracle-investigation-live.json`
- `evidence/phase3/inspect/live/position-snapshot.json`
- `evidence/phase3/inspect/live/read-trace.json`
- `evidence/phase3/integration-tests.json`
- `evidence/phase3/lint.txt`
- `evidence/phase3/monitor-smoke-alerts.txt`
- `evidence/phase3/monitor-smoke-once.txt`
- `evidence/phase3/monitor-smoke-restart.txt`
- `evidence/phase3/monitor-smoke-status.txt`
- `evidence/phase3/monitoring-smoke.json`
- `evidence/phase3/phase1-evidence-integrity.json`
- `evidence/phase3/phase1-evidence-integrity.txt`
- `evidence/phase3/phase1-regression/accounting.json`
- `evidence/phase3/phase1-regression/block-consistency.json`
- `evidence/phase3/phase1-regression/cli-report.txt`
- `evidence/phase3/phase1-regression/contract-verification.json`
- `evidence/phase3/phase1-regression/market-id-verification.json`
- `evidence/phase3/phase1-regression/market-parameters.json`
- `evidence/phase3/phase1-regression/mcp-rpc-comparison.json`
- `evidence/phase3/phase1-regression/network-verification.json`
- `evidence/phase3/phase1-regression/oracle-investigation-live.json`
- `evidence/phase3/phase1-regression/position-snapshot.json`
- `evidence/phase3/phase1-regression/read-trace.json`
- `evidence/phase3/phase3-inventory.txt`
- `evidence/phase3/prior-phases-baseline.json`
- `evidence/phase3/prior-phases-integrity.json`
- `evidence/phase3/prior-phases-integrity.txt`
- `evidence/phase3/risk-integration/collateral-estimate.json`
- `evidence/phase3/risk-integration/input-snapshot.json`
- `evidence/phase3/risk-integration/manifest.json`
- `evidence/phase3/risk-integration/repayment-estimate.json`
- `evidence/phase3/risk-integration/risk-report.txt`
- `evidence/phase3/risk-integration/risk-result.json`
- `evidence/phase3/risk/historical-21853902/collateral-estimate.json`
- `evidence/phase3/risk/historical-21853902/input-snapshot.json`
- `evidence/phase3/risk/historical-21853902/manifest.json`
- `evidence/phase3/risk/historical-21853902/repayment-estimate.json`
- `evidence/phase3/risk/historical-21853902/risk-report.txt`
- `evidence/phase3/risk/historical-21853902/risk-result.json`
- `evidence/phase3/risk/live/collateral-estimate.json`
- `evidence/phase3/risk/live/input-snapshot.json`
- `evidence/phase3/risk/live/manifest.json`
- `evidence/phase3/risk/live/repayment-estimate.json`
- `evidence/phase3/risk/live/risk-report.txt`
- `evidence/phase3/risk/live/risk-result.json`
- `evidence/phase3/secret-scan.json`
- `evidence/phase3/secrets-check.txt`
- `evidence/phase3/source-runtime-links.txt`
- `evidence/phase3/source-runtime-matches.json`
- `evidence/phase3/test-integration.txt`
- `evidence/phase3/test-unit.txt`
- `evidence/phase3/typecheck.txt`
- `evidence/phase3/unit-tests.json`
- `evidence/phase3/verification-results.json`
- `scripts/check-doc-links.ts`
- `scripts/monitoring-smoke.ts`
- `scripts/phase3-files.ts`
- `scripts/phase3-inventory.ts`
- `scripts/phase3-live-regression.ts`
- `scripts/phase3-preservation.ts`
- `src/cli/monitor-options.ts`
- `src/cli/monitor.ts`
- `src/config/monitoring.ts`
- `src/monitoring/logs.ts`
- `src/monitoring/model.ts`
- `src/monitoring/observation.ts`
- `src/monitoring/reader.ts`
- `src/monitoring/service.ts`
- `src/monitoring/transitions.ts`
- `src/notifications/adapters.ts`
- `src/notifications/dispatcher.ts`
- `src/notifications/format.ts`
- `src/notifications/types.ts`
- `src/storage/migrations.ts`
- `src/storage/store.ts`
- `test/fixtures/monitoring.ts`
- `test/monitoring-cli.test.ts`
- `test/monitoring-config.test.ts`
- `test/monitoring-safety.test.ts`
- `test/monitoring-service.test.ts`
- `test/monitoring-storage.test.ts`
- `test/monitoring-transitions.test.ts`
- `test/notifications.test.ts`

## Missing original files

None.
