// Exercise library (grid; list | detail at ≥1000px) and the exercise page (#/ex/<slug>) incl. pain / joint flags.
import { S, save } from "./store.js";
import { $, $$, esc, ic, openSheet, closeSheet, toast, haptic, fmtDate, lineChart, indicate, selectIn } from "./ui.js";
import { EX, BY, GROUPS, EQUIP, norm, hasEquip, byTier, swaps, history, bestOf, setsText, exerciseStats, weekStart, WEEK,
  JOINTS, JOINT_IDS, avoidFor, flaggedJoints, jointFriendly } from "./data.js";
import { MBY, bodySVG } from "./body.js";
import { e1rm } from "./calc.js";
import { setTop, go, tierBadge, tierInfo, levelBars, xcard, onImg, isFav, toggleFav, restText, JEFF_VID, fillIll, routeParts } from "./main.js";
import * as T from "./train.js";
import { autoPush } from "./sync.js";

const view = () => $("#view");
const wide = () => innerWidth >= 1000;
const L = (o) => (o && typeof o === "object" ? o[S.settings.lang || "en"] || o.en || "" : o || "");

/* ================= LIBRARY ================= */
export const lib = { q: "", group: "All", equip: "", tier: "", level: "", favs: false, machine: false, mine: true, scroll: 0 };
function filtered() {
  const words = norm(lib.q).split(/\s+/).filter(Boolean);
  return EX.filter((e) => (lib.group === "All" || e.group === lib.group) && (!lib.equip || e.equipment.includes(lib.equip)) &&
    (!lib.tier || (lib.tier === "SA" ? ["S", "A"].includes(e.tier) : e.tier === lib.tier)) && (!lib.level || e.level === lib.level) &&
    (!lib.favs || isFav(e.slug)) && (!lib.machine || e.machine) && (!lib.mine || hasEquip(e)) && words.every((w) => e._q.includes(w))).sort(byTier);
}
const TOGGLES = [["", "All tiers"], ["S", "S tier"], ["SA", "S + A"], ["fav", "Saved"], ["machine", "Machines"]];
const tOn = (v) => (v === "fav" ? lib.favs : v === "machine" ? lib.machine : v === "mine" ? lib.mine : lib.tier === v && !lib.favs);

function libHTML(pick) {
  const counts = {}; EX.forEach((e) => (counts[e.group] = (counts[e.group] || 0) + 1));
  return `<div class="libbar"><div class="search">${ic("search", "sm")}<input id="q" type="search" enterkeyhint="search" placeholder="Search ${EX.length} exercises" value="${esc(lib.q)}" autocomplete="off"></div>
      <div class="chips" id="tiers" style="padding-top:10px">${[...TOGGLES, ...(S.settings.equip !== "gym" ? [["mine", "My equipment"]] : [])].map(([v, l]) => `<button class="chip ${tOn(v) ? "on" : ""}" data-t="${v}">${l}</button>`).join("")}
        <select class="chip ${lib.equip ? "on" : ""}" id="equip" aria-label="Equipment"><option value="">Equipment</option>${EQUIP.map((q) => `<option ${q === lib.equip ? "selected" : ""}>${esc(q)}</option>`).join("")}</select>
        <select class="chip ${lib.level ? "on" : ""}" id="level" aria-label="Level"><option value="">Level</option>${["beginner", "intermediate", "advanced"].map((l) => `<option value="${l}" ${l === lib.level ? "selected" : ""}>${l[0].toUpperCase() + l.slice(1)}</option>`).join("")}</select></div>
      <div class="chips" id="groups" style="padding-top:0">${["All", ...GROUPS].map((g) => `<button class="chip ${lib.group === g ? "on" : ""}" data-g="${esc(g)}">${esc(g)}${g !== "All" ? ` <span class="n">${counts[g]}</span>` : ""}</button>`).join("")}</div></div>
    <div class="row"><div class="count grow" id="count"></div><button class="linkbtn small" id="tierHelp">${ic("info", "xs")} Tiers</button></div>
    <div class="grid ${pick ? "pick" : ""}" id="grid"></div><div id="sentinel" style="height:1px"></div>`;
}
function wireLib(pick, cur) {
  let list = [], shown = 0; const grid = $("#grid"); const pane = $("#lpane");
  const more = () => { const nx = list.slice(shown, shown + 40); grid.insertAdjacentHTML("beforeend", nx.map((e) => xcard(e, 0, pick?.selected.has(e.slug))).join("")); shown += nx.length; onImg(grid); markCur(cur); };
  const refresh = () => {
    list = filtered(); shown = 0; grid.innerHTML = "";
    $("#count").textContent = `${list.length} exercise${list.length === 1 ? "" : "s"} · best tier first`;
    if (!list.length) grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${ic("search")}<br>No matches. Try fewer filters.</div>`;
    more();
  };
  refresh();
  new IntersectionObserver((en) => { if (en[0].isIntersecting && shown < list.length) more(); }, { root: pane && wide() ? pane : null, rootMargin: "900px" }).observe($("#sentinel"));
  let t; $("#q").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { lib.q = e.target.value; refresh(); }, 120); };
  $("#groups").onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; haptic(); lib.group = b.dataset.g; $$("#groups .chip").forEach((c) => c.classList.toggle("on", c === b)); b.scrollIntoView({ inline: "center", block: "nearest" }); refresh(); };
  $("#tiers").onclick = (e) => {
    const b = e.target.closest("button.chip"); if (!b) return; haptic(); const v = b.dataset.t;
    if (v === "fav") lib.favs = !lib.favs; else if (v === "machine") lib.machine = !lib.machine; else if (v === "mine") lib.mine = !lib.mine; else { lib.tier = v; lib.favs = false; }
    $$("#tiers button.chip").forEach((c) => c.classList.toggle("on", tOn(c.dataset.t))); refresh();
  };
  $("#equip").onchange = (e) => { lib.equip = e.target.value; e.target.classList.toggle("on", !!lib.equip); refresh(); };
  $("#tierHelp").onclick = () => { haptic(); tierInfo(); };
  $("#level").onchange = (e) => { lib.level = e.target.value; e.target.classList.toggle("on", !!lib.level); refresh(); };
  if (pick) {
    grid.onclick = (e) => {
      const c = e.target.closest(".xcard"); if (!c) return; e.preventDefault(); haptic();
      const s = c.dataset.slug; pick.selected.has(s) ? pick.selected.delete(s) : pick.selected.add(s);
      c.classList.toggle("sel"); $("#pickDone").textContent = `Add ${pick.selected.size} exercise${pick.selected.size === 1 ? "" : "s"}`; $("#pickDone").disabled = !pick.selected.size;
    };
    $("#pickDone").onclick = T.finishPick;
  }
}
const markCur = (slug) => $$("#grid .xcard").forEach((c) => c.classList.toggle("cur", c.dataset.slug === slug));

export function libraryView() {
  const pick = T.pickMode && routeParts()[1] === "pick" ? T.pickMode : null;
  if (pick) {
    setTop({ title: "Add exercises", back: true });
    view().innerHTML = libHTML(pick) + `<div class="sticky-cta"><button class="btn primary" id="pickDone" disabled>Add 0 exercises</button></div>`;
    document.body.classList.add("has-cta");
    wireLib(pick); return;
  }
  setTop({ title: "Exercises" });
  if (wide()) return splitView(null);
  view().innerHTML = libHTML();
  wireLib(null);
  requestAnimationFrame(() => scrollTo(0, lib.scroll));
}
addEventListener("hashchange", (e) => { if (/#\/(lib)?$/.test(new URL(e.oldURL).hash || "#/") && innerWidth < 1000) lib.scroll = scrollY; });

/** ≥1000px: list on the left stays mounted, detail on the right. */
function splitView(slug) {
  if (!$("#lpane")) {
    view().innerHTML = `<div class="split"><aside class="lpane" id="lpane">${libHTML()}</aside><section class="rpane" id="rpane"></section></div>`;
    wireLib(null, slug);
  } else markCur(slug);
  const r = $("#rpane");
  if (!slug) {
    r.innerHTML = `<div class="card pad-l" style="text-align:center;margin-top:4px"><div class="ill" data-ill="plan" style="max-width:220px"></div><b>Pick an exercise</b><p class="muted small" style="margin-top:4px">Videos, how-to steps, muscles and your stats show here.</p></div>`;
    fillIll(r); return;
  }
  r.classList.remove("page"); void r.offsetWidth; r.classList.add("page");
  detail(slug, r);
}

/* ================= EXERCISE PAGE ================= */
const TIER_WORD = { S: "Top pick", A: "Great", B: "Good", C: "OK" };
let heads = null;
const loadHeads = async () => (heads ??= await fetch("data/guide/heads.json").then((r) => r.json()).catch(() => ({ muscles: {} })));
const dtab = { cur: "how" };

export function exerciseView(slug) {
  const e = BY[slug];
  if (!e) { setTop({ title: "Not found", back: true }); view().innerHTML = `<div class="empty">Exercise not found</div>`; return; }
  if (wide()) { setTop({ title: "Exercises" }); splitView(slug); return; }
  setTop({ title: e.name, back: true, shy: true, right: topRight(slug) });
  detail(slug, view());
  wireTop(slug);
}
const topRight = (slug) => `<button class="iconbtn ${isFav(slug) ? "on" : ""}" id="favTop" aria-label="Save">${ic("heart")}</button><button class="iconbtn" id="moreTop" aria-label="More">${ic("more")}</button>`;
function wireTop(slug, root = document) {
  const f = $("#favTop", root); if (f) f.onclick = () => { toggleFav(slug); f.classList.toggle("on", isFav(slug)); toast(isFav(slug) ? "Saved" : "Removed from saved"); };
  const m = $("#moreTop", root); if (m) m.onclick = () => moreMenu(slug);
}

function detail(slug, root) {
  const e = BY[slug]; const inPane = root.id === "rpane";
  const pain = S.pain?.[slug] || [];
  const risky = flaggedJoints().filter((j) => !pain.includes(j) && avoidFor(e, j));
  root.innerHTML = `<div class="dsplit">
      <div class="dhero" id="hero"></div>
      <div>
        <div class="row top"><h1 class="dtitle grow">${esc(e.name)}</h1>${inPane ? `<div class="row" style="gap:0;margin-top:6px">${topRight(slug)}</div>` : ""}</div>
        <div class="facts">${e.tier ? `<button class="tierbtn" id="tierInfo" aria-label="What tiers mean">Jeff: ${tierBadge(e.tier)}<span class="dim small">${TIER_WORD[e.tier]}</span>${ic("info", "xs")}</button>` : `<span class="dim">Not ranked</span>`}
          ${e.level ? `<span>${levelBars(e.level)}</span>` : ""}
          <span>${ic("reps")}${e.repRange[0]}–${e.repRange[1]} reps</span><span>${ic("timer")}${restText(e.rest)} rest</span><span>${ic("layers")}${e.type === "compound" ? "Compound" : "Isolation"}</span></div>
        ${e.tierNote ? `<button class="jeff" id="jeff" aria-expanded="false"><div class="txt"><b>Jeff:</b> ${esc(e.tierNote)}
            <div class="more" hidden><a href="https://www.youtube.com/watch?v=${e.tierVideo}" target="_blank" rel="noopener">${ic("yt", "sm")} ${esc(JEFF_VID[e.tierVideo] || "Watch on YouTube")}</a></div></div>${ic("down", "sm")}</button>` : ""}
        ${pain.length ? `<div class="notice warn" style="margin-top:8px">${ic("bandage", "sm")}<div class="grow"><b>Hurts your ${pain.map(jName).join(" & ")}</b><div class="small muted">Hidden from plans and swaps. Joint-friendly options in the Muscles tab.</div></div></div>`
          : risky.length ? `<div class="notice warn" style="margin-top:8px">${ic("alert", "sm")}<div class="grow small">May bother your <b>${risky.map(jName).join(" & ")}</b> — see joint-friendly options in the Muscles tab.</div></div>` : ""}
        <div class="ptabs fit" id="dtabs" style="margin-top:10px">${[["how", "How to"], ["mus", "Muscles"], ["stats", "Stats"], ["notes", "Notes & alternatives"]].map(([k, l]) => `<button data-k="${k}" class="${dtab.cur === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <div class="tab-panel" id="dpanel"></div>
      </div></div>
    <div class="sticky-cta"><button class="btn primary" id="addTo">${ic("plus", "sm")} Add to workout</button>${S.active ? `<button class="btn" id="addNow">${ic("bolt", "sm")} Add now</button>` : ""}</div>`;
  if (!inPane) document.body.classList.add("has-cta");
  hero(e);
  panel(e);
  if (inPane) wireTop(slug, root);
  requestAnimationFrame(() => indicate(root));
  $("#dtabs").onclick = (ev) => { const b = ev.target.closest("button"); if (!b || b.classList.contains("on")) return; haptic(); dtab.cur = b.dataset.k; selectIn(b); panel(e); };
  const j = $("#jeff"); if (j) j.onclick = (ev) => { if (ev.target.closest("a")) return; const o = j.classList.toggle("open"); j.setAttribute("aria-expanded", o); $(".more", j).hidden = !o; };
  const ti = $("#tierInfo", root); if (ti) ti.onclick = () => { haptic(); tierInfo(); };
  $("#addTo").onclick = () => T.addToWorkoutSheet(slug);
  const an = $("#addNow"); if (an) an.onclick = () => { T.addToSession(slug); toast("Added to current workout"); };
}
const jName = (j) => (L(JOINTS[j]?.name) || j).toLowerCase();

/* ---- hero: Video | Muscles (mannequin animation) ---- */
let heroMode = "video";
const paintBody = (e) => { const pri = e.primary || [], sec = e.secondary || [];
  return (svg) => svg.replace(/<path class="m" data-m="([^"]+)"/g, (m0, id) => `<path class="m ${pri.includes(id) ? "sel" : sec.includes(id) ? "sec" : ""}" data-m="${id}"`); };
function hero(e) {
  const h = $("#hero"); const hasFig = !!e.figure; const paint = paintBody(e);
  const mode = heroMode === "fig" || !e.video ? "fig" : "video";
  h.innerHTML = `${e.video ? `<div class="seg sm" id="hseg"><button data-m="video" class="${mode === "video" ? "on" : ""}">Video</button><button data-m="fig" class="${mode === "fig" ? "on" : ""}">Muscles</button></div>` : ""}
    ${mode === "video" ? `<video id="vid" src="${e.video}" poster="${e.poster}" autoplay muted loop playsinline preload="auto"></video><div class="ctl"><button id="spd" aria-label="Playback speed">1×</button></div>`
      : `<div class="hmus${hasFig ? " withfig" : ""}">${hasFig ? `<img class="fig" src="${e.figure}" alt="Animated figure of this movement, worked muscles in red">` : ""}
          <div class="mini-body">${paint(bodySVG("front"))}${paint(bodySVG("back"))}</div></div>
        <span class="cap"><i style="background:var(--accent)"></i>Main <i style="background:var(--mus-2)"></i>Helpers</span>`}`;
  const v = $("#vid", h);
  if (v) { const sp = [1, .5, .25]; let i = 0; $("#spd", h).onclick = () => { i = (i + 1) % 3; v.playbackRate = sp[i]; $("#spd", h).textContent = sp[i] + "×"; haptic(); }; v.play().catch(() => {}); }
  const s = $("#hseg", h); if (s) s.onclick = (ev) => { const b = ev.target.closest("button"); if (!b || b.classList.contains("on")) return; heroMode = b.dataset.m; haptic(); hero(e); };
  requestAnimationFrame(() => indicate(h));
}

/* ---- tab panels ---- */
function panel(e) {
  const p = $("#dpanel"); p.style.animation = "none"; void p.offsetWidth; p.style.animation = "";
  if (dtab.cur === "how") {
    p.innerHTML = `${e.about ? `<p class="muted" style="margin-bottom:12px">${esc(e.about)}</p>` : ""}
      ${e.steps.length ? `<ol class="steps">${e.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol>` : `<p class="dim">No written steps yet — follow the video.</p>`}
      ${e.cues.length ? `<div class="h4">Cues</div><ul class="bul ok">${e.cues.map((s) => `<li>${ic("okc", "sm")}<span>${esc(s)}</span></li>`).join("")}</ul>` : ""}
      ${e.mistakes.length ? `<div class="h4">Common mistakes</div><ul class="bul no">${e.mistakes.map((s) => `<li>${ic("x", "sm")}<span>${esc(s)}</span></li>`).join("")}</ul>` : ""}
      ${e.vnote ? `<div class="h4">This variation</div><p class="muted">${esc(e.vnote)}</p>` : ""}`;
  } else if (dtab.cur === "mus") musclesPanel(e, p);
  else if (dtab.cur === "stats") statsPanel(e, p);
  else notesPanel(e, p);
}
async function musclesPanel(e, p) {
  const pri = e.primary || [], sec = e.secondary || []; const paint = paintBody(e);
  const pain = S.pain?.[e.slug] || []; const joints = [...new Set([...pain, ...flaggedJoints().filter((j) => avoidFor(e, j))])];
  p.innerHTML = `<div class="row top" style="gap:16px"><div class="mini-body" style="gap:4px">${paint(bodySVG("front"))}${paint(bodySVG("back"))}</div>
      <div class="grow mus-list"><div class="eyebrow">Main</div>${pri.map((m) => `<div><i style="background:var(--accent)"></i>${esc(MBY[m]?.name || m)}</div>`).join("") || `<div>${esc(e.group)}</div>`}
        ${sec.length ? `<div class="eyebrow" style="margin-top:8px">Helpers</div>${sec.map((m) => `<div><i style="background:var(--mus-2)"></i>${esc(MBY[m]?.name || m)}</div>`).join("")}` : ""}</div></div>
    <div id="heads"></div>${joints.length ? painBlock(e, joints) : ""}`;
  p.querySelectorAll(".mini-body svg").forEach((s) => (s.style.width = "78px"));
  const H = await loadHeads(); const out = [];
  for (const m of pri) {
    const hs = H.muscles?.[m]?.heads; if (!hs?.length) continue;
    const hit = hs.find((h) => h.match && new RegExp(h.match, "i").test(e.name)) || hs.find((h) => h.default) || null;
    if (hit) out.push(`<div class="lrow plain" style="align-items:flex-start"><span class="ico">${ic("target", "sm")}</span><div class="grow"><div class="t">${esc(L(hit.name))} <span class="dim tiny">${esc(hit.latin || "")}</span></div><div class="s" style="color:var(--t2)">${esc(L(hit.about))}</div></div></div>`);
  }
  const hd = $("#heads", p); if (hd && out.length) hd.innerHTML = `<div class="h4">Where it hits most</div><div class="list-sep">${out.join("")}</div>`;
  const rm = $("#rmPain", p); if (rm) rm.onclick = () => { delete S.pain[e.slug]; save("pain"); autoPush(); toast("Flag removed"); rerenderDetail(e.slug); };
}
function painBlock(e, joints) {
  const alts = jointFriendly(e, joints, 5);
  const J = joints.map((j) => JOINTS[j]).filter(Boolean);
  return `<div class="h4">${ic("bandage", "xs")} Joint-friendly options</div>
    <div class="stack tight">${alts.map((x) => `<a class="lrow" href="#/ex/${x.slug}"><img src="${x.poster}" alt="" loading="lazy"><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.equipment.join(" · ") || x.group)}</div></div>${tierBadge(x.tier)}</a>`).join("") || `<p class="dim">No safe alternative found for this muscle.</p>`}</div>
    ${J.map((j) => `<div class="h4">Go easy on your ${esc(L(j.name).toLowerCase())}</div><ul class="bul ok">${(L(j.tips) || []).slice(0, 3).map((t) => `<li>${ic("okc", "sm")}<span>${esc(t)}</span></li>`).join("")}</ul>
      <div class="list-sep" style="margin-top:8px">${(j.drills || []).map((d) => `<div class="lrow plain"><span class="ico">${ic("flame", "sm")}</span><div class="grow"><div class="t">${esc(L(d.name))} <span class="dim tiny">${esc(d.dose || "")}</span></div><div class="s" style="color:var(--t2)">${esc(L(d.how))}</div></div></div>`).join("")}</div>`).join("")}
    <div class="notice warn" style="margin-top:12px">${ic("alert", "sm")}<span class="small">${esc(L(J[0]?.physio) || "If pain persists or is sharp, stop and see a physiotherapist.")}</span></div>
    ${S.pain?.[e.slug]?.length ? `<button class="btn sm ghost" id="rmPain" style="margin-top:6px">Remove pain flag</button>` : ""}`;
}
function statsPanel(e, p) {
  const best = bestOf(e.slug), hist = history(e.slug), u = S.settings.unit;
  if (!hist.length) { p.innerHTML = `<div class="empty"><div class="ill" data-ill="pr" style="max-width:150px"></div>Log this exercise in a workout to see your best lift and progress.</div>`; fillIll(p); return; }
  const w0 = weekStart(), cur = exerciseStats(w0, Date.now() + 1)[e.slug], prev = exerciseStats(w0 - WEEK, w0)[e.slug];
  const cell = (o) => (o ? `${o.sets} × ${Math.round(o.reps / o.sets)} · ${o.best ? `${o.best.w}${u}` : "—"}` : `<span class="dim">—</span>`);
  const pts = hist.map((h) => Math.max(...h.sets.map((s) => e1rm(s.w, s.r))));
  p.innerHTML = `<div class="row"><div class="grow"><div class="eyebrow">Best est. 1RM</div><div class="num" style="font-size:28px;font-weight:780">${best.e1rm}${u}</div>
      <div class="dim small">${best.w}${u} × ${best.r} · ${fmtDate(best.date)}</div></div>${ic("trophy")}</div>
    ${pts.length > 1 ? lineChart(pts, { h: 72, cls: "chart spark" }) : ""}
    <table class="cmp" style="margin-top:10px"><tr><th></th><th>Sets × reps · top</th><th class="n">Volume</th></tr>
      <tr><td>Last week</td><td>${cell(prev)}</td><td class="n">${prev ? Math.round(prev.kg) + u : "—"}</td></tr>
      <tr><td><b>This week</b></td><td>${cell(cur)}</td><td class="n">${cur ? Math.round(cur.kg) + u : "—"}</td></tr></table>
    <div class="dim small" style="margin-top:10px">Last session: ${esc(setsText(hist.at(-1).sets))}</div>`;
}
function notesPanel(e, p) {
  const alt = swaps(e, 6);
  p.innerHTML = `<div class="h4" style="margin-top:0">Alternatives <span class="dim small">same muscle, best tier first</span></div>
    ${alt.length ? `<div class="stack tight">${alt.map((x) => `<a class="lrow" href="#/ex/${x.slug}"><img src="${x.poster}" alt="" loading="lazy"><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.equipment.join(" · ") || x.group)}</div></div>${tierBadge(x.tier)}</a>`).join("")}</div>` : `<p class="dim">No alternatives with your equipment.</p>`}
    <div class="h4">My notes</div><textarea id="note" class="input" placeholder="Seat height, grip, cues…">${esc(S.notes[e.slug] || "")}</textarea>`;
  let nt; $("#note", p).oninput = (ev) => { clearTimeout(nt); nt = setTimeout(() => { S.notes[e.slug] = ev.target.value; save("notes"); autoPush(); }, 400); };
}
function rerenderDetail(slug) { if (wide() && $("#rpane")) splitView(slug); else exerciseView(slug); }

/* ---- ⋯ menu: pain flags ---- */
function moreMenu(slug) {
  const e = BY[slug]; const cur = new Set(S.pain?.[slug] || []);
  openSheet(`<h3>${esc(e.name)}</h3><div class="eyebrow" style="margin-bottom:4px">Hurts my…</div>
    <div class="menu" id="jm">${JOINT_IDS.map((j) => `<button data-j="${j}" class="${cur.has(j) ? "on" : ""}">${ic(cur.has(j) ? "check" : "bandage", "sm ck")}${esc(L(JOINTS[j]?.name) || j)}</button>`).join("")}</div>
    <p class="dim small" style="margin:8px 0 12px">Flagged exercises are hidden from plans, swaps and suggestions. You'll get joint-friendly options instead.</p>
    <div class="menu">${e.tierVideo ? `<a href="https://www.youtube.com/watch?v=${e.tierVideo}" target="_blank" rel="noopener">${ic("yt", "sm")}Jeff's ranking video</a>` : ""}
      <button id="mAdd">${ic("plus", "sm")}Add to workout</button></div>`, (el) => {
    $("#jm", el).onclick = (ev) => {
      const b = ev.target.closest("[data-j]"); if (!b) return; haptic(); const j = b.dataset.j;
      cur.has(j) ? cur.delete(j) : cur.add(j);
      S.pain ||= {}; if (cur.size) S.pain[slug] = [...cur]; else delete S.pain[slug];
      save("pain"); autoPush(); b.classList.toggle("on", cur.has(j)); b.querySelector("svg").outerHTML = ic(cur.has(j) ? "check" : "bandage", "sm ck");
    };
    $("#mAdd", el).onclick = () => { closeSheet(); setTimeout(() => T.addToWorkoutSheet(slug), 220); };
    $("#sheet").addEventListener("close", () => { if (BY[slug] && location.hash.includes(slug)) { if (cur.size) dtab.cur = "mus"; rerenderDetail(slug); } }, { once: true });
  });
}
