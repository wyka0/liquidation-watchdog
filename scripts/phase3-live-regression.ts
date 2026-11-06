import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { root } from "./phase3-files.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";

const schema = z.object({ blockNumber: z.string(), blockHash: z.string(), debtAmount: z.string(), collateralValue: z.string(),
  liquidationCapacity: z.string(), ltv: z.string(), safetyRatio: z.string(), actionable: z.literal(false),
  dataQuality: z.object({ oracle: z.literal("UNVERIFIED") }), repayment: z.object({ amount: z.object({ raw: z.string() }), calculation: z.unknown(), actionable: z.literal(false) }),
  additionalCollateral: z.object({ amount: z.object({ raw: z.string() }), calculation: z.unknown(), actionable: z.literal(false) }) });
const read = async (directory: string) => schema.parse(JSON.parse(await readFile(join(root, directory, "risk/historical-21853902/risk-result.json"), "utf8")));
const before = await read("evidence/phase2"), after = await read(CURRENT_EVIDENCE);
const passed = JSON.stringify(before) === JSON.stringify(after);
await writeFile(join(root, CURRENT_EVIDENCE, "historical-regression.json"), `${JSON.stringify({
  evidenceKind: "HISTORICAL_CHAIN_REREAD_AGAINST_PHASE2", checkedAt: new Date().toISOString(), passed, before, after
}, null, 2)}\n`);
console.log(`Historical read-only Phase 2 regression: ${passed ? "PASS" : "FAIL"}; identity, debt/value/capacity/LTV/ratio and both complete recovery proofs compared.`);
if (!passed) process.exitCode = 1;
