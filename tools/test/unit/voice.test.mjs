// voice.js: the inlined English table = app/data/voice.en.json; every language table has the same keys + plural "other"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync("app/js/voice.js", "utf8");
const inline = JSON.parse(src.match(/const EN = (\{[\s\S]*?\});/)[1]);
const tab = (l) => JSON.parse(readFileSync(`app/data/voice.${l}.json`, "utf8"));
test("inlined English = voice.en.json", () => assert.deepEqual(inline, tab("en")));
for (const l of ["tr", "ar"]) test(`voice.${l}.json matches the English keys`, () => {
  const en = tab("en"), x = tab(l);
  assert.deepEqual(Object.keys(x).sort(), Object.keys(en).sort());
  for (const [k, v] of Object.entries(en)) {
    if (typeof v === "object") { assert.ok(x[k].other, `${l} ${k}.other`); for (const f of Object.values(x[k])) if (f !== x[k].other || v.other.includes("{n}")) assert.ok(/\{n\}|واحد|ين$|ان\.?$/.test(f), `${l} ${k}: ${f}`); }
    else for (const ph of v.match(/\{\w\}/g) || []) assert.ok(x[k].includes(ph), `${l} ${k} lacks ${ph}`);
  }
});
