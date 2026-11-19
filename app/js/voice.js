// Voice (PLAN §9b). Best: recorded clips (media/voice/<lang>/<key>.mp3, made by tools/voice/gen.py with a neural voice)
// played back to back through the same Web Audio context as the beeps. Any clip missing (offline and not cached yet,
// pounds, odd weights) -> that sentence uses the browser's own voice (Web Speech API).
// Settings > Voice turns on the spoken rest timer ("Rest 2 minutes", "10 seconds", "3, 2, 1", "Go. Set 2 of 3 …").
// The Listen button on an exercise's How to reads the steps and cues aloud even when the setting is off (explicit tap).
// The language follows <html lang>: every sentence comes from app/data/voice.<lang>.json (the same table tools/voice/gen.py
// records from; English is inlined below so it works before any fetch). tr/ar reuse the English exercise-name clips.
import { S } from "./store.js";
import { audioCtx } from "./ui.js";

const SS = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
export const supported = !!SS || typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined";
export const enabled = () => supported && S.settings.voice === true;

let voice = null, local = null;
/* best-sounding voice first: natural / neural / Google / enhanced ones beat the default device engine;
   a network voice (Android Chrome "Google US English") only while online, else the best on-device one */
const GOOD = /natural|neural|enhanced|premium|google|siri|samantha|daniel|karen|moira|serena|aria|jenny|guy/i;
const score = (v, lang) => (GOOD.test(v.name) ? 8 : 0) + (/^en[-_](us|gb)/i.test(v.lang) && lang === "en" ? 3 : 0) + (v.default ? 1 : 0) - (/compact|eloquence|espeak/i.test(v.name) ? 10 : 0);
function pick() {
  const lang = (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
  const vs = SS.getVoices().filter((v) => (v.lang || "").toLowerCase().replace("_", "-").startsWith(lang)).sort((a, b) => score(b, lang) - score(a, lang));
  local = vs.find((v) => v.localService) || null;
  voice = vs[0] || null;
}
const best = () => (voice && !voice.localService && navigator.onLine === false ? local : voice);
if (SS) { try { pick(); SS.addEventListener?.("voiceschanged", pick); } catch {} }

/** speak one or more lines; a new call cuts off what is being said. force = speak even when the setting is off */
export function speak(lines, { force = false, onend } = {}) {
  if (!SS || (!force && !enabled())) return false;
  const list = [].concat(lines).map((t) => String(t || "").trim()).filter(Boolean);
  const cut = SS.speaking || SS.pending;
  if (cut) SS.cancel();
  if (!list.length) return false;
  if (!voice) pick();
  const v = best();
  const go = () => {
    try { SS.resume(); } catch {} // Chrome can get stuck "paused" after the tab was hidden
    list.forEach((t, i) => {
      const u = new SpeechSynthesisUtterance(t);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = document.documentElement.lang || "en";
      if (i === list.length - 1 && onend) { u.onend = onend; u.onerror = onend; }
      SS.speak(u);
    });
  };
  // Chrome on Android drops an utterance queued in the same tick as cancel(): wait a moment when something was cut off
  if (cut) setTimeout(go, 120); else go();
  return true;
}
export function stop() { token++; for (const s of srcs) try { s.stop(); } catch {} srcs = []; try { SS?.cancel(); } catch {} capTimers.forEach(clearTimeout); capTimers = []; caption(""); }

/* ---- caption: the sentence being spoken, at the top of the screen (owner: "text while it talks") ---- */
let capTimers = [], capOff = 0;
function caption(text, ms = 0) {
  let c = document.getElementById("vcap");
  if (!text) { c?.classList.remove("on"); return; }
  if (/^\d+$/.test(text.trim())) return; // "3", "2", "1": the big timer already shows it
  if (!c) { c = document.createElement("div"); c.id = "vcap"; c.className = "vcap"; c.setAttribute("aria-hidden", "true"); document.body.appendChild(c); }
  c.textContent = text; c.dir = /[֐-ࣿ]/.test(text) ? "rtl" : "ltr"; // an English exercise name alone keeps its "." on the right
  c.classList.add("on");
  clearTimeout(capOff); capOff = setTimeout(() => c.classList.remove("on"), ms + 700);
}

/* ---- recorded clips ---- */
let token = 0, srcs = [];
const lang = () => (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
const VOICE_V = "2"; // = sw.js VOICE_V; bump both after regenerating clips (old cached clips are dropped)
const bufs = new Map(); // key -> Promise<AudioBuffer | null>
function load(key) {
  if (!key) return Promise.resolve(null);
  const id = `${key.startsWith("x/") && tbl().names === "en" ? "en" : lang()}/${key}`;
  if (!bufs.has(id)) bufs.set(id, (async () => {
    try { const r = await fetch(`media/voice/${id}.mp3?v=${VOICE_V}`); if (!r.ok) throw 0; return await audioCtx().decodeAudioData(await r.arrayBuffer()); }
    catch { bufs.delete(id); return null; } // not cached: try again next time (back online)
  })());
  return bufs.get(id);
}
export const preload = (parts) => parts.forEach((p) => p && load(p[0]));
/** parts = [[clipKey | null, text, gapAfter?], ...]: the clips back to back, else the joined text with the browser voice */
export async function say(parts, { force = false, onend } = {}) {
  if (!force && !enabled()) return false;
  parts = parts.filter(Boolean); if (!parts.length) return false;
  stop(); const my = token;
  const ctx = audioCtx(), got = ctx ? await Promise.all(parts.map((p) => load(p[0]))) : [];
  if (my !== token) return true; // something newer started meanwhile
  if (!ctx || got.some((b) => !b)) { const text = parts.map((p) => p[1]).join(" "); caption(text, text.length * 75); return speak(text, { force: true, onend }); }
  if (ctx.state === "suspended") try { await ctx.resume(); } catch {}
  const t0 = ctx.currentTime + 0.04; let t = t0;
  /* caption by sentence: pieces up to one ending in . ! ? are shown together while they play */
  let from = 0, sent = [];
  got.forEach((b, i) => {
    sent.push(parts[i][1]);
    if (/[.!?]$/.test(parts[i][1]) || i === got.length - 1) {
      const start = from, text = sent.join(" "), end = t + b.duration - t0;
      capTimers.push(setTimeout(() => caption(text, (end - start) * 1000), start * 1000));
      sent = []; from = t + b.duration + (parts[i][2] ?? 0.35) - t0;
    }
    const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(t); srcs.push(src);
    t += b.duration + (parts[i][2] ?? 0.35);
    if (i === got.length - 1) src.onended = () => { if (my === token) { srcs = []; onend?.(); } };
  });
  return true;
}

/* iOS Safari only speaks after a first utterance inside a user gesture: say nothing on the first tap while Voice is on */
if (SS) addEventListener("pointerdown", function unlock() {
  if (!enabled()) return;
  removeEventListener("pointerdown", unlock, true);
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; SS.speak(u); } catch {}
}, true);

/* ---- phrases: [clipKey, text, gap] lists (keys = tools/voice/gen.py, text = voice.<lang>.json) ---- */
const EN = {"voice":"en-US-AvaNeural","rate":"-20%","names":"own","dec":".",
  "rest":"Nice work. Now rest for {d}.",
  "min":{"one":"{n} minute","other":"{n} minutes"},"sec":{"one":"{n} second","other":"{n} seconds"},"minsec":"{m} {s}",
  "ten":"10 seconds.","go":"Go.","ivrest":"Rest.","restover":"Rest over. Next set.","timeup":"Time is up.","ivdone":"Intervals done.",
  "work":"Work.","warm":"Warm-up set.","last":"Last set. Finish strong.","cues":"Cues.","voiceon":"Voice on. Rest 2 minutes. Set 2 of 3.",
  "set":"Set {n} of {m}.","round":"Round {n} of {m}.",
  "kg":{"one":"{n} kilo","other":"{n} kilos"},"lb":{"one":"{n} pound","other":"{n} pounds"},
  "reps":{"one":"{n} rep.","other":"{n} reps."},"forReps":{"one":"for {n} rep.","other":"for {n} reps."},
  "step":"Step {n}. {s}","hold":"Hold for {d}."}; // = app/data/voice.en.json (tools/test/unit/voice.test.mjs checks)
const tables = { en: EN };
let loading = null;
/** fetch voice.<lang>.json once (main.js calls it at boot; English needs nothing) */
export function loadTable(l = lang()) {
  if (tables[l] || l === "en") return Promise.resolve();
  return (loading ||= fetch(`data/voice.${l}.json`).then((r) => r.json()).then((j) => { tables[l] = j; }).catch(() => {}).finally(() => { loading = null; }));
}
const tbl = () => tables[lang()] || (loadTable(), EN);
const fill = (s, kv) => s.replace(/\{(\w)\}/g, (m, k) => kv[k] ?? m);
const num = (n) => String(n).replace(".", tbl().dec);
const pl = (key, n) => { const f = tbl()[key]; let c = "other"; try { c = new Intl.PluralRules(lang()).select(n); } catch {} return (f[c] ?? f.other).replace("{n}", num(n)); };
export function duration(sec) {
  sec = Math.round(sec); const m = Math.floor(sec / 60), s = sec % 60;
  if (!m) return pl("sec", s);
  return s ? fill(tbl().minsec, { m: pl("min", m), s: pl("sec", s) }) : pl("min", m);
}
const kgKey = (w) => (S.settings.unit === "kg" && ((w <= 300 && Number.isInteger(w * 2)) || (w <= 400 && Number.isInteger(w))) ? `kg/${w}` : null);
const p = (k) => tbl()[k];
const holdKey = (sec) => (sec % 5 === 0 && sec >= 10 && sec <= 180 ? `p/hold-${sec}` : null); // clips: tools/voice/gen.py
export const P = {
  rest: (sec) => [[sec % 15 === 0 && sec <= 600 ? `p/rest-${sec}` : null, fill(p("rest"), { d: duration(sec) })]],
  count: (n) => [n === 10 ? ["p/ten", p("ten")] : [`p/n${n}`, String(n)]],
  timeUp: () => [["p/timeup", p("timeup")]],
  ivRest: () => [["p/rest", p("ivrest")]],
  ivDone: () => [["p/ivdone", p("ivdone")]],
  ivWork: (n, m) => [["p/work", p("work"), 0.12], [m <= 30 ? `p/round-${n}-of-${m}` : null, fill(p("round"), { n, m })]],
  voiceOn: () => [["p/voiceon", p("voiceon")]],
  /** Q21 timed set starts: "Go. Hold for 60 seconds." */
  hold: (sec) => [["p/go", p("go"), 0.15], ...(sec ? [[holdKey(sec), fill(p("hold"), { d: duration(sec) })]] : [])],
  /** nx = train.js nextInfo(): { text, last, slug, fam, name, set, of, w, r, cue, newEx } */
  go(nx = {}) {
    if (!nx.name) return nx.last ? [["p/go", p("go")], ["p/last", p("last")]] : [["p/restover", p("restover")]];
    const out = [["p/go", p("go"), 0.15]];
    if (nx.newEx) out.push([nx.slug ? `x/${nx.slug}` : null, `${nx.name}.`]);
    const n = +nx.set, m = +nx.of;
    out.push(n ? [m <= 12 && n <= m ? `p/set-${n}-of-${m}` : null, fill(p("set"), { n, m })] : ["p/warm", p("warm")]);
    const w = +nx.w, r = +nx.r;
    if (+nx.t) out.push([holdKey(+nx.t), fill(p("hold"), { d: duration(+nx.t) })]);
    else if (r && w) out.push([kgKey(w), pl(S.settings.unit === "lb" ? "lb" : "kg", w), 0.08], [r <= 50 ? `fr/${r}` : null, pl("forReps", r)]);
    else if (r) out.push([r <= 50 ? `r/${r}` : null, pl("reps", r)]);
    if (nx.cue) out.push([nx.fam ? `f/${nx.fam}-c0` : null, nx.cue]);
    return out;
  },
  /** exercise How to: name, numbered steps, cues */
  howTo: (e) => [[`x/${e.slug}`, `${e.name}.`, 0.4], ...e.steps.map((s, i) => [`f/${e.family}-s${i}`, fill(p("step"), { n: i + 1, s }), 0.45]),
    ...(e.cues.length ? [["p/cues", p("cues"), 0.25], ...e.cues.map((c, i) => [`f/${e.family}-c${i}`, /[.!?]$/.test(c) ? c : c + ".", 0.35])] : [])],
};
