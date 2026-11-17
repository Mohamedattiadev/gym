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
