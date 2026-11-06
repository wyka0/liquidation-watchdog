# Stage 3A — Typed Suggested Actions

**Completed:** 2026-11-05  
**Scope:** local typed-action implementation only  
**Decision:** **GO for Stage 3A acceptance; Stage 3B not started**

## 1. Implementation summary

Every newly generated alert now contains exactly one strict, versioned `suggestedAction` object. Actions are either:

- `FINANCIAL_OPTION` — one action containing one or two already-calculated strict-gate-qualified recovery options; or
- `NON_FINANCIAL` — a concrete safe human instruction containing no financial amount.

The implementation does not add a calculator, signer, transaction builder or broadcaster. Financial options copy only existing repayment/additional-collateral estimates produced by the existing recovery pipeline after strict eligibility passes.

Every action and option is structurally `actionable:false`.

## 2. Suggested-action schema

New modules:

- `src/actions/model.ts`
- `src/actions/derive.ts`

### Common action fields

```text
schemaVersion: 1
origin: GENERATED | LEGACY_DERIVED
type: FINANCIAL_OPTION | NON_FINANCIAL
instruction: bounded trusted human-readable text
rationale: bounded enum
createdAt: UTC
evidence: strict provenance/evidence summary
financialOptions: 0..2 exact options
actionable: false
```

Evidence records:

- qualification status;
- cycle ID;
- chain/account/market identity;
- snapshot ID;
- block number/hash/timestamp;
- progression state/reason;
- oracle assurance/freshness;
- independent validation state;
- invalidation/configuration/timestamp anomalies;
- oracle observation timestamp;
- strict recovery eligibility and bounded reason codes.

### Financial option fields

Each option preserves:

- `REPAY` or `ADD_COLLATERAL`;
- exact raw integer decimal text;
- exact formatted decimal text;
- asset address and decimals;
- chain/account/market identity;
- exact target ratio;
- approved calculation method;
- snapshot ID, block number/hash and calculation time;
- oracle observation timestamp and `VERIFIED` freshness;
- mandatory refresh/simulation condition;
- `actionable:false`.

Token symbols are intentionally omitted because the persisted risk view does not retain a separately qualified symbol. No symbol is guessed or copied from display text.

## 3. Financial versus non-financial behavior

### Financial action

A `FINANCIAL_OPTION` is limited to risk alert codes where mitigation review is meaningful:

- `INITIAL_RISK`
- `RISK_WORSENED`
- `DEBT_OBSERVED`
- `CRITICAL_REMINDER`

The mathematical state must be warning, critical or liquidation boundary, and at least one existing calculated recovery estimate must be present.

The alert renderer emits financial amounts only from `suggestedAction.financialOptions`. The previous generic estimate rendering path was removed, so a non-financial alert cannot accidentally render an unrelated amount.

### Non-financial action

Every alert code has an exhaustive deterministic instruction. Categories include:

- refresh/restore complete data and do not transact;
- review the named position and independently refresh state;
- verify oracle source/configuration/freshness;
- continue monitoring after improvement/recovery without claiming safety;
- legacy review instruction when no action was persisted historically.

Unavailable evidence never drops an alert.

## 4. Eligibility gate enforcement

`riskView` now persists an optional strict recovery-eligibility summary for new observations. It is optional solely for historical observation compatibility.

Financial action derivation requires all of the following:

1. accepted observation;
2. warning/critical/boundary state and eligible risk alert code;
3. `recoveryEligibility.eligible=true`, status `ELIGIBLE`, no reason codes;
4. progression exactly `ADVANCING`;
5. oracle assurance `VERIFIED` and gate `ASSURANCE_REQUIREMENTS_MET`;
6. oracle freshness `VERIFIED` with observation timestamp;
7. independent validation `VERIFIED` and eligible;
8. no evidence invalidation, invalidation latch or reason;
9. no configuration changes;
10. no timestamp anomaly;
11. non-null assurance configuration/fingerprint with matching timing fingerprint;
12. existing estimate provenance already matching risk snapshot/block/hash/calculation time.

The action layer invokes no solver. If any condition fails—or no estimate exists—the result is `NON_FINANCIAL` with zero financial options.

Oracle assurance, oracle freshness and chain progression remain separately represented and separately checked.

## 5. Alert generation and rendering

`transition()` remains the only alert-generation path. Its central alert constructor now calls `deriveSuggestedAction(code, current)` before strict `alertSchema` parsing.

Consequences:

- no new alert can pass schema validation without exactly one action;
- action timestamp equals alert observation timestamp;
- action is persisted inside alert JSON;
- alert fingerprint semantics remain event/episode based and unchanged;
- every console/Telegram/Discord rendering includes:
  - UTC alert timestamp;
  - `Action:` instruction;
  - action evidence/rationale/origin;
  - exact option line only for a qualified financial action;
  - explicit `actionable:false`.

The API alert-history projection now includes the typed action, so the dashboard's JSON view displays it without reconstructing advice client-side.

## 6. Historical compatibility and integrity

No SQLite or PostgreSQL migration was needed because alerts are stored as JSON text.

Two schemas are used:

- `alertSchema` requires a suggested action for all newly generated/written alerts;
- `storedAlertSchema` accepts current or legacy bytes and upgrades a legacy row in memory.

Legacy handling:

1. storage integrity/hash is checked against the original JSON text first;
2. original bytes are parsed without rewrite/backfill;
3. missing action becomes `LEGACY_DERIVED` / `NON_FINANCIAL`;
4. the instruction explicitly states that no suggested action was persisted originally;
5. no financial option is inferred, even if historical risk payloads contained estimates.

PostgreSQL continues comparing `alert_sha256` to original text. SQLite content/fingerprint bytes remain unchanged. Tests confirm the original legacy JSON and digest remain identical after reads.

## 7. Persistence changes

Updated read paths to use backward-compatible stored alert decoding:

- SQLite alert list/detail/snapshot/full validation;
- PostgreSQL read snapshots;
- PostgreSQL alert lookup and unknown-COMMIT reconciliation.

Write paths still require strict current `alertSchema`, so legacy-shaped new writes are rejected.

Native PostgreSQL tests prove:

- generated action JSON round-trips exactly;
- actions survive an immediate PostgreSQL restart;
- hash-valid legacy alert bytes become a non-financial legacy action in memory;
- the legacy database row and `alert_sha256` are not rewritten.

## 8. Test results

### Focused action tests

`test/suggested-actions.test.ts`:

- **39/39 passed**.

Coverage includes:

1. every alert code receives exactly one action;
2. timestamp and `Action:` rendering;
3. qualified estimates copied exactly;
4. missing assurance;
5. unknown freshness and stale data;
6. UNKNOWN/STALLED/REGRESSED/CONFLICT progression;
7. identity mismatch;
8. invalidated evidence;
9. timestamp/configuration anomalies;
10. exact raw/formatted units;
11. unconditional false actionability;
12. legacy hash/byte compatibility;
13. SQLite restart/action persistence;
14. no signing/private-key/broadcast source.

### Related focused suites

- monitoring, notifications, storage, read model, recovery and progression: **261/261 passed** across 8 files.

### Native PostgreSQL

- `test/integration/postgres.test.ts`: **61/61 passed**.
- Includes generated action persistence, restart preservation and hash-valid legacy decoding.
- Cleanup verified: no PostgreSQL process/service, no fixture directory and no persistent test-bin environment.

### Full verification

- full unit suite: **46 files, 972/972 passed**;
- TypeScript `--noEmit`: PASS;
- full ESLint: PASS;
- production build: PASS.

## 9. Files changed

Added:

- `src/actions/model.ts`
- `src/actions/derive.ts`
- `test/suggested-actions.test.ts`
- `docs/STAGE-3A-TYPED-SUGGESTED-ACTIONS.md`

Updated:

- `src/monitoring/model.ts`
- `src/monitoring/transitions.ts`
- `src/notifications/format.ts`
- `src/runtime/read-model.ts`
- `src/storage/store.ts`
- `src/storage/postgres/database.ts`
- `src/storage/postgres/store.ts`
- `test/integration/postgres.test.ts`

The production build also regenerated corresponding `dist/` files.

## 10. Security invariants

Preserved:

- no fabricated chain/oracle data;
- no amount without every existing strict recovery gate;
- no second financial calculator;
- no freshness/progression conflation;
- unconditional `actionable:false`;
- no private key, signing, transaction construction or broadcasting;
- no real notification;
- no Neon/cloud/paid-service connection.

The native PostgreSQL rerun used only a disposable local loopback cluster because persistence formats changed. This was within the explicit Stage 3A native-test allowance. No remote database operation occurred.

## 11. Remaining limitations

- Financial actions remain conditional decision-support options, never executable instructions.
- Production oracle assurance/freshness remain unverified, so production observations continue to produce non-financial actions and no amounts.
- No asset symbol is exposed in action options until it can be retained with verified metadata provenance.
- The PostgreSQL runtime still has no notification adapters; Stage 3B remains separate and unstarted.
- No real provider alert was sent.
- Multiple positions remain unimplemented.
- Neon reader, migration/security, schema/grants and remote persistence blockers remain unchanged.

## 12. Decision

Stage 3A acceptance criteria are met locally. **GO for the typed suggested-action implementation.**

Stage 3B and all infrastructure/deployment work remain unapproved and were not started.
