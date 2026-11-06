import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runSubmissionDemo } from "../scripts/submission-demo.js";

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) { await new Promise(resolve => setTimeout(resolve, 20)); rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } });

describe("SUBMISSION FIXTURE: reproducible single-position demo", () => {
  it("qualifies the synthetic warning/critical, outbox, rendering, restart and strict-gate scenarios", async () => {
    const parent = mkdtempSync(join(tmpdir(), "opencode", "watchdog-submission-demo-")); directories.push(parent);
    const result = await runSubmissionDemo({ root: resolve("."), outputDirectory: join(parent, "artifacts") });
    expect(result.summary).toMatchObject({ evidenceKind: "SYNTHETIC_FIXTURE_DEMO", passed: true,
      scenarios: { warning: "WARNING", critical: "CRITICAL", insufficientEvidenceAction: "NON_FINANCIAL", qualifiedFixtureAction: "FINANCIAL_OPTION" },
      persistence: { consoleDelivered: true, restartKnownDeliveriesResent: false },
      readiness: { status: 503, ready: false },
      safety: { actionable: false, liveProviderVerified: false, oracleAssuranceLiveVerified: false, realNotificationsSent: 0 } });
  });
});
