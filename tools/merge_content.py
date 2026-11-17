"""Post-build step: fix groups from movement families, merge content, detect machines.
Writes app/data/exercises.json (lean list) + app/data/families.<lang>.json (texts per language)."""
import glob, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGS = ("en", "tr", "ar")
R2G = {"chest": "Chest", "delt-front": "Shoulders", "delt-side": "Shoulders", "delt-rear": "Shoulders", "biceps": "Biceps",
       "triceps": "Triceps", "forearms": "Forearms", "abs": "Abs", "obliques": "Abs", "quads": "Quads", "adductors": "Groin",
       "shins": "Shins", "calves": "Calves", "traps": "Traps", "upper-back": "Upper Back", "lats": "Lats",
       "lower-back": "Lower Back", "glutes": "Glutes", "hamstrings": "Hamstrings"}
# family-group changes we do NOT accept (API split between lats/upper back rows is better; glute-focused lunges stay glutes)
KEEP = {("Lats", "Upper Back"), ("Upper Back", "Lats"), ("Glutes", "Quads"), ("Traps", "Lats"), ("Traps", "Upper Back")}
NAME_FIX = [(r"^knee tucks", "Abs", "abs")]

MACHINES = [  # (label, regex) first match wins
    ("Hammer Strength", r"hammer strength|iso.?lateral"), ("Smith machine", r"smith"), ("Pec deck", r"pec ?deck|machine (rear delt )?fly|reverse pec"),
    ("Leg press", r"leg press"), ("Hack squat", r"hack"), ("Pendulum squat", r"pendulum"), ("Belt squat", r"belt squat"),
    ("Leg curl", r"leg curl|hamstring curl machine|(seated|lying) (leg )?curl"), ("Leg extension", r"leg extension"),
    ("Hip abductor", r"abduct(or|ion) machine|machine abduct|^abductions?$"), ("Hip adductor", r"adduct(or|ion) machine|machine adduct"),
    ("Lat pulldown", r"pull ?down"), ("Seated row", r"seated (cable )?row|machine row|machine high elbow row|seated v.?bar row|seated row"),
    ("Chest press machine", r"machine (chest |incline |decline )?press|chest press machine"),
    ("Shoulder press machine", r"machine shoulder press|shoulder press machine"), ("Assisted pull-up", r"assisted"),
    ("Reverse hyper", r"reverse hyper"), ("Roman chair", r"roman chair|hyper ?extension|back extension|45.?degree"),
    ("Preacher bench", r"preacher"), ("T-bar", r"t.?bar"), ("Landmine", r"landmine|meadows"), ("TRX", r"trx|suspension"),
    ("Calf machine", r"(seated|standing|machine) calf|calf (raise )?machine|donkey calf"), ("Glute machine", r"glute (drive|kickback) machine|hip thrust machine"),
    ("Cable station", r"cable|push ?down|press ?down|face ?pull|crossover|rope"), ("Machine", r"machine"),
]
MACHINES_C = [(l, re.compile(rx, re.I)) for l, rx in MACHINES]


def merge(final):
    fam, mp, vn = {}, {}, {}
    for f in sorted(glob.glob(str(ROOT / "app/data/content/*.json"))):
        c = json.loads(Path(f).read_text())
        fam.update(c["families"]); mp.update(c["map"]); vn.update(c.get("variantNotes", {}))
    changed = 0
    for x in final:
        fid = mp.get(x["slug"])
        f = fam.get(fid) if fid else None
        if f:
            prim = f["primary"][0] if f.get("primary") else None
            g = R2G.get(prim)
            if g and g != x["group"] and (x["group"], g) not in KEEP:
                x["group"] = g; changed += 1
                x["region"] = "chest-upper" if prim == "chest" and x.get("region") == "chest-upper" else prim
            x["family"] = fid
            x["primary"] = f.get("primary", [])
            x["secondary"] = f.get("secondary", [])
            x["tr"] = f["tr"]["title"]; x["ar"] = f["ar"]["title"]
        for rx, g, reg in NAME_FIX:
            if re.search(rx, x["name"], re.I):
                x["group"], x["region"] = g, reg
        if x["slug"] in vn:
            x["note"] = 1
        x["machine"] = next((l for l, rx in MACHINES_C if rx.search(x["name"])), None)
        if x["machine"] and "Machine" not in x["equipment"] and x["machine"] not in ("Cable station", "Landmine", "TRX", "T-bar"):
            pass
        # drop legacy fields replaced by family content
        if f:
            for k in ("steps", "tips"):
                x.pop(k, None)
        x.pop("variations", None)
        # slim payload: derive media paths client-side, drop empty/legacy fields
        x["v"] = 1 if x.pop("video", None) else 0
        x.pop("poster", None); x.pop("id", None); x.pop("muscles", None)
        for k in ("aliases", "each_side", "tierNote", "tierVideo", "tier", "canonical", "machine", "note"):
            if k in x and not x[k]:
                x.pop(k)
    for lang in LANGS:
        out = {"families": {k: {kk: v[lang][kk] for kk in ("title", "about", "steps", "cues", "mistakes") if kk in v[lang]} for k, v in fam.items()},
               "notes": {k: v[lang] for k, v in vn.items() if lang in v}}
        (ROOT / f"app/data/families.{lang}.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    from collections import Counter
    print(f"families merged: {sum(1 for x in final if x.get('family'))}/{len(final)} | groups changed by family: {changed} | "
          f"machines: {dict(Counter(x['machine'] for x in final if x.get('machine')).most_common())}")
    return final
