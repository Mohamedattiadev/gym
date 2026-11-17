// Shared UI helpers: icons, sheet, toast, haptics, sound, confetti, formatting.
import { S } from "./store.js";

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

const P = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  body: '<circle cx="12" cy="4.5" r="2.2"/><path d="M5 9l7 1.5L19 9M12 10.5V15m0 0l-3 6m3-6l3 6"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', close: '<path d="M18 6L6 18M6 6l12 12"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', check: '<path d="M20 6L9 17l-5-5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>', flame: '<path d="M12 2s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5S9 11 11 11c0-4 1-9 1-9z"/>',
  swap: '<path d="M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4"/>', up: '<path d="M18 15l-6-6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  yt: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  calc: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h2M14 11h2M8 15h2M14 15h2M8 19h2M14 19h2"/>',
  fire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.4 1.5 1.5 2.8 2.5 2.8z"/>',
  download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/>', settings: '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.8l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.8v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', chev: '<path d="M9 6l6 6-6 6"/>',
  chart: '<path d="M3 3v18h18M7 15l4-4 3 3 6-6"/>', book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', share: '<path d="M12 3v13M7 8l5-5 5 5M5 21h14"/>', note: '<path d="M4 4h16v12l-4 4H4zM16 20v-4h4"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>', speed: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-5"/>', fs: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', fsx: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  reps: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>', okc: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>', scale: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8 9a5 5 0 0 1 8 0l-3 3"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>', arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>', bandage: '<rect x="2" y="8" width="20" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M10 12h.01M14 12h.01M12 10h.01M12 14h.01"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
};
export const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;

export const RM = matchMedia("(prefers-reduced-motion: reduce)");

/** Sliding indicator for every .seg / .ptabs inside root (positions it on the `.on` button). */
export function indicate(root = document) {
  for (const el of root.querySelectorAll(".seg, .ptabs")) {
    const on = el.querySelector(":scope > button.on"); const cls = el.classList.contains("seg") ? "seg-ind" : "ptabs-ind";
    let ind = el.querySelector(`:scope > .${cls}`);
    if (!on) { ind?.remove(); continue; }
    if (!el.offsetWidth) continue;
    if (!ind) { ind = document.createElement("span"); ind.className = cls; ind.style.transition = "none"; el.prepend(ind); el.classList.add("has-ind"); }
    ind.style.width = on.offsetWidth + "px"; ind.style.transform = `translateX(${on.offsetLeft}px)`;
    if (ind.style.transition) requestAnimationFrame(() => (ind.style.transition = ""));
  }
}
/** Mark button `b` as the selected one among its siblings and slide the indicator. */
export function selectIn(b) { if (!b) return; [...b.parentElement.children].forEach((x) => x.tagName === "BUTTON" && x.classList.toggle("on", x === b)); indicate(b.parentElement.parentElement || document); }
addEventListener("resize", () => indicate());

/* A11Y-1: selected state for assistive tech, derived from the `.on` class everywhere (one place, no call sites):
   .seg / chip buttons -> aria-pressed, .ptabs -> role=tab + aria-selected, .switch -> role=switch + aria-checked. */
function ariaOf(b) {
  if (b.tagName !== "BUTTON") return;
  const on = String(b.classList.contains("on")), p = b.parentElement;
  if (b.classList.contains("switch")) { b.setAttribute("role", "switch"); if (b.getAttribute("aria-checked") !== on) b.setAttribute("aria-checked", on); }
  else if (p?.classList.contains("ptabs")) { p.setAttribute("role", "tablist"); b.setAttribute("role", "tab"); if (b.getAttribute("aria-selected") !== on) b.setAttribute("aria-selected", on); }
  else if (p?.classList.contains("seg") || b.classList.contains("chip")) { if (b.getAttribute("aria-pressed") !== on) b.setAttribute("aria-pressed", on); }
}
const ARIA_SEL = ".switch, .ptabs > button, .seg > button, button.chip";
export function ariaSync(root = document) { if (root.matches?.(ARIA_SEL)) ariaOf(root); root.querySelectorAll?.(ARIA_SEL).forEach(ariaOf); }
new MutationObserver((ms) => {
  for (const m of ms) {
    if (m.type === "attributes") { if (m.target.matches(ARIA_SEL)) ariaOf(m.target); }
    else m.addedNodes.forEach((n) => n.nodeType === 1 && ariaSync(n));
  }
}).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });

/* ---- tiny SVG charts ---- */
/** Line chart; pts = numbers. opts: {h, area, dots} */
export function lineChart(pts, { h = 120, area = true, dots = true, cls = "chart" } = {}) {
  if (!pts.length) return "";
  const w = 300, min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1, n = Math.max(1, pts.length - 1);
  const xy = pts.map((v, i) => [pts.length === 1 ? w / 2 : (i / n) * w, h - 8 - ((v - min) / rng) * (h - 20)]);
  const d = xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="height:${h}px" aria-hidden="true">
    ${[.25, .5, .75].map((k) => `<line class="gd" x1="0" x2="${w}" y1="${h * k}" y2="${h * k}"/>`).join("")}
    ${area && pts.length > 1 ? `<path class="ar" d="${d} L${w} ${h} L0 ${h} Z"/>` : ""}<path class="ln" d="${d}"/>
    ${dots ? xy.map((p, i) => (i === xy.length - 1 || pts.length < 14) ? `<circle class="pt" cx="${p[0]}" cy="${p[1]}" r="${i === xy.length - 1 ? 3.5 : 2.2}" vector-effect="non-scaling-stroke"/>` : "").join("") : ""}</svg>`;
}
/** Vertical bars; items = [[label, value, isCurrent]] */
export const vBars = (items) => { const mx = Math.max(1, ...items.map((x) => x[1]));
  return `<div class="vbars">${items.map(([l, v, cur]) => `<div class="${cur ? "cur" : ""}" title="${esc(String(v))}"><i style="height:${Math.max(3, Math.round((v / mx) * 84))}px"></i><span>${esc(l)}</span></div>`).join("")}</div>`; };
export const delta = (a, b, fmt = (x) => x) => { const d = a - b; if (!b && !a) return `<span class="d same">–</span>`;
  return d > 0 ? `<span class="d up">${ic("arrowUp", "xs")}${fmt(d)}</span>` : d < 0 ? `<span class="d down">${ic("arrowDown", "xs")}${fmt(-d)}</span>` : `<span class="d same">same</span>`; };
export const fmtKg = (v) => (v >= 10000 ? (v / 1000).toFixed(1) + "t" : Math.round(v).toLocaleString());

/* ---- sheet ---- */
const sheet = () => $("#sheet");
/* FE-9: a sheet opened while the previous one is still closing (190 ms) or open cancels the pending close and
   settles the previous content's "close" listeners (ask() promises) at once, so they never leak onto the new one */
let closeT = 0;
export function openSheet(html, mount, { dlg = false, half = false } = {}) {
  const d = sheet();
  clearTimeout(closeT);
  if (d.open) d.dispatchEvent(new Event("close"));
  d.classList.toggle("dlg", dlg); d.classList.toggle("half", half);
  $("#sheetBody").innerHTML = html;
  d.classList.remove("closing");
  if (!d.open) d.showModal();
  mount && mount($("#sheetBody"));
  requestAnimationFrame(() => indicate($("#sheetBody")));
}
export function closeSheet() {
  const d = sheet(); if (!d.open) return;
  d.classList.add("closing");
  clearTimeout(closeT); closeT = setTimeout(() => { d.close(); d.classList.remove("closing"); }, 190);
}
export function initSheet() {
  const d = sheet();
  d.addEventListener("click", (e) => { if (e.target === d) closeSheet(); });
  d.addEventListener("cancel", (e) => { e.preventDefault(); closeSheet(); });
  // drag to dismiss
  let y0 = null, dy = 0;
  d.addEventListener("touchstart", (e) => { if ($("#sheetBody").scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  d.addEventListener("touchmove", (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); d.style.transform = `translateY(${dy}px)`; }, { passive: true });
  d.addEventListener("touchend", () => { d.style.transform = ""; if (dy > 110) closeSheet(); y0 = null; });
}

/* ---- in-app dialogs (replace confirm / prompt) ---- */
function dialogP(html, mount) {
  return new Promise((res) => {
    let val = null, done = false;
    const finish = (v) => { if (done) return; done = true; val = v; closeSheet(); };
    openSheet(html, (el) => mount(el, finish), { dlg: true });
    sheet().addEventListener("close", () => { done = true; res(val); }, { once: true });
  });
}
/** ask("Delete this?", {ok:"Delete", danger:true}) → Promise<boolean> */
export function ask(msg, { title = "", ok = "OK", cancel = "Cancel", danger = false } = {}) {
  return dialogP(`${title ? `<h3>${esc(title)}</h3>` : ""}<p style="margin:${title ? 0 : "4px"} 0 18px;font-size:16px">${esc(msg)}</p>
    <div class="row"><button class="btn grow" data-v="0">${esc(cancel)}</button><button class="btn grow ${danger ? "dark danger" : "primary"}" data-v="1">${esc(ok)}</button></div>`,
    (el, finish) => { el.onclick = (e) => { const b = e.target.closest("[data-v]"); if (b) finish(b.dataset.v === "1"); }; setTimeout(() => $('[data-v="1"]', el)?.focus(), 60); }).then((v) => !!v);
}
/** askText("Workout name", {value:"Push Day"}) → Promise<string|null> */
export function askText(title, { value = "", ok = "Save", placeholder = "", type = "text", inputmode = "" } = {}) {
  return dialogP(`<h3>${esc(title)}</h3><form id="dlgF"><input class="input" id="dlgI" type="${type}" ${inputmode ? `inputmode="${inputmode}"` : ""} value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" enterkeyhint="done">
    <div class="row" style="margin-top:16px"><button type="button" class="btn grow" data-x>Cancel</button><button class="btn primary grow">${esc(ok)}</button></div></form>`,
    (el, finish) => {
      const i = $("#dlgI", el); setTimeout(() => { i.focus(); i.select(); }, 80);
      $("#dlgF", el).onsubmit = (e) => { e.preventDefault(); const v = i.value.trim(); if (v) finish(v); else i.focus(); };
      $("[data-x]", el).onclick = () => finish(null);
    });
}

/* ---- toast ---- */
export function toast(msg, ms = 1900, action) {
  $$(".toast").forEach((t) => t.remove());
  const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status");
  const sp = document.createElement("span"); sp.textContent = msg; t.appendChild(sp);
  let off = () => {};
  const rm = () => { t.remove(); off(); };
  if (action) {
    const b = document.createElement("button"); b.textContent = action.label; b.onclick = () => { rm(); action.fn(); }; t.appendChild(b); ms = Math.max(ms, 5000);
    // UT-3: an action toast can be closed and never sits over a box the user is typing in
    const x = document.createElement("button"); x.className = "tx"; x.setAttribute("aria-label", "Close"); x.innerHTML = ic("close", "sm"); x.onclick = rm; t.appendChild(x);
    const onF = (e) => { if (e.target.matches?.("input, textarea, select")) rm(); };
    document.addEventListener("focusin", onF); off = () => document.removeEventListener("focusin", onF);
  }
  document.body.appendChild(t); setTimeout(rm, ms);
}

/* ---- haptics + sound ---- */
const PAT = { tap: 8, success: [10, 40, 14], warn: [30, 60, 30], rest: [90, 60, 90, 60, 180] };
export function haptic(kind = "tap") {
  if (!S.settings.haptics) return;
  try { navigator.vibrate && navigator.vibrate(PAT[kind] || 8); } catch {}
}
let actx;
export function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch {} }
export function beep(seq = [[880, .12]], vol = .18) {
  if (!S.settings.sound || !actx) return;
  let t = actx.currentTime;
  for (const [f, d] of seq) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.start(t); o.stop(t + d + .02); t += d + .06;
  }
}

/* ---- confetti (PRs) ---- */
export function confetti() {
  if (RM.matches) return;
  const c = document.createElement("canvas"); c.className = "confetti";
  const dpr = devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.appendChild(c); const x = c.getContext("2d"); x.scale(dpr, dpr);
  const cols = ["#D93A31", "#F08A5D", "#E9B949", "#F4F0EC", "#94690B", "#C2352D"];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: Math.random() * -14 - 4,
    s: Math.random() * 6 + 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[(Math.random() * cols.length) | 0] }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) { p.vy += .38; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.globalAlpha = Math.max(0, 1 - f / 120); x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); }
    if (++f < 130) requestAnimationFrame(tick); else c.remove();
  })();
}

/* ---- format ---- */
export const fmtDur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000)), h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
};
export const fmtDate = (t, o = { weekday: "short", month: "short", day: "numeric" }) => new Date(t).toLocaleDateString(undefined, o);
export const ring = (pct, r = 16) => {
  const c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 ${r * 2 + 6} ${r * 2 + 6}"><circle class="bg" cx="${r + 3}" cy="${r + 3}" r="${r}"/>
    <circle class="fg" cx="${r + 3}" cy="${r + 3}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg>`;
};
export function onImg(root = document) {
  $$("img[data-fade]", root).forEach((im) => {
    if (im.complete && im.naturalWidth) im.classList.add("ok");
    else { im.onload = () => im.classList.add("ok"); im.onerror = () => im.remove(); }
  });
}
