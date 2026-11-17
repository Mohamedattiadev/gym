// App shell: router, top bar, theme, shared exercise card, body map, Jeff's videos, boot.
import "./log.js"; // FE-6: first, so boot errors are caught too
import { S, save, loadStore, persist, flush, degraded } from "./store.js";
import { $, $$, esc, ic, openSheet, closeSheet, initSheet, toast, haptic, unlockAudio, indicate, selectIn, RM } from "./ui.js";
import { EX, searchEx, byTier, weeklyVolume, loadExercises, hasEquip, hurts, recovery } from "./data.js";
import { MUSCLES, MBY, bodySVG, muscleBox, zoomTo, FULL, HEAT, CREDIT } from "./body.js";
import * as T from "./train.js";
import { homeView } from "./home.js";
import { libraryView, exerciseView } from "./exercise.js";
import { meView, settingsView } from "./me.js";
import { timerView, initTimer, renderPill } from "./timer.js";
import { initMedia } from "./media.js";
import * as Sync from "./sync.js";

/* Opening screen: the first open of the day plays the whole animation (assemble + one rep, ~2.7 s);
   later opens only let the dumbbell snap together (~0.9 s) so the app stays quick. */
const SPLASH_T0 = performance.now();
const SPLASH_MIN = (() => {
  try { const d = new Date().toDateString(); if (localStorage.getItem("gym-splash-day") !== d) { localStorage.setItem("gym-splash-day", d); return 1200; } } catch { /* storage blocked */ }
  return 0; // 19e: hide as soon as the first view is ready
})();
function hideSplash() {
  const el = document.getElementById("splash");
  if (!el || el.classList.contains("out")) return;
  const wait = Math.max(0, SPLASH_MIN - (performance.now() - SPLASH_T0));
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 280); }, wait);
}

const view = $("#view");
export const MEDIA_CACHE = "gym-media-v1";

/* ================= router ================= */
const TAB_OF = { "": "home", lib: "lib", ex: "lib", body: "body", train: "train", workout: "train", session: "train", pick: "train", me: "me", videos: "home", settings: "settings", timer: "train", guide: "me", start: "train", standards: "me", nutrition: "me", plans: "train", plan: "train", warmup: "train" };
let lastDepth = 0;
// FE-2: every route() gets an id; async views check live(id) after each await so a late view never paints over the next page
let routeSeq = 0;
export const routeId = () => routeSeq;
export const live = (id) => id === routeSeq;
export function go(hash) { location.hash = hash; }
// FE-1: guard redirects and "leave this page for good" replace the history entry (no Back trap)
export function redirect(hash) { location.replace(hash); }
export const routeParts = () => (location.hash.slice(1) || "/").split("?")[0].split("/");
function route(quiet) {
  if (quiet !== true) quiet = false;
  routeSeq++;
  const [, a = "", b] = routeParts();
  const narrow = innerWidth < 768;
  const depth = ["ex", "workout", "session", "pick", "videos", "guide", "start", "standards", "nutrition", "plans", "plan", "warmup"].includes(a) || ((a === "timer" || a === "settings") && narrow) ? 1 : 0;
  const back = depth < lastDepth; lastDepth = depth;
  const keep = (a === "ex" || a === "lib") && innerWidth >= 1000 && !!$("#lpane"); // 2-pane library: only the detail pane changes
  view.onclick = null; view.oninput = null; view.onchange = null; if (!keep) view.className = "";
  document.body.classList.remove("has-cta", "scroll-down", "bm-open"); BM = null;
  const tab = TAB_OF[a] || "home";
  $$(".nav .navl").forEach((x) => x.classList.toggle("active", x.dataset.tab === tab || (narrow && tab === "settings" && x.dataset.tab === "me")));
  setTop({ back: depth > 0 });
  const fn = { "": homeView, lib: libraryView, ex: exerciseView, body: bodyMap, train: T.trainView, workout: T.workoutView, session: T.sessionView,
    pick: libraryView, me: meView, guide: G("guideView"), start: G("startView"), standards: G("standardsView"), nutrition: G("nutritionView"), plans: G("plansView"), plan: G("plansView"), warmup: G("warmupView", "warmup"), videos, settings: settingsView, timer: (x) => timerView(setTop, view, x) }[a] || homeView;
  try { fn(b); } catch (err) { console.error(err); view.innerHTML = `<div class="empty">Something went wrong.<br><small>${esc(err.message)}</small></div>`; }
  T.updateLiveDot(); fillIll(view);
  if (quiet) { hideSplash(); return; }
  if (!["pick", "lib", "ex"].includes(a) || (a === "ex" && innerWidth < 1000)) window.scrollTo(0, 0);
  document.documentElement.classList.toggle("back-nav", back);
  if (!keep) { view.classList.remove("page"); void view.offsetWidth; view.classList.add("page"); }
  requestAnimationFrame(() => indicate(view));
  hideSplash();
}
addEventListener("hashchange", () => { closeSheet(); route(); });
// SEC-4: no inline onerror (CSP) — thumbnails marked data-hide-broken hide themselves when the file is missing
addEventListener("error", (e) => { if (e.target?.hasAttribute?.("data-hide-broken")) e.target.style.visibility = "hidden"; }, true);
// BE-2: another tab saved -> show its data here; never re-render under the user's fingers or a hidden tab
let staleView = false;
const refresh = () => {
  if (!staleView) return;
  if (document.hidden || document.activeElement?.matches?.("input, textarea, select")) return;
  staleView = false; const y = scrollY; applyTheme(); route(true); renderPill(); scrollTo(0, y);
};
addEventListener("store:changed", () => { staleView = true; refresh(); });
document.addEventListener("visibilitychange", refresh);
document.addEventListener("focusout", () => setTimeout(refresh, 0));
export const rerender = () => route();
const G = (fn, mod = "guide") => (x) => { const rid = routeSeq; return import(`./${mod}.js`).then((m) => live(rid) && m[fn](x)).then(() => { if (!live(rid)) return; fillIll(view); requestAnimationFrame(() => indicate(view)); }).catch((err) => { console.error(err); if (live(rid)) view.innerHTML = `<div class="empty">Could not load.</div>`; }); };

/** Top bar. shy: the title only fades in once the page title has scrolled away (no duplicate titles). */
export function setTop({ title = "", back = false, right = "", shy = false } = {}) {
  $("#tTitle").textContent = title; document.title = title ? `${title} · Gym` : "Gym";
  const tb = $("#topbar");
  $("#tBack").hidden = !back; tb.classList.toggle("sub", back); tb.classList.toggle("shy", shy); tb.classList.toggle("empty", !title && !back && !right);
  $("#tRight").innerHTML = right;
}
let lastY = 0;
addEventListener("scroll", () => {
  $("#topbar").classList.toggle("scrolled", scrollY > 56);
  const dy = scrollY - lastY; if (Math.abs(dy) > 6) { document.body.classList.toggle("scroll-down", dy > 0 && scrollY > 120 && innerHeight + scrollY < document.documentElement.scrollHeight - 40); lastY = scrollY; }
}, { passive: true });
$("#tBack").onclick = () => (history.length > 1 ? history.back() : go("#/"));

/* ================= inline illustrations (follow theme via currentColor) ================= */
const illCache = {};
export async function fillIll(root = document) {
  for (const el of root.querySelectorAll("[data-ill]:empty")) {
    const n = el.dataset.ill;
    try { illCache[n] ??= await (await fetch(`illustrations/${n}.svg`)).text(); el.innerHTML = illCache[n]; } catch {}
  }
}

/* ================= theme ================= */
const lightMQ = matchMedia("(prefers-color-scheme: light)");
export function applyTheme() {
  const pref = S.settings.theme || "system";
  const t = pref === "system" ? (lightMQ.matches ? "light" : "dark") : pref;
  document.documentElement.dataset.theme = t;
  $$('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", t === "light" ? "#F2EFEC" : "#161413")); // app theme wins over OS scheme
  try { localStorage.setItem("gym-theme", JSON.stringify(pref)); } catch {}
}
lightMQ.addEventListener("change", applyTheme);

/* ================= keyboard shortcuts (desktop) ================= */
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); return palette(); }
  if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName) || $("#sheet").open) return;
  const map = { 1: "#/", 2: "#/lib", 3: "#/body", 4: "#/train", 5: "#/me", ",": "#/settings", t: "#/timer" };
  if (map[e.key]) { e.preventDefault(); go(map[e.key]); }
  else if (e.key === "/") { e.preventDefault(); if (!location.hash.startsWith("#/lib")) go("#/lib"); setTimeout(() => $("#q")?.focus(), 80); }
});

/** Cmd/Ctrl+K: jump to any page or exercise. ↑/↓ move, Enter opens, Esc closes. */
const PAGES = [["Home", "#/", "1"], ["Exercises", "#/lib", "2"], ["Body map", "#/body", "3"], ["Train", "#/train", "4"], ["Me", "#/me", "5"], ["Settings", "#/settings", ","],
  ["Rest timer", "#/timer", "T"], ["Plans", "#/plans", ""], ["Strength standards", "#/standards", ""], ["Nutrition", "#/nutrition", ""]];
function palette() {
  if ($("#sheet").open && $("#pq")) return $("#pq").focus();
  let sel = 0, items = [];
  openSheet(`<div class="search">${ic("search", "sm")}<input id="pq" type="search" placeholder="Go to page or exercise" autocomplete="off" enterkeyhint="go" aria-label="Go to page or exercise"></div>
    <div class="list-sep" id="pres" role="listbox" style="margin-top:10px"></div><p class="small muted" style="margin:10px 2px 0">↑ ↓ to move · Enter to open · Esc to close</p>`, (b) => {
    const inp = b.querySelector("#pq"), box = b.querySelector("#pres");
    const draw = () => {
      const q = inp.value.trim(), nq = q.toLowerCase();
      items = S.active && (!q || "current workout".includes(nq)) ? [{ t: "Current workout", h: "#/session" }] : [];
      items.push(...PAGES.filter(([t]) => !q || t.toLowerCase().includes(nq)).map(([t, h, k]) => ({ t, h, k })));
      if (q) items.push(...searchEx(q, EX).slice(0, 8).map((x) => ({ t: x.name, h: `#/ex/${x.slug}`, e: x })));
      sel = Math.min(sel, Math.max(0, items.length - 1));
      box.innerHTML = items.length ? items.map((it, i) => `<a class="lrow ${i === sel ? "on" : ""}" role="option" aria-selected="${i === sel}" href="${it.h}" data-i="${i}">${it.e ? `<img src="${esc(it.e.poster)}" alt="" loading="lazy">` : ""}
        <div class="grow"><div class="t">${esc(it.t)}</div>${it.e ? `<div class="s">${esc(it.e.group)} · ${esc(it.e.equipment.join(", "))}</div>` : ""}</div>${it.e ? tierBadge(it.e.tier) : it.k ? `<span class="kbd">${esc(it.k)}</span>` : ""}</a>`).join("")
        : `<div class="empty small">No matches</div>`;
      onImg(box);
    };
    const open = (i) => { const it = items[i]; if (!it) return; closeSheet(); go(it.h); };
    inp.oninput = () => { sel = 0; draw(); };
    inp.onkeydown = (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % Math.max(1, items.length); draw(); box.querySelector(".on")?.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter") { e.preventDefault(); open(sel); }
    };
    box.onclick = (e) => { const a = e.target.closest("a[data-i]"); if (!a) return; e.preventDefault(); open(+a.dataset.i); };
    draw(); setTimeout(() => inp.focus(), 30);
  });
}

/* ================= shared bits ================= */
export const tierBadge = (t, cls = "") => (t ? `<span class="tier ${t} ${cls}">${t}<small>tier</small></span>` : "");
export const TIER_INFO = [["S", "Top pick", "One of the best choices for this muscle."], ["A", "Great", "Excellent, use it freely."],
  ["B", "Good", "Solid, works fine."], ["C", "OK", "Works, but better options exist."]];
/** One-tap explanation of Jeff Nippard's S/A/B/C tiers. */
export function tierInfo() {
  openSheet(`<h3>What do the tiers mean?</h3><p class="muted small" style="margin:-6px 0 12px">Jeff Nippard ranks exercises by how well they build muscle (S best, C weakest).</p>
    <div class="list-sep">${TIER_INFO.map(([t, w, d]) => `<div class="lrow plain">${tierBadge(t)}<div class="grow"><div class="t">${w}</div><div class="s">${d}</div></div></div>`).join("")}</div>`);
}
const LVL = { beginner: [1, "Beginner"], intermediate: [2, "Intermediate"], advanced: [3, "Advanced"] };
export const levelBars = (l) => { const [n, w] = LVL[l] || [0, ""]; return n ? `<span class="lvl l${n}" title="${w}"><i></i><i></i><i></i></span>${w}` : ""; };
export const isFav = (s) => S.favorites.includes(s);
export function toggleFav(s) { S.favorites = isFav(s) ? S.favorites.filter((x) => x !== s) : [...S.favorites, s]; save("favorites"); Sync.autoPush(); haptic(); }
export const restText = (sec) => (sec >= 120 ? `${sec / 60} min` : `${sec}s`);
export function xcard(e, i = 0, sel = false, href = `#/ex/${e.slug}`) {
  return `<a class="xcard${sel ? " sel" : ""}" href="${href}" data-slug="${e.slug}">
    <div class="ph"><img data-fade loading="lazy" decoding="async" src="${e.poster}" alt="">${tierBadge(e.tier)}
      ${isFav(e.slug) ? `<span class="fav">${ic("heart")}</span>` : ""}</div>
    <div class="meta"><div class="name">${esc(e.name)}</div><div class="sub">${levelBars(e.level)}</div>
      <div class="tags">${[e.group, e.equipment[0], e.machine && !e.machine.toLowerCase().includes((e.equipment[0] || "~").toLowerCase()) ? e.machine : ""].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")}</div></div></a>`;
}
export function onImg(root = document) {
  $$("img[data-fade]", root).forEach((im) => {
    if (im.complete && im.naturalWidth) im.classList.add("ok");
    else { im.onload = () => im.classList.add("ok"); im.onerror = () => (im.style.visibility = "hidden"); }
  });
}

/* ================= install ================= */
let deferredPrompt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; if (location.hash.length < 3) route(); });
export const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export function installBanner() {
  if (standalone() || !S.sessions.length || Date.now() - (S.settings.installDismissed || 0) < 3 * 864e5) return "";
  if (!deferredPrompt && !isIOS()) return "";
  return `<div class="install" id="install"><img src="icons/icon-192.png" alt="">
    <div class="grow"><b>Install Gym</b><div class="dim small">Full screen, works offline.</div></div>
    <button class="btn primary sm" id="doInstall">Install</button><button class="iconbtn sm" id="noInstall" aria-label="Dismiss">${ic("close", "sm")}</button></div>`;
}
export function wireInstall() {
  const d = $("#doInstall"); if (d) d.onclick = installNow;
  const n = $("#noInstall"); if (n) n.onclick = () => { S.settings.installDismissed = Date.now(); save("settings"); $("#install").remove(); };
}
export function installNow() {
  if (deferredPrompt) {
    const dp = deferredPrompt; deferredPrompt = null;
    const fail = () => installNow(); // stale/used prompt -> show the menu steps instead
    try { Promise.resolve(dp.prompt()).then(() => dp.userChoice).then((c) => { if (c.outcome === "accepted") { toast("Installed"); persist(); } route(); }, fail); } catch { fail(); }
  } else if (isIOS()) {
    openSheet(`<h3>Add to Home Screen</h3><ol class="steps">
        <li><span>Tap the <b>Share</b> button at the bottom of Safari</span></li>
        <li><span>Choose <b>Add to Home Screen</b></span></li><li><span>Tap <b>Add</b>, then open Gym from your home screen</span></li></ol>
      <button class="btn primary block" style="margin-top:18px" id="gotIt">Got it</button>`, (el) => ($("#gotIt", el).onclick = closeSheet));
  } else {
    const desk = !matchMedia("(pointer: coarse)").matches;
    openSheet(`<h3>Install Gym</h3><ol class="steps">
        ${desk ? `<li><span>Click the <b>install icon</b> at the right of the address bar (Chrome / Edge)</span></li><li><span>Or open the browser menu <b>⋮</b> → <b>Install Gym</b></span></li>`
          : `<li><span>Open the Chrome menu <b>⋮</b> (top right)</span></li><li><span>Tap <b>Install app</b> or <b>Add to Home screen</b></span></li><li><span>Open Gym from your home screen</span></li>`}</ol>
      <p class="muted small" style="margin:14px 0 0">Just uninstalled it? Reload this page once, then try again. iPhone: Safari → <b>Share</b> → <b>Add to Home Screen</b>.</p>
      <button class="btn primary block" style="margin-top:18px" id="gotIt">Got it</button>`, (el) => ($("#gotIt", el).onclick = closeSheet));
  }
}
addEventListener("appinstalled", () => { deferredPrompt = null; S.settings.installDismissed = 0; save("settings"); if (location.hash.length < 3) route(); });

/* ================= BODY MAP ================= */
const bm = { view: "front", mode: "muscles" }; // mode: muscles | week | rec
const Lg = (o) => (o && typeof o === "object" ? o[S.settings.lang || "en"] || o.en || "" : o || "");
let HEADS = null;
const loadHeads = () => (HEADS ??= fetch("data/guide/heads.json").then((r) => r.json()).catch(() => ({ muscles: {} })));
export function exercisesFor(m) {
  return EX.filter((e) => (m.regions ? m.regions.includes(e.region) : m.id === "obliques" ? /oblique|twist|side bend|wood ?chop|bicycle/i.test(e.name) : m.groups.includes(e.group)) && hasEquip(e)).sort(byTier);
}
/** Which head of muscle `hs` an exercise mainly hits (regex on name, else the default head). */
export const headOf = (hs, e) => hs.find((h) => h.match && new RegExp(h.match, "i").test(e.name)) || hs.find((h) => h.default) || hs[0];
const heatOf = (m, vol) => HEAT[Math.min(4, Math.ceil(((vol[m.id] || 0) / (m.lm[1] ? m.lm[1] * .6 : 10)) * 4))];
const recText = (r) => (!r ? "Ready" : r.state === "r" ? `Trained <24h · ~${r.left}h to go` : r.left ? `Needs ~${r.left} more hours` : "Ready");
let BM = null; // live body-map controller (detail panel), null when the page is not shown
const wide = () => innerWidth >= 820;
addEventListener("popstate", () => { if (BM && location.hash.startsWith("#/body")) BM.sync(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && BM?.open && !$("#sheet").open) { e.preventDefault(); BM.close(); } });
function bodyMap() {
  setTop({ title: "Body map" });
  document.body.classList.remove("bm-open");
  const vol = weeklyVolume(), rec = recovery();
  const list = MUSCLES.filter((m) => m.view === bm.view || m.view === "both");
  const M = bm.mode;
  const hint = M === "week" ? `<div class="heat-legend">Sets vs target ${HEAT.map((c) => `<i style="background:${c}"></i>`).join("")}<span>none → optimal</span></div>`
    : M === "rec" ? `<div class="legend-dots"><span><i style="background:var(--rec-r)"></i>&lt;24h</span><span><i style="background:var(--rec-y)"></i>Recovering</span><span><i style="background:var(--rec-g)"></i>Ready</span></div>`
    : `<div class="dim small">Tap a muscle to see its parts and the best exercises.</div>`;
  const dot = (m) => (M === "week" ? heatOf(m, vol) : M === "rec" ? `var(--rec-${rec[m.id]?.state || "g"})` : "var(--accent)");
  const cnt = (m) => (M === "week" ? Math.round(vol[m.id] || 0) + " sets" : M === "rec" ? (rec[m.id]?.left ? `~${rec[m.id].left}h` : "Ready") : exercisesFor(m).length);
  view.innerHTML = `<div class="bm-split"><div class="bm-main">
      <div class="bm-top" id="bmtop"><div class="seg" id="side"><button data-v="front" class="${bm.view === "front" ? "on" : ""}">Front</button><button data-v="back" class="${bm.view === "back" ? "on" : ""}">Back</button></div>
        <div class="seg" id="mode">${[["muscles", "Muscles"], ["week", "This week"], ["rec", "Recovery"]].map(([k, l]) => `<button data-k="${k}" class="${M === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      ${hint}
      <div class="body-wrap" id="bwrap">${bodySVG(bm.view)}</div>
      <div class="dim tiny bm-credit"><button class="linkbtn" id="credit">Anatomy art credit</button></div></div>
    <div class="bm-side"><div id="bmlist"><div class="sec"><h2>Muscles</h2></div>
      <div class="mgrid stagger" id="legend">${list.map((m) => `<button data-m="${m.id}" style="--hm:${dot(m)}"><i></i>${m.name}<span class="c">${cnt(m)}</span></button>`).join("")}</div></div>
      <section class="mdet" id="mdet" hidden aria-label="Muscle details"></section></div></div>`;
  const svg = $(".body-svg"), det = $("#mdet"), dur = () => (RM.matches ? 1 : 520);
  $$("path.m", svg).forEach((p) => { const m = MBY[p.dataset.m]; if (!m) return;
    if (M === "week") p.style.setProperty("--hm", heatOf(m, vol)); else if (M === "rec") p.classList.add(rec[m.id]?.state || "g"); });
  const ctl = BM = { open: null, tab: "info", full: false };
  // phone: fit the body into the space above the sheet
  const fitSvg = (on) => {
    if (wide()) { svg.style.height = ""; return; }
    if (!on) { if (!svg.style.height) return; svg.style.height = svg._nat + "px"; setTimeout(() => { if (!ctl.open) svg.style.height = ""; }, 340); return; }
    if (!svg.style.height) { svg._nat = svg.getBoundingClientRect().height; svg.style.height = svg._nat + "px"; void svg.offsetHeight; }
    const top = $("#bmtop").getBoundingClientRect().top - ($("#topbar")?.offsetHeight || 56) - 6;
    if (Math.abs(top) > 2) scrollBy({ top, behavior: "auto" });
    const detTop = innerHeight - (parseFloat(getComputedStyle(det).bottom) || 0) - det.offsetHeight; // offsetHeight ignores the slide-in transform
    const avail = detTop - svg.getBoundingClientRect().top + (parseFloat(svg.style.height) - svg.getBoundingClientRect().height) - 8;
    svg.style.height = Math.max(150, Math.min(svg._nat, ctl.full ? svg._nat : avail)) + "px";
  };
  const sheetH = () => Math.round(innerHeight * .45);
  const fullH = () => innerHeight - ($("#topbar")?.offsetHeight || 56) - (innerWidth < 768 ? ($(".nav")?.offsetHeight || 64) : 0);
  const setH = (h, anim = true) => { det.style.transition = anim ? "" : "none"; det.style.height = h + "px"; };
  const zoom = (id) => {
    if (!$(`path.m[data-m="${id}"]`, svg)) return zoomTo(svg, FULL, dur());
    const [x, y, w, h] = muscleBox(svg, id); if (!(w > 0 && h > 0)) return; const pad = Math.max(w, h) * .35 + 6;
    let W = w + pad * 2, H = Math.max(h + pad * 2, W * 1.1);
    const hEl = parseFloat(svg.style.height) || svg.getBoundingClientRect().height, a = svg.getBoundingClientRect().width / hEl;
    if (a > 0 && isFinite(a)) { if (W / H < a) W = H * a; else H = W / a; } // fill the box the body actually has
    zoomTo(svg, [x + w / 2 - W / 2, y + h / 2 - H / 2, W, H], dur());
  };
  const show = (id) => {
    const m = MBY[id]; if (!m) return;
    const was = ctl.open; ctl.open = id;
    svg.classList.add("focus"); svg.classList.remove("hpick");
    $$("path.m", svg).forEach((p) => { p.classList.toggle("sel", p.dataset.m === id); p.classList.remove("hsel"); });
    $$("#legend button").forEach((b) => b.classList.toggle("on", b.dataset.m === id));
    document.body.classList.add("bm-open");
    det.hidden = false; $("#bmlist").hidden = wide();
    if (!was) { det.classList.remove("full"); ctl.full = false; if (!wide()) setH(sheetH(), false); else det.style.height = ""; }
    muscleDetail(m, vol, rec, svg, det, ctl);
    requestAnimationFrame(() => { fitSvg(true); zoom(id); });
    if (wide() && !was) scrollTo({ top: 0, behavior: RM.matches ? "auto" : "smooth" });
  };
  const hide = () => {
    if (!ctl.open) return; ctl.open = null;
    svg.classList.remove("focus", "hpick"); $$("path.m", svg).forEach((p) => p.classList.remove("sel", "hsel"));
    $$("#legend button").forEach((b) => b.classList.remove("on"));
    document.body.classList.remove("bm-open");
    det.hidden = true; det.innerHTML = ""; $("#bmlist").hidden = false;
    fitSvg(false); zoomTo(svg, FULL, dur());
  };
  ctl.sync = () => { const id = history.state?.bm; if (id && MBY[id]) show(id); else hide(); };
  ctl.close = () => { if (history.state?.bm) history.back(); else hide(); };
  const select = (id) => {
    haptic();
    if (history.state?.bm) history.replaceState({ ...history.state, bm: id }, ""); else history.pushState({ bm: id }, "");
    show(id);
  };
  ctl.select = select;
  // drag the phone sheet: half <-> full, down to close
  det.addEventListener("pointerdown", (e) => {
    if (wide() || !e.target.closest(".mgrab, .mhd") || e.target.closest("button:not(.mgrab)")) return;
    const y0 = e.clientY, h0 = det.offsetHeight; let h = h0, moved = false;
    const mv = (ev) => { const dy = ev.clientY - y0; if (Math.abs(dy) > 4) moved = true; h = Math.max(80, Math.min(fullH(), h0 - dy)); setH(h, false); };
    const up = () => {
      removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
      if (!moved) { ctl.full = !ctl.full; } else if (h < sheetH() * .6) { setH(h0); ctl.close(); return; } else ctl.full = h > (sheetH() + fullH()) / 2;
      det.classList.toggle("full", ctl.full); setH(ctl.full ? fullH() : sheetH()); setTimeout(() => fitSvg(true), 300);
    };
    addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  });
  svg.onclick = (e) => { const p = e.target.closest("path.m"); if (p) select(p.dataset.m); else if (ctl.open) ctl.close(); };
  $("#bwrap").onclick = (e) => { if (e.target.id === "bwrap" && ctl.open) ctl.close(); };
  $("#legend").onclick = (e) => { const b = e.target.closest("button"); if (b) select(b.dataset.m); };
  $("#credit").onclick = () => openSheet(`<h3>Anatomy art</h3><p class="muted small">${esc(CREDIT.title)} by ${esc(CREDIT.author)}.<br>License: <a href="${esc(CREDIT.licenseUrl)}" target="_blank" rel="noopener">${esc(CREDIT.license)}</a>. ${esc(CREDIT.note || "")}</p><p class="small"><a href="${esc(CREDIT.url)}" target="_blank" rel="noopener">Original source</a></p>`);
  $("#side").onclick = (e) => { const b = e.target.closest("button"); if (!b || b.dataset.v === bm.view) return; bm.view = b.dataset.v; haptic(); selectIn(b); setTimeout(() => { bodyMap(); $("#bwrap").classList.add("flip"); indicate(view); }, 160); };
  $("#mode").onclick = (e) => { const b = e.target.closest("button"); if (!b || b.dataset.k === bm.mode) return; bm.mode = b.dataset.k; haptic(); selectIn(b); setTimeout(() => { bodyMap(); indicate(view); }, 160); };
  if (history.state?.bm) ctl.sync(); // back from an exercise / Front-Back flip keeps the open muscle
}
async function muscleDetail(m, vol, rec, svg, el, ctl) {
  const hs = (await loadHeads()).muscles?.[m.id]?.heads || [];
  if (ctl.open !== m.id) return;
  const shown = new Set($$(`path.m[data-m="${m.id}"]`, svg).map((p) => p.dataset.h));
  const list = exercisesFor(m).filter((e) => !hurts(e));
  const done = Math.round(vol[m.id] || 0); const [mev, mav] = m.lm; const r = rec[m.id];
  let eq = "", picked = null;
  const pickHead = (hid) => { svg.classList.toggle("hpick", !!hid); $$(`path.m[data-m="${m.id}"]`, svg).forEach((p) => p.classList.toggle("hsel", p.dataset.h === hid)); };
  const exRow = (e) => `<a class="lrow" href="#/ex/${e.slug}"><img src="${e.poster}" alt="" loading="lazy"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.equipment.join(" · ") || e.group)}</div></div>${tierBadge(e.tier)}</a>`;
  const drawEx = () => {
    const l = eq ? list.filter((e) => e.equipment.includes(eq)) : list;
    let html;
    if (hs.length > 1) {
      const by = Object.fromEntries(hs.map((h) => [h.id, []])); l.forEach((e) => by[headOf(hs, e).id].push(e));
      html = hs.filter((h) => by[h.id].length).map((h) => `<div class="h4 hd-h" data-h="${h.id}">${esc(Lg(h.name))} <span class="dim tiny">${by[h.id].length}</span></div>${by[h.id].slice(0, 12).map(exRow).join("")}`).join("");
    } else html = l.slice(0, 40).map(exRow).join("");
    $("#mlist", el).innerHTML = html || `<div class="empty">No exercises</div>`;
  };
  const eqs = [...new Set(list.flatMap((e) => e.equipment))].slice(0, 8);
  const info = `<p class="muted small" style="margin:0 0 10px">${m.fn}</p>
    <div class="card soft pad row"><div class="grow"><div class="eyebrow">This week</div><b class="num" style="font-size:22px">${done}</b> <span class="dim">/ ${mev || 4}–${mav} sets</span></div>
      <div style="width:110px" class="progress"><div style="width:${Math.min(100, (done / (mav || 10)) * 100)}%"></div></div></div>
    <div class="row small" style="gap:8px;margin:10px 2px"><i class="rdot" style="background:var(--rec-${r?.state || "g"})"></i><span>${recText(r)}</span></div>
    ${hs.length > 1 ? `<div class="h4">Parts</div><div class="list-sep" id="hlist">${hs.map((h) => `<button class="lrow plain hd-row" data-h="${h.id}"><span class="hdot"></span><div class="grow"><div class="t">${esc(Lg(h.name))} <span class="dim tiny">${esc(h.latin || "")}</span></div><div class="s" style="color:var(--t2)">${esc(Lg(h.about))}</div>${shown.has(h.id) ? "" : `<div class="dim tiny">Deep or not visible from this side</div>`}</div></button>`).join("")}</div>` : ""}`;
  el.innerHTML = `<button class="mgrab" aria-label="Expand or collapse"></button>
    <div class="mhd"><button class="iconbtn" id="mback" aria-label="Back to muscles">${ic(wide() ? "back" : "x")}</button><h3>${m.name}</h3></div>
    <div class="mbd"><div class="ptabs fit" id="mtabs"><button data-k="info" class="${ctl.tab === "info" ? "on" : ""}">Info</button><button data-k="ex" class="${ctl.tab === "ex" ? "on" : ""}">Exercises <span class="dim tiny">${list.length}</span></button></div>
    <div id="mpanel" style="margin-top:12px"></div></div>`;
  const hover = matchMedia("(hover: hover)").matches;
  const panel = () => {
    const pn = $("#mpanel", el);
    if (ctl.tab === "info") {
      pn.innerHTML = info; const hl = $("#hlist", el); if (!hl) return;
      hl.onclick = (e) => { const b = e.target.closest("[data-h]"); if (!b) return; haptic(); picked = picked === b.dataset.h ? null : b.dataset.h; $$(".hd-row", el).forEach((x) => x.classList.toggle("on", x.dataset.h === picked)); pickHead(picked); };
      if (hover) { hl.onmouseover = (e) => { const b = e.target.closest("[data-h]"); if (b) pickHead(b.dataset.h); }; hl.onmouseleave = () => pickHead(picked); }
    } else {
      pn.innerHTML = `<div class="chips" id="meq"><button class="chip ${eq ? "" : "on"}" data-q="">All</button>${eqs.map((q) => `<button class="chip ${eq === q ? "on" : ""}" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div><div class="stack tight" id="mlist"></div>`;
      drawEx();
      $("#meq", el).onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; eq = b.dataset.q; $$("#meq .chip", el).forEach((c) => c.classList.toggle("on", c === b)); drawEx(); };
      $("#mlist", el).onclick = (e) => { const h = e.target.closest(".hd-h"); if (h) { picked = h.dataset.h; pickHead(picked); } };
      if (hover) { $("#mlist", el).onmouseover = (e) => { const h = e.target.closest(".hd-h"); if (h) pickHead(h.dataset.h); }; $("#mlist", el).onmouseleave = () => pickHead(picked); }
    }
  };
  panel();
  requestAnimationFrame(() => indicate(el));
  $("#mback", el).onclick = () => ctl.close();
  $("#mtabs", el).onclick = (e) => { const b = e.target.closest("button"); if (!b || b.dataset.k === ctl.tab) return; haptic(); ctl.tab = b.dataset.k; selectIn(b); panel(); };
}

/* ================= VIDEOS ================= */
export const JEFF_VID = { "fGm-ef-4PVk": "Best & Worst Chest Exercises", "jLvqKgW-_G8": "Best & Worst Back Exercises", "SgyUoY0IZ7A": "Best & Worst Shoulder Exercises",
  "GNO4OtYoCYk": "Best & Worst Biceps Exercises", "OpRMRhr0Ycc": "Best & Worst Triceps Exercises", "kIXcoivzGf8": "Best & Worst Quad Exercises",
  "3ryh7PNhz3E": "Best & Worst Glute Exercises", "S6rqpxVGKZ4": "The Only 25 Exercises You Need", "qpRGnTTcLpo": "7 Amazing S-Tier Exercises" };
const VIDEOS = [
  ["Tier lists", [["fGm-ef-4PVk", "Chest"], ["jLvqKgW-_G8", "Back"], ["SgyUoY0IZ7A", "Shoulders"], ["GNO4OtYoCYk", "Biceps"], ["OpRMRhr0Ycc", "Triceps"], ["kIXcoivzGf8", "Quads"], ["3ryh7PNhz3E", "Glutes"]]],
  ["Best of Jeff", [["S6rqpxVGKZ4", "The Only 25 Exercises You Ever Need"], ["qpRGnTTcLpo", "7 Amazing Exercises No One Does (All S-Tier)"], ["928aRhhPP8I", "The Upper Body Workout (1-Year Transformation)"],
    ["hRZ5MM6gmlE", "The Leg Workout (1-Year Transformation)"], ["MT9ZeE5JJsI", "7 Things That Helped My Shoulders Grow"], ["Tn-XvYG9x7w", "Get Abs In 60 Days"]]],
];
function videos() {
  setTop({ title: "Jeff Nippard", back: true });
  view.innerHTML = `${navigator.onLine ? "" : `<div class="notice warn">${ic("alert", "sm")}<span>You're offline — these videos need internet. Exercise demos still work.</span></div>`}
    ${VIDEOS.map(([h, vs]) => `<div class="sec"><h2>${h}</h2></div><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">
      ${vs.map(([id, t]) => `<button class="xcard" data-id="${id}" style="border:0;padding:0;text-align:start;color:inherit"><div class="ph" style="aspect-ratio:16/9"><img data-fade src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"></div>
        <div class="meta"><div class="name" style="min-height:0">${h === "Tier lists" ? `Best & worst ${t} exercises` : esc(t)}</div></div></button>`).join("")}</div>`).join("")}`;
  onImg(view);
  view.onclick = (e) => {
    const c = e.target.closest("[data-id]"); if (!c || c.querySelector("iframe")) return;
    if (!navigator.onLine) return toast("Needs internet");
    c.firstElementChild.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${c.dataset.id}?autoplay=1&playsinline=1&rel=0" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  };
}

/* ================= boot ================= */
const net = () => ($("#offline").hidden = navigator.onLine);
addEventListener("online", net); addEventListener("offline", net);
addEventListener("pointerdown", unlockAudio, { once: true });
(async () => {
  initSheet(); net();
  const exP = loadExercises(); // fetch data in parallel with IndexedDB
  await loadStore(); applyTheme();
  if (degraded) $(".app").insertAdjacentHTML("afterbegin", `<div class="notice warn storewarn" role="alert">${ic("alert", "sm")}<div class="grow"><b>Storage unavailable</b><div class="small">Changes may not be kept. Close the app fully and open it again.</div></div></div>`); try { Sync.initSync(); } catch (e) { console.warn(e); }
  try { await exP; } catch (e) { view.innerHTML = `<div class="empty">Couldn't load exercises.<br><small>${esc(e.message)}</small></div>`; hideSplash(); return; }
  initMedia(); initTimer();
  route(); renderPill();
  if ("serviceWorker" in navigator) {
    // FE-3/PERF-5: a new version waits; "Reload" activates it and reloads once, so code never mixes versions
    let reloading = false;
    const offer = (w) => w && navigator.serviceWorker.controller && toast("New version ready", 8000, { label: "Reload", fn: async () => { reloading = true; await flush().catch(() => {}); w.postMessage("skip"); } });
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloading) location.reload(); });
    navigator.serviceWorker.register("sw.js").then((reg) => {
      offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing; nw?.addEventListener("statechange", () => { if (nw.state === "installed") offer(nw); });
      });
    }).catch(() => {});
  }
  setTimeout(precachePosters, 4000);
})();
/* Owner: all posters (~21 MB) are saved once, quietly, after the app has settled — lists and pages then show
   pictures offline at once. Videos are saved the first time an exercise is opened (sw.js); Settings > Download
   all still saves every video. Skipped on Data Saver; resumes where it stopped (only missing files are fetched). */
async function precachePosters() {
  try {
    if (localStorage.getItem("gym-posters") === "1" || navigator.connection?.saveData || !navigator.onLine || !("caches" in self)) return;
    const cache = await caches.open(MEDIA_CACHE);
    const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
    const todo = [...new Set(EX.map((e) => e.poster).filter(Boolean))].map((x) => new URL(x, location.href)).filter((x) => !have.has(x.pathname));
    let i = 0, fail = 0, ok = 0;
    // the service worker stores each poster as it passes through (one download); stop early if the host has no media
    const worker = async () => { while (i < todo.length && (ok || i < 6)) { const x = todo[i++]; try { const r = await fetch(x.href); if (r.ok) { ok++; await r.arrayBuffer(); } else if (r.status !== 404) fail++; } catch { fail++; } } };
    await Promise.all([worker(), worker()]);
    if (!fail && ok && i >= todo.length) localStorage.setItem("gym-posters", "1");
  } catch {}
}
