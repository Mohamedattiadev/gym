// Workouts, level-based plans, workout editor, live session logger (beat last week + plateau auto-adjust), tools.
import { S, save, tomb, persist } from "./store.js";
import { $, $$, esc, ic, uid, ask, askText, openSheet, closeSheet, toast, haptic, beep, confetti, fmtDur, RM } from "./ui.js";
import { EX, BY, byTier, hasEquip, hurts, history, lastSets, bestOf, setsText, swaps, LEVEL_N, WEEK } from "./data.js";
import { e1rm, platesFor, plateColor, plateHeight, warmupSets, suggest } from "./calc.js";
import { go, redirect, setTop, tierBadge, restText, fillIll } from "./main.js";
import * as Tm from "./timer.js";

const view = () => $("#view");
export let pickMode = null;
const store = save; // FE-10: sync pushes from the save hook

/* ---------------- plans by level (slot-based, filled from S/A canonical exercises) ---------------- */
const SLOT = (group, pattern, sets, reps) => ({ group, pattern, sets, reps });
export const PLANS = [
  { id: "beg-fb", level: "beginner", name: "Full Body", days: 3, desc: "3 days a week · 2–3 sets · learn the movements", workouts: [
    ["Full Body A", [SLOT("Quads", "squat", 3, "6-10"), SLOT("Chest", "h-push", 3, "8-12"), SLOT("Lats", "v-pull", 3, "8-12"), SLOT("Hamstrings", "curl", 2, "10-12"), SLOT("Shoulders", "raise", 2, "12-15"), SLOT("Abs", "core", 2, "10-15")]],
    ["Full Body B", [SLOT("Hamstrings", "hinge", 3, "8-10"), SLOT("Shoulders", "v-push", 3, "8-12"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Quads", "lunge", 2, "10-12"), SLOT("Biceps", "curl", 2, "10-15"), SLOT("Triceps", "ext", 2, "10-15")]],
  ] },
  { id: "int-ul", level: "intermediate", name: "Upper / Lower", days: 4, desc: "4 days a week · each muscle twice a week", workouts: [
    ["Upper A", [SLOT("Chest", "h-push", 3, "6-10"), SLOT("Lats", "v-pull", 3, "8-12"), SLOT("Shoulders", "v-push", 2, "8-12"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Shoulders", "raise", 3, "12-15"), SLOT("Biceps", "curl", 2, "10-12"), SLOT("Triceps", "ext", 2, "10-12")]],
    ["Lower A", [SLOT("Quads", "squat", 3, "6-10"), SLOT("Hamstrings", "hinge", 3, "8-10"), SLOT("Quads", "ext", 2, "10-15"), SLOT("Hamstrings", "curl", 3, "10-12"), SLOT("Calves", "calf", 3, "10-15"), SLOT("Abs", "core", 3, "10-15")]],
    ["Upper B", [SLOT("Chest", "h-push", 3, "8-12"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Lats", "v-pull", 3, "10-12"), SLOT("Chest", "fly", 2, "10-15"), SLOT("Shoulders", "fly", 3, "12-15"), SLOT("Triceps", "ext", 2, "10-15"), SLOT("Biceps", "curl", 2, "10-15")]],
    ["Lower B", [SLOT("Quads", "lunge", 3, "8-12"), SLOT("Glutes", "hinge", 3, "8-12"), SLOT("Hamstrings", "curl", 3, "10-12"), SLOT("Glutes", "raise", 2, "12-20"), SLOT("Calves", "calf", 3, "10-15"), SLOT("Abs", "core", 2, "10-15")]],
  ] },
  { id: "adv-ppl", level: "advanced", name: "Push / Pull / Legs", days: 6, desc: "6 days a week (or 3) · more volume · isolations to failure", workouts: [
    ["Push", [SLOT("Chest", "h-push", 3, "6-10"), SLOT("Chest", "h-push", 3, "8-12"), SLOT("Shoulders", "v-push", 3, "8-12"), SLOT("Chest", "fly", 3, "10-15"), SLOT("Shoulders", "raise", 4, "12-20"), SLOT("Triceps", "ext", 3, "10-15")]],
    ["Pull", [SLOT("Lats", "v-pull", 3, "6-10"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Lats", "h-pull", 3, "10-12"), SLOT("Shoulders", "fly", 3, "12-20"), SLOT("Biceps", "curl", 3, "8-12"), SLOT("Biceps", "curl", 2, "12-15")]],
    ["Legs", [SLOT("Quads", "squat", 4, "6-10"), SLOT("Hamstrings", "hinge", 3, "8-10"), SLOT("Quads", "lunge", 3, "8-12"), SLOT("Hamstrings", "curl", 3, "10-15"), SLOT("Quads", "ext", 3, "12-15"), SLOT("Calves", "calf", 4, "10-15")]],
  ] },
];
const LEVEL_C = { beginner: "var(--ok)", intermediate: "var(--tier-B)", advanced: "var(--tier-A)" };
function fillSlot(slot, used, level) {
  const lv = LEVEL_N[level] || 2;
  const ok = (e) => e.video && hasEquip(e) && !hurts(e) && !used.has(e.slug);
  const pool = EX.filter((e) => ok(e) && e.group === slot.group && e.pattern === slot.pattern && (LEVEL_N[e.level] || 1) <= Math.max(lv, 2));
  const best = pool.filter((e) => e.canonical).sort(byTier)[0] || pool.sort(byTier)[0] || EX.filter((e) => ok(e) && e.group === slot.group).sort(byTier)[0];
  if (best) used.add(best.slug);
  return best;
}
export function buildPlan(p) {
  const used = new Set();
  return p.workouts.map(([name, slots]) => ({ id: uid(), name, plan: p.id, updatedAt: Date.now(),
    items: slots.map((s) => [s, fillSlot(s, used, p.level)]).filter(([, e]) => e).map(([s, e]) => ({ slug: e.slug, sets: s.sets, reps: s.reps })) }));
}

/* ---------------- train tab ---------------- */
export function nextWorkout() {
  if (!S.workouts.length) return null;
  const last = [...S.sessions].reverse().find((s) => s.workoutId);
  const i = last ? S.workouts.findIndex((w) => w.id === last.workoutId) : -1;
  return S.workouts[(i + 1) % S.workouts.length];
}
export function trainView() {
  setTop({ title: "Train" });
  view().innerHTML = `${S.active ? `<a class="hero-card live" href="#/session" style="display:block;margin-bottom:4px"><div class="eyebrow">In progress</div><h3>${esc(S.active.name)}</h3><div class="muted small">Tap to resume</div></a>` : ""}
    <div class="cols"><div>
      <div class="sec"><h2>My workouts</h2><button class="btn sm" id="newW">${ic("plus", "sm")} New</button></div>
      <div class="stack tight stagger">${S.workouts.map((w) => `<div class="wrow"><a class="grow" href="#/workout/${esc(w.id)}">
          <img src="${BY[w.items[0]?.slug]?.poster || ""}" alt="" data-hide-broken><div class="grow"><div class="b ellip">${esc(w.name)}</div><div class="dim small">${w.items.length} exercises · ${w.items.reduce((a, it) => a + +it.sets, 0)} sets</div></div></a>
          <button class="go-btn" data-start="${esc(w.id)}" aria-label="Start ${esc(w.name)}">${ic("play")}</button></div>`).join("") ||
        `<div class="card pad row" style="gap:14px;text-align:start"><div class="ill" data-ill="empty-workouts" style="width:84px;margin:0;flex:none"></div><div class="grow"><b>No workouts yet</b><div class="muted small">Use a plan for your level or create your own.</div></div></div>`}</div>
      ${S.active ? "" : `<button class="btn ghost block" id="quick" style="margin-top:6px">${ic("bolt", "sm")} Quick start — empty workout</button>`}
      <div class="sec"><h2>Tools</h2></div>
      <div class="itiles"><button class="itile" id="tPlates"><span class="ico">${ic("calc")}</span><div><b>Plates</b><span>What to load</span></div></button>
        <button class="itile" id="t1rm" style="--c:var(--tier-S)"><span class="ico">${ic("trophy")}</span><div><b>1RM</b><span>Estimate your max</span></div></button>
        <a class="itile" href="#/timer/countdown" style="--c:var(--info)"><span class="ico">${ic("timer")}</span><div><b>Timer</b><span>Rest countdown</span></div></a>
        <a class="itile" href="#/timer/interval" style="--c:var(--tier-A)"><span class="ico">${ic("bolt")}</span><div><b>Intervals</b><span>Tabata / EMOM</span></div></a>
        <a class="itile" href="#/warmup" style="--c:var(--accent)"><span class="ico">${ic("flame")}</span><div><b>Warm-up</b><span>Ramp-up, primers</span></div></a></div>
    </div><div>
      <div class="sec"><h2>Plans by level</h2><a href="#/start">Find my plan</a></div>
      <div class="stack tight stagger">${PLANS.map((p) => `<div class="plan-card"><div class="row"><span class="tag" style="color:${LEVEL_C[p.level]};background:color-mix(in oklab, ${LEVEL_C[p.level]} 14%, transparent)">${p.level}</span><span class="dim small grow">${p.workouts.length} workouts</span><a class="link small" href="#/plan/${p.id}" style="color:var(--accent-text);font-weight:600">How it works</a></div>
          <b>${p.name}</b><div class="muted small">${p.desc}</div>
          <div class="row" style="margin-top:6px"><button class="btn sm grow" data-preview="${p.id}">Preview</button><button class="btn sm primary grow" data-use="${p.id}">Use plan</button></div></div>`).join("")}</div>
    </div></div>`;
  view().onclick = (e) => {
    const st = e.target.closest("[data-start]"); if (st) return startSession(S.workouts.find((w) => w.id === st.dataset.start));
    const pv = e.target.closest("[data-preview]"); if (pv) return previewPlan(PLANS.find((p) => p.id === pv.dataset.preview));
    const us = e.target.closest("[data-use]"); if (us) return usePlan(PLANS.find((p) => p.id === us.dataset.use));
  };
  $("#newW").onclick = newWorkout;
  const q = $("#quick"); if (q) q.onclick = () => startSession(null);
  $("#tPlates").onclick = () => plateSheet(100); $("#t1rm").onclick = oneRmSheet;
}
async function newWorkout() { const n = await askText("New workout", { value: "Push Day", ok: "Create" }); if (!n) return null; const w = { id: uid(), name: n, items: [], updatedAt: Date.now() }; S.workouts.push(w); store("workouts"); go(`#/workout/${w.id}`); return w; }
function previewPlan(p) {
  const ws = buildPlan(p);
  openSheet(`<h3>${p.name}</h3><p class="muted small" style="margin:-6px 0 8px">${p.desc}</p>${ws.map((w) => `<div class="h4">${esc(w.name)}</div><div class="stack tight">
    ${w.items.map((it) => `<div class="lrow"><img src="${BY[it.slug].poster}" alt=""><div class="grow"><div class="t">${esc(BY[it.slug].name)}</div><div class="s">${it.sets} × ${it.reps}</div></div>${tierBadge(BY[it.slug].tier)}</div>`).join("")}</div>`).join("")}
    <button class="btn primary block" style="margin-top:16px" id="usePv">Use this plan</button>`, (el) => ($("#usePv", el).onclick = () => { closeSheet(); usePlan(p); }));
}
export function usePlan(p, redraw = true) {
  const ws = buildPlan(p);
  S.workouts.push(...ws); S.profile = { ...(S.profile || {}), level: p.level }; store("workouts", "profile");
  haptic("success"); toast(`Added ${ws.length} workouts`); if (redraw) { trainView(); fillIll(view()); }
}

/* ---------------- workout editor ---------------- */
export function workoutView(id) {
  const w = S.workouts.find((x) => x.id === id); if (!w) return redirect("#/train");
  setTop({ title: w.name, back: true, right: `<button class="iconbtn" id="wMore" aria-label="More">${ic("more")}</button>` });
  const touch = () => { w.updatedAt = Date.now(); store("workouts"); };
  view().innerHTML = `<div class="stack tight stagger" id="items">${w.items.map((it, i) => { const e = BY[it.slug]; return `<div class="edrow" data-i="${i}">
      <a href="#/ex/${it.slug}" aria-label="How to do ${esc(e?.name || it.slug)}"><img src="${e?.poster || ""}" alt=""></a>
      <div style="min-width:0"><div class="t clamp2">${esc(e?.name || it.slug)} ${tierBadge(e?.tier)}</div>
        <div class="row dim small" style="gap:6px;margin-top:6px"><input class="mini-in num" data-k="sets" value="${esc(it.sets)}" inputmode="numeric" aria-label="Sets"> sets ×
          <input class="mini-in w num" data-k="reps" value="${esc(it.reps)}" aria-label="Reps"> reps</div></div>
      <div class="acts"><button class="iconbtn sm" data-a="up" aria-label="Move up" ${i ? "" : "disabled"}>${ic("up", "sm")}</button><button class="iconbtn sm" data-a="del" aria-label="Remove" style="color:var(--t3)">${ic("trash", "sm")}</button></div></div>`; }).join("") ||
      `<div class="card pad" style="text-align:center"><div class="ill" data-ill="plan" style="max-width:140px"></div><b>No exercises yet</b><div class="muted small">Add a few from the library.</div></div>`}</div>
    <button class="btn block" id="add" style="margin-top:12px">${ic("plus", "sm")} Add exercises</button>
    <div class="sticky-cta"><button class="btn primary" id="start" ${w.items.length ? "" : "disabled"}>${ic("play", "sm")} Start workout</button></div>`;
  document.body.classList.add("has-cta");
  const items = $("#items");
  items.onclick = (e) => {
    const b = e.target.closest("button[data-a]"); if (!b) return; haptic();
    const i = +b.closest("[data-i]").dataset.i;
    if (b.dataset.a === "del") { const old = structuredClone(w.items); w.items.splice(i, 1); touch(); workoutView(id); fillIll(view());
      toast("Exercise removed", 1900, { label: "Undo", fn: () => { w.items = old; touch(); workoutView(id); } }); return; }
    if (b.dataset.a === "up" && i > 0) [w.items[i - 1], w.items[i]] = [w.items[i], w.items[i - 1]];
    touch(); workoutView(id);
  };
  items.onchange = (e) => { const inp = e.target.closest("input"); if (!inp) return; const it = w.items[+inp.closest("[data-i]").dataset.i];
    it[inp.dataset.k] = inp.dataset.k === "sets" ? Math.max(1, Math.min(12, parseInt(inp.value) || 1)) : inp.value.trim() || it.reps; touch(); };
  $("#add").onclick = () => { pickMode = { workoutId: id, selected: new Set() }; go("#/pick"); };
  $("#start").onclick = () => startSession(w);
  $("#wMore").onclick = () => openSheet(`<h3>${esc(w.name)}</h3><div class="menu"><button id="ren">${ic("edit", "sm")}Rename</button><button id="dup">${ic("copy", "sm")}Duplicate</button><button class="danger" id="del">${ic("trash", "sm")}Delete workout</button></div>`, (el) => {
    $("#ren", el).onclick = async () => { const n = await askText("Rename workout", { value: w.name }); if (n) { w.name = n; touch(); workoutView(id); } };
    $("#dup", el).onclick = () => { S.workouts.push({ ...structuredClone(w), id: uid(), name: w.name + " (copy)", updatedAt: Date.now() }); store("workouts"); closeSheet(); toast("Duplicated"); };
    $("#del", el).onclick = async () => { if (await ask(`Delete “${w.name}”?`, { ok: "Delete", danger: true })) { const old = S.workouts; S.workouts = S.workouts.filter((x) => x !== w); tomb("workouts", w.id); store("workouts"); go("#/train"); toast("Workout deleted", 1900, { label: "Undo", fn: () => { S.workouts = old; tomb("workouts", w.id, true); store("workouts"); go(`#/workout/${w.id}`); } }); } };
  });
}
export function finishPick() {
  const { workoutId, selected, toSession } = pickMode; pickMode = null;
  if (toSession && S.active) { selected.forEach((s) => S.active.entries.push(newEntry(s, 3))); save("active"); go("#/session"); return; }
  const w = S.workouts.find((x) => x.id === workoutId);
  if (w) { selected.forEach((slug) => { const e = BY[slug]; w.items.push({ slug, sets: 3, reps: `${e.repRange[0]}-${e.repRange[1]}` }); }); w.updatedAt = Date.now(); }
  store("workouts"); go(`#/workout/${workoutId}`);
}
export function addToWorkoutSheet(slug) {
  openSheet(`<h3>Add to…</h3><div class="menu">
    ${S.active ? `<button data-a="now">${ic("bolt", "sm")}Current workout</button>` : ""}
    ${S.workouts.map((w) => `<button data-w="${w.id}">${ic("dumbbell", "sm")}<span class="grow">${esc(w.name)}</span><span class="dim small">${w.items.length}</span></button>`).join("")}
    <button data-a="new">${ic("plus", "sm")}New workout</button></div>`, (el) => {
    el.onclick = async (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.a === "now") { addToSession(slug); closeSheet(); toast("Added to current workout"); return; }
      let w;
      if (b.dataset.a === "new") { const n = await askText("New workout", { value: "Push Day", ok: "Create" }); if (!n) return; w = { id: uid(), name: n, items: [] }; S.workouts.push(w); }
      else w = S.workouts.find((x) => x.id === b.dataset.w);
      if (!w) return; const ex = BY[slug];
      w.items.push({ slug, sets: 3, reps: `${ex.repRange[0]}-${ex.repRange[1]}` }); w.updatedAt = Date.now(); store("workouts"); haptic("success"); closeSheet(); toast(`Added to ${w.name}`);
    };
  });
}
export function addToSession(slug) { if (!S.active) return; S.active.entries.push(newEntry(slug, 3)); save("active"); }

/* ---------------- plateau detection (best e1RM not beaten for ≥3 weeks and ≥3 sessions) ---------------- */
export function stalledWeeks(slug, now = Date.now()) {
  const h = history(slug); if (h.length < 3) return 0;
  let best = 0, bestT = 0;
  for (const x of h) { const v = Math.max(...x.sets.map((s) => e1rm(s.w, s.r))); if (v > best) { best = v; bestT = x.date; } }
  const after = h.filter((x) => x.date > bestT).length, wk = (now - bestT) / WEEK;
  return after >= 3 && wk >= 3 ? Math.floor(wk) : 0;
}
const parseRange = (r) => { const m = String(r || "").match(/(\d+)\s*[-–]\s*(\d+)/); return m ? [+m[1], +m[2]] : null; };
function plateauAdjust(w) {
  if (!w) return [];
  S.adjust ||= {};
  const changes = [];
  w.items.forEach((it, i) => {
    const wk = stalledWeeks(it.slug); if (!wk) return;
    const prev = S.adjust[it.slug]; if (prev && Date.now() - prev.at < 3 * WEEK) return; // give the last change time to work
    const ex = BY[it.slug]; if (!ex) return;
    if (!prev || prev.kind === "swap") {
      const [lo] = parseRange(it.reps) || ex.repRange; const to = lo <= 8 ? "10-12" : "6-8";
      changes.push({ i, kind: "reps", slug: it.slug, from: it.reps, to, wk });
    } else {
      const alt = swaps(ex, 8).find((x) => x.family !== ex.family) || swaps(ex, 1)[0];
      if (alt) changes.push({ i, kind: "swap", slug: it.slug, from: it.slug, to: alt.slug, wk });
    }
  });
  if (!changes.length) return [];
  const before = { items: structuredClone(w.items), adjust: structuredClone(S.adjust) };
  for (const c of changes) {
    if (c.kind === "reps") w.items[c.i].reps = c.to; else w.items[c.i].slug = c.to;
    S.adjust[c.kind === "swap" ? c.to : c.slug] = { at: Date.now(), kind: c.kind, from: c.from, to: c.to, wk: c.wk };
  }
  w.updatedAt = Date.now(); store("workouts", "adjust");
  changes.before = before;
  return changes;
}

/* ---------------- session ---------------- */
function newEntry(slug, n, target) {
  const ex = BY[slug];
  return { slug, target: target || (ex ? `${ex.repRange[0]}-${ex.repRange[1]}` : ""), deload: stalledWeeks(slug) >= 5,
    sets: Array.from({ length: +n || 3 }, () => ({ w: "", r: "", done: false, type: "n" })) };
}
export async function startSession(w) {
  if (S.active && !(await ask("A workout is already in progress. Replace it?", { ok: "Replace", danger: true }))) return;
  const ch = plateauAdjust(w);
  S.active = { id: uid(), workoutId: w?.id || null, name: w?.name || "Workout", startedAt: Date.now(),
    entries: (w?.items || []).map((it) => newEntry(it.slug, it.sets, it.reps)) };
  save("active"); haptic("success"); go("#/session");
  if (ch.length) {
    const msg = ch.length > 1 ? `Plateau: adjusted ${ch.length} exercises` : ch[0].kind === "reps" ? `Plateau: ${BY[ch[0].slug]?.name} → ${ch[0].to} reps` : `Plateau: swapped to ${BY[ch[0].to]?.name}`;
    setTimeout(() => toast(msg, 6000, { label: "Undo", fn: () => {
      w.items = ch.before.items; S.adjust = ch.before.adjust; w.updatedAt = Date.now(); store("workouts", "adjust");
      if (S.active?.workoutId === w.id && !S.active.entries.some((en) => en.sets.some((s) => s.done))) { S.active.entries = w.items.map((it) => newEntry(it.slug, it.sets, it.reps)); save("active"); if (location.hash === "#/session") sessionView(); }
      toast("Change undone");
    } }), 350);
  }
}
let clockT, wakeLock, gi = 0; // gi = current exercise in Gym mode
async function keepAwake() { try { wakeLock = await navigator.wakeLock?.request("screen"); } catch {} }
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.active && location.hash === "#/session") keepAwake(); });

function stats() {
  let sets = 0, vol = 0;
  S.active.entries.forEach((en) => en.sets.forEach((s) => { if (s.done && s.type !== "w") { sets++; vol += (+s.w || 0) * (+s.r || 0); } }));
  return { sets, vol: Math.round(vol) };
}
export function sessionView() {
  const a = S.active; if (!a) return redirect("#/train");
  keepAwake();
  setTop({ title: a.name, back: true, right: `<button class="btn sm primary" id="finTop">Finish</button>` });
  const st = stats(), u = S.settings.unit, gym = !!S.settings.gym && a.entries.length > 0;
  if (gym) { gi = Math.min(gi, a.entries.length - 1); if (a.entries[gi]?.sets.every((x) => x.done)) { const k = a.entries.findIndex((en) => en.sets.some((x) => !x.done)); if (k >= 0) gi = k; } }
  view().classList.toggle("gym", gym);
  view().innerHTML = `
    <div class="sess-head"><div><div class="eyebrow">Time</div><div class="sess-clock num" id="clock">0:00</div></div>
      <div class="sess-stats"><div><b class="num" id="stSets">${st.sets}</b>sets</div><div><b class="num" id="stVol">${st.vol}</b>${u}</div></div>
      <button class="btn sm ${gym ? "primary" : ""}" id="gymT" aria-pressed="${gym}">${ic("phone", "sm")} Gym mode</button></div>
    ${!a.warmed && !a.noWarm && a.entries.length && !a.entries.some((en) => en.sets.some((x) => x.done)) ? `<div class="notice acc" id="warmN" style="margin-bottom:12px">${ic("flame", "sm")}<div class="grow"><b>Warm up first</b><div class="small muted">About 6 min, made for this workout</div></div><a class="btn sm primary" href="#/warmup/s">Start</a><button class="iconbtn sm" id="warmX" aria-label="Skip warm-up">${ic("close", "sm")}</button></div>` : ""}
    ${gym ? `<div class="gnav"><button class="iconbtn filled" id="gPrev" aria-label="Previous exercise" ${gi ? "" : "disabled"}>${ic("back")}</button><b class="num">Exercise ${gi + 1} of ${a.entries.length}</b><button class="iconbtn filled fwd" id="gNext" aria-label="Next exercise" ${gi < a.entries.length - 1 ? "" : "disabled"}>${ic("back")}</button></div>` : ""}
    <div class="sess-grid"><div class="sess-main">
    <div class="stack" id="entries">${a.entries.map((en, ei) => entryHTML(en, ei)).join("") || `<div class="card pad" style="text-align:center"><div class="ill" data-ill="hero-start" style="max-width:140px"></div><b>Empty workout</b><div class="muted small">Add your first exercise.</div></div>`}</div>
    <button class="btn block" id="addEx" style="margin-top:12px">${ic("plus", "sm")} Add exercise</button>
    <div class="row" style="margin-top:10px"><button class="btn ghost grow danger" id="disc">Discard</button><button class="btn primary grow" id="fin">${ic("check", "sm")} Finish workout</button></div></div>
    <aside class="sess-side" id="sside" aria-label="Current exercise"></aside></div>`;
  clearInterval(clockT);
  const tick = () => { const c = $("#clock"); if (!c || !S.active) return clearInterval(clockT); c.textContent = fmtDur(Date.now() - S.active.startedAt); };
  tick(); clockT = setInterval(tick, 1000);
  const wx = $("#warmX"); if (wx) wx.onclick = () => { a.noWarm = true; save("active"); $("#warmN")?.remove(); };
  wireSession(); sideCur = -1; side();
}
/* 22b part 4b: wide screens (>= 1200 px) — sticky right column: current exercise video, next set, workout progress */
const WIDE = matchMedia("(min-width: 1200px)");
let sideCur = -1, sideSlug = "";
function curEntry() {
  const en = S.active?.entries || []; if (!en.length) return -1;
  if (sideCur >= 0 && en[sideCur]?.sets.some((x) => !x.done)) return sideCur;
  const k = en.findIndex((x) => x.sets.some((s) => !s.done)); return k >= 0 ? k : en.length - 1;
}
function side() {
  const el = $("#sside"), a = S.active; if (!el || !a) return;
  if (!WIDE.matches || !a.entries.length) { el.innerHTML = ""; sideSlug = ""; return; }
  const ei = curEntry(), en = a.entries[ei], e = BY[en.slug], u = S.settings.unit;
  const k = en.sets.findIndex((x) => !x.done), work = en.sets.filter((x) => x.type !== "w");
  let now;
  if (k < 0) now = `<b>All sets done</b>`;
  else { const s = en.sets[k], warm = s.type === "w", n = warm ? 0 : en.sets.slice(0, k + 1).filter((x) => x.type !== "w").length, tg = warm ? null : planOf(en).tgt(n);
    const w = s.w || tg?.w, r = s.r || tg?.r;
    now = `<b>${warm ? "Warm-up set" : `Set ${n} of ${work.length}`}</b>${r ? `<span class="num">${w ? `${esc(w)} ${u} × ${esc(r)}` : `${esc(r)} reps`}</span>` : ""}`; }
  if (sideSlug !== en.slug || !el.firstElementChild) {
    sideSlug = en.slug;
    el.innerHTML = `<div class="card sside"><a class="sv" href="#/ex/${en.slug}" aria-label="How to do ${esc(e?.name || en.slug)}">${e?.poster ? `<img class="hbg" src="${e.poster}" alt="">` : ""}${e?.video ? `<video src="${e.video}" poster="${e?.poster || ""}"${RM.matches ? "" : " autoplay"} muted loop playsinline preload="metadata"></video>` : e?.poster ? `<img src="${e.poster}" alt="">` : ""}</a>
      <div class="sbody"><div class="eyebrow">Now</div><div class="st">${esc(e?.name || en.slug)}</div><div class="snow" id="snow"></div>
        <div class="row" style="gap:8px;margin-top:10px"><a class="btn sm" href="#/ex/${en.slug}">${ic("info", "sm")} How to</a><button class="btn sm" data-go="${ei}">${ic("chev", "sm")} Go to sets</button></div></div></div>
      <div class="card sprog"><div class="eyebrow">Workout</div><div id="slist"></div></div>`;
  }
  $("#snow", el).innerHTML = now;
  $("[data-go]", el).dataset.go = ei;
  $("#slist", el).innerHTML = a.entries.map((x, i) => { const d = x.sets.filter((s) => s.done && s.type !== "w").length, t = x.sets.filter((s) => s.type !== "w").length;
    return `<button class="sitem${i === ei ? " on" : ""}${t && d >= t ? " done" : ""}" data-go="${i}"><span class="grow">${esc(BY[x.slug]?.name || x.slug)}</span><span class="num">${d}/${t}</span></button>`; }).join("");
  el.onclick = (ev) => { const b = ev.target.closest("[data-go]"); if (!b) return;
    const blk = $(`#entries [data-ei="${b.dataset.go}"]`); if (!blk) return; sideCur = +b.dataset.go; side();
    blk.scrollIntoView({ block: "start", behavior: RM.matches ? "auto" : "smooth" });
    const inp = blk.querySelector('.setrow:not(.done) input[data-k="w"]'); inp?.focus({ preventScroll: true }); };
}
WIDE.addEventListener("change", () => { if (location.hash === "#/session") { sideSlug = ""; side(); } });
/* per-set plan: previous value (same working-set index last time) + today's target (double progression, deload = ~60%) */
const wStep = (ex) => (ex && (ex.equipment.includes("Barbell") || ex.equipment.includes("Smith")) ? 2.5 : ex?.equipment.includes("Dumbbell") ? 2 : 2.5);
function planOf(en) {
  const e = BY[en.slug], last = lastSets(en.slug), tr = parseRange(en.target) || e?.repRange || null;
  const sug = e && last ? suggest({ ...e, repRange: tr || e.repRange }, last.sets) : null;
  const top = last ? last.sets.reduce((a, x) => (+x.w > +a.w ? x : a), last.sets[0]) : null, st = wStep(e);
  const prev = (n) => last?.sets[n - 1] || null;
  const tgt = (n) => { // n = working-set number (1-based)
    const p = prev(n) || last?.sets.at(-1);
    if (!p) return { w: "", r: tr ? String(tr[1]) : "" };
    if (en.deload) return { w: +p.w ? String(Math.round(+p.w * 0.6 / st) * st) : "", r: String(p.r || "") };
    if (sug?.up) return { w: String(sug.w || ""), r: String(tr ? tr[0] : p.r) };
    return { w: String(p.w || ""), r: String(Math.min(tr ? tr[1] : 99, (+p.r || 0) + 1)) };
  };
  return { e, last, sug, top, tr, prev, tgt };
}
const wr = (w, r, u = "") => `${+w ? `${w}${u ? " " + u : ""} × ` : ""}${r}`;
export const restOf = (en) => S.settings.restEx?.[en.slug] ?? BY[en.slug]?.rest ?? S.settings.restDefault;
const restLbl = (sec) => (sec ? restText(sec) : "off");
function entryHTML(en, ei) {
  const P = planOf(en), e = P.e, last = P.last, u = S.settings.unit;
  const allDone = en.sets.length && en.sets.every((s) => s.done);
  const barb = e && (e.equipment.includes("Barbell") || e.equipment.includes("Smith"));
  const act = en.sets.findIndex((s) => !s.done);
  const t1 = P.tgt(1);
  let n = 0;
  const ssIn = S.active.entries[ei - 1]?.ss, ssOut = en.ss && S.active.entries[ei + 1];
  return `<div class="xblock ${allDone ? "done-all" : ""} ${S.settings.gym && ei === gi ? "cur" : ""} ${ssOut ? "ss-out" : ""} ${ssIn ? "ss-in" : ""}" data-ei="${ei}">
    ${ssOut ? `<div class="ss-tag">${ic("swap", "xs")} Superset with next — no rest between</div>` : ""}
    <div class="xhead"><a href="#/ex/${en.slug}" aria-label="How to do ${esc(e?.name || en.slug)}"><img src="${e?.poster || ""}" alt=""></a>
      <div class="grow"><div class="t">${esc(e?.name || en.slug)}</div>
        <div class="hint">${tierBadge(e?.tier)}<span>${esc(en.target || "")} reps ·</span><button class="restb" data-a="rest" aria-label="Change rest time">rest ${restLbl(restOf(en))}</button></div>
        ${last ? `<div class="hint"><span class="beat">${ic("target")}Today: ${wr(t1.w, t1.r, u)}</span><span class="dim">(last: ${wr(P.top.w, P.top.r)})</span></div>` : `<div class="hint">First time — pick a weight you can do ${P.tr ? P.tr[1] : 10} times with good form.</div>`}
        ${en.deload ? `<div class="hint" style="color:var(--warn)">${ic("alert", "xs")}<span class="grow">Stalled 5+ weeks — deload: ~60% weight today, then build back up.</span></div>` : ""}</div>
      <button class="iconbtn sm" data-a="menu" aria-label="Options">${ic("more")}</button></div>
    <div class="set-hdr"><span>Set</span><span>Previous</span><span>${u}</span><span>Reps</span><span></span></div>
    <div class="sets">${en.sets.map((s, si) => { const warm = s.type === "w"; if (!warm) n++; const pv = warm ? null : P.prev(n), tg = warm ? { w: "", r: "" } : P.tgt(n);
      return `<div class="setrow ${s.done ? "done" : ""} ${si === act ? "act" : ""}" data-si="${si}">
      <button class="n ${warm ? "w" : ""}" data-a="type" aria-label="Set type">${warm ? "W" : n}</button>
      ${pv ? `<button class="prev num" data-a="prev" data-w="${esc(pv.w)}" data-r="${esc(pv.r)}" aria-label="Same as last time: ${esc(wr(pv.w, pv.r, u))}">${esc(wr(pv.w, pv.r))}</button>` : `<span class="prev dim">—</span>`}
      <div class="stepper"><input data-k="w" inputmode="decimal" enterkeyhint="next"${barb ? ' title="Hold for plates"' : ""} placeholder="${esc(tg.w || "kg")}" value="${esc(s.w)}" aria-label="Weight"></div>
      <div class="stepper"><input data-k="r" inputmode="numeric" enterkeyhint="done" placeholder="${esc(tg.r || "—")}" value="${esc(s.r)}" aria-label="Reps"></div>
      <button class="check" data-a="done" aria-pressed="${!!s.done}" aria-label="Set ${warm ? "warm-up" : n} done">${ic("check")}</button>
      <div class="stepline"><div><button data-a="w-" aria-label="Less weight">−</button><span>${wStep(e)} ${u}</span><button data-a="w+" aria-label="More weight">+</button></div>
        <div><button data-a="r-" aria-label="Fewer reps">−</button><span>1 rep</span><button data-a="r+" aria-label="More reps">+</button></div></div></div>`; }).join("")}</div>
    <div class="xtools"><button class="btn sm" data-a="add">${ic("plus", "sm")} Set</button><button class="btn sm" data-a="warm">${ic("flame", "sm")} Warm-up</button>
      ${barb ? `<button class="btn sm" data-a="plates">${ic("calc", "sm")} Plates</button>` : ""}<button class="btn sm" data-a="swap">${ic("swap", "sm")} Swap</button></div>
    ${S.settings.gym && allDone && ei < S.active.entries.length - 1 ? `<button class="btn primary block big" data-a="next">Next exercise ${ic("chev", "sm")}</button>` : ""}</div>`;
}
let lpFired = 0;
function wireSession() {
  const a = S.active; const box = $("#entries");
  const refreshStats = () => { const st = stats(); $("#stSets").textContent = st.sets; $("#stVol").textContent = st.vol; };
  const rerender = (ei) => { const old = box.querySelector(`[data-ei="${ei}"]`); if (old) old.outerHTML = entryHTML(a.entries[ei], ei); };
  box.oninput = (e) => {
    const inp = e.target.closest("input"); if (!inp) return;
    const en = a.entries[+inp.closest("[data-ei]").dataset.ei]; en.sets[+inp.closest("[data-si]").dataset.si][inp.dataset.k] = inp.value.replace(",", ".");
    save("active");
  };
  box.addEventListener("focusin", (e) => { const b = e.target.closest("[data-ei]"); if (b && +b.dataset.ei !== sideCur) { sideCur = +b.dataset.ei; side(); } });
  box.addEventListener("click", () => setTimeout(side, 0));
  box.addEventListener("focusin", (e) => { const row = e.target.closest(".setrow"); if (!row || row.classList.contains("act")) return;
    row.parentElement.querySelectorAll(".setrow.act").forEach((x) => x.classList.remove("act")); row.classList.add("act"); });
  // keyboard entry: ↑/↓ = ± one step (weight step / 1 rep), Enter in kg -> reps; Enter in reps (mouse/keyboard devices) = set done -> next set's kg
  box.addEventListener("keydown", (e) => {
    const inp = e.target.closest?.(".setrow input[data-k]"); if (!inp || e.altKey || e.ctrlKey || e.metaKey) return;
    const row = inp.closest(".setrow"), k = inp.dataset.k;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); row.querySelector(`[data-a="${k}${e.key === "ArrowUp" ? "+" : "-"}"]`)?.click(); inp.select(); return; }
    if (e.key !== "Enter") return; e.preventDefault();
    if (k === "w") { const r = row.querySelector('[data-k="r"]'); r.focus(); r.select(); return; }
    if (matchMedia("(pointer: coarse)").matches) { inp.blur(); return; }
    const ei = +row.closest("[data-ei]").dataset.ei, wasDone = row.classList.contains("done");
    if (!wasDone) row.querySelector('[data-a="done"]')?.click();
    setTimeout(() => { const nx = box.querySelector(`[data-ei="${ei}"] .setrow:not(.done) input[data-k="w"]`) || box.querySelector('.setrow:not(.done) input[data-k="w"]');
      if (nx) { nx.focus({ preventScroll: true }); nx.select(); nx.scrollIntoView({ block: "nearest", behavior: RM.matches ? "auto" : "smooth" }); } }, 60);
  });
  let lp = null; // long-press the kg box on barbell/Smith lifts -> plate calculator
  const lpEnd = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
  box.addEventListener("pointerdown", (e) => {
    const inp = e.target.closest('input[data-k="w"]'); if (!inp || (e.pointerType === "mouse" && e.button)) return;
    const ex = BY[a.entries[+inp.closest("[data-ei]").dataset.ei]?.slug]; if (!ex || !(ex.equipment.includes("Barbell") || ex.equipment.includes("Smith"))) return;
    lpEnd(); lp = { x: e.clientX, y: e.clientY, t: setTimeout(() => { lp = null; lpFired = Date.now(); haptic(); inp.blur(); window.getSelection?.()?.removeAllRanges();
      plateSheet(+(inp.value.replace(",", ".")) || +ph(inp.closest(".setrow"), "w") || 60); }, 500) };
  });
  box.addEventListener("pointermove", (e) => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) lpEnd(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((t) => box.addEventListener(t, lpEnd));
  box.addEventListener("scroll", lpEnd, { passive: true, capture: true });
  box.addEventListener("contextmenu", (e) => { if (Date.now() - lpFired < 900 && e.target.closest('input[data-k="w"]')) e.preventDefault(); });
  const ph = (row, k) => { const v = row.querySelector(`[data-k="${k}"]`).placeholder; return /^\d+([.,]\d+)?$/.test(v) ? v : ""; };
  box.onclick = async (e) => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const blk = b.closest("[data-ei]"); const ei = +blk.dataset.ei; const en = a.entries[ei]; const ex = BY[en.slug];
    const row = b.closest("[data-si]"); const si = row ? +row.dataset.si : -1; const s = row ? en.sets[si] : null;
    const act = b.dataset.a; haptic();
    if (act === "w+" || act === "w-") { const step = wStep(ex);
      s.w = String(Math.max(0, Math.round(((+s.w || +ph(row, "w") || 0) + (act === "w+" ? step : -step)) * 100) / 100)); row.querySelector('[data-k="w"]').value = s.w; save("active"); return; }
    if (act === "r+" || act === "r-") { s.r = String(Math.max(0, (+s.r || +ph(row, "r") || 0) + (act === "r+" ? 1 : -1))); row.querySelector('[data-k="r"]').value = s.r; save("active"); return; }
    if (act === "type") { s.type = s.type === "w" ? "n" : "w"; save("active"); rerender(ei); return; }
    if (act === "rest") return restSheet(ei);
    if (act === "prev" || act === "done") {
      if (act === "prev") { s.w = b.dataset.w || ""; s.r = b.dataset.r || ""; if (s.done) { save("active"); rerender(ei); refreshStats(); return; } }
      if (!s.w) s.w = ph(row, "w"); if (!s.r) s.r = ph(row, "r");
      s.done = !s.done; save("active");
      if (s.done) {
        haptic("success");
        const nx = en.sets[si + 1]; if (nx && !nx.w && nx.type === s.type) nx.w = s.w;
        if (s.type !== "w" && isPR(en.slug, s)) { confetti(); toast(`New PR: ${s.w}${S.settings.unit} × ${s.r}`); beep([[660, .1], [880, .1], [1175, .2]]); }
        const ssNext = en.ss && a.entries[ei + 1];
        if (s.type !== "w" && ssNext) toast(`Superset: now ${BY[ssNext.slug]?.name || "next exercise"}`);
        else if (S.settings.autoRest && s.type !== "w" && restOf(en)) startRest(restOf(en), a.entries[ei - 1]?.ss ? ssBackLabel(ei - 1) : nextLabel(ei, si));
        else if (s.type === "w") startRest(45, nextLabel(ei, si));
      }
      rerender(ei); refreshStats();
      if (S.settings.gym && s.done && s.type !== "w") { // follow supersets; move on when the exercise is finished
        const ssPrev = a.entries[ei - 1]?.ss && a.entries[ei - 1].sets.some((x) => !x.done && x.type !== "w");
        if (en.ss && a.entries[ei + 1]?.sets.some((x) => !x.done)) setTimeout(() => gymGo(ei + 1), 500);
        else if (ssPrev) setTimeout(() => gymGo(ei - 1), 500);
      }
      return;
    }
    if (act === "next") return gymGo(ei + 1);
    if (act === "add") { const l = en.sets.at(-1); en.sets.push({ w: l?.w || "", r: "", done: false, type: "n" }); save("active"); rerender(ei); return; }
    if (act === "warm") {
      const work = en.sets.find((x) => x.type !== "w" && +x.w)?.w || lastSets(en.slug)?.sets[0]?.w || await askText(`Working weight (${S.settings.unit})`, { inputmode: "decimal", ok: "Add warm-up" }); if (!+work) return;
      const ws = warmupSets(work, ex); if (!ws.length) return toast("No warm-up needed for this weight");
      en.sets = [...ws.map((x) => ({ w: String(x.w), r: String(x.r), done: false, type: "w" })), ...en.sets.filter((x) => x.type !== "w")];
      save("active"); rerender(ei); toast(`Added ${ws.length} warm-up sets`); return;
    }
    if (act === "plates") { const w = en.sets.find((x) => !x.done && +x.w)?.w || en.sets.find((x) => +x.w)?.w || lastSets(en.slug)?.sets[0]?.w || 60; plateSheet(+w); return; }
    if (act === "swap") return swapSheet(ei);
    if (act === "menu") return entryMenu(ei);
  };
  $("#gymT").onclick = () => { S.settings.gym = !S.settings.gym; save("settings"); haptic(); sessionView(); };
  const gp = $("#gPrev"), gn = $("#gNext"); if (gp) gp.onclick = () => gymGo(gi - 1); if (gn) gn.onclick = () => gymGo(gi + 1);
  if (S.settings.gym) { let x0 = null, y0 = 0; // swipe left/right between exercises
    box.ontouchstart = (e) => { if (e.target.closest("input,.stepper")) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
    box.ontouchend = (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) gymGo(gi + (dx < 0 ? 1 : -1) * (document.dir === "rtl" ? -1 : 1)); }; }
  $("#addEx").onclick = () => { pickMode = { toSession: true, selected: new Set() }; go("#/pick"); };
  $("#fin").onclick = finishSession; $("#finTop").onclick = finishSession;
  $("#disc").onclick = async () => { if (await ask("Discard this workout? Nothing will be saved.", { ok: "Discard", danger: true })) { S.active = null; save("active"); stopRest(); wakeLock?.release?.(); redirect("#/train"); } };
}
function gymGo(i) {
  const n = S.active?.entries.length || 0; if (i < 0 || i >= n || i === gi) return;
  const dir = i > gi ? 1 : -1; gi = i; haptic(); sessionView();
  const c = $("#entries .cur"); if (c && !RM.matches) c.animate([{ opacity: 0, transform: `translateX(${dir * 24}px)` }, { opacity: 1, transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,0,0,1)" });
  window.scrollTo(0, 0);
}
/* the next undone set from entry ei / set index `from` on: { text, slug, name, set, of, w, r } (w/r = typed, else last time, else target) */
function nextInfo(ei, from) {
  const a = S.active;
  for (let i = ei; i < a.entries.length; i++) {
    const en = a.entries[i], k = en.sets.findIndex((x, j) => j >= (i === ei ? from : 0) && !x.done); if (k < 0) continue;
    const s = en.sets[k], warm = s.type === "w", work = en.sets.filter((x) => x.type !== "w");
    const n = warm ? 0 : en.sets.slice(0, k + 1).filter((x) => x.type !== "w").length, tg = warm ? null : planOf(en).tgt(n);
    const w = warm ? s.w : s.w || tg.w, r = warm ? s.r : s.r || tg.r;
    const name = BY[en.slug]?.name || en.slug, u = S.settings.unit;
    const text = `Next: ${i === ei ? "" : `${name} · `}${warm ? "warm-up set" : `set ${n} of ${work.length}`}${r ? ` · ${w ? `${w} ${u} × ` : ""}${r}` : ""}`;
    return { text, slug: en.slug, name, set: warm ? "" : n, of: work.length, w: String(w || ""), r: String(r || "") };
  }
  return { text: "Last set — finish strong" };
}
const nextLabel = (ei, si) => nextInfo(ei, si + 1), ssBackLabel = (pi) => nextInfo(pi, 0);
function isPR(slug, s) { const b = bestOf(slug); const v = e1rm(s.w, s.r); return v > 0 && b && v > b.e1rm; }
function restSheet(ei) {
  const en = S.active.entries[ei], cur = restOf(en), def = BY[en.slug]?.rest ?? S.settings.restDefault;
  const opts = [0, 45, 60, 90, 120, 150, 180, 240, 300];
  openSheet(`<h3>Rest time</h3><p class="muted small" style="margin:-6px 0 12px">${esc(BY[en.slug]?.name || "")} · saved for next time. Suggested: ${restText(def)}</p>
    <div class="restgrid">${opts.map((o) => `<button class="btn ${o === cur ? "primary" : ""}" data-r="${o}">${o ? fmtDur(o * 1000) : "Off"}</button>`).join("")}</div>`, (el) => {
    el.onclick = (e) => { const b = e.target.closest("[data-r]"); if (!b) return; const v = +b.dataset.r;
      S.settings.restEx = { ...(S.settings.restEx || {}) }; if (v === def) delete S.settings.restEx[en.slug]; else S.settings.restEx[en.slug] = v;
      store("settings"); closeSheet(); sessionView(); haptic(); };
  }, { half: true });
}
function swapSheet(ei) {
  const en = S.active.entries[ei]; const ex = BY[en.slug]; const alts = swaps(ex, 10);
  openSheet(`<h3>Swap exercise</h3><p class="muted small" style="margin:-6px 0 12px">Machine taken? Same muscle, best tier first.</p><div class="stack tight">
    ${alts.map((x) => `<button class="lrow" data-s="${x.slug}"><img src="${x.poster}" alt=""><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.equipment.join(" · "))}</div></div>${tierBadge(x.tier)}</button>`).join("") || `<div class="empty">No alternatives with your equipment.</div>`}</div>`, (el) => {
    el.onclick = (e) => { const b = e.target.closest("[data-s]"); if (!b) return; S.active.entries[ei] = newEntry(b.dataset.s, en.sets.length, en.target); save("active"); closeSheet(); sessionView(); toast("Swapped"); };
  });
}
function entryMenu(ei) {
  const a = S.active; const en = a.entries[ei];
  openSheet(`<h3>${esc(BY[en.slug]?.name)}</h3><div class="menu">
    <button data-m="up" ${ei ? "" : "disabled"}>${ic("up", "sm")}Move up</button><button data-m="down" ${ei < a.entries.length - 1 ? "" : "disabled"}>${ic("down", "sm")}Move down</button>
    <button data-m="ss" ${ei < a.entries.length - 1 ? "" : "disabled"}>${ic("swap", "sm")}${en.ss ? "Unlink superset" : "Superset with next exercise"}</button>
    <button data-m="delset">${ic("minus", "sm")}Remove last set</button><button data-m="hist">${ic("chart", "sm")}History</button><a href="#/ex/${en.slug}">${ic("book", "sm")}How to do it</a>
    <button class="danger" data-m="rm">${ic("trash", "sm")}Remove exercise</button></div>`, (el) => {
    el.onclick = (e) => {
      const b = e.target.closest("[data-m]"); if (!b) return; const m = b.dataset.m;
      if (m === "hist") { closeSheet(); setTimeout(() => historySheet(en.slug), 220); return; }
      if (m === "up" && ei > 0) [a.entries[ei - 1], a.entries[ei]] = [a.entries[ei], a.entries[ei - 1]];
      if (m === "down" && ei < a.entries.length - 1) [a.entries[ei + 1], a.entries[ei]] = [a.entries[ei], a.entries[ei + 1]];
      if (m === "delset" && en.sets.length > 1) en.sets.pop();
      if (m === "ss") { en.ss = !en.ss; toast(en.ss ? "Superset: no rest until both are done" : "Superset removed"); }
      if (m === "rm") { a.entries.splice(ei, 1); if (ei && !a.entries[ei]) a.entries[ei - 1].ss = false; }
      if (m === "up" || m === "down") a.entries.forEach((x) => (x.ss = false));
      save("active"); closeSheet(); sessionView();
    };
  });
}
async function finishSession() {
  const a = S.active; const st = stats();
  if (!st.sets && !(await ask("No sets are checked. Finish anyway?", { ok: "Finish" }))) return;
  const left = a.entries.reduce((n, en) => n + en.sets.filter((s) => !s.done).length, 0); // UT-1: never drop unticked sets silently
  if (st.sets && left && !(await ask(`${left} ${left === 1 ? "set is" : "sets are"} not checked and won't be saved. Finish anyway?`, { ok: "Finish", cancel: "Keep going" }))) return;
  const prs = [];
  a.entries.forEach((en) => { const b = bestOf(en.slug); en.sets.forEach((s) => { if (s.done && s.type !== "w") { const v = e1rm(s.w, s.r); if (v && (!b || v > b.e1rm) && !prs.find((p) => p.slug === en.slug)) prs.push({ slug: en.slug, w: s.w, r: s.r }); } }); });
  a.endedAt = Date.now();
  a.entries = a.entries.map((en) => ({ slug: en.slug, sets: en.sets.filter((s) => s.done) })).filter((en) => en.sets.length);
  S.sessions.push(a); S.active = null; store("sessions", "active"); stopRest(); wakeLock?.release?.(); clearInterval(clockT);
  if (S.sessions.length === 1) persist();
  haptic("success"); beep([[523, .1], [659, .1], [784, .25]]); if (prs.length) confetti();
  redirect("#/");
  setTimeout(() => openSheet(`<div style="text-align:center"><div class="ill" data-ill="${prs.length ? "pr" : "rest-recovery"}" style="max-width:150px"></div><h3 style="margin:4px 0 2px">Workout complete</h3><div class="muted small">${esc(a.name)} · ${fmtDur(a.endedAt - a.startedAt)}</div></div>
    <div class="kpis" style="margin:16px 0"><div class="kpi"><b class="num">${st.sets}</b><span>Sets</span></div><div class="kpi"><b class="num">${st.vol}</b><span>${S.settings.unit} volume</span></div><div class="kpi"><b class="num">${prs.length}</b><span>New PRs</span></div></div>
    ${prs.length ? `<div class="stack tight">${prs.map((p) => `<div class="lrow"><img src="${BY[p.slug]?.poster}" alt=""><div class="grow"><div class="t">${esc(BY[p.slug]?.name)}</div><div class="s">${p.w}${S.settings.unit} × ${p.r}</div></div>${ic("trophy")}</div>`).join("")}</div>` : ""}
    <div class="row" style="margin-top:16px"><button class="btn grow" id="shareW">${ic("share", "sm")} Share</button><button class="btn primary grow" id="done">Done</button></div>
    <a class="btn ghost block" href="#/warmup/cool" id="coolW" style="margin-top:6px">${ic("timer", "sm")} Cool-down stretches (optional)</a>`, (el) => {
      fillIll(el); $("#done", el).onclick = closeSheet;
      $("#shareW", el).onclick = () => import("./share.js").then((m) => m.shareSession(a, st, prs)).catch((e) => { console.error(e); toast("Could not share"); });
    }), 120);
}

/* ---------------- rest timer (global timer + floating pill) ---------------- */
export function startRest(sec, nx = {}) { Tm.startCountdown(sec, { kind: "rest", label: "Rest", next: nx.text || "", nx }); }
export function stopRest() { if (Tm.T.mode === "countdown" && Tm.T.kind === "rest") Tm.stop(); }

/* ---------------- tools ---------------- */
async function historySheet(slug) {
  const X = await import("./exercise.js");
  openSheet(`<h3>${esc(BY[slug]?.name || slug)}</h3><div class="dim small" style="margin:-4px 0 12px">History</div>${X.historyHTML(slug)}`, (el) => { fillIll(el); X.wireHistory(el, slug); });
}
export function plateSheet(total) {
  const u = S.settings.unit;
  const draw = (el) => {
    const t = +$("#pw", el).value || 0; const { bar, out, rest } = platesFor(t);
    const plate = (p, i) => `<div class="plate" style="height:${plateHeight(p)}px;background:${plateColor(p)};animation-delay:${i * 40}ms" title="${p}"></div>`;
    $("#viz", el).innerHTML = `<div class="sleeve"></div>${[...out].reverse().map(plate).join("")}<div class="bar"></div><div class="bar"></div>${out.map(plate).join("")}<div class="sleeve"></div>`;
    $("#ptxt", el).innerHTML = t <= bar ? `Just the bar (${bar}${u})` : `Each side: <b>${out.join(" + ") || "—"}</b>${rest ? ` <span style="color:var(--warn)">(${rest}${u} can't be made)</span>` : ""}`;
  };
  openSheet(`<h3>Plate calculator</h3><div class="field"><label>Total weight (${u}) · bar ${S.settings.bar}${u}</label>
    <div class="stepper" style="height:56px"><button id="pm" style="width:56px;font-size:24px" aria-label="Minus 5">−</button><input id="pw" inputmode="decimal" value="${total}" style="font-size:26px"><button id="pp" style="width:56px;font-size:24px" aria-label="Plus 5">+</button></div></div>
    <div class="barbell" id="viz"></div><div id="ptxt" style="text-align:center;font-size:17px"></div>`, (el) => {
    draw(el); $("#pw", el).oninput = () => draw(el);
    $("#pm", el).onclick = () => { $("#pw", el).value = Math.max(0, +$("#pw", el).value - 5); draw(el); haptic(); };
    $("#pp", el).onclick = () => { $("#pw", el).value = +$("#pw", el).value + 5; draw(el); haptic(); };
  });
}
function oneRmSheet() {
  const u = S.settings.unit;
  openSheet(`<h3>1RM calculator</h3><div class="row"><div class="field grow"><label>Weight (${u})</label><input id="ow" inputmode="decimal" value="80"></div><div class="field grow"><label>Reps</label><input id="or" inputmode="numeric" value="8"></div></div>
    <div class="card soft pad" style="text-align:center"><div class="eyebrow">Estimated 1RM</div><div style="font-size:44px;font-weight:780" class="num" id="ores">—</div></div>
    <div class="h4">Training weights</div><div class="kv" id="opct"></div>`, (el) => {
    const draw = () => { const v = e1rm($("#ow", el).value, $("#or", el).value); $("#ores", el).textContent = v ? v + u : "—";
      $("#opct", el).innerHTML = [[.9, "3"], [.85, "5"], [.8, "8"], [.75, "10"], [.7, "12"], [.65, "15"]].map(([p, r]) => `<div><b class="num">${v ? Math.round(v * p * 2) / 2 : "—"}</b><span>~${r} reps · ${Math.round(p * 100)}%</span></div>`).join(""); };
    draw(); el.oninput = draw;
  });
}

/* ---------------- misc ---------------- */
export function updateLiveDot() { const a = $('.nav [data-tab="train"]'); if (!a) return; a.querySelector(".dot")?.remove(); if (S.active) a.insertAdjacentHTML("beforeend", '<span class="dot"></span>'); }
