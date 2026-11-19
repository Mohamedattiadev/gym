// HTML for the printable guide + wall poster (see build.mjs). Same design language as the app: off-white paper, Inter,
// flat cards with a 1 px hairline, coral #D93A31 used sparingly, our illustrations, the app's words. No emoji, no gradients.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/* UI words (the app's own wording); tr/ar come with block 21 */
const T = {
  en: {
    levels: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" },
    guide: "guide", poster: "Wall poster", days: (n) => `${n} days a week`, min: (n) => `about ${n} min`,
    dayNames: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], rest: "Rest", restDay: "Rest day",
    getApp: "Get the app", getAppLine: "Free. Works offline. Install it from the browser.", scanEx: "Scan an exercise QR for its video.",
    exercise: "Exercise", sets: "Sets", reps: "Reps", setsReps: "Sets × reps", restCol: "Rest", tier: "tier", video: "Video",
    howToUse: "How to use this guide", use: [
      "Train on the days in the week plan. Rest days are part of the plan.",
      "Do the exercises in order. Warm up first (page {warm}).",
      "Write every set on the log sheets at the back, or log it in the app.",
      "Add reps first, then weight. The progress page shows how.",
      "Scan the small QR next to an exercise to watch how it is done."],
    plan: "Your plan", week: "Your week", who: "Who it is for", why: "Why it works", pros: "Good", cons: "Keep in mind", tips: "Tips",
    weeklySets: "Hard sets per muscle per week", workout: "Workout", firstCue: "Key cue",
    progress: "How to progress", progressShort: "Add a rep each week. When every set reaches the top of the range, add a little weight and start again at the bottom.", next4: "The next 4 weeks", wk4: ["Start", "Reps up", "Weight up", "Deload"],
    example: (n, s, r, top, lo) => `Example: ${n}, ${s} sets of ${r}. Add reps until every set reaches ${top}, then add weight and start again at ${lo}. Every few weeks take one lighter week (about 60% of the weight, one set less).`,
    warm: "Warm-up and cool-down", general: "General warm-up", ramp: "Ramp-up sets", cool: "Cool-down",
    swaps: "Swaps and pain", swapsLine: "Machine busy or missing? Use one of these instead. They train the same muscle with a similar movement.",
    instead: "Instead of", tryThese: "Try one of these", pain: "If a joint hurts",
    goals: "Strength goals", goalsLine: "Estimated one-rep max as a multiple of your bodyweight.", lift: "Lift", men: "Men", women: "Women",
    nutrition: "Nutrition basics", calc: "Your daily calories", formula: "Step 1 · Resting energy (Mifflin-St Jeor)",
    fMen: "Men: 10 × weight (kg) + 6.25 × height (cm) − 5 × age + 5", fWomen: "Women: 10 × weight (kg) + 6.25 × height (cm) − 5 × age − 161",
    step2: "Step 2 · Multiply by your activity", step3: "Step 3 · Adjust for your goal", protein: "Protein", fat: "Fat",
    app: "Using the app", appLine: "Everything in this guide is also in the app, with videos, a rest timer and your history.",
    log: "Log sheet", logLine: "Write weight × reps for each set. When every set reaches the top of the range, add weight next time.",
    weekN: (n) => `Week ${n}`, printAgain: "Print this page again for weeks 7–12.", date: "Date",
    sources: "Sources", made: "Made with Gym, a free workout app.", page: "Page",
    stepsApp: [
      ["home", "Home", "Up next shows today's workout. Tap Start workout."],
      ["session", "Log a set", "Type kg and reps, tap the check. Tap Previous to repeat last time."],
      ["rest", "Rest timer", "Starts by itself after each set. It also shows on the lock screen."],
      ["exercise", "Exercise page", "Video, How to, Common mistakes and Muscles for every exercise."],
      ["body", "Body map", "Tap a muscle to see what it does and the best exercises for it."],
      ["backup", "Backup", "Me > Settings > Backup file keeps your history safe. Export it now and then."]],
    install: "Install: open the site, then Add to Home screen (iPhone: Share > Add to Home Screen; Android and desktop: the Install app button in Me > Settings).",
  },
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmtRest = (s) => (s >= 60 ? `${Math.floor(s / 60)}${s % 60 ? `:${String(s % 60).padStart(2, "0")}` : ""} min` : `${s} s`);
const reps = (r) => String(r).replace("-", "–");

function css(root, kind) {
  const font = "file://" + resolve(root, "app/fonts/Inter.woff2");
  return `<style>
@font-face { font-family: Inter; src: url("${font}") format("woff2"); font-weight: 100 900; }
@page { size: ${kind === "poster" ? "A3" : "A4"}; margin: 0; }
:root { --paper: #FBF9F7; --card: #FFFFFF; --s2: #F4F1EE; --ink: #1E1B1A; --dim: #6B625C; --faint: #9A918A; --line: #E5DED8; --line2: #D6CEC7; --accent: #D93A31; --accent-text: #C2352D; --ill-ink: #1E1B1A; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--paper); color: var(--ink); font-family: Inter, system-ui, sans-serif; font-feature-settings: "tnum" 1, "cv11" 1; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
a { color: inherit; text-decoration: none; }
.page { width: 210mm; height: 297mm; padding: 16mm 16mm 18mm; position: relative; overflow: hidden; break-after: page; display: flex; flex-direction: column; }
.foot { position: absolute; left: 16mm; right: 16mm; bottom: 8mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: var(--faint); }
.foot b { color: var(--dim); font-weight: 600; }
.brand { display: flex; align-items: center; gap: 2.5mm; font-weight: 700; font-size: 13pt; letter-spacing: -.01em; }
.brand img { width: 8mm; height: 8mm; }
h1 { font-size: 30pt; line-height: 1.05; letter-spacing: -.025em; font-weight: 750; }
h2 { font-size: 19pt; letter-spacing: -.02em; font-weight: 700; margin-bottom: 2mm; }
h3 { font-size: 11pt; font-weight: 650; margin-bottom: 1.5mm; }
.kicker { font-size: 8pt; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; color: var(--accent-text); margin-bottom: 2mm; }
p, li { font-size: 9.5pt; line-height: 1.5; }
.dim { color: var(--dim); } .small { font-size: 8.5pt; } .tiny { font-size: 7.5pt; }
.lead { font-size: 11pt; line-height: 1.5; color: var(--dim); max-width: 150mm; }
.card { background: var(--card); border: .25mm solid var(--line); border-radius: 3.5mm; padding: 5mm; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.stack > * + * { margin-top: 4mm; }
ul.dots { list-style: none; } ul.dots li { padding-left: 4mm; position: relative; margin-top: 1.2mm; }
ul.dots li::before { content: ""; position: absolute; left: 0; top: 2.1mm; width: 1.4mm; height: 1.4mm; border-radius: 50%; background: var(--line2); }
ul.dots.acc li::before { background: var(--accent); }
ol.num { list-style: none; counter-reset: n; } ol.num li { counter-increment: n; padding-left: 7mm; position: relative; margin-top: 2mm; }
ol.num li::before { content: counter(n); position: absolute; left: 0; top: .2mm; width: 4.6mm; height: 4.6mm; border-radius: 50%; border: .25mm solid var(--line2); font-size: 7pt; font-weight: 650; display: grid; place-items: center; }
.week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2mm; }
.week > div { border: .25mm solid var(--line); background: var(--card); border-radius: 2.5mm; padding: 2.5mm 2mm; text-align: center; }
.week > div.off { background: transparent; border-style: dashed; color: var(--faint); }
.week i { display: block; font-style: normal; font-size: 7.5pt; color: var(--dim); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.week b { display: block; font-size: 9pt; font-weight: 650; margin-top: 1mm; line-height: 1.2; }
.week > div.on b { color: var(--accent-text); }
.bars { display: grid; grid-template-columns: 24mm 1fr 8mm; gap: 1.6mm 3mm; align-items: center; font-size: 8.5pt; }
.bars i { height: 2.2mm; border-radius: 1.1mm; background: var(--s2); position: relative; overflow: hidden; }
.bars i b { position: absolute; inset: 0 auto 0 0; background: var(--accent); border-radius: 1.1mm; }
.bars em { font-style: normal; text-align: right; font-weight: 600; }
.qr { background: #fff; padding: 1.4mm; border-radius: 1.5mm; border: .25mm solid var(--line); display: block; }
.qr svg { display: block; width: 100%; height: 100%; }
.tierb { display: inline-block; font-size: 6.5pt; font-weight: 700; border: .25mm solid var(--line2); border-radius: 1mm; padding: .2mm 1.2mm; color: var(--dim); vertical-align: 1px; }
.tierb.S { border-color: var(--accent); color: var(--accent-text); }
/* workout table */
.ex { display: grid; grid-template-columns: 38mm 1fr 25mm 17mm 19mm; gap: 4mm; align-items: center; padding: 3.2mm 0; border-top: .25mm solid var(--line); }
.ex:first-of-type { border-top: 0; }
.ex .ph { width: 38mm; height: 21.4mm; border-radius: 2mm; object-fit: cover; background: var(--s2); display: block; }
.ex .nm { font-size: 10.5pt; font-weight: 650; line-height: 1.25; }
.ex .meta { font-size: 7.5pt; color: var(--dim); margin-top: .8mm; }
.ex .cue { font-size: 8pt; color: var(--dim); margin-top: 1.2mm; line-height: 1.4; }
.ex .sr { font-size: 12pt; font-weight: 700; letter-spacing: -.01em; } .ex .sr small { display: block; font-size: 7pt; font-weight: 500; color: var(--faint); letter-spacing: 0; }
.ex .qr { width: 19mm; height: 19mm; }
.thead { display: grid; grid-template-columns: 38mm 1fr 25mm 17mm 19mm; gap: 4mm; font-size: 7pt; color: var(--faint); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; padding-bottom: 1.5mm; }
table.t { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
table.t th { text-align: left; font-size: 7pt; color: var(--faint); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; padding: 0 2mm 1.5mm 0; }
table.t td { border-top: .25mm solid var(--line); padding: 2mm 2mm 2mm 0; vertical-align: top; line-height: 1.4; }
table.t td.n { font-weight: 600; white-space: nowrap; }
.swg { display: grid; grid-template-columns: 1fr 1fr; gap: 0 6mm; }
.swg > div { border-top: .25mm solid var(--line); padding: 2.2mm 0; font-size: 8pt; line-height: 1.45; break-inside: avoid; }
.swg b { font-weight: 650; font-size: 8.5pt; } .swg .dim { font-size: 7pt; }
.ill { color: var(--accent); } .ill svg { width: 100%; height: 100%; display: block; }
.shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
.shots img { width: 100%; height: 75mm; object-fit: cover; object-position: top; border-radius: 3mm; border: .25mm solid var(--line); display: block; background: var(--s2); }
.shots h3 { margin: 2.5mm 0 .5mm; font-size: 9.5pt; }
.shots p { font-size: 8pt; color: var(--dim); line-height: 1.4; }
.logt { width: 100%; border-collapse: collapse; table-layout: fixed; }
.logt th { font-size: 7pt; color: var(--faint); text-transform: uppercase; letter-spacing: .05em; font-weight: 600; text-align: left; padding: 0 1.5mm 1.5mm; }
.logt td { border: .25mm solid var(--line2); height: var(--rh, 7.2mm); font-size: 7pt; color: var(--faint); padding: 0 1.5mm; vertical-align: middle; }
.logt td.exn { border-left: 0; font-size: 8pt; color: var(--ink); font-weight: 600; line-height: 1.25; padding-left: 0; }
.logt td.exn span { display: block; font-weight: 400; color: var(--dim); font-size: 7pt; }
.logt tr.first td { border-top: .5mm solid var(--ink); }
.logt td.sn { width: 6mm; text-align: center; color: var(--dim); }
/* poster */
.poster { width: 297mm; height: 420mm; padding: 16mm 16mm 14mm; display: flex; flex-direction: column; break-after: page; }
.poster h1 { font-size: 46pt; }
.poster .week b { font-size: 14pt; } .poster .week i { font-size: 10pt; } .poster .week > div { padding: 4mm 2mm; border-radius: 3.5mm; }
.pcols { display: grid; gap: 7mm; flex: 1; min-height: 0; margin-top: 8mm; }
.pw { background: var(--card); border: .3mm solid var(--line); border-radius: 5mm; padding: 6mm; display: flex; flex-direction: column; }
.pw h2 { font-size: 22pt; margin: 0; } .pw .dim { font-size: 11pt; margin-top: 1mm; }
.pex { display: grid; grid-template-columns: 40mm 1fr 19mm; gap: 5mm; align-items: center; padding: 3.2mm 0; border-top: .3mm solid var(--line); }
.pex .ph { width: 40mm; height: 22.5mm; border-radius: 2.5mm; object-fit: cover; display: block; background: var(--s2); }
.pex .nm { font-size: 15pt; font-weight: 650; line-height: 1.15; display: block; } .pex .meta { font-size: 10pt; color: var(--dim); margin-top: 1.2mm; display: flex; align-items: baseline; gap: 3mm; white-space: nowrap; }
.pex .sr { font-size: 17pt; font-weight: 750; letter-spacing: -.02em; white-space: nowrap; color: var(--ink); }
.pex .qr { width: 19mm; height: 19mm; padding: 1mm; }
.pw .rows { flex: 1; display: flex; flex-direction: column; justify-content: space-around; }
.pfoot { display: flex; align-items: center; gap: 7mm; margin-top: 7mm; }
.pfoot .qr { width: 42mm; height: 42mm; padding: 2.5mm; }
@media print { .page, .poster { margin: 0; } }
</style>`;
}

export function guideHTML(c) {
  const t = T[c.lang] || T.en, L = (x) => (x && typeof x === "object" ? x[c.lang] ?? x.en : x ?? "");
  const P = c.plan, tx = c.text.plans.plans[P.id], lvName = t.levels[c.level];
  const exUrl = (slug) => `${c.site}#/ex/${slug}`, qr = (u) => `<span class="qr">${c.qr(u)}</span>`;
  const img = (e) => (e.poster ? `<img class="ph" src="file://${c.img(e.poster)}" alt="">` : `<span class="ph"></span>`);
  const ill = (n) => { const f = resolve(c.root, `app/illustrations/${n}.svg`); return existsSync(f) ? readFileSync(f, "utf8") : ""; };
  const fam = (e) => c.fam[e.family] || {};
  const tierB = (e) => (e.tier ? `<span class="tierb ${e.tier}">${e.tier} ${t.tier}</span>` : "");
  const planName = L(tx.name);
  const pages = [];
  let pageNo = 0;
  const page = (body, cls = "") => { pageNo++; pages.push(`<section class="page ${cls}">${body}<div class="foot"><span><b>Gym</b> · ${esc(lvName)} ${t.guide} · ${esc(planName)}</span><span>${t.page} ${pageNo}</span></div></section>`); };
  const weekStrip = () => `<div class="week">${P.week.map((w, i) => w == null ? `<div class="off"><i>${t.dayNames[i]}</i><b>${t.rest}</b></div>`
    : `<div class="on"><i>${t.dayNames[i]}</i><b>${esc(P.workouts[w].name)}</b></div>`).join("")}</div>`;

  /* page numbers known up front: cover 1, plan 2, workouts 3.., then progress, warm-up, swaps, goals, nutrition, app, logs */
  const nW = P.workouts.length, warmPage = 3 + nW + 1;

  // 1 cover
  pageNo++;
  pages.push(`<section class="page" style="padding:20mm 18mm">
    <div class="brand"><img src="file://${resolve(c.root, "app/icons/icon.svg")}" alt="">Gym</div>
    <div style="margin-top:28mm"><div class="kicker">${esc(lvName)} ${t.guide}</div><h1>${esc(planName)}</h1>
      <p class="lead" style="margin-top:4mm">${esc(L(tx.line))}</p>
      <p class="dim" style="margin-top:2mm;font-size:10pt">${t.days(P.days)} · ${t.min(Math.max(...P.workouts.map((w) => w.min)))}</p></div>
    <div class="ill" style="width:120mm;height:104mm;margin:14mm auto 0">${ill("hero-start")}</div>
    <div style="margin-top:auto;display:flex;gap:7mm;align-items:center" class="card">
      <a href="${c.site}" class="qr" style="width:36mm;height:36mm;padding:2mm">${c.qr(c.site)}</a>
      <div><h3 style="font-size:14pt">${t.getApp}</h3><p class="dim">${t.getAppLine}</p><p class="dim small" style="margin-top:2mm">${t.scanEx}</p></div></div>
  </section>`);

  // 2 plan
  const sets = Object.entries(P.sets).sort((a, b) => b[1] - a[1]), maxS = Math.max(...sets.map(([, n]) => n), 10);
  page(`<div class="kicker">${t.plan}</div><h2>${esc(planName)}</h2><p class="lead">${esc(L(tx.what))}</p>
    <h3 style="margin-top:6mm">${t.week}</h3>${weekStrip()}
    <div class="grid2" style="margin-top:6mm">
      <div class="card"><h3>${t.who}</h3><p class="dim small">${esc(L(tx.who))}</p><h3 style="margin-top:3mm">${t.why}</h3><p class="dim small">${esc(L(tx.why))}</p></div>
      <div class="card"><h3>${t.weeklySets}</h3><div class="bars">${sets.map(([m, n]) => `<span>${esc(m)}</span><i><b style="width:${Math.round((n / maxS) * 100)}%"></b></i><em>${n}</em>`).join("")}</div>
        <p class="dim tiny" style="margin-top:2.5mm">${esc(L(tx.setsPerMuscle))}</p></div>
      <div class="card"><h3>${t.pros}</h3><ul class="dots acc">${tx.pros.map((x) => `<li class="small">${esc(L(x))}</li>`).join("")}</ul></div>
      <div class="card"><h3>${t.cons}</h3><ul class="dots">${tx.cons.map((x) => `<li class="small">${esc(L(x))}</li>`).join("")}</ul></div>
    </div>
    <div class="card" style="margin-top:4mm"><h3>${t.howToUse}</h3><ol class="num">${t.use.map((x) => `<li class="small">${esc(x.replace("{warm}", warmPage))}</li>`).join("")}</ol></div>`);

  // workouts
  for (const w of P.workouts) {
    const total = w.items.reduce((a, x) => a + +x.sets, 0);
    page(`<div class="kicker">${t.workout} · ${w.items.length} exercises · ${total} sets · ${t.min(w.min)}</div><h2>${esc(w.name)}</h2>
      <p class="dim small" style="margin-bottom:5mm">${t.dayNames.filter((_, i) => P.week[i] === P.workouts.indexOf(w)).join(", ")}</p>
      <div class="thead"><span>${t.exercise}</span><span></span><span>${t.setsReps}</span><span>${t.restCol}</span><span>${t.video}</span></div>
      ${w.items.map((e) => `<div class="ex">${img(e)}
        <div><a class="nm" href="${exUrl(e.slug)}">${esc(e.name)}</a><div class="meta">${esc(e.group)} · ${esc(e.equipment.join(", "))} ${tierB(e)}</div>
          ${fam(e).cues?.[0] ? `<div class="cue">${esc(fam(e).cues[0])}</div>` : ""}</div>
        <div class="sr">${e.sets} × ${reps(e.reps)}<small>${t.sets} × ${t.reps}</small></div>
        <div class="small" style="font-weight:600">${fmtRest(e.rest || 90)}</div>
        <a href="${exUrl(e.slug)}">${qr(exUrl(e.slug))}</a></div>`).join("")}`);
  }

  // progress
  const it = P.workouts[0].items[0], [lo, hi] = String(it.reps).split("-").map(Number), top = hi || lo + 2;
  const wk = [[60, lo, it.sets], [60, top, it.sets], [62.5, lo, it.sets], [37.5, lo, Math.max(1, it.sets - 1)]], mx = Math.max(...wk.map(([a, r, s]) => a * r * s));
  page(`<div class="kicker">${t.progress}</div><h2>${esc(L(c.text.plans.progression.title))}</h2>
    <div class="card" style="margin-top:3mm"><ul class="dots acc">${c.text.plans.progression.points.map((x) => `<li>${esc(L(x))}</li>`).join("")}</ul></div>
    <div class="card" style="margin-top:4mm"><h3>${t.next4}</h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5mm;align-items:end;height:46mm;margin-top:3mm">
        ${wk.map(([a, r, s], n) => `<div style="display:flex;flex-direction:column;justify-content:flex-end;height:100%">
          <div style="height:${Math.round((a * r * s / mx) * 30)}mm;background:${n === 3 ? "var(--s2)" : "var(--accent)"};border-radius:1.5mm;${n === 3 ? "border:.25mm dashed var(--line2)" : ""}"></div>
          <b style="font-size:10pt;margin-top:2mm">${a} kg × ${r}</b><span class="dim tiny">${n + 1}. ${t.wk4[n]} · ${s} ${t.sets.toLowerCase()}</span></div>`).join("")}</div>
      <p class="dim small" style="margin-top:4mm">${esc(t.example(it.name, it.sets, reps(it.reps), top, lo))}</p></div>
    <div class="grid2" style="margin-top:4mm"><div class="card"><h3>${esc(planName)}</h3><p class="dim small">${esc(L(tx.progression))}</p></div>
      <div class="card"><h3>${t.tips}</h3><ul class="dots">${tx.tips.map((x) => `<li class="small">${esc(L(x))}</li>`).join("")}</ul></div></div>`);

  // warm-up
  const W = c.text.warm, dr = (id) => W.drills[id];
  const drillList = (ids) => ids.filter(dr).map((id) => `<li class="small"><b>${esc(L(dr(id).name))}</b> <span class="dim">· ${esc(L(dr(id).cue || dr(id).how))}</span></li>`).join("");
  page(`<div class="kicker">${t.warm}</div><h2>${t.warm}</h2><p class="lead">${esc(L(W.intro))}</p>
    <div class="grid2" style="margin-top:5mm">
      <div class="card"><h3>1 · ${t.general}</h3><p class="dim small">${esc(L(W.general.note))}</p><ul class="dots" style="margin-top:2mm">${drillList((W.general.cardio || []).slice(0, 3).concat((W.general.mobility?.full || []).slice(0, 3)))}</ul></div>
      <div class="card"><h3>2 · ${t.ramp}</h3><p class="dim small">${esc(L(W.ramp.note))}</p><ul class="dots acc" style="margin-top:2mm">${W.ramp.rules.map((x) => `<li class="small">${esc(L(x))}</li>`).join("")}</ul></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 50mm;gap:4mm;margin-top:4mm;align-items:stretch">
      <div class="card"><h3>3 · ${t.cool}</h3><p class="dim small">${esc(L(W.cooldown.note))}</p><ul class="dots" style="margin-top:2mm">${drillList(W.cooldown.drills)}</ul></div>
      <div class="ill" style="padding:4mm">${ill("warmup")}</div></div>`);

  // swaps + pain
  const all = P.workouts.flatMap((w) => w.items);
  const J = c.text.joints;
  page(`<div class="kicker">${t.swaps}</div><h2>${t.swaps}</h2><p class="lead">${t.swapsLine}</p>
    <div class="swg" style="margin-top:4mm">${all.map((e) => `<div><b>${esc(e.name)}</b> <span class="dim">${esc(e.equipment.join(", "))}</span><div class="dim" style="font-size:8pt;color:var(--ink)">${e.swaps.map((x) => `<a href="${exUrl(x.slug)}">${esc(x.name)}</a> <span class="dim">${esc(x.equipment[0] || "")}</span>`).join(" · ")}</div></div>`).join("")}</div>
    <h3 style="margin-top:6mm">${t.pain}</h3>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3mm">${Object.values(J).map((j) => `<div class="card" style="padding:3.5mm"><b class="small">${esc(L(j.name))}</b>
      <ul class="dots">${(j.tips?.[c.lang] || j.tips?.en || []).slice(0, 2).map((x) => `<li class="tiny">${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>`);

  // strength goals
  const S = c.text.std;
  page(`<div class="kicker">${t.goals}</div><h2>${t.goals}</h2><p class="lead">${esc(L(S.note))}</p>
    <table class="t" style="margin-top:5mm"><tr><th>${t.lift}</th><th></th>${S.levels.map((l) => `<th>${esc(L(S.levelNames[l]))}</th>`).join("")}</tr>
    ${S.lifts.map((l) => ["male", "female"].map((sx, k) => `<tr>${k === 0 ? `<td class="n" rowspan="2">${esc(L(l.name))}<div class="dim tiny" style="font-weight:400;white-space:normal">${esc(L(l.note))}</div></td>` : ""}
      <td class="dim">${sx === "male" ? t.men : t.women}</td>${(l.ratios[sx] || []).map((r, i) => `<td style="${i === { beginner: 0, intermediate: 1, advanced: 2 }[c.level] ? "font-weight:700;color:var(--accent-text)" : ""}">${r}×</td>`).join("")}</tr>`).join("")).join("")}</table>
    <p class="dim small" style="margin-top:4mm">${t.goalsLine}</p>`);

  // nutrition
  const N = c.text.nutri;
  page(`<div class="kicker">${t.nutrition}</div><h2>${t.nutrition}</h2>
    <div class="card" style="margin-top:2mm"><h3>${t.calc}</h3>
      <p class="small"><b>${t.formula}</b></p><p class="small dim">${t.fMen}<br>${t.fWomen}</p>
      <p class="small" style="margin-top:2.5mm"><b>${t.step2}</b></p>
      <table class="t" style="margin-top:1mm">${N.activity.map((a) => `<tr><td class="n">× ${a.f}</td><td><b style="font-weight:600">${esc(L(a.name))}</b> <span class="dim">${esc(L(a.desc))}</span></td></tr>`).join("")}</table>
      <p class="small" style="margin-top:2.5mm"><b>${t.step3}</b></p>
      <table class="t" style="margin-top:1mm">${N.goals.map((g) => `<tr><td class="n">${g.kcalPct > 0 ? "+" : g.kcalPct < 0 ? "−" : "±"}${Math.abs(Math.round(g.kcalPct * 100))}%</td><td><b style="font-weight:600">${esc(L(g.name))}</b> <span class="dim">${esc(L(g.desc))} ${esc(L(g.rate))}</span></td></tr>`).join("")}</table></div>
    <div class="grid2" style="margin-top:4mm"><div class="card"><h3>${t.protein}</h3><p class="dim small">${esc(L(N.protein.note))}</p></div>
      <div class="card"><h3>${t.fat}</h3><p class="dim small">${esc(L(N.fat.note))}</p></div></div>
    <p class="dim tiny" style="margin-top:4mm">${esc(L(N.disclaimer))}</p>`);

  // app guide
  const shot = (n) => { const f = resolve(c.root, `tools/guide/shots/${n}.jpg`); return existsSync(f) ? `<img src="file://${f}" alt="">` : `<img alt="">`; };
  page(`<div class="kicker">${t.app}</div><h2>${t.app}</h2><p class="lead">${t.appLine}</p>
    <div class="shots" style="margin-top:6mm">${t.stepsApp.map(([n, h, p]) => `<div>${shot(n)}<h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("")}</div>
    <div style="margin-top:auto;display:flex;gap:6mm;align-items:center" class="card">
      <a href="${c.site}" class="qr" style="width:28mm;height:28mm">${c.qr(c.site)}</a>
      <div><h3>${t.getApp}</h3><p class="dim small">${t.install}</p></div></div>`);

  // log sheets
  for (const w of P.workouts) {
    const rowH = Math.min(11, Math.max(6.5, 205 / (w.items.reduce((a, x) => a + +x.sets, 0) + 2)));
    page(`<div class="kicker">${t.log}</div><h2>${esc(w.name)}</h2><p class="dim small" style="margin-bottom:4mm">${t.logLine}</p>
      <table class="logt" style="--rh:${rowH}mm"><colgroup><col style="width:40mm"><col style="width:6mm">${[1, 2, 3, 4, 5, 6].map(() => "<col>").join("")}</colgroup>
      <tr><th style="padding-left:0">${t.exercise}</th><th></th>${[1, 2, 3, 4, 5, 6].map((n) => `<th>${t.weekN(n)}</th>`).join("")}</tr>
      <tr><td class="exn" style="font-weight:400;color:var(--dim)">${t.date}</td><td class="sn"></td>${"<td></td>".repeat(6)}</tr>
      ${w.items.map((e) => Array.from({ length: +e.sets }, (_, s) => `<tr class="${s === 0 ? "first" : ""}">${s === 0 ? `<td class="exn" rowspan="${e.sets}">${esc(e.name)}<span>${e.sets} × ${reps(e.reps)}</span></td>` : ""}<td class="sn">${s + 1}</td>${'<td>kg ×</td>'.repeat(6)}</tr>`).join("")).join("")}</table>
      <p class="dim tiny" style="margin-top:3mm">${t.printAgain}</p>`);
  }

  // sources (last page footer note on the log sheets would be cramped -> small closing block)
  page(`<div class="kicker">${t.sources}</div><h2>${t.sources}</h2>
    <ul class="dots" style="margin-top:3mm">${c.text.plans.sources.concat(c.text.warm.sources.map((s) => ({ title: s.name, url: s.url }))).map((s) => `<li class="small"><a href="${esc(s.url)}"><b style="font-weight:600">${esc(s.title)}</b></a></li>`).join("")}</ul>
    <div class="ill" style="width:90mm;height:78mm;margin:16mm auto 0">${ill("plan")}</div>
    <div style="margin-top:auto;display:flex;gap:6mm;align-items:center" class="card">
      <a href="${c.site}" class="qr" style="width:28mm;height:28mm">${c.qr(c.site)}</a>
      <div><h3>${t.made}</h3><p class="dim small">mohamedattiadev.github.io/gym</p></div></div>`);

  return `<!doctype html><html lang="${c.lang}" dir="${c.lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>Gym · ${esc(lvName)} ${t.guide}</title>${css(c.root, "guide")}</head><body>${pages.join("")}</body></html>`;
}

export function posterHTML(c) {
  const t = T[c.lang] || T.en, L = (x) => (x && typeof x === "object" ? x[c.lang] ?? x.en : x ?? "");
  const P = c.plan, tx = c.text.plans.plans[P.id], lvName = t.levels[c.level];
  const exUrl = (slug) => `${c.site}#/ex/${slug}`;
  const n = P.workouts.length, cols = n <= 2 ? n : n === 4 ? 2 : 3;
  const img = (e) => (e.poster ? `<img class="ph" src="file://${c.img(e.poster)}" alt="">` : `<span class="ph"></span>`);
  const week = `<div class="week" style="margin-top:7mm">${P.week.map((w, i) => w == null ? `<div class="off"><i>${t.dayNames[i]}</i><b>${t.rest}</b></div>`
    : `<div class="on"><i>${t.dayNames[i]}</i><b>${esc(P.workouts[w].name)}</b></div>`).join("")}</div>`;
  return `<!doctype html><html lang="${c.lang}" dir="${c.lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>Gym · ${esc(lvName)} · ${t.poster}</title>${css(c.root, "poster")}</head><body>
  <section class="poster">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><div class="kicker" style="font-size:11pt">${esc(lvName)} · ${t.days(P.days)}</div><h1>${esc(L(tx.name))}</h1></div>
      <div class="brand" style="font-size:18pt"><img src="file://${resolve(c.root, "app/icons/icon.svg")}" alt="" style="width:11mm;height:11mm">Gym</div></div>
    ${week}
    <div class="pcols" style="grid-template-columns:repeat(${cols},1fr)">
      ${P.workouts.map((w) => `<div class="pw"><h2>${esc(w.name)}</h2><div class="dim" style="margin-bottom:3mm">${t.min(w.min)} · ${t.dayNames.filter((_, i) => P.week[i] === P.workouts.indexOf(w)).join(", ")}</div>
        <div class="rows">${w.items.map((e) => `<div class="pex">${img(e)}<div><a class="nm" href="${exUrl(e.slug)}">${esc(e.name)}</a><div class="meta"><span class="sr">${e.sets} × ${reps(e.reps)}</span><span>${t.restCol} ${fmtRest(e.rest || 90)}</span></div></div>
          <a href="${exUrl(e.slug)}" class="qr">${c.qr(exUrl(e.slug))}</a></div>`).join("")}</div></div>`).join("")}
    </div>
    <div class="pfoot card" style="padding:6mm">
      <a href="${c.site}" class="qr">${c.qr(c.site)}</a>
      <div style="flex:1"><h2 style="font-size:24pt;margin:0">${t.getApp}</h2><p class="dim" style="font-size:13pt;margin-top:1.5mm">${t.getAppLine}</p>
        <p style="font-size:13pt;margin-top:3mm;font-weight:600">${t.scanEx}</p></div>
      <div style="max-width:78mm;border-left:.3mm solid var(--line);padding-left:6mm"><p style="font-size:11pt;font-weight:650">${t.progress}</p><p class="dim" style="font-size:10.5pt;margin-top:1mm">${t.progressShort}</p></div>
    </div>
  </section></body></html>`;
}
