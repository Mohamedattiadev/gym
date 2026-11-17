// SEC-3: hostile backup / sync data must come out of sanitize() without markup or prototype keys.
import { test } from "node:test";
import assert from "node:assert/strict";
const { sanitize } = await import("../../../app/js/sanitize.js");
const KEYS = ["favorites", "workouts", "sessions", "active", "notes", "bodyweight", "pain", "adjust", "settings", "profile"];
const opt = { keys: KEYS, schema: 2, uid: () => "newid" };
const X = "<img src=x onerror=alert(1)>";

test("sanitize: hostile fixture has no markup outside free text", () => {
  const evil = JSON.parse(`{"__proto__":{"polluted":1},"evil":"${X.replace(/"/g, "")}","settings":{"unit":"${X}","bar":"20<b>","plates":[20,"x"],"restEx":{"bench":60,"<x>":5}},
    "workouts":[{"id":"\\"><svg onload=1>","name":"${X}","items":[{"slug":"bench-press","sets":3,"reps":"8-12\\"><b>"},{"slug":"<x y>"}]}],
    "sessions":[{"id":"ok-1","startedAt":1,"entries":[{"slug":"squat","sets":[{"w":"60<img>","r":"8","done":true,"type":"<x>"},{"w":"62.5","r":"10","type":"w"}]},{"slug":"a b<"}]}],
    "favorites":["squat","<x y>",5],"notes":{"squat":"knees <out>","<bad>":"x"},"pain":{"bench":["shoulder\\"x"]},"profile":"oops","schema":2}`);
  const o = sanitize(evil, opt);
  assert.equal(o.evil, undefined); assert.equal({}.polluted, undefined); assert.equal(Object.getPrototypeOf(o), Object.prototype);
  assert.equal(o.settings.unit, undefined); assert.equal(o.settings.bar, undefined); assert.equal(o.settings.plates, undefined);
  assert.deepEqual(o.settings.restEx, { bench: 60 });
  assert.equal(o.workouts[0].id, "newid"); assert.equal(o.workouts[0].items.length, 1);
  assert.equal(o.workouts[0].name, X); // free text kept, the UI escapes names
  const s = o.sessions[0]; assert.equal(s.id, "ok-1"); assert.equal(s.entries.length, 1);
  assert.deepEqual(s.entries[0].sets.map((x) => [x.w, x.r, x.type]), [["", "8", "n"], ["62.5", "10", "w"]]);
  assert.deepEqual(o.favorites, ["squat"]); assert.deepEqual(o.notes, { squat: "knees <out>" });
  assert.equal(o.profile, null);
  const rest = JSON.stringify({ ...o, workouts: o.workouts.map(({ name, ...w }) => w), notes: {} });
  assert.ok(!/[<>]/.test(rest), rest);
});
test("sanitize: normal backup is unchanged", () => {
  const d = { settings: { unit: "lb", bar: 20, plates: [25, 20], theme: "dark" }, favorites: ["squat"], workouts: [{ id: "abc123", name: "Push A", items: [{ slug: "bench-press", sets: 3, reps: "8-12" }] }],
    sessions: [{ id: "imp-x1", name: "Push", startedAt: 1, endedAt: 2, entries: [{ slug: "bench-press", sets: [{ w: "80", r: "8", done: true, type: "n" }] }] }], schema: 2 };
  assert.deepEqual(sanitize(structuredClone(d), opt), d);
});
test("sanitize: newer schema is refused, non-object refused", () => {
  assert.throws(() => sanitize({ schema: 3 }, opt), /newer version/);
  assert.throws(() => sanitize([], opt), /Not a Gym/);
});
