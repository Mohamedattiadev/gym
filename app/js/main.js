// App shell: splash, router, scroll/top bar, keyboard shortcuts, boot, poster precache. Pages live in their own modules.
import "./log.js"; // FE-6: first, so boot errors are caught too
import { S, loadStore, flush, degraded } from "./store.js";
import { $, BP, $$, esc, ic, closeSheet, initSheet, toast, unlockAudio, indicate } from "./ui.js";
import { EX, loadExercises, buildIndex, FAM_LANG } from "./data.js";
import { bodyMap, leaveBodyMap } from "./bodymap.js";
import { videos } from "./videos.js";
import { nextRoute, routeId, live, go, routeParts, onRoute, setTop } from "./nav.js";
import { MEDIA_CACHE, fillIll, applyTheme } from "./components.js";
import "./install.js";
import * as T from "./train.js";
import { homeView } from "./home.js";
import { timerView, initTimer, renderPill } from "./timer.js";
import { initMedia } from "./media.js";
import { setLang, t } from "./i18n.js";

/* Opening screen: the first open of the day plays the whole animation (assemble + one rep, ~2.7 s);
   later opens only let the dumbbell snap together (~0.9 s) so the app stays quick. */
const SPLASH_T0 = performance.now();
const SPLASH_MIN = (() => {
  // PERF-10: the full splash animation only on the very first launch; afterwards hide as soon as the first view is ready
  try { if (!localStorage.getItem("gym-splash-seen")) { localStorage.setItem("gym-splash-seen", "1"); return 1200; } } catch { /* storage blocked */ }
  return 0;
})();
function hideSplash() {
  const el = document.getElementById("splash");
  if (!el || el.classList.contains("out")) return;
  const wait = Math.max(0, SPLASH_MIN - (performance.now() - SPLASH_T0));
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 280); }, wait);
}

const view = $("#view");

/* ================= router ================= */
const TAB_OF = { "": "home", lib: "lib", ex: "lib", body: "body", train: "train", workout: "train", session: "train", pick: "train", me: "me", videos: "home", settings: "me", timer: "train", guide: "me", start: "train", profile: "me", standards: "me", nutrition: "me", plans: "train", plan: "train", warmup: "train", privacy: "me" };
let lastDepth = 0;
function route(quiet) {
  if (quiet !== true) quiet = false;
  nextRoute();
  const [, a = "", b] = routeParts();
  const narrow = innerWidth < BP.tablet;
  const depth = ["ex", "workout", "session", "pick", "videos", "guide", "start", "profile", "standards", "nutrition", "plans", "plan", "warmup", "privacy"].includes(a) || (a === "timer" && narrow) ? 1 : 0;
  const back = depth < lastDepth; lastDepth = depth;
  const keep = (a === "ex" || a === "lib") && innerWidth >= BP.wide && !!$("#lpane"); // 2-pane library: only the detail pane changes
  view.onclick = null; view.oninput = null; view.onchange = null; if (!keep) view.className = "";
  document.body.classList.remove("has-cta", "scroll-down", "bm-open"); leaveBodyMap();
  const tab = TAB_OF[a] || "home";
  $$(".nav .navl").forEach((x) => x.classList.toggle("active", x.dataset.tab === tab));
  setTop({ back: depth > 0 });
  const fn = { "": homeView, lib: Z("libraryView", "exercise"), ex: Z("exerciseView", "exercise"), body: bodyMap, train: T.trainView, workout: T.workoutView, session: T.sessionView,
    pick: Z("libraryView", "exercise"), me: Z("meView", "me"), guide: G("guideView"), start: G("startView"), profile: G("profileView"), standards: G("standardsView"), nutrition: G("nutritionView"), plans: G("plansView"), plan: G("plansView"), warmup: G("warmupView", "warmup"), videos, settings: Z("settingsView", "me"), privacy: Z("privacyView", "me"), timer: (x) => timerView(setTop, view, x) }[a] || homeView;
  try { fn(b); } catch (err) { console.error(err); view.innerHTML = `<div class="empty">Something went wrong.<br><small>${esc(err.message)}</small></div>`; }
  T.updateLiveDot(); fillIll(view);
  $("#tTitle").toggleAttribute("aria-hidden", !!view.querySelector("h1")); // A11Y-14 one h1 per page for screen readers
  if (quiet) { hideSplash(); return; }
  if (!["pick", "lib", "ex"].includes(a) || (a === "ex" && innerWidth < BP.wide)) window.scrollTo(0, 0);
  document.documentElement.classList.toggle("back-nav", back);
  if (!keep) { view.classList.remove("page"); void view.offsetWidth; view.classList.add("page"); }
  requestAnimationFrame(() => indicate(view));
  // A11Y-9: move focus to the new page heading (screen readers announce it; :focus-visible keeps pointer users ring-free)
  if (!keep && routeFocus && !view.contains(document.activeElement)) { const h = $("#view h1") || $("#view h2") || $("#tTitle"); if (h) { if (!h.hasAttribute("tabindex")) h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  routeFocus = true;
  hideSplash();
}
let routeFocus = false; // not on the first load (focus starts at the top anyway)
addEventListener("hashchange", () => { closeSheet(); route(); });
// A11Y-18 skip link: the hash is the router, so focus the content instead of following "#view"
$(".skip").onclick = (e) => { e.preventDefault(); $("#view").focus(); };
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
onRoute(route);
/* PERF-7: rarely-first pages load their module on demand. Z() renders synchronously once the module is in
   (boot awaits it for a deep link, idle time loads the rest), so scroll restore and heading focus keep working. */
const MOD = {};
const need = (mod) => import(`./${mod}.js`).then((m) => (MOD[mod] = m));
const LAZY = { lib: "exercise", ex: "exercise", pick: "exercise", me: "me", settings: "me" };
const Z = (fn, mod) => (x) => (MOD[mod] ? MOD[mod][fn](x) : G(fn, mod)(x));
const G = (fn, mod = "guide") => (x) => { const rid = routeId(); return need(mod).then((m) => live(rid) && m[fn](x)).then(() => { if (!live(rid)) return; fillIll(view); requestAnimationFrame(() => indicate(view)); }).catch((err) => { console.error(err); if (live(rid)) view.innerHTML = `<div class="empty">Could not load.</div>`; }); };

let lastY = 0, scrollQ = 0;
// PERF-2: one check per frame; scrollHeight (forces layout) is read only while scrolling down
addEventListener("scroll", () => {
  if (scrollQ) return;
  scrollQ = requestAnimationFrame(() => {
    scrollQ = 0; $("#topbar").classList.toggle("scrolled", scrollY > 56);
    const dy = scrollY - lastY; if (Math.abs(dy) > 6) { document.body.classList.toggle("scroll-down", dy > 0 && scrollY > 120 && innerHeight + scrollY < document.documentElement.scrollHeight - 40); lastY = scrollY; }
  });
}, { passive: true });
$("#tBack").onclick = () => (history.length > 1 ? history.back() : go("#/"));

/* ================= keyboard shortcuts (desktop) ================= */
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); return import("./palette.js").then((p) => p.palette()); }
  if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(e.target.tagName) || $("#sheet").open) return;
  const map = { 1: "#/", 2: "#/lib", 3: "#/body", 4: "#/train", 5: "#/me", ",": "#/settings", t: "#/timer" };
  if (map[e.key]) { e.preventDefault(); go(map[e.key]); }
  else if (e.key === "/") { e.preventDefault(); if (!location.hash.startsWith("#/lib")) go("#/lib"); setTimeout(() => $("#q")?.focus(), 80); }
});


/* ================= boot ================= */
const net = () => ($("#offline").hidden = navigator.onLine);
addEventListener("online", net); addEventListener("offline", net);
addEventListener("pointerdown", unlockAudio, { once: true });
(async () => {
  initSheet(); net();
  const exP = loadExercises(); // fetch data in parallel with IndexedDB
  await loadStore(); applyTheme();
  const lg = await setLang(S.settings.lang); try { localStorage.setItem("gym-lang", lg); } catch {}
  if (lg !== "en") import("./voice.js").then((m) => m.loadTable(lg)).catch(() => {}); // spoken phrases in that language
  // Q11: back from "Sign in with Google" (?code=…): the route is restored at once, sign-in + first sync run in the background
  const back = /[?&](code|error)=/.test(location.search) ? await import("./cloud.js").then((m) => { const r = m.pendingReturn(); return r && { done: m.finishSignIn(r) }; }).catch(() => null) : null; // {done} = not awaited here
  if (degraded) $(".app").insertAdjacentHTML("afterbegin", `<div class="notice warn storewarn" role="alert">${ic("alert", "sm")}<div class="grow"><b>${t("Storage unavailable")}</b><div class="small">${t("Changes may not be kept. Close the app fully and open it again.")}</div></div></div>`);
  try { await exP; if (FAM_LANG !== lg) await loadExercises(); } catch (e) { view.innerHTML = `<div class="empty">${t("Couldn't load exercises.")}<br><small>${esc(e.message)}</small></div>`; hideSplash(); return; }
  initMedia(); initTimer();
  // 26b: first open (nothing set up yet, landing on Home) -> onboarding; deep links are never hijacked
  if (!S.profile?.onboarded && !S.settings.onboarded && !S.sessions.length && !S.workouts.length && /^#?\/?$/.test(location.hash)) history.replaceState(null, "", "#/start");
  const first = LAZY[routeParts()[1] || ""]; if (first) await need(first).catch(() => {});
  route(); renderPill();
  import("./sync.js").then((m) => m.initSync()).catch((e) => console.warn(e));
  if (back) back.done.then((r) => { toast(r.ok ? (r.restored ? t("Signed in. Your data is back.") : t("Signed in. Backup is on.")) : r.error, 4000); route(); });
  else if (S.cloud?.refresh) import("./cloud.js").then((m) => m.initCloud()).catch((e) => console.warn(e));
  const idle = self.requestIdleCallback || ((f) => setTimeout(f, 300));
  idle(() => { buildIndex(); need("exercise").then(() => need("me")).catch(() => {}); });
  if ("serviceWorker" in navigator) {
    // FE-3/PERF-5: a new version waits; "Reload" activates it and reloads once, so code never mixes versions
    let reloading = false;
    const offer = (w) => w && navigator.serviceWorker.controller && toast(t("New version ready"), 8000, { label: t("Reload"), fn: async () => { reloading = true; await flush().catch(() => {}); w.postMessage("skip"); } });
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
    if (localStorage.getItem("gym-posters") === "webp" || navigator.connection?.saveData || !navigator.onLine || !("caches" in self)) return;
    const cache = await caches.open(MEDIA_CACHE);
    const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
    const todo = [...new Set(EX.map((e) => e.poster).filter(Boolean))].map((x) => new URL(x, location.href)).filter((x) => !have.has(x.pathname));
    let i = 0, fail = 0, ok = 0;
    // the service worker stores each poster as it passes through (one download); stop early if the host has no media
    const worker = async () => { while (i < todo.length && (ok || i < 6)) { const x = todo[i++]; try { const r = await fetch(x.href); if (r.ok) { ok++; await r.arrayBuffer(); } else if (r.status !== 404) fail++; } catch { fail++; } } };
    await Promise.all([worker(), worker()]);
    if (!fail && ok && i >= todo.length) localStorage.setItem("gym-posters", "webp");
  } catch {}
}
