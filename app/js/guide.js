// Guides: onboarding (-> plan) + profile, strength standards, nutrition calculator + guide, plans explained.
// Content lives in data/guide/*.json (en/tr/ar); this module is lazy-loaded by the router.
import { S, save } from "./store.js";
import { $, esc, ic, haptic, toast, selectIn, indicate, L } from "./ui.js";
import { EX, bestOf, EQUIP_PROFILES } from "./data.js";
import { setTop, go, redirect, routeId, live } from "./nav.js";
import * as T from "./train.js";
import * as P from "./plans.js";
import { guideBtns } from "./components.js";
import { t, tn, N } from "./i18n.js";

const view = () => $("#view");
const G = {};
const load = (n) => G[n] || (G[n] = fetch(`data/guide/${n}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
const prof = () => (S.profile = S.profile || {});
const setProf = (o) => { Object.assign(prof(), o); save("profile"); };
const lastBW = () => { const l = (S.bodyweight || []).filter((x) => +x.w).sort((a, b) => String(a.d).localeCompare(String(b.d))); return l.length ? +l[l.length - 1].w : 0; };
const saveBW = (w) => { const d = new Date().toISOString().slice(0, 10); S.bodyweight = [...(S.bodyweight || []).filter((x) => x.d !== d), { d, w, updatedAt: Date.now() }]; save("bodyweight"); };
const seg = (id, opts, cur, cls = "") => `<div class="seg sm ${cls}" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${esc(l)}</button>`).join("")}</div>`;
const segVal = (el, fn) => (el.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; haptic(); selectIn(b); fn(b.dataset.v); });
const loading = () => (view().innerHTML = `<div class="empty">${t("Loading…")}</div>`);

/* ---------------- hub ---------------- */
export function guideView() {
  setTop({ title: t("Guides"), back: true });
  const tile = (href, icn, c, b, s) => `<a class="itile" href="${href}" style="--c:${c}"><span class="ico">${ic(icn)}</span><div><b>${b}</b><span>${s}</span></div></a>`;
  view().innerHTML = `<div class="itiles">${tile("#/start", "user", "var(--accent)", t("Find my plan"), t("Level, days, equipment"))}
    ${tile("#/plans", "layers", "var(--tier-A)", t("Plans explained"), t("What, who, why"))}
    ${tile("#/standards", "trophy", "var(--tier-S)", t("Strength goals"), t("Aim for at least…"))}
    ${tile("#/nutrition", "fire", "var(--info)", t("Nutrition"), t("Calories & protein"))}</div>`;
}

/* ---------------- onboarding (block 26b): level -> days + equipment -> body -> recommended plan ---------------- */
// Shown once on the first open (main.js boot), re-run from Settings / Guides, edited in Me > Profile (#/profile).
const LEVELS = [["beginner", N("Beginner"), N("Training less than 1 year, or not consistent yet.")], ["intermediate", N("Intermediate"), N("1–3 years, you know the main lifts.")], ["advanced", N("Advanced"), N("3+ years, progress has slowed down.")]];
const LV = { beginner: N("beginner"), intermediate: N("intermediate"), advanced: N("advanced") }; // lower-case level words in running text
const lvName = (l) => (LV[l] ? t(LV[l]) : l);
const NOT_SURE = [
  [N("How long have you trained without long breaks?"), [N("Less than 1 year"), N("1 to 3 years"), N("More than 3 years")]],
  [N("Do you know the main lifts (squat, bench press, row, deadlift)?"), [N("Not really"), N("Most of them"), N("Yes, with good form")]],
  [N("How often does the weight on your main lifts go up?"), [N("Most weeks"), N("Every month or so"), N("Only over many months")]],
];
const DAYS = [2, 3, 4, 5, 6];
const LB = 2.2046, IN = 2.54;
const ob = { i: 0, a: {}, ns: null, picked: false };
const firstRun = () => !S.profile?.onboarded;
const markOnboarded = () => { setProf({ onboarded: true }); if (!S.settings.onboarded) { S.settings.onboarded = true; save("settings"); } };
export async function startView() {
  setTop({ title: firstRun() ? t("Welcome") : t("Find my plan"), back: !firstRun() }); loading(); view().classList.add("obview");
  const rid = routeId(); const od = await load("onboarding"); if (!live(rid)) return;
  if (!ob.started) {
    const p = prof(), n = p.nutri || {};
    ob.a = { level: p.level, days: p.days || 3, equip: S.settings.equip || "gym" };
    ob.b = { unit: S.settings.unit || "kg", hu: p.hu || "cm", w: lastBW() || "", h: n.h || "", age: n.age || "", sex: p.sex || n.sex || "" };
    ob.i = 0; ob.ns = null; ob.picked = false; ob.started = true;
  }
  const equipQ = (od.questions || []).find((q) => q.id === "equip");
  const dots = () => `<div class="obtop"><div class="obdots" role="img" aria-label="${t("Step {n} of 4", { n: ob.i + 1 })}">${[0, 1, 2, 3].map((k) => `<i class="${k < ob.i ? "done" : k === ob.i ? "on" : ""}"></i>`).join("")}</div>${ob.i === 1 || ob.i === 2 ? `<button class="btn ghost sm" id="obSkip">${t("Skip")}</button>` : ""}</div>`;
  const nav = (ok = true, label = t("Next")) => `<div class="row obnav">${ob.i ? `<button class="btn grow" id="obBack">${ic("back", "sm")} ${t("Back", null, "nav")}</button>` : ""}<button class="btn primary grow" id="obNext" ${ok ? "" : "disabled"}>${label}</button></div>`;
  const step = (k) => { ob.i = k; draw(); window.scrollTo(0, 0); };
  const draw = () => {
    if (ob.i >= 3) return result(od);
    if (ob.ns) return notSure();
    if (ob.i === 0) {
      view().innerHTML = `${dots()}<h2 class="qt">${t("What is your level?")}</h2><div class="muted small">${t("Picks the right plan. You can change it any time.")}</div>
        <div class="stack tight mt-14" id="obOpts">${LEVELS.map(([v, nm, d]) => `<button class="qopt ${ob.a.level === v ? "on" : ""}" data-v="${v}"><b>${t(nm)}</b><span>${t(d)}</span></button>`).join("")}</div>
        ${ob.picked ? `<div class="small obnote">${ic("check", "sm")} ${t("Picked from your answers. Change it if it feels wrong.")}</div>` : ""}
        <button class="btn ghost block mt-8" id="obNs">${t("Not sure? Answer 3 quick questions")}</button>${nav(!!ob.a.level)}`;
      $("#obOpts").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; haptic(); ob.a.level = b.dataset.v; ob.picked = false; setProf({ level: ob.a.level }); markOnboarded(); step(1); };
      $("#obNs").onclick = () => { ob.ns = { i: 0, s: [] }; draw(); };
    } else if (ob.i === 1) {
      view().innerHTML = `${dots()}<h2 class="qt">${t("How many days a week can you train?")}</h2>
        <div class="obdays" id="obDays" role="group" aria-label="${t("Days a week")}">${DAYS.map((d) => `<button class="${ob.a.days === d ? "on" : ""}" data-v="${d}"><b class="num">${d}</b><span>${tn(d, "day", "days")}</span></button>`).join("")}</div>
        <h3 class="qt sm">${t("Where do you train?")}</h3>
        <div class="stack tight" id="obEq">${(equipQ?.options || []).map((o) => `<button class="qopt ${ob.a.equip === o.v ? "on" : ""}" data-v="${o.v}"><b>${esc(L(o.label))}</b>${o.desc ? `<span>${esc(L(o.desc))}</span>` : ""}</button>`).join("")}</div>${nav()}`;
      $("#obDays").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; haptic(); ob.a.days = +b.dataset.v; selectIn(b); };
      $("#obEq").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; haptic(); ob.a.equip = b.dataset.v; selectIn(b); };
    } else {
      view().innerHTML = `${dots()}<h2 class="qt">${t("About you")}</h2><div class="muted small">${t("For strength goals and calories. You can add this later in Me.")}</div>
        <div class="card pad mt-14" id="obBody">${bodyFields(ob.b)}</div>${nav()}`;
      wireBody($("#obBody"), ob.b);
    }
    const bk = $("#obBack"); if (bk) bk.onclick = () => step(ob.i - 1);
    const sk = $("#obSkip"); if (sk) sk.onclick = () => { if (ob.i === 1) saveDays({ days: prof().days || 3, equip: S.settings.equip || "gym" }); step(ob.i + 1); };
    $("#obNext").onclick = () => {
      if (ob.i === 0) { setProf({ level: ob.a.level }); markOnboarded(); return step(1); }
      if (ob.i === 1) { saveDays(ob.a); return step(2); }
      const b = readBody($("#obBody"), ob.b); if (!b) return; saveBody(b); step(3);
    };
  };
  const notSure = () => {
    const k = ob.ns.i, [q, opts] = NOT_SURE[k];
    view().innerHTML = `${dots()}<div class="dim tiny" style="margin:2px 0 4px">${t("Question {n} of 3", { n: k + 1 })}</div><h2 class="qt">${t(q)}</h2>
      <div class="stack tight mt-14" id="obOpts">${opts.map((o, v) => `<button class="qopt" data-v="${v}"><b>${t(o)}</b></button>`).join("")}</div>
      <div class="row obnav"><button class="btn grow" id="obBack">${ic("back", "sm")} ${t("Back", null, "nav")}</button></div>`;
    $("#obOpts").onclick = (e) => {
      const b = e.target.closest("[data-v]"); if (!b) return; haptic(); ob.ns.s[k] = +b.dataset.v;
      if (k < 2) { ob.ns.i++; return draw(); }
      const sum = ob.ns.s.reduce((x, y) => x + y, 0); // 0–6: <= 2 beginner, 3–4 intermediate, 5+ advanced
      ob.a.level = sum <= 2 ? "beginner" : sum <= 4 ? "intermediate" : "advanced"; ob.picked = true; ob.ns = null; draw();
    };
    $("#obBack").onclick = () => { if (ob.ns.i) ob.ns.i--; else ob.ns = null; draw(); };
  };
  draw();
}
const saveDays = ({ days, equip }) => { setProf({ days }); if (S.settings.equip !== equip) { S.settings.equip = equip; save("settings"); } };

/* body fields (onboarding step 3 + Me > Profile). b = { unit kg|lb, hu cm|ft, w (in unit), h (cm), age, sex } */
function bodyFields(b) {
  const ft = b.h ? Math.floor(b.h / IN / 12) : "", inch = b.h ? Math.round(b.h / IN - ft * 12) : "";
  return `<div class="obgrid">
    <div class="field"><label for="bW">${t("Weight")}</label><div class="row" style="gap:8px"><input id="bW" type="number" inputmode="decimal" step="0.1" value="${b.w || ""}" placeholder="${t("e.g. {n}", { n: b.unit === "lb" ? 165 : 75 })}">${seg("bWu", [["kg", "kg"], ["lb", "lb"]], b.unit)}</div></div>
    <div class="field"><label for="${b.hu === "ft" ? "bFt" : "bH"}">${t("Height")}</label><div class="row" style="gap:8px">${b.hu === "ft"
      ? `<input id="bFt" type="number" inputmode="numeric" value="${ft}" placeholder="ft" aria-label="${t("Feet")}"><input id="bIn" type="number" inputmode="numeric" value="${inch}" placeholder="in" aria-label="${t("Inches")}">`
      : `<input id="bH" type="number" inputmode="numeric" value="${b.h || ""}" placeholder="${t("e.g. {n}", { n: 175 })}">`}${seg("bHu", [["cm", "cm"], ["ft", "ft"]], b.hu)}</div></div>
    <div class="field"><label for="bAge">${t("Age")}</label><input id="bAge" type="number" inputmode="numeric" value="${b.age || ""}" placeholder="${t("e.g. {n}", { n: 30 })}"></div>
    <div class="field"><label>${t("Sex")}</label>${seg("bSex", [["male", t("Male")], ["female", t("Female")]], b.sex, "block")}</div></div>`;
}
/* reads the inputs into b (keeps the draft when a unit toggle re-renders); returns null + toast when a value is out of range */
function readBody(host, b) {
  const v = (id) => { const x = host.querySelector("#" + id); return x && x.value !== "" ? +x.value : ""; };
  const w = v("bW"), h = b.hu === "ft" ? (v("bFt") !== "" || v("bIn") !== "" ? Math.round(((+v("bFt") || 0) * 12 + (+v("bIn") || 0)) * IN) : "") : v("bH"), age = v("bAge");
  Object.assign(b, { w, h, age });
  const [lo, hi] = b.unit === "lb" ? [55, 660] : [25, 300];
  if (w !== "" && (w < lo || w > hi)) return toast(t("Enter a weight between {lo} and {hi} {unit}", { lo, hi, unit: b.unit })), null;
  if (h !== "" && (h < 120 || h > 230)) return toast(b.hu === "ft" ? t("Enter a height between 4 ft 0 in and 7 ft 6 in") : t("Enter a height between 120 and 230 cm")), null;
  if (age !== "" && (age < 14 || age > 90)) return toast(t("Enter an age between 14 and 90")), null;
  return b;
}
function wireBody(host, b, onChange) {
  const redraw = () => { host.innerHTML = bodyFields(b); wireBody(host, b, onChange); };
  segVal(host.querySelector("#bWu"), (u) => { readBody(host, b); if (u !== b.unit && b.w) b.w = Math.round((u === "lb" ? b.w * LB : b.w / LB) * 10) / 10; b.unit = u; redraw(); onChange?.(); });
  segVal(host.querySelector("#bHu"), (u) => { readBody(host, b); b.hu = u; redraw(); onChange?.(); });
  segVal(host.querySelector("#bSex"), (s) => { b.sex = s; onChange?.(); });
  if (onChange) host.onchange = (e) => { if (e.target.matches("input")) onChange(); };
}
function saveBody(b) {
  const p = prof(), n = (p.nutri = p.nutri || {});
  if (S.settings.unit !== b.unit) { // unit change: convert the logged bodyweights too
    const f = b.unit === "lb" ? LB : 1 / LB;
    S.bodyweight = (S.bodyweight || []).map((x) => ({ ...x, w: Math.round(x.w * f * 10) / 10, updatedAt: Date.now() })); save("bodyweight");
    S.settings.unit = b.unit; save("settings");
  }
  if (b.w && +b.w !== lastBW()) saveBW(+b.w);
  if (b.h) n.h = b.h; if (b.age) n.age = b.age; if (b.sex) { p.sex = b.sex; n.sex = b.sex; }
  delete n.w; p.hu = b.hu; save("profile");
}

/* nutrition numbers (shared by the Nutrition page and the onboarding result); w in kg */
function nutriCalc(nu, n, w) {
  const bmr = 10 * w + 6.25 * n.h - 5 * n.age + (n.sex === "female" ? -161 : 5);
  const a = (nu.activity || []).find((x) => x.id === n.act) || { f: 1.55 }, g = (nu.goals || []).find((x) => x.id === n.goal) || { kcalPct: 0 };
  const tdee = bmr * a.f, kcal = Math.round((tdee * (1 + g.kcalPct)) / 10) * 10;
  const [p1, p2] = nu.protein?.gPerKg || [1.6, 2.2], prot = [Math.round(w * p1), Math.round(w * p2)];
  const fat = Math.round((kcal * (nu.fat?.pctKcal?.[0] || 0.25)) / 9), carb = Math.max(0, Math.round((kcal - prot[1] * 4 - fat * 9) / 4));
  return { tdee, kcal, prot, fat, carb, g };
}
const kgBW = () => (S.settings.unit === "lb" ? lastBW() / LB : lastBW());

export const pickPlan = (a) => P.pickPlans(a)[0]?.p.id || "beg-fb";
async function result() {
  const a = ob.a, first = firstRun() || !S.workouts.length;
  ob.started = false; markOnboarded();
  const rid = routeId(), [tx, st, nu] = await Promise.all([P.loadPlanText(), load("standards"), load("nutrition")]); if (!live(rid)) return;
  const picks = P.pickPlans(a), best = picks[0].p, eq = EQUIP_PROFILES[S.settings.equip]?.name;
  const why = (w) => L(tx.why?.[w])?.replace("{n}", a.days) || "";
  const p = prof(), n = p.nutri || {}, bw = lastBW(), unit = S.settings.unit;
  let targets = "";
  if (bw) {
    const li = { beginner: 0, intermediate: 1, advanced: 2 }[p.level] ?? 0, sex = p.sex || "male", r = 2.5;
    const goals = (st.lifts || []).filter((l) => ["squat", "bench", "deadlift"].includes(l.id))
      .map((l) => `${esc(L(l.name))} <b class="num">${Math.round(((l.ratios?.[sex] || [])[li] * bw) / r) * r} ${unit}</b>`).join(" · ");
    const nn = n.h && n.age && (p.sex || n.sex) ? nutriCalc(nu, { sex: p.sex || n.sex, age: n.age, h: n.h, act: n.act || nu.activity?.[2]?.id, goal: n.goal || "maintain" }, kgBW()) : null;
    targets = `<div class="card pad obtarget"><b>${t("Your targets")}</b>
      ${goals ? `<div class="small mt-6">${t("Strength goals: {list}", { list: goals })}</div>` : ""}
      ${nn ? `<div class="small mt-4">${t("About {kcal} a day to keep your weight · protein {p}", { kcal: `<b class="num">${nn.kcal} kcal</b>`, p: `<b class="num">${nn.prot[0]}–${nn.prot[1]} g</b>` })}</div>` : `<div class="dim tiny mt-4">${t("Add height and age in Me > Profile for calories.")}</div>`}
      <div class="row small" style="margin-top:8px;gap:14px"><a href="#/standards" class="lnk">${t("Strength goals")}</a><a href="#/nutrition" class="lnk">${t("Nutrition")}</a></div></div>`;
  }
  view().innerHTML = `<div class="obtop"><div class="obdots" role="img" aria-label="${t("Step {n} of 4", { n: 4 })}"><i class="done"></i><i class="done"></i><i class="done"></i><i class="on"></i></div></div>
    <div class="eyebrow mt-6">${best.id === P.recommendedId(a.level, a.days) ? t("Recommended for you") : t("Your best fit")}</div>
    <h2 class="qt">${esc(L(tx.plans?.[best.id]?.name) || best.name)}</h2><div class="muted small">${tn(best.days, "{n} day a week", "{n} days a week")}${eq ? ` · ${esc(eq)}` : ""} · ${esc(lvName(p.level || best.level))}</div>
    <div class="card pad mt-12"><div class="small">${esc(L(tx.plans?.[best.id]?.best) || L(tx.plans?.[best.id]?.line) || why(picks[0].why))}</div>
      <a class="small lnk" href="#/plan/${best.id}" style="display:inline-block;margin-top:8px">${t("How a week works")}</a></div>
    <div class="row obnav"><a class="btn grow" href="#/plans">${t("See other plans")}</a><button class="btn primary grow" id="qUse">${ic("plus", "sm")} ${t("Use this plan")}</button></div>
    ${targets}
    ${picks.length > 1 ? `<div class="h4">${t("Also good for you")}</div><div class="stack tight" id="qAlt">${picks.slice(1).map(({ p: q, why: w }) => T.planCard(q, { why: why(w) })).join("")}</div>` : ""}
    <button class="btn ghost block mt-10" id="qAgain">${t("Start over")}</button>`;
  const done = (ok) => ok && go(first ? "#/" : "#/train");
  $("#qUse").onclick = async () => done(await T.usePlan(best, false));
  const alt = $("#qAlt"); if (alt) alt.onclick = (e) => { const u = e.target.closest("[data-use]"); if (u) { e.preventDefault(); T.usePlan(P.planById(u.dataset.use), false).then(done); } else T.planClicks(e); };
  $("#qAgain").onclick = () => { ob.started = false; startView(); };
  T.fillPlanLines?.(view());
  haptic("success");
}

/* ---------------- Me > Profile ---------------- */
export async function profileView() {
  setTop({ title: t("Profile"), back: true });
  const p = prof(), n = p.nutri || {};
  const b = { unit: S.settings.unit || "kg", hu: p.hu || "cm", w: lastBW() || "", h: n.h || "", age: n.age || "", sex: p.sex || n.sex || "" };
  view().innerHTML = `<div class="cols"><div class="stack">
      <div class="card pad"><div class="field"><label>${t("Level")}</label>${seg("prLv", LEVELS.map(([v, nm]) => [v, t(nm)]), p.level || "", "block")}</div>
        <div class="field"><label>${t("Days a week")}</label>${seg("prDays", DAYS.map((d) => [d, String(d)]), p.days || 3, "block")}</div>
        <div class="field" style="margin-bottom:0"><label>${t("Equipment")}</label>${seg("prEq", [["gym", t("Full gym")], ["dumbbells", t("Dumbbells")], ["home", t("Home", null, "equip")]], S.settings.equip || "gym", "block")}</div></div>
      ${(() => { const cp = T.currentPlan(); return `<a class="card pad row" href="#/plans" style="gap:12px"><span class="grow"><span class="dim small">${t("Your plan")}</span><b style="display:block">${cp ? `${esc(cp.name)} · ${tn(cp.days, "{n} day", "{n} days")}` : t("No plan yet")}</b></span><span class="btn sm">${cp ? t("Change") : t("Pick a plan")}</span></a>`; })()}
      <a class="btn block ghost" href="#/start">${ic("user", "sm")} ${t("Find my plan again")}</a></div>
    <div class="stack"><div class="card pad" id="prBody">${bodyFields(b)}</div>
      <div class="row small" style="gap:14px;padding:0 4px"><a href="#/standards" class="lnk">${t("Strength goals")}</a><a href="#/nutrition" class="lnk">${t("Nutrition")}</a></div></div></div>`;
  segVal($("#prLv"), (v) => setProf({ level: v, onboarded: true }));
  segVal($("#prDays"), (v) => setProf({ days: +v }));
  segVal($("#prEq"), (v) => { S.settings.equip = v; save("settings"); });
  const host = $("#prBody"); wireBody(host, b, () => { if (readBody(host, b)) saveBody(b); });
  requestAnimationFrame(() => indicate(view()));
}

/* ---------------- strength standards ---------------- */
export async function standardsView() {
  setTop({ title: t("Strength goals"), back: true }); loading();
  const rid = routeId(); const st = await load("standards"); if (!live(rid)) return; const lifts = st.lifts || [], lv = st.levels || [];
  const unit = S.settings.unit;
  const best = (lift) => { // best e1RM among exercises whose name matches
    let re; try { re = new RegExp(lift.match, "i"); } catch { return null; }
    let b = null; for (const e of EX) if (re.test(e.name)) { const x = bestOf(e.slug); if (x && (!b || x.e1rm > b.e1rm)) b = { ...x, name: e.name }; }
    return b;
  };
  const draw = () => {
    const bw = lastBW(), sex = prof().sex || "male";
    const rows = lifts.map((l) => {
      const r = l.ratios?.[sex] || [], kg = r.map((x) => Math.round(x * bw / 2.5) * 2.5), b = bw ? best(l) : null;
      const mine = b ? (l.id === "pullup" ? b.e1rm + bw : b.e1rm) : 0; // pull-ups: added weight + bodyweight
      const reached = kg.filter((k) => mine >= k).length, next = kg[reached];
      const pct = mine && kg.length ? Math.min(100, (mine / kg[kg.length - 1]) * 100) : 0;
      return `<div class="card pad std"><div class="row between"><b>${esc(L(l.name))}</b>${mine ? `<span class="num small">${Math.round(mine)} ${unit}</span>` : `<span class="dim tiny">${t("not logged yet")}</span>`}</div>
        <div class="stdbar">${kg.map((k, i) => `<span class="${i < reached ? "on" : ""}"><b class="num">${k}</b><small>${esc(L(st.levelNames?.[lv[i]]) || lv[i] || "")}</small></span>`).join("")}${pct ? `<i style="inset-inline-start:${pct}%"></i>` : ""}</div>
        <div class="small muted">${next ? (mine ? t("Aim for at least {w} ({n} to go).", { w: `<b>${next} ${unit}</b>`, n: Math.max(0, Math.round(next - mine)) }) : t("Aim for at least {w}.", { w: `<b>${next} ${unit}</b>` })) : mine ? t("Elite level. Great work.") : ""}${l.note ? ` ${esc(L(l.note))}` : ""}</div></div>`;
    }).join("");
    view().innerHTML = `<div class="card pad"><div class="row" style="flex-wrap:wrap;gap:10px"><b class="grow">${t("You")}</b>
        ${seg("sSex", [["male", t("Male")], ["female", t("Female")]], sex)}<button class="btn sm" id="sBw">${ic("scale", "sm")} ${bw ? `${bw} ${unit}` : t("Set weight")}</button></div></div>
      ${bw ? `<div class="stack tight mt-10">${rows}</div>` : `<div class="empty">${t("Enter your bodyweight to see your targets.")}</div>`}
      <p class="dim small mt-12">${t("Your number is your best estimated 1-rep max from logged sets.")}${st.note ? ` ${esc(L(st.note))}` : ""}</p>`;
    segVal($("#sSex"), (v) => { setProf({ sex: v }); draw(); });
    $("#sBw").onclick = async () => { const { askText } = await import("./ui.js"); const v = await askText(t("Bodyweight"), { value: bw || "", ok: t("Save"), type: "number", inputmode: "decimal" }); const w = +v; if (!w) return; if (w < 25 || w > 300) return toast(t("Enter a weight between 25 and 300")); saveBW(w); draw(); };
  };
  draw();
}

/* ---------------- nutrition ---------------- */
export async function nutritionView() {
  setTop({ title: t("Nutrition"), back: true }); loading();
  const rid = routeId(); const nu = await load("nutrition"); if (!live(rid)) return; const acts = nu.activity || [], goals = nu.goals || [];
  const p = prof(), n = (p.nutri = p.nutri || {});
  n.sex = n.sex || p.sex || "male"; n.age = n.age || 25; n.h = n.h || 175; n.act = n.act || acts[2]?.id; n.goal = n.goal || (p.goal === "fatloss" ? "cut" : p.goal === "muscle" ? "lean-bulk" : "maintain");
  const draw = () => {
    const w = n.w || kgBW() || 75;
    const { tdee, kcal, prot, fat, carb, g } = nutriCalc(nu, n, w);
    view().innerHTML = `<div class="card pad nutri">
        <div class="kpis"><div class="kpi"><b class="num">${kcal}</b><span>${t("kcal / day")}</span></div><div class="kpi"><b class="num">${prot[0]}–${prot[1]} g</b><span>${t("Protein")}</span></div><div class="kpi"><b class="num">${fat} g</b><span>${t("Fat (min)")}</span></div><div class="kpi"><b class="num">${carb} g</b><span>${t("Carbs")}</span></div></div>
        <div class="dim tiny mt-6">${t("Maintenance about {n} kcal", { n: Math.round(tdee / 10) * 10 })}${g.rate ? ` · ${esc(L(g.rate))}` : ""}</div></div>
      <div class="card pad mt-10">
        <div class="field"><label>${t("Goal")}</label><div class="gchips" id="nGoal">${goals.map((x) => `<button class="chip ${x.id === n.goal ? "on" : ""}" data-v="${x.id}">${esc(L(x.name))}</button>`).join("")}</div></div>
        <div class="field"><label>${t("Activity")}</label><select id="nAct">${acts.map((x) => `<option value="${x.id}" ${x.id === n.act ? "selected" : ""}>${esc(L(x.name))} — ${esc(L(x.desc))}</option>`).join("")}</select></div>
        <div class="nrow"><div class="field"><label>${t("Sex")}</label>${seg("nSex", [["male", t("Male")], ["female", t("Female")]], n.sex, "block")}</div>
          <div class="field"><label for="nAge">${t("Age")}</label><input id="nAge" type="number" inputmode="numeric" min="14" max="90" value="${n.age}"></div>
          <div class="field"><label for="nH">${t("Height (cm)")}</label><input id="nH" type="number" inputmode="numeric" min="120" max="230" value="${n.h}"></div>
          <div class="field"><label for="nW">${t("Weight (kg)")}</label><input id="nW" type="number" inputmode="decimal" min="30" max="300" value="${Math.round(w * 10) / 10}"></div></div></div>
      ${(nu.guide || []).map((s) => `<details class="gsec"><summary>${esc(L(s.title))}${ic("chev", "sm")}</summary><ul>${(s.points || []).map((x) => `<li>${esc(L(x))}</li>`).join("")}</ul></details>`).join("")}
      ${nu.disclaimer ? `<p class="dim small mt-12">${esc(L(nu.disclaimer))}</p>` : ""}
      ${(nu.sources || []).length ? `<p class="dim tiny">${t("Sources:")} ${nu.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(" · ")}</p>` : ""}`;
    const upd = (k, v) => { n[k] = v; save("profile"); draw(); };
    segVal($("#nGoal"), (v) => upd("goal", v)); segVal($("#nSex"), (v) => upd("sex", v));
    $("#nAct").onchange = (e) => upd("act", e.target.value);
    for (const [id, k, lo, hi] of [["nAge", "age", 14, 90], ["nH", "h", 120, 230], ["nW", "w", 30, 300]])
      $("#" + id).onchange = (e) => { const v = +e.target.value; if (v >= lo && v <= hi) upd(k, v); else { toast(t("Enter a value between {lo} and {hi}", { lo, hi })); e.target.value = n[k] || ""; } };
    requestAnimationFrame(() => indicate(view()));
  };
  draw();
}

/* ---------------- plans explained (block 26) ---------------- */
let plansDays = 0; // filter on the Plans page (kept while the app is open)
const TARGET = { beginner: [6, 10], intermediate: [10, 16], advanced: [12, 20] };
export async function plansView(id) {
  setTop({ title: id ? t("Plan") : t("Plans"), back: true }); loading();
  const rid = routeId(); const pl = await P.loadPlanText(); if (!live(rid)) return; const C = pl.plans || {};
  if (id) {
    const p = P.planById(id), c = C[id] || {}; if (!p) return redirect("#/plans");
    setTop({ title: L(c.name) || p.name, back: true });
    const blk = (h, v) => (v ? `<div class="h4">${h}</div><p class="small">${esc(L(v))}</p>` : "");
    const list = (h, xs, cls) => ((xs || []).length ? `<div class="h4">${h}</div><ul class="small glist ${cls}">${xs.map((x) => `<li>${esc(L(x))}</li>`).join("")}</ul>` : "");
    const ws = P.weeklySets(p), [lo, hi] = TARGET[p.level], max = Math.max(hi, ...Object.values(ws));
    const rec = p.id === P.recommendedId();
    view().innerHTML = `<div class="card pad"><div class="eyebrow">${esc(lvName(p.level))} · ${tn(p.days, "{n} day a week", "{n} days a week")}${rec ? ` · ${t("Recommended for you")}` : ""}</div><p class="small" style="margin:6px 0 0">${esc(L(c.what))}</p><p class="small b" style="margin:6px 0 0">${esc(P.weekLine(p))}</p>${c.best ? `<p class="dim small" style="margin:6px 0 0">${esc(L(c.best))}</p>` : ""}</div>
      <div class="row between scn-h"><div class="h4">${t("How a week works")}</div><select class="chip scn-cmp" id="pCmp" aria-label="${t("Compare with another plan")}"><option value="">${t("Compare with…")}</option>${P.PLANS.filter((q) => q.id !== p.id).map((q) => `<option value="${q.id}">${esc(L(C[q.id]?.name) || q.name)} · ${tn(q.days, "{n} day", "{n} days")}</option>`).join("")}</select></div><div id="scnHost"></div>
      ${blk(t("Who it's for"), c.who)}${blk(t("Why it works"), c.why)}${list(t("Good"), c.pros, "pros")}${list(t("Keep in mind"), c.cons, "cons")}
      <div class="h4">${t("Hard sets per muscle per week")}</div><div class="wsets">${P.MAIN.map((g) => [g, ws[g] || 0]).map(([g, n]) => `<div><span>${esc(P.gName(g))}</span><i><u style="inset-inline-start:${(lo / max) * 100}%;width:${((hi - lo) / max) * 100}%"></u><b style="width:${(n / max) * 100}%" class="${n < lo ? "lo" : ""}"></b></i><em class="num">${n}</em></div>`).join("")}</div>
      <div class="dim tiny mt-6">${t("Green band = a good weekly range for this level ({lo}–{hi} sets). Presses count half a set for triceps, rows and pulldowns half a set for biceps.", { lo, hi })}${(() => { const o = Object.entries(ws).filter(([g]) => !P.MAIN.includes(g)); return o.length ? " " + t("Also: {list}.", { list: o.map(([g, n]) => `${esc(P.gName(g))} ${n}`).join(" · ") }) : ""; })()}</div>
      ${blk(t("How to progress"), c.progression)}${list(t("Tips"), c.tips, "")}
      <div class="h4">${t("Print it")}</div><p class="dim small" style="margin:0 0 8px">${t("The {level} plans as a PDF with photos and a QR code to each video.", { level: esc(lvName(p.level)) })}</p>${guideBtns(p.level)}
      <div class="row mt-16"><button class="btn grow" id="pPv">${t("Preview")}</button><button class="btn primary grow" id="pUse">${ic("plus", "sm")} ${t("Use this plan")}</button></div>`;
    const sc = await import("./scenario.js"); if (!live(rid)) return;
    sc.mountScenario($("#scnHost"), p);
    $("#pCmp").onchange = (e) => sc.mountScenario($("#scnHost"), p, { compare: e.target.value });
    $("#pPv").onclick = () => T.previewPlan(p);
    $("#pUse").onclick = async () => { if (await T.usePlan(p, false)) go("#/train"); };
    return;
  }
  const rec = P.recommendedId();
  const draw = () => {
    const d = plansDays, ps = P.PLANS.filter((p) => !d || p.days === d).sort((a, b) => (b.id === rec) - (a.id === rec) || a.days - b.days);
    view().innerHTML = `<div class="gchips" id="pDays" role="group" aria-label="${t("Days a week")}">${[0, 2, 3, 4, 5, 6].map((v) => `<button class="chip ${v === d ? "on" : ""}" data-v="${v}">${v ? tn(v, "{n} day", "{n} days") : t("All")}</button>`).join("")}</div>
      <div class="stack tight mt-10" id="pList">${ps.map((p) => T.planCard(p)).join("")}</div>
      <a class="btn ghost block mt-8" href="#/start">${ic("layers", "sm")} ${t("Not sure? Find my plan")}</a>
      ${pl.progression ? `<details class="gsec"><summary>${esc(L(pl.progression.title))}${ic("chev", "sm")}</summary><ul>${(pl.progression.points || []).map((x) => `<li>${esc(L(x))}</li>`).join("")}</ul></details>` : ""}`;
    segVal($("#pDays"), (v) => { plansDays = +v; draw(); });
    $("#pList").onclick = (e) => { T.planClicks(e); }; // never return false: that cancels the "How it works" link
    T.fillPlanLines(view());
  };
  draw();
}
