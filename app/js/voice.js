// Voice (PLAN §9b, option A): the browser's own speech (Web Speech API, offline on most phones, no files).
// Settings > Voice turns on the spoken rest timer ("Rest 2 minutes", "10 seconds", "3, 2, 1", "Go. Set 2 of 3 …").
// The Listen button on an exercise's How to reads the steps and cues aloud even when the setting is off (explicit tap).
// The language follows <html lang> (English now; block 21 sets tr/ar).
import { S } from "./store.js";

const SS = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
export const supported = !!SS;
export const enabled = () => !!SS && S.settings.voice === true;

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
export const stop = () => { try { SS?.cancel(); } catch {} };
export const speaking = () => !!SS && (SS.speaking || SS.pending);

/* iOS Safari only speaks after a first utterance inside a user gesture: say nothing on the first tap while Voice is on */
if (SS) addEventListener("pointerdown", function unlock() {
  if (!enabled()) return;
  removeEventListener("pointerdown", unlock, true);
  try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; SS.speak(u); } catch {}
}, true);

/* ---- phrases ---- */
const unitWord = (n) => (S.settings.unit === "lb" ? (+n === 1 ? "pound" : "pounds") : (+n === 1 ? "kilo" : "kilos"));
export function duration(sec) {
  sec = Math.round(sec); const m = Math.floor(sec / 60), s = sec % 60;
  if (!m) return `${s} seconds`;
  return `${m} minute${m === 1 ? "" : "s"}${s ? ` ${s} seconds` : ""}`;
}
/** nx = timer.js / train.js nextInfo(): { text, name, set, of, w, r, cue, newEx } */
export function nextPhrase(nx = {}) {
  if (!nx.name) return nx.text ? nx.text.replace(/^Next: /, "") : "";
  const load = nx.r ? `${nx.w && +nx.w ? `${nx.w} ${unitWord(nx.w)} for ` : ""}${nx.r} reps` : "";
  const set = nx.set ? `Set ${nx.set} of ${nx.of}` : "Warm-up set";
  return [nx.newEx ? `${nx.name}. ${set}` : set, load].filter(Boolean).join(". ") + "." + (nx.cue ? ` ${nx.cue}` : "");
}
