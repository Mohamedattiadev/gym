// Share a finished workout as an image (1080×1350 PNG, light card design). Lazy-loaded from the summary sheet.
import { S } from "./store.js";
import { toast, fmtDur } from "./ui.js";
import { BY } from "./data.js";
import { t, tn, loc } from "./i18n.js";

const W = 1080, H = 1350, ACC = "#D93A31", INK = "#2B2522", DIM = "#8A817B";

function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
function fit(c, s, max) { if (c.measureText(s).width <= max) return s; while (s.length > 1 && c.measureText(s + "…").width > max) s = s.slice(0, -1); return s + "…"; }

export async function renderSession(a, st, prs) {
  await document.fonts?.ready;
  const cv = Object.assign(document.createElement("canvas"), { width: W, height: H }), c = cv.getContext("2d"), F = (w, s) => `${w} ${s}px Inter, system-ui, sans-serif`, u = S.settings.unit;
  c.fillStyle = "#F6F1EC"; c.fillRect(0, 0, W, H);
  c.fillStyle = ACC; rr(c, 72, 72, 88, 88, 24); c.fill(); // logo tile with a dumbbell
  c.fillStyle = "#fff"; [[90, 100, 12, 32], [104, 92, 14, 48], [146, 100, 12, 32], [132, 92, 14, 48], [114, 110, 22, 12]].forEach(([x, y, w, h]) => { rr(c, x, y, w, h, 4); c.fill(); });
  c.fillStyle = INK; c.font = F(800, 44); c.fillText("GYM", 184, 132);
  c.fillStyle = DIM; c.font = F(500, 34); c.textAlign = "right"; c.fillText(new Date(a.endedAt).toLocaleDateString(loc(), { weekday: "short", month: "short", day: "numeric" }), W - 72, 130); c.textAlign = "left";
  c.fillStyle = INK; c.font = F(800, 76); c.fillText(fit(c, a.name, W - 144), 72, 290);
  c.fillStyle = DIM; c.font = F(500, 36); c.fillText(`${fmtDur(a.endedAt - a.startedAt)} · ${tn(a.entries.length, "{n} exercise", "{n} exercises")}`, 72, 346);
  const kp = [[st.sets, tn(st.sets, "set", "sets")], [st.vol.toLocaleString(loc()), t("{u} volume", { u })], [prs.length, tn(prs.length, "new PR", "new PRs")]];
  kp.forEach(([v, l], i) => { const x = 72 + i * 320; c.fillStyle = "#fff"; rr(c, x, 400, 296, 170, 28); c.fill();
    c.fillStyle = i === 2 && prs.length ? ACC : INK; c.font = F(800, 64); c.fillText(String(v), x + 32, 490); c.fillStyle = DIM; c.font = F(600, 30); c.fillText(l, x + 32, 538); });
  let y = 650; const pr = new Set(prs.map((p) => p.slug));
  const shown = Math.min(7, a.entries.length) + (a.entries.length > 7 ? 1 : 0);
  c.fillStyle = "#fff"; rr(c, 72, 610, W - 144, Math.max(160, shown * 82 + 50), 28); c.fill();
  for (const en of a.entries.slice(0, 7)) {
    const best = en.sets.filter((s) => s.type !== "w").reduce((b, s) => ((+s.w || 0) * (+s.r || 1) > (+b?.w || 0) * (+b?.r || 1) ? s : b), null);
    c.fillStyle = INK; c.font = F(650, 36); c.fillText(fit(c, BY[en.slug]?.name || en.slug, 640), 112, y + 36);
    c.fillStyle = pr.has(en.slug) ? ACC : DIM; c.font = F(600, 32); c.textAlign = "right";
    c.fillText(`${en.sets.filter((s) => s.type !== "w").length} × ${best ? (+best.w ? `${best.w} ${u} × ${best.r}` : tn(+best.r, "{n} rep", "{n} reps")) : "–"}${pr.has(en.slug) ? "  PR" : ""}`, W - 112, y + 36); c.textAlign = "left";
    y += 82;
  }
  if (a.entries.length > 7) { c.fillStyle = DIM; c.font = F(500, 30); c.fillText(t("+ {n} more", { n: a.entries.length - 7 }), 112, y + 30); }
  c.fillStyle = DIM; c.font = F(500, 28); c.textAlign = "center"; c.fillText(t("Tracked with Gym"), W / 2, H - 50);
  return new Promise((r) => cv.toBlob(r, "image/png"));
}

export async function shareSession(a, st, prs) {
  const blob = await renderSession(a, st, prs);
  const file = new File([blob], `workout-${new Date(a.endedAt).toISOString().slice(0, 10)}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: a.name }); } catch (e) { if (e.name !== "AbortError") toast(t("Could not share")); } return; }
  const url = URL.createObjectURL(blob); Object.assign(document.createElement("a"), { href: url, download: file.name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 4000); toast(t("Image saved"));
}
