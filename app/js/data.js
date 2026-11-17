// Exercise library + derived lookups over user history.
import { S } from "./store.js";
import { e1rm } from "./calc.js";

export let EX = [];
export const BY = {};
export let GROUPS = [];
export let EQUIP = [];
export const GROUP_ORDER = ["Chest", "Upper Back", "Lats", "Shoulders", "Traps", "Biceps", "Triceps", "Forearms",
  "Abs", "Quads", "Hamstrings", "Glutes", "Calves", "Lower Back", "Shins", "Groin"];
export const TIER_RANK = { S: 0, A: 1, B: 2, C: 3 };
export const LEVEL_N = { beginner: 1, intermediate: 2, advanced: 3 };

/** Search normalization: case, Latin diacritics (Turkish ı/İ/ş/ğ…), Arabic tashkeel + letter variants. */
export function norm(t) {
  return String(t || "").toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}]+/gu, " ");
}
const GROUP_I18N = { Chest: "göğüs gogus صدر", "Upper Back": "üst sırt sirt ظهر علوي", Lats: "kanat lat sırt ظهر مجنص", Shoulders: "omuz كتف أكتاف", Traps: "trapez ترابيس",
  Biceps: "pazu biseps باي", Triceps: "arka kol triseps تراي", Forearms: "ön kol bilek ساعد", Abs: "karın karin بطن", Quads: "ön bacak quadriceps فخذ أمامي",
  Hamstrings: "arka bacak hamstring فخذ خلفي", Glutes: "kalça kalca popo مؤخرة أرداف", Calves: "baldır kalf سمانة", "Lower Back": "bel أسفل الظهر", Shins: "kaval قصبة", Groin: "iç bacak adduktor ضامة" };
const EQUIP_I18N = { Dumbbell: "dambıl dumbel دمبل", Barbell: "halter bar بار", Cable: "kablo كابل", Machine: "makine جهاز", Bodyweight: "vücut ağırlığı وزن الجسم", Smith: "smith سميث", Band: "lastik bant مطاط", Kettlebell: "kettlebell كيتل" };

export let FAM = { families: {}, notes: {} };
export async function loadExercises() {
  const lang = S.settings.lang || "en";
  const get = async (u, d) => { try { const r = await fetch(u); return r.ok ? await r.json() : d; } catch { return d; } };
  let fig;
  [EX, FAM, fig, JOINTS] = await Promise.all([fetch("data/exercises.json").then((r) => r.json()), get(`data/families.${lang}.json`, null).then((x) => x || get("data/families.en.json", { families: {}, notes: {} })),
    get("data/figures.json", { f: {}, s: {} }), get("data/guide/joints.json", { joints: {} }).then((j) => j.joints || {})]);
  for (const e of EX) {
    e.video = e.v ? `media/video/${e.slug}.mp4` : null; e.poster = `media/poster/${e.slug}.jpg`;
    const oef = fig.s[e.slug] || fig.f[e.family]; e.figure = oef ? `media/figures/${oef}.webp` : null;
    const f = FAM.families[e.family] || {}; e.steps = f.steps || []; e.cues = f.cues || []; e.mistakes = (f.mistakes || []).map((m) => (typeof m === "string" ? { text: m } : m)); e.about = f.about || "";
    e.vnote = e.note ? FAM.notes[e.slug] || "" : "";
    e.muscles = [...(e.primary || []), ...(e.secondary || [])]; e.aliases = [e.aliases, e.tr, e.ar].filter(Boolean).join(" ");
    e.tier ??= null; e.tierNote ??= ""; e.canonical = !!e.canonical;
    BY[e.slug] = e;
    e._q = norm([e.name, e.aliases, e.group, GROUP_I18N[e.group], e.region, e.machine, e.machine && "makine machine جهاز", ...e.muscles, ...e.equipment, ...e.equipment.map((q) => EQUIP_I18N[q])].join(" "));
  }
  const gs = new Set(EX.map((e) => e.group));
  GROUPS = GROUP_ORDER.filter((g) => gs.has(g));
  const counts = {};
  EX.forEach((e) => e.equipment.forEach((q) => (counts[q] = (counts[q] || 0) + 1)));
  EQUIP = Object.keys(counts).filter((q) => counts[q] >= 4).sort((a, b) => counts[b] - counts[a]);
}

/* ---- equipment profile ---- */
export const EQUIP_PROFILES = {
  gym: { name: "Full gym", has: null },
  dumbbells: { name: "Dumbbells only", has: ["Dumbbell", "Bodyweight", "Band", "Ball", "Plate"] },
  home: { name: "Home (bodyweight + bands)", has: ["Bodyweight", "Band"] },
};
/** True when the exercise can be done with the user's equipment profile. */
export function hasEquip(e, profile = S.settings.equip || "gym") {
  const has = EQUIP_PROFILES[profile]?.has; if (!has) return true;
  if (!e.equipment.length) return false;
  if (e.machine && !["TRX"].includes(e.machine)) return false;
  return e.equipment.every((q) => has.includes(q));
}

export const byTier = (a, b) => (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9) || (b.canonical - a.canonical) || a.name.length - b.name.length;

/** Same muscle region & pattern, same-or-better tier. Pain-flagged exercises never show up. */
export function swaps(ex, n = 6) {
  return EX.filter((x) => x.slug !== ex.slug && x.group === ex.group && (x.pattern === ex.pattern || x.region === ex.region) && x.video && hasEquip(x) && !hurts(x))
    .sort(byTier).slice(0, n);
}

/* ---- pain / joint flags (S.pain = {slug: [joint ids]}) ---- */
export let JOINTS = {};
export const JOINT_IDS = ["shoulder", "knee", "elbow", "lower-back", "wrist", "hip"];
const rx = {}; const re = (s) => (s ? (rx[s] ??= (() => { try { return new RegExp(s, "i"); } catch { return null; } })()) : null);
/** Joints the user flagged as hurting, across all exercises. */
export const flaggedJoints = () => [...new Set(Object.values(S.pain || {}).flat())];
/** Exercise looks risky for that joint (by pattern or name). */
export function avoidFor(e, j) { const a = JOINTS[j]?.avoid; if (!a) return false; return (a.patterns || []).includes(e.pattern) || !!re(a.nameRegex)?.test(e.name); }
/** True if the user flagged this exercise, or it is risky for a joint the user flagged. */
export function hurts(e) {
  if (!S.pain) return false;
  if (S.pain[e.slug]?.length) return true;
  return flaggedJoints().some((j) => avoidFor(e, j));
}
/** Joint-friendly alternatives: same muscle, not risky for the joints, joint-friendly variants first, then tier. */
export function jointFriendly(ex, joints, n = 6) {
  const pref = (x) => joints.some((j) => { const p = JOINTS[j]?.prefer; return p && (re(p.nameRegex)?.test(x.name) || (p.equipment || []).some((q) => x.equipment.includes(q)) || (x.machine && (p.equipment || []).includes("Machine"))); });
  return EX.filter((x) => x.slug !== ex.slug && x.group === ex.group && x.video && hasEquip(x) && !hurts(x) && !joints.some((j) => avoidFor(x, j)))
    .sort((a, b) => pref(b) - pref(a) || byTier(a, b)).slice(0, n);
}

/* ---- dates & period stats ---- */
export const DAY = 864e5, WEEK = 7 * DAY;
export function weekStart(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
const workSets = (en) => en.sets.filter((x) => x.done !== false && x.type !== "w" && (+x.w || +x.r));
/** Totals for sessions finished in [from, to). */
export function periodStats(from, to) {
  let workouts = 0, sets = 0, reps = 0, kg = 0;
  for (const s of S.sessions) {
    if (!(s.endedAt >= from && s.endedAt < to)) continue; workouts++;
    for (const en of s.entries) for (const x of workSets(en)) { sets++; reps += +x.r || 0; kg += (+x.w || 0) * (+x.r || 0); }
  }
  return { workouts, sets, reps, kg: Math.round(kg) };
}
/** Per exercise in [from, to): {slug: {sets, reps, kg, best:{w,r}}} */
export function exerciseStats(from, to) {
  const out = {};
  for (const s of S.sessions) {
    if (!(s.endedAt >= from && s.endedAt < to)) continue;
    for (const en of s.entries) { const o = (out[en.slug] ??= { sets: 0, reps: 0, kg: 0, best: null, e1: 0 });
      for (const x of workSets(en)) { o.sets++; o.reps += +x.r || 0; o.kg += (+x.w || 0) * (+x.r || 0); const v = e1rm(x.w, x.r); if (v > o.e1) { o.e1 = v; o.best = { w: +x.w, r: +x.r }; } } }
  }
  return out;
}

/* ---- recovery: per muscle hours left (48–72h window by size & sets) ---- */
const REC_BASE = { quads: 72, hamstrings: 72, glutes: 72, lats: 66, "upper-back": 66, chest: 66, "lower-back": 72, traps: 54, "delt-front": 54, "delt-side": 54, "delt-rear": 54,
  triceps: 54, biceps: 54, adductors: 60, calves: 48, forearms: 48, abs: 48, obliques: 48, shins: 48 };
export function recovery(now = Date.now()) {
  const load = {}; // muscle → {t: last time, sets}
  for (const s of S.sessions) {
    if (!(s.endedAt > now - 4 * DAY)) continue;
    for (const en of s.entries) { const e = BY[en.slug]; if (!e) continue; const n = workSets(en).length; if (!n) continue;
      const add = (m, k) => { const o = (load[m] ??= { t: 0, sets: 0 }); o.t = Math.max(o.t, s.endedAt); o.sets += n * k; };
      (e.primary || []).forEach((m) => add(m, 1)); (e.secondary || []).forEach((m) => add(m, .5)); }
  }
  const out = {};
  for (const [m, o] of Object.entries(load)) {
    const base = REC_BASE[m] || 60, win = Math.min(72, Math.max(48, base * (.8 + .2 * Math.min(o.sets, 10) / 10)));
    const el = (now - o.t) / 36e5, left = Math.max(0, Math.round(win - el));
    out[m] = { left, state: el < 24 ? "r" : left > 0 ? "y" : "g" };
  }
  return out;
}

/** All finished working sets for an exercise, oldest first. */
export function history(slug) {
  const out = [];
  for (const s of S.sessions) {
    const en = s.entries.find((x) => x.slug === slug);
    if (en) out.push({ date: s.endedAt || s.startedAt, sets: en.sets.filter((x) => x.done && x.type !== "w" && (+x.w || +x.r)) });
  }
  return out.filter((h) => h.sets.length);
}
export function lastSets(slug) { const h = history(slug); return h.length ? h[h.length - 1] : null; }
export function bestOf(slug) {
  let best = null;
  for (const h of history(slug)) for (const s of h.sets) {
    const v = e1rm(s.w, s.r);
    if (v && (!best || v > best.e1rm)) best = { e1rm: v, w: +s.w, r: +s.r, date: h.date };
  }
  return best;
}
export const setsText = (sets, unit = S.settings.unit) =>
  sets.map((s) => (+s.w ? `${+s.w}${unit}×${s.r || 0}` : `${s.r || 0} reps`)).join(" · ");

/** Weekly working sets per muscle (primary muscles 1 set, secondary 0.5) between [from, to). */
export function weeklyVolume(days = 7, to = Date.now()) {
  const since = to - days * 864e5, vol = {};
  for (const s of S.sessions) {
    const t = s.endedAt || 0; if (t < since || t >= to) continue;
    for (const en of s.entries) {
      const e = BY[en.slug]; if (!e) continue;
      const n = en.sets.filter((x) => x.done && x.type !== "w").length; if (!n) continue;
      const prim = e.primary?.length ? e.primary : [e.region === "chest-upper" ? "chest" : e.region];
      for (const m of prim) vol[m] = (vol[m] || 0) + n;
      for (const m of e.secondary || []) vol[m] = (vol[m] || 0) + n * .5;
    }
  }
  return vol;
}
/** Main muscles that got < min hard sets in the last 7 days (only once the user trained this week). */
export const BALANCE_MUSCLES = ["chest", "lats", "upper-back", "delt-side", "quads", "hamstrings", "glutes", "biceps", "triceps"];
export function lowMuscles(min = 10) {
  if (!S.sessions.some((s) => s.endedAt > Date.now() - 7 * 864e5)) return [];
  const v = weeklyVolume();
  return BALANCE_MUSCLES.map((m) => [m, Math.round(v[m] || 0)]).filter(([, n]) => n < min).sort((a, b) => a[1] - b[1]);
}
