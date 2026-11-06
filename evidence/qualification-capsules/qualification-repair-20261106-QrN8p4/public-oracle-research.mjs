// Bounded public GET research only. Remote content is retained as evidence, never executed as instructions.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const audit = dirname(fileURLToPath(import.meta.url)), directory = join(audit, "public-oracle-research"); mkdirSync(directory);
const feedId = "0x0007c129e624689953a2636c014531b2f0bd0c15f9a22211f53023354f309fa6";
const collateral = "0x4809010926aec940b550D34a46A52739f996D75D";
const sources = [
  ["pharos-chainlink-push-engine", "https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe.md"],
  ["pharos-doc-index", "https://docs.pharos.xyz/llms.txt"],
  ["reservoir-addresses", "https://docs.reservoir.xyz/security-and-compliance/smart-contract-addresses.md"],
  ["reservoir-savings", "https://docs.reservoir.xyz/products/savings-srusd-and-wsrusd.md"],
  ["chainlink-exchange-rate-streams", "https://docs.chain.link/data-streams/exchange-rate-streams"],
  ["chainlink-redemption-schema-v7", "https://docs.chain.link/data-streams/reference/report-schema-v7"],
  ["chainlink-overview", "https://docs.chain.link/data-streams/overview"],
  ["chainlink-avalanche-wsrusd-rusd", "https://data.chain.link/feeds/avalanche/mainnet/wsrusd-rusd-exchange-rate"],
  ["dexscreener-exact-address", `https://api.dexscreener.com/latest/dex/tokens/${collateral}`],
  ["dexscreener-pharos-exact-address", `https://api.dexscreener.com/token-pairs/v1/pharos/${collateral}`]
];
const allowed = new Set(sources.map(([, url]) => new URL(url).host));
const startedAt = new Date().toISOString(), started = performance.now();
const maxBytes = 2_000_000, timeoutMs = 15_000, totalWallMs = 120_000;
const results = [];
for (let offset = 0; offset < sources.length; offset += 3) {
  assert.ok(performance.now() - started < totalWallMs, "Public research total wall bound exceeded");
  results.push(...await Promise.all(sources.slice(offset, offset + 3).map(async ([name, sourceUrl]) => {
    const beganAt = new Date().toISOString(), deadline = AbortSignal.timeout(timeoutMs);
    try {
      let current = sourceUrl, response, redirects = [];
      for (let count = 0; count < 4; count++) {
        assert.ok(allowed.has(new URL(current).host), "Redirect host is outside research allowlist");
        response = await fetch(current, { method: "GET", redirect: "manual", signal: deadline, headers: { Accept: "text/markdown,text/plain,text/html,application/json;q=0.9" } });
        if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
          const next = new URL(response.headers.get("location"), current).href; redirects.push({ from: current, status: response.status, to: next });
          await response.body?.cancel(); current = next; continue;
        }
        break;
      }
      const chunks = []; let bytes = 0;
      for await (const chunk of response.body ?? []) { bytes += chunk.length; if (bytes > maxBytes) throw new Error("RESPONSE_BYTE_LIMIT"); chunks.push(chunk); }
      const body = Buffer.concat(chunks), text = body.toString("utf8");
      const bodyPath = `${name}.body.txt`; writeFileSync(join(directory, bodyPath), body, { flag: "wx" });
      const content = text.split(/\n# Agent Instructions\b/)[0];
      const relevantLines = content.split(/\r?\n/).filter(line => /0007c129|b5779919|d9F00c86|Heartbeat|heart.?beat|Decimals|deviation|WSRUSD\/RUSD|Pharos|srUSD|wsrUSD|rUSD|observation|staleness|liquidity|source|operator|workflow/i.test(line))
        .map(line => line.slice(0, 2000)).slice(0, 160);
      const result = { name, sourceUrl, finalUrl: current, method: "GET", beganAt, retrievedAt: new Date().toISOString(), status: response.status,
        headers: Object.fromEntries(["content-type", "date", "etag", "last-modified"].map(header => [header, response.headers.get(header)])),
        redirects, block: null, bytes: body.length, responseSha256: createHash("sha256").update(body).digest("hex"), bodyPath, relevantLines,
        evidenceClass: "PUBLIC_DOCUMENT_OR_READ_ONLY_API_RESEARCH_NOT_AUTOMATIC_GATE_QUALIFICATION", ignoredRemoteAgentInstructionAppendix: content !== text };
      writeFileSync(join(directory, `${name}.json`), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
      return result;
    } catch (error) {
      const result = { name, sourceUrl, method: "GET", beganAt, retrievedAt: new Date().toISOString(), status: null, block: null,
        error: { name: error.name, code: error.cause?.code ?? null, classification: error.message === "RESPONSE_BYTE_LIMIT" ? "RESPONSE_BYTE_LIMIT" : "PUBLIC_SOURCE_UNAVAILABLE" },
        evidenceClass: "UNAVAILABLE_RESEARCH_NOT_PROOF_OF_MISSING_PRODUCT_OR_FRESHNESS" };
      writeFileSync(join(directory, `${name}.json`), JSON.stringify(result, null, 2) + "\n", { flag: "wx" }); return result;
    }
  })));
}
const pe = results.find(result => result.name === "pharos-chainlink-push-engine");
const report = { schemaVersion: 1, startedAt, completedAt: new Date().toISOString(), durationMs: performance.now() - started,
  bounds: { requestUrls: sources.length, concurrentRequests: 3, timeoutMs, totalWallMs, maxBytesPerResponse: maxBytes, maximumRedirectsPerUrl: 3 },
  identity: { chainId: 1672, feedId, facade: "0xb5779919e2F183e59A34140331F7779cbFF1d1BC", collateral,
    loan: "0xC879C018dB60520F4355C26eD1a6D572cdAC1815" },
  findings: { exactFeedRowFound: pe.status === 200 && pe.relevantLines.some(line => line.includes(feedId) && /WSRUSD\/RUSD/.test(line)),
    documentedHeartbeatSeconds: pe.status === 200 && pe.relevantLines.some(line => /Heartbeat.*3600 seconds/.test(line)) ? 3600 : null,
    declaredProduct: "WSRUSD/RUSD (not WSRUSD/USDC)",
    qualificationLimitations: ["A common-setting heartbeat declaration is not a verified maximum upstream observation age or end-to-end publication guarantee.",
      "The declared settings are not tied to the sampled workflow hash, DON configuration version, signer/operator identities, or complete active configuration fingerprint.",
      "The selected market mechanically uses a rUSD-denominated product in an 18-decimal collateral / 6-decimal USDC loan valuation without an active quote feed. Exact rUSD/USDC economic equivalence remains unproved.",
      "Public deployment descriptions identify a CRE / Data Streams architecture, not the exact workflow program, aggregation inputs or independent real-world operators.",
      "No public document or same-product/cross-chain feed is adopted as an eligible independent market-price comparator."] },
  results, safety: { realMonitorStopped: true, noChainPositionRead: true, noNotifications: true, noTransactionsOrWalletOperations: true,
    noPaidServiceOrAuthenticatedFeedAccess: true, noRemoteContentExecuted: true, noRepositoryWrites: true } };
writeFileSync(join(directory, "summary.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "RESEARCH_CAPTURED", findings: report.findings,
  sources: results.map(({ name, status, bytes, responseSha256, error }) => ({ name, status, bytes, responseSha256, error })) }, null, 2));
