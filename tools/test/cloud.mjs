// Q11 browser test: the real app + a fake Supabase on the SAME origin (so the CSP needs no change).
//   node tools/test/cloud.mjs <outDir>
// Serves app/ on :8766, answers supabase-config.json, /auth/v1/* (authorize -> ?code=e2e, token, logout) and
// /rest/v1/gym_backups (one in-memory row with rev), then drives two "phones" (fresh browser profiles) with shot.mjs:
// phone 1 logs a workout and signs in -> row created; phone 2 signs in -> workout restored; phone 2 deletes the cloud data.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const out = resolve(process.argv[2] || "cloud-shots"); mkdirSync(out, { recursive: true });
const ROOT = resolve("app"), PORT = 8766, BASE = `http://localhost:${PORT}/`;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".glb": "model/gltf-binary", ".jpg": "image/jpeg" };
let row = null; const calls = [];
const user = { id: "00000000-0000-4000-8000-000000000001", email: "tester@example.com" };
const session = () => ({ access_token: "acc-" + Date.now(), refresh_token: "ref-" + Date.now(), expires_in: 3600, token_type: "bearer", user });
const srv = http.createServer(async (q, r) => {
  const u = new URL(q.url, BASE), send = (code, body, type = "application/json") => { r.writeHead(code, { "content-type": type, "cache-control": "no-store" }); r.end(body == null ? "" : typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
  let body = ""; for await (const c of q) body += c;
  if (u.pathname.startsWith("/auth/") || u.pathname.startsWith("/rest/")) calls.push(`${q.method} ${u.pathname}${u.search}`);
  if (u.pathname === "/supabase-config.json") return send(200, { url: `http://localhost:${PORT}`, key: "anon-test" });
  if (u.pathname === "/__row") return send(200, { row, calls });
  if (u.pathname === "/auth/v1/authorize") {
    const back = u.searchParams.get("redirect_to"), ok = u.searchParams.get("provider") === "google" && u.searchParams.get("code_challenge_method") === "s256" && (u.searchParams.get("code_challenge") || "").length >= 43;
    return send(200, `<script>location.replace(${JSON.stringify(back + (ok ? "?code=e2e" : "?error=bad_request&error_description=bad+authorize+params"))})</script>`, "text/html");
  }
  if (u.pathname === "/auth/v1/token") { const b = JSON.parse(body || "{}"); return (b.auth_code === "e2e" && b.code_verifier?.length >= 43) || b.refresh_token ? send(200, session()) : send(400, { error: "invalid_grant" }); }
  if (u.pathname === "/auth/v1/logout") return send(204, null);
  if (u.pathname === "/rest/v1/gym_backups") {
    if (!/^Bearer acc-/.test(q.headers.authorization || "") || q.headers.apikey !== "anon-test") return send(401, { message: "JWT" });
    if (q.method === "GET") return send(200, row ? [{ data: row.data, rev: row.rev }] : []);
    const b = JSON.parse(body || "null");
    if (q.method === "POST") { if (row) return send(409, {}); row = { data: b.data, rev: 1 }; return send(201, null); }
    if (q.method === "PATCH") { const want = +(u.searchParams.get("rev") || "").replace("eq.", ""); if (!row || row.rev !== want) return send(200, []); row = { data: b.data, rev: b.rev }; return send(200, [{ rev: b.rev }]); }
    if (q.method === "DELETE") { row = null; return send(204, null); }
  }
  let p = join(ROOT, decodeURIComponent(u.pathname)); if (!p.startsWith(ROOT)) return send(403, "");
  try { if ((await stat(p)).isDirectory()) p = join(p, "index.html"); send(200, await readFile(p), TYPES[extname(p)] || "application/octet-stream"); } catch { send(404, "not found", "text/plain"); }
});
await new Promise((ok) => srv.listen(PORT, ok));
if (process.argv.includes("--serve")) { console.log("fake Supabase + app on " + BASE); await new Promise(() => {}); } // debug: keep serving

// async spawn: spawnSync would block this process, and with it the fake server the browser talks to
const shot = (name, steps) => new Promise((done) => {
  const f = join(out, name + ".json"); writeFileSync(f, JSON.stringify(steps));
  const p = spawn("node", ["tools/test/shot.mjs", out, f, BASE]); let o = "";
  p.stdout.on("data", (d) => (o += d)); p.stderr.on("data", (d) => (o += d));
  const kill = setTimeout(() => p.kill(), 180000);
  p.on("close", () => { clearTimeout(kill); process.stdout.write(`--- ${name}\n${o}`); done(o); });
});
const fakeSession = `import('./js/store.js').then(m=>{const t=Date.now()-864e5;m.S.sessions.push({id:'e2e1',startedAt:t,endedAt:t+3600e3,entries:[{slug:'barbell-bench-press',sets:[{w:'60',r:'10',done:true,type:'n'}]}]});m.save('sessions');return m.flush()})`;
const fails = [];
const check = (cond, msg) => { console.log((cond ? "ok   " : "FAIL ") + msg); if (!cond) fails.push(msg); };

// phone 1: workout on the device, then Sign in with Google
const o1 = await shot("phone1", [{ vp: "phone" }, { go: "#/train" }, { waitFor: ".nav" }, { eval: fakeSession, wait: 400 },
  { go: "#/me/settings" }, { waitFor: "#aIn" }, { eval: "document.querySelector('#acct').scrollIntoView({block:'center'})", wait: 300 }, { shot: "account-signed-out" },
  { click: "#aIn" }, { wait: 2500 }, { waitFor: "#aSync" }, { wait: 800 }, { eval: "document.querySelector('#acct').scrollIntoView({block:'center'})", wait: 300 }, { shot: "account-signed-in" },
  { eval: "location.search + '|' + location.hash", log: true }]);
let st = await (await fetch(BASE + "__row")).json();
check(st.row?.rev === 1 && st.row.data.data.sessions.some((s) => s.id === "e2e1"), "phone 1: sign-in created the row with the workout");
check(!JSON.stringify(st.row?.data || {}).includes("ref-"), "no refresh token in the uploaded data");
check(/eval: "\|#\/me\/settings"/.test(o1), "phone 1: back on #/me/settings, ?code removed from the URL");

// phone 2: a fresh browser signs in to the same account -> the workout comes back; then Delete my cloud data
const o2 = await shot("phone2", [{ vp: "phone" }, { go: "#/me/settings" }, { waitFor: "#aIn" }, { click: "#aIn" }, { wait: 2500 }, { waitFor: "#aSync" }, { wait: 800 },
  { eval: "import('./js/store.js').then(m=>m.S.sessions.map(s=>s.id).join(','))", log: true },
  { eval: "document.documentElement.setAttribute('data-theme','dark')" }, { eval: "document.querySelector('#acct').scrollIntoView({block:'center'})", wait: 300 }, { shot: "account-dark" },
  { go: "#/privacy" }, { waitFor: "h1" }, { shot: "privacy" },
  { go: "#/me/settings" }, { waitFor: "#aDel" }, { click: "#aDel" }, { wait: 500 }, { click: "[data-v=\"1\"]" }, { wait: 1500 }, { waitFor: "#aIn" }, { eval: "document.querySelector('#acct').scrollIntoView({block:'center'})", wait: 300 }, { shot: "after-delete" },
  { eval: "import('./js/store.js').then(m=>m.S.sessions.length+'|'+JSON.stringify(m.S.cloud))", log: true }]);
st = await (await fetch(BASE + "__row")).json();
check(/eval: "e2e1"/.test(o2), "phone 2: workout restored after sign-in");
check(st.row === null, "phone 2: Delete my cloud data removed the row");
check(/eval: "1\|null"/.test(o2), "phone 2: local data kept, signed out");
check(!/ERRORS/.test(o1 + o2), "no console errors");
srv.close();
console.log(fails.length ? `CLOUD TEST FAILED (${fails.length})` : "CLOUD TEST PASS");
process.exit(fails.length ? 1 : 0);
