// Tests may use loopback fixture servers only. Real external socket/fetch attempts fail closed.
const { appendFileSync } = require("node:fs");
const net = require("node:net");
const log = value => appendFileSync(process.env.WATCHDOG_QUALIFICATION_NETWORK_LOG, JSON.stringify({ pid: process.pid, ...value }) + "\n");
const local = host => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(String(host).toLowerCase());
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...input) {
  const args = Array.isArray(input[0]) ? input[0] : input;
  const first = args[0];
  const options = first !== null && typeof first === "object" ? first
    : typeof first === "string" ? { path: first } : { port: first, host: typeof args[1] === "string" ? args[1] : "localhost" };
  const host = options.host ?? "localhost";
  const allowed = options.path ? !String(options.path).startsWith("\\\\") : local(host);
  log({ kind: "SOCKET", host: options.path ? "LOCAL_IPC" : host, port: options.port ?? null, outcome: allowed ? "LOOPBACK_OR_LOCAL_IPC_ALLOWED" : "EXTERNAL_BLOCKED" });
  if (!allowed) throw new Error("OFFLINE_QUALIFICATION_EXTERNAL_SOCKET_BLOCKED");
  return originalConnect.apply(this, input);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const allowed = local(url.hostname);
  log({ kind: "FETCH", host: url.hostname, port: url.port || null, outcome: allowed ? "LOOPBACK_ALLOWED" : "EXTERNAL_BLOCKED" });
  if (!allowed) throw new Error("OFFLINE_QUALIFICATION_EXTERNAL_FETCH_BLOCKED");
  return originalFetch(input, init);
};
