// Warm-ups (block 20): hub (#/warmup), player (#/warmup/play), auto warm-up for a workout or the live
// session (#/warmup/w/<id>, #/warmup/s), muscle primers, ramp-up calculator, cool-down (#/warmup/cool).
// Content: data/guide/warmups.json (en/tr/ar). Lazy-loaded by the router.
import { S, save } from "./store.js";
import { $, esc, ic, haptic, beep, toast, selectIn, indicate, openSheet } from "./ui.js";
import { BY, lastSets } from "./data.js";
import { warmupSets } from "./calc.js";
import { setTop, go, fillIll } from "./main.js";
import * as T from "./train.js";

const view = () => $("#view");
const L = (o) => (o && typeof o === "object" ? o[S.settings.lang || "en"] || o.en || "" : o ?? "");
let W = null;
const load = () => W || (W = fetch("data/guide/warmups.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
const mins = (s) => `${Math.max(1, Math.round(s / 60))} min`;
const AREAS = ["shoulders", "back", "knees", "hips", "elbows", "ankles", "core"];
const PUSH = ["chest", "delt-front", "delt-side", "triceps"], PULL = ["lats", "upper-back", "traps", "biceps", "delt-rear", "forearms"],
  LEGS = ["quads", "glutes", "hamstrings", "calves", "adductors", "shins"];

/* ---------------- building a warm-up ---------------- */
const total = (q) => q.items.reduce((a, it) => a + it.secs, 0);
const item = (w, id, secs) => (w.drills?.[id] ? { id, secs: secs || w.drills[id].secs || 30 } : null);
/** Muscle weights of a list of exercise slugs (primary 1, secondary .5). */
function muscleLoad(slugs) {
  const m = {};
  for (const s of slugs) { const e = BY[s]; if (!e) continue; (e.primary || []).forEach((k) => (m[k] = (m[k] || 0) + 1)); (e.secondary || []).forEach((k) => (m[k] = (m[k] || 0) + 0.5)); }
  return m;
}
function dayType(m) {
  const sum = (l) => l.reduce((a, k) => a + (m[k] || 0), 0); const p = sum(PUSH), u = sum(PULL), g = sum(LEGS), all = p + u + g || 1;
  return g / all >= 0.6 ? "legs" : p / all >= 0.6 ? "push" : u / all >= 0.6 ? "pull" : "full";
}
/** Auto warm-up for exercises: light cardio, dynamic mobility for the day, primers for the two most used joints. */
export function buildFor(w, slugs, name) {
  const m = muscleLoad(slugs), type = slugs.length ? dayType(m) : "full";
  const ar = {}; for (const [k, v] of Object.entries(m)) { const a = w.muscleArea?.[k]; if (a) ar[a] = (ar[a] || 0) + v; }
  const top = Object.entries(ar).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([a]) => a);
  const items = [], has = (id) => items.some((x) => x.id === id), add = (id, s) => { const it = !has(id) && item(w, id, s); if (it) items.push(it); };
  add(w.general?.cardio?.[0], 120);
  (w.general?.mobility?.[type] || []).slice(0, 4).forEach((id) => add(id));
  top.forEach((a) => (w.areas?.[a]?.drills || []).filter((id) => !has(id)).slice(0, 1).forEach((id) => add(id)));
  return { title: name ? `Warm-up · ${name}` : "General warm-up", items, type, areas: top, slugs };
}
const buildList = (w, title, ids) => ({ title, items: ids.map((id) => item(w, id)).filter(Boolean) });

/* ---------------- hub ---------------- */
let Q = null; // current player queue {title, items, i, back, slugs, cool}
export async function warmupView(arg) {
  const [, , sub, id] = (location.hash.slice(1) || "/").split("?")[0].split("/");
  view().innerHTML = `<div class="empty">Loading…</div>`;
  const w = await load();
  if (!w.drills) { setTop({ title: "Warm-up", back: true }); view().innerHTML = `<div class="empty">Could not load.</div>`; return; }
  if (sub === "play") return Q ? player(w) : go("#/warmup");
  if (sub === "s" || sub === "w") {
    const src = sub === "s" ? S.active : S.workouts.find((x) => x.id === id);
    if (!src) return go("#/warmup");
    const slugs = sub === "s" ? src.entries.map((e) => e.slug) : src.items.map((it) => it.slug);
    return play(buildFor(w, slugs, src.name), sub === "s" ? "#/session" : `#/workout/${src.id}`, true);
  }
  if (sub === "cool") return play({ ...buildList(w, "Cool-down", w.cooldown?.drills || []), cool: true }, "#/warmup", true);
  hub(w);
}

function hub(w) {
  setTop({ title: "Warm-up", back: true });
  const nx = S.active ? { name: S.active.name, slugs: S.active.entries.map((e) => e.slug), href: "#/warmup/s" }
    : (() => { const n = T.nextWorkout(); return n && { name: n.name, slugs: n.items.map((it) => it.slug), href: `#/warmup/w/${n.id}` }; })();
  const auto = buildFor(w, nx?.slugs || [], nx?.name);
  const areaName = (a) => L(w.areas?.[a]?.name) || a;
  const u = S.settings.unit;
  view().innerHTML = `<div class="muted small" style="margin:-2px 0 12px">${esc(L(w.intro))}</div>
    <div class="hero-card has-ill"><div class="txt"><div class="eyebrow">${nx ? "Before your workout" : "Quick start"}</div><h3>${esc(nx ? nx.name : "General warm-up")}</h3>
      <div class="muted small" style="margin-bottom:12px">${mins(total(auto))} · ${auto.items.length} moves${auto.areas.length ? ` · ${esc(auto.areas.map(areaName).join(", "))}` : ""}</div>
      <button class="btn primary" id="wAuto">${ic("play", "sm")} Start warm-up</button></div><div class="ill" data-ill="warmup"></div></div>
    <div class="sec"><h2>Warm up one area</h2></div>
    <div class="chips" id="wAreas">${AREAS.filter((a) => w.areas?.[a]).map((a) => `<button class="chip" data-a="${a}">${esc(areaName(a))}</button>`).join("")}</div>
    <div class="sec"><h2>Ramp-up sets</h2><button class="link small" id="wRules" style="color:var(--accent-text);font-weight:600;background:none;border:0">How it works</button></div>
    <div class="card pad"><div class="row" style="gap:10px;flex-wrap:wrap"><div class="field" style="margin:0;flex:1;min-width:120px"><label for="wKg">Working weight (${u})</label><input id="wKg" type="number" inputmode="decimal" min="0" step="0.5" placeholder="e.g. 80"></div>
      <div class="seg sm" id="wKind"><button data-v="heavy" class="on">Barbell lift</button><button data-v="light">Other</button></div></div>
      <div id="wRamp" class="ramp" style="margin-top:10px"><div class="dim small">${esc(L(w.ramp?.note))}</div></div></div>
    <div class="itiles" style="margin-top:12px"><button class="itile" id="wGen"><span class="ico">${ic("flame")}</span><div><b>General</b><span>${mins(total(buildFor(w, [], "")))} · full body</span></div></button>
      <a class="itile" href="#/warmup/cool" style="--c:var(--info)"><span class="ico">${ic("timer")}</span><div><b>Cool-down</b><span>After training</span></div></a></div>
    ${w.sources?.length ? `<details class="srcs"><summary class="dim small">Sources</summary><div class="small">${w.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(" · ")}</div></details>` : ""}`;
  fillIll(view()); indicate(view());
  $("#wAuto").onclick = () => (nx ? go(nx.href) : play(auto, "#/warmup"));
  $("#wGen").onclick = () => play(buildFor(w, [], ""), "#/warmup");
  $("#wAreas").onclick = (e) => { const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a; play(buildList(w, `Warm-up · ${areaName(a)}`, w.areas[a].drills), "#/warmup"); };
  $("#wRules").onclick = () => openSheet(`<h3>Ramp-up sets</h3><div class="muted small" style="margin-bottom:10px">${esc(L(w.ramp?.note))}</div>
    <ul class="bul">${(w.ramp?.rules || []).map((r) => `<li>${ic("check", "sm")}<span>${esc(L(r))}</span></li>`).join("")}</ul>`);
  let kind = "heavy";
  const ramp = () => {
    const kg = +$("#wKg").value; const box = $("#wRamp");
    if (!kg) return (box.innerHTML = `<div class="dim small">${esc(L(w.ramp?.note))}</div>`);
    const ex = kind === "heavy" ? { equipment: ["Barbell"], type: "compound" } : { equipment: [], type: "isolation" };
    const ws = warmupSets(kg, ex);
    box.innerHTML = ws.length ? `<div class="rsets">${ws.map((s, i) => `<div><span class="dim tiny">Set ${i + 1}</span><b class="num">${s.w}${u}</b><span class="num">× ${s.r}</span></div>`).join("")}<div class="go"><span class="dim tiny">Then</span><b class="num">${kg}${u}</b><span>work sets</span></div></div>` : `<div class="dim small">Light enough — no ramp-up sets needed.</div>`;
  };
  $("#wKg").oninput = ramp;
  $("#wKind").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; haptic(); selectIn(b); kind = b.dataset.v; ramp(); };
}

/* ---------------- player ---------------- */
let iv = null, endAt = 0, left = 0, running = false;
function play(q, back, replace = false) {
  Q = { ...q, i: 0, back };
  if (!Q.items.length) return toast("Nothing to show yet");
  replace ? history.replaceState(null, "", "#/warmup/play") : history.pushState(null, "", "#/warmup/play");
  load().then(player);
}
const stopT = () => { clearInterval(iv); iv = null; running = false; };
addEventListener("hashchange", () => { if (!location.hash.startsWith("#/warmup/play")) stopT(); });

const sec = (t) => String(t || "0").split(":").reduce((a, x) => a * 60 + +x, 0);
const ytId = (u) => (String(u).match(/[?&]v=([\w-]{11})/) || String(u).match(/youtu\.be\/([\w-]{11})/) || [])[1];
function visual(d) {
  if (d.fig) return `<img class="wfig" src="media/figures/${esc(d.fig)}.webp" alt="">`;
  if (d.clip?.file) return `<video class="wclip" src="media/clips/${esc(d.clip.file)}" autoplay muted loop playsinline preload="metadata"></video>
    <a class="wcred" href="${esc(d.clip.q)}" target="_blank" rel="noopener">${ic("yt", "xs")} ${esc(d.clip.by || "Original")}</a>`;
  if (d.clip?.q && ytId(d.clip.q)) return `<div class="ill wfill" data-ill="warmup"></div>
    <button class="btn sm wdemo" id="wpDemo">${ic("play", "sm")} Watch demo · ${esc(d.clip.by || "")}</button>`;
  return `<div class="ill wfill" data-ill="warmup"></div>`;
}
/** Plays only the drill's segment of the expert's video (credited, links to the original). */
function demo(d) {
  const id = ytId(d.clip.q), s = sec(d.clip.start), e = sec(d.clip.end);
  $(".wvis").innerHTML = `<iframe class="wclip" src="https://www.youtube-nocookie.com/embed/${id}?start=${s}${e > s ? `&end=${e}` : ""}&autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1" title="${esc(d.clip.by || "Demo")}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
    <a class="wcred" href="https://www.youtube.com/watch?v=${id}&t=${s}s" target="_blank" rel="noopener">${ic("yt", "xs")} ${esc(d.clip.by || "Original")}</a>`;
}
function player(w) {
  const q = Q, it = q.items[q.i], d = w.drills[it.id], n = q.items.length;
  setTop({ title: q.title, back: true });
  const restSecs = q.items.slice(q.i + 1).reduce((a, x) => a + x.secs, 0);
  const R = 46, CC = 2 * Math.PI * R;
  view().innerHTML = `<div class="qprog"><i style="width:${(q.i / n) * 100}%"></i></div>
    <div class="row between dim tiny" style="margin:8px 0 10px"><span>Move ${q.i + 1} of ${n}</span><span id="wpLeft"></span></div>
    <div class="wplay"><div class="wvis">${visual(d)}</div>
      <div class="winfo"><h2 class="qt" style="margin:0">${esc(L(d.name))}</h2>
        <div class="wcue">${esc(L(d.reps) || L(d.cue))}</div>
        <div class="muted small">${esc(L(d.how))}${L(d.reps) && L(d.cue) ? ` <b>${esc(L(d.cue))}</b>` : ""}</div>
        <div class="wctl"><div class="ringwrap sm"><svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="${R}"/><circle class="fill" id="wpF" cx="50" cy="50" r="${R}" stroke-dasharray="${CC}" stroke-dashoffset="0"/></svg><div class="big num" id="wpT"></div></div>
          <div class="row" style="justify-content:center;gap:10px"><button class="iconbtn filled" id="wpPrev" aria-label="Previous" ${q.i ? "" : "disabled"}>${ic("back")}</button>
            <button class="btn lg primary" id="wpGo" style="min-width:130px"></button>
            <button class="iconbtn filled fwd" id="wpNext" aria-label="${q.i < n - 1 ? "Next" : "Finish"}">${ic("back")}</button></div></div></div></div>
    ${q.i === n - 1 && !q.cool ? `<div class="dim small" style="text-align:center;margin-top:10px">Next: ramp-up sets on your first exercise.</div>` : ""}`;
  fillIll(view());
  left = it.secs; const draw = () => {
    const s = Math.max(0, Math.ceil(left)); const t = $("#wpT"); if (!t) return stopT();
    t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    $("#wpF").setAttribute("stroke-dashoffset", String(CC * (1 - left / it.secs)));
    $("#wpGo").innerHTML = running ? `${ic("pause", "sm")} Pause` : `${ic("play", "sm")} ${left < it.secs ? "Resume" : "Start"}`;
    $("#wpLeft").textContent = `${mins(left + restSecs)} left`;
  };
  const tick = () => { left = (endAt - Date.now()) / 1000; if (left <= 0) { left = 0; stopT(); draw(); beep([[660, .1], [880, .18]]); haptic("success"); return next(); } if (left <= 3.2 && left > 3) beep([[520, .06]], .1); draw(); };
  const start = () => { endAt = Date.now() + left * 1000; running = true; clearInterval(iv); iv = setInterval(tick, 200); draw(); };
  const next = () => { stopT(); if (q.i < n - 1) { q.i++; player(w); } else finish(w); };
  const dm = $("#wpDemo"); if (dm) dm.onclick = () => { haptic(); if (!navigator.onLine) return toast("Demo needs internet"); demo(d); };
  $("#wpGo").onclick = () => { haptic(); running ? (stopT(), draw()) : start(); };
  $("#wpNext").onclick = () => { haptic(); next(); };
  $("#wpPrev").onclick = () => { haptic(); stopT(); if (q.i) { q.i--; player(w); } };
  stopT(); draw();
  if (q.auto) start();
  q.auto = true; // after the first move, the next ones start on their own
}

function finish(w) {
  const q = Q; stopT(); haptic("success");
  if (S.active && q.back === "#/session") { S.active.warmed = true; save("active"); }
  const u = S.settings.unit;
  // ramp-up for the first exercise of the workout, from the last weight used
  const first = (q.slugs || []).map((s) => BY[s]).find(Boolean);
  const lw = first && +(lastSets(first.slug)?.sets.find((s) => s.type !== "w" && +s.w)?.w || 0);
  const ws = first && lw ? warmupSets(lw, first) : [];
  setTop({ title: q.title, back: true });
  view().innerHTML = `<div class="qprog"><i style="width:100%"></i></div>
    <div style="text-align:center;margin-top:14px"><div class="ill" data-ill="${q.cool ? "rest-recovery" : "warmup"}" style="max-width:150px;margin:0 auto"></div>
      <h2 class="qt" style="margin:6px 0 2px">${q.cool ? "Cool-down done" : "Warm-up done"}</h2>
      <div class="muted small">${q.cool ? "Nice work today." : "Now ease into your first exercise with a few light sets."}</div></div>
    ${ws.length ? `<div class="card pad" style="margin-top:14px"><b>${esc(first.name)}</b><div class="dim tiny" style="margin-bottom:8px">Ramp-up to ${lw}${u} (last time)</div>
      <div class="rsets">${ws.map((s, i) => `<div><span class="dim tiny">Set ${i + 1}</span><b class="num">${s.w}${u}</b><span class="num">× ${s.r}</span></div>`).join("")}</div>
      ${S.active && q.back === "#/session" ? `<button class="btn block" id="wAdd" style="margin-top:10px">${ic("plus", "sm")} Add these to the workout</button>` : ""}</div>` : ""}
    <button class="btn lg primary block" id="wDone" style="margin-top:16px">${q.back === "#/session" ? "Back to workout" : q.back?.startsWith("#/workout/") ? "Go to workout" : "Done"}</button>`;
  fillIll(view());
  const add = $("#wAdd"); if (add) add.onclick = () => {
    const en = S.active?.entries.find((e) => e.slug === first.slug); if (!en) return;
    if (en.sets.some((s) => s.type === "w")) return toast("Warm-up sets already added");
    en.sets.unshift(...ws.map((s) => ({ w: s.w, r: s.r, done: false, type: "w" }))); save("active"); toast(`Added ${ws.length} warm-up sets`); add.disabled = true;
  };
  $("#wDone").onclick = () => { Q = null; go(q.back || "#/warmup"); };
}
