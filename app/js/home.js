// Home: what to do now (resume / next workout / get started), quick rest timer, this week vs last week, recovery.
import { S } from "./store.js";
import { $, esc, ic, fmtDate, fmtDur, haptic, delta, fmtKg } from "./ui.js";
import { BY, EX, periodStats, weekStart, WEEK, DAY, lowMuscles, recovery, hurts } from "./data.js";
import { MBY, bodySVG } from "./body.js";
import { setTop, go } from "./nav.js";
import { installBanner, wireInstall } from "./install.js";
import { xcard, onImg } from "./components.js";
import * as T from "./train.js";
import { t, tn, loc } from "./i18n.js";
import { planById, recommendedId, freqOf, planSlots, planOpts, minutesOf } from "./plans.js";

const view = () => $("#view");
const greeting = () => { const h = new Date().getHours(); return h < 5 ? t("Late session") : h < 12 ? t("Good morning") : h < 18 ? t("Good afternoon") : t("Good evening"); };

function weekDots() {
  const w0 = weekStart(), today = new Date().toDateString();
  return `<div class="week">${Array.from({ length: 7 }, (_, i) => {
    const d = new Date(w0 + i * DAY), a = d.getTime(), on = S.sessions.some((s) => s.endedAt >= a && s.endedAt < a + DAY);
    return `<div class="${on ? "on" : ""} ${d.toDateString() === today ? "is-today" : ""}">${d.toLocaleDateString(loc(), { weekday: "narrow" })}<i>${on ? ic("check", "xs") : ""}</i></div>`;
  }).join("")}</div>`;
}
function heroCard() {
  if (S.active) {
    const n = S.active.entries.reduce((a, en) => a + en.sets.filter((s) => s.done).length, 0);
    return `<a class="hero-card live" href="#/session"><div class="eyebrow">${t("In progress")}</div><h2>${esc(S.active.name)}</h2>
      <div class="muted small">${fmtDur(Date.now() - S.active.startedAt)} · ${tn(n, "{n} set done", "{n} sets done")} · ${t("tap to resume")}</div></a>`;
  }
  const next = T.nextWorkout();
  const pl = T.currentPlan();
  if (next) return `<div class="hero-card"><div class="eyebrow">${t("Up next")}${pl ? ` · ${t("{name} plan", { name: esc(pl.name) })}` : ""}</div><h2>${esc(next.name)}</h2>
      <div class="muted small">${tn(next.items.length, "{n} exercise", "{n} exercises")} · ${t("about {n} min", { n: Math.max(10, Math.round(next.items.reduce((a, it) => a + +it.sets * 2.6, 0) / 5) * 5) })}</div>
      <div class="thumbs">${next.items.slice(0, 6).map((it) => `<img src="${BY[it.slug]?.poster || ""}" alt="" data-hide-broken>`).join("")}</div>
      <div class="row"><button class="btn primary grow" id="startNext">${ic("play", "sm")} ${t("Start workout")}</button><a class="btn" href="#/warmup/w/${next.id}" aria-label="${t("Warm up")}">${ic("flame", "sm")}<span class="wl"> ${t("Warm up")}</span></a><a class="btn" href="#/workout/${next.id}" aria-label="${t("Edit")}">${ic("edit", "sm")}</a></div></div>`;
  const p = planById(recommendedId());
  return `<div class="hero-card has-ill rec"><div class="txt"><div class="eyebrow">${S.profile?.level ? t("Recommended for you") : t("Recommended for beginners")}</div><h2>${esc(p.name)} · ${tn(p.days, "{n} day", "{n} days")}</h2>
      <div class="muted small" style="margin-bottom:14px">${t("Each muscle {f}× a week, about {m} min a session.", { f: freqOf(p), m: Math.max(...planSlots(p, planOpts()).map(minutesOf)) })} ${S.profile?.level ? "" : t("Not a beginner?") + " "}<a href="#/start" style="color:var(--accent-text);font-weight:600">${S.profile?.level ? t("Find another plan") : t("Find my plan")}</a></div>
      </div><div class="row"><button class="btn primary grow" id="useRec">${ic("plus", "sm")} ${t("Use this plan")}</button><a class="btn grow" href="#/plan/${p.id}">${t("How it works")}</a></div><div class="ill" data-ill="hero-start"></div></div>`;
}
function weekCard() {
  const w0 = weekStart(), now = Date.now();
  const cur = periodStats(w0, now + 1), prev = periodStats(w0 - WEEK, w0 - WEEK + (now - w0) + 1); // same point in last week
  const kpi = (v, l, d) => `<div class="kpi"><b class="num">${v}</b><span>${l}</span>${d}</div>`;
  return `<div class="card pad"><div class="row between"><b>${t("This week")}</b><span class="dim tiny">${t("vs same day last week")}</span></div>
    <div class="kpis mt-10">${kpi(cur.workouts, t("Workouts"), delta(cur.workouts, prev.workouts))}${kpi(cur.sets, t("Sets"), delta(cur.sets, prev.sets))}${kpi(fmtKg(cur.kg), t("Volume {unit}", { unit: S.settings.unit }), delta(cur.kg, prev.kg, fmtKg))}</div>
    ${weekDots()}</div>`;
}
function recoveryCard() {
  const rec = recovery(); const ids = Object.keys(rec);
  if (!ids.length) return "";
  const paint = (svg) => svg.replace(/<path class="m" data-m="([^"]+)"/g, (m0, id) => `<path class="m ${rec[id]?.state || "g"}" data-m="${id}"`);
  const fresh = ids.filter((m) => rec[m].state === "r"), mid = ids.filter((m) => rec[m].state === "y");
  const names = (l) => l.map((m) => MBY[m]?.name || m).slice(0, 4).join(", ");
  return `<a class="card pad row" href="#/body" style="gap:14px"><div class="mini-body">${paint(bodySVG("front"))}${paint(bodySVG("back"))}</div>
    <div class="grow"><b>${t("Recovery")}</b>
      <div class="small muted" style="margin:4px 0 8px">${fresh.length ? t("Just trained: {m}.", { m: esc(names(fresh)) }) + " " : ""}${mid.length ? t("Recovering: {m}.", { m: esc(names(mid)) }) : ""}${!fresh.length && !mid.length ? t("All muscles ready to train.") : ""}</div>
      <div class="legend-dots"><span><i style="background:var(--rec-r)"></i>&lt;24h</span><span><i style="background:var(--rec-y)"></i>${t("Recovering")}</span><span><i style="background:var(--rec-g)"></i>${t("Ready")}</span></div></div></a>`;
}

export function homeView() {
  setTop();
  const low = lowMuscles();
  const top = EX.filter((e) => e.tier === "S" && e.canonical && !hurts(e)).slice(0, 6);
  view().innerHTML = `
    <div class="hello"><h1 class="grow">${greeting()}${S.profile?.name ? ", " + esc(S.profile.name) : ""}</h1><div class="eyebrow">${fmtDate(Date.now(), { weekday: "short", month: "short", day: "numeric" })}</div></div>
    ${installBanner()}
    <div class="cols stagger">
      <div class="stack">${heroCard()}${S.sessions.length ? recoveryCard() : ""}</div>
      <div class="stack">${S.sessions.length ? weekCard() : ""}
        ${low.length ? `<a class="notice warn" href="#/body">${ic("alert", "sm")}<div class="grow"><b>${t("Low volume this week")}</b><div class="small muted">${low.slice(0, 4).map(([m, n]) => `${MBY[m]?.name || m} ${n}/10`).join(" · ")} ${t("sets")}</div></div>${ic("chev", "sm")}</a>` : ""}
        ${S.sessions.length ? "" : recoveryCard()}
        ${S.sessions.length ? "" : `<div class="itiles two"><a class="itile" href="#/body"><span class="ico">${ic("body")}</span><div><b>${t("Body map")}</b><span>${t("Tap a muscle")}</span></div></a>
          <a class="itile" href="#/videos" style="--c:var(--tier-S)"><span class="ico">${ic("yt")}</span><div><b>${t("Jeff's tier lists")}</b><span>${t("Watch rankings")}</span></div></a>
          <a class="itile" href="#/standards" style="--c:var(--tier-A)"><span class="ico">${ic("trophy")}</span><div><b>${t("Strength goals")}</b><span>${t("For your bodyweight")}</span></div></a>
          <a class="itile" href="#/nutrition" style="--c:var(--rec-g)"><span class="ico">${ic("flame")}</span><div><b>${t("Nutrition")}</b><span>${t("Calories & protein")}</span></div></a></div>`}
      </div></div>
    <div class="sec"><h2>${t("Top S-tier picks")}</h2><a href="#/lib" id="seeS">${t("See all")}</a></div>
    <div class="grid picks">${top.map((e) => xcard(e)).join("")}</div>`;
  onImg(view());
  const ur = $("#useRec"); if (ur) ur.onclick = async () => { haptic(); if (await T.usePlan(planById(recommendedId()), false)) homeView(); };
  const sn = $("#startNext"); if (sn) sn.onclick = () => T.startSession(T.nextWorkout());
  $("#seeS").onclick = async (e) => { e.preventDefault(); const L = await import("./exercise.js"); Object.assign(L.lib, { tier: "S", group: "All", q: "" }); go("#/lib"); };
  wireInstall();
}
