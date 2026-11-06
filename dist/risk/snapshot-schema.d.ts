import { z } from "zod";
import type { Snapshot } from "../domain/types.js";
export declare const riskSnapshotSchema: z.ZodType<Snapshot>;
export declare const snapshotIdentitySchema: z.ZodObject<{
    network: z.ZodObject<{
        chainId: z.ZodNumber;
    }, z.core.$strip>;
    account: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
    accountRole: z.ZodEnum<{
        PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET: "PUBLIC_DEMONSTRATION_ACCOUNT_NOT_USER_WALLET";
        EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET: "EXPLICITLY_CONFIGURED_PUBLIC_ACCOUNT_NOT_USER_WALLET";
    }>;
    marketId: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
    block: z.ZodNullable<z.ZodObject<{
        number: z.ZodBigInt;
        hash: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
        parentHash: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
        timestamp: z.ZodBigInt;
    }, z.core.$strict>>;
    evidenceKind: z.ZodEnum<{
        LIVE_CHAIN_READ: "LIVE_CHAIN_READ";
        HISTORICAL_SNAPSHOT: "HISTORICAL_SNAPSHOT";
        FIXTURE: "FIXTURE";
    }>;
    retrievedAt: z.ZodISODateTime;
}, z.core.$strip>;
