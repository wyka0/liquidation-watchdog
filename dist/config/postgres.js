import { DataError } from "../domain/errors.js";
export const PG_LIMITS = Object.freeze({ connectionsPerRole: 1, queuedPerRole: 3, connectMs: 5_000, idleMs: 5_000,
    queryMs: 6_000, transactionMs: 10_000, readTransactionMs: 4_000, writerStatementMs: 5_000, readerStatementMs: 1_000,
    lockMs: 1_000, closeMs: 5_000, cycleMs: 240_000, jobMs: 300_000, leaseSeconds: 360, httpMs: 420_000, bodyBytes: 1_024,
    storageStopBytes: 800_000_000, pendingDeliveries: 10_000 });
export const SLOT_PERIOD_DEFAULT_SECONDS = 300;
const invalid = () => new DataError("POSTGRES_CONFIG", "Explicit, verified PostgreSQL configuration is required.");
/** The one cadence source (A2 approval). Slots stay on the UTC minute grid; the interval must at least hold
 * the full cycle budget so a normal execution fits inside its own slot window. */
function slotPeriodSeconds(input) {
    if (input !== undefined && !/^[1-9][0-9]{0,4}$/.test(input)) {
        throw new DataError("POSTGRES_CONFIG", "WATCHDOG_SCHEDULER_SLOT_SECONDS must be a canonical positive integer.");
    }
    const value = input === undefined ? SLOT_PERIOD_DEFAULT_SECONDS : Number(input);
    if (!Number.isSafeInteger(value) || value < PG_LIMITS.cycleMs / 1_000 || value > 3_600
        || value % 60 !== 0 || 3_600 % value !== 0) {
        throw new DataError("POSTGRES_CONFIG", `WATCHDOG_SCHEDULER_SLOT_SECONDS must be an integer multiple of 60 seconds that divides 3600 and is at least ${PG_LIMITS.cycleMs / 1_000}; the approved A2 interval is ${SLOT_PERIOD_DEFAULT_SECONDS} seconds (5 minutes).`);
    }
    return value;
}
/** No pg environment/default URL discovery, URL-supplied TLS files, or permissive SSL options. */
export function connectionConfiguration(value) {
    try {
        if (!value || value.length > 4_096)
            throw invalid();
        const url = new URL(value);
        if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.username || !url.password || url.hash
            || !/^[A-Za-z0-9.-]+$/.test(url.hostname) || ["localhost", "127.0.0.1"].includes(url.hostname)
            || !/^\/[A-Za-z0-9_-]{1,63}$/.test(url.pathname)
            || [...url.searchParams].some(([name, mode]) => name === "sslmode" ? !["require", "verify-full"].includes(mode)
                : name === "channel_binding" ? mode !== "require" : true)
            || url.searchParams.getAll("sslmode").length > 1 || url.searchParams.getAll("channel_binding").length > 1)
            throw invalid();
        const port = url.port ? Number(url.port) : 5432;
        if (!Number.isInteger(port) || port < 1 || port > 65_535)
            throw invalid();
        // Transaction poolers can reject PostgreSQL's startup `options` parameter. Runtime transactions
        // still set the same search path locally before any application SQL; direct maintenance connections
        // retain startup hardening. Detect the conventional pooler endpoint marker, never a specific host.
        const pooled = url.hostname.toLowerCase().split(".")[0].endsWith("-pooler");
        return { host: url.hostname, port, database: url.pathname.slice(1), user: decodeURIComponent(url.username),
            password: decodeURIComponent(url.password), ssl: { rejectUnauthorized: true }, sslnegotiation: "postgres",
            enableChannelBinding: url.searchParams.get("channel_binding") === "require",
            ...(pooled ? {} : { options: "-c search_path=pg_catalog" }),
            application_name: "liquidation-watchdog", client_encoding: "UTF8" };
    }
    catch {
        throw invalid();
    }
}
/** Called only by the explicit PostgreSQL entrypoint. It never loads credential files. */
export function postgresConfiguration(input) {
    if (input.WATCHDOG_STORAGE_BACKEND !== "postgres" || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(input.WATCHDOG_POSTGRES_NAMESPACE ?? "")
        || ![undefined, "true", "false"].includes(input.WATCHDOG_SCHEDULER_ENABLED))
        throw invalid();
    const writer = connectionConfiguration(input.WATCHDOG_POSTGRES_WRITER_URL), reader = connectionConfiguration(input.WATCHDOG_POSTGRES_READER_URL);
    if (writer.user === reader.user || writer.host !== reader.host || writer.port !== reader.port || writer.database !== reader.database)
        throw invalid();
    return { backend: "postgres", namespace: input.WATCHDOG_POSTGRES_NAMESPACE, schedulerEnabled: input.WATCHDOG_SCHEDULER_ENABLED === "true",
        slotPeriodSeconds: slotPeriodSeconds(input.WATCHDOG_SCHEDULER_SLOT_SECONDS), writer, reader };
}
//# sourceMappingURL=postgres.js.map