#!/usr/bin/env python3
"""Q6 visual baseline: compare the route screenshots (tools/test/routes.mjs) with tools/test/baseline/.

  python3 tools/test/visual.py <routesOutDir>            compare, exit 1 if a page changed
  python3 tools/test/visual.py <routesOutDir> --update   accept the current look as the new baseline

Baseline = half-size grayscale PNGs (16 grey levels) (small enough to commit; still catches layout, spacing,
contrast and missing elements). A page counts as changed when more than LIMIT of its pixels
differ by more than TOL grey levels, or its size changed (page got taller/shorter).
Diff images (changed pixels in red over the new shot) go to <routesOutDir>/visual-diff/.
After an intended visual change: look at the diffs, then run with --update and commit the baseline.
"""
import sys, pathlib
from PIL import Image, ImageChops

TOL, LIMIT = 40, 0.01  # 0.4 % flagged blur-under-the-tab-bar flicker (phone-profile-dark)
root = pathlib.Path(__file__).resolve().parent
base = root / "baseline"


def small(p):
    im = Image.open(p).convert("L")
    return im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.BILINEAR)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = pathlib.Path(sys.argv[1])
    shots = sorted(p for p in src.glob("*.png"))
    if not shots:
        sys.exit(f"no screenshots in {src}")
    if "--update" in sys.argv:
        base.mkdir(exist_ok=True)
        for old in base.glob("*.png"):
            old.unlink()
        for p in shots:
            small(p).point(lambda v: v // 17 * 17).save(base / p.name, optimize=True, bits=4)
        print(f"baseline updated: {len(shots)} pages -> {base}")
        return
    diffdir = src / "visual-diff"
    changed, missing = [], []
    for p in shots:
        b = base / p.name
        if not b.exists():
            missing.append(p.name)
            continue
        cur, ref = small(p), Image.open(b).convert("L")
        if cur.size != ref.size:
            changed.append((p.name, f"size {ref.size[0]}x{ref.size[1]} -> {cur.size[0]}x{cur.size[1]}"))
            continue
        d = ImageChops.difference(cur, ref).point(lambda v: 255 if v > TOL else 0)
        n = sum(d.histogram()[255:])
        ratio = n / (cur.width * cur.height)
        if ratio > LIMIT:
            changed.append((p.name, f"{ratio:.1%} of pixels"))
            diffdir.mkdir(exist_ok=True)
            over = Image.open(p).convert("RGB").resize(cur.size)
            over.paste((230, 30, 30), mask=d)
            over.save(diffdir / p.name)
    gone = sorted({b.name for b in base.glob("*.png")} - {p.name for p in shots})
    for name, why in changed:
        print(f"CHANGED {name}: {why}")
    for name in missing:
        print(f"NEW     {name} (no baseline yet)")
    for name in gone:
        print(f"MISSING {name} (in baseline, not shot)")
    print(f"{len(shots) - len(changed) - len(missing)}/{len(shots)} pages match the baseline"
          + (f"; diffs in {diffdir}" if changed else ""))
    sys.exit(1 if changed else 0)


if __name__ == "__main__":
    main()
