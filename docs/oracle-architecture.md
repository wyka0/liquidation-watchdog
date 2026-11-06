# Selected oracle architecture and configuration

**The implementation path is established; the underlying economic source is unresolved.** All addresses in this document are chain-bound to **Pharos Pacific Mainnet (1672)** unless explicitly stated otherwise.

## Dependency graph and evidence anchor

The source/runtime research anchor is block **21864844**, hash **`0x34bed88e5dcc0890c2087cc2f2c7f71a484e74bd7a140cb5f8449c4196a61f8b`**, block timestamp **1793553649**. Source metadata was retrieved between `2026-11-01T17:21:22.670Z` and `2026-11-01T17:23:06.723Z`. This is historical evidence, not a statement about a later block.

```text
Morpho market
  -> MorphoChainlinkOracleV2.price()
     -> BASE_FEED_1: SelfManagedFeedsCacheProxy.latestRoundData()
        -> configurable cache address + feed ID
           -> SelfManagedFeedsCache stored answer/observation timestamp
              <- configured KeystoneForwarder
                 <- report: DON/version + f+1 distinct signatures
                 <- route: separately owner-authorized forwarder
                    <- allowed workflow ID / optional workflow-owner check
                       <- underlying economic product and inputs: UNRESOLVED
```

| Role | Exact identifier | Confidence and evidence |
| --- | --- | --- |
| Market | `0xbea21c372be9729760844cb2d60879f5ced6a8a5bba9a538dea8801e8ac49e73` | `PROVEN`: pinned market parameters and derived market ID |
| Morpho | `0x18573fA18fd17dDfD790B4a5B5b2977aad3b4Efb` | `PROVEN`: snapshot/runtime/compiler reproduction |
| Oracle | `0x9416F861970C2a39c02ab7696Ef0496383d4E81b` | `PROVEN`: market parameter and reproduced immutable composition |
| Proxy/facade | `0xb5779919e2F183e59A34140331F7779cbFF1d1BC` | `PROVEN`: active base feed, reproduced source/runtime |
| Cache | `0xd9F00c86ced2De92F6B7152b0492cb28edc4B5a8` | `PROVEN`: pinned proxy getter and reproduced runtime |
| Feed ID | `0x0007c129e624689953a2636c014531b2f0bd0c15f9a22211f53023354f309fa6` | `PROVEN` cache key; economic product mapping `UNKNOWN` |
| Forwarder | `0x76c9cf548b4179F8901cda1f8623568b58215E62` | `PROVEN`: pinned cache getter and reproduced runtime |
| Collateral | `0x4809010926aec940b550D34a46A52739f996D75D` | Pinned market/token reads; issuer registry maps this Pharos address to wsrUSD |
| Loan | `0xC879C018dB60520F4355C26eD1a6D572cdAC1815` | Pinned market/token reads; 6 decimals; symbol is display metadata |

Primary artifacts: [research snapshot](../evidence/phase4/oracle-research-2026-11-01T17-23-46-683Z-9ad554c5-ffdd-4f43-83d7-3a52a8abd91f/snapshot.json), [source/compiler proof](../evidence/phase4/oracle-research-2026-11-01T17-23-46-683Z-9ad554c5-ffdd-4f43-83d7-3a52a8abd91f/independent-recompilation.json), [collateral addendum](../evidence/phase4/collateral-proof-2026-11-01T17-28-39-523Z-2726e5be-5979-42ba-9fbb-c29342e4be09/collateral-proof.json), and [new bounded audit captures](../evidence/phase4/oracle-smoke.json). Research read records retain request, endpoint, pinned block and retrieval time; audit findings bind the hashed supplemental trace to the fixed RPC endpoint and audit block. RPC and MCP are shared-upstream corroboration.

## Source and runtime identity

Explorer metadata was obtained from `https://api.socialscan.io/pharos-mainnet/v1/explorer/contract/<lowercase-address>/code`. Every compiler input source was retained with its original verification-service URL, byte count, retrieval time and SHA-256. Compilation used exact native Solidity releases from the [official Windows manifest](https://binaries.soliditylang.org/windows-amd64/list.json), with binary SHA-256 and Keccak checks. Full settings, remappings, metadata settings and library maps are archived in each `*-compiler-input.json`; library maps were empty.

| Contract | Exact compiler | EVM / viaIR / optimizer runs | Input sources | Full deployed runtime SHA-256 |
| --- | --- | --- | --- | --- |
| Oracle | `0.8.21+commit.d9974bed` | Paris / true / 999999 | 9 | `178a10129f94627df4d95f019df5eb7875a4d1049364fe28ff69c06dd456c794` |
| Proxy | `0.8.26+commit.8a97fa7a` | Cancun / false / 200 | 10 | `95027d40e661cafffa6a90129991f47fd63b59bd0435481f53cc5a0b2414a9fa` |
| Cache | `0.8.26+commit.8a97fa7a` | Cancun / false / 200 | 14 | `8bb736091d9032c49a1b279f51406f653b3fbf7c0880d7b917c93b2ce9086103` |
| Forwarder | `0.8.24+commit.e11b9ed9` | Paris / false / 1000000 | 11 | `f9c0c886360e5fd0b5837b83a0d307cea7aab6a43ad05d2c6ebf2f023e04edd0` |
| Morpho | `0.8.19+commit.7dd6d404` | Paris / true / 999999 | 14 | `5b1b9424a6dc46c6a041f8eb1d69239342e89f3726ea31dc409cae9dd333a55f` |
| Collateral (`WsrusdOft`) | `0.8.22+commit.4fc1097e` | Paris / compiler default false / 200 | 44 | `494f468eef50ffd3c8b6debdec66583cb02c433bdb1ae8bd12f5927dc417e8e8` |

All six deployed runtimes were independently reproduced, including metadata bytes. Immutables were bound using compiler AST IDs, compiler-emitted runtime reference offsets, and public getters at the pinned block; deployed bytes were not copied into unexplained offsets. The oracle had nine immutable bindings, Morpho one, and collateral two. Proxy/cache/forwarder had no runtime immutable substitutions.

The initial main research artifact records collateral reproduction as incomplete. The separate collateral addendum completes AST **1386 → `endpoint`**, value `0x6f475642a6e85809b1c36fa62763669b1b48dd5b`, and **2906 → `decimalConversionRate`**, value `1000000000000`. The internal `innerToken` declaration has no emitted runtime immutable references. Forty-two collateral sources appear in emitted contract metadata; all 44 compiler input sources are separately hashed. The original incomplete record is retained honestly.

`CONTRACT_IDENTITY` checks the five Morpho/pricing-path dependencies on each snapshot. Collateral reproduction is supplementary identity research; it does not prove cross-chain redemption equivalence. The [offline checker](../scripts/check-oracle-evidence.ts) reconstructs the archived outputs and verifies all six hashes; it does not execute solc again or establish economic truth.

## Proxy relationships

The named proxy is a reproduced `SelfManagedFeedsCacheProxy` **facade with owner-controlled `setCache` and `setFeedId`**, rather than a conclusion inferred from its name. It calls a cache interface. At the historical anchor, the EIP-1967 implementation, admin and beacon slots all contain zero. Those zero slots alone would be insufficient to establish architecture; the full runtime/source reproduction provides the behavioral evidence.

The oracle's feed/vault composition is immutable in its reproduced runtime. A stable oracle address therefore does not imply stable data: the referenced facade can select another cache or feed ID, and the cache/forwarder owners control further dependencies.

## Ownership and permission boundaries

These controller addresses are historical observations at the anchor, not real-world identities or trust endorsements:

| Control | Address | Reproduced permission boundary |
| --- | --- | --- |
| Proxy owner | `0x007DB8D5b32015E34f63Cf5312505ADf03Fcca5d` | Changes cache and feed ID; ownership transfer |
| Cache owner | `0x59538b88DB99635Eb9181AdFBd1F6CF5588DDFf0` | Changes forwarder, workflow allowlist and allowed-workflow owner; ownership transfer |
| Forwarder owner | `0xB8F1032c6E69ef81DB98CF036133b9CBeAD1B3b0` | Sets/clears DON configurations and adds/removes authorized forwarders; ownership transfer |
| Additional allowed-workflow-owner check | `0x0000000000000000000000000000000000000000` | Zero disables only this additional owner comparison |

The cache requires the configured forwarder as caller and an allowed workflow ID. Zero workflow-owner configuration does **not** make the workflow-ID allowlist or forwarder check disappear.

`report` validates the configured DON/version and exactly `f+1` distinct configured signatures. `route` instead accepts a separately owner-authorized forwarder and does not perform that signature-validation path. `clearConfig` emits `ConfigSet(..., 0, [])`; it must be treated as a configuration change. Mapping entries are not completely enumerable through this bounded audit.

Reviewed source: [proxy](../evidence/phase1/sources/SelfManagedFeedsCacheProxy.sol), [cache](../evidence/phase1/sources/SelfManagedFeedsCache.sol), [forwarder](../evidence/phase1/sources/KeystoneForwarder.sol), [ownership](../evidence/phase1/sources/ConfirmedOwnerWithProposal.sol). Reviewed source hashes, preservation of the original source archive, and the separate compiler/runtime reproduction are checked during verification.

## Workflow, signatures and bounded history

At block 21864844 the 8,000-block scan covers **21856845–21864844** and observes **zero configuration events**. This establishes only the returned bounded window, not deployment-to-present immutability or complete history.

Two sampled cache updates bind log → successful receipt → transaction calldata → publication block/header → feed ID/answer/observation timestamp. Each yields four distinct recovered signatures. The sampled active configuration at the audit block is **DON 1, version 1, config ID 4294967297, f=3, ten signers**. Historical signature recovery and current signer-set membership are explicitly separate observations; addresses do not identify ten independent real-world organizations.

Workflow ID: `0x00bd398f80a8f53c31e1270678b7dd5283d5b9a0f5898ae3c4ceed15455ede02`. Reported workflow owner: `0xf0900CD3ef1eba7f96756D22DC5c7EE1A012D449`. The workflow was allowed at both sampled transaction blocks and the audit block. The workflow program, feed product, aggregation inputs, quote denomination and operator identities remain `UNKNOWN`.

Storage interpretation is bound to the reproduced forwarder layout: `s_owner` slot 0, `s_pendingOwner` 1, `s_configs` 2, `s_forwarders` 3, `s_transmissions` 4. `OracleSet` contains `f` at relative slot/offset 0, `signers` at slot 1 and `_positions` at slot 2. The audit checks one sampled active configuration and at most 31 signers; it never guesses this layout for a changed runtime.

Supplemental limits are **96 requests, 120 seconds total wall budget, 15 seconds/request, 2,000,000 bytes/response, 8,000 history blocks, 1,000 blocks/query, 512 logs jointly across configuration and answer history, eight configuration-event block headers, two update transactions, one signer configuration**. Fixed-endpoint read methods and exact getter selectors/addresses are allowlisted. Exhaustion or failed binding becomes unavailable with sanitized diagnostics. See [assurance integration](oracle-assurance.md) for persistent invalidation and alert behavior.

## Mechanical price composition

There is one active feed and no active base/quote vault or secondary feed. Feed and collateral decimals are 18; loan decimals are 6. `SCALE_FACTOR = 1000000` and `Morpho price = feed answer × 1000000`. Morpho uses its `10^36` price scale for collateral-base-unit to loan-base-unit conversion.

At the historical anchor, the latest feed answer is `1106203549076968373`; the resulting Morpho price is `1106203549076968373000000`. Mechanical normalization to whole loan-token units per whole collateral-token unit gives the rational value `1.106203549076968373`. Calling that value a verified wsrUSD/USDC market price would require the missing economic quote/source evidence. No active quote feed independently proves a USDC peg. [Independent validation](oracle-independent-validation.md) explains why issuer redemption and other-chain exchange-rate data cannot fill this gap automatically.
