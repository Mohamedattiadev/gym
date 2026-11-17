// App shell: router, top bar, theme, shared exercise card, body map, Jeff's videos, boot.
import { S, save, loadStore, persist } from "./store.js";
import { $, $$, esc, ic, openSheet, closeSheet, initSheet, toast, haptic, unlockAudio, indicate, selectIn, RM } from "./ui.js";
import { EX, byTier, weeklyVolume, loadExercises, hasEquip, hurts } from "./data.js";
import { MUSCLES, MBY, bodySVG, muscleBox, zoomTo, FULL, HEAT } from "./body.js";
import * as T from "./train.js";
import { homeView } from "./home.js";
import { libraryView, exerciseView } from "./exercise.js";
import { meView, settingsView } from "./me.js";
import { timerView, initTimer, renderPill } from "./timer.js";
import * as Sync from "./sync.js";

/* Opening screen: the first open of the day plays the whole animation (assemble + one rep, ~2.7 s);
   later opens only let the dumbbell snap together (~0.9 s) so the app stays quick. */
const SPLASH_T0 = performance.now();
const SPLASH_MIN = (() => {
  try { const d = new Date().toDateString(); if (localStorage.getItem("gym-splash-day") !== d) { localStorage.setItem("gym-splash-day", d); return 2700; } } catch { /* storage blocked */ }
  return 900;
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
const TAB_OF = { "": "home", lib: "lib", ex: "lib", body: "body", train: "train", workout: "train", session: "train", pick: "train", me: "me", videos: "home", settings: "settings", timer: "train" };
let lastDepth = 0;
export function go(hash) { location.hash = hash; }
export const routeParts = () => (location.hash.slice(1) || "/").split("?")[0].split("/");
function route() {
  const [, a = "", b] = routeParts();
  const narrow = innerWidth < 768;
  const depth = ["ex", "workout", "session", "pick", "videos"].includes(a) || ((a === "timer" || a === "settings") && narrow) ? 1 : 0;
  const back = depth < lastDepth; lastDepth = depth;
  const keep = (a === "ex" || a === "lib") && innerWidth >= 1000 && !!$("#lpane"); // 2-pane library: only the detail pane changes
  view.onclick = null; view.oninput = null; view.onchange = null; if (!keep) view.className = "";
  document.body.classList.remove("has-cta");
  const tab = TAB_OF[a] || "home";
  $$(".nav .navl").forEach((x) => x.classList.toggle("active", x.dataset.tab === tab || (narrow && tab === "settings" && x.dataset.tab === "me")));
  setTop({ back: depth > 0 });
  const fn = { "": homeView, lib: libraryView, ex: exerciseView, body: bodyMap, train: T.trainView, workout: T.workoutView, session: T.sessionView,
    pick: libraryView, me: meView, videos, settings: settingsView, timer: (x) => timerView(setTop, view, x) }[a] || homeView;
  try { fn(b); } catch (err) { console.error(err); view.innerHTML = `<div class="empty">Something went wrong.<br><small>${esc(err.message)}</small></div>`; }
  T.updateLiveDot(); fillIll(view);
  if (!["pick", "lib", "ex"].includes(a) || (a === "ex" && innerWidth < 1000)) window.scrollTo(0, 0);
  document.documentElement.classList.toggle("back-nav", back);
  if (!keep) { view.classList.remove("page"); void view.offsetWidth; view.classList.add("page"); }
  requestAnimationFrame(() => indicate(view));
  hideSplash();
}
addEventListener("hashchange", () => { closeSheet(); route(); });
export const rerender = () => route();

/** Top bar. shy: the title only fades in once the page title has scrolled away (no duplicate titles). */
export function setTop({ title = "", back = false, right = "", shy = false } = {}) {
  $("#tTitle").textContent = title; document.title = title ? `${title} · Gym` : "Gym";
  const tb = $("#topbar");
  $("#tBack").hidden = !back; tb.classList.toggle("sub", back); tb.classList.toggle("shy", shy); tb.classList.toggle("empty", !title && !back && !right);
  $("#tRight").innerHTML = right;
}
addEventListener("scroll", () => $("#topbar").classList.toggle("scrolled", scrollY > 56), { passive: true });
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
  const pref = S.settings.theme || "light";
  const t = pref === "system" ? (lightMQ.matches ? "light" : "dark") : pref;
  document.documentElement.dataset.theme = t;
  $$('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", t === "light" ? "#F2EFEC" : "#161413")); // app theme wins over OS scheme
  try { localStorage.setItem("gym-theme", JSON.stringify(pref)); } catch {}
}
lightMQ.addEventListener("change", applyTheme);

/* ================= keyboard shortcuts (desktop) ================= */
addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName) || $("#sheet").open) return;
  const map = { 1: "#/", 2: "#/lib", 3: "#/body", 4: "#/train", 5: "#/me", ",": "#/settings", t: "#/timer" };
  if (map[e.key]) { e.preventDefault(); go(map[e.key]); }
  else if (e.key === "/") { e.preventDefault(); if (!location.hash.startsWith("#/lib")) go("#/lib"); setTimeout(() => $("#q")?.focus(), 80); }
});

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
  if (standalone() || Date.now() - (S.settings.installDismissed || 0) < 3 * 864e5) return "";
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
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((c) => { if (c.outcome === "accepted") { toast("Installed"); persist(); } deferredPrompt = null; route(); });
  } else if (isIOS()) {
    openSheet(`<h3>Add to Home Screen</h3><ol class="steps">
        <li><span>Tap the <b>Share</b> button at the bottom of Safari</span></li>
        <li><span>Choose <b>Add to Home Screen</b></span></li><li><span>Tap <b>Add</b>, then open Gym from your home screen</span></li></ol>
      <button class="btn primary block" style="margin-top:18px" id="gotIt">Got it</button>`, (el) => ($("#gotIt", el).onclick = closeSheet));
  } else toast("Use your browser menu → Install app");
}

/* ================= BODY MAP ================= */
const bm = { view: "front", heat: false };
export function exercisesFor(m) {
  return EX.filter((e) => (m.regions ? m.regions.includes(e.region) : m.id === "obliques" ? /oblique|twist|side bend|wood ?chop|bicycle/i.test(e.name) : m.groups.includes(e.group)) && hasEquip(e)).sort(byTier);
}
const heatOf = (m, vol) => HEAT[Math.min(4, Math.ceil(((vol[m.id] || 0) / (m.lm[1] ? m.lm[1] * .6 : 10)) * 4))];
function bodyMap() {
  setTop({ title: "Body map" });
  const vol = weeklyVolume();
  const list = MUSCLES.filter((m) => m.view === bm.view || m.view === "both");
  view.innerHTML = `<div class="bm-split"><div>
      <div class="bm-top"><div class="seg" id="side"><button data-v="front" class="${bm.view === "front" ? "on" : ""}">Front</button><button data-v="back" class="${bm.view === "back" ? "on" : ""}">Back</button></div>
        <div class="seg" id="mode"><button data-h="0" class="${bm.heat ? "" : "on"}">Muscles</button><button data-h="1" class="${bm.heat ? "on" : ""}">This week</button></div></div>
      ${bm.heat ? `<div class="heat-legend">Sets vs target ${HEAT.map((c) => `<i style="background:${c}"></i>`).join("")}<span>none → optimal</span></div>` : `<div class="dim small">Tap a muscle to see the best exercises.</div>`}
      <div class="body-wrap" id="bwrap">${bodySVG(bm.view)}</div></div>
    <div><div class="sec"><h2>Muscles</h2></div>
      <div class="mgrid stagger" id="legend">${list.map((m) => `<button data-m="${m.id}" style="--hm:${bm.heat ? heatOf(m, vol) : "var(--accent)"}"><i></i>${m.name}<span class="c">${bm.heat ? Math.round(vol[m.id] || 0) + " sets" : exercisesFor(m).length}</span></button>`).join("")}</div></div></div>`;
  const svg = $(".body-svg");
  if (bm.heat) $$("path.m", svg).forEach((p) => { const m = MBY[p.dataset.m]; if (m) p.style.setProperty("--hm", heatOf(m, vol)); });
  const select = (id) => {
    const m = MBY[id]; if (!m) return; haptic();
    svg.classList.add("focus"); $$("path.m", svg).forEach((p) => p.classList.toggle("sel", p.dataset.m === id));
    const [x, y, w, h] = muscleBox(svg, id); const pad = Math.max(w, h) * .55 + 14;
    const W = w + pad * 2, H = Math.max(h + pad * 2, W * 1.15);
    zoomTo(svg, [x + w / 2 - W / 2, y + h / 2 - H / 2, W, H], RM.matches ? 1 : 520);
    muscleSheet(m, vol);
    $("#sheet").addEventListener("close", () => { svg.classList.remove("focus"); $$("path.m", svg).forEach((p) => p.classList.remove("sel")); zoomTo(svg, FULL, RM.matches ? 1 : 520); }, { once: true });
  };
  svg.onclick = (e) => { const p = e.target.closest("path.m"); if (p) select(p.dataset.m); };
  $("#legend").onclick = (e) => { const b = e.target.closest("button"); if (b) select(b.dataset.m); };
  $("#side").onclick = (e) => { const b = e.target.closest("button"); if (!b || b.dataset.v === bm.view) return; bm.view = b.dataset.v; haptic(); selectIn(b); setTimeout(() => { bodyMap(); $("#bwrap").classList.add("flip"); indicate(view); }, 160); };
  $("#mode").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; bm.heat = b.dataset.h === "1"; haptic(); selectIn(b); setTimeout(() => { bodyMap(); indicate(view); }, 160); };
}
function muscleSheet(m, vol) {
  const list = exercisesFor(m).filter((e) => !hurts(e));
  const done = Math.round(vol[m.id] || 0); const [mev, mav] = m.lm;
  let eq = "";
  const draw = (el) => {
    const l = eq ? list.filter((e) => e.equipment.includes(eq)) : list;
    $("#mlist", el).innerHTML = l.slice(0, 40).map((e) => `<a class="lrow" href="#/ex/${e.slug}"><img src="${e.poster}" alt="" loading="lazy">
      <div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.equipment.join(" · ") || e.group)}</div></div>${tierBadge(e.tier)}</a>`).join("") || `<div class="empty">No exercises</div>`;
  };
  const eqs = [...new Set(list.flatMap((e) => e.equipment))].slice(0, 8);
  openSheet(`<h3>${m.name}</h3><p class="muted small" style="margin:-6px 0 12px">${m.fn}</p>
    <div class="card soft pad row"><div class="grow"><div class="eyebrow">This week</div><b class="num" style="font-size:22px">${done}</b> <span class="dim">/ ${mev || 4}–${mav} sets</span></div>
      <div style="width:110px" class="progress"><div style="width:${Math.min(100, (done / (mav || 10)) * 100)}%"></div></div></div>
    <div class="chips" id="meq" style="margin-top:8px"><button class="chip on" data-q="">All</button>${eqs.map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
    <div class="stack tight" id="mlist"></div>`, (el) => {
    draw(el);
    $("#meq", el).onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; eq = b.dataset.q; $$("#meq .chip", el).forEach((c) => c.classList.toggle("on", c === b)); draw(el); };
    $("#mlist", el).onclick = (e) => { if (e.target.closest("a")) closeSheet(); };
  });
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
  await loadStore(); applyTheme(); try { Sync.initSync(); } catch (e) { console.warn(e); }
  try { await exP; } catch (e) { view.innerHTML = `<div class="empty">Couldn't load exercises.<br><small>${esc(e.message)}</small></div>`; hideSplash(); return; }
  initTimer();
  route(); renderPill();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing; nw?.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) toast("Update ready — reopen the app", 4000); });
      });
    }).catch(() => {});
  }
})();
