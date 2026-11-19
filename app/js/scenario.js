// Plans 2.0 "How it works" scenario player (block 26 part 2): a tappable Mon..Sun strip, the front + back body with the
// day's muscles lit and recovery colours (same windows as data.js recovery()) evolving over the repeating week,
// Play = walk the week ~1.5 s per day, a 4-week progression example, and (desktop) two plans side by side.
import { S } from "./store.js";
import { esc, ic, haptic } from "./ui.js";
import { BY, REC_BASE } from "./data.js";
import { MBY, bodySVG } from "./body.js";
import * as P from "./plans.js";
import { t, tn } from "./i18n.js";

const DAYS = P.DN, D = (d) => t(DAYS[d]);
const STEP = 1500;

/** muscles (primary) per workout index, from the exercises buildPlan picked */
function musclesOf(built) {
  return built.map((w) => new Set(w.items.flatMap((it) => BY[it.slug]?.primary || [])));
}
/** recovery state of every muscle on day d of a repeating week: r = trained today, y = recovering, g = ready */
export function dayStates(p, mus, d) {
  const out = {};
  for (const m of new Set(mus.flatMap((s) => [...s]))) {
    for (let k = 0; k < 14; k++) {
      const i = p.week[(((d - k) % 7) + 7) % 7];
      if (i == null || !mus[i].has(m)) continue;
      out[m] = k === 0 ? "r" : k * 24 < (REC_BASE[m] || 60) ? "y" : "g";
      break;
    }
  }
  return out;
}

function column(p, built, unit) {
  const freq = P.MAIN.map((g) => `${esc(P.gName(g))} ${P.timesPerWeek(p, g)}×`).join(" · ");
  return `<div class="scn-col card pad" data-plan="${p.id}">
    <div class="scn-name"><b>${esc(p.name)}</b><span class="dim tiny">${tn(p.days, "{n} day", "{n} days")}</span></div>
    <div class="scn-week" role="group" aria-label="${t("Days of the week")}">${p.week.map((i, d) => `<button class="${i == null ? "off" : ""}" data-d="${d}" aria-label="${D(d)}: ${i == null ? t("Rest") : esc(built[i].name)}"><b>${D(d)}</b><span>${i == null ? t("Rest") : esc(built[i].name)}</span></button>`).join("")}</div>
    <div class="scn-stage"><div class="mini-body scn-body">${bodySVG("front")}${bodySVG("back")}</div><div class="scn-info grow" aria-live="polite"></div></div>
    <div class="dim tiny scn-freq">${t("Times a week:")} ${freq}</div></div>`;
}
function info(p, built, d, st) {
  const i = p.week[d], head = `<div class="scn-day"><b>${D(d)} · ${i == null ? t("Rest") : esc(built[i].name)}</b>${i == null ? "" : `<span class="dim tiny num">${t("~{m} min", { m: P.minutesOf(built[i].items) })}</span>`}</div>`;
  if (i == null) {
    const y = Object.keys(st).filter((m) => st[m] === "y").map((m) => t(MBY[m]?.name || m));
    return `${head}<p class="small muted">${t("Rest day.")} ${y.length ? esc(t("Still recovering: {list}", { list: y.slice(0, 5).join(", ") + (y.length > 5 ? "…" : ".") })) : t("Everything is ready again.")}</p>`;
  }
  return `${head}<ol class="scn-list">${built[i].items.map((it) => `<li><a href="#/ex/${it.slug}">${esc(BY[it.slug]?.name || it.slug)}</a><span class="dim num">${it.sets} × ${esc(it.reps)}</span></li>`).join("")}</ol>`;
}

/** 4-week double progression example on the plan's first lift: reps up -> weight up -> deload */
function progression(built) {
  const it = built[0]?.items[0]; if (!it) return "";
  const lb = S.settings.unit === "lb", u = lb ? "lb" : "kg", w = lb ? 135 : 60, step = lb ? 5 : 2.5;
  const [lo, hi] = String(it.reps).split("-").map(Number); const top = hi || lo + 2;
  const wk = [[w, lo, it.sets, t("Start", null, "week")], [w, top, it.sets, t("Reps up")], [w + step, lo, it.sets, t("Weight up")], [Math.round((w * 0.6) / step) * step, lo, Math.max(1, it.sets - 1), t("Deload")]];
  const max = Math.max(...wk.map(([a, r, s]) => a * r * s));
  return `<div class="h4">${t("The next 4 weeks")}</div><div class="prog4">${wk.map(([a, r, s, lb], n) => `<div class="${n === 3 ? "dl" : ""}"><i><b style="height:${Math.round((a * r * s / max) * 100)}%"></b></i><em class="num">${a} ${u} × ${r}</em><span>${n + 1}. ${lb}</span></div>`).join("")}</div>
    <p class="dim tiny mt-6">${esc(t("Example: {name}, {s} sets of {r}. Add reps until every set reaches {top}, then add weight and start again at {lo}. Every few weeks take one lighter week (about 60% of the weight, one set less).", { name: BY[it.slug]?.name || "", s: it.sets, r: it.reps, top, lo }))}</p>`;
}

/** mount into host; returns nothing. opts.compare = second plan id (desktop), opts.opt = plan options (Preview sheet) */
export function mountScenario(host, p, { compare = "", opt = P.planOpts() } = {}) {
  const unit = S.settings.unit;
  const plans = [p, compare && P.planById(compare)].filter(Boolean);
  const built = plans.map((q) => P.buildPlan(q, opt)), mus = built.map(musclesOf);
  let d = Math.max(0, p.week.findIndex((i) => i != null)), timer = 0;
  host.innerHTML = `<div class="row between scn-top"><div class="legend-dots"><span><i style="background:var(--rec-r)"></i>${t("Trained today")}</span><span><i style="background:var(--rec-y)"></i>${t("Recovering")}</span><span><i style="background:var(--rec-g)"></i>${t("Ready")}</span></div>
      <button class="btn sm" id="scnPlay">${ic("play", "sm")} ${t("Play week")}</button></div>
    <div class="scn${plans.length > 1 ? " two" : ""}">${plans.map((q, n) => column(q, built[n], unit)).join("")}</div>
    ${progression(built[0])}`;
  const cols = [...host.querySelectorAll(".scn-col")], play = host.querySelector("#scnPlay");
  const show = (nd) => {
    d = nd;
    cols.forEach((c, n) => {
      const q = plans[n], st = dayStates(q, mus[n], d);
      c.querySelectorAll(".scn-week button").forEach((b) => b.classList.toggle("on", +b.dataset.d === d));
      c.querySelectorAll(".scn-body path.m").forEach((el) => el.setAttribute("class", `m ${st[el.dataset.m] || ""}`));
      c.querySelector(".scn-info").innerHTML = info(q, built[n], d, st);
    });
  };
  const stop = () => { clearInterval(timer); timer = 0; play.innerHTML = `${ic("play", "sm")} ${t("Play week")}`; play.setAttribute("aria-pressed", "false"); };
  play.onclick = () => {
    haptic();
    if (timer) return stop();
    play.innerHTML = `${ic("pause", "sm")} ${t("Pause")}`; play.setAttribute("aria-pressed", "true");
    let n = 0; show(0);
    timer = setInterval(() => {
      if (!host.isConnected) return clearInterval(timer);
      if (++n > 6) return stop();
      show(n);
    }, STEP);
  };
  host.querySelector(".scn").onclick = (e) => { const b = e.target.closest(".scn-week button"); if (!b) return; haptic(); stop(); show(+b.dataset.d); };
  show(d);
}
