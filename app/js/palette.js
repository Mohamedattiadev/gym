// Cmd/Ctrl+K command palette (FE-13: out of main.js; loaded on the first Cmd/Ctrl+K).
import { S } from "./store.js";
import { $, esc, ic, openSheet, closeSheet } from "./ui.js";
import { EX, searchEx } from "./data.js";
import { go } from "./nav.js";
import { tierBadge, onImg } from "./components.js";
import { t, N } from "./i18n.js";

/** Cmd/Ctrl+K: jump to any page or exercise. ↑/↓ move, Enter opens, Esc closes. */
const PAGES = [[N("Home"), "#/", "1"], [N("Exercises"), "#/lib", "2"], [N("Body map"), "#/body", "3"], [N("Train"), "#/train", "4"], [N("Me"), "#/me", "5"], [N("Settings"), "#/settings", ","],
  [N("Rest timer"), "#/timer", "T"], [N("Plans"), "#/plans", ""], [N("Strength standards"), "#/standards", ""], [N("Nutrition"), "#/nutrition", ""]];
export function palette() {
  if ($("#sheet").open && $("#pq")) return $("#pq").focus();
  let sel = 0, items = [];
  openSheet(`<div class="search">${ic("search", "sm")}<input id="pq" type="search" placeholder="${t("Go to page or exercise")}" autocomplete="off" enterkeyhint="go" aria-label="${t("Go to page or exercise")}"></div>
    <div class="list-sep mt-10" id="pres" role="listbox"></div><p class="small muted" style="margin:10px 2px 0">${t("↑ ↓ to move · Enter to open · Esc to close")}</p>`, (b) => {
    const inp = b.querySelector("#pq"), box = b.querySelector("#pres");
    const draw = () => {
      const q = inp.value.trim(), nq = q.toLowerCase();
      const cw = t("Current workout");
      items = S.active && (!q || cw.toLowerCase().includes(nq) || "current workout".includes(nq)) ? [{ t: cw, h: "#/session" }] : [];
      items.push(...PAGES.map(([en, h, k]) => ({ t: t(en), en, h, k })).filter((p) => !q || p.t.toLowerCase().includes(nq) || p.en.toLowerCase().includes(nq)));
      if (q) items.push(...searchEx(q, EX).slice(0, 8).map((x) => ({ t: x.name, h: `#/ex/${x.slug}`, e: x })));
      sel = Math.min(sel, Math.max(0, items.length - 1));
      box.innerHTML = items.length ? items.map((it, i) => `<a class="lrow ${i === sel ? "on" : ""}" role="option" aria-selected="${i === sel}" href="${it.h}" data-i="${i}">${it.e ? `<img src="${esc(it.e.poster)}" alt="" loading="lazy">` : ""}
        <div class="grow"><div class="t">${esc(it.t)}</div>${it.e ? `<div class="s">${esc(t(it.e.group))} · ${esc(it.e.equipment.map((q) => t(q)).join(", "))}</div>` : ""}</div>${it.e ? tierBadge(it.e.tier) : it.k ? `<span class="kbd">${esc(it.k)}</span>` : ""}</a>`).join("")
        : `<div class="empty small">${t("No matches")}</div>`;
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
