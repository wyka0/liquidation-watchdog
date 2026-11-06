import { DEPLOYMENT, NETWORK } from "../src/config/deployment.js";
import { stringify } from "../src/domain/serialize.js";
import { saveOracleBundle, sha256 } from "../src/oracle-assurance/evidence.js";

// Read-only candidate research. No value retrieved here is adopted as a risk-engine price.
const artifacts: Record<string, string> = {};
const urls = [
  ["reservoir-addresses", "https://docs.reservoir.xyz/security-and-compliance/smart-contract-addresses.md"],
  ["reservoir-savings", "https://docs.reservoir.xyz/products/savings-srusd-and-wsrusd.md"],
  ["dexscreener-exact-address", `https://api.dexscreener.com/token-pairs/v1/pharos/${DEPLOYMENT.collateralToken}`],
  ["chainlink-megaeth", "https://data.chain.link/feeds/megaeth/megaeth/wsrusd-rusd-exchange-rate"]
] as const;
for (const [id, url] of urls) {
  const context = { subjectAddress: DEPLOYMENT.collateralToken, subjectChainId: NETWORK.chainId, url, block: null,
    independentComparatorEligible: false, classification: "RESEARCH_NOT_QUALIFIED_PRICE_EVIDENCE" };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: "error" });
    const chunks: Uint8Array[] = []; let length = 0;
    if (response.ok && response.body) {
      const reader = response.body.getReader();
      try { for (;;) { const next = await reader.read(); if (next.done) break; length += next.value.length; if (length > 1_000_000) throw new Error(); chunks.push(next.value); } }
      finally { await reader.cancel(); }
    } else await response.body?.cancel();
    const bytes = Buffer.concat(chunks), text = bytes.toString("utf8");
    const sanitize = (value: string) => value.replace(/https?:\/\/[^\s<>"')]+/g, match => {
      const parsed = new URL(match); parsed.username = ""; parsed.password = ""; parsed.search = ""; parsed.hash = ""; return parsed.href;
    });
    const rows = id === "reservoir-addresses" ? (text.match(/<tr>[\s\S]*?<\/tr>/g) ?? []).filter(row => /Pharos|d3fd63209fa2d55b07a0f6db36c2f43900be3094/i.test(row)) : [];
    const retained = id.startsWith("reservoir-") ? sanitize(text) : id === "dexscreener-exact-address" ? sanitize(text) : "";
    artifacts[`${id}.json`] = stringify({ ...context, retrievedAt: new Date().toISOString(), status: response.status,
      responseSha256: response.ok ? sha256(bytes) : null, retainedText: retained, exactRelevantRows: rows.map(sanitize),
      transformation: "Public document retained in full within byte bound; URL userinfo, queries and fragments removed. Original response SHA-256 retained.",
      unresolved: ["No exact temporally aligned collateral/loan quote with proved independent operator and upstream is adopted.",
        "Issuer redemption rates, API display prices and differently denominated cross-chain feeds require separate qualification."] }) + "\n";
  } catch {
    artifacts[`${id}.json`] = stringify({ ...context, retrievedAt: new Date().toISOString(), status: "UNAVAILABLE", reason: "BOUNDED_PUBLIC_REQUEST_FAILED" }) + "\n";
  }
}
console.log(stringify(await saveOracleBundle(artifacts, { prefix: "independent-research" })));
