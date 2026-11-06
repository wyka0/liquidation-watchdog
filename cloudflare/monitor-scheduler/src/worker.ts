const ENDPOINT_PATH = "/internal/monitor/run";
const FIVE_MINUTES_MS = 300_000;
const REQUEST_TIMEOUT_MS = 450_000;
const RESPONSE_BYTES = 8_192;
const secretPattern = /^[A-Za-z0-9_-]{43,256}$/;

export interface WorkerEnvironment {
  WATCHDOG_SCHEDULER_URL?: string | undefined;
  WATCHDOG_SCHEDULER_SECRET?: string | undefined;
}
export interface ScheduledControllerLike { scheduledTime: number; cron: string; noRetry(): void }
export interface ExecutionContextLike { waitUntil(work: Promise<unknown>): void }
export interface SchedulerDependencies {
  fetch: typeof fetch;
  timeoutMs: number;
  log(record: Readonly<Record<string, unknown>>): void;
}
export interface SchedulerResult {
  httpStatus: number;
  outcome: string;
  slot: string;
  cycleId: string | null;
  observationAccepted: boolean | null;
  missedSlots: number | null;
  error: string | null;
}

class SchedulerInvocationError extends Error {
  constructor(readonly code: string) { super(code); this.name = "SchedulerInvocationError"; }
}
const fail = (code: string): never => { throw new SchedulerInvocationError(code); };
const dependencies = (): SchedulerDependencies => ({ fetch, timeoutMs: REQUEST_TIMEOUT_MS, log: record => { console.log(record); } });

function endpoint(value: string | undefined): string {
  try {
    if (!value) return fail("ENDPOINT_CONFIG");
    if (value.length > 2_048) return fail("ENDPOINT_CONFIG");
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash
      || !/^[A-Za-z0-9.-]+$/.test(url.hostname) || ["localhost", "127.0.0.1"].includes(url.hostname)
      || url.pathname !== ENDPOINT_PATH) fail("ENDPOINT_CONFIG");
    return url.href;
  } catch (error) {
    if (error instanceof SchedulerInvocationError) throw error;
    return fail("ENDPOINT_CONFIG");
  }
}

export function scheduledSlot(scheduledTime: number): string {
  if (!Number.isSafeInteger(scheduledTime) || scheduledTime < 0 || scheduledTime % FIVE_MINUTES_MS !== 0) return fail("SLOT_CONFIG");
  const slot = new Date(scheduledTime).toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:(?:00|05|10|15|20|25|30|35|40|45|50|55):00\.000Z$/.test(slot)) return fail("SLOT_CONFIG");
  return slot;
}

async function boundedObject(response: Response): Promise<Record<string, unknown>> {
  const stated = response.headers.get("content-length");
  if (stated !== null && (!/^(?:0|[1-9][0-9]{0,4})$/.test(stated) || Number(stated) > RESPONSE_BYTES)) return fail("RESPONSE_INVALID");
  if (!response.body) return fail("RESPONSE_INVALID");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > RESPONSE_BYTES) { await reader.cancel(); return fail("RESPONSE_INVALID"); }
      chunks.push(item.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) return fail("RESPONSE_INVALID");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SchedulerInvocationError) throw error;
    return fail("RESPONSE_INVALID");
  }
}

function result(response: Response, body: Record<string, unknown>, requestedSlot: string): SchedulerResult {
  const outcome = typeof body.status === "string" && /^[A-Z_]{2,32}$/.test(body.status) ? body.status : "INVALID";
  const slot = typeof body.slot === "string" && body.slot === requestedSlot ? body.slot : requestedSlot;
  const cycleId = typeof body.cycleId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(body.cycleId) ? body.cycleId : null;
  const observationAccepted = typeof body.accepted === "boolean" ? body.accepted : null;
  const missedSlots = typeof body.missedSlots === "number" && Number.isSafeInteger(body.missedSlots) && body.missedSlots >= 0 ? body.missedSlots : null;
  const error = typeof body.error === "string" && /^[A-Z_]{2,64}$/.test(body.error) ? body.error : null;
  return { httpStatus: response.status, outcome, slot, cycleId, observationAccepted, missedSlots, error };
}

/** Exactly one bounded request. PostgreSQL owns duplicate prevention, fencing and durable outcomes. */
export async function invokeScheduler(controller: Pick<ScheduledControllerLike, "scheduledTime">, env: WorkerEnvironment,
  injected: SchedulerDependencies = dependencies()): Promise<SchedulerResult> {
  const slot = scheduledSlot(controller.scheduledTime), url = endpoint(env.WATCHDOG_SCHEDULER_URL), secret = env.WATCHDOG_SCHEDULER_SECRET;
  if (!secret || !secretPattern.test(secret)) return fail("SECRET_CONFIG");
  const signal = AbortSignal.timeout(injected.timeoutMs);
  let response: Response;
  try {
    response = await injected.fetch(url, { method: "POST", redirect: "error", signal,
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ slot }) });
  } catch {
    const code = signal.aborted ? "ENDPOINT_TIMEOUT" : "NETWORK_FAILURE";
    injected.log({ event: "scheduler_request_failed", code, slot });
    return fail(code);
  }
  let parsed: Record<string, unknown>;
  try { parsed = await boundedObject(response); }
  catch {
    injected.log({ event: "scheduler_response_failed", code: "RESPONSE_INVALID", httpStatus: response.status, slot });
    return fail("RESPONSE_INVALID");
  }
  const outcome = result(response, parsed, slot);
  if (!response.ok) {
    injected.log({ event: "scheduler_http_failure", ...outcome });
    return fail("ENDPOINT_NON_2XX");
  }
  // HTTP success and even `accepted: true` are persisted receipt facts, not proof of a fresh chain observation.
  injected.log({ event: "scheduler_result", ...outcome });
  return outcome;
}

export default {
  scheduled(controller: ScheduledControllerLike, env: WorkerEnvironment, context: ExecutionContextLike): void {
    controller.noRetry(); // one attempt only; duplicate safety belongs to the durable endpoint protocol.
    context.waitUntil(invokeScheduler(controller, env));
  }
};
