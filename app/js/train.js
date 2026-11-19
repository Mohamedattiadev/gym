// Workouts, level-based plans, workout editor, live session logger (beat last week + plateau auto-adjust), tools.
import { S, save, tomb, persist } from "./store.js";
import { $, BP, $$, esc, ic, uid, ask, askText, choose, openSheet, closeSheet, toast, haptic, beep, confetti, fmtDur, RM } from "./ui.js";
import { BY, history, lastSets, bestOf, setsText, swaps, WEEK } from "./data.js";
import { PLANS, planById, buildPlan, pickPlans, recommendedId, planOpts, planSlots, minutesOf, freqOf, FOCUS, loadPlanText, weekLine, gName } from "./plans.js";
import { e1rm, platesFor, plateColor, plateHeight, warmupSets, suggest } from "./calc.js";
import { go, redirect, setTop } from "./nav.js";
import { tierBadge, restText, fillIll } from "./components.js";
import * as Tm from "./timer.js";
import { t, tn, N, lang, iso } from "./i18n.js";

const view = () => $("#view");
export let pickMode = null;
const store = save; // FE-10: sync pushes from the save hook

/* ---------------- plans (block 26: definitions + picker in plans.js) ---------------- */
export { PLANS, buildPlan };
const LEVEL_C = { beginner: "var(--ok)", intermediate: "var(--tier-B)", advanced: "var(--tier-A)" };

/* ---------------- train tab ---------------- */
export function nextWorkout() {
  if (!S.workouts.length) return null;
  const last = [...S.sessions].reverse().find((s) => s.workoutId);
  const i = last ? S.workouts.findIndex((w) => w.id === last.workoutId) : -1;
  return S.workouts[(i + 1) % S.workouts.length];
}
/** the plan the user's workouts came from (null = no plan) */
export function currentPlan() { const id = S.workouts.find((w) => w.plan)?.plan; return id ? planById(id) : null; }
export function trainView() {
  setTop({ title: t("Train") });
  const cur = currentPlan(), next = nextWorkout();
  const wrow = (w) => `<div class="wrow${next && w.id === next.id ? " next" : ""}"><a class="grow" href="#/workout/${esc(w.id)}">
          <img src="${BY[w.items[0]?.slug]?.poster || ""}" alt="" data-hide-broken><div class="grow"><div class="b ellip">${esc(w.name)}</div><div class="dim small">${next && w.id === next.id ? `<b class="nx">${t("Next")}</b> · ` : ""}${tn(w.items.length, "{n} exercise", "{n} exercises")} · ${tn(w.items.reduce((a, it) => a + +it.sets, 0), "{n} set", "{n} sets")}</div></div></a>
          <button class="go-btn" data-start="${esc(w.id)}" aria-label="${t("Start {name}", { name: esc(w.name) })}">${ic("play")}</button></div>`;
  const planBox = cur ? `<div class="card pad myplan"><div class="eyebrow">${t("Your plan")}</div><div class="row" style="gap:8px;align-items:baseline"><h2 class="grow">${esc(cur.name)}</h2><span class="dim small num">${tn(cur.days, "{n} day a week", "{n} days a week")}</span></div>
      <div class="muted small">${esc(weekLine(cur))} ${t("Each muscle {f}× a week.", { f: freqOf(cur) })}</div>
      <div class="row mt-10"><a class="btn sm grow" href="#/plans">${ic("swap", "sm")} ${t("Change plan")}</a><a class="btn sm grow" href="#/plan/${cur.id}">${t("How it works")}</a></div></div>`
    : `<div class="card pad myplan"><div class="eyebrow">${t("Step 1")}</div><h2>${t("Pick a plan")}</h2><div class="muted small">${t("A plan gives you ready workouts for each training day. You can change it any time.")}</div></div>`;
  const plans = `<div class="stack tight stagger" id="planCards">${pickPlans({ level: S.profile?.level || "beginner", days: S.profile?.days || 3 }).map(({ p }) => planCard(p)).join("")}</div>
      <div class="row mt-6"><a class="btn ghost grow" href="#/plans">${t("All {n} plans", { n: PLANS.length })}</a><a class="btn ghost grow" href="#/start">${ic("layers", "sm")} ${t("Find my plan")}</a></div>`;
  const tools = `<div class="sec"><h2>${t("Tools")}</h2></div><div class="tchips">
      <button class="chip" id="tPlates">${ic("calc", "sm")} ${t("Plates")}</button><button class="chip" id="t1rm">${ic("trophy", "sm")} ${t("1RM")}</button>
      <a class="chip" href="#/timer/countdown">${ic("timer", "sm")} ${t("Rest timer")}</a><a class="chip" href="#/timer/interval">${ic("bolt", "sm")} ${t("Intervals")}</a><a class="chip" href="#/warmup">${ic("flame", "sm")} ${t("Warm-up")}</a></div>`;
  /* wide screens (.cols): no plan yet -> plans on the left, My workouts + Tools on the right (owner: My workouts sat far down under the plans, right side empty); with a plan -> plan + workouts left, Tools right */
  view().innerHTML = `${S.active ? `<a class="hero-card live" href="#/session" style="display:block;margin-bottom:4px"><div class="eyebrow">${t("In progress")}</div><h2>${esc(S.active.name)}</h2><div class="muted small">${t("Tap to resume")}</div></a>` : ""}
    <div class="cols"><div>
      ${planBox}
      ${cur ? "" : `${plans}</div><div>`}
      <div class="sec"><h2>${cur ? t("Workouts") : t("My workouts")}</h2><button class="btn sm" id="newW">${ic("plus", "sm")} ${t("New")}</button></div>
      <div class="stack tight stagger">${S.workouts.map(wrow).join("") ||
        `<div class="card pad row" style="gap:14px;text-align:start"><div class="ill" data-ill="empty-workouts" style="width:84px;margin:0;flex:none"></div><div class="grow"><b>${t("No workouts yet")}</b><div class="muted small">${t("Pick a plan above, or tap New to build your own.")}</div></div></div>`}</div>
      ${S.active ? "" : `<button class="btn ghost block mt-6" id="quick">${ic("bolt", "sm")} ${t("Quick start — empty workout")}</button>`}
    ${cur ? "</div><div>" : ""}
      ${tools}
    </div></div>`;
  view().onclick = (e) => {
    const st = e.target.closest("[data-start]"); if (st) return startSession(S.workouts.find((w) => w.id === st.dataset.start));
    planClicks(e);
  };
  $("#newW").onclick = newWorkout;
  const q = $("#quick"); if (q) q.onclick = () => startSession(null);
  fillPlanLines(view());
  $("#tPlates").onclick = () => plateSheet(100); $("#t1rm").onclick = oneRmSheet;
}
async function newWorkout() { const n = await askText(t("New workout"), { value: t("Push Day"), ok: t("Create") }); if (!n) return null; const w = { id: uid(), name: n, items: [], updatedAt: Date.now() }; S.workouts.push(w); store("workouts"); go(`#/workout/${w.id}`); return w; }
const LEVEL_T = { beginner: N("Beginner"), intermediate: N("Intermediate"), advanced: N("Advanced") };
/** plan card: level tag, Recommended badge, name, days · minutes · frequency, one line (filled from plans.json) */
export function planCard(p, { why = "" } = {}) {
  const cur = p.id === currentPlan()?.id, rec = p.id === recommendedId(), f = freqOf(p), mins = Math.max(...planSlots(p, planOpts()).map(minutesOf));
  return `<div class="plan-card${rec ? " rec" : ""}"><div class="row"><span class="tag" style="color:${LEVEL_C[p.level]};background:color-mix(in oklab, ${LEVEL_C[p.level]} 14%, transparent)">${t(LEVEL_T[p.level])}</span>${rec ? `<span class="tag rec-b">${ic("check", "sm")} ${t("Recommended")}</span>` : ""}<span class="grow"></span><a class="link small" href="#/plan/${p.id}" style="color:var(--accent-text);font-weight:600">${t("How it works")}</a></div>
    <b>${esc(p.name)}</b><div class="dim small num">${tn(p.days, "{n} day a week", "{n} days a week")} · ${t("~{m} min", { m: mins })} · ${t("each muscle {f}× a week", { f })}</div>
    <div class="muted small" data-pline="${p.id}">${why ? esc(why) : ""}</div>
    <div class="row mt-6"><button class="btn sm grow" data-preview="${p.id}">${t("Preview")}</button>${cur ? `<span class="btn sm grow cur-b" aria-disabled="true">${ic("check", "sm")} ${t("Your plan")}</span>` : `<button class="btn sm primary grow" data-use="${p.id}">${t("Use plan")}</button>`}</div></div>`;
}
/** fill the one-line texts after plans.json arrives */
export async function fillPlanLines(root) {
  const pt = await loadPlanText(), lang = S.settings.lang || "en", L = (o) => (o && (o[lang] || o.en)) || "";
  root.querySelectorAll("[data-pline]").forEach((el) => { if (!el.textContent.trim()) el.textContent = L(pt.plans?.[el.dataset.pline]?.line); });
}
/** wire Preview / Use plan buttons inside root */
export function planClicks(e) {
  const pv = e.target.closest("[data-preview]"); if (pv) { previewPlan(planById(pv.dataset.preview)); return true; }
  const us = e.target.closest("[data-use]"); if (us) { usePlan(planById(us.dataset.use)).then((ok) => { if (ok && !location.hash.startsWith("#/train")) go("#/train"); }); return true; }
  return false;
}
export function previewPlan(p) {
  const o = planOpts();
  let tab = "list";
  const draw = async (el) => {
    const ws = buildPlan(p, o), sl = planSlots(p, o);
    const seg = (id, opts, cur) => `<div class="seg sm" id="${id}" role="group">${opts.map(([v, lb]) => `<button class="${String(v) === String(cur) ? "on" : ""}" data-v="${v}">${lb}</button>`).join("")}</div>`;
    el.innerHTML = `<h3>${esc(p.name)}</h3><p class="muted small" style="margin:-6px 0 10px">${esc(weekLine(p))}</p>
      <div class="seg sm block mb-12" id="pvTab" role="group"><button class="${tab === "list" ? "on" : ""}" data-v="list">${t("Workouts")}</button><button class="${tab === "week" ? "on" : ""}" data-v="week">${t("How a week works")}</button></div>
      <div class="pv-opts"><div class="row between"><span class="small b">${t("Session length")}</span>${seg("pvMin", [45, 60, 75].map((m) => [m, t("{n} min", { n: m })]), o.min)}</div>
        <div><span class="small b">${t("Extra focus")}</span><div class="gchips mt-6" id="pvFocus">${[["", t("None")], ...Object.entries(FOCUS).map(([k, v]) => [k, gName(v.name)])].map(([k, lb]) => `<button class="chip ${k === o.focus ? "on" : ""}" data-v="${k}">${lb}</button>`).join("")}</div>${o.focus ? `<div class="dim tiny mt-4">${t("Adds a few sets for {focus} to two workouts.", { focus: esc(gName(FOCUS[o.focus].name).toLocaleLowerCase(lang())) })}</div>` : ""}</div></div>
      ${tab === "week" ? `<div id="pvScn" class="mt-12"></div>` : ws.map((w, i) => `<div class="h4">${esc(w.name)} <span class="dim tiny num">${t("~{m} min", { m: minutesOf(sl[i]) })}</span></div><div class="stack tight">
      ${w.items.map((it) => `<div class="lrow"><img src="${BY[it.slug].poster}" alt=""><div class="grow"><div class="t">${esc(BY[it.slug].name)}</div><div class="s">${it.sets} × ${it.reps}</div></div>${tierBadge(BY[it.slug].tier)}</div>`).join("")}</div>`).join("")}
      <button class="btn primary block mt-16" id="usePv">${t("Use this plan")}</button>`;
    $("#pvTab", el).onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b || b.dataset.v === tab) return; haptic(); tab = b.dataset.v; draw(el); };
    $("#pvMin", el).onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; haptic(); o.min = +b.dataset.v; draw(el); };
    $("#pvFocus", el).onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; haptic(); o.focus = b.dataset.v; draw(el); };
    $("#usePv", el).onclick = () => { closeSheet(); usePlan(p, true, o).then((ok) => { if (ok && !location.hash.startsWith("#/train")) go("#/train"); }); };
    if (tab === "week") { const host = $("#pvScn", el), sc = await import("./scenario.js"); if (host.isConnected) sc.mountScenario(host, p, { opt: { ...o } }); }
  };
  openSheet(`<div id="pvBody"></div>`, (el) => draw($("#pvBody", el)));
}
/** UT-6: using a plan again (or a second plan) asks Replace / Keep both instead of silently duplicating */
export async function usePlan(p, redraw = true, opt = planOpts()) {
  const old = S.workouts.filter((w) => w.plan), same = old.some((w) => w.plan === p.id);
  let mode = "add";
  if (old.length) {
    const cur = planById(old[0].plan)?.name || t("your plan");
    mode = await choose(same ? t("You already use this plan") : t("Switch from {plan}?", { plan: cur }), same ? t("Replace its workouts with fresh ones, or keep both copies.") : tn(old.length, "Replace the {n} workout from {plan}, or keep it next to the new ones.", "Replace the {n} workouts from {plan}, or keep them next to the new ones.", { plan: cur }),
      same ? [["replace", t("Replace")], ["add", t("Keep both")]] : [["replace", t("Replace {plan}", { plan: cur })], ["add", t("Keep both")]]);
    if (!mode) return false;
  }
  if (mode === "replace") for (const w of old) { tomb("workouts", w.id); S.workouts.splice(S.workouts.indexOf(w), 1); }
  const ws = buildPlan(p, opt);
  S.workouts.push(...ws);
  S.settings.planMin = opt.min; S.settings.planFocus = opt.focus;
  S.profile = { ...(S.profile || {}), level: S.profile?.level || p.level, plan: p.id };
  store("workouts", "profile", "settings");
  haptic("success"); toast(mode === "replace" ? tn(ws.length, "Plan replaced · {n} workout", "Plan replaced · {n} workouts") : tn(ws.length, "Added {n} workout", "Added {n} workouts")); if (redraw && location.hash.startsWith("#/train")) { trainView(); fillIll(view()); }
  return true;
}

/* ---------------- workout editor ---------------- */
export function workoutView(id) {
  const w = S.workouts.find((x) => x.id === id); if (!w) return redirect("#/train");
  setTop({ title: w.name, back: true, right: `<button class="iconbtn" id="wMore" aria-label="${t("More")}">${ic("more")}</button>` });
  const touch = () => { w.updatedAt = Date.now(); store("workouts"); };
  view().innerHTML = `<div class="stack tight stagger" id="items">${w.items.map((it, i) => { const e = BY[it.slug]; return `<div class="edrow" data-i="${i}">
      <a href="#/ex/${it.slug}" aria-label="${t("How to do {name}", { name: esc(e?.name || it.slug) })}"><img src="${e?.poster || ""}" alt=""></a>
      <div style="min-width:0"><div class="t clamp2">${esc(e?.name || it.slug)} ${tierBadge(e?.tier)}</div>
        <div class="row dim small" style="gap:6px;margin-top:6px"><input class="mini-in num" data-k="sets" value="${esc(it.sets)}" inputmode="numeric" aria-label="${t("Sets")}"> ${t("sets ×")}
          <input class="mini-in w num" data-k="reps" value="${esc(it.reps)}" aria-label="${t("Reps")}"> ${t("reps")}</div></div>
      <div class="acts"><button class="iconbtn sm" data-a="up" aria-label="${t("Move up")}" ${i ? "" : "disabled"}>${ic("up", "sm")}</button><button class="iconbtn sm" data-a="del" aria-label="${t("Remove")}" style="color:var(--t3)">${ic("trash", "sm")}</button></div></div>`; }).join("") ||
      `<div class="card pad tc"><div class="ill" data-ill="plan" style="max-width:140px"></div><b>${t("No exercises yet")}</b><div class="muted small">${t("Add a few from the library.")}</div></div>`}</div>
    <button class="btn block mt-12" id="add">${ic("plus", "sm")} ${t("Add exercises")}</button>
    <div class="sticky-cta"><button class="btn primary" id="start" ${w.items.length ? "" : "disabled"}>${ic("play", "sm")} ${t("Start workout")}</button></div>`;
  document.body.classList.add("has-cta");
  const items = $("#items");
  items.onclick = (e) => {
    const b = e.target.closest("button[data-a]"); if (!b) return; haptic();
    const i = +b.closest("[data-i]").dataset.i;
    if (b.dataset.a === "del") { const old = structuredClone(w.items); w.items.splice(i, 1); touch(); workoutView(id); fillIll(view());
      toast(t("Exercise removed"), 1900, { label: t("Undo"), fn: () => { w.items = old; touch(); workoutView(id); } }); return; }
    if (b.dataset.a === "up" && i > 0) [w.items[i - 1], w.items[i]] = [w.items[i], w.items[i - 1]];
    touch(); workoutView(id);
  };
  items.onchange = (e) => { const inp = e.target.closest("input"); if (!inp) return; const it = w.items[+inp.closest("[data-i]").dataset.i];
    it[inp.dataset.k] = inp.dataset.k === "sets" ? Math.max(1, Math.min(12, parseInt(inp.value) || 1)) : inp.value.trim() || it.reps; touch(); };
  $("#add").onclick = () => { pickMode = { workoutId: id, selected: new Set() }; go("#/pick"); };
  $("#start").onclick = () => startSession(w);
  $("#wMore").onclick = () => openSheet(`<h3>${esc(w.name)}</h3><div class="menu"><button id="ren">${ic("edit", "sm")}${t("Rename")}</button><button id="dup">${ic("copy", "sm")}${t("Duplicate")}</button><button class="danger" id="del">${ic("trash", "sm")}${t("Delete workout")}</button></div>`, (el) => {
    $("#ren", el).onclick = async () => { const n = await askText(t("Rename workout"), { value: w.name }); if (n) { w.name = n; touch(); workoutView(id); } };
    $("#dup", el).onclick = () => { S.workouts.push({ ...structuredClone(w), id: uid(), name: t("{name} (copy)", { name: w.name }), updatedAt: Date.now() }); store("workouts"); closeSheet(); toast(t("Duplicated")); };
    $("#del", el).onclick = async () => { if (await ask(t("Delete “{name}”?", { name: w.name }), { ok: t("Delete"), danger: true })) { const old = S.workouts; S.workouts = S.workouts.filter((x) => x !== w); tomb("workouts", w.id); store("workouts"); go("#/train"); toast(t("Workout deleted"), 1900, { label: t("Undo"), fn: () => { S.workouts = old; tomb("workouts", w.id, true); store("workouts"); go(`#/workout/${w.id}`); } }); } };
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
  openSheet(`<h3>${t("Add to…")}</h3><div class="menu">
    ${S.active ? `<button data-a="now">${ic("bolt", "sm")}${t("Current workout")}</button>` : ""}
    ${S.workouts.map((w) => `<button data-w="${w.id}">${ic("dumbbell", "sm")}<span class="grow">${esc(w.name)}</span><span class="dim small">${w.items.length}</span></button>`).join("")}
    <button data-a="new">${ic("plus", "sm")}${t("New workout")}</button></div>`, (el) => {
    el.onclick = async (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.a === "now") { addToSession(slug); closeSheet(); toast(t("Added to current workout")); return; }
      let w;
      if (b.dataset.a === "new") { const n = await askText(t("New workout"), { value: t("Push Day"), ok: t("Create") }); if (!n) return; w = { id: uid(), name: n, items: [] }; S.workouts.push(w); }
      else w = S.workouts.find((x) => x.id === b.dataset.w);
      if (!w) return; const ex = BY[slug];
      w.items.push({ slug, sets: 3, reps: `${ex.repRange[0]}-${ex.repRange[1]}` }); w.updatedAt = Date.now(); store("workouts"); haptic("success"); closeSheet(); toast(t("Added to {name}", { name: w.name }));
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
  if (S.active && !(await ask(t("A workout is already in progress. Replace it?"), { ok: t("Replace"), danger: true }))) return;
  const ch = plateauAdjust(w);
  S.active = { id: uid(), workoutId: w?.id || null, name: w?.name || t("Workout"), startedAt: Date.now(),
    entries: (w?.items || []).map((it) => newEntry(it.slug, it.sets, it.reps)) };
  save("active"); haptic("success"); go("#/session");
  if (ch.length) {
    const msg = ch.length > 1 ? t("Plateau: adjusted {n} exercises", { n: ch.length }) : ch[0].kind === "reps" ? t("Plateau: {name} → {reps} reps", { name: BY[ch[0].slug]?.name, reps: ch[0].to }) : t("Plateau: swapped to {name}", { name: BY[ch[0].to]?.name });
    setTimeout(() => toast(msg, 6000, { label: t("Undo"), fn: () => {
      w.items = ch.before.items; S.adjust = ch.before.adjust; w.updatedAt = Date.now(); store("workouts", "adjust");
      if (S.active?.workoutId === w.id && !S.active.entries.some((en) => en.sets.some((s) => s.done))) { S.active.entries = w.items.map((it) => newEntry(it.slug, it.sets, it.reps)); save("active"); if (location.hash === "#/session") sessionView(); }
      toast(t("Change undone"));
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
  setTop({ title: a.name, back: true, right: `<button class="iconbtn" id="sMore" aria-label="${t("Workout options")}">${ic("more")}</button><button class="btn sm" id="finTop">${t("Finish")}</button>` });
  const st = stats(), u = S.settings.unit, gym = !!S.settings.gym && a.entries.length > 0;
  if (gym) { gi = Math.min(gi, a.entries.length - 1); if (a.entries[gi]?.sets.every((x) => x.done)) { const k = a.entries.findIndex((en) => en.sets.some((x) => !x.done)); if (k >= 0) gi = k; } }
  view().classList.toggle("gym", gym);
  view().innerHTML = `
    <div class="sess-head"><span class="sess-clock num" id="clock" aria-label="${t("Time")}">0:00</span>
      <span class="sess-stats"><span><b class="num" id="stSets">${st.sets}</b> ${t("sets")}</span><span><b class="num" id="stVol">${st.vol}</b> ${u}</span></span></div>
    ${!a.warmed && !a.noWarm && a.entries.length && !a.entries.some((en) => en.sets.some((x) => x.done)) ? `<div class="warmn" id="warmN">${ic("flame", "sm")}<span class="grow" title="${t("About 6 min, made for this workout")}">${t("Warm up first")}</span><a class="btn sm" href="#/warmup/s">${t("Start")}</a><button class="iconbtn sm" id="warmX" aria-label="${t("Skip warm-up")}">${ic("close", "sm")}</button></div>` : ""}
    ${gym ? `<div class="gnav"><button class="iconbtn filled" id="gPrev" aria-label="${t("Previous exercise")}" ${gi ? "" : "disabled"}>${ic("back")}</button><b class="num">${t("Exercise {n} of {m}", { n: gi + 1, m: a.entries.length })}</b><button class="iconbtn filled fwd" id="gNext" aria-label="${t("Next exercise")}" ${gi < a.entries.length - 1 ? "" : "disabled"}>${ic("back")}</button></div>` : ""}
    <div class="sess-grid"><div class="sess-main">
    <div class="stack" id="entries">${a.entries.map((en, ei) => entryHTML(en, ei)).join("") || `<div class="card pad tc"><div class="ill" data-ill="hero-start" style="max-width:140px"></div><b>${t("Empty workout")}</b><div class="muted small">${t("Add your first exercise.")}</div></div>`}</div>
    <div class="row mt-12"><button class="btn grow" id="addEx">${ic("plus", "sm")} ${t("Add exercise")}</button><button class="btn primary grow" id="fin">${ic("check", "sm")} ${t("Finish workout")}</button></div></div>
    <aside class="sess-side" id="sside" aria-label="${t("Current exercise")}"></aside></div>`;
  clearInterval(clockT);
  const tick = () => { const c = $("#clock"); if (!c || !S.active) return clearInterval(clockT); c.textContent = fmtDur(Date.now() - S.active.startedAt); };
  tick(); clockT = setInterval(tick, 1000);
  const wx = $("#warmX"); if (wx) wx.onclick = () => { a.noWarm = true; save("active"); $("#warmN")?.remove(); };
  wireSession(); sideCur = -1; side();
}
/* 22b part 4b: wide screens (>= 1200 px) — sticky right column: current exercise video, next set, workout progress */
const WIDE = matchMedia(`(min-width: ${BP.xl}px)`);
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
  if (k < 0) now = `<b>${t("All sets done")}</b>`;
  else { const s = en.sets[k], warm = s.type === "w", n = warm ? 0 : en.sets.slice(0, k + 1).filter((x) => x.type !== "w").length, tg = warm ? null : planOf(en).tgt(n);
    const w = s.w || tg?.w, r = s.r || tg?.r;
    now = `<b>${warm ? t("Warm-up set") : t("Set {n} of {m}", { n, m: work.length })}</b>${r ? `<span class="num">${w ? `<bdi>${esc(w)} ${u} × ${esc(r)}</bdi>` : t("{r} reps", { r: esc(r) })}</span>` : ""}`; }
  if (sideSlug !== en.slug || !el.firstElementChild) {
    sideSlug = en.slug;
    el.innerHTML = `<div class="card sside"><a class="sv" href="#/ex/${en.slug}" aria-label="${t("How to do {name}", { name: esc(e?.name || en.slug) })}">${e?.poster ? `<img class="hbg" src="${e.poster}" alt="">` : ""}${e?.video ? `<video src="${e.video}" poster="${e?.poster || ""}"${RM.matches ? "" : " autoplay"} muted loop playsinline preload="metadata"></video>` : e?.poster ? `<img src="${e.poster}" alt="">` : ""}</a>
      <div class="sbody"><div class="eyebrow">${t("Now")}</div><div class="st">${esc(e?.name || en.slug)}</div><div class="snow" id="snow"></div>
        <div class="row" style="gap:8px;margin-top:10px"><a class="btn sm" href="#/ex/${en.slug}">${ic("info", "sm")} ${t("How to")}</a><button class="btn sm" data-go="${ei}">${ic("chev", "sm")} ${t("Go to sets")}</button></div></div></div>
      <div class="card sprog"><div class="eyebrow">${t("Workout")}</div><div id="slist"></div></div>`;
  }
  $("#snow", el).innerHTML = now;
  $("[data-go]", el).dataset.go = ei;
  $("#slist", el).innerHTML = a.entries.map((x, i) => { const d = x.sets.filter((s) => s.done && s.type !== "w").length, tot = x.sets.filter((s) => s.type !== "w").length;
    return `<button class="sitem${i === ei ? " on" : ""}${tot && d >= tot ? " done" : ""}" data-go="${i}"><span class="grow">${esc(BY[x.slug]?.name || x.slug)}</span><span class="num">${d}/${tot}</span></button>`; }).join("");
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
const wr = (w, r, u = "") => iso(`${+w ? `${w}${u ? " " + u : ""} × ` : ""}${r}`);
export const restOf = (en) => S.settings.restEx?.[en.slug] ?? BY[en.slug]?.rest ?? S.settings.restDefault;
const restLbl = (sec) => (sec ? t("{time} rest", { time: restText(sec) }) : t("rest off")); // reads as a setting ("2 min rest"), not an order
const opened = new WeakSet(); // finished exercises the user expanded again (Q13: done exercises fold to one line)
const firstOpen = () => S.active.entries.findIndex((x) => x.sets.some((s) => !s.done));
function entryHTML(en, ei) {
  const P = planOf(en), e = P.e, last = P.last, u = S.settings.unit;
  const allDone = en.sets.length && en.sets.every((s) => s.done);
  const ssIn0 = S.active.entries[ei - 1]?.ss, ssOut0 = en.ss && S.active.entries[ei + 1];
  if (allDone && !S.settings.gym && !opened.has(en)) { // Q13: one calm line per finished exercise, tap to open
    const ws = en.sets.filter((s) => s.type !== "w"), top = ws.reduce((b, x) => (+x.w * +x.r > +b.w * +b.r ? x : b), ws[0] || en.sets[0]);
    return `<div class="xblock done-all fold ${ssOut0 ? "ss-out" : ""} ${ssIn0 ? "ss-in" : ""}" data-ei="${ei}" data-slug="${esc(en.slug)}"><button class="xfold" data-a="unfold" aria-expanded="false" aria-label="${t("Show sets")}: ${esc(e?.name || en.slug)}">
      <img src="${e?.poster || ""}" alt=""><span class="grow"><span class="t">${esc(e?.name || en.slug)}</span><span class="hint">${tn(ws.length, "{n} set", "{n} sets")}${top ? ` · ${esc(wr(top.w, top.r, u))}` : ""}</span></span><span class="okdot">${ic("check", "sm")}</span></button></div>`;
  }
  const barb = e && (e.equipment.includes("Barbell") || e.equipment.includes("Smith"));
  const act = S.settings.gym || ei === firstOpen() ? en.sets.findIndex((s) => !s.done) : -1; // Q13: the +/- line only under the current set of the current exercise
  const t1 = P.tgt(1);
  let n = 0;
  const xn = esc(e?.name || en.slug);
  const ssIn = S.active.entries[ei - 1]?.ss, ssOut = en.ss && S.active.entries[ei + 1];
  return `<div class="xblock ${allDone ? "done-all" : ""} ${S.settings.gym && ei === gi ? "cur" : ""} ${ssOut ? "ss-out" : ""} ${ssIn ? "ss-in" : ""}" data-ei="${ei}" data-slug="${esc(en.slug)}">
    ${ssOut ? `<div class="ss-tag">${ic("swap", "xs")} ${t("Superset with next — no rest between")}</div>` : ""}
    <div class="xhead"><a href="#/ex/${en.slug}" aria-label="${t("How to do {name}", { name: esc(e?.name || en.slug) })}"><img src="${e?.poster || ""}" alt=""></a>
      <div class="grow"><div class="t">${esc(e?.name || en.slug)}</div>
        <div class="hint"><span>${e?.each_side ? t("{r} reps each side", { r: esc(en.target || "") }) : t("{r} reps", { r: esc(en.target || "") })} ·</span><button class="restb" data-a="rest" aria-label="${t("Rest between sets: {rest}. Change", { rest: restLbl(restOf(en)) })}">${restLbl(restOf(en))}</button></div>
        ${last ? `<div class="hint"><span class="beat">${ic("target")}${t("Today: {x}", { x: wr(t1.w, t1.r, u) })}</span><span class="dim">${t("(last: {x})", { x: wr(P.top.w, P.top.r) })}</span></div>` : ei === firstOpen() && !en.sets.some((s) => s.done) ? `<div class="hint">${t("First time — pick a weight you can do {n} times with good form.", { n: P.tr ? P.tr[1] : 10 })}</div>` : ""}
        ${en.deload ? `<div class="hint" style="color:var(--warn)">${ic("alert", "xs")}<span class="grow">${t("Stalled 5+ weeks — deload: ~60% weight today, then build back up.")}</span></div>` : ""}</div>
      <button class="iconbtn sm" data-a="menu" aria-label="${t("Options")}">${ic("more")}</button></div>
    <div class="set-hdr"><span>${t("Set")}</span><span>${t("Last")}<span class="lt"> ${t("time")}</span></span><span>${u}</span><span>${t("Reps")}</span><span></span></div>
    <div class="sets">${en.sets.map((s, si) => { const warm = s.type === "w"; if (!warm) n++; const pv = warm ? null : P.prev(n), tg = warm ? { w: "", r: "" } : P.tgt(n), sn = warm ? t("warm-up") : n;
      return `<div class="setrow ${s.done ? "done" : ""} ${si === act ? "act" : ""}" data-si="${si}">
      <button class="n ${warm ? "w" : ""}" data-a="type" aria-label="${t("Set {n} type, {name}", { n: sn, name: xn })}">${warm ? "W" : n}</button>
      ${pv ? `<button class="prev num" data-a="prev" data-w="${esc(pv.w)}" data-r="${esc(pv.r)}" aria-label="${t("Same as last time: {x}", { x: esc(wr(pv.w, pv.r, u)) })}">${esc(wr(pv.w, pv.r))}</button>` : `<span class="prev dim">—</span>`}
      <div class="stepper"><input data-k="w" inputmode="decimal" enterkeyhint="next"${barb ? ` title="${t("Hold for plates")}"` : ""} placeholder="${esc(tg.w || "kg")}" value="${esc(s.w)}" aria-label="${t("Set {n} weight, {name}", { n: sn, name: xn })}"></div>
      <div class="stepper"><input data-k="r" inputmode="numeric" enterkeyhint="done" placeholder="${esc(tg.r || "—")}" value="${esc(s.r)}" aria-label="${t("Set {n} reps, {name}", { n: sn, name: xn })}"></div>
      <button class="check" data-a="done" aria-pressed="${!!s.done}" aria-label="${t("Set {n} done, {name}", { n: sn, name: xn })}">${ic("check")}</button>
      <div class="stepline"><div><button data-a="w-" aria-label="${t("Less weight")}">−</button><span><bdi>${wStep(e)} ${u}</bdi></span><button data-a="w+" aria-label="${t("More weight")}">+</button></div>
        <div><button data-a="r-" aria-label="${t("Fewer reps")}">−</button><span>${t("1 rep")}</span><button data-a="r+" aria-label="${t("More reps")}">+</button></div></div></div>`; }).join("")}</div>
    <div class="xtools"><button class="btn sm ghost" data-a="add">${ic("plus", "sm")} ${t("Set")}</button>${allDone && opened.has(en) ? `<button class="btn sm ghost" data-a="fold" aria-expanded="true">${ic("up", "sm")} ${t("Done")}</button>` : ""}</div>
    ${S.settings.gym && allDone && ei < S.active.entries.length - 1 ? `<button class="btn primary block big" data-a="next">${t("Next exercise")} ${ic("chev", "sm")}</button>` : ""}</div>`;
}
let lpFired = 0;
function wireSession() {
  const a = S.active; const box = $("#entries");
  const refreshStats = () => { const st = stats(); $("#stSets").textContent = st.sets; $("#stVol").textContent = st.vol; };
  const rerender = (ei) => { const f0 = firstOpen(); [ei, ...(f0 >= 0 && f0 !== ei ? [f0] : [])].forEach((i) => { const old = box.querySelector(`[data-ei="${i}"]`); if (old) old.outerHTML = entryHTML(a.entries[i], i); }); restHint(); };
  offHint?.(); offHint = Tm.onTick(restHint); restHint();
  box.oninput = (e) => {
    const inp = e.target.closest("input"); if (!inp) return;
    const en = a.entries[+inp.closest("[data-ei]").dataset.ei]; en.sets[+inp.closest("[data-si]").dataset.si][inp.dataset.k] = inp.value.replace(",", ".");
    save("active");
  };
  box.addEventListener("focusin", (e) => { const b = e.target.closest("[data-ei]"); if (b && +b.dataset.ei !== sideCur) { sideCur = +b.dataset.ei; side(); } });
  box.addEventListener("click", () => setTimeout(side, 0));
  box.addEventListener("focusin", (e) => { const row = e.target.closest(".setrow"); if (!row || row.classList.contains("act")) return;
    box.querySelectorAll(".setrow.act").forEach((x) => x.classList.remove("act")); row.classList.add("act"); });
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
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => box.addEventListener(ev, lpEnd));
  box.addEventListener("scroll", lpEnd, { passive: true, capture: true });
  box.addEventListener("contextmenu", (e) => { if (Date.now() - lpFired < 900 && e.target.closest('input[data-k="w"]')) e.preventDefault(); });
  const ph = (row, k) => { const v = row.querySelector(`[data-k="${k}"]`).placeholder; return /^\d+([.,]\d+)?$/.test(v) ? v : ""; };
  box.onclick = async (e) => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const blk = b.closest("[data-ei]"); const ei = +blk.dataset.ei; const en = a.entries[ei]; const ex = BY[en.slug];
    const row = b.closest("[data-si]"); const si = row ? +row.dataset.si : -1; const s = row ? en.sets[si] : null;
    const act = b.dataset.a; haptic();
    if (act === "unfold") { opened.add(en); rerender(ei); return; }
    if (act === "fold") { opened.delete(en); rerender(ei); box.querySelector(`[data-ei="${ei}"]`)?.scrollIntoView({ block: "nearest" }); return; }
    if (act === "w+" || act === "w-") { const step = wStep(ex);
      s.w = String(Math.max(0, Math.round(((+s.w || +ph(row, "w") || 0) + (act === "w+" ? step : -step)) * 100) / 100)); row.querySelector('[data-k="w"]').value = s.w; save("active"); return; }
    if (act === "r+" || act === "r-") { s.r = String(Math.max(0, (+s.r || +ph(row, "r") || 0) + (act === "r+" ? 1 : -1))); row.querySelector('[data-k="r"]').value = s.r; save("active"); return; }
    if (act === "type") { s.type = s.type === "w" ? "n" : "w"; save("active"); rerender(ei); return; }
    if (act === "rest") return restSheet(ei);
    if (act === "prev" || act === "done") {
      if (act === "prev") { s.w = b.dataset.w || ""; s.r = b.dataset.r || ""; if (s.done) { save("active"); rerender(ei); refreshStats(); return; } }
      if (!s.w) s.w = ph(row, "w"); if (!s.r) s.r = ph(row, "r");
      if (!s.done) { // UT-2: nothing typed and no target to copy (first time) -> ask for the number instead of logging 0
        const bw = (ex?.equipment || []).length && ex.equipment.every((q) => /body/i.test(q));
        const miss = !s.r ? "r" : !s.w && !bw ? "w" : null;
        if (miss) { const inp = row.querySelector(`[data-k="${miss}"]`); inp.focus(); inp.classList.add("need"); setTimeout(() => inp.classList.remove("need"), 1600);
          toast(miss === "w" ? t("Type the weight first (0 = bodyweight)") : t("Type the reps first")); return; }
      }
      s.done = !s.done; save("active");
      if (s.done) {
        haptic("success"); $("#warmN")?.remove();
        const nx = en.sets[si + 1]; if (nx && !nx.w && nx.type === s.type) nx.w = s.w;
        if (s.type !== "w" && isPR(en.slug, s)) { confetti(); toast(t("New PR: {w}{u} × {r}", { w: s.w, u: S.settings.unit, r: s.r })); beep([[660, .1], [880, .1], [1175, .2]]); }
        const ssNext = en.ss && a.entries[ei + 1];
        restEi = ei;
        if (s.type !== "w" && ssNext) toast(t("Superset: now {name}", { name: BY[ssNext.slug]?.name || t("next exercise") }));
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
    if (act === "menu") return entryMenu(ei);
  };
  const gp = $("#gPrev"), gn = $("#gNext"); if (gp) gp.onclick = () => gymGo(gi - 1); if (gn) gn.onclick = () => gymGo(gi + 1);
  if (S.settings.gym) { let x0 = null, y0 = 0; // swipe left/right between exercises
    box.ontouchstart = (e) => { if (e.target.closest("input,.stepper")) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
    box.ontouchend = (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) gymGo(gi + (dx < 0 ? 1 : -1) * (document.dir === "rtl" ? -1 : 1)); }; }
  $("#addEx").onclick = () => { pickMode = { toSession: true, selected: new Set() }; go("#/pick"); };
  $("#fin").onclick = finishSession; $("#finTop").onclick = finishSession;
  const discard = async () => { if (await ask(t("Discard this workout? Nothing will be saved."), { ok: t("Discard"), danger: true })) { closeSheet(); S.active = null; save("active"); stopRest(); wakeLock?.release?.(); redirect("#/train"); } };
  $("#sMore").onclick = () => openSheet(`<h3>${esc(a.name)}</h3><div class="menu"><button id="sAdd">${ic("plus", "sm")}${t("Add exercise")}</button><button id="sGym" aria-pressed="${!!S.settings.gym}">${ic("phone", "sm")}<span class="grow">${t("Gym mode")}</span><span class="switch${S.settings.gym ? " on" : ""}" aria-hidden="true"></span></button><button class="danger" id="sDisc">${ic("trash", "sm")}${t("Discard workout")}</button></div>`, (el) => {
    $("#sAdd", el).onclick = () => { closeSheet(); $("#addEx").click(); };
    $("#sGym", el).onclick = () => { S.settings.gym = !S.settings.gym; save("settings"); haptic(); closeSheet(); sessionView(); };
    $("#sDisc", el).onclick = discard;
  });
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
    const what = warm ? t("warm-up set") : t("set {n} of {m}", { n, m: work.length }), load = r ? ` · ${iso(`${w ? `${w} ${u} × ` : ""}${r}`)}` : "";
    const text = (i === ei ? t("Next: {what}", { what }) : t("Next: {name} · {what}", { name, what })) + load;
    const fresh = !en.sets.some((x) => x.done); // Voice: a new exercise gets its name and first cue spoken
    return { text, slug: en.slug, name, set: warm ? "" : n, of: work.length, w: String(w || ""), r: String(r || ""), fam: BY[en.slug]?.family || "", newEx: i !== ei || fresh, cue: fresh ? BY[en.slug]?.cues?.[0] || "" : "" };
  }
  return { text: t("Last set — finish strong"), last: true }; // voice.js P.go uses `last` (text is translated)
}
const nextLabel = (ei, si) => nextInfo(ei, si + 1), ssBackLabel = (pi) => nextInfo(pi, 0);
function isPR(slug, s) { const b = bestOf(slug); const v = e1rm(s.w, s.r); return v > 0 && b && v > b.e1rm; }
function restSheet(ei) {
  const en = S.active.entries[ei], cur = restOf(en), def = BY[en.slug]?.rest ?? S.settings.restDefault;
  const opts = [0, 45, 60, 90, 120, 150, 180, 240, 300];
  openSheet(`<h3>${t("Rest between sets")}</h3><p class="muted small" style="margin:-6px 0 12px">${esc(BY[en.slug]?.name || "")} · ${t("saved for next time. Suggested: {time}", { time: restText(def) })}</p>
    <div class="restgrid">${opts.map((o) => `<button class="btn ${o === cur ? "primary" : ""}" data-r="${o}">${o ? fmtDur(o * 1000) : t("Off")}</button>`).join("")}</div>`, (el) => {
    el.onclick = (e) => { const b = e.target.closest("[data-r]"); if (!b) return; const v = +b.dataset.r;
      S.settings.restEx = { ...(S.settings.restEx || {}) }; if (v === def) delete S.settings.restEx[en.slug]; else S.settings.restEx[en.slug] = v;
      store("settings"); closeSheet(); sessionView(); haptic(); };
  }, { half: true });
}
function swapSheet(ei) {
  const en = S.active.entries[ei]; const ex = BY[en.slug]; const alts = swaps(ex, 10);
  openSheet(`<h3>${t("Swap exercise")}</h3><p class="muted small" style="margin:-6px 0 12px">${t("Machine taken? Same muscle, best tier first.")}</p><div class="stack tight">
    ${alts.map((x) => `<button class="lrow" data-s="${x.slug}"><img src="${x.poster}" alt=""><div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.equipment.join(" · "))}</div></div>${tierBadge(x.tier)}</button>`).join("") || `<div class="empty">${t("No alternatives with your equipment.")}</div>`}</div>`, (el) => {
    el.onclick = (e) => { const b = e.target.closest("[data-s]"); if (!b) return; S.active.entries[ei] = newEntry(b.dataset.s, en.sets.length, en.target); save("active"); closeSheet(); sessionView(); toast(t("Swapped")); };
  });
}
function entryMenu(ei) {
  const a = S.active; const en = a.entries[ei], ex = BY[en.slug], barb = ex && (ex.equipment.includes("Barbell") || ex.equipment.includes("Smith"));
  openSheet(`<h3>${esc(BY[en.slug]?.name)}</h3><div class="menu">
    <button data-m="swap">${ic("swap", "sm")}${t("Swap exercise")}</button><button data-m="warm">${ic("flame", "sm")}${t("Add warm-up sets")}</button>${barb ? `<button data-m="plates">${ic("calc", "sm")}${t("Plate calculator")}</button>` : ""}
    <button data-m="up" ${ei ? "" : "disabled"}>${ic("up", "sm")}${t("Move up")}</button><button data-m="down" ${ei < a.entries.length - 1 ? "" : "disabled"}>${ic("down", "sm")}${t("Move down")}</button>
    <button data-m="ss" ${ei < a.entries.length - 1 ? "" : "disabled"}>${ic("swap", "sm")}${en.ss ? t("Unlink superset") : t("Superset with next exercise")}</button>
    <button data-m="delset">${ic("minus", "sm")}${t("Remove last set")}</button><button data-m="hist">${ic("chart", "sm")}${t("History")}</button><a href="#/ex/${en.slug}">${ic("book", "sm")}${t("How to do it")}</a>
    <button class="danger" data-m="rm">${ic("trash", "sm")}${t("Remove exercise")}</button></div>`, (el) => {
    el.onclick = (e) => {
      const b = e.target.closest("[data-m]"); if (!b) return; const m = b.dataset.m;
      if (m === "hist") { closeSheet(); setTimeout(() => historySheet(en.slug), 220); return; }
      if (m === "swap") { closeSheet(); setTimeout(() => swapSheet(ei), 220); return; }
      if (m === "plates") { closeSheet(); const w = en.sets.find((x) => !x.done && +x.w)?.w || en.sets.find((x) => +x.w)?.w || lastSets(en.slug)?.sets[0]?.w || 60; setTimeout(() => plateSheet(+w), 220); return; }
      if (m === "warm") { closeSheet(); setTimeout(() => addWarm(ei), 220); return; }
      if (m === "up" && ei > 0) [a.entries[ei - 1], a.entries[ei]] = [a.entries[ei], a.entries[ei - 1]];
      if (m === "down" && ei < a.entries.length - 1) [a.entries[ei + 1], a.entries[ei]] = [a.entries[ei], a.entries[ei + 1]];
      if (m === "delset" && en.sets.length > 1) en.sets.pop();
      if (m === "ss") { en.ss = !en.ss; toast(en.ss ? t("Superset: no rest until both are done") : t("Superset removed")); }
      if (m === "rm") { a.entries.splice(ei, 1); if (ei && !a.entries[ei]) a.entries[ei - 1].ss = false; }
      if (m === "up" || m === "down") a.entries.forEach((x) => (x.ss = false));
      save("active"); closeSheet(); sessionView();
    };
  });
}
async function addWarm(ei) {
  const en = S.active?.entries[ei]; if (!en) return; const ex = BY[en.slug];
  const work = en.sets.find((x) => x.type !== "w" && +x.w)?.w || lastSets(en.slug)?.sets[0]?.w || await askText(t("Working weight ({u})", { u: S.settings.unit }), { inputmode: "decimal", ok: t("Add warm-up") }); if (!+work) return;
  const ws = warmupSets(work, ex); if (!ws.length) return toast(t("No warm-up needed for this weight"));
  en.sets = [...ws.map((x) => ({ w: String(x.w), r: String(x.r), done: false, type: "w" })), ...en.sets.filter((x) => x.type !== "w")];
  save("active"); sessionView(); toast(tn(ws.length, "Added {n} warm-up set", "Added {n} warm-up sets"));
}
async function finishSession() {
  const a = S.active; const st = stats();
  if (!st.sets) { // Q0c: never save an empty session (0 sets would count in history, calendar and streak)
    if (await ask(t("Nothing was logged. Discard this workout?"), { ok: t("Discard"), cancel: t("Keep going"), danger: true })) { closeSheet(); S.active = null; save("active"); stopRest(); wakeLock?.release?.(); clearInterval(clockT); redirect("#/train"); }
    return;
  }
  const left = a.entries.reduce((n, en) => n + en.sets.filter((s) => !s.done).length, 0); // UT-1: never drop unticked sets silently
  if (st.sets && left && !(await ask(tn(left, "{n} set is not checked and won't be saved. Finish anyway?", "{n} sets are not checked and won't be saved. Finish anyway?"), { ok: t("Finish"), cancel: t("Keep going") }))) return;
  const prs = [];
  a.entries.forEach((en) => { const b = bestOf(en.slug); en.sets.forEach((s) => { if (s.done && s.type !== "w") { const v = e1rm(s.w, s.r); if (v && (!b || v > b.e1rm) && !prs.find((p) => p.slug === en.slug)) prs.push({ slug: en.slug, w: s.w, r: s.r }); } }); });
  a.endedAt = Date.now();
  a.entries = a.entries.map((en) => ({ slug: en.slug, sets: en.sets.filter((s) => s.done) })).filter((en) => en.sets.length);
  S.sessions.push(a); S.active = null; store("sessions", "active"); stopRest(); wakeLock?.release?.(); clearInterval(clockT);
  if (S.sessions.length === 1) persist();
  haptic("success"); beep([[523, .1], [659, .1], [784, .25]]); if (prs.length) confetti();
  redirect("#/");
  setTimeout(() => openSheet(`<div class="tc"><div class="ill" data-ill="${prs.length ? "pr" : "rest-recovery"}" style="max-width:150px"></div><h3 style="margin:4px 0 2px">${t("Workout complete")}</h3><div class="muted small">${esc(a.name)} · ${fmtDur(a.endedAt - a.startedAt)}</div></div>
    <div class="kpis" style="margin:16px 0"><div class="kpi"><b class="num">${st.sets}</b><span>${t("Sets")}</span></div><div class="kpi"><b class="num">${st.vol}</b><span>${t("{u} volume", { u: S.settings.unit })}</span></div><div class="kpi"><b class="num">${prs.length}</b><span>${t("New PRs")}</span></div></div>
    ${prs.length ? `<div class="stack tight">${prs.map((p) => `<div class="lrow"><img src="${BY[p.slug]?.poster}" alt=""><div class="grow"><div class="t">${esc(BY[p.slug]?.name)}</div><div class="s">${p.w}${S.settings.unit} × ${p.r}</div></div>${ic("trophy")}</div>`).join("")}</div>` : ""}
    <div class="row mt-16"><button class="btn grow" id="shareW">${ic("share", "sm")} ${t("Share")}</button><button class="btn primary grow" id="done">${t("Done")}</button></div>
    <a class="btn ghost block mt-6" href="#/warmup/cool" id="coolW">${ic("timer", "sm")} ${t("Cool-down stretches (optional)")}</a>`, (el) => {
      fillIll(el); $("#done", el).onclick = closeSheet; setTimeout(() => $("#done", el)?.focus({ focusVisible: false }), 60); /* UT-13: not a red ring on Share */
      $("#shareW", el).onclick = () => import("./share.js").then((m) => m.shareSession(a, st, prs)).catch((e) => { console.error(e); toast(t("Could not share")); });
    }), 120);
}

/* ---------------- rest timer (global timer + floating pill) ---------------- */
/* while a rest runs, one line in the exercise you just ticked: "Resting 1:49 · next: set 2 · 66 kg × 10" (gone when the rest ends or is skipped) */
let restEi = -1, offHint = null;
function restHint() {
  const box = $("#entries"); if (!box) return;
  let h = box.querySelector(".rhint"); const nx = Tm.T.nx || {};
  let blk = Tm.isRest() && S.active ? box.querySelector(`[data-ei="${restEi}"]:not(.fold)`) || (nx.slug && box.querySelector(`[data-slug="${CSS.escape(nx.slug)}"]:not(.fold)`)) : null;
  if (blk && !$(".sets", blk)) blk = null;
  if (!blk) { h?.remove(); return; }
  const row = blk.querySelector(".setrow:not(.done)"), same = row && blk.dataset.slug === nx.slug, u = S.settings.unit;
  const load = nx.r ? ` · ${iso(`${nx.w ? `${nx.w} ${u} × ` : ""}${nx.r}`)}` : "";
  const next = !nx.name ? "" : same ? " · " + t("next: {what}", { what: nx.set ? t("set {n}", { n: nx.set }) : t("warm-up") }) + load : " · " + t("next: {what}", { what: nx.name }); // plain text (textContent)
  const txt = t("Resting {time}", { time: Tm.view().text }) + next;
  if (!h || h.parentElement !== (same ? row.parentElement : $(".sets", blk)) || (same && h.nextElementSibling !== row)) {
    h?.remove(); h = document.createElement("div"); h.className = "rhint"; h.innerHTML = `${ic("timer", "xs")}<span></span>`;
    if (same) row.before(h); else $(".sets", blk).append(h);
  }
  const sp = h.lastElementChild; if (sp.textContent !== txt) sp.textContent = txt;
}
export function startRest(sec, nx = {}) { Tm.startCountdown(sec, { kind: "rest", label: t("Rest"), next: nx.text || "", nx }); }
export function stopRest() { if (Tm.T.mode === "countdown" && Tm.T.kind === "rest") Tm.stop(); }

/* ---------------- tools ---------------- */
async function historySheet(slug) {
  const X = await import("./exercise.js");
  openSheet(`<h3>${esc(BY[slug]?.name || slug)}</h3><div class="dim small" style="margin:-4px 0 12px">${t("History")}</div>${X.historyHTML(slug)}`, (el) => { fillIll(el); X.wireHistory(el, slug); });
}
export function plateSheet(total) {
  const u = S.settings.unit;
  const draw = (el) => {
    const tw = +$("#pw", el).value || 0; const { bar, out, rest } = platesFor(tw);
    const plate = (p, i) => `<div class="plate" style="height:${plateHeight(p)}px;background:${plateColor(p)};animation-delay:${i * 40}ms" title="${p}"></div>`;
    $("#viz", el).innerHTML = `<div class="sleeve"></div>${[...out].reverse().map(plate).join("")}<div class="bar"></div><div class="bar"></div>${out.map(plate).join("")}<div class="sleeve"></div>`;
    $("#ptxt", el).innerHTML = tw <= bar ? t("Just the bar ({w}{u})", { w: bar, u }) : `${t("Each side:")} <b>${out.join(" + ") || "—"}</b>${rest ? ` <span style="color:var(--warn)">${t("({w}{u} can't be made)", { w: rest, u })}</span>` : ""}`;
  };
  openSheet(`<h3>${t("Plate calculator")}</h3><div class="field"><label>${t("Total weight ({u}) · bar {bar}{u}", { u, bar: S.settings.bar })}</label>
    <div class="stepper" style="height:56px"><button id="pm" style="width:56px;font-size:24px" aria-label="${t("Minus 5")}">−</button><input id="pw" inputmode="decimal" value="${total}" style="font-size:26px"><button id="pp" style="width:56px;font-size:24px" aria-label="${t("Plus 5")}">+</button></div></div>
    <div class="barbell" id="viz"></div><div id="ptxt" style="text-align:center;font-size:17px"></div>`, (el) => {
    draw(el); $("#pw", el).oninput = () => draw(el);
    $("#pm", el).onclick = () => { $("#pw", el).value = Math.max(0, +$("#pw", el).value - 5); draw(el); haptic(); };
    $("#pp", el).onclick = () => { $("#pw", el).value = +$("#pw", el).value + 5; draw(el); haptic(); };
  });
}
function oneRmSheet() {
  const u = S.settings.unit;
  openSheet(`<h3>${t("1RM calculator")}</h3><div class="row"><div class="field grow"><label>${t("Weight ({u})", { u })}</label><input id="ow" inputmode="decimal" value="80"></div><div class="field grow"><label>${t("Reps")}</label><input id="or" inputmode="numeric" value="8"></div></div>
    <div class="card soft pad tc"><div class="eyebrow">${t("Estimated 1RM")}</div><div style="font-size:44px;font-weight:780" class="num" id="ores">—</div></div>
    <div class="h4">${t("Training weights")}</div><div class="kv" id="opct"></div>`, (el) => {
    const draw = () => { const v = e1rm($("#ow", el).value, $("#or", el).value); $("#ores", el).textContent = v ? v + u : "—";
      $("#opct", el).innerHTML = [[.9, "3"], [.85, "5"], [.8, "8"], [.75, "10"], [.7, "12"], [.65, "15"]].map(([p, r]) => `<div><b class="num">${v ? Math.round(v * p * 2) / 2 : "—"}</b><span>${t("~{r} reps · {p}%", { r, p: Math.round(p * 100) })}</span></div>`).join(""); };
    draw(); el.oninput = draw;
  });
}

/* ---------------- misc ---------------- */
export function updateLiveDot() { const a = $('.nav [data-tab="train"]'); if (!a) return; a.querySelector(".dot")?.remove(); if (S.active) a.insertAdjacentHTML("beforeend", '<span class="dot"></span>'); }
