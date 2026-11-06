$env:NODE_OPTIONS = ""
$env:NODE_DISABLE_COMPILE_CACHE = "1"
$code = @'
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const audit = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/qualification-repair-20261106-QrN8p4", stage2 = "[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/live-stage2-SGNCxp";
const load = (root, file) => JSON.parse(readFileSync(join(root, file), "utf8"));
const original = load(stage2, "unit-tests.json"), direct = load(stage2, "independent-pinned-verification.json"), live = load(stage2, "live-stage2-evidence.json");
const causal = load(audit, "causal-analysis.json"), lifecycle = load(audit, "final-lifecycle-verification.json"), rpc = load(audit, "oracle-rpc-audit/summary.json");
const failure = original.testResults.flatMap(file => file.assertionResults).filter(test => test.status === "failed");
const pin = "0x" + BigInt(rpc.block.number).toString(16);
console.log(JSON.stringify({ originalFailedAssertions: failure.map(test => ({ title: test.title, messages: test.failureMessages.length, timeoutRecorded: test.failureMessages.some(message => message.includes("40000ms")), EPERMRecorded: test.failureMessages.some(message => message.includes("EPERM")) })),
  directGetters: { count: direct.calls.length, matches: direct.calls.every(call => call.matches && call.rpcBytes === call.mcpBytes && call.blockNumber === live.block.number) },
  historicalRisk: { keys: Object.keys(live.risk), recovery: live.risk.recoveryEligibility, progression: { state: live.risk.progression.state, reason: live.risk.progression.reason }, recoveryAmountsNull: live.risk.repayment === null && live.risk.additionalCollateral === null },
  controls: causal.controls.map(control => ({ name: control.name, status: control.status, role: control.role, sourceCapsuleRecorded: control.sourceCapsuleRecorded, sourceSha256IsNull: control.sourceSha256 === null, durationMs: control.selectedAssertion.durationMs, timeout: control.selectedAssertion.failureMessages.some(message => message.includes("40000ms")), EPERM: control.selectedAssertion.failureMessages.some(message => message.includes("EPERM")) })),
  lifecycle: { checks: lifecycle.checks.length, children: lifecycle.phases.reduce((sum, phase) => sum + phase.children.length, 0), recordedPidsPresent: lifecycle.osObservation.recordedPidsPresent.length, relevantNodeProcesses: lifecycle.osObservation.relevantNodeProcesses.length },
  rpc: { requests: rpc.trace.length, stateRequestsPinned: rpc.trace.filter(request => ["eth_call", "eth_getCode", "eth_getStorageAt"].includes(request.method)).every(request => request.params.at(-1) === pin) },
  finalOutputsAlreadyExist: ["finalization-baseline.json", "preservation-seal.json", "FINAL-QUALIFICATION-REPAIR-REPORT.md", "final-qualification-evidence.json", "final-report-validation.json", "final-artifact-manifest.json", "final-manifest-verification.json", "final-completion.json", "final-seal.json"].filter(file => existsSync(join(audit, file))),
  detachedReceiptAlreadyExists: existsSync("[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/final-qualification-seal-verification-QrN8p4.json") }, null, 2));
'@
& "C:\Program Files\nodejs\node.exe" --input-type=module -e $code
