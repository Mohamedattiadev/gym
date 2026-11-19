/* i18n (block 21 / Q9). English source text is its own key: t("Start workout"), t("{n} exercises", { n }).
   Tables app/data/i18n/<lang>.json map English -> translation; a missing key falls back to English, so a
   half-filled table never shows a blank. Plurals: tn(n, "{n} set", "{n} sets") — the key is the plural
   form; a table value may be a string or { one, two, few, many, other } picked with Intl.PluralRules (Arabic).
   Static HTML: elements with data-t="English" get their text replaced (data-ta = aria-label too).
   tools/i18n/keys.mjs collects every literal t()/tn() key and reports what each table is missing.
   Imports nothing (ui.js and store.js import this). */
export const LANGS = { en: "English", tr: "Türkçe", ar: "العربية" };
/** Languages whose table is complete enough to offer in Settings (FE-19: no half-translated switch). */
export const READY = ["en"];
let LANG = "en", TBL = {}, PR = new Intl.PluralRules("en");

export const lang = () => LANG;
export const rtl = () => LANG === "ar";
/** Locale for Intl / toLocale* calls (dates, numbers). Arabic keeps Latin digits like the rest of the app. */
export const loc = () => (LANG === "ar" ? "ar-u-nu-latn" : LANG);

const fill = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? m)) : s);
export function t(s, v) {
  const x = TBL[s];
  return fill(typeof x === "string" && x ? x : s, v);
}
/** Marks English text stored in data for keys.mjs; translate it later with t(x). */
export const N = (s) => s;
export function tn(n, one, many, v = {}) {
  const x = TBL[many], vv = { n, ...v };
  if (x && typeof x === "object") return fill(x[PR.select(n)] || x.other || many, vv);
  if (typeof x === "string" && x) return fill(x, vv); // e.g. Turkish: no plural -s
  return fill(n === 1 ? one : many, vv);
}

/** Translate static markup (index.html tab bar, etc.). */
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
  for (const el of root.querySelectorAll("[data-ta]")) el.setAttribute("aria-label", t(el.dataset.ta));
}

/** Switch the in-memory table (setLang uses it; unit tests call it directly). */
export function useTable(l, tbl = {}) { LANG = l; TBL = tbl; PR = new Intl.PluralRules(l); }

/** Load a language table and set <html lang/dir>. Unknown or failed -> English. */
export async function setLang(l) {
  l = LANGS[l] ? l : "en";
  let tbl = {};
  if (l !== "en") {
    try { const r = await fetch(`data/i18n/${l}.json`); if (r.ok) tbl = await r.json(); else l = "en"; } catch { l = "en"; }
  }
  useTable(l, tbl);
  const h = document.documentElement;
  h.lang = l; h.dir = l === "ar" ? "rtl" : "ltr";
  applyStatic();
  return l;
}
