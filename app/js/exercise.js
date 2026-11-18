// Exercise library (grid; list | detail at ≥1000px) and the exercise page (#/ex/<slug>) incl. pain / joint flags.
import { S, save } from "./store.js";
import { $, BP, $$, esc, ic, openSheet, closeSheet, toast, haptic, fmtDate, lineChart, indicate, selectIn, RM, L } from "./ui.js";
import { EX, BY, GROUPS, EQUIP, searchEx, hasEquip, byTier, swaps, history, bestOf, setsText, exerciseStats, weekStart, WEEK,
  JOINTS, JOINT_IDS, avoidFor, flaggedJoints, jointFriendly, hurts, FAM } from "./data.js";
import { MBY, bodySVG, panZoom } from "./body.js";
import { e1rm } from "./calc.js";
import { setTop, go, routeParts } from "./nav.js";
import { tierBadge, tierInfo, levelBars, xcard, onImg, isFav, toggleFav, restText, JEFF_VID, fillIll } from "./components.js";
import * as T from "./train.js";

const view = () => $("#view");
const wide = () => innerWidth >= BP.wide;

/* ================= LIBRARY ================= */
export const lib = { q: "", group: "All", equip: "", tier: "", level: "", favs: false, machine: false, mine: true, scroll: 0 };
function filtered() {
  return searchEx(lib.q, EX.filter((e) => (lib.group === "All" || e.group === lib.group) && (!lib.equip || e.equipment.includes(lib.equip)) &&
    (!lib.tier || (lib.tier === "SA" ? ["S", "A"].includes(e.tier) : e.tier === lib.tier)) && (!lib.level || e.level === lib.level) &&
    (!lib.favs || isFav(e.slug)) && (!lib.machine || e.machine) && (!lib.mine || hasEquip(e))));
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
  // PERF-2: only the new cards get image hooks + the "current" mark (was O(n²) over the whole grid)
  const more = () => {
    const nx = list.slice(shown, shown + 40); const tp = document.createElement("template");
    tp.innerHTML = nx.map((e) => xcard(e, 0, pick?.selected.has(e.slug))).join(""); shown += nx.length;
    onImg(tp.content); if (cur) tp.content.querySelectorAll(".xcard").forEach((c) => c.classList.toggle("cur", c.dataset.slug === cur));
    grid.append(tp.content);
  };
  const refresh = () => {
    list = filtered(); shown = 0; grid.innerHTML = "";
    $("#count").textContent = list.length && list.close === list.length ? `${list.length} close match${list.length === 1 ? "" : "es"} · check the spelling` : `${list.length} exercise${list.length === 1 ? "" : "s"} · best tier first`;
    if (!list.length) grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${ic("search")}<br>No matches. Try fewer filters.</div>`;
    more();
  };
  refresh();
  libIO?.disconnect(); /* FE-16 */
  libIO = new IntersectionObserver((en) => { if (en[0].isIntersecting && shown < list.length) more(); }, { root: pane && wide() ? pane : null, rootMargin: "900px" }).observe($("#sentinel"));
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
addEventListener("hashchange", (e) => { if (/#\/(lib)?$/.test(new URL(e.oldURL).hash || "#/") && innerWidth < BP.wide) lib.scroll = scrollY; });

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
  const joints = jointsOf(e);
  if (dtab.cur === "mus" || dtab.cur === "notes") dtab.cur = "how";
  root.innerHTML = `<div class="dsplit">
      <div><div class="dhero" id="hero"></div>${variantsHTML(e)}</div>
      <div>
        <div class="row top"><h1 class="dtitle grow">${esc(e.name)}</h1>${inPane ? `<div class="row" style="gap:0;margin-top:6px">${topRight(slug)}</div>` : ""}</div>
        <div class="dmeta">${e.tier ? `<button class="tierbtn" id="tierInfo" aria-label="Jeff's ranking">${tierBadge(e.tier)}<span class="dim small">${TIER_WORD[e.tier]}</span>${ic("info", "xs")}</button>` : `<span class="dim small">Not ranked</span>`}
          ${e.level ? `<span class="small dim">${levelBars(e.level)}</span>` : ""}
          ${joints.length ? `<button class="painchip" id="painChip">${ic("bandage", "xs")}${joints.map((j) => esc(L(JOINTS[j]?.name) || j)).join(" · ")}</button>` : ""}</div>
        <div class="dsub">${e.repRange[0]}–${e.repRange[1]} reps · ${restText(e.rest)} rest · ${e.type === "compound" ? "Compound" : "Isolation"}</div>
        <div class="ptabs fit" id="dtabs" style="margin-top:12px">${[["how", "How to"], ["stats", "Stats"], ["rank", "Ranking & alternatives"]].map(([k, l]) => `<button data-k="${k}" class="${dtab.cur === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <div class="tab-panel" id="dpanel"></div>
      </div></div>
    <div class="sticky-cta"><button class="btn primary" id="addTo">${ic("plus", "sm")}<span class="lbl">Add to workout</span></button>${S.active ? `<button class="btn" id="addNow">${ic("bolt", "sm")}<span class="lbl">Add now</span></button>` : ""}</div>`;
  if (!inPane) document.body.classList.add("has-cta");
  hero(e);
  panel(e);
  if (inPane) wireTop(slug, root);
  requestAnimationFrame(() => indicate(root));
  const tabs = $("#dtabs");
  const show = (k) => { const b = tabs.querySelector(`[data-k="${k}"]`); if (!b || b.classList.contains("on")) return; dtab.cur = k; selectIn(b); panel(e); };
  tabs.onclick = (ev) => { const b = ev.target.closest("button"); if (!b) return; haptic(); show(b.dataset.k); };
  const ti = $("#tierInfo", root); if (ti) ti.onclick = () => { haptic(); show("rank"); tabs.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const pc = $("#painChip", root); if (pc) pc.onclick = () => { haptic(); jointCare(e); };
  const vq = $("#eqv", root); if (vq) vq.onclick = (ev) => { const b = ev.target.closest("[data-s]"); if (!b || b.classList.contains("on")) return; haptic();
    window.history.replaceState(null, "", `#/ex/${b.dataset.s}`); rerenderDetail(b.dataset.s); };
  $("#addTo").onclick = () => T.addToWorkoutSheet(slug);
  const an = $("#addNow"); if (an) an.onclick = () => { T.addToSession(slug); toast("Added to current workout"); };
}
const jName = (j) => (L(JOINTS[j]?.name) || j).toLowerCase();
/** Joints that matter on this page: flagged for this exercise, or flagged elsewhere and risky here. */
const jointsOf = (e) => { const pain = S.pain?.[e.slug] || []; return [...new Set([...pain, ...flaggedJoints().filter((j) => avoidFor(e, j))])]; };

/* ---- equipment variants: same family first, else same pattern + main muscle ("similar") ---- */
const KINDS = ["Machine", "Smith", "Cable", "Barbell", "EZ Bar", "Dumbbell", "Bodyweight"];
const KIND_NAME = { Smith: "Smith", "EZ Bar": "EZ bar" };
const kindOf = (x) => KINDS.find((k) => x.equipment.includes(k)) || null;
/* alt pick = the common, canonical movement, never a novelty variant (19a-chips b) */
const NOVEL = /\b(partials?|copy|1\.5|1 ?¼|tempo|giant|cluster|myo|drop ?sets?|drops|iso(metric)?|holds?|pause[ds]?|lengthened|stretch|somersault|sissy|extreme|banded|band resisted|chains?|deficit|anderson|pin|board|spoto|zercher|jefferson|landmine|kas|frog|reverse grip|single|1 arm|one arm|unilateral|kneeling|half)\b/i;
const MODS = /[("]|\b(heel|elevated|wide|narrow|close|neutral|incline|decline|seated|lying|standing|high|low|mid|bar|grip|stance|cambered|safety|ssb|fat|thick)\b/gi;
const oddity = (x) => { const n = x.name.replace(/\b(high|low)[- ]bar\b/gi, ""); return (NOVEL.test(n) ? 10 : 0) + (n.match(MODS)?.length || 0); }; // "High Bar Squats" = the plain back squat
/** the name names another equipment kind (data says Barbell, name says "Dumbbell …") → not a fair pick for chip k */
const clash = (x, k) => !new RegExp(`\\b${k}\\b`, "i").test(x.name) && KINDS.some((o) => o !== k && new RegExp(`\\b${o}\\b`, "i").test(x.name));
const altSort = (a, b) => (b.canonical - a.canonical) || oddity(a) - oddity(b) || byTier(a, b);
export function variants(e) {
  const own = kindOf(e); if (!own) return [];
  const ok = (x) => x.slug !== e.slug && x.video && hasEquip(x) && !hurts(x);
  const fam = EX.filter((x) => x.family === e.family && ok(x)).sort(altSort);
  const sim = EX.filter((x) => x.family !== e.family && ok(x) && !/\b(copy|partials?|1\.5|tempo|giant)\b/i.test(x.name + " " + x.slug.replace(/-/g, " ").replace(/copy$/, "")) && x.group === e.group && x.pattern === e.pattern && x.primary?.[0] && x.primary[0] === e.primary?.[0]).sort(altSort);
  const out = [];
  for (const k of KINDS) {
    if (k === own) { out.push({ k, x: e, on: true }); continue; }
    const f = fam.find((x) => kindOf(x) === k && !clash(x, k)); if (f) { out.push({ k, x: f }); continue; }
    const s = sim.find((x) => kindOf(x) === k && !clash(x, k) && oddity(x) < 10); if (s) out.push({ k, x: s, sim: true });
  }
  return out.length > 1 ? out : [];
}
function variantsHTML(e) {
  const v = variants(e); if (!v.length) return "";
  return `<div class="chips eqv" id="eqv">${v.map(({ k, x, on, sim }) => `<button class="chip ${on ? "on" : ""}" data-s="${x.slug}" title="${esc(x.name)}">${esc(KIND_NAME[k] || k)}${sim ? `<span class="n">alt</span>` : ""}</button>`).join("")}</div>`;
}

/* ---- Joint care sheet (opened from the pain chip) ---- */
const JOINT_AREA = { shoulder: "shoulders", knee: "knees", elbow: "elbows", wrist: "elbows", "lower-back": "back", hip: "hips" };
let WU = null;
const loadWU = () => (WU ??= fetch("data/guide/warmups.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
const hcards = (list) => `<div class="hcards">${list.map((x) => `<a class="hcard" href="#/ex/${x.slug}"><div class="ph"><img src="${x.poster}" alt="" loading="lazy">${tierBadge(x.tier)}</div><div class="t">${esc(x.name)}</div><div class="s">${esc(x.equipment.join(" · ") || x.group)}</div></a>`).join("")}</div>`;
async function jointCare(e) {
  const joints = jointsOf(e); const pain = S.pain?.[e.slug] || [];
  const J = joints.map((j) => JOINTS[j]).filter(Boolean); const w = await loadWU();
  const area = JOINT_AREA[joints[0]]; const drills = (w.areas?.[area]?.drills || []).map((id) => ({ id, ...w.drills?.[id] })).filter((d) => d.name).slice(0, 3);
  const secs = drills.reduce((a, d) => a + (d.secs || 30), 0);
  const alts = jointFriendly(e, joints, 6);
  openSheet(`<h3>Joint care · ${esc(joints.map((j) => L(JOINTS[j]?.name) || j).join(" & "))}</h3>
    <p class="muted small" style="margin:-4px 0 10px">${pain.length ? "You flagged this exercise. It is hidden from plans and swaps." : `You flagged your ${esc(joints.map(jName).join(" & "))}. This exercise may bother it.`}</p>
    <div class="h4" style="margin-top:4px">Joint-friendly options</div>${alts.length ? hcards(alts) : `<p class="dim small">No safe alternative found for this muscle.</p>`}
    ${drills.length ? `<div class="h4">Do these first</div><div class="list-sep jcdrills">${drills.map((d) => `<div class="lrow plain"><span class="ico">${ic("flame", "sm")}</span><div class="grow"><div class="t">${esc(L(d.name))}</div><div class="s">${esc(L(d.how))}</div></div><span class="dim tiny num">${d.secs || 30}s</span></div>`).join("")}</div>
      <button class="btn sm" id="jcGo" style="margin-top:8px">${ic("play", "sm")} Start · ${Math.max(1, Math.round(secs / 60))} min</button>` : ""}
    ${J.map((j) => `<div class="h4">Go easy on your ${esc(L(j.name).toLowerCase())}</div><ul class="bul ok">${(L(j.tips) || []).slice(0, 3).map((t) => `<li>${ic("okc", "sm")}<span>${esc(t)}</span></li>`).join("")}</ul>`).join("")}
    <p class="dim small" style="margin-top:12px">${ic("alert", "xs")} ${esc(L(J[0]?.physio) || "If pain persists or is sharp, stop and see a physiotherapist.")}</p>
    ${pain.length ? `<button class="btn sm ghost" id="rmPain" style="margin-top:4px">Remove pain flag</button>` : ""}`, (el) => {
    const g = $("#jcGo", el); if (g) g.onclick = () => { closeSheet(); import("./warmup.js").then((m) => m.playDrills(`Joint warm-up · ${L(JOINTS[joints[0]]?.name)}`, drills.map((d) => d.id), location.hash)); };
    const rm = $("#rmPain", el); if (rm) rm.onclick = () => { delete S.pain[e.slug]; save("pain"); toast("Flag removed"); closeSheet(); rerenderDetail(e.slug); };
    el.querySelectorAll(".hcard").forEach((a) => a.addEventListener("click", () => closeSheet()));
  });
}

/* ---- hero: Video | Muscles (mannequin animation) ---- */
let libIO = null; // FE-16: library infinite-scroll observer
let heroMode = "video";
const paintBody = (e) => { const pri = e.primary || [], sec = e.secondary || [];
  return (svg) => svg.replace(/<path class="m" data-m="([^"]+)"/g, (m0, id) => `<path class="m ${pri.includes(id) ? "sel" : sec.includes(id) ? "sec" : ""}" data-m="${id}"`); };
/* exact-movement matches with an OpenGym3D motion (family -> anim id); everything else shows the still 3D body */
const MOVE3D = { "barbell-row": "bent_over_row", "dumbbell-curl": "bicep_curl", "hammer-curl": "hammer_curl", "standing-calf-raise": "calf_raise",
  "crunch": "crunch", "deadlift": "deadlift", "dumbbell-shoulder-press": "dumbbell_shoulder_press", "barbell-overhead-press": "overhead_press",
  "dumbbell-lateral-raise": "lateral_raise", "good-morning": "good_morning", "push-ups": "push_up", "reverse-lunge": "reverse_lunge",
  "walking-lunge": "lunge", "romanian-deadlift": "romanian_deadlift", "sumo-squat": "sumo_squat" };
const NOT_SAME = /twist|reverse grip|partial|pause|drops?\b|holds?|incline|decline|seated|elevated|single arm|one arm|1 arm|lying|kneeling|smith|cable|landmine|machine|3 way|deficit|spider|preacher|high elbow|lateral lunge|static|split|band|plate|lean/i;
/* 19b: our own keyframe motions (app/3d/poses/<family>.json); value = names that are NOT this exact movement */
const POSE3D = { "high-bar-squat": /heel|elevated|drops?\b|pause|safety|century/i, "shrug": NOT_SAME, "barbell-curl": /rocking|wall|cluster/i, "reverse-curl": /cable|seated|concentration|single|incline|wall|tri ?set|cluster/i,
  "upright-row": NOT_SAME, "rear-delt-raise": /barbell|partial|single|supinated|incline|lying|seated/i, "dips-chest": /hold|hs drop|rocking|between knees/i,
  "hanging-knee-raise": /rotation|straps|barbell/i, "hanging-leg-raise": /dip|roman|straps/i, "close-grip-press": /smith|coffin|elbows flared|tri-fecta/i,
  "sissy-squat": /heel|landmine|assisted|barbell sissy squat on/i, "split-squat": /heel|smith|landmine|drops?\b/i,
  "skull-crushers": /incline|reverse|45|tri-fecta|extreme/i, "dumbbell-skull-crushers": /incline|45|tri-fecta|full stretch/i,
  "lat-pulldown": /single arm|fixed elbow|straight bar/i, "close-grip-pulldown": /extreme/i,
  "flat-dumbbell-press": /rotating/i, "dumbbell-fly": /low|decline/i, "incline-dumbbell-press": /high incline|hammer|slight|hold|tucked/i,
  "incline-dumbbell-fly": /high|slight|clavicular/i, "barbell-incline-press": /slight/i, "incline-dumbbell-curl": /single|high/i,
  "seated-cable-row": /pronated|lat row|flexion|rolled/i, "bar-pushdown": /partials|over top/i, "cable-fly": /high to low|seated|cross midline/i,
  "dumbbell-row-bent-over": /wrap around|pronated/i,
  "pull-up": /dead|v-bar/i, "triceps-dips": /smith|straight bar/i, "cable-curl": /single|v-handle|extreme|elbows tucked/i,
  "rope-pushdown": /flared/i, "face-pull": /$^/, "cable-overhead-extension": /single|straight bar/i,
  "seated-leg-curl": /$^/, "leg-extension": /single|partial|3\/4/i,
  "hip-thrust": /smith/i, "one-arm-dumbbell-row": /pronated|prontated/i, "lying-leg-curl": /$^/, "seated-calf-raise": /single|partial|poor man/i,
  "cable-lateral-raise": /single|behind|lying|incline/i, "back-extension": /single|poor man/i, "t-bar-row": /machine|chest supported/i, "sumo-deadlift": /dumbbell/i,
  "low-bar-squat": /safety/i, "smith-squat": /heel/i, "preacher-curl": /flat side|poor man|single|tilt/i,
  "chest-supported-row": /one arm|tucked|90 degrees|lat row/i, "spider-curl": /high|hammer|^dumbbell spider curls$|^ez bar spider|^dumbbell spider "/i,
  "machine-chest-press": /decline|single/i, "machine-shoulder-press": /single/i, "leg-press": /single/i,
  "leg-press-calf-raise": /single/i, "chest-supported-high-elbow-row": /one arm|2 part|seal/i, "high-elbow-dumbbell-row": /bent over|wall/i,
  "concentration-curl": /$^/, "rear-delt-cable-fly": /seated|single|partial/i, "dumbbell-leg-curl": /kneeling|ground|hamstring curls/i,
  "behind-body-cable-curl": /incline|face out/i,
  "hack-squat": /pendulum|elevated|wide|cluster/i, "bulgarian-split-squat": /twist|leaned|glute focused/i, "front-squat": /dumbbell/i, "single-leg-squat": /landmine|hack/i, "nordic-curl": /tucked|use your hands|angled/i,
  "single-arm-cable-row": /bent|kneeling|high|pronated/i, "machine-row": /single|high elbow|roll/i, "incline-cable-extension": /slight|ez bar|elbows (back|high)/i,
  "assisted-pull-up": /close/i,
  "smith-incline-press": /slight|high|pause|tucked/i, "machine-incline-press": /single/i, "decline-press": /slight/i, "smith-shoulder-press": /60 degree/i,
  "seated-barbell-press": /$^/, "seated-cable-high-elbow-row": /pit shark/i, "machine-lateral-raise": /straight arm|single|standing/i,
  "wrist-curl": /cable|dual|angled/i, "wrist-extension": /cable|dual/i, "jm-press": /incline|neck/i, "hip-abduction": /$^/, "pendlay-row": /smith|high elbow/i,
  "neutral-dumbbell-press": /single/i, "supinated-dumbbell-press": /single/i, "machine-curl": /single/i, "machine-fly": /single|tilted/i,
  "machine-rear-delt-fly": /partial|single|high hands/i, "drag-curl": /cable|smith/i, "floor-press": /$^/,
  "dead-skulls": /$^/, "belt-squat": /$^/, "y-raise": /trx/i, "w-raise": /$^/, "machine-dips": /single/i,
  "step-up": /quad dominant|weighted/i, "bench-dips": /chest/i,
  "reverse-grip-press": /incline/i, "incline-lateral-raise": /hybrid|seated|facing bench/i, "incline-shrug": /bent|one arm|45 degree/i, "mid-trap-shrug": /1 arm|landmine|smith/i, "french-press": /3 way|standing|tri-f|dumbbell|incline/i,
  "hamstring-hyper": /barbell|single leg/i, "hanging-scapular-shrug": /v-bar|low trap/i, "pulldown-scapular-shrug": /v-bar/i, "incline-cable-fly": /slight|extreme/i,
  "hip-adduction": /$^/, "rear-delt-row": /lying|trx/i, "high-elbow-shrug": /machine/i, "cable-pullover": /incline|single/i, "kickback": /$^/,
  "lying-cable-curl": /$^/, "single-arm-pushdown": /internally|lateral head/i, "single-arm-overhead-extension": /pressed|bench/i,
  "bench-press": /$^/,
  "tibialis-raise": /plate/i, "glute-rdl": /stance|landmine|belt|split|twist/i, "incline-cable-pushdown": /$^/, "forearm-supination": /strap|cable/i,
  "one-arm-lat-row": /$^/, "landmine-rear-delt-raise": /$^/, "ball-hamstring-curl": /$^/,
  "spanish-squat": /$^/, "somersault-squat": /barbell|smith/i, "scoop-fly": /$^/, "arnold-rotation": /lying|incline/i, "raise-to-press": /$^/,
  "barrel-press": /incline/i, "viking-press": /poor man/i, "rear-delt-around-the-world": /fixed elbow/i, "single-leg-rdl": /$^/, "lateral-lunge": /elevated/i,
  "rear-delt-fly": /machine/i, "glute-hyper": /single/i, "forearm-drag-curl": /pinwheel/i, "front-delt-around-the-world": /$^/, "reverse-hyper": /$^/,
  "meadows-row": /$^/, "bench-assisted-pull-up": /$^/, "ball-knee-tuck": /$^/,
  "bodyweight-row": /$^/, "bodyweight-curl": /$^/, "bodyweight-triceps-extension": /$^/,
  "triceps-push-ups": /decline|incline/i, "deficit-push-ups": /$^/, "reverse-crunch": /pelvic|seated/i,
  "v-up": /bent knees/i, "ab-rollout": /$^/,
  "barbell-pullover": /incline/i, "dumbbell-pullover": /one arm|single/i, "decline-crunch": /sit-up/i,
  "cable-rotation": /$^/, "seated-bicycle": /$^/ };
export const move3d = (e) => { const m = MOVE3D[e.family]; if (m) return !NOT_SAME.test(e.name) ? m : null;
  const not = POSE3D[e.family]; return not && !not.test(e.name) ? "p:" + e.family : null; };
/** prop in the hands for the 3D motion, from the exercise's equipment */
const prop3d = (e) => { const q = [].concat(e.equipment || []).join(" "); return /dumbbell/i.test(q) ? "db" : /barbell|ez bar|plate/i.test(q) ? "bar" : null; };
let v3d = null, v3dView = "front";
/** Main / Helpers muscle names; doubles as the colour legend of the hero body. */
const musList = (e) => { const pri = e.primary || [], sec = e.secondary || [];
  return `<div class="mus-list hl"><div class="eyebrow">Main</div>${pri.map((m) => `<div><i style="background:var(--accent)"></i>${esc(MBY[m]?.name || m)}</div>`).join("") || `<div>${esc(e.group)}</div>`}
    ${sec.length ? `<div class="eyebrow">Helpers</div>${sec.map((m) => `<div><i style="background:var(--mus-2)"></i>${esc(MBY[m]?.name || m)}</div>`).join("")}` : ""}</div>`; };
const backFirst = (e) => { const f = bodySVG("front"); return (e.primary || []).filter((m) => f.includes(`data-m="${m}"`)).length < (e.primary || []).length / 2; };
/** 19a-fix: hero height = video aspect at full width (phone); remembered per exercise so Muscles/3D keep the same height. */
const ASPECT = new Map();
function fitHero(h, e) {
  const set = (r) => { if (!(r > 0)) return; ASPECT.set(e.slug, r); if (h.isConnected) { h.style.setProperty("--ar", r.toFixed(4)); h.classList.add("fit"); } };
  if (ASPECT.has(e.slug)) return set(ASPECT.get(e.slug));
  h.classList.remove("fit"); h.style.removeProperty("--ar");
  if (e.poster) { const im = new Image(); im.onload = () => set(im.naturalHeight / im.naturalWidth); im.src = e.poster; }
  return set;
}
function hero(e) {
  const h = $("#hero"); const hasFig = !!e.figure; const paint = paintBody(e);
  if (v3d) { v3d.dispose(); v3d = null; }
  const mode = heroMode === "3d" ? "3d" : heroMode === "fig" || !e.video ? "fig" : "video";
  const mv = move3d(e);
  h.classList.toggle("is3d", mode === "3d"); h.classList.toggle("isvid", mode === "video");
  h.innerHTML = `<div class="seg sm" id="hseg">${e.video ? `<button data-m="video" class="${mode === "video" ? "on" : ""}">Video</button>` : ""}<button data-m="fig" class="${mode === "fig" ? "on" : ""}">Muscles</button><button data-m="3d" class="${mode === "3d" ? "on" : ""}">3D</button></div>
    ${mode === "3d" ? `<div class="v3d" id="v3d"><span class="v3d-load muted small">Loading 3D…</span></div>
        <div class="v3d-bar"><div class="seg sm" id="v3dv">${["front", "side", "back"].map((k) => `<button data-v="${k}" class="${v3dView === k ? "on" : ""}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div>
        ${mv ? `<div class="row" style="gap:8px"><button class="v3d-play v3d-spd" id="v3ds" aria-label="Speed 1×">1×</button><button class="v3d-play" id="v3dp" aria-label="Pause">${ic("pause", "sm")}</button></div>` : ""}</div>
        <div class="v3d-zoom"><button class="v3d-play" data-z="1.4" aria-label="Zoom in">${ic("plus", "sm")}</button><button class="v3d-play" data-z="0.7" aria-label="Zoom out">${ic("minus", "sm")}</button></div>
        <span class="cap"><i style="background:var(--accent)"></i>Main <i style="background:color-mix(in oklab, var(--accent) 42%, #cdc7c2)"></i>Helpers${mv ? "" : ` · <span class="dim">still pose</span>`} · <a class="dim" href="https://github.com/AssiamahS/opengym3d" target="_blank" rel="noopener">OpenGym3D</a></span>`
    : mode === "video" ? `${e.poster ? `<img class="hbg" src="${e.poster}" alt="">` : ""}<video id="vid" src="${e.video}" poster="${e.poster}"${RM.matches ? "" : " autoplay"} muted loop playsinline preload="${RM.matches ? "metadata" : "auto"}"></video><div class="ctl"><button id="ppb" class="sq" aria-label="${RM.matches ? "Play" : "Pause"}">${ic(RM.matches ? "play" : "pause", "sm")}</button><button id="spd" aria-label="Playback speed 1×">${ic("speed", "sm")}<b>1×</b></button><button id="fsb" class="sq" aria-label="Full screen">${ic("fs", "sm")}</button></div>`
      : `<div class="hmus${hasFig ? " withfig" : ""}">${hasFig ? `<img class="fig" src="${e.figure}" alt="Animated figure of this movement, worked muscles in red">` : ""}
          <div class="mini-body">${hasFig ? paint(bodySVG(backFirst(e) ? "back" : "front")) : paint(bodySVG("front")) + paint(bodySVG("back"))}</div>${musList(e)}
          <div class="mzoom"><button class="v3d-play mfull" data-z="0" aria-label="Show the whole body">Full body</button><button class="v3d-play" data-z="0.7" aria-label="Zoom out">${ic("minus", "sm")}</button><button class="v3d-play" data-z="1.4" aria-label="Zoom in">${ic("plus", "sm")}</button></div></div>`}`;
  const v = $("#vid", h); const setAR = fitHero(h, e);
  if (v && setAR) v.addEventListener("loadedmetadata", () => v.videoWidth && setAR(v.videoHeight / v.videoWidth), { once: true });
  if (v) { // A11Y-5: pause/play (WCAG 2.2.2); no autoplay under reduced motion
    const pb = $("#ppb", h), syncP = () => { pb.innerHTML = ic(v.paused ? "play" : "pause", "sm"); pb.setAttribute("aria-label", v.paused ? "Play" : "Pause"); };
    pb.onclick = () => { haptic(); v.paused ? v.play().catch(() => {}) : v.pause(); }; v.onplay = v.onpause = syncP;
    const sp = [1, .5, .25]; let i = 0; const sb = $("#spd", h); sb.onclick = () => { i = (i + 1) % 3; v.playbackRate = sp[i]; $("b", sb).textContent = sp[i] + "×"; sb.setAttribute("aria-label", `Playback speed ${sp[i]}×`); haptic(); };
    const fb = $("#fsb", h), isFs = () => document.fullscreenElement === h || document.webkitFullscreenElement === h;
    const toggleFs = () => {
      haptic();
      if (isFs()) return (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      if (h.requestFullscreen) h.requestFullscreen({ navigationUI: "hide" }).then(() => { if (v.videoWidth > v.videoHeight) screen.orientation?.lock?.("landscape").catch(() => {}); }).catch(() => {});
      else if (h.webkitRequestFullscreen) h.webkitRequestFullscreen();
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iPhone Safari: native player only
    };
    fb.onclick = toggleFs;
    v.ondblclick = toggleFs; let lt = 0; v.addEventListener("touchend", (ev) => { const t = Date.now(); if (t - lt < 300) { ev.preventDefault(); toggleFs(); lt = 0; } else lt = t; });
    h.onfullscreenchange = h.onwebkitfullscreenchange = () => { const on = isFs(); h.classList.toggle("fs", on); fb.innerHTML = ic(on ? "fsx" : "fs", "sm"); fb.setAttribute("aria-label", on ? "Exit full screen" : "Full screen"); if (!on) screen.orientation?.unlock?.(); }; if (!RM.matches) v.play().catch(() => {}); }
  const hm = $(".hmus", h);
  if (hm) { // 18b: zoom into the body; opens framed on the worked muscles
    const pz = panZoom(hm, $$(".mini-body svg", hm));
    $(".mzoom", hm).onclick = (ev) => { const b = ev.target.closest("[data-z]"); if (!b) return; haptic(); +b.dataset.z ? pz.zoomBy(+b.dataset.z) : pz.full(); };
    requestAnimationFrame(() => hm.isConnected && pz.frame(e.primary?.length ? e.primary : e.secondary || []));
  }
  if (mode === "3d") {
    const box = $("#v3d", h);
    import("./view3d.js").then((m) => m.mount3d(box, { primary: e.primary || [], secondary: e.secondary || [], move: mv, view: v3dView, prop: prop3d(e) }))
      .then((c) => { if (!box.isConnected) return c.dispose(); v3d = c; $(".v3d-load", box)?.remove(); })
      .catch(() => { box.innerHTML = `<span class="v3d-load muted small">3D view is not available on this device.</span>`; });
    $("#v3dv", h).onclick = (ev) => { const b = ev.target.closest("button"); if (!b) return; v3dView = b.dataset.v; $$("#v3dv button", h).forEach((x) => x.classList.toggle("on", x === b)); indicate(h); v3d?.setView(v3dView); haptic(); };
    $(".v3d-zoom", h).onclick = (ev) => { const b = ev.target.closest("[data-z]"); if (b) { v3d?.zoomBy(+b.dataset.z); haptic(); } };
    const sb3 = $("#v3ds", h); if (sb3) sb3.onclick = () => { const r = sb3.textContent === "1×" ? .5 : 1; v3d?.setSpeed(r); sb3.textContent = `${r}×`; sb3.setAttribute("aria-label", `Speed ${r}×`); haptic(); };
    const pb = $("#v3dp", h); if (pb) pb.onclick = () => { if (!v3d) return; const on = v3d.togglePlay(); pb.innerHTML = ic(on ? "pause" : "play", "sm"); pb.setAttribute("aria-label", on ? "Pause" : "Play"); haptic(); };
  }
  const s = $("#hseg", h); if (s) s.onclick = (ev) => { const b = ev.target.closest("button"); if (!b || b.classList.contains("on")) return; heroMode = b.dataset.m; haptic(); hero(e); };
  requestAnimationFrame(() => indicate(h));
}

/* ---- block 22: "Show" a common mistake — wrong vs right; visual = credited clip (data/mistakes.json) or the body map, never an unrelated picture ---- */
let MK = null;
const loadMistakes = () => (MK ??= fetch("data/mistakes.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
/* 22c (2): motion for every mistake with a demo video = the exercise's own clip, looped + muted, marked RIGHT; no file (live site) -> body map */
const mvid = (e) => `<div class="mvwrap"><div class="mvid"><video src="${e.video}" poster="${e.poster}" muted loop playsinline${RM.matches ? " controls" : " autoplay"} preload="metadata"></video>
    <span class="mtag">${ic("okc", "sm")}Right</span></div><p class="dim small mcred">This is the movement done right. Compare it with the mistake above.</p></div>`;
/* 22c (3): body-position mistakes of the posed families = 3D WRONG | RIGHT loops ("wrong" variants in app/3d/poses/<family>.json) */
const poseWrong = (e, i) => { const mv = move3d(e); if (!mv?.startsWith("p:")) return null;
  return fetch(`3d/poses/${mv.slice(2)}.json`).then((r) => (r.ok ? r.json() : null)).then((P) => (P?.wrong?.[i] ? { mv, view: P.wrong[i].view || (P.yaw ? "front" : "side") } : null)).catch(() => null); };
const m3cell = (w) => `<div class="m3c ${w ? "no" : "ok"}"><span class="mtag${w ? " no" : ""}">${ic(w ? "x" : "okc", "sm")}${w ? "Wrong" : "Right"}</span></div>`;
/** wide sheet: both loops side by side, started together; narrow: one canvas + Wrong | Right switch (max 2 WebGL contexts, freed on close) */
function mount3dPair(el, e, i, pw) {
  const host = $(".m3d", el); if (!host) return;
  const two = host.clientWidth >= 460, ctl = {}, row = $(".m3row", host);
  row.innerHTML = two ? m3cell(1) + m3cell(0) : m3cell(1);
  const mount = (w, cell) => import("./view3d.js").then((m) => m.mount3d(cell, { primary: e.primary || [], secondary: e.secondary || [], move: pw.mv, view: pw.view, prop: prop3d(e), wrong: w ? i : null, pad: [36, 10] }))
    .then((c) => { if (!cell.isConnected) { c.dispose(); return null; } ctl[w] = c; return c; });
  el.closest("dialog")?.addEventListener("close", () => Object.values(ctl).forEach((c) => c?.dispose()), { once: true });
  const fail = () => { host.innerHTML = `<p class="dim small mcred">3D view is not available on this device.</p>`; };
  if (two) { const [a, b] = $$(".m3c", row); Promise.all([mount(1, a), mount(0, b)]).then((cs) => cs.forEach((c) => c?.restart())).catch(fail); return; }
  let cur = 1; mount(1, $(".m3c", row)).catch(fail);
  const seg = $(".m3seg", host); seg.hidden = false;
  seg.onclick = (ev) => { const b = ev.target.closest("button"); if (!b) return; const w = +b.dataset.w; if (w === cur) return; haptic(); cur = w;
    $$("button", seg).forEach((x) => x.classList.toggle("on", x === b)); ctl[1 - w]?.dispose(); delete ctl[1 - w];
    row.innerHTML = m3cell(w); mount(w, $(".m3c", row)).catch(fail); };
}
async function mistakeSheet(e, i) {
  const m = e.mistakes[i]; if (!m) return;
  const c = ((await loadMistakes()).fam || {})[e.family]?.[i]?.clip, paint = paintBody(e), pw = c ? null : await poseWrong(e, i);
  const bodyVis = `<div class="mini-body mbody">${paint(bodySVG("front"))}${paint(bodySVG("back"))}</div><p class="dim small mcred">Done right, the highlighted muscles do the work.</p>`;
  const vis = c ? `<div class="yt mclip"><iframe src="https://www.youtube-nocookie.com/embed/${esc(c.yt)}?start=${c.start | 0}&end=${c.end | 0}&autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1" title="Mistake demo" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
      <p class="dim small mcred">Clip: ${esc(c.credit || "")} · <a href="https://www.youtube.com/watch?v=${esc(c.yt)}&t=${c.start | 0}s" target="_blank" rel="noopener">Original at ${mmss(c.start)}</a></p>`
    : pw ? `<div class="m3d"><div class="seg sm m3seg" hidden><button class="on" data-w="1">Wrong</button><button data-w="0">Right</button></div><div class="m3row"></div>
      <p class="dim small mcred">3D: the mistake next to the right movement. Drag to turn.</p></div>`
    : e.video ? mvid(e) : bodyVis;
  openSheet(`<h3>Common mistake</h3>
    <div class="mwr"><div class="mw no"><div class="mwh">${ic("x", "sm")}Wrong</div><p>${esc(m.text)}</p></div>
      <div class="mw ok"><div class="mwh">${ic("okc", "sm")}Right</div><p>${esc(m.fix || "Follow the steps and cues above.")}</p></div></div>${vis}`,
    (el) => { if (pw) mount3dPair(el, e, i, pw); const v = $(".mvid video", el); if (v) v.onerror = () => { const b = v.closest(".mvwrap"); if (b) b.outerHTML = bodyVis; }; }, { half: !pw });
}

/* ---- tab panels ---- */
function panel(e) {
  const p = $("#dpanel"); p.style.animation = "none"; void p.offsetWidth; p.style.animation = "";
  if (dtab.cur === "how") {
    p.innerHTML = `<div id="tgt"></div>${e.about ? `<p class="muted" style="margin-bottom:12px">${esc(e.about)}</p>` : ""}
      ${e.steps.length ? `<ol class="steps">${e.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol>` : `<p class="dim">No written steps yet — follow the video.</p>`}
      ${e.cues.length ? `<div class="h4">Cues</div><ul class="bul ok">${e.cues.map((s) => `<li>${ic("okc", "sm")}<span>${esc(s)}</span></li>`).join("")}</ul>` : ""}
      ${e.mistakes.length ? `<div class="h4">Common mistakes</div><ul class="bul no">${e.mistakes.map((m, i) => `<li>${ic("x", "sm")}<span>${esc(m.text)}</span><button class="mshow" data-mi="${i}" aria-label="Show the fix">Show</button></li>`).join("")}</ul>` : ""}
      ${e.vnote ? `<div class="h4">This variation</div><p class="muted">${esc(e.vnote)}</p>` : ""}`;
    targets(e, p); $$(".mshow", p).forEach((b) => (b.onclick = () => { haptic(); mistakeSheet(e, +b.dataset.mi); }));
  } else if (dtab.cur === "stats") statsPanel(e, p);
  else rankPanel(e, p);
}
/** "Targets: Mid chest (sternal head)" — one expandable line at the top of How to. */
async function targets(e, p) {
  const H = await loadHeads(); const hits = [];
  for (const m of e.primary || []) {
    const hs = H.muscles?.[m]?.heads; if (!hs?.length) continue;
    const hit = hs.find((h) => h.match && new RegExp(h.match, "i").test(e.name)) || hs.find((h) => h.default); if (hit) hits.push(hit);
  }
  const box = $("#tgt", p); if (!box || !hits.length) return;
  box.innerHTML = `<details class="tgt"><summary>${ic("target", "sm")}<span class="grow">Targets: <b>${hits.map((h) => esc(L(h.name))).join(", ")}</b></span>${ic("down", "sm")}</summary>
    ${hits.map((h) => `<p><b>${esc(L(h.name))}</b> <span class="dim tiny">${esc(h.latin || "")}</span><br>${esc(L(h.about))}</p>`).join("")}</details>`;
}
/* Jeff's ranking moment (data/jeff.json: fam[family][video] = sec, ex[slug] = backup video) */
let JF = null;
const loadJeff = () => (JF ??= fetch("data/jeff.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
const mmss = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
function ytBox(id, t, title) {
  const url = `https://www.youtube.com/watch?v=${id}${t ? `&t=${t}s` : ""}`;
  if (!navigator.onLine) return `<div class="yt off"><div class="msg">${ic("alert", "sm")}<span>Needs internet</span><a href="${url}" target="_blank" rel="noopener">Open on YouTube</a></div></div>`;
  return `<button class="yt" data-yt="${id}" data-t="${t || 0}" aria-label="Play ${esc(title)}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="play">${ic("play")}</span>${t ? `<span class="at">${mmss(t)}</span>` : ""}</button>`;
}
async function rankPanel(e, p) {
  const J = await loadJeff(); const fam = FAM.families?.[e.family]?.title;
  let top = "";
  if (e.tierVideo) {
    const fv = J.fam?.[e.family] || {}; const vid = fv[e.tierVideo] != null ? e.tierVideo : Object.keys(fv)[0] || e.tierVideo;
    const t = fv[vid] || 0; const title = JEFF_VID[vid] || "Jeff Nippard";
    const group = EX.filter((x) => x.group === e.group && x.tier).sort(byTier); const k = group.indexOf(e) + 1;
    top = `<div class="rank">${tierBadge(e.tier)}<div class="grow"><b>${TIER_WORD[e.tier]}</b> <span class="dim small">· Jeff Nippard</span>${k ? `<div class="dim small">#${k} of ${group.length} ${esc(e.group.toLowerCase())} exercises</div>` : ""}</div><button class="linkbtn small" id="tierHelp">${ic("info", "xs")} Tiers</button></div>
      ${e.tierNote ? `<p class="muted" style="margin:8px 0 10px">${esc(e.tierNote)}</p>` : ""}
      ${ytBox(vid, t, title)}<div class="dim small ytcap">${esc(title)}${t && fam && !e.canonical ? ` · Jeff ranks the ${esc(fam)} version` : ""}</div>`;
  } else if (J.ex?.[e.slug]) {
    const b = J.ex[e.slug];
    top = `<div class="rank"><div class="grow"><b>Not ranked by Jeff</b><div class="dim small">Technique from ${esc(b.by)}</div></div></div>${ytBox(b.yt, b.t, b.title)}<div class="dim small ytcap">${esc(b.title)} · ${esc(b.by)}</div>`;
  } else top = `<p class="dim small" style="margin-top:4px">Not ranked by Jeff Nippard.</p>`;
  const alt = swaps(e, 8);
  p.innerHTML = `${top}
    <div class="h4">Alternatives <span class="dim small">same muscle, best tier first</span></div>
    ${alt.length ? hcards(alt) : `<p class="dim">No alternatives with your equipment.</p>`}
    <div class="h4">My notes</div><textarea id="note" class="input" placeholder="Seat height, grip, cues…">${esc(S.notes[e.slug] || "")}</textarea>`;
  const th = $("#tierHelp", p); if (th) th.onclick = () => { haptic(); tierInfo(); };
  const y = $(".yt[data-yt]", p); if (y) y.onclick = () => { haptic();
    y.outerHTML = `<div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/${y.dataset.yt}?start=${y.dataset.t}&autoplay=1&playsinline=1&rel=0&modestbranding=1" title="YouTube video" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`; };
  let nt; $("#note", p).oninput = (ev) => { clearTimeout(nt); nt = setTimeout(() => { S.notes[e.slug] = ev.target.value; (S.notesAt ||= {})[e.slug] = Date.now(); save("notes", "notesAt"); }, 400); };
}
function statsPanel(e, p) {
  p.innerHTML = historyHTML(e.slug); fillIll(p); wireHistory(p, e.slug);
}
/** Exercise history: e1RM chart + PRs + past sessions. Shared by the Stats tab and the session "History" sheet. */
export function historyHTML(slug) {
  const hist = history(slug), u = S.settings.unit;
  if (!hist.length) return `<div class="empty hist-empty"><div class="ill" data-ill="pr" style="max-width:120px"></div><div>No history yet. Log this exercise in a workout to see your records and progress here.</div></div>`;
  const best = bestOf(slug); let heavy = null, reps = null;
  for (const h of hist) for (const s of h.sets) {
    if (+s.w && (!heavy || +s.w > heavy.w || (+s.w === heavy.w && +s.r > heavy.r))) heavy = { w: +s.w, r: +s.r };
    if (+s.r && (!reps || +s.r > reps.r || (+s.r === reps.r && +s.w > reps.w))) reps = { w: +s.w, r: +s.r };
  }
  let rec = 0; const rows = hist.map((h) => { const v = Math.max(...h.sets.map((s) => e1rm(s.w, s.r))); const pr = v > rec; if (pr) rec = v; return { ...h, v, pr }; });
  const pts = rows.map((r) => r.v).filter(Boolean);
  const wr = (s) => (+s.w ? `${+s.w} × ${s.r || 0}` : `${s.r || 0} reps`);
  const tile = (l, v, sub) => `<div class="pr-t"><span>${l}</span><b class="num">${v}</b><small>${sub}</small></div>`;
  const list = [...rows].reverse();
  return `<div class="pr-row">${best ? tile("Best est. 1RM", `${best.e1rm}<i>${u}</i>`, `${best.w} × ${best.r}`) : tile("Best est. 1RM", "—", "bodyweight")}
      ${tile("Heaviest", heavy ? `${heavy.w}<i>${u}</i>` : "—", heavy ? `× ${heavy.r}` : "no weight")}
      ${tile("Most reps", reps ? `${reps.r}` : "—", reps && reps.w ? `at ${reps.w} ${u}` : "reps")}</div>
    ${pts.length > 1 ? `<div class="hist-ch"><div class="eyebrow">Est. 1RM · ${pts.length} sessions</div>${lineChart(pts, { h: 84, cls: "chart" })}
      <div class="chart-x"><span>${fmtDate(rows.find((r) => r.v).date, { month: "short", day: "numeric" })}</span><span>${fmtDate(rows.at(-1).date, { month: "short", day: "numeric" })}</span></div></div>` : ""}
    <div class="eyebrow" style="margin-top:14px">Past sessions</div>
    <div class="hist-list">${list.map((r, i) => `<div class="hist-r ${i >= 5 ? "more" : ""}"><span class="d">${fmtDate(r.date)}</span><span class="s num">${esc(r.sets.map(wr).join(", "))}${r.pr && r.v ? ` <em title="Record at the time">PR</em>` : ""}</span></div>`).join("")}</div>
    ${list.length > 5 ? `<button class="btn sm ghost block" data-h="all" style="margin-top:6px">Show all ${list.length}</button>` : ""}`;
}
export function wireHistory(el) {
  el.addEventListener("click", (ev) => { const b = ev.target.closest("[data-h]"); if (!b) return;
    if (b.dataset.h === "all") { el.querySelector(".hist-list")?.classList.add("open"); b.remove(); }
  });
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
      save("pain"); b.classList.toggle("on", cur.has(j)); b.querySelector("svg").outerHTML = ic(cur.has(j) ? "check" : "bandage", "sm ck");
    };
    $("#mAdd", el).onclick = () => { closeSheet(); setTimeout(() => T.addToWorkoutSheet(slug), 220); };
    $("#sheet").addEventListener("close", () => { if (BY[slug] && location.hash.includes(slug)) { rerenderDetail(slug); } }, { once: true });
  });
}
