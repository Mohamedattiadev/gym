// Voice (PLAN §9b). Best: recorded clips (media/voice/<lang>/<key>.mp3, made by tools/voice/gen.py with a neural voice)
// played back to back through the same Web Audio context as the beeps. Any clip missing (offline and not cached yet,
// pounds, odd weights) -> that sentence uses the browser's own voice (Web Speech API).
// Settings > Voice turns on the spoken rest timer ("Rest 2 minutes", "10 seconds", "3, 2, 1", "Go. Set 2 of 3 …").
// The Listen button on an exercise's How to reads the steps and cues aloud even when the setting is off (explicit tap).
// The language follows <html lang> (English now; block 21 sets tr/ar).
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
export function stop() { token++; for (const s of srcs) try { s.stop(); } catch {} srcs = []; try { SS?.cancel(); } catch {} }

/* ---- recorded clips ---- */
let token = 0, srcs = [];
const lang = () => (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
const bufs = new Map(); // key -> Promise<AudioBuffer | null>
function load(key) {
  if (!key) return Promise.resolve(null);
  const id = `${lang()}/${key}`;
  if (!bufs.has(id)) bufs.set(id, (async () => {
    try { const r = await fetch(`media/voice/${id}.mp3`); if (!r.ok) throw 0; return await audioCtx().decodeAudioData(await r.arrayBuffer()); }
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
  if (!ctx || got.some((b) => !b)) return speak(parts.map((p) => p[1]).join(" "), { force: true, onend });
  if (ctx.state === "suspended") try { await ctx.resume(); } catch {}
  let t = ctx.currentTime + 0.04;
  got.forEach((b, i) => {
    const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(t); srcs.push(src);
    t += b.duration + (parts[i][2] ?? 0.22);
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

/* ---- phrases: [clipKey, text, gap] lists (keys = tools/voice/gen.py) ---- */
export function duration(sec) {
  sec = Math.round(sec); const m = Math.floor(sec / 60), s = sec % 60;
  if (!m) return `${s} seconds`;
  return `${m} minute${m === 1 ? "" : "s"}${s ? ` ${s} seconds` : ""}`;
}
const kgKey = (w) => (S.settings.unit === "kg" && ((w <= 300 && Number.isInteger(w * 2)) || (w <= 400 && Number.isInteger(w))) ? `kg/${w}` : null);
export const P = {
  rest: (sec) => [[sec % 15 === 0 && sec <= 600 ? `p/rest-${sec}` : null, `Set done. Rest for ${duration(sec)}.`]],
  count: (n) => [n === 10 ? ["p/ten", "10 seconds."] : [`p/n${n}`, String(n)]],
  timeUp: () => [["p/timeup", "Time is up."]],
  ivRest: () => [["p/rest", "Rest."]],
  ivDone: () => [["p/ivdone", "Intervals done."]],
  ivWork: (n, m) => [["p/work", "Work.", 0.12], [m <= 30 ? `p/round-${n}-of-${m}` : null, `Round ${n} of ${m}.`]],
  voiceOn: () => [["p/voiceon", "Voice on. Rest 2 minutes. Set 2 of 3."]],
  /** nx = train.js nextInfo(): { text, slug, fam, name, set, of, w, r, cue, newEx } */
  go(nx = {}) {
    if (!nx.name) return nx.text && /last set/i.test(nx.text) ? [["p/go", "Go."], ["p/last", "Last set. Finish strong."]] : [["p/restover", "Rest over. Next set."]];
    const out = [["p/go", "Go.", 0.15]];
    if (nx.newEx) out.push([nx.slug ? `x/${nx.slug}` : null, `${nx.name}.`]);
    const n = +nx.set, m = +nx.of;
    out.push(n ? [m <= 12 && n <= m ? `p/set-${n}-of-${m}` : null, `Set ${n} of ${m}.`] : ["p/warm", "Warm-up set."]);
    const w = +nx.w, r = +nx.r, unit = S.settings.unit === "lb" ? (w === 1 ? "pound" : "pounds") : (w === 1 ? "kilo" : "kilos");
    if (r && w) out.push([kgKey(w), `${w} ${unit}`, 0.08], [r <= 50 ? `fr/${r}` : null, `for ${r} reps.`]);
    else if (r) out.push([r <= 50 ? `r/${r}` : null, `${r} reps.`]);
    if (nx.cue) out.push([nx.fam ? `f/${nx.fam}-c0` : null, nx.cue]);
    return out;
  },
  /** exercise How to: name, numbered steps, cues */
  howTo: (e) => [[`x/${e.slug}`, `${e.name}.`, 0.4], ...e.steps.map((s, i) => [`f/${e.family}-s${i}`, `Step ${i + 1}. ${s}`, 0.45]),
    ...(e.cues.length ? [["p/cues", "Cues.", 0.25], ...e.cues.map((c, i) => [`f/${e.family}-c${i}`, /[.!?]$/.test(c) ? c : c + ".", 0.35])] : [])],
};
