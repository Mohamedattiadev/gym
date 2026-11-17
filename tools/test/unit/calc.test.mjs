// Unit tests for pure training math (app/js/calc.js). Run: node --test tools/test/unit/
import { test } from "node:test";
import assert from "node:assert/strict";
// store.js registers page listeners at import time; stub them for Node.
globalThis.addEventListener ??= () => {}; globalThis.document ??= { addEventListener() {}, hidden: false };
const { S } = await import("../../../app/js/store.js");
const C = await import("../../../app/js/calc.js");
const reset = () => { S.settings.bar = 20; S.settings.plates = [25, 20, 15, 10, 5, 2.5, 1.25]; };
const bb = { equipment: ["Barbell"], type: "compound", repRange: [6, 10] };
const db = { equipment: ["Dumbbell"], type: "isolation", repRange: [10, 15] };

test("e1rm: edge cases", () => {
  assert.equal(C.e1rm(0, 5), 0); assert.equal(C.e1rm(100, 0), 0); assert.equal(C.e1rm("", ""), 0);
  assert.equal(C.e1rm(100, 1), 100);
  assert.equal(C.e1rm("100", "1"), 100);
});
test("e1rm: mean of Epley + Brzycki, capped at 12 reps", () => {
  const ep = 100 * (1 + 5 / 30), bz = 100 * 36 / 32;
  assert.equal(C.e1rm(100, 5), Math.round((ep + bz) / 2 * 10) / 10);
  assert.equal(C.e1rm(100, 20), C.e1rm(100, 12));
  assert.ok(C.e1rm(100, 8) > C.e1rm(100, 5));
});
test("platesFor: exact load", () => {
  reset();
  assert.deepEqual(C.platesFor(100), { bar: 20, out: [25, 15], rest: 0 });
  assert.deepEqual(C.platesFor(142.5), { bar: 20, out: [25, 25, 10, 1.25], rest: 0 });
});
test("platesFor: bar only / below bar / remainder", () => {
  reset();
  assert.deepEqual(C.platesFor(20), { bar: 20, out: [], rest: 0 });
  assert.deepEqual(C.platesFor(10), { bar: 20, out: [], rest: 0 });
  assert.equal(C.platesFor(21).rest, 1);
});
test("platesFor: custom bar + inventory", () => {
  S.settings.bar = 15; S.settings.plates = [20, 10, 5];
  assert.deepEqual(C.platesFor(75), { bar: 15, out: [20, 10], rest: 0 });
  reset();
});
test("warmupSets: heavy barbell compound ramps from the bar, all lighter than work", () => {
  reset();
  const w = C.warmupSets(100, bb);
  assert.equal(w[0].w, 20); assert.equal(w[0].r, 10);
  assert.ok(w.length >= 4);
  for (const s of w) { assert.ok(s.w < 100); assert.equal(s.w % 2.5, 0); }
  const ws = w.map((s) => s.w); assert.deepEqual(ws, [...ws].sort((a, b) => a - b)); assert.equal(new Set(ws).size, ws.length);
});
test("warmupSets: light isolation = 2 sets, none for empty work", () => {
  reset();
  assert.deepEqual(C.warmupSets(20, db), [{ w: 10, r: 8 }, { w: 15, r: 4 }]);
  assert.deepEqual(C.warmupSets(0, db), []);
  assert.deepEqual(C.warmupSets("", bb), []);
});
test("suggest: no history -> null; warm-ups and undone ignored", () => {
  assert.equal(C.suggest(bb, []), null); assert.equal(C.suggest(bb, null), null);
  assert.equal(C.suggest(bb, [{ w: 60, r: 10, done: true, type: "w" }, { w: 80, r: 8, done: false }]), null);
});
test("suggest: top of range on all sets -> add weight, back to bottom", () => {
  const s = C.suggest(bb, [{ w: 80, r: 10, done: true }, { w: 80, r: 10, done: true }]);
  assert.deepEqual([s.w, s.r, s.up], [82.5, 6, true]);
  const d = C.suggest(db, [{ w: 12, r: 15, done: true }]);
  assert.deepEqual([d.w, d.r], [13, 10]);
  assert.equal(C.suggest(db, [{ w: 22, r: 15, done: true }]).w, 24);
});
test("suggest: otherwise +1 rep on the weakest set, same weight", () => {
  const s = C.suggest(bb, [{ w: 80, r: 9, done: true }, { w: 80, r: 7, done: true }]);
  assert.deepEqual([s.w, s.r, s.up], [80, 8, false]);
  assert.equal(C.suggest({ equipment: ["Cable"] }, [{ w: 30, r: 11, done: true }]).r, 12);
});
