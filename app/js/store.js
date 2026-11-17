// User data lives ONLY on this device (IndexedDB). No accounts, no server: every phone has its own data.
const DB_NAME = "gymy", DB_VER = 1, STORE = "kv";
export const SCHEMA = 2;

const DEFAULTS = {
  favorites: [], workouts: [], sessions: [], active: null, notes: {}, bodyweight: [], pain: {}, adjust: {},
  settings: { unit: "kg", restDefault: 90, autoRest: true, sound: true, haptics: true, bar: 20,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25], theme: "light", equip: "gym", installDismissed: 0, lastBackup: 0, onboarded: false },
  profile: null, // {level, days, equipment, name}
};

let db;
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
});

export async function loadStore() {
  try {
    db = await idb();
    const keys = await tx("readonly", (st) => st.getAllKeys());
    const vals = await tx("readonly", (st) => st.getAll());
    keys.forEach((k, i) => { S[k] = vals[i]; });
    S.settings = { ...DEFAULTS.settings, ...(S.settings || {}) };
    if (!keys.includes("schema")) await migrateFromV1();
  } catch (e) {
    console.warn("IndexedDB unavailable, falling back to localStorage", e);
    db = null;
    try { Object.assign(S, JSON.parse(localStorage.getItem("gymy2") || "{}")); } catch {}
  }
  return S;
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
export function save(...keys) {
  (keys.length ? keys : Object.keys(DEFAULTS)).forEach((k) => dirty.add(k));
  clearTimeout(timer); timer = setTimeout(flush, 150);
}
export async function flush() {
  const keys = [...dirty]; dirty.clear();
  if (!keys.length) return;
  if (!db) { try { localStorage.setItem("gymy2", JSON.stringify(S)); } catch {} return; }
  await tx("readwrite", (st) => keys.forEach((k) => st.put(structuredClone(S[k]), k)));
}
async function saveAll() { Object.keys(DEFAULTS).concat("schema").forEach((k) => dirty.add(k)); await flush(); }
addEventListener("pagehide", flush);
document.addEventListener("visibilitychange", () => document.hidden && flush());

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
  const d = j.app === "gymy" ? j.data : j; // also accept v1 backups
  if (!Array.isArray(d.workouts) || !Array.isArray(d.sessions)) throw new Error("Not a Gym backup");
  d.sessions = d.sessions.map((s) => ({ ...s, startedAt: s.startedAt || s.start, endedAt: s.endedAt || s.end }));
  Object.assign(S, structuredClone(DEFAULTS), d, { settings: { ...DEFAULTS.settings, ...(d.settings || {}) }, active: S.active, sync: S.sync });
  await saveAll();
}
