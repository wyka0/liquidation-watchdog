# Architecture and validation

## Modules

| Path | Responsibility |
| --- | --- |
| `src/config/` | Chain 1672, endpoints, fixed market/account, contract addresses, runtime pins, read limits, source references |
| `src/chain/` | Public RPC transport, paced reads, checked Multicall3 batches, snapshot collection and lifecycle |
| `src/mcp/` | Official MCP SDK client, Streamable HTTP session, tool discovery/allowlist, result validation |
| `src/morpho/` | Read-only ABI fragments and checked Morpho v1.0.0 arithmetic |
| `src/oracle/` | Feed/cache/forwarder ABIs, investigated adapter binding, freshness/quality assessment |
| `src/validation/` | Zod schemas, market and token identity, decimal boundaries, quality precedence |
| `src/domain/` | Typed snapshots/errors, bigint serialization, CLI report, evidence writer |
| `src/risk/` | Snapshot-bound risk validation, exact bands, share-aware repayment, collateral recovery, provenance and reporting |
| `src/monitoring/` | Opt-in lifecycle, independent transitions, source attribution, sanitized observations and logs |
| `src/storage/` | SQLite migrations, state/alert transactions, deduplication, durable delivery attempts and retention |
| `src/notifications/` | Console plus optional Telegram/Discord adapters, bounded retries and formatting |
| `src/cli/` | Inspect/risk/monitor/history/status dispatch; explicit temporal mode and separate threshold/monitor configuration |
| `test/` | Labeled fixtures, adversarial unit cases, separate real-chain integration |
| `scripts/` | Source/history capture, archival fixture extraction, verification and secret scan |

The CLI exposes `inspect` and `risk`, with optional `--block` and `--save-evidence`; `risk` also accepts threshold flags and an explicit JSON configuration file. The selected account, market, oracle policy, and network cannot be overridden by ambient environment variables. Phase 2 is layered on the snapshot lifecycle below; see [risk-engine architecture](risk-engine.md).

Phase 3 adds explicit `monitor`, `monitor --once`, `alerts` and `status` commands on this same lifecycle. See [monitoring architecture](monitoring-architecture.md) for opt-in scheduling, last-accepted state, outbox transactions and shutdown.

## Snapshot lifecycle

1. Query RPC `eth_chainId` and MCP `get_chain_info`. Require 1672, including agreement among the MCP's decimal/hex/expected-chain fields.
2. Read both heads. Use the common minimum minus five blocks, unless a positive explicit block is requested and both paths have reached it.
3. Retrieve that block's number, hash, parent hash, and timestamp on both paths. Reject wrong-number, zero, future, malformed, or disagreeing headers.
4. Check deployed bytecode for Multicall3, Morpho, IRM, oracle factory, oracle, both tokens, and feed proxy. Cross-check every runtime through MCP at the selected block. Multicall3 must match the investigated runtime pin before it is used.
5. Execute the `market-and-oracle` batch: market parameters/state/position; IRM and LLTV enablement; oracle factory recognition; token metadata; oracle composition/price; proxy round, timestamps, identity, and owner.
6. Validate and derive the market ID using `keccak256(abi.encode(loanToken, collateralToken, oracle, irm, lltv))`. Validate market existence and storage widths, position totals, token identity/decimals, and metadata text.
7. Follow the actual cache address returned by the proxy, check its runtime on both paths, and execute the `rate-and-cache` batch. `borrowRateView` receives the exact market parameters and stored totals just read at the same block.
8. Follow the cache's forwarder address, verify its code, and execute `forwarder-control` for owner/version. A normal complete snapshot verifies ten deployed contracts.
9. Read the original block header again through each path and compare to the initial header, then recheck both chain IDs. Any changed header or provider disagreement rejects the snapshot.
10. Assess oracle quality and calculate only when every required input exists, consistency checks passed, and quality is `VALID` or `UNVERIFIED`. Otherwise, derived accounting and valuation are null.

All contract calls and `get_code` calls use the same explicit numeric block tag. There are no `latest` contract reads inside a snapshot. Each Multicall batch contains EVM `getBlockNumber()` and `getCurrentBlockTimestamp()` sentinel reads, checked on **both** access paths. Three complete batches produce six sentinel comparisons and 58 total comparisons including code, headers, and chain ID.

`aggregate3` is invoked only through `eth_call`, without value. Its Solidity ABI is payable, but the child calls are restricted to known `view`/`pure` fragments. Each uses `allowFailure: true` so a reverted child produces an explicit `UNAVAILABLE` finding instead of being mistaken for an empty/zero result. Malformed successful returns and unequal success flags/bytes are rejected.

## Validation rules

- Bigint fields must fit their actual uint128/uint256 storage or ABI widths. Numeric RPC inputs that have already lost precision are rejected.
- Market `lastUpdate` must be nonzero and at most the block timestamp. Borrowed market assets cannot exceed supplied assets; fee cannot exceed Morpho's 25% maximum.
- Position supply/borrow shares cannot exceed the corresponding stored totals. A successfully read zero-share account is distinct from a failed position read.
- The four market addresses and 91.5% LLTV must match this chain-bound configuration; the derived market ID must match the requested ID.
- Loan and collateral decimals must be 6 and 18. Display metadata must be nonempty, bounded, and free of control/format characters. Symbols never establish identity.
- Oracle price and feed answer must be positive. Composition, vault samples, scale factor, proxy/cache answers, and timestamps must agree.
- `updatedAt` must be positive, nonfuture, and consistent with the bound adapter. Verified source requires equal `startedAt`/`updatedAt`, uint32 observation time, and zero round IDs for this adapter.
- Rate is a uint256 WAD/second value from `borrowRateView`. Zero is permitted; there is no invented APR bound. Every subsequent multiply/add and storage-sized result is checked for overflow.
- No invariant equates borrower rounded-up debt to or below the market's borrow assets: the official share library explicitly permits rounding/virtual-asset surplus.

Unread scopes are marked unavailable; a prior severe finding is retained. `VALID` describes a successful check in its own scope, not a complete position-level classification.

## Transport bounds

The two clients share a queue with at least **750 ms between HTTP request starts**. Transient read operations get at most **three attempts**, with 1s/2s backoff or the server's `Retry-After`. A delay above 15s stops the operation rather than retrying before the server permits it. Fetch timeout is 15s; MCP request timeout is 20s. Tool pagination is limited to four pages; one expired-session reconnection is allowed per tool invocation.

Read-only MCP allowlist:

```text
get_chain_info
get_block_number
get_block
get_code
eth_call
get_logs
get_transaction_receipt
```

The main inspector needs the first five. The bounded history script uses the equivalent RPC log/receipt methods. RPC has a matching seven-method allowlist. Required MCP tools must exist and must not explicitly advertise destructive or non-read-only behavior. Malformed payloads and service errors never trigger a zero-value fallback.

## Consistency limitations

The hosted MCP identifies `https://rpc.pharos.xyz` as its upstream. These are two access paths to the **same upstream**, not independent consensus providers. Agreement catches path/serialization/session inconsistencies but does not independently prove correct chain state.

Five-block lag, numeric pinning, in-EVM sentinels, and before/after hash checks mitigate mixed snapshots. They do not constitute a finality proof or prevent a later reorganization. Every report remains qualified by its recorded block/hash and retrieval time.
