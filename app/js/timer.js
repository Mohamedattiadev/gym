// One global timer (stopwatch | countdown | intervals) shared by the Timer page, rest timer and the floating pill.
import { $, BP, esc, ic, haptic, beep, toast, fmtDur } from "./ui.js";
import { S } from "./store.js";
import * as V from "./voice.js";

const KEY = "gym-timer";
const now = () => Date.now();
/* state: { mode, running, t0, acc, laps[], total, end, left, label, next, rest, work, rounds, round, phase } */
export let T = load();
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.mode) return s; } catch {} return { mode: null }; }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch {} }
const listeners = new Set();
export const onTick = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
let offView = null; // FE-15: the timer page's tick listener

let iv = null, lastBeep = -1;
function loop() { clearInterval(iv); if (T.mode && T.running) iv = setInterval(tick, 200); tick(); }
function tick() {
  if (T.mode === "countdown" && T.running) {
    const left = T.end - now(); const sec = Math.ceil(left / 1000);
    count(sec, T.total, .08, .12);
    if (left <= 0) { const { kind, nx } = T; stop(); haptic("rest"); beep([[880, .15], [880, .15], [1320, .3]]);
      const msg = kind === "rest" ? (nx?.name ? `Go: ${nx.name}${nx.set ? ` · set ${nx.set}` : ""}` : "Rest over — next set") : "Time is up";
      toast(msg); say(kind === "rest" ? `Rest over. ${msg}` : msg);
      later(kind === "rest" ? V.P.go(nx || {}) : V.P.timeUp());
      dispatchEvent(new CustomEvent("gym:timerend", { detail: { kind, nx } })); return; }
  }
  if (T.mode === "interval" && T.running) {
    let left = T.end - now();
    if (left <= 0) {
      if (T.phase === "work" && T.rest) { T.phase = "rest"; T.end = now() + T.rest * 1000; beep([[440, .2]]); haptic("warn"); later(V.P.ivRest()); }
      else if (T.round >= T.rounds) { stop(); beep([[880, .15], [1320, .4]]); haptic("rest"); toast("Intervals done"); later(V.P.ivDone()); return; }
      else { T.round++; T.phase = "work"; T.end = now() + T.work * 1000; beep([[880, .2]]); haptic("success"); later(V.P.ivWork(T.round, T.rounds)); }
      persist(); left = T.end - now();
    }
    count(Math.ceil(left / 1000), (T.phase === "work" ? T.work : T.rest) * 1000, .06, .1);
  }
  listeners.forEach((fn) => fn(view()));
  renderOverlay(); renderPill();
}

/* last seconds: a beep at 3, 2, 1 — with Voice on it says "10 seconds" (long timers) and "3", "2", "1" instead */
function count(sec, total, d, vol) {
  if (sec === lastBeep || sec <= 0) return;
  if (sec === 10 && total >= 20000 && V.enabled()) { lastBeep = sec; V.say(V.P.count(10)); }
  else if (sec <= 3) { lastBeep = sec; if (V.enabled()) V.say(V.P.count(sec)); else beep([[660, d]], vol); }
}
/* speak after the end beep has played */
const later = (parts) => V.enabled() && setTimeout(() => V.say(parts), 700);

/* ---- derived view of the timer ---- */
export function view() {
  const v = { mode: T.mode, running: !!T.running, label: T.label || "", next: T.next || "" };
  if (T.mode === "stopwatch") { v.ms = (T.acc || 0) + (T.running ? now() - T.t0 : 0); v.text = fmtMs(v.ms); v.pct = 1; }
  else if (T.mode === "countdown") { v.ms = Math.max(0, T.running ? T.end - now() : T.left); v.text = fmtDur(v.ms + 999); v.pct = T.total ? v.ms / T.total : 0; }
  else if (T.mode === "interval") {
    const ms = Math.max(0, T.running ? T.end - now() : T.left); const len = (T.phase === "work" ? T.work : T.rest) * 1000;
    v.ms = ms; v.text = fmtDur(ms + 999); v.pct = len ? ms / len : 0; v.phase = T.phase; v.round = T.round; v.rounds = T.rounds;
  }
  return v;
}
export const fmtMs = (ms) => { const s = Math.floor(ms / 1000); return `${fmtDur(s * 1000)}.${Math.floor((ms % 1000) / 100)}`; };

/* ---- actions ---- */
export function startStopwatch() { T = { mode: "stopwatch", running: true, t0: now(), acc: 0, laps: [] }; persist(); loop(); }
/* nx (rest only) = { text, slug, name, set, of, w, r } — the next set, shown on the overlay and the lock screen */
export function startCountdown(sec, { kind = "timer", label = "", next = "", nx = null } = {}) {
  T = { mode: "countdown", kind, running: true, total: sec * 1000, end: now() + sec * 1000, left: sec * 1000, label, next, nx }; lastBeep = -1; persist(); loop();
  if (kind === "rest" && V.enabled()) { V.say(V.P.rest(sec)); V.preload([...V.P.count(10), ...V.P.count(3), ...V.P.count(2), ...V.P.count(1), ...V.P.go(nx || {})]); }
}
export function startIntervals(work, rest, rounds, label = "") {
  T = { mode: "interval", running: true, work, rest, rounds, round: 1, phase: "work", end: now() + work * 1000, left: work * 1000, label }; lastBeep = -1;
  beep([[880, .2]]); persist(); loop(); later(V.P.ivWork(1, rounds));
}
export function pause() {
  if (!T.running) return;
  if (T.mode === "stopwatch") T.acc += now() - T.t0; else T.left = Math.max(0, T.end - now());
  T.running = false; persist(); loop();
}
export function resume() {
  if (T.running || !T.mode) return;
  if (T.mode === "stopwatch") T.t0 = now(); else T.end = now() + T.left;
  T.running = true; persist(); loop();
}
export function toggle() { T.running ? pause() : resume(); haptic(); }
export function lap() { if (T.mode !== "stopwatch") return; T.laps.unshift(view().ms); persist(); tick(); }
export function add(sec) {
  if (T.mode !== "countdown") return;
  if (T.running) T.end += sec * 1000; else T.left = Math.max(0, T.left + sec * 1000);
  T.total = Math.max(1000, T.total + sec * 1000); persist(); tick();
}
export function stop() { V.stop(); T = { mode: null }; persist(); clearInterval(iv); listeners.forEach((fn) => fn(view())); renderOverlay(); renderPill(); }
export const isRest = () => T.mode === "countdown" && T.kind === "rest";
export const active = () => !!T.mode;

/* ---- floating pill (hidden on the Timer page) ---- */
const C = 2 * Math.PI * 11;
export function renderPill() {
  let p = $("#tpill");
  const onTimerPage = location.hash.startsWith("#/timer");
  const show = !(!T.mode || onTimerPage || $("#rov")); document.body.classList.toggle("has-pill", show); // UT-7: room below the page so the pill covers nothing
  if (!show) { p?.remove(); return; }
  const v = view();
  if (!p) {
    p = document.createElement("div"); p.id = "tpill"; p.className = "tpill"; p.setAttribute("role", "timer");
    p.innerHTML = `<a href="#/timer" class="row" style="gap:6px" aria-label="Open timer"><svg class="ring" viewBox="0 0 28 28"><circle class="bg" cx="14" cy="14" r="11"/><circle class="fg" cx="14" cy="14" r="11" stroke-dasharray="${C}"/></svg><span class="tm num"></span></a>
      <button data-p="toggle" aria-label="Pause or resume"></button><button data-p="plus" hidden>+30</button><button data-p="stop" aria-label="Stop">${ic("close", "xs")}</button>`;
    p.onclick = (e) => { const b = e.target.closest("[data-p]"); if (!b) return; haptic();
      if (b.dataset.p === "toggle") toggle(); if (b.dataset.p === "plus") add(30); if (b.dataset.p === "stop") stop(); };
    document.body.appendChild(p);
  }
  p.querySelector(".tm").textContent = v.mode === "interval" ? `${v.phase === "work" ? "Work" : "Rest"} ${v.text}` : isRest() ? `Rest ${v.text}` : v.text; // say what it is: a rest, not a set to do
  p.setAttribute("aria-label", isRest() ? "Rest timer" : "Timer");
  p.querySelector(".fg").setAttribute("stroke-dashoffset", C * (1 - (v.mode === "stopwatch" ? 1 : v.pct)));
  const tg = p.querySelector('[data-p="toggle"]'); const icn = v.running ? "pause" : "play";
  if (tg.dataset.i !== icn) { tg.dataset.i = icn; tg.innerHTML = ic(icn, "xs"); }
  p.querySelector('[data-p="plus"]').hidden = v.mode !== "countdown";
}
addEventListener("hashchange", () => { renderOverlay(); renderPill(); });

/* ---- full-screen rest overlay: big ring, the next set, −15 / +30 / Skip; minimise = back to the pill ---- */
const RR = 46, RC = 2 * Math.PI * RR;
/* A11Y-2: assertive live region (rest end), focus + inert while the overlay is open */
function say(t) {
  let l = $("#srLive"); if (!l) { l = document.createElement("div"); l.id = "srLive"; l.className = "sr"; l.setAttribute("aria-live", "assertive"); document.body.appendChild(l); }
  l.textContent = ""; setTimeout(() => (l.textContent = t), 60);
}
let rovFocus = null;
const setInert = (on) => { const a = $(".app"); if (a) a.inert = on; };
function renderOverlay() {
  let o = $("#rov");
  const want = isRest() && !T.min && !location.hash.startsWith("#/timer");
  if (!want) {
    if (o) { o.remove(); document.removeEventListener("keydown", onKey); setInert(false); if (rovFocus?.isConnected) rovFocus.focus({ preventScroll: true }); rovFocus = null; }
    return;
  }
  const v = view(), nx = T.nx || {};
  if (!o) {
    o = document.createElement("div"); o.id = "rov"; o.className = "rov"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Rest");
    const u = S.settings.unit, load = nx.r ? `${nx.w ? `${nx.w} ${u} × ` : ""}${nx.r} reps` : "";
    o.innerHTML = `<div class="rov-in"><div class="rov-top"><span class="lbl">Rest</span><button class="iconbtn" data-r="min" aria-label="Minimise">${ic("down")}</button></div>
      <div class="ringwrap"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${RR}"/><circle class="fill" cx="50" cy="50" r="${RR}" stroke-dasharray="${RC}"/></svg>
        <button class="big num" data-r="toggle"></button><div class="sub2 rov-st"></div></div>
      ${nx.name ? `<div class="rov-next">${nx.slug ? `<img src="media/poster/${esc(nx.slug)}.webp" alt="">` : ""}<div class="grow"><div class="dim tiny">Next</div><b>${esc(nx.name)}</b>
        <div class="muted small">${[nx.set ? `Set ${nx.set}${nx.of ? ` of ${nx.of}` : ""}` : "", load].filter(Boolean).join(" · ")}</div></div></div>`
        : nx.text ? `<div class="rov-next"><b class="grow">${esc(nx.text)}</b></div>` : ""}
      <div class="rov-btns"><button class="btn lg" data-r="m15">−15 s</button><button class="btn lg" data-r="p30">+30 s</button></div>
      <button class="btn lg primary block" data-r="skip">Skip rest</button></div>`;
    o.onclick = (e) => { const b = e.target.closest("[data-r]"); if (!b) return; haptic(); const k = b.dataset.r;
      if (k === "min") { T.min = true; persist(); tick(); } if (k === "toggle") toggle(); if (k === "m15") add(-15); if (k === "p30") add(30); if (k === "skip") stop(); };
    rovFocus = document.activeElement; document.body.appendChild(o); document.addEventListener("keydown", onKey);
    setInert(true); $('[data-r="skip"]', o).focus({ preventScroll: true, focusVisible: false });
  }
  const big = $(".big", o); big.textContent = v.text;
  // spoken name: remaining time in 15 s steps (not every second) + what a tap does
  const step = `${Math.ceil(v.ms / 15000) * 15 || 0}`, lab = `${v.text} rest left, tap to ${v.running ? "pause" : "resume"}`;
  if (big.dataset.s !== step + v.running) { big.dataset.s = step + v.running; big.setAttribute("aria-label", lab); }
  $(".fill", o).setAttribute("stroke-dashoffset", RC * (1 - v.pct));
  $(".rov-st", o).textContent = v.running ? "" : "Paused — tap to resume";
}
function onKey(e) { if (e.key === "Escape" && isRest()) { T.min = true; persist(); tick(); } }

/* ---- Timer page ---- */
const PRESETS = [30, 60, 90, 120, 180, 300];
const IPRESETS = [["Tabata", 20, 10, 8], ["EMOM", 60, 0, 10], ["40 / 20", 40, 20, 10], ["30 / 30", 30, 30, 12]];
let tab = null, cdSet = { m: 1, s: 30 }, iSet = { w: 40, r: 20, n: 10 };
export function timerView(setTop, root, arg) {
  setTop({ title: "Timer", back: innerWidth < BP.tablet });
  if (arg && ["stopwatch", "countdown", "interval"].includes(arg)) tab = arg;
  if (T.mode) tab = T.mode; tab ||= "countdown";
  const R = 46, CC = 2 * Math.PI * R;
  const draw = () => {
    const v = view(); const mine = T.mode === tab;
    let body = "";
    if (tab === "stopwatch") {
      body = `<div class="ringwrap"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${R}"/></svg><div class="big num" id="tmT">${mine ? v.text : "0:00.0"}</div></div>
        <div class="row" style="justify-content:center;gap:10px">${mine
          ? `<button class="btn lg" data-a="${v.running ? "lap" : "reset"}" style="min-width:120px">${v.running ? "Lap" : "Reset"}</button><button class="btn lg primary" data-a="toggle" style="min-width:120px">${v.running ? "Pause" : "Resume"}</button>`
          : `<button class="btn lg primary" data-a="sw" style="min-width:200px">${ic("play", "sm")} Start</button>`}</div>
        <div class="laps">${mine ? (T.laps || []).map((l, i, a) => `<div><span class="dim">Lap ${a.length - i}</span><b class="num">${fmtMs(l - (a[i + 1] || 0))}</b><span class="num dim">${fmtMs(l)}</span></div>`).join("") : ""}</div>`;
    } else if (tab === "countdown") {
      body = mine ? `<div class="ringwrap"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${R}"/><circle class="fill" id="tmF" cx="50" cy="50" r="${R}" stroke-dasharray="${CC}" stroke-dashoffset="${CC * (1 - v.pct)}"/></svg>
          ${T.kind === "rest" ? `<div class="lbl">Rest</div>` : ""}<div class="big num" id="tmT">${v.text}</div>${v.next ? `<div class="sub2">${esc(v.next)}</div>` : ""}</div>
          <div class="row" style="justify-content:center;gap:8px"><button class="btn lg" data-a="m15">−15s</button><button class="btn lg primary" data-a="toggle" style="min-width:120px">${v.running ? "Pause" : "Resume"}</button><button class="btn lg" data-a="p15">+15s</button></div>
          <button class="btn block ghost mt-8" data-a="stop">${T.kind === "rest" ? "Skip rest" : "Stop"}</button>`
        : `<div class="mmss" style="margin:22px 0 16px"><input id="cdM" inputmode="numeric" value="${cdSet.m}" aria-label="Minutes"><b>:</b><input id="cdS" inputmode="numeric" value="${String(cdSet.s).padStart(2, "0")}" aria-label="Seconds"></div>
          <div class="presets" style="grid-template-columns:repeat(3,1fr)">${PRESETS.map((s) => `<button data-pre="${s}">${fmtDur(s * 1000)}</button>`).join("")}</div>
          <button class="btn lg primary block mt-16" data-a="cd">${ic("play", "sm")} Start</button>`;
    } else {
      body = mine ? `<div class="ringwrap"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${R}"/><circle class="fill" id="tmF" cx="50" cy="50" r="${R}" stroke-dasharray="${CC}" stroke-dashoffset="${CC * (1 - v.pct)}" style="stroke:${v.phase === "work" ? "var(--accent)" : "var(--info)"}"/></svg>
          <div class="lbl" style="color:${v.phase === "work" ? "var(--accent-text)" : "var(--info)"}">${v.phase === "work" ? "Work" : "Rest"}</div><div class="big num" id="tmT">${v.text}</div><div class="sub2">Round ${v.round} / ${v.rounds}</div></div>
          <div class="row" style="justify-content:center;gap:10px"><button class="btn lg" data-a="stop" style="min-width:120px">Stop</button><button class="btn lg primary" data-a="toggle" style="min-width:120px">${v.running ? "Pause" : "Resume"}</button></div>`
        : `<div class="chips mt-14">${IPRESETS.map(([n, w, r, k]) => `<button class="chip ${iSet.w === w && iSet.r === r && iSet.n === k ? "on" : ""}" data-ip="${w},${r},${k}">${n}</button>`).join("")}</div>
          <div class="kv" style="margin:8px 0 16px">${[["w", "Work (s)"], ["r", "Rest (s)"], ["n", "Rounds"]].map(([k, l]) => `<div><input class="input num" data-i="${k}" inputmode="numeric" value="${iSet[k]}" style="text-align:center;font-size:22px;font-weight:740;height:52px"><span>${l}</span></div>`).join("")}</div>
          <div class="dim small" style="text-align:center;margin-bottom:12px">Total ${fmtDur((iSet.w + iSet.r) * iSet.n * 1000)}</div>
          <button class="btn lg primary block" data-a="int">${ic("play", "sm")} Start</button>`;
    }
    root.innerHTML = `<div class="seg block" id="tmTabs" style="margin:4px 0 6px">${[["stopwatch", "Stopwatch"], ["countdown", "Countdown"], ["interval", "Intervals"]].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="tab-panel" style="max-width:460px;margin:0 auto">${body}</div>`;
  };
  draw();
  let last = { running: T.running, mode: T.mode, phase: T.phase };
  offView?.(); /* FE-15: one listener, however often #/timer is opened */
  const off = offView = onTick((v) => {
    if (!root.isConnected || !location.hash.startsWith("#/timer")) return off();
    if (v.running !== last.running || T.mode !== last.mode || T.phase !== last.phase) { last = { running: T.running, mode: T.mode, phase: T.phase }; draw(); return; }
    const t = $("#tmT", root); if (t && T.mode === tab) t.textContent = v.text;
    const f = $("#tmF", root); if (f) f.setAttribute("stroke-dashoffset", CC * (1 - v.pct));
  });
  root.oninput = (e) => {
    const i = e.target;
    if (i.id === "cdM") cdSet.m = Math.max(0, Math.min(99, parseInt(i.value) || 0));
    if (i.id === "cdS") cdSet.s = Math.max(0, Math.min(59, parseInt(i.value) || 0));
    if (i.dataset.i) { iSet[i.dataset.i] = Math.max(i.dataset.i === "r" ? 0 : 1, parseInt(i.value) || 0); const d = root.querySelector(".dim.small"); if (d) d.textContent = `Total ${fmtDur((iSet.w + iSet.r) * iSet.n * 1000)}`; }
  };
  root.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return; haptic();
    if (b.dataset.t) { if (T.mode && T.mode !== b.dataset.t) { toast("Stop the running timer first"); return; } tab = b.dataset.t; draw(); return; }
    if (b.dataset.pre) { const s = +b.dataset.pre; cdSet = { m: Math.floor(s / 60), s: s % 60 }; startCountdown(s); draw(); return; }
    if (b.dataset.ip) { const [w, r, n] = b.dataset.ip.split(",").map(Number); iSet = { w, r, n }; draw(); return; }
    const a = b.dataset.a;
    if (a === "sw") startStopwatch();
    if (a === "cd") { const s = cdSet.m * 60 + cdSet.s; if (s > 0) startCountdown(s); }
    if (a === "int") startIntervals(iSet.w, iSet.r, iSet.n);
    if (a === "toggle") toggle();
    if (a === "lap") lap();
    if (a === "reset" || a === "stop") stop();
    if (a === "m15") add(-15); if (a === "p15") add(15);
    draw();
  };
}

export function initTimer() { loop(); }
