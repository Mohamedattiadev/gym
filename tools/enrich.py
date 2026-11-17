"""Phase-0 enrichment: authoritative group fixes, equipment normalization, and derived training fields.
Used by build_data.py: enrich(x) mutates one exercise dict."""
import re

I = re.I

# ---------- name cleanup ----------
def clean_name(n):
    n = re.sub(r"\bcluster\s*f\w*", "Cluster", n, flags=I)
    n = re.sub(r"tri-?fucta", "Tri-Fecta", n, flags=I)
    n = re.sub(r"\bFML\b", "", n)
    if n.isupper() or sum(c.isupper() for c in n) > 0.7 * sum(c.isalpha() for c in n):
        n = n.title()
    return re.sub(r"\s{2,}", " ", n).strip(" -")


# ---------- authoritative group rules (override API group; first match wins) ----------
GROUP_FIX = [
    ("Abs", r"crunch|leg raise|knee raise"),
    ("Chest", r"hammer strength|hammer.*press"),
    ("Triceps", r"lateral head|long head(?!.*curl)|close.?grip (bench|press)"),
    ("Lats", r"close.?grip.*pull.?up"),
    ("Forearms", r"wrist|forearm|farmer|reverse (grip )?curl|grip crush|gripper|dead hang"),
    ("Hamstrings", r"leg curl|hamstring|nordic|\brdl\b|romanian|stiff.?leg|\bstiffs?\b|good ?morning|glute.?ham"),
    ("Calves", r"calf|calves"),
    ("Shins", r"\btib"),
    ("Glutes", r"hip thrust|glute|abduct|donkey|clam|frog pump|(cable|band).*kick ?back(?!.*tri)|bridge"),
    ("Quads", r"leg extension|sissy|leg press|hack|pendulum|squat|lunge|step.?up|wall sit"),
    ("Traps", r"shrug|kelso"),
    ("Shoulders", r"rear delt|reverse (pec|fly|cable fly)|face ?pull|lateral(?!.*(walk|lunge|squat|step))|laterals|"
                  r"y.?raise|w raise|upright row|shoulder press|military|overhead press|arnold|viking|bus driver|partial sides|scap plane"),
    ("Triceps", r"skull|push ?downs?|press ?downs?|tricep|french press|jm press|coffin|kick ?back|"
                r"(overhead|cable|rope|incline cable|straight bar|ez bar).*extension|bench dip|"
                r"over top of elbow|straight bar partials"),
    ("Biceps", r"curl|preacher|bicep|spider|hammer(?! strength)(?!.*press)"),
    ("Lats", r"pull ?downs?|pull.?ups?|chin.?ups?|pull ?over|straight.?arm|lat prayer|\blat\b"),
    ("Upper Back", r"\brows?\b|reverse fly|scap|thoracic"),
    ("Lower Back", r"hyper|back extension|jefferson|roman chair|superman|posterior chain|deadlift"),
    ("Abs", r"crunch|leg raise|knee raise|plank|\bab\b|abs\b|abdominal|v.?ups?|sit.?ups?|oblique|russian twist|"
            r"pike|hollow|wood ?chop|dead ?bug|bicycle|rollout"),
    ("Chest", r"chest|bench|press|push.?ups?|\bfly\b|flye|flys|crossover|pec|dips?\b"),
]
GROUP_FIX_C = [(g, re.compile(rx, I)) for g, rx in GROUP_FIX]

# ---------- equipment ----------
EQUIP_NORM = {"Exercise Machine": "Machine", "Calisthenics": "Bodyweight", "Smith Machine": "Smith",
              "Resistance Band": "Band", "Kettlebells": "Kettlebell", "Exercise Ball": "Ball", "Body Weight": "Bodyweight"}
EQUIP_DROP = {"Free Weights", "Total Body", "Other", "Alternative", "Plyometrics", "Cardio", "Stretching"}
EQUIP_NAME = [("Smith", r"smith"), ("EZ Bar", r"ez.?bar"), ("Barbell", r"barbell|\bbb\b|bench press|deadlift|landmine|t.?bar"),
              ("Dumbbell", r"dumbbell|\bdb\b|goblet"), ("Kettlebell", r"kettlebell"),
              ("Cable", r"cable|push ?down|press ?down|pull ?down|v.?bar|rope|face ?pull|crossover"),
              ("Machine", r"machine|leg press|leg extension|leg curl|pec deck|hack|pendulum|calf raise machine|abduct|assisted"),
              ("Band", r"\bband"), ("Plate", r"\bplate"), ("Ball", r"exercise ball|stability ball|swiss ball"),
              ("Bodyweight", r"push.?up|pull.?up|chin.?up|\bdips?\b|bodyweight|body weight|plank|crunch|sit.?up|nordic|"
                             r"pistol|hanging|inverted row|hyper|lunge(?!.*(dumbbell|barbell|smith))")]
EQUIP_NAME_C = [(e, re.compile(rx, I)) for e, rx in EQUIP_NAME]

# ---------- movement pattern ----------
PATTERNS = [
    ("calf", r"calf|calves|\btib"),
    ("core", r"crunch|leg raise|knee raise|plank|\bab\b|abs\b|abdominal|v.?ups?|sit.?ups?|oblique|twist|pike|hollow|dead ?bug|bicycle|rollout|wood ?chop"),
    ("ext", r"leg extension|sissy|skull|push ?down|press ?down|tricep|french|extension(?!.*(back|hip))|kick ?back(?!.*glute)|coffin"),
    ("curl", r"curl|preacher|spider|nordic|glute.?ham"),
    ("hinge", r"\brdl\b|romanian|stiff|deadlift|good ?morning|hip thrust|bridge|hyper|back extension|jefferson|pull.?through"),
    ("lunge", r"lunge|split squat|bulgarian|step.?up"),
    ("squat", r"squat|leg press|hack|pendulum|wall sit"),
    ("v-pull", r"pull ?down|pull.?ups?|chin.?ups?"),
    ("h-pull", r"\brows?\b|face ?pull"),
    ("fly", r"\bfly\b|flye|flys|crossover|pec ?deck|reverse fly|rear delt|pull ?over|straight.?arm|lat prayer"),
    ("raise", r"raise|lateral|laterals|shrug|kelso|abduct|upright row|bus driver|y.?raise"),
    ("v-push", r"shoulder press|overhead press|military|arnold|viking|(seated|standing).*(barbell|dumbbell) press$|landmine press"),
    ("h-push", r"press|bench|push.?up|dips?\b"),
]
PATTERNS_C = [(p, re.compile(rx, I)) for p, rx in PATTERNS]
COMPOUND = {"squat", "lunge", "hinge", "h-push", "v-push", "h-pull", "v-pull"}

ADV = re.compile(r"drops?\b|drop set|partials?|cluster|myo|super slow|\bhold\b|second hold|tempo|2 count|pause|"
                 r"rest.?pause|giant|tri.?set|extreme stretch|deficit|nordic|pistol|1 ?1/2|one and a half", I)
INTER = re.compile(r"barbell|smith|pull.?ups?|chin.?ups?|\bdips?\b|bulgarian|split squat|front squat|rdl|romanian|"
                   r"stiff|deadlift|hip thrust|good ?morning|hanging|skull|jm press|t.?bar|pendlay|kroc|sissy|landmine", I)

def region(group, name):
    n = name.lower()
    if group == "Shoulders":
        if re.search(r"rear|reverse|face ?pull", n): return "delt-rear"
        if re.search(r"lateral|y.?raise|w raise|upright|side|bus driver|partial sides|scap", n): return "delt-side"
        return "delt-front"
    if group == "Chest" and re.search(r"incline|clavicular|low.?to.?high", n): return "chest-upper"
    return {"Chest": "chest", "Biceps": "biceps", "Triceps": "triceps", "Forearms": "forearms", "Abs": "abs",
            "Quads": "quads", "Groin": "adductors", "Shins": "shins", "Traps": "traps", "Upper Back": "upper-back",
            "Lats": "lats", "Lower Back": "lower-back", "Glutes": "glutes", "Hamstrings": "hamstrings",
            "Calves": "calves", "Cardio": "cardio"}.get(group, "other")


def enrich(x, api_group):
    n = x["name"] = clean_name(x["name"])
    # group: authoritative name rules first, then API/keyword group
    for g, rx in GROUP_FIX_C:
        if rx.search(n):
            x["group"] = g
            break
    if x["group"] in ("Lats", "Upper Back") and api_group in ("Lats", "Upper Back") and re.search(r"\brows?\b", n, I):
        x["group"] = api_group  # keep API's lats/upper-back split for rows
    # equipment
    eq = [e for e, rx in EQUIP_NAME_C if rx.search(n)]
    if not eq:
        eq = [EQUIP_NORM.get(e, e) for e in x["equipment"] if e not in EQUIP_DROP]
    if "Smith" in eq or "EZ Bar" in eq:
        eq = [e for e in eq if e != "Barbell"]
    if len(eq) > 1 and "Bodyweight" in eq:
        eq.remove("Bodyweight")
    x["equipment"] = list(dict.fromkeys(eq))[:3]
    # pattern / type
    x["pattern"] = next((p for p, rx in PATTERNS_C if rx.search(n)), "isolation")
    compound = x["pattern"] in COMPOUND and x["group"] not in ("Calves", "Abs", "Forearms")
    x["type"] = "compound" if compound else "isolation"
    heavy = compound and x["pattern"] in ("squat", "hinge", "h-push", "v-push") and \
        any(e in x["equipment"] for e in ("Barbell", "Smith"))
    small = x["group"] in ("Calves", "Abs", "Forearms", "Shins")
    x["rest"] = 180 if heavy else 120 if compound else 60 if small else 90
    x["repRange"] = [5, 8] if heavy and x["pattern"] in ("squat", "hinge") else [6, 10] if heavy else \
        [8, 12] if compound else [12, 20] if small else [10, 15]
    # level
    d = (x.get("difficulty") or "").lower()
    if ADV.search(n) or d in ("advanced", "expert"):
        lvl = "advanced"
    elif INTER.search(n) or d == "intermediate":
        lvl = "intermediate"
    else:
        lvl = "beginner"
    x["level"] = lvl
    x.pop("difficulty", None)
    x["region"] = region(x["group"], n)
    return x


CLEAN = re.compile(r"^[A-Za-z0-9 \-]+$")
NOISE = re.compile(r"drops?|partial|cluster|hold|slow|tri.?set|giant|garage|2\.0|explanation|tip|extreme|"
                   r"\d+ (count|second)|pre.?exhaust|wrap|focus|version", I)

def mark_canonical(exs, per_group=8):
    """Pick a small clean set per group: tier S/A, has video, no intensity-technique noise, short names."""
    score_t = {"S": 0, "A": 1, "B": 2}
    by = {}
    for x in exs:
        x["canonical"] = False
        if x["tier"] in score_t and x["video"] and CLEAN.match(x["name"]) and not NOISE.search(x["name"]):
            by.setdefault(x["group"], []).append(x)
    for x in exs:  # groups Jeff never ranked: allow clean untiered picks
        if x["tier"] is None and x["video"] and CLEAN.match(x["name"]) and not NOISE.search(x["name"]) \
                and not any(y["group"] == x["group"] for y in exs if y["tier"] in score_t):
            by.setdefault(x["group"], []).append(x)
    score_t[None] = 3
    for g, lst in by.items():
        lst.sort(key=lambda x: (score_t[x["tier"]], len(x["name"])))
        seen_patterns = {}
        picked = []
        for x in lst:  # diversity: max 3 per pattern within a group
            if seen_patterns.get(x["pattern"], 0) >= 4:
                continue
            seen_patterns[x["pattern"]] = seen_patterns.get(x["pattern"], 0) + 1
            picked.append(x)
            if len(picked) >= per_group:
                break
        for x in picked:
            x["canonical"] = True
