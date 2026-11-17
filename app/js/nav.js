/* Routing helpers shared by every view (FE-12: views import these, nothing imports main.js). */
import { $ } from "./ui.js";

// FE-2: every route() gets an id; async views check live(id) after each await so a late view never paints over the next page
let routeSeq = 0, routeFn = () => {};
export const nextRoute = () => ++routeSeq;
/** main.js registers the router; rerender() re-runs the current page (install prompt, etc.). */
export const onRoute = (fn) => { routeFn = fn; };
export const rerender = () => routeFn();
export const routeId = () => routeSeq;
export const live = (id) => id === routeSeq;
export function go(hash) { location.hash = hash; }
// FE-1: guard redirects and "leave this page for good" replace the history entry (no Back trap)
export function redirect(hash) { location.replace(hash); }
export const routeParts = () => (location.hash.slice(1) || "/").split("?")[0].split("/");

/** Top bar. shy: the title only fades in once the page title has scrolled away (no duplicate titles). */
export function setTop({ title = "", back = false, right = "", shy = false } = {}) {
  $("#tTitle").textContent = title; document.title = title ? `${title} · Gym` : "Gym";
  const tb = $("#topbar");
  $("#tBack").hidden = !back; tb.classList.toggle("sub", back); tb.classList.toggle("shy", shy); tb.classList.toggle("empty", !title && !back && !right);
  $("#tRight").innerHTML = right;
}
