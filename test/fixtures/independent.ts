import { DEPLOYMENT, NETWORK } from "../../src/config/deployment.js";
import { INDEPENDENT_PROOFS } from "../../src/oracle-assurance/model.js";
import type { IndependentCandidate } from "../../src/oracle-assurance/model.js";
import { REVIEWED_SOURCES } from "../../src/oracle-assurance/reviewed.js";

/** Synthetic proofs only: this candidate is never eligible as production evidence. */
export function candidateFixture(): IndependentCandidate {
  const base = { chainId: NETWORK.chainId, address: DEPLOYMENT.collateralToken, decimals: 18 }, quote = { chainId: NETWORK.chainId, address: DEPLOYMENT.loanToken, decimals: 6 };
  return { id: "independent_fixture", availability: "AVAILABLE", base, quote, kind: "MARKET_PRICE", denomination: "WHOLE_QUOTE_PER_WHOLE_BASE", price: (10n ** 18n).toString(),
    decimals: 18, timestamp: "9000", frequencySeconds: "300", operatorId: "separate_operator", upstreamId: "separate_upstream",
    proofs: INDEPENDENT_PROOFS.map(claim => ({ claim, evidence: { ...REVIEWED_SOURCES[0]!, subjectAddress: claim === "QUOTE" ? quote.address : base.address,
      source: "fixture:independence", sourceKind: "FIXTURE", method: "Synthetic evidence for unit tests only." } })) };
}
