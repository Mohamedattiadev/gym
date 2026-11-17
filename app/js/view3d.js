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
   "frame":deg pitches the whole body (-90 = lying on the back, author as if standing); "plant":false = feet not planted, "footL" = only the front (left) foot.
   Interpolated per sample (directions slerped), so planted feet stay put; eccentric half is slower. */
const SEG = { torso: ["spine05", "neck01"], neck: ["neck01", "head"], clav: ["clavicle", "upperarm01"], uarm: ["upperarm01", "lowerarm01"],
  farm: ["lowerarm01", "wrist"], hand: ["wrist", "finger3-1"], thigh: ["upperleg01", "lowerleg01"], shin: ["lowerleg01", "foot"], foot: ["foot", "toe3-1"] };
const SIDED = new Set(["clav", "uarm", "farm", "hand", "thigh", "shin", "foot"]);
const ORDER = ["torso", "neck", ...["clav", "uarm", "farm", "hand", "thigh", "shin", "foot"].flatMap((k) => [k + "L", k + "R"])];
const CURL_AXIS = new THREE.Vector3(0, 0, 1); // finger bones bend about their local z (left +, right -)
const ezs = (u) => u * u * (3 - 2 * u);
/** Bar resting on the upper traps behind the neck (high-bar back squat). get(boneName) -> Vector3 in one space. */
function backBar(get, low = false) {
  const nk = get("neck01"), s5 = get("spine05"), cl = get("clavicleL"), cr = get("clavicleR");
  const up = nk.clone().sub(s5).normalize(), left = cl.clone().sub(cr); left.addScaledVector(up, -left.dot(up)).normalize();
  const fwd = new THREE.Vector3().crossVectors(left, up).normalize();
  const c = nk.clone().addScaledVector(up, low ? -.12 : -.055).addScaledVector(fwd, low ? -.1 : -.085);
  return { c, up, fwd, left };
}
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
/* 22c: "wrong": {"<mistake index>": {all:{..}, keys:[{..}|null], base:{..}, range:[a,b], tempo:{ecc,con,bottom}, view}} in the same pose file.
   all = merged into every key, keys[i] = merged into key i, insert:[i, key] = extra key before key i (filled from key i-1, e.g. hips rising first),
   range = part of the start->end path used (half reps), tempo = seconds / bottom hold (bouncing, dropping fast). */
export function withWrong(P, W) {
  if (!W) return P;
  const keys = P.keys.map((k, i) => ({ ...k, ...(W.all || {}), ...(W.keys?.[i] || {}) }));
  if (W.insert) { const [i, k] = W.insert; keys.splice(i, 0, { ...keys[i - 1], ...k }); }
  return { ...P, base: { ...P.base, ...(W.base || {}) }, keys, range: W.range, tempo: W.tempo || P.tempo };
}
function buildClip(model, P, eqProp = null) {
  if (P.bar === "back" && eqProp === "bar") P = { ...P, ik: P.ik || "backbar", props: (P.props || []).map((k) => (k === "bar" ? "backbar" : k)) };
  const bones = {}; model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const B = (n, side = "") => bones[(n + side).replace(/[.-]/g, "")] || bones[n + side];
  const seg = {}; for (const k of ORDER) { const side = /[LR]$/.test(k) && SIDED.has(k.slice(0, -1)) ? k.slice(-1) : ""; const [a, b] = SEG[side ? k.slice(0, -1) : k]; seg[k] = [B(a, side), B(b, side)]; }
  const root = bones.root, all = Object.values(bones), rest = all.map((b) => b.quaternion.clone()), rootPos = root.position.clone();
  const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
  model.updateMatrixWorld(true);
  const pw = (b) => b.getWorldPosition(V()), dir = (k) => pw(seg[k][1]).sub(pw(seg[k][0])).normalize();
  const restDir = { footL: dir("footL"), footR: dir("footR") };
  const keys = P.keys.map((k) => resolve({ ...P.base, ...k }));
  const plant = P.plant ?? "feet", pb = plant === "hands" ? ["handL", "handR"] : plant === "footL" ? ["footL", "footL"] : ["footL", "footR"], onFeet = plant === "feet" || plant === "footL"; let anchor = null;
  const pose = (r) => {
    all.forEach((b, i) => b.quaternion.copy(rest[i])); root.position.copy(rootPos);
    const F = Q().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(r.frame));
    if (r.frame) { root.quaternion.premultiply(F); }
    model.updateMatrixWorld(true);
    const target = { ...r.d }; if (onFeet) { target.footL ??= restDir.footL.toArray(); if (plant === "feet") target.footR ??= restDir.footR.toArray(); }
    for (const k of ORDER) {
      const [b, e] = seg[k]; if (!b || !e || (!target[k] && r.tw[k] == null)) continue;
      const bw = b.getWorldQuaternion(Q()), par = b.parent.getWorldQuaternion(Q()).invert();
      if (target[k]) { const t = new THREE.Vector3(...target[k]).normalize(); if (!(k in restDir) || r.d[k]) t.applyQuaternion(F); bw.premultiply(Q().setFromUnitVectors(dir(k), t)); }
      b.quaternion.copy(par.multiply(bw)); b.updateMatrixWorld(true);
      if (r.tw[k]) { const tq = Q().setFromAxisAngle(dir(k), THREE.MathUtils.degToRad(r.tw[k])); b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert().multiply(tq.multiply(b.getWorldQuaternion(Q())))); b.updateMatrixWorld(true); }
    }
    root.position.add(new THREE.Vector3(...r.pos));
    if (plant) { model.updateMatrixWorld(true); const f = pw(seg[pb[0]][0]).add(pw(seg[pb[1]][0])).multiplyScalar(.5);
      if (!anchor) anchor = new THREE.Vector3(f.x, onFeet ? restDir.y0 : f.y, f.z); root.position.add(anchor.clone().sub(f)); }
    model.updateMatrixWorld(true);
    if (P.ik === "backbar" || P.ik === "lowbar") { // hands grip the bar on the traps just outside the shoulders, elbows down/back
      const g = backBar((n) => pw(bones[n]), P.ik === "lowbar");
      for (const sd of ["L", "R"]) {
        const sgn = sd === "L" ? 1 : -1, S = pw(seg["uarm" + sd][0]);
        const grip = g.c.clone().addScaledVector(g.left, sgn * (P.gripW ?? .29));
        const T = grip.clone().addScaledVector(g.up, -.045).addScaledVector(g.fwd, .025); // wrist sits just under/in front of the bar
        const a = ulen[sd], b = flen[sd]; let D = T.clone().sub(S); const d = Math.min(D.length(), a + b - 1e-3); const u = D.normalize();
        const pole = g.up.clone().multiplyScalar(-1).addScaledVector(g.fwd, -.35).addScaledVector(g.left, sgn * .45);
        const perp = pole.addScaledVector(u, -pole.dot(u)).normalize();
        const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
        const E = S.clone().addScaledVector(u, x).addScaledVector(perp, h), W = S.clone().addScaledVector(u, d);
        aimW("uarm" + sd, E.clone().sub(S).normalize()); aimW("farm" + sd, W.clone().sub(E).normalize());
        aimW("hand" + sd, g.up.clone().addScaledVector(g.fwd, -.55).normalize());
      }
    }
    if (grip) curl();
  };
  const aimW = (k, t) => { const [b] = seg[k]; const bw = b.getWorldQuaternion(Q()), par = b.parent.getWorldQuaternion(Q()).invert();
    bw.premultiply(Q().setFromUnitVectors(dir(k), t)); b.quaternion.copy(par.multiply(bw)); b.updateMatrixWorld(true); };
  const ulen = {}, flen = {};
  for (const sd of ["L", "R"]) { ulen[sd] = pw(seg["uarm" + sd][0]).distanceTo(pw(seg["uarm" + sd][1])); flen[sd] = pw(seg["farm" + sd][0]).distanceTo(pw(seg["farm" + sd][1])); }
  // closed grip: curl the fingers (and the thumb a bit) when something is held
  const held = [...(P.props || []), ...(P.fixed || [])].some((k) => /bar|db|cbar|pullbar|dipbars/.test(k)), grip = P.grip ?? held;
  const fingers = []; for (const sd of ["L", "R"]) for (let f = 1; f <= 5; f++) for (let j = 1; j <= 3; j++) { const fb = B(`finger${f}-${j}`, sd); if (fb) fingers.push([fb, f, j, sd]); }
  const curl = () => { for (const [fb, f, j, sd] of fingers) fb.quaternion.multiply(Q().setFromAxisAngle(CURL_AXIS, (f === 1 ? (j === 1 ? .2 : .45) : j === 1 ? 1.25 : j === 2 ? 1.35 : .9) * (sd === "L" ? 1 : -1))); };
  { model.updateMatrixWorld(true); restDir.y0 = (pw(seg.footL[0]).y + pw(seg.footR[0]).y) / 2; }
  const lerpR = (a, b, u) => { const d = {}; for (const k of new Set([...Object.keys(a.d), ...Object.keys(b.d)])) {
      const va = new THREE.Vector3(...(a.d[k] || b.d[k])).normalize(), vb = new THREE.Vector3(...(b.d[k] || a.d[k])).normalize();
      d[k] = va.clone().applyQuaternion(Q().slerp(Q().setFromUnitVectors(va, vb), u)).toArray(); }
    const tw = {}; for (const k of new Set([...Object.keys(a.tw), ...Object.keys(b.tw)])) tw[k] = (a.tw[k] || 0) * (1 - u) + (b.tw[k] || 0) * u;
    return { d, tw, frame: a.frame + (b.frame - a.frame) * u, pos: a.pos.map((x, i) => x + (b.pos[i] - x) * u) }; };
  const [ra, rb] = P.range || [0, 1];
  const at = (u) => { u = ra + (rb - ra) * u; const n = keys.length - 1, x = Math.min(n - 1e-6, u * n), i = Math.floor(x); return lerpR(keys[i], keys[i + 1], x - i); };
  const tp = P.tempo || {}, E = tp.ecc ?? 1.6, C = tp.con ?? 1.0;
  const ecc = P.ecc === "out", T1 = ecc ? E : C, T2 = ecc ? C : E, H0 = !ecc && tp.bottom != null ? tp.bottom : .35, H1 = ecc && tp.bottom != null ? tp.bottom : .25, N = 18;
  const times = [], samples = [];
  const push = (t, u) => { times.push(t); samples.push(u); };
  push(0, 0); push(H0, 0);
  for (let i = 1; i <= N; i++) push(H0 + T1 * i / N, ezs(i / N));
  push(H0 + T1 + H1, 1);
  for (let i = 1; i <= N; i++) push(H0 + T1 + H1 + T2 * i / N, 1 - ezs(i / N));
  const moved = [root, ...new Set(Object.values(seg).map((s) => s[0]).filter(Boolean)), ...(grip ? fingers.map((x) => x[0]) : [])];
  const qv = moved.map(() => []), pv = [];
  pose(keys[0]); // fixes the anchor at the start pose
  for (const u of samples) { pose(at(u)); moved.forEach((b, i) => qv[i].push(...b.quaternion.toArray())); pv.push(...root.position.toArray()); }
  all.forEach((b, i) => b.quaternion.copy(rest[i])); root.position.copy(rootPos); model.updateMatrixWorld(true);
  const tracks = moved.map((b, i) => new THREE.QuaternionKeyframeTrack(`${b.uuid}.quaternion`, times, qv[i]));
  tracks.push(new THREE.VectorKeyframeTrack(`${root.uuid}.position`, times, pv));
  const clip = new THREE.AnimationClip("pose", times.at(-1), tracks); clip.props = P.fixed || []; clip.eqProps = P.props || [];
  if (P.bar === "back" && eqProp === "bar") clip.props = [...clip.props, "backbar"];
  if (P.one && eqProp === "db") { clip.props = [...clip.props, "db" + P.one]; clip.eqProps = clip.eqProps.filter((k) => k !== "db"); } // one dumbbell (single-arm moves)
  if (P.hold === "neutral" && eqProp === "db") { clip.props = [...clip.props.filter((k) => !/^db[LR]$/.test(k)), "dbn" + (P.one || "")]; clip.eqProps = clip.eqProps.filter((k) => k !== "db"); } // hammer grip: handle front-to-back
  return clip;
}

/** Simple props: "bar" between the palms, "cbar" short cable handle, "db" in each hand, "pullbar" above the hands, "bench" under the back (lying moves). */
const P_CHEST = [.14, .26]; // chest pad: forward, up from the hips
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
    } else if (kind === "backbar" || kind === "lowbar") { const o = new THREE.Group(); o.add(cyl(.014, 1.8)); for (const x of [-.74, .74]) { const p = cyl(.1, .05); p.position.x = x; o.add(p); } g.add(o);
      const get = (n) => loc(bones[n], new THREE.Vector3()).clone();
      ups.push(() => { const k = backBar(get, kind === "lowbar"); o.position.copy(k.c); o.quaternion.setFromUnitVectors(X, k.left); });
    } else if (/^dbn?[LR]?$/.test(kind)) for (let i = 0; i < 2; i++) { if (/[LR]$/.test(kind) && i !== (kind.endsWith("R") ? 1 : 0)) continue; const nt = kind.startsWith("dbn"); const o = new THREE.Group(); o.add(cyl(.016, .16)); for (const x of [-.09, .09]) { const p = cyl(.05, .05); p.position.x = x; o.add(p); } g.add(o);
      ups.push(() => { const h = hand[i]; o.position.copy(grip(h)); loc(h[0], a); loc(h[1], b); // handle across the palm
        const n = b.sub(a).normalize(), side = nt ? c.set(0, 0, 1) : c.set(i ? -1 : 1, 0, 0); o.quaternion.setFromUnitVectors(X, side.sub(n.multiplyScalar(side.dot(n))).normalize()); });
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
    } else if (kind === "thrustbench") { // hip thrust: bench across the upper back (shoulder blades rest on its edge)
      const o = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .34), pad); g.add(o);
      ups.push(() => { const s5 = loc(bones.spine05, a).clone(), nk = loc(bones.neck01, b).clone(), fl = Math.min(loc(bones.footL, c).y, loc(bones.footR, c).y) - .07;
        const p = nk.clone().lerp(s5, .32), top = p.y - .12, h = Math.max(.1, top - fl); const hd = nk.clone().sub(s5).setY(0).normalize(); o.scale.y = h; o.position.set(p.x, top - h / 2, p.z).addScaledVector(hd, .1); o.rotation.y = Math.atan2(hd.x, hd.z); });
    } else if (kind === "handbench") { // one-arm row: bench under the free (left) hand
      const o = new THREE.Mesh(new THREE.BoxGeometry(.3, 1, .45), pad); g.add(o);
      ups.push(() => { const p = grip(hand[0], .3), fl = Math.min(loc(bones.footL, c).y, loc(bones.footR, c).y) - .07, top = p.y - .03, h = Math.max(.1, top - fl);
        o.scale.y = h; o.position.set(p.x, top - h / 2, p.z + .05); });
    } else if (kind === "hyper") { // 45° back-extension bench: pad in front of the hips/thighs + roller behind the ankles + post
      const o = new THREE.Mesh(new THREE.BoxGeometry(.36, .07, .42), pad), roll = cyl(.045, .4, pad), post = new THREE.Mesh(new THREE.BoxGeometry(.07, 1, .07), mat); g.add(o, roll, post);
      const t = new THREE.Vector3(), l = new THREE.Vector3(), f = new THREE.Vector3(), M = new THREE.Matrix4();
      ups.push(() => { const hip = loc(bones.upperleg01L, a).clone().add(loc(bones.upperleg01R, b)).multiplyScalar(.5), kn = loc(bones.lowerleg01L, a).clone().add(loc(bones.lowerleg01R, b)).multiplyScalar(.5);
        const an = loc(bones.footL, a).clone().add(loc(bones.footR, b)).multiplyScalar(.5);
        l.copy(loc(bones.upperleg01R, a)).sub(loc(bones.upperleg01L, b)).normalize(); t.subVectors(hip, kn).normalize(); f.crossVectors(l, t).normalize();
        o.quaternion.setFromRotationMatrix(M.makeBasis(l, f, t)); o.position.copy(hip).lerp(kn, .3).addScaledVector(f, .12);
        roll.position.copy(an).addScaledVector(f, -.08).addScaledVector(t, .02); roll.quaternion.setFromUnitVectors(X, l);
        const fl = an.y - .12, h = Math.max(.1, o.position.y - fl); post.scale.y = h; post.position.set(o.position.x, o.position.y - h / 2, o.position.z); });
    } else if (kind === "preacher") { // preacher pad under the upper arms (top edge in the armpits), sloping with the arms + post
      const o = new THREE.Mesh(new THREE.BoxGeometry(.5, .06, .32), pad), post = new THREE.Mesh(new THREE.BoxGeometry(.07, 1, .07), mat); g.add(o, post);
      const t = new THREE.Vector3(), n = new THREE.Vector3(), x = new THREE.Vector3(), M = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);
      ups.push(() => { const sh = loc(bones.upperarm01L, a).clone().add(loc(bones.upperarm01R, b)).multiplyScalar(.5), el = loc(bones.lowerarm01L, a).clone().add(loc(bones.lowerarm01R, b)).multiplyScalar(.5);
        t.subVectors(el, sh).normalize(); n.copy(UP).addScaledVector(t, -UP.dot(t)).normalize(); x.crossVectors(n, t);
        o.quaternion.setFromRotationMatrix(M.makeBasis(x, n, t)); o.position.copy(sh).lerp(el, .62).addScaledVector(n, -.08);
        const fl = Math.min(loc(bones.footL, c).y, loc(bones.footR, c).y) - .07, lo = o.position.clone().addScaledVector(t, .13).addScaledVector(n, -.03), h = Math.max(.1, lo.y - fl);
        post.scale.y = h; post.position.set(lo.x, lo.y - h / 2, lo.z); });
    } else if (kind === "sled" || kind === "sledtoe") { // leg press foot plate: square plate under the soles, facing the hips (sledtoe = under the balls of the feet, calf raise)
      const o = new THREE.Mesh(new THREE.BoxGeometry(.62, .62, .04), pad); g.add(o);
      const d = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
      ups.push(() => { const hip = loc(bones.upperleg01L, a).clone().add(loc(bones.upperleg01R, b)).multiplyScalar(.5);
        const ft = loc(bones.footL, a).clone().add(loc(bones.footR, b)).multiplyScalar(.5), toe = loc(bones["toe3-1L"] || bones.toe31L, a).clone().add(loc(bones["toe3-1R"] || bones.toe31R, b)).multiplyScalar(.5);
        d.subVectors(ft, hip).normalize(); o.quaternion.setFromUnitVectors(Z, d); o.position.copy(ft).lerp(toe, kind === "sled" ? .45 : 1).addScaledVector(d, kind === "sled" ? .06 : .035); });
    } else if (kind === "backpad" || kind === "chestpad") { // hack squat back pad (follows the torso along the sled) / chest pad of a machine row (fixed in front of the chest, from the hips)
      const o = new THREE.Mesh(new THREE.BoxGeometry(kind === "backpad" ? .42 : .32, kind === "backpad" ? .95 : .3, .07), pad); g.add(o);
      const t = new THREE.Vector3(), l = new THREE.Vector3(), f = new THREE.Vector3(), M = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);
      ups.push(() => { const s5 = loc(bones.spine05, a).clone(), nk = loc(bones.neck01, b).clone(); l.subVectors(loc(bones.upperleg01L, a), loc(bones.upperleg01R, b)).normalize();
        if (kind === "backpad") { t.subVectors(nk, s5).normalize(); f.crossVectors(l, t).normalize(); o.quaternion.setFromRotationMatrix(M.makeBasis(l, t, f)); o.position.copy(s5).lerp(nk, .38).addScaledVector(f, -.16); }
        else { f.crossVectors(l, UP).normalize(); o.quaternion.setFromRotationMatrix(M.makeBasis(l, UP, f)); o.position.copy(s5).addScaledVector(UP, P_CHEST[1]).addScaledVector(f, P_CHEST[0]); } });
    } else if (kind === "kneepad") { // assisted pull-up machine: pad under the knees
      const o = new THREE.Mesh(new THREE.BoxGeometry(.42, .06, .32), pad); g.add(o);
      ups.push(() => { const k = loc(bones.lowerleg01L, a).clone().add(loc(bones.lowerleg01R, b)).multiplyScalar(.5), an = loc(bones.footL, a).clone().add(loc(bones.footR, b)).multiplyScalar(.5);
        o.position.copy(k).lerp(an, .3); o.position.y -= .08; o.rotation.y = Math.atan2(an.x - k.x, an.z - k.z); });
    } else if (kind === "footbench") { // Bulgarian split squat: bench under the rear (right) foot
      const o = new THREE.Mesh(new THREE.BoxGeometry(.36, 1, .4), pad); g.add(o);
      ups.push(() => { const an = loc(bones.footR, a).clone(), toe = loc(bones["toe3-1R"] || bones.toe31R, b).clone(), fl = loc(bones.footL, c).y - .07, top = Math.min(an.y, toe.y) - .035, p = an.lerp(toe, .5), h = Math.max(.1, top - fl);
        o.scale.y = h; o.position.set(p.x, top - h / 2, p.z); });
    } else if (kind === "stepbox") { // step-up: box (.42 m) under the front (left) foot, which stays planted
      const o = new THREE.Mesh(new THREE.BoxGeometry(.75, .42, .4), pad); g.add(o);
      ups.push(() => { const an = loc(bones.footL, a).clone(), toe = loc(bones["toe3-1L"] || bones.toe31L, b).clone(), p = an.lerp(toe, .45); o.position.set(p.x - .15, Math.min(an.y, toe.y) - .035 - .21, p.z); });
    } else if (kind === "dipbench") { // bench dips: bench behind the hips under both hands
      const o = new THREE.Mesh(new THREE.BoxGeometry(.9, 1, .32), pad); g.add(o);
      ups.push(() => { const p = grip(hand[0], .3).add(grip(hand[1], .3)).multiplyScalar(.5), fl = Math.min(loc(bones.footL, c).y, loc(bones.footR, c).y) - .05, top = p.y - .03, h = Math.max(.1, top - fl);
        o.scale.y = h; o.position.set(p.x, top - h / 2, p.z - .1); });
    } else if (kind === "dipbars") for (let i = 0; i < 2; i++) { const o = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .6, 16), mat); o.rotation.x = Math.PI / 2; g.add(o);
      ups.push(() => { o.position.copy(grip(hand[i], .3)); o.position.y -= .02; });
    }
  }
  return { g, update() { if (g.parent) { g.parent.updateMatrixWorld(true); inv.copy(g.parent.matrixWorld).invert(); } ups.forEach((f) => f()); } };
}

/** CSS colour (any syntax, incl. color-mix) -> THREE.Color */
// PERF-3: memoised per theme + accent (the 1x1 readback cost ~140 ms per call on phones)
const colMemo = new Map(); let probeCtx;
const themeKey = () => { const d = document.documentElement; return d.dataset.theme + "|" + getComputedStyle(d).getPropertyValue("--accent"); };
function cssColor(expr) {
  const k = themeKey() + "|" + expr; let c = colMemo.get(k); if (c) return c.clone();
  if (!probeCtx) { const cv = document.createElement("canvas"); cv.width = cv.height = 1; probeCtx = cv.getContext("2d", { willReadFrequently: true }); }
  const x = probeCtx, probe = document.createElement("i"); probe.style.color = expr; document.body.appendChild(probe);
  x.clearRect(0, 0, 1, 1); x.fillStyle = getComputedStyle(probe).color; probe.remove(); x.fillRect(0, 0, 1, 1);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data; c = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
  colMemo.set(k, c); return c.clone();
}

function adjacency(geo) {
  const n = geo.attributes.position.count, idx = geo.index.array, sets = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2]; sets[a].add(b).add(c); sets[b].add(a).add(c); sets[c].add(a).add(b); }
  // weld seams: vertices at the same position share neighbours
  const key = new Map(), p = geo.attributes.position;
  for (let i = 0; i < n; i++) { const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`; const j = key.get(k); if (j === undefined) key.set(k, i); else { sets[i].add(j); sets[j].add(i); } }
  return sets.map((s) => Int32Array.from(s));
}

// PERF-3: painted buffers are reused for the same muscles + theme (same family across exercises)
const paintMemo = new Map();
function paint(geo, labels, adj, primary, secondary) {
  const pk = [...primary].sort() + "|" + [...secondary].sort() + "|" + themeKey(), hit = paintMemo.get(pk);
  if (hit) { geo.setAttribute("color", new THREE.BufferAttribute(hit.col, 3)); geo.setAttribute("glow", new THREE.BufferAttribute(hit.glow, 1)); return; }
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
  paintMemo.set(pk, { col, glow }); if (paintMemo.size > 24) paintMemo.delete(paintMemo.keys().next().value);
}

// PERF-3: WebGL renderers are pooled (no new context + shader compile per exercise, no forceContextLoss per page);
// one shared body material keeps its compiled program. Contexts are only dropped on pagehide.
const pool = []; let bodyMat;
function takeRenderer() {
  const r = pool.pop() || new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  r.outputColorSpace = THREE.SRGBColorSpace; r.setPixelRatio(Math.min(devicePixelRatio, 2)); return r;
}
function giveRenderer(r) { r.domElement.remove(); r.renderLists.dispose(); if (pool.length < 2) pool.push(r); else { r.dispose(); r.forceContextLoss(); } }
addEventListener("pagehide", (e) => { if (e.persisted) return; pool.splice(0).forEach((r) => { r.dispose(); r.forceContextLoss(); }); });
function getBodyMat() {
  if (bodyMat) return bodyMat;
  bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 });
  bodyMat.onBeforeCompile = (sh) => { // subtle self-glow on the main muscles (per-vertex "glow" attribute)
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float glow;\nvarying float vGlow;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = glow;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vGlow;").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * .32;");
  };
  return bodyMat;
}

export const VIEWS = { front: 0, side: -Math.PI / 2, back: Math.PI };

/** Mount into `el`. opts: {primary, secondary, move (anim id or null), view}. Returns {setView, dispose}. */
export async function mount3d(el, { primary = [], secondary = [], move = null, view = "front", at = null, prop: eqProp = null, wrong = null, pad = [44, 72] } = {}) {
  let [gltf, clip] = await Promise.all([getBody(), move ? getAnim(move).catch(() => null) : null]);
  if (!el.isConnected) return { setView() {}, dispose() {} };
  // each mount gets its own copy of the scene (shared geometry is repainted per exercise, so clone it)
  const src = gltf.scene; const scene3 = new THREE.Scene(); const model = cloneSkinned(src);
  let mesh; model.traverse((o) => { if (o.isSkinnedMesh || o.isMesh) mesh = o; });
  mesh.geometry = mesh.geometry.clone(); mesh.frustumCulled = false; const la = mesh.geometry.attributes._muscle, labels = Uint8Array.from({ length: la.count }, (_, i) => Math.round(la.getX(i) * (la.normalized ? 255 : 1)));
  adjP ??= Promise.resolve(adjacency(mesh.geometry));
  paint(mesh.geometry, labels, await adjP, primary, secondary);
  mesh.material = getBodyMat();
  if (clip && !clip.tracks) { const P = clip; clip = buildClip(model, withWrong(P, wrong != null ? P.wrong?.[wrong] : null), eqProp); if (P.yaw) model.rotation.y = THREE.MathUtils.degToRad(P.yaw); }
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

  const renderer = takeRenderer(), ac = new AbortController(), on = { signal: ac.signal };
  const cv = renderer.domElement; cv.className = "v3d-cv"; el.appendChild(cv);
  const cam = new THREE.PerspectiveCamera(28, 1, .05, 30);
  let yaw = VIEWS[view] ?? 0, yawT = yaw, pitch = .06, W = 0, H = 0, dirty = true, zoom = 1, zoomT = 1, panY = 0;
  const ZMAX = 3.5, halfH = size.y / 2;
  const fit = () => {
    W = el.clientWidth; H = el.clientHeight || 300; renderer.setSize(W, H, false); cam.aspect = W / H;
    // keep the body inside the free band between the top toggle and the bottom controls
    const [pt, pb] = pad, band = Math.max(.4, (H - pt - pb) / H), tn = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const need = (Math.max(size.y / 2 / tn / band, reach / 2 / tn / cam.aspect / .86) + reach / 9) / zoom;
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
    else drag = { x: e.clientX, y: e.clientY, yaw: yawT, pitch, pan: panY }; }, on);
  cv.addEventListener("pointermove", (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; setZoom(pinch.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d); return; }
    if (!drag) return; yawT = drag.yaw + (e.clientX - drag.x) * .012; yaw = yawT;
    if (zoomT > 1.01) panY = drag.pan + (e.clientY - drag.y) * size.y / H / zoom; else pitch = Math.max(-.25, Math.min(.6, drag.pitch + (e.clientY - drag.y) * .006));
    fit(); }, on);
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) drag = null; };
  cv.addEventListener("pointerup", up, on); cv.addEventListener("pointercancel", up, on);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); setZoom(zoomT * Math.exp(-e.deltaY * .0015)); }, { passive: false, signal: ac.signal });
  const reset = () => { zoomT = 1; panY = 0; pitch = .06; el.classList.remove("zoomed"); fit(); loop(); };
  cv.addEventListener("dblclick", reset, on);

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
    ac.abort();
    mesh.geometry.dispose(); prop?.g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); giveRenderer(renderer);
  }
  return {
    setView(k) { const t = VIEWS[k] ?? 0; const d = Math.round((yawT - t) / (2 * Math.PI)); yawT = t + d * 2 * Math.PI; loop(); },
    togglePlay() { if (!act) return false; act.paused = !act.paused; last = performance.now(); loop(); return !act.paused; },
    setSpeed(r) { if (act) act.timeScale = r; },
    zoomBy(f) { setZoom(zoomT * f); }, reset,
    snap() { pivot.rotation.y = yaw; renderer.render(scene3, cam); return cv.toDataURL("image/png"); }, // screenshots / QA
    restart() { if (act) { act.time = 0; last = performance.now(); loop(); } },
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

/** 19b-QA: geometric check of an authored motion (no rendering). Samples the clip and returns the failures:
    prop away from the hands / back, prop through the head or torso, hands inside the torso, odd grip width. */
export async function qa3d(move, eqProp = null, N = 24, wrong = null) {
  const [gltf, P0] = await Promise.all([getBody(), getAnim(move)]), P = withWrong(P0, wrong != null ? P0.wrong?.[wrong] : null);
  const model = cloneSkinned(gltf.scene), clip = buildClip(model, P, eqProp); if (P.yaw) model.rotation.y = THREE.MathUtils.degToRad(P.yaw);
  const kinds = [...(clip.props || []), (clip.eqProps || []).includes(eqProp) ? eqProp : null].filter(Boolean);
  const prop = makeProp(kinds, model, false), mixer = new THREE.AnimationMixer(model), act = mixer.clipAction(clip); act.play();
  const bones = {}; model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const W = (n) => bones[n].getWorldPosition(new THREE.Vector3());
  const segDist = (p, a, b) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq())); return a.clone().addScaledVector(ab, t).distanceTo(p); };
  const fails = new Set(), worst = {};
  const note = (k, v, bad) => { worst[k] = worst[k] == null ? v : (bad === "lt" ? Math.min(worst[k], v) : Math.max(worst[k], v)); };
  for (let i = 0; i < N; i++) {
    act.time = clip.duration * i / N; mixer.update(0); model.updateMatrixWorld(true); prop?.update(); prop?.g.updateMatrixWorld(true);
    const grip = ["L", "R"].map((s) => W("wrist" + s).lerp(W("finger3-1" + s), .35));
    const head = W("head").add(W("head").sub(W("neck01")).normalize().multiplyScalar(.09)), s5 = W("spine05"), nk = W("neck01");
    const torsoD = (p) => segDist(p, s5, nk);
    for (const g of grip) note("handTorso", torsoD(g), "lt");
    if (!prop) continue;
    const k = kinds.find((x) => /bar|db/.test(x));
    prop.g.children.forEach((o) => {
      const cyl = o.children?.[0]; if (cyl?.geometry?.type !== "CylinderGeometry") return;
      const len = cyl.geometry.parameters.height, c = o.getWorldPosition(new THREE.Vector3()), ax = new THREE.Vector3(1, 0, 0).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()));
      const a = c.clone().addScaledVector(ax, -len / 2), b = c.clone().addScaledVector(ax, len / 2), inner = len > 1 ? .5 : len / 2; // plates/collars excluded from body checks
      const ia = c.clone().addScaledVector(ax, -inner), ib = c.clone().addScaledVector(ax, inner);
      const hd = Math.min(...grip.map((g) => segDist(g, a, b)));
      note("propHand", len > .3 ? Math.max(...grip.map((g) => segDist(g, a, b))) : hd); // bars: both hands on it; dumbbell: its own hand
      note("propHead", segDist(head, ia, ib), "lt");
      if (!/backbar|lowbar/.test(k)) note("propTorso", Math.min(...[0, .25, .5, .75, 1].map((t) => torsoD(ia.clone().lerp(ib, t)))), "lt");
      else note("barNeck", c.distanceTo(nk));
    });
    if (kinds.some((k) => /^(bar|backbar|lowbar)$/.test(k))) note("gripW", grip[0].distanceTo(grip[1]));
  }
  const fixedHands = (P.fixed || []).some((k) => /pullbar|dipbars|cbar/.test(k)) || kinds.length;
  if (worst.handTorso < .06) fails.add(`hand inside torso (${worst.handTorso.toFixed(3)})`);
  if (worst.propHand > .09 && fixedHands) fails.add(`prop away from hands (${worst.propHand.toFixed(3)})`);
  if (worst.propHead < .12) fails.add(`prop through head (${worst.propHead.toFixed(3)})`);
  if (worst.propTorso < .07) fails.add(`prop through torso (${worst.propTorso.toFixed(3)})`);
  if (worst.barNeck > .17) fails.add(`bar not on the back (${worst.barNeck.toFixed(3)})`);
  if (worst.gripW != null && (worst.gripW > 1.05)) fails.add(`grip too wide (${worst.gripW.toFixed(3)})`);
  for (const k in worst) worst[k] = +worst[k].toFixed(3);
  return { move: wrong != null ? `${move} wrong#${wrong}` : move, prop: kinds, fails: [...fails], worst };
}
