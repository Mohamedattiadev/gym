/* Install prompt + steps (FE-12: out of main.js). */
import { S, save, persist } from "./store.js";
import { $, ic, openSheet, closeSheet, toast } from "./ui.js";
import { rerender as route, setTop, go } from "./nav.js";
import { t } from "./i18n.js";
import { openGuideSheet } from "./components.js";

let deferredPrompt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; if (location.hash.length < 3 || onInstallPage()) route(); });
const onInstallPage = () => location.hash.startsWith("#/install");
export const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const ua = () => navigator.userAgent;
const isIOS = () => /iphone|ipad|ipod/i.test(ua()) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const coarse = () => matchMedia("(pointer: coarse)").matches;
// which browser, only to word the manual steps right (Brave hides itself in the UA string -> navigator.brave)
const browser = () => navigator.brave ? "Brave" : /Firefox\//.test(ua()) ? "Firefox" : /SamsungBrowser/.test(ua()) ? "Samsung" : /Edg\//.test(ua()) ? "Edge" : /OPR\//.test(ua()) ? "Opera" : "Chrome";
export function installBanner() {
  // shown from the first visit (was: only after a finished workout, and Chrome's own bar is suppressed above -> new users saw nothing)
  if (standalone() || Date.now() - (S.settings.installDismissed || 0) < 3 * 864e5) return "";
  if (!deferredPrompt && !isIOS() && !coarse()) return ""; // phones without a prompt get the menu steps
  return `<div class="install" id="install"><img src="icons/icon-192.png" alt="">
    <div class="grow"><b>${t("Install Gym")}</b><div class="dim small">${t("Full screen, works offline.")}</div><button class="linkbtn small" id="insPdf">${t("Or get the PDF")}</button></div>
    <button class="btn primary sm" id="doInstall">${t("Install")}</button><button class="iconbtn sm" id="noInstall" aria-label="${t("Dismiss")}">${ic("close", "sm")}</button></div>`;
}
export function wireInstall() {
  const d = $("#doInstall"); if (d) d.onclick = installNow;
  const p = $("#insPdf"); if (p) p.onclick = () => openGuideSheet(); // owner: the PDF is for people who don't install, so it sits in the install banner
  const n = $("#noInstall"); if (n) n.onclick = () => { S.settings.installDismissed = Date.now(); save("settings"); $("#install").remove(); };
}
export function installNow() {
  if (deferredPrompt) {
    const dp = deferredPrompt; deferredPrompt = null;
    const fail = () => installNow(); // stale/used prompt -> show the menu steps instead
    // "accepted" only means the user clicked Install in the browser dialog; the app exists once "appinstalled" fires
    try { Promise.resolve(dp.prompt()).then(() => dp.userChoice).then((c) => { if (c.outcome === "accepted") toast(t("Installing Gym…"), 6000); route(); }, fail); } catch { fail(); }
  } else steps();
}
const stepsHTML = ({ items, note }) => `${items.length ? `<ol class="steps">${items.map((s) => `<li><span>${s}</span></li>`).join("")}</ol>` : ""}
    ${note ? `<p class="muted small" style="margin:14px 0 0">${note}</p>` : ""}`;
const sheet = (title, items, note = "") => ({ head: title, items, note });
function steps() { const x = stepsFor(); openSheet(`<h3>${x.head}</h3>${stepsHTML(x)}
    <button class="btn primary block" style="margin-top:18px" id="gotIt">${t("Got it")}</button>`, (el) => ($("#gotIt", el).onclick = closeSheet)); }
function stepsFor() {
  const b = browser(), desk = !coarse(), linux = /Linux/.test(ua()) && !/Android/.test(ua());
  const again = t("Just uninstalled it? Reload this page once, then try again.");
  if (isIOS()) return sheet(t("Add to Home Screen"), [t("Tap the <b>Share</b> button in Safari (bottom bar, or top right on iPad)"),
    t("Choose <b>Add to Home Screen</b>"), t("Tap <b>Add</b>, then open Gym from your home screen")], t("In Chrome on iPhone: <b>Share</b> → <b>Add to Home Screen</b> works the same (iOS 16.4+)."));
  if (b === "Firefox" && desk) return sheet(t("Firefox can't install apps"), [],
    t("Firefox on a computer can't install web apps. Open <b>{url}</b> in <b>Chrome</b>, <b>Edge</b> or <b>Brave</b> and install it there. Gym also works fine in a normal Firefox tab, offline too.", { url: location.origin + location.pathname }));
  const launcher = linux ? t("Then search for <b>Gym</b> in your app launcher (it can take a few seconds to show up)") : desk ? t("Then open Gym from your Start menu, Launchpad or apps list") : t("Open Gym from your home screen");
  let list;
  if (!desk) list = b === "Firefox" ? [t("Open the Firefox menu <b>⋮</b>"), t("Tap <b>Install</b> or <b>Add to Home screen</b>"), launcher]
    : b === "Samsung" ? [t("Open the menu <b>≡</b> (bottom right)"), t("Tap <b>Add page to</b> → <b>Home screen</b>"), launcher]
    : [t("Open the {b} menu <b>⋮</b>", { b }), t("Tap <b>Install app</b> or <b>Add to Home screen</b>"), launcher];
  else list = b === "Edge" ? [t("Click the <b>app icon</b> at the right of the address bar"), t("Or open the menu <b>…</b> → <b>Apps</b> → <b>Install this site as an app</b>"), launcher]
    : b === "Brave" ? [t("Click the <b>install icon</b> at the right of the address bar"), t("Or open the Brave menu <b>≡</b> → <b>Save and share</b> → <b>Install page as app</b>"), launcher]
    : [t("Click the <b>install icon</b> at the right of the address bar"), t("Or open the {b} menu <b>⋮</b> → <b>Cast, save and share</b> → <b>Install page as app</b>", { b }), launcher];
  return sheet(t("Install Gym"), list, `${again} ${t("iPhone: Safari → <b>Share</b> → <b>Add to Home Screen</b>.")}`);
}
addEventListener("appinstalled", () => {
  deferredPrompt = null; S.settings.installDismissed = 0; save("settings"); persist();
  const desk = !coarse(); // also fires when installed from the browser menu
  toast(!desk ? t("Installed · open Gym from your home screen") : /Linux/.test(ua()) ? t("Installed · find Gym in your app launcher") : t("Installed · open Gym from your apps"), 5000);
  if (location.hash.length < 3 || onInstallPage()) route();
});

/* Q13c #/install: the link on GitHub (README "Install" button). Opens straight to the install button or this browser's steps;
   a fresh profile is NOT sent to onboarding first (boot only redirects "#/"), "Continue" goes there afterwards. */
const fresh = () => !S.profile?.onboarded && !S.settings.onboarded && !S.sessions.length && !S.workouts.length;
export function installView(view) {
  setTop({ title: t("Install"), back: !fresh() });
  const next = () => go(fresh() ? "#/start" : "#/");
  let body;
  if (standalone()) body = `<p class="muted">${t("Gym is already installed.")}</p>
    <button class="btn primary block big" id="iGo">${t("Open Gym")}</button>`;
  else {
    const x = isIOS() || browser() === "Firefox" ? stepsFor() : null; // no install prompt ever comes there; elsewhere it can arrive late -> button (no prompt = steps sheet)
    body = `<p class="muted">${t("Full screen, works offline. No store needed.")}</p>
    ${x ? `<div class="card pad mt-12" style="text-align:start"><b>${x.head}</b>${stepsHTML(x)}</div>` : `<button class="btn primary block big" id="iDo">${ic("download", "sm")} ${t("Install")}</button>`}
    <button class="btn ghost block mt-12" id="iGo">${t("Continue in the browser")}</button>`;
  }
  view.innerHTML = `<div class="inst-page tc" style="max-width:440px;margin:24px auto 0"><img src="icons/icon-192.png" alt="" width="96" height="96" style="border-radius:22px">
    <h1 style="font-size:1.6rem;margin:14px 0 6px">${t("Install Gym")}</h1>${body}</div>`;
  const d = $("#iDo", view); if (d) d.onclick = installNow;
  $("#iGo", view).onclick = next;
}
