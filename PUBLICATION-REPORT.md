# Phase 5: private publication-copy completion report

Preparation began **2026-11-06**; completion reported **2026-11-07**. Status: **COMPLETE — LOCAL PUBLICATION COPY VERIFIED**.

Publication root: `C:\liquidation-watchdog-github`. Source: the verified package at `C:\liquidation-watchdog-submission\package`. Approved decisions are **PRIVATE** visibility, evidence strategy **A — complete repository**, **NONE** for a new project-wide license, and `main` as the intended future branch. See [publication provenance](PUBLICATION-PROVENANCE.md).

## 1. Complete-copy accounting

| Measure | Result |
|---|---:|
| Original source-package paths retained | 5,096 / 5,096 |
| Byte-identical original files | 5,089 |
| Authorized publication-only modified files | 7 |
| Additional publication metadata files | 8 |
| Final files, including both publication checksum files | 5,104 |
| Final subdirectories below the root | 347 |
| Original subdirectories retained | 346 / 346 |
| Original source-package bytes | 163,521,629 |
| Current bytes at the 5,096 original paths | 163,541,887 |
| Publication-only increase at those original paths | 20,258 |
| Additional publication metadata bytes | 4,464,927 |
| Final publication-copy bytes | 168,006,814 |
| Files covered by the new SHA-256 inventory | 5,102 |

Every original directory is retained, including 13 empty leaves and 14 directories with no file descendants. `publication-audit/` is the only additional directory. Git does not represent empty directories; the unchanged original ZIP preserves the exact original directory set. No placeholder was inserted into historical evidence.

The [original/current inventory](PUBLICATION-INVENTORY.json) records every source-payload path, size, hash, classification and directory. The [baseline](publication-audit/baseline.json) records the byte-identical starting copy. No original payload path was omitted or deleted.

## 2. Exactly seven authorized modifications

| File | Original bytes | Publication bytes | Reason |
|---|---:|---:|---|
| `.gitignore` | 144 | 14,567 | Exact qualified-build/demo/database exceptions, with unrelated local-state exclusions. |
| `.gitattributes` | 240 | 467 | Preserve evidence, qualified build and demo bytes through Git text conversion. |
| `README.md` | 21,856 | 22,960 | Portable root instructions, package/capsule links and completed packaging status. |
| `.env.example` | 484 | 1,124 | Comment-only SQLite/PostgreSQL input clarification; placeholder assignments unchanged. |
| `render.yaml` | 2,033 | 2,051 | Correct obsolete missing-file comments; deployment configuration values unchanged. |
| `PACKAGE-INVENTORY.md` | 11,845 | 13,825 | Distinguish the original snapshot from the derivative and document retained historical caches. |
| `PACKAGE-PROVENANCE.md` | 11,004 | 12,870 | Explain original-environment paths and the two checksum scopes. |

Original and publication SHA-256 values for each change are in [PUBLICATION-INVENTORY.json](PUBLICATION-INVENTORY.json). All remaining 5,089 original files match their original size and SHA-256. The two example/configuration edits were compared with comments and blank lines removed; their effective assignments remain identical.

## 3. Git inclusion and byte preservation

- All 5,096 original file paths and eight publication metadata paths pass the publication ignore rules.
- Exactly **356 file-specific exceptions** retain **321 build files**, **seven non-database demo files**, and **28 approved database/sidecar/lock files**. Six database artifacts also belong to the 13-file demo; they are counted once in the exception set.
- All **89 unrelated-file exclusion probes** pass, including private environment/credential files, dependencies, new build/demo output, unrelated databases, active caches, logs, backups and local tool configuration.
- All **4,771 evidence/build/demo files** have `text` unset (`-text`); no clean filter is selected.
- For all **ten previously affected historical files**, original/current SHA-256 and raw/clean Git blob hashes agree. The inspection uses `git hash-object` in memory without `-w`.
- Read-only Git rule evaluation uses the original repository's existing metadata with this copy as the explicit worktree. Optional locks, global/system attributes and global ignores are disabled; repository-local overrides were inspected.
- No file exceeds 50 MiB or 100 MiB. The largest is the preserved Stage 4 `chainlink-exchange-rate-streams.body.txt` capture at **16,942,643 bytes**. This snapshot requires no Git LFS. Final path-set closure is recorded with the checksum readback.

Per-path rule results, exclusion probes and all ten clean-hash comparisons are in [publication-audit/inspection.json](publication-audit/inspection.json).

## 4. Complete evidence, databases, demo and qualified build

| Preserved group | Files | Subdirectories | Bytes |
|---|---:|---:|---:|
| Complete `evidence/` tree | 4,437 | 294 | 156,362,904 |
| Root qualified `dist/` | 321 | 18 | 2,230,254 |
| `data/submission-demo/` | 13 | 0 | 1,084,585 |
| Live Stage 2 capsule | 561 | 28 | 12,341,392 |
| Qualification repair capsule | 1,782 | 92 | 24,465,407 |
| Stage 4 research capsule | 6 | 0 | 16,976,010 |
| Stage 5A discovery capsule | 29 | 0 | 387,339 |

Capsule rows are subsets of `evidence/`, not extra payload totals. All four [capsules](evidence/qualification-capsules/) are complete and byte-identical. All **28 approved database artifacts / 4,804,144 bytes** remain: six demo, seven live-capsule and fifteen repair-capsule artifacts. They were read only as filesystem bytes, without a database engine.

Canonical and legacy repository evidence, original failures, negative controls, original/corrected reports, manifests, seals, checksums, detached receipts, twelve original Markdown snapshots and their baseline remain intact. The **977 historical TSX cache files / 8,362,983 bytes** remain captured evidence. Qualified source maps retain their original bytes and the separate [packaged source mapping](evidence/packaging/qualified-build.json).

Historical binding rechecks **PASS**: **2,760 capsule bindings**, four capsule detached checksums, **224 repository artifact bindings across 34 manifests**, 21 repository detached checksums, and the original Phase 8 document binding. Historical seals retain their original version scope; no seal is represented as certifying later source or documentation.

## 5. Documentation and package-script inspection

Publication-root documentation inspection **PASS**: **800 local links across 101 Markdown files**, including **56 anchors**; **111 mapped references across twelve archival Markdown snapshots** also resolve. All linked publication metadata files are present. The 124 external links were recorded without contact.

Package-script and dependency inspection **PASS**: **23 scripts**, **12 direct dependencies** matching the lockfile, **2,138 imports across 423 code files**, ten `import.meta.url` references, eleven deployment-related paths and the configured Cloudflare worker entrypoint. The preserved runtime evidence-manifest hash matches its pinned value.

Inspection is static. It neither installs dependencies nor executes a project module or package script. The preserved runtime qualification is Node **24.14.1 / SQLite 3.51.2**; the broader engine declaration is not freshly validated. Wrangler/provider validation, Python runtime prerequisites, computed/environment paths and relocated historical driver execution retain their documented limitations.

The original `scripts/check-secrets.ts` pins the original `.env.example` bytes. Its pin remains unchanged with the source code. The authorized comment-only derivative is explicitly checked by comparing non-comment assignments and scanning the complete file; it is not a usable-credential finding. A future run of the original project checker would flag that historical template pin and needs separate review before being treated as fresh publication-copy validation.

## 6. Security, privacy and licensing

The complete-copy credential and private-file scan **PASS** covers **all 5,104 files**, using ten base and eight expanded pattern families plus credential/private-file checks. **No usable credentials were detected.** Two exact matches are inert transport/configuration-rejection fixtures; the generated PostgreSQL notification mock was separately reviewed. All three `.env.example` assignments remain placeholders. Final metadata and both checksum files are included in the closing scan. Findings are recorded only as file paths, categories and fingerprints, without secret values.

The file-level scan identified **241 original-payload files with personal-home paths** and **1,298 with audit-workspace paths**; these categories overlap, and publication metadata also repeats provenance paths. Cache-directory identity components and two captured host/account inventory copies remain deliberately preserved. They are visible to authorized readers of the intended **PRIVATE** repository. Historical absolute paths identify the original audit environment; reviewer navigation and setup context use relative publication-root paths. No historical redaction or credential substitution was performed.

No project-wide license was selected. No LICENSE file or `package.json` license field was added. Existing third-party/source-level notices remain unchanged, including **36 captured Solidity SPDX declarations** across canonical and compatibility copies (`BUSL-1.1`, `GPL-2.0-or-later`, and `MIT`). Private visibility does not alter their terms or grant a new project-wide license.

## 7. Protected-input preservation

Protected-input comparison **PASS**. The [preservation record](publication-audit/preservation.json) covers the original repository and raw Git state, full source delivery, verified source package, original ZIP and completion report, external capsule/document originals and detached receipt. All compared file paths, sizes, SHA-256 values and directory sets match their protected baselines.

Protected baselines:

- Original repository: **22,032 files / 1,909 subdirectories / 273,814,522 bytes**.
- Source delivery: **5,150 files / 348 subdirectories / 215,559,068 bytes**; its complete outer inventory covers 5,148 files plus the two-file checksum envelope.
- Source package: **5,096 files / 346 subdirectories / 163,521,629 bytes**.
- Original Git index: **65,736 bytes**, SHA-256 `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689`.
- Original Git state: unborn `HEAD` at `refs/heads/master`, empty staged diff, 550 intent-to-add entries, 793 untracked files and 20,669 ignored entries. The future `main` decision does not change that original state.

## 8. Original and publication integrity records

| Original protected artifact | Bytes | SHA-256 |
|---|---:|---|
| Original `SHA256SUMS.txt` | 812,835 | `0c90f7e32d5d7169fec84d318835d04f875561de77aaf9507e057400d8c266a8` |
| Original outer `COMPLETE-SHA256SUMS.txt` | 858,903 | `f2d3f524096916f7431b48aa748191684a487f3e3e2312a803f7745a99689bbf` |
| Original source ZIP | 25,324,806 | `6acf2787d00741d3f69916df8e7e82e4e03c44fdd06397a3f62ff7fb2e026beb` |
| Original Phase 3 completion report | 12,631 | `3ca6501ba78ec12ba1ccc7ec6b0a8c874066b839dc5eecb210ab7dfd56db4783` |

The original [SHA256SUMS.txt](SHA256SUMS.txt) remains byte-identical and describes its original 5,095 other source files. Seven expected derivative differences do not indicate a failure of the original package's integrity.

The new [PUBLICATION-SHA256SUMS.txt](PUBLICATION-SHA256SUMS.txt), **813,489 bytes**, covers **5,102 current files**, including this report and the unchanged original checksum file. Only itself and [PUBLICATION-SHA256SUMS.sha256](PUBLICATION-SHA256SUMS.sha256), **93 bytes**, are excluded. The detached file contains the publication inventory's final SHA-256; the same digest is supplied in the delivery response. Repeating that digest inside this covered report would create a circular hash dependency, so the detached record is the authoritative digest location. Final checksum readback validates every entry, exact path/directory sets and the detached digest.

The eight additional files are [publication provenance](PUBLICATION-PROVENANCE.md), [this report](PUBLICATION-REPORT.md), [the inventory](PUBLICATION-INVENTORY.json), [baseline](publication-audit/baseline.json), [inspection](publication-audit/inspection.json), [preservation](publication-audit/preservation.json), [publication checksums](PUBLICATION-SHA256SUMS.txt), and [their detached digest](PUBLICATION-SHA256SUMS.sha256). No original manifest, seal, receipt or checksum was regenerated.

## 9. Historical qualification and remaining limits

The preserved default-suite result is **1007/1007 across 49 files**; focused selections overlap it, and the independent selection remains **one passed / three intentionally pending**. The original **1006/1007** failure and negative controls remain included. These are historical results, not tests rerun during publication preparation.

Stage 4 remains **FAIL**; Stage 5A **NO QUALIFIED MARKET FOUND**; oracle assurance **UNVERIFIED**; freshness **UNKNOWN**; financial recovery recommendations **NOT QUALIFIED**; production **NOT ACCEPTED / NO-GO**. The finite monitor remains **STOPPED**. Real Telegram/Discord and exactly-once external delivery remain unproven.

## 10. Stop boundary and completion decision

Preparation blockers: **NONE**. The complete local copy is ready for the user's next approval. Fresh executable validation, the historical template-pin review, and any future GitHub publication remain separate authorized work. The historical production/market limitations above are unchanged.

This phase performs filesystem/static inspection and explicitly authorized read-only Git rule/hash checks. No `.git/` is created in this copy; no Git initialization, staging, commit, remote creation, push or GitHub contact occurs. No dependency installation, build, test, project verification/finalization/release command, deployment, database operation, monitor run, notification or external-service call occurs.

The handoff stops at the prepared local publication copy and awaits approval.
