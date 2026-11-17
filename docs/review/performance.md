# Performance review: Gym PWA

Reviewed 2026-11-17 at commit `348af78` (sw `v36`). Read-only review: no app code was changed.
Device target: a mid-range Android phone. Emulated as Chromium 151 headless, 390x844 @3x, **CPU throttled 4x** (`Emulation.setCPUThrottlingRate 4`), with WebGL on SwiftShader.

Scripts and raw output are in `/home/ati/tmp/claude-1000/-home-ati-Attia-Pro-Projects-gym-y/dc8f548e-5a93-4efa-83c3-914e65e7aff4/scratchpad/perf/`:
- `cdp.mjs`: CDP helper plus injected PerformanceObservers (longtask, layout-shift, LCP) and a WebGL context counter.
- `boot.mjs`: per-page boot timings.
- `prof.mjs`: CPU profile of boot.
- `leak.mjs`: heap, DOM nodes, listeners and WebGL contexts across 80 routes and 30 3D mounts.
- `misc.mjs` and `libprof.mjs`: library search, scroll, trace.
- `d3.mjs`: 3D mount profile.
- `css.mjs`: selector-match estimate.
- `vid.mjs`: video start test.

Lighthouse is not installed and there is no network, so it was not run.

Caveats:
- The server is local `python3 -m http.server`, which does not compress. Production is GitHub Pages, which serves gzip, so gzip sizes are quoted.
- CDP network throttling does **not** apply to fetches made inside the service worker. Video-start numbers under a slow network are therefore **computed** from file sizes.
- SwiftShader exaggerates GPU-side costs such as `forceContextLoss` and `getImageData` readback. Treat 3D numbers as relative, not absolute.

## Key numbers

### Shipped bytes (`stat` + `gzip -9c | wc -c`)

| Group | Files | Raw | gzip -9 | When loaded |
|---|---|---|---|---|
| JS (all 19 modules) | `app/js/*.js` | 361 KB | 127 KB | — |
| JS on the boot critical path (static import graph from main.js, 14 modules) | main, ui, store, data, calc, body, anatomy, train, timer, sync, home, exercise, me, media | 276 KB | 96 KB | every boot (13 are modulepreloaded; `media.js` is not) |
| JS lazy (dynamic `import()`) | guide, warmup, view3d, csv, share | 84 KB | 31 KB | on demand (all precached) |
| CSS | `css/app.css` | 82 KB | 17.5 KB | render-blocking |
| Font | `fonts/Inter.woff2` (variable) | 64 KB | 64 KB | preloaded |
| Boot JSON | exercises 397 K, families.en 200 K, joints 24 K, figures 17 K | 638 KB | 98 KB | every boot (`data.js:95`) |
| Lazy JSON | heads 46 K, warmups 35 K, plans/nutrition/... 48 K, jeff 15 K | ~145 KB | ~45 KB | on demand |
| **Unused JSON** | `data/content/*.json` (4 files) | **835 KB** | 179 KB | never referenced by the runtime |
| three.js r170 + GLTFLoader + meshopt + BufferGeometryUtils + body.glb | vendor/three, 3d | 1109 KB | 355 KB | first 3D view, **not precached** |
| 3D animations | 3d/anim/*.glb (~100 KB each), 3d/poses | 2.9 MB dir | ~19 KB each gz | per exercise in 3D |
| SW precache (`SHELL_FILES`, 46 entries) | | 1310 KB | 359 KB | install |
| Media (not in git) | posters 832 x avg 24 KB (480² baseline JPEG); videos 832 x avg 672 KB (720² h264 ~360 kbps, moov at front); figures 223 x avg 104 KB (animated WebP); clips 19 x 1.3 MB | 604 MB total | — | lazy, cached on first view |

### JSON.parse cost (node, 20-run average, desktop CPU; multiply by ~4–6 for a phone)

`exercises.json` takes 3.6 ms, `families.en.json` 1.05 ms, and `families.ar.json` 1.05 ms. Everything else is under 0.2 ms. **Parsing is not a bottleneck.** The post-parse loop is the real cost (see PERF-8).

### Boot per page (`boot.mjs`, 4x CPU, phone viewport)

"Cold" means a fresh profile and the first visit. "Warm" means the service worker is controlling and every file comes from the SW cache (0 KB transferred). All times are ms. A fresh profile also triggers the "first open of the day" splash, which is held for at least 1200 ms.

| Page | FCP cold / warm | LCP cold / warm | LCP element | CLS | Long tasks cold (count / total / max) | Long tasks warm |
|---|---|---|---|---|---|---|
| Home `#/` | 1432 / 1776 | 1432 / 3288 | text div | 0 | 5 / 736 / 294 | 6 / 602 / 201 |
| Library `#/lib` | 896 / 1136 | 4304 / 3504 | first poster (fades in) | 0 | 5 / 643 / 180 | 7 / 793 / 224 |
| Exercise `#/ex/...` | 1032 / 520 | 3892 / 2400 | blurred `img.hbg` poster | 0 | 5 / 842 / 266 | 2 / 328 / 209 |
| Body `#/body` | 1584 / 452 | 3828 / 2716 | text div | 0 | 3 / 382 / 181 | 3 / 371 / 208 |
| Train `#/train` | 756 / 400 | 4016 / 1056 | h1 / text | 0 | 3 / 335 / 154 | 3 / 417 / 219 |

Warm Home boot **with the daily splash suppressed** (`prof.mjs`):
- First paint is 212 ms.
- `#view` is populated at **542 ms**.
- LCP is 1548 ms. The 220 ms `pageIn` fade plus the splash fade delay it.
- There are 2 long tasks, 145 ms and 83 ms.

Top main-thread self time at boot: `route` 91 ms, `norm` (search index) 74 ms, `loadExercises` 44 ms, JSON 17 ms.

### Interaction and runtime (4x CPU)

| Scenario | Result |
|---|---|
| Library: scroll to the end (60 x 1500 px) | 720 cards, **11 081 DOM nodes**, **61 long tasks, max 723 ms**. Trace over 40 steps: Layout 1760 ms, Paint 1093 ms, Style 1014 ms, Layerize 551 ms, image decode ~630 ms |
| Library: search keystroke to paint (after the 120 ms debounce) | 173 / 190 / 174 / 267 ms |
| 3D: first mount (three.js + body.glb from network) | 6012 ms to canvas (SwiftShader) |
| 3D: next exercise (new WebGL context) | 1256 ms to canvas; long tasks 944 / 1584 / 1090 ms per mount |
| 3D: idle while paused | rAF still fires at 60 per second |
| Heap after 20 / 40 / 80 route changes | 3.3 → 3.7 → 3.7 → 3.9 MB; listeners 37 → 42 → 42 → 42; nodes flat. **No leak** |
| WebGL across 30 3D exercise navigations | 31 contexts created, **only 1 canvas alive**, heap 9.0 → 9.5 MB. **Disposal works**, but a new context is created every time |

## Findings

Severity: P0 means users feel it badly, a leak, or something broken. Effort: S, M or L. Findings marked **[ASK OWNER]** change the look or remove a feature.

### PERF-1 (P0, S): Service worker holds every uncached video until the whole file has downloaded and been written to the cache
**Evidence:**
- `sw.js:58-75`: on a cache miss it runs `await fetch(key)` (full file, Range header stripped), then `await cache.put(...)`, and only then builds a 206 response from `arrayBuffer()`.
- Videos are faststart (`ftyp, moov, ...` at the head; checked on 5 random files), so the browser could start playing after about 100 KB. Instead the first frame waits for the full download.
- Average video is 672 KB, p95 is 1.10 MB, max is 1.68 MB. On a weak gym signal (1.6 Mbps, 150 ms RTT) that is **≈3.5 s on average and ≈8.5 s at worst** before the demo starts, against ≈0.6 s for progressive playback. These numbers are computed; CDP cannot throttle SW fetches.
- This hits the first view of every exercise, which is the core use of the app.
- `rangeResponse` also loads the whole file into memory on every Range request.

**Fix:** on a miss, return the network response straight away and cache in the background:
```js
if (!hit) { e.waitUntil(fetch(key).then(r => r.ok && cache.put(key, r)).catch(() => {}));
            return fetch(req).catch(() => new Response("", { status: 504 })); }
```
- Keep `rangeResponse` for cache hits only.
- Optionally cache only after `playing` fires, so swiping past a video does not download it.

### PERF-2 (P1, S): Library list grows without bound and has no `content-visibility`, so scrolling janks
**Evidence:**
- `exercise.js:37-46` appends 40 cards per sentinel hit and never trims. A full scroll reaches 720 cards and 11 081 nodes, with 61 long tasks up to 723 ms at 4x.
- The trace is dominated by Layout (1.76 s), Paint (1.09 s) and Style (1.01 s), not JS.
- Each `more()` re-runs `onImg(grid)` over **every** image (`main.js:156`) and `markCur` over **every** card (`exercise.js:66`), which is O(n²).
- The scroll listener (`main.js:69-72`) reads `document.documentElement.scrollHeight` on every event, which forces layout right after `insertAdjacentHTML`, and toggles a class on `<body>`.

**Fix:**
- Add `.xcard{content-visibility:auto;contain-intrinsic-size:auto 236px}` (measure the real card height). This does not change the look.
- In `more()`, call `onImg` only on the new cards (e.g. insert into a `<template>`, run `onImg(frag)`, then append), and call `markCur` only once in `refresh()`.
- rAF-throttle the scroll handler and only read `scrollHeight` when `dy > 0 && scrollY > 120`.

### PERF-3 (P1, M): 3D creates a new WebGL context and recomputes everything for every exercise
**Evidence:**
- `view3d.js:262` runs `new THREE.WebGLRenderer` on every mount, and `dispose()` (`:306-309`) calls `forceContextLoss`. That made 31 contexts over 30 navigations.
- Per-mount profile (`d3.mjs`, 3 remounts):

  | Item | Cost per mount |
  |---|---|
  | `forceContextLoss` | 449 ms |
  | `getImageData` (`cssColor`, `view3d.js:188-191`, a 1x1 2D canvas readback called 3x per paint) | **413 ms** |
  | `paint()` muscle diffusion (4 passes over all vertices x2) | 207 ms |
  | `getContext` and shader compile | 201 ms |

- Long tasks of 0.9 to 1.6 s per exercise switch. SwiftShader inflates the GPU parts, but a context and program compile per page is costly on Mali/Adreno too, and Android caps live contexts at about 8–16.

**Fix:**
- Keep one module-level renderer and canvas. On mount, move `renderer.domElement` into the new box, and on dispose detach it and stop the loop. Do not call `forceContextLoss`; only do so on `pagehide`.
- Memoise `cssColor` per theme (`Map` keyed by theme and string), or resolve once with `getComputedStyle` and `THREE.Color.setStyle`.
- Cache painted color/glow buffers by `primary|secondary|theme` key, which repeats across exercises of the same family.

### PERF-4 (P1, S): 3D assets are not precached and sit in the versioned shell cache, which is wiped on every release
**Evidence:**
- `SHELL_FILES` (`sw.js:6-11`) includes `js/view3d.js` but not `vendor/three/*`, `3d/body.glb` or `3d/anim/*`.
- These get stored by the generic SWR handler (`sw.js:79-85`) into `gym-shell-v36`, which `activate` deletes on the next version bump (`sw.js:18-21`).
- As a result, **3D fails offline** until it has been opened online once after each update, and every release forces 1109 KB raw / 355 KB gz to download again, plus every visited animation.

**Fix:**
- Route `/vendor/` and `/3d/` to a stable cache-first cache named after the three revision (e.g. `gym-3d-r170`) that is not deleted on shell bumps.
- Optionally warm it (`three`, `GLTFLoader`, `meshopt`, `BufferGeometryUtils`, `body.glb`) the first time a user opens 3D, or from "Download all".

### PERF-5 (P1, S): The update strategy can mix code versions in one session
**Evidence:**
- `install` calls `skipWaiting()` (`sw.js:15`), and `activate` claims clients and deletes the old cache.
- Pages already running old `main.js` then lazily `import()` `guide.js`, `warmup.js`, `view3d.js`, `csv.js` and `share.js` from the **new** cache.
- Within one version, per-file SWR (`sw.js:83`) can also leave the cache half-updated if the app is closed mid-revalidate.
- The result can be broken named imports after a deploy. The "Update ready — reopen" toast (`main.js:397`) suggests the intent was an atomic update.

**Fix:**
- Drop `skipWaiting()` from `install`. Send `postMessage('skip')` from the "Update ready" toast and reload on `controllerchange`.
- Serve the shell **cache-first** from the versioned cache (the version bump is the freshness signal).
- Keep SWR only for `data/*.json` if data should refresh between releases.

### PERF-6 (P2, M): Opportunistic media cache has no cap or eviction
**Evidence:**
- Every viewed video, poster, figure and clip goes into `gym-media-v1` permanently (`sw.js:58-66`). The full set is about 604 MB.
- One scroll through the library caches 225 posters (≈5.4 MB) via lazy images.
- `persist()` is only requested after the first saved session, on install, or on "Download all" (`train.js:492`, `main.js:183`, `me.js:291`). Before that, origin eviction would also delete the IndexedDB workout data.

**Fix:**
- Cap the opportunistic cache: an LRU of about 150 videos or about 150 MB, tracked in a small IndexedDB or cache-key list.
- Exempt files fetched by "Download all".
- Request `persist()` at the first write of user data (the first logged set or a favourite).

### PERF-7 (P2, M): The boot loads every view module eagerly
**Evidence:**
- `main.js:2-12` statically imports `me.js` (29 KB), `exercise.js` (40 KB), `sync.js` (17 KB) and others, and index.html modulepreloads 13 modules.
- 276 KB raw / 96 KB gz of JS is parsed on every boot, although Home needs about half of it. The rest is already lazy for guide, warmup and view3d through `G()` (`main.js:59`).

**Fix:**
- Use the existing `G(fn, mod)` pattern for `meView`/`settingsView` (me.js) and `libraryView`/`exerciseView` (exercise.js).
- Import `sync.js` after the first route, in idle time.
- Remove them from modulepreload.

Code cache softens the gain on repeat visits; expect roughly 30–60 ms less boot work at 4x.

### PERF-8 (P2, S): The search index is rebuilt on every boot
**Evidence:**
- `data.js:105` builds `e._q = norm([...])` for all 842 exercises before the first route.
- Self time at 4x: `norm` 74 ms plus the `loadExercises` loop 44 ms, about 120 ms on the critical path, which is the largest JS item after `route`.

**Fix:** build `_q` lazily on the first `searchEx`/library filter call, or in `requestIdleCallback` after `route()`.

### PERF-9 (P2, S): Boot JSON carries fields that are not needed at boot; non-English users download the English families file for nothing
**Evidence:**
- In `exercises.json` (397 KB), `tierNote` is 42 KB, `ar` 25 KB, `tr` 21 KB and `tierVideo` 18 KB. That is about 106 KB (27%) used only on the exercise page or for search in other languages.
- `index.html:36` always preloads `families.en.json` (200 KB / 47 KB gz).
- Arabic and Turkish users then also fetch `families.ar.json` (279 KB) or `families.tr.json` (210 KB). Those files are not precached, so after a release they fall back to English offline (`data.js:95`).

**Fix:**
- Move `ar`/`tr` aliases into `families.{lang}.json`.
- Choose the families preload in the inline `<head>` script from the stored language.
- Precache, or cache-first, the active language file.

### PERF-10 (P2, S): The first open of each day holds the splash for at least 1.2 s [ASK OWNER]
**Evidence:** `main.js:17-19` sets `SPLASH_MIN=1200` once per day. The view is ready at about 540 ms (warm, 4x), so the first launch of a gym day shows content about 700 ms later than it could.
**Fix:** hide the splash as soon as `route()` has run, and keep the full animation only for the very first install.

### PERF-11 (P2, S): The 3D render loop wakes every frame even when nothing changes
**Evidence:** `view3d.js:291-301` reschedules `loop()` whenever the canvas is visible, even when it is paused and idle, measured at 60 rAF per second. Rendering is skipped, but the main thread never idles (battery).
**Fix:** reschedule only while `dirty`, an animation is playing, or yaw/zoom is easing. `setView`, `togglePlay` and input handlers already call `loop()`.

### PERF-12 (P2, S): Expensive GPU effects on scrolling surfaces [ASK OWNER]
**Evidence:**
- `backdrop-filter: blur(20px) saturate(...)` on the fixed topbar and bottom nav (`app.css:66`, `:90`).
- `filter: blur(22px)` on an oversized poster behind every exercise hero and the session side panel (`app.css:864`), and that blurred poster is the LCP element on the exercise page.
- Multi-shadow `--raise-sm` on every card (`app.css:251`).
- The library scroll trace shows Paint 1.09 s plus Layerize 0.55 s.

**Fix:**
- Swap backdrop blur for an opaque `var(--bg)` at 92–96% alpha.
- Use a pre-blurred tiny poster (e.g. a 24 px version scaled up), or a flat colour, for the letterbox.
- Use a single soft shadow or a border on cards. This fits with planned block 28, the "visual de-slop".

### PERF-13 (P2, M): Posters are baseline JPEG
**Evidence:** 832 files, 480x480, average 24 KB, 21 MB in total. A full library scroll loads about 5.4 MB of posters.
**Fix:** re-encode to WebP at q≈75 (expect 25–35% smaller at the same look). Change the extension in `e.poster` (`data.js:98`) and in the hard-coded `media/poster/*.jpg` path in `timer.js:119`. GitHub Pages cannot do content negotiation, so the files must be renamed. Keep the 480 px size, which fits 3x DPR at about 160 css px.

### PERF-14 (P2, S): 835 KB of unused JSON is deployed
**Evidence:** `app/data/content/*.json` (back-biceps, chest-triceps, legs-abs, shoulders-traps-forearms) has no reference in `app/js` (grep `content/` finds nothing). It ships in the Pages artifact.
**Fix:** move it out of `app/`, for example to `tools/data/` or `raw/`.

### PERF-15 (P2, S): Smaller loading nits
- `media.js` is statically imported by `main.js` but missing from the modulepreload list (initiator `script`, discovered late). Add `<link rel="modulepreload" href="js/media.js">`.
- `fitHero`'s extra `new Image()` (`exercise.js:250`) reuses the hero poster URL, so it costs no extra request. No action.
- Library search costs 170–270 ms per keystroke at 4x (rebuilds 40 cards). It will improve with PERF-2. Optionally reuse existing card nodes keyed by slug.

### PERF-16 (P2, S): CSS is render-blocking with about 57% unmatched rules (upper bound)
**Evidence:**
- Selector-match sweep over 15 phone routes (`css.mjs`): 791 style rules, of which 304 matched. That covers 32.7 KB of 76.7 KB of rule text.
- The sweep excludes desktop/iPad media queries, sheets, dialogs and session states, so real unused CSS is lower.
- Size is 17.5 KB gz.

**Fix:** no split recommended; the gain is under 10 KB gz. Simply remove dead selectors during the block 28 de-slop.

## Checked and OK (no action)
- **No memory leaks.** Heap 3.3 → 3.9 MB, listeners 37 → 42 (flat after the first visit to each view) and DOM nodes flat over 80 route changes.
- **No WebGL context leak.** Only 1 canvas stays alive and the 3D heap stays flat (9.0 → 9.5 MB over 30 mounts). The `ResizeObserver`, `IntersectionObserver` and `visibilitychange` listener in view3d are all removed in `dispose`.
- Library `IntersectionObserver` (`exercise.js:46`) is never disconnected, but it is garbage-collected with its detached sentinel (heap stays flat). Optional tidy-up only.
- **three.js loads only on demand**, through `import("./view3d.js")` at `exercise.js:284`.
- **CLS is 0** on every measured page. Card images sit in fixed `aspect-ratio` boxes.
- Library posters use `loading="lazy" decoding="async"` and pages of 40 cards.
- Videos are faststart. The exercise page uses `preload="auto"`, which is correct for the main content. Session and warm-up videos use `preload="metadata"`.
- The font is a single 64 KB variable woff2, preloaded, with `font-display: swap`.
- Exercise and family JSON are preloaded and the preload is reused (one request each).
- The timer interval (200 ms) is cleared on stop. The session clock clears itself when `#clock` is gone (`train.js:243`).
- The silent audio loop in `media.js` is intentional (lock-screen timer) and stops on disengage.
