// HTML for the printable guide + wall posters (see build.mjs). Same design language as the app: Inter, flat cards with a
// 1 px hairline, coral #D93A31 used with intent, our illustrations, the app's words. Light (print) and dark (phone) themes.
// One guide per level = every plan of that level (recommended first); one A3 poster page per plan.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { startKg, perHand, BODY, REF, e1rm, pctFor, progression, stepOf } from "./start.mjs";

/* UI words (the app's own wording); tr/ar come with block 21 */
const T = {
  en: {
    levels: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" },
    guide: "guide", days: (n) => `${n} days a week`, dshort: (n) => `${n} days`, min: (n) => `about ${n} min`,
    dayNames: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], rest: "Rest",
    recommended: "Recommended", page: "Page", contents: "Contents", see: (n) => `page ${n}`,
    getApp: "Get the app", getAppLine: "Free. No account. Works offline in the gym.",
    scanApp: "Scan with your phone camera", scanEx: "Scan the QR next to an exercise to watch its video.",
    inst: [["iPhone", "Open it in Safari, tap Share, then Add to Home Screen."], ["Android", "Open it in Chrome, tap the menu ⋮, then Install app."], ["Computer", "Chrome, Edge or Brave: click the install icon in the address bar."]],
    exercise: "Exercise", setsReps: "Sets × reps", restCol: "Rest", start: "Start", video: "Video", tier: "tier",
    startNote: (m, w, p) => `Start = first-session weight for a ${m} kg man (M) and a ${w} kg woman (W). Your own number: page ${p}.`,
    each: "each hand", bw: "Bodyweight",
    howToUse: "How to use this guide", use: [
      ["Find your level", "Answer three questions or test one lift. Page {level}."],
      ["Pick one plan", "Choose by how many days you can train. The recommended plan comes first. Page {choose}."],
      ["Find your starting weights", "Look up your bodyweight in the table, then adjust in the first session. Page {start}."],
      ["Train and write it down", "Do the exercises in order, warm up first, log every set on the sheets or in the app."],
      ["Add reps, then weight", "The progress pages show it week by week with real numbers. Page {prog}."]],
    secLevel: "Which level are you?", secChoose: "Choose your plan", secPlan: "Plan", secStart: "Starting weights",
    secProg: "How to progress", secWarm: "Warm-up and cool-down", secSwap: "Swaps and pain", secNutri: "Nutrition basics",
    secApp: "Using the app", secLog: "Log sheets", secSrc: "Sources",
    q3: "Three questions", q3line: "Count your answers. Mostly the first answer = Beginner, the second = Intermediate, the third = Advanced.",
    notSure: [["How long have you trained without long breaks?", ["Less than 1 year", "1 to 3 years", "More than 3 years"]],
      ["Do you know the main lifts (squat, bench press, row, deadlift)?", ["Not really", "Most of them", "Yes, with good form"]],
      ["How often does the weight on your main lifts go up?", ["Most weeks", "Every month or so", "Only over many months"]]],
    lvlDesc: { beginner: "Training less than 1 year, or not consistent yet.", intermediate: "1–3 years, you know the main lifts.", advanced: "3+ years, progress has slowed down." },
    strTest: "Or test one lift", strLine: "Your estimated one-rep max (e1RM) divided by your bodyweight. Below the Intermediate number = Beginner.",
    e1How: "How to get your e1RM without maxing", e1Steps: ["Warm up, then do one set of 3–10 reps you could not do one more time with good form.", "Multiply the weight by the number for your reps below.", "Divide by your bodyweight and compare with the table."],
    repsW: "Reps", factor: "× weight", e1Ex: (w, r, x, bw) => `Example: ${w} kg × ${r} reps = ${x} kg e1RM. At ${bw} kg bodyweight that is ${(x / bw).toFixed(2)}× bodyweight.`,
    lift: "Lift", men: "Men", women: "Women", at: (kg) => `at ${kg} kg`, youAre: "You are here",
    chooseLine: "Every plan below trains the whole body each week. Pick the one that fits the days you can really train.",
    perMuscle: (n) => `each muscle ${n}× a week`, best: "Best for", workouts: "workouts",
    who: "Who it is for", why: "Why it works", pros: "Good", cons: "Keep in mind", tips: "Tips", week: "Your week",
    weeklySets: "Hard sets per muscle per week", workoutsOf: (p) => `${p} · workouts`, sets: "sets", exercises: "exercises",
    startLead: "Nobody knows your first weights, not even you. Start with the number for your bodyweight, then adjust after the first set. Two or three reps should be left in the tank on every set.",
    startSteps: [["Look it up", "Find the exercise and the column closest to your bodyweight."], ["First set", "Do the reps. Could you do more than 4 extra? Add about 10%. Could you not reach the bottom of the range? Take 10% off."], ["Write it down", "The weight that leaves 2–3 reps is your starting weight. From now on, the log decides."]],
    startEx: "Example", startExText: (n, kg, lo, hi) => `${n}: the table says ${kg} kg. You do ${hi + 3} easy reps, so add 10% next set. If you only get ${lo - 2} reps, drop 10%.`,
    knowE1: "Already know your e1RM?", knowE1Line: "Working weight for the top of your rep range with 2 reps left:",
    pct: "% of e1RM", man: "Man", woman: "Woman", bwKg: "bodyweight", dbNote: "Dumbbells: kg in each hand. Machines and cables: the number on the stack (stacks differ between gyms, so treat it as a rough guide). BW = bodyweight only.",
    estimate: "These are estimates from bodyweight, level and equipment, for adults with no injuries. Safety first: if a weight feels wrong, it is wrong.",
    progLead: "Double progression: stay at one weight and add reps. When every set reaches the top of the range, add the smallest step and go back to the bottom.",
    progSteps: [["Same weight, more reps", "Each session, try to beat last time by one rep on one or two sets."], ["Top of the range on every set", "Next session add the smallest step: barbell 2.5 kg, dumbbells 2 kg, machine 5 kg."], ["Back to the bottom", "With the new weight you start again at the low end of the range."]],
    next4: "A typical month", wk4: ["Start", "Reps up", "Weight up", "Lighter week"],
    examples: "Real examples, week by week", exLine: (m) => `For a ${m} kg beginner man, one session a week shown. Coral = weight goes up next time.`,
    wkN: (n) => `Week ${n}`, whatIf: "When it does not go up",
    ifs: [["Stuck for 2 weeks", "Repeat the weight, sleep and eat more. Still stuck after 3 weeks? Take 10% off and build up again."],
      ["Bad day", "Do the same weight and fewer reps. One bad day changes nothing."],
      ["Missed a week", "Go back one week: the last weight you did easily."],
      ["Jump too big", "2 kg on a 10 kg dumbbell is 20%. Do 2–3 more reps first, or add 1 kg if your gym has it."],
      ["Every 6–8 weeks", "Take a lighter week: about 60% of the weight, one set less. Then continue where you were."]],
    warmGeneral: "General warm-up", ramp: "Ramp-up sets", cool: "Cool-down",
    swapsLine: "Machine busy or missing? Use one of these instead. They train the same muscle with a similar movement. The app shows all swaps.",
    pain: "If a joint hurts", nutriCalc: "Your daily calories", f1: "Step 1 · Resting energy (Mifflin-St Jeor)",
    fMen: "Men: 10 × weight (kg) + 6.25 × height (cm) − 5 × age + 5", fWomen: "Women: 10 × weight (kg) + 6.25 × height (cm) − 5 × age − 161",
    f2: "Step 2 · Multiply by your activity", f3: "Step 3 · Adjust for your goal", protein: "Protein", fat: "Fat",
    nEx: "Worked example", nExText: (b, t, g, p1, p2) => [`Man, 75 kg, 178 cm, 25 years: 10 × 75 + 6.25 × 178 − 5 × 25 + 5 = ${b} kcal.`, `Trains 3–5 days a week (× 1.55): ${t} kcal to stay the same.`, `Slow muscle gain (+10%): about ${g} kcal a day.`, `Protein: ${p1}–${p2} g a day (1.6–2.2 g per kg).`],
    appLead: "Everything in this guide is in the app too, with videos, a rest timer, your history and progress charts.",
    appPages: [
      ["Install it and start", [["install", "Install", "Settings shows the steps for your phone. Then it opens like any app, also offline."], ["onboard", "Set-up questions", "Level, days, equipment. Not sure? Three questions pick for you."], ["plans", "Pick a plan", "Plans for you shows the best fits. Tap Use plan."]]],
      ["Your plan and your day", [["plan", "How a week works", "Tap a day to see which muscles train, recover and are ready."], ["home", "Home", "Up next is today's workout. Tap Start workout."], ["progress", "Me > Progress", "Weekly volume, sets per muscle and your strength chart."]]],
      ["Logging a workout", [["session", "Log a set", "Type kg and reps, tap the check. Tap the Previous value to repeat last time in one tap."], ["rest", "Rest timer", "Starts by itself after each set, with the next set below. It also shows on the lock screen."], ["exercise", "Exercise page", "Video, Muscles and 3D for every exercise. Tap the heart to save it."]]],
      ["Learning the moves", [["howto", "How to", "Numbered steps, cues and Listen to hear them while you train."], ["mistake", "Common mistakes", "Tap Show: the wrong and the right way side by side."], ["body", "Body map", "Tap a muscle to see what it does and the best exercises for it."]]]],
    appLast: "Keep your history safe", appLastLine: "Me > Settings > Backup file > Export. Do it now and then, or connect cloud sync. A backup file brings everything back on a new phone.",
    log: "Log sheet", logLine: "Write weight × reps for each set. When every set reaches the top of the range, add weight next time.",
    weekN: (n) => `Week ${n}`, date: "Date", blank: "Blank log sheet", blankLine: "For any workout. Copy this page as often as you need.",
    made: "Made with Gym, a free workout app.", progShort: "Add a rep each week. When every set hits the top of the range, add the smallest weight step.",
    daysRange: (a, b) => (a === b ? `${a} days a week` : `${a} to ${b} days a week`), startLight: "Start light: leave 2–3 reps in the tank on every set.", plansIn: (n) => `${n} plans`,
  },
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmtRest = (s) => (s >= 60 ? `${Math.floor(s / 60)}${s % 60 ? `:${String(s % 60).padStart(2, "0")}` : ""} min` : `${s} s`);
const reps = (r) => String(r).replace("-", "–");
const kgS = (n) => `${+(+n).toFixed(2)}`;
const THEME = {
  light: "--paper:#FBF9F7;--card:#FFFFFF;--s2:#F3EFEB;--ink:#1E1B1A;--dim:#5E5650;--faint:#8F867F;--line:#E6DFD9;--line2:#D3CAC2;--accent:#D93A31;--accent-text:#C2352D;--on-accent:#FFFFFF;--tint:#FBE9E7;",
  dark: "--paper:#161413;--card:#201D1B;--s2:#2A2624;--ink:#F4EFEB;--dim:#BDB3AC;--faint:#8E857F;--line:#35302D;--line2:#4A433F;--accent:#E5483F;--accent-text:#F2685F;--on-accent:#FFFFFF;--tint:#3A2220;",
};

function css(root, kind, theme) {
  const font = "file://" + resolve(root, "app/fonts/Inter.woff2");
  return `<style>
@font-face { font-family: Inter; src: url("${font}") format("woff2"); font-weight: 100 900; }
@page { size: ${kind === "poster" ? "A3" : "A4"}; margin: 0; }
:root { ${THEME[theme] || THEME.light} }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--paper); color: var(--ink); font-family: Inter, system-ui, sans-serif; font-feature-settings: "tnum" 1, "cv11" 1; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
a { color: inherit; text-decoration: none; }
.page { width: 210mm; height: 297mm; padding: 15mm 15mm 16mm; position: relative; overflow: hidden; break-after: page; display: flex; flex-direction: column; background: var(--paper); }
.top { display: flex; align-items: center; gap: 3mm; font-size: 8pt; font-weight: 600; color: var(--faint); letter-spacing: .02em; padding-bottom: 3mm; margin-bottom: 7mm; border-bottom: .25mm solid var(--line); }
.top .no { color: var(--on-accent); background: var(--accent); border-radius: 1.2mm; padding: .6mm 1.8mm; font-weight: 700; }
.top .sp { flex: 1; } .top b { color: var(--ink); font-weight: 650; }
.foot { position: absolute; left: 15mm; right: 15mm; bottom: 7mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: var(--faint); }
.brand { display: flex; align-items: center; gap: 2.5mm; font-weight: 750; font-size: 14pt; letter-spacing: -.01em; }
.brand img { width: 9mm; height: 9mm; border-radius: 2mm; }
h1 { font-size: 40pt; line-height: 1; letter-spacing: -.035em; font-weight: 800; }
h2 { font-size: 24pt; line-height: 1.08; letter-spacing: -.025em; font-weight: 750; margin-bottom: 2.5mm; }
h3 { font-size: 11.5pt; font-weight: 700; margin-bottom: 1.5mm; letter-spacing: -.01em; }
.kicker { font-size: 8.5pt; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--accent-text); margin-bottom: 2mm; }
p, li { font-size: 10pt; line-height: 1.5; }
.dim { color: var(--dim); } .faint { color: var(--faint); } .small { font-size: 9pt; } .tiny { font-size: 7.5pt; }
.lead { font-size: 11.5pt; line-height: 1.5; color: var(--dim); max-width: 165mm; }
.card { background: var(--card); border: .25mm solid var(--line); border-radius: 3.5mm; padding: 5mm; }
.card.tint { background: var(--tint); border-color: transparent; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; } .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
.badge { display: inline-block; font-size: 7.5pt; font-weight: 700; letter-spacing: .02em; color: var(--on-accent); background: var(--accent); border-radius: 1.2mm; padding: .6mm 2mm; vertical-align: 2px; }
.chip { display: inline-block; font-size: 7.5pt; font-weight: 650; color: var(--dim); border: .25mm solid var(--line2); border-radius: 1.2mm; padding: .5mm 1.8mm; }
ul.dots { list-style: none; } ul.dots li { padding-left: 4.5mm; position: relative; margin-top: 1.4mm; }
ul.dots li::before { content: ""; position: absolute; left: 0; top: 2.2mm; width: 1.6mm; height: 1.6mm; border-radius: 50%; background: var(--line2); }
ul.dots.acc li::before { background: var(--accent); }
.steps { display: grid; gap: 4mm; } .step { display: grid; grid-template-columns: 8mm 1fr; gap: 3mm; align-items: start; }
.step > i { font-style: normal; width: 7mm; height: 7mm; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-weight: 750; font-size: 10pt; display: grid; place-items: center; }
.step b { display: block; font-size: 10.5pt; font-weight: 700; margin-bottom: .5mm; } .step p { color: var(--dim); font-size: 9.5pt; }
.week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1.8mm; }
.week > div { background: var(--accent); color: var(--on-accent); border-radius: 2.2mm; padding: 2.4mm 1.5mm; text-align: center; min-height: 15mm; display: flex; flex-direction: column; justify-content: center; }
.week > div.off { background: transparent; border: .25mm dashed var(--line2); color: var(--faint); }
.week i { display: block; font-style: normal; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; opacity: .85; }
.week b { display: block; font-size: 8.5pt; font-weight: 700; margin-top: .8mm; line-height: 1.15; }
.bars { display: grid; grid-template-columns: 23mm 1fr 7mm; gap: 1.8mm 3mm; align-items: center; font-size: 8.5pt; }
.bars i { height: 2.4mm; border-radius: 1.2mm; background: var(--s2); position: relative; overflow: hidden; }
.bars i b { position: absolute; inset: 0 auto 0 0; background: var(--accent); border-radius: 1.2mm; }
.bars em { font-style: normal; text-align: right; font-weight: 700; }
.qr { background: #fff; padding: 1.3mm; border-radius: 1.5mm; display: block; flex: none; }
.qr svg { display: block; width: 100%; height: 100%; }
.tierb { font-size: 6.5pt; font-weight: 700; border: .25mm solid var(--line2); border-radius: 1mm; padding: .1mm 1.1mm; color: var(--dim); }
.tierb.S { border-color: var(--accent); color: var(--accent-text); }
/* get the app block */
.app { display: grid; grid-template-columns: auto 1fr; gap: 7mm; align-items: center; }
.app .qbox { text-align: center; } .app .qbox .qr { width: var(--q, 40mm); height: var(--q, 40mm); padding: 2.2mm; border: .25mm solid var(--line); }
.app .qbox span { display: block; font-size: 7.5pt; color: var(--faint); margin-top: 1.8mm; font-weight: 600; }
.app h3 { font-size: 17pt; margin: 0; } .app .sub { color: var(--dim); font-size: 10pt; margin-top: 1mm; }
.app .inst { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-top: 4.5mm; padding-top: 4mm; border-top: .25mm solid var(--line); }
.app .inst b { display: block; font-size: 9.5pt; font-weight: 700; } .app .inst p { font-size: 8.5pt; color: var(--dim); line-height: 1.4; margin-top: .6mm; }
.app .url { font-size: 9pt; font-weight: 650; color: var(--accent-text); margin-top: 1.5mm; }
/* workout card */
.wk { background: var(--card); border: .25mm solid var(--line); border-radius: 3.5mm; padding: 4mm 4.5mm 1.5mm; break-inside: avoid; }
.wk + .wk { margin-top: 5mm; }
.wkh { display: flex; align-items: baseline; gap: 3mm; padding-bottom: 2.5mm; }
.wkh h3 { font-size: 14pt; margin: 0; } .wkh span { font-size: 8.5pt; color: var(--dim); } .wkh .sp { flex: 1; }
.thead, .ex { display: grid; grid-template-columns: 27mm 1fr 20mm 12mm 19mm 15mm; gap: 3mm; align-items: center; }
.thead { font-size: 6.8pt; color: var(--faint); text-transform: uppercase; letter-spacing: .06em; font-weight: 650; padding-bottom: 1.2mm; }
.ex { padding: 2mm 0; border-top: .25mm solid var(--line); }
.ex .ph { width: 27mm; height: 15.2mm; border-radius: 1.8mm; object-fit: cover; background: var(--s2); display: block; }
.ex .nm { font-size: 10pt; font-weight: 700; line-height: 1.2; display: block; }
.ex .meta { font-size: 7pt; color: var(--dim); margin-top: .6mm; }
.ex .cue { font-size: 7.5pt; color: var(--dim); margin-top: .7mm; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ex .sr { font-size: 12.5pt; font-weight: 800; letter-spacing: -.02em; white-space: nowrap; }
.ex .rs { font-size: 9pt; font-weight: 650; }
.ex .st { font-size: 8pt; line-height: 1.35; } .ex .st b { font-weight: 750; font-size: 9pt; } .ex .st small { display: block; font-size: 6.5pt; color: var(--faint); }
.ex .qr { width: 15mm; height: 15mm; padding: .9mm; border: .25mm solid var(--line); }
.wk.big { flex: 1; display: flex; flex-direction: column; padding: 5mm 5mm 2mm; }
.wk.big .wkh h3 { font-size: 17pt; } .wk.big .rows { flex: 1; display: flex; flex-direction: column; }
.wk.big .thead, .wk.big .ex { grid-template-columns: 34mm 1fr 22mm 13mm 19mm 19mm; gap: 3mm; }
.wk.big .ex { flex: 1; max-height: 34mm; } .wk.big .ex .ph { width: 34mm; height: 19.1mm; border-radius: 2.2mm; }
.wk.big .ex .nm { font-size: 12pt; } .wk.big .ex .meta { font-size: 8pt; } .wk.big .ex .cue { font-size: 8.5pt; -webkit-line-clamp: 2; }
.wk.big .ex .sr { font-size: 15pt; } .wk.big .ex .rs { font-size: 10pt; } .wk.big .ex .st { font-size: 9pt; } .wk.big .ex .st b { font-size: 10pt; }
.wk.big .ex .qr { width: 19mm; height: 19mm; padding: 1.1mm; } .wk.big .ex .sr { font-size: 14pt; }
/* tables */
table.t { width: 100%; border-collapse: collapse; font-size: 9pt; }
table.t th { text-align: left; font-size: 7pt; color: var(--faint); text-transform: uppercase; letter-spacing: .05em; font-weight: 650; padding: 0 2mm 1.5mm 0; }
table.t td { border-top: .25mm solid var(--line); padding: 1.8mm 2mm 1.8mm 0; vertical-align: top; line-height: 1.35; }
table.t td.n { font-weight: 650; } table.t td.c, table.t th.c { text-align: center; } table.t .hl { color: var(--accent-text); font-weight: 750; }
table.t tr.grp td { border-top: 0; padding-top: 3.5mm; font-size: 7.5pt; font-weight: 750; text-transform: uppercase; letter-spacing: .06em; color: var(--accent-text); }
table.t td.big { font-size: 10pt; font-weight: 700; }
.prog { width: 100%; border-collapse: separate; border-spacing: 1.2mm 0; table-layout: fixed; }
.prog td { text-align: center; padding: 1.6mm .5mm; font-size: 8.5pt; background: var(--s2); }
.prog tr:first-child td { border-radius: 1.5mm 1.5mm 0 0; font-weight: 750; padding-top: 2.2mm; } .prog tr:last-child td { border-radius: 0 0 1.5mm 1.5mm; color: var(--dim); padding-bottom: 2.2mm; }
.prog td.up { background: var(--accent); color: var(--on-accent) !important; }
.prog th { font-size: 6.8pt; color: var(--faint); font-weight: 650; text-transform: uppercase; letter-spacing: .04em; padding-bottom: 1mm; }
.swg { display: grid; grid-template-columns: 1fr 1fr; gap: 0 6mm; }
.swg > div { border-top: .25mm solid var(--line); padding: 2.2mm 0; font-size: 8.5pt; line-height: 1.45; break-inside: avoid; }
.swg b { font-weight: 700; } .swg .dim { font-size: 7.5pt; }
.ill { color: var(--accent); } .ill svg { width: 100%; height: 100%; display: block; }
/* phone shots */
.shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
.phone { border: 1.4mm solid var(--ink); border-radius: 6mm; overflow: hidden; background: var(--card); aspect-ratio: 390 / 844; width: 100%; }
.phone img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.shots .cap { display: grid; grid-template-columns: 6mm 1fr; gap: 2mm; margin-top: 3.5mm; }
.shots .cap i { font-style: normal; width: 5.5mm; height: 5.5mm; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-size: 8pt; font-weight: 750; display: grid; place-items: center; }
.shots .cap b { display: block; font-size: 10pt; font-weight: 700; } .shots .cap p { font-size: 8.5pt; color: var(--dim); line-height: 1.4; margin-top: .4mm; }
/* log */
.logt { width: 100%; border-collapse: collapse; table-layout: fixed; }
.logt th { font-size: 7pt; color: var(--faint); text-transform: uppercase; letter-spacing: .05em; font-weight: 650; text-align: left; padding: 0 1.5mm 1.5mm; }
.logt td { border: .25mm solid var(--line2); height: var(--rh, 7.2mm); font-size: 6.5pt; color: var(--faint); padding: 0 1.5mm; vertical-align: middle; }
.logt td.exn { border-left: 0; font-size: 8pt; color: var(--ink); font-weight: 650; line-height: 1.2; padding-left: 0; }
.logt td.exn span { display: block; font-weight: 500; color: var(--dim); font-size: 7pt; }
.logt tr.first td { border-top: .5mm solid var(--ink); } .logt td.sn { text-align: center; color: var(--dim); }
/* contents */
.toc a { display: grid; grid-template-columns: 9mm 1fr auto; gap: 3mm; align-items: baseline; padding: 2.4mm 0; border-top: .25mm solid var(--line); font-size: 10.5pt; }
.toc a i { font-style: normal; font-weight: 750; color: var(--accent-text); font-size: 9pt; } .toc a em { font-style: normal; color: var(--faint); font-size: 9pt; }
.toc a.sub { font-size: 9.5pt; color: var(--dim); padding: 1.5mm 0; } .toc a.sub i { color: var(--faint); }
/* cover */
.cover { padding: 0; }
.cover .band { background: var(--accent); color: var(--on-accent); padding: 16mm 16mm 14mm; }
.cover .band .brand img { background: #fff; padding: .8mm; }
.cover .band h1 { font-size: 50pt; margin-top: 22mm; } .cover .band .kick { font-size: 11pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .9; }
.cover .band p { font-size: 12.5pt; line-height: 1.45; margin-top: 4mm; max-width: 150mm; opacity: .95; }
.cover .band .pl { display: flex; flex-wrap: wrap; gap: 2mm; margin-top: 7mm; }
.cover .band .pl span { border: .3mm solid rgba(255,255,255,.6); border-radius: 1.5mm; padding: 1mm 2.5mm; font-size: 9pt; font-weight: 650; }
.cover .band .pl span.rec { background: #fff; color: var(--accent); border-color: #fff; }
.cover .body { padding: 10mm 16mm 16mm; flex: 1; display: flex; flex-direction: column; }
/* poster */
.poster { width: 297mm; height: 420mm; padding: 15mm 15mm 13mm; display: flex; flex-direction: column; break-after: page; background: var(--paper); overflow: hidden; }
.poster h1 { font-size: 54pt; } .poster .kicker { font-size: 12pt; }
.poster .week > div { min-height: 21mm; border-radius: 3mm; } .poster .week b { font-size: 12.5pt; } .poster .week i { font-size: 9.5pt; }
.pgrid { display: grid; gap: 6mm; flex: 1; min-height: 0; margin-top: 7mm; }
.pw { background: var(--card); border: .3mm solid var(--line); border-radius: 4.5mm; padding: 5mm 5mm 2mm; display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; }
.pw h2 { font-size: 21pt; margin: 0; } .pw .when { font-size: 10pt; color: var(--dim); margin: 1mm 0 2mm; }
.pw .rows { flex: 1; display: flex; flex-direction: column; }
.pex { flex: 1; display: grid; grid-template-columns: var(--pw) 1fr var(--pq); gap: 4mm; align-items: center; border-top: .3mm solid var(--line); padding: 1.5mm 0; min-height: 0; }
.pex .ph { width: var(--pw); height: calc(var(--pw) * .5625); border-radius: 2mm; object-fit: cover; display: block; background: var(--s2); }
.pex > div { min-width: 0; } .pex .nm { font-size: var(--pf); font-weight: 700; line-height: 1.12; display: block; }
.pex .meta { margin-top: 1mm; display: flex; flex-wrap: wrap; align-items: baseline; gap: .5mm 3mm; font-size: calc(var(--pf) * .72); color: var(--dim); }
.pex .meta span { white-space: nowrap; } .pex .sr { font-size: calc(var(--pf) * 1.15); font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
.pex .qr { width: var(--pq); height: var(--pq); padding: .8mm; border: .25mm solid var(--line); }
.pfoot { display: grid; grid-template-columns: auto 1fr 1fr; gap: 8mm; align-items: center; margin-top: 6mm; }
.pfoot .qr { width: 44mm; height: 44mm; padding: 2.5mm; border: .25mm solid var(--line); }
.pfoot h2 { font-size: 24pt; margin: 0; } .pfoot p { font-size: 12pt; }
.pfoot .tip { border-left: .3mm solid var(--line); padding-left: 7mm; }
.pfoot .tip b { display: block; font-size: 12pt; font-weight: 750; margin-bottom: 1mm; } .pfoot .tip p { font-size: 11pt; color: var(--dim); line-height: 1.4; }
.pfoot .tip p + b { margin-top: 3mm; }
.pex.stack { grid-template-columns: var(--pw) 1fr; grid-template-areas: "ph qr" "tx tx"; gap: 1.5mm 3mm; align-content: center; }
.pex.stack > img, .pex.stack > span.ph { grid-area: ph; } .pex.stack > div { grid-area: tx; } .pex.stack > a.qr { grid-area: qr; justify-self: end; align-self: end; }
.pex.stack .meta { margin-top: .5mm; }
.pcell { justify-content: center; gap: 2.5mm; } .pcell .qr { width: 46mm; height: 46mm; padding: 2.5mm; border: .25mm solid var(--line); margin-bottom: 2mm; }
.pcell p { font-size: 11.5pt; line-height: 1.4; } .pcell .tip { border-top: .3mm solid var(--line); padding-top: 4mm; margin-top: 2mm; }
.pcell .tip b { display: block; font-size: 12pt; font-weight: 750; } .pcell .tip p { color: var(--dim); margin: .5mm 0 3mm; }
</style>`;
}

/* shared helpers bound to one render */
function kit(c) {
  const t = T[c.lang] || T.en, L = (x) => (x && typeof x === "object" ? x[c.lang] ?? x.en : x ?? "");
  const exUrl = (slug) => `${c.site}#/ex/${slug}`;
  const img = (e, cls = "ph") => (e.poster ? `<img class="${cls}" src="file://${c.img(e.poster)}" alt="">` : `<span class="${cls}"></span>`);
  const ill = (n) => { const f = resolve(c.root, `app/illustrations/${n}.svg`); return existsSync(f) ? readFileSync(f, "utf8") : ""; };
  const ptx = (id) => c.text.plans.plans[id] || {};
  const planName = (p) => L(ptx(p.id).name) || p.name;
  const daysOf = (p, w) => t.dayNames.filter((_, i) => p.week[i] === w).join(", ");
  const weekStrip = (p) => `<div class="week">${p.week.map((w, i) => w == null ? `<div class="off"><i>${t.dayNames[i]}</i><b>${t.rest}</b></div>`
    : `<div><i>${t.dayNames[i]}</i><b>${esc(p.workouts[w].name)}</b></div>`).join("")}</div>`;
  const appBlock = (q = "40mm", url = true) => `<div class="app" style="--q:${q}"><div class="qbox"><a class="qr" href="${c.site}">${c.qr(c.site)}</a><span>${t.scanApp}</span></div>
    <div><h3>${t.getApp}</h3><p class="sub">${t.getAppLine}</p>${url ? `<p class="url">mohamedattiadev.github.io/gym</p>` : ""}
      <div class="inst">${t.inst.map(([h, p]) => `<div><b>${h}</b><p>${esc(p)}</p></div>`).join("")}</div></div></div>`;
  return { t, L, exUrl, img, ill, ptx, planName, daysOf, weekStrip, appBlock };
}

export function guideHTML(c) {
  const K = kit(c), { t, L, exUrl, img, ill, ptx, planName, daysOf, weekStrip, appBlock } = K;
  const D = c.data, plans = D.plans, rec = plans[0], lvName = t.levels[c.level];
  const fam = (e) => c.fam[e.family] || {};
  const pages = [], toc = [];
  let sec = 0;
  /* page(): body + a section label; toc entries are filled with page numbers after all pages exist */
  const page = (body, { id, title, tocTitle, sub, cls = "" } = {}) => {
    if (id && !sub) sec++;
    if (id) toc.push({ id, title: tocTitle || title, sub: !!sub, sec, n: pages.length + 3 });
    const head = title ? `<div class="top"><span class="no">${String(sec).padStart(2, "0")}</span><b>${esc(title)}</b><span class="sp"></span><span>${esc(lvName)} ${t.guide}</span></div>` : "";
    pages.push(`<section class="page ${cls}"${id ? ` id="${id}"` : ""}>${head}${body}<div class="foot"><span><b>Gym</b> · ${esc(lvName)} ${t.guide}</span><span>${t.page} %N%</span></div></section>`);
  };
  const pageOf = (id) => toc.find((x) => x.id === id)?.n ?? "";

  /* ---- level ---- */
  const S = c.text.std, lvIdx = { beginner: 0, intermediate: 1, advanced: 2 }[c.level];
  const e1Ex = { w: 60, r: 8 }, e1X = e1rm(e1Ex.w, e1Ex.r);
  page(`<h2>${t.secLevel}</h2><p class="lead">${esc(t.lvlDesc[c.level])} ${t.q3line}</p>
    <div class="grid3" style="margin-top:6mm">${["beginner", "intermediate", "advanced"].map((l) => `<div class="card ${l === c.level ? "tint" : ""}"><h3>${t.levels[l]} ${l === c.level ? `<span class="badge">${t.youAre}</span>` : ""}</h3><p class="dim small">${esc(t.lvlDesc[l])}</p></div>`).join("")}</div>
    <div class="card" style="margin-top:4mm"><h3>${t.q3}</h3>
      <table class="t" style="margin-top:2mm">${t.notSure.map(([q, a]) => `<tr><td class="n" style="width:62mm">${esc(q)}</td>${a.map((x) => `<td class="dim">${esc(x)}</td>`).join("")}</tr>`).join("")}
      <tr><td></td>${["beginner", "intermediate", "advanced"].map((l) => `<td class="hl tiny" style="text-transform:uppercase;letter-spacing:.05em">= ${t.levels[l]}</td>`).join("")}</tr></table></div>
    <div class="grid2" style="margin-top:4mm;grid-template-columns:1.35fr 1fr">
      <div class="card"><h3>${t.strTest}</h3><p class="dim small">${t.strLine}</p>
        <table class="t" style="margin-top:2.5mm"><tr><th>${t.lift}</th><th></th>${["beginner", "intermediate", "advanced"].map((l) => `<th class="c">${t.levels[l]}</th>`).join("")}</tr>
        ${S.lifts.filter((l) => l.id !== "row").map((l) => ["male", "female"].map((sx, k) => { const r = l.ratios[sx]; return `<tr>${k === 0 ? `<td class="n" rowspan="2">${esc(L(l.name))}</td>` : ""}<td class="dim tiny">${sx === "male" ? t.men : t.women}</td>
          <td class="c ${lvIdx === 0 ? "hl" : ""}">&lt; ${r[1]}×</td><td class="c ${lvIdx === 1 ? "hl" : ""}">${r[1]}–${r[2]}×</td><td class="c ${lvIdx === 2 ? "hl" : ""}">${r[2]}×+</td></tr>`; }).join("")).join("")}</table></div>
      <div class="card"><h3>${t.e1How}</h3><div class="steps" style="gap:2.5mm;margin-top:2mm">${t.e1Steps.map((s, i) => `<div class="step"><i>${i + 1}</i><p style="color:var(--ink)">${esc(s)}</p></div>`).join("")}</div>
        <table class="t" style="margin-top:3mm"><tr><th>${t.repsW}</th>${[3, 5, 6, 8, 10].map((r) => `<th class="c">${r}</th>`).join("")}</tr>
          <tr><td class="dim">${t.factor}</td>${[3, 5, 6, 8, 10].map((r) => `<td class="c n">${(e1rm(100, r) / 100).toFixed(2)}</td>`).join("")}</tr></table>
        <p class="dim tiny" style="margin-top:2.5mm">${t.e1Ex(e1Ex.w, e1Ex.r, e1X, REF.male)}</p></div></div>`, { id: "level", title: t.secLevel });

  /* ---- choose ---- */
  page(`<h2>${t.secChoose}</h2><p class="lead">${t.chooseLine}</p>
    <div class="grid2" style="margin-top:6mm;gap:4mm">${plans.map((p, i) => `<a class="card ${i === 0 ? "tint" : ""}" href="#plan-${p.id}" style="display:block;padding:4.5mm">
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="chip">${t.dshort(p.days)} · ${t.min(Math.max(...p.workouts.map((w) => w.min)))}</span>${i === 0 ? `<span class="badge">${t.recommended}</span>` : ""}</div>
      <h3 style="font-size:14pt;margin:2.5mm 0 1mm">${esc(planName(p))}</h3>
      <p class="dim small">${esc(L(ptx(p.id).line))}</p>
      <p class="small" style="margin-top:1.5mm"><b style="font-weight:650">${t.perMuscle(p.freq)}</b> <span class="faint">· ${p.workouts.length} ${t.workouts} · ${t.see("%P:plan-" + p.id + "%")}</span></p>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1mm;margin-top:2.5mm">${p.week.map((w) => `<i style="height:2mm;border-radius:1mm;background:${w == null ? "var(--s2)" : "var(--accent)"}"></i>`).join("")}</div></a>`).join("")}</div>`,
  { id: "choose", title: t.secChoose });

  /* ---- plans ---- */
  const startCell = (e) => {
    const m = startKg(e, REF.male, "male", c.level), w = startKg(e, REF.female, "female", c.level);
    if (m == null) return `<div class="st faint">—</div>`;
    if (m === 0) return `<div class="st"><b>${t.bw}</b></div>`;
    return `<div class="st"><b>M ${kgS(m)} kg</b><br>W ${kgS(w)} kg${perHand(e) ? `<small>${t.each}</small>` : ""}</div>`;
  };
  const wkCard = (p, w, wi) => {
    const total = w.items.reduce((a, x) => a + +x.sets, 0);
    return `<div class="wk big"><div class="wkh"><h3>${esc(w.name)}</h3><span>${daysOf(p, wi)}</span><span class="sp"></span><span>${w.items.length} ${t.exercises} · ${total} ${t.sets} · ${t.min(w.min)}</span></div>
      <div class="thead"><span>${t.exercise}</span><span></span><span>${t.setsReps}</span><span>${t.restCol}</span><span>${t.start}</span><span>${t.video}</span></div>
      <div class="rows">${w.items.map((e) => `<div class="ex">${img(e)}
        <div><a class="nm" href="${exUrl(e.slug)}">${esc(e.name)}</a><div class="meta">${esc(e.group)} · ${esc(e.equipment.join(", "))} ${e.tier ? `<span class="tierb ${e.tier}">${e.tier}</span>` : ""}</div>
          ${fam(e).cues?.[0] ? `<div class="cue">${esc(fam(e).cues[0])}</div>` : ""}</div>
        <div class="sr">${e.sets} × ${reps(e.reps)}</div><div class="rs">${fmtRest(e.rest || 90)}</div>${startCell(e)}
        <a href="${exUrl(e.slug)}" class="qr">${c.qr(exUrl(e.slug))}</a></div>`).join("")}</div></div>`;
  };
  plans.forEach((p, pi) => {
    const tx = ptx(p.id), sets = Object.entries(p.sets).sort((a, b) => b[1] - a[1]), maxS = Math.max(...sets.map(([, n]) => n), 10);
    const name = planName(p), ttl = `${t.secPlan} ${pi + 1} · ${name}`;
    page(`<div class="kicker">${t.secPlan} ${pi + 1} / ${plans.length} · ${t.days(p.days)} ${pi === 0 ? `<span class="badge" style="margin-left:2mm">${t.recommended}</span>` : ""}</div>
      <h2>${esc(name)}</h2><p class="lead">${esc(L(tx.what))}</p>
      <div style="margin-top:5mm">${weekStrip(p)}</div>
      <div class="grid2" style="margin-top:5mm">
        <div class="card"><h3>${t.who}</h3><p class="dim small">${esc(L(tx.who))}</p><h3 style="margin-top:3mm">${t.why}</h3><p class="dim small">${esc(L(tx.why))}</p></div>
        <div class="card"><h3>${t.weeklySets}</h3><div class="bars">${sets.map(([m, n]) => `<span>${esc(m)}</span><i><b style="width:${Math.round((n / maxS) * 100)}%"></b></i><em>${n}</em>`).join("")}</div>
          <p class="dim tiny" style="margin-top:2.5mm">${esc(L(tx.setsPerMuscle))}</p></div>
        <div class="card"><h3>${t.pros}</h3><ul class="dots acc">${(tx.pros || []).map((x) => `<li class="small">${esc(L(x))}</li>`).join("")}</ul></div>
        <div class="card"><h3>${t.cons}</h3><ul class="dots">${(tx.cons || []).map((x) => `<li class="small">${esc(L(x))}</li>`).join("")}</ul></div>
      </div>
      ${tx.best ? `<div class="card tint" style="margin-top:4mm"><p class="small"><b>${t.best}:</b> ${esc(L(tx.best))}</p></div>` : ""}
      <div class="card" style="margin-top:4mm"><h3>${t.tips}</h3><ul class="dots">${(tx.tips || []).map((x) => `<li class="small">${esc(L(x))}</li>`).join("")}</ul></div>`,
    { id: `plan-${p.id}`, title: ttl, tocTitle: `${name} · ${t.dshort(p.days)}${pi === 0 ? ` · ${t.recommended}` : ""}` });
    /* one workout per page, rows grow to fill it */
    p.workouts.forEach((w, wi) => page(`${wkCard(p, w, wi)}<p class="faint tiny" style="padding-top:3mm">${t.startNote(REF.male, REF.female, "%P:start%")}</p>`, { title: ttl }));
  });

  /* ---- starting weights ---- */
  const seen = new Map();
  plans.forEach((p) => p.workouts.forEach((w) => w.items.forEach((e) => { if (!seen.has(e.slug)) seen.set(e.slug, e); })));
  const ORDER = ["Chest", "Shoulders", "Lats", "Upper Back", "Traps", "Biceps", "Triceps", "Forearms", "Quads", "Hamstrings", "Glutes", "Calves", "Abs"];
  const exs = [...seen.values()].sort((a, b) => (ORDER.indexOf(a.group) - ORDER.indexOf(b.group)) || a.name.localeCompare(b.name));
  const rowsOf = (list) => { let g = ""; return list.map((e) => {
    const head = e.group !== g ? `<tr class="grp"><td colspan="8">${esc((g = e.group))}</td></tr>` : "";
    const cells = [...BODY.male.map((b) => startKg(e, b, "male", c.level)), ...BODY.female.map((b) => startKg(e, b, "female", c.level))];
    return head + `<tr><td class="n">${esc(e.name)}<span class="faint" style="font-weight:400"> · ${esc(e.equipment[0] || "")}${perHand(e) ? ` (${t.each})` : ""}</span></td>
      ${cells.map((k, i) => `<td class="c ${i === 1 || i === 4 ? "big" : ""}">${k == null ? "—" : k === 0 ? "BW" : kgS(k)}</td>`).join("")}</tr>`; }).join(""); };
  const thead = `<tr><th>${t.exercise}</th>${BODY.male.map((b) => `<th class="c">${t.man} ${b}</th>`).join("")}${BODY.female.map((b) => `<th class="c">${t.woman} ${b}</th>`).join("")}</tr>`;
  const ex0 = rec.workouts[0].items.find((e) => startKg(e, REF.male, "male", c.level) > 0) || rec.workouts[0].items[0];
  const [lo0, hi0] = String(ex0.reps).split("-").map(Number);
  /* chunk by table height: a row = 1, a new muscle group adds its header row */
  const chunks = [[]]; let room = 11, g0 = "";
  for (const e of exs) { const cost = 1 + (e.group !== g0 ? 1.1 : 0); if (cost > room) { chunks.push([]); room = 29; g0 = ""; } const c2 = 1 + (e.group !== g0 ? 1.1 : 0); chunks.at(-1).push(e); room -= c2; g0 = e.group; }
  page(`<h2>${t.secStart}</h2><p class="lead">${t.startLead}</p>
    <div class="grid3" style="margin-top:5mm">${t.startSteps.map(([h, p], i) => `<div class="card"><div class="step"><i>${i + 1}</i><div><b>${h}</b><p>${esc(p)}</p></div></div></div>`).join("")}</div>
    <div class="grid2" style="margin-top:4mm;grid-template-columns:1.4fr 1fr">
      <div class="card tint"><h3>${t.startEx}</h3><p class="small">${esc(t.startExText(ex0.name, startKg(ex0, REF.male, "male", c.level), lo0, hi0 || lo0 + 2))}</p></div>
      <div class="card"><h3>${t.knowE1}</h3><p class="dim tiny">${t.knowE1Line}</p>
        <table class="t" style="margin-top:1.5mm"><tr><th>${t.repsW}</th>${[6, 8, 10, 12, 15].map((r) => `<th class="c">${r}</th>`).join("")}</tr><tr><td class="dim">${t.pct}</td>${[6, 8, 10, 12, 15].map((r) => `<td class="c n">${pctFor(r)}%</td>`).join("")}</tr></table></div></div>
    <table class="t" style="margin-top:5mm">${thead}${rowsOf(chunks[0])}</table>
    <p class="faint tiny" style="margin-top:auto;padding-top:3mm">${t.dbNote} ${t.estimate}</p>`, { id: "start", title: t.secStart });
  chunks.slice(1).forEach((ch) => page(`<table class="t">${thead}${rowsOf(ch)}</table><p class="faint tiny" style="margin-top:auto;padding-top:3mm">${t.dbNote}</p>`, { title: t.secStart }));

  /* ---- progress ---- */
  const it = ex0, [lo, hi] = String(it.reps).split("-").map(Number), top = hi || lo + 2, s0 = startKg(it, REF.male, "male", c.level) || 20, st = stepOf(it);
  const wk = [[s0, lo, it.sets], [s0, top, it.sets], [s0 + st, lo, it.sets], [Math.round(s0 * 0.6 / st) * st, lo, Math.max(1, it.sets - 1)]], mx = Math.max(...wk.map(([a, r, s]) => a * r * s));
  page(`<h2>${t.secProg}</h2><p class="lead">${t.progLead}</p>
    <div class="grid3" style="margin-top:5mm">${t.progSteps.map(([h, p], i) => `<div class="card"><div class="step"><i>${i + 1}</i><div><b>${h}</b><p>${esc(p)}</p></div></div></div>`).join("")}</div>
    <div class="card" style="margin-top:4mm"><h3>${t.next4} · ${esc(it.name)}</h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6mm;align-items:end;height:44mm;margin-top:3mm">
        ${wk.map(([a, r, s], n) => `<div style="display:flex;flex-direction:column;justify-content:flex-end;height:100%">
          <div style="height:${Math.round((a * r * s / mx) * 28)}mm;background:${n === 3 ? "var(--s2)" : "var(--accent)"};border-radius:1.5mm"></div>
          <b style="font-size:11pt;margin-top:2mm">${kgS(a)} kg × ${r}</b><span class="dim tiny">${n + 1}. ${t.wk4[n]} · ${s} ${t.sets}</span></div>`).join("")}</div></div>
    <div class="card" style="margin-top:4mm"><ul class="dots acc">${c.text.plans.progression.points.map((x) => `<li class="small">${esc(L(x))}</li>`).join("")}</ul></div>
    <h3 style="margin-top:6mm">${t.whatIf}</h3>
    <div class="grid3" style="grid-template-columns:repeat(5,1fr);gap:3mm">${t.ifs.map(([h, p]) => `<div class="card" style="padding:3.5mm"><b class="small" style="display:block;font-weight:700">${h}</b><p class="dim tiny" style="margin-top:1mm;line-height:1.4">${esc(p)}</p></div>`).join("")}</div>`,
  { id: "prog", title: t.secProg });
  /* examples: first loaded exercise of up to 4 workouts of the recommended plan */
  const exPicks = []; for (const w of rec.workouts) { const e = w.items.find((x) => startKg(x, REF.male, "male", c.level) > 0 && !exPicks.some((y) => y.slug === x.slug)); if (e) exPicks.push(e); if (exPicks.length === 4) break; }
  for (const w of rec.workouts) for (const e of w.items) if (exPicks.length < 4 && startKg(e, REF.male, "male", c.level) > 0 && !exPicks.some((y) => y.slug === e.slug)) exPicks.push(e);
  page(`<h2>${t.examples}</h2><p class="lead">${t.exLine(REF.male)}</p>
    ${exPicks.map((e) => { const pr = progression(startKg(e, REF.male, "male", c.level), e.sets, e.reps, stepOf(e), 8);
      return `<div class="card" style="margin-top:4.5mm"><div style="display:flex;align-items:center;gap:4mm;margin-bottom:3mm">${img(e).replace('class="ph"', 'style="width:24mm;height:13.5mm;border-radius:1.5mm;object-fit:cover;display:block"')}
        <div><h3 style="margin:0">${esc(e.name)}</h3><p class="dim tiny">${e.sets} × ${reps(e.reps)} · ${perHand(e) ? t.each + " · " : ""}+${kgS(stepOf(e))} kg</p></div></div>
        <table class="prog"><tr>${pr.map((_, i) => `<th>${t.wkN(i + 1)}</th>`).join("")}</tr>
        <tr>${pr.map((x) => `<td class="${x.up ? "up" : ""}">${kgS(x.w)} kg</td>`).join("")}</tr>
        <tr>${pr.map((x) => `<td class="${x.up ? "up" : ""}">${x.reps.join(" · ")}</td>`).join("")}</tr></table></div>`; }).join("")}`, { title: t.secProg });

  /* ---- warm-up ---- */
  const W = c.text.warm, dr = (id) => W.drills[id];
  const drillList = (ids) => ids.filter(dr).map((id) => `<li class="small"><b style="font-weight:650">${esc(L(dr(id).name))}</b> <span class="dim">· ${esc(L(dr(id).cue || dr(id).how))}</span></li>`).join("");
  page(`<h2>${t.secWarm}</h2><p class="lead">${esc(L(W.intro))}</p>
    <div class="grid2" style="margin-top:5mm">
      <div class="card"><h3>1 · ${t.warmGeneral}</h3><p class="dim small">${esc(L(W.general.note))}</p><ul class="dots" style="margin-top:2mm">${drillList((W.general.cardio || []).slice(0, 3).concat((W.general.mobility?.full || []).slice(0, 4)))}</ul></div>
      <div class="card"><h3>2 · ${t.ramp}</h3><p class="dim small">${esc(L(W.ramp.note))}</p><ul class="dots acc" style="margin-top:2mm">${W.ramp.rules.map((x) => `<li class="small">${esc(L(x))}</li>`).join("")}</ul></div></div>
    <div style="display:grid;grid-template-columns:1fr 55mm;gap:4mm;margin-top:4mm">
      <div class="card"><h3>3 · ${t.cool}</h3><p class="dim small">${esc(L(W.cooldown.note))}</p><ul class="dots" style="margin-top:2mm">${drillList(W.cooldown.drills)}</ul></div>
      <div class="ill" style="padding:3mm">${ill("warmup")}</div></div>`, { id: "warm", title: t.secWarm });

  /* ---- swaps + pain (recommended plan) ---- */
  const J = c.text.joints;
  page(`<h2>${t.secSwap}</h2><p class="lead">${t.swapsLine}</p>
    <div class="swg" style="margin-top:4mm">${rec.workouts.flatMap((w) => w.items).map((e) => `<div><b>${esc(e.name)}</b> <span class="dim">${esc(e.equipment.join(", "))}</span><div style="font-size:8pt">${e.swaps.map((x) => `<a href="${exUrl(x.slug)}">${esc(x.name)}</a> <span class="dim">${esc(x.equipment[0] || "")}</span>`).join(" · ")}</div></div>`).join("")}</div>
    <h3 style="margin-top:6mm">${t.pain}</h3>
    <div class="grid3" style="gap:3mm">${Object.values(J).map((j) => `<div class="card" style="padding:3.5mm"><b class="small" style="font-weight:700">${esc(L(j.name))}</b>
      <ul class="dots">${(j.tips?.[c.lang] || j.tips?.en || []).slice(0, 2).map((x) => `<li class="tiny">${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>`, { id: "swap", title: t.secSwap });

  /* ---- nutrition ---- */
  const N = c.text.nutri, bmr = Math.round(10 * 75 + 6.25 * 178 - 5 * 25 + 5), tdee = Math.round(bmr * 1.55 / 10) * 10, gain = Math.round(tdee * 1.1 / 10) * 10;
  page(`<h2>${t.secNutri}</h2>
    <div class="card" style="margin-top:2mm"><h3>${t.nutriCalc}</h3>
      <p class="small"><b>${t.f1}</b></p><p class="small dim">${t.fMen}<br>${t.fWomen}</p>
      <p class="small" style="margin-top:2.5mm"><b>${t.f2}</b></p>
      <table class="t" style="margin-top:1mm">${N.activity.map((a) => `<tr><td class="n" style="width:16mm">× ${a.f}</td><td><b style="font-weight:650">${esc(L(a.name))}</b> <span class="dim">${esc(L(a.desc))}</span></td></tr>`).join("")}</table>
      <p class="small" style="margin-top:2.5mm"><b>${t.f3}</b></p>
      <table class="t" style="margin-top:1mm">${N.goals.map((g) => `<tr><td class="n" style="width:16mm">${g.kcalPct > 0 ? "+" : g.kcalPct < 0 ? "−" : "±"}${Math.abs(Math.round(g.kcalPct * 100))}%</td><td><b style="font-weight:650">${esc(L(g.name))}</b> <span class="dim">${esc(L(g.desc))} ${esc(L(g.rate))}</span></td></tr>`).join("")}</table></div>
    <div class="card tint" style="margin-top:4mm"><h3>${t.nEx}</h3><ul class="dots acc">${t.nExText(bmr, tdee, gain, Math.round(75 * N.protein.gPerKg[0]), Math.round(75 * N.protein.gPerKg[1])).map((x) => `<li class="small">${esc(x)}</li>`).join("")}</ul></div>
    <div class="grid2" style="margin-top:4mm"><div class="card"><h3>${t.protein}</h3><p class="dim small">${esc(L(N.protein.note))}</p></div>
      <div class="card"><h3>${t.fat}</h3><p class="dim small">${esc(L(N.fat.note))}</p></div></div>
    <p class="faint tiny" style="margin-top:auto">${esc(L(N.disclaimer))}</p>`, { id: "nutri", title: t.secNutri });

  /* ---- app guide ---- */
  const sfx = c.theme === "dark" ? "-d" : "";
  const shot = (n) => { const f = resolve(c.root, `tools/guide/shots/${n}${sfx}.jpg`); return `<div class="phone">${existsSync(f) ? `<img src="file://${f}" alt="">` : ""}</div>`; };
  let stepNo = 0;
  t.appPages.forEach(([h, items], i) => page(`${i === 0 ? `<h2>${t.secApp}</h2><p class="lead">${t.appLead}</p><div class="card" style="margin:5mm 0 6mm">${appBlock("34mm")}</div>` : `<h2>${h}</h2><div style="height:4mm"></div>`}
    ${i === 0 ? `<h3 style="font-size:14pt;margin-bottom:4mm">${h}</h3>` : ""}
    <div class="shots" style="${i === 0 ? "width:80%;margin:0 auto;gap:5mm" : ""}">${items.map(([n, b, p]) => `<div>${shot(n)}<div class="cap"><i>${++stepNo}</i><div><b>${b}</b><p>${esc(p)}</p></div></div></div>`).join("")}</div>
    ${i === t.appPages.length - 1 ? `<div class="card tint" style="margin-top:auto"><h3>${t.appLast}</h3><p class="small">${t.appLastLine}</p></div>` : ""}`,
  i === 0 ? { id: "app", title: t.secApp } : { title: t.secApp }));

  /* ---- log sheets (recommended plan + one blank) ---- */
  const logPage = (w, title, line) => {
    const rows = w ? w.items.reduce((a, x) => a + +x.sets, 0) : 24, rowH = Math.min(11, Math.max(6.5, 205 / (rows + 2)));
    const items = w ? w.items : Array.from({ length: 8 }, () => ({ name: "", sets: 3, reps: "" }));
    return `<h2>${esc(title)}</h2><p class="dim small" style="margin-bottom:4mm">${line}</p>
      <table class="logt" style="--rh:${rowH}mm"><colgroup><col style="width:40mm"><col style="width:6mm">${"<col>".repeat(6)}</colgroup>
      <tr><th style="padding-left:0">${t.exercise}</th><th></th>${[1, 2, 3, 4, 5, 6].map((n) => `<th>${t.weekN(n)}</th>`).join("")}</tr>
      <tr><td class="exn" style="font-weight:500;color:var(--dim)">${t.date}</td><td class="sn"></td>${"<td></td>".repeat(6)}</tr>
      ${items.map((e) => Array.from({ length: +e.sets }, (_, s) => `<tr class="${s === 0 ? "first" : ""}">${s === 0 ? `<td class="exn" rowspan="${e.sets}">${esc(e.name)}${e.reps ? `<span>${e.sets} × ${reps(e.reps)}</span>` : ""}</td>` : ""}<td class="sn">${s + 1}</td>${"<td>kg ×</td>".repeat(6)}</tr>`).join("")).join("")}</table>`;
  };
  rec.workouts.forEach((w, i) => page(logPage(w, `${planName(rec)} · ${w.name}`, t.logLine), i === 0 ? { id: "log", title: t.secLog } : { title: t.secLog }));
  page(logPage(null, t.blank, t.blankLine), { title: t.secLog });

  /* ---- sources ---- */
  page(`<h2>${t.secSrc}</h2>
    <ul class="dots" style="margin-top:3mm">${c.text.plans.sources.concat(c.text.warm.sources.map((s) => ({ title: s.name, url: s.url }))).map((s) => `<li class="small"><a href="${esc(s.url)}"><b style="font-weight:650">${esc(s.title)}</b></a></li>`).join("")}</ul>
    <div class="ill" style="width:80mm;height:70mm;margin:12mm auto 0">${ill("plan")}</div>
    <div class="card" style="margin-top:auto">${appBlock("34mm")}</div>
    <p class="faint tiny" style="margin-top:3mm;text-align:center">${t.made}</p>`, { id: "src", title: t.secSrc });

  /* ---- cover + contents (built last, they need page numbers) ---- */
  const cover = `<section class="page cover"><div class="band">
      <div class="brand"><img src="file://${resolve(c.root, "app/icons/icon.svg")}" alt="">Gym</div>
      <h1>${esc(lvName)}<br>${t.guide}</h1><div class="kick" style="margin-top:4mm">${t.plansIn(plans.length)} · ${t.daysRange(Math.min(...plans.map((p) => p.days)), Math.max(...plans.map((p) => p.days)))}</div>
      <p>${esc(t.lvlDesc[c.level])} ${esc(L(ptx(rec.id).best) || "")}</p>
      <div class="pl">${plans.map((p, i) => `<span class="${i === 0 ? "rec" : ""}">${esc(planName(p))} · ${p.days}d</span>`).join("")}</div></div>
    <div class="body"><div class="ill" style="width:78mm;height:68mm;margin:2mm auto 0">${ill("hero-start")}</div>
      <div class="card" style="margin-top:auto">${appBlock("40mm")}</div></div></section>`;
  const use = t.use.map(([h, p]) => [h, p.replace("{level}", "%P:level%").replace("{choose}", "%P:choose%").replace("{start}", "%P:start%").replace("{prog}", "%P:prog%")]);
  const contents = `<section class="page"><div class="top"><span class="no">00</span><b>${t.contents}</b><span class="sp"></span><span>${esc(lvName)} ${t.guide}</span></div>
    <div class="grid2" style="grid-template-columns:1fr 1fr;gap:10mm">
      <div><h2>${t.contents}</h2><div class="toc" style="margin-top:3mm">${toc.map((x) => `<a href="#${x.id}" class="${x.sub || x.id.startsWith("plan-") ? "sub" : ""}"><i>${x.id.startsWith("plan-") ? "" : String(x.sec).padStart(2, "0")}</i><span>${esc(x.title)}</span><em>${x.n}</em></a>`).join("")}</div></div>
      <div><h2>${t.howToUse}</h2><div class="steps" style="margin-top:5mm;gap:5mm">${use.map(([h, p], i) => `<div class="step"><i>${i + 1}</i><div><b>${h}</b><p>${esc(p)}</p></div></div>`).join("")}</div>
        <div class="card tint" style="margin-top:7mm"><p class="small">${t.scanEx}</p></div></div></div>
    <div class="foot"><span><b>Gym</b> · ${esc(lvName)} ${t.guide}</span><span>${t.page} 2</span></div></section>`;
  let html = [cover, contents, ...pages.map((p, i) => p.replace("%N%", i + 3))].join("");
  html = html.replace(/%P:([\w-]+)%/g, (_, id) => pageOf(id));
  return `<!doctype html><html lang="${c.lang}" dir="${c.lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>Gym · ${esc(lvName)} ${t.guide}</title>${css(c.root, "guide", c.theme)}</head><body>${html}</body></html>`;
}

export function posterHTML(c) {
  const { t, L, exUrl, img, ptx, planName, daysOf, weekStrip } = kit(c);
  const lvName = t.levels[c.level];
  const one = (p, pi) => {
    const n = p.workouts.length, cols = n <= 3 ? n : n === 4 ? 2 : 3, rowsN = Math.ceil(n / cols);
    const maxItems = Math.max(...p.workouts.map((w) => w.items.length));
    /* row height available per exercise -> photo / font / QR size */
    const inCell = n % cols !== 0 && rowsN > 1; /* empty grid cell -> the app + tips card goes there, no footer */
    const gridH = 262 + (inCell ? 62 : 0) - (rowsN - 1) * 6, rowH = (gridH / rowsN - 31) / maxItems;
    const colW = (267 - (cols - 1) * 6) / cols - 10;
    const pq = Math.max(11, Math.min(18, rowH - 3.5, colW * 0.18)); let pw = Math.min(colW * 0.32, (rowH - 3.5) / 0.5625, 44);
    let textW = colW - pw - pq - 8, pf = Math.max(9.5, Math.min(15, rowH * 0.55, textW / 2.4));
    /* tall narrow cells (3 workouts in one row): photo + QR on top, text below */
    const stack = cols === 3 && rowsN === 1 && rowH >= 32;
    if (stack) { pw = Math.min(colW - pq - 4, (rowH - 15) / 0.5625); pf = 12; }
    return `<section class="poster">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><div class="kicker">${esc(lvName)} · ${t.days(p.days)} ${pi === 0 ? `<span class="badge" style="font-size:10pt;margin-left:2mm">${t.recommended}</span>` : ""}</div><h1>${esc(planName(p))}</h1></div>
      <div class="brand" style="font-size:20pt"><img src="file://${resolve(c.root, "app/icons/icon.svg")}" alt="" style="width:12mm;height:12mm">Gym</div></div>
    <div style="margin-top:6mm">${weekStrip(p)}</div>
    <div class="pgrid" style="grid-template-columns:repeat(${cols},minmax(0,1fr));grid-template-rows:repeat(${rowsN},minmax(0,1fr));--pw:${pw.toFixed(1)}mm;--pq:${pq.toFixed(1)}mm;--pf:${pf.toFixed(1)}pt">
      ${p.workouts.map((w, wi) => `<div class="pw"><h2>${esc(w.name)}</h2><div class="when">${daysOf(p, wi)} · ${t.min(w.min)}</div>
        <div class="rows">${w.items.map((e) => `<div class="pex${stack ? " stack" : ""}">${img(e)}<div><a class="nm" href="${exUrl(e.slug)}">${esc(e.name)}</a><div class="meta"><span class="sr">${e.sets} × ${reps(e.reps)}</span><span>${t.restCol} ${fmtRest(e.rest || 90)}</span></div></div>
          <a href="${exUrl(e.slug)}" class="qr">${c.qr(exUrl(e.slug))}</a></div>`).join("")}</div></div>`).join("")}
      ${inCell ? `<div class="pw pcell"><a href="${c.site}" class="qr">${c.qr(c.site)}</a><h2>${t.getApp}</h2><p class="dim">${t.getAppLine}</p><p style="font-weight:650">${t.scanEx}</p>
        <div class="tip"><b>${t.secProg}</b><p>${t.progShort}</p><b>${t.secStart}</b><p>${t.startLight}</p></div></div>` : ""}
    </div>
    ${inCell ? "" : `<div class="pfoot card" style="padding:6mm">
      <a href="${c.site}" class="qr">${c.qr(c.site)}</a>
      <div><h2>${t.getApp}</h2><p class="dim" style="margin-top:1.5mm">${t.getAppLine}</p><p style="margin-top:3mm;font-weight:650">${t.scanEx}</p></div>
      <div class="tip"><b>${t.secProg}</b><p>${t.progShort}</p><b>${t.secStart}</b><p>${t.startLight}</p></div>
    </div>`}</section>`;
  };
  return `<!doctype html><html lang="${c.lang}" dir="${c.lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>Gym · ${esc(lvName)} posters</title>${css(c.root, "poster", c.theme)}</head><body>${c.data.plans.map(one).join("")}</body></html>`;
}
