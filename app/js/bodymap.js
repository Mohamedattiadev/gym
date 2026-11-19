// Body map page (#/body): front/back anatomy, Muscles | This week | Recovery modes, muscle detail panel/sheet (FE-13: out of main.js).
import { $, BP, $$, esc, ic, openSheet, haptic, indicate, selectIn, RM, L } from "./ui.js";
import { EX, byTier, weeklyVolume, hasEquip, hurts, recovery } from "./data.js";
import { MUSCLES, MBY, bodySVG, muscleBox, zoomTo, panZoom, FULL, HEAT, CREDIT } from "./body.js";
import { setTop } from "./nav.js";
import { tierBadge } from "./components.js";

const view = $("#view");
/** The router calls this on every page change: the detail controller only lives while the page is shown. */
export const leaveBodyMap = () => { BM = null; };
const bm = { view: "front", mode: "muscles" }; // mode: muscles | week | rec
let HEADS = null;
const loadHeads = () => (HEADS ??= fetch("data/guide/heads.json").then((r) => r.json()).catch(() => ({ muscles: {} })));
function exercisesFor(m) {
  return EX.filter((e) => (m.regions ? m.regions.includes(e.region) : m.id === "obliques" ? /oblique|twist|side bend|wood ?chop|bicycle/i.test(e.name) : m.groups.includes(e.group)) && hasEquip(e)).sort(byTier);
}
/** Which head of muscle `hs` an exercise mainly hits (regex on name, else the default head). */
const headOf = (hs, e) => hs.find((h) => h.match && new RegExp(h.match, "i").test(e.name)) || hs.find((h) => h.default) || hs[0];
const heatOf = (m, vol) => HEAT[Math.min(4, Math.ceil(((vol[m.id] || 0) / (m.lm[1] ? m.lm[1] * .6 : 10)) * 4))];
const recText = (r) => (!r ? "Ready" : r.state === "r" ? `Trained <24h · ~${r.left}h to go` : r.left ? `Needs ~${r.left} more hours` : "Ready");
let BM = null; // live body-map controller (detail panel), null when the page is not shown
const wide = () => innerWidth >= BP.panel;
addEventListener("popstate", () => { if (BM && location.hash.startsWith("#/body")) BM.sync(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && BM?.open && !$("#sheet").open) { e.preventDefault(); BM.close(); } });
export function bodyMap() {
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
      <div class="body-wrap" id="bwrap">${bodySVG(bm.view)}<div class="zctl"><button class="iconbtn" data-z="1.4" aria-label="Zoom in">${ic("plus", "sm")}</button><button class="iconbtn" data-z="0.7" aria-label="Zoom out">${ic("minus", "sm")}</button></div></div>
      <div class="dim tiny bm-credit"><button class="linkbtn" id="credit">Anatomy art credit</button></div></div>
    <div class="bm-side"><div id="bmlist"><div class="sec"><h2>Muscles</h2></div>
      <div class="mgrid stagger" id="legend">${list.map((m) => `<button data-m="${m.id}" style="--hm:${dot(m)}" aria-label="${m.name}, ${cnt(m)} exercises"><i></i>${m.name}<span class="c">${cnt(m)}</span></button>`).join("")}</div></div>
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
  const fullH = () => innerHeight - ($("#topbar")?.offsetHeight || 56) - (innerWidth < BP.tablet ? ($(".nav")?.offsetHeight || 64) : 0);
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
  const pz = panZoom($("#bwrap"), [svg]); // 18b
  $("#bwrap .zctl").onclick = (e) => { const z = e.target.closest("[data-z]"); if (z) { haptic(); pz.zoomBy(+z.dataset.z); } };
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
  const exRow = (e, hid) => `<a class="lrow" href="#/ex/${e.slug}"${hid ? ` data-h="${hid}"` : ""}><img src="${e.poster}" alt="" loading="lazy"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.equipment.join(" · ") || e.group)}</div></div>${tierBadge(e.tier)}</a>`;
  const drawEx = () => {
    const l = eq ? list.filter((e) => e.equipment.includes(eq)) : list;
    let html;
    if (hs.length > 1) {
      const by = Object.fromEntries(hs.map((h) => [h.id, []])); l.forEach((e) => by[headOf(hs, e).id].push(e));
      html = hs.filter((h) => by[h.id].length).map((h) => `<div class="h4 hd-h" data-h="${h.id}">${esc(L(h.name))} <span class="dim tiny">${by[h.id].length}</span></div>${by[h.id].slice(0, 12).map((e) => exRow(e, h.id)).join("")}`).join("");
    } else html = l.slice(0, 40).map((e) => exRow(e)).join("");
    $("#mlist", el).innerHTML = html || `<div class="empty">No exercises</div>`;
  };
  const eqs = [...new Set(list.flatMap((e) => e.equipment))].slice(0, 8);
  const info = `<p class="muted small" style="margin:0 0 10px">${m.fn}</p>
    <div class="card soft pad row"><div class="grow"><div class="eyebrow">This week</div><b class="num" style="font-size:22px">${done}</b> <span class="dim">/ ${mev || 4}–${mav} sets</span></div>
      <div style="width:110px" class="progress"><div style="width:${Math.min(100, (done / (mav || 10)) * 100)}%"></div></div></div>
    <div class="row small" style="gap:8px;margin:10px 2px"><i class="rdot" style="background:var(--rec-${r?.state || "g"})"></i><span>${recText(r)}</span></div>
    ${hs.length > 1 ? `<div class="h4">Parts</div><div class="list-sep" id="hlist">${hs.map((h) => `<button class="lrow plain hd-row" data-h="${h.id}"><span class="hdot"></span><div class="grow"><div class="t">${esc(L(h.name))} <span class="dim tiny">${esc(h.latin || "")}</span></div><div class="s" style="color:var(--t2)">${esc(L(h.about))}</div>${shown.has(h.id) ? "" : `<div class="dim tiny">Deep or not visible from this side</div>`}</div></button>`).join("")}</div>` : ""}`;
  el.innerHTML = `<button class="mgrab" aria-label="Expand or collapse"></button>
    <div class="mhd"><button class="iconbtn" id="mback" aria-label="Back to muscles">${ic(wide() ? "back" : "x")}</button><h3>${m.name}</h3></div>
    <div class="mbd"><div class="ptabs fit" id="mtabs"><button data-k="info" class="${ctl.tab === "info" ? "on" : ""}">Info</button><button data-k="ex" class="${ctl.tab === "ex" ? "on" : ""}">Exercises <span class="dim tiny">${list.length}</span></button></div>
    <div id="mpanel" class="mt-12"></div></div>`;
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
      if (hover) { $("#mlist", el).onmouseover = (e) => { const h = e.target.closest("[data-h]"); if (h) pickHead(h.dataset.h); }; /* a part's heading AND its exercise rows light that part */ $("#mlist", el).onmouseleave = () => pickHead(picked); }
    }
  };
  panel();
  requestAnimationFrame(() => indicate(el));
  $("#mback", el).onclick = () => ctl.close();
  $("#mtabs", el).onclick = (e) => { const b = e.target.closest("button"); if (!b || b.dataset.k === ctl.tab) return; haptic(); ctl.tab = b.dataset.k; selectIn(b); panel(); };
}
