// Optional account: "Sign in with Google" + ONE backup row per user in Supabase (docs/SUPABASE.md).
// Hidden until the deploy writes supabase-config.json ({url, key} = project URL + public anon key).
// No libraries: OAuth PKCE + PostgREST over fetch. Sessions (tokens) live in IndexedDB key "cloud" and are never
// put into a backup. The data itself is merged exactly like the GitHub backup (sync.js merge: ids, tombstones,
// notes by edit time, newer-schema refusal), so two devices never overwrite each other.
import { S, save, onSave, resetUserData } from "./store.js";
import { merge, buildBackup, parseBackup, applyData, isApplying, SyncError } from "./sync.js";
import { t } from "./i18n.js";

const TABLE = "gym_backups";
const DEBOUNCE_MS = 20000, PULL_GAP = 10000;
const OWNER = "gym-data-uid"; // Q20 localStorage: the account this device's data belongs to (kept after "Sign out, keep data")
const PK = "gym-pkce"; // localStorage: PKCE verifier + the hash to return to (survives the Google redirect)

let conf = null;        // null = not loaded yet, false = no config (feature hidden), {url,key}
let f = (...a) => fetch(...a);
let lastError = null, debounce = null, lastSync = 0, hooked = false;
const listeners = new Set();

/* ================= config ================= */

// https URL without a path (+ http://localhost for the mock test), non-empty key
export function validConfig(j) {
  const url = String(j?.url || "").trim().replace(/\/+$/, ""), key = String(j?.key || "").trim();
  if (!key || !/^(https:\/\/[a-z0-9.-]+|http:\/\/localhost(:\d+)?)$/i.test(url)) return null;
  return { url, key };
}
export async function loadConfig() {
  if (conf === null) {
    try { const r = await f("supabase-config.json", { cache: "no-store" }); conf = (r.ok && validConfig(await r.json())) || false; }
    catch { conf = false; }
  }
  return conf || null;
}
export const configured = () => !!conf;
// unit tests: inject fetch / config
export function _test({ fetch: ff, config } = {}) { if (ff) f = ff; if (config !== undefined) conf = config; lastError = null; }

/* ================= HTTP ================= */

async function req(path, { method = "GET", body, token, headers = {} } = {}) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new SyncError(t("You are offline. Backup will retry when you're back online."), "offline");
  let res;
  try {
    res = await f(conf.url + path, { method, cache: "no-store",
      headers: { apikey: conf.key, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined });
  } catch { throw new SyncError(t("Can't reach the server (offline or network error)."), "offline"); }
  if (res.ok) return res;
  let msg = "";
  try { const j = await res.json(); msg = j.msg || j.message || j.error_description || j.error || ""; } catch {}
  if (res.status === 401) throw new SyncError(t("Signed out. Sign in again to keep backing up."), "auth", 401);
  if (res.status === 409) throw new SyncError("Conflict", "conflict", 409);
  if (res.status >= 500) throw new SyncError(t("The server is having trouble right now. Will try again later."), "server", res.status);
  throw new SyncError(t("Server error {code}", { code: res.status }) + (msg ? ": " + msg : ""), "http", res.status);
}

/* ================= session ================= */

function setSession(s) {
  const prev = S.cloud || {}, uid = s.user?.id || prev.uid;
  S.cloud = { ...(prev.uid === uid ? prev : {}), uid, email: s.user?.email || prev.email || "",
    access: s.access_token, refresh: s.refresh_token || prev.refresh,
    exp: s.expires_at ? s.expires_at * 1000 : Date.now() + (+s.expires_in || 3600) * 1000 };
  save("cloud");
  if (uid) try { localStorage.setItem(OWNER, uid); } catch {}
}

async function token() {
  const c = S.cloud;
  if (!c?.refresh) throw new SyncError(t("Signed out. Sign in again to keep backing up."), "auth");
  if (c.access && c.exp - 60000 > Date.now()) return c.access;
  try { setSession(await (await req("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: c.refresh } })).json()); }
  catch (e) {
    if (e.code === "auth" || e.status === 400) { c.access = c.refresh = null; save("cloud"); throw new SyncError(t("Signed out. Sign in again to keep backing up."), "auth"); }
    throw e;
  }
  return S.cloud.access;
}

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Leaves the page for Google (via Supabase). The hash route is restored after the redirect back. */
export async function signIn() {
  const c = await loadConfig(); if (!c) return;
  const ver = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ver)));
  localStorage.setItem(PK, JSON.stringify({ ver, hash: location.hash || "#/me/settings", at: Date.now() })); // at: Fluent365 (same origin + Supabase project) forwards a ?code to /gym/ only within 10 min
  const back = location.origin + location.pathname; // never the hash: PKCE returns ?code=… and our routes use #
  location.assign(`${c.url}/auth/v1/authorize?` + new URLSearchParams({ provider: "google", redirect_to: back, code_challenge: challenge, code_challenge_method: "s256" }));
}

/** At boot: are we coming back from the Google sign-in? (only when this device started one) */
export function pendingReturn() {
  let p = null; try { p = JSON.parse(localStorage.getItem(PK) || "null"); } catch {}
  const q = new URLSearchParams(location.search);
  return p && (q.has("code") || q.has("error")) ? { p, q } : null;
}

/** Restores the route at once (sync part), then trades the code for a session and runs the first sync. */
export async function finishSignIn({ p, q }) {
  try { localStorage.removeItem(PK); } catch {}
  history.replaceState(null, "", location.pathname + (p.hash || "#/me/settings"));
  const code = q.get("code");
  if (!code) return { ok: false, error: q.get("error_description") || t("Sign-in was cancelled.") };
  try {
    if (!(await loadConfig())) throw new SyncError(t("Sign-in was not finished. Try again."), "config");
    let owner = null; try { owner = localStorage.getItem(OWNER); } catch {}
    setSession(await (await req("/auth/v1/token?grant_type=pkce", { method: "POST", body: { auth_code: code, code_verifier: p.ver } })).json());
    // Q20: another account's data is on this phone -> ask instead of merging two people's workouts
    if (owner && owner !== S.cloud.uid && hasUserData()) {
      const { choose } = await import("./ui.js");
      const c = await choose(t("This phone has another account's data"), t("You signed in as {email}. The workouts on this phone belong to a different account.", { email: S.cloud.email || "?" }),
        [["only", t("Use only this account's data")], ["add", t("Add this phone's data to this account")]]);
      if (!c) { await signOut(); try { localStorage.setItem(OWNER, owner); } catch {} return { ok: false, error: t("Sign-in cancelled. Nothing was changed.") }; }
      if (c === "only") await resetUserData();
    }
    hook();
    const r = await syncNow();
    return { ok: true, restored: r.restored };
  } catch (e) { fail(e); return { ok: false, error: e.message }; }
}

export async function signOut() {
  clearTimeout(debounce); debounce = null;
  const c = S.cloud;
  if (c?.access && conf) req("/auth/v1/logout?scope=local", { method: "POST", token: c.access }).catch(() => {}); // best effort
  S.cloud = null; lastError = null; save("cloud"); emit();
}

const hasUserData = () => ["sessions", "workouts", "favorites", "bodyweight"].some((k) => S[k]?.length) || !!S.profile;

/** Q20: backs up first, then signs out and empties this device (false = the backup failed, nothing was removed). */
export async function signOutAndRemove() {
  try { await syncNow(); } catch { return false; }
  await signOut(); await resetUserData();
  try { localStorage.removeItem(OWNER); } catch {}
  return true;
}

/** Deletes this user's Gym row (the data on this device stays), then signs out. */
export async function deleteCloudData() {
  await exclusive(async () => {
    const tk = await token();
    await req(`/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(S.cloud.uid)}`, { method: "DELETE", token: tk });
  });
  await signOut();
}

/* ================= sync ================= */

const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

async function getRow() {
  const r = await req(`/rest/v1/${TABLE}?select=data,rev&user_id=eq.${encodeURIComponent(S.cloud.uid)}`, { token: await token() });
  const a = await r.json();
  return Array.isArray(a) && a[0] ? a[0] : null;
}

// rev = the row version we read (null = no row yet). A row changed in between -> "conflict" -> read + merge again.
async function putRow(payload, rev) {
  const tk = await token(), uid = S.cloud.uid, at = new Date().toISOString();
  if (rev == null) {
    await req(`/rest/v1/${TABLE}`, { method: "POST", token: tk, body: { user_id: uid, data: payload, rev: 1, updated_at: at }, headers: { Prefer: "return=minimal" } });
    return;
  }
  const r = await req(`/rest/v1/${TABLE}?user_id=eq.${encodeURIComponent(uid)}&rev=eq.${+rev}&select=rev`,
    { method: "PATCH", token: tk, body: { data: payload, rev: +rev + 1, updated_at: at }, headers: { Prefer: "return=representation" } });
  const a = await r.json();
  if (!Array.isArray(a) || !a.length) throw new SyncError("Conflict", "conflict", 409);
}

let chain = Promise.resolve(), busy = 0;
const exclusive = (fn) => { busy++; const p = chain.then(fn); chain = p.catch(() => {}); return p.finally(() => { busy--; emit(); }); };

/** Read the row, merge it into this device, write the result back if the cloud is missing something. */
export function syncNow() {
  return exclusive(async () => {
    const c = S.cloud; if (!c?.refresh) throw new SyncError(t("Signed out. Sign in again to keep backing up."), "auth");
    lastSync = Date.now();
    try {
      let restored = false;
      for (let i = 0; ; i++) {
        c.dirty = false; // a change made while this runs sets it again
        const row = await getRow();
        let remote = null;
        if (row) {
          remote = parseBackup(JSON.stringify(row.data)).data; // BE-6: newer schema -> refused
          const local = buildBackup().data;
          const fresh = !(local.sessions || []).length && !(local.workouts || []).length;
          const merged = merge(local, remote, { preferRemoteSettings: fresh });
          if (stable(merged) !== stable(local)) { await applyData(merged); restored = restored || fresh; }
          S.cloud.lastPull = Date.now();
        }
        const payload = buildBackup();
        if (remote && stable(payload.data) === stable(remote)) break; // cloud already has all of it
        try { await putRow(payload, row ? row.rev : null); S.cloud.lastPush = Date.now(); break; }
        catch (e) { if (e.code !== "conflict" || i) throw e; } // another device wrote in between: once more
      }
      lastError = null; S.cloud.lastError = null; save("cloud"); emit();
      return { ok: true, restored };
    } catch (e) {
      if (S.cloud) { S.cloud.dirty = true; save("cloud"); }
      if (e.code === "offline") waitOnline();
      throw fail(e);
    }
  });
}

function fail(e) {
  lastError = e?.message || String(e);
  if (S.cloud) { S.cloud.lastError = lastError; save("cloud"); }
  emit();
  return e;
}

export function autoSync() {
  const c = S.cloud; if (!c?.refresh) return;
  if (!c.dirty) { c.dirty = true; save("cloud"); }
  clearTimeout(debounce);
  if (typeof navigator !== "undefined" && navigator.onLine === false) { waitOnline(); return; }
  debounce = setTimeout(() => { debounce = null; syncNow().catch(() => {}); }, DEBOUNCE_MS);
}

let waiting = false;
function waitOnline() {
  if (waiting || typeof addEventListener !== "function") return;
  waiting = true;
  addEventListener("online", () => { waiting = false; if (S.cloud?.dirty) autoSync(); }, { once: true });
}

function hook() {
  if (hooked) return; hooked = true;
  onSave((keys) => { if (!isApplying() && keys.some((k) => !["active", "sync", "cloud"].includes(k))) autoSync(); });
  if (typeof document === "undefined") return;
  // Back on screen / window focused (laptop) -> pull what the other device did.
  const pullNow = () => { if (S.cloud?.refresh && Date.now() - lastSync > PULL_GAP) syncNow().catch(() => {}); };
  // Leaving -> send a pending change now: phones freeze the 20 s timer in the background, so the other
  // device would not see the last sets until this phone is opened again (Fluent365 3/6 bug, 2026-11-21).
  const leave = () => { if (S.cloud?.refresh && S.cloud.dirty) { clearTimeout(debounce); debounce = null; syncNow().catch(() => {}); } };
  document.addEventListener("visibilitychange", () => (document.hidden ? leave() : pullNow()));
  addEventListener("focus", pullNow);
  addEventListener("pagehide", leave);
}

/** Boot (after loadStore): signed in -> hook saves, pull what other devices added. Costs nothing when signed out. */
export async function initCloud() {
  if (!S.cloud?.refresh || !(await loadConfig())) return;
  lastError = S.cloud.lastError || null;
  hook();
  syncNow().catch(() => {});
}

/* ================= status ================= */

const emit = () => { const s = status(); listeners.forEach((fn) => { try { fn(s); } catch {} }); };
export function onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function status() {
  const c = S.cloud;
  return { configured: !!conf, signedIn: !!c?.refresh, expired: !!c?.uid && !c?.refresh, email: c?.email || "",
    lastPush: c?.lastPush || 0, lastPull: c?.lastPull || 0, pending: !!c?.dirty, error: lastError, busy: busy > 0 };
}
