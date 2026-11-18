// Q0b click-through audit: visits every route, clicks every button / link / chip (and every button inside the sheets they
// open, one level deep), and records console errors, browser dialogs, dead buttons (no DOM / route / sheet / video change),
// buttons covered by another element, horizontal overflow and tap targets smaller than 24 px.
//   node tools/test/clickthrough.mjs [outDir] [--quick]     (needs the app on localhost:8765)
// --quick = phone light only (used by all.sh). Full = phone light + desktop dark (+ layout checks on small/laptop).
// Exit 1 only on real bugs (console errors, browser dialogs, failed clicks). Dead / tiny / overflow are listed for review.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
const root = new URL("../../", import.meta.url).pathname;
const args = process.argv.slice(2), quick = args.includes("--quick");
const out = args.find((a) => !a.startsWith("--")) || "/tmp/gym-click"; mkdirSync(out, { recursive: true });
const base = "http://localhost:8765/";
const VP = { phone: [390, 844, 3, true], small: [360, 740, 2, true], desktop: [1440, 900, 1, false], laptop: [1366, 768, 1, false] };
const ex = JSON.parse(readFileSync(root + "app/data/exercises.json", "utf8"));
const slug = (ex.find((e) => e.slug === "barbell-bench-press") || ex[0]).slug;
const ROUTES = ["#/", "#/lib", `#/ex/${slug}`, "#/body", "#/train", "#/plan/ulf3", "#/plans", "#/me", "#/guide", "#/start", "#/profile",
  "#/standards", "#/nutrition", "#/warmup", "#/videos", "#/settings", "#/timer", "#/pick", "#/session"];
const PER_KIND = 3, SHEET_MAX = 14;
const SKIP_TEXT = /^(sign out|log out|disconnect)/i; // never pressed
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- helpers injected into every page ----
const INJECT = `(() => {
  window.__dlg = []; for (const k of ["alert", "confirm", "prompt"]) window[k] = (m) => { window.__dlg.push(k + ": " + m); return k === "confirm" ? false : null; };
  window.open = (u) => { window.__opened = u; return null; };
  const SEL = 'button, a[href], [role=button], [role=tab], [role=switch], summary, input[type=checkbox], input[type=radio], label.switch';
  const h = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; };
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(e);
    return s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05 && !e.closest("[hidden],[inert],[aria-hidden=true]") && !e.disabled; };
  const txt = (e) => (e.getAttribute("aria-label") || e.textContent || e.value || "").trim().replace(/\\s+/g, " ").slice(0, 40);
  const attrs = (e, vals) => [...e.attributes].filter((a) => a.name.startsWith("data-") || a.name === "href" || a.name === "id" || a.name === "for").map((a) => vals ? a.name + "=" + a.value.slice(0, 40) : a.name).join(" ");
  const sig = (e) => e.tagName.toLowerCase() + "[" + attrs(e, true) + "] " + txt(e);
  const kind = (e) => e.tagName + "." + [...e.classList].sort().join(".") + "[" + attrs(e, false) + "]" + (e.getAttribute("href") || "").split("/").slice(0, 2).join("/");
  const scope = (where) => where === "view" ? [document.getElementById("view")] : where === "sheet" ? [document.getElementById("sheetBody")]
    : [document.getElementById("nav"), document.getElementById("topbar")];
  const all = (where) => scope(where).flatMap((r) => r ? [...r.querySelectorAll(SEL)] : [])
    .filter((e) => !(e.matches("input") && e.closest("label.switch")) && (vis(e) || (e.matches("input") && e.closest("label") && vis(e.closest("label")))));
  window.__ct = {
    list(where) { const seen = {}, perKind = {}, res = [];
      for (const e of all(where)) { const s = sig(e), k = kind(e); const n = seen[s] = (seen[s] || 0) + 1;
        perKind[k] = (perKind[k] || 0) + 1; if (perKind[k] > ${PER_KIND}) continue;
        if (e.matches(".on, [aria-pressed=true], [aria-selected=true], [aria-current=page], [aria-checked=true]:not(input)") && !e.matches("label.switch")) continue; // already selected: pressing it again rightly does nothing
        const ext = e.matches("a[href]") && /^(https?:|mailto:|tel:)/.test(e.getAttribute("href"));
        res.push({ sig: s, n, kind: k, ext, blank: e.target === "_blank", rel: e.rel || "", file: e.matches("input[type=file]"), dl: e.hasAttribute("download") }); }
      return res; },
    find(where, s, n) { let i = 0; for (const e of all(where)) if (sig(e) === s && ++i === n) return e; return null; },
    state() { const d = document.getElementById("sheet"), b = document.body.innerHTML;
      return [location.hash, h(b), d?.open ? 1 : 0, Math.round(scrollY), [...document.querySelectorAll("video")].map((v) => v.paused ? 0 : 1).join(""), document.documentElement.className, document.fullscreenElement ? 1 : 0, window.__opened || ""].join("|"); },
    press(where, s, n) { const e = this.find(where, s, n); if (!e) return { miss: true };
      e.scrollIntoView({ block: "center", inline: "center" }); const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y); let cover = "";
      if (hit && hit !== e && !e.contains(hit) && !hit.contains(e) && !(e.htmlFor && hit.id === e.htmlFor) && !(e.matches("input") && hit.closest("label")?.contains(e))) cover = sig(hit.closest(SEL) || hit) + " ." + [...hit.classList].join(".");
      const before = this.state(); window.__dlg = []; e.click(); return { before, cover }; },
    sheetKey() { const b = document.getElementById("sheetBody"); return b ? (b.querySelector("h1,h2,h3,h4,p")?.textContent || "").trim().slice(0, 50) : ""; },
    isDlg() { const d = document.getElementById("sheet"); return d?.open && d.classList.contains("dlg"); },
    layout() { const W = innerWidth, res = { overflow: document.documentElement.scrollWidth - W, out: [], tiny: [] };
      const clip = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== "visible") return true; } return false; };
      for (const e of document.querySelectorAll("#view *, #sheetBody *")) { if (!vis(e)) continue; const r = e.getBoundingClientRect();
        if ((r.right > W + 1 || r.left < -1) && !clip(e) && res.out.length < 6) res.out.push(sig(e).slice(0, 70) + " " + Math.round(r.left) + ".." + Math.round(r.right)); }
      for (const e of [...all("view"), ...all("sheet"), ...all("chrome")]) { const r = e.getBoundingClientRect(); if (Math.min(r.width, r.height) >= 24) continue;
        if (e.matches("a") && e.closest("p, li, .muted, small") && !e.matches(".btn,.chip")) continue; // inline text links are exempt (WCAG 2.5.8)
        const pa = getComputedStyle(e, "::after"), pb = getComputedStyle(e, "::before");
        if ([pa, pb].some((p) => p.content !== "none" && p.position === "absolute" && (parseFloat(p.width) >= 24 || parseFloat(p.inset) < 0 || parseFloat(p.top) < 0))) continue; // invisible hit area
        if (res.tiny.length < 12) res.tiny.push(sig(e).slice(0, 60) + " " + Math.round(r.width) + "x" + Math.round(r.height)); }
      return res; },
  };
})();`;

// ---- CDP ----
async function browser() {
  const port = 9300 + Math.floor(Math.random() * 600), prof = `/tmp/gymclick-${port}`;
  const proc = spawn("chromium", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "--no-first-run",
    "--autoplay-policy=no-user-gesture-required", "--disable-gpu", "about:blank"], { stdio: "ignore" });
  let url; for (let i = 0; i < 60 && !url; i++) { try { url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {} if (!url) await sleep(100); }
  const ws = new WebSocket(url); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(), b = { errs: [], file: 0, dl: 0 };
  ws.onmessage = (m) => { const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); return; }
    if (d.method === "Runtime.exceptionThrown") b.errs.push("EXC " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split("\n").slice(0, 2).join(" | "));
    if (d.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(d.params.type)) b.errs.push(d.params.type + " " + d.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200));
    if (d.method === "Log.entryAdded" && d.params.entry.level === "error" && !/vibrate/.test(d.params.entry.text)) b.errs.push("LOG " + d.params.entry.text + " " + (d.params.entry.url || ""));
    if (d.method === "Page.fileChooserOpened") b.file++;
    if (d.method === "Page.downloadWillBegin") b.dl++; };
  b.send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  b.ev = async (expr) => { const r = await b.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) b.errs.push("EVAL " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text).split("\n")[0]); return r.result?.value; };
  b.call = (fn, ...a) => b.ev(`window.__ct.${fn}(${a.map((x) => JSON.stringify(x)).join(",")})`);
  b.close = () => { proc.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch {} };
  await b.send("Runtime.enable"); await b.send("Log.enable"); await b.send("Page.enable");
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
  await b.send("Page.setInterceptFileChooserDialog", { enabled: true }).catch(() => {});
  await b.send("Page.setDownloadBehavior", { behavior: "deny" }).catch(() => {});
  await b.send("Page.addScriptToEvaluateOnNewDocument", { source: INJECT });
  return b;
}

const seedJS = `(async () => { const { S, save } = await import('./js/store.js'); const d = 864e5, now = Date.now();
  const mk = (i, slugA, w) => ({ id: 'seed' + i, name: 'Seed ' + i, startedAt: now - i * 2 * d, endedAt: now - i * 2 * d + 3600e3,
    entries: [{ slug: slugA, sets: [{ w, r: 8, done: true, type: 'n' }, { w, r: 8, done: true, type: 'n' }] }, { slug: 'barbell-curl', sets: [{ w: 25, r: 10, done: true, type: 'n' }] }] });
  for (let i = 1; i <= 6; i++) S.sessions.push(mk(i, ${JSON.stringify(slug)}, 60 + i * 2.5)); save('sessions'); return S.sessions.length; })()`;
const resetJS = `(async () => { try { (await import('./js/ui.js')).closeSheet(); (await import('./js/timer.js')).stop(); } catch {} document.querySelectorAll('.toast').forEach((t) => t.remove()); })()`;

async function run(vpName, scheme, { clicks, routes = ROUTES }) {
  const b = await browser(), [w, h, dpr, mobile] = VP[vpName], R = { vp: vpName, scheme, routes: {} };
  await b.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile });
  await b.send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
  await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  await b.send("Page.navigate", { url: base + "#/train" }); await sleep(2500);
  await b.ev(seedJS); await sleep(300);
  const hasActive = () => b.ev(`import('./js/store.js').then((m) => !!m.S.active)`);
  const ensureSession = async () => { if (await hasActive()) return;
    await b.ev(`location.hash = '#/train'`); await sleep(800);
    if (!(await b.ev(`!!document.querySelector('[data-start]')`))) { await b.ev(`document.querySelector('[data-use]')?.click()`); await sleep(900); await b.ev(`document.querySelector('#sheet[open] [data-c]')?.click()`); await sleep(600); }
    await b.ev(`document.querySelector('[data-start]')?.click()`); await sleep(1200); };
  const goRoute = async (r) => { await b.ev(resetJS); await sleep(260); if (r === "#/session") await ensureSession();
    if (await b.ev(`location.hash`) !== r) { await b.ev(`location.hash = ${JSON.stringify(r)}`); await sleep(900); }
    else { await b.ev(`import('./js/nav.js').then((m) => m.rerender())`); await sleep(450); }
    await b.ev(`scrollTo(0, 0)`); await sleep(80); };
  const take = () => { const e = b.errs.splice(0); return e.filter((x) => !/vibrate/.test(x)); };
  // press one element, wait, classify
  const press = async (where, c, ctx) => {
    const f0 = b.file, d0 = b.dl; const p = await b.call("press", where, c.sig, c.n);
    if (p?.miss) return { res: "missing", ...ctx };
    await sleep(650);
    const after = await b.call("state"), dlg = await b.ev(`window.__dlg`), errs = take();
    const [h0, , s0] = p.before.split("|"), [h1, , s1] = after.split("|");
    let res = after !== p.before ? (h1 !== h0 ? "nav " + h1 : s1 === "1" && s0 !== "1" ? "sheet" : "changed") : b.file > f0 ? "file chooser" : b.dl > d0 ? "download" : "DEAD?";
    return { res, cover: p.cover, errs, dlg, ...ctx };
  };
  for (const r of routes) {
    const RR = R.routes[r] = { items: [], layout: null };
    await goRoute(r); take();
    RR.layout = await b.call("layout");
    if (!clicks) continue;
    const wheres = r === "#/" ? ["view", "chrome"] : ["view"];
    const sheetsDone = new Set();
    for (const where of wheres) {
      await goRoute(r); take();
      const cands = (await b.call("list", where)) || [];
      for (const c of cands) {
        if (c.ext) { RR.items.push({ sig: c.sig, res: c.blank ? "external (new tab)" : "EXTERNAL SAME TAB", note: c.blank && !/noopener|noreferrer/.test(c.rel) ? "no rel=noopener" : "" }); continue; }
        if (SKIP_TEXT.test(c.sig.split("] ")[1] || "")) { RR.items.push({ sig: c.sig, res: "skipped" }); continue; }
        await goRoute(r); take();
        const it = await press(where, c, { sig: c.sig }); RR.items.push(it);
        if (it.res === "sheet") {
          const dlg = await b.call("isDlg"), key = await b.call("sheetKey");
          it.sheet = key;
          if (dlg) { // confirm dialog: answer Cancel and check it closes without doing anything
            await b.ev(`document.querySelector('#sheetBody [data-v="0"], #sheetBody [data-c=""], #sheetBody [data-x]')?.click()`); await sleep(400);
            it.res = "confirm (cancelled)"; it.errs.push(...take()); continue; }
          it.layout = await b.call("layout");
          if (sheetsDone.has(key)) continue; sheetsDone.add(key);
          const sc = ((await b.call("list", "sheet")) || []).slice(0, SHEET_MAX); it.sub = [];
          for (const s of sc) {
            if (s.ext) { it.sub.push({ sig: s.sig, res: s.blank ? "external (new tab)" : "EXTERNAL SAME TAB" }); continue; }
            if (SKIP_TEXT.test(s.sig.split("] ")[1] || "")) { it.sub.push({ sig: s.sig, res: "skipped" }); continue; }
            await goRoute(r); take(); const re = await press(where, c, {}); if (re.res !== "sheet") { it.sub.push({ sig: s.sig, res: "could not reopen sheet (" + re.res + ")" }); continue; }
            const si = await press("sheet", s, { sig: s.sig });
            if (si.res === "sheet" || (await b.call("isDlg"))) { if (await b.call("isDlg")) { await b.ev(`document.querySelector('#sheetBody [data-v="0"], #sheetBody [data-c=""], #sheetBody [data-x]')?.click()`); await sleep(400); si.res = "confirm (cancelled)"; } }
            it.sub.push(si);
          }
        }
      }
    }
    process.stdout.write(`  ${vpName} ${scheme} ${r}: ${RR.items.length} items\n`);
  }
  b.close(); return R;
}

const combos = quick ? [["phone", "light", true]] : [["phone", "light", true], ["desktop", "dark", true], ["small", "dark", false], ["laptop", "light", false]];
const results = [];
for (const [vp, sc, clicks] of combos) { console.log(`== ${vp} ${sc}${clicks ? "" : " (layout only)"}`); results.push(await run(vp, sc, { clicks })); }
writeFileSync(`${out}/clickthrough.json`, JSON.stringify(results, null, 1));

// ---- summary ----
let bugs = 0; const lines = [];
const flat = (it) => [it, ...(it.sub || [])];
for (const R of results) {
  lines.push(`\n## ${R.vp} ${R.scheme}`);
  for (const [r, RR] of Object.entries(R.routes)) {
    const L = RR.layout, probs = [];
    if (L?.overflow > 1) probs.push(`page scrolls sideways by ${L.overflow}px`);
    if (L?.out.length) probs.push("sticks out: " + L.out.join("; "));
    if (L?.tiny.length) probs.push("small targets: " + L.tiny.join("; "));
    for (const it of RR.items.flatMap(flat)) {
      if (it.errs?.length) { bugs++; probs.push(`BUG console on "${it.sig}": ${[...new Set(it.errs)].join(" / ")}`); }
      if (it.dlg?.length) { bugs++; probs.push(`BUG browser dialog on "${it.sig}": ${it.dlg.join(" / ")}`); }
      if (it.res === "DEAD?") probs.push(`dead? "${it.sig}"`);
      if (/could not reopen/.test(it.res)) probs.push(`${it.res}: "${it.sig}"`);
      if (it.res === "EXTERNAL SAME TAB" || it.note) probs.push(`${it.res} ${it.note || ""}: "${it.sig}"`);
      if (it.cover) probs.push(`covered: "${it.sig}" under ${it.cover}`);
      if (it.layout?.overflow > 1 || it.layout?.out?.length) probs.push(`sheet "${it.sheet}" overflow: ${it.layout.overflow}px ${it.layout.out.join("; ")}`);
    }
    const n = RR.items.reduce((a, it) => a + flat(it).length, 0), gone = RR.items.flatMap(flat).filter((it) => it.res === "missing").length;
    lines.push(`${probs.length ? "!!" : "ok"} ${r} (${n - gone} clicks${gone ? `, ${gone} gone after earlier clicks changed the page state` : ""})${probs.map((p) => "\n    - " + p).join("")}`);
  }
}
const txt = lines.join("\n"); writeFileSync(`${out}/clickthrough.txt`, txt); console.log(txt);
console.log(`\n${bugs} bug(s). Full data: ${out}/clickthrough.json`); process.exit(bugs ? 1 : 0);
