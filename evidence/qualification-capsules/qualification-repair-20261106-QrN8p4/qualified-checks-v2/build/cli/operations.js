import { loadMonitoringConfiguration } from "../config/monitoring.js";
import { requireStartupConfiguration, validateStartupConfiguration } from "../config/production.js";
import { stringify } from "../domain/serialize.js";
import { operationalDiagnostics, SAFETY_STATUS } from "../operations/diagnostics.js";
import { publicError } from "../operations/redaction.js";
import { createBackup, verifyBackup, verifyRestore } from "../storage/backup.js";
import { MonitorStore } from "../storage/store.js";
import { loadRuntimeConfiguration } from "../config/runtime.js";
export async function runOperationsCli(options, write, now) {
    const output = (result) => write(stringify(result) + "\n");
    try {
        if (options.command === "backup-verify") {
            output(await verifyBackup(options.backup));
            return 0;
        }
        const config = await loadMonitoringConfiguration(options.configPath, options.database ? { database: options.database } : {});
        if (options.command === "config-check") {
            const resolved = await loadRuntimeConfiguration({ monitoringPath: options.configPath,
                monitoringOverrides: options.database ? { database: options.database } : {}, positionPath: options.positionConfigPath });
            const validation = validateStartupConfiguration(resolved.monitoring, { thresholds: resolved.thresholds, position: resolved.position });
            output({ configuration: validation, ...SAFETY_STATUS });
            return validation.valid ? 0 : 2;
        }
        if (options.command === "backup") {
            output(await createBackup(config.storage.path, options.output, { now, limits: config.resources }));
            return 0;
        }
        if (options.command === "restore-verify") {
            output(await verifyRestore(options.backup, options.restoreRoot, config.notifications.maxAttempts));
            return 0;
        }
        if (options.command === "database-init") {
            const resolved = await loadRuntimeConfiguration({ monitoringPath: options.configPath,
                monitoringOverrides: options.database ? { database: options.database } : {}, positionPath: options.positionConfigPath });
            requireStartupConfiguration(config, { thresholds: resolved.thresholds, position: resolved.position });
            const store = new MonitorStore(config.storage.path, { limits: config.resources });
            try {
                output({ initialized: true, database: store.statistics(), ...SAFETY_STATUS });
            }
            finally {
                store.close();
            }
            return 0;
        }
        const resolved = await loadRuntimeConfiguration({ monitoringPath: options.configPath,
            monitoringOverrides: options.database ? { database: options.database } : {}, thresholdPath: options.riskConfigPath,
            positionPath: options.positionConfigPath });
        const result = await operationalDiagnostics(config, resolved.thresholds, { now, probe: options.probe, position: resolved.position });
        output(result);
        return options.command === "readiness" ? result.operationalReadiness.readyForObservation ? 0 : 2 : result.processHealth.healthy ? 0 : 2;
    }
    catch (error) {
        output({ passed: false, error: publicError(error), ...SAFETY_STATUS });
        return 2;
    }
}
//# sourceMappingURL=operations.js.map