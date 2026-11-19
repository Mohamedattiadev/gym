// Route smoke test: every hash route on phone + desktop (light + dark), fails on any console error.
//   node tools/test/routes.mjs [outDir]   (needs the app served on localhost:8765)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
const root = new URL("../../", import.meta.url).pathname;
const out = process.argv[2] || "/tmp/gym-routes"; mkdirSync(out, { recursive: true });
const ex = JSON.parse(readFileSync(root + "app/data/exercises.json", "utf8"));
const slug = (ex.find((e) => e.slug === "barbell-bench-press") || ex.find((e) => e.equipment.includes("Barbell")) || ex[0]).slug;
const plan = (readFileSync(root + "app/js/train.js", "utf8").match(/\{ id: "([\w-]+)", level:/) || [, "beg-fb"])[1];
const routes = ["#/", "#/lib", `#/ex/${slug}`, "#/body", "#/train", `#/plan/${plan}`, "#/plans", "#/me", "#/guide", "#/start", "#/profile",
  "#/standards", "#/nutrition", "#/warmup", "#/videos", "#/settings", "#/timer", "#/pick"];
// Must stay last: starts a session from a plan (needs data-use -> data-start), then the session + workout pages.
const sessionSteps = [{ go: "#/train" }, { waitFor: "[data-use]" }, { click: "[data-use]", wait: 800 }, { waitFor: "[data-start]" },
  { click: "[data-start]", wait: 1200 }, { waitFor: ".xblock" }, { shot: "session" },
  { go: "#/train" }, { waitFor: "a[href^='#/workout/']" },
  { click: "a[href^='#/workout/']", wait: 900 }, { shot: "workout" },
  // FE-6: the app's own error log must stay empty
  { eval: "(() => { const l = localStorage.getItem('gym-log'); if (l) throw new Error('app error log: ' + l.slice(0, 400)); })()" }];
let failed = 0;
for (const vp of ["phone", "desktop"]) for (const scheme of ["light", "dark"]) {
  // the welcome screen (fresh profile on #/ or #/start) holds every other route until Guest / Google (main.js route());
  // check that once, then drop its flag before each page so every route renders as before
  const unwelc = { eval: "delete document.documentElement.dataset.welcome", wait: 0 };
  const steps = [{ vp, scheme }, { go: "#/", wait: 2500 }, { waitFor: "#view" },
    { go: "#/lib", wait: 700 }, { eval: "(() => { if (location.hash !== '#/start') throw new Error('welcome guard: tab left the welcome screen -> ' + location.hash); })()" },
    ...routes.flatMap((r) => [unwelc, { go: r, wait: 900 }, { shot: (r.slice(2).replace(/\W+/g, "-") || "home") + "-" + scheme }]),
    unwelc, ...sessionSteps.map((s) => (s.shot ? { shot: s.shot + "-" + scheme } : s))];
  const f = `${out}/steps-${vp}-${scheme}.json`; writeFileSync(f, JSON.stringify(steps));
  const txt = execFileSync("node", [root + "tools/test/shot.mjs", out, f], { encoding: "utf8", maxBuffer: 1 << 26 });
  const errs = txt.split("\n").filter((l) => l && !l.startsWith("shot ") && !/^(no console errors|ERRORS:)$/.test(l) && !/navigator\.vibrate/.test(l));
  console.log(`${errs.length ? "FAIL" : "ok  "} ${vp.padEnd(8)}${scheme.padEnd(6)} ${routes.length + 2} pages${errs.length ? "\n  " + errs.join("\n  ") : ""}`);
  if (errs.length) failed++;
}
console.log(`screenshots: ${out}`); process.exit(failed ? 1 : 0);
