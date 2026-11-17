// FE-6: errors on a phone have no devtools. Uncaught errors and rejected promises go into a small local log
// (last 50, localStorage "gym-log"), the user sees one quiet toast per session, Settings > Backup can copy it.
const KEY = "gym-log", MAX = 50;
export const readLog = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
export const clearLog = () => { try { localStorage.removeItem(KEY); } catch {} };
let told = false;
function add(msg, stack) {
  const l = readLog();
  l.push({ t: Date.now(), msg: String(msg).slice(0, 300), stack: String(stack || "").slice(0, 1200), hash: location.hash });
  try { localStorage.setItem(KEY, JSON.stringify(l.slice(-MAX))); } catch {}
  if (told) return; told = true;
  import("./ui.js").then((u) => u.toast("Something went wrong — details saved in Settings", 3500)).catch(() => {});
}
addEventListener("error", (e) => {
  if (e.target && e.target !== window) return; // broken <img>/<video> loads are not script errors
  add(e.message || "error", e.error?.stack || `${e.filename}:${e.lineno}:${e.colno}`);
});
addEventListener("unhandledrejection", (e) => { const r = e.reason; add(r?.message || r || "rejection", r?.stack); });
