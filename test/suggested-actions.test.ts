import { createHash } from "node:crypto";
import { readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deriveSuggestedAction } from "../src/actions/derive.js";
import { suggestedActionSchema } from "../src/actions/model.js";
import { alertCodeSchema, alertSchema, observationSchema, riskView, storedAlertSchema } from "../src/monitoring/model.js";
import type { Alert, Observation } from "../src/monitoring/model.js";
import { renderAlert } from "../src/notifications/format.js";
import { calculateAssuredRisk } from "../src/risk/assured.js";
import { MonitorStore } from "../src/storage/store.js";
import { fixtureAlert, monitoringFixture, MONITOR_THRESHOLDS, persistFixture, temporaryMonitorDirectory, testClock } from "./fixtures/monitoring.js";
import { riskFixture } from "./fixtures/phase4.js";
import { verifiedAssuranceFixture } from "./fixtures/recovery.js";

const directory = temporaryMonitorDirectory();
let base: Observation, financial: Observation;
beforeAll(async () => {
  base = await monitoringFixture();
  const snapshot = await riskFixture(), assurance = verifiedAssuranceFixture(snapshot);
  const result = calculateAssuredRisk(snapshot, assurance, MONITOR_THRESHOLDS,
    { calculatedAt: testClock(), progression: { state: "ADVANCING" } });
  expect(result.recoveryEligibility.eligible).toBe(true);
  const block = snapshot.block!;
  financial = observationSchema.parse({ cycleId: "qualified_action", observedAt: testClock().toISOString(), accepted: true,
    risk: riskView(result), diagnostics: [], assurance,
    progression: { state: "ADVANCING", reason: null, advancedBlocks: "1", blockNumber: block.number.toString(),
      blockHash: block.hash, blockTimestamp: block.timestamp.toString(), headNumber: (block.number + 5n).toString(),
      baselineBlockNumber: (block.number - 1n).toString(), baselineBlockHash: block.parentHash,
      sameBlockStreak: 0, evaluatedAt: testClock().toISOString() } });
});
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });

function blocked(reason: NonNullable<Observation["risk"]["recoveryEligibility"]>["reasonCodes"][number]): Observation {
  const value = structuredClone(financial);
  value.risk.recoveryEligibility = { eligible: false, status: "BLOCKED", reasonCodes: [reason] };
  value.risk.repayment = null; value.risk.additionalCollateral = null;
  return value;
}

describe("FIXTURE: mandatory typed suggested actions", () => {
  it.each(alertCodeSchema.options)("creates exactly one safe action for %s", code => {
    const action = deriveSuggestedAction(code, base);
    expect(suggestedActionSchema.parse(action)).toEqual(action);
    expect(action).toMatchObject({ type: "NON_FINANCIAL", origin: "GENERATED", actionable: false, createdAt: base.observedAt });
    expect(action.instruction.length).toBeGreaterThan(10); expect(action.financialOptions).toEqual([]);
    expect(JSON.stringify(action)).not.toMatch(/amountRaw|amountFormatted/);
  });

  it("copies only existing qualified recovery estimates with exact units and provenance", () => {
    const action = deriveSuggestedAction("RISK_WORSENED", financial);
    expect(action.type).toBe("FINANCIAL_OPTION");
    if (action.type !== "FINANCIAL_OPTION") throw new Error("Expected qualified financial action");
    expect(action.financialOptions).toHaveLength(2);
    const repayment = action.financialOptions.find(option => option.type === "REPAY")!;
    expect(repayment).toMatchObject({ amountRaw: financial.risk.repayment!.raw,
      amountFormatted: financial.risk.repayment!.formatted, assetAddress: financial.risk.repayment!.tokenAddress,
      assetDecimals: financial.risk.repayment!.decimals, snapshotIdentifier: financial.risk.snapshotIdentifier,
      blockNumber: financial.risk.blockNumber, blockHash: financial.risk.blockHash,
      oracleObservationTimestamp: financial.assurance!.freshness.observationTimestamp,
      freshness: "VERIFIED", actionable: false });
    expect(BigInt(repayment.amountRaw).toString()).toBe(repayment.amountRaw);
    expect(repayment.amountFormatted).toMatch(/^[0-9]+(?:\.[0-9]+)?$/);
    expect(action.evidence).toMatchObject({ status: "QUALIFIED_FINANCIAL", progressionState: "ADVANCING",
      oracleAssurance: "VERIFIED", oracleFreshness: "VERIFIED", independentValidation: "VERIFIED",
      recoveryEligibility: { eligible: true, status: "ELIGIBLE", reasonCodes: [] } });
  });

  it("never turns an informational or recovered alert into a financial instruction", () => {
    for (const code of ["RISK_IMPROVED", "RISK_RECOVERY", "NO_DEBT_OBSERVED", "ORACLE_ASSURANCE_IMPROVED"] as const) {
      expect(deriveSuggestedAction(code, financial)).toMatchObject({ type: "NON_FINANCIAL", actionable: false });
    }
  });

  it("uses non-financial actions when oracle assurance is missing", () => {
    const value = structuredClone(financial); delete value.assurance;
    expect(deriveSuggestedAction("RISK_WORSENED", value)).toMatchObject({ type: "NON_FINANCIAL", actionable: false });
  });

  it("uses non-financial actions for unknown freshness", () => {
    const value = structuredClone(financial); value.assurance!.freshness.state = "UNKNOWN";
    value.risk.recoveryEligibility = { eligible: false, status: "BLOCKED", reasonCodes: ["RECOVERY_ORACLE_FRESHNESS_NOT_VERIFIED"] };
    value.risk.repayment = null; value.risk.additionalCollateral = null;
    expect(deriveSuggestedAction("RISK_WORSENED", value)).toMatchObject({ type: "NON_FINANCIAL",
      evidence: { oracleFreshness: "UNKNOWN" }, financialOptions: [] });
  });

  it("uses a non-financial action for stale position data", () => {
    const value = blocked("RECOVERY_POSITION_DATA_BLOCKED"); value.accepted = false; value.risk.dataQuality = "STALE";
    expect(deriveSuggestedAction("RISK_WORSENED", value)).toMatchObject({ type: "NON_FINANCIAL",
      evidence: { status: "NOT_QUALIFIED" }, financialOptions: [] });
  });

  it.each(["UNKNOWN", "STALLED", "REGRESSED", "CONFLICT"] as const)("uses non-financial actions for %s progression", state => {
    const value = structuredClone(financial); value.progression!.state = state;
    value.risk.recoveryEligibility = { eligible: false, status: "BLOCKED",
      reasonCodes: [state === "UNKNOWN" ? "RECOVERY_CHAIN_PROGRESSION_UNKNOWN" : `RECOVERY_CHAIN_PROGRESSION_${state}`] };
    value.risk.repayment = null; value.risk.additionalCollateral = null;
    expect(deriveSuggestedAction("RISK_WORSENED", value)).toMatchObject({ type: "NON_FINANCIAL",
      evidence: { progressionState: state }, financialOptions: [] });
  });

  it("uses a non-financial action for snapshot identity mismatch", () => {
    expect(deriveSuggestedAction("RISK_WORSENED", blocked("RECOVERY_SNAPSHOT_IDENTITY_MISMATCH"))).toMatchObject({
      type: "NON_FINANCIAL", evidence: { recoveryEligibility: { reasonCodes: ["RECOVERY_SNAPSHOT_IDENTITY_MISMATCH"] } } });
  });

  it("uses non-financial actions for invalidated evidence", () => {
    const value = blocked("RECOVERY_EVIDENCE_INVALIDATED"); value.assurance!.evidenceInvalidated = true;
    value.assurance!.invalidatedAt = value.observedAt; value.assurance!.invalidationReason = "CONFIGURATION_CHANGE";
    expect(deriveSuggestedAction("RISK_WORSENED", value)).toMatchObject({ type: "NON_FINANCIAL",
      evidence: { evidenceInvalidated: true }, financialOptions: [] });
  });

  it("uses non-financial actions for timestamp and configuration anomalies", () => {
    const timestamp = blocked("RECOVERY_TIMESTAMP_ANOMALY"); timestamp.assurance!.freshness.anomalies = ["FUTURE_TIMESTAMP"];
    expect(deriveSuggestedAction("RISK_WORSENED", timestamp)).toMatchObject({ type: "NON_FINANCIAL",
      evidence: { timestampAnomalies: ["FUTURE_TIMESTAMP"] } });
    const configuration = blocked("RECOVERY_EVIDENCE_INVALIDATED"); configuration.assurance!.changes = ["ORACLE_CONFIGURATION_CHANGED"];
    expect(deriveSuggestedAction("RISK_WORSENED", configuration)).toMatchObject({ type: "NON_FINANCIAL",
      evidence: { configurationChanges: ["ORACLE_CONFIGURATION_CHANGED"] } });
    const mismatch = blocked("RECOVERY_CONFIGURATION_MISMATCH"); mismatch.assurance!.configurationFingerprint = null;
    expect(deriveSuggestedAction("RISK_WORSENED", mismatch)).toMatchObject({ type: "NON_FINANCIAL",
      evidence: { recoveryEligibility: { reasonCodes: ["RECOVERY_CONFIGURATION_MISMATCH"] } } });
  });

  it("renders the alert timestamp and explicit action line", () => {
    const alert = fixtureAlert(base), text = renderAlert(alert);
    expect(text.startsWith(`[${alert.createdAt}]`)).toBe(true);
    expect(text).toContain(`Action: ${alert.suggestedAction.instruction}`);
    expect(text).toContain("Action evidence:"); expect(text).toContain("actionable: false");
  });

  it("renders amounts only inside a qualified financial action", () => {
    const template = fixtureAlert(base), financialAction = deriveSuggestedAction("RISK_WORSENED", financial);
    const qualified = alertSchema.parse({ ...template, code: "RISK_WORSENED", current: financial,
      createdAt: financial.observedAt, cycleId: financial.cycleId, suggestedAction: financialAction });
    const financialText = renderAlert(qualified);
    expect(financialText).toContain("Action option: REPAY");
    expect(financialText).toContain(financial.risk.repayment!.formatted);
    const nonFinancial = alertSchema.parse({ ...qualified, code: "RISK_IMPROVED",
      suggestedAction: deriveSuggestedAction("RISK_IMPROVED", financial) });
    const nonFinancialText = renderAlert(nonFinancial);
    expect(nonFinancialText).not.toContain("Action option:");
    expect(nonFinancialText).not.toContain(financial.risk.repayment!.raw);
    expect(nonFinancialText).not.toContain(financial.risk.additionalCollateral!.raw);
  });

  it("upgrades legacy bytes in memory without changing their hash or inventing an amount", () => {
    const current = fixtureAlert(base), legacy = structuredClone(current) as Partial<Alert>;
    delete legacy.suggestedAction; const text = JSON.stringify(legacy), before = createHash("sha256").update(text).digest("hex");
    const parsed = storedAlertSchema.parse(JSON.parse(text));
    expect(createHash("sha256").update(text).digest("hex")).toBe(before);
    expect(parsed.suggestedAction).toMatchObject({ origin: "LEGACY_DERIVED", type: "NON_FINANCIAL",
      rationale: "LEGACY_ALERT_WITHOUT_PERSISTED_ACTION", actionable: false, financialOptions: [] });
    expect(parsed.suggestedAction.createdAt).toBe(current.createdAt);
    expect(alertSchema.safeParse(legacy).success).toBe(false);
  });

  it("persists generated actions across a SQLite restart", () => {
    const path = join(directory, "suggested-actions.sqlite"); let store = new MonitorStore(path); store.acquireMonitor();
    const alerts = persistFixture(store, base); store.close(); store = new MonitorStore(path);
    expect(Object.fromEntries(store.alerts().map(alert => [alert.id, alert.suggestedAction])))
      .toEqual(Object.fromEntries(alerts.map(alert => [alert.id, alert.suggestedAction]))); store.close();
  });

  it("reads a legacy SQLite alert without rewriting its original bytes", () => {
    const path = join(directory, "legacy-action.sqlite"); let store = new MonitorStore(path); store.acquireMonitor(); persistFixture(store, base); store.close();
    const db = new DatabaseSync(path), row = db.prepare("SELECT id,alert_json FROM alerts ORDER BY rowid LIMIT 1").get()!;
    const id = String(row.id), legacy = JSON.parse(String(row.alert_json)) as Record<string, unknown>; delete legacy.suggestedAction;
    const text = JSON.stringify(legacy), hash = createHash("sha256").update(text).digest("hex");
    db.prepare("UPDATE alerts SET alert_json=? WHERE id=?").run(text, id); db.close();
    store = new MonitorStore(path); expect(store.alerts().find(alert => alert.id === id)?.suggestedAction.origin).toBe("LEGACY_DERIVED"); store.close();
    const reopened = new DatabaseSync(path); const retained = String(reopened.prepare("SELECT alert_json FROM alerts WHERE id=?").get(id)?.alert_json); reopened.close();
    expect(retained).toBe(text); expect(createHash("sha256").update(retained).digest("hex")).toBe(hash);
  });

  it("contains no signing, private-key or transaction-broadcast implementation", () => {
    const source = (directoryPath: string): string => readdirSync(directoryPath).sort().map(name => {
      const filename = join(directoryPath, name); return statSync(filename).isDirectory() ? source(filename)
        : filename.endsWith(".ts") ? readFileSync(filename, "utf8") : "";
    }).join("\n");
    expect(source(join(process.cwd(), "src"))).not.toMatch(/eth_sendRawTransaction|sendRawTransaction|sendTransaction|signTransaction|privateKey|mnemonic/i);
  });
});
