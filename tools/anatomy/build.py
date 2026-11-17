import json, sys, math
import numpy as np
from svgpathtools import parse_path
from shapely.geometry import Polygon, MultiPolygon, LineString, box, Point
from shapely.ops import unary_union
from shapely import affinity

SRC = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
GAP = float(sys.argv[3]) if len(sys.argv) > 3 else 4.5     # source units between muscles
GROW_STEPS = int(sys.argv[4]) if len(sys.argv) > 4 else 5
GROW_STEP = 1.6
SCALE = 3.0
X0, Y0 = 40.0, 90.0
VIEWBOX = [0, 0, 216, 424]
AXIS = {"front": 364.0, "back": 1083.5}


def to_poly(d, step=1.5):
    p = parse_path(d)
    polys = []
    for sub in p.continuous_subpaths():
        pts = []
        for seg in sub:
            n = max(2, int(math.ceil(seg.length() / step)))
            for t in np.linspace(0, 1, n, endpoint=False):
                z = seg.point(t)
                pts.append((z.real, z.imag))
        if len(pts) >= 3:
            polys.append(Polygon(pts).buffer(0))
    return unary_union(polys)


def parts(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [x for x in getattr(g, "geoms", []) if isinstance(x, Polygon)]


# ---------- mapping: index -> (data-m, data-h) or "base" ----------
F, B = SRC["front"], SRC["back"]
NF = len(F)

def idx(name):  # "f12" / "b96" use the global numbering of the preview
    return int(name[1:])

MAP = {}
def m(names, mid, hid):
    for n in names.split():
        MAP[idx(n)] = (mid, hid)

# FRONT
m("f0 f1", "chest", "SPLIT_CHEST")
m(" ".join(f"f{i}" for i in range(2, 18)), "obliques", "obliques-external")
m("f20 f22 f18 f23", "abs", "abs-upper")
m("f19 f24 f21 f25", "abs", "abs-lower")
m("f26 f27", "biceps", "SPLIT_BICEPS")
m("f28 f29", "biceps", "biceps-brachialis")
m("f35 f36", "traps", "traps-upper")
m("f37 f38", "delt", "SPLIT_DELT_FRONT")
m("f39 f42", "adductors", "adductors-short")
m("f40 f43 f41 f44", "adductors", "adductors-magnus")
m("f45 f48", "quads", "quads-rf")
m("f46 f49", "quads", "quads-vl")
m("f47 f50", "quads", "quads-vm")
m("f55 f56", "shins", "shins-tibialis")
m("f57 f59", "calves", "calves-soleus")
m("f58 f60", "calves", "calves-gastroc")
m("f61 f64", "forearms", "forearms-brachioradialis")
m("f62 f63 f65 f66", "forearms", "forearms-flexors")
# BACK
m("b89 b90", "traps", "traps-upper")
m("b91 b92", "traps", "SPLIT_TRAPS")
m("b93 b94", "delt", "SPLIT_DELT_BACK")
m("b95 b97 b98 b99", "upper-back", "upper-back-teres")
m("b96 b100", "lats", "SPLIT_LATS")
m("b107 b110", "lats", "lats-lower")
m("b108 b109", "lower-back", "lower-back-erectors")
m("b101 b104", "triceps", "triceps-lateral")
m("b102 b105", "triceps", "triceps-long")
m("b103 b106", "triceps", "triceps-medial")
m("b113 b117", "forearms", "forearms-brachioradialis")
m("b111 b112 b114 b115 b116 b118", "forearms", "forearms-extensors")
m("b119 b121", "glutes", "glutes-med")
m("b120 b122", "glutes", "glutes-max")
m("b123 b124", "adductors", "adductors-magnus")
m("b125 b127 b129 b132", "hamstrings", "hamstrings-bf")
m("b126 b128 b130 b131", "hamstrings", "hamstrings-semis")
m("b133 b135 b137 b138", "calves", "calves-gastroc")
m("b134 b136 b139 b140", "calves", "calves-soleus")

HEADISH = {"head", "hair"}


def build_view(view):
    lst = F if view == "front" else B
    off = 0 if view == "front" else NF
    sil = to_poly(SRC[view + "_outline"], 2.0)
    region = sil.buffer(-3.0)
    pieces = []  # dict(geom, mid, hid, base, grow, mirror)
    for k, p in enumerate(lst):
        gi = k + off
        g = to_poly(p["d"])
        if gi in MAP:
            mid, hid = MAP[gi]
            pieces.append(dict(g=g, mid=mid, hid=hid, base=False, grow=True, gi=gi))
        else:
            pieces.append(dict(g=g, mid=None, hid=None, base=True, grow=False, gi=gi, slug=p["slug"]))
    # ---- growth to tighten gaps ----
    obst = [q for q in pieces if not q["grow"]]
    obst_u = unary_union([q["g"] for q in obst]).buffer(GAP)
    growers = [q for q in pieces if q["grow"]]
    orig = [q["g"] for q in growers]
    for _ in range(GROW_STEPS):
        for i, q in enumerate(growers):
            others = unary_union([growers[j]["g"] for j in range(len(growers)) if j != i]).buffer(GAP)
            g = q["g"].buffer(GROW_STEP, join_style=1).intersection(region).difference(others).difference(obst_u)
            g = unary_union([pp for pp in parts(g) if pp.intersects(orig[i])])
            q["g"] = unary_union([g, orig[i].difference(others)]) if not g.is_empty else q["g"]
    for q in growers:  # smooth
        q["g"] = q["g"].buffer(-1.2, join_style=1).buffer(1.2, join_style=1)
    # ---- splits ----
    out = []
    ax = AXIS[view]
    for q in pieces:
        if q["base"]:
            continue
        hid = q["hid"]
        g = q["g"]
        right = g.centroid.x > ax
        mir = (lambda geom: affinity.scale(geom, xfact=-1, yfact=1, origin=(ax, 0))) if right else (lambda geom: geom)
        X = (lambda x: 2 * ax - x) if right else (lambda x: x)
        if not hid.startswith("SPLIT"):
            out.append((q["mid"], hid, g)); continue
        def below(c, l):  # is point (in left-space) below line l=((x1,y1),(x2,y2)) ?
            (x1, y1), (x2, y2) = l; x = X(c.x)
            return c.y > y1 + (y2 - y1) * (x - x1) / (x2 - x1)
        def leftof(c, l):  # lateral of a mostly-vertical line (left-space)
            (x1, y1), (x2, y2) = l
            return X(c.x) < x1 + (x2 - x1) * (c.y - y1) / (y2 - y1)
        L = lambda l: mir(LineString(l))
        if hid == "SPLIT_CHEST":
            l1 = ((240, 338), (380, 356)); l2 = ((240, 392), (380, 404))
            out += cut(g, [L(l1), L(l2)], lambda c: "chest-lower" if below(c, l2) else ("chest-mid" if below(c, l1) else "chest-upper"), "chest")
        elif hid == "SPLIT_BICEPS":
            mrr = g.minimum_rotated_rectangle
            xs, ys = mrr.exterior.coords.xy
            e = [(xs[i + 1] - xs[i], ys[i + 1] - ys[i]) for i in range(2)]
            v = max(e, key=lambda t: math.hypot(*t)); n = math.hypot(*v); v = (v[0] / n * 200, v[1] / n * 200)
            c0 = g.centroid
            ln = LineString([(c0.x - v[0], c0.y - v[1]), (c0.x + v[0], c0.y + v[1])])
            out += cut(g, [ln], lambda cc: "biceps-long" if X(cc.x) < X(c0.x) else "biceps-short", "biceps")
        elif hid == "SPLIT_DELT_FRONT":
            l = ((233, 296), (205, 398))
            out += [(h, h, gg) for _, h, gg in cut(g, [L(l)], lambda cc: "delt-side" if leftof(cc, l) else "delt-front", "x")]
        elif hid == "SPLIT_DELT_BACK":
            l = ((947, 300), (925, 400))
            out += [(h, h, gg) for _, h, gg in cut(g, [L(l)], lambda cc: "delt-side" if leftof(cc, l) else "delt-rear", "x")]
        elif hid == "SPLIT_LATS":
            l = ((950, 486), (1080, 472))
            out += cut(g, [L(l)], lambda cc: "lats-lower" if below(cc, l) else "lats-upper", "lats")
        elif hid == "SPLIT_TRAPS":
            l1 = ((990, 352), (1090, 374))   # mid / below
            l2 = ((1052.4, 358), (1079, 490))  # rhomboid (lateral) / lower traps (medial)
            l3 = ((1000, 452), (1090, 452))  # rhomboid bottom
            def asg(c):
                if not below(c, l1): return "traps-mid"
                if leftof(c, l2) and not below(c, l3): return "upper-back-rhomboids"
                return "traps-lower"
            pcs = cut(g, [L(l1), L(((1052.4, 358), (1079, 490)))], asg, "traps")
            print("TRAPS", [(h, round(pp.area), round(pp.representative_point().x), round(pp.representative_point().y)) for _, h, pp in pcs])
            for _, h, pp in [t for t in pcs if t[2].area > 200]:
                out.append(("upper-back" if h.startswith("upper-back") else "traps", h, pp))
    return sil, pieces, out


def cut(g, lines, assign, mid):
    strip = unary_union([ln.buffer(GAP / 2, cap_style=2) for ln in lines])
    res = []
    for pp in parts(g.difference(strip)):
        if pp.area < 80:
            continue
        res.append((mid, assign(pp.representative_point()), pp))
    return res


def num(v):  # v in tenths
    s = ("%.1f" % (v / 10)).rstrip("0").rstrip(".")
    if s.startswith("0."): s = s[1:]
    elif s.startswith("-0."): s = "-" + s[2:]
    if s == "-0" or s == "": s = "0"
    return s


def path_d(geom, ox, tol=0.45):
    geom = geom.simplify(tol, preserve_topology=True)
    out = []
    for p in parts(geom):
        for r in [p.exterior] + list(p.interiors):
            pts = [(round((x - ox - X0) / SCALE * 10), round((y - Y0) / SCALE * 10)) for x, y in r.coords]
            dd = []
            for q in pts:
                if not dd or q != dd[-1]:
                    dd.append(q)
            if len(dd) > 1 and dd[0] == dd[-1]:
                dd.pop()
            if len(dd) < 3:
                continue
            s = "M" + num(dd[0][0]) + " " + num(dd[0][1]) + "l"
            prev = dd[0]; first = True
            for q in dd[1:]:
                a, b = num(q[0] - prev[0]), num(q[1] - prev[1])
                if not first and not a.startswith("-"):
                    s += " "
                s += a + ("" if b.startswith("-") else " ") + b
                prev = q; first = False
            out.append(s + "z")
    return "".join(out)


res = {}
report = {}
for view in ("front", "back"):
    ox = 0 if view == "front" else 724
    sil, pieces, out = build_view(view)
    html = ['<path class="base" d="%s"/>' % path_d(sil, ox, 0.5)]
    for q in pieces:
        if q["base"]:
            html.append('<path class="base" d="%s"/>' % path_d(q["g"], ox, 0.5))
    for mid, hid, g in out:
        if mid == "delt":
            mid = hid
        html.append('<path class="m" data-m="%s" data-h="%s" d="%s"/>' % (mid, hid, path_d(g, ox)))
        report.setdefault(view, {}).setdefault(mid, set()).add(hid)
    res[view] = "".join(html)

credit = {
    "title": "react-native-body-highlighter — male body front/back SVG paths (v3.2.0)",
    "author": "ELABBASSI Hicham (HichamELBSI) and contributors",
    "url": "https://github.com/HichamELBSI/react-native-body-highlighter",
    "license": "MIT",
    "licenseUrl": "https://github.com/HichamELBSI/react-native-body-highlighter/blob/main/LICENSE",
    "note": ("Copyright (c) 2022 ELABBASSI Hicham, MIT License. Modified: flattened to polygons, rescaled, muscles grown to "
             "close gaps, regrouped to this app's muscle ids, and split into heads (chest bands, biceps long/short, "
             "front/side/rear deltoid, upper/lower lats, mid/lower traps, synthesized rhomboids)."),
}
MIT = """/*
 * Body map shapes derived from react-native-body-highlighter v3.2.0
 * https://github.com/HichamELBSI/react-native-body-highlighter
 *
 * MIT License
 *
 * Copyright (c) 2022 ELABBASSI Hicham
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Modifications (flattening, rescaling, gap closing, head splits) by this project; same license.
 */
"""
js = MIT + "// Generated file: realistic front/back body map. Coordinates in a shared viewBox.\n"
js += "export const VIEWBOX = %s;\n" % json.dumps(VIEWBOX).replace(" ", "")
js += "export const CREDIT = %s;\n" % json.dumps(credit, ensure_ascii=False, indent=2)
assert "'" not in res["front"] + res["back"]
js += "export const ANATOMY = {\n  front: '%s',\n  back: '%s',\n};\n" % (res["front"], res["back"])
open(OUT, "w").write(js)
print(len(js.encode()), "bytes")
for v, d in report.items():
    print(v, {k: sorted(s) for k, s in d.items()})
