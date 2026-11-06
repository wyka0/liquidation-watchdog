import type { AddressInfo } from "node:net";
import type { Lifecycle, ReadApi } from "./read-model.js";
import type { SchedulerEndpoint } from "./scheduler.js";
export declare const HTTP_LIMITS: Readonly<{
    headerBytes: 8192;
    urlBytes: 2048;
    responseBytes: number;
    connections: 64;
    inFlight: 16;
    clientInFlight: 4;
    clientIdentities: 256;
    globalPerMinute: 300;
    clientPerMinute: 120;
    readsPerSecond: 8;
    cacheEntries: 16;
    cacheBytes: number;
}>;
export interface HttpOptions {
    api: ReadApi;
    authenticate: (header: string | undefined) => boolean;
    lifecycle: () => Lifecycle;
    now?: () => number;
    scheduler?: SchedulerEndpoint;
}
/** No static-file root, upstream client, SQL handle, writable store or request logger. */
export declare class ReadHttpServer {
    private readonly options;
    private readonly server;
    private accepting;
    private closing;
    private readonly sockets;
    private readonly clients;
    private readonly cache;
    private readonly pendingReads;
    private cacheBytes;
    private inFlight;
    private global;
    private reads;
    private scheduled;
    private readonly now;
    constructor(options: HttpOptions);
    listen(host: string, port: number): Promise<AddressInfo>;
    private encode;
    private send;
    private error;
    private admit;
    private projection;
    private handle;
    private handleScheduler;
    close(): Promise<void>;
}
