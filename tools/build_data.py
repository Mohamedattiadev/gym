#!/usr/bin/env python3
"""Merge server exercises (with videos) + APK app.db (steps/tips/muscles) into app/data/exercises.json."""
import base64, json, re, sqlite3, sys, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = json.loads((ROOT / "raw/exercises.json").read_text())
DB = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "raw/app.db")
OUT = ROOT / "app/data/exercises.json"


def java_list(b64):
    """Decode a Java-serialized ArrayList<String> (TC_STRING = 0x74, u16 length)."""
    if not b64:
        return []
    try:
        raw = base64.b64decode(b64)
    except Exception:
        return []
    out, i = [], raw.find(b"\x77")  # block data after header
    i = 0 if i < 0 else i
    while i < len(raw):
        if raw[i] == 0x74 and i + 3 <= len(raw):
            n = int.from_bytes(raw[i + 1:i + 3], "big")
            s = raw[i + 3:i + 3 + n]
            if len(s) == n:
                try:
                    out.append(s.decode("utf-8").strip())
                    i += 3 + n
                    continue
                except UnicodeDecodeError:
                    pass
        i += 1
    return [s for s in out if s]


def norm(s):
    s = (s or "").lower()
    s = re.sub(r"\(.*?\)|\bcopy\b|garage program|\bgp\b", " ", s)
    s = s.replace("-", " ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\bups\b", "up", s)
    s = re.sub(r"s\b", "", s)  # crude plural strip
    return " ".join(s.split())


db = {}
con = sqlite3.connect(DB)
for row in con.execute("select name, other_names, difficulty_level, muscle_groups, types, tips, steps, variations from ExerciseObject"):
    name, other, diff, mg, types, tips, steps, var = row
    rec = dict(muscles=java_list(mg), types=java_list(types), tips=java_list(tips),
               steps=java_list(steps), variations=java_list(var), difficulty=diff)
    if not (rec["steps"] or rec["muscles"]):
        continue
    for n in [name] + (other or "").split(","):
        k = norm(n)
        if k and k not in db:
            db[k] = rec

MUSCLE_MAP = {"Front/Anterior Delt": "Shoulders", "Side/Lateral Delt": "Shoulders", "Rear/Posterior Delt": "Shoulders",
              "Deltoids": "Shoulders", "Upper Traps": "Traps", "Mid Traps": "Traps", "Lower Traps": "Traps",
              "Middle Back": "Upper Back", "Adductors": "Groin", "Outer Thighs": "Glutes", "Quadriceps": "Quads"}

out, matched = [], 0
for e in API:
    slug = e["cached_slug"]
    has_video = (ROOT / f"media/video/{slug}.mp4").exists() or bool(e.get("stream_url"))
    m = db.get(norm(e["name"]))
    if m:
        matched += 1
    muscles = [x for x in (e.get("muscle_groups") or []) if x] or (m["muscles"] if m else [])
    primary = e.get("muscle_group") or (muscles[0] if muscles else "")
    secondary = [x["name"] for x in (e.get("secondary_muscle_groups") or []) if isinstance(x, dict)]
    def lst(v):
        return [s.strip() for s in v if isinstance(s, str) and s.strip()] if isinstance(v, list) else []
    name = re.sub(r"\s*\((copy|gp|garage program)\)\s*|\s+copy$", "", e["name"], flags=re.I).strip().replace("“", "\"").replace("”", "\"")
    out.append(dict(
        id=e["id"], slug=slug, name=name,
        group=MUSCLE_MAP.get(primary, primary) or "Other",
        muscles=sorted(set(muscles + secondary) - {""})[:8],
        equipment=lst(m["types"]) if m else [],
        difficulty=e.get("difficulty_level") or (m["difficulty"] if m else None),
        steps=lst(e.get("steps")) or (m["steps"] if m else []),
        tips=lst(e.get("tips")) or (m["tips"] if m else []),
        variations=m["variations"] if m else [],
        aliases=e.get("other_names") or "",
        each_side=bool(e.get("each_side")),
        video=f"media/video/{slug}.mp4" if has_video else None,
        poster=f"media/poster/{slug}.webp",
        _api_group=MUSCLE_MAP.get(primary, primary),
    ))

PROGRAM = re.compile(r"\bweek \d|welcome|explanation|intro|overview|\bprogram\b|-a-thon|thon\b|\btips?\b|wrap up|^rest$|warm up", re.I)
GROUP_RULES = [  # first match wins
    ("Shins", r"\btib"), ("Lower Back", r"hyper|jefferson|roman chair|posterior chain"), ("Abs", r"bicycle"),
    ("Shoulders", r"viking|w raise|plate raise|supinated.*raise|raise.*supinated|partial sides|dumbbell drags"),
    ("Triceps", r"extension|push ?downs?|over top of elbow|straight bar partials"),
    ("Chest", r"(incline|decline|flat|floor|smith|db|machine).*(press|db|smith|cable)|^incline smith"),
    ("Calves", r"calf|calves"), ("Forearms", r"wrist|forearm|grip crush|farmer"),
    ("Abs", r"crunch|\bab\b|abs\b|abdominal|leg raise|plank|v-?ups?|sit-?ups?|oblique|russian twist|pike|knee raise|hollow|wood ?chop|dead ?bug"),
    ("Traps", r"shrug|\btrap"), ("Hamstrings", r"hamstring|leg curl|nordic|\bstiffs?\b|stiff.?leg|rdl|romanian|good ?morning|glute.?ham"),
    ("Glutes", r"glute|hip thrust|bridge|kickback(?!.*tricep)|abduct|donkey|clam"),
    ("Triceps", r"tricep|skull|french press|pushdown|push-?down|jm press|close.?grip|\bdips?\b|dip bar|kick ?back|overhead extension|coffin"),
    ("Biceps", r"curl|bicep|spider|hammer|preacher"),
    ("Shoulders", r"lateral|laterals|delt|shoulder|military|overhead press|arnold|front raise|face pull|upright row|bus driver|\bpress\b.*seated|seated .*press|y.?raise|rear"),
    ("Lats", r"pull-?ups?|chin-?ups?|pulldown|pull-?down|pullover|\blat\b|lats\b"),
    ("Upper Back", r"\brows?\b|rowing|thoracic|scap|reverse fly"),
    ("Chest", r"chest|bench|push-?ups?|\bfly\b|flye|flys|crossover|pec|squeeze press"),
    ("Quads", r"squat|lunge|leg press|leg extension|step.?up|sissy|split|quad|hack|wall sit|goblet"),
    ("Lower Back", r"hyperextension|back extension|superman|deadlift"),
    ("Cardio", r"cardio|run|walk|bike|jump|burpee|sprint|skip|row machine|treadmill|elliptical"),
]
EQUIP_RULES = [("Dumbbell", r"dumbbell|\bdb\b"), ("Barbell", r"barbell|\bbb\b|bench press|deadlift"), ("EZ Bar", r"ez.?bar"),
               ("Smith Machine", r"smith"), ("Cable", r"cable|pushdown|pulldown|v-?bar|rope"), ("Kettlebell", r"kettlebell"),
               ("Band", r"band"), ("Machine", r"machine|leg press|leg extension|leg curl|pec deck|hack"),
               ("Bodyweight", r"push-?up|pull-?up|chin-?up|\bdip|bodyweight|plank|crunch|sit-?up|burpee"),
               ("Exercise Ball", r"exercise ball|stability ball|swiss ball")]


def classify(x):
    n = x["name"]
    if PROGRAM.search(n) and not x["steps"]:
        x["group"] = "Program Videos"
    elif x["group"] == "Other":
        for g, rx in GROUP_RULES:
            if re.search(rx, n, re.I):
                x["group"] = g
                break
    if x["slug"] == "2-part-high-elbow-row":  # video is a chest-supported dumbbell row
        x["equipment"] = ["Dumbbell"]
    if not x["equipment"]:
        x["equipment"] = [eq for eq, rx in EQUIP_RULES if re.search(rx, n, re.I)]
    return x


out = [x for x in (classify(x) for x in out) if x["group"] != "Program Videos"]  # talking explainers, useless silent

sys.path.insert(0, str(ROOT / "tools"))
from enrich import enrich, mark_canonical  # noqa: E402
out = [enrich(x, x.pop("_api_group")) for x in out]

# ---- Jeff Nippard tiers ----
from jeff_tiers import RULES  # noqa: E402
RULES_C = [(re.compile(rx, re.I), t, note, vid) for rx, t, note, vid in RULES]
removed = []
for x in out:
    x["tier"] = x["tierNote"] = x["tierVideo"] = None
    for rx, t, note, vid in RULES_C:
        if rx.search(x["name"]):
            x["tier"], x["tierNote"], x["tierVideo"] = t, note, vid
            break
removed = [x for x in out if x["tier"] in ("D", "F")]
out = [x for x in out if x["tier"] not in ("D", "F")]
(ROOT / "raw/removed_by_jeff.json").write_text(json.dumps([{k: x[k] for k in ("name", "tier", "tierNote")} for x in removed], indent=1))
from collections import Counter
print("tiers:", dict(sorted(Counter(x["tier"] or "-" for x in out).items())), "| removed D/F:", len(removed))

# drop exact-duplicate names (keep the one with a video / more info)
best = {}
for x in out:
    k = x["name"].lower()
    score = (x["video"] is not None, len(x["steps"]), len(x["muscles"]))
    if k not in best or score > best[k][0]:
        best[k] = (score, x)
mark_canonical(list(v[1] for v in best.values()))
final = sorted((v[1] for v in best.values()), key=lambda x: re.sub(r"[^a-z0-9 ]", "", x["name"].lower()).strip())
OUT.parent.mkdir(parents=True, exist_ok=True)
from merge_content import merge  # noqa: E402
final = merge(final)
OUT.write_text(json.dumps(final, ensure_ascii=False, separators=(",", ":")))
print("canonical:", sum(bool(x.get("canonical")) for x in final), "| levels:", dict(Counter(x["level"] for x in final)))
print(f"{len(API)} api, {matched} matched with app.db, {len(final)} after dedupe, "
      f"{sum(1 for x in final if x.get('family'))} with family, {sum(1 for x in final if x['v'])} with video")
