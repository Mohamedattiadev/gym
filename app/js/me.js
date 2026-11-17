// Me: progress tracking (week vs week, charts, PRs, heat map, bodyweight) + history. Settings page.
import { S, save, persist, exportData, importData, flush } from "./store.js";
import { $, $$, esc, ic, ask, askText, toast, haptic, fmtDate, fmtDur, lineChart, vBars, delta, fmtKg, indicate, selectIn } from "./ui.js";
import { EX, BY, EQUIP_PROFILES, bestOf, setsText, weeklyVolume, periodStats, exerciseStats, weekStart, WEEK, DAY, history, flaggedJoints, JOINTS } from "./data.js";
import { MUSCLES, MBY } from "./body.js";
import { e1rm } from "./calc.js";
import { setTop, applyTheme, fillIll, installNow, standalone, MEDIA_CACHE, tierBadge } from "./main.js";
import { lib } from "./exercise.js";
import * as Sync from "./sync.js";

const view = () => $("#view");
const me = { tab: "progress", ex: null };
const u = () => S.settings.unit;

export function meView() {
  setTop({ title: "Me" });
  view().innerHTML = `<div class="ptabs" id="mtabs">${[["progress", "Progress"], ["history", "History"]].map(([k, l]) => `<button data-k="${k}" class="${me.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="tab-panel" id="mpanel"></div>
    <div class="card list-sep" style="margin-top:18px">
      <a class="setrow-s" href="#/guide"><span class="ico">${ic("info", "sm")}</span><b class="grow">Guides</b><span class="v hide-s">Plan quiz, strength goals, nutrition</span>${ic("chev", "sm")}</a>
      <a class="setrow-s" href="#/settings"><span class="ico">${ic("settings", "sm")}</span><b class="grow">Settings</b><span class="v hide-s">Theme, units, backup</span>${ic("chev", "sm")}</a></div>`;
  $("#mtabs").onclick = (e) => { const b = e.target.closest("button"); if (!b || b.classList.contains("on")) return; haptic(); me.tab = b.dataset.k; selectIn(b); panel(); };
  panel();
}
function panel() {
  const p = $("#mpanel"); p.style.animation = "none"; void p.offsetWidth; p.style.animation = "";
  me.tab === "history" ? historyPanel(p) : progressPanel(p);
  fillIll(p); requestAnimationFrame(() => indicate(p));
}

/* ---------------- progress ---------------- */
function progressPanel(p) {
  if (!S.sessions.length) {
    p.innerHTML = `<div class="card pad" style="text-align:center"><div class="ill" data-ill="empty-history" style="max-width:150px"></div><b>No workouts yet</b><div class="muted small">Finish a workout and your progress, records and weekly totals show up here.</div></div>
      <div style="margin-top:12px">${bodyweightCard()}</div>`;
    wireBW(p); return;
  }
  const w0 = weekStart(), now = Date.now();
  const cur = periodStats(w0, now + 1), prev = periodStats(w0 - WEEK, w0);
  const kpi = (v, l, d) => `<div class="kpi"><b class="num">${v}</b><span>${l}</span>${d}</div>`;
  const weeks = Array.from({ length: 8 }, (_, i) => { const a = w0 - (7 - i) * WEEK; return [new Date(a).toLocaleDateString(undefined, { day: "numeric", month: "numeric" }), periodStats(a, a + WEEK).kg, i === 7]; });
  const vol = weeklyVolume(7);
  const mus = MUSCLES.filter((m) => m.lm[0] > 0).map((m) => [m, Math.round(vol[m.id] || 0)]).sort((a, b) => b[1] - a[1]);
  const mx = Math.max(10, ...mus.map((x) => x[1]));
  p.innerHTML = `<div class="cols">
    <div class="stack">
      <div class="card pad"><div class="row between"><b>This week</b><span class="dim tiny">vs last week</span></div>
        <div class="kpis" style="margin-top:10px">${kpi(fmtKg(cur.kg), `Volume ${u()}`, delta(cur.kg, prev.kg, fmtKg))}${kpi(cur.sets, "Hard sets", delta(cur.sets, prev.sets))}${kpi(cur.reps, "Reps", delta(cur.reps, prev.reps))}</div></div>
      <div class="card pad"><div class="row between" style="margin-bottom:10px"><b>Weekly volume</b><span class="dim tiny">${u()} lifted · 8 weeks</span></div>${vBars(weeks.map(([l, v, c]) => [l, v, c]))}</div>
      <div class="card pad"><div class="row between" style="margin-bottom:10px"><b>Sets per muscle</b><span class="dim tiny">last 7 days · aim 10+</span></div>
        <div class="bars">${mus.map(([m, n]) => `<div><span class="ellip">${m.name}</span><div class="b"><i class="${n < 10 && m.lm[0] > 0 ? "low" : ""}" style="width:${(n / mx) * 100}%"></i></div><span class="v num">${n}</span></div>`).join("")}</div></div>
    </div>
    <div class="stack">
      ${progressChart()}
      ${perExercise(w0)}
      ${prList()}
      <div class="card pad"><div class="row between" style="margin-bottom:10px"><b>Last 16 weeks</b><span class="dim tiny">${S.sessions.filter((s) => s.endedAt > now - 112 * DAY).length} workouts</span></div>${heatMap()}</div>
      ${bodyweightCard()}
    </div></div>`;
  wireChart(p); wireBW(p);
}
function perExercise(w0) {
  const cur = exerciseStats(w0, Date.now() + 1), prev = exerciseStats(w0 - WEEK, w0);
  const slugs = [...new Set([...Object.keys(cur), ...Object.keys(prev)])].filter((s) => BY[s]).slice(0, 8);
  if (!slugs.length) return "";
  const cell = (o) => (o ? `${o.sets}×${Math.round(o.reps / o.sets)}${o.best?.w ? ` · ${o.best.w}` : ""}` : `<span class="dim">—</span>`);
  return `<div class="card pad"><div class="row between"><b>Per exercise</b><span class="dim tiny">sets×reps · top ${u()}</span></div>
    <table class="cmp" style="margin-top:6px"><tr><th>Exercise</th><th class="n">Last wk</th><th class="n">This wk</th></tr>
    ${slugs.map((s) => { const c = cur[s], l = prev[s]; const up = c && l && c.e1 > l.e1;
      return `<tr><td><a href="#/ex/${s}" class="b">${esc(BY[s].name)}</a></td><td class="n">${cell(l)}</td><td class="n">${cell(c)}${up ? ` <span class="d up" style="display:inline-flex">${ic("arrowUp", "xs")}</span>` : ""}</td></tr>`; }).join("")}</table></div>`;
}
function topExercises() {
  const n = {}; S.sessions.forEach((s) => s.entries.forEach((en) => { if (en.sets.some((x) => x.done && x.type !== "w" && (+x.w || +x.r))) n[en.slug] = (n[en.slug] || 0) + 1; })); // same rule as history()
  return Object.keys(n).filter((s) => BY[s] && n[s] >= 2).sort((a, b) => n[b] - n[a]).slice(0, 6);
}
function progressChart() {
  const tops = topExercises(); if (!tops.length) return "";
  if (!tops.includes(me.ex)) me.ex = tops[0];
  return `<div class="card pad" id="pchart"><div class="row between"><b>Strength</b><span class="dim tiny">est. 1RM per session</span></div>
    <div class="chips" style="margin:6px 0 2px;padding-inline:0;margin-inline:0" id="pex">${tops.map((s) => `<button class="chip ${s === me.ex ? "on" : ""}" data-s="${s}">${esc(BY[s].name.length > 22 ? BY[s].name.slice(0, 21) + "…" : BY[s].name)}</button>`).join("")}</div>
    <div id="pplot">${plot(me.ex)}</div></div>`;
}
function plot(slug) {
  const h = history(slug); const pts = h.map((x) => Math.max(...x.sets.map((s) => e1rm(s.w, s.r))));
  if (pts.length < 2) return `<p class="dim small" style="margin:8px 0 0">Log this exercise in two sessions to see the trend.</p>`;
  const b = bestOf(slug);
  return `${lineChart(pts)}<div class="chart-x"><span>${fmtDate(h[0].date, { month: "short", day: "numeric" })}</span><span>Best ${b?.e1rm ?? "—"}${u()}</span><span>${fmtDate(h.at(-1).date, { month: "short", day: "numeric" })}</span></div>`;
}
function wireChart(p) { const c = $("#pex", p); if (c) c.onclick = (e) => { const b = e.target.closest("[data-s]"); if (!b) return; haptic(); me.ex = b.dataset.s; $$(".chip", c).forEach((x) => x.classList.toggle("on", x === b)); $("#pplot", p).innerHTML = plot(me.ex); }; }
function prList() {
  const prs = Object.keys(BY).map((s) => [s, bestOf(s)]).filter(([, b]) => b).sort((a, b) => b[1].date - a[1].date).slice(0, 6);
  if (!prs.length) return "";
  return `<div class="card pad"><div class="row between" style="margin-bottom:6px"><b>Personal records</b>${ic("trophy", "sm")}</div><div class="list-sep">${prs.map(([s, b]) => `<a class="lrow plain" href="#/ex/${s}"><img src="${BY[s].poster}" alt="" style="width:40px;height:40px"><div class="grow"><div class="t ellip">${esc(BY[s].name)}</div><div class="s">${b.w}${u()} × ${b.r} · ${fmtDate(b.date, { month: "short", day: "numeric" })}</div></div><b class="num">${b.e1rm}<span class="dim tiny"> e1RM</span></b></a>`).join("")}</div></div>`;
}
function heatMap() {
  const end = weekStart() + WEEK, start = end - 16 * WEEK, cnt = {};
  S.sessions.forEach((s) => { if (s.endedAt >= start) { const k = Math.floor((s.endedAt - start) / DAY); cnt[k] = (cnt[k] || 0) + 1; } });
  const today = Math.floor((Date.now() - start) / DAY);
  return `<div class="heat">${Array.from({ length: 112 }, (_, i) => `<i class="${i > today ? "fut" : cnt[i] ? "l" + Math.min(3, cnt[i] + 1) : ""}" title="${fmtDate(start + i * DAY)}"></i>`).join("")}</div>
    <div class="chart-x"><span>${fmtDate(start, { month: "short", day: "numeric" })}</span><span>Today</span></div>`;
}

/* ---------------- bodyweight ---------------- */
const bw = () => [...(S.bodyweight || [])].filter((x) => x && +x.w).sort((a, b) => String(a.d).localeCompare(String(b.d)));
function bodyweightCard() {
  const l = bw(), last = l.at(-1), first = l.length > 1 ? l[0] : null;
  return `<div class="card pad"><div class="row between"><div class="row"><span class="ico-t">${ic("scale", "sm")}</span><div><b>Bodyweight</b>
      <div class="dim small">${last ? `${last.w}${u()} · ${fmtDate(last.d, { month: "short", day: "numeric" })}${first ? ` · ${(last.w - first.w > 0 ? "+" : "") + Math.round((last.w - first.w) * 10) / 10}${u()} total` : ""}` : "Log it once a week, same time of day."}</div></div></div>
      <button class="btn sm" id="bwAdd">${ic("plus", "sm")} Add</button></div>
    ${l.length > 1 ? `<div style="margin-top:10px">${lineChart(l.slice(-20).map((x) => +x.w), { h: 90 })}</div>` : ""}</div>`;
}
function wireBW(p) {
  const b = $("#bwAdd", p); if (!b) return;
  b.onclick = async () => {
    const v = await askText(`Bodyweight today (${u()})`, { value: bw().at(-1)?.w ?? "", inputmode: "decimal", ok: "Save" });
    const w = parseFloat(String(v || "").replace(",", ".")); if (!w || w < 20 || w > 400) { if (v) toast("Enter a number like 78.5"); return; }
    const d = new Date().toISOString().slice(0, 10);
    S.bodyweight = [...(S.bodyweight || []).filter((x) => x.d !== d), { d, w, updatedAt: Date.now() }];
    save("bodyweight"); Sync.autoPush(); haptic("success"); toast("Saved"); panel();
  };
}

/* ---------------- history ---------------- */
function historyPanel(p) {
  const ss = [...S.sessions].reverse();
  p.innerHTML = ss.length ? `<div class="stack tight stagger">${ss.slice(0, 60).map((s) => `<div class="card pad">
      <div class="row"><div class="grow"><b>${esc(s.name)}</b><div class="dim small">${fmtDate(s.endedAt)} · ${fmtDur(s.endedAt - s.startedAt)} · ${s.entries.reduce((a, en) => a + en.sets.length, 0)} sets</div></div>
      <button class="iconbtn sm" data-del="${s.id}" aria-label="Delete" style="color:var(--t3)">${ic("trash", "sm")}</button></div>
      ${s.entries.map((en) => `<div class="small" style="margin-top:6px"><b class="b">${esc(BY[en.slug]?.name || en.slug)}</b> <span class="dim">${esc(setsText(en.sets))}</span></div>`).join("")}</div>`).join("")}</div>`
    : `<div class="empty"><div class="ill" data-ill="empty-history"></div>Finished workouts appear here.</div>`;
  p.onclick = async (e) => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    const old = S.sessions;
    if (await ask("Delete this workout from your history?", { ok: "Delete", danger: true })) {
      S.sessions = S.sessions.filter((x) => x.id !== b.dataset.del); save("sessions"); Sync.autoPush(); panel();
      toast("Workout deleted", 1900, { label: "Undo", fn: () => { S.sessions = old; save("sessions"); Sync.autoPush(); panel(); } });
    }
  };
}

/* ================= SETTINGS ================= */
const segH = (id, opts, cur) => `<div class="seg sm" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
export async function settingsView() {
  setTop({ title: "Settings", back: innerWidth < 768 });
  const total = EX.reduce((n, e) => n + (e.video ? 2 : 1), 0);
  const st = S.settings, joints = flaggedJoints();
  const row = (icn, label, ctl, sub = "") => `<div class="setrow-s"><span class="ico">${ic(icn, "sm")}</span><div class="grow"><b>${label}</b>${sub ? `<div class="dim tiny">${sub}</div>` : ""}</div>${ctl}</div>`;
  view().innerHTML = `<div class="cols"><div class="stack">
      <div class="card list-sep">
        ${row(document.documentElement.dataset.theme === "light" ? "sun" : "moon", "Theme", segH("sTheme", [["light", "Light"], ["dark", "Dark"], ["system", "Auto"]], st.theme || "system"))}
        <div class="setrow-s wrap">${`<span class="ico">${ic("dumbbell", "sm")}</span><div class="grow"><b>Equipment</b><div class="dim tiny">Library, plans and swaps show only what you have</div></div>`}${segH("sEquip", [["gym", "Full gym"], ["dumbbells", "Dumbbells"], ["home", "Home"]], st.equip || "gym").replace('class="seg sm"', 'class="seg sm block"')}</div>
        ${row("scale", "Units", segH("sUnit", [["kg", "kg"], ["lb", "lb"]], st.unit))}
        ${row("calc", "Bar weight", segH("sBar", [[20, "20"], [15, "15"], [10, "10"]], st.bar))}
      </div>
      <div class="card list-sep">
        ${row("timer", "Auto rest timer", `<button class="switch ${st.autoRest ? "on" : ""}" data-k="autoRest" aria-label="Auto rest timer"></button>`, "Starts after every checked set")}
        ${row("bolt", "Sound", `<button class="switch ${st.sound ? "on" : ""}" data-k="sound" aria-label="Sound"></button>`)}
        ${row("phone", "Vibration", `<button class="switch ${st.haptics ? "on" : ""}" data-k="haptics" aria-label="Vibration"></button>`)}
      </div>
      ${joints.length ? `<div class="card pad"><div class="row"><span class="ico-t">${ic("bandage", "sm")}</span><div class="grow"><b>Pain flags</b><div class="dim small">${joints.map((j) => esc(JOINTS[j]?.name?.en || j)).join(", ")} · ${Object.keys(S.pain).length} exercises hidden</div></div><button class="btn sm" id="clrPain">Clear</button></div></div>` : ""}
    </div><div class="stack">
      <div class="card pad"><b>Offline videos</b><p class="muted small" style="margin:4px 0 10px">Videos save as you watch. Download all once on Wi-Fi (~500 MB) for full offline use.</p>
        <div class="progress"><div id="bar"></div></div><div class="dim small" style="margin:8px 0 10px" id="cstat">Checking…</div>
        <div class="row"><button class="btn primary sm grow" id="dlAll">${ic("download", "sm")} All</button><button class="btn sm grow" id="dlTop">S + A tier only</button></div></div>
      <div class="card pad" id="cloud">${cloudCard()}</div>
      <div class="card pad"><b>Backup file</b><p class="muted small" style="margin:4px 0 10px">Your data stays on this phone. Save a backup now and then.</p>
        <div class="row"><button class="btn sm grow" id="exp">${ic("share", "sm")} Export</button><label class="btn sm grow">${ic("download", "sm")} Import<input type="file" id="imp" accept=".json,application/json" hidden></label></div>
        <div class="dim tiny" style="margin-top:8px" id="pst"></div></div>
      ${standalone() ? "" : `<button class="btn block" id="inst">${ic("phone", "sm")} Install on this phone</button>`}
    </div></div>
    <div class="credits card soft pad" style="margin-top:16px">
      <p>© Mohamed Attia — all rights reserved. ${EX.length} exercises.</p>
      <p>Exercise rankings & coaching ideas: <a href="https://www.youtube.com/@JeffNippard" target="_blank" rel="noopener">Jeff Nippard</a>. Demo videos © their creators. Muscle animations: <a href="https://github.com/AbanoubAmir/open-exercise-figures" target="_blank" rel="noopener">open-exercise-figures</a> (CC0). 3D body & motions: <a href="https://github.com/AssiamahS/opengym3d" target="_blank" rel="noopener">OpenGym3D</a> (MIT, MakeHuman mesh), rendered with <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> (MIT).</p></div>`;
  const urls = (onlyTop) => EX.filter((e) => !onlyTop || ["S", "A"].includes(e.tier)).flatMap((e) => [e.poster, e.video].filter(Boolean));
  const stat = async () => { let n = 0; try { n = (await (await caches.open(MEDIA_CACHE)).keys()).length; } catch {} const c = $("#cstat"); if (c) { c.textContent = `${n} / ${total} files on this device`; $("#bar").style.width = `${Math.min(100, (n / total) * 100)}%`; } };
  stat(); wireCloud();
  (async () => { const pe = await (navigator.storage?.persisted?.() ?? false); const est = await (navigator.storage?.estimate?.() ?? {}); const el = $("#pst"); if (el) el.innerHTML = `Storage ${pe ? "protected" : `<a href="#" id="persist" style="color:var(--accent-text)">not protected — tap to protect</a>`}${est.usage ? ` · ${(est.usage / 1e6).toFixed(0)} MB used` : ""}`;
    const pp = $("#persist"); if (pp) pp.onclick = async (e) => { e.preventDefault(); toast((await persist()) ? "Storage protected" : "Install the app first, then try again"); }; })();
  const set = (k, v) => { st[k] = v; save("settings"); Sync.autoPush(); haptic(); };
  const seg = (id, fn) => ($(`#${id}`).onclick = (e) => { const b = e.target.closest("button"); if (!b || b.classList.contains("on")) return; selectIn(b); fn(b.dataset.v); });
  seg("sTheme", (v) => { set("theme", v); applyTheme(); });
  seg("sEquip", (v) => { set("equip", v); lib.mine = true; toast(`Showing exercises for: ${EQUIP_PROFILES[v].name}`); });
  seg("sUnit", (v) => set("unit", v)); seg("sBar", (v) => set("bar", +v));
  $$(".switch[data-k]").forEach((s) => (s.onclick = () => { s.classList.toggle("on"); set(s.dataset.k, s.classList.contains("on")); }));
  const cp = $("#clrPain"); if (cp) cp.onclick = async () => { if (await ask("Clear all pain flags?", { ok: "Clear" })) { S.pain = {}; save("pain"); Sync.autoPush(); settingsView(); } };
  $("#dlAll").onclick = () => downloadMedia(urls(false), stat);
  $("#dlTop").onclick = () => downloadMedia(urls(true), stat);
  const ins = $("#inst"); if (ins) ins.onclick = installNow;
  $("#exp").onclick = async () => {
    await flush();
    const file = new File([exportData()], `gym-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: "Gym backup" }); } catch {} }
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); }
    S.settings.lastBackup = Date.now(); save("settings");
  };
  $("#imp").onchange = async (e) => {
    try { const txt = await e.target.files[0].text(); if (!(await ask("Replace your workouts and history with this backup?", { ok: "Replace", danger: true }))) return; await importData(txt); toast("Backup restored"); settingsView(); }
    catch { toast("Not a valid Gym backup"); }
  };
}

/* ---- cloud backup to the owner's private GitHub repo (see js/SYNC.md) ---- */
function cloudCard() {
  const st = Sync.status();
  if (!st.connected) return `<b>Cloud backup (GitHub)</b><p class="muted small" style="margin:4px 0 10px">Back up to your own private GitHub repository. Your token stays on this device.</p>
    <div class="field"><label for="cRepo">Repository</label><input id="cRepo" placeholder="yourname/gym-data" autocomplete="off" autocapitalize="off"></div>
    <div class="field"><label for="cTok">Token</label><input id="cTok" type="password" placeholder="github_pat_…" autocomplete="off"></div>
    <button class="btn primary sm block" id="cCon">Connect</button>`;
  return `<b>Cloud backup (GitHub)</b><p class="muted small" style="margin:4px 0 10px">Connected to <b>${esc(st.owner)}/${esc(st.repo)}</b> · last backup ${st.lastPush ? fmtDate(st.lastPush, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "never"}${st.pending ? " · pending" : ""}</p>
    ${st.error ? `<p class="small" style="color:var(--danger);margin:0 0 10px">${esc(st.error)}</p>` : ""}
    <div class="row" style="margin-bottom:10px"><span class="grow small b">Auto backup after changes</span><button class="switch ${st.auto ? "on" : ""}" id="cAuto" aria-label="Auto backup"></button></div>
    <div class="row wrap"><button class="btn sm primary" id="cPush">Back up now</button><button class="btn sm" id="cRest">Restore</button><button class="btn sm ghost danger" id="cDis">Disconnect</button></div>`;
}
function wireCloud() {
  const re = () => { const c = $("#cloud"); if (c) { c.innerHTML = cloudCard(); wireCloud(); } };
  const con = $("#cCon");
  if (con) con.onclick = async () => {
    con.disabled = true; con.textContent = "Connecting…";
    const r = await Sync.connect({ repo: $("#cRepo").value.trim(), token: $("#cTok").value.trim() });
    if (!r.ok) { toast(r.error || "Could not connect", 4000); re(); return; }
    if (r.remoteExists && await ask(`A backup${r.remoteUpdatedAt ? " from " + fmtDate(r.remoteUpdatedAt) : ""} was found. Restore it now?`, { ok: "Restore" })) {
      const x = await Sync.restore(); toast(`Restored ${x.sessions ?? 0} workouts`);
    } else toast("Connected");
    re();
  };
  const p = $("#cPush"); if (p) p.onclick = async () => { try { await Sync.push(); toast("Backed up"); } catch (e) { toast(e.message, 4000); } re(); };
  const r = $("#cRest"); if (r) r.onclick = async () => { if (!(await ask("Merge the cloud backup into this phone? Nothing will be deleted.", { ok: "Restore" }))) return; try { const x = await Sync.restore(); toast(`Restored ${x.sessions ?? 0} workouts`); } catch (e) { toast(e.message, 4000); } re(); };
  const a = $("#cAuto"); if (a) a.onclick = () => { Sync.setAuto(!Sync.status().auto); re(); };
  const d = $("#cDis"); if (d) d.onclick = async () => { if (await ask("Remove the token from this phone? Your cloud backup stays on GitHub.", { ok: "Disconnect", danger: true })) { await Sync.disconnect(); re(); } };
}

let downloading = false;
async function downloadMedia(list, onProgress) {
  if (downloading) return; downloading = true; persist();
  const btns = $$("#dlAll,#dlTop"); btns.forEach((b) => (b.disabled = true));
  const cache = await caches.open(MEDIA_CACHE);
  const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  const todo = list.map((x) => new URL(x, location.href)).filter((x) => !have.has(x.pathname));
  let i = 0, fail = 0, last = 0;
  const worker = async () => { while (i < todo.length) { const x = todo[i++]; try { const r = await fetch(x.href); r.ok ? await cache.put(x.origin + x.pathname, r) : fail++; } catch { fail++; } if (Date.now() - last > 500) { last = Date.now(); onProgress(); } } };
  await Promise.all(Array.from({ length: 4 }, worker));
  downloading = false; await onProgress(); btns.forEach((b) => (b.disabled = false));
  toast(fail ? `${fail} files failed — try again` : "Saved for offline");
}
