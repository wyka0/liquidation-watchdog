import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "../src/domain/serialize.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";
import { createHash } from "node:crypto";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const readOnly = process.argv.slice(2).includes("--read-only");
if (process.argv.slice(2).some(arg => arg !== "--read-only")) throw new Error("Supported secret-scan option: --read-only.");
const excluded = new Set([".git", "node_modules", "dist", "coverage", "data", "backups"]);
const fixtureEndpoint = ["https:", "", "name:example@example.test"].join("/");
const rules = [
  { id: "private-key-block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: "credential-assignment", pattern: /\b(?:private[_-]?key|mnemonic|seed[_-]?phrase|api[_-]?key|access[_-]?token|auth[_-]?token|bot[_-]?token|password)\s*["']?\s*[:=]\s*["'`][A-Za-z0-9+/_=. -]{8,}["'`]/i },
  { id: "github-token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/ },
  { id: "cloud-access-id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: "telegram-token", pattern: /\b[0-9]{8,12}:[A-Za-z0-9_-]{30,}\b/ },
  { id: "discord-webhook", pattern: /https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api(?:\/v[0-9]+)?\/webhooks\/[0-9]+\/[A-Za-z0-9._-]{20,}/i },
  { id: "authorization-bearer", pattern: /["']authorization["']\s*[:=]\s*["']Bearer [A-Za-z0-9._~+/-]{16,}/i },
  { id: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\b/ },
  { id: "credential-in-url", pattern: /https?:\/\/[^\s/"']+:[^\s/"']+@[^\s/"']+/i }
];
const findings: { path: string; line: number | null; rule: string }[] = [];
let filesScanned = 0;
let fixtureExceptions = 0;
let placeholderTemplateVerified = false;
async function scan(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.isSymbolicLink()) continue;
    const path = join(directory, entry.name);
    const name = relative(root, path).replaceAll("\\", "/");
    if (name === ".env.example" && entry.isFile()) {
      // Exact authored placeholder file only. A changed template is a failure, never a blanket .env exclusion.
      placeholderTemplateVerified = createHash("sha256").update(await readFile(path)).digest("hex") === "517c936b52b4489029ba6576c553cbfc2b052eebe638511b4d055ace99d22c69";
      if (!placeholderTemplateVerified) findings.push({ path: name, line: null, rule: "authored-placeholder-template-mismatch" });
      filesScanned += 1; continue;
    }
    if (/^(?:\.env(?:\..*)?|\.npmrc|\.netrc|id_(?:rsa|ed25519)(?:\.pub)?|.*\.(?:pem|p12|pfx|key)|.*(?:keystore|credentials|secrets).*)$/i.test(entry.name)
      && !["check-secrets.ts", "secrets-check.txt"].includes(entry.name)) {
      // Report the name only; never open potential credential/key files.
      findings.push({ path: name, line: null, rule: "credential-file-present-not-read" });
      continue;
    }
    if (entry.isDirectory()) { await scan(path); continue; }
    const lines = (await readFile(path, "utf8")).split(/\r?\n/);
    filesScanned += 1;
    for (const [index, line] of lines.entries()) {
      for (const rule of rules) {
        for (const match of line.matchAll(new RegExp(rule.pattern.source, `${rule.pattern.flags}g`))) {
          if (rule.id === "credential-in-url" && name === "test/transport.test.ts" && match[0] === fixtureEndpoint) {
            fixtureExceptions += 1; // Exact synthetic .test URL; other matches on the same line are still scanned.
            continue;
          }
          findings.push({ path: name, line: index + 1, rule: rule.id });
        }
      }
    }
  }
}
await scan(root);
const result = {
  evidenceKind: "LOCAL_VERIFICATION", retrievedAt: new Date().toISOString(),
  scope: "Project-owned files and sanitized evidence; dependencies/build/git/private runtime data/backups excluded; potential key files are named but not opened. The authored .env.example is byte-hash verified.",
  filesScanned, ruleCount: rules.length, fixtureExceptions, placeholderTemplateVerified, passed: findings.length === 0 && placeholderTemplateVerified, findings
};
if (readOnly) console.log(stringify(result));
else {
  await mkdir(join(root, CURRENT_EVIDENCE), { recursive: true });
  await writeFile(join(root, CURRENT_EVIDENCE, "secret-scan.json"), `${stringify(result)}\n`, "utf8");
  console.log(`Secret scan: ${result.passed ? "PASS" : "FAIL"}; ${filesScanned} files, ${findings.length} findings (paths/rules only).`);
  if (!result.passed) console.log(stringify(findings));
}
if (!result.passed) process.exitCode = 1;
