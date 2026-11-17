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
const getAnim = (id) => (anims[id] ??= loader.loadAsync(`3d/anim/${id}.glb`).then((g) => g.animations[0]));

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
  const base = cssColor("#b8b0a9"), pri = cssColor("var(--accent)"), sec = base.clone().lerp(pri, .5);
  const col = new Float32Array(n * 3), c = new THREE.Color(), ss = (x) => { const t = Math.min(1, Math.max(0, (x - .25) / .35)); return t * t * (3 - 2 * t); };
  for (let i = 0; i < n; i++) { c.copy(base).lerp(sec, ss(S[i])).lerp(pri, ss(P[i])); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

export const VIEWS = { front: 0, side: -Math.PI / 2, back: Math.PI };

/** Mount into `el`. opts: {primary, secondary, move (anim id or null), view}. Returns {setView, dispose}. */
export async function mount3d(el, { primary = [], secondary = [], move = null, view = "front" } = {}) {
  const [gltf, clip] = await Promise.all([getBody(), move ? getAnim(move).catch(() => null) : null]);
  if (!el.isConnected) return { setView() {}, dispose() {} };
  // each mount gets its own copy of the scene (shared geometry is repainted per exercise, so clone it)
  const src = gltf.scene; const scene3 = new THREE.Scene(); const model = cloneSkinned(src);
  let mesh; model.traverse((o) => { if (o.isSkinnedMesh || o.isMesh) mesh = o; });
  mesh.geometry = mesh.geometry.clone(); mesh.frustumCulled = false; const la = mesh.geometry.attributes._muscle, labels = Uint8Array.from({ length: la.count }, (_, i) => Math.round(la.getX(i) * (la.normalized ? 255 : 1)));
  adjP ??= Promise.resolve(adjacency(mesh.geometry));
  paint(mesh.geometry, labels, await adjP, primary, secondary);
  mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .68, metalness: 0 });
  const pivot = new THREE.Group(); pivot.add(model); scene3.add(pivot);
  scene3.add(new THREE.HemisphereLight(0xffffff, 0x8a7f78, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(1.2, 2.4, 3); scene3.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, .9); rim.position.set(-2, 1.5, -2.5); scene3.add(rim);

  const mixer = clip ? new THREE.AnimationMixer(model) : null;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const act = mixer ? mixer.clipAction(clip) : null;
  if (act) { act.play(); if (reduce) act.paused = true; }

  // framing: union of bone positions over the clip (or rest pose)
  const box = new THREE.Box3(), v = new THREE.Vector3();
  const sample = () => { model.updateMatrixWorld(true); mesh.skeleton.bones.forEach((b) => { if (!/finger|toe|oris|tongue|levator|special|eye|oculi|orbic|tempor|risor|jaw/.test(b.name)) box.expandByPoint(b.getWorldPosition(v)); }); };
  if (mixer) { const t0 = mixer.time; for (let i = 0; i <= 8; i++) { mixer.setTime(clip.duration * i / 8); sample(); } mixer.setTime(reduce ? clip.duration / 2 : t0); } else sample();
  box.expandByScalar(.14); const ctr = box.getCenter(new THREE.Vector3()); model.position.sub(new THREE.Vector3(ctr.x, 0, ctr.z));
  const size = box.getSize(new THREE.Vector3()); const reach = Math.max(size.x, size.z);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const cv = renderer.domElement; cv.className = "v3d-cv"; el.appendChild(cv);
  const cam = new THREE.PerspectiveCamera(28, 1, .05, 30);
  let yaw = VIEWS[view] ?? 0, yawT = yaw, pitch = .06, W = 0, H = 0, dirty = true;
  const fit = () => {
    W = el.clientWidth; H = el.clientHeight || 300; renderer.setSize(W, H, false); cam.aspect = W / H;
    // keep the body inside the free band between the top toggle and the bottom controls
    const pt = 46, pb = 84, band = Math.max(.4, (H - pt - pb) / H), tn = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const need = Math.max(size.y / 2 / tn / band, reach / 2 / tn / cam.aspect / .92) + reach / 3;
    cam.position.set(0, ctr.y + Math.sin(pitch) * need, Math.cos(pitch) * need); cam.lookAt(0, ctr.y, 0);
    cam.setViewOffset(W, H, 0, (pb - pt) / 2, W, H); cam.updateProjectionMatrix(); dirty = true;
  };
  const ro = new ResizeObserver(fit); ro.observe(el); fit();

  // drag to rotate (yaw), vertical drag tilts a little
  let drag = null;
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw: yawT, pitch }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => { if (!drag) return; yawT = drag.yaw + (e.clientX - drag.x) * .012; yaw = yawT; pitch = Math.max(-.25, Math.min(.6, drag.pitch + (e.clientY - drag.y) * .006)); fit(); });
  const up = () => { drag = null; };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

  let visible = true, raf = 0, last = performance.now(), dead = false;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }); io.observe(el);
  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame((now) => {
      if (dead) return; if (!el.isConnected) return dispose();
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (Math.abs(yawT - yaw) > 1e-3) { yaw += (yawT - yaw) * Math.min(1, dt * 9); dirty = true; } else yaw = yawT;
      pivot.rotation.y = yaw;
      if (act && !act.paused) { mixer.update(dt); dirty = true; }
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
