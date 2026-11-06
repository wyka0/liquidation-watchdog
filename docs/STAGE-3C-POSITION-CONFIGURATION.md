# Stage 3C — Position Identity and Configuration Foundation

**Completed:** 2026-11-05  
**Scope:** one explicitly selected position; no orchestration, discovery, migration, or new chain integration  
**Decision:** **GO locally for the reviewed Pharos Morpho Blue market only**

## 1. Supported boundary

Stage 3C removes the account from the reader's compiled identity while keeping every reviewed market dependency pinned.

The current reader supports:

- chain ID `1672` (Pharos Pacific Mainnet);
- protocol `MORPHO_BLUE`;
- the existing reviewed Morpho Blue contract and market ID;
- the existing reviewed oracle, IRM, loan asset, and collateral asset;
- one explicitly configured, non-zero EVM account.

It does **not** support arbitrary chains, protocols, markets, assets, RPC/MCP endpoints, or discovered positions. Changing any pinned field is rejected as `POSITION_UNSUPPORTED`. This is account selection inside an existing reviewed reader, not a new live chain integration.

Morpho Blue identifies a market by its market ID rather than a market-specific contract address. `marketId` is therefore the canonical market-equivalent identifier; `protocolAddress` identifies the Morpho Blue contract.

## 2. Canonical identity

The canonical `PositionIdentity` contains:

```text
positionId          derived SHA-256 identity fingerprint
chainId             1672
protocol            MORPHO_BLUE
protocolAddress     reviewed Morpho Blue contract
marketId            reviewed Morpho market ID
account             selected non-zero EVM account
oracleAddress       reviewed market oracle
irmAddress          reviewed interest-rate model
loanToken           reviewed loan asset
collateralToken     reviewed collateral asset
```

Normalization rules:

- EVM addresses are syntax-validated and normalized with the standard checksum representation.
- The 32-byte market ID is normalized to lowercase.
- The account must be non-zero.
- Unknown and missing fields are rejected.
- All non-account identity fields must equal the reviewed deployment.
- The fingerprint uses an explicitly ordered, versioned array of lowercase canonical identity values; property order and address case do not affect it.

Identity is separate from thresholds, monitoring policy, storage paths, RPC endpoints, and secrets.

## 3. Configuration schema

The file is a strict versioned JSON document. Stage 3C validates a bounded array to detect duplicate canonical identities, then requires exactly one entry. More than one unique entry is rejected as `MULTI_POSITION_UNSUPPORTED`; Stage 3D owns orchestration.

```json
{
  "schemaVersion": 1,
  "positions": [
    {
      "enabled": true,
      "mode": "CONFIGURED",
      "identity": {
        "chainId": 1672,
        "protocol": "MORPHO_BLUE",
        "protocolAddress": "0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb",
        "marketId": "0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73",
        "account": "0x1111111111111111111111111111111111111111",
        "oracleAddress": "0x9416F861970C2a39c02ab7696Ef0496383d4E81b",
        "irmAddress": "0xD5E02889C13230458506CC842347c4E62F8cDF3a",
        "loanToken": "0xC879C018dB60520F4355C26eD1a6D572cdAC1815",
        "collateralToken": "0x4809010926aec940b550D34a46A52739f996D75D"
      },
      "thresholds": {
        "warningRatio": "1.30",
        "criticalRatio": "1.10",
        "targetRatio": "1.25",
        "liquidationBoundary": "1.00"
      }
    }
  ]
}
```

The account above is synthetic. The other addresses are public reviewed deployment identifiers required for validation. The file contains no RPC credential, provider token, database URL, notification destination, signing key, or wallet secret.

## 4. Threshold semantics

The position file reuses the existing exact decimal/WAD threshold implementation:

- every value is a positive exact decimal string;
- no floating-point conversion is used;
- liquidation boundary is the fixed Morpho invariant `1.00`;
- `warning > critical > 1.00`;
- `target > critical`;
- no value is clamped, reordered, or repaired;
- omitted threshold fields use the existing documented defaults.

When a position file is selected, it owns the threshold configuration. Combining it with `--risk-config`, threshold flags, or `WATCHDOG_RISK_CONFIG_PATH` is rejected as `POSITION_THRESHOLD_AMBIGUOUS`. This avoids undocumented precedence and cross-position threshold drift.

## 5. Loading paths

All files must be explicit local regular `.json` files, must not be symlinks, and are bounded to 32 KiB. Secret/credential/keystore-like filenames are rejected.

Supported selection paths:

- monitoring CLI: `--position-config <position.json>`;
- SQLite service: `--position-config <position.json>`;
- PostgreSQL service: `WATCHDOG_POSITION_CONFIG_PATH`;
- operational config/readiness diagnostics: `--position-config <position.json>`.

`WATCHDOG_MONITORING_CONFIG_PATH` remains the independent monitoring-policy path. It does not contain position identity or provider secrets.

The complete monitoring, position, and threshold configuration is validated before writable store acquisition, PostgreSQL pool work, scheduled jobs, or provider calls. Merely setting account-like environment variables has no effect; there are no per-field environment overrides.

## 6. Demo versus configured mode

Backward compatibility without a position file resolves an explicit in-memory `DEMO` configuration for the existing public demonstration account. It is exposed as:

```text
mode: DEMO
accountRole: PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET
```

An explicitly selected non-demo account must use:

```text
mode: CONFIGURED
accountRole: EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET
```

`DEMO` is accepted only for the compiled demonstration account. `CONFIGURED` cannot relabel that account. Neither role claims account ownership, custody, user authorization, current debt, oracle verification, or financial safety.

`enabled:false` preserves an inspectable identity configuration but prevents monitoring/scheduler startup. It is never silently changed to `true`.

## 7. Scope and isolation

The historical demo stream retains its exact existing scope:

```text
hash("monitor-v1", chainId, marketId, demoAccount, authoredThresholds, context)
```

This preserves compatibility with existing SQLite and PostgreSQL rows.

Configured positions use:

```text
hash("monitor-v2", positionId, authoredThresholds, context)
```

Consequences:

- different accounts cannot share state, episodes, alerts, progression, or assurance baselines;
- different authored threshold configurations cannot share a stream;
- live and historical contexts remain separate;
- changing configuration selects another scope; it never rewrites old observations or alerts;
- the local `alerts` command filters by the selected identity/threshold scope instead of mixing streams;
- public read models expose the selected `positionId`, mode, enabled status, and canonical identity.

Stage 3C still runs one position. It does not introduce a coordinator, shared cycle, bounded concurrency, or multi-position API.

## 8. Reader, risk, actions, and notifications

The selected configuration is passed through:

- snapshot query construction;
- snapshot identity and account-role labeling;
- Phase 2 identity validation and provenance;
- oracle-assurance snapshot validation;
- strict recovery eligibility identity binding;
- monitoring scope and persistence;
- SQLite/PostgreSQL read-model identity;
- alert rendering and notification delivery.

The reader never derives or replaces the configured account from an RPC/MCP response. A snapshot for another account is rejected against the selected identity.

All existing safety behavior remains:

- `actionable:false` is unconditional;
- configuration alone cannot create a recovery amount or financial option;
- financial options still require the complete Stage 3A strict gate and exact snapshot provenance;
- oracle assurance, freshness, progression, retrieval age, and block age remain independent;
- Stage 3B outbox, retry, fencing, and terminal-unknown delivery behavior is unchanged;
- console remains available; no real provider message is sent by configuration loading.

## 9. Persistence compatibility

No SQLite or PostgreSQL schema, migration, catalog fingerprint, table, index, or constraint changed.

Compatibility behavior:

- old demo scopes are unchanged;
- historical risk/observation schemas still accept the original demo role;
- current schemas additionally accept the explicit configured-account role;
- stored observations and alerts retain the identity and threshold text present when created;
- no historical row is updated or backfilled;
- configured identities use new scopes and therefore cannot reinterpret demo history.

## 10. Validation errors

Sanitized error codes include:

- `POSITION_IDENTITY_INVALID` — incomplete, malformed, unknown, or contradictory fields;
- `POSITION_ACCOUNT_INVALID` — zero account;
- `POSITION_UNSUPPORTED` — chain/protocol/market/oracle/IRM/assets outside the reviewed reader;
- `POSITION_MODE_MISMATCH` — demo/configured role contradicts the selected account;
- `POSITION_DUPLICATE` — repeated canonical identity in one document;
- `MULTI_POSITION_UNSUPPORTED` — more than one unique position at Stage 3C;
- `POSITION_THRESHOLD_AMBIGUOUS` — position thresholds combined with another threshold source;
- existing `INVALID_THRESHOLDS`, `INVALID_THRESHOLD_ORDER`, and `INVALID_LIQUIDATION_BOUNDARY` codes;
- `POSITION_DISABLED` — monitoring requested for a disabled position;
- `POSITION_CONFIG_FILE` / `POSITION_CONFIG_INVALID` — unsafe file or document.

Errors do not include file contents, account history, RPC results, credentials, or provider response text.

## 11. Automated verification

Focused tests cover:

- valid, incomplete, malformed, normalized, and deterministic identity;
- supported-chain/protocol/market/asset allowlisting;
- valid thresholds, ordering, target, and boundary errors;
- missing/malformed file handling and ambiguous sources;
- duplicate identity and multi-position rejection;
- explicit demo/configured mode behavior;
- account and threshold scope isolation;
- exact legacy demo scope compatibility;
- configured reader/risk identity binding;
- historical observation/alert identity preservation;
- SQLite persistence and public read projection;
- inert PostgreSQL runtime and fail-before-database validation;
- Stage 3A non-financial fallback and unconditional `actionable:false`;
- Stage 3B message rendering and unchanged notification behavior.

Results:

- focused identity/runtime/storage/action/notification suites: **14 files, 362/362 passed**;
- full unit suite: **48 files, 1006/1006 passed**;
- native PostgreSQL 17.11 integration: **1 file, 61/61 passed**;
- TypeScript `--noEmit`: PASS;
- full ESLint: PASS;
- production build: PASS.

## 12. Security restrictions

- Position JSON is non-secret and cannot contain credentials.
- RPC/MCP endpoints remain compiled reviewed endpoints; arbitrary endpoint input is unsupported.
- No discovery, signing, transaction construction, simulation-to-send bridge, or broadcasting exists.
- No configured identity proves account control or authorizes a transaction.
- No Neon connection, remote SQL, deployment, scheduler activation, or real notification occurred in Stage 3C.

## 13. Known limitations and Stage 3D boundary

- Exactly one selected position is supported per runtime.
- Only accounts in the one reviewed Pharos Morpho Blue market are supported.
- There is no position discovery or ownership proof.
- There is no multi-position coordinator, per-position cycle scheduling, partial-cycle status, or bounded multi-position concurrency.
- PostgreSQL scheduled-execution schema still represents one position/cycle stream.
- Real provider and production qualification remain separately blocked.

Stage 3D may design local multi-position orchestration only after separate approval. It must not silently reuse PostgreSQL's one-cycle scheduler model; any required persistence/scheduler migration needs a separate migration review and authorization.
