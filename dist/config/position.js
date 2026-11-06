import { lstat, readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { z } from "zod";
import { DEPLOYMENT } from "./deployment.js";
import { canonicalThresholdDecimals, parseThresholds, validateThresholds } from "./risk.js";
import { DataError } from "../domain/errors.js";
import { localPath } from "../storage/paths.js";
import { accountRole, DEMO_POSITION_IDENTITY, parsePositionIdentity, positionModeSchema } from "../positions/model.js";
const entrySchema = z.object({
    enabled: z.boolean(), mode: positionModeSchema, identity: z.unknown(), thresholds: z.unknown().optional()
}).strict();
const documentSchema = z.object({ schemaVersion: z.literal(1), positions: z.array(entrySchema).min(1).max(10) }).strict();
export function validatePositionConfiguration(position, runtimeThresholds = position.thresholds) {
    try {
        if (position.schemaVersion !== 1 || typeof position.enabled !== "boolean" || !positionModeSchema.safeParse(position.mode).success
            || position.accountRole !== accountRole(position.mode))
            throw new Error("Invalid position envelope.");
        const identity = parsePositionIdentity({ chainId: position.identity.chainId, protocol: position.identity.protocol,
            protocolAddress: position.identity.protocolAddress, marketId: position.identity.marketId, account: position.identity.account,
            oracleAddress: position.identity.oracleAddress, irmAddress: position.identity.irmAddress,
            loanToken: position.identity.loanToken, collateralToken: position.identity.collateralToken });
        if (identity.positionId !== position.identity.positionId)
            throw new Error("Invalid position digest.");
        const isDemoAccount = identity.account.toLowerCase() === DEPLOYMENT.account.toLowerCase();
        if ((position.mode === "DEMO") !== isDemoAccount)
            throw new Error("Invalid position mode.");
        validateThresholds(position.thresholds);
        validateThresholds(runtimeThresholds);
        if (JSON.stringify(canonicalThresholdDecimals(position.thresholds)) !== JSON.stringify(canonicalThresholdDecimals(runtimeThresholds))) {
            throw new DataError("POSITION_THRESHOLD_MISMATCH", "The selected position and runtime must use one identical threshold configuration.");
        }
    }
    catch (error) {
        if (error instanceof DataError)
            throw error;
        throw new DataError("POSITION_CONFIG_INVALID", "The selected position configuration is invalid or was modified after validation.");
    }
}
export function demoPositionConfiguration(thresholds = parseThresholds()) {
    validateThresholds(thresholds);
    return Object.freeze({ schemaVersion: 1, enabled: true, mode: "DEMO", accountRole: accountRole("DEMO"),
        identity: DEMO_POSITION_IDENTITY, thresholds });
}
export function parsePositionConfigurationDocument(raw) {
    const parsed = documentSchema.safeParse(raw);
    if (!parsed.success)
        throw new DataError("POSITION_CONFIG_INVALID", "Position configuration must be a strict version 1 document with a bounded positions array.");
    const positions = parsed.data.positions.map(entry => {
        const identity = parsePositionIdentity(entry.identity), thresholds = parseThresholds(entry.thresholds ?? {});
        const isDemoAccount = identity.account.toLowerCase() === DEPLOYMENT.account.toLowerCase();
        if ((entry.mode === "DEMO") !== isDemoAccount) {
            throw new DataError("POSITION_MODE_MISMATCH", "DEMO mode is reserved for the compiled public demonstration account; configured accounts must use CONFIGURED mode.");
        }
        const position = Object.freeze({ schemaVersion: 1, enabled: entry.enabled, mode: entry.mode,
            accountRole: accountRole(entry.mode), identity, thresholds });
        validatePositionConfiguration(position);
        return position;
    });
    const ids = positions.map(position => position.identity.positionId);
    if (new Set(ids).size !== ids.length)
        throw new DataError("POSITION_DUPLICATE", "Duplicate canonical position identities are not permitted.");
    return Object.freeze(positions);
}
export function selectSinglePosition(raw) {
    const positions = parsePositionConfigurationDocument(raw);
    if (positions.length !== 1)
        throw new DataError("MULTI_POSITION_UNSUPPORTED", "Stage 3C requires exactly one explicitly selected position; multi-position orchestration is not enabled.");
    return positions[0];
}
export async function loadPositionConfiguration(path, legacyThresholds) {
    validateThresholds(legacyThresholds);
    if (path === undefined)
        return demoPositionConfiguration(legacyThresholds);
    if (extname(path).toLowerCase() !== ".json" || /^(?:\.env|.*(?:secret|credential|keystore))/i.test(basename(path))) {
        throw new DataError("POSITION_CONFIG_FILE", "An explicitly selected non-secret .json position file is required.");
    }
    try {
        const selected = localPath(path), stat = await lstat(selected);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32_768)
            throw new Error("Invalid config file size or type.");
        return selectSinglePosition(JSON.parse(await readFile(selected, "utf8")));
    }
    catch (error) {
        if (error instanceof DataError)
            throw error;
        throw new DataError("POSITION_CONFIG_FILE", "Position configuration must be a readable regular JSON file of at most 32 KiB.");
    }
}
//# sourceMappingURL=position.js.map