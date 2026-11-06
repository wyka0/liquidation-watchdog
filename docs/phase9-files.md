# Phase 9 files, inputs and preservation record

**COMPLETE — documentation-only audit/design package; Phase 10 approval pending.** The verified repository delta from the Phase 9 baseline is exactly the following six added files. Their final byte lengths and SHA-256 values are recorded externally after content is finalized, so this inventory does not contain a self-dependent hash.

## Six authorized deliverables

| Added path | Purpose |
| --- | --- |
| `docs/phase9-report.md` | Exactly 12 numbered sections: decision, preservation, findings, backend, migration, Free runtime/scheduling/capacity, security/recovery, implementation gates, blockers/approvals and handoff. |
| `docs/neon-postgres-architecture.md` | Source/script/test and 12-table inventory; lossless types/codecs; async pg design; transactions/global fencing; outbox/recovery; pooling/TLS/deadlines; remote evidence and failure policy. |
| `docs/sqlite-postgres-migration-plan.md` | Explicit source selection/freeze/snapshot/export/import/parity/cutover; post-write rollback boundary; consistent independent backups, restore/reconciliation and RPO/RTO decisions. |
| `docs/render-free-architecture.md` | Published Free limits; A/B/C comparison; 30-minute external Cron/trigger proposal; lifecycle/auth/timeouts/staleness; quantified compute/storage/traffic/memory/build/backup budgets and costs. |
| `docs/phase9-security-review.md` | Trust boundaries, scoped credentials/roles, TLS, authentication/replay/abuse controls, data/evidence integrity, backup privacy, delivery ambiguity and security acceptance gates. |
| `docs/phase9-files.md` | This inventory, read-input authorities, baseline/historical hashes, external verification protocol and stopping boundary. |

Companions: [report](phase9-report.md), [database design](neon-postgres-architecture.md), [migration](sqlite-postgres-migration-plan.md), [Free hosting](render-free-architecture.md), [security](phase9-security-review.md).

No existing repository file is an authorized Phase 9 modification. The final comparison includes source, configuration, dependency manifests, schema/migrations, generated build output, databases/sidecars, archives, deployment files and historical documents. The entire original Git working-tree state remains intact after filtering these six additions; the tree was already extensively uncommitted before Phase 9.

## Phase 8 and historical authorities reviewed

All five Phase 8 deliverables were read:

1. [Phase 8 report](phase8-report.md).
2. [Phase 8 file inventory](phase8-files.md).
3. [Runtime operations](render-runtime-operations.md).
4. [Dashboard/API contract](render-dashboard-api.md).
5. [Phase 8 test evidence](phase8-test-evidence.md).

Relevant Phase 1–7 input families include:

| Area | Historical inputs |
| --- | --- |
| Chain/accounting/provenance | [Architecture](architecture.md), [accounting](accounting.md), [evidence](evidence.md), [oracle investigation](oracle-investigation.md), [security/quality](security-and-quality.md). |
| Exact risk and thresholds | [Risk engine](risk-engine.md), [recommendation math](recommendation-math.md), [thresholds](thresholds.md), [Phase 2 report](phase2-report.md). |
| Monitoring and notifications | [Monitoring architecture](monitoring-architecture.md), [alerts/dedup/outbox](alerting.md), [notification setup](notification-setup.md), [Phase 3 report](phase3-report.md). |
| Oracle assurance/continuity | [Oracle architecture](oracle-architecture.md), [assurance](oracle-assurance.md), [freshness](oracle-freshness.md), [independent validation](oracle-independent-validation.md), [Phase 4 report](phase4-report.md). |
| Production operations/recovery | [Production architecture](production-architecture.md), [database operations](database-operations.md), [deployment](deployment.md), [environment/configuration](environment-variables.md), [operations runbook](operations-runbook.md), [production security](production-security.md), [reliability testing](reliability-testing.md), [rollback/recovery](rollback-and-recovery.md), [readiness gaps](production-readiness-gaps.md), [Phase 5 report](phase5-report.md). |
| Host acceptance boundary | [Host acceptance report](host-acceptance-report.md), [checklist](host-acceptance-checklist.md), [host evidence inventory](host-acceptance-files.md). |
| Prior Render decision | [Render architecture](render-architecture.md), [deployment plan](render-deployment-plan.md), [storage decision](render-storage-decision.md), [security plan](render-security-plan.md), [Phase 7 report](phase7-report.md), [Phase 7 inventory](phase7-files.md). |

Historical text describes the phase in which it was written. For example, the preserved Phase 7 Blueprint comments predate Phase 8's implemented entrypoint/configuration, and old CLI operations documentation predates the HTTP dashboard. Phase 9 documents reconcile those facts without editing historical claims or manifests.

Implementation inspection covered `src/storage/`, `src/monitoring/`, `src/notifications/`, `src/runtime/`, `src/operations/`, `src/config/`, oracle-assurance evidence/continuity code, `src/cli/` entrypoints, `src/service.ts`, domain/risk evidence writers, `config/render.json`, `render.yaml`, `package.json`, relevant scripts/tests and their filesystem/generated-output behavior. The detailed call-site, table, dialect and filesystem inventory is in the database design. Official platform/driver sources and consultation date are listed in the architecture/security documents; no connected cloud account was consulted.

## Pre-inspection verification

An external read-only helper was prepared at:

`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase9-audit.mjs`

Its `init` run verified the historical seal before source inspection, then captured the Phase 9 file/status baseline at **2026-11-02T16:07:56.560Z**. The seal-verification portion records **16:07:49.159Z**. The exclusive output directory is:

`[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase9-validation-8LlmKy\`

| Verified item | Pre-inspection result |
| --- | ---: |
| Phase 8 seal file bindings | 665 matched |
| Phase 8 indexed evidence payloads | 221 matched |
| Historical originals unchanged since pre-Phase-8 snapshot | 1,236 matched |
| Authorized Phase 8 original-file differences | 5 matched their sealed Phase 8 bytes |
| Historical external snapshot originals | 1,241 matched |
| Phase 7 file bindings | 7 matched |
| Phase 9 project-owned baseline files | 1,773 bound |
| Metadata-only private entries | 0 |
| Original default porcelain Git-status entries | 613 |
| Git index | Exact original hash matched |

The five historical Phase 8 differences are `src/storage/store.ts`, `scripts/release-inputs.ts`, and `dist/storage/store.js`, `dist/storage/store.js.map`, `dist/storage/store.d.ts`. Their **Phase 8** values are frozen originals for this audit, not permission for new Phase 9 changes. Every original file/directory captured in the Phase 9 baseline must still match at completion.

## Hash authorities

| Authority | SHA-256 |
| --- | --- |
| Phase 8 `phase8-seal.json` | `44c5d1f4a588a41cb93024575234cce8806f9c9da40463765e9f77da6c64b094` |
| Phase 9 external `baseline.json` | `a75ffbd423db7c5baf63a199b95cdf1de8c262216371324dac07dbf2fbae3bff` |
| External `phase9-audit.mjs` helper | `b8ec02c60c3745ac7109b29b0ac0c6fca8898966214742898f34969b48c99916` |
| Original Phase 5 release manifest | `f9059fe0ad2fd031a505c79ea0e38397cc4eb624f6a4d7e0caee96463d581f3a` |
| Phase 6 evidence manifest | `15708b4f1000f1c1859010f6dabfc11c87d96391bcacb60662354ab122c4bda3` |
| Phase 7 file inventory | `aeb1616cab83bec411bf2632f42c2b304039fba284d4d4c28dcbe38a8478a34d` |
| Phase 8 source/configuration aggregate, 180 files | `e9c758240dcfcd06e7691e51a8bb48194e5f7f38cd616ec3ec547c9c7fff3004` |
| Phase 8 build aggregate, 258 files | `84830d46176759e16458ce285adc310cd49c3810321724c017e3a5a214f3072b` |
| Preserved `render.yaml` | `766eb55f0a0f215155853a77fad09da243cd575eb93b22260288d49ce24628ef` |
| Exact authored placeholder `.env.example` | `517c936b52b4489029ba6576c553cbfc2b052eebe638511b4d055ace99d22c69` |
| Original Git index | `99b8af3c5aa3985d32e6bf62f4a2e114914f00dacd52fd1f0107fe2ef7a44689` |
| Phase 8 handoff/default pre-Phase-9 Git status | `8179b4ccaa9f8c0548fb15395f9fb62c072f147fbdf6ff712ee87008ecfdf4ec` |

Git status changes naturally when the six new documents are added; its old aggregate is not expected to remain equal. Instead, the verifier compares the complete NUL-delimited status with untracked files expanded, excluding only these six allowed additions. The index must remain byte-identical. No verified Git HEAD exists; content manifests identify this work, not a fabricated commit/release revision.

## External verification artifacts and procedure

The helper writes exclusively outside the repository. It uses exclusive `wx` outputs so earlier results cannot be overwritten. `init` is a one-time baseline capture; do not rerun it to bless a changed tree.

| External path relative to the validation directory | Meaning |
| --- | --- |
| `baseline.json` | Pre-inspection seal/index/status bindings and all 1,773 project-owned files/directories/private-name metadata. |
| `git-status-before.txt` | Exact NUL-delimited expanded untracked/status baseline. |
| `validation-<unique-label>.json` | Dated seal/historical/original-file, six-addition, section/link/whitespace/index/status and read-only secret-scan result; includes the six document byte lengths/hashes. |
| `empty-<unique-label>.txt` | External empty reference for `git diff --no-index --check` on each new, untracked Markdown file. |
| `validation-final.json` | Designated authoritative final validation after all document edits. Earlier labeled checks remain retained. |

The final command, executed from `C:\liquidation-watchdog`, is:

```powershell
node "[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase9-audit.mjs" verify "[REDACTED_LOCAL_PATH]\AppData\Local\Temp\opencode\phase9-validation-8LlmKy" final
```

Before using the baseline/helper, compare their hashes with the table above. Each final verification:

1. Verifies the fixed Phase 8 seal/detached checksum, 665 seal bindings, 221 evidence payloads, historical snapshots/Phase 8 authorized differences and seven Phase 7 bindings.
2. Hashes every original project-owned file and compares directory/private metadata against the Phase 9 baseline. Database files receive raw byte hashing only; no SQLite/application module is used to inspect them.
3. Requires exactly the six authorized document additions and no other project file or directory change; compares existing Git status and original index without staging. Git commands use optional locking disabled.
4. Requires report section numbers **1 through 12 exactly**, checks local link targets, new-document whitespace and `git diff --check`.
5. Runs only `node --import tsx scripts/check-secrets.ts --read-only`, requiring zero findings and the exact authored placeholder template. Scanner results include its actual file count/exclusions and no matched secret text.
6. Writes the final document hashes and all results to the unique external record. Any failure stops handoff; preserve the result and use a new label after an authorized correction.

Exclusions are explicit: project inventory excludes `.git` and installed `node_modules`; the Git index is verified separately. Sensitive filename patterns are checked as metadata and never opened (except the exact verified placeholder template). The secret scanner additionally excludes generated build output, coverage, private runtime data and backups. The byte-preservation inventory includes project-owned build/data/evidence files; a secret scan is not represented as a scan of their private contents. No environment dump or credential inspection is used.

## Actual audit validation versus future acceptance

Pre-inspection integrity/baseline capture and completed-document review both passed. `validation-review-1.json` records the review at **2026-11-02T16:53:06.081Z**, with SHA-256 **`f844eedcc2beff0c32f234ef82c6c9887e1af31f5529b975d7517d1c6eb2c544`**. That record is retained unchanged; it binds the document versions before the review results were added to this inventory/report.

| Actual review check | Result |
| --- | --- |
| Historical preservation | 665 seal bindings, 221 evidence payloads, 1,236 unchanged originals plus five sealed Phase 8 differences, 1,241 snapshot originals and seven Phase 7 bindings matched. |
| Phase 9 baseline preservation | All 1,773 original files and the directory/private-metadata inventory matched; exactly six document additions. |
| Database preservation | All 64 baseline database/sidecar files, totaling 7,806,976 bytes, are included in the unchanged-file result; no database engine/query was used. |
| Source/configuration/dependencies/build/evidence/deployment | Zero original-file changes. Preserved `render.yaml` and all schema/dependency inputs remain byte-identical. |
| Git | Original index hash matched; pre-existing expanded working-tree status preserved; `git diff --check` passed. |
| Document checks | Report numbered sections 1–12; 87 local file-link targets; all six new-document whitespace checks passed. A separate read-only session check passed all seven local heading fragments and confirmed exactly 12 total level-two report headings. |
| Read-only secret scan | Exit 0; 1,257 files; nine rules; zero findings; authored placeholder template verified. The scanner retains one established fixture exception and the recorded private/build/dependency exclusions. |

The authoritative `validation-final.json` repeats the verifier after these result updates and binds the final six file lengths/hashes. Its `passed: true` result is required for handoff; final hashes stay in that external record to avoid self-reference. Phase 9 verification covers preservation, document structure/links/whitespace and the read-only static secret scan. PostgreSQL performance, actual Render/Neon availability, scheduler execution, migration parity and backup recovery remain explicit future acceptance gates.

Two harmless inspection-command corrections are retained in the session history: an earlier lookup of nonexistent `src/operations/config.ts` was corrected to `src/config/production.ts`; a metadata-summary `node -e` command failed at parse time because Windows PowerShell removed quoting, then the same external-baseline summary succeeded with PowerShell's JSON/hash commands. Neither executed application/database logic or modified project files. These are not test or implementation failures.

Historical results remain attributed to Phase 8: 709 unit tests including 47 runtime tests, two live tests, 99 repeated operations tests, 26/26 verification checks and 5/5 finalization. No legacy verification/release/inventory command was rerun against historical archives. No new application test, build or database experiment was necessary for this documentation-only change.

## Handoff boundary

The final external result is the authority for exact six-file addition hashes, original-byte/index/status preservation, zero database/deployment changes and scanner findings. No new in-repository evidence directory, helper, manifest, dependency, schema, configuration or application code is part of Phase 9.

The audit used public documentation and project text plus read-only preservation hashes. It created no cloud account/resource/job/deployment, made no real notification or financial transaction, read no credential/private key and performed no commit, push, branch, tag or index change. Historical evidence and the sealed disk-backed Phase 8 implementation remain intact.

**Stop for explicit Phase 10 approval.** The next decision is implementation permission for the recommended async pg/global-fence/atomic-outbox/protected-trigger design. Provider provisioning, migration/cutover, slower cadence, backup/recovery targets, scheduler enablement, real channels and production operation each retain the approvals described in [the report](phase9-report.md#11-blockers-risks-and-required-approvals).
