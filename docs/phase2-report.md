# Liquidation Watchdog — Phase 2 report

Project: `C:\liquidation-watchdog`. Scope: snapshot-bound Morpho Blue risk calculations, CLI integration, documentation and verification. All work is local and uncommitted.

**Oracle status remains UNVERIFIED. Every risk result and recovery estimate is indicative and non-actionable. Mathematical bands and target proofs do not establish current liquidation eligibility, protection, or a guaranteed real transaction outcome.**

## 1. Files added and changed

Added:

- `src/risk/{engine,types,snapshot-schema,validate,provenance,thresholds,repayment,collateral,report,evidence}.ts`.
- `src/config/{risk,evidence}.ts`, `src/cli/{options,run}.ts`, and `config/risk-thresholds.example.json`.
- Six `test/risk-*.test.ts` suites and `test/fixtures/risk.ts`.
- `scripts/phase1-integrity.ts` and `scripts/phase2-inventory.ts`.
- `docs/risk-engine.md`, `docs/thresholds.md`, `docs/recommendation-math.md`, this report, the generated Phase 2 inventory, and `evidence/phase2/` artifacts.

Changed original files:

- `src/cli.ts` and `src/domain/evidence.ts`: CLI dispatch and new-capture destination.
- `test/integration/live.test.ts`: retained Phase 1 assertions, redirected capture, and a second same-snapshot risk test.
- `package.json`, `.gitattributes`, `scripts/{verify,check-secrets,link-source-evidence,capture-sources,capture-oracle-history}.ts`: Phase 2 verification/capture routing and archive checks.
- `README.md` and `docs/{architecture,evidence,testing,security-and-quality}.md`: current commands and Phase 2 guidance.

The complete inventory, original/current hashes and preserved-core list are in `docs/phase2-files.md` and `evidence/phase2/file-changes.json`. Of the 111 original project files, 15 changed, 96 are byte-for-byte unchanged, and none are missing. Phase 1's read path, accounting, oracle policy, validation modules, original unit tests and fixtures remain the foundation. The generated inventory includes all added implementation, documentation and verification files.

## 2. Risk calculation implementation

`calculateRisk` validates a parsed copy of the Phase 1 snapshot, rechecks its identities/block/accounting/valuation and the unchanged oracle policy, then calculates exact threshold bands and target recovery. Financial arithmetic uses checked bigint uint128/uint256 operations and explicit WAD/oracle scales.

Collateral value and capacity retain Morpho's two floor divisions. Displayed LTV and safety ratio are WAD-scaled; comparisons use integer cross-products. Zero debt, zero collateral, missing data, invalid price/LLTV, overflow, stale data and snapshot mismatch are distinguished explicitly. No missing value becomes an invented zero.

The Morpho safety ratio is **not an Aave health factor**: it measures one isolated market's LLTV-adjusted capacity against its rounded-up debt. Aave uses account-level enabled collateral, liquidation thresholds and applicable portfolio configuration against debts. Their accounting and liquidation rules are not interchangeable.

Mathematical state, data quality and actionability are separate fields. Valid provisional mathematics with this oracle yields `DATA_UNVERIFIED`. Each immutable result/estimate retains block/hash/time, content-derived snapshot ID, token units, oracle limitation, method/version, assumptions and false actionability. Canonical ID encoding distinguishes bigint, arrays and objects, including lookalike serialized structures.

The final built live CLI capture is bound to block `21856848`, hash `0x241f9a8e922f99ea60b5b6f1388b131cb57198a8e51ce1acad23f176c89797be`, and snapshot ID `sha256:ccac512d063daa6646d610523c24440151dff870449e940b9ac3b7ce30b0ca89`. It was calculated at `2026-11-01T14:59:55.173Z`. Its indicative safety ratio is `1.171985087174697698`, mathematical state is `WARNING`, effective state is `DATA_UNVERIFIED`, and `actionable` is false. This is a recorded as-of-block result. The complete input, results and estimates are under `evidence/phase2/risk/live/`.

## 3. Threshold configuration

Defaults: warning `1.30`, critical `1.10`, target `1.25`, boundary `1.00`. Positive exact decimal strings are parsed to WAD. Require warning > critical > boundary and target > critical. The boundary is exactly one WAD because it describes Morpho's protocol invariant.

Precedence: defaults → explicit JSON file → CLI flags. Target 1.25 may still leave a mathematical `WARNING`; it does not imply `ABOVE_WARNING` or actionability. Exact boundary equality belongs to the requested band while Morpho's `capacity >= debt` comparison includes equality.

## 4. Repayment calculation validation

The model starts with debt-minus-allowed as a lower bound, then searches integer asset costs using actual share-burning and updated market assets/shares. Virtual assets/shares and ceil-rounded debt are retained. Full repayment uses the borrower's complete share count to avoid asset-mode over-burning.

A monotone binary search, bounded to 129 steps, proves the target and proves that one loan-base-unit less fails. The minimum covers both repay modes. Tests independently enumerate both modes, including zero-share burns, the full-share endpoint, large states and overflow.

The independent exhaustive comparison covers 1,350 small-state/capacity cases; separate checks cover monotonicity and uint128-scale positions.

The deterministic tiny fixture has debt 10, capacity 10 and target 1.25. The naive repayment of 2 leaves debt 9 and fails; the proved minimum is 3 raw loan units, leaving debt 8. It is explicitly a fixture, not a live recommendation.

## 5. Collateral calculation validation

Three nested ceiling divisions derive required capacity, value and collateral. The original two-stage floor valuation forward-checks the result; one collateral-base-unit less must fail for a positive addition. Proof failure or storage/intermediate overflow suppresses the amount. The defensive rounding correction is bounded and is zero for the exact current formulas.

The deterministic tiny fixture (`C=1`, `P=2*S`, `LLTV=floor(W/3)`, debt 1, target 1.25) requires 3 additional collateral units. The resulting capacity is 2; one unit less gives capacity 1. Exhaustive tests cover fractional prices/LLTVs, tiny units and extreme prices. Real integration checks both target inequalities at its recorded snapshot.

An independent integer search checks 624 price/LLTV/debt/collateral combinations against the solver, in addition to the explicit edge cases.

## 6. Test counts and results

**Final `npm run verify`: PASS.** The authoritative run started at `2026-11-01T14:55:08.492Z` and finished at `2026-11-01T15:00:33.493Z`, using Node.js `v24.14.1` on Windows. All 16 recorded commands exited 0.

**205/205 unit tests passed across 11 files: 78 original Phase 1 cases plus 127 new Phase 2 cases. The two real read-only integration tests also passed. No failed or skipped cases.**

| Suite | Passed cases |
| --- | ---: |
| Original accounting, oracle, snapshot, transport and validation suites | 78 |
| `test/risk-thresholds.test.ts` | 40 |
| `test/risk-engine.test.ts` | 40 |
| `test/risk-repayment.test.ts` | 12 |
| `test/risk-collateral.test.ts` | 11 |
| `test/risk-cli.test.ts` | 21 |
| `test/risk-evidence.test.ts` | 3 |
| Unit total | **205** |
| `test/integration/live.test.ts` | **2** |

The real integration used one RPC/MCP snapshot at block `21856704`, hash `0xff0f04f0613674b76270c0ad69122c7fdeb735d74d65ebe6be7e3b2372f30336`; its risk snapshot ID is `sha256:6ca75e32d467f451047352d7f52c0893eafdd4ef1e61268cd1ce3216e20b5444`. Both recovery estimates satisfied their target and one-unit-less checks while retaining unverified oracle quality and false actionability.

The final captured artifacts were also checked: **15/15 file hashes** across the integration, live CLI and historical CLI risk manifests match. Standalone estimates match the embedded estimates and their recorded provenance. All **46 local documentation links** across 14 Markdown documents resolve. These checks are recorded in `evidence/phase2/evidence-consistency.json` and `documentation-links.json`.

Full command output and test reports are in `evidence/phase2/verification-results.json`, `unit-tests.json`, and `integration-tests.json`. Post-documentation inventory, scan, preservation and whitespace rechecks are recorded separately in `evidence/phase2/finalization-results.json`.

## 7. Phase 1 regression results

The original Phase 1 unit suites and every existing live integration assertion passed. The real read validated chain 1672 on both paths, ten contracts, six sentinels, all 58 matching comparisons, stable before/after block headers, token/market identity, positive accrued debt and retained oracle `UNVERIFIED` quality. New real captures use `evidence/phase2/phase1-regression/`; risk integration and CLI captures have their own directories. The source `inspect` CLI smoke also passed at block `21856800`.

The explicit historical CLI smoke requested block `21853902`, hash `0xfe044ec9c464d3899f431b23efc307e9ccb619a71d42fdfe4c0b7a2e346c88d3`. It exactly reproduced the archived Phase 1 debt `273629792897`, collateral value `350480669854`, capacity `320689812916`, LTV WAD `780727202475920202`, and safety-ratio WAD `1171984269405613955`. Its newly retrieved input ID is `sha256:0acbb165dbdf770aa69fbe90c81e6fc32b463eed361aecb86e93ac2a7794aa31`. The capture is explicitly `HISTORICAL`, indicative and non-actionable; the exact-value comparison is recorded in `evidence-consistency.json`.

**All 54/54 Phase 1 evidence files are byte-for-byte unchanged**, with no archive additions or deletions. The exclusive pre-Phase-2 baseline also covers the 111 original project files; the preserved-core check passed. All 23 archived source hashes and all 5 source/runtime links matched, including the exact oracle-library text comparison. Evidence is in `phase1-evidence-integrity.json`, `file-changes.json`, and `source-runtime-matches.json` under Phase 2.

## 8. Build, lint and typecheck

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Built CLI `--help` | PASS |
| Source CLI `inspect --save-evidence` | PASS |
| Built CLI `risk --save-evidence` | PASS |
| Built historical `risk --block 21853902` with threshold flags | PASS; labeled `HISTORICAL` |
| `git diff --check` | PASS |

`verification-results.json` records command exit codes, times and exact output filenames. Intent-to-add bookkeeping includes newly added files in whitespace checking and creates no commit. The final documentation refresh is covered by the separate finalization check record.

## 9. Security findings

`npm audit --json` passed with **0 vulnerabilities** at every severity. The local credential-pattern scan passed with **0 findings**; its eight rules retain one exact synthetic `.test` URL exception from the original transport test. The finalization check refreshes the scan after documentation changes. No new dependencies were added, and the lockfile is byte-for-byte unchanged. The existing seven-method RPC/MCP allowlists and view/pure child-call guard remain in use. Monetary calculations use bigint; Number arithmetic is limited to clocks, presentation and nonfinancial bounds.

Final review found and fixed a canonical-encoding ambiguity between a bigint and a lookalike object. Separate type envelopes for bigint/array/object and a regression test now protect the snapshot ID. The identifier is a content binding, not an authenticity or finality proof.

The scanner reports paths/rules only and skips potential credential files without opening them. No secrets were opened, and no wallet signing, transaction broadcast, deployment, commit or push was performed. Final audit/scan findings are in `evidence/phase2/dependency-audit.json` and `secret-scan.json`.

## 10. Remaining limitations

- Economic oracle source/denomination, real-world operator identities and heartbeat remain unverified; cached price readability does not establish freshness.
- RPC and hosted MCP share an upstream. Matching reads and before/after headers do not provide independent consensus or finality.
- Estimates assume constant oracle/LLTV and no intervening interest, other market activity or bad-debt changes. Funding, token-transfer execution, gas and execution availability are outside the model.
- The application remains bound to the investigated market and public demonstration account on chain 1672.
- Source/runtime evidence links archived source and explorer metadata to runtime hashes; an independent Solidity compilation was not reproduced.
- Stored captures are valid only for their recorded block and retrieval time. Historical calculations are explicitly labeled `HISTORICAL`.

Phase 2 stops at local one-shot calculations. Further phases require separate approval.
