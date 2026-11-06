import assert from "node:assert/strict";
import http from "node:http";
import sqlite from "node:sqlite";
import { syncBuiltinESMExports } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const before = { directory: process.cwd(), interrupt: process.listenerCount("SIGINT"), terminate: process.listenerCount("SIGTERM") };
const forbidden = () => { throw new Error("Import attempted an explicit-startup-only operation"); };
http.createServer = forbidden;
sqlite.DatabaseSync = new Proxy(sqlite.DatabaseSync, { construct: forbidden });
globalThis.fetch = async () => forbidden();
syncBuiltinESMExports();
await import(pathToFileURL(resolve(process.argv[2] ?? "src/service.ts")).href);
assert.equal(process.cwd(), before.directory); assert.equal(process.listenerCount("SIGINT"), before.interrupt); assert.equal(process.listenerCount("SIGTERM"), before.terminate);
console.log(JSON.stringify({ passed: true, databaseOpens: 0, serverConstructions: 0, providerRequests: 0, signalHandlersAdded: 0, cwdChanged: false }));
