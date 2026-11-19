// Collects every literal UI string key (block 21 / Q9) and reports what each language table is missing.
//   node tools/i18n/keys.mjs            -> writes tools/i18n/en.keys.json, prints counts per language
//   node tools/i18n/keys.mjs --missing tr -> prints the keys app/data/i18n/tr.json does not have yet
// Keys = first string argument of t( / _t( / N( and the plural (3rd) argument of tn(, plus data-t / data-ta in index.html.
// Exit 1 if a call has a non-literal first argument written as a template with ${} (it can never match a table key).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const js = fs.readdirSync(`${root}/app/js`).filter((f) => f.endsWith(".js")).map((f) => `app/js/${f}`);
const STR = String.raw`"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\x60((?:[^\x60\\$]|\\.)*)\x60`;
const one = new RegExp(String.raw`(?<![\w.$])(?:_t|t|N)\(\s*(?:${STR})`, "g");
const plural = new RegExp(String.raw`(?<![\w.$])tn\([^,]+,\s*(?:${STR})\s*,\s*(?:${STR})`, "g");
const bad = /(?<![\w.$])(?:_t|t|N)\(\s*`[^`]*\$\{/g;
const lit = (m, i) => (m[i] != null ? new Function(`return "${m[i]}"`)() : m[i + 1] != null ? new Function(`return '${m[i + 1]}'`)() : new Function(`return \x60${m[i + 2]}\x60`)()); // our own source
const keys = new Map(); let errors = 0;
const add = (k, where) => { if (!keys.has(k)) keys.set(k, where); };
for (const f of js) {
  const src = fs.readFileSync(`${root}/${f}`, "utf8");
  if (!/from "\.\/i18n\.js"|^export const N =/m.test(src)) continue; // only modules that use i18n
  for (const m of src.matchAll(one)) add(lit(m, 1), f);
  for (const m of src.matchAll(/(?<![\w.$])t\(\s*"([^"]+)",\s*(?:null|undefined|\{[^}]*\}),\s*"(\w+)"\)/g)) add(`${m[1]}@${m[2]}`, f); // context keys
  for (const m of src.matchAll(plural)) { add(lit(m, 1), f); add(lit(m, 4), f); }
  for (const m of src.matchAll(bad)) { console.log(`${f}: t() with a \${} template can't be translated: ${m[0]}`); errors++; }
}
const html = fs.readFileSync(`${root}/app/index.html`, "utf8");
for (const m of html.matchAll(/data-ta?="([^"]+)"/g)) add(m[1], "app/index.html");
// data words shown through t(variable): muscle groups + equipment (exercises.json), muscle names + functions (body.js MUSCLES)
for (const e of JSON.parse(fs.readFileSync(`${root}/app/data/exercises.json`, "utf8"))) { add(e.group, "data"); for (const q of e.equipment || []) add(q, "data"); }
for (const m of fs.readFileSync(`${root}/app/js/body.js`, "utf8").matchAll(/name: "([^"]+)"[^\n]*?fn: "([^"]+)"/g)) { add(m[1], "data"); add(m[2], "data"); }
const list = [...keys.keys()].filter(Boolean).sort();
fs.writeFileSync(`${root}/tools/i18n/en.keys.json`, JSON.stringify(list, null, 1) + "\n");
const want = process.argv.indexOf("--missing") > 0 ? process.argv[process.argv.indexOf("--missing") + 1] : null;
console.log(`${list.length} keys from ${new Set(keys.values()).size} files`);
for (const l of ["tr", "ar"]) {
  const p = `${root}/app/data/i18n/${l}.json`;
  const tbl = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
  const miss = list.filter((k) => !tbl[k]), stale = Object.keys(tbl).filter((k) => !keys.has(k));
  console.log(`${l}: ${list.length - miss.length}/${list.length} translated${stale.length ? `, ${stale.length} unused` : ""}`);
  if (want === l) console.log(JSON.stringify(Object.fromEntries(miss.map((k) => [k, ""])), null, 1));
}
process.exit(errors ? 1 : 0);
