// User data lives ONLY on this device (IndexedDB). No accounts, no server: every phone has its own data.
const DB_NAME = "gymy", DB_VER = 1, STORE = "kv";
export const SCHEMA = 2;

const DEFAULTS = {
  favorites: [], workouts: [], sessions: [], active: null, notes: {}, bodyweight: [], pain: {}, adjust: {},
  settings: { unit: "kg", restDefault: 90, autoRest: true, sound: true, haptics: true, bar: 20,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25], theme: "system", equip: "gym", installDismissed: 0, lastBackup: 0, onboarded: false, lockTimer: true },
  profile: null, // {level, days, equipment, name}
  deleted: {}, // FE-7 tombstones {sessions|workouts|favorites: {id: ts}}; ts < 0 = brought back (undo / re-favourite) at -ts
};

import { sanitize } from "./sanitize.js";
let db;
// SEC-3: clean anything that comes from a file or the sync repo before it reaches S
export const clean = (d) => sanitize(d, { keys: Object.keys(DEFAULTS), schema: SCHEMA, uid: () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36) });
export const S = structuredClone(DEFAULTS);

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = (mode, fn) => new Promise((res, rej) => {
  const t = db.transaction(STORE, mode); const st = t.objectStore(STORE);
  const out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error);
  t.onabort = () => rej(t.error || new DOMException("aborted", "AbortError")); // BE-1: quota abort must reject, not hang
});

// BE-4: storage that failed to open is retried once, then the app says so (S.degraded) instead of looking empty
export let degraded = false;
export async function loadStore() {
  try {
    try { db = await idb(); } catch { await new Promise((r) => setTimeout(r, 300)); db = await idb(); }
    db.onversionchange = () => { db.close(); db = null; };
    const keys = await tx("readonly", (st) => st.getAllKeys());
    const vals = await tx("readonly", (st) => st.getAll());
    keys.forEach((k, i) => { S[k] = vals[i]; });
    S.settings = { ...DEFAULTS.settings, ...(S.settings || {}) };
    if (!keys.includes("schema")) await migrateFromV1();
    await adoptFallback();
  } catch (e) {
    console.warn("IndexedDB unavailable, falling back to localStorage", e);
    db = null; degraded = true;
    try { Object.assign(S, JSON.parse(localStorage.getItem("gymy2") || "{}")); } catch {}
  }
  initChannel();
  return S;
}
// work saved to the localStorage fallback in a degraded session is merged back on the next good load
async function adoptFallback() {
  let fb = null; try { fb = JSON.parse(localStorage.getItem("gymy2") || "null"); } catch {}
  if (!fb) return;
  const { merge } = await import("./sync.js");
  const m = merge(Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, S[k]])), { ...fb, sync: undefined });
  for (const k of Object.keys(DEFAULTS)) if (k !== "settings" && k !== "active") S[k] = m[k];
  S.active ??= fb.active ?? null;
  await saveAll();
  try { localStorage.removeItem("gymy2"); } catch {}
}

/* BE-2: several tabs/windows. After a write, the others re-read those keys (unless they have their own unsaved
   change to that key) and fire "store:changed" so the open page re-renders with fresh data. */
const TAB = Math.random().toString(36).slice(2);
let bc;
function initChannel() {
  if (!("BroadcastChannel" in globalThis) || bc) return;
  bc = new BroadcastChannel("gymy");
  bc.onmessage = async ({ data }) => {
    if (data?.t !== "changed" || data.from === TAB || !db) return;
    const keys = data.keys.filter((k) => !dirty.has(k));
    if (!keys.length) return;
    try {
      const vals = await tx("readonly", (st) => { const out = {}; keys.forEach((k) => { const r = st.get(k); r.onsuccess = () => { out[k] = r.result; }; }); return { get result() { return out; } }; });
      keys.forEach((k) => { if (vals[k] !== undefined) S[k] = vals[k]; });
      if (keys.includes("settings")) S.settings = { ...DEFAULTS.settings, ...(S.settings || {}) };
      dispatchEvent(new CustomEvent("store:changed", { detail: keys }));
    } catch (e) { console.warn("reload from other tab failed", e); }
  };
}

async function migrateFromV1() {
  let old = null;
  try { old = JSON.parse(localStorage.getItem("gymy") || "null"); } catch {}
  if (old) {
    S.favorites = old.favorites || [];
    S.workouts = (old.workouts || []).map((w) => ({ ...w, items: w.items.map((it) => ({ ...it, reps: it.reps || "8-12" })) }));
    S.sessions = (old.sessions || []).map((s) => ({ ...s, startedAt: s.start, endedAt: s.end }));
    S.active = null;
    S.settings.unit = old.unit || "kg";
    try { localStorage.setItem("gymy_v1_backup", localStorage.getItem("gymy")); localStorage.removeItem("gymy"); } catch {}
  }
  S.schema = SCHEMA;
  await saveAll();
}

const dirty = new Set(); let timer;
/* FE-7: remember a removal (or its undo) so a cloud merge does not bring the record back */
export function tomb(kind, id, back = false) {
  const m = ((S.deleted ||= {})[kind] ||= {});
  if (back) { if (!m[id]) return; m[id] = -Date.now(); } else m[id] = Date.now();
  save("deleted");
}
/* FE-10: listeners told about every save (sync.js pushes user data from here, so no call site can forget) */
const subs = new Set();
export const onSave = (fn) => subs.add(fn);
export function save(...keys) {
  (keys.length ? keys : Object.keys(DEFAULTS)).forEach((k) => dirty.add(k));
  subs.forEach((fn) => { try { fn(keys.length ? keys : Object.keys(DEFAULTS)); } catch (e) { console.warn(e); } });
  clearTimeout(timer); timer = setTimeout(flushSafe, 150);
}
// FE-5: keys stay dirty until the write succeeds; one retry with a fresh connection (Safari drops it in the
// background), then the user is told instead of silently losing the set.
let warned = 0;
export async function flush() {
  const keys = [...dirty]; dirty.clear();
  if (!keys.length) return;
  if (!db) {
    try { localStorage.setItem("gymy2", JSON.stringify(S)); } catch (e) { keys.forEach((k) => dirty.add(k)); fail(e); }
    return;
  }
  const put = () => tx("readwrite", (st) => keys.forEach((k) => st.put(structuredClone(S[k]), k)));
  try { await put(); } catch (e1) {
    try { db = await idb(); await put(); } catch (e) { keys.forEach((k) => dirty.add(k)); fail(e); return; }
  }
  try { bc?.postMessage({ t: "changed", from: TAB, keys }); } catch {}
}
function fail(e) {
  console.error("save failed", e);
  if (Date.now() - warned < 30000) return; warned = Date.now();
  import("./ui.js").then((u) => u.toast("Couldn't save — phone storage may be full", 4000)).catch(() => {});
}
const flushSafe = () => { flush().catch(() => {}); };
async function saveAll() { Object.keys(DEFAULTS).concat("schema").forEach((k) => dirty.add(k)); subs.forEach((fn) => { try { fn(Object.keys(DEFAULTS)); } catch {} }); await flush(); }
addEventListener("pagehide", flushSafe);
document.addEventListener("visibilitychange", () => document.hidden && flushSafe());

export async function persist() {
  try {
    if (navigator.storage?.persisted && await navigator.storage.persisted()) return true;
    return navigator.storage?.persist ? await navigator.storage.persist() : false;
  } catch { return false; }
}

export function exportData() {
  return JSON.stringify({ app: "gymy", schema: SCHEMA, exportedAt: new Date().toISOString(),
    data: { ...S, active: null, sync: undefined } }, null, 1);
}
export async function importData(text) {
  const j = JSON.parse(text);
  const raw = j && j.app === "gymy" ? j.data : j; // also accept v1 backups
  if (!raw || !Array.isArray(raw.workouts) || !Array.isArray(raw.sessions)) throw new Error("Not a Gym backup");
  raw.sessions = raw.sessions.map((s) => ({ ...s, startedAt: s?.startedAt || s?.start, endedAt: s?.endedAt || s?.end }));
  const d = clean(raw);
  Object.assign(S, structuredClone(DEFAULTS), d, { settings: { ...DEFAULTS.settings, ...(d.settings || {}) }, active: S.active, sync: S.sync });
  await saveAll();
}
