# Evidence and provenance

Completed archives are under `evidence/phase1/` through `evidence/phase4/`; every new capture and check is under `evidence/phase5/`. These contain public chain data, public contract/source metadata, and local verification outputs. Financial bigint fields are decimal strings. Every chain snapshot carries chain ID, block number/hash/timestamp, retrieval time, and the explicit public-demonstration-account role.

The pre-Phase-2 baseline records 54 Phase 1 evidence files and 111 original project files. `phase1-evidence-integrity.json` records byte-for-byte SHA-256 comparisons, including added/deleted archive detection. The baseline is created exclusively and cannot be overwritten by capture. Phase 2 file changes are recorded in `file-changes.json`.

The exclusive pre-Phase-3 baseline adds all 213 then-existing project files, including 54 Phase 1 and 73 Phase 2 evidence files. Its preservation checker still validates both archives, 15 Phase 2 risk-artifact hashes and three exact typed-input/full-result replays. Raw RPC/MCP JSON wire fields retain their original types during bigint revival; the canonical snapshot identifier is checked before accepting replay equality.

The exclusive pre-Phase-5 baseline covers **550 files**, including **391 Phase 1–4 evidence files (54 / 73 / 77 / 187)**. Its SHA-256 is `043b6c7a7ae68515b7c17379619a090d24a01d361f5ba72816d89da97b93f9e2`. The [pre-implementation gap register](production-readiness-gaps.md) is independently anchored by `evidence/phase5/gap-register-record.json`. Both anchors and all four archives remain unchanged. Current inventory output is `evidence/phase5/file-changes.json`; completed reports/inventories retain their historical meaning.

## Main live snapshot artifacts

These Phase 1-format files are emitted by `inspect --save-evidence` into `evidence/phase5/inspect/live/` (or its historical block directory), and by integration into `evidence/phase5/phase1-regression/`. Original files are preserved:

| Artifact | Contents |
| --- | --- |
| `position-snapshot.json` | Complete typed report, quality findings, raw read trace, accounting, and provenance |
| `cli-report.txt` | Human-readable report generated from exactly that snapshot |
| `network-verification.json` | Chain IDs, endpoint addresses, observed heads and selected block |
| `contract-verification.json` | Ten runtime code lengths, Keccak-256/SHA-256 hashes, pins and path agreement |
| `market-parameters.json` | Actual market parameters/state and token addresses/metadata |
| `market-id-verification.json` | Requested versus parameter-derived market ID |
| `oracle-investigation-live.json` | Price, composition, feed/cache/controller reads, timestamps, age, policy and findings |
| `mcp-rpc-comparison.json` | All per-value/code/header comparisons and provider-independence qualification |
| `block-consistency.json` | Initial/final headers from each path, sentinel count, comparison digests |
| `accounting.json` | Accrual intermediates, expected totals, debt, valuation, and non-actionable flag |
| `read-trace.json` | Public read inputs/results, block tags, source endpoint, method, and response time |

`LIVE_CHAIN_READ` means actual live retrieval at the recorded time. A saved live read becomes historical as time passes; the label does not claim it remains the current chain state. `--block` explicitly uses `HISTORICAL_SNAPSHOT` and a separate block-specific directory.

The trace records public responses without HTTP headers, MCP session identifiers, environment dumps, wallet material, or authentication values. Top-level transport failure becomes an explicit finding; failed multicall children remain in raw bytes/success flags. A trace of successful responses is not a log of every low-level retry attempt.

## Source material

`sources/manifest.json` classifies fetched material as version-pinned official source, explorer-verified source, or explorer verification metadata. It records each URL, retrieval time, and exact captured-content SHA-256. Official registry excerpts are in a separate file with the full response hash.

Current verification reads the preserved Phase 1 source archive, compares it to the new integration snapshot, and writes `evidence/phase5/source-runtime-matches.json`. Optional fresh source capture writes only to `evidence/phase5/sources/`.

Fetched Solidity archives retain their original bytes, including source-provided CRLF or final blank lines. `.gitattributes` disables newline conversion and exempts only CR-at-EOL/final-blank-line whitespace checks for those archives. Project code remains subject to normal whitespace checks. Generated verification logs normalize line endings and trailing blank lines; the source archives are not normalized.

`source-runtime-matches.json` links explorer metadata for the proxy, cache, market oracle, forwarder, and Multicall3 to the main snapshot's runtime SHA-256. It also verifies all archived file hashes and the official/deployed oracle-library exact text match. Runtime Keccak-256 remains available separately.

These source/runtime links support deployed-source attribution. Independent Solidity reconstruction is recorded separately in Phase 4's preserved bundles and rechecked in `oracle-evidence-verification.json`. Neither establishes the feed's off-chain economic inputs or independent provider consensus.

## Historical observations and fixtures

`oracle-update-history.json` is anchored at block **21,852,148** with hash `0xb07299fc97a3743868dd26dd3556131ad0374e0b61ea5a7f565a6b65a6429130`. It records eight bounded ranges, three update events, their headers, a successful delivery receipt, and the anchor recheck. Its observations are historical even when the main integration snapshot moves forward.

The historical runtime fixture under `test/fixtures/` has its own block and capture metadata. Synthetic state/client fixtures are explicitly `FIXTURE`; they do not inherit live status just because some input numbers or code bytes were once read from chain.

## Verification artifacts

The following filenames are produced under Phase 5 for current checks; prior archives keep their original results:

- `verification-results.json`: overall result, command exit codes and UTC start/finish times.
- `unit-tests.json`, `operations-tests.json`, `integration-tests.json`: machine-readable Vitest reports; corresponding `.txt` logs identify the execution. Operations repeats a subset of unit tests.
- `stability-results.json`: bounded synthetic-time experiment with real local timing/resource measurements and zero external calls.
- `typecheck.txt`, `lint.txt`, `build.txt`, `built-cli-smoke.txt`: compiler/linter/build output.
- `source-runtime-links.txt`: archived-hash and runtime-attribution check output.
- `dependency-audit.json` and `.txt`: dependency audit snapshot.
- `secret-scan.json`, `secrets-check.txt`: bounded local secret-pattern scan, paths/rules only if a finding exists.
- `project-whitespace.json`, `project-whitespace-check.txt`, `git-diff-check.txt`: read-only new-file and existing-file Git whitespace results. The real index is not modified.
- `verification-inputs.json`, `build-artifacts.json`: exact source/configuration and emitted-build fingerprints recorded during verification.
- `finalization-results.json`: five final local checks against unchanged tested source inputs.
- `verification-runs/<uuid>/`: immutable per-attempt command transcripts and test/report copies, including failures. Canonical top-level filenames show the latest attempt.
- `release-manifest.json`, `release-manifest.sha256`, `release-manifest-check.json`: final source/build/document/evidence binding, checksum and check. These three self/check files are the only self-hash exclusions.

## Phase 2 risk artifacts

`risk --save-evidence` writes the complete input snapshot, risk result, text report, two self-contained recovery estimates, and a final manifest of file hashes. Each estimate retains input snapshot identifier, block/hash/time, tokens, method/version, rounding, assumptions, oracle quality and `actionable: false`. The risk engine's canonical typed snapshot identifier and the serialized-file SHA-256 serve different purposes. See [risk-engine provenance](risk-engine.md).

Live CLI, explicitly historical CLI and live integration use distinct directories. A label is provenance for the recorded capture, not evidence that a stored result stays current. Phase 2 preservation and current test outputs never replace Phase 1 artifacts.

## Phase 3 monitoring artifacts

`monitoring-smoke.json` and four `monitor-smoke-*.txt` files record two bounded console-only live monitor processes and history/status commands. The main SQLite runtime store is local ignored `data/` state, separate from capture archives. Alert/current/prior projections contain only schema-validated public fields; provider credentials, destinations and raw exceptions are excluded. Read [monitoring storage](monitoring-architecture.md) for retention and restart guarantees.

## Oracle and operational artifacts

Oracle audits create exclusive UUID-named bundles with manifest hashes and explicit live/historical provenance. Each current verification rechecks the preserved source/compiler/immutable-binding proofs, all reviewed references, and all Phase 4/5 oracle bundles. Runtime reproduction does not verify operator identity, economic quote semantics or freshness. See [oracle architecture](oracle-architecture.md).

`operations-smoke.json` records 15 built-CLI invocations with expected success/degraded exits, explicit read-only connectivity, consistent backup and isolated restore. Runtime databases, test scratch and backups are private ignored local files; sanitized summaries are captured as evidence. Backups include a standalone SQLite file, every persisted saved/reviewed evidence reference and all required complete bundles. [Database operations](database-operations.md) documents validation and recovery semantics.

Capture writers apply bounded file/inventory budgets and reject unsafe local paths. Ordinary monitoring cycles store projections rather than full snapshot bundles. No automatic evidence deletion runs. Release hashes are integrity bindings, not signatures or production approval; modifying a bound file requires updated verification/finalization and manifest generation.

## Reproduction and refresh

```powershell
npm run watchdog -- inspect --save-evidence
npm run evidence:sources
npm run evidence:oracle-history
npm run verify
```

These are **separate optional actions**, not a schedule. The main verification pipeline does not rerun the optional historical-log capture script; bounded oracle audits have their own constrained history reads. Source capture writes fresh timestamps under Phase 5; the optional history script uses the preserved Phase 1 snapshot as its explicitly historical anchor and writes its result under Phase 5. The runtime-fixture extraction script is one-time and refuses to overwrite an existing fixture.

To reproduce a saved position, pass its block to `inspect --block <decimal>`. Success depends on the endpoints retaining access to that historical state. Compare values at the same block, and preserve the retrieval-time distinction.
