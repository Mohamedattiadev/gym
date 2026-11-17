// Optional cloud backup to the owner's OWN PRIVATE GitHub repo (see SYNC.md).
// The token stays on this device (IndexedDB key "sync") and is NEVER written into the backup file.
// Talks only to https://api.github.com. No libraries.
import { S, save, flush, exportData } from "./store.js";

const API = "https://api.github.com";
const DEBOUNCE_MS = 20000;
const DEFAULT_PATH = "gym-backup.json";

let lastError = null;   // human-readable message of the last failure (null = fine)
let busy = null;        // promise of the running push/pull (serialises network work)
let debounce = null;
const listeners = new Set();

/* ================= pure helpers (exported for tests) ================= */

// UTF-8 safe base64 (handles emoji, umlauts, …). Chunked so big backups don't blow the call stack.
export function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64decode(b64) {
  const bin = atob(String(b64).replace(/\s+/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Accepts "owner", "repo", "owner/repo" or a full GitHub URL in either field.
export function parseRepo(owner = "", repo = "") {
  const clean = (s) => String(s || "").trim().replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  let o = clean(owner), r = clean(repo);
  if (r.includes("/")) [o, r] = r.split("/").slice(0, 2);
  else if (!r && o.includes("/")) [o, r] = o.split("/").slice(0, 2);
  const ok = /^[A-Za-z0-9-]{1,39}$/.test(o) && /^[A-Za-z0-9._-]{1,100}$/.test(r);
  return ok ? { owner: o, repo: r } : null;
}

// Backup payload = exportData() minus anything secret/device-only.
export function buildBackup(text = exportData()) {
  const j = JSON.parse(text);
  if (j && j.data) { delete j.data.sync; j.data.active = null; }
  return j;
}

const t = (x) => (typeof x === "number" ? x : Date.parse(x) || 0);
const stamp = (o) => Math.max(t(o?.updatedAt), t(o?.endedAt), t(o?.startedAt), 0);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function mergeById(loc = [], rem = [], pick) {
  const out = [], idx = new Map();
  for (const x of loc || []) {
    if (x && x.id != null && idx.has(x.id)) continue;
    if (x && x.id != null) idx.set(x.id, out.length);
    out.push(x);
  }
  for (const r of rem || []) {
    if (!r) continue;
    if (r.id == null) { if (!out.some((x) => same(x, r))) out.push(r); continue; }
    if (!idx.has(r.id)) { idx.set(r.id, out.length); out.push(r); continue; }
    const i = idx.get(r.id), l = out[i];
    if (same(l, r)) continue;
    const res = pick(l, r);
    if (res === "both") {
      // conflicting copies with no timestamps: keep the remote one under a derived id (idempotent)
      const cid = r.id + "-cloud";
      const ex = idx.has(cid) ? out[idx.get(cid)] : null;
      const copy = { ...r, id: cid, name: (r.name || "Workout").replace(/ \(cloud\)$/, "") + " (cloud)" };
      if (!ex) { idx.set(cid, out.length); out.push(copy); }
      else if (!same(ex, copy)) out[idx.get(cid)] = copy;
    } else out[i] = res;
  }
  return out;
}

function mergeNotes(loc = {}, rem = {}) {
  const out = { ...(rem || {}), ...(loc || {}) };
  for (const k of Object.keys(rem || {})) {
    const l = (loc || {})[k], r = rem[k];
    if (l == null || l === "") { out[k] = r; continue; }
    if (typeof l !== "string" || typeof r !== "string" || !r || l === r || l.includes(r)) continue;
    out[k] = r.includes(l) ? r : `${l}\n— ${r}`; // never drop either text
  }
  return out;
}

const bwKey = (e) => (e && (e.date ?? e.d ?? e.day ?? e.at ?? e.t)) ?? JSON.stringify(e);
function mergeBodyweight(loc = [], rem = []) {
  const m = new Map();
  for (const e of rem || []) m.set(String(bwKey(e)), e);
  for (const e of loc || []) {
    const k = String(bwKey(e)), r = m.get(k);
    m.set(k, r && t(r.updatedAt) > t(e?.updatedAt) ? r : e); // same date: local wins unless remote is newer
  }
  const arr = [...m.values()];
  const sortable = arr.every((e) => e && (typeof bwKey(e) === "number" || !isNaN(Date.parse(bwKey(e)))));
  return sortable ? arr.sort((a, b) => t(bwKey(a)) - t(bwKey(b))) : arr;
}

/**
 * Merge two `data` objects (the `data` part of an exportData() payload). Never drops records.
 * opts.preferRemoteSettings: used by restore() on a fresh phone so cloud settings come back.
 */
export function merge(local = {}, remote = {}, opts = {}) {
  local = local || {}; remote = remote || {};
  const out = {};
  const empty = (v) => v == null || (typeof v === "object" && Object.keys(v).length === 0); // BE-3: default {} / [] must not beat real cloud data
  for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) out[k] = empty(local[k]) ? remote[k] : local[k];

  out.sessions = mergeById(local.sessions, remote.sessions, (l, r) => (stamp(r) > stamp(l) ? r : l));
  out.workouts = mergeById(local.workouts, remote.workouts, (l, r) => {
    const lu = t(l.updatedAt), ru = t(r.updatedAt);
    if (!lu && !ru) return "both";
    return ru > lu ? r : l;
  });
  out.favorites = [...new Set([...(local.favorites || []), ...(remote.favorites || [])])];
  out.notes = mergeNotes(local.notes, remote.notes);
  out.bodyweight = mergeBodyweight(local.bodyweight, remote.bodyweight);
  // pain flags: union per exercise; plateau adjust: newest entry per exercise wins
  const lp = local.pain || {}, rp = remote.pain || {};
  out.pain = {};
  for (const k of new Set([...Object.keys(rp), ...Object.keys(lp)])) {
    const l = lp[k], r = rp[k];
    out.pain[k] = Array.isArray(l) || Array.isArray(r) ? [...new Set([...(Array.isArray(r) ? r : []), ...(Array.isArray(l) ? l : [])])] : (l ?? r);
  }
  const la = local.adjust || {}, ra = remote.adjust || {};
  out.adjust = { ...ra };
  for (const k of Object.keys(la)) if (!ra[k] || t(la[k]?.at) >= t(ra[k]?.at)) out.adjust[k] = la[k];

  const ls = local.settings || {}, rs = remote.settings || {};
  out.settings = opts.preferRemoteSettings ? { ...ls, ...rs } : { ...rs, ...ls };
  if (ls.onboarded || rs.onboarded) out.settings.onboarded = true;
  out.settings.lastBackup = Math.max(+ls.lastBackup || 0, +rs.lastBackup || 0);
  if (opts.preferRemoteSettings && remote.profile) out.profile = remote.profile;
  out.schema = Math.max(+local.schema || 0, +remote.schema || 0) || out.schema;

  out.active = local.active ?? null; // an in-progress workout is device-only
  delete out.sync;                   // token/config never travels (applyData keeps this device's own S.sync)
  return out;
}

/* ================= GitHub API ================= */

export class SyncError extends Error {
  constructor(msg, code, status) { super(msg); this.code = code; this.status = status; }
}

const cfg = () => (S.sync && S.sync.token ? S.sync : null);
const enc = (p) => p.split("/").map(encodeURIComponent).join("/");
const contentsUrl = (c) => `${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${enc(c.path || DEFAULT_PATH)}`;

async function gh(token, url, { method = "GET", body, accept = "application/vnd.github+json" } = {}) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new SyncError("You are offline. Backup will retry when you're back online.", "offline");
  let res;
  try {
    res = await fetch(url, {
      method, cache: "no-store",
      headers: { Accept: accept, Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new SyncError("Can't reach GitHub (offline or network error).", "offline");
  }
  if (res.ok) return res;
  let msg = "";
  try { msg = (await res.json()).message || ""; } catch {}
  const h = (k) => res.headers?.get?.(k);
  if (res.status === 401) throw new SyncError("GitHub rejected the token (expired, revoked or mistyped). Create a new token and connect again.", "auth", 401);
  if (res.status === 429 || (res.status === 403 && (h("x-ratelimit-remaining") === "0" || /rate limit/i.test(msg)))) {
    const reset = +h("x-ratelimit-reset") * 1000 || 0, after = +h("retry-after") * 1000 || 0;
    const when = reset ? new Date(reset) : after ? new Date(Date.now() + after) : null;
    throw new SyncError(`GitHub rate limit reached. Try again${when ? " after " + when.toLocaleTimeString() : " later"}.`, "ratelimit", res.status);
  }
  if (res.status === 403) throw new SyncError("The token is not allowed to do this. It needs \"Contents: Read and write\" on this repository.", "forbidden", 403);
  if (res.status === 404) throw new SyncError("Not found", "notfound", 404);
  if (res.status === 409 || res.status === 422) throw new SyncError(msg || "Conflict", "conflict", res.status);
  if (res.status >= 500) throw new SyncError("GitHub is having trouble right now. Will try again later.", "server", res.status);
  throw new SyncError(`GitHub error ${res.status}${msg ? ": " + msg : ""}`, "http", res.status);
}

// -> {sha, text} or null if the file does not exist yet
async function getRemote(c) {
  let res;
  try { res = await gh(c.token, `${contentsUrl(c)}?ref=${encodeURIComponent(c.branch || "main")}`); }
  catch (e) {
    if (e.code === "notfound") return null; // file missing, branch missing, or empty repo
    throw e;
  }
  const j = await res.json();
  if (Array.isArray(j) || j.type !== "file") throw new SyncError(`"${c.path}" in the repo is not a file.`, "http");
  let text;
  if (j.content && j.encoding === "base64") text = b64decode(j.content);
  else { // files > 1 MB: contents API omits the body, fetch the blob instead (up to 100 MB)
    const b = await (await gh(c.token, `${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/git/blobs/${j.sha}`)).json();
    text = b64decode(b.content);
  }
  return { sha: j.sha, text };
}

function parseBackup(text) {
  let j;
  try { j = JSON.parse(text); } catch { throw new SyncError("The backup file in the repo is not valid JSON.", "corrupt"); }
  const d = j && j.app === "gymy" ? j.data : j;
  if (!d || !Array.isArray(d.sessions) || !Array.isArray(d.workouts)) throw new SyncError("The file in the repo is not a Gym backup.", "corrupt");
  return { exportedAt: j.exportedAt || null, data: d };
}

/* ================= state helpers ================= */

const emit = () => { const s = status(); listeners.forEach((fn) => { try { fn(s); } catch {} }); };
export function onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function fail(e) {
  lastError = e?.message || String(e);
  if (S.sync) { S.sync.lastError = lastError; save("sync"); }
  emit();
  return e;
}
function ok() { lastError = null; if (S.sync) S.sync.lastError = null; }

let chain = Promise.resolve();
const exclusive = (fn) => {
  busy = (busy || 0) + 1;
  const p = chain.then(fn);
  chain = p.catch(() => {});
  return p.finally(() => { busy = busy > 1 ? busy - 1 : null; });
};

// Write merged data into S (all keys, never the device's sync config / active workout).
async function applyData(d) {
  for (const [k, v] of Object.entries(d)) {
    if (k === "sync" || k === "active") continue;
    S[k] = structuredClone(v);
  }
  save(...Object.keys(d).filter((k) => k !== "sync" && k !== "active"), "sync");
  await flush();
}

/* ================= public API ================= */

export async function connect({ owner, repo, token } = {}) {
  const pr = parseRepo(owner, repo);
  token = String(token || "").trim();
  if (!pr) return { ok: false, error: "Enter the repository as owner/name, e.g. yourname/gym-data." };
  if (!token) return { ok: false, error: "Paste your GitHub token." };
  try {
    let info;
    try { info = await (await gh(token, `${API}/repos/${pr.owner}/${pr.repo}`)).json(); }
    catch (e) {
      if (e.code === "notfound") throw new SyncError(`Repository ${pr.owner}/${pr.repo} not found, or the token was not given access to it.`, "notfound", 404);
      throw e;
    }
    if (!info.private) throw new SyncError("This repository is PUBLIC. Your workout data would be visible to everyone. Make it private (Settings → Danger Zone → Change visibility) or use a private repo.", "public");
    const c = { owner: info.owner?.login || pr.owner, repo: info.name || pr.repo, branch: info.default_branch || "main",
      path: S.sync?.path || DEFAULT_PATH, token };
    const remote = await getRemote(c);
    let remoteUpdatedAt = null;
    if (remote) { try { remoteUpdatedAt = parseBackup(remote.text).exportedAt; } catch { remoteUpdatedAt = null; } }
    // sha deliberately left null: the first push() will merge the cloud copy in before overwriting it.
    S.sync = { ...c, lastPush: S.sync?.lastPush || 0, lastPull: S.sync?.lastPull || 0, sha: null,
      auto: S.sync?.auto ?? true, dirty: false, lastError: null };
    ok(); save("sync"); await flush(); emit();
    return { ok: true, remoteExists: !!remote, remoteUpdatedAt };
  } catch (e) {
    lastError = e.message; emit();
    return { ok: false, error: e.message, code: e.code };
  }
}

export function pull() {
  return exclusive(async () => {
    const c = cfg(); if (!c) throw fail(new SyncError("Cloud backup is not connected.", "notconnected"));
    try {
      const r = await getRemote(c);
      if (!r) { ok(); emit(); return null; }
      const { data, exportedAt } = parseBackup(r.text);
      c.lastPull = Date.now(); ok(); save("sync"); emit();
      return { data, exportedAt, sha: r.sha };
    } catch (e) { throw fail(e); }
  });
}

async function pushOnce(c, retried) {
  if (!c.sha) {
    const r = await getRemote(c);
    if (r) { // cloud has data this device hasn't seen: merge it in first, never overwrite blindly
      const local = buildBackup().data;
      await applyData(merge(local, parseBackup(r.text).data));
      c.sha = r.sha; c.lastPull = c.lastMerge = Date.now(); // UI may want to re-render (see onStatus)
    }
  }
  const payload = JSON.stringify(buildBackup(), null, 1);
  if (c.token && payload.includes(c.token)) throw new SyncError("Refusing to upload: the token was found inside the backup.", "leak");
  const body = { message: `backup ${new Date().toISOString()}`, content: b64encode(payload), branch: c.branch || "main", ...(c.sha ? { sha: c.sha } : {}) };
  let res;
  try { res = await gh(c.token, contentsUrl(c), { method: "PUT", body }); }
  catch (e) {
    if (e.code === "conflict" && !retried) { c.sha = null; return pushOnce(c, true); } // someone else pushed: pull + merge + retry once
    if (e.code === "notfound" && !c.sha) { // brand-new empty repo: let GitHub create the default branch
      delete body.branch;
      try { res = await gh(c.token, contentsUrl(c), { method: "PUT", body }); }
      catch (e2) { throw e2.code === "notfound" ? new SyncError("Repository not found or empty. On GitHub, add a README file to the repo, then try again.", "notfound", 404) : e2; }
    } else throw e;
  }
  c.sha = (await res.json()).content?.sha || null;
}

export function push() {
  return exclusive(async () => {
    const c = cfg(); if (!c) throw fail(new SyncError("Cloud backup is not connected.", "notconnected"));
    try {
      c.dirty = false; // changes made during the upload set it again
      await pushOnce(c, false);
      c.lastPush = Date.now();
      ok(); save("sync"); emit();
      return { ok: true, at: c.lastPush };
    } catch (e) {
      c.dirty = true; save("sync");
      if (e.code === "offline") waitOnline();
      throw fail(e);
    }
  });
}

export async function restore() {
  const r = await pull();
  if (!r) throw fail(new SyncError("No backup found in the repository yet.", "notfound", 404));
  const local = buildBackup().data;
  const fresh = !(local.sessions || []).length && !(local.workouts || []).length;
  await exclusive(async () => {
    await applyData(merge(local, r.data, { preferRemoteSettings: fresh }));
    S.sync.sha = r.sha; save("sync"); await flush();
  });
  emit();
  return { ok: true, sessions: S.sessions.length, workouts: S.workouts.length, exportedAt: r.exportedAt };
}

// Call after every save() of user data. Safe to call any time (no-op when not connected / auto off).
export function autoPush() {
  const c = cfg(); if (!c || c.auto === false) return;
  if (!c.dirty) { c.dirty = true; save("sync"); }
  clearTimeout(debounce);
  if (typeof navigator !== "undefined" && navigator.onLine === false) { waitOnline(); return; }
  debounce = setTimeout(() => { debounce = null; push().catch(() => {}); }, DEBOUNCE_MS);
}

let waiting = false;
function waitOnline() {
  if (waiting || typeof addEventListener !== "function") return;
  waiting = true;
  addEventListener("online", () => { waiting = false; if (cfg()?.dirty) autoPush(); }, { once: true });
}

// Call once after loadStore(): resumes an upload that was pending when the app was closed.
export function initSync() {
  const c = cfg(); if (!c) return;
  lastError = c.lastError || null;
  if (c.dirty && c.auto !== false) autoPush();
}

export function setAuto(on) { if (!S.sync) return; S.sync.auto = !!on; save("sync"); if (on && S.sync.dirty) autoPush(); emit(); }

export async function disconnect() {
  clearTimeout(debounce); debounce = null;
  S.sync = null; lastError = null;
  save("sync"); await flush(); // overwrites the stored config: the token is gone from this device
  emit();
}

export function status() {
  const c = cfg();
  return { connected: !!c, owner: c?.owner || null, repo: c?.repo || null, auto: c ? c.auto !== false : false,
    pending: !!c?.dirty, lastPush: c?.lastPush || 0, lastPull: c?.lastPull || 0, lastMerge: c?.lastMerge || 0, error: lastError,
    busy: !!busy };
}
