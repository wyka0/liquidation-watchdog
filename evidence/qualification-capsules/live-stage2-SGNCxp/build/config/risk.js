import { lstat, readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { z } from "zod";
import { DataError } from "../domain/errors.js";
import { uint, WAD } from "../morpho/math.js";
import { parseAmount } from "../validation/decimals.js";
import { localPath } from "../storage/paths.js";
export const DEFAULT_THRESHOLD_TEXT = Object.freeze({
    warningRatio: "1.30", criticalRatio: "1.10", targetRatio: "1.25", liquidationBoundary: "1.00"
});
const decimal = z.string().min(1).max(100);
const overridesSchema = z.object({
    warningRatio: decimal.optional(), criticalRatio: decimal.optional(),
    targetRatio: decimal.optional(), liquidationBoundary: decimal.optional()
}).strict();
export function parseThresholdOverrides(raw) {
    const parsed = overridesSchema.safeParse(raw);
    if (!parsed.success)
        throw new DataError("INVALID_THRESHOLDS", "Thresholds must be an object of named decimal strings; unknown fields are rejected.");
    const overrides = {};
    for (const name of Object.keys(DEFAULT_THRESHOLD_TEXT)) {
        const value = parsed.data[name];
        if (value !== undefined)
            overrides[name] = value;
    }
    return overrides;
}
export function parseThresholds(overrides = {}) {
    const text = Object.freeze({ ...DEFAULT_THRESHOLD_TEXT, ...parseThresholdOverrides(overrides) });
    const wad = Object.freeze({
        warningRatio: parseAmount(text.warningRatio, 18), criticalRatio: parseAmount(text.criticalRatio, 18),
        targetRatio: parseAmount(text.targetRatio, 18), liquidationBoundary: parseAmount(text.liquidationBoundary, 18)
    });
    const configuration = Object.freeze({ scale: WAD, decimal: text, wad });
    validateThresholds(configuration);
    return configuration;
}
export function validateThresholds(configuration) {
    const ratios = configuration.wad;
    for (const name of Object.keys(DEFAULT_THRESHOLD_TEXT)) {
        if (uint(ratios[name]) === 0n || parseAmount(configuration.decimal[name], 18) !== ratios[name]) {
            throw new DataError("INVALID_THRESHOLDS", "Every threshold must be a positive, consistently encoded WAD ratio.");
        }
    }
    // This boundary is a protocol invariant, not a user-adjustable liquidation rule.
    if (configuration.scale !== WAD || ratios.liquidationBoundary !== WAD) {
        throw new DataError("INVALID_LIQUIDATION_BOUNDARY", "Morpho's mathematical boundary must be exactly 1.00 (one WAD).");
    }
    if (ratios.criticalRatio <= ratios.liquidationBoundary || ratios.warningRatio <= ratios.criticalRatio
        || ratios.targetRatio <= ratios.criticalRatio) {
        throw new DataError("INVALID_THRESHOLD_ORDER", "Require warning > critical > 1.00 and target > critical.");
    }
}
/** Minimal exact decimal text for an 18-decimal WAD ratio. Equivalent authored forms ("1.30", "1.3", "1.300")
 * canonicalize to the same text, so configuration fingerprints never depend on representation. */
function canonicalDecimalText(value) {
    uint(value);
    const whole = value / WAD, fraction = value % WAD;
    if (fraction === 0n)
        return whole.toString();
    return `${whole}.${fraction.toString().padStart(18, "0").replace(/0+$/, "")}`;
}
export function canonicalThresholdDecimals(thresholds) {
    validateThresholds(thresholds);
    return Object.freeze(Object.fromEntries(Object.keys(DEFAULT_THRESHOLD_TEXT)
        .map(name => [name, canonicalDecimalText(thresholds.wad[name])])));
}
export async function loadThresholds(path, overrides = {}) {
    let fileOverrides = {};
    if (path !== undefined) {
        if (extname(path).toLowerCase() !== ".json" || /^(?:\.env|.*(?:secret|credential|keystore))/i.test(basename(path)))
            throw new DataError("CONFIG_FILE", "An explicitly selected non-secret .json threshold file is required.");
        try {
            path = localPath(path);
            const stat = await lstat(path);
            if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16_384)
                throw new Error("Invalid config file size or type.");
            fileOverrides = parseThresholdOverrides(JSON.parse(await readFile(path, "utf8")));
        }
        catch (error) {
            if (error instanceof DataError)
                throw error;
            throw new DataError("CONFIG_FILE", "Threshold configuration must be a readable regular JSON file of at most 16 KiB.");
        }
    }
    return parseThresholds({ ...fileOverrides, ...overrides });
}
//# sourceMappingURL=risk.js.map