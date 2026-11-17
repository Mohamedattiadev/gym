// Original stylized anatomy (front/back). Left-half shapes are mirrored around x=100 (viewBox 0 0 200 420).
export const MUSCLES = [
  // id, number, name, group(s) for exercise lookup, view, weekly sets target [MEV, MAV-hi, MRV], function
  { id: "chest", n: 1, name: "Chest", groups: ["Chest"], view: "front", lm: [8, 20, 22], fn: "Pushes arms forward & across the body (pressing, flies)." },
  { id: "delt-front", n: 2, name: "Front Delts", groups: ["Shoulders"], regions: ["delt-front"], view: "front", lm: [0, 12, 16], fn: "Raises the arm forward. Already hit hard by all pressing." },
  { id: "delt-side", n: 3, name: "Side Delts", groups: ["Shoulders"], regions: ["delt-side"], view: "both", lm: [8, 22, 26], fn: "Lifts the arm out to the side — the key to wide, 3D shoulders." },
  { id: "biceps", n: 4, name: "Biceps", groups: ["Biceps"], view: "front", lm: [8, 20, 26], fn: "Bends the elbow and turns the palm up." },
  { id: "forearms", n: 5, name: "Forearms", groups: ["Forearms"], view: "both", lm: [2, 12, 20], fn: "Grip strength, wrist flexion & extension." },
  { id: "abs", n: 6, name: "Abs", groups: ["Abs"], view: "front", lm: [0, 16, 25], fn: "Flexes the spine (crunching) and braces the core." },
  { id: "obliques", n: 7, name: "Obliques", groups: ["Abs"], view: "front", lm: [0, 12, 20], fn: "Rotates and side-bends the torso." },
  { id: "quads", n: 8, name: "Quads", groups: ["Quads"], view: "front", lm: [8, 18, 20], fn: "Straightens the knee: squats, leg press, extensions." },
  { id: "adductors", n: 9, name: "Adductors", groups: ["Groin"], view: "front", lm: [0, 12, 16], fn: "Pulls the legs together; big helper in deep squats." },
  { id: "shins", n: 10, name: "Shins", groups: ["Shins"], view: "front", lm: [0, 8, 12], fn: "Lifts the toes up; protects knees & ankles." },
  { id: "traps", n: 11, name: "Traps", groups: ["Traps"], view: "both", lm: [0, 16, 26], fn: "Shrugs and moves the shoulder blades." },
  { id: "delt-rear", n: 12, name: "Rear Delts", groups: ["Shoulders"], regions: ["delt-rear"], view: "back", lm: [8, 20, 26], fn: "Pulls the arm back — posture & round shoulders from behind." },
  { id: "upper-back", n: 13, name: "Upper Back", groups: ["Upper Back"], view: "back", lm: [8, 20, 25], fn: "Squeezes the shoulder blades together (rows)." },
  { id: "lats", n: 14, name: "Lats", groups: ["Lats"], view: "back", lm: [8, 20, 25], fn: "Pulls the arms down & back — the V-taper." },
  { id: "triceps", n: 15, name: "Triceps", groups: ["Triceps"], view: "back", lm: [6, 14, 18], fn: "Straightens the elbow; ~2/3 of upper-arm size." },
  { id: "lower-back", n: 16, name: "Lower Back", groups: ["Lower Back"], view: "back", lm: [0, 8, 12], fn: "Keeps the spine straight under load (hinges)." },
  { id: "glutes", n: 17, name: "Glutes", groups: ["Glutes"], view: "back", lm: [0, 12, 16], fn: "Extends the hip and opens it to the side." },
  { id: "hamstrings", n: 18, name: "Hamstrings", groups: ["Hamstrings"], view: "back", lm: [6, 16, 20], fn: "Bends the knee and extends the hip." },
  { id: "calves", n: 19, name: "Calves", groups: ["Calves"], view: "both", lm: [8, 16, 20], fn: "Points the foot; stand-up & jump power." },
];
export const MBY = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));

// ---- left-half shapes ----
const BASE_FRONT = "M100 44 L93 45 L92 53 C82 57 64 58 52 64 C43 70 40 82 41 98 C39 118 39 136 40 148 C36 166 32 182 30 196 C28 206 29 214 33 213 C37 212 40 206 42 199 C46 186 51 170 57 152 C61 136 64 122 66 110 L68 112 C68 132 68 152 70 170 C64 198 62 230 66 262 C68 274 69 282 69 290 C67 316 71 340 73 362 C71 372 69 380 75 382 L92 382 C92 372 88 366 88 356 C90 330 92 306 90 288 C92 274 94 266 96 250 L100 232 Z";
const FRONT = {
  traps: "M92 51 C86 56 79 59 69 62 L92 63 Z",
  "delt-front": "M70 66 C64 67 59 71 57 77 C60 82 63 88 64 96 C66 86 68 78 72 70 Z",
  "delt-side": "M68 63 C56 63 47 71 46 85 C46 93 48 99 51 103 C53 94 56 85 57 77 C59 70 63 66 68 63 Z",
  chest: "M73 68 C81 65 92 65 98 67 L98 99 C90 104 78 104 70 98 C65 92 64 80 73 68 Z",
  biceps: "M50 107 C46 117 44 131 46 145 L58 145 C60 131 62 117 61 105 C57 102 53 103 50 107 Z",
  forearms: "M45 151 C40 166 36 182 34 195 L44 197 C50 184 55 168 58 151 Z",
  abs: "M86 105 h12 v12 h-12 Z M86 120 h12 v12 h-12 Z M86 135 h12 v12 h-12 Z M86 150 h12 v20 C93 172 89 170 86 166 Z",
  obliques: "M71 104 C75 120 77 140 80 160 L84 162 C84 142 84 122 84 106 C80 104 75 103 71 104 Z",
  quads: "M74 178 C67 200 64 230 68 257 C72 267 82 271 90 265 C94 238 95 210 93 184 C87 177 80 175 74 178 Z",
  adductors: "M94 186 C97 198 99 212 99 226 L97 238 C95 222 94 204 94 186 Z",
  shins: "M74 292 C72 312 74 332 77 352 L82 352 C82 332 82 312 80 292 Z",
  calves: "M84 290 C89 302 91 322 88 344 L84 344 C84 324 84 306 84 290 Z",
};
const BACK = {
  traps: "M100 47 C94 55 82 59 68 63 C79 70 91 82 100 102 Z",
  "delt-rear": "M68 63 C56 63 47 71 46 85 C46 93 48 99 51 103 C55 90 61 78 70 70 Z",
  "upper-back": "M74 71 C83 78 92 89 98 104 L98 114 C88 110 78 102 72 92 C70 84 71 76 74 71 Z",
  lats: "M71 94 C77 105 88 113 98 117 L98 141 C90 150 82 156 78 162 C74 147 70 126 66 109 C67 103 69 98 71 94 Z",
  triceps: "M50 105 C46 117 46 132 48 146 L58 146 C60 132 62 118 62 106 C58 102 54 102 50 105 Z",
  forearms: "M45 151 C40 166 36 182 34 195 L44 197 C50 184 55 168 58 151 Z",
  "lower-back": "M86 142 C92 142 96 143 98 145 L98 176 C92 176 87 172 84 167 C84 157 84 149 86 142 Z",
  glutes: "M77 168 C70 180 70 200 76 212 C84 220 94 218 98 212 L98 179 C92 173 85 169 77 168 Z",
  hamstrings: "M72 217 C68 237 68 256 72 272 C78 278 88 278 94 272 C96 252 96 232 94 221 C86 223 78 221 72 217 Z",
  calves: "M72 292 C66 306 68 326 74 340 C80 346 88 346 92 338 C94 320 92 304 88 292 C82 288 76 288 72 292 Z",
};

const mirror = (d) => `<g transform="translate(200 0) scale(-1 1)">${d}</g>`;
function shapes(map) {
  return Object.entries(map).map(([id, d]) => {
    const p = `<path class="m" data-m="${id}" d="${d}"/>`;
    return p + mirror(p);
  }).join("");
}
export function bodySVG(view) {
  const map = view === "front" ? FRONT : BACK;
  const base = `<circle class="base" cx="100" cy="26" r="17"/><path class="base" d="${BASE_FRONT}"/>${mirror(`<path class="base" d="${BASE_FRONT}"/>`)}`;
  return `<svg class="body-svg" viewBox="0 0 200 420" data-view="${view}" xmlns="http://www.w3.org/2000/svg">
    ${base}<g class="muscles">${shapes(map)}</g><g class="pins"></g></svg>`;
}
/** Place numbered pins at the centroid of each muscle's LEFT shape (after insertion into DOM). */
export function placePins(svg) {
  const g = svg.querySelector(".pins"); const done = new Set();
  svg.querySelectorAll(".muscles > path.m").forEach((p) => {
    const id = p.dataset.m; if (done.has(id) || !MBY[id]) return; done.add(id);
    const b = p.getBBox();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    g.insertAdjacentHTML("beforeend", `<g class="pin"><circle cx="${cx}" cy="${cy}" r="5"/><text x="${cx}" y="${cy + .3}">${MBY[id].n}</text></g>`);
  });
}
/** Union bbox of both sides of a muscle. */
export function muscleBox(svg, id) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  svg.querySelectorAll(`path.m[data-m="${id}"]`).forEach((p) => {
    const b = p.getBBox(); const m = p.getCTM(); const root = svg.getCTM();
    // convert to svg user space (account for mirror transform)
    const pts = [[b.x, b.y], [b.x + b.width, b.y + b.height]].map(([x, y]) => {
      const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; return pt.matrixTransform(root.inverse().multiply(m));
    });
    for (const q of pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  });
  return [x0, y0, x1 - x0, y1 - y0];
}
/** Smoothly animate viewBox to target [x,y,w,h]. */
export function zoomTo(svg, target, ms = 520) {
  const from = svg.getAttribute("viewBox").split(" ").map(Number);
  const t0 = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 4);
  cancelAnimationFrame(svg._raf);
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms), k = ease(t);
    svg.setAttribute("viewBox", from.map((v, i) => (v + (target[i] - v) * k).toFixed(2)).join(" "));
    if (t < 1) svg._raf = requestAnimationFrame(step);
  };
  svg._raf = requestAnimationFrame(step);
}
export const FULL = [0, 0, 200, 420];
export const HEAT = ["var(--mus)", "color-mix(in oklab, var(--accent) 22%, var(--mus))", "color-mix(in oklab, var(--accent) 45%, var(--mus))", "color-mix(in oklab, var(--accent) 70%, var(--mus))", "var(--accent)"];
