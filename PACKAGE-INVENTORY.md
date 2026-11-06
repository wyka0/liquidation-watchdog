# Submission package inventory

The verified source package was prepared 2026-11-06 from the preserved local working copy. This private-publication derivative retains every source-package path and adds separately identified publication records. Start with [README](README.md), the current [submission summary](docs/SUBMISSION-PACKAGE.md), [package provenance](PACKAGE-PROVENANCE.md), and [publication provenance](PUBLICATION-PROVENANCE.md).

Historical absolute paths identify the original audit environment; they are not setup instructions. Use the relative packaged locations below from this copy's root. [PUBLICATION-INVENTORY.json](PUBLICATION-INVENTORY.json) records every original path, original/current hash, intentional change and new metadata path.

## Contents

The verified source payload contained **5,096 files**, **346 directories below its root** (347 including the root), and **163,521,629 bytes**: 5,089 byte-identical copies and 7 Phase 3 package-specific metadata/checksum files. All 5,096 paths and all original directories remain present here, including empty directories. Seven authorized publication-only files now differ; new publication metadata is additional. These are source-snapshot counts, not a claim that the publication derivative has the same total size. See the [publication report](PUBLICATION-REPORT.md) for the prepared copy's counts and checks.

| Destination | Phase 3 copied files | Source subdirectories | Phase 3 copied bytes |
|---|---:|---:|---:|
| `src/` | 107 | 18 | 665,580 |
| `test/` | 66 | 3 | 570,263 |
| `scripts/` | 34 | 0 | 201,505 |
| `config/` | 5 | 0 | 3,566 |
| `cloudflare/` | 2 | 2 | 6,704 |
| `deploy/` | 1 | 0 | 1,319 |
| `docs/` | 94 | 0 | 1,379,947 |
| `./` | 13 | 0 | 179,318 |
| `data/submission-demo/` | 13 | 0 | 1,084,585 |
| `evidence/repository/` | 1,020 | 81 | 46,717,855 |
| `evidence/` | 1,020 | 81 | 46,717,855 |
| `evidence/qualification-capsules/live-stage2-SGNCxp/` | 561 | 28 | 12,341,392 |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/` | 1,782 | 92 | 24,465,407 |
| `evidence/qualification-capsules/stage4-oracle-reads/` | 6 | 0 | 16,976,010 |
| `evidence/qualification-capsules/stage5a-discovery/` | 29 | 0 | 387,339 |
| `dist/` | 321 | 18 | 2,230,254 |
| `evidence/documentation-provenance/phase2-originals/` | 14 | 2 | 5,897,660 |
| `evidence/qualification-support/` | 1 | 0 | 12,951 |

The rows describe the original Phase 3 copy operations, before publication-only documentation/configuration edits. The complete repair capsule already contains the selected build; root `dist/` is a deliberate byte-identical additional copy. Repository evidence is deliberately present at both its canonical and legacy compatibility paths. Phase 3 copied bytes total **159,839,510**; its generated metadata bytes are measured in the original external inventory.

Required root inputs include `package.json`, `package-lock.json`, both TypeScript configurations, both Vitest configurations, `eslint.config.mjs`, `.gitattributes`, `.gitignore`, the placeholder-only `.env.example`, `README.md`, and both Render examples. All current source, 66 test/fixture files, 34 scripts, 94 documents under `docs/`, five configuration examples, the Cloudflare Worker/TOML and the systemd example are included. File selection did not depend on Git tracking or ignore status.

## Complete capsules

| Capsule | Files | Subdirectories | Bytes |
|---|---:|---:|---:|
| [live-stage2-SGNCxp](evidence/qualification-capsules/live-stage2-SGNCxp/) | 561 | 28 | 12,341,392 |
| [qualification-repair-20261106-QrN8p4](evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/) | 1,782 | 92 | 24,465,407 |
| [stage4-oracle-reads](evidence/qualification-capsules/stage4-oracle-reads/) | 6 | 0 | 16,976,010 |
| [stage5a-discovery](evidence/qualification-capsules/stage5a-discovery/) | 29 | 0 | 387,339 |

All captured failures, intermediate attempts, original/corrected reports, manifests, seals, checksum sidecars, receipts, negative controls and qualification limitations remain present. The 13-file [submission demo](data/submission-demo/) is preserved unchanged.

## Explicit evidence database exception

The user approved preservation of exactly **28** historical SQLite/database-sidecar/lock files: six in the demo, seven in the live capsule and fifteen in the repair capsule. These files were handled only as filesystem bytes and secret-scanned. No database engine was opened.

| Preserved file | Bytes | SHA-256 |
|---|---:|---|
| `data/submission-demo/qualified-fixture.sqlite` | 327,680 | `4253ae4acea8f98d255c1697321424f26e26f53c16c734ceed9d8f62e869e606` |
| `data/submission-demo/qualified-fixture.sqlite-monitor-lock` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `data/submission-demo/watchdog.sqlite` | 684,032 | `208ef171f3b852d04b63cedf7c481838839cff5bacb460c7e4e0616b2a719041` |
| `data/submission-demo/watchdog.sqlite-monitor-lock` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `data/submission-demo/watchdog.sqlite-shm` | 32,768 | `fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb` |
| `data/submission-demo/watchdog.sqlite-wal` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `evidence/qualification-capsules/live-stage2-SGNCxp/unit-tmp/opencode/watchdog-phase3-fixture-aKX2ke/storage/runtime-owner.sqlite` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `evidence/qualification-capsules/live-stage2-SGNCxp/unit-tmp/opencode/watchdog-phase3-fixture-aKX2ke/storage/watchdog.sqlite` | 704,512 | `ab165ab7f6467564b373216fe71bfb80daa0ab9df1363839620d23e24a4813d2` |
| `evidence/qualification-capsules/live-stage2-SGNCxp/unit-tmp/opencode/watchdog-phase3-fixture-aKX2ke/storage/watchdog.sqlite-monitor-lock` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `evidence/qualification-capsules/live-stage2-SGNCxp/watchdog.sqlite` | 471,040 | `1d1bf776dfcec3dcf13f7a4a146c2ce9b7f201948f1d3af4d044a9f4836b1fa6` |
| `evidence/qualification-capsules/live-stage2-SGNCxp/watchdog.sqlite-monitor-lock` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `evidence/qualification-capsules/live-stage2-SGNCxp/watchdog.sqlite-shm` | 32,768 | `fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb` |
| `evidence/qualification-capsules/live-stage2-SGNCxp/watchdog.sqlite-wal` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/final-read-only-store-copies/stage2-watchdog.sqlite` | 471,040 | `1d1bf776dfcec3dcf13f7a4a146c2ce9b7f201948f1d3af4d044a9f4836b1fa6` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/final-read-only-store-copies/stage2-watchdog.sqlite-shm` | 32,768 | `fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/final-read-only-store-copies/stage2-watchdog.sqlite-wal` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-budget-latency-negative-control/temp/opencode/watchdog-phase3-fixture-6YWCia/storage/runtime-owner.sqlite` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-budget-latency-negative-control/temp/opencode/watchdog-phase3-fixture-6YWCia/storage/runtime-owner.sqlite-journal` | 512 | `eb2a12cf03105e83715c85d87b29becac6d8116f17f8f0fca7687288fa5d34ca` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-budget-latency-negative-control/temp/opencode/watchdog-phase3-fixture-6YWCia/storage/watchdog.sqlite` | 131,072 | `ec0772cd73a9073ebe75e2f9665a490dbc56d37212884471d8e7e89b3dd61f91` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-budget-latency-negative-control/temp/opencode/watchdog-phase3-fixture-6YWCia/storage/watchdog.sqlite-monitor-lock` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-budget-latency-negative-control/temp/opencode/watchdog-phase3-fixture-6YWCia/storage/watchdog.sqlite-monitor-lock-journal` | 512 | `3e2b41f500ce16aa2bc464e759b097c1e272d5c2f4429a02d60557a1146af71f` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-budget-latency-negative-control/temp/opencode/watchdog-phase3-fixture-6YWCia/storage/watchdog.sqlite-shm` | 32,768 | `26f2a2f5190818dfa4915022ed96a41ba7e0d232304fdf392fc4bda39ba85ca4` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-budget-latency-negative-control/temp/opencode/watchdog-phase3-fixture-6YWCia/storage/watchdog.sqlite-wal` | 1,145,392 | `83ecec86a320b49f4ec6b17e763f3eb0f70d5203040de9a4e97fe616b5a89679` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-failure-database-copies/runtime-owner.sqlite` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-failure-database-copies/watchdog.sqlite` | 704,512 | `ab165ab7f6467564b373216fe71bfb80daa0ab9df1363839620d23e24a4813d2` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-failure-database-copies/watchdog.sqlite-monitor-lock` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-failure-database-copies/watchdog.sqlite-shm` | 32,768 | `fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb` |
| `evidence/qualification-capsules/qualification-repair-20261106-QrN8p4/original-failure-database-copies/watchdog.sqlite-wal` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

## Complete machine-readable inventories

- [Original Phase 3 copy map](evidence/packaging/copy-map.json): every copied path, historical source path, size and SHA-256; full directory set; original-document mappings; omission categories. This historical record is unchanged.
- [Original SHA256SUMS.txt](SHA256SUMS.txt): unchanged hashes of all 5095 other files in the verified source-package snapshot. The seven publication-only modifications are expected differences from this original snapshot, not historical integrity failures.
- [Publication inventory](PUBLICATION-INVENTORY.json): complete original/current file comparison, intentional modifications and additional metadata paths.
- [Publication SHA256SUMS](PUBLICATION-SHA256SUMS.txt) and [detached digest](PUBLICATION-SHA256SUMS.sha256): prepared-copy integrity, with the two checksum-envelope files explicitly excluded from self-hashing.
- [Qualified-build analysis and source mappings](evidence/packaging/qualified-build.json).
- [Candidate security and exception record](evidence/packaging/security-review.json).
- [Preparation and static inspections](evidence/packaging/preparation-record.json).

The original checksum file cannot contain its own final digest. The source delivery's enclosing `audit/package-tree.json` and `COMPLETE-SHA256SUMS.txt` include its digest and all original payload files. That enclosing archive, completion report and audit records remain at their original delivery location; they are not new files in this publication root. The unchanged ZIP contains the original payload under `liquidation-watchdog/`. Original and publication checksum scopes are distinguished in [publication provenance](PUBLICATION-PROVENANCE.md).

## Exclusions and external prerequisites

- `.git/`: 20 files / 92,026 bytes. Original Git state is preserved and independently compared before/after packaging.
- `node_modules/`: 20,071 files / 165,663,351 bytes. Dependency manifests and lockfile are included; no dependency installation was performed.
- `data/` outside `data/submission-demo/`: 264 files / 55,022,800 bytes of unrelated runtime state.
- `opencode.jsonc`: one local configuration file / 264 bytes.
- The original repository `dist/` candidate: 321 files / 2,225,439 bytes; the separately identified qualified build supplies the package's `dist/`.
- Usable credentials, private keys, personal environment files and unrelated runtime databases are not included. `.env.example` retains only inert placeholder assignments; its publication edits clarify entrypoint scope in comments.
- Complete historical capsules intentionally retain **977 captured TSX cache files / 8,362,983 bytes**. These are preserved evidence, not active local dependencies or newly generated caches. Unrelated active caches and runtime output remain excluded by the publication ignore rules.
- Other historical temp workspaces, provider services, host-installed tools and operator-supplied configuration referenced in records are not recursively bundled. The exact source-to-package map identifies the included bytes.

Declared Node range is `>=22.18.0`; preserved runtime qualification is Node **24.14.1 / SQLite 3.51.2**. Wrangler is not a pinned project dependency; Cloudflare provider-runtime validation remains pending as documented in [A3 setup](docs/a3-cloudflare-setup.md). The standalone deployment TOML inspection script needs a compatible Python runtime with `tomllib`. Host paths and secret names in deployment examples remain operator prerequisites.

Fresh tests, builds, installation, runtime validation and deployment were not performed during packaging. Package integrity is a byte/path preservation result; production acceptance and oracle/financial qualification retain their documented limitations.
