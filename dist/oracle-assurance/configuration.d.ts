import type { Hex } from "viem";
import type { Snapshot } from "../domain/types.js";
import type { ConfigurationChange, OracleConfiguration } from "./model.js";
export declare const FORWARDER: "0x76c9cf548b4179F8901cda1f8623568b58215E62";
export declare const IDENTITY_PINS: readonly [{
    readonly address: `0x${string}`;
    readonly keccak256: "0xc7e89967df297eebdb2642ade6225f6a9f72a61862c83de181dd707ff2e2c744";
    readonly sha256: "5b1b9424a6dc46c6a041f8eb1d69239342e89f3726ea31dc409cae9dd333a55f";
}, {
    readonly address: `0x${string}`;
    readonly keccak256: "0x2b4b39be4acacf49ae05c056a0debbe9bf8fff8e47c9ff6b67f101dbad34de9b";
    readonly sha256: "178a10129f94627df4d95f019df5eb7875a4d1049364fe28ff69c06dd456c794";
}, {
    readonly address: `0x${string}`;
    readonly keccak256: `0x${string}`;
    readonly sha256: "95027d40e661cafffa6a90129991f47fd63b59bd0435481f53cc5a0b2414a9fa";
}, {
    readonly address: `0x${string}`;
    readonly keccak256: `0x${string}`;
    readonly sha256: "8bb736091d9032c49a1b279f51406f653b3fbf7c0880d7b917c93b2ce9086103";
}, {
    readonly address: "0x76c9cf548b4179F8901cda1f8623568b58215E62";
    readonly keccak256: "0x2b21870eb5ea9013a781ed3db7d5fab742b612b2ac8de0990ac9d95b22f795fc";
    readonly sha256: "f9c0c886360e5fd0b5837b83a0d307cea7aab6a43ad05d2c6ebf2f023e04edd0";
}];
export declare function verifyRuntimeBytecode(code: Hex, expected: {
    sha256: string;
    keccak256: string;
}): {
    sha256: string;
    keccak256: `0x${string}`;
    verified: boolean;
};
export declare function validateContractIdentity(snapshot: Snapshot): "VERIFIED" | "UNKNOWN" | "FAILED";
export declare function configurationFromSnapshot(snapshot: Snapshot, supplemental?: {
    [Key in keyof OracleConfiguration]?: OracleConfiguration[Key] | undefined;
}): OracleConfiguration;
export declare const configurationFingerprint: (value: OracleConfiguration) => string;
export declare const configurationObservabilityLost: (before: OracleConfiguration, after: OracleConfiguration | null) => boolean;
export declare function configurationChanges(before: OracleConfiguration, after: OracleConfiguration): ConfigurationChange[];
