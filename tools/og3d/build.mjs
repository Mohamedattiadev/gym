// Build app/3d/ from the OpenGym3D exercise pack (MIT, SylvesterAssiamahGK).
// usage: NODE_PATH=<dir with @gltf-transform, meshoptimizer> node tools/og3d/build.mjs raw/og3d_pack/pack app/3d
//  body.glb      skinned MakeHuman mesh, no animation / morphs / colours (quantized + meshopt)
//  anim/<id>.glb skeleton + one baked loop (face bones dropped, meshopt)
//  body.glb also carries _MUSCLE (Uint8 per vertex): index+1 into MUSCLE_IDS (0 = none), painted like og3d's
//                paint_muscles(): dominant skin bone + front/back split + height bands.
import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { prune, quantize, meshopt, resample, dedup } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import fs from "node:fs";
import path from "node:path";

const [src, out] = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
fs.mkdirSync(path.join(out, "anim"), { recursive: true });
const FACE = /^(jaw|special|oris|tongue|levator|eye|orbicularis|temporalis|oculi|risorius)/;
const comp = meshopt({ encoder: MeshoptEncoder, level: "high" });

// ---------- body ----------
const doc = await io.read(path.join(src, "models", "calf_raise.glb"));
const root = doc.getRoot();
root.listAnimations().forEach((a) => a.dispose());
const prim = root.listMeshes()[0].listPrimitives()[0];
prim.listTargets().forEach((t) => { prim.removeTarget(t); t.dispose(); });
root.listMeshes()[0].setWeights([]);
for (const s of ["COLOR_0", "TEXCOORD_0"]) { const a = prim.getAttribute(s); prim.setAttribute(s, null); a?.dispose(); }

// ---- muscle labels (bind pose, glTF: +Y up, character faces +Z, metres) ----
const pos = prim.getAttribute("POSITION").getArray(), J = prim.getAttribute("JOINTS_0").getArray(), W = prim.getAttribute("WEIGHTS_0").getArray();
const skin = root.listSkins()[0], joints = skin.listJoints(), ibm = skin.getInverseBindMatrices().getArray();
// joint world bind position = translation of inverse(IBM); IBMs here are pure rigid -> -R^T t
const head = joints.map((_, i) => { const m = ibm.slice(i * 16, i * 16 + 16); const t = [m[12], m[13], m[14]];
  return [0, 1, 2].map((r) => -(m[r * 4] * t[0] + m[r * 4 + 1] * t[1] + m[r * 4 + 2] * t[2])); });
const name = joints.map((n) => n.getName());
const tail = joints.map((n, i) => { const c = n.listChildren().find((k) => joints.includes(k)); return c ? head[joints.indexOf(c)] : head[i]; });
const base = (n) => n.split(".")[0];
const MUSCLE_IDS = ["chest", "delt-front", "delt-side", "biceps", "forearms", "abs", "obliques", "quads", "adductors", "shins",
  "traps", "delt-rear", "upper-back", "lats", "triceps", "lower-back", "glutes", "hamstrings", "calves"];
const id = (m) => MUSCLE_IDS.indexOf(m) + 1;
const TORSO = new Set(["spine01", "spine02", "spine03", "spine04", "spine05", "breast", "clavicle", "neck01", "neck02", "neck03", "pelvis", "root"]);
const n = pos.length / 3, lab = new Uint8Array(n);
for (let v = 0; v < n; v++) {
  let b = -1, bw = 0;
  for (let k = 0; k < 4; k++) if (W[v * 4 + k] > bw) { bw = W[v * 4 + k]; b = J[v * 4 + k]; }
  if (b < 0) continue;
  const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], bn = base(name[b]), ax = Math.abs(x);
  // offset from the bone segment (closest point)
  const h = head[b], t = tail[b], d = [t[0] - h[0], t[1] - h[1], t[2] - h[2]], dd = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1;
  const s = Math.max(0, Math.min(1, ((x - h[0]) * d[0] + (y - h[1]) * d[1] + (z - h[2]) * d[2]) / dd));
  const o = [x - h[0] - s * d[0], y - h[1] - s * d[1], z - h[2] - s * d[2]];
  const front = z > -0.03;
  let m = 0;
  if (TORSO.has(bn) || bn === "upperleg01" && y > 0.82) {
    if (bn.startsWith("neck") && y > 1.5) m = 0;
    else if (front) {
      if (y > 1.24 && y < 1.43 - Math.max(0, 0.07 - ax) * 0.8 && ax < 0.19 && !bn.startsWith("neck")) m = id("chest");
      else if (y >= 0.94 && y <= 1.24) m = id(ax < 0.075 ? "abs" : "obliques");
    } else {
      if (y > 1.38 && y < 1.6 && ax < 0.17) m = id("traps");
      else if (y > 1.18 && y <= 1.38 && ax < 0.075) m = id("upper-back");
      else if (y > 1.06 && y <= 1.38) m = id("lats");
      else if (y > 0.97 && y <= 1.06 && ax < 0.11) m = id("lower-back");
      else if (y > 0.97 && y <= 1.06) m = id("obliques");
      else if (y > 0.74 && y <= 0.97) m = id("glutes");
    }
  } else if (bn === "shoulder01" || bn === "upperarm01") {
    if (o[2] > 0.025 && o[2] > o[1]) m = id("delt-front");
    else if (o[2] < -0.025 && -o[2] > o[1]) m = id("delt-rear");
    else if (o[1] > -0.01) m = id("delt-side");
  } else if (bn === "upperarm02") m = id(o[2] >= 0 ? "biceps" : "triceps");
  else if (bn === "lowerarm01" || bn === "lowerarm02") m = id("forearms");
  else if (bn === "upperleg01" || bn === "upperleg02") {
    const inward = -Math.sign(x) * o[0]; // towards the midline
    if (inward > Math.abs(o[2]) * 0.9 && y > 0.6) m = id("adductors");
    else m = id(o[2] >= 0 ? "quads" : "hamstrings");
  } else if (bn === "lowerleg01" || bn === "lowerleg02") m = id(o[2] >= 0 ? "shins" : "calves");
  lab[v] = m;
}
prim.setAttribute("_MUSCLE", doc.createAccessor("muscle").setType("SCALAR").setArray(lab).setBuffer(root.listBuffers()[0]));
const cnt = {}; lab.forEach((l) => { const k = l ? MUSCLE_IDS[l - 1] : "-"; cnt[k] = (cnt[k] || 0) + 1; }); console.log(cnt);

await doc.transform(prune(), quantize({ quantizeNormal: 8, quantizePosition: 14 }), comp);
await io.write(path.join(out, "body.glb"), doc);

// ---------- animations ----------
const man = JSON.parse(fs.readFileSync(path.join(src, "exercises.json"), "utf8"));
for (const e of man) {
  const d = await io.read(path.join(src, "models", e.id + ".glb")); const r = d.getRoot();
  r.listNodes().forEach((nd) => { nd.setMesh(null); nd.setSkin(null); });
  r.listMeshes().forEach((m) => m.dispose()); r.listSkins().forEach((s) => s.dispose());
  for (const a of r.listAnimations()) for (const c of a.listChannels()) {
    const t = c.getTargetNode(); if (!t || FACE.test(t.getName()) || c.getTargetPath() === "weights") { c.getSampler()?.dispose(); c.dispose(); }
  }
  r.listAnimations().forEach((a) => { if (!a.listChannels().length) a.dispose(); });
  await d.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }), dedup(), comp);
  await io.write(path.join(out, "anim", e.id + ".glb"), d);
}
fs.writeFileSync(path.join(out, "moves.json"), JSON.stringify(man.map((e) => ({ id: e.id, name: e.name, equipment: e.equipment, primary: e.primary, secondary: e.secondary })), null, 0));
console.log("ok");
