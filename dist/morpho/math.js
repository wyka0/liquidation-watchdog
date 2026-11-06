import { DataError } from "../domain/errors.js";
import { U128_MAX, U256_MAX } from "../validation/schemas.js";
export const WAD = 10n ** 18n;
export const ORACLE_SCALE = 10n ** 36n;
export const VIRTUAL_ASSETS = 1n;
export const VIRTUAL_SHARES = 1000000n;
export function uint(value, bits = 256) {
    if (typeof value !== "bigint" || value < 0n || value > (bits === 128 ? U128_MAX : U256_MAX)) {
        throw new DataError("INTEGER_RANGE", `Value is outside uint${bits}.`, "accounting");
    }
    return value;
}
export function add(x, y, bits = 256) {
    return uint(uint(x, bits) + uint(y, bits), bits);
}
export function sub(x, y) {
    return uint(uint(x) - uint(y));
}
export function mul(x, y) {
    return uint(uint(x) * uint(y));
}
function divisor(value) {
    if (uint(value) === 0n)
        throw new DataError("ZERO_DENOMINATOR", "Division by zero is invalid.", "accounting");
    return value;
}
export function mulDivDown(x, y, d) {
    return mul(x, y) / divisor(d);
}
export function mulDivUp(x, y, d) {
    // Match MathLib's checked (x * y + (d - 1)) / d, including the addition's
    // overflow boundary; arbitrary-precision bigint must not conceal an EVM revert.
    return add(mul(x, y), divisor(d) - 1n) / d;
}
export function toAssetsUp(shares, totalAssets, totalShares) {
    return mulDivUp(shares, add(totalAssets, VIRTUAL_ASSETS), add(totalShares, VIRTUAL_SHARES));
}
export function toSharesDown(assets, totalAssets, totalShares) {
    return mulDivDown(assets, add(totalShares, VIRTUAL_SHARES), add(totalAssets, VIRTUAL_ASSETS));
}
//# sourceMappingURL=math.js.map