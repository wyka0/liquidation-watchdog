import { writeFileSync } from "node:fs";
const fs = await import("node:fs/promises");
const path = "C:/liquidation-watchdog/evidence/phase4/oracle-research-2026-11-01T17-23-46-683Z-9ad554c5-ffdd-4f43-83d7-3a52a8abd91f/morpho-compiler-output.json";
const raw = await fs.readFile(path, "utf8");
const doc = JSON.parse(raw);
const strings = [];
(function walk(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach(walk); return; }
  for (const [k, v] of Object.entries(node)) {
    if (k === "metadata" && typeof v === "string") strings.push(v);
    else walk(v);
  }
})(doc);
const names = ["CreateMarket", "Borrow", "SupplyCollateral", "Repay", "WithdrawCollateral", "Liquidate"];
const viem = await import("file:///C:/liquidation-watchdog/node_modules/viem/_esm/index.js");
const report = [];
let chosen = null;
for (const [i, s] of strings.entries()) {
  let meta;
  try { meta = JSON.parse(s); } catch (e) { report.push({ index: i, error: "UNPARSEABLE" }); continue; }
  const abi = meta?.output?.abi ?? [];
  const events = abi.filter(x => x.type === "event");
  const nameStr = events.map(e => e.name).filter(Boolean);
  const hit = abi.filter(x => x.type === "event" && names.includes(x.name));
  report.push({ index: i, eventCount: events.length, eventNames: nameStr.slice(0, 40), hits: hit.length });
  if (hit.length && !chosen) chosen = { meta, abi };
}
if (chosen) {
  const out = {};
  for (const ev of chosen.abi.filter(x => x.type === "event" && names.includes(x.name))) {
    const canonical = `${ev.name}(${ev.inputs.map(i => i.type === "tuple" ? "(" + i.components.map(c => c.type).join(",") + ")" : i.type).join(",")})`;
    out[ev.name] = { canonical, topic0: viem.keccak256(viem.stringToHex(canonical)),
      inputs: ev.inputs.map(i => ({ name: i.name, type: i.type, internalType: i.internalType, indexed: i.indexed })) };
  }
  writeFileSync("[REDACTED_LOCAL_PATH]/AppData/Local/Temp/opencode/stage5a-discovery/event-signatures.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1));
} else {
  console.log("NO_EVENT_ABI_FOUND");
  console.log(JSON.stringify(report, null, 1));
}
