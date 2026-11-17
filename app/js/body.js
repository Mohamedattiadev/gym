// Muscle list + body map helpers. Shapes come from anatomy.js (open-licensed source, see CREDIT).
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

import { VIEWBOX, ANATOMY } from "./anatomy.js";
export { CREDIT } from "./anatomy.js";

export function bodySVG(view) {
  return `<svg class="body-svg" viewBox="${VIEWBOX.join(" ")}" data-view="${view}" xmlns="http://www.w3.org/2000/svg"><g class="muscles">${ANATOMY[view]}</g></svg>`;
}
/** Union bbox of both sides of a muscle. */
export function muscleBox(svg, id, attr = "m") {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  svg.querySelectorAll(`path.m[data-${attr}="${id}"]`).forEach((p) => {
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
export const FULL = VIEWBOX;
export const HEAT = ["var(--mus)", "color-mix(in oklab, var(--accent) 22%, var(--mus))", "color-mix(in oklab, var(--accent) 45%, var(--mus))", "color-mix(in oklab, var(--accent) 70%, var(--mus))", "var(--accent)"];
