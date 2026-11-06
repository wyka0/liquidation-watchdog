import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { projectFiles, root } from "./phase3-files.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";

const checks: { document: string; target: string; exists: boolean }[] = [];
for (const path of [...await projectFiles()].filter(path => path.endsWith(".md"))) {
  const text = await readFile(join(root, path), "utf8");
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1]!;
    if (/^(?:https?:|#)/.test(target)) continue;
    let exists = true;
    try { await access(resolve(root, dirname(path), target.split("#")[0]!)); } catch { exists = false; }
    checks.push({ document: path, target, exists });
  }
}
const passed = checks.every(check => check.exists);
await writeFile(join(root, CURRENT_EVIDENCE, "documentation-links.json"), `${JSON.stringify({ checkedAt: new Date().toISOString(), passed, checks }, null, 2)}\n`);
console.log(`Local documentation targets: ${checks.filter(check => check.exists).length}/${checks.length} exist.`);
if (!passed) process.exitCode = 1;
