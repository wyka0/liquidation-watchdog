import { DataError } from "../domain/errors.js";
import { U256_MAX } from "../validation/schemas.js";
const gcd = (a, b) => { while (b)
    [a, b] = [b, a % b]; return a; };
export function normalizePrice(value, decimals, baseDecimals, quoteDecimals, denomination) {
    if (value <= 0n || value > U256_MAX || [decimals, baseDecimals, quoteDecimals].some(n => !Number.isInteger(n) || n < 0 || n > 77)) {
        throw new DataError("INDEPENDENT_UNITS", "Prices must be positive uint256 values with explicit bounded decimal units.");
    }
    if (!["WHOLE_QUOTE_PER_WHOLE_BASE", "QUOTE_BASE_UNITS_PER_BASE_UNIT"].includes(denomination))
        throw new DataError("INDEPENDENT_UNITS", "An explicit supported denomination is required.");
    let numerator = value, denominator = 10n ** BigInt(decimals);
    if (denomination === "QUOTE_BASE_UNITS_PER_BASE_UNIT") {
        numerator *= 10n ** BigInt(baseDecimals);
        denominator *= 10n ** BigInt(quoteDecimals);
    }
    const factor = gcd(numerator, denominator);
    return { numerator: numerator / factor, denominator: denominator / factor };
}
//# sourceMappingURL=units.js.map