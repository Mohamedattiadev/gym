// Printable guide (block 25 / Q8): wall poster (A3) + full guide (A4) per level and language, built from the app's own data.
// Usage: node tools/guide/build.mjs [outDir=docs/guide] [levels=beginner] [langs=en] [base=http://localhost:8765/]
//   e.g. node tools/guide/build.mjs docs/guide beginner,intermediate,advanced en,tr,ar
// Needs the local server (cd app && python3 -m http.server 8765), chromium, qrencode; pdftoppm for the PNG check pages.
// The plans are built IN the app (plans.js buildPlan with a fresh profile = full gym, 60 min, no focus), so the PDF lists
// exactly the exercises a new user gets when they press "Use this plan".
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { guideHTML, posterHTML } from "./template.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [outArg = "docs/guide", lvArg = "beginner", langArg = "en", base = "http://localhost:8765/"] = process.argv.slice(2);
const OUT = resolve(outArg), LEVELS = lvArg.split(","), LANGS = langArg.split(",");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (p) => JSON.parse(readFileSync(resolve(ROOT, "app", p), "utf8"));

/* ---- minimal CDP ---- */
const port = 9800 + Math.floor(Math.random() * 150), prof = `/tmp/gymshot-guide-${port}`;
const chrome = spawn("chromium", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "--no-first-run",
  "--disable-gpu", "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
const done = () => { try { chrome.kill(); } catch {} try { rmSync(prof, { recursive: true, force: true }); } catch {} };
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { done(); process.exit(130); });
let ws, id = 0; const pending = new Map(), waiters = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const loaded = () => new Promise((r) => waiters.push(r));
async function go(url) { const l = loaded(); await send("Page.navigate", { url }); await l; }

/* ---- data from the running app ---- */
const DUMP = `(async () => {
  const D = await import('./js/data.js'); if (!D.EX.length) await D.loadExercises();
  const P = await import('./js/plans.js');
  const pick = (e) => ({ slug: e.slug, name: e.name, group: e.group, equipment: e.equipment, tier: e.tier, rest: e.rest, family: e.family, poster: e.poster, pattern: e.pattern });
  const out = {};
  for (const lv of ${JSON.stringify(LEVELS)}) {
    const p = P.planById(P.recommendedId(lv, undefined)), opt = { min: 60, focus: '' }, slots = P.planSlots(p, opt);
    out[lv] = { id: p.id, days: p.days, week: p.week, sets: P.weeklySets(p, slots),
      workouts: P.buildPlan(p, opt).map((w, i) => ({ name: w.name, min: P.minutesOf(slots[i]),
        items: w.items.map((it) => { const e = D.BY[it.slug]; return { ...pick(e), sets: it.sets, reps: it.reps, swaps: D.swaps(e, 3).map(pick) }; }) })) };
  }
  return out;
})()`;

/* ---- QR (qrencode SVG, quiet zone drawn by the layout) ---- */
const qrCache = new Map();
export function qr(url) {
  if (!qrCache.has(url)) {
    let s = execFileSync("qrencode", ["-t", "SVG", "-m", "0", "-l", "M", "--rle", "-o", "-", url], { encoding: "utf8" });
    s = s.replace(/<\?xml[^>]*>\s*/, "").replace(/<!--[^>]*-->\s*/, "").replace(/ width="[^"]*" height="[^"]*"/, "")
      .replace(/<rect x="0" y="0" width="(\d+)" height="\1" fill="#ffffff"\/>/, "").replace(/#000000/g, "#1E1B1A");
    qrCache.set(url, s);
  }
  return qrCache.get(url);
}

try {
  for (let i = 0; i < 60 && !ws; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find((t) => t.type === "page"); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} if (!ws) await sleep(100); }
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => { const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); }
    if (d.method === "Page.loadEventFired") waiters.splice(0).forEach((r) => r()); };
  await send("Page.enable"); await send("Runtime.enable");
  await go(base + "#/train"); await sleep(800);
  const data = await ev(DUMP);
  writeFileSync(resolve(OUT, "plans-data.json"), JSON.stringify(data, null, 1));
  /* posters as JPEG: Chromium embeds JPEG as-is (DCT) but re-encodes WebP losslessly -> 5x bigger PDFs */
  const IMG = resolve(OUT, ".img"); mkdirSync(IMG, { recursive: true });
  const img = (p) => { const src = resolve(ROOT, "app", p), jpg = resolve(IMG, p.split("/").pop().replace(/\.\w+$/, ".jpg"));
    if (!existsSync(jpg)) execFileSync("magick", [src, "-resize", "400x400>", "-quality", "82", "-strip", jpg]); return jpg; };
  const ctx = { root: ROOT, qr, img, site: "https://mohamedattiadev.github.io/gym/",
    text: { plans: json("data/guide/plans.json"), warm: json("data/guide/warmups.json"), std: json("data/guide/standards.json"),
      nutri: json("data/guide/nutrition.json"), joints: json("data/guide/joints.json").joints } };
  for (const lang of LANGS) {
    const fam = existsSync(resolve(ROOT, `app/data/families.${lang}.json`)) ? json(`data/families.${lang}.json`) : json("data/families.en.json");
    for (const lv of LEVELS) {
      for (const [kind, fn, size] of [["poster", posterHTML, { w: 11.69, h: 16.54 }], ["guide", guideHTML, { w: 8.27, h: 11.69 }]]) {
        const name = `gym-${kind}-${lv}-${lang}`, html = resolve(OUT, `${name}.html`);
        writeFileSync(html, fn({ ...ctx, lang, level: lv, plan: data[lv], fam: fam.families }));
        await go("file://" + html);
        await ev("document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode().catch(() => 0))))");
        const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, paperWidth: size.w, paperHeight: size.h, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, generateTaggedPDF: true });
        writeFileSync(resolve(OUT, `${name}.pdf`), Buffer.from(pdf.data, "base64"));
        rmSync(html);
        try { mkdirSync(resolve(OUT, "png"), { recursive: true }); execFileSync("pdftoppm", ["-r", kind === "poster" ? "40" : "60", "-png", resolve(OUT, `${name}.pdf`), resolve(OUT, "png", name)]); } catch {}
        console.log("ok", name);
      }
    }
  }
} finally { done(); try { rmSync(resolve(OUT, ".img"), { recursive: true, force: true }); } catch {} }
process.exit(0);
