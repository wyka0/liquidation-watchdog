# Prior-project pattern reuse

The three earlier Pharos projects were consulted selectively as reference material. The new implementation lives entirely in `C:\liquidation-watchdog`; their repositories were kept read-only. No environment, wallet, key, or other secret files were needed.

| Reference | Pattern reused or adapted |
| --- | --- |
| `C:\pharos-dapp-support-agent\src\retrieval\mcp.ts` | Official MCP `Client` + `StreamableHTTPClientTransport`; explicit tool allowlist; envelope validation and public-data-only trace boundaries |
| `C:\pharos-dapp-support-agent\src\retrieval\http.ts` | Request deadline and `Retry-After` handling; adapted into a shared paced queue with bounded read retries |
| `C:\pharos-threshold-guardian\src\chain\readers.ts` | Block-qualified provenance, explicit failed reads, and preventing missing data from becoming a passing condition |
| `C:\pharos-skill-chain-flow\src\mcp.ts` | Small official-SDK adapter lifecycle and reliable client cleanup |

The implementation is specialized to this mainnet Morpho reader. In particular, it requires matching RPC **and** MCP data, uses explicit pinned Multicall batches and before/after block checks, and never turns a failed MCP call into an accepted RPC-only snapshot.

Morpho accounting and oracle behavior were derived from version-pinned official Solidity source and source linked to deployed runtime, rather than from prior project risk heuristics. Original fetched Solidity files retain their source headers and provenance in `evidence/phase1/sources/`.
