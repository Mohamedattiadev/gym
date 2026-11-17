// Rotatable 3D body (lazy-loaded only on the hero "3D" tab).
// Model + motions: OpenGym3D (MIT, SylvesterAssiamahGK), MakeHuman mesh; built by tools/og3d/build.mjs.
// Muscle paint: body.glb vertex attribute _MUSCLE (one muscle id per vertex), primary = accent, secondary = light accent.
import * as THREE from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/three/meshopt_decoder.module.js";

const IDS = ["chest", "delt-front", "delt-side", "biceps", "forearms", "abs", "obliques", "quads", "adductors", "shins",
  "traps", "delt-rear", "upper-back", "lats", "triceps", "lower-back", "glutes", "hamstrings", "calves"];
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let bodyP = null, adjP = null;
const anims = {};
const getBody = () => (bodyP ??= loader.loadAsync("3d/body.glb"));
const getAnim = (id) => (anims[id] ??= id.startsWith("p:") ? fetch(`3d/poses/${id.slice(2)}.json`).then((r) => r.json()) : loader.loadAsync(`3d/anim/${id}.glb`).then((g) => g.animations[0]));

/* ---- authored motions (19b): app/3d/poses/<family>.json ----
   {base:{...}, keys:[start, (mid), end], ecc:"out"|"back"}  — each key = segment directions in body space
   (x = the body's LEFT/outward for sided segments (mirrored for the right side), y = up, z = forward),
   e.g. "uarm":[0,-1,0.2], "farmR":[...]; "tw":{"farm":deg} twists a segment about its own axis;
   "frame":deg pitches the whole body (-90 = lying on the back, author as if standing); "plant":false = feet not planted.
   Interpolated per sample (directions slerped), so planted feet stay put; eccentric half is slower. */
const SEG = { torso: ["spine05", "neck01"], neck: ["neck01", "head"], clav: ["clavicle", "upperarm01"], uarm: ["upperarm01", "lowerarm01"],
  farm: ["lowerarm01", "wrist"], hand: ["wrist", "finger3-1"], thigh: ["upperleg01", "lowerleg01"], shin: ["lowerleg01", "foot"], foot: ["foot", "toe3-1"] };
const SIDED = new Set(["clav", "uarm", "farm", "hand", "thigh", "shin", "foot"]);
const ORDER = ["torso", "neck", ...["clav", "uarm", "farm", "hand", "thigh", "shin", "foot"].flatMap((k) => [k + "L", k + "R"])];
const ezs = (u) => u * u * (3 - 2 * u);
function resolve(spec) { // {uarm:[..]} -> {uarmL:[..], uarmR:[-x..]}; explicit L/R win
  const d = {}, tw = {};
  for (const [k, v] of Object.entries(spec)) {
    if (k === "tw") { for (const [s, deg] of Object.entries(v)) { if (SIDED.has(s)) { tw[s + "L"] ??= deg; tw[s + "R"] ??= -deg; } else tw[s] = deg; } continue; }
    if (!SEG[k.replace(/[LR]$/, "")] || !Array.isArray(v)) continue;
    if (SIDED.has(k)) { d[k + "L"] ??= v; d[k + "R"] ??= [-v[0], v[1], v[2]]; } else d[k] = v;
  }
  for (const [k, v] of Object.entries(spec.tw || {})) if (/[LR]$/.test(k)) tw[k] = v;
  for (const [k, v] of Object.entries(spec)) if (/[LR]$/.test(k) && SEG[k.slice(0, -1)]) d[k] = v;
  return { d, tw, frame: spec.frame || 0, pos: spec.pos || [0, 0, 0] };
}
function buildClip(model, P) {
  const bones = {}; model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const B = (n, side = "") => bones[(n + side).replace(/[.-]/g, "")] || bones[n + side];
  const seg = {}; for (const k of ORDER) { const side = /[LR]$/.test(k) && SIDED.has(k.slice(0, -1)) ? k.slice(-1) : ""; const [a, b] = SEG[side ? k.slice(0, -1) : k]; seg[k] = [B(a, side), B(b, side)]; }
  const root = bones.root, all = Object.values(bones), rest = all.map((b) => b.quaternion.clone()), rootPos = root.position.clone();
  const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
  model.updateMatrixWorld(true);
  const pw = (b) => b.getWorldPosition(V()), dir = (k) => pw(seg[k][1]).sub(pw(seg[k][0])).normalize();
  const restDir = { footL: dir("footL"), footR: dir("footR") };
  const keys = P.keys.map((k) => resolve({ ...P.base, ...k }));
  const plant = P.plant ?? "feet", pb = plant === "hands" ? ["handL", "handR"] : ["footL", "footR"]; let anchor = null;
  const pose = (r) => {
    all.forEach((b, i) => b.quaternion.copy(rest[i])); root.position.copy(rootPos);
    const F = Q().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(r.frame));
    if (r.frame) { root.quaternion.premultiply(F); }
    model.updateMatrixWorld(true);
    const target = { ...r.d }; if (plant === "feet") { target.footL ??= restDir.footL.toArray(); target.footR ??= restDir.footR.toArray(); }
    for (const k of ORDER) {
      const [b, e] = seg[k]; if (!b || !e || (!target[k] && r.tw[k] == null)) continue;
      const bw = b.getWorldQuaternion(Q()), par = b.parent.getWorldQuaternion(Q()).invert();
      if (target[k]) { const t = new THREE.Vector3(...target[k]).normalize(); if (!(k in restDir) || r.d[k]) t.applyQuaternion(F); bw.premultiply(Q().setFromUnitVectors(dir(k), t)); }
      b.quaternion.copy(par.multiply(bw)); b.updateMatrixWorld(true);
      if (r.tw[k]) { const tq = Q().setFromAxisAngle(dir(k), THREE.MathUtils.degToRad(r.tw[k])); b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert().multiply(tq.multiply(b.getWorldQuaternion(Q())))); b.updateMatrixWorld(true); }
    }
    root.position.add(new THREE.Vector3(...r.pos));
    if (plant) { model.updateMatrixWorld(true); const f = pw(seg[pb[0]][0]).add(pw(seg[pb[1]][0])).multiplyScalar(.5);
      if (!anchor) anchor = new THREE.Vector3(f.x, plant === "feet" ? restDir.y0 : f.y, f.z); root.position.add(anchor.clone().sub(f)); }
    model.updateMatrixWorld(true);
  };
  { model.updateMatrixWorld(true); restDir.y0 = (pw(seg.footL[0]).y + pw(seg.footR[0]).y) / 2; }
  const lerpR = (a, b, u) => { const d = {}; for (const k of new Set([...Object.keys(a.d), ...Object.keys(b.d)])) {
      const va = new THREE.Vector3(...(a.d[k] || b.d[k])).normalize(), vb = new THREE.Vector3(...(b.d[k] || a.d[k])).normalize();
      d[k] = va.clone().applyQuaternion(Q().slerp(Q().setFromUnitVectors(va, vb), u)).toArray(); }
    const tw = {}; for (const k of new Set([...Object.keys(a.tw), ...Object.keys(b.tw)])) tw[k] = (a.tw[k] || 0) * (1 - u) + (b.tw[k] || 0) * u;
    return { d, tw, frame: a.frame + (b.frame - a.frame) * u, pos: a.pos.map((x, i) => x + (b.pos[i] - x) * u) }; };
  const at = (u) => { const n = keys.length - 1, x = Math.min(n - 1e-6, u * n), i = Math.floor(x); return lerpR(keys[i], keys[i + 1], x - i); };
  const ecc = P.ecc === "out", T1 = ecc ? 1.6 : 1.0, T2 = ecc ? 1.0 : 1.6, H0 = .35, H1 = .25, N = 18;
  const times = [], samples = [];
  const push = (t, u) => { times.push(t); samples.push(u); };
  push(0, 0); push(H0, 0);
  for (let i = 1; i <= N; i++) push(H0 + T1 * i / N, ezs(i / N));
  push(H0 + T1 + H1, 1);
  for (let i = 1; i <= N; i++) push(H0 + T1 + H1 + T2 * i / N, 1 - ezs(i / N));
  const moved = [root, ...new Set(Object.values(seg).map((s) => s[0]).filter(Boolean))];
  const qv = moved.map(() => []), pv = [];
  pose(keys[0]); // fixes the anchor at the start pose
  for (const u of samples) { pose(at(u)); moved.forEach((b, i) => qv[i].push(...b.quaternion.toArray())); pv.push(...root.position.toArray()); }
  all.forEach((b, i) => b.quaternion.copy(rest[i])); root.position.copy(rootPos); model.updateMatrixWorld(true);
  const tracks = moved.map((b, i) => new THREE.QuaternionKeyframeTrack(`${b.uuid}.quaternion`, times, qv[i]));
  tracks.push(new THREE.VectorKeyframeTrack(`${root.uuid}.position`, times, pv));
  const clip = new THREE.AnimationClip("pose", times.at(-1), tracks); clip.props = P.fixed || []; clip.eqProps = P.props || []; return clip;
}

/** Simple props: "bar" between the palms, "cbar" short cable handle, "db" in each hand, "pullbar" above the hands, "bench" under the back (lying moves). */
function makeProp(kinds, model, dark) {
  kinds = kinds.filter(Boolean); if (!kinds.length) return null;
  const bones = {}; model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const hand = ["L", "R"].map((s) => [bones["wrist" + s], bones["finger3-1" + s] || bones["finger31" + s]]);
  const mat = new THREE.MeshStandardMaterial({ color: dark ? 0x5a5c60 : 0x3b3d42, roughness: .45, metalness: .6 });
  const pad = new THREE.MeshStandardMaterial({ color: dark ? 0x3a3c40 : 0x55585e, roughness: .8 });
  const cyl = (r, l, m = mat) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 20), m); o.rotation.z = Math.PI / 2; return o; };
  const g = new THREE.Group(), ups = [];
  const inv = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
  const loc = (bone, v) => bone.getWorldPosition(v).applyMatrix4(inv);
  const grip = (h, f = .35) => loc(h[0], a).lerp(loc(h[1], b), f).clone();
  for (const kind of kinds) {
    if (kind === "bar" || kind === "pullbar" || kind === "cbar") { const o = new THREE.Group(); o.add(cyl(kind === "pullbar" ? .018 : .014, kind === "bar" ? 1.8 : kind === "cbar" ? .5 : 1.3));
      if (kind === "bar") for (const x of [-.74, .74]) { const p = cyl(.17, .05); p.position.x = x; o.add(p); } g.add(o);
      ups.push(() => { const L = grip(hand[0], kind === "bar" ? .35 : .5), R = grip(hand[1], kind === "bar" ? .35 : .5); o.position.copy(L).add(R).multiplyScalar(.5); o.quaternion.setFromUnitVectors(X, c.copy(L).sub(R).normalize()); });
    } else if (kind === "db") for (let i = 0; i < 2; i++) { const o = new THREE.Group(); o.add(cyl(.016, .16)); for (const x of [-.09, .09]) { const p = cyl(.05, .05); p.position.x = x; o.add(p); } g.add(o);
      ups.push(() => { const h = hand[i]; o.position.copy(grip(h)); loc(h[0], a); loc(h[1], b); // handle across the palm
        const n = b.sub(a).normalize(), side = c.set(i ? -1 : 1, 0, 0); o.quaternion.setFromUnitVectors(X, side.sub(n.multiplyScalar(side.dot(n))).normalize()); });
    } else if (kind === "bench") { // pad under the back, pitched to follow the torso (flat or incline); seat block under the hips when inclined
      const o = new THREE.Mesh(new THREE.BoxGeometry(.3, .07, 1.2), pad), seat = new THREE.Mesh(new THREE.BoxGeometry(.3, .07, .38), pad), legs = new THREE.Mesh(new THREE.BoxGeometry(.08, 1, .08), mat); g.add(o, seat, legs);
      const t = new THREE.Vector3(), n = new THREE.Vector3(), x = new THREE.Vector3(), M = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);
      ups.push(() => { const s5 = loc(bones.spine05, a).clone(), nk = loc(bones.neck01, b).clone(); t.subVectors(nk, s5).normalize();
        n.copy(UP).addScaledVector(t, -UP.dot(t)).normalize(); x.crossVectors(n, t); o.quaternion.setFromRotationMatrix(M.makeBasis(x, n, t));
        const fl = Math.min(loc(bones.footL, c).y, loc(bones.footR, c).y) - .07, inc = t.y > .3;
        o.position.copy(s5).lerp(nk, .5).addScaledVector(n, -.13).addScaledVector(t, inc ? .28 : -.28);
        seat.visible = inc; const sy = s5.y - .15; seat.position.set(s5.x, sy, s5.z); seat.rotation.y = Math.atan2(t.x, t.z);
        const base = inc ? sy : o.position.y, h = Math.max(.1, base - fl); legs.scale.y = h; legs.position.set(inc ? s5.x : o.position.x, base - h / 2, inc ? s5.z : o.position.z); });
    } else if (kind === "seat") { const o = new THREE.Mesh(new THREE.BoxGeometry(.42, .08, .4), pad); const post = new THREE.Mesh(new THREE.BoxGeometry(.07, 1, .07), mat); o.add(post); g.add(o);
      ups.push(() => { const p = loc(bones.spine05, a), fl = Math.min(loc(bones.footL, c).y, loc(bones.footR, c).y) - .07, top = p.y - .14;
        o.position.set(p.x, top, p.z + .06); const h = Math.max(.1, top - fl); post.scale.y = h; post.position.set(0, -h / 2, 0); });
    } else if (kind === "dipbars") for (let i = 0; i < 2; i++) { const o = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .6, 16), mat); o.rotation.x = Math.PI / 2; g.add(o);
      ups.push(() => { o.position.copy(grip(hand[i], .3)); o.position.y -= .02; });
    }
  }
  return { g, update() { if (g.parent) { g.parent.updateMatrixWorld(true); inv.copy(g.parent.matrixWorld).invert(); } ups.forEach((f) => f()); } };
}

/** CSS colour (any syntax, incl. color-mix) -> THREE.Color */
function cssColor(expr) {
  const c = document.createElement("canvas"); c.width = c.height = 1; const x = c.getContext("2d");
  const probe = document.createElement("i"); probe.style.color = expr; document.body.appendChild(probe);
  x.fillStyle = getComputedStyle(probe).color; probe.remove(); x.fillRect(0, 0, 1, 1);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data; return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

function adjacency(geo) {
  const n = geo.attributes.position.count, idx = geo.index.array, sets = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2]; sets[a].add(b).add(c); sets[b].add(a).add(c); sets[c].add(a).add(b); }
  // weld seams: vertices at the same position share neighbours
  const key = new Map(), p = geo.attributes.position;
  for (let i = 0; i < n; i++) { const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`; const j = key.get(k); if (j === undefined) key.set(k, i); else { sets[i].add(j); sets[j].add(i); } }
  return sets.map((s) => Int32Array.from(s));
}

function paint(geo, labels, adj, primary, secondary) {
  const n = labels.length, P = new Float32Array(n), S = new Float32Array(n);
  for (let i = 0; i < n; i++) { const m = IDS[labels[i] - 1]; if (primary.includes(m)) P[i] = 1; else if (secondary.includes(m)) S[i] = 1; }
  for (const F of [P, S]) for (let r = 0; r < 4; r++) { const s = F.slice(); for (let i = 0; i < n; i++) { const a = adj[i]; if (!a.length) continue; let t = 0; for (let k = 0; k < a.length; k++) t += s[a[k]]; F[i] = .5 * s[i] + .5 * t / a.length; } }
  // neutral, desaturated skin so the worked muscles pop: main = saturated accent, helpers = light accent
  const dark = document.documentElement.dataset.theme === "dark";
  const base = cssColor(dark ? "#8d8781" : "#cdc7c2"), pri = cssColor("color-mix(in oklab, var(--accent) 88%, #ff2a00)"), sec = base.clone().lerp(pri, .42);
  const col = new Float32Array(n * 3), glow = new Float32Array(n), c = new THREE.Color(), ss = (x) => { const t = Math.min(1, Math.max(0, (x - .25) / .35)); return t * t * (3 - 2 * t); };
  for (let i = 0; i < n; i++) { const p = ss(P[i]); c.copy(base).lerp(sec, ss(S[i])).lerp(pri, p); col.set([c.r, c.g, c.b], i * 3); glow[i] = p; }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("glow", new THREE.BufferAttribute(glow, 1));
}

export const VIEWS = { front: 0, side: -Math.PI / 2, back: Math.PI };

/** Mount into `el`. opts: {primary, secondary, move (anim id or null), view}. Returns {setView, dispose}. */
export async function mount3d(el, { primary = [], secondary = [], move = null, view = "front", at = null, prop: eqProp = null } = {}) {
  let [gltf, clip] = await Promise.all([getBody(), move ? getAnim(move).catch(() => null) : null]);
  if (!el.isConnected) return { setView() {}, dispose() {} };
  // each mount gets its own copy of the scene (shared geometry is repainted per exercise, so clone it)
  const src = gltf.scene; const scene3 = new THREE.Scene(); const model = cloneSkinned(src);
  let mesh; model.traverse((o) => { if (o.isSkinnedMesh || o.isMesh) mesh = o; });
  mesh.geometry = mesh.geometry.clone(); mesh.frustumCulled = false; const la = mesh.geometry.attributes._muscle, labels = Uint8Array.from({ length: la.count }, (_, i) => Math.round(la.getX(i) * (la.normalized ? 255 : 1)));
  adjP ??= Promise.resolve(adjacency(mesh.geometry));
  paint(mesh.geometry, labels, await adjP, primary, secondary);
  mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 });
  mesh.material.onBeforeCompile = (sh) => { // subtle self-glow on the main muscles (per-vertex "glow" attribute)
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float glow;\nvarying float vGlow;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = glow;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vGlow;").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * .32;");
  };
  if (clip && !clip.tracks) { const P = clip; clip = buildClip(model, P); if (P.yaw) model.rotation.y = THREE.MathUtils.degToRad(P.yaw); }
  const pivot = new THREE.Group(); pivot.add(model); scene3.add(pivot);
  scene3.add(new THREE.HemisphereLight(0xffffff, 0x8a7f78, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(1.2, 2.4, 3); scene3.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, .9); rim.position.set(-2, 1.5, -2.5); scene3.add(rim);

  const mixer = clip ? new THREE.AnimationMixer(model) : null;
  const prop = makeProp(clip ? [...(clip.props || []), (clip.eqProps || []).includes(eqProp) ? eqProp : null] : [], model, document.documentElement.dataset.theme === "dark"); if (prop) pivot.add(prop.g);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const act = mixer ? mixer.clipAction(clip) : null;
  if (act) { act.play(); if (reduce || at != null) act.paused = true; }

  // framing: union of bone positions over the clip (or rest pose)
  const box = new THREE.Box3(), v = new THREE.Vector3();
  const sample = () => { model.updateMatrixWorld(true); mesh.skeleton.bones.forEach((b) => { if (!/finger|toe|oris|tongue|levator|special|eye|oculi|orbic|tempor|risor|jaw/.test(b.name)) box.expandByPoint(b.getWorldPosition(v)); }); if (prop) { prop.update(); prop.g.updateMatrixWorld(true); const pb = new THREE.Box3().setFromObject(prop.g); pb.min.y = Math.max(pb.min.y, box.min.y - .05); box.union(pb); } };
  const seek = (t) => { act.time = t; mixer.update(0); };
  if (mixer) { for (let i = 0; i <= 8; i++) { seek(clip.duration * i / 8); sample(); } seek(at != null ? clip.duration * at : reduce ? clip.duration / 2 : 0); prop?.update(); } else sample();
  box.expandByScalar(.04); const ctr = box.getCenter(new THREE.Vector3()); model.position.sub(new THREE.Vector3(ctr.x, 0, ctr.z));
  prop?.update();
  const size = box.getSize(new THREE.Vector3()); const reach = Math.max(size.x, size.z);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const cv = renderer.domElement; cv.className = "v3d-cv"; el.appendChild(cv);
  const cam = new THREE.PerspectiveCamera(28, 1, .05, 30);
  let yaw = VIEWS[view] ?? 0, yawT = yaw, pitch = .06, W = 0, H = 0, dirty = true, zoom = 1, zoomT = 1, panY = 0;
  const ZMAX = 3.5, halfH = size.y / 2;
  const fit = () => {
    W = el.clientWidth; H = el.clientHeight || 300; renderer.setSize(W, H, false); cam.aspect = W / H;
    // keep the body inside the free band between the top toggle and the bottom controls
    const pt = 44, pb = 72, band = Math.max(.4, (H - pt - pb) / H), tn = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const need = (Math.max(size.y / 2 / tn / band, reach / 2 / tn / cam.aspect / .96) + reach / 9) / zoom;
    panY = Math.max(-halfH * (1 - 1 / zoom), Math.min(halfH * (1 - 1 / zoom), panY)); const ty = ctr.y + panY;
    cam.position.set(0, ty + Math.sin(pitch) * need, Math.cos(pitch) * need); cam.lookAt(0, ty, 0);
    cam.setViewOffset(W, H, 0, (pb - pt) / 2, W, H); cam.updateProjectionMatrix(); dirty = true;
  };
  const ro = new ResizeObserver(fit); ro.observe(el); fit();

  // drag = rotate (vertical drag tilts; when zoomed in it moves up/down the body), pinch / wheel / +− = zoom, double-tap = reset
  let drag = null; const pts = new Map(); let pinch = null;
  const setZoom = (z) => { zoomT = Math.max(1, Math.min(ZMAX, z)); el.classList.toggle("zoomed", zoomT > 1.01); loop(); };
  cv.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, e); cv.setPointerCapture(e.pointerId);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: zoomT }; drag = null; }
    else drag = { x: e.clientX, y: e.clientY, yaw: yawT, pitch, pan: panY }; });
  cv.addEventListener("pointermove", (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; setZoom(pinch.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d); return; }
    if (!drag) return; yawT = drag.yaw + (e.clientX - drag.x) * .012; yaw = yawT;
    if (zoomT > 1.01) panY = drag.pan + (e.clientY - drag.y) * size.y / H / zoom; else pitch = Math.max(-.25, Math.min(.6, drag.pitch + (e.clientY - drag.y) * .006));
    fit(); });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); setZoom(zoomT * Math.exp(-e.deltaY * .0015)); }, { passive: false });
  const reset = () => { zoomT = 1; panY = 0; pitch = .06; el.classList.remove("zoomed"); fit(); loop(); };
  cv.addEventListener("dblclick", reset);

  let visible = true, raf = 0, last = performance.now(), dead = false;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }); io.observe(el);
  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame((now) => {
      if (dead) return; if (!el.isConnected) return dispose();
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (Math.abs(yawT - yaw) > 1e-3) { yaw += (yawT - yaw) * Math.min(1, dt * 9); dirty = true; } else yaw = yawT;
      if (Math.abs(zoomT - zoom) > 1e-3) { zoom += (zoomT - zoom) * Math.min(1, dt * 12); fit(); } else if (zoom !== zoomT) { zoom = zoomT; fit(); }
      pivot.rotation.y = yaw;
      if (act && !act.paused) { mixer.update(dt); prop?.update(); dirty = true; }
      if (dirty) { renderer.render(scene3, cam); dirty = false; }
      if (visible && !document.hidden) loop();
    });
  }
  const onVis = () => { if (!document.hidden) { last = performance.now(); loop(); } };
  document.addEventListener("visibilitychange", onVis);
  loop();
  function dispose() {
    if (dead) return; dead = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", onVis);
    mesh.geometry.dispose(); mesh.material.dispose(); renderer.dispose(); renderer.forceContextLoss(); cv.remove();
  }
  return {
    setView(k) { const t = VIEWS[k] ?? 0; const d = Math.round((yawT - t) / (2 * Math.PI)); yawT = t + d * 2 * Math.PI; loop(); },
    togglePlay() { if (!act) return false; act.paused = !act.paused; last = performance.now(); loop(); return !act.paused; },
    setSpeed(r) { if (act) act.timeScale = r; },
    zoomBy(f) { setZoom(zoomT * f); }, reset,
    dispose,
  };
}

// minimal SkeletonUtils.clone (skinned meshes need their bones re-bound)
function cloneSkinned(source) {
  const map = new Map(), clone = source.clone();
  (function walk(a, b) { map.set(a, b); for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]); })(source, clone);
  clone.traverse((n) => { if (!n.isSkinnedMesh) return; let s = null; for (const [k, v] of map) if (v === n) s = k;
    n.skeleton = s.skeleton.clone(); n.skeleton.bones = s.skeleton.bones.map((b) => map.get(b)); n.bind(n.skeleton, s.bindMatrix); });
  return clone;
}
