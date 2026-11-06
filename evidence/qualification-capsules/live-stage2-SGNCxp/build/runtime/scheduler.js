import { PG_LIMITS } from "../config/postgres.js";
import { DataError } from "../domain/errors.js";
import { bounded } from "../operations/deadline.js";
import { receiptSchemaFor, slotSchemaFor } from "./scheduler-contract.js";
const receiptReply = (receipt, periodSeconds) => ({ status: receipt.status === "COMPLETED" ? 200 : 500, body: receiptSchemaFor(periodSeconds).parse(receipt) });
function admissionReply(result, periodSeconds) {
    if (result.kind === "RECEIPT")
        return receiptReply(result.receipt, periodSeconds);
    if (result.kind === "IN_PROGRESS")
        return { status: 202, body: { status: "IN_PROGRESS", slot: result.slot, cycleId: result.cycleId } };
    return { status: 409, body: { error: result.kind } };
}
/** One finite request owns the complete job. No timers/polling initiate background monitoring. */
export class SchedulerRunner {
    options;
    stopping = false;
    active = new Set();
    running = new Set();
    budget;
    periodSeconds;
    constructor(options) {
        this.options = options;
        this.budget = options.budgetMs ?? PG_LIMITS.jobMs;
        if (!Number.isInteger(this.budget) || this.budget < 60 || this.budget > PG_LIMITS.jobMs)
            throw new DataError("SCHEDULER_CONFIG", "Invalid bounded job budget.");
        this.periodSeconds = options.periodSeconds;
        slotSchemaFor(this.periodSeconds); // validates the configured grid once.
    }
    run(slot, caller) {
        slotSchemaFor(this.periodSeconds).parse(slot);
        if (!this.options.enabled || this.stopping)
            return Promise.resolve({ status: 503, body: { error: "SCHEDULER_DISABLED" } });
        if (this.active.size >= 2)
            return Promise.resolve({ status: 429, body: { error: "SCHEDULER_BUSY" } });
        const controller = new AbortController(), cancel = () => controller.abort();
        caller.addEventListener("abort", cancel, { once: true });
        if (caller.aborted)
            cancel();
        this.active.add(controller);
        const promise = this.execute(slot, controller.signal).catch(() => ({ status: 503, body: { error: "EXECUTION_UNAVAILABLE" } })).finally(() => {
            caller.removeEventListener("abort", cancel);
            this.active.delete(controller);
            this.running.delete(promise);
        });
        this.running.add(promise);
        return promise;
    }
    async execute(slot, signal) {
        const reserve = Math.min(20_000, Math.floor(this.budget / 3));
        let fence, job, accepted = false;
        let failure = null, duplicate;
        const business = new AbortController(), cancel = () => { business.abort(); job?.abort(); };
        signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted)
            cancel();
        try {
            await bounded(async (workSignal) => {
                const onAbort = () => { business.abort(); job?.abort(); };
                workSignal.addEventListener("abort", onAbort, { once: true });
                try {
                    const admission = await this.options.store.admit(slot, workSignal);
                    if (admission.kind !== "ACQUIRED") {
                        duplicate = admissionReply(admission, this.periodSeconds);
                        return;
                    }
                    fence = admission.fence;
                    if (workSignal.aborted)
                        throw new DataError("JOB_TIMEOUT", "Scheduling admission exceeded its budget.");
                    job = this.options.createJob(fence, business.signal);
                    const result = await job.runOnce();
                    if (workSignal.aborted || "skipped" in result)
                        throw new DataError("CYCLE_FAILED", "The scheduled cycle did not complete.");
                    accepted = result.observation.accepted;
                }
                finally {
                    workSignal.removeEventListener("abort", onAbort);
                }
            }, this.budget - reserve, "JOB_TIMEOUT", signal);
        }
        catch (error) {
            failure = error instanceof DataError && ["JOB_TIMEOUT", "CYCLE_TIMEOUT"].includes(error.code) ? "JOB_TIMEOUT" : "CYCLE_FAILED";
            cancel();
        }
        finally {
            signal.removeEventListener("abort", cancel);
            try {
                if (job)
                    await bounded(() => job.shutdown(), Math.floor(reserve / 2), "JOB_TIMEOUT");
            }
            catch {
                failure ??= "CYCLE_FAILED";
                cancel();
            }
        }
        if (duplicate)
            return duplicate;
        if (!fence)
            return { status: 503, body: { error: "EXECUTION_UNAVAILABLE" } };
        const owned = fence;
        const receipt = await bounded(finalSignal => this.options.store.finish(owned, { accepted: failure ? false : accepted, error: failure }, finalSignal), Math.floor(reserve / 2), "JOB_TIMEOUT");
        return receiptReply(receipt, this.periodSeconds);
    }
    async stop() {
        this.stopping = true;
        for (const controller of this.active)
            controller.abort();
        await Promise.allSettled([...this.running]);
    }
}
//# sourceMappingURL=scheduler.js.map