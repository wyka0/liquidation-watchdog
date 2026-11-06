// Exact allowlist for the one authorized test-only change; never modifies repository content or Git.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const audit = dirname(fileURLToPath(import.meta.url)), repo = "C:/liquidation-watchdog", path = "test/runtime-process.test.ts";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const baseline = JSON.parse(readFileSync(join(audit, "baseline.json"))), entry = baseline.files.find(file => file.path === path);
const current = readFileSync(join(repo, path));
assert.ok(entry); assert.equal(hash(readFileSync(join(repo, ".git/index"))), baseline.git.index.sha256);
if (process.argv[2] === "capture") {
  assert.equal(hash(current), entry.sha256); mkdirSync(join(audit, "source-before"));
  copyFileSync(join(repo, path), join(audit, "source-before/runtime-process.test.ts"));
  writeFileSync(join(audit, "correction-before.json"), JSON.stringify({ path, capturedAt: new Date().toISOString(), bytes: current.length,
    sha256: hash(current), baselineMatches: true, unchangedGitIndex: baseline.git.index }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: "ORIGINAL_TEST_CAPTURED", path, bytes: current.length, sha256: hash(current) }));
} else if (process.argv[2] === "seal") {
  const original = readFileSync(join(audit, "source-before/runtime-process.test.ts")); assert.equal(hash(original), entry.sha256);
  assert.notEqual(hash(current), entry.sha256); mkdirSync(join(audit, "source-after"));
  copyFileSync(join(repo, path), join(audit, "source-after/runtime-process.test.ts"));
  const files = [{ path, beforeSha256: hash(original), afterSha256: hash(current), beforeBytes: original.length, afterBytes: current.length,
    reason: "Test-only correction: independently track/reap child processes through close before fixture removal, reject late spawns for torn-down fixtures, and budget two sequential unchanged 30-second child horizons plus the existing normal 10-second assertion allowance. Preserve all four tests, forced-kill/recovery assertions, 3-second graceful shutdown assertion, application code and V2 IPC guard." }];
  writeFileSync(join(audit, "authorized-changes.json"), JSON.stringify({ schemaVersion: 1, sealedAt: new Date().toISOString(),
    authorization: "FINAL QUALIFICATION REPAIR: smallest evidence-justified runtime-process test correction only", files,
    supportingEvidence: ["original-failure-inspection.json", "timing-analysis-unmodified-independent-v2-unmodified-loaded-v2.json",
      "original-budget-latency-negative-control/summary.json", "original-budget-latency-negative-control/process-lifecycle.jsonl"],
    excluded: ["src/**", "test/helpers/phase8-runtime.ts", "vitest.config.ts", "Stage 2 evidence", "Git index/staged state/HEAD", "unrelated user work"] }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status: "ONE_TEST_CHANGE_ALLOWLISTED", files }, null, 2));
} else throw new Error("Use capture or seal.");
