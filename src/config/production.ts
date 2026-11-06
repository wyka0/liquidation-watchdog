import { isAbsolute } from "node:path";
import { z } from "zod";
import { NETWORK, DEPLOYMENT } from "./deployment.js";
import { parseMonitoringConfiguration } from "./monitoring.js";
import type { MonitoringConfiguration } from "./monitoring.js";
import { validateThresholds } from "./risk.js";
import type { ThresholdConfiguration } from "./risk.js";
import { DataError } from "../domain/errors.js";
import { validDiscordDestination, validTelegramConfiguration } from "../notifications/adapters.js";
import type { PositionConfiguration } from "./position.js";
import { demoPositionConfiguration, validatePositionConfiguration } from "./position.js";

export const VERIFIED_RUNTIME = Object.freeze({ node: "v24.14.1", sqlite: "3.51.2" });
export const ENVIRONMENT_NAMES = ["WATCHDOG_TELEGRAM_BOT_TOKEN", "WATCHDOG_TELEGRAM_CHAT_ID", "WATCHDOG_DISCORD_WEBHOOK_URL"] as const;
const fixedChain = z.object({ chainId: z.literal(1672), rpc: z.literal(NETWORK.rpc), mcp: z.literal(NETWORK.mcp) });
const fixedPosition = z.object(Object.fromEntries(Object.entries(DEPLOYMENT).map(([key, value]) => [key, z.literal(value)])));
type ChannelConfiguration = "DISABLED" | "CONFIGURED" | "MISSING" | "INVALID";

export function notificationConfiguration(config: MonitoringConfiguration, environment: NodeJS.ProcessEnv = process.env) {
  let telegram: ChannelConfiguration = "DISABLED", discord: ChannelConfiguration = "DISABLED";
  // Disabled channels must not access even the corresponding environment property.
  if (config.notifications.telegram) {
    const token = environment.WATCHDOG_TELEGRAM_BOT_TOKEN, chat = environment.WATCHDOG_TELEGRAM_CHAT_ID;
    telegram = !token || !chat ? "MISSING" : validTelegramConfiguration(token, chat) ? "CONFIGURED" : "INVALID";
  }
  if (config.notifications.discord) {
    const endpoint = environment.WATCHDOG_DISCORD_WEBHOOK_URL;
    discord = !endpoint ? "MISSING" : validDiscordDestination(endpoint) ? "CONFIGURED" : "INVALID";
  }
  return { console: "ENABLED" as const, telegram, discord };
}

export function validateStartupConfiguration(config: MonitoringConfiguration, options: {
  environment?: NodeJS.ProcessEnv; runtime?: { node: string; sqlite: string }; chain?: unknown; position?: unknown;
  thresholds?: ThresholdConfiguration;
} = {}) {
  const errors: string[] = [];
  const parsed = parseMonitoringConfiguration(config);
  const runtime = options.runtime ?? { node: process.version, sqlite: process.versions.sqlite ?? "UNAVAILABLE" };
  const suppliedPosition = options.position ?? demoPositionConfiguration();
  const positionValid = fixedPosition.safeParse(suppliedPosition).success || (() => {
    try {
      const candidate = suppliedPosition as PositionConfiguration;
      validatePositionConfiguration(candidate, options.thresholds ?? candidate.thresholds); return true;
    } catch { return false; }
  })();
  if (!fixedChain.safeParse(options.chain ?? NETWORK).success || !positionValid) errors.push("MANDATORY_CHAIN_CONFIG_INVALID");
  if (options.thresholds !== undefined) {
    try { validateThresholds(options.thresholds); } catch { errors.push("THRESHOLD_CONFIG_INVALID"); }
  }
  const notifications = notificationConfiguration(parsed, options.environment);
  if ([notifications.telegram, notifications.discord].some(value => value === "INVALID" || value === "MISSING")) errors.push("ENABLED_NOTIFICATION_CONFIG_INVALID");
  const runtimeVerified = runtime.node === VERIFIED_RUNTIME.node && runtime.sqlite === VERIFIED_RUNTIME.sqlite;
  if (parsed.operations.profile === "production") {
    if (!runtimeVerified) errors.push("PRODUCTION_RUNTIME_MISMATCH");
    if (!isAbsolute(parsed.storage.path)) errors.push("PRODUCTION_DATABASE_ABSOLUTE_PATH_REQUIRED");
    if (parsed.operations.shutdownTimeoutSeconds <= parsed.notifications.timeoutSeconds) errors.push("PRODUCTION_SHUTDOWN_BUDGET_INVALID");
    if (parsed.operations.cycleTimeoutSeconds < 120) errors.push("PRODUCTION_CYCLE_BUDGET_INVALID");
  }
  return { valid: errors.length === 0, profile: parsed.operations.profile, errors, runtimeVerified, notifications,
    chain: { status: errors.includes("MANDATORY_CHAIN_CONFIG_INVALID") ? "INVALID" : "FIXED_CONFIGURATION_VALID", chainId: NETWORK.chainId },
    secretValues: "OMITTED" as const, endpointOverrides: "UNSUPPORTED" as const };
}

export function requireStartupConfiguration(config: MonitoringConfiguration,
  options: { thresholds?: ThresholdConfiguration; position?: PositionConfiguration } = {}): void {
  const result = validateStartupConfiguration(config, options);
  if (!result.valid) throw new DataError("STARTUP_CONFIG_INVALID", "Startup configuration is invalid. Use config-check for sanitized configuration codes.");
}
