# Security and data quality

## Read-only boundary

The application uses public RPC and the official MCP SDK. There is no wallet client, account signing dependency, private-key input, environment-file loader, or generic write-method escape hatch. RPC/MCP method allowlists are enforced at runtime. Contract batches accept only known `view`/`pure` child methods and run via `eth_call` without value.

Historical log queries are limited to 1,000 blocks each. The investigation script makes eight bounded queries. Requests have paced starts, deadlines, and bounded retries; server `Retry-After` limits are respected. MCP availability is required for the main inspector, so an outage is not silently converted into a weaker single-path result.

Application writes are local reports/evidence/build output, the local SQLite monitor store, explicit backup/recovery scratch and configured notification messages. Chain access remains read-only. The configured public account is not represented as belonging to the user. All five phases retain this chain boundary. Phase 5 verification uses mocked external notifications only.

## Independent quality fields

Quality is recorded overall and separately for network, contracts, market, position, tokens, oracle, accounting, consistency, and snapshot errors. The precedence is:

```text
INVALID > UNAVAILABLE > STALE > UNVERIFIED > VALID
```

| State | Meaning |
| --- | --- |
| `VALID` | The relevant required checks passed within this scope |
| `UNVERIFIED` | Data is readable/consistent but a necessary trust or freshness policy remains unproven |
| `STALE` | Age exceeds a verified, positive maximum-age policy bound to this exact adapter |
| `UNAVAILABLE` | Required data could not be obtained, or a scope could not complete |
| `INVALID` | Wrong network, bad shape/range/identity, inconsistent return values, mixed blocks, changed hash, or invalid accounting |

An invalid value is not relabeled stale. Unknown heartbeat is not treated as a fabricated maximum age. A reported age is measured against the pinned block, not the local wall clock. Data consistency cannot establish authenticity of the off-chain source.

The live production policy has unverified source/operator/heartbeat fields. It permits explicitly indicative calculations while keeping oracle and overall status `UNVERIFIED`. Phase 2 reuses that policy, returns provisional mathematical bands separately, and quality-gates the result as `DATA_UNVERIFIED`. Every result and estimate sets `actionable: false`; there is no SAFE state. Caller-supplied verification flags cannot promote the selected oracle.

`accepted: true` means enough valid/consistent input exists for **read-only indicative reporting**. It is not an authorization or investment signal. On any severe failure, derived accounting and valuation are null. A successfully cross-checked zero-share read is the only path to `NO_DEBT`.

## Evidence sanitization

Chain endpoints must match the exact fixed public HTTPS URLs, with no user-info, custom path/query/fragment or alternate network; redirects are rejected. Reports use known public configuration and schema-validated data. Source metadata omits the explorer's verifier wallet field because it is not the current contract owner. Transport headers, session tokens, and environment contents are not saved. Optional notification endpoints are constructed privately from the three documented environment values; error handling never logs their request URL or provider response body. Strict persistent projections contain no raw exceptions, credentials or notification destinations. Operational errors expose fixed codes and generic messages.

The local scanner examines project-owned files and evidence for credential-assignment patterns, private-key blocks, provider tokens, bearer/JWT tokens, and credentials embedded in URLs. It excludes `.git`, dependencies, build output, coverage and private `data/`/`backups/`. Potential `.env`/key/keystore files are reported by name **without being opened**. Only the exact authored placeholder `.env.example` is separately hash-verified. Symlinks are not followed.

One exact `.test` URL in a negative transport test is a documented synthetic exception. The exception does not exempt the rest of its line or file. Findings report only a path, line, and rule, never the matched content. This is a reproducible scoped scan, not an assertion of exhaustive secret detection.

## Remaining limitations

- Exact upstream economic feed identity/denomination and workflow source are unverified.
- Controller addresses and one transmitter are observable, but operator identities and the complete active signer/workflow configurations are unverified.
- No verified heartbeat or expected-frequency policy has been established.
- The last cached value can remain readable after upstream delivery stops; the investigated oracle path does not enforce price age.
- RPC and hosted MCP share the same upstream; matching responses do not provide independent consensus.
- Numeric block pinning, sentinels, and header rechecks do not prove finality or prevent later reorganizations.
- Six deployed runtimes were independently reproduced with reviewed compiler/source/immutable-binding evidence. That establishes code binding, not off-chain economics/operators/freshness.
- The CLI is intentionally bound to one investigated market/account and does not claim a general adapter for arbitrary feeds.

Phase 2 adds snapshot-bound local mathematics and verification. Its estimates assume fixed price/LLTV and no intervening interest or market activity. Their proven model outcomes do not establish actual execution outcomes or liquidation protection. Phase 3 adds read-only monitoring and a durable outbox; Phase 4 adds evidence-based assurance and persistent invalidation. Phase 5 hardens lifecycle, storage, diagnostics, resources and recovery without promoting those trust claims. Unknown heartbeat remains unknown. See [recommendation assumptions](recommendation-math.md), [monitoring limitations](monitoring-architecture.md) and [production security](production-security.md). Production deployment and monitoring require separate approval and [host acceptance](release-readiness.md).
