import type { Address, Hex } from "viem";
import { z } from "zod";
import type { Snapshot } from "../domain/types.js";
import type { ConfigurationChange, OracleConfiguration } from "./model.js";
import { AuditRpc } from "./audit-rpc.js";
export { AUDIT_BOUNDS, AUDIT_READ_METHODS, AuditRpc } from "./audit-rpc.js";
export declare const IMPLEMENTATION_SLOT: `0x${string}`;
export interface ConfigurationEvent {
    code: ConfigurationChange;
    address: Address;
    blockNumber: string;
    blockHash: Hex;
    transactionHash: Hex;
    logIndex: string;
}
export interface SupplementalResult {
    status: "BOUNDED_READ_COMPLETE" | "UNAVAILABLE" | "UNSUPPORTED_IDENTITY";
    block: {
        number: string;
        hash: string;
        timestamp: string;
    };
    retrievedAt: string;
    historyFrom: string;
    historyTo: string;
    configuration: Partial<OracleConfiguration>;
    events: ConfigurationEvent[];
    samples: unknown[];
    observations: {
        blockNumber: string;
        blockHash: string;
        transactionHash: string;
        timestamp: string;
        answer: string;
    }[];
    signerSets: {
        configId: string;
        f: number;
        signers: Address[];
    }[];
    workflowIds: {
        id: Hex;
        allowed: boolean;
    }[];
    trace: AuditRpc["trace"];
    limitations: string[];
}
export declare const supplementalResultSchema: z.ZodObject<{
    status: z.ZodEnum<{
        UNAVAILABLE: "UNAVAILABLE";
        BOUNDED_READ_COMPLETE: "BOUNDED_READ_COMPLETE";
        UNSUPPORTED_IDENTITY: "UNSUPPORTED_IDENTITY";
    }>;
    block: z.ZodObject<{
        number: z.ZodString;
        hash: z.ZodString;
        timestamp: z.ZodString;
    }, z.core.$strict>;
    retrievedAt: z.ZodISODateTime;
    historyFrom: z.ZodString;
    historyTo: z.ZodString;
    configuration: z.ZodObject<{
        proxyImplementation: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        proxyAdmin: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        proxyBeacon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        signerConfigurationHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        workflowConfigurationHash: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        signerCoverage: z.ZodOptional<z.ZodEnum<{
            UNOBSERVED: "UNOBSERVED";
            SAMPLED_ACTIVE_CONFIGS: "SAMPLED_ACTIVE_CONFIGS";
            COMPLETE: "COMPLETE";
        }>>;
    }, z.core.$strict>;
    events: z.ZodArray<z.ZodObject<{
        code: z.ZodEnum<{
            ORACLE_CONFIGURATION_CHANGED: "ORACLE_CONFIGURATION_CHANGED";
            PROXY_IMPLEMENTATION_CHANGED: "PROXY_IMPLEMENTATION_CHANGED";
            ORACLE_OWNER_CHANGED: "ORACLE_OWNER_CHANGED";
            ORACLE_FEED_ID_CHANGED: "ORACLE_FEED_ID_CHANGED";
            ORACLE_SIGNER_CONFIGURATION_CHANGED: "ORACLE_SIGNER_CONFIGURATION_CHANGED";
            ORACLE_DENOMINATION_CHANGED: "ORACLE_DENOMINATION_CHANGED";
        }>;
        address: z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>;
        blockNumber: z.ZodString;
        blockHash: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
        transactionHash: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
        logIndex: z.ZodString;
    }, z.core.$strict>>;
    samples: z.ZodArray<z.ZodUnknown>;
    observations: z.ZodArray<z.ZodObject<{
        blockNumber: z.ZodString;
        blockHash: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
        transactionHash: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
        timestamp: z.ZodString;
        answer: z.ZodString;
    }, z.core.$strict>>;
    signerSets: z.ZodArray<z.ZodObject<{
        configId: z.ZodString;
        f: z.ZodNumber;
        signers: z.ZodArray<z.ZodPipe<z.ZodString & z.ZodType<`0x${string}`, string, z.core.$ZodTypeInternals<`0x${string}`, string>>, z.ZodTransform<`0x${string}`, `0x${string}`>>>;
    }, z.core.$strict>>;
    workflowIds: z.ZodArray<z.ZodObject<{
        id: z.ZodPipe<z.ZodString, z.ZodTransform<`0x${string}`, string>>;
        allowed: z.ZodBoolean;
    }, z.core.$strict>>;
    trace: z.ZodArray<z.ZodUnknown>;
    limitations: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
/** Mapping layout is tied to the reproduced KeystoneForwarder runtime, never guessed for another implementation. */
export declare const CONFIGS_STORAGE_SLOT = 2n;
export declare function inspectSupplemental(snapshot: Snapshot, rpc?: AuditRpc): Promise<SupplementalResult>;
