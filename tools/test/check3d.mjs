// 19b-QA build check: every authored motion (app/3d/poses/*.json) with each prop it can show must keep the prop
// in the hands / on the back and out of the head and torso. Exit 1 on any failure.
//   node tools/test/check3d.mjs   (needs the app served on localhost:8765)
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
const dir = new URL("../../app/3d/poses/", import.meta.url).pathname;
const cases = readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => {
  const P = JSON.parse(readFileSync(dir + f, "utf8")), fam = f.slice(0, -5);
  return (P.props?.length ? P.props : [null]).flatMap((p) => [[fam, p, null], ...Object.keys(P.wrong || {}).map((w) => [fam, p, w])]); // 22c: wrong variants too
});
const js = `(async()=>{const m=await import('./js/view3d.js');const out=[];for(const [f,p,w] of ${JSON.stringify(cases)}){try{out.push(await m.qa3d('p:'+f,p,24,w))}catch(e){out.push({move:f+(w?' wrong#'+w:''),fails:['error '+e.message]})}}return out})()`;
const tmp = mkdtempSync(tmpdir() + "/check3d-");
writeFileSync(tmp + "/s.json", JSON.stringify([{ vp: "desktop" }, { go: "#/", wait: 2500 }, { waitFor: "#view" }, { eval: js, log: true, wait: 100 }]));
const txt = execFileSync("node", [new URL("./shot.mjs", import.meta.url).pathname, tmp, tmp + "/s.json"], { encoding: "utf8", maxBuffer: 1 << 26 });
const line = txt.split("\n").find((l) => l.startsWith("eval: ")); if (!line) { console.error(txt); process.exit(1); }
const res = JSON.parse(line.slice(6)); let bad = 0;
for (const r of res) { const ok = !r.fails.length; if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${r.move.padEnd(28)} ${(r.prop || []).join("+").padEnd(14)} ${ok ? JSON.stringify(r.worst) : r.fails.join("; ")}`); }
console.log(`${res.length - bad}/${res.length} pass`); process.exit(bad ? 1 : 0);
