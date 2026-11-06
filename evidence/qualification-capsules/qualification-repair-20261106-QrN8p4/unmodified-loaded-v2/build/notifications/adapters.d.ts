import type { MonitoringConfiguration } from "../config/monitoring.js";
import type { Alert } from "../monitoring/model.js";
import type { DeliveryResult, NotificationAdapter } from "./types.js";
export declare class ConsoleAdapter implements NotificationAdapter {
    private readonly write;
    readonly channel: "console";
    constructor(write: (text: string) => void);
    send(alert: Alert): Promise<DeliveryResult>;
}
type Http = (input: string, init: RequestInit) => Promise<Response>;
export declare function validTelegramConfiguration(credential: string, destination: string): boolean;
export declare function validDiscordDestination(endpoint: string): boolean;
declare abstract class HttpAdapter implements NotificationAdapter {
    private readonly http;
    private readonly timeoutMs;
    private readonly now;
    abstract readonly channel: "telegram" | "discord";
    constructor(http: Http, timeoutMs: number, now: () => number);
    protected post(url: string, payload: unknown, signal?: AbortSignal): Promise<DeliveryResult>;
    private performPost;
    abstract send(alert: Alert, signal?: AbortSignal): Promise<DeliveryResult>;
}
export declare class TelegramAdapter extends HttpAdapter {
    private readonly credential;
    private readonly destination;
    readonly channel: "telegram";
    constructor(credential: string, destination: string, http?: Http, timeoutMs?: number, now?: () => number);
    send(alert: Alert, signal?: AbortSignal): Promise<DeliveryResult>;
}
export declare class DiscordAdapter extends HttpAdapter {
    readonly channel: "discord";
    private readonly endpoint;
    constructor(endpoint: string, http?: Http, timeoutMs?: number, now?: () => number);
    send(alert: Alert, signal?: AbortSignal): Promise<DeliveryResult>;
}
export declare function notificationAdapters(configuration: MonitoringConfiguration, write: (text: string) => void, environment?: NodeJS.ProcessEnv): NotificationAdapter[];
export {};
