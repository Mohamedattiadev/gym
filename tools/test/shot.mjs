// Headless Chromium test via CDP (no deps). Usage:
//   node tools/test/shot.mjs <outDir> <script.json|-> [base=http://localhost:8765/]
// script: [{"vp":"phone|ipad|desktop"}, {"waitFor":"css"}, {"go":"#/lib"}, {"click":"css"}, {"eval":"js"}, {"wait":ms}, {"shot":"name"}, {"seed":true}]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
const [out = "shots", scriptArg = "-", base = "http://localhost:8765/"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const steps = JSON.parse(scriptArg === "-" ? readFileSync(0, "utf8") : readFileSync(scriptArg, "utf8"));
const VP = { phone: [390, 844, 3, true], ipad: [820, 1180, 2, true], desktop: [1440, 900, 1, false], laptop: [1366, 768, 1, false] };
const port = 9300 + Math.floor(Math.random() * 500);
const prof = `/tmp/gymshot-${port}`;
const chrome = spawn("chromium", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "--no-first-run",
  "--autoplay-policy=no-user-gesture-required", "--disable-gpu", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map(); const errors = [];
async function connect() {
  for (let i = 0; i < 50; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find((t) => t.type === "page"); if (p) return p.webSocketDebuggerUrl; } catch {} await sleep(100); }
  throw new Error("no chrome");
}
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
try {
  ws = new WebSocket(await connect());
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); return; }
    if (d.method === "Runtime.exceptionThrown") errors.push("EXC " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split("\n").slice(0, 3).join(" | "));
    if (d.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(d.params.type)) errors.push(d.params.type + " " + d.params.args.map((a) => a.value ?? a.description).join(" "));
    if (d.method === "Log.entryAdded" && d.params.entry.level === "error") errors.push("LOG " + d.params.entry.text + " " + (d.params.entry.url || ""));
  };
  await send("Runtime.enable"); await send("Log.enable"); await send("Page.enable");
  const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) errors.push("EVAL " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split("\n")[0]); return r.result?.value; };
  let loaded = false, vpName = "phone";
  for (const s of steps) {
    if (s.vp) { vpName = s.vp; const [w, h, dpr, mobile] = VP[s.vp]; await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile }); await send("Emulation.setTouchEmulationEnabled", { enabled: mobile }); }
    if (s.scheme || s.display) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: s.scheme || "light" }, ...(s.display ? [{ name: "display-mode", value: s.display }] : [])] });
    if (s.safe) { try { await send("Emulation.setSafeAreaInsetsOverride", { insets: { top: s.safe[0], bottom: s.safe[1] } }); } catch (e) { errors.push("SAFE " + e.message); } }
    if (s.go !== undefined) { if (!loaded || s.reload) { await send("Page.navigate", { url: base + s.go }); loaded = true; await sleep(s.wait ?? 1200); } else { await ev(`location.hash=${JSON.stringify(s.go)}`); await sleep(s.wait ?? 600); } continue; }
    if (s.waitFor) { const t0 = Date.now(); let ok = false; while (Date.now() - t0 < (s.timeout || 20000)) { if (await ev(`!!document.querySelector(${JSON.stringify(s.waitFor)})`)) { ok = true; break; } await sleep(150); } if (!ok) errors.push("TIMEOUT waitFor " + s.waitFor); else if (s.log) console.log("waitFor", s.waitFor, Date.now() - t0, "ms"); await sleep(250); continue; }
    if (s.click) { const ok = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(s.click)});if(!e)return false;e.click();return true})()`); if (!ok) errors.push("NOCLICK " + s.click); await sleep(s.wait ?? 450); continue; }
    if (s.eval) { const v = await ev(s.eval); if (s.log) console.log("eval:", JSON.stringify(v)); await sleep(s.wait ?? 200); continue; }
    if (s.wait) await sleep(s.wait);
    if (s.shot) { const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!s.full }); const f = `${out}/${vpName}-${s.shot}.png`; writeFileSync(f, Buffer.from(r.data, "base64")); console.log("shot", f); }
  }
} catch (e) { errors.push("HARNESS " + e.message); }
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
chrome.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
