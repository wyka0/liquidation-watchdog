import { validateStartupConfiguration, VERIFIED_RUNTIME } from "../config/production.js";
import { monitoringScope } from "../monitoring/model.js";
import { MonitorStore } from "../storage/store.js";
import { MIGRATIONS } from "../storage/migrations.js";
import { CURRENT_EVIDENCE } from "../config/evidence.js";
import { evidenceStatistics, resourceStatus } from "./resources.js";
import { publicError } from "./redaction.js";
import { probeConnectivity } from "./connectivity.js";
import { demoPositionConfiguration } from "../config/position.js";
export const SAFETY_STATUS = Object.freeze({ oracleAssurance: "UNVERIFIED", freshness: "UNKNOWN", financialActionability: false,
    estimates: "INDICATIVE_ONLY", productionReleaseReady: false,
    blockers: ["ORACLE_ECONOMICS_AND_OPERATORS_UNVERIFIED", "UPSTREAM_FRESHNESS_UNKNOWN", "INDEPENDENT_COMPARATOR_UNQUALIFIED", "PRODUCTION_HOST_ACCEPTANCE_AND_APPROVAL_REQUIRED"] });
export async function operationalDiagnostics(config, thresholds, options = {}) {
    const position = options.position ?? demoPositionConfiguration(thresholds), now = (options.now ?? (() => new Date()))(), configuration = validateStartupConfiguration(config, { ...(options.environment ? { environment: options.environment } : {}), position, thresholds });
    const runtime = { node: process.version, sqlite: process.versions.sqlite ?? "UNAVAILABLE", platform: process.platform, architecture: process.arch, verified: VERIFIED_RUNTIME,
        checkerUptimeSeconds: Math.floor(process.uptime()), checkerRssBytes: process.memoryUsage().rss };
    let connectivity = { rpc: "UNKNOWN", mcp: "UNKNOWN", checkedAt: null, mode: "PERSISTED_AS_OF_SNAPSHOT" };
    if (options.probe && configuration.valid)
        connectivity = await (options.connectivity ?? (() => probeConnectivity(config.operations.connectivityTimeoutSeconds * 1_000)))();
    let store;
    try {
        store = (options.openStore ?? (path => new MonitorStore(path, { readOnly: true })))(config.storage.path);
        const scope = monitoringScope(thresholds, undefined, position);
        const summary = store.summary(scope), stats = store.statistics(), worker = store.runtime(), ownership = store.ownership();
        const latest = summary.state.latest, last = summary.state.lastAccepted;
        const age = last?.risk.snapshotRetrievedAt ? now.getTime() - Date.parse(last.risk.snapshotRetrievedAt) : Infinity;
        const currentAcceptedRead = Boolean(latest?.accepted && last?.risk.evidenceKind === "LIVE_CHAIN_READ" && age >= 0 && age <= config.operations.chainStatusMaxAgeSeconds * 1_000);
        if (!options.probe) {
            connectivity.checkedAt = last?.risk.snapshotRetrievedAt ?? null;
            if (currentAcceptedRead) {
                connectivity.rpc = "REACHABLE_AS_OF_ACCEPTED_SNAPSHOT";
                connectivity.mcp = "REACHABLE_AS_OF_ACCEPTED_SNAPSHOT";
            }
            else {
                if (latest?.diagnostics.includes("RPC_UNAVAILABLE"))
                    connectivity.rpc = "UNAVAILABLE";
                if (latest?.diagnostics.includes("MCP_UNAVAILABLE"))
                    connectivity.mcp = "UNAVAILABLE";
            }
        }
        const resources = { ...resourceStatus(store.storagePath, store, config.resources, worker?.rssBytes),
            memoryMeasurement: worker ? "WORKER_AS_OF_RUNTIME_RECORD" : "CHECKER_ONLY", memoryMeasuredAt: worker?.updatedAt ?? now.toISOString() };
        let evidence;
        try {
            evidence = { available: true, ...evidenceStatistics(CURRENT_EVIDENCE, config.resources) };
        }
        catch (error) {
            evidence = { available: false, code: publicError(error).code };
        }
        const activeWorker = worker && !["STOPPED", "FAILED"].includes(worker.status);
        const grace = Math.max(config.operations.cycleTimeoutSeconds, config.monitoring.intervalSeconds, config.operations.failureBackoffMaxSeconds) + config.operations.shutdownTimeoutSeconds + 10;
        const stalled = Boolean(activeWorker && now.getTime() - Date.parse(worker.updatedAt) > grace * 1_000);
        const workerStatus = ownership === "HELD" ? activeWorker ? stalled ? "STALLED" : "RUNNING" : "OWNER_PRESENT_IDENTITY_UNKNOWN"
            : activeWorker ? "STOPPED_UNCLEAN" : worker?.status === "FAILED" ? "FAILED" : "NOT_RUNNING";
        const workerCoherent = !["STALLED", "STOPPED_UNCLEAN", "FAILED", "OWNER_PRESENT_IDENTITY_UNKNOWN"].includes(workerStatus)
            && ownership !== "UNKNOWN" && (!worker || worker.scope === scope);
        const processHealthy = configuration.valid && resources.ok && workerCoherent;
        const connected = [connectivity.rpc, connectivity.mcp].every(status => status === "REACHABLE" || status === "REACHABLE_AS_OF_ACCEPTED_SNAPSHOT");
        const initialized = Boolean(last);
        const cycleSettled = Boolean(summary.latestCycle?.status === "COMPLETED" && summary.latestCycle.id === latest?.cycleId);
        const ready = processHealthy && stats.schemaVersion === MIGRATIONS.length && evidence.available && connected && initialized && currentAcceptedRead && cycleSettled;
        return { commandScope: "LOCAL_OPERATIONAL_DIAGNOSTICS", checkedAt: now.toISOString(),
            processHealth: { checker: "HEALTHY", healthy: processHealthy, workerStatus, ownership, worker },
            database: { available: true, schemaCurrent: stats.schemaVersion === MIGRATIONS.length, ...stats }, configuration, runtime,
            lastCycle: summary.latestCycle, lastSuccessfulChainRead: last ? { retrievedAt: last.risk.snapshotRetrievedAt, blockNumber: last.risk.blockNumber,
                blockHash: last.risk.blockHash, evidenceKind: last.risk.evidenceKind } : null,
            pendingDeliveryCount: resources.pendingDeliveries, deliveryCounts: summary.deliveryCounts, providerLimits: summary.providerLimits,
            monitoring: { initialized, currentAcceptedRead, latestAccepted: latest?.accepted ?? false, consecutiveFailures: summary.state.consecutiveFailures },
            connectivity, resources, evidence, recentFailures: store.recentFailures(), latestReadDiagnostics: latest?.diagnostics ?? [],
            operationalReadiness: { readyForObservation: ready, currentChainSnapshotRequired: true, latestCycleSettled: cycleSettled, workerCoherent,
                monitorRunning: workerStatus === "RUNNING" },
            ...SAFETY_STATUS };
    }
    catch (error) {
        return { commandScope: "LOCAL_OPERATIONAL_DIAGNOSTICS", checkedAt: now.toISOString(), runtime, configuration,
            processHealth: { checker: "HEALTHY", healthy: false, workerStatus: "UNKNOWN", ownership: "UNKNOWN", worker: null },
            database: { available: false, schemaCurrent: false, error: publicError(error).code }, connectivity,
            lastCycle: null, lastSuccessfulChainRead: null, pendingDeliveryCount: null,
            operationalReadiness: { readyForObservation: false, currentChainSnapshotRequired: true, monitorRunning: false }, ...SAFETY_STATUS };
    }
    finally {
        store?.close();
    }
}
//# sourceMappingURL=diagnostics.js.map