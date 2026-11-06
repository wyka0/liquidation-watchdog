import { writeFileSync } from "node:fs";
const fs = await import("node:fs/promises");
const path = "C:/liquidation-watchdog/evidence/phase4/oracle-research-2026-11-01T17-23-46-683Z-9ad554c5-ffdd-4f43-83d7-3a52a8abd91f/morpho-compiler-output.json";
const raw = await fs.readFile(path, "utf8");
let doc = null;
try { doc = JSON.parse(raw); } catch (e) { console.log("WHOLE_FILE_PARSE_FAILED:", e.message.slice(0, 120)); }
function fromDoc(d) {
  // locate metadata anywhere
  const keys = [];
  (function walk(node, where) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, where + "/" + i)); return; }
    for (const [k, v] of Object.entries(node)) {
      if (k === "metadata" && typeof v === "string") keys.push(v);
      else walk(v, where + "/" + k);
    }
  })(d, "");
  return keys;
}
const strings = doc ? fromDoc(doc) : [];
console.log("metadataStrings:", strings.length);
const meta = strings.length ? JSON.parse(strings[0]) : null;
if (!meta) process.exit(1);
const abi = meta.output.abi;
const names = ["CreateMarket", "Borrow", "SupplyCollateral", "Repay", "WithdrawCollateral", "Liquidate", "Withdraw", "Supply"];
const viem = await import("file:///C:/liquidation-watchdog/node_modules/viem/_esm/index.js");
const out = { chainMetaVersion: meta.compiler };
for (const ev of abi.filter(x => x.type === "event" && names.includes(x.name))) {
  const canonical = `${ev.name}(${ev.inputs.map(i => i.type === "tuple" ? "(" + i.components.map(c => c.type).join(",") + ")" : i.type).join(",")})`;
  out[ev.name] = { canonical, topic0: viem.keccak256(viem.stringToHex(canonical)),
    inputs: ev.inputs.map(i => ({ name: i.name, type: i.type, internalType: i.internalType, indexed: i.indexed })) };
}
writeFileSync("[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/stage5a-discovery/event-signatures.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
