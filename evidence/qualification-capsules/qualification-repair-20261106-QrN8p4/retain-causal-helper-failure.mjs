// Retain the already observed documentary helper failure before repairing this external helper; not a test rerun.
import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const audit = dirname(fileURLToPath(import.meta.url)), source = join(audit, "consolidate-causality.mjs");
const capsule = join(audit, "causal-consolidation-attempt-1-tool.mjs"); copyFileSync(source, capsule);
const error = "TypeError: Cannot read properties of undefined (reading 'sha256')\n    at consolidate-causality.mjs:35:46\nNode.js v24.14.1\n";
writeFileSync(join(audit, "causal-consolidation-attempt-1.stderr.txt"), error, { flag: "wx" });
writeFileSync(join(audit, "causal-consolidation-attempt-1.json"), JSON.stringify({ schemaVersion: 1, status: "FAIL_DOCUMENTARY_HELPER_NOT_TEST_QUALIFICATION",
  recordedAt: new Date().toISOString(), failedInvocationTimestamp: "NOT_CAPTURED", exitCode: 1, node: process.version,
  command: [process.execPath, source], cwd: "C:/liquidation-watchdog", generatedCausalAnalysis: false,
  error: { name: "TypeError", message: "Cannot read properties of undefined (reading 'sha256')", location: "consolidate-causality.mjs:35:46" },
  toolCapsule: capsule, toolSha256: createHash("sha256").update(readFileSync(capsule)).digest("hex"),
  cause: "Earlier diagnostic summaries did not capture tooling.testSource. Consolidation must preserve missing capsule provenance as null, not assume a later schema or manufacture a hash.",
  noTestApplicationGuardOrHistoricalEvidenceChanged: true, originalFullSuiteAndAllControlsRetained: true }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "HELPER_FAILURE_AND_EXACT_TOOL_RETAINED", noQualificationRerun: true }));
