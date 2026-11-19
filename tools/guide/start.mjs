// Starting-weight estimates, level test and progression examples for the printable guide.
// Estimates = a first-session guess for the working sets (2–3 reps left), as a fraction of bodyweight for a beginner man,
// scaled for women and for more experienced lifters. They are a starting point only: the guide tells the reader to adjust.
const F = {
  "Quads:squat": { Barbell: 0.5, Smith: 0.5, Machine: 0.55, Dumbbell: 0.12, Kettlebell: 0.2, Bodyweight: 0 },
  "Quads:lunge": { Barbell: 0.3, Smith: 0.3, Machine: 0.4, Dumbbell: 0.1, Kettlebell: 0.15, Bodyweight: 0 },
  "Quads:ext": { Machine: 0.35, Cable: 0.15, Bodyweight: 0 },
  "Hamstrings:hinge": { Barbell: 0.6, Smith: 0.5, Machine: 0.5, Dumbbell: 0.2, Cable: 0.3, Bodyweight: 0 },
  "Glutes:hinge": { Barbell: 0.6, Smith: 0.5, Machine: 0.5, Dumbbell: 0.2, Cable: 0.3, Bodyweight: 0 },
  "Hamstrings:curl": { Machine: 0.3, Cable: 0.15, Dumbbell: 0.1, Bodyweight: 0 },
  "Glutes:raise": { Barbell: 0.6, Machine: 0.4, Cable: 0.1, Dumbbell: 0.15, Bodyweight: 0 },
  "Chest:h-push": { Barbell: 0.45, Smith: 0.45, Machine: 0.45, Dumbbell: 0.15, Cable: 0.15, Bodyweight: 0 },
  "Chest:fly": { Dumbbell: 0.07, Cable: 0.07, Machine: 0.3, Bodyweight: 0 },
  "Shoulders:v-push": { Barbell: 0.3, Smith: 0.3, Machine: 0.3, Dumbbell: 0.1, Cable: 0.1, Bodyweight: 0 },
  "Shoulders:raise": { Dumbbell: 0.05, Cable: 0.03, Machine: 0.15, Bodyweight: 0 },
  "Shoulders:fly": { Dumbbell: 0.04, Cable: 0.04, Machine: 0.2, Bodyweight: 0 },
  "Lats:v-pull": { Cable: 0.5, Machine: 0.5, Bodyweight: 0 },
  "Lats:h-pull": { Cable: 0.45, Machine: 0.45, Dumbbell: 0.2, Barbell: 0.4, Smith: 0.4, Bodyweight: 0 },
  "Upper Back:h-pull": { Cable: 0.45, Machine: 0.45, Dumbbell: 0.2, Barbell: 0.4, Smith: 0.4, Bodyweight: 0 },
  "Lats:fly": { Cable: 0.15, Dumbbell: 0.1, Machine: 0.3 },
  "Traps:raise": { Dumbbell: 0.25, Barbell: 0.6, Smith: 0.6, Machine: 0.5, Cable: 0.3 },
  "Biceps:curl": { Dumbbell: 0.08, Cable: 0.15, Barbell: 0.25, Machine: 0.2, Bodyweight: 0 },
  "Triceps:ext": { Cable: 0.2, Dumbbell: 0.07, Barbell: 0.2, Machine: 0.25, Bodyweight: 0 },
  "Forearms:curl": { Dumbbell: 0.07, Barbell: 0.2, Cable: 0.1 },
  "Calves:calf": { Machine: 0.7, Smith: 0.6, Barbell: 0.5, Dumbbell: 0.15, Bodyweight: 0 },
  "Abs:core": { Cable: 0.3, Machine: 0.3, Dumbbell: 0.1, Bodyweight: 0 },
};
const LOWER = new Set(["Quads", "Hamstrings", "Glutes", "Calves"]);
const LEVEL_X = { beginner: 1, intermediate: 1.5, advanced: 2 };
export const BODY = { male: [60, 75, 90], female: [50, 60, 75] }, REF = { male: 75, female: 60 };

const kind = (eq) => (eq === "Smith" ? "Barbell" : eq);
/** step and minimum load per equipment; dumbbells are per hand */
export function stepOf(e) {
  const eq = e.equipment?.[0] || "Machine";
  if (eq === "Barbell" || eq === "Smith") return 2.5;
  if (eq === "Dumbbell" || eq === "Kettlebell") return 2;
  return 5;
}
/** first-session working weight in kg (0 = bodyweight), or null when unknown */
export function startKg(e, bw, sex = "male", level = "beginner") {
  const eq = e.equipment?.[0] || "Machine", key = `${e.group}:${e.slotPattern || e.pattern}`;
  let f = F[key]?.[eq] ?? F[key]?.[kind(eq)];
  if (f == null) f = { Barbell: 0.3, Smith: 0.3, Machine: 0.3, Cable: 0.15, Dumbbell: 0.08, Bodyweight: 0 }[eq];
  if (f == null) return null;
  if (f === 0) return 0;
  if (/leg-press/.test(e.family || "")) f = 1.1;
  const sx = sex === "female" ? (LOWER.has(e.group) ? 0.7 : 0.55) : 1;
  const raw = bw * f * sx * (LEVEL_X[level] || 1), step = stepOf(e);
  const min = eq === "Barbell" ? (/Biceps|Triceps|Forearms/.test(e.group) ? 10 : 20) : step;
  return Math.max(min, Math.round(raw / step) * step);
}
export const fmtKg = (kg, e) => (kg == null ? "—" : kg === 0 ? "BW" : `${+kg.toFixed(2)}${/Dumbbell|Kettlebell/.test(e.equipment?.[0]) ? "" : ""}`);
export const perHand = (e) => /Dumbbell|Kettlebell/.test(e.equipment?.[0] || "");

/** the app's own e1RM (calc.js: mean of Epley and Brzycki, reps capped at 12) */
export function e1rm(w, r) { if (r === 1) return w; const rr = Math.min(r, 12); return Math.round(((w * (1 + rr / 30)) + (w * 36 / (37 - rr))) / 2 * 10) / 10; }
/** % of e1RM to use for N reps with 2 reps left (RIR 2) */
export const pctFor = (reps) => Math.round(100 / (1 + (reps + 2) / 30)); /* Epley, not capped: the app caps e1RM at 12 reps */

/** double progression, one session a week shown: add reps to the weakest sets, all at the top -> add one step */
export function progression(start, sets, range, step, weeks = 8) {
  const [lo, hi] = String(range).split("-").map(Number), top = hi || lo + 2;
  let w = start, reps = Array(+sets).fill(lo);
  const out = [];
  for (let k = 0; k < weeks; k++) {
    out.push({ w, reps: reps.slice(), up: false });
    if (reps.every((r) => r >= top)) { w = +(w + step).toFixed(2); reps = Array(+sets).fill(lo); out[out.length - 1].up = true; continue; }
    /* +1 rep on the two lowest sets (the last set lags, like real training) */
    const order = reps.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, Math.min(2, reps.length));
    for (const [, i] of order) reps[i] = Math.min(top, reps[i] + 1);
  }
  return out;
}
