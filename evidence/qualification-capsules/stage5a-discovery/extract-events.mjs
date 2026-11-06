import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const fs = await import("node:fs/promises");
const path = "C:/liquidation-watchdog/evidence/phase4/oracle-research-2026-11-01T17-23-46-683Z-9ad554c5-ffdd-4f43-83d7-3a52a8abd91f/morpho-compiler-output.json";
const raw = await fs.readFile(path, "utf8");
const marker = '"metadata": ';
const idx = raw.indexOf(marker);
let rest = raw.slice(idx + marker.length).trim();
let end = -1, inStr = false;
for (let i = 0; i < rest.length; i++) {
  const c = rest[i];
  if (c === '"') inStr = !inStr;
  else if (!inStr && (c === "," || c === "}")) { end = i; break; }
}
if (end === -1) end = rest.length;
const meta = JSON.parse(JSON.parse(rest.slice(0, end).replace(/,\s*$/, "")));
const abi = meta.output.abi;
const names = ["CreateMarket", "Borrow", "SupplyCollateral", "Repay", "WithdrawCollateral", "Liquidate"];
const viem = await import("file:///C:/liquidation-watchdog/node_modules/viem/_esm/index.js");
const out = {};
for (const ev of abi.filter(x => x.type === "event" && names.includes(x.name))) {
  const canonical = `${ev.name}(${ev.inputs.map(i => {
    const t = i.type === "tuple" ? "(" + i.components.map(c => c.type).join(",") + ")" : i.type;
    return t;
  }).join(",")})`;
  let hash = null;
  try { hash = viem.keccak256(viem.stringToHex(canonical)); } catch (e) { hash = "ERR:" + e.message; }
  out[ev.name] = { canonical, topic0: hash, inputs: ev.inputs.map(i => ({ name: i.name, type: i.type, internalType: i.internalType, indexed: i.indexed })) };
}
writeFileSync("[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/stage5a-discovery/event-signatures.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
