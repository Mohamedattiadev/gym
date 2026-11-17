/* Install prompt + steps (FE-12: out of main.js). */
import { S, save, persist } from "./store.js";
import { $, ic, openSheet, closeSheet, toast } from "./ui.js";
import { rerender as route } from "./nav.js";

let deferredPrompt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; if (location.hash.length < 3) route(); });
export const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export function installBanner() {
  // shown from the first visit (was: only after a finished workout, and Chrome's own bar is suppressed above -> new users saw nothing)
  if (standalone() || Date.now() - (S.settings.installDismissed || 0) < 3 * 864e5) return "";
  if (!deferredPrompt && !isIOS() && !matchMedia("(pointer: coarse)").matches) return ""; // phones without a prompt get the menu steps
  return `<div class="install" id="install"><img src="icons/icon-192.png" alt="">
    <div class="grow"><b>Install Gym</b><div class="dim small">Full screen, works offline.</div></div>
    <button class="btn primary sm" id="doInstall">Install</button><button class="iconbtn sm" id="noInstall" aria-label="Dismiss">${ic("close", "sm")}</button></div>`;
}
export function wireInstall() {
  const d = $("#doInstall"); if (d) d.onclick = installNow;
  const n = $("#noInstall"); if (n) n.onclick = () => { S.settings.installDismissed = Date.now(); save("settings"); $("#install").remove(); };
}
export function installNow() {
  if (deferredPrompt) {
    const dp = deferredPrompt; deferredPrompt = null;
    const fail = () => installNow(); // stale/used prompt -> show the menu steps instead
    try { Promise.resolve(dp.prompt()).then(() => dp.userChoice).then((c) => { if (c.outcome === "accepted") { toast("Installed"); persist(); } route(); }, fail); } catch { fail(); }
  } else if (isIOS()) {
    openSheet(`<h3>Add to Home Screen</h3><ol class="steps">
        <li><span>Tap the <b>Share</b> button at the bottom of Safari</span></li>
        <li><span>Choose <b>Add to Home Screen</b></span></li><li><span>Tap <b>Add</b>, then open Gym from your home screen</span></li></ol>
      <button class="btn primary block" style="margin-top:18px" id="gotIt">Got it</button>`, (el) => ($("#gotIt", el).onclick = closeSheet));
  } else {
    const desk = !matchMedia("(pointer: coarse)").matches;
    openSheet(`<h3>Install Gym</h3><ol class="steps">
        ${desk ? `<li><span>Click the <b>install icon</b> at the right of the address bar (Chrome / Edge)</span></li><li><span>Or open the browser menu <b>⋮</b> → <b>Install Gym</b></span></li>`
          : `<li><span>Open the Chrome menu <b>⋮</b> (top right)</span></li><li><span>Tap <b>Install app</b> or <b>Add to Home screen</b></span></li><li><span>Open Gym from your home screen</span></li>`}</ol>
      <p class="muted small" style="margin:14px 0 0">Just uninstalled it? Reload this page once, then try again. iPhone: Safari → <b>Share</b> → <b>Add to Home Screen</b>.</p>
      <button class="btn primary block" style="margin-top:18px" id="gotIt">Got it</button>`, (el) => ($("#gotIt", el).onclick = closeSheet));
  }
}
addEventListener("appinstalled", () => { deferredPrompt = null; S.settings.installDismissed = 0; save("settings"); if (location.hash.length < 3) route(); });

