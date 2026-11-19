// Unit tests for history maths in app/js/data.js (FE-14): recovery windows, weekly volume, period totals.
// The functions take `sessions` as their last argument, so no store or DOM is needed. Run: node --test tools/test/unit/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const app = new URL("../../../app/", import.meta.url);
globalThis.fetch = async (u) => { try { const t = await readFile(new URL(String(u), app), "utf8"); return { ok: true, json: async () => JSON.parse(t) }; } catch { return { ok: false, json: async () => null }; } };
let D;
try { D = await import("../../../app/js/data.js"); await D.loadExercises(); } catch (e) { D = null; console.log("skip:", e.message); }

const H = 36e5, NOW = Date.UTC(2026, 10, 18, 12);
// barbell-bench-press: primary chest, secondary triceps + delt-front
const bench = (endedAt, n = 3, extra = {}) => ({ id: "s" + endedAt, startedAt: endedAt - H, endedAt,
  entries: [{ slug: "barbell-bench-press", sets: Array.from({ length: n }, () => ({ w: 60, r: 8, done: true, type: "n", ...extra })) }] });

test("recovery: trained <24 h is red, then yellow, then green", { skip: !D }, () => {
  assert.equal(D.recovery(NOW, [bench(NOW - 2 * H)]).chest.state, "r");
  const y = D.recovery(NOW, [bench(NOW - 30 * H)]).chest; assert.equal(y.state, "y"); assert.ok(y.left > 0);
  assert.equal(D.recovery(NOW, [bench(NOW - 80 * H)]).chest.state, "g");
  assert.deepEqual(D.recovery(NOW, [bench(NOW - 5 * 24 * H)]), {}, "older than 4 days is ignored");
});
test("recovery: window is 48–72 h and grows with sets", { skip: !D }, () => {
  const few = D.recovery(NOW, [bench(NOW - 24 * H, 1)]).chest.left, many = D.recovery(NOW, [bench(NOW - 24 * H, 10)]).chest.left;
  assert.ok(many > few, `${many} > ${few}`); assert.ok(many <= 72 - 24 && few >= 48 - 24 - 1);
});
test("recovery: secondary muscles count, warm-up / unticked sets do not", { skip: !D }, () => {
  const r = D.recovery(NOW, [bench(NOW - 2 * H)]); assert.ok(r.triceps && r["delt-front"]);
  assert.deepEqual(D.recovery(NOW, [bench(NOW - 2 * H, 3, { type: "w" })]), {});
  assert.deepEqual(D.recovery(NOW, [bench(NOW - 2 * H, 3, { done: false })]), {});
});
test("weeklyVolume: primary = 1 set, secondary = 0.5, inside the window only", { skip: !D }, () => {
  const v = D.weeklyVolume(7, NOW, [bench(NOW - 24 * H, 4), bench(NOW - 8 * 24 * H, 9)]);
  assert.equal(v.chest, 4); assert.equal(v.triceps, 2); assert.equal(v["delt-front"], 2);
});
test("periodStats: totals in [from, to)", { skip: !D }, () => {
  const s = D.periodStats(NOW - 7 * 24 * H, NOW, [bench(NOW - H, 3), bench(NOW, 5)]);
  assert.deepEqual(s, { workouts: 1, sets: 3, reps: 24, kg: 1440 });
});
test("history / exerciseStats: best set by e1RM", { skip: !D }, () => {
  const ss = [bench(NOW - 48 * H), { ...bench(NOW - H), entries: [{ slug: "barbell-bench-press", sets: [{ w: 80, r: 5, done: true, type: "n" }, { w: 70, r: 8, done: true, type: "n" }] }] }];
  assert.equal(D.history("barbell-bench-press", ss).length, 2);
  const st = D.exerciseStats(0, NOW + 1, ss)["barbell-bench-press"]; assert.equal(st.sets, 5); assert.deepEqual(st.best, { w: 80, r: 5 });
});

test("Q21 timed exercises: marked by family/name, rep moves with a hold are not", { skip: !D }, () => {
  const by = Object.fromEntries(D.EX.map((e) => [e.slug, e]));
  assert.equal(by["dead-hang-ryan_humis514743"].time, 60);
  assert.equal(by["dead-hang-copy-ryan_humis514743"].time, 60);
  assert.equal(by.cardio.time, 1200);
  for (const s of ["dips-3-second-hold-at-bottom", "slight-incline-db-20-second-hold", "dumbbell-side-lateral-holds-garage-program", "quad-extreme-stretch", "dips-extreme-stretch"]) assert.equal(by[s].time, 0, s);
  assert.equal(D.timedKg(by["dead-hang-copy-ryan_humis514743"]), true); // chest stretch holds dumbbells
  assert.equal(D.timedKg(by["dead-hang-ryan_humis514743"]), false);
  assert.equal(D.timedTarget({ family: "x", name: "Front Plank", equipment: [] }), 30);
  assert.equal(D.timedTarget({ family: "x", name: "Side Plank (45 Seconds)", equipment: [] }), 45);
});
test("Q21 timed history: seconds-only sets count, best hold, labels", { skip: !D }, () => {
  const ss = [{ endedAt: 1, startedAt: 0, entries: [{ slug: "dead-hang-ryan_humis514743", sets: [{ w: "", r: "", t: "50", done: true, type: "n" }, { w: "", r: "", t: "62", done: true, type: "n" }] }] },
    { endedAt: 3, startedAt: 2, entries: [{ slug: "dead-hang-ryan_humis514743", sets: [{ w: "", r: "", t: "58", done: true, type: "n" }] }] }];
  assert.equal(D.history("dead-hang-ryan_humis514743", ss).length, 2);
  assert.deepEqual(D.bestHold("dead-hang-ryan_humis514743", ss), { t: 62, w: 0, date: 1 });
  assert.equal(D.exerciseStats(0, 9, ss)["dead-hang-ryan_humis514743"].secs, 170);
  assert.deepEqual([45, 60, 95, 1200].map(D.fmtSec), ["45s", "60s", "1:35", "20 min"]);
});

test("goalStatus: to go, reached (near or crossed), toward the goal (Q22)", { skip: !D }, () => {
  assert.equal(D.goalStatus(null, 80, null), null);
  assert.deepEqual(D.goalStatus(84, 80, 77.6), { left: 2.4, reached: false, toward: true });
  assert.deepEqual(D.goalStatus(80, 82, 77.6), { left: 4.4, reached: false, toward: false });
  assert.equal(D.goalStatus(84, 77.5, 77.6).reached, true);
  assert.equal(D.goalStatus(84, 76, 77.6).reached, true); // went past it
  assert.equal(D.goalStatus(70, 75, 75).reached, true); // gaining goal
  assert.deepEqual(D.goalStatus(null, 80, 80), { left: 0, reached: true, toward: false });
});
