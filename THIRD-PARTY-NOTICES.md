# Third-party notices

This repository ships **no third-party source code files**. During the
public-release remediation (Phase 8B), all captured third-party Solidity
sources and compiler input/output artifacts that embedded them were excluded
from this copy, because the required redistribution rights could not be
verified. The excluded material is preserved in the maintainer's private
pre-publication snapshot and includes, per its own license headers:

- Morpho Blue and companion libraries (SPDX `BUSL-1.1`, `GPL-2.0-or-later`);
- Chainlink oracle and data-feed libraries (SPDX `GPL-2.0-or-later`, `MIT`);
- LayerZero message-library sources (SPDX `LZBL-1.2`);
- two deployment contracts marked `UNLICENSED` (no license granted).

Because that material is excluded here, no obligations arise from it for
this public copy; anyone needing it should obtain it from the upstream
projects under their own terms.

## Retained third-party-derived material

- `test/fixtures/runtime.json` archives **compiled bytecode** of public
  on-chain contracts (Multicall3 and the Chainlink self-managed feeds
  cache/proxy stack) as read from public chain state at a recorded block.
  Bytecode archival for testing is retained with attribution to the
  upstream projects; the source copies inspected during preparation carried
  MIT license headers. No source text is redistributed by this repository.
- `package-lock.json` records npm dependency metadata, including each
  package's declared license field. No dependency source code is committed;
  dependencies are fetched from the npm registry under their own licenses
  at install time.

## Captured website content

Captured website page bodies (Chainlink, Reservoir, Pharos and DexScreener
documentation/API responses) were **removed** from this public copy because
redistribution permission was not established. Retained research records
contain only project-authored metadata: source title, original URL,
retrieval timestamps where recorded, response size/hash, and the project's
own factual findings.

## Historical license references

Historical qualification and audit documents may name the licenses above
for provenance purposes. Naming a license does not redistribute licensed
material, and this repository makes no claim about the terms of any
third-party license beyond what those projects publish themselves.
