# Phase 7 file inventory

Phase 7 adds **six Markdown documents and one unapproved Blueprint draft**, all local and uncommitted. No application implementation was added. The final inventory is measured against the preserved pre-Phase-7 project, not against this repository's older Git intent-to-add state.

## Deliverables

| Path | Purpose |
| --- | --- |
| `docs/render-architecture.md` | Actual application/import/worker findings, Render topology decision, read API/dashboard contract and fixed invariants |
| `docs/render-deployment-plan.md` | Supported service settings, runtime/evidence layout, lifecycle, resources/cost, backup/recovery and Phase 8 acceptance sequence |
| `docs/render-storage-decision.md` | Cross-instance SQLite answer, Option A/B comparison and required future migration invariants |
| `docs/render-security-plan.md` | Proposed endpoint/auth/read boundaries, DTO omissions, HTTP bounds, secrets, logging and operator/recovery controls |
| `docs/phase7-report.md` | Twelve requested report sections, final verification, exact-recovery disclosure and remaining blockers |
| `docs/phase7-files.md` | This inventory and its hash-binding convention |
| `render.yaml` | **DRAFT-UNAPPROVED-NOT-DEPLOYED** configuration; nonexistent service/config entrypoints; local schema review only |

## Final byte hashes

These values bind the final bytes of the other six deliverables. This inventory is self-excluded to avoid a circular self-hash. All seven final hashes, including this inventory's own hash, are recorded in `[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase7-validation-fqzKjQ\phase7-file-bindings.json`; `final-results.json` in that directory records the final verification outcome and timestamps.

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `docs/render-architecture.md` | 15,183 | `847d0cf046a6e4e9d6032ce67bac0e381cc61c53930a82e24a068d931717d6cc` |
| `docs/render-deployment-plan.md` | 20,324 | `624ed370d411ddd3d729551a4f238b66c9ad08111061b6d2019383de8068cf09` |
| `docs/render-storage-decision.md` | 12,097 | `c098116140519c53dae346425d7c9d32d62a2ae3055336daccf462536625c887` |
| `docs/render-security-plan.md` | 12,571 | `154d111058d11ff87ce840b451ed210c607bd36cd553a441e171ab65e28776a2` |
| `docs/phase7-report.md` | 27,349 | `9e53d8db371e95d83d97593b89ab93c605c17ebc76720a9ec98b1aadacd19b75` |
| `render.yaml` | 2,033 | `766eb55f0a0f215155853a77fad09da243cd575eb93b22260288d49ce24628ef` |

## Preservation and verification boundary

The final preservation result and command outputs are recorded in [the Phase 7 report](phase7-report.md). Protected groups include `src/`, `test/`, `scripts/`, `config/`, `deploy/`, package/lock/build configuration, `.env.example`, the 40 original release-bound documents, `dist/` and Phase 1–6 evidence.

Measured project delta: **997 unchanged original files, 0 modified/missing originals, exactly 7 additions; 1,004 current project files** under the existing inventory exclusions. Built outputs are verified separately. All **1,230/1,230 historical byte-length/SHA-256 bindings** match, and the Git index is unchanged.

The early finalization invocation temporarily overwrote historical files; all ten affected files were restored to their exact sealed bytes, and seven accidental attempt files were byte-verified and moved to the external reconciliation record. This is **final byte preservation**, not a claim that no temporary archive write occurred. See the report for chronology and location.

The original manifest `evidence/phase5/release-manifest.json` retains SHA-256 `f9059fe0ad2fd031a505c79ea0e38397cc4eb624f6a4d7e0caee96463d581f3a`. New Phase 7 documents are a separately inventoried planning package, not an already rebound production release. The current release-input allowlist omits root `render.yaml`; a Phase 8 candidate must explicitly bind it, the new JSON configuration and any web assets.
