/* Small shared view pieces (FE-12: moved out of main.js so views never import main.js). */
import { S, save, tomb } from "./store.js";
import { $$, esc, ic, openSheet, haptic } from "./ui.js";

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
export function guideUrl(kind, level) {
  const lv = GUIDE_LEVELS.includes(level) ? level : "beginner";
  const lang = ["tr", "ar"].includes(document.documentElement.lang) ? document.documentElement.lang : "en";
  const th = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  return `guides/gym-${kind}-${lv}-${lang}-${th}.pdf`;
}
export const guideBtns = (level, cls = "btn sm grow") => `<div class="row"><a class="${cls}" href="${guideUrl("guide", level)}" target="_blank" rel="noopener" download>${ic("download", "sm")} Guide PDF</a><a class="${cls}" href="${guideUrl("poster", level)}" target="_blank" rel="noopener" download>${ic("download", "sm")} Wall poster</a></div>`;

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
export function toggleFav(s) { const off = isFav(s); S.favorites = off ? S.favorites.filter((x) => x !== s) : [...S.favorites, s]; tomb("favorites", s, !off); save("favorites"); haptic(); }
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

export const JEFF_VID = { "fGm-ef-4PVk": "Best & Worst Chest Exercises", "jLvqKgW-_G8": "Best & Worst Back Exercises", "SgyUoY0IZ7A": "Best & Worst Shoulder Exercises",
  "GNO4OtYoCYk": "Best & Worst Biceps Exercises", "OpRMRhr0Ycc": "Best & Worst Triceps Exercises", "kIXcoivzGf8": "Best & Worst Quad Exercises",
  "3ryh7PNhz3E": "Best & Worst Glute Exercises", "S6rqpxVGKZ4": "The Only 25 Exercises You Need", "qpRGnTTcLpo": "7 Amazing S-Tier Exercises" };
