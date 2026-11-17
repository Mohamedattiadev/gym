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
    if (t < 1) svg._raf = requestAnimationFrame(step); else svg._pz?.();
  };
  svg._raf = requestAnimationFrame(step);
}
export const FULL = VIEWBOX;

/** 18b: zoom + pan on anatomy SVGs that share one viewBox (front + back move together).
 *  pinch / wheel / drag (when zoomed) / double-tap (zoomed -> whole body, else 2x there); a tap that did not move still clicks. */
export function panZoom(host, svgs, { minW = FULL[2] / 5, signal } = {}) {
  const on = { signal }, s0 = svgs[0];
  const vb = () => s0.getAttribute("viewBox").split(" ").map(Number);
  const asp = () => { const r = s0.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r.width / r.height : FULL[2] / FULL[3]; };
  const maxH = (a) => Math.max(FULL[3], FULL[2] / a);
  /* fill the svg box (no letterbox), clamp size and keep the view on the body */
  const fit = ([x, y, w, h]) => {
    const a = asp(), cx = x + w / 2, cy = y + h / 2;
    if (w / h < a) w = h * a; else h = w / a;
    if (h > maxH(a)) { h = maxH(a); w = h * a; }
    if (w < minW) { w = minW; h = w / a; }
    const cl = (c, s, o, S) => (s >= S ? o + S / 2 : Math.min(o + S - s / 2, Math.max(o + s / 2, c)));
    return [cl(cx, w, FULL[0], FULL[2]) - w / 2, cl(cy, h, FULL[1], FULL[3]) - h / 2, w, h];
  };
  const zoomed = (v = vb()) => v[3] < maxH(asp()) * .97;
  const mark = () => host.classList.toggle("zoomed", zoomed());
  svgs.forEach((s) => (s._pz = mark));
  const apply = (v) => { svgs.forEach((s) => { cancelAnimationFrame(s._raf); s.setAttribute("viewBox", v.map((n) => n.toFixed(2)).join(" ")); }); mark(); };
  const go = (v, ms = 320) => { v = fit(v); if (matchMedia("(prefers-reduced-motion: reduce)").matches) return apply(v); svgs.forEach((s) => zoomTo(s, v, ms)); };
  const svgAt = (x, y) => svgs.find((s) => { const r = s.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }) || s0;
  const toUser = (x, y) => { const s = svgAt(x, y), p = s.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(s.getScreenCTM().inverse()); };
  const around = (v, f, u) => [u.x - (u.x - v[0]) / f, u.y - (u.y - v[1]) / f, v[2] / f, v[3] / f];
  const center = (v) => ({ x: v[0] + v[2] / 2, y: v[1] + v[3] / 2 });
  const zoomAt = (f, x, y) => { const v = vb(); apply(fit(around(v, f, toUser(x, y)))); };
  const panBy = (dx, dy) => { const v = vb(), k = s0.getScreenCTM()?.a || 1; apply(fit([v[0] - dx / k, v[1] - dy / k, v[2], v[3]])); };
  const full = () => go(FULL);
  const pts = new Map(); let start = null, moved = false, lastTap = 0, framed = null;
  /* the box can change size later (figure image loads, rotation): keep the framing, else keep filling the box */
  let lastA = 0; const ro = new ResizeObserver(() => requestAnimationFrame(() => {
    if (!s0.isConnected) return ro.disconnect(); const a = asp(); if (Math.abs(a - lastA) < .01) return; lastA = a;
    if (framed) api.frame(framed, 0); else if (zoomed()) apply(fit(vb())); }));
  ro.observe(s0); signal?.addEventListener("abort", () => ro.disconnect());
  host.addEventListener("pointerdown", (e) => { framed = null;
    if (e.button > 0 || e.target.closest("button, a")) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { start = { x: e.clientX, y: e.clientY }; moved = false; } else moved = true;
  }, on);
  host.addEventListener("pointermove", (e) => {
    const p = pts.get(e.pointerId); if (!p) return; const q = { x: e.clientX, y: e.clientY };
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y), m0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pts.set(e.pointerId, q); const [c, d] = [...pts.values()], d1 = Math.hypot(c.x - d.x, c.y - d.y), m1 = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 };
      if (d0 > 0) zoomAt(d1 / d0, m1.x, m1.y); panBy(m1.x - m0.x, m1.y - m0.y); return;
    }
    pts.set(e.pointerId, q);
    if (!moved && Math.hypot(q.x - start.x, q.y - start.y) < 6) return;
    if (!zoomed()) return; // whole body: let the page scroll
    if (!moved) { moved = true; try { host.setPointerCapture(e.pointerId); } catch {} }
    panBy(q.x - p.x, q.y - p.y);
  }, on);
  const up = (e) => {
    if (!pts.delete(e.pointerId)) return;
    if (e.type === "pointerup" && !pts.size && !moved) { // double-tap
      const t = e.timeStamp; if (t - lastTap < 320) { lastTap = 0; zoomed() ? full() : go(around(vb(), 2.2, toUser(e.clientX, e.clientY))); } else lastTap = t;
    }
  };
  host.addEventListener("pointerup", up, on); host.addEventListener("pointercancel", up, on);
  host.addEventListener("click", (e) => { if (moved) { moved = false; e.stopPropagation(); e.preventDefault(); } }, { capture: true, signal });
  host.addEventListener("wheel", (e) => {
    const f = Math.exp(-e.deltaY * .0015); if (f < 1 && !zoomed()) return; // zooming out at whole body = normal page scroll
    e.preventDefault(); zoomAt(f, e.clientX, e.clientY);
  }, { passive: false, signal });
  const api = {
    zoomBy: (f) => { framed = null; go(around(vb(), f, center(vb()))); },
    full: () => { framed = null; full(); }, zoomed,
    /** open framed on these muscles (padded); whole body when they cover most of it */
    frame(ids, ms = 560) {
      framed = ids; lastA = asp();
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const s of svgs) for (const id of ids) { if (!s.querySelector(`path.m[data-m="${id}"]`)) continue;
        const [x, y, w, h] = muscleBox(s, id); if (!(w > 0)) continue; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); }
      if (!(x1 > x0)) return;
      const pad = Math.max(x1 - x0, y1 - y0) * .12 + 6, v = fit([x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2]);
      if (v[3] < maxH(asp()) * .85) ms ? go(v, ms) : apply(v); else apply(fit(FULL));
    },
  };
  return api;
}
export const HEAT = ["var(--mus)", "color-mix(in oklab, var(--accent) 22%, var(--mus))", "color-mix(in oklab, var(--accent) 45%, var(--mus))", "color-mix(in oklab, var(--accent) 70%, var(--mus))", "var(--accent)"];
