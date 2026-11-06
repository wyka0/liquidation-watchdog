// Preserve the failed read-only --eval tool request and tool-returned output; do not rerun it.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const ref = file => { const bytes = readFileSync(join(root, file)); return { root: "REPAIR", file, bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex") }; };
const result = { schemaVersion: 1, status: "FAIL_DOCUMENTARY_INPUT_REVIEW_NOT_SOFTWARE_QUALIFICATION", recordedAt: new Date().toISOString(),
  failedInvocationTimestamp: "NOT_CAPTURED", exitCode: 1, node: "v24.14.1", cwd: "C:/liquidation-watchdog",
  requestedShellCapsule: ref("documentary-input-review-attempt-1.ps1"), toolReturnedOutput: ref("documentary-input-review-attempt-1.tool-output.txt"),
  error: { name: "SyntaxError", message: "Unexpected identifier 'node'", location: "file:///C:/liquidation-watchdog/[eval1]:1" },
  observedFirstEvalLine: "import { readFileSync, existsSync } from node:fs;", actualNativeEvalArgumentFullyCaptured: false,
  streamSeparationCaptured: false,
  outputMeaning: "Full visible tool-returned combined output copied into a new text artifact, including its exit annotation; not a separately captured raw stdout/stderr transcript. The requested shell capsule is not asserted to be the exact post-PowerShell native eval argument.",
  cause: "The quoted requested module specifier appears unquoted in Node's parser error, demonstrating the Windows PowerShell native --eval argument quoting boundary. Parsing failed before imports or evidence reads.",
  correction: "Use a reviewed file-based local documentary input helper instead of inline native --eval. Do not change the repository, test assertions, qualification evidence or failure classification.",
  noCapturedEvidenceRead: true, noSoftwareTestOrApplicationOrDatabaseOrNetworkOrMonitoringOperation: true,
  originalEvidenceAndResultsUnchanged: true, monitor: "STOPPED", retainedBy: ref("retain-documentary-input-review-failure.mjs") };
writeFileSync(join(root, "documentary-input-review-attempt-1.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: result.status, record: ref("documentary-input-review-attempt-1.json"), noFailedInvocationRerun: true }, null, 2));
