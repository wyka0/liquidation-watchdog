import { DataError } from "./errors.js";
export function stringify(value, space = 2) {
    return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, space);
}
export function utcFromSeconds(seconds) {
    if (seconds < 0n || seconds > 8640000000000n) {
        throw new DataError("TIMESTAMP_RANGE", "Timestamp cannot be represented as a UTC date.");
    }
    // Only date presentation uses Number; amounts, rates and ratios stay bigint.
    return new Date(Number(seconds) * 1_000).toISOString();
}
//# sourceMappingURL=serialize.js.map