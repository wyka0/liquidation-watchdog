import { createHash } from "node:crypto";
import { DataError } from "../../domain/errors.js";
import { utcSchema } from "../../monitoring/model.js";
export const PG_MAX_INT8 = 9223372036854775807n;
export const corrupt = () => new DataError("STORE_CORRUPT", "PostgreSQL persistence failed validation; no reset or replacement was attempted.");
export const textHash = (text) => createHash("sha256").update(text).digest("hex");
export function sequence(value) {
    if (typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > PG_MAX_INT8)
        throw new DataError("READ_PAGE", "Invalid exact bigint cursor.");
    return value;
}
/** Only bounded operational counters are Numbers. Financial decimals never use this codec. */
export function counter(value) {
    if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value) || BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER))
        throw corrupt();
    return Number(value);
}
export function utcText(value) {
    if (!utcSchema.safeParse(value).success || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value))
        throw corrupt();
    return value;
}
export function stored(schema, text, maxBytes = 1_048_576) {
    if (typeof text !== "string" || Buffer.byteLength(text) > maxBytes)
        throw new DataError("READ_LIMIT", "Stored data exceeds the read budget.");
    try {
        return schema.parse(JSON.parse(text));
    }
    catch {
        throw corrupt();
    }
}
export function encoded(schema, input, maxBytes = 262_144) {
    schema.parse(input);
    const text = JSON.stringify(input);
    if (Buffer.byteLength(text) > maxBytes)
        throw new DataError("RESOURCE_DATABASE_LIMIT", "A persistence payload exceeds its bounded size.");
    return text;
}
//# sourceMappingURL=codec.js.map