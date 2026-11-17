import json, sys, os, collections
sys.path.insert(0, os.path.dirname(__file__))
from famdata import FAM, CHEST, BACK, SHO, BIS, TRI, QUAD, GLUTE, ALL25, S7, EX, VID

root = sys.argv[1]
ex_all = json.load(open(os.path.join(root, 'app/data/exercises.json')))
by_slug = {e['slug']: e for e in ex_all}
fams = {e['family'] for e in ex_all}

fam = collections.OrderedDict()
for f, v, t in FAM:
    assert f in fams, f
    fam.setdefault(f, collections.OrderedDict())
    if v not in fam[f]:
        fam[f][v] = max(0, t - 2)

ex = collections.OrderedDict()
for slug, vid, t in EX:
    e = by_slug[slug]
    assert not e.get('tierVideo'), slug
    by, title = VID[vid]
    ex[slug] = {"yt": vid, "t": max(0, t - 2) if t > 2 else t, "by": by, "title": title}

out = {"v": 1, "fam": fam, "ex": ex}
json.dump(out, open(os.path.join(root, 'app/data/jeff.json'), 'w'), separators=(',', ':'), ensure_ascii=False)

# coverage
tier = [e for e in ex_all if e.get('tierVideo')]
cov_own = [e for e in tier if e['tierVideo'] in fam.get(e['family'], {})]
cov_any = [e for e in tier if e['family'] in fam]
print('tier exercises', len(tier), 'covered in own tierVideo', len(cov_own), 'family has any jeff ts', len(cov_any))
nt = [e for e in ex_all if not e.get('tierVideo')]
print('non-tier', len(nt), 'with backup', len(ex), collections.Counter(x['by'] for x in ex.values()))
print('fam families', len(fam), 'pairs', sum(len(v) for v in fam.values()))
