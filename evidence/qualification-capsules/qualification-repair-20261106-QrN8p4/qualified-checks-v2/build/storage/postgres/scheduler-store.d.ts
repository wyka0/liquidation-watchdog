import type { Admission, ExecutionReceipt } from "../../runtime/scheduler-contract.js";
import type { Fence, PostgresDatabase } from "./database.js";
/** Only table-backed ownership; no session locks or reliance on a PgBouncer session. */
export declare class PostgresSchedulerStore {
    private readonly db;
    private readonly scope;
    private readonly slotSchema;
    private readonly receiptSchema;
    private readonly periodSeconds;
    constructor(db: PostgresDatabase, scope: string, periodSeconds: number);
    private identity;
    private receipt;
    admit(slot: string, signal?: AbortSignal): Promise<Admission>;
    lookup(slot: string, signal?: AbortSignal): Promise<Admission>;
    finish(fence: Fence, outcome: {
        accepted: boolean;
        error: ExecutionReceipt["error"];
    }, signal?: AbortSignal): Promise<ExecutionReceipt>;
}
