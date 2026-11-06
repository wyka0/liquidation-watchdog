/** Public errors contain a bounded internal code, never arbitrary exception/provider text. */
export declare function publicError(error: unknown): {
    code: string;
    message: string;
};
/** Defense in depth for human-readable text. Structured operational output uses allowlists instead. */
export declare function redactText(input: string): string;
