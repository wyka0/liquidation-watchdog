import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const render = readFileSync("render-a3.yaml", "utf8");
const wrangler = readFileSync("cloudflare/monitor-scheduler/wrangler.toml", "utf8");
const service = readFileSync("src/postgres-service.ts", "utf8");

describe("A3 FIXTURE: unapproved Free deployment drafts", () => {
  it("keeps the Render Blueprint inert, Free, diskless and auto-deploy disabled", () => {
    expect(render).toContain("DRAFT-UNAPPROVED-NOT-DEPLOYED");
    expect(render).toMatch(/type: web\s+runtime: node/);
    expect(render).toMatch(/plan: free/);
    expect(render).toMatch(/autoDeployTrigger: 'off'/);
    expect(render).toMatch(/startCommand: npm run start:postgres/);
    expect(render).toMatch(/healthCheckPath: \/api\/health/);
    expect(render).not.toMatch(/^\s*(?:disk|databases|preDeployCommand):/m);
  });
  it("declares only names/placeholders for required credentials and starts monitoring disabled", () => {
    expect(render).toMatch(/WATCHDOG_SCHEDULER_ENABLED\s+value: 'false'/);
    expect(render).toMatch(/WATCHDOG_SCHEDULER_SLOT_SECONDS\s+value: '300'/);
    for (const name of ["WATCHDOG_POSTGRES_WRITER_URL", "WATCHDOG_POSTGRES_READER_URL", "WATCHDOG_READ_API_TOKEN", "WATCHDOG_SCHEDULER_SECRET"]) {
      expect(render).toMatch(new RegExp(`key: ${name}\\s+sync: false`));
    }
    expect(render).not.toMatch(/postgres(?:ql)?:\/\//i);
  });
  it("binds the Worker draft to one five-minute UTC Cron without account or secret values", () => {
    expect(wrangler).toContain("DRAFT-UNAPPROVED-NOT-DEPLOYED");
    expect(wrangler).toMatch(/crons = \["\*\/5 \* \* \* \*"\]/);
    expect(wrangler).toMatch(/workers_dev = false/);
    expect(wrangler).not.toMatch(/account_id\s*=/);
    expect(wrangler).not.toMatch(/WATCHDOG_SCHEDULER_SECRET\s*=/);
  });
  it("passes the documented A2 cadence environment name through the explicit service allowlist", () => {
    expect(service).toContain("WATCHDOG_SCHEDULER_SLOT_SECONDS: process.env.WATCHDOG_SCHEDULER_SLOT_SECONDS");
  });
});
