import type { Address, Hex } from "viem";
import { z } from "zod";
export declare const POSITION_PROTOCOL: "MORPHO_BLUE";
export declare const positionModeSchema: z.ZodEnum<{
    DEMO: "DEMO";
    CONFIGURED: "CONFIGURED";
}>;
export type PositionMode = z.infer<typeof positionModeSchema>;
export declare const positionAccountRoleSchema: z.ZodEnum<{
    PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
    EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
}>;
export type PositionAccountRole = z.infer<typeof positionAccountRoleSchema>;
export interface PositionIdentity {
    readonly positionId: string;
    readonly chainId: number;
    readonly protocol: typeof POSITION_PROTOCOL;
    readonly protocolAddress: Address;
    readonly marketId: Hex;
    readonly account: Address;
    readonly oracleAddress: Address;
    readonly irmAddress: Address;
    readonly loanToken: Address;
    readonly collateralToken: Address;
}
export declare function positionIdentityFingerprint(identity: Omit<PositionIdentity, "positionId">): string;
/** Stage 3C supports account selection only inside the one reviewed reader deployment. */
export declare function parsePositionIdentity(raw: unknown): PositionIdentity;
export declare const DEMO_POSITION_IDENTITY: PositionIdentity;
export declare function accountRole(mode: PositionMode): PositionAccountRole;
