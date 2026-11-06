import { DataError } from "../domain/errors.js";
export const OPERATION_COMMANDS = ["health", "readiness", "diagnostics", "config-check", "database-init", "backup", "backup-verify", "restore-verify"];
export function parseOperationsOptions(command, input) {
    const result = { command, probe: false }, args = [...input], seen = new Set();
    const common = ["--config", "--database"], diagnostic = ["health", "readiness", "diagnostics"].includes(command);
    const allowed = command === "backup-verify" ? ["--backup"] : command === "restore-verify" ? ["--backup", "--restore-root", "--config"]
        : [...common, ...(["config-check", "database-init"].includes(command) || diagnostic ? ["--position-config"] : []),
            ...(diagnostic ? ["--risk-config"] : []), ...(command === "readiness" ? ["--probe"] : []), ...(command === "backup" ? ["--output"] : [])];
    while (args.length) {
        const key = args.shift();
        if (!allowed.includes(key) || seen.has(key))
            throw new DataError("CLI_ARGUMENT", "Unknown or repeated operational option. Consult --help.");
        seen.add(key);
        if (key === "--probe") {
            result.probe = true;
            continue;
        }
        const value = args.shift();
        if (!value || value.startsWith("--") || value.length > 2_048 || /[\p{Cc}\p{Cf}]/u.test(value))
            throw new DataError("CLI_ARGUMENT", "An explicit bounded operational option value is required.");
        if (key === "--database")
            result.database = value;
        if (key === "--config")
            result.configPath = value;
        if (key === "--risk-config")
            result.riskConfigPath = value;
        if (key === "--position-config")
            result.positionConfigPath = value;
        if (key === "--output")
            result.output = value;
        if (key === "--backup")
            result.backup = value;
        if (key === "--restore-root")
            result.restoreRoot = value;
    }
    if ((command === "backup" && !result.output) || (["backup-verify", "restore-verify"].includes(command) && !result.backup)) {
        throw new DataError("CLI_ARGUMENT", "Backup commands require an explicit --output or --backup directory.");
    }
    return result;
}
//# sourceMappingURL=operations-options.js.map