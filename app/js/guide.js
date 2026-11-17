// Guides: onboarding quiz (-> plan), strength standards, nutrition calculator + guide, plans explained.
// Content lives in data/guide/*.json (en/tr/ar); this module is lazy-loaded by the router.
import { S, save } from "./store.js";
import { $, esc, ic, haptic, toast, selectIn, indicate } from "./ui.js";
import { EX, bestOf, EQUIP_PROFILES } from "./data.js";
import { setTop, go, redirect } from "./main.js";
import * as T from "./train.js";
import * as Sync from "./sync.js";

const view = () => $("#view");
const L = (o) => (o && typeof o === "object" ? o[S.settings.lang || "en"] || o.en || "" : o ?? "");
const G = {};
const load = (n) => G[n] || (G[n] = fetch(`data/guide/${n}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
const prof = () => (S.profile = S.profile || {});
const setProf = (o) => { Object.assign(prof(), o); save("profile"); Sync.autoPush(); };
const lastBW = () => { const l = (S.bodyweight || []).filter((x) => +x.w).sort((a, b) => String(a.d).localeCompare(String(b.d))); return l.length ? +l[l.length - 1].w : 0; };
const saveBW = (w) => { const d = new Date().toISOString().slice(0, 10); S.bodyweight = [...(S.bodyweight || []).filter((x) => x.d !== d), { d, w, updatedAt: Date.now() }]; save("bodyweight"); };
const seg = (id, opts, cur, cls = "") => `<div class="seg sm ${cls}" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${esc(l)}</button>`).join("")}</div>`;
const segVal = (el, fn) => (el.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; haptic(); selectIn(b); fn(b.dataset.v); });
const loading = () => (view().innerHTML = `<div class="empty">Loading…</div>`);

/* ---------------- hub ---------------- */
export function guideView() {
  setTop({ title: "Guides", back: true });
  const t = (href, icn, c, b, s) => `<a class="itile" href="${href}" style="--c:${c}"><span class="ico">${ic(icn)}</span><div><b>${b}</b><span>${s}</span></div></a>`;
  view().innerHTML = `<div class="itiles">${t("#/start", "user", "var(--accent)", "Find my plan", "5 quick questions")}
    ${t("#/plans", "layers", "var(--tier-A)", "Plans explained", "What, who, why")}
    ${t("#/standards", "trophy", "var(--tier-S)", "Strength goals", "Aim for at least…")}
    ${t("#/nutrition", "fire", "var(--info)", "Nutrition", "Calories & protein")}</div>`;
}

/* ---------------- onboarding quiz ---------------- */
const quiz = { i: 0, a: {} };
export async function startView() {
  setTop({ title: "Find my plan", back: true }); loading();
  const ob = await load("onboarding"); const Q = ob.questions || [];
  if (!quiz.started) { const p = prof(); quiz.a = { level: p.level, days: p.days, equip: S.settings.equip, goal: p.goal, sex: p.sex }; quiz.i = 0; quiz.started = true; }
  const steps = [...Q, { id: "bw" }];
  const draw = () => {
    if (quiz.i >= steps.length) return result(ob);
    const q = steps[quiz.i], n = steps.length;
    const head = `<div class="qprog"><i style="width:${(quiz.i / n) * 100}%"></i></div><div class="dim tiny" style="margin:10px 0 4px">Question ${quiz.i + 1} of ${n}</div>`;
    const nav = `<div class="row" style="margin-top:16px">${quiz.i ? `<button class="btn grow" id="qBack">${ic("back", "sm")} Back</button>` : ""}<button class="btn primary grow" id="qNext" ${q.id === "bw" || quiz.a[q.id] != null ? "" : "disabled"}>Next</button></div>`;
    if (q.id === "bw") {
      view().innerHTML = `${head}<h2 class="qt">What do you weigh?</h2><div class="muted small">Used for strength goals and calories. Optional.</div>
        <div class="field" style="margin-top:14px"><label for="qBw">Bodyweight (${S.settings.unit})</label><input id="qBw" type="number" inputmode="decimal" min="25" max="300" step="0.1" value="${lastBW() || ""}" placeholder="e.g. 75"></div>${nav}`;
    } else {
      view().innerHTML = `${head}<h2 class="qt">${esc(L(q.title))}</h2>${q.help ? `<div class="muted small">${esc(L(q.help))}</div>` : ""}
        <div class="stack tight" style="margin-top:14px" id="qOpts">${(q.options || []).map((o) => `<button class="qopt ${String(quiz.a[q.id]) === String(o.v) ? "on" : ""}" data-v="${o.v}"><b>${esc(L(o.label))}</b>${o.desc ? `<span>${esc(L(o.desc))}</span>` : ""}</button>`).join("")}</div>${nav}`;
      $("#qOpts").onclick = (e) => { const b = e.target.closest("[data-v]"); if (!b) return; haptic(); quiz.a[q.id] = q.id === "days" ? +b.dataset.v : b.dataset.v; quiz.i++; draw(); };
    }
    const bk = $("#qBack"); if (bk) bk.onclick = () => { quiz.i--; draw(); };
    $("#qNext").onclick = () => { if (q.id === "bw") { const w = +$("#qBw").value; if (w && (w < 25 || w > 300)) return toast("Enter a weight between 25 and 300"); quiz.a.bw = w; } quiz.i++; draw(); };
  };
  draw();
}
export function pickPlan({ level = "beginner", days = 3 } = {}) {
  if (days <= 3) return level === "advanced" && days === 3 ? "adv-ppl" : "beg-fb";
  if (days >= 6 && level !== "beginner") return "adv-ppl";
  return "int-ul";
}
function result(ob) {
  const a = quiz.a, id = pickPlan(a), p = T.PLANS.find((x) => x.id === id);
  setProf({ level: a.level, days: a.days, goal: a.goal, sex: a.sex });
  if (a.equip) { S.settings.equip = a.equip; S.settings.onboarded = true; save("settings"); }
  if (a.bw) saveBW(a.bw);
  quiz.started = false;
  const eq = EQUIP_PROFILES[a.equip]?.name;
  view().innerHTML = `<div class="qprog"><i style="width:100%"></i></div><div class="eyebrow" style="margin-top:14px">${esc(L(ob.result?.title) || "Your plan")}</div>
    <h2 class="qt">${esc(p.name)}</h2><div class="muted small">${esc(p.desc)}${eq ? ` · ${esc(eq)}` : ""}</div>
    <div class="card pad" style="margin-top:12px">${esc(L(ob.result?.why?.[id]))}</div>
    <div class="row" style="margin-top:14px"><a class="btn grow" href="#/plan/${id}">How it works</a><button class="btn primary grow" id="qUse">${ic("plus", "sm")} Use this plan</button></div>
    <button class="btn ghost block" style="margin-top:6px" id="qAgain">Start over</button>`;
  $("#qUse").onclick = () => { T.usePlan(p, false); go("#/train"); };
  $("#qAgain").onclick = () => { quiz.i = 0; startView(); };
  haptic("success");
}

/* ---------------- strength standards ---------------- */
export async function standardsView() {
  setTop({ title: "Strength goals", back: true }); loading();
  const st = await load("standards"); const lifts = st.lifts || [], lv = st.levels || [];
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
      return `<div class="card pad std"><div class="row between"><b>${esc(L(l.name))}</b>${mine ? `<span class="num small">${Math.round(mine)} ${unit}</span>` : `<span class="dim tiny">not logged yet</span>`}</div>
        <div class="stdbar">${kg.map((k, i) => `<span class="${i < reached ? "on" : ""}"><b class="num">${k}</b><small>${esc(L(st.levelNames?.[lv[i]]) || lv[i] || "")}</small></span>`).join("")}${pct ? `<i style="inset-inline-start:${pct}%"></i>` : ""}</div>
        <div class="small muted">${next ? `Aim for at least <b>${next} ${unit}</b>${mine ? ` (${Math.max(0, Math.round(next - mine))} to go)` : ""}.` : mine ? "Elite level. Great work." : ""}${l.note ? ` ${esc(L(l.note))}` : ""}</div></div>`;
    }).join("");
    view().innerHTML = `<div class="card pad"><div class="row" style="flex-wrap:wrap;gap:10px"><b class="grow">You</b>
        ${seg("sSex", [["male", "Male"], ["female", "Female"]], sex)}<button class="btn sm" id="sBw">${ic("scale", "sm")} ${bw ? `${bw} ${unit}` : "Set weight"}</button></div></div>
      ${bw ? `<div class="stack tight" style="margin-top:10px">${rows}</div>` : `<div class="empty">Enter your bodyweight to see your targets.</div>`}
      <p class="dim small" style="margin-top:12px">Your number is your best estimated 1-rep max from logged sets.${st.note ? ` ${esc(L(st.note))}` : ""}</p>`;
    segVal($("#sSex"), (v) => { setProf({ sex: v }); draw(); });
    $("#sBw").onclick = async () => { const { askText } = await import("./ui.js"); const v = await askText("Bodyweight", { value: bw || "", ok: "Save", type: "number", inputmode: "decimal" }); const w = +v; if (!w) return; if (w < 25 || w > 300) return toast("Enter a weight between 25 and 300"); saveBW(w); Sync.autoPush(); draw(); };
  };
  draw();
}

/* ---------------- nutrition ---------------- */
export async function nutritionView() {
  setTop({ title: "Nutrition", back: true }); loading();
  const nu = await load("nutrition"); const acts = nu.activity || [], goals = nu.goals || [];
  const p = prof(), n = (p.nutri = p.nutri || {});
  n.sex = n.sex || p.sex || "male"; n.age = n.age || 25; n.h = n.h || 175; n.act = n.act || acts[2]?.id; n.goal = n.goal || (p.goal === "fatloss" ? "cut" : p.goal === "muscle" ? "lean-bulk" : "maintain");
  const draw = () => {
    const kgW = S.settings.unit === "lb" ? lastBW() / 2.2046 : lastBW(), w = n.w || kgW || 75;
    const bmr = 10 * w + 6.25 * n.h - 5 * n.age + (n.sex === "female" ? -161 : 5);
    const a = acts.find((x) => x.id === n.act) || { f: 1.55 }, g = goals.find((x) => x.id === n.goal) || { kcalPct: 0 };
    const tdee = bmr * a.f, kcal = Math.round((tdee * (1 + g.kcalPct)) / 10) * 10;
    const [p1, p2] = nu.protein?.gPerKg || [1.6, 2.2], prot = [Math.round(w * p1), Math.round(w * p2)];
    const fat = Math.round((kcal * (nu.fat?.pctKcal?.[0] || 0.25)) / 9), carb = Math.max(0, Math.round((kcal - prot[1] * 4 - fat * 9) / 4));
    view().innerHTML = `<div class="card pad nutri">
        <div class="kpis"><div class="kpi"><b class="num">${kcal}</b><span>kcal / day</span></div><div class="kpi"><b class="num">${prot[0]}–${prot[1]} g</b><span>Protein</span></div><div class="kpi"><b class="num">${fat} g</b><span>Fat (min)</span></div><div class="kpi"><b class="num">${carb} g</b><span>Carbs</span></div></div>
        <div class="dim tiny" style="margin-top:6px">Maintenance about ${Math.round(tdee / 10) * 10} kcal${g.rate ? ` · ${esc(L(g.rate))}` : ""}</div></div>
      <div class="card pad" style="margin-top:10px">
        <div class="field"><label>Goal</label><div class="gchips" id="nGoal">${goals.map((x) => `<button class="chip ${x.id === n.goal ? "on" : ""}" data-v="${x.id}">${esc(L(x.name))}</button>`).join("")}</div></div>
        <div class="field"><label>Activity</label><select id="nAct">${acts.map((x) => `<option value="${x.id}" ${x.id === n.act ? "selected" : ""}>${esc(L(x.name))} — ${esc(L(x.desc))}</option>`).join("")}</select></div>
        <div class="nrow"><div class="field"><label>Sex</label>${seg("nSex", [["male", "Male"], ["female", "Female"]], n.sex, "block")}</div>
          <div class="field"><label for="nAge">Age</label><input id="nAge" type="number" inputmode="numeric" min="14" max="90" value="${n.age}"></div>
          <div class="field"><label for="nH">Height (cm)</label><input id="nH" type="number" inputmode="numeric" min="120" max="230" value="${n.h}"></div>
          <div class="field"><label for="nW">Weight (kg)</label><input id="nW" type="number" inputmode="decimal" min="30" max="300" value="${Math.round(w * 10) / 10}"></div></div></div>
      ${(nu.guide || []).map((s) => `<details class="gsec"><summary>${esc(L(s.title))}${ic("chev", "sm")}</summary><ul>${(s.points || []).map((x) => `<li>${esc(L(x))}</li>`).join("")}</ul></details>`).join("")}
      ${nu.disclaimer ? `<p class="dim small" style="margin-top:12px">${esc(L(nu.disclaimer))}</p>` : ""}
      ${(nu.sources || []).length ? `<p class="dim tiny">Sources: ${nu.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(" · ")}</p>` : ""}`;
    const upd = (k, v) => { n[k] = v; save("profile"); draw(); };
    segVal($("#nGoal"), (v) => upd("goal", v)); segVal($("#nSex"), (v) => upd("sex", v));
    $("#nAct").onchange = (e) => upd("act", e.target.value);
    for (const [id, k, lo, hi] of [["nAge", "age", 14, 90], ["nH", "h", 120, 230], ["nW", "w", 30, 300]])
      $("#" + id).onchange = (e) => { const v = +e.target.value; if (v >= lo && v <= hi) upd(k, v); else { toast(`Enter a value between ${lo} and ${hi}`); e.target.value = n[k] || ""; } };
    requestAnimationFrame(() => indicate(view()));
  };
  draw();
}

/* ---------------- plans explained ---------------- */
export async function plansView(id) {
  setTop({ title: id ? "Plan" : "Plans explained", back: true }); loading();
  const pl = await load("plans"); const C = pl.plans || {};
  if (id) {
    const p = T.PLANS.find((x) => x.id === id), c = C[id] || {}; if (!p) return redirect("#/plans");
    setTop({ title: p.name, back: true });
    const blk = (t, v) => (v ? `<div class="h4">${t}</div><p class="small">${esc(L(v))}</p>` : "");
    view().innerHTML = `<div class="card pad"><div class="eyebrow">${esc(p.level)} · ${p.days} days</div><p class="small" style="margin:6px 0 0">${esc(L(c.what) || p.desc)}</p></div>
      ${blk("Who it's for", c.who)}${blk("Why it works", c.why)}
      ${(c.schedule || []).length ? `<div class="h4">Your week</div><div class="sched">${c.schedule.map((d) => `<div><b>${esc(L(d.day))}</b><span>${esc(L(d.focus))}</span></div>`).join("")}</div>` : ""}
      ${blk("Sets per muscle", c.setsPerMuscle)}${blk("How to progress", c.progression)}
      ${(c.tips || []).length ? `<div class="h4">Tips</div><ul class="small glist">${c.tips.map((x) => `<li>${esc(L(x))}</li>`).join("")}</ul>` : ""}
      <button class="btn primary block" style="margin-top:16px" id="pUse">${ic("plus", "sm")} Use this plan</button>`;
    $("#pUse").onclick = () => { T.usePlan(p, false); go("#/train"); };
    return;
  }
  view().innerHTML = `<div class="stack tight">${T.PLANS.map((p) => `<a class="lrow" href="#/plan/${p.id}"><span class="ico-t">${ic("layers", "sm")}</span><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.level)} · ${esc(p.desc)}</div></div>${ic("chev", "sm")}</a>`).join("")}</div>
    ${(pl.splits || []).length ? `<div class="h4">Splits</div><div class="stack tight">${pl.splits.map((s) => `<div class="card pad"><div class="row between"><b>${esc(L(s.name))}</b><span class="dim tiny">${esc(s.days)} days</span></div><div class="small muted">${esc(L(s.about))}</div></div>`).join("")}</div>` : ""}
    ${pl.progression ? `<details class="gsec" open><summary>${esc(L(pl.progression.title))}${ic("chev", "sm")}</summary><ul>${(pl.progression.points || []).map((x) => `<li>${esc(L(x))}</li>`).join("")}</ul></details>` : ""}`;
}
