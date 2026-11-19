/* Small shared view pieces (FE-12: moved out of main.js so views never import main.js). */
import { S, save, tomb } from "./store.js";
import { $$, esc, ic, openSheet, haptic, indicate, selectIn } from "./ui.js";
import { t, N, lang } from "./i18n.js";

export const MEDIA_CACHE = "gym-media-v1";
export const RECENT_CACHE = "gym-media-recent"; // PERF-6: videos saved while watching (sw.js caps it)

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

/* ================= printable guide PDFs (Q8c, app/guides, built by tools/guide/build.mjs) ================= */
export const GUIDE_LEVELS = ["beginner", "intermediate", "advanced"];
export const appTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
export function guideUrl(kind, level, theme) {
  const lv = GUIDE_LEVELS.includes(level) ? level : "beginner";
  const lg = lang();
  const th = theme === "dark" || theme === "light" ? theme : appTheme(); // owner: the Printable guide sheet picks Light | Dark paper; elsewhere it follows the app
  return `guides/gym-${kind}-${lv}-${lg}-${th}.pdf`;
}
export const guideBtns = (level, cls = "btn sm grow", theme) => `<div class="row"><a class="${cls}" href="${guideUrl("guide", level, theme)}" target="_blank" rel="noopener" download>${ic("download", "sm")} ${t("Guide PDF")}</a><a class="${cls}" href="${guideUrl("poster", level, theme)}" target="_blank" rel="noopener" download>${ic("download", "sm")} ${t("Wall poster")}</a></div>`;

/** Printable guide sheet: level + Light | Dark paper -> Guide PDF / Wall poster (Me > Settings and the Train "Your plan" card). */
export function openGuideSheet(level) {
  let lv = GUIDE_LEVELS.includes(level) ? level : GUIDE_LEVELS.includes(S.profile?.level) ? S.profile.level : "beginner", th = appTheme();
  const seg = (id, opts, cur, label) => `<div class="seg sm block" id="${id}" role="group" aria-label="${label}">${opts.map(([v, l]) => `<button data-v="${v}" class="${cur === v ? "on" : ""}">${t(l)}</button>`).join("")}</div>`;
  openSheet(`<h3 style="margin:0 0 4px">${t("Printable guide")}</h3><p class="muted small" style="margin:0 0 12px">${t("Your plan with photos, sets and a QR code to each exercise video. Print the wall poster for the gym, share the guide with friends.")}</p>
    ${seg("gLv", GUIDE_LEVELS.map((l) => [l, l[0].toUpperCase() + l.slice(1)]), lv, t("Level"))}
    <div class="mt-8">${seg("gTh", [["light", "Light"], ["dark", "Dark"]], th, t("Paper"))}</div><div class="mt-16" id="gBtns">${guideBtns(lv, "btn grow", th)}</div>`, (d) => {
    requestAnimationFrame(() => indicate(d));
    const pick = (id, fn) => (d.querySelector(id).onclick = (e) => { const b = e.target.closest("button"); if (!b || b.classList.contains("on")) return; selectIn(b); fn(b.dataset.v); d.querySelector("#gBtns").innerHTML = guideBtns(lv, "btn grow", th); });
    pick("#gLv", (v) => (lv = v)); pick("#gTh", (v) => (th = v));
  }, { half: true });
}

/* ================= shared bits ================= */
export const tierBadge = (k, cls = "") => (k ? `<span class="tier ${k} ${cls}">${k}<small>${t("tier")}</small></span>` : "");
export const TIER_INFO = [["S", N("Top pick"), N("One of the best choices for this muscle.")], ["A", N("Great"), N("Excellent, use it freely.")],
  ["B", N("Good"), N("Solid, works fine.")], ["C", N("OK"), N("Works, but better options exist.")]]; // English keys: show with t()
/** One-tap explanation of Jeff Nippard's S/A/B/C tiers. */
export function tierInfo() {
  openSheet(`<h3>${t("What do the tiers mean?")}</h3><p class="muted small" style="margin:-6px 0 12px">${t("Jeff Nippard ranks exercises by how well they build muscle (S best, C weakest).")}</p>
    <div class="list-sep">${TIER_INFO.map(([k, w, d]) => `<div class="lrow plain">${tierBadge(k)}<div class="grow"><div class="t">${t(w)}</div><div class="s">${t(d)}</div></div></div>`).join("")}</div>`);
}
const LVL = { beginner: [1, N("Beginner")], intermediate: [2, N("Intermediate")], advanced: [3, N("Advanced")] };
export const levelBars = (l) => { const [n, w] = LVL[l] || [0, ""]; return n ? `<span class="lvl l${n}" title="${t(w)}"><i></i><i></i><i></i></span>${t(w)}` : ""; };
export const isFav = (s) => S.favorites.includes(s);
export function toggleFav(s) { const off = isFav(s); S.favorites = off ? S.favorites.filter((x) => x !== s) : [...S.favorites, s]; tomb("favorites", s, !off); save("favorites"); haptic(); }
export const restText = (sec) => (sec >= 120 ? t("{n} min", { n: sec / 60 }) : t("{n}s", { n: sec }));
export function xcard(e, i = 0, sel = false, href = `#/ex/${e.slug}`) {
  return `<a class="xcard${sel ? " sel" : ""}" href="${href}" data-slug="${e.slug}">
    <div class="ph"><img data-fade loading="lazy" decoding="async" src="${e.poster}" alt="">${tierBadge(e.tier)}
      ${isFav(e.slug) ? `<span class="fav">${ic("heart")}</span>` : ""}</div>
    <div class="meta"><div class="name">${esc(e.name)}</div><div class="sub">${levelBars(e.level)}</div>
      <div class="tags">${[e.group, e.equipment[0], e.machine && !e.machine.toLowerCase().includes((e.equipment[0] || "~").toLowerCase()) ? e.machine : ""].filter(Boolean).map((x) => `<span>${esc(t(x))}</span>`).join("")}</div></div></a>`;
}
export function onImg(root = document) {
  $$("img[data-fade]", root).forEach((im) => {
    if (im.complete && im.naturalWidth) im.classList.add("ok");
    else { im.onload = () => im.classList.add("ok"); im.onerror = () => (im.style.visibility = "hidden"); }
  });
}

export const JEFF_VID = { "fGm-ef-4PVk": "Best & Worst Chest Exercises", "jLvqKgW-_G8": "Best & Worst Back Exercises", "SgyUoY0IZ7A": "Best & Worst Shoulder Exercises",
  "GNO4OtYoCYk": "Best & Worst Biceps Exercises", "OpRMRhr0Ycc": "Best & Worst Triceps Exercises", "kIXcoivzGf8": "Best & Worst Quad Exercises",
  "3ryh7PNhz3E": "Best & Worst Glute Exercises", "S6rqpxVGKZ4": "The Only 25 Exercises You Need", "qpRGnTTcLpo": "7 Amazing S-Tier Exercises" };
