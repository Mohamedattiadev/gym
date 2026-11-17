/* SEC-3: data that comes from OUTSIDE this device (backup file, sync repo) is cleaned once at the boundary,
   before it reaches S. Pure (no DOM, no S) so tools/test/unit/sanitize.test.mjs can feed it hostile files.
   - only known top-level keys (stops __proto__ and junk); "schema" newer than ours is refused
   - ids/slugs/map keys must be plain tokens (bad id -> new id, bad slug -> entry dropped)
   - unit is kg|lb, numbers must be finite, set weight/reps must look like numbers
   - every other string loses < > " ' ` unless it is free text (names, notes), which the UI esc()'s anyway */
const BAD_KEY = new Set(["__proto__", "constructor", "prototype"]);
const FREE = new Set(["name", "note", "notes", "title", "desc"]);
const ID = /^[\w-]{1,60}$/, SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/i, NUMSTR = /^\d{0,4}([.,]\d{1,2})?$/;
const strip = (s) => s.replace(/[<>"'`]/g, "");

// generic deep clean: drops dangerous keys, functions, non-finite numbers; strips markup chars from non-free text
function deep(v, key = "", depth = 0) {
  if (depth > 12) return undefined;
  if (typeof v === "string") return FREE.has(key) ? v.slice(0, 2000) : strip(v).slice(0, 500);
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean" || v === null) return v;
  if (Array.isArray(v)) return v.slice(0, 20000).map((x) => deep(x, key, depth + 1)).filter((x) => x !== undefined);
  if (typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (BAD_KEY.has(k) || /[<>"'`]/.test(k)) continue; // a key with markup is dropped, not repaired
      const c = deep(x, key === "notes" ? "notes" : k, depth + 1); // values of the notes map stay free text
      if (c !== undefined) o[k.slice(0, 200)] = c;
    }
    return o;
  }
  return undefined;
}

const slugMap = (m) => (m && typeof m === "object" && !Array.isArray(m)
  ? Object.fromEntries(Object.entries(m).filter(([k]) => SLUG.test(k))) : {});
const num = (v) => { const s = String(v ?? "").trim(); return NUMSTR.test(s) ? s : ""; };
function sets(list) {
  return (Array.isArray(list) ? list : []).filter((s) => s && typeof s === "object")
    .map((s) => ({ ...s, w: num(s.w), r: num(s.r), type: /^[nwdf]$/.test(s.type) ? s.type : "n" }));
}
function entries(list) {
  return (Array.isArray(list) ? list : []).filter((e) => e && SLUG.test(e.slug)).map((e) => ({ ...e, sets: sets(e.sets) }));
}

export function sanitize(d, { keys, schema, uid }) {
  if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("Not a Gym backup");
  if (+d.schema > schema) throw new Error("This backup is from a newer version of the app — update first");
  const allow = new Set([...keys, "schema"]);
  const out = deep(Object.fromEntries(Object.entries(d).filter(([k]) => allow.has(k))));
  const fixId = (x) => (ID.test(String(x?.id ?? "")) ? x : { ...x, id: uid() });

  if (Array.isArray(out.workouts)) out.workouts = out.workouts.filter((w) => w && typeof w === "object").map(fixId)
    .map((w) => ({ ...w, items: (Array.isArray(w.items) ? w.items : []).filter((it) => it && SLUG.test(it.slug)) }));
  if (Array.isArray(out.sessions)) out.sessions = out.sessions.filter((s) => s && typeof s === "object").map(fixId)
    .map((s) => ({ ...s, entries: entries(s.entries) }));
  if (Array.isArray(out.favorites)) out.favorites = out.favorites.filter((s) => typeof s === "string" && SLUG.test(s));
  for (const k of ["notes", "pain", "adjust"]) if (k in out) out[k] = slugMap(out[k]);
  if ("deleted" in out) { // FE-7 tombstones: known kinds, plain id keys, numeric stamps only
    const dl = out.deleted && typeof out.deleted === "object" && !Array.isArray(out.deleted) ? out.deleted : {};
    out.deleted = {};
    for (const kind of ["sessions", "workouts", "favorites"]) if (dl[kind] && typeof dl[kind] === "object")
      out.deleted[kind] = Object.fromEntries(Object.entries(dl[kind]).filter(([k, v]) => ID.test(k) && typeof v === "number"));
  }
  if (out.bodyweight && !Array.isArray(out.bodyweight)) out.bodyweight = [];
  if (out.profile !== undefined && out.profile !== null && (typeof out.profile !== "object" || Array.isArray(out.profile))) out.profile = null;
  if (out.settings && typeof out.settings === "object") {
    const st = out.settings;
    if (!["kg", "lb"].includes(st.unit)) delete st.unit;
    for (const k of ["restDefault", "bar", "installDismissed", "lastBackup", "planMin"]) if (k in st && !Number.isFinite(st[k])) delete st[k];
    if ("plates" in st && !(Array.isArray(st.plates) && st.plates.every(Number.isFinite))) delete st.plates;
    if ("restEx" in st) st.restEx = slugMap(st.restEx);
  } else delete out.settings;
  if ("schema" in out && !Number.isFinite(out.schema)) delete out.schema;
  return out;
}
