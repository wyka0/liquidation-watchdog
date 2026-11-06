/** Static, same-origin assets. Dynamic text is rendered only with textContent. */
export const DASHBOARD_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Watchdog · Read-only monitor</title><link rel="stylesheet" href="/dashboard.css"><script src="/dashboard.js" defer></script></head>
<body><main><header><p class="eyebrow">PHAROS · CHAIN 1672</p><h1>Liquidation watchdog</h1><p>Protected, read-only monitoring of the fixed public demonstration position.</p></header>
<aside><strong>Oracle UNVERIFIED · Freshness UNKNOWN · actionable: false</strong><p>Repayment and collateral calculations are indicative estimates only. RPC/MCP agreement is not independent oracle validation.</p></aside>
<nav><button id="refresh" type="button">Refresh persisted data</button><span id="connection" role="status">Loading…</span></nav>
<section><h2>Operational status</h2><pre id="status"></pre></section>
<section><h2>Observation readiness</h2><p>Readiness is operational; it does not establish financial actionability.</p><pre id="readiness"></pre></section>
<section><h2>Position and risk</h2><p>Latest and last accepted observations are shown separately. Raw amounts and ratios retain their integer strings and scales.</p><pre id="position"></pre></section>
<section><h2>Observation history</h2><pre id="observations"></pre><button id="older-observations" type="button" disabled>Older observations</button></section>
<section><h2>Alert history</h2><p>Delivery is at least once. An ambiguous attempt may already have been delivered.</p><pre id="alerts"></pre><button id="older-alerts" type="button" disabled>Older alerts</button></section>
<footer>Local Phase 8 implementation. Deployment and production approval have not been granted.</footer></main></body></html>`;

export const DASHBOARD_CSS = `:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#101720;color:#e1e9f0}body{margin:0}main{max-width:1100px;margin:auto;padding:2rem}h1{font-size:2.3rem;margin:.4rem 0}.eyebrow{color:#80d9c1;letter-spacing:.16em;font-size:.8rem}p,footer{color:#b5c4d0;line-height:1.6}aside,section{border:1px solid #344453;border-radius:.7rem;padding:1.2rem;margin:1.2rem 0}aside{border-color:#b18a45;background:#28251e}aside strong{color:#f0ce85}nav{display:flex;gap:1rem;align-items:center;flex-wrap:wrap}button{font:inherit;border:1px solid #80d9c1;border-radius:.4rem;padding:.65rem .9rem;background:#173b36;color:#e8fff8;cursor:pointer}button:disabled{opacity:.4;cursor:default}button:focus-visible{outline:3px solid #f0ce85}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.85rem;line-height:1.5;max-height:34rem;overflow:auto}footer{font-size:.85rem}@media(max-width:600px){main{padding:1rem}h1{font-size:1.8rem}}`;

export const DASHBOARD_JS = `"use strict";
const cursors = { observations: null, alerts: null };
let busy = false;
const node = id => document.getElementById(id);
async function load(route, id) {
  const response = await fetch(route, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (response.status === 401) throw new Error("Authentication required. Reload and use the protected read-access login.");
  const data = await response.json();
  node(id).textContent = JSON.stringify(data, null, 2);
  if (id === "observations" || id === "alerts") {
    cursors[id] = typeof data.nextCursor === "string" && /^[1-9][0-9]{0,15}$/.test(data.nextCursor) ? data.nextCursor : null;
    node("older-" + id).disabled = cursors[id] === null;
  }
  if (!response.ok && response.status !== 503) throw new Error("Read request refused. Try again later.");
}
async function run(work) {
  if (busy) return;
  busy = true; node("refresh").disabled = true; node("connection").textContent = "Reading persisted data…";
  try { await work(); node("connection").textContent = "As-of times and stale indicators are included below. Refresh is manual."; }
  catch (error) { node("connection").textContent = error instanceof Error && error.message.startsWith("Authentication required") ? error.message : "Data unavailable or request limited. Try a manual refresh."; }
  finally { busy = false; node("refresh").disabled = false; }
}
async function refresh() {
  for (const [route, id] of [["/api/monitoring/status", "status"], ["/api/readiness", "readiness"], ["/api/positions", "position"], ["/api/observations", "observations"], ["/api/alerts", "alerts"]]) await load(route, id);
}
node("refresh").addEventListener("click", () => run(refresh));
for (const id of ["observations", "alerts"]) node("older-" + id).addEventListener("click", () => run(async () => { if (cursors[id]) await load("/api/" + id + "?before=" + encodeURIComponent(cursors[id]), id); }));
run(refresh);
`;
