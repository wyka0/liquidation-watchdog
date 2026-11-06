import { encodeAbiParameters, keccak256, zeroAddress } from "viem";
import { DEPLOYMENT, NETWORK } from "../config/deployment.js";
import { DataError } from "../domain/errors.js";
import { WAD } from "../morpho/math.js";
import { marketParamsSchema, marketSchema, parseData, positionSchema, sameHex, tokenSchema } from "./schemas.js";
export function validateChainId(chainId) {
    if (chainId !== BigInt(NETWORK.chainId)) {
        throw new DataError("WRONG_CHAIN", `Expected chain ${NETWORK.chainId}; received chain ${chainId}.`, "network");
    }
}
export function deriveMarketId(params) {
    const p = parseData(marketParamsSchema, params, "INVALID_MARKET_PARAMS", "market");
    return keccak256(encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "uint256" }], [p.loanToken, p.collateralToken, p.oracle, p.irm, p.lltv]));
}
export function validateMarketParams(raw) {
    const p = parseData(marketParamsSchema, raw, "INVALID_MARKET_PARAMS", "market");
    if ([p.loanToken, p.collateralToken, p.oracle, p.irm].some(value => sameHex(value, zeroAddress))) {
        throw new DataError("MARKET_NOT_FOUND", "Selected market parameters contain a zero address.", "market");
    }
    for (const key of ["loanToken", "collateralToken", "oracle", "irm"]) {
        if (!sameHex(p[key], DEPLOYMENT[key]))
            throw new DataError("MARKET_ADDRESS_MISMATCH", `Market ${key} differs from the chain-bound deployment.`, "market");
    }
    if (p.lltv <= 0n || p.lltv >= WAD || p.lltv !== DEPLOYMENT.lltv) {
        throw new DataError("INVALID_LLTV", "Selected market LLTV differs from the verified 91.5%.", "market");
    }
    if (!sameHex(deriveMarketId(p), DEPLOYMENT.marketId)) {
        throw new DataError("MARKET_ID_MISMATCH", "Parameter-derived market ID does not match the selected market.", "market");
    }
    return p;
}
export function validateMarket(raw, block) {
    const m = parseData(marketSchema, raw, "INVALID_MARKET", "market");
    if (m.lastUpdate === 0n)
        throw new DataError("MARKET_NOT_FOUND", "Market lastUpdate is zero; this market does not exist.", "market");
    if (m.lastUpdate > block.timestamp)
        throw new DataError("FUTURE_MARKET_UPDATE", "Market update is later than the snapshot block.", "market");
    if (m.totalBorrowAssets > m.totalSupplyAssets)
        throw new DataError("INVALID_MARKET_TOTALS", "Market borrowed assets exceed supplied assets.", "market");
    if (m.fee > WAD / 4n)
        throw new DataError("INVALID_FEE", "Market fee exceeds Morpho's 25% maximum.", "market");
    return m;
}
export function validatePosition(raw, market) {
    const p = parseData(positionSchema, raw, "INVALID_POSITION", "position");
    if (p.borrowShares > market.totalBorrowShares || p.supplyShares > market.totalSupplyShares) {
        throw new DataError("POSITION_TOTAL_MISMATCH", "Position shares exceed the stored market totals.", "position");
    }
    // Do not require rounded borrower debt <= totalBorrowAssets: Morpho explicitly
    // permits a rounding surplus in expectedBorrowAssets (including virtual assets).
    return p;
}
export function validateToken(raw, role) {
    const t = parseData(tokenSchema, raw, "INVALID_TOKEN_METADATA", "tokens");
    const expectedAddress = role === "loan" ? DEPLOYMENT.loanToken : DEPLOYMENT.collateralToken;
    const expectedDecimals = role === "loan" ? DEPLOYMENT.loanDecimals : DEPLOYMENT.collateralDecimals;
    if (!sameHex(t.address, expectedAddress))
        throw new DataError("TOKEN_ADDRESS_MISMATCH", "Token address differs from the selected market.", "tokens");
    if (t.decimals !== expectedDecimals)
        throw new DataError("TOKEN_DECIMALS_MISMATCH", `${role} token decimals differ from the verified deployment.`, "tokens");
    return t;
}
//# sourceMappingURL=market.js.map