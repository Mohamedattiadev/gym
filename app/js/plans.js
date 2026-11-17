// Plans 2.0 (block 26): split definitions (slot-based, filled from S/A canonical exercises), recommendation rules,
// best-fit picker, session-length and focus options. Texts (what / who / pros / cons …) live in data/guide/plans.json.
import { S } from "./store.js";
import { EX, byTier, hasEquip, hurts, LEVEL_N } from "./data.js";
import { uid } from "./ui.js";

const SLOT = (group, pattern, sets, reps) => ({ group, pattern, sets, reps });
const W = {
  fbA: ["Full Body A", [SLOT("Quads", "squat", 3, "6-10"), SLOT("Chest", "h-push", 3, "8-12"), SLOT("Lats", "v-pull", 3, "8-12"), SLOT("Hamstrings", "curl", 2, "10-12"), SLOT("Shoulders", "raise", 2, "12-15"), SLOT("Abs", "core", 2, "10-15")]],
  fbB: ["Full Body B", [SLOT("Hamstrings", "hinge", 3, "8-10"), SLOT("Shoulders", "v-push", 3, "8-12"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Chest", "h-push", 2, "8-12"), SLOT("Quads", "lunge", 2, "10-12"), SLOT("Biceps", "curl", 2, "10-15"), SLOT("Triceps", "ext", 2, "10-15")]],
  fb2A: ["Full Body A", [SLOT("Quads", "squat", 3, "6-10"), SLOT("Chest", "h-push", 3, "8-12"), SLOT("Lats", "v-pull", 3, "8-12"), SLOT("Hamstrings", "curl", 2, "10-12"), SLOT("Shoulders", "raise", 2, "12-15"), SLOT("Biceps", "curl", 2, "10-15")]],
  fb2B: ["Full Body B", [SLOT("Hamstrings", "hinge", 3, "8-10"), SLOT("Shoulders", "v-push", 3, "8-12"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Quads", "lunge", 2, "10-12"), SLOT("Chest", "fly", 2, "10-15"), SLOT("Triceps", "ext", 2, "10-15")]],
  upA: ["Upper A", [SLOT("Chest", "h-push", 3, "6-10"), SLOT("Lats", "v-pull", 3, "8-12"), SLOT("Shoulders", "v-push", 2, "8-12"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Shoulders", "raise", 3, "12-15"), SLOT("Biceps", "curl", 2, "10-12"), SLOT("Triceps", "ext", 2, "10-12")]],
  loA: ["Lower A", [SLOT("Quads", "squat", 3, "6-10"), SLOT("Hamstrings", "hinge", 3, "8-10"), SLOT("Quads", "ext", 2, "10-15"), SLOT("Hamstrings", "curl", 3, "10-12"), SLOT("Calves", "calf", 3, "10-15"), SLOT("Abs", "core", 3, "10-15")]],
  upB: ["Upper B", [SLOT("Chest", "h-push", 3, "8-12"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Lats", "v-pull", 3, "10-12"), SLOT("Chest", "fly", 2, "10-15"), SLOT("Shoulders", "fly", 3, "12-15"), SLOT("Triceps", "ext", 2, "10-15"), SLOT("Biceps", "curl", 2, "10-15")]],
  loB: ["Lower B", [SLOT("Quads", "lunge", 3, "8-12"), SLOT("Glutes", "hinge", 3, "8-12"), SLOT("Hamstrings", "curl", 3, "10-12"), SLOT("Glutes", "raise", 2, "12-20"), SLOT("Calves", "calf", 3, "10-15"), SLOT("Abs", "core", 2, "10-15")]],
  full: ["Full Body", [SLOT("Quads", "lunge", 3, "8-12"), SLOT("Chest", "h-push", 3, "8-12"), SLOT("Lats", "h-pull", 3, "10-12"), SLOT("Hamstrings", "curl", 2, "10-12"), SLOT("Shoulders", "raise", 2, "12-15"), SLOT("Abs", "core", 2, "10-15")]],
  push: ["Push", [SLOT("Chest", "h-push", 3, "6-10"), SLOT("Chest", "h-push", 3, "8-12"), SLOT("Shoulders", "v-push", 3, "8-12"), SLOT("Chest", "fly", 3, "10-15"), SLOT("Shoulders", "raise", 4, "12-20"), SLOT("Triceps", "ext", 3, "10-15")]],
  pull: ["Pull", [SLOT("Lats", "v-pull", 3, "6-10"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Lats", "h-pull", 3, "10-12"), SLOT("Shoulders", "fly", 3, "12-20"), SLOT("Biceps", "curl", 3, "8-12"), SLOT("Biceps", "curl", 2, "12-15")]],
  legs: ["Legs", [SLOT("Quads", "squat", 4, "6-10"), SLOT("Hamstrings", "hinge", 3, "8-10"), SLOT("Quads", "lunge", 3, "8-12"), SLOT("Hamstrings", "curl", 3, "10-15"), SLOT("Quads", "ext", 3, "12-15"), SLOT("Calves", "calf", 4, "10-15")]],
  torA: ["Torso A", [SLOT("Chest", "h-push", 3, "6-10"), SLOT("Lats", "v-pull", 3, "8-12"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Shoulders", "v-push", 2, "8-12"), SLOT("Chest", "fly", 2, "10-15"), SLOT("Abs", "core", 2, "10-15")]],
  limA: ["Limbs A", [SLOT("Quads", "squat", 3, "6-10"), SLOT("Hamstrings", "curl", 3, "10-12"), SLOT("Shoulders", "raise", 3, "12-15"), SLOT("Biceps", "curl", 3, "8-12"), SLOT("Triceps", "ext", 3, "10-12"), SLOT("Calves", "calf", 3, "10-15")]],
  torB: ["Torso B", [SLOT("Chest", "h-push", 3, "8-12"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Lats", "v-pull", 3, "10-12"), SLOT("Shoulders", "fly", 3, "12-15"), SLOT("Chest", "fly", 2, "12-15"), SLOT("Abs", "core", 2, "10-15")]],
  limB: ["Limbs B", [SLOT("Hamstrings", "hinge", 3, "8-10"), SLOT("Quads", "lunge", 3, "8-12"), SLOT("Shoulders", "raise", 3, "12-20"), SLOT("Biceps", "curl", 2, "10-15"), SLOT("Triceps", "ext", 2, "10-15"), SLOT("Calves", "calf", 3, "10-15")]],
  chBk: ["Chest + Back", [SLOT("Chest", "h-push", 3, "6-10"), SLOT("Lats", "v-pull", 3, "8-12"), SLOT("Chest", "h-push", 3, "8-12"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Chest", "fly", 2, "10-15"), SLOT("Lats", "h-pull", 2, "10-12")]],
  shAr: ["Shoulders + Arms", [SLOT("Shoulders", "v-push", 3, "8-12"), SLOT("Shoulders", "raise", 4, "12-20"), SLOT("Shoulders", "fly", 2, "12-20"), SLOT("Biceps", "curl", 3, "8-12"), SLOT("Triceps", "ext", 3, "10-12"), SLOT("Biceps", "curl", 2, "12-15"), SLOT("Triceps", "ext", 2, "12-15")]],
  chest: ["Chest", [SLOT("Chest", "h-push", 4, "6-10"), SLOT("Chest", "h-push", 3, "8-12"), SLOT("Chest", "fly", 3, "10-15"), SLOT("Chest", "fly", 2, "12-15"), SLOT("Abs", "core", 3, "10-15")]],
  back: ["Back", [SLOT("Lats", "v-pull", 4, "6-10"), SLOT("Upper Back", "h-pull", 3, "8-12"), SLOT("Lats", "h-pull", 3, "10-12"), SLOT("Lats", "fly", 2, "12-15"), SLOT("Traps", "raise", 3, "10-15")]],
  delts: ["Shoulders", [SLOT("Shoulders", "v-push", 4, "8-12"), SLOT("Shoulders", "raise", 4, "12-20"), SLOT("Shoulders", "fly", 3, "12-20"), SLOT("Shoulders", "raise", 3, "15-20")]],
  arms: ["Arms", [SLOT("Biceps", "curl", 3, "8-12"), SLOT("Triceps", "ext", 3, "8-12"), SLOT("Biceps", "curl", 3, "10-15"), SLOT("Triceps", "ext", 3, "10-15"), SLOT("Forearms", "curl", 2, "12-15")]],
};
/* week: 7 entries Mon..Sun, each an index into workouts or null (rest) */
const P = (id, name, level, levels, days, kind, ws, week) => ({ id, name, level, levels, days, kind, workouts: ws.map((k) => W[k]), week });
export const PLANS = [
  P("fb2", "Full Body", "beginner", ["beginner", "intermediate", "advanced"], 2, "fb", ["fb2A", "fb2B"], [0, null, null, 1, null, null, null]),
  P("beg-fb", "Full Body", "beginner", ["beginner", "intermediate"], 3, "fb", ["fbA", "fbB"], [0, null, 1, null, 0, null, null]),
  P("ulf3", "Upper / Lower / Full", "intermediate", ["beginner", "intermediate"], 3, "ul", ["upA", "loA", "full"], [0, null, 1, null, 2, null, null]),
  P("ppl3", "Push / Pull / Legs", "intermediate", ["intermediate"], 3, "ppl", ["push", "pull", "legs"], [0, null, 1, null, 2, null, null]),
  P("int-ul", "Upper / Lower", "intermediate", ["beginner", "intermediate", "advanced"], 4, "ul", ["upA", "loA", "upB", "loB"], [0, 1, null, 2, 3, null, null]),
  P("tl4", "Torso / Limbs", "intermediate", ["intermediate", "advanced"], 4, "ul", ["torA", "limA", "torB", "limB"], [0, 1, null, 2, 3, null, null]),
  P("pplul5", "PPL + Upper / Lower", "advanced", ["intermediate", "advanced"], 5, "ppl", ["push", "pull", "legs", "upA", "loA"], [0, 1, 2, null, 3, 4, null]),
  P("bro5", "Bro split", "intermediate", ["intermediate", "advanced"], 5, "bro", ["chest", "back", "delts", "legs", "arms"], [0, 1, 2, 3, 4, null, null]),
  P("adv-ppl", "Push / Pull / Legs", "advanced", ["advanced"], 6, "ppl", ["push", "pull", "legs"], [0, 1, 2, 0, 1, 2, null]),
  P("arnold6", "Arnold split", "advanced", ["advanced"], 6, "ppl", ["chBk", "shAr", "legs"], [0, 1, 2, 0, 1, 2, null]),
];
export const planById = (id) => PLANS.find((p) => p.id === id);

/* Recommended (owner rules, Jeff Nippard: each muscle ~2x/week, enough weekly sets, sustainable) */
const LEVEL_REC = { beginner: "beg-fb", intermediate: "int-ul", advanced: "pplul5" };
export const BEST_FOR_DAYS = { 2: ["fb2"], 3: ["beg-fb", "ulf3"], 4: ["int-ul"], 5: ["pplul5"], 6: ["adv-ppl"] };
export function recommendedId(level = S.profile?.level || "beginner", days = S.profile?.days) {
  if (level === "advanced" && days >= 6) return "adv-ppl";
  return LEVEL_REC[level] || "beg-fb";
}
/** 2–3 best-fit plans for the answers, best first: [{ p, why: "recommended" | "days" | "fits" | "fewer" }] */
export function pickPlans({ level = "beginner", days = 3 } = {}) {
  const rec = recommendedId(level, days), best = BEST_FOR_DAYS[Math.min(6, Math.max(2, days))] || [];
  const score = (p) => {
    if (p.days > days) return -1;
    let s = (p.levels.includes(level) ? 3 : 0) + (p.days === days ? 3 : 2 - (days - p.days)) + (best.includes(p.id) ? 3 : 0);
    if (p.id === rec) s += 4;
    if (p.kind === "bro") s -= level === "beginner" ? 6 : 3; // once a week per muscle: never the first pick
    return s;
  };
  return PLANS.map((p) => ({ p, s: score(p) })).filter((x) => x.s > 1).sort((a, b) => b.s - a.s).slice(0, 3)
    .map(({ p }) => ({ p, why: p.id === rec ? "recommended" : best.includes(p.id) ? "days" : p.days === days ? "fits" : "fewer" }));
}

/* weekly hard sets per muscle (Lats + Upper Back = Back, Glutes count with Hamstrings only when no Glutes slot) */
export const MAIN = ["Chest", "Back", "Shoulders", "Quads", "Hamstrings", "Biceps", "Triceps"];
const muscleOf = (g) => (g === "Lats" || g === "Upper Back" ? "Back" : g);
export function weeklySets(p, ws = p.workouts.map(([, s]) => s)) {
  const out = {};
  const add = (m, n) => (out[m] = (out[m] || 0) + n);
  p.week.forEach((i) => { if (i != null) for (const s of ws[i] || []) {
    add(muscleOf(s.group), +s.sets);
    /* indirect work, half a set (Jeff Nippard's fractional counting): presses -> triceps, rows / pulldowns -> biceps */
    if (/^(h|v)-push$/.test(s.pattern) && s.group !== "Triceps") add("Triceps", s.sets / 2);
    if (/^(h|v)-pull$/.test(s.pattern) && s.group !== "Traps") add("Biceps", s.sets / 2);
  } });
  for (const k in out) out[k] = Math.round(out[k]);
  return out;
}
export const timesPerWeek = (p, m) => p.week.filter((i) => i != null && p.workouts[i][1].some((s) => muscleOf(s.group) === m)).length;
/** minutes for a list of slots: ~2.5 min per working set (incl. rest) + warm-up */
export const minutesOf = (slots) => Math.round((slots.reduce((a, s) => a + +s.sets, 0) * 2.5 + 8) / 5) * 5;

/* session length: 60 = as written; 45 trims isolation sets then the last slots; 75 adds a set to the first lifts */
const CAP = { 45: 15, 60: 99, 75: 24 };
export function fitTime(slots, min = 60) {
  let out = slots.map((s) => ({ ...s }));
  const total = () => out.reduce((a, s) => a + +s.sets, 0);
  if (min === 45) {
    for (let i = out.length - 1; i >= 2 && total() > CAP[45]; i--) if (out[i].sets > 2) out[i].sets--;
    while (total() > CAP[45] && out.length > 4) out.pop();
  } else if (min === 75) {
    for (let i = 0; i < out.length && total() < CAP[75]; i++) if (out[i].sets < 4) out[i].sets++;
  }
  return out;
}
/* focus add-ons: +4–6 sets a week for one area, added to two workouts */
export const FOCUS = {
  arms: { name: "Arms", groups: ["Biceps", "Triceps"], slots: [SLOT("Biceps", "curl", 2, "10-15"), SLOT("Triceps", "ext", 2, "10-15")] },
  shoulders: { name: "Shoulders", groups: ["Shoulders"], slots: [SLOT("Shoulders", "raise", 3, "12-20")] },
  chest: { name: "Chest", groups: ["Chest"], slots: [SLOT("Chest", "fly", 3, "10-15")] },
  back: { name: "Back", groups: ["Lats", "Upper Back"], slots: [SLOT("Lats", "v-pull", 3, "10-12")] },
  glutes: { name: "Glutes", groups: ["Glutes", "Hamstrings", "Quads"], slots: [SLOT("Glutes", "hinge", 3, "8-12")] },
};
export function planSlots(p, { min = 60, focus = "" } = {}) {
  const ws = p.workouts.map(([, s]) => fitTime(s, min));
  const F = FOCUS[focus];
  if (F) {
    const has = ws.map((s, i) => [i, s.some((x) => F.groups.includes(x.group))]);
    const pick = [...has.filter(([, h]) => h), ...has.filter(([, h]) => !h)].slice(0, 2).map(([i]) => i);
    for (const i of pick) ws[i] = [...ws[i], ...F.slots.map((s) => ({ ...s }))];
  }
  return ws;
}

function fillSlot(slot, used, level) {
  const lv = LEVEL_N[level] || 2;
  const ok = (e) => e.video && hasEquip(e) && !hurts(e) && !used.has(e.slug);
  const pool = EX.filter((e) => ok(e) && e.group === slot.group && e.pattern === slot.pattern && (LEVEL_N[e.level] || 1) <= Math.max(lv, 2));
  const best = pool.filter((e) => e.canonical).sort(byTier)[0] || pool.sort(byTier)[0] || EX.filter((e) => ok(e) && e.group === slot.group).sort(byTier)[0];
  if (best) used.add(best.slug);
  return best;
}
export function buildPlan(p, opt = planOpts()) {
  const used = new Set(), ws = planSlots(p, opt);
  return p.workouts.map(([name], i) => ({ id: uid(), name, plan: p.id, updatedAt: Date.now(),
    items: ws[i].map((s) => [s, fillSlot(s, used, p.level)]).filter(([, e]) => e).map(([s, e]) => ({ slug: e.slug, sets: s.sets, reps: s.reps })) }));
}
export const planOpts = () => ({ min: +S.settings.planMin || 60, focus: S.settings.planFocus || "" });
let TXT;
/** plans.json texts (what / who / line / pros / cons …), cached */
export const loadPlanText = () => TXT || (TXT = fetch("data/guide/plans.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
/** how often the main muscles are hit per week (lowest of the big groups) */
export const freqOf = (p) => Math.min(...["Chest", "Quads", "Back", "Hamstrings", "Shoulders"].map((g) => timesPerWeek(p, g)));
