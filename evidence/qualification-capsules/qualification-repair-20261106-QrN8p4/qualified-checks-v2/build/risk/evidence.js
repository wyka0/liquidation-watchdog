import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DataError } from "../domain/errors.js";
import { stringify } from "../domain/serialize.js";
import { riskProvenance, snapshotIdentifier } from "./provenance.js";
import { renderRiskReport } from "./report.js";
import { riskSnapshotSchema } from "./snapshot-schema.js";
import { prepareEvidenceCapture } from "../operations/resources.js";
export async function saveRiskEvidence(snapshot, result, directory) {
    const parsed = riskSnapshotSchema.safeParse(snapshot);
    if (!parsed.success || snapshotIdentifier(parsed.data) !== result.inputSnapshotIdentifier) {
        throw new DataError("EVIDENCE_SNAPSHOT_MISMATCH", "Risk evidence cannot be saved with a different or unbound input snapshot.");
    }
    const expected = riskProvenance(parsed.data, result.inputSnapshotIdentifier);
    const provenanceKeys = ["chainId", "marketId", "account", "blockNumber", "blockHash", "blockTimestamp", "inputSnapshotIdentifier", "temporalContext", "evidenceKind"];
    for (const derived of [result, result.repayment, result.additionalCollateral]) {
        if (derived !== null && (derived.actionable !== false || derived.actionability.actionable !== false
            || provenanceKeys.some(key => derived[key] !== expected[key]))) {
            throw new DataError("EVIDENCE_DERIVATION_MISMATCH", "A derived result has different snapshot provenance or actionability.");
        }
    }
    const documents = {
        "input-snapshot.json": `${stringify(snapshot)}\n`,
        "risk-result.json": `${stringify(result)}\n`,
        "risk-report.txt": renderRiskReport(result),
        "repayment-estimate.json": `${stringify(result.repayment)}\n`,
        "collateral-estimate.json": `${stringify(result.additionalCollateral)}\n`
    };
    directory = prepareEvidenceCapture(directory, { ...documents, "manifest.json": "" });
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const files = [];
    for (const [file, contents] of Object.entries(documents)) {
        await writeFile(join(directory, file), contents, { encoding: "utf8", mode: 0o600 });
        files.push({ file, sha256: createHash("sha256").update(contents).digest("hex") });
    }
    await writeFile(join(directory, "manifest.json"), `${stringify({
        evidenceKind: result.evidenceKind, temporalContext: result.temporalContext, inputSnapshotIdentifier: result.inputSnapshotIdentifier,
        chainId: result.chainId, marketId: result.marketId, account: result.account,
        blockNumber: result.blockNumber, blockHash: result.blockHash, blockTimestamp: result.blockTimestamp, calculatedAt: result.calculatedAt,
        dataQuality: result.dataQuality.overall, oracleQuality: result.dataQuality.oracle, actionable: false, files
    })}\n`, "utf8");
}
//# sourceMappingURL=evidence.js.map