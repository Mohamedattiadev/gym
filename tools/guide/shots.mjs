// App screenshots for the printable guide, light + dark (server must run).
// Usage: node tools/guide/shots.mjs   -> tools/guide/shots/<name>.jpg and <name>-d.jpg (520 px wide, full phone screen)
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "tools/guide/shots"), TMP = resolve(OUT, ".raw");
mkdirSync(TMP, { recursive: true });
const EX = "machine-chest-press-ryan_humis514743";
const day = 864e5, now = Date.now();
/* 6 finished sessions over 3 weeks so Me > Progress has a chart and history */
const fake = `(async()=>{const st=await import('./js/store.js');const S=st.S;const mk=(d,w)=>({id:'f'+d,startedAt:${now}-d*${day}-3600e3,endedAt:${now}-d*${day},name:'Full Body A',
entries:[{slug:'${EX}',sets:[{w,r:10,done:true,type:'n'},{w,r:9,done:true,type:'n'},{w,r:8,done:true,type:'n'}]},{slug:'belt-squat-ryan_humis514743',sets:[{w:w+10,r:8,done:true,type:'n'},{w:w+10,r:8,done:true,type:'n'}]}]});
S.sessions.push(mk(19,30),mk(16,32.5),mk(12,32.5),mk(9,35),mk(5,35),mk(2,37.5));st.save('sessions')})()`;
const set = "const set=(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};";
const steps = (sfx, scheme) => [
  { vp: "phone" }, { scheme },
  { go: "#/start" }, { wait: 1500 }, { shot: "onboard" + sfx },
  { go: "#/train" }, { waitFor: "[data-use]" }, { wait: 800 }, { shot: "plans" + sfx },
  { go: "#/plan/beg-fb" }, { wait: 1800 }, { shot: "plan" + sfx },
  { go: "#/train" }, { waitFor: "[data-use]" }, { click: "[data-use]", wait: 900 },
  { eval: fake }, { wait: 300 },
  { go: "#/" }, { wait: 1400 }, { eval: "document.getElementById('install')?.remove();document.querySelectorAll('.toast').forEach(t=>t.remove())" }, { wait: 200 }, { shot: "home" + sfx },
  { go: "#/ex/" + EX }, { wait: 2600 }, { shot: "exercise" + sfx },
  { eval: "document.querySelector('.mshow')?.closest('ul')?.previousElementSibling?.scrollIntoView({block:'start'});scrollBy(0,-80)" }, { wait: 500 }, { shot: "howto" + sfx },
  { click: ".mshow", wait: 2600 }, { shot: "mistake" + sfx },
  { go: "#/body" }, { wait: 1400 }, { eval: "(()=>{const e=document.querySelector('[data-m=chest]');e&&e.dispatchEvent(new MouseEvent('click',{bubbles:true}))})()" }, { wait: 1500 }, { shot: "body" + sfx },
  { go: "#/me" }, { wait: 1800 }, { shot: "progress" + sfx },
  { go: "#/settings" }, { wait: 1300 }, { eval: "[...document.querySelectorAll('.card b')].find(b=>b.textContent==='Backup file')?.closest('.card').scrollIntoView({block:'start'}); scrollBy(0,-70)" }, { wait: 500 }, { shot: "backup" + sfx },
  { eval: "scrollTo(0,0)" }, { click: "#inst", wait: 1200 }, { shot: "install" + sfx },
  { go: "#/train" }, { waitFor: "[data-start]" }, { click: "[data-start]", wait: 1300 }, { waitFor: ".xblock" },
  { eval: `(()=>{${set}set(document.querySelector('input[data-k=w]'),'40');set(document.querySelector('input[data-k=r]'),'10');scrollTo(0,0)})()` }, { wait: 600 }, { shot: "session" + sfx },
  { click: "button.check[data-a=done]", wait: 1500 }, { eval: "document.querySelectorAll('.toast').forEach(t=>t.remove())" }, { wait: 300 }, { shot: "rest" + sfx },
];
for (const [sfx, scheme] of [["", "light"], ["-d", "dark"]]) {
  const f = resolve(TMP, `steps${sfx}.json`);
  writeFileSync(f, JSON.stringify(steps(sfx, scheme)));
  console.log(execFileSync("node", [resolve(ROOT, "tools/test/shot.mjs"), TMP, f], { encoding: "utf8", timeout: 240000 }).trim().split("\n").slice(-4).join("\n"));
}
for (const f of readdirSync(TMP).filter((x) => x.endsWith(".png")))
  execFileSync("magick", [resolve(TMP, f), "-resize", "520x", "-quality", "80", "-strip", resolve(OUT, f.replace(/^phone-/, "").replace(/\.png$/, ".jpg"))]);
console.log("ok", readdirSync(OUT).filter((x) => x.endsWith(".jpg")).length, "shots");
