# Lighthouse mobile + visual baseline (Q6, 2026-11-19)

Tool: `tools/test/lighthouse.sh [url] [outDir]` (Lighthouse 13.6.0, default mobile emulation:
Moto G class phone, CPU ×4 slowdown, slow 4G). Boots at `#/train` because a fresh profile at `#/`
is sent to the onboarding.

## Numbers (sw v94, before the heading fix)

| Run | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Speed index |
|---|---|---|---|---|---|---|---|---|---|
| Live (GitHub Pages, gzip) run 1 | 95 | 98 | 100 | 100 | 1.1 s | 2.6 s | 80 ms | 0 | 3.6 s |
| Live run 2 | **97** | 98 | 100 | 100 | 0.9 s | 2.4 s | 70 ms | 0 | 2.9 s |
| Local `python3 -m http.server` (no gzip, no cache headers) | 73 | 98 | 100 | 100 | 1.2 s | 8.1 s | 130 ms | 0 | 3.1 s |

- Block 23 target "Lighthouse ≥ 95 mobile" is met on the live site. The local number is not
  representative (the dev server sends everything uncompressed); measure the live URL:
  `tools/test/lighthouse.sh https://mohamedattiadev.github.io/gym/#/train`.
- LCP element = the "Pick a plan" card text on Train (render delay, no image involved).
- Accessibility 98: the only failing audit was `heading-order` (Train "Pick a plan" / "Your plan"
  card used `<h3>` straight after the page `<h1>`). Fixed in sw v96: those cards, the
  "In progress" card and the Warm-up hero use `<h2>` with the same look (CSS covers both).
- Remaining "below 0.9" items are informational for this app: unminified CSS/JS (no build step on
  purpose; Pages gzips), unused CSS (one stylesheet for all routes), cache-insight (GitHub Pages sets
  `max-age=600`; the service worker caches the shell anyway), render-blocking app.css (needed for
  first paint). Not worth a build step.

## Visual baseline

`python3 tools/test/visual.py <routesOutDir> [--update]` compares the 80 screenshots that
`tools/test/routes.mjs` takes (20 pages × phone/desktop × light/dark) with `tools/test/baseline/`
(half-size, 16 grey levels, ~2 MB committed). A page counts as changed when > 1 % of its pixels
differ by > 40 grey levels or its height changed; diffs (red overlay) go to
`<routesOutDir>/visual-diff/`. `tools/test/all.sh` runs it right after the route test.
After an intended look change: check the diff PNGs, then `--update` and commit the baseline.
