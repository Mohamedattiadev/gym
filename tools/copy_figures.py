#!/usr/bin/env python3
"""Copy open-exercise-figures animations into media/figures/<id>.webp.

Usage (run isolated, from anywhere):
  python3 -I tools/copy_figures.py 0652 1604 3021
  python3 -I tools/copy_figures.py ids.json        # JSON list of ids, or a dict
                                                  # whose values contain {"oef": id}
  python3 -I tools/copy_figures.py --map           # everything in tools/figures_map.json

Source: raw/oef (git clone of AbanoubAmir/open-exercise-figures, CC0 media).
Files larger than 300 KB are re-encoded with ffmpeg (animated webp, q=70).
"""
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OEF = os.path.join(ROOT, 'raw', 'oef')
OUT = os.path.join(ROOT, 'media', 'figures')
MAX_BYTES = 300_000


def ids_from_json(path):
    data = json.load(open(path, encoding='utf-8'))
    found = []

    def walk(x):
        if isinstance(x, str):
            found.append(x)
        elif isinstance(x, list):
            for y in x:
                walk(y)
        elif isinstance(x, dict):
            if 'oef' in x:
                found.append(str(x['oef']))
            else:
                for y in x.values():
                    walk(y)
    walk(data)
    return found


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    ids = []
    for a in argv:
        if a == '--map':
            ids += ids_from_json(os.path.join(ROOT, 'tools', 'figures_map.json'))
        elif a.endswith('.json') and os.path.isfile(a):
            ids += ids_from_json(a)
        else:
            ids.append(a)
    catalog = {e['id']: e for e in json.load(open(os.path.join(OEF, 'exercises.json'), encoding='utf-8'))}
    os.makedirs(OUT, exist_ok=True)
    total, missing = 0, []
    for i in dict.fromkeys(ids):
        e = catalog.get(i)
        src = os.path.join(OEF, e['animation']) if e else None
        if not src or not os.path.isfile(src):
            missing.append(i)
            continue
        dst = os.path.join(OUT, i + '.webp')
        if os.path.getsize(src) > MAX_BYTES:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-c:v', 'libwebp_anim',
                            '-quality', '70', '-lossless', '0', '-loop', '0', dst], check=True)
        else:
            shutil.copyfile(src, dst)
        total += os.path.getsize(dst)
        print(f'{i}\t{e["name"]}\t{os.path.getsize(dst) // 1024} KB')
    print(f'copied {len(dict.fromkeys(ids)) - len(missing)} files, {total / 1e6:.2f} MB -> {OUT}')
    if missing:
        print('missing ids:', ' '.join(missing), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
