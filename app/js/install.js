/* Install prompt + steps (FE-12: out of main.js). */
import { S, save, persist } from "./store.js";
import { $, ic, openSheet, closeSheet, toast } from "./ui.js";
import { rerender as route } from "./nav.js";
import { t } from "./i18n.js";

let deferredPrompt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; if (location.hash.length < 3) route(); });
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
    <div class="grow"><b>${t("Install Gym")}</b><div class="dim small">${t("Full screen, works offline.")}</div></div>
    <button class="btn primary sm" id="doInstall">${t("Install")}</button><button class="iconbtn sm" id="noInstall" aria-label="${t("Dismiss")}">${ic("close", "sm")}</button></div>`;
}
export function wireInstall() {
  const d = $("#doInstall"); if (d) d.onclick = installNow;
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
const sheet = (title, items, note = "") => openSheet(`<h3>${title}</h3>${items.length ? `<ol class="steps">${items.map((s) => `<li><span>${s}</span></li>`).join("")}</ol>` : ""}
    ${note ? `<p class="muted small" style="margin:14px 0 0">${note}</p>` : ""}
    <button class="btn primary block" style="margin-top:18px" id="gotIt">${t("Got it")}</button>`, (el) => ($("#gotIt", el).onclick = closeSheet));
function steps() {
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
  sheet(t("Install Gym"), list, `${again} ${t("iPhone: Safari → <b>Share</b> → <b>Add to Home Screen</b>.")}`);
}
addEventListener("appinstalled", () => {
  deferredPrompt = null; S.settings.installDismissed = 0; save("settings"); persist();
  const desk = !coarse(); // also fires when installed from the browser menu
  toast(!desk ? t("Installed · open Gym from your home screen") : /Linux/.test(ua()) ? t("Installed · find Gym in your app launcher") : t("Installed · open Gym from your apps"), 5000);
  if (location.hash.length < 3) route();
});
