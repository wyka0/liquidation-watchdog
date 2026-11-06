import { createHash } from "node:crypto";
import { getAddress, zeroAddress } from "viem";
import { z } from "zod";
import { DEPLOYMENT, NETWORK } from "../config/deployment.js";
import { DataError } from "../domain/errors.js";
import { addressSchema, hashSchema, sameHex } from "../validation/schemas.js";
export const POSITION_PROTOCOL = "MORPHO_BLUE";
export const positionModeSchema = z.enum(["DEMO", "CONFIGURED"]);
export const positionAccountRoleSchema = z.enum([
    "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET",
    "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET"
]);
const inputSchema = z.object({
    chainId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    protocol: z.literal(POSITION_PROTOCOL),
    protocolAddress: addressSchema,
    marketId: hashSchema,
    account: addressSchema,
    oracleAddress: addressSchema,
    irmAddress: addressSchema,
    loanToken: addressSchema,
    collateralToken: addressSchema
}).strict();
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function positionIdentityFingerprint(identity) {
    return digest(["position-identity-v1", identity.chainId, identity.protocol, identity.protocolAddress.toLowerCase(),
        identity.marketId.toLowerCase(), identity.account.toLowerCase(), identity.oracleAddress.toLowerCase(),
        identity.irmAddress.toLowerCase(), identity.loanToken.toLowerCase(), identity.collateralToken.toLowerCase()]);
}
/** Stage 3C supports account selection only inside the one reviewed reader deployment. */
export function parsePositionIdentity(raw) {
    const parsed = inputSchema.safeParse(raw);
    if (!parsed.success)
        throw new DataError("POSITION_IDENTITY_INVALID", "Position identity must contain only the complete documented chain, protocol, market, account and asset fields.");
    const value = parsed.data;
    if (sameHex(value.account, zeroAddress))
        throw new DataError("POSITION_ACCOUNT_INVALID", "The configured position account must be a non-zero EVM address.");
    const supported = value.chainId === NETWORK.chainId && value.protocol === POSITION_PROTOCOL
        && sameHex(value.protocolAddress, DEPLOYMENT.morpho) && sameHex(value.marketId, DEPLOYMENT.marketId)
        && sameHex(value.oracleAddress, DEPLOYMENT.oracle) && sameHex(value.irmAddress, DEPLOYMENT.irm)
        && sameHex(value.loanToken, DEPLOYMENT.loanToken) && sameHex(value.collateralToken, DEPLOYMENT.collateralToken);
    if (!supported)
        throw new DataError("POSITION_UNSUPPORTED", "Only the reviewed Pharos Morpho Blue market and its exact protocol, oracle, IRM and asset identities are supported.");
    const canonical = {
        chainId: value.chainId, protocol: value.protocol, protocolAddress: getAddress(value.protocolAddress),
        marketId: value.marketId.toLowerCase(), account: getAddress(value.account), oracleAddress: getAddress(value.oracleAddress),
        irmAddress: getAddress(value.irmAddress), loanToken: getAddress(value.loanToken), collateralToken: getAddress(value.collateralToken)
    };
    return Object.freeze({ positionId: positionIdentityFingerprint(canonical), ...canonical });
}
export const DEMO_POSITION_IDENTITY = parsePositionIdentity({
    chainId: NETWORK.chainId, protocol: POSITION_PROTOCOL, protocolAddress: DEPLOYMENT.morpho,
    marketId: DEPLOYMENT.marketId, account: DEPLOYMENT.account, oracleAddress: DEPLOYMENT.oracle,
    irmAddress: DEPLOYMENT.irm, loanToken: DEPLOYMENT.loanToken, collateralToken: DEPLOYMENT.collateralToken
});
export function accountRole(mode) {
    return mode === "DEMO" ? "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET" : "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
}
//# sourceMappingURL=model.js.map