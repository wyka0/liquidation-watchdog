import { randomUUID } from "node:crypto";
import { relative } from "node:path";
import { parseMonitoringConfiguration } from "../config/monitoring.js";
import { DataError } from "../domain/errors.js";
import { stringify } from "../domain/serialize.js";
import { evaluateAssurance, oracleContinuityScope } from "../oracle-assurance/evaluate.js";
import { saveOracleBundle } from "../oracle-assurance/evidence.js";
import { dependencyGraph, renderOracleStatus } from "../oracle-assurance/report.js";
import { inspectSupplemental, supplementalResultSchema } from "../oracle-assurance/supplemental.js";
import { riskSnapshotSchema } from "../risk/snapshot-schema.js";
import { MonitorStore } from "../storage/store.js";
export async function runOracleCli(options, inspect, write, now, overrides = {}) {
    const dependencies = { openStore: path => new MonitorStore(path, { readOnly: options.command === "oracle-status" }), supplemental: inspectSupplemental, save: saveOracleBundle, ...overrides };
    const config = parseMonitoringConfiguration({}, options.database ? { database: options.database } : {});
    let store;
    try {
        store = dependencies.openStore(config.storage.path);
    }
    catch (error) {
        if (options.command !== "oracle-status" || !(error instanceof DataError) || error.code !== "STORE_NOT_FOUND")
            throw error;
        write(options.json ? stringify({ status: "NO_PERSISTED_AUDIT", latest: null, actionable: false }) + "\n"
            : "No persisted oracle assurance result. Database unavailable; assurance UNVERIFIED, freshness UNKNOWN, actionable: false.\n");
        return 0;
    }
    try {
        if (options.command === "oracle-status") {
            const latest = store.latestOracleAssurance();
            if (options.json)
                write(stringify({ status: latest ? "PERSISTED_AS_OF_SNAPSHOT" : "NO_PERSISTED_AUDIT", latest, actionable: false }) + "\n");
            else
                write(latest ? `${renderOracleStatus(latest.assurance)}Persisted result; no fresh chain read was performed.\n` : "No persisted oracle assurance result. Run oracle-audit for one bounded investigation.\n");
            return 0;
        }
        store.acquireMonitor();
        const snapshot = await inspect(options.block);
        if ((options.block !== undefined && snapshot.block !== null && snapshot.block.number !== options.block)
            || (options.block !== undefined && snapshot.evidenceKind === "LIVE_CHAIN_READ") || (options.block === undefined && snapshot.evidenceKind === "HISTORICAL_SNAPSHOT")) {
            throw new DataError("ORACLE_AUDIT_MODE", "The audit snapshot differs from the explicitly requested block or temporal mode.");
        }
        const supplemental = snapshot.block && (snapshot.evidenceKind !== "FIXTURE" || overrides.supplemental) ? await dependencies.supplemental(snapshot) : undefined;
        const previous = store.latestOracleAssurance(oracleContinuityScope(snapshot.evidenceKind, options.block))?.assurance ?? null;
        const assurance = evaluateAssurance(snapshot, { now: now(), previous,
            ...(supplemental ? { supplemental } : {}), ...(options.block === undefined ? {} : { block: options.block }),
            ...(options.localMaxAgeSeconds === undefined ? {} : { localMaxAgeSeconds: options.localMaxAgeSeconds }) });
        let bundle;
        if (options.saveEvidence) {
            // The finding hashes identify the schema-normalized serialization used by the evaluator.
            // Preserve that exact byte representation; its SHA-256 is distinct from the type-tagged snapshot ID.
            const normalizedSnapshot = riskSnapshotSchema.safeParse(snapshot), normalizedSupplemental = supplementalResultSchema.safeParse(supplemental);
            const capture = await dependencies.save({ "assurance.json": stringify(assurance) + "\n", "snapshot.json": stringify(normalizedSnapshot.success ? normalizedSnapshot.data : snapshot) + "\n",
                "dependency-graph.json": stringify(dependencyGraph(assurance)) + "\n", "audit-report.txt": renderOracleStatus(assurance),
                ...(supplemental ? { "supplemental.json": stringify(normalizedSupplemental.success ? normalizedSupplemental.data : supplemental) + "\n" } : {}) }, { now: now() });
            bundle = { path: relative(process.cwd(), capture.directory).replaceAll("\\", "/"), manifestSha256: capture.manifestSha256 };
        }
        store.saveOracleAssurance(`audit_${randomUUID()}`, assurance, bundle);
        write(options.json ? stringify({ assurance, bundle: bundle ?? null }) + "\n" : renderOracleStatus(assurance));
        if (!options.json && bundle)
            write(`Immutable evidence: ${bundle.path}/ | manifest SHA-256: ${bundle.manifestSha256}\n`);
        return ["DATA_INVALID", "DATA_UNAVAILABLE"].includes(assurance.gate) ? 2 : 0;
    }
    finally {
        store.close();
    }
}
//# sourceMappingURL=oracle.js.map