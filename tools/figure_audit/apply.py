import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from decide import *
os.chdir(ROOT)
M = json.load(open('tools/figures_map.json'))
C = {x['id']: x for x in json.load(open('tools/oef_catalog.json'))}
E = json.load(open('app/data/exercises.json'))
F0 = json.load(open('app/data/figures.json'))
byfam = collections.defaultdict(list)
for e in E: byfam[e['family']].append(e)
byname = collections.defaultdict(list)
for e in E: byname[e['name']].append(e)
assert set(FAM) == set(M['families']), set(M['families']) ^ set(FAM)
fams, slugs, drops = {}, {}, {}
for f, v in M['families'].items():
    d = FAM[f]; oname = C[v['oef']]['name']; mem = byfam[f]
    if d == K:
        fams[f] = dict(v, why=f'all {len(mem)} members are {oname} (same equipment + body position)')
        continue
    keep = [] if d == D else d
    names = {e['name'] for e in mem}
    bad = [n for n in keep if n not in names]
    assert not bad, (f, bad)
    if keep and len(keep) == len(mem):
        print('NOTE full keep listed', f)
    for e in mem:
        if e['name'] in keep:
            slugs[e['slug']] = {'oef': v['oef'], 'file': v['file'], 'conf': 'high',
                                'why': f'same movement as {oname} (family {f} split)'}
    drops[f] = {'rejected': v['oef'], 'why': f'not every member is {oname}; kept {len(keep)}/{len(mem)} as slug entries'}
names_slug = {e['slug']: e['name'] for e in E}
for s, v in M['slugs'].items():
    n = names_slug.get(s)
    if n is None or n in DROP_SLUG:
        continue
    slugs[s] = dict(v, why=v.get('why') or f'exact match: {C[v["oef"]]["name"]}')
dropped_slugs = [names_slug.get(s) for s in M['slugs'] if names_slug.get(s) in DROP_SLUG]
assert len(dropped_slugs) == len(DROP_SLUG), set(DROP_SLUG) - set(dropped_slugs)
for n, (i, why) in ADD.items():
    (e,) = byname[n]
    slugs[e['slug']] = {'oef': i, 'file': C[i]['file'], 'conf': 'high', 'why': why}
out = {'families': dict(sorted(fams.items())), 'slugs': dict(sorted(slugs.items())),
       'dropped_families': dict(sorted(drops.items()))}
need = sorted({v['oef'] for v in list(fams.values()) + list(slugs.values())})
missing = [i for i in need if not os.path.isfile(f'app/media/figures/{i}.webp')]
print('missing webp:', missing)
if '--write' in sys.argv:
    json.dump(out, open('tools/figures_map.json', 'w'), indent=1, ensure_ascii=False); open('tools/figures_map.json','a').write('\n')
    fig = {'f': {k: v['oef'] for k, v in out['families'].items()}, 's': {k: v['oef'] for k, v in out['slugs'].items()}}
    json.dump(fig, open('app/data/figures.json', 'w'), separators=(',', ':'), ensure_ascii=False)
def cnt(F): return sum(1 for e in E if F['s'].get(e['slug']) or F['f'].get(e['family']))
F1 = {'f': {k: v['oef'] for k, v in fams.items()}, 's': {k: v['oef'] for k, v in slugs.items()}}
print('families map', len(M['families']), 'runtime f', len(F0['f']), '-> kept', len(fams), 'dropped', len(drops))
print('slugs', len(M['slugs']), '-> ', len(slugs), '(dropped old', len(dropped_slugs), ', new from splits', len([1 for v in slugs.values() if 'split' in v['why']]), ', added', len(ADD), ')')
print('exercises with figure', cnt(F0), '->', cnt(F1), 'of', len(E))
