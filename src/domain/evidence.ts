import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { captureDirectory } from "../config/evidence.js";
import type { Snapshot } from "./types.js";
import { stringify } from "./serialize.js";
import { renderReport } from "./report.js";
import { prepareEvidenceCapture } from "../operations/resources.js";

export async function saveSnapshotEvidence(snapshot: Snapshot, directory = captureDirectory("inspect", undefined)): Promise<void> {
  const context = {
    evidenceKind: snapshot.evidenceKind,
    retrievedAt: snapshot.retrievedAt,
    chainId: snapshot.network.chainId,
    block: snapshot.block,
    accountRole: snapshot.accountRole
  };
  const documents: Record<string, unknown> = {
    "position-snapshot.json": snapshot,
    "network-verification.json": { ...context, network: snapshot.network, observedChainIds: snapshot.observedChainIds, heads: snapshot.heads },
    "contract-verification.json": { ...context, contracts: snapshot.contracts, basis: "Code presence and same-block runtime hash agreement; explorer source attribution is captured separately." },
    "market-parameters.json": { ...context, marketId: snapshot.marketId, params: snapshot.params, market: snapshot.market, tokens: snapshot.tokens },
    "market-id-verification.json": { ...context, configured: snapshot.marketId, derivedFromActualParameters: snapshot.derivedMarketId, matches: snapshot.derivedMarketId === snapshot.marketId },
    "oracle-investigation-live.json": { ...context, oracle: snapshot.oracle, findings: snapshot.quality.findings.filter(item => item.scope === "oracle") },
    "mcp-rpc-comparison.json": { ...context, endpoints: [snapshot.network.rpc, snapshot.network.mcp], comparisons: snapshot.consistency.comparisons, providerIndependence: "Two access paths; hosted MCP reports the same upstream RPC. Agreement is not independent consensus." },
    "block-consistency.json": { ...context, ...snapshot.consistency },
    "accounting.json": { ...context, accounting: snapshot.accounting, valuation: snapshot.valuation, actionable: false },
    "read-trace.json": { ...context, reads: snapshot.reads }
  };
  const text = { ...Object.fromEntries(Object.entries(documents).map(([name, document]) => [name, `${stringify(document)}\n`])), "cli-report.txt": renderReport(snapshot) };
  const target = prepareEvidenceCapture(directory, text);
  await mkdir(target, { recursive: true, mode: 0o700 });
  for (const [name, contents] of Object.entries(text)) await writeFile(join(target, name), contents, { encoding: "utf8", mode: 0o600 });
}
