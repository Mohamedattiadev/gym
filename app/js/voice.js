// Voice (PLAN §9b, option A): the browser's own speech (Web Speech API, offline on most phones, no files).
// Settings > Voice turns on the spoken rest timer ("Rest 2 minutes", "10 seconds", "3, 2, 1", "Go. Set 2 of 3 …").
// The Listen button on an exercise's How to reads the steps and cues aloud even when the setting is off (explicit tap).
// The language follows <html lang> (English now; block 21 sets tr/ar).
import { S } from "./store.js";

const SS = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
export const supported = !!SS;
export const enabled = () => !!SS && S.settings.voice === true;

let voice = null;
function pick() {
  const lang = (document.documentElement.lang || "en").slice(0, 2).toLowerCase();
  const vs = SS.getVoices().filter((v) => (v.lang || "").toLowerCase().replace("_", "-").startsWith(lang));
  voice = vs.find((v) => v.localService && v.default) || vs.find((v) => v.localService) || vs.find((v) => v.default) || vs[0] || null;
}
if (SS) { try { pick(); SS.addEventListener?.("voiceschanged", pick); } catch {} }

/** speak one or more lines; a new call cuts off what is being said. force = speak even when the setting is off */
export function speak(lines, { force = false, onend } = {}) {
  if (!SS || (!force && !enabled())) return false;
  const list = [].concat(lines).map((t) => String(t || "").trim()).filter(Boolean);
  SS.cancel();
  if (!list.length) return false;
  if (!voice) pick();
  list.forEach((t, i) => {
    const u = new SpeechSynthesisUtterance(t);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = document.documentElement.lang || "en";
    if (i === list.length - 1 && onend) { u.onend = onend; u.onerror = onend; }
    SS.speak(u);
  });
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
