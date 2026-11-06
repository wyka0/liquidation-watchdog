# Phase 8 file inventory

**Local, uncommitted implementation; ready for separate deployment review.** The definitive byte lengths and SHA-256 values are recorded in `evidence/phase8/implementation-inputs.json`, `file-changes.json`, `evidence-index.json` and the detached `phase8-seal.json`/`phase8-seal.sha256` handoff binding. Production approval is absent.

Companions: [report](phase8-report.md), [operations](render-runtime-operations.md), [API](render-dashboard-api.md), [tests](phase8-test-evidence.md).

## Existing files intentionally modified

| File | Change |
| --- | --- |
| `src/storage/store.ts` | Existing-only validated opens and bounded coherent read-only snapshots; original writer/schema/mutation contracts retained |
| `scripts/release-inputs.ts` | Include the fixed Render configuration and preserved Blueprint in source/configuration verification bindings |
| `dist/storage/store.js` | Production build of the modified store |
| `dist/storage/store.js.map` | Corresponding build source map |
| `dist/storage/store.d.ts` | Corresponding generated declaration |

These are the only five permitted original-file differences. Every original historical document and evidence file is preserved. Before/after hashes for the five differences are in the machine-readable delta and pre-Phase-8 baseline.

## New source, configuration and verification code

| File | Purpose |
| --- | --- |
| `src/service.ts` | Guarded executable, reviewed option contract, explicit environment inputs, signals and process deadline |
| `src/runtime/auth.ts` | Bounded bearer/Basic authentication and constant-time digest comparison |
| `src/runtime/dashboard.ts` | Fixed protected HTML/CSS/JS strings, safe text rendering and manual pagination/refresh |
| `src/runtime/http.ts` | Explicit read-only routing, auth/admission/cache/output limits, sanitized errors and bounded closure |
| `src/runtime/read-model.ts` | Strict persisted DTOs, status/readiness, history and non-actionable provenance |
| `src/runtime/service.ts` | Process singleton, existing monitor integration, fatal failure propagation and cleanup |
| `src/runtime/workspace.ts` | Mount/path/writability checks, pinned exclusive evidence bootstrap and workspace ownership fence |
| `config/render.json` | Initial disabled production-profile single-disk configuration |
| `scripts/phase8-reliability.ts` | Bounded 24-cycle/72-request synthetic resource, backup and isolated restore measurement |
| `test/fixtures/runtime.ts` | Isolated explicit DB initialization and synthetic in-memory credential fixtures |
| `test/helpers/phase8-import.ts` | Guarded source/built import probe forbidding DB/HTTP/provider construction |
| `test/helpers/phase8-runtime.ts` | Bounded child-runtime fixture for lifecycle and termination checks |
| `test/runtime-storage.test.ts` | Persistent workspace, ownership, existing-only refusal, permissions/aliases and SQLite contention |
| `test/runtime-http.test.ts` | Auth, read-only routes, bounds, safe assets, caching/rate/concurrency and HTTP closure |
| `test/runtime-read-model.test.ts` | Coherent committed projections, provenance, stale/history/cursors and size refusal |
| `test/runtime-lifecycle.test.ts` | Explicit/single startup, disabled/fatal states, cancellation/signals/deadlines and restart/outbox |
| `test/runtime-process.test.ts` | Import guard, child shutdown and actual forced termination/recovery |

Seven new application TypeScript modules produce **21 new build files**: `.js`, `.js.map` and `.d.ts` for `dist/service` and each of `dist/runtime/{auth,dashboard,http,read-model,service,workspace}`. All generated outputs are individually bound, including declarations/maps.

## Five required documents

| File | Purpose |
| --- | --- |
| `docs/phase8-report.md` | Twelve-section implementation, verification, preservation and readiness report |
| `docs/phase8-files.md` | This inventory and evidence-binding protocol |
| `docs/render-runtime-operations.md` | Startup/storage/lifecycle contract, operator procedures and deployment-review gaps |
| `docs/render-dashboard-api.md` | Routes, auth, exact data/limits, error semantics and dashboard behavior |
| `docs/phase8-test-evidence.md` | Commands/counts, failures/skips, resource measurements and evidence provenance |

The implementation/document delta is **43 added files and 5 modified originals**: 17 source/configuration/test/script additions, 21 build additions and five documents. Phase 8 evidence files are listed separately by exact path/hash in `evidence-index.json`.

## New Phase 8 evidence

| Path/group under `evidence/phase8/` | Meaning |
| --- | --- |
| `pre-phase8-baseline.json` | Exclusive pre-edit bindings for 1,241 original files, runtime/index/status and external snapshot identity |
| `phase7-file-bindings.json` | Exact copied seven-file Phase 7 handoff binding |
| `initial-typecheck.json` | Preserved initial unused-import TypeScript failure |
| `checks/*.json` | Exclusive labeled commands, working directories, timestamps, exit codes and sanitized stdout/stderr |
| `runtime-tests-initial.json` | Original 39/40 targeted result, retaining its one test-harness failure |
| `runtime-tests.json` | Corrected earlier targeted 45/45 result |
| `runtime-reliability.json` | First passing bounded run with cycle-only peak sampling; retained transparently |
| `runtime-reliability-full.json` | Preferred run with full-lifecycle RSS sampling including backup/restore |
| `built-service-smoke.json` | Two bounded compiled-executable scenarios, controlled Windows signal dispatch and expected missing-DB refusal |
| `verification-candidate.json` | 1,296-file exclusive candidate copy, original input hashes and dependency/Git-pointer provenance |
| `verification/**` | 173 byte-preserved new/changed isolated legacy outputs, under their original relative path prefix |
| `verification-provenance.json` | Candidate-to-Phase-8 output mapping, exact hashes, source-bound test/verification summaries |
| `implementation-inputs.json` | Final source/configuration/build identity, matching full verification, preserved historical authorities |
| `tooling/*.mjs`, `tooling-provenance.json` | Seven exact external helper sources used for isolation, command capture, compiled smoke, final checks and sealing |
| `main-final-checks.json` | Final main-tree source/build match, document links, secret scan, whitespace and integrity |
| `process-state-final.json`, `process-state-post-smoke.json` | Sanitized process snapshots, each with zero matching runtime processes; no unrelated-process modification |
| `git-status-final.txt` | Final NUL-delimited porcelain status; index is not modified |
| `file-changes.json` | Added/modified implementation/document paths with final byte/SHA-256 bindings |
| `evidence-index.json` | Per-file SHA-256 inventory of new Phase 8 evidence payloads |
| `phase8-seal.json`, `phase8-seal.sha256` | Handoff binding for complete source/build, five documents, inventory and evidence |
| `seal-verification.json` | Post-seal byte/index/historical/secret validation; explicitly self-excluded |

Original paths inside transplanted verification records refer to the **isolated candidate**, not authority to overwrite main-tree Phase 5 evidence. `verification-provenance.json` maps those paths to their Phase 8 copies. Generated Markdown copies use `.md.txt` to retain exact bytes without presenting relocated document links. Unchanged candidate historical bytes remain resolvable through its copy manifest and the unchanged main-tree archive.

## Historical hashes and noncircular sealing

Final source/configuration identity (**180 files**): `e9c758240dcfcd06e7691e51a8bb48194e5f7f38cd616ec3ec547c9c7fff3004`. Final build identity (**258 files**): `84830d46176759e16458ce285adc310cd49c3810321724c017e3a5a214f3072b`. Both byte-for-byte inventories match the completed 26-check candidate. The source input count also includes the preserved Phase 7 Blueprint newly added to the source-verification allowlist.

| Historical authority | SHA-256 |
| --- | --- |
| Original Phase 5 release manifest | `f9059fe0ad2fd031a505c79ea0e38397cc4eb624f6a4d7e0caee96463d581f3a` |
| Phase 6 evidence manifest | `15708b4f1000f1c1859010f6dabfc11c87d96391bcacb60662354ab122c4bda3` |
| Phase 7 file inventory | `aeb1616cab83bec411bf2632f42c2b304039fba284d4d4c28dcbe38a8478a34d` |
| Preserved `render.yaml` | `766eb55f0a0f215155853a77fad09da243cd575eb93b22260288d49ce24628ef` |
| Pinned placeholder `.env.example` | `517c936b52b4489029ba6576c553cbfc2b052eebe638511b4d055ace99d22c69` |
| Original Git index | `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689` |

The source/build identity is independent of these documents. The evidence index binds new evidence payloads and the implementation/document delta. The final seal then binds the five documents **including this inventory**, all final implementation/build inputs and the new evidence index/payloads. Its detached checksum binds the seal. The seal, its checksum and its post-seal check do not hash themselves; no document embeds a self-dependent final seal hash.

No Phase 1–7 evidence file or historical manifest is regenerated. The isolated legacy release manifest is retained only as a successful compatibility-check output; runtime bootstrap continues to use the original pinned historical manifest. The main tree plus Phase 8 content identities is the review candidate.
