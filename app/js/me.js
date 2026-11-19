// Me: three tabs — Progress (week vs week, charts, PRs, bodyweight), Workouts (16-week calendar + past sessions), Settings.
// Routes: #/me, #/me/workouts, #/me/settings (#/settings opens the Settings tab).
import { S, save, tomb, persist, exportData, importData, undoImport, flush } from "./store.js";
import { $, $$, esc, ic, ask, askText, openSheet, closeSheet, toast, haptic, fmtDate, fmtDur, lineChart, vBars, delta, fmtKg, indicate, selectIn } from "./ui.js";
import { EX, BY, EQUIP_PROFILES, bestOf, setsText, weeklyVolume, periodStats, exerciseStats, weekStart, WEEK, DAY, history, flaggedJoints, JOINTS } from "./data.js";
import { MUSCLES, MBY } from "./body.js";
import { e1rm } from "./calc.js";
import { setTop, routeParts } from "./nav.js";
import { installNow, standalone } from "./install.js";
import { applyTheme, fillIll, MEDIA_CACHE, RECENT_CACHE, tierBadge, GUIDE_LEVELS, guideBtns } from "./components.js";
import { lib } from "./exercise.js";
import * as Sync from "./sync.js";
import * as V from "./voice.js";
import { readLog, clearLog } from "./log.js";
import { LANGS, READY, lang as curLang, t, tn, N, loc } from "./i18n.js";

const view = () => $("#view");
const me = { tab: "progress", ex: null };
const TABS = [["progress", N("Progress")], ["workouts", N("Workouts")], ["settings", N("Settings")]];
const u = () => S.settings.unit;

// FE-6: shown only when something actually went wrong
const errLog = () => { const n = readLog().length; return n ? `<div class="dim tiny errlog mt-6">${tn(n, "{n} app error logged", "{n} app errors logged")} · <a href="#" id="copyLog" style="color:var(--accent-text)">${t("Copy debug log")}</a> · <a href="#" id="clearLog" style="color:var(--accent-text)">${t("Clear")}</a></div>` : ""; };
export function meView() {
  const [, a, b] = routeParts();
  me.tab = a === "settings" ? "settings" : TABS.some(([k]) => k === b) ? b : "progress";
  setTop({ title: t("Me") });
  view().innerHTML = `<div class="ptabs" id="mtabs" role="tablist">${TABS.map(([k, l]) => `<button data-k="${k}" role="tab" class="${me.tab === k ? "on" : ""}">${t(l)}</button>`).join("")}</div>
    <div class="tab-panel" id="mpanel"></div>`;
  $("#mtabs").onclick = (e) => { const b = e.target.closest("button"); if (!b || b.classList.contains("on")) return; haptic(); me.tab = b.dataset.k;
    window.history.replaceState(window.history.state, "", me.tab === "progress" ? "#/me" : `#/me/${me.tab}`); selectIn(b); panel(); };
  panel();
}
function panel() {
  const p = $("#mpanel"); p.style.animation = "none"; void p.offsetWidth; p.style.animation = ""; p.onclick = null;
  me.tab === "workouts" ? historyPanel(p) : me.tab === "settings" ? settingsPanel(p) : progressPanel(p);
  fillIll(p); requestAnimationFrame(() => indicate(p));
}
/** #/settings (keyboard ",", old links) = the Settings tab of Me */
export function settingsView() { me.tab = "settings"; window.history.replaceState(window.history.state, "", "#/me/settings"); meView(); }

/* ---------------- progress ---------------- */
function progressPanel(p) {
  if (!S.sessions.length) {
    p.innerHTML = `<div class="card pad tc"><div class="ill" data-ill="empty-history" style="max-width:150px"></div><b>${t("No workouts yet")}</b><div class="muted small">${t("Finish a workout and your progress, records and weekly totals show up here.")}</div></div>
      <div class="mt-12">${bodyweightCard()}</div>`;
    wireBW(p); return;
  }
  const w0 = weekStart(), now = Date.now();
  const cur = periodStats(w0, now + 1), prev = periodStats(w0 - WEEK, w0);
  const kpi = (v, l, d) => `<div class="kpi"><b class="num">${v}</b><span>${l}</span>${d}</div>`;
  const weeks = Array.from({ length: 8 }, (_, i) => { const a = w0 - (7 - i) * WEEK; return [new Date(a).toLocaleDateString(loc(), { day: "numeric", month: "numeric" }), periodStats(a, a + WEEK).kg, i === 7]; });
  const vol = weeklyVolume(7);
  const mus = MUSCLES.filter((m) => m.lm[0] > 0).map((m) => [m, Math.round(vol[m.id] || 0)]).sort((a, b) => b[1] - a[1]);
  const mx = Math.max(10, ...mus.map((x) => x[1]));
  p.innerHTML = `<div class="cols">
    <div class="stack">
      <div class="card pad"><div class="row between"><b>${t("This week")}</b><span class="dim tiny">${t("vs last week")}</span></div>
        <div class="kpis mt-10">${kpi(fmtKg(cur.kg), t("Volume {u}", { u: u() }), delta(cur.kg, prev.kg, fmtKg))}${kpi(cur.sets, t("Sets"), delta(cur.sets, prev.sets))}${kpi(cur.reps, t("Reps"), delta(cur.reps, prev.reps))}</div></div>
      <div class="card pad"><div class="row between mb-10"><b>${t("Weekly volume")}</b><span class="dim tiny">${t("{u} lifted · 8 weeks", { u: u() })}</span></div>${vBars(weeks.map(([l, v, c]) => [l, v, c]))}</div>
      <div class="card pad"><div class="row between mb-10"><b>${t("Sets per muscle")}</b><span class="dim tiny">${t("last 7 days · aim 10+")}</span></div>
        <div class="bars">${mus.map(([m, n]) => `<div><span class="ellip">${m.name}</span><div class="b"><i class="${n < 10 && m.lm[0] > 0 ? "low" : ""}" style="width:${(n / mx) * 100}%"></i></div><span class="v num">${n}</span></div>`).join("")}</div></div>
    </div>
    <div class="stack">
      ${progressChart()}
      ${perExercise(w0)}
      ${prList()}
      ${bodyweightCard()}
    </div></div>`;
  wireChart(p); wireBW(p);
}
function perExercise(w0) {
  const cur = exerciseStats(w0, Date.now() + 1), prev = exerciseStats(w0 - WEEK, w0);
  const slugs = [...new Set([...Object.keys(cur), ...Object.keys(prev)])].filter((s) => BY[s]).slice(0, 8);
  if (!slugs.length) return "";
  const cell = (o) => (o ? `${o.sets}×${Math.round(o.reps / o.sets)}${o.best?.w ? ` · ${o.best.w}` : ""}` : `<span class="dim">—</span>`);
  return `<div class="card pad"><div class="row between"><b>${t("Per exercise")}</b><span class="dim tiny">${t("sets×reps · top {u}", { u: u() })}</span></div>
    <table class="cmp mt-6"><tr><th>${t("Exercise")}</th><th class="n">${t("Last wk")}</th><th class="n">${t("This wk")}</th></tr>
    ${slugs.map((s) => { const c = cur[s], l = prev[s]; const up = c && l && c.e1 > l.e1;
      return `<tr><td><a href="#/ex/${s}" class="b">${esc(BY[s].name)}</a></td><td class="n">${cell(l)}</td><td class="n">${cell(c)}${up ? ` <span class="d up" style="display:inline-flex">${ic("arrowUp", "xs")}</span>` : ""}</td></tr>`; }).join("")}</table></div>`;
}
function topExercises() {
  const n = {}; S.sessions.forEach((s) => s.entries.forEach((en) => { if (en.sets.some((x) => x.done && x.type !== "w" && (+x.w || +x.r))) n[en.slug] = (n[en.slug] || 0) + 1; })); // same rule as history()
  return Object.keys(n).filter((s) => BY[s] && n[s] >= 2).sort((a, b) => n[b] - n[a]).slice(0, 6);
}
function progressChart() {
  const tops = topExercises(); if (!tops.length) return "";
  if (!tops.includes(me.ex)) me.ex = tops[0];
  return `<div class="card pad" id="pchart"><div class="row between"><b>${t("Strength")}</b><span class="dim tiny">${t("est. 1RM per session")}</span></div>
    <div class="chips" style="margin:6px 0 2px;padding-inline:0;margin-inline:0" id="pex">${tops.map((s) => `<button class="chip ${s === me.ex ? "on" : ""}" data-s="${s}">${esc(BY[s].name.length > 22 ? BY[s].name.slice(0, 21) + "…" : BY[s].name)}</button>`).join("")}</div>
    <div id="pplot">${plot(me.ex)}</div></div>`;
}
function plot(slug) {
  const h = history(slug); const pts = h.map((x) => Math.max(...x.sets.map((s) => e1rm(s.w, s.r))));
  if (pts.length < 2) return `<p class="dim small" style="margin:8px 0 0">${t("Log this exercise in two sessions to see the trend.")}</p>`;
  const b = bestOf(slug);
  return `${lineChart(pts)}<div class="chart-x"><span>${fmtDate(h[0].date, { month: "short", day: "numeric" })}</span><span>${t("Best {v}{u}", { v: b?.e1rm ?? "—", u: u() })}</span><span>${fmtDate(h.at(-1).date, { month: "short", day: "numeric" })}</span></div>`;
}
function wireChart(p) { const c = $("#pex", p); if (c) c.onclick = (e) => { const b = e.target.closest("[data-s]"); if (!b) return; haptic(); me.ex = b.dataset.s; $$(".chip", c).forEach((x) => x.classList.toggle("on", x === b)); $("#pplot", p).innerHTML = plot(me.ex); }; }
function prList() {
  const prs = Object.keys(BY).map((s) => [s, bestOf(s)]).filter(([, b]) => b).sort((a, b) => b[1].date - a[1].date).slice(0, 6);
  if (!prs.length) return "";
  return `<div class="card pad"><div class="row between" style="margin-bottom:6px"><b>${t("Personal records")}</b>${ic("trophy", "sm")}</div><div class="list-sep">${prs.map(([s, b]) => `<a class="lrow plain" href="#/ex/${s}"><img src="${BY[s].poster}" alt="" style="width:40px;height:40px"><div class="grow"><div class="t ellip">${esc(BY[s].name)}</div><div class="s">${b.w}${u()} × ${b.r} · ${fmtDate(b.date, { month: "short", day: "numeric" })}</div></div><b class="num">${b.e1rm}<span class="dim tiny"> e1RM</span></b></a>`).join("")}</div></div>`;
}
/* ---------------- bodyweight ---------------- */
const bw = () => [...(S.bodyweight || [])].filter((x) => x && +x.w).sort((a, b) => String(a.d).localeCompare(String(b.d)));
function bodyweightCard() {
  const l = bw(), last = l.at(-1), first = l.length > 1 ? l[0] : null;
  return `<div class="card pad"><div class="row between"><div class="row"><span class="ico-t">${ic("scale", "sm")}</span><div><b>${t("Bodyweight")}</b>
      <div class="dim small">${last ? `${last.w}${u()} · ${fmtDate(last.d, { month: "short", day: "numeric" })}${first ? ` · ${t("{v} total", { v: (last.w - first.w > 0 ? "+" : "") + Math.round((last.w - first.w) * 10) / 10 + u() })}` : ""}` : t("Log it once a week, same time of day.")}</div></div></div>
      <button class="btn sm" id="bwAdd">${ic("plus", "sm")} ${t("Add")}</button></div>
    ${l.length > 1 ? `<div class="mt-10">${lineChart(l.slice(-20).map((x) => +x.w), { h: 90 })}</div>` : ""}</div>`;
}
function wireBW(p) {
  const b = $("#bwAdd", p); if (!b) return;
  b.onclick = async () => {
    const v = await askText(t("Bodyweight today ({u})", { u: u() }), { value: bw().at(-1)?.w ?? "", inputmode: "decimal", ok: t("Save") });
    const w = parseFloat(String(v || "").replace(",", ".")); if (!w || w < 20 || w > 400) { if (v) toast(t("Enter a number like 78.5")); return; }
    const d = new Date().toISOString().slice(0, 10);
    S.bodyweight = [...(S.bodyweight || []).filter((x) => x.d !== d), { d, w, updatedAt: Date.now() }];
    save("bodyweight"); haptic("success"); toast(t("Saved")); panel();
  };
}

/* ---------------- history ---------------- */
/* Workouts tab: summary tiles, 16-week calendar (month + weekday labels, tap a day -> its workout),
   workouts grouped by week with volume and PR marks. */
const doneSets = (en) => en.sets.filter((x) => x.done !== false && x.type !== "w" && (+x.w || +x.r));
const sessKg = (s) => s.entries.reduce((a, en) => a + doneSets(en).reduce((b, x) => b + (+x.w || 0) * (+x.r || 0), 0), 0);
const sessSets = (s) => s.entries.reduce((a, en) => a + doneSets(en).length, 0);
const nW = (n) => tn(n, "{n} workout", "{n} workouts");
const mins = (ms) => { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? t("{n} min", { n: m }) : m % 60 ? t("{h} h {m} min", { h: Math.floor(m / 60), m: m % 60 }) : t("{h} h", { h: m / 60 }); };
/** slug list per session id where the best e1RM went up (the first time an exercise is done is not a PR) */
function prsBySession() {
  const best = {}, out = {};
  for (const s of [...S.sessions].sort((a, b) => a.endedAt - b.endedAt)) for (const en of s.entries) {
    const top = Math.max(0, ...doneSets(en).map((x) => e1rm(+x.w || 0, +x.r || 0)));
    if (!top) continue;
    if (best[en.slug] && top > best[en.slug] + 0.01) (out[s.id] ??= []).push(en.slug);
    best[en.slug] = Math.max(best[en.slug] || 0, top);
  }
  return out;
}
function weekStreak() {
  const has = new Set(S.sessions.map((s) => weekStart(s.endedAt)));
  let w = weekStart(), n = 0;
  if (!has.has(w)) w -= WEEK; // this week not trained yet: the streak is still alive
  while (has.has(w)) { n++; w = weekStart(w - 3 * DAY); }
  return n;
}
function calendar() {
  const end = weekStart() + WEEK, start = weekStart(end - 16 * WEEK + DAY), first = {}, cnt = {};
  for (const s of S.sessions) if (s.endedAt >= start) { const k = Math.floor((s.endedAt - start) / DAY); cnt[k] = (cnt[k] || 0) + 1; if (!first[k] || s.endedAt > first[k].endedAt) first[k] = s; }
  const today = Math.floor((Date.now() - start) / DAY);
  let lastM = -1; const months = [];
  for (let c = 0; c < 16; c++) { const m = new Date(start + c * WEEK + 6 * DAY).getMonth(); months.push(m !== lastM && c < 15 ? fmtDate(start + c * WEEK + 6 * DAY, { month: "short" }) : ""); lastM = m; }
  const cells = Array.from({ length: 112 }, (_, i) => {
    const ts = start + i * DAY, n = cnt[i] || 0, at = `style="grid-column:${2 + Math.floor(i / 7)};grid-row:${2 + (i % 7)}"`;
    if (i > today) return `<i class="fut" ${at}></i>`;
    const lbl = `${fmtDate(ts)}${n ? ` · ${nW(n)}` : ""}`;
    return n ? `<button class="l${Math.min(3, n + 1)}${i === today ? " now" : ""}" ${at} data-day="${esc(first[i].id)}" title="${lbl}" aria-label="${lbl}"></button>` : `<i class="${i === today ? "now" : ""}" ${at} title="${lbl}"></i>`;
  }).join("");
  return `<div class="hm">${months.map((m, c) => `<span class="hm-m" style="grid-column:${c + 2}">${m}</span>`).join("")}
    ${[N("Mon"), "", N("Wed"), "", N("Fri"), "", ""].map((d, r) => `<span class="hm-d" style="grid-row:${r + 2}">${d && t(d)}</span>`).join("")}
    <div class="heat">${cells}</div></div>
    <div class="hm-legend">${t("Less")} <i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i> ${t("More")}</div>`;
}
let showAll = false;
function historyPanel(p) {
  if (!S.sessions.length) { p.innerHTML = `<div class="empty"><div class="ill" data-ill="empty-history"></div>${t("Finished workouts appear here.")}</div>`; p.onclick = null; return; }
  const now = Date.now(), wk = weekStart(), goal = +S.profile?.days || 3;
  const thisW = periodStats(wk, wk + WEEK), m30 = periodStats(now - 30 * DAY, now + 1), streak = weekStreak();
  const pr = prsBySession(), ss = [...S.sessions].sort((a, b) => b.endedAt - a.endedAt), list = showAll ? ss : ss.slice(0, 40);
  const tile = (v, l, sub) => `<div class="kpi"><b class="num">${v}</b><span>${l}</span>${sub ? `<div class="d dim">${sub}</div>` : ""}</div>`;
  const bar = `<div class="wk-goal" role="img" aria-label="${t("{n} of {g} workouts this week", { n: thisW.workouts, g: goal })}">${Array.from({ length: Math.max(goal, thisW.workouts) }, (_, i) => `<i class="${i < thisW.workouts ? "on" : ""}"></i>`).join("")}</div>`;
  const groups = []; for (const s of list) { const w = weekStart(s.endedAt); if (groups.at(-1)?.w !== w) groups.push({ w, items: [] }); groups.at(-1).items.push(s); }
  const wname = (w) => w === wk ? t("This week") : w === wk - WEEK || w === weekStart(wk - 3 * DAY) ? t("Last week") : `${fmtDate(w, { month: "short", day: "numeric" })} – ${fmtDate(w + 6 * DAY, { month: "short", day: "numeric" })}`;
  const card = (s) => { const prs = pr[s.id] || [], kg = sessKg(s);
    return `<div class="card pad wk-s" id="s-${esc(s.id)}">
      <div class="row"><div class="grow"><b>${esc(s.name || t("Workout"))}</b><div class="dim small">${fmtDate(s.endedAt)} · ${mins(s.endedAt - s.startedAt)} · ${tn(sessSets(s), "{n} set", "{n} sets")}${kg ? ` · ${fmtKg(kg)} ${u()}` : ""}</div></div>
      ${prs.length ? `<span class="pr-b">${ic("trophy", "sm")}${prs.length > 1 ? t("{n} PRs", { n: prs.length }) : "PR"}</span>` : ""}
      <button class="iconbtn sm" data-del="${esc(s.id)}" aria-label="${t("Delete workout")}" style="color:var(--t3)">${ic("trash", "sm")}</button></div>
      <div class="wk-ex">${s.entries.filter((en) => doneSets(en).length).map((en) => `<a href="#/ex/${esc(en.slug)}"><span class="b ellip">${esc(BY[en.slug]?.name || en.slug)}${prs.includes(en.slug) ? ` <span class="pr-i" aria-label="${t("new record")}">${ic("trophy", "sm")}</span>` : ""}</span><span class="dim">${esc(setsText(doneSets(en)))}</span></a>`).join("")}</div></div>`; };
  p.innerHTML = `<div class="wk-top">
      <div class="kpis wk-kpis">
        <div class="kpi"><b class="num">${thisW.workouts}<small class="dim"> / ${goal}</small></b><span>${t("This week")}</span>${bar}</div>
        ${tile(streak, t("Week streak"), streak ? t("weeks in a row with a workout") : t("train this week to start"))}
        ${tile(m30.workouts, t("Last 30 days"), m30.kg ? t("{kg} {u} lifted", { kg: fmtKg(m30.kg), u: u() }) : "")}
      </div>
      <div class="card pad wk-cal"><div class="row between mb-10"><b>${t("Last 16 weeks")}</b><span class="dim tiny">${nW(S.sessions.filter((s) => s.endedAt > now - 112 * DAY).length)}</span></div>${calendar()}</div></div>
    ${groups.map((g) => { const st = periodStats(g.w, g.w + WEEK); return `<div class="wk-h"><b>${wname(g.w)}</b><span class="dim tiny">${nW(st.workouts)}${st.kg ? ` · ${fmtKg(st.kg)} ${u()}` : ""}</span></div>
      <div class="stack tight">${g.items.map(card).join("")}</div>`; }).join("")}
    ${!showAll && ss.length > list.length ? `<button class="btn block mt-12" data-more>${t("Show all {n} workouts", { n: ss.length })}</button>` : ""}`;
  p.onclick = async (e) => {
    if (e.target.closest("[data-more]")) { showAll = true; return historyPanel(p); }
    const d = e.target.closest("[data-day]");
    if (d) { const el = document.getElementById(`s-${d.dataset.day}`); if (!el) { showAll = true; historyPanel(p); } const sc = document.getElementById(`s-${d.dataset.day}`); if (sc) { sc.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); sc.classList.remove("flash"); void sc.offsetWidth; sc.classList.add("flash"); } return; }
    const b = e.target.closest("[data-del]"); if (!b) return;
    const old = S.sessions;
    if (await ask(t("Delete this workout from your history?"), { ok: t("Delete"), danger: true })) {
      S.sessions = S.sessions.filter((x) => x.id !== b.dataset.del); tomb("sessions", b.dataset.del); save("sessions"); panel();
      toast(t("Workout deleted"), 1900, { label: t("Undo"), fn: () => { S.sessions = old; tomb("sessions", b.dataset.del, true); save("sessions"); panel(); } });
    }
  };
}

/* ================= SETTINGS ================= */
const segH = (id, opts, cur) => `<div class="seg sm" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${t(l)}</button>`).join("")}</div>`;
async function settingsPanel(host) {
  const rerun = () => settingsPanel(host);
  const total = EX.reduce((n, e) => n + (e.video ? 2 : 1), 0);
  const st = S.settings, joints = flaggedJoints();
  const row = (icn, label, ctl, sub = "") => `<div class="setrow-s"><span class="ico">${ic(icn, "sm")}</span><div class="grow"><b>${label}</b>${sub ? `<div class="dim tiny">${sub}</div>` : ""}</div>${ctl}</div>`;
  host.innerHTML = `<div class="cols"><div class="stack">
      <div class="card list-sep">
        <a class="setrow-s" href="#/profile"><span class="ico">${ic("user", "sm")}</span><div class="grow"><b>${t("Profile")}</b><div class="dim tiny">${t("Level, days, body")}</div></div>${ic("chev", "sm")}</a>
        <a class="setrow-s" href="#/guide"><span class="ico">${ic("info", "sm")}</span><div class="grow"><b>${t("Guides")}</b><div class="dim tiny">${t("Plan quiz, strength goals, nutrition")}</div></div>${ic("chev", "sm")}</a>
        <button class="setrow-s" id="pdfG"><span class="ico">${ic("download", "sm")}</span><div class="grow"><b>${t("Printable guide")}</b><div class="dim tiny">${t("PDF to print or share · plan, photos, video QR codes")}</div></div>${ic("chev", "sm")}</button>
        <a class="setrow-s" href="#/start"><span class="ico">${ic("user", "sm")}</span><div class="grow"><b>${t("Set-up questions")}</b><div class="dim tiny">${t("Level, days, equipment, body · picks a plan")}</div></div>${ic("chev", "sm")}</a>
      </div>
      <div class="card list-sep">
        ${READY.length > 1 ? row("info", t("Language"), segH("sLang", READY.map((l) => [l, LANGS[l]]), curLang())) : ""}
        ${row(document.documentElement.dataset.theme === "light" ? "sun" : "moon", t("Theme"), segH("sTheme", [["light", N("Light")], ["dark", N("Dark")], ["system", N("Auto")]], st.theme || "system"))}
        <div class="setrow-s wrap">${`<span class="ico">${ic("dumbbell", "sm")}</span><div class="grow"><b>${t("Equipment")}</b><div class="dim tiny">${t("Library, plans and swaps show only what you have")}</div></div>`}${segH("sEquip", [["gym", N("Full gym")], ["dumbbells", N("Dumbbells")], ["home", N("Home")]], st.equip || "gym").replace('class="seg sm"', 'class="seg sm block"')}</div>
        ${row("scale", t("Units"), segH("sUnit", [["kg", "kg"], ["lb", "lb"]], st.unit))}
        ${row("calc", t("Bar weight"), segH("sBar", [[20, "20"], [15, "15"], [10, "10"]], st.bar))}
      </div>
      <div class="card list-sep">
        ${row("timer", t("Auto rest timer"), `<button class="switch ${st.autoRest ? "on" : ""}" role="switch" aria-checked="${!!(st.autoRest)}" data-k="autoRest" aria-label="${t("Auto rest timer")}"></button>`, t("Starts after every checked set"))}
        ${row("play", t("Lock-screen rest timer"), `<button class="switch ${st.lockTimer !== false ? "on" : ""}" role="switch" aria-checked="${!!(st.lockTimer !== false)}" data-k="lockTimer" aria-label="${t("Lock-screen rest timer")}"></button>`, `${t("Rest time and next set on the lock screen")} · <a href="#" id="lockHelp" style="color:var(--accent-text)">${t("How it works")}</a>`)}
        ${row("sound", t("Sound"), `<button class="switch ${st.sound ? "on" : ""}" role="switch" aria-checked="${!!(st.sound)}" data-k="sound" aria-label="${t("Sound")}"></button>`)}
        ${V.supported ? row("voice", t("Voice"), `<button class="switch ${st.voice ? "on" : ""}" role="switch" aria-checked="${!!st.voice}" data-k="voice" aria-label="${t("Voice")}"></button>`, t("Says the rest time, the last seconds and the next set")) : ""}
        ${row("phone", t("Vibration"), `<button class="switch ${st.haptics ? "on" : ""}" role="switch" aria-checked="${!!(st.haptics)}" data-k="haptics" aria-label="${t("Vibration")}"></button>`)}
      </div>
      ${joints.length ? `<div class="card pad"><div class="row"><span class="ico-t">${ic("bandage", "sm")}</span><div class="grow"><b>${t("Pain flags")}</b><div class="dim small">${joints.map((j) => esc(JOINTS[j]?.name?.en || j)).join(", ")} · ${tn(Object.keys(S.pain).length, "{n} exercise hidden", "{n} exercises hidden")}</div></div><button class="btn sm" id="clrPain">${t("Clear")}</button></div></div>` : ""}
    </div><div class="stack">
      <div class="card pad"><b>${t("Offline videos")}</b><p class="muted small" style="margin:4px 0 10px">${t("Videos save as you watch. Download all once on Wi-Fi (~500 MB) for full offline use.")}</p>
        <div class="progress"><div id="bar"></div></div><div class="dim small" style="margin:8px 0 10px" id="cstat">${t("Checking…")}</div>
        <div class="row"><button class="btn primary sm grow" id="dlAll">${ic("download", "sm")} ${t("All")}</button><button class="btn sm grow" id="dlTop">${t("S + A tier only")}</button></div></div>
      <div class="card pad" id="cloud">${cloudCard()}</div>
      <div class="card pad"><b>${t("Backup file")}</b><p class="muted small" style="margin:4px 0 10px">${t("Your data stays on this phone. Save a backup now and then.")}</p>
        <div class="row"><button class="btn sm grow" id="exp">${ic("share", "sm")} ${t("Export")}</button><label class="btn sm grow">${ic("download", "sm")} ${t("Import")}<input type="file" id="imp" accept=".json,application/json" hidden></label></div>
        <div class="dim small" style="margin:12px 0 6px">${t("Spreadsheet (CSV) — open in Excel, or move from another app")}</div>
        <div class="row"><button class="btn sm grow" id="expCsv">${ic("share", "sm")} ${t("Export CSV")}</button><label class="btn sm grow">${ic("download", "sm")} ${t("From Strong / Hevy")}<input type="file" id="impCsv" accept=".csv,text/csv,text/plain" hidden></label></div>
        <div class="dim tiny mt-8" id="pst"></div>${errLog()}</div>
      ${standalone() ? "" : `<button class="btn block" id="inst">${ic("phone", "sm")} ${t("Install app")}</button>`}
    </div></div>
    <div class="credits card soft pad mt-16">
      <p>${t("Code © Mohamed Attia, MIT license. {n} exercises. Not affiliated with any of the owners below; everything else belongs to them.", { n: EX.length })}</p>
      <p>Demo videos, posters and exercise names © <a href="https://getswole.app" target="_blank" rel="noopener">Get SWOLE</a> and the coaches shown. Tier rankings and training ideas © <a href="https://www.youtube.com/@JeffNippard" target="_blank" rel="noopener">Jeff Nippard</a>. Volume and recovery ideas: <a href="https://www.youtube.com/@RenaissancePeriodization" target="_blank" rel="noopener">Renaissance Periodization</a>. 3D body and motions: <a href="https://github.com/AssiamahS/opengym3d" target="_blank" rel="noopener">OpenGym3D</a> (MIT), rendered with <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> (MIT). Body map: <a href="https://github.com/HichamELBSI/react-native-body-highlighter" target="_blank" rel="noopener">react-native-body-highlighter</a> (MIT). Muscle figures: <a href="https://github.com/AbanoubAmir/open-exercise-figures" target="_blank" rel="noopener">open-exercise-figures</a> (CC0). Font: Inter (<a href="fonts/OFL.txt" target="_blank" rel="noopener">OFL 1.1</a>). 3D model compression: meshoptimizer (MIT). Voice: recorded with a Microsoft Edge neural voice (Ava).</p>
      <p>${t("Coach videos play from YouTube (privacy-enhanced mode) only when you tap them.")}</p>
      <p>${t("Own something here and want it changed or removed? {link} and it will be done right away.", { link: `<a href="https://github.com/Mohamedattiadev/gym/issues" target="_blank" rel="noopener">${t("Open an issue")}</a>` })}</p></div>`;
  const urls = (onlyTop) => EX.filter((e) => !onlyTop || ["S", "A"].includes(e.tier)).flatMap((e) => [e.poster, e.video].filter(Boolean));
  const stat = async () => { let n = 0; try { const m = await caches.open(MEDIA_CACHE), r = await caches.open(RECENT_CACHE); const k = new Set((await m.keys()).concat(await r.keys()).map((x) => x.url).filter((u) => !u.includes("/voice/"))); n = k.size; } catch {} const c = $("#cstat"); if (c) { c.textContent = t("{n} / {total} files on this device", { n, total }); $("#bar").style.width = `${Math.min(100, (n / total) * 100)}%`; } };
  stat(); wireCloud();
  (async () => { const pe = await (navigator.storage?.persisted?.() ?? false); const est = await (navigator.storage?.estimate?.() ?? {}); const el = $("#pst"); if (el) el.innerHTML = `${pe ? t("Storage protected") : `${t("Storage")} <a href="#" id="persist" style="color:var(--accent-text)">${t("not protected — tap to protect")}</a>`}${est.usage ? ` · ${t("{n} MB used", { n: (est.usage / 1e6).toFixed(0) })}` : ""}`;
    const pp = $("#persist"); if (pp) pp.onclick = async (e) => { e.preventDefault(); toast((await persist()) ? t("Storage protected") : t("Install the app first, then try again")); }; })();
  const set = (k, v) => { st[k] = v; save("settings"); haptic(); };
  const seg = (id, fn) => ($(`#${id}`).onclick = (e) => { const b = e.target.closest("button"); if (!b || b.classList.contains("on")) return; selectIn(b); fn(b.dataset.v); });
  $("#pdfG").onclick = () => {
    let lv = GUIDE_LEVELS.includes(S.profile?.level) ? S.profile.level : "beginner";
    const body = () => `<h3 style="margin:0 0 4px">${t("Printable guide")}</h3><p class="muted small" style="margin:0 0 12px">${t("Your plan with photos, sets and a QR code to each exercise video. Print the wall poster for the gym, share the guide with friends.")}</p>
      ${segH("gLv", GUIDE_LEVELS.map((l) => [l, l[0].toUpperCase() + l.slice(1)]), lv).replace('class="seg sm"', 'class="seg sm block"')}<div class="mt-16" id="gBtns">${guideBtns(lv, "btn grow")}</div>`;
    openSheet(body(), (d) => { requestAnimationFrame(() => indicate(d)); d.querySelector("#gLv").onclick = (e) => { const b = e.target.closest("button"); if (!b || b.classList.contains("on")) return; selectIn(b); lv = b.dataset.v; d.querySelector("#gBtns").innerHTML = guideBtns(lv, "btn grow"); }; }, { half: true });
  };
  seg("sTheme", (v) => { set("theme", v); applyTheme(); });
  if ($("#sLang")) seg("sLang", async (v) => { set("lang", v); await flush().catch(() => {}); location.reload(); }); // exercise texts load per language at boot
  seg("sEquip", (v) => { set("equip", v); lib.mine = true; toast(t("Showing exercises for: {x}", { x: t(EQUIP_PROFILES[v].name) })); });
  seg("sUnit", (v) => set("unit", v)); seg("sBar", (v) => set("bar", +v));
  $$(".switch[data-k]").forEach((s) => (s.onclick = () => { s.classList.toggle("on"); s.setAttribute("aria-checked", s.classList.contains("on")); set(s.dataset.k, s.classList.contains("on")); if (s.dataset.k === "voice" && st.voice) V.say(V.P.voiceOn()); }));
  $("#lockHelp").onclick = (e) => { e.preventDefault(); openSheet(`<h3 style="margin:0 0 8px">${t("Lock-screen rest timer")}</h3>
    <p class="muted small" style="margin:0 0 8px">${t("During a workout the rest timer shows on the lock screen and in the notification player: time left, the next set and weight. Pause = pause rest, Next = skip rest, the seek buttons = +30 s / −15 s. When rest ends you hear a beep, the phone vibrates (Android) and a notification appears.")}</p>
    <p class="muted small" style="margin:0 0 8px"><b>Android:</b> ${t("works in Chrome and the installed app. It uses a silent audio track, so on some phones it pauses music from other apps — turn it off here if it does.")}</p>
    <p class="muted small" style="margin:0 0 8px"><b>iPhone:</b> ${t("the lock-screen player works in Safari; notifications only in the app added to the Home Screen (iOS 16.4+). iOS stops web apps soon after locking, so the beep at rest end may not play while locked. No vibration on iPhone.")}</p>
    <p class="muted small" style="margin-bottom:0"><b>${t("Later:")}</b> ${t("a real Live Activity / Dynamic Island needs a native app wrapper (Capacitor). Not built yet.")}</p>`, null, { half: true }); };
  const cp = $("#clrPain"); if (cp) cp.onclick = async () => { if (await ask(t("Clear all pain flags?"), { ok: t("Clear") })) { S.pain = {}; save("pain"); rerun(); } };
  $("#dlAll").onclick = () => downloadMedia(urls(false), stat);
  $("#dlTop").onclick = () => downloadMedia(urls(true), stat);
  const ins = $("#inst"); if (ins) ins.onclick = installNow;
  $("#exp").onclick = async () => {
    await flush();
    const file = new File([exportData()], `gym-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: t("Gym backup") }); } catch {} }
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); }
    S.settings.lastBackup = Date.now(); save("settings");
  };
  const cl = $("#copyLog"); if (cl) cl.onclick = async (ev) => { ev.preventDefault();
    const txt = readLog().map((x) => `${new Date(x.t).toISOString()} ${x.hash} ${x.msg}\n${x.stack}`).join("\n\n");
    try { await navigator.clipboard.writeText(txt); toast(t("Debug log copied")); } catch { toast(t("Couldn't copy")); }
  };
  const xl = $("#clearLog"); if (xl) xl.onclick = (ev) => { ev.preventDefault(); clearLog(); xl.closest(".errlog")?.remove(); };
  $("#expCsv").onclick = async () => {
    await flush(); if (!S.sessions.length) return toast(t("No workouts to export yet"));
    const C = await import("./csv.js");
    shareFile(new File(["\uFEFF" + C.exportCSV()], `gym-workouts-${new Date().toISOString().slice(0, 10)}.csv`, { type: "text/csv" }), t("Gym workouts"));
  };
  $("#impCsv").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    const C = await import("./csv.js"); let R;
    try { R = C.readImport(await f.text()); } catch { return toast(t("Can't read this file. Export a CSV from Strong or Hevy and try again.")); }
    csvPreview(C, R);
  };
  $("#imp").onchange = async (e) => {
    try { const txt = await e.target.files[0].text(); if (!(await ask(t("Replace your workouts and history with this backup?"), { ok: t("Replace"), danger: true }))) return; await importData(txt); rerun(); toast(t("Backup restored"), 8000, { label: t("Undo"), fn: async () => { if (await undoImport()) { toast(t("Your earlier data is back")); rerun(); } } }); }
    catch { toast(t("Not a valid Gym backup")); }
  };
}

async function shareFile(file, title) {
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title }); return; } catch (err) { if (err?.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/* ---- CSV import preview: check / fix exercise matches, then add the workouts ---- */
function csvPreview(C, R) {
  const sets = R.workouts.reduce((a, w) => a + w.ex.reduce((b, x) => b + x.sets.length, 0), 0);
  const md = { month: "short", year: "numeric" };
  const row = (x, i) => `<div class="imp-r" data-i="${i}"><div class="grow"><div class="t">${esc(x.name)}</div>
      <div class="small ${x.slug ? "muted" : "warn"}">${x.slug ? `${ic("check", "xs")} ${esc(BY[x.slug].name)}` : t("Not matched — will be skipped")}</div></div>
      <button class="btn sm" data-c="${i}">${x.slug ? t("Change") : t("Pick")}</button></div>`;
  const draw = (el) => {
    const n = R.names.filter((x) => x.slug).length;
    $("#impList", el).innerHTML = R.names.map(row).join("");
    $("#impSum", el).textContent = t("{n} of {m} exercises matched", { n, m: R.names.length });
  };
  openSheet(`<h3>${esc(t("Import from {f}", { f: R.format }))}</h3>
    <div class="muted small" style="margin:-2px 0 12px">${nW(R.workouts.length)} · ${tn(sets, "{n} set", "{n} sets")} · ${fmtDate(R.workouts[0].start, md)} – ${fmtDate(R.workouts.at(-1).start, md)}</div>
    ${R.unitUnknown ? `<div class="row mb-12"><span class="grow small">${t("Weights in this file are in")}</span><div class="seg sm" id="impU">${["kg", "lb"].map((u) => `<button data-u="${u}" class="${R.fileUnit === u ? "on" : ""}">${u}</button>`).join("")}</div></div>` : ""}
    ${R.dropped ? `<div class="muted small" style="margin:-6px 0 12px">${tn(R.dropped, "{n} timed or distance set (planks, cardio) won't be imported.", "{n} timed or distance sets (planks, cardio) won't be imported.")}</div>` : ""}
    <div class="row" style="margin-bottom:6px"><b class="grow" id="impSum"></b></div>
    <div id="impList" class="imp-list"></div>
    <p class="dim small" style="margin:10px 0 12px">${t("Workouts are added to your history; nothing is replaced. Already imported workouts are skipped.")}</p>
    <button class="btn primary block" id="impGo">${t("Import workouts")}</button>`, (el) => {
    draw(el);
    const iu = $("#impU", el); if (iu) iu.onclick = (ev) => { const b = ev.target.closest("[data-u]"); if (!b) return; haptic(); R.fileUnit = b.dataset.u; selectIn(b); };
    $("#impList", el).onclick = (ev) => { const b = ev.target.closest("[data-c]"); if (!b) return; const i = +b.dataset.c, x = R.names[i];
      const box = b.closest(".imp-r"); if (box.nextElementSibling?.classList.contains("imp-pick")) return box.nextElementSibling.remove();
      el.querySelectorAll(".imp-pick").forEach((p) => p.remove());
      box.insertAdjacentHTML("afterend", `<div class="imp-pick"><div class="search">${ic("search", "sm")}<input type="search" value="${esc(x.name.replace(/\([^)]*\)/g, "").trim())}" aria-label="${t("Search exercises")}"></div><div class="menu"></div></div>`);
      const pk = box.nextElementSibling, inp = pk.querySelector("input"), list = pk.querySelector(".menu");
      const fill = () => { const r = C.rank(inp.value || x.name, 6);
        list.innerHTML = r.map(({ e }) => `<button data-s="${e.slug}">${esc(e.name)}<span class="dim small" style="margin-inline-start:auto">${esc(e.equipment[0] || "")}</span></button>`).join("") + `<button data-s="">${ic("close", "sm")}${t("Skip this exercise")}</button>`; };
      inp.oninput = fill; fill(); inp.focus(); inp.select();
      list.onclick = (e2) => { const s = e2.target.closest("[data-s]"); if (!s) return; x.slug = s.dataset.s || null; haptic(); draw(el); };
    };
    $("#impGo", el).onclick = () => { const r = C.applyImport(R); closeSheet();
      toast(r.added ? `${t("Imported {w} ({s})", { w: nW(r.added), s: tn(r.sets, "{n} set", "{n} sets") })}${r.skipped ? ` · ${t("{n} skipped", { n: r.skipped })}` : ""}` : t("Nothing new to import")); settingsView(); };
  });
}

/* ---- cloud backup to the owner's private GitHub repo (see docs/SYNC.md) ---- */
// SEC-5: GitHub tokens expire; after ~80 days remind the owner where a stopped backup comes from
function tokenAge(at) {
  if (!at) return "";
  const d = Math.floor((Date.now() - at) / DAY);
  return d < 80 ? "" : `<br>${t("Token added {n} days ago. If backup stops, make a new token and connect again.", { n: d })}`;
}
function cloudCard() {
  const st = Sync.status();
  if (!st.connected) return `<b>${t("Cloud backup (GitHub)")}</b><p class="muted small" style="margin:4px 0 10px">${t("Back up to your own private GitHub repository. Your token stays on this device.")}</p>
    <div class="field"><label for="cRepo">${t("Repository")}</label><input id="cRepo" placeholder="yourname/gym-data" autocomplete="off" autocapitalize="off"></div>
    <div class="field"><label for="cTok">${t("Token")}</label><input id="cTok" type="password" placeholder="github_pat_…" autocomplete="off"></div>
    <button class="btn primary sm block" id="cCon">${t("Connect")}</button>`;
  return `<b>${t("Cloud backup (GitHub)")}</b><p class="muted small" style="margin:4px 0 10px">${t("Connected to {r} · last backup {d}", { r: `<b>${esc(st.owner)}/${esc(st.repo)}</b>`, d: st.lastPush ? fmtDate(st.lastPush, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : t("never") })}${st.pending ? ` · ${t("pending")}` : ""}${tokenAge(st.connectedAt)}</p>
    ${st.error ? `<p class="small" style="color:var(--danger);margin:0 0 10px">${esc(st.error)}</p>` : ""}
    <div class="row mb-10"><span class="grow small b">${t("Auto backup after changes")}</span><button class="switch ${st.auto ? "on" : ""}" role="switch" aria-checked="${!!(st.auto)}" id="cAuto" aria-label="${t("Auto backup")}"></button></div>
    <div class="row wrap"><button class="btn sm primary" id="cPush">${t("Back up now")}</button><button class="btn sm" id="cRest">${t("Restore")}</button><button class="btn sm ghost danger" id="cDis">${t("Disconnect")}</button></div>`;
}
function wireCloud() {
  const re = () => { const c = $("#cloud"); if (c) { c.innerHTML = cloudCard(); wireCloud(); } };
  const con = $("#cCon");
  if (con) con.onclick = async () => {
    con.disabled = true; con.textContent = t("Connecting…");
    const r = await Sync.connect({ repo: $("#cRepo").value.trim(), token: $("#cTok").value.trim() });
    if (!r.ok) { toast(r.error || t("Could not connect"), 4000); re(); return; }
    if (r.remoteExists && await ask(r.remoteUpdatedAt ? t("A backup from {d} was found. Restore it now?", { d: fmtDate(r.remoteUpdatedAt) }) : t("A backup was found. Restore it now?"), { ok: t("Restore") })) {
      const x = await Sync.restore(); toast(t("Restored {n} workouts", { n: x.sessions ?? 0 }));
    } else toast(t("Connected"));
    re();
  };
  const p = $("#cPush"); if (p) p.onclick = async () => { try { await Sync.push(); toast(t("Backed up")); } catch (e) { toast(e.message, 4000); } re(); };
  const r = $("#cRest"); if (r) r.onclick = async () => { if (!(await ask(t("Merge the cloud backup into this phone? Nothing will be deleted."), { ok: t("Restore") }))) return; try { const x = await Sync.restore(); toast(t("Restored {n} workouts", { n: x.sessions ?? 0 })); } catch (e) { toast(e.message, 4000); } re(); };
  const a = $("#cAuto"); if (a) a.onclick = () => { Sync.setAuto(!Sync.status().auto); re(); };
  const d = $("#cDis"); if (d) d.onclick = async () => { if (await ask(t("Remove the token from this phone? Your cloud backup stays on GitHub."), { ok: t("Disconnect"), danger: true })) { await Sync.disconnect(); re(); } };
}

let downloading = false;
async function downloadMedia(list, onProgress) {
  if (downloading) return; downloading = true; persist();
  const btns = $$("#dlAll,#dlTop"); btns.forEach((b) => (b.disabled = true));
  const cache = await caches.open(MEDIA_CACHE);
  const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  const todo = list.map((x) => new URL(x, location.href)).filter((x) => !have.has(x.pathname));
  let i = 0, fail = 0, last = 0;
  const recent = await caches.open(RECENT_CACHE); // PERF-6: a video already watched moves into the kept cache (no second download)
  const worker = async () => { while (i < todo.length) { const x = todo[i++], k = x.origin + x.pathname; try { const old = await recent.match(k); const r = old || await fetch(x.href); if (r.ok) { await cache.put(k, r); if (old) await recent.delete(k); } else fail++; } catch { fail++; } if (Date.now() - last > 500) { last = Date.now(); onProgress(); } } };
  await Promise.all(Array.from({ length: 4 }, worker));
  downloading = false; await onProgress(); btns.forEach((b) => (b.disabled = false));
  toast(fail ? t("{n} files failed — try again", { n: fail }) : t("Saved for offline"));
}
