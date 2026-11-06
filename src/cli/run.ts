import { inspectLive } from "../chain/live.js";
import { captureDirectory } from "../config/evidence.js";
import { loadThresholds } from "../config/risk.js";
import { DataError } from "../domain/errors.js";
import { saveSnapshotEvidence } from "../domain/evidence.js";
import { renderReport } from "../domain/report.js";
import type { Snapshot } from "../domain/types.js";
import { calculateAssuredRisk } from "../risk/assured.js";
import { evaluateAssurance } from "../oracle-assurance/evaluate.js";
import { renderOracleStatus } from "../oracle-assurance/report.js";
import { saveRiskEvidence } from "../risk/evidence.js";
import { renderRiskReport } from "../risk/report.js";
import { riskSnapshotSchema } from "../risk/snapshot-schema.js";
import type { RiskResult } from "../risk/types.js";
import { canCalculate } from "../validation/quality.js";
import { CLI_USAGE, parseCliOptions } from "./options.js";
import type { MonitoringCliDependencies } from "./monitor.js";
import type { OracleCliDependencies } from "./oracle.js";

export interface CliDependencies {
  inspect: (block?: bigint) => Promise<Snapshot>;
  write: (text: string) => void;
  saveInspection: (snapshot: Snapshot, directory: string) => Promise<void>;
  saveRisk: (snapshot: Snapshot, result: RiskResult, directory: string) => Promise<void>;
  now: () => Date;
  monitoring?: MonitoringCliDependencies;
  oracle?: Partial<OracleCliDependencies>;
}

export async function runCli(args: readonly string[], overrides: Partial<CliDependencies> = {}): Promise<number> {
  const dependencies: CliDependencies = {
    inspect: inspectLive, write: text => { process.stdout.write(text); },
    saveInspection: saveSnapshotEvidence, saveRisk: saveRiskEvidence, now: () => new Date(), ...overrides
  };
  const options = parseCliOptions(args);
  if (options.command === "help") { dependencies.write(`${CLI_USAGE}\n`); return 0; }
  if ("probe" in options) {
    const { runOperationsCli } = await import("./operations.js");
    return runOperationsCli(options, dependencies.write, dependencies.now);
  }
  if ("localMaxAgeSeconds" in options) {
    const { runOracleCli } = await import("./oracle.js");
    return runOracleCli(options, dependencies.inspect, dependencies.write, dependencies.now, dependencies.oracle);
  }
  if ("monitoringOverrides" in options) {
    const { runMonitoringCli } = await import("./monitor.js");
    return runMonitoringCli(options, dependencies.write, dependencies.now, dependencies.monitoring);
  }
  // Validate all configuration before any network request.
  const thresholds = options.command === "risk" ? await loadThresholds(options.configPath, options.thresholdOverrides) : null;
  const snapshot = await dependencies.inspect(options.block);
  if ((options.block !== undefined && snapshot.block !== null && snapshot.block.number !== options.block)
    || (options.block !== undefined && snapshot.evidenceKind === "LIVE_CHAIN_READ")
    || (options.block === undefined && snapshot.evidenceKind === "HISTORICAL_SNAPSHOT")) {
    throw new DataError("CLI_SNAPSHOT_MISMATCH", "The returned snapshot does not match the explicitly requested block/mode.", "consistency");
  }
  const directory = captureDirectory(options.command, options.block);
  if (options.command === "inspect") {
    dependencies.write(renderReport(snapshot));
    if (options.saveEvidence) {
      await dependencies.saveInspection(snapshot, directory);
      dependencies.write(`Sanitized snapshot evidence saved under ${directory}/.\n`);
    }
    return snapshot.accepted ? 0 : 2;
  }
  if (!thresholds) throw new Error("Risk thresholds were not initialized.");
  const calculatedAt = dependencies.now();
  const assurance = evaluateAssurance(snapshot, { now: calculatedAt });
  const result = calculateAssuredRisk(snapshot, assurance, thresholds, { calculatedAt });
  dependencies.write(renderRiskReport(result));
  dependencies.write(renderOracleStatus(assurance));
  if (options.saveEvidence) {
    const normalized = riskSnapshotSchema.safeParse(snapshot);
    await dependencies.saveRisk(normalized.success ? normalized.data : snapshot, result, directory);
    dependencies.write(`Sanitized risk evidence saved under ${directory}/.\n`);
  }
  return canCalculate(result.dataQuality.overall) && result.mathematicalRiskState !== null ? 0 : 2;
}
