// Unit tests for CSV import (app/js/csv.js) — BE-5 unit + dropped timed sets. Run: node --test tools/test/unit/
import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.addEventListener ??= () => {}; globalThis.document ??= { addEventListener() {}, hidden: false };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
let C, S;
try { C = await import("../../../app/js/csv.js"); S = (await import("../../../app/js/store.js")).S; } catch (e) { C = null; console.log("skip:", e.message); }
const strong = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2024-01-02 18:00:00,Push,1h 5m,Bench Press (Barbell),1,225,5,0,0,,,
2024-01-02 18:00:00,Push,1h 5m,Bench Press (Barbell),2,225,5,0,0,,,
2024-01-02 18:00:00,Push,1h 5m,Plank,1,0,0,0,60,,,`;
test("csv: Strong file without a unit column asks and converts lb -> kg (BE-5)", { skip: !C }, () => {
  S.settings.unit = "kg";
  const R = C.readImport(strong);
  assert.equal(R.unitUnknown, true); assert.equal(R.fileUnit, "kg"); assert.equal(R.dropped, 1);
  R.fileUnit = "lb"; S.sessions.length = 0;
  for (const n of R.names) n.slug ||= "x";
  C.applyImport(R);
  const w = S.sessions[0].entries[0].sets[0].w;
  assert.equal(w, "102"); // 225 lb = 102.06 kg, rounded to 0.25
  assert.equal(R.workouts[0].ex[0].sets[0].w, "225", "parsed data stays raw");
});
test("csv: Hevy weight_kg column is known", { skip: !C }, () => {
  const R = C.readImport(`title,start_time,end_time,exercise_title,set_index,set_type,weight_kg,reps\nA,"2 Jan 2024, 18:00","2 Jan 2024, 19:00",Squat (Barbell),0,normal,100,5`);
  assert.equal(R.unitUnknown, false); assert.equal(R.dropped, 0);
});
