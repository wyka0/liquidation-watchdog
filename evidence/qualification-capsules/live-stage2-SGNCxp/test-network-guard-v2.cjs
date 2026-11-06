// Allow loopback fixture traffic and local named pipes; continue rejecting external hosts/UNC pipes.
// V1 rejected every \\-prefixed path, including tsx's documented \\?\pipe\... local Windows IPC.
const { appendFileSync } = require("node:fs");
const net = require("node:net");
const log = value => appendFileSync(process.env.WATCHDOG_QUALIFICATION_NETWORK_LOG, JSON.stringify({ pid: process.pid, ...value }) + "\n");
const local = host => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(String(host).toLowerCase());
const classify = options => {
  if (!options.path) return { allowed: local(options.host ?? "localhost"), host: options.host ?? "localhost", port: options.port ?? null, ipcClass: null };
  const path = String(options.path), namedPipe = /^\\\\[.?]\\pipe\\/i.test(path);
  const localSocket = !path.startsWith("\\\\");
  return { allowed: namedPipe || localSocket, host: "LOCAL_IPC", port: null, path,
    ipcClass: namedPipe ? "WINDOWS_LOCAL_NAMED_PIPE" : localSocket ? "LOCAL_SOCKET" : "UNC_OR_REMOTE_PATH" };
};
exports.classify = classify;
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...input) {
  const args = Array.isArray(input[0]) ? input[0] : input, first = args[0];
  const options = first !== null && typeof first === "object" ? first
    : typeof first === "string" ? { path: first } : { port: first, host: typeof args[1] === "string" ? args[1] : "localhost" };
  const target = classify(options);
  log({ kind: "SOCKET", ...target, outcome: target.allowed ? "LOOPBACK_OR_LOCAL_IPC_ALLOWED" : "EXTERNAL_BLOCKED" });
  if (!target.allowed) throw new Error("OFFLINE_QUALIFICATION_EXTERNAL_SOCKET_BLOCKED");
  return originalConnect.apply(this, input);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url), allowed = local(url.hostname);
  log({ kind: "FETCH", host: url.hostname, port: url.port || null, outcome: allowed ? "LOOPBACK_ALLOWED" : "EXTERNAL_BLOCKED" });
  if (!allowed) throw new Error("OFFLINE_QUALIFICATION_EXTERNAL_FETCH_BLOCKED");
  return originalFetch(input, init);
};
