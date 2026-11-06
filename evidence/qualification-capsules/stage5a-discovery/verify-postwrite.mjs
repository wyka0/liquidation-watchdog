import { createHash } from "node:crypto";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
const doc = "C:/liquidation-watchdog/docs/STAGE-5A-QUALIFIED-MARKET-DISCOVERY.md";
const bytes = readFileSync(doc);
const hash = c => c.createHash(c).update(c).digest("hex");
const h = createHash("sha256").update(bytes).digest("hex");
const out = { docSha256: h, docBytes: bytes.length, sizeOnDisk: statSync(doc).size, crlf: (bytes.toString("binary").match(/\r\n/g) ?? []).length };
out.gitStatus = execSync("git status --porcelain=v2", { cwd: "C:/liquidation-watchdog", encoding: "utf8" });
let staged = "EMPTY_OK";
try { const d = execSync("git diff --cached", { cwd: "C:/liquidation-watchdog", encoding: "utf8" }); staged = d.length ? "NONEMPTY:" + d.length : "EMPTY_OK"; } catch (e) { staged = "ERR:" + e.status; }
out.stagedDiff = staged;
let indexHash = null, indexBytes = null;
try { indexHash = execSync("git ls-files -s", { cwd: "C:/liquidation-watchdog", encoding: "utf8" }); } catch (e) { indexHash = "ERR:" + e.status; }
try { indexBytes = readFileSync("C:/liquidation-watchdog/.git/index"); } catch (e) { indexBytes = null; }
out.indexSha256 = indexBytes ? createHash("sha256").update(indexBytes).digest("hex") : null;
out.indexBytesLength = indexBytes ? indexBytes.length : null;
let head = null;
try { head = execSync("git rev-parse HEAD", { cwd: "C:/liquidation-watchdog", encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }); } catch (e) { head = "REVPARSE_EXIT_" + (e.status ?? "ERR"); }
out.head = head;
// scan for node processes related to monitor/fixture
let procs = "";
try { procs = execSync("tasklist /FI \"IMAGENAME eq node.exe\" /FO CSV", { cwd: "C:/liquidation-watchdog", encoding: "utf8" }); } catch (e) { procs = "ERR"; }
out.nodeProcessLines = procs.split("\n").filter(l => l.startsWith('"')).length;
out.changedFiles = out.gitStatus.split("\n").filter(l => l.includes("??") || l.startsWith("1 .M") || l.startsWith("2 .M")).map(l => l.trim().slice(0, 120));
console.log(JSON.stringify(out, null, 2));
