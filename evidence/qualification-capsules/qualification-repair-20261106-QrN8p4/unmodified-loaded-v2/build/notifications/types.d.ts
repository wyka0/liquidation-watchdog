import type { Alert, Channel } from "../monitoring/model.js";
export type DeliveryErrorCode = "TRANSPORT_ERROR" | "PROVIDER_HTTP_ERROR" | "PROVIDER_REJECTED" | "PROVIDER_RESPONSE_INVALID" | "PROVIDER_RATE_LIMIT" | "PROVIDER_TIMEOUT" | "ATTEMPT_INTERRUPTED" | "CONSOLE_ERROR" | "ADAPTER_ERROR" | "RETRY_EXHAUSTED";
export type DeliveryResult = {
    delivered: true;
} | {
    delivered: false;
    code: DeliveryErrorCode;
    retryable: boolean;
    ambiguous: boolean;
    retryAfterMs: number | null;
};
export interface NotificationAdapter {
    readonly channel: Channel;
    send(alert: Alert, signal?: AbortSignal): Promise<DeliveryResult>;
}
