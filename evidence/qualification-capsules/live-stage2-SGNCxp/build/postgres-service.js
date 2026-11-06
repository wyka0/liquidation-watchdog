import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { postgresConfiguration } from "./config/postgres.js";
import { loadRuntimeConfiguration } from "./config/runtime.js";
import { PostgresRuntime } from "./runtime/postgres-runtime.js";
import { installSignals } from "./runtime/service.js";
import { notificationAdapters } from "./notifications/adapters.js";
import { structuredLogger } from "./monitoring/logs.js";
/** Import-safe, separately selected entrypoint. Configuration is consumed only on explicit invocation. */
export async function runPostgresService(input, write = text => { process.stdout.write(text); }) {
    let runtime, removeSignals;
    try {
        const configuration = postgresConfiguration(input), port = input.PORT;
        if (!port || !/^[1-9][0-9]{0,4}$/.test(port) || Number(port) > 65_535)
            throw new Error();
        // Monitoring policy and thresholds resolve once. Scheduler enablement/cadence remain the A2 environment
        // contract and are applied by the runtime shim; notification flags remain explicit non-secret configuration.
        const resolved = await loadRuntimeConfiguration({ monitoringPath: input.WATCHDOG_MONITORING_CONFIG_PATH,
            thresholdPath: input.WATCHDOG_RISK_CONFIG_PATH, positionPath: input.WATCHDOG_POSITION_CONFIG_PATH });
        const adapters = notificationAdapters(resolved.monitoring, write, {
            WATCHDOG_TELEGRAM_BOT_TOKEN: input.WATCHDOG_TELEGRAM_BOT_TOKEN,
            WATCHDOG_TELEGRAM_CHAT_ID: input.WATCHDOG_TELEGRAM_CHAT_ID,
            WATCHDOG_DISCORD_WEBHOOK_URL: input.WATCHDOG_DISCORD_WEBHOOK_URL
        });
        runtime = new PostgresRuntime({ configuration, monitoring: resolved.monitoring, thresholds: resolved.thresholds, position: resolved.position,
            adapters, log: structuredLogger(write), port: Number(port), host: "0.0.0.0",
            readCredential: input.WATCHDOG_READ_API_TOKEN, schedulerCredential: input.WATCHDOG_SCHEDULER_SECRET });
        removeSignals = installSignals(runtime, () => { write('{"event":"postgres_runtime_failed","error":"PROCESS_SHUTDOWN_DEADLINE"}\n'); process.exit(1); });
        await runtime.start();
        return await runtime.done;
    }
    catch {
        await runtime?.stop();
        write('{"event":"postgres_runtime_failed","error":"RUNTIME_STARTUP_OR_SHUTDOWN"}\n');
        return 1;
    }
    finally {
        removeSignals?.();
    }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    process.exitCode = await runPostgresService({ WATCHDOG_STORAGE_BACKEND: process.env.WATCHDOG_STORAGE_BACKEND,
        WATCHDOG_POSTGRES_NAMESPACE: process.env.WATCHDOG_POSTGRES_NAMESPACE, WATCHDOG_POSTGRES_WRITER_URL: process.env.WATCHDOG_POSTGRES_WRITER_URL,
        WATCHDOG_POSTGRES_READER_URL: process.env.WATCHDOG_POSTGRES_READER_URL, WATCHDOG_SCHEDULER_ENABLED: process.env.WATCHDOG_SCHEDULER_ENABLED,
        WATCHDOG_SCHEDULER_SLOT_SECONDS: process.env.WATCHDOG_SCHEDULER_SLOT_SECONDS,
        WATCHDOG_MONITORING_CONFIG_PATH: process.env.WATCHDOG_MONITORING_CONFIG_PATH, WATCHDOG_RISK_CONFIG_PATH: process.env.WATCHDOG_RISK_CONFIG_PATH,
        WATCHDOG_POSITION_CONFIG_PATH: process.env.WATCHDOG_POSITION_CONFIG_PATH,
        WATCHDOG_TELEGRAM_BOT_TOKEN: process.env.WATCHDOG_TELEGRAM_BOT_TOKEN, WATCHDOG_TELEGRAM_CHAT_ID: process.env.WATCHDOG_TELEGRAM_CHAT_ID,
        WATCHDOG_DISCORD_WEBHOOK_URL: process.env.WATCHDOG_DISCORD_WEBHOOK_URL,
        WATCHDOG_READ_API_TOKEN: process.env.WATCHDOG_READ_API_TOKEN, WATCHDOG_SCHEDULER_SECRET: process.env.WATCHDOG_SCHEDULER_SECRET, PORT: process.env.PORT });
}
//# sourceMappingURL=postgres-service.js.map