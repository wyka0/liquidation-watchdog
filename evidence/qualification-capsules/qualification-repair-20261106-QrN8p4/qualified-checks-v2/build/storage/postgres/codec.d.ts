import type { z } from "zod";
import { DataError } from "../../domain/errors.js";
export declare const PG_MAX_INT8 = 9223372036854775807n;
export declare const corrupt: () => DataError;
export declare const textHash: (text: string) => string;
export declare function sequence(value: unknown): string;
/** Only bounded operational counters are Numbers. Financial decimals never use this codec. */
export declare function counter(value: unknown): number;
export declare function utcText(value: string): string;
export declare function stored<T>(schema: z.ZodType<T>, text: unknown, maxBytes?: number): T;
export declare function encoded<T>(schema: z.ZodType<T>, input: T, maxBytes?: number): string;
