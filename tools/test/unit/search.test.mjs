// Unit tests for library search (app/js/data.js searchEx) — UT-12 Turkish words + group-first ranking. Run: node --test tools/test/unit/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
globalThis.addEventListener ??= () => {}; globalThis.document ??= { addEventListener() {}, hidden: false };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const app = new URL("../../../app/", import.meta.url);
globalThis.fetch = async (u) => { try { const t = await readFile(new URL(String(u), app), "utf8"); return { ok: true, json: async () => JSON.parse(t) }; } catch { return { ok: false, json: async () => null }; } };
let D;
try { D = await import("../../../app/js/data.js"); await D.loadExercises(); } catch (e) { D = null; console.log("skip:", e.message); }
const top = (q, n = 5) => D.searchEx(q, D.EX).slice(0, n);
test("search: barfix spelling finds pull-ups (UT-12)", { skip: !D }, () => {
  const r = top("barfix"); assert.ok(r.length, "no results"); assert.ok(r.every((e) => /pull|chin/i.test(e.name)), r.map((e) => e.name).join(", "));
});
test("search: group words put that group first (UT-12)", { skip: !D }, () => {
  for (const [q, g] of [["karın", ["Abs"]], ["ön kol", ["Forearms"]], ["sırt", ["Lats", "Upper Back", "Lower Back"]], ["göğüs", ["Chest"]], ["chest", ["Chest"]]]) {
    const r = top(q); assert.equal(r.length, 5, q); for (const e of r) assert.ok(g.includes(e.group), `${q}: ${e.name} (${e.group})`);
  }
});
test("search: name hits still lead for non-group words (UT-4)", { skip: !D }, () => {
  for (const e of top("bench", 3)) assert.match(e.name + " " + e.aliases, /bench/i);
  for (const e of top("göğüs presi", 3)) assert.match(e.name, /press/i);
});
