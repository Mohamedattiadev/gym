// Training math: e1RM, plates, warm-up ramps, double progression.
import { S } from "./store.js";

/** Estimated 1RM: mean of Epley & Brzycki, only trustworthy up to ~12 reps. */
export function e1rm(w, r) {
  w = +w; r = +r;
  if (!w || !r) return 0;
  if (r === 1) return w;
  const rr = Math.min(r, 12);
  return Math.round(((w * (1 + rr / 30)) + (w * 36 / (37 - rr))) / 2 * 10) / 10;
}

export const roundTo = (x, step) => Math.round(x / step) * step;
export const smallestPlate = () => Math.min(...S.settings.plates) * 2;

/** Plates per side for a barbell target. Greedy with the configured inventory. */
export function platesFor(total) {
  const bar = S.settings.bar;
  let side = (total - bar) / 2;
  const out = [];
  if (side <= 0) return { bar, out, rest: 0 };
  for (const p of [...S.settings.plates].sort((a, b) => b - a)) {
    while (side >= p - 1e-9) { out.push(p); side -= p; }
  }
  return { bar, out, rest: Math.round(side * 2 * 100) / 100 };
}
const PLATE_COL = { 25: "#e5383b", 20: "#3a86ff", 15: "#ffbe0b", 10: "#38b000", 5: "#f1f1f1", 2.5: "#e5383b", 1.25: "#bdbdbd", 45: "#3a86ff", 35: "#ffbe0b" };
export const plateColor = (p) => PLATE_COL[p] || "#9aa0a6";
export const plateHeight = (p) => Math.max(40, Math.min(120, 30 + p * 3.6));

/** Jeff-style ramp-up sets for the first exercise of a muscle. */
export function warmupSets(work, ex) {
  work = +work;
  if (!work) return [];
  const bar = ex.equipment.includes("Barbell") || ex.equipment.includes("Smith");
  const step = bar ? smallestPlate() : 1;
  const heavy = ex.type === "compound" && work >= 60;
  const scheme = heavy ? [[.4, 8], [.6, 5], [.75, 3], [.85, 1]] : [[.5, 8], [.75, 4]];
  const out = [];
  if (bar && heavy) out.push({ w: S.settings.bar, r: 10 });
  for (const [p, r] of scheme) {
    const w = Math.max(bar ? S.settings.bar : 0, roundTo(work * p, step));
    if (!out.some((s) => s.w === w) && w < work) out.push({ w, r });
  }
  return out;
}

/** Double progression suggestion from the last working sets. */
export function suggest(ex, lastSets) {
  const work = (lastSets || []).filter((s) => s.done && s.type !== "w" && +s.r);
  if (!work.length) return null;
  const [lo, hi] = ex.repRange || [8, 12];
  const top = work.reduce((a, s) => (+s.w > +a.w ? s : a), work[0]);
  const inc = ex.equipment.includes("Barbell") || ex.equipment.includes("Smith") || ex.equipment.includes("Machine") ? 2.5 : (+top.w >= 20 ? 2 : 1);
  if (work.every((s) => +s.r >= hi)) return { w: Math.round((+top.w + inc) * 100) / 100, r: lo, up: true, why: `Hit ${hi} reps on all sets` };
  const minR = Math.min(...work.map((s) => +s.r));
  return { w: +top.w, r: Math.min(hi, minR + 1), up: false, why: `Aim for +1 rep (range ${lo}-${hi})` };
}
