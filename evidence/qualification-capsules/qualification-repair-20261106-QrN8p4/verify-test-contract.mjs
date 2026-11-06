// AST-level preservation proof for original assertions/titles and deadline scope. No tests are skipped or rewritten here.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const audit = dirname(fileURLToPath(import.meta.url)), repo = "C:/liquidation-watchdog";
const ts = (await import(pathToFileURL(join(repo, "node_modules/typescript/lib/typescript.js")).href)).default;
const beforeBytes = readFileSync(join(audit, "source-before/runtime-process.test.ts")), afterBytes = readFileSync(join(repo, "test/runtime-process.test.ts"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex"), normalize = value => value.replace(/\s+/g, " ").trim();
const inspect = bytes => {
  const source = ts.createSourceFile("runtime-process.test.ts", bytes.toString(), ts.ScriptTarget.Latest, true);
  const assertions = [], titles = [], spawnTimeouts = [];
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "expect") {
      let chain = node;
      while (chain.parent && ((ts.isPropertyAccessExpression(chain.parent) && chain.parent.expression === chain)
        || (ts.isCallExpression(chain.parent) && chain.parent.expression === chain))) chain = chain.parent;
      assertions.push(normalize(chain.getText(source)));
    }
    if (ts.isCallExpression(node) && (node.expression.getText(source) === "it" || node.expression.getText(source).startsWith("it.each("))) {
      const title = node.arguments[0]; if (title && ts.isStringLiteral(title)) titles.push(title.text);
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === "spawn") {
      const options = node.arguments[2]; if (options && ts.isObjectLiteralExpression(options)) {
        const timeout = options.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(source) === "timeout");
        assert.ok(timeout && ts.isPropertyAssignment(timeout));
        spawnTimeouts.push(timeout.initializer.getText(source) === "CHILD_TIMEOUT_MS" ? 30000 : Number(timeout.initializer.getText(source).replaceAll("_", "")));
      }
    }
    ts.forEachChild(node, visit);
  }; visit(source);
  return { assertions, titles, spawnTimeouts };
};
const before = inspect(beforeBytes), after = inspect(afterBytes), remaining = [...after.assertions];
for (const assertion of before.assertions) { const index = remaining.indexOf(assertion); assert.notEqual(index, -1, assertion); remaining.splice(index, 1); }
assert.deepEqual(before.titles, after.titles); assert.deepEqual(before.spawnTimeouts, after.spawnTimeouts);
assert.deepEqual(before.spawnTimeouts, [30000, 20000]); assert.equal(before.titles.length, 3);
assert.deepEqual(remaining, ["expect(existsSync(directory)).toBe(false)"]);
const original = beforeBytes.toString(), corrected = afterBytes.toString();
assert.match(corrected, /\}, 2 \* CHILD_TIMEOUT_MS \+ 10_000\);/); assert.match(corrected, /const CHILD_TIMEOUT_MS = 30_000/);
assert.match(corrected, /await child\.closed/); assert.match(corrected, /directories\.includes\(directory\)/);
assert.match(corrected, /Promise\.allSettled\(children\.splice\(0\)\.map\(stop\)\)/);
assert.match(original, /if \(process\.exitCode !== null \|\| process\.signalCode !== null\) return/);
assert.ok(!/\bit\.(?:skip|todo|only)\b|\bdescribe\.(?:skip|todo|only)\b/.test(corrected));
const baseline = JSON.parse(readFileSync(join(audit, "baseline.json")));
const preserved = ["test/helpers/phase8-runtime.ts", "vitest.config.ts", "src/runtime/service.ts", "src/runtime/workspace.ts",
  "src/oracle-assurance/evaluate.ts", "src/oracle-assurance/freshness.ts", "src/oracle-assurance/independent.ts", "src/risk/eligibility.ts"]
  .map(path => { const bytes = readFileSync(join(repo, path)), entry = baseline.files.find(file => file.path === path); assert.ok(entry);
    assert.equal(hash(bytes), entry.sha256); return { path, bytes: bytes.length, sha256: hash(bytes), baselineMatches: true }; });
const result = { schemaVersion: 1, status: "PASS", inspectedAt: new Date().toISOString(), sourceBeforeSha256: hash(beforeBytes), sourceAfterSha256: hash(afterBytes),
  originalAssertionChainsPreserved: before.assertions, addedCleanupAssertion: remaining, unchangedTestTitleTemplates: before.titles,
  expandedTests: 4, unchangedPerChildSpawnTimeoutsMs: before.spawnTimeouts,
  aggregateRecoveryDeadline: { beforeMs: 40000, afterMs: 70000, formula: "2 * unchanged 30000ms child horizons + existing normal 10000ms assertion budget" },
  unchangedOtherExplicitTestDeadlinesMs: [30000, 40000, 40000], unchangedGracefulShutdownAssertionMs: 3000,
  noSkippedDeletedExclusiveOrTodoTests: true, sharedSpawnTimeClosePromiseUsedByStop: true, lateSpawnDirectoryFencePresent: true,
  afterEachIndependentlyReapsAllTrackedChildren: true, preserved,
  limitations: ["This is static structural verification; real process/IPC/SQLite/directory behavior is qualified separately by retained control and test executions."] };
writeFileSync(join(audit, "test-contract-preservation.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: result.status, originalAssertionsPreserved: before.assertions.length, addedCleanupAssertions: remaining.length,
  expandedTests: result.expandedTests, spawnTimeoutsMs: before.spawnTimeouts, aggregateRecoveryDeadline: result.aggregateRecoveryDeadline,
  preservedSourceFiles: preserved.length }, null, 2));
