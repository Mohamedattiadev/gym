// Unit tests for the cloud/backup merge (app/js/sync.js merge). Run: node --test tools/test/unit/
import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.addEventListener ??= () => {}; globalThis.document ??= { addEventListener() {}, hidden: false };
const { merge } = await import("../../../app/js/sync.js");

test("merge: restore to a fresh phone keeps cloud pain + adjust (BE-3)", () => {
  const cloud = { pain: { bench: ["shoulder"] }, adjust: { squat: { at: 5, kind: "deload" } }, profile: { level: "beg" } };
  const out = merge({ pain: {}, adjust: {}, profile: null }, cloud);
  assert.deepEqual(out.pain, { bench: ["shoulder"] });
  assert.deepEqual(out.adjust, { squat: { at: 5, kind: "deload" } });
  assert.deepEqual(out.profile, { level: "beg" });
});
test("merge: pain flags union, adjust newest wins", () => {
  const out = merge({ pain: { bench: ["elbow"], row: ["back"] }, adjust: { a: { at: 10 }, b: { at: 1 } } },
                    { pain: { bench: ["shoulder"] }, adjust: { a: { at: 3 }, b: { at: 7 }, c: { at: 2 } } });
  assert.deepEqual(out.pain.bench.sort(), ["elbow", "shoulder"]); assert.deepEqual(out.pain.row, ["back"]);
  assert.equal(out.adjust.a.at, 10); assert.equal(out.adjust.b.at, 7); assert.equal(out.adjust.c.at, 2);
});
test("merge: local non-empty values still win, active stays local", () => {
  const out = merge({ profile: { level: "adv" }, active: { id: 1 } }, { profile: { level: "beg" }, active: { id: 2 } });
  assert.equal(out.profile.level, "adv"); assert.equal(out.active.id, 1);
});

// FE-7: tombstones
const NOW = 1_800_000_000_000, DAY = 864e5;
test("merge: a session deleted on another device does not come back", () => {
  const s = { id: "s1", startedAt: NOW - 3 * DAY, endedAt: NOW - 3 * DAY };
  const out = merge({ sessions: [s] }, { sessions: [], deleted: { sessions: { s1: NOW - DAY } } }, { now: NOW });
  assert.equal(out.sessions.length, 0); assert.equal(out.deleted.sessions.s1, NOW - DAY);
});
test("merge: a workout edited after the remote delete survives; undo (negative) wins over an older delete", () => {
  const w = { id: "w1", name: "A", updatedAt: NOW - 1000, items: [] }, w2 = { id: "w2", name: "B", updatedAt: NOW - 5 * DAY, items: [] };
  const out = merge({ workouts: [w, w2], deleted: { workouts: { w2: -(NOW - DAY) } } },
                    { workouts: [w, w2], deleted: { workouts: { w1: NOW - 2 * DAY, w2: NOW - 2 * DAY } } }, { now: NOW });
  assert.deepEqual(out.workouts.map((x) => x.id), ["w1", "w2"]); assert.equal(out.deleted.workouts.w2, -(NOW - DAY));
});
test("merge: un-favourite sticks, re-favourite after it wins, old tombstones expire", () => {
  const out = merge({ favorites: ["a", "b", "c"], deleted: { favorites: { b: -(NOW - 10), z: NOW - 200 * DAY } } },
                    { favorites: ["a", "b"], deleted: { favorites: { a: NOW - 5, b: NOW - 20 } } }, { now: NOW });
  assert.deepEqual(out.favorites, ["b", "c"]); assert.ok(!("z" in out.deleted.favorites));
});
