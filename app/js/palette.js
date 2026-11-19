// Cmd/Ctrl+K command palette (FE-13: out of main.js; loaded on the first Cmd/Ctrl+K).
import { S } from "./store.js";
import { $, esc, ic, openSheet, closeSheet } from "./ui.js";
import { EX, searchEx } from "./data.js";
import { go } from "./nav.js";
import { tierBadge, onImg } from "./components.js";

/** Cmd/Ctrl+K: jump to any page or exercise. ↑/↓ move, Enter opens, Esc closes. */
const PAGES = [["Home", "#/", "1"], ["Exercises", "#/lib", "2"], ["Body map", "#/body", "3"], ["Train", "#/train", "4"], ["Me", "#/me", "5"], ["Settings", "#/settings", ","],
  ["Rest timer", "#/timer", "T"], ["Plans", "#/plans", ""], ["Strength standards", "#/standards", ""], ["Nutrition", "#/nutrition", ""]];
export function palette() {
  if ($("#sheet").open && $("#pq")) return $("#pq").focus();
  let sel = 0, items = [];
  openSheet(`<div class="search">${ic("search", "sm")}<input id="pq" type="search" placeholder="Go to page or exercise" autocomplete="off" enterkeyhint="go" aria-label="Go to page or exercise"></div>
    <div class="list-sep mt-10" id="pres" role="listbox"></div><p class="small muted" style="margin:10px 2px 0">↑ ↓ to move · Enter to open · Esc to close</p>`, (b) => {
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
