import { test } from "node:test";
import assert from "node:assert/strict";
import { t, tn, useTable, lang, loc } from "../../../app/js/i18n.js";

test("English: key is the text, {vars} filled, plural by n", () => {
  useTable("en");
  assert.equal(t("Start workout"), "Start workout");
  assert.equal(t("about {n} min", { n: 45 }), "about 45 min");
  assert.equal(tn(1, "{n} set", "{n} sets"), "1 set");
  assert.equal(tn(3, "{n} set", "{n} sets"), "3 sets");
});
test("Turkish table: string plural, missing key falls back to English", () => {
  useTable("tr", { "Start workout": "Antrenmanı başlat", "{n} sets": "{n} set", "": "x" });
  assert.equal(lang(), "tr");
  assert.equal(t("Start workout"), "Antrenmanı başlat");
  assert.equal(t("Not translated yet"), "Not translated yet");
  assert.equal(tn(1, "{n} set", "{n} sets"), "1 set");
  assert.equal(tn(4, "{n} set", "{n} sets"), "4 set");
});
test("Arabic table: plural categories, Latin digits locale", () => {
  useTable("ar", { "{n} sets": { one: "مجموعة واحدة", two: "مجموعتان", few: "{n} مجموعات", many: "{n} مجموعة", other: "{n} مجموعة" } });
  assert.equal(tn(1, "{n} set", "{n} sets"), "مجموعة واحدة");
  assert.equal(tn(2, "{n} set", "{n} sets"), "مجموعتان");
  assert.equal(tn(5, "{n} set", "{n} sets"), "5 مجموعات");
  assert.equal(tn(11, "{n} set", "{n} sets"), "11 مجموعة");
  assert.equal(loc(), "ar-u-nu-latn");
  useTable("en");
});
test("context key: t(s, null, ctx) prefers 's@ctx', English stays s", () => {
  useTable("tr", { Back: "Arka", "Back@nav": "Geri" });
  assert.equal(t("Back"), "Arka");
  assert.equal(t("Back", null, "nav"), "Geri");
  useTable("en");
  assert.equal(t("Back", null, "nav"), "Back");
});
test("every READY language table has every key with the same {placeholders}", async () => {
  const fs = await import("node:fs");
  const { READY } = await import("../../../app/js/i18n.js");
  const keys = JSON.parse(fs.readFileSync(new URL("../../i18n/en.keys.json", import.meta.url)));
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const l of READY.filter((x) => x !== "en")) {
    const tbl = JSON.parse(fs.readFileSync(new URL(`../../../app/data/i18n/${l}.json`, import.meta.url)));
    for (const k of keys) {
      const v = tbl[k];
      assert.ok(v, `${l}: missing "${k}"`);
      for (const s of typeof v === "string" ? [v] : Object.values(v)) assert.equal(ph(s), ph(k), `${l}: placeholders of "${k}"`);
    }
  }
});
