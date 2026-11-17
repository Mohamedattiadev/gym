// Lock-screen rest timer. While a workout runs, a silent looping audio track keeps a Media Session alive:
// the lock screen / notification player shows "Rest 1:23" + the next set, with pause/play, skip (next track),
// +30 s (seek forward) and −15 s (seek back). Rest end = beep + vibration (timer.js) + a notification via the
// service worker when the app is in the background. Limits (iOS suspends locked web apps) are explained in Settings.
import { S, save } from "./store.js";
import { BY } from "./data.js";
import { toast, fmtDur } from "./ui.js";
import * as Tm from "./timer.js";

const MS = "mediaSession" in navigator ? navigator.mediaSession : null;
let audio = null, on = false, iv = null, nx = null, art = "", lastTitle = "";
export const enabled = () => !!MS && S.settings.lockTimer !== false;

/* 10 s of 8 kHz silence as a WAV blob (Chrome only shows the media notification for clips >= 5 s) */
function silentWav(sec = 10, rate = 8000) {
  const n = sec * rate, b = new ArrayBuffer(44 + n), v = new DataView(b);
  const w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
  new Uint8Array(b, 44).fill(128);
  return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
}

function engage() { // must run inside a user gesture (the "set done" tap)
  if (on || !enabled() || !S.active) return;
  audio ||= Object.assign(new Audio(silentWav()), { loop: true, preload: "auto" });
  audio.setAttribute("playsinline", "");
  audio.play().then(() => { on = true; handlers(); update(); clearInterval(iv); iv = setInterval(update, 1000); askNotify(); }).catch(() => {});
}
export function disengage() {
  on = false; clearInterval(iv); audio?.pause(); lastTitle = ""; art = "";
  if (MS) { MS.metadata = null; MS.playbackState = "none"; for (const a of ["play", "pause", "nexttrack", "seekforward", "seekbackward", "stop"]) try { MS.setActionHandler(a, null); } catch {} }
}

function handlers() {
  const h = {
    play: () => { audio.play(); if (Tm.isRest()) Tm.resume(); update(); },
    pause: () => { if (Tm.isRest()) { Tm.pause(); update(); } else audio.play(); }, // between rests nothing to pause
    nexttrack: () => { if (Tm.isRest()) Tm.stop(); update(); },
    seekforward: () => { if (Tm.isRest()) Tm.add(30); update(); },
    seekbackward: () => { if (Tm.isRest()) Tm.add(-15); update(); },
    stop: disengage,
  };
  for (const [a, fn] of Object.entries(h)) try { MS.setActionHandler(a, fn); } catch {}
}

const setLine = (x) => x?.name ? `${x.name}${x.set ? ` · set ${x.set} of ${x.of}` : ""}${x.r ? ` · ${x.w ? `${x.w} ${S.settings.unit} × ` : ""}${x.r}` : ""}` : x?.text || "";
function update() {
  if (!on) return;
  if (!S.active || !enabled()) return disengage();
  const rest = Tm.isRest(), v = Tm.view();
  if (rest && Tm.T.nx) nx = Tm.T.nx;
  const title = rest ? `Rest ${v.text}${v.running ? "" : " (paused)"}` : nx?.name ? `Go: ${nx.name}${nx.set ? ` set ${nx.set}` : ""}` : `Workout ${fmtDur(Date.now() - S.active.startedAt)}`;
  const sub = rest ? (nx?.name ? `Next: ${setLine(nx)}` : nx?.text || "") : `${S.active.name || "Workout"} · ${fmtDur(Date.now() - S.active.startedAt)}`;
  const pic = new URL(nx?.slug && BY[nx.slug] ? BY[nx.slug].poster : "icons/icon-512.png", location.href).href;
  if (pic !== art || !MS.metadata) { art = pic; MS.metadata = new MediaMetadata({ title, artist: sub, album: "Gym", artwork: [{ src: pic, sizes: "512x512" }] }); }
  else if (title !== lastTitle || MS.metadata.artist !== sub) { MS.metadata.title = title; MS.metadata.artist = sub; }
  lastTitle = title;
  MS.playbackState = rest && !v.running ? "paused" : "playing";
  try {
    if (rest && Tm.T.total) { const d = Tm.T.total / 1000; MS.setPositionState({ duration: d, playbackRate: 1, position: Math.min(d, Math.max(0, d - v.ms / 1000)) }); }
    else MS.setPositionState(); // clears the bar between rests
  } catch {}
}

/* one-time, in-app (no browser dialog until the user taps "Allow") */
function askNotify() {
  if (!("Notification" in window) || Notification.permission !== "default" || S.settings.notifAsked) return;
  S.settings.notifAsked = true; save("settings");
  setTimeout(() => toast("Notify you when rest ends?", 6000, { label: "Allow", fn: () => Notification.requestPermission().catch(() => {}) }), 1200);
}
async function notifyEnd({ kind, nx: x }) {
  if (kind !== "rest" || !document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.getRegistration?.(); if (!reg) return;
  const title = x?.name ? `Go: ${x.name}${x.set ? ` set ${x.set}` : ""}` : "Rest over — next set";
  reg.showNotification(title, { body: x?.r ? `${x.w ? `${x.w} ${S.settings.unit} × ` : ""}${x.r} reps` : "", tag: "gym-rest", renotify: true,
    icon: "icons/icon-192.png", badge: "icons/icon-192.png", vibrate: [90, 60, 90, 60, 180], silent: false }).catch(() => {});
}

export function initMedia() {
  if (MS) Tm.onTick(() => { if (Tm.isRest() && S.active && !on && Tm.T.running) engage(); else if (on) update(); });
  addEventListener("gym:timerend", (e) => { notifyEnd(e.detail); if (on) update(); });
}
