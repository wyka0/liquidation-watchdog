import type { MonitoringConfiguration } from "./monitoring.js";
import type { ThresholdConfiguration } from "./risk.js";
import type { PositionConfiguration } from "./position.js";
export declare const VERIFIED_RUNTIME: Readonly<{
    node: "v24.14.1";
    sqlite: "3.51.2";
}>;
export declare const ENVIRONMENT_NAMES: readonly ["WATCHDOG_TELEGRAM_BOT_TOKEN", "WATCHDOG_TELEGRAM_CHAT_ID", "WATCHDOG_DISCORD_WEBHOOK_URL"];
type ChannelConfiguration = "DISABLED" | "CONFIGURED" | "MISSING" | "INVALID";
export declare function notificationConfiguration(config: MonitoringConfiguration, environment?: NodeJS.ProcessEnv): {
    console: "ENABLED";
    telegram: ChannelConfiguration;
    discord: ChannelConfiguration;
};
export declare function validateStartupConfiguration(config: MonitoringConfiguration, options?: {
    environment?: NodeJS.ProcessEnv;
    runtime?: {
        node: string;
        sqlite: string;
    };
    chain?: unknown;
    position?: unknown;
    thresholds?: ThresholdConfiguration;
}): {
    valid: boolean;
    profile: "local" | "production";
    errors: string[];
    runtimeVerified: boolean;
    notifications: {
        console: "ENABLED";
        telegram: ChannelConfiguration;
        discord: ChannelConfiguration;
    };
    chain: {
        status: string;
        chainId: 1672;
    };
    secretValues: "OMITTED";
    endpointOverrides: "UNSUPPORTED";
};
export declare function requireStartupConfiguration(config: MonitoringConfiguration, options?: {
    thresholds?: ThresholdConfiguration;
    position?: PositionConfiguration;
}): void;
export {};
