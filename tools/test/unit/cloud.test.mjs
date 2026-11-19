// Q11 cloud.js (Supabase account backup) against an in-memory fake of the Supabase REST + auth endpoints.
import test from "node:test";
import assert from "node:assert/strict";
import { S } from "../../../app/js/store.js";
import * as C from "../../../app/js/cloud.js";

const URL0 = "https://abc.supabase.co";
const mem = new Map(); // store.js flush() falls back to localStorage without IndexedDB
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
function fake() {
  const srv = { row: null, calls: [], conflictOnce: false, refreshOk: true };
  srv.fetch = async (url, o = {}) => {
    const u = new URL(url), m = o.method || "GET", body = o.body ? JSON.parse(o.body) : null;
    srv.calls.push(`${m} ${u.pathname}${u.search}`);
    const res = (status, j) => ({ ok: status < 300, status, json: async () => j });
    if (u.pathname === "/auth/v1/token") {
      if (u.searchParams.get("grant_type") === "refresh_token") return srv.refreshOk ? res(200, { access_token: "a2", refresh_token: "r2", expires_in: 3600, user: { id: "u1", email: "me@x.io" } }) : res(400, { error: "invalid_grant" });
      return res(200, { access_token: "a1", refresh_token: "r1", expires_in: 3600, user: { id: "u1", email: "me@x.io" } });
    }
    if (u.pathname === "/auth/v1/logout") return res(204, null);
    if (u.pathname !== "/rest/v1/gym_backups") return res(404, {});
    assert.equal(o.headers.apikey, "anon");
    assert.match(o.headers.Authorization, /^Bearer a/);
    if (m === "GET") return res(200, srv.row ? [{ data: srv.row.data, rev: srv.row.rev }] : []);
    if (m === "POST") { if (srv.row) return res(409, {}); srv.row = { data: body.data, rev: 1 }; return res(201, null); }
    if (m === "PATCH") {
      const want = +u.searchParams.get("rev").replace("eq.", "");
      if (srv.conflictOnce) { srv.conflictOnce = false; srv.row.rev++; srv.row.data.data.favorites.push("other-phone"); return res(200, []); }
      if (!srv.row || srv.row.rev !== want) return res(200, []);
      srv.row = { data: body.data, rev: body.rev }; return res(200, [{ rev: body.rev }]);
    }
    if (m === "DELETE") { srv.row = null; return res(204, null); }
  };
  return srv;
}
const sess = (id, t0) => ({ id, startedAt: t0, endedAt: t0 + 3600e3, entries: [{ slug: "x", sets: [{ w: "60", r: "10", done: true, type: "n" }] }] });
function reset(srv) {
  Object.assign(S, { sessions: [], workouts: [], favorites: [], notes: {}, notesAt: {}, bodyweight: [], pain: {}, adjust: {}, deleted: {}, profile: null });
  S.cloud = { uid: "u1", email: "me@x.io", access: "a1", refresh: "r1", exp: Date.now() + 3600e3 };
  C._test({ fetch: srv.fetch, config: { url: URL0, key: "anon" } });
}

test("validConfig: https project URL + key, else hidden", () => {
  assert.deepEqual(C.validConfig({ url: URL0 + "/", key: "k" }), { url: URL0, key: "k" });
  assert.equal(C.validConfig({ url: "http://abc.supabase.co", key: "k" }), null);
  assert.equal(C.validConfig({ url: URL0 + "/rest", key: "k" }), null);
  assert.equal(C.validConfig({ url: URL0, key: "" }), null);
  assert.equal(C.validConfig({}), null);
  assert.ok(C.validConfig({ url: "http://localhost:8766", key: "k" }));
});

test("first sync with nothing in the cloud uploads (no token in the payload)", async () => {
  const srv = fake(); reset(srv); S.sessions = [sess("s1", 1e12)];
  await C.syncNow();
  assert.equal(srv.row.rev, 1);
  assert.equal(srv.row.data.data.sessions[0].id, "s1");
  assert.ok(!JSON.stringify(srv.row.data).includes("r1"), "refresh token must never be uploaded");
  assert.equal(srv.row.data.data.cloud, undefined);
});

test("empty device restores from the cloud and does not write back", async () => {
  const srv = fake(); reset(srv); S.sessions = [sess("s1", 1e12)]; S.favorites = ["bench"];
  await C.syncNow();
  const writes = () => srv.calls.filter((c) => !c.startsWith("GET")).length;
  const before = writes();
  reset(srv); // fresh phone, same account
  const r = await C.syncNow();
  assert.equal(r.restored, true);
  assert.deepEqual(S.sessions.map((s) => s.id), ["s1"]);
  assert.deepEqual(S.favorites, ["bench"]);
  assert.equal(writes(), before, "nothing new -> no write");
});

test("both sides have data -> merged, written with the row version", async () => {
  const srv = fake(); reset(srv); S.sessions = [sess("a", 1e12)];
  await C.syncNow();
  reset(srv); S.sessions = [sess("b", 2e12)];
  await C.syncNow();
  assert.deepEqual(S.sessions.map((s) => s.id).sort(), ["a", "b"]);
  assert.deepEqual(srv.row.data.data.sessions.map((s) => s.id).sort(), ["a", "b"]);
  assert.equal(srv.row.rev, 2);
  assert.ok(srv.calls.some((c) => c.startsWith("PATCH") && c.includes("rev=eq.1")));
});

test("another phone wrote in between -> read + merge again, nothing lost", async () => {
  const srv = fake(); reset(srv); S.favorites = ["a"];
  await C.syncNow();
  S.favorites = ["a", "b"]; srv.conflictOnce = true;
  await C.syncNow();
  assert.deepEqual([...srv.row.data.data.favorites].sort(), ["a", "b", "other-phone"]);
  assert.ok(S.favorites.includes("other-phone"));
});

test("newer schema in the cloud is refused (BE-6)", async () => {
  const srv = fake(); reset(srv);
  srv.row = { rev: 1, data: { app: "gymy", schema: 99, data: { schema: 99, sessions: [], workouts: [] } } };
  await assert.rejects(C.syncNow(), (e) => e.code === "newer");
  assert.equal(srv.row.rev, 1);
});

test("expired access token is refreshed; a dead refresh token signs out", async () => {
  const srv = fake(); reset(srv); S.cloud.exp = Date.now() - 1;
  await C.syncNow();
  assert.equal(S.cloud.access, "a2"); assert.equal(S.cloud.refresh, "r2");
  S.cloud.exp = Date.now() - 1; srv.refreshOk = false;
  await assert.rejects(C.syncNow(), (e) => e.code === "auth");
  assert.equal(C.status().signedIn, false); assert.equal(C.status().expired, true);
});

test("delete my cloud data removes the row and signs out; local data stays", async () => {
  const srv = fake(); reset(srv); S.sessions = [sess("s1", 1e12)];
  await C.syncNow();
  await C.deleteCloudData();
  assert.equal(srv.row, null);
  assert.equal(S.cloud, null);
  assert.equal(S.sessions.length, 1);
});
