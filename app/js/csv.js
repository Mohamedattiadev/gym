// CSV export (one row per logged set) + import from Strong, Hevy and our own CSV.
import { S, save } from "./store.js";
import { EX, BY, norm, byTier } from "./data.js";

/* ---- CSV text ---- */
const q = (v) => { const s = String(v ?? ""); return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const first = text.slice(0, text.search(/\r?\n/) >>> 0 || text.length);
  const d = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cur = "", inq = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inq) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inq = false; } else cur += c; continue; }
    if (c === '"') inq = true;
    else if (c === d) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x !== "")) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

const COLS = ["Date", "Workout Name", "Duration (min)", "Exercise Name", "Set Order", "Weight", "Unit", "Reps", "Set Type", "Exercise ID"];
export function exportCSV() {
  const u = S.settings.unit, out = [COLS.join(",")];
  const pad = (n) => String(n).padStart(2, "0");
  const dt = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`; };
  for (const s of [...S.sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const mins = s.endedAt && s.startedAt ? Math.round((s.endedAt - s.startedAt) / 6e4) : "";
    for (const en of s.entries) { let n = 0;
      for (const x of en.sets) { if (!x.done) continue; const w = x.type === "w"; if (!w) n++;
        out.push([dt(s.startedAt), s.name || "Workout", mins, BY[en.slug]?.name || en.name || en.slug, w ? "W" : n, +x.w || 0, u, +x.r || 0, w ? "warmup" : "normal", en.slug].map(q).join(",")); } }
  }
  return out.join("\n");
}

/* ---- exercise name matching ---- */
const EQ = { barbell: "Barbell", dumbbell: "Dumbbell", cable: "Cable", machine: "Machine", smith: "Smith", "smith machine": "Smith", bodyweight: "Bodyweight", band: "Band", kettlebell: "Kettlebell", "ez bar": "Barbell", "weighted": "" };
const SYN = [[/\bohp\b|\bmilitary press\b|\boverhead press\b/, "shoulder press"], [/\brdl\b|\bromanian deadlift\b/, "stiff leg deadlift"], [/\bbicep\b/, "biceps"], [/\btricep\b/, "triceps"],
  [/\bpull ?ups?\b|\bpullups?\b/, "pull up"], [/\bchin ?ups?\b/, "chin up"], [/\bpush ?downs?\b/, "pushdown"], [/\bskullcrushers?\b/, "skull crusher"], [/\bflyes\b/, "fly"]];
const stem = (t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t);
function toks(name) {
  let n = norm(name); for (const [re, r] of SYN) n = n.replace(re, r);
  return new Set(n.split(" ").filter((t) => t && !["the", "with", "on", "a"].includes(t)).map(stem));
}
function hint(name) { const m = String(name).match(/\(([^)]+)\)/); if (!m) return null;
  for (const part of m[1].split(/[-,/]/)) { const h = norm(part).trim(); if (h in EQ) return EQ[h] || null; } return null; }
// Auto-match only when the library name is the same movement: it contains every word of the imported name and adds only
// harmless words (equipment, "flat", "high bar"…). Anything else is left for the user to pick (suggestions ranked below).
const MILD = new Set(["barbell", "dumbbell", "cable", "machine", "smith", "bodyweight", "flat", "standing", "high", "low", "bar", "straight", "ez", "lat", "regular", "conventional", "back"]);
const NOVEL = /\b(partials?|copy|tempo|giant|cluster|myo|drops?|iso|holds?|pause[ds]?|lengthened|stretch|somersault|extreme|banded|chains?|deficit|pin|zercher|jefferson|landmine|kas|frog|half|diy|shrugs?)\b|["(]/i;
const KIND = ["Barbell", "Dumbbell", "Cable", "Machine", "Smith", "Kettlebell"];
let IDX = null;
const index = () => (IDX ||= EX.map((e) => ({ e, t: toks(e.name.replace(/\([^)]*\)/g, " ")), odd: NOVEL.test(e.name) })));
export function rank(name, n = 6) {
  const base = String(name).replace(/\([^)]*\)/g, " "), eq = hint(name), A = toks(base);
  if (!A.size) return [];
  const out = [];
  for (const { e, t, odd } of index()) {
    let both = 0; for (const x of A) if (t.has(x)) both++;
    if (!both) continue;
    const extra = [...t].filter((x) => !A.has(x)), hard = extra.filter((x) => !MILD.has(x)).length;
    let sc = both / A.size - hard * 0.08 - (odd ? 0.2 : 0);
    const clash = eq && KIND.some((k) => k !== eq && t.has(k.toLowerCase())); // name says "Dumbbell …" but the file says Barbell
    if (eq) sc += clash ? -0.3 : e.equipment.includes(eq) ? 0.15 : -0.1;
    sc += e.canonical ? 0.05 : 0; sc += e.tier === "S" ? 0.02 : e.tier === "A" ? 0.01 : 0;
    out.push({ e, sc, sure: both === A.size && !hard && !odd && !clash && (!eq || e.equipment.includes(eq)) });
  }
  return out.sort((a, b) => b.sc - a.sc || byTier(a.e, b.e)).slice(0, n);
}
export function matchExercise(name) {
  const k = norm(name).trim(), saved = S.settings.csvMap?.[k];
  if (saved && BY[saved]) return saved;
  const ex = EX.find((e) => norm(e.name).trim() === k); if (ex) return ex.slug;
  return rank(name, 40).find((x) => x.sure)?.e.slug || null;
}

/* ---- import ---- */
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseDate(s) {
  s = String(s || "").trim(); if (!s) return NaN;
  let m = s.match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/); if (m) return new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  m = s.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4}),? (\d{1,2}):(\d\d)/); if (m && MON[m[2].toLowerCase()] != null) return new Date(+m[3], MON[m[2].toLowerCase()], +m[1], +m[4], +m[5]).getTime();
  const t = Date.parse(s); return t;
}
const durMin = (s) => { s = String(s || ""); if (/^\d+(\.\d+)?$/.test(s)) return +s; const h = +(s.match(/(\d+)\s*h/)?.[1] || 0), m = +(s.match(/(\d+)\s*m/)?.[1] || 0), sec = +(s.match(/(\d+)\s*s/)?.[1] || 0); return h * 60 + m + sec / 60; };
const num = (v) => +String(v ?? "").replace(",", ".") || 0;

/** Parse a CSV file into { format, workouts:[{start,end,name,ex:[{name,slug,sets}]}], names:[{name,slug,count}] } or throw. */
export function readImport(text) {
  const rows = parseCSV(text); if (rows.length < 2) throw new Error("empty");
  const H = rows[0].map((h) => h.trim().toLowerCase()), col = (...ks) => { for (const k of ks) { const i = H.indexOf(k); if (i >= 0) return i; } return -1; };
  const hevy = col("exercise_title") >= 0, own = col("exercise id") >= 0;
  const c = hevy ? { date: col("start_time"), end: col("end_time"), wname: col("title"), ex: col("exercise_title"), order: col("set_index"), w: col("weight_kg", "weight_lbs"), r: col("reps"), type: col("set_type") }
    : { date: col("date"), dur: col("duration", "duration (min)"), wname: col("workout name"), ex: col("exercise name"), order: col("set order"), w: col("weight"), r: col("reps"), unit: col("unit", "weight unit"), id: col("exercise id") };
  if (c.date < 0 || c.ex < 0 || c.r < 0) throw new Error("format");
  const myU = S.settings.unit, conv = (w, from) => (!from || from === myU ? w : from === "kg" ? Math.round(w * 2.20462 * 4) / 4 : Math.round(w / 2.20462 * 4) / 4);
  const hevyU = hevy ? (H[c.w] === "weight_lbs" ? "lb" : "kg") : null;
  const W = new Map(), names = new Map();
  for (const r of rows.slice(1)) {
    const t = parseDate(r[c.date]), exn = (r[c.ex] || "").trim(); if (!isFinite(t) || !exn) continue;
    const ord = String(r[c.order] ?? "").trim(), typ = String(hevy ? r[c.type] : r[col("set type")] ?? "").toLowerCase();
    if (!hevy && ord && !/^\d+$/.test(ord) && !/^[wdf]$/i.test(ord)) continue; // Strong "Rest Timer" rows etc.
    const warm = /^w$/i.test(ord) || typ.startsWith("warm"), reps = num(r[c.r]);
    let w = num(r[c.w]); const u = hevy ? hevyU : (String(r[c.unit] ?? "").toLowerCase().startsWith("lb") ? "lb" : String(r[c.unit] ?? "").toLowerCase().startsWith("kg") ? "kg" : null); w = conv(w, u);
    if (!reps && !w) continue;
    const key = t + "|" + (r[c.wname] || "");
    let wk = W.get(key); if (!wk) { const end = hevy ? parseDate(r[c.end]) : t + (durMin(r[c.dur]) || 60) * 6e4; W.set(key, (wk = { start: t, end: isFinite(end) && end > t ? end : t + 36e5, name: (r[c.wname] || "Workout").trim(), ex: [] })); }
    let en = wk.ex.at(-1); if (!en || en.name !== exn) wk.ex.push((en = { name: exn, id: own ? r[c.id] : "", sets: [] }));
    en.sets.push({ w: w ? String(w) : "", r: reps ? String(reps) : "", done: true, type: warm ? "w" : "n" });
    names.set(exn, (names.get(exn) || 0) + 1);
  }
  if (!W.size) throw new Error("nodata");
  const ids = new Map(); for (const wk of W.values()) for (const en of wk.ex) if (en.id && BY[en.id]) ids.set(en.name, en.id);
  return { format: hevy ? "Hevy" : own ? "Gym" : "Strong", workouts: [...W.values()].sort((a, b) => a.start - b.start),
    names: [...names].map(([name, count]) => ({ name, count, slug: ids.get(name) || matchExercise(name) })).sort((a, b) => (!!a.slug - !!b.slug) || b.count - a.count) };
}

/** Add parsed workouts as finished sessions (skips ones already imported / same start time). Returns { added, skipped, sets }. */
export function applyImport(R) {
  const map = Object.fromEntries(R.names.map((x) => [x.name, x.slug]));
  S.settings.csvMap ||= {}; for (const x of R.names) if (x.slug) S.settings.csvMap[norm(x.name).trim()] = x.slug;
  const have = new Set(S.sessions.map((s) => Math.round((s.startedAt || 0) / 6e4)));
  let added = 0, skipped = 0, sets = 0;
  for (const wk of R.workouts) {
    const entries = wk.ex.filter((en) => map[en.name]).map((en) => ({ slug: map[en.name], sets: en.sets }));
    if (!entries.length) { skipped++; continue; }
    if (have.has(Math.round(wk.start / 6e4))) { skipped++; continue; }
    S.sessions.push({ id: `imp-${wk.start.toString(36)}`, name: wk.name, startedAt: wk.start, endedAt: wk.end, entries, imported: R.format });
    have.add(Math.round(wk.start / 6e4)); added++; sets += entries.reduce((a, en) => a + en.sets.length, 0);
  }
  S.sessions.sort((a, b) => a.startedAt - b.startedAt);
  save("sessions"); save("settings");
  return { added, skipped, sets };
}
