export type PriceDenomination = "WHOLE_QUOTE_PER_WHOLE_BASE" | "QUOTE_BASE_UNITS_PER_BASE_UNIT";
export declare function normalizePrice(value: bigint, decimals: number, baseDecimals: number, quoteDecimals: number, denomination: PriceDenomination): {
    numerator: bigint;
    denominator: bigint;
};
