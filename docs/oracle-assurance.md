# Oracle assurance — Phase 4

**Overall assurance is `UNVERIFIED`; every recovery estimate is indicative and `actionable: false`.** Reproducing a contract proves its deployed code identity under the recorded inputs. It does not prove the economic correctness of its answer, the identity of its operators, or the independence of two data providers.

The selected deployment is on **Pharos Pacific Mainnet, chain 1672**. The complete chain-bound graph, addresses, compiler settings and permission analysis are in [oracle architecture](oracle-architecture.md). [Freshness](oracle-freshness.md) and [independent validation](oracle-independent-validation.md) document the unresolved evidence separately.

## Evidence rules

`src/oracle-assurance/model.ts` defines seven independent dimensions. `evaluate.ts` uses explicit mandatory requirements; strengths in one dimension cannot compensate for missing evidence in another.

| Dimension | Requirements for verification | Established result for the reviewed configuration |
| --- | --- | --- |
| `CONTRACT_IDENTITY` | Exact chain/market/address relationships, pinned deployed SHA-256 and Keccak hashes, independently reproduced source | `VERIFIED` for the five selected pricing/accounting dependencies when the snapshot matches all pins |
| `SOURCE_PROVENANCE` | Exact feed-ID/product mapping, workflow source, economic inputs | `UNVERIFIED` |
| `OPERATOR_PROVENANCE` | Source operator, signer operators, controller identities | `UNVERIFIED` |
| `PRICE_SEMANTICS` | Mechanical scaling, economic base/quote, feed denomination | `PARTIALLY_VERIFIED`: scaling only |
| `FRESHNESS` | Established timestamp meaning, configuration-bound verified heartbeat and upstream maximum-age guarantee, no anomaly/expiry | `UNKNOWN` |
| `INDEPENDENT_VALIDATION` | Qualified exact-asset/quote market price, independent upstream/operator provenance, explicit temporal/tolerance policies, aligned observations | `UNKNOWN`; no candidate is configured |
| `CONFIGURATION_CONTROL` | Permission boundaries, current controllers, complete signer configuration, controller identities | `PARTIALLY_VERIFIED` |

Any failed dimension makes overall assurance `FAILED`. Overall `VERIFIED` requires every dimension to be `VERIFIED` and no invalidation latch. All other combinations produce `UNVERIFIED`. The current production evaluator cannot establish the missing upstream facts and supplies no selected-upstream identity to the comparator. Even the model's `ASSURANCE_REQUIREMENTS_MET` gate does not authorize execution: the Phase 4 actionability field is always false.

Each finding retains its exact subject address, chain, source location, source kind, retrieval time, method, artifact hash, available block number/hash/timestamp, confidence and unresolved questions. Classifications are `PROVEN`, `INTERPRETATION` and `UNKNOWN`. A document may have `block: null`; its runtime-derived behavioral claims are applied only when the current snapshot matches the reviewed runtime. Snapshot artifact SHA-256 and the type-tagged canonical snapshot identifier are distinct values.

RPC `https://rpc.pharos.xyz` and MCP `https://mcp.pharos.xyz/mcp` agreement is recorded as **shared-upstream consistency**, not independent consensus. Contract names, descriptions, interfaces, positive answers and successful calls do not qualify economic provenance.

## Risk and monitoring integration

`src/risk/assured.ts::calculateAssuredRisk` wraps `src/risk/engine.ts::calculateRisk`. The original Phase 2 engine, validation, accounting and recovery mathematics are preserved byte-for-byte. The wrapper binds assurance to the exact snapshot identifier, block number/hash/timestamp, retrieval time, evidence kind, Morpho price and oracle timestamp before applying the assurance gate.

- Unknown or unverified assurance retains useful mathematical results as `DATA_UNVERIFIED`, with non-actionable indicative estimates.
- Invalid prices, runtime/address conflicts, inconsistent or regressing timestamps, malformed/unbound supplemental evidence and eligible independent disagreement fail closed as `DATA_INVALID`.
- Required source failures become `DATA_UNAVAILABLE`; they never become zero prices, zero debt, fresh observations or a restored state.
- Invalid/unavailable/stale effective data suppress both recovery estimates. The original mathematical state and `phase2DataQuality` remain separately visible.
- Independent prices are retained beside the Morpho answer and never replace the price used by the risk engine.

The `risk` command performs snapshot-based assurance. `oracle-audit` and monitoring additionally run the bounded supplemental investigation. Observations and alerts retain assurance, quality, mathematical state and actionability separately.

## Configuration continuity and persistent alerts

A fingerprint includes dependencies and runtimes, proxy slots, owners, allowed-workflow owner, feed ID, composition, token units, description, sampled signer/workflow hashes and observation coverage. Economic denomination remains explicitly `ECONOMIC_QUOTE_UNVERIFIED`.

The evaluator compares against a **separately block-bound last complete baseline**, not against a partial failed read. A configuration change or an observability gap invalidates established assurance. Bound configuration events can trigger invalidation even when later supplemental reads fail. Runtime changes, backwards blocks, same-height hash conflicts and missing previously observed configuration are conservatively handled. An 8,000-block history window cannot establish continuity across a larger gap.

The `evidenceInvalidated` latch and first invalidation time/reason persist through failures, stable subsequent reads, process restarts and threshold-stream changes. No ordinary read clears the latch or automatically restores `VERIFIED`. `LIVE`, `FIXTURE` and `HISTORICAL-<block>` scopes are isolated. The store rejects a cleared latch, a missing/regressed complete baseline, and a backwards evaluation clock.

Persistent oracle alert codes are:

- `ORACLE_CONFIGURATION_CHANGED`, `PROXY_IMPLEMENTATION_CHANGED`, `ORACLE_OWNER_CHANGED`;
- `ORACLE_FEED_ID_CHANGED`, `ORACLE_SIGNER_CONFIGURATION_CHANGED`, `ORACLE_DENOMINATION_CHANGED`;
- `ORACLE_TIMESTAMP_ANOMALY`, `INDEPENDENT_PRICE_DISAGREEMENT`;
- `ORACLE_ASSURANCE_INVALIDATED`, `ORACLE_ASSURANCE_DETERIORATED`, `ORACLE_ASSURANCE_IMPROVED`.

These reuse the existing episode fingerprints, durable alert/delivery records and notification adapters. Assurance improvement means a dimension or availability improved; it does not imply actionability. SQLite migration **4** adds hashed assurance records and optional evidence-bundle bindings. Versions 1, 2 and 3 are migrated with their original migration checksums. Retention preserves the latest record per continuity scope and bundle-bound audits.

## Bounded CLI

```powershell
npm run watchdog -- oracle-audit
npm run watchdog -- oracle-audit --save-evidence
npm run watchdog -- oracle-audit --save-evidence --json
npm run watchdog -- oracle-audit --block 21864844 --save-evidence
npm run watchdog -- oracle-status
npm run watchdog -- oracle-status --json
```

`--database` selects the existing SQLite facility (default `data/watchdog.sqlite`). An audit runs one bounded investigation and persists its assurance. `--save-evidence` additionally creates a new immutable UUID bundle. `oracle-status` reports the latest persisted result and its provenance; it makes **no fresh chain read**. If the latest audit was historical, both text and JSON preserve that fact. Empty status never manufactures an assurance result.

`oracle-audit --local-max-age-seconds <positive-integer>` enables only an operator-selected rejection policy. There is no implicit age threshold or heartbeat setting. Monitoring accepts the optional `monitoring.oracleLocalMaxAgeSeconds` configuration field. The interval between monitoring cycles is unrelated to oracle freshness.

Exit 0 means a bounded result was produced, including `UNVERIFIED`; exit 2 means invalid/unavailable data or a rejected local age policy; exit 1 means a command/configuration/execution error. No exit code establishes a safe position or permission to transact.

## Evidence and verification

Authoritative audit bundles contain `snapshot.json`, `assurance.json`, `supplemental.json` when available, `dependency-graph.json`, `audit-report.txt`, `manifest.json` and `manifest.sha256`. Source research bundles retain compiler inputs/outputs, metadata, runtime bytes and read traces. The writer uses exclusive creation and rejects archive paths and symlink traversal; verification checks the exact inventory, byte counts, every artifact hash and the manifest hash.

Two development audit captures are retained but superseded because their saved snapshot serialization does not match the finding artifact hashes. The older one also uses an earlier schema. They are not current audit evidence. See the exact dispositions and hashes in [the Phase 4 report](phase4-report.md) and [the evidence checker](../evidence/phase4/oracle-evidence-verification.json).

The offline checker validates reviewed references, compiler-source and emitted-metadata hashes, release links, AST/getter immutable bindings, reconstructed runtimes, audit schema, exact snapshot/supplemental artifact references, and archived RPC replay. Replay is explicitly `FIXTURE`; it is neither a new chain read nor a new compiler run, and does not claim to reconstruct the original type-tagged snapshot identifier from JSON.

See [the completion report](phase4-report.md), [file inventory](phase4-files.md) and [verification results](../evidence/phase4/verification-results.json) for exact outcomes.
