# Private publication-copy provenance

## Scope and approved decisions

This is a separately prepared copy for a future **PRIVATE** GitHub repository using evidence strategy **A: complete repository**. The intended future branch is `main`. Git initialization, staging, commits, remote creation and publication have not occurred; private visibility is an approved requirement, not a setting applied to a remote during this phase.

The verified source snapshot is `C:\liquidation-watchdog-submission\package`; this publication copy is `C:\liquidation-watchdog-github`. These locations describe preparation provenance. Reviewer navigation uses paths relative to this root: [README](README.md), [package inventory](PACKAGE-INVENTORY.md), [historical package provenance](PACKAGE-PROVENANCE.md), and the [completion report](PUBLICATION-REPORT.md).

## Original snapshot and publication derivative

The starting copy was verified at **5,096 files / 346 subdirectories / 163,521,629 bytes**, including every empty source directory. Selection used every entry in the original [SHA256SUMS.txt](SHA256SUMS.txt), plus that checksum file itself; Git ignore rules did not determine copy selection.

The unchanged original checksum file is **812,835 bytes**, SHA-256:

```text
0c90f7e32d5d7169fec84d318835d04f875561de77aaf9507e057400d8c266a8
```

That file describes the verified source snapshot. Seven approved files have different publication-copy bytes, so checking the derivative against the original inventory is expected to identify those seven differences. [PUBLICATION-INVENTORY.json](PUBLICATION-INVENTORY.json) records original/current size and SHA-256 for every source-payload path, every intentional modification, preserved directories and the new metadata path set.

| Intentionally modified file | Publication-only purpose |
|---|---|
| `.gitignore` | Exact exceptions for 321 qualified build files, seven non-database demo files and 28 approved database/sidecar/lock files (six also belong to the 13-file demo); retain unrelated local-state exclusions. |
| `.gitattributes` | Disable text conversion for complete evidence, qualified build and demo trees; retain original source-archive whitespace rules. |
| `README.md` | Portable project-root instructions, direct package/capsule navigation and completed portable-package status. |
| `.env.example` | Comment-only distinction between SQLite argument/configuration inputs and explicit PostgreSQL environment inputs; placeholder assignments unchanged. |
| `render.yaml` | Correct obsolete absent-file comments while retaining undeployed, unapproved draft status; configuration values unchanged. |
| `PACKAGE-INVENTORY.md` | Label source-snapshot counts and checksums, identify the derivative inventory and clarify historical cache preservation. |
| `PACKAGE-PROVENANCE.md` | Explain original-environment absolute paths, publication-only differences and separate checksum scopes. |

No application source, test, package dependency/lockfile, qualified build, demo artifact or historical evidence file is modified. The original source package, ZIP, Phase 3 completion report, original repository and external evidence remain protected inputs.

## Preserved evidence and historical scope

- All four complete [qualification capsules](evidence/qualification-capsules/), including failures, negative controls, original/corrected reports, manifests, seals, detached checksums and receipts, remain byte-identical.
- All 28 approved database/sidecar/lock files remain present; they are scanned and hashed as filesystem bytes without opening a database engine.
- All 13 [demo files](data/submission-demo/) and all 321 [qualified build files](dist/) remain unchanged.
- Canonical [repository evidence](evidence/repository/) and its legacy compatibility copies remain unchanged. Runtime dependencies on the checksum-pinned Phase 5 manifest and reviewed source bundles remain available.
- Twelve original Markdown snapshots and their baseline/checksum remain at [documentation provenance](evidence/documentation-provenance/phase2-originals/). The original Phase 8 document binding retains its original version scope.
- Complete capsules retain 977 historical TSX cache files. These are captured evidence, not installed dependencies or active caches.
- Original absolute references and qualified source-map paths retain their provenance. The [relocation map](PACKAGE-PROVENANCE.md#relocation-mapping) and [source-map mapping](evidence/packaging/qualified-build.json) locate included artifacts without rewriting them.

All 346 original subdirectories are retained, including 13 empty leaf directories (14 directories have no file descendants). Git cannot represent empty directories by itself. The original ZIP preserves the exact directory set; no placeholder was added inside an evidence capsule.

The unchanged original archive is `C:\liquidation-watchdog-submission\liquidation-watchdog-submission-2026-11-06.zip`, **25,324,806 bytes**, SHA-256:

```text
6acf2787d00741d3f69916df8e7e82e4e03c44fdd06397a3f62ff7fb2e026beb
```

Its original enclosing inventories, audit files and completion report remain outside this publication root. Historical paths identify where preparation occurred; they are not setup instructions or claims that historical driver scripts are portable executable workflows.

## Publication integrity records

New metadata is limited to:

1. `PUBLICATION-PROVENANCE.md` — this explanation and checksum-scope policy.
2. `PUBLICATION-REPORT.md` — completion results and limitations.
3. `PUBLICATION-INVENTORY.json` — every source payload path, before/after hashes, intentional changes and directory/new-file sets.
4. `publication-audit/baseline.json` — source checksum anchors, protected-input prechecks and exact starting-copy result.
5. `publication-audit/inspection.json` — per-file ignore results, attributes and in-memory clean hashes, documentation/dependency inspection, and privacy/security findings without secret values.
6. `publication-audit/preservation.json` — final protected-input and unchanged-evidence comparisons.
7. `PUBLICATION-SHA256SUMS.txt` — current file SHA-256 inventory.
8. `PUBLICATION-SHA256SUMS.sha256` — detached SHA-256 of that inventory.

The [publication checksum inventory](PUBLICATION-SHA256SUMS.txt) covers every file in this prepared copy except itself and its [detached digest](PUBLICATION-SHA256SUMS.sha256). The detached digest binds the inventory. This explicit two-file envelope avoids self-hashing claims. The original `SHA256SUMS.txt` is an ordinary, unchanged file inside the new inventory's coverage. No original evidence checksum or detached receipt is regenerated.

File hashing, static inspection, read-only Git rule evaluation and in-memory Git object hashing establish the preparation checks only. They do not run project verification commands or supply fresh executable validation. The original repository's existing Git metadata is used read-only for rule evaluation against this directory, with optional locks and global ignore/attribute files disabled; no `.git/` is created here.

## Privacy and licensing

The target visibility is **PRIVATE**. Historical user-specific paths, captured host/account identities and cache-directory names are deliberately preserved for provenance; authorized repository readers can see them. Private visibility does not redact those records. Findings are recorded as file paths and categories, with secret values withheld. Inert placeholders and mock credentials are distinguished from usable credentials.

**No project-wide license was selected.** No LICENSE file or `package.json` license field is added. Contents remain subject to applicable third-party notices and existing source-level license declarations, including the preserved Solidity SPDX declarations. Private visibility does not change those declarations or grant a new project-wide license.

## Qualification limits

The preserved final default-suite result remains **1007/1007 across 49 files**, with focused selections overlapping and the independent selection **one passed / three intentionally pending**. Original failures and negative controls remain included. No tests, builds, dependency installation, project verification/finalization/release commands, deployment, database operations, monitoring, notifications or external-service access are performed in this preparation.

Stage 4 remains **FAIL**; Stage 5A remains **NO QUALIFIED MARKET FOUND**; oracle assurance **UNVERIFIED**, freshness **UNKNOWN**, financial recovery recommendations **NOT QUALIFIED**, and production **NOT ACCEPTED / NO-GO**. The finite monitor run ended **STOPPED**. Real Telegram/Discord and exactly-once external delivery remain unproven. Fresh executable validation and any Git operation that changes state require a separately authorized phase.
