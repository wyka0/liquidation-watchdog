// EXPLICIT NEGATIVE CONTROL ONLY. Lower just the corrected aggregate test deadline back to 40s
// through an external Vite transform. Assertions, child limits, application bytes and repository files stay unchanged.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
const source = "}, 2 * CHILD_TIMEOUT_MS + 10_000);", replacement = "}, 40_000);";
const hash = code => createHash("sha256").update(code).digest("hex");
export default {
  plugins: [{ name: "explicit-original-aggregate-deadline-control", enforce: "pre", transform(code, id) {
    if (!id.replaceAll("\\", "/").split("?")[0].endsWith("/test/runtime-process.test.ts")) return;
    assert.equal(code.split(source).length, 2, "Control must replace exactly one aggregate deadline");
    const changed = code.replace(source, replacement);
    writeFileSync(process.env.WATCHDOG_DEADLINE_CONTROL_SOURCE, changed, { flag: "wx" });
    appendFileSync(process.env.WATCHDOG_REPAIR_PROCESS_LOG, JSON.stringify({ at: new Date().toISOString(), hrNs: process.hrtime.bigint().toString(),
      pid: process.pid, ppid: process.ppid, event: "explicit_original_deadline_control_transform", sourceSha256: hash(code), transformedSha256: hash(changed),
      aggregateDeadlineMs: 40000, repositoryBytesModified: false, assertionsOrChildLimitsModified: false }) + "\n");
    return changed;
  } }],
  test: { include: ["test/runtime-process.test.ts"], exclude: ["test/integration/**"], testTimeout: 10_000, maxWorkers: 2 }
};
