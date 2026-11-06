import type { OracleAssurance } from "./model.js";
export declare function dependencyGraph(input: OracleAssurance): {
    chainId: 1672;
    block: {
        number: string;
        hash: string;
        timestamp: string;
    } | null;
    retrievedAt: string | null;
    snapshotIdentifier: string | null;
    edges: {
        subjectAddress: string;
        from: string | null;
        to: string | null;
        relationship: string;
        findingIds: string[];
    }[];
    confidence: string;
};
export declare function renderOracleStatus(input: OracleAssurance): string;
