"""Fill the 164 exercises whose source data had no equipment (checked one by one on the posters, session 9).
Idempotent; re-run after any rebuild of app/data/exercises.json:  python3 -I tools/fix_equipment.py ."""
import json, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
fix = json.loads((root / "tools/equip_fix.json").read_text())
p = root / "app/data/exercises.json"; L = json.loads(p.read_text()); n = 0
for x in L:
    eq = fix.get(x["slug"])
    if not eq or x["equipment"]: continue
    x["equipment"] = eq; n += 1
    # same rest / rep rule as tools/enrich.py (heavy = barbell/smith compound squat, hinge, press)
    compound = x["type"] == "compound"
    heavy = compound and x["pattern"] in ("squat", "hinge", "h-push", "v-push") and eq[0] in ("Barbell", "Smith")
    if heavy:
        x["rest"] = 180
        x["repRange"] = [5, 8] if x["pattern"] in ("squat", "hinge") else [6, 10]
p.write_text(json.dumps(L, ensure_ascii=False, separators=(",", ":")))
print("filled", n)
