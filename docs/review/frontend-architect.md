# Frontend + architecture review: Gym PWA

Reviewer: senior frontend engineer / architect. Date: 2026-11-17. Scope: `app/` at commit 348af78, plus uncommitted `tools/test/*`. Read-only review.

## Summary

1. The codebase is in good shape for a no-build vanilla app: 4,356 JS lines in 19 modules, none over 542 lines, 196 `esc()` calls, and a green test suite (`tools/test/all.sh` gives ALL PASS: 10 unit tests, 46 precache files, every route on phone and desktop in light and dark, 49/49 3D checks).
2. There are two **confirmed user-facing navigation bugs**, both reproduced in headless Chromium. Back after a workout traps you on `#/train` forever. A late async view paints over the page you just moved to.
3. The **service worker update path can mix app versions**. It uses `skipWaiting` + `clients.claim` + stale-while-revalidate on JS. Lazy modules can load from a newer version than `main.js`, and installs can precache stale copies from the HTTP cache.
4. **Data safety gaps:** IndexedDB write errors are swallowed and their dirty keys are lost. There is no global error handler or local log. Cloud merge has no tombstones, so things deleted on one device come back from another.
5. Architecture: `main.js` is router, shell, body map, palette, videos and shared components at once, and is the hub of 6 circular imports. Splitting out `components.js` and `bodymap.js` and adding a store change event would remove most of the coupling and make recovery, volume and progression unit-testable.

Commands used (all from the repo root unless noted): `wc -l`, `grep -n "^import|^export"`, an export-to-importer cross-grep loop, `bash tools/test/all.sh <scratch>`, two `tools/test/shot.mjs` scripts (trap.json, race.json, shown below), and Python one-liners over `data/exercises.json`.

## Findings

| ID | Title | Sev | Effort |
|---|---|---|---|
| FE-1 | Back-button trap after finishing or discarding a workout | P0 | S |
| FE-2 | Async views render into the wrong page (no route token) | P1 | S |
| FE-3 | Service worker version skew: skipWaiting + claim + SWR on JS modules | P1 | M |
| FE-4 | Precache can store stale files (HTTP cache) and SWR changes the live shell cache | P1 | S |
| FE-5 | IndexedDB write errors swallowed, dirty keys dropped | P1 | S |
| FE-6 | No global error handler and no local error log | P1 | S |
| FE-7 | Cloud merge resurrects deleted workouts, sessions and favourites | P1 | M |
| FE-8 | Offline gaps: 3D vendor (864 KB), 3D models, jeff.json, mistakes.json not precached | P1 | S |
| FE-9 | Sheet close timer can close the next sheet (190 ms race) | P1 | S |
| FE-10 | `autoPush()` must be called by hand after each save; CSV import and backup import never push | P1 | M |
| FE-11 | Deploy: `app/media` is a symlink to git-ignored `../media` (603 MB) | P1 | M |
| FE-12 | Circular imports: main.js is imported by 6 modules that it imports back | P1 | M |
| FE-13 | main.js has 6 responsibilities; proposed split | P2 | M |
| FE-14 | Pure logic is tied to the global `S`, so only calc.js has tests | P2 | M |
| FE-15 | Timer page adds an `onTick` listener on every visit | P2 | S |
| FE-16 | Library creates an IntersectionObserver per render and never disconnects it | P2 | S |
| FE-17 | Duplicated helpers have drifted apart | P2 | S |
| FE-18 | Dead code: exports, an unused 824 KB data folder, unused JSON fields | P2 | S |
| FE-19 | Unreachable i18n payload: `settings.lang` is never set | P2 | S [ASK OWNER] |
| FE-20 | `importData()` replaces everything with no automatic snapshot | P2 | S |
| FE-21 | Breakpoints are magic numbers in JS and CSS (768/820/1000/1200) | P2 | S |
| FE-22 | 213 inline `style="..."` in JS templates | P2 | M |
| FE-23 | Dead CSS classes (sample check) | P2 | S |
| FE-24 | Escaping convention is implicit | P2 | S |
| FE-25 | Update flow: toast says "reopen" but there is no reload action | P2 | S |
| FE-26 | Store fallback edge cases (localStorage path) | P2 | S |
| FE-27 | Maintainability: sw VERSION bump script, precache completeness check, CI test job | P2 | S |

---

### FE-1: Back-button trap after finishing or discarding a workout (P0, S)
**Evidence:** `train.js:225` is `const a = S.active; if (!a) return go("#/train");` and `main.js:34` is `go = (h) => location.hash = h`, which pushes a history entry. `train.js:101` (workout not found → `go("#/train")`), `guide.js:151` and `warmup.js:59` redirect the same way. Reproduced with `shot.mjs` (no active session; `#/lib` → `#/session` → `history.back()` ×3):
```
eval: "#/train len=4"   (after redirect)
eval: "#/train len=4"   (after back #1)
eval: "#/train len=4"   (after back #2)
eval: "#/train len=4"   (after back #3)
```
After finishing a workout (`train.js:494` `go("#/")`), the history stack is `… #/session, #/`. Back goes to `#/session`, which redirects to `#/train` and pushes again, so every Back press after that lands on `#/session` → `#/train`. On Android or in an installed PWA, the user cannot leave with Back.
**Fix:** add `export const redirect = (h) => location.replace(h);` in main.js and use it for every "guard" redirect (train.js:101, 225; guide.js:151; warmup.js:59). Also use `location.replace("#/")` at train.js:494 so the dead `#/session` entry is not left behind (same for Discard). Add the trap.json script to `tools/test/routes.mjs` as a regression check.

### FE-2: Async views render into the wrong page (P1, S)
**Evidence:** `main.js:59` `G()` does `import(...).then(m => m[fn](x))` with no check that the route is still current. `guide.js:36` (`startView`), `guide.js:82` (`standardsView`) and `warmup.js:54` `await` a fetch and then write `view.innerHTML`, `setTop` and `view.onclick`. Reproduced: set `#/standards` then `#/me` on the next tick, and 2 s later:
```
eval: "#/me | title=Strength goals · Gym | view=You Male Female Set weight Enter your bodyweight…"
```
The hash says Me, but the Strength goals page is shown, with its click handlers wired on the shared `#view`.
**Fix:** in `route()` do `const rid = ++routeSeq;` and export `const live = (id) => id === routeSeq`. In `G()`, check `live(rid)` before calling the view, and pass `rid` (or an `isLive()` callback) so async views return early after each `await`. Apply the same guard to `fillIll`'s callback.

### FE-3: Service worker version skew (P1, M)
**Evidence:** `sw.js:14` calls `self.skipWaiting()` on install and `sw.js:20` calls `clients.claim()`. `sw.js:78-84` serves **everything** (including `js/*.js`) stale-while-revalidate from `gym-shell-${VERSION}`. `guide.js`, `warmup.js`, `view3d.js`, `csv.js`, `share.js` and `exercise.js` are loaded with dynamic `import()` (`main.js:59`, `exercise.js:202,284`, `me.js:206`, `train.js:501,511`). When a new version installs while the app is open, the new SW takes control at once, the old `main.js` stays in memory, and the next lazy `import("./guide.js")` comes from the new cache. If an export was renamed, that throws "does not provide an export named …" and shows "Could not load." (`main.js:59`).
**Fix (pick one):** (a) recommended: drop `skipWaiting()` from install. On `updatefound` → `installed`, show a toast with a "Reload" action that posts `{type:"SKIP_WAITING"}`. In the SW, handle `message` with `self.skipWaiting()`. On the page, `navigator.serviceWorker.addEventListener("controllerchange", () => location.reload())`. (b) Minimum: keep skipWaiting but serve `js/*.js` cache-first from the versioned cache only, with no SWR, so a page always gets modules from one version.

### FE-4: Precache can store stale files, and SWR changes the live shell cache (P1, S)
**Evidence:** `sw.js:14` `c.addAll(SHELL_FILES)` uses the default fetch cache mode, so GitHub Pages' `Cache-Control: max-age=600` lets install store copies up to 10 minutes old under the new VERSION. `sw.js:81` writes every revalidated response into the *current* shell cache file by file. If a launch ends mid-way (gym signal), the next launch can run new `main.js` with old `train.js` from the same "v36" cache. `cache.put(req, …)` keys include query strings while `match` uses `ignoreSearch`, so entries pile up.
**Fix:** `c.addAll(SHELL_FILES.map((u) => new Request(u, { cache: "reload" })))`. Limit SWR to `data/*.json` and illustrations. Treat JS, CSS and `index.html` as cache-first per VERSION (a VERSION bump is the only way code changes; see FE-27). Put with `url.origin + url.pathname` as the key.

### FE-5: IndexedDB write errors swallowed, dirty keys dropped (P1, S)
**Evidence:** `store.js:64-70`: `flush()` runs `dirty.clear()` **before** the transaction, then `await tx(...)`. It is called from `setTimeout(flush,150)` (`store.js:62`), `pagehide` and `visibilitychange` (`store.js:72-73`) with no `.catch`. A failed transaction (quota exceeded, Safari "connection lost" after backgrounding) rejects with no handler, the keys are no longer dirty, and the write is never retried. The user believes the set was saved.
**Fix:** copy the keys, clear only on success, and on error re-add them, `console.error`, `toast("Couldn't save — storage full?")`, and retry once after reopening `db = await idb()` (Safari can drop the connection). Have `flush().catch(...)` everywhere it is called without `await`.

### FE-6: No global error handler and no local error log (P1, S)
**Evidence:** `grep -n "unhandledrejection\|addEventListener(\"error\"\|window.onerror" -r app/js app/index.html` finds nothing. Only `route()` has a try/catch (`main.js:51`). Errors in `view.onclick` handlers, timers and sheets fail silently on a phone with no devtools.
**Fix:** a 15-line `js/log.js` imported first by main.js. `addEventListener("error")` and `addEventListener("unhandledrejection")` push `{t, msg, stack, hash, ver}` into a ring buffer (last 50) in `localStorage["gym-log"]` and show a one-time toast "Something went wrong" per session. Settings → "Copy debug log" button. Have `tools/test/routes.mjs` assert the log is empty.

### FE-7: Cloud merge resurrects deleted items (P1, M)
**Evidence:** `sync.js:52-77` `mergeById` and `sync.js:120` favourites are unions ("Never drops records", `sync.js:103`). A merge runs on conflict (`sync.js:291` `c.sha = null; return pushOnce(...)`), on the first push from a device (`sync.js:276-281`) and on restore (`sync.js:322`). Device B deletes a workout or un-favourites an exercise and pushes. Device A, with a stale sha, pushes, gets a conflict, merges, and the deleted item is back on both devices.
**Fix:** record deletions as tombstones: `S.deleted = { workouts: {id: ts}, sessions: {id: ts}, favorites: {slug: ts} }`, written wherever records are removed (train.js workout delete, toggleFav, session delete in me.js). In `merge`, drop any record whose tombstone is newer than its `stamp()`, and union the tombstone maps. Expire tombstones older than 180 days. Add unit tests in `tools/test/unit/sync.test.mjs` (merge is already pure and exported).

### FE-8: Offline gaps in the precache (P1, S)
**Evidence:** `sw.js:6-12` precaches 46 files. Missing: `vendor/three/*.js` (864 KB, needed by `view3d.js:4-6`), `3d/body.glb`, `3d/anim/*`, `3d/poses/*` (2.9 MB), `data/jeff.json` (`exercise.js:336`), `data/mistakes.json` (`exercise.js:298`). All are fetched only on first use online, so the 3D viewer, "Jeff's ranking moment" and "Show mistake" fail if first opened offline. `all.sh` checks only that listed files exist, not that every runtime fetch is listed.
**Fix:** add `vendor/three/{three.module,GLTFLoader,BufferGeometryUtils,meshopt_decoder.module}.js`, `data/jeff.json`, `data/mistakes.json` and `3d/body.glb` to SHELL_FILES. Put animations in a separate non-blocking "warm" step (`cache.addAll` after activate, errors ignored). Extend the all.sh precache step to grep `fetch("…")` and `import("…")` literals in app/js and fail when one is not in SHELL_FILES or an allowlist.

### FE-9: Sheet close timer can close the next sheet (P1, S)
**Evidence:** `ui.js:93-96`: `closeSheet()` runs `setTimeout(() => d.close(), 190)` and the timer is never cancelled. `openSheet()` (`ui.js:84-91`) removes `.closing` but cannot stop that timer, so any open within 190 ms of a close is closed right away. `dialogP` (`ui.js:109-115`) resolves on the next `close` event, so a stale timer also resolves a fresh `ask()` as Cancel. Today it is hit by chained flows such as palette → open, and finish-workout `go("#/")` plus hashchange `closeSheet()` (`main.js:57`) with the summary sheet opened in a `setTimeout` (`train.js:495`, safe only because its delay is longer than 190 ms).
**Fix:** `let closeT; closeSheet(){ clearTimeout(closeT); closeT = setTimeout(...) }` and `openSheet(){ clearTimeout(closeT); ... }`.

### FE-10: autoPush is manual and easy to forget (P1, M)
**Evidence:** `sync.js:329` says "Call after every save() of user data". The counts are 61 `save(` calls against 18 `autoPush` calls. `csv.js:134` (CSV import of whole history) and `me.js:216` (`importData`) do not push, so the cloud copy stays stale until some unrelated edit happens. `guide.js:136` (profile `upd`) does not push either.
**Fix:** inside `store.js`, add `const subs = new Set(); export const onSave = (fn) => subs.add(fn);` and call `subs.forEach(fn => fn(keys))` in `save()`. In `sync.initSync()`, `onSave((k) => k.some(x => x !== "active" && x !== "sync") && autoPush())`. Then delete the 18 manual calls and `train.js:12`'s `store` wrapper. This also removes the `train → sync` and `main → sync` imports.

### FE-11: Deploy cannot ship media (P1, M; known in PLAN.md §8)
**Evidence:** `.github/workflows/pages.yml` uploads `path: app`. `app/media -> ../media` (symlink), `.gitignore:10 /media/`, `du -sh media` = 603M, and `git ls-files app | grep -c ^app/media` = 0. On Pages, all posters and videos return 404. Also, 603 MB is near the Pages 1 GB soft limit, and a "Download all" puts about 600 MB into Cache Storage, which Safari can evict.
**Fix:** decide on hosting before the public push. Option one: commit compressed posters (small) and host videos on a separate Pages repo or Releases CDN under a `MEDIA_BASE` constant. Option two: Git LFS is **not** served by Pages, so avoid it. Add a check to all.sh that a sample poster URL returns 200 on the deployed URL. [ASK OWNER] on hosting choice.

### FE-12: Circular imports through main.js (P1, M)
**Evidence:** main.js imports train, home, exercise, me (`main.js:6-9`), and `home.js:6`, `exercise.js:8`, `me.js:7`, `train.js:6`, `guide.js:6` and `warmup.js:8` import back from main.js. `exercise.js:9` also imports train.js, while train.js loads exercise.js lazily (`train.js:511`). It works only because every cross use happens inside functions. One top-level `const x = tierBadge(...)` or `MEDIA_CACHE` read at module eval in a child throws a TDZ ReferenceError and gives a white screen. That kind of error is easy to introduce and hard to diagnose.
**Fix:** move the leaf helpers out of main.js into `js/components.js` (`tierBadge`, `TIER_INFO`, `tierInfo`, `levelBars`, `xcard`, `onImg`, `isFav`, `toggleFav`, `restText`, `JEFF_VID`, `fillIll`) and `js/nav.js` (`go`, `redirect`, `routeParts`, `setTop`). Views import those instead of main.js. main.js then imports views and nothing imports main.js. Add an all.sh check: `grep -l 'from "./main.js"' app/js/*.js` must be empty.

### FE-13: main.js has 6 responsibilities (P2, M)
**Evidence:** `main.js` (401 lines) holds splash (14-26), router (31-59), top bar/scroll (62-74), illustrations (77-83), theme (86-93), keyboard and the Cmd+K palette (96-133), shared cards (136-163), install (166-200), the body map (201-358, the largest part) and videos (360-385). Other sizes: train.js 542, exercise.js 417, main.js 401, view3d.js 370, sync.js 367, me.js 301; nothing is alarming.
**Fix:** `main.js` (boot + router only, about 90 lines), `nav.js`, `components.js` (FE-12), `bodymap.js` (201-358, lazy-loadable like guide), `palette.js` (lazy on first Cmd+K), `install.js`, `videos.js`. No behaviour change. Split `train.js` later along its existing seams: `plans.js` (PLANS, buildPlan, plateauAdjust, stalledWeeks: pure), `session.js` (sessionView/wireSession/side), `train.js` (list + workout editor).

### FE-14: Pure logic is tied to the global S (P2, M)
**Evidence:** only `calc.js` has tests (`tools/test/unit/calc.test.mjs`, 10 tests), and they need DOM stubs because `calc.js:2` imports `S` from `store.js`, which registers listeners at import (`store.js:72-73`). `data.js:184 recovery()`, `data.js:223 weeklyVolume()`, `data.js:162 periodStats()`, `train.js:159 stalledWeeks()`, `train.js plateauAdjust()`, `calc.js:49 suggest()` and `data.js:73 searchEx()` all read `S.sessions` or `S.settings` directly.
**Fix:** take inputs as arguments with defaults, for example `recovery(sessions = S.sessions, now = Date.now(), by = BY)` and `suggest(ex, last, { plates, bar })`. Move them into `js/logic/{recovery,volume,progression,search}.js` with no store or DOM import. Tests to add: `recovery.test.mjs` (24/48/72 h windows, secondary 0.5 weight), `volume.test.mjs`, `progression.test.mjs` (stall detection, plateau deload), `search.test.mjs` (Turkish ı, Arabic alef forms, typo tolerance), `sync.test.mjs` (merge, tombstones, b64 round-trip). Move the `addEventListener` lines in store.js into an `initStore()` call so Node imports are clean.

### FE-15: Timer page adds an onTick listener on every visit (P2, S)
**Evidence:** `timer.js:174` `const off = onTick(...)` removes itself only inside a tick (`timer.js:175`), and ticks run only while a timer runs (`timer.js:15`). Opening `#/timer` N times while idle adds N listeners. Later, every one of them calls `draw()` on each state change, because `root` is the shared `#view` and is always connected.
**Fix:** keep the unsubscribe at module level: `let offTimer; … offTimer?.(); offTimer = onTick(...)`, or unsubscribe in the hashchange handler at `timer.js:103`. More generally, have `route()` call a `cleanup` function that the previous view returns (`const c = fn(b); lastCleanup = typeof c === "function" ? c : null`). That one pattern covers timers, observers and `onTick`.

### FE-16: Library IntersectionObserver never disconnected (P2, S)
**Evidence:** `exercise.js:46` `new IntersectionObserver(...).observe($("#sentinel"))` runs on every `libraryView()`, with no reference kept. It is probably garbage-collected with the detached node, but on desktop, where the 2-pane `keep` path is used (`main.js:42`), the observer's `root` pane stays alive.
**Fix:** keep it in module scope and `io?.disconnect()` before creating a new one, or return it through the cleanup hook from FE-15.

### FE-17: Duplicated helpers have drifted apart (P2, S)
**Evidence:**
- `onImg` is defined twice. `main.js:156` hides on error; `ui.js:192` removes the element and is never imported (dead).
- The language helper is copied 4 times with **different** fallbacks: `guide.js:11` and `warmup.js:12` use `o ?? ""`, while `exercise.js:14` and `main.js:202` use `o || ""`.
- The `NOVEL` regex is defined twice and has diverged: `csv.js:52` vs `exercise.js:159`. exercise.js includes `1\.5`, `1 ?¼` and `iso(metric)?`; csv.js does not.
- `wide()` means 820 in `main.js:213` and 1000 in `exercise.js:13`.
- `"gym-media-v1"` appears in `main.js:29` and `sw.js:5`, which must stay in sync.
- `864e5` is used 4 times instead of `DAY` from data.js.

**Fix:** keep one `onImg` (in components.js) and delete `ui.js:192-197`. Export `L()` from `ui.js`. Export `NOVEL` from data.js and use it in both places. Name the widths (FE-21). Add a comment in sw.js pointing to `MEDIA_CACHE` and an all.sh grep check that both strings match.

### FE-18: Dead code (P2, S)
**Evidence (export → importer cross-grep, then usage grep):**
- Never used anywhere: `timer.js:107 showOverlay`, `main.js:58 rerender`, `ui.js:192 onImg`.
- Exported but used only in their own module (fine for tests; otherwise drop `export`): `calc.roundTo/smallestPlate`, `train.buildPlan/stalledWeeks/restOf/startRest/stopRest/plateSheet`, `timer.fmtMs/startStopwatch/startIntervals/lap`, `media.enabled/disengage`, `share.renderSession`, `main.TIER_INFO/exercisesFor/headOf`, `data.GROUP_ORDER/BALANCE_MUSCLES`, `guide.pickPlan`, `warmup.buildFor`, `sync.onStatus`, `exercise.move3d`, `view3d.VIEWS`. `view3d.qa3d` is used by `tools/test/check3d.mjs`, so keep it.
- **`app/data/content/` (824 KB, 4 files) is never fetched by any app file** (`grep -rn "content/" app/js app/sw.js` finds nothing). Only `tools/merge_content.py` reads it, so it is build input that ships to users.
- `exercises.json` field `each_side` (51 entries) is never read by app/js (written by `tools/build_data.py:87`).
- `js/SYNC.md` is shipped inside the deployed folder.

**Fix:** delete `showOverlay`, `rerender` and `ui.onImg`. Move `app/data/content/` to `tools/content/` (or `raw/`) and update `merge_content.py`. Drop `each_side` in build_data.py or use it (show "each side" on set rows). Move `SYNC.md` to `docs/`.

### FE-19: Unreachable i18n payload (P2, S) [ASK OWNER]
**Evidence:** `settings.lang` is read in 5 places (`data.js:92`, `guide.js:11`, `warmup.js:12`, `exercise.js:14`, `main.js:202`) but never written (`grep -rn "settings.lang *=" app/js` finds nothing; there is no Settings control). `families.ar.json` (276 KB) and `families.tr.json` (208 KB) are therefore never loaded. `exercises.json` carries `tr`/`ar` names on all 842 entries (about 39 KB), and they serve only as search aliases. 46 `ar` and 53 `tr` values are just the English name copied.
**Fix:** either add a Language setting (feature decision) or leave the files out of the deploy until then. In `build_data.py`, drop `tr`/`ar` values that equal `name`.

### FE-20: importData replaces everything with no snapshot (P2, S)
**Evidence:** `store.js:85-92` overwrites all user data. `me.js:216` relies on a single "Replace" confirmation. A wrong file (an old backup, someone else's backup) is unrecoverable unless cloud sync was on.
**Fix:** before `Object.assign`, write `exportData()` to IndexedDB key `preImport` (one slot). Show a toast with an "Undo" action (toast already supports actions, `ui.js:136`) that restores it.

### FE-21: Breakpoints are magic numbers (P2, S)
**Evidence:** `grep -on "innerWidth…|(min/max-width…px)"` gives 768 ×15, 1000 ×9, 1200 ×3, 820 ×3, plus 480, 700, 900 and 1100 once each, split across JS and CSS.
**Fix:** `export const BP = { tablet: 768, wide: 1000, xl: 1200 }` in ui.js, with JS using `matchMedia` constants (like `train.js` WIDE). Comment the same values at the top of app.css. Settle on 768/1000/1200 and fold 820 into 768 or 1000 [ASK OWNER] (layout change at iPad widths).

### FE-22: 213 inline style attributes in JS (P2, M)
**Evidence:** `grep -o 'style="' app/js/*.js | wc -l` = 213, for example `main.js:376-378` and `train.js:495`. This works against block 28 (visual de-slop): spacing and colours live in JS strings instead of tokens.
**Fix:** during block 28, move repeated ones (`margin-top:16px`, `text-align:center`, `max-width:150px`) into utility classes (`.mt-16`, `.center`, `.ill-sm`). Do it file by file, with a route screenshot diff from `routes.mjs` for each.

### FE-23: Dead CSS (P2, S)
**Evidence:** app.css is 893 lines and 83.7 KB (about 94 chars per line, dense). Of 360 class selectors, these are not referenced in js, index.html or illustrations: `avatar`, `clamp1`, `facts`, `hr`, `opt`, `spark`. `l1`/`l3` are false positives built as `l${n}`. Only 10 `!important`. Logical properties are already dominant (64 logical vs 6 physical), which is good for future RTL.
**Fix:** delete the 6 rules and convert the 6 remaining physical `left/right` declarations to `inset-inline-*` or `margin-inline-*`.

### FE-24: Escaping convention is implicit (P2, S)
**Evidence:** 74 `innerHTML =` and 3 `insertAdjacentHTML`, with 196 `esc()`. All user strings checked are escaped or go through `ask`/`toast` (which escape or use textContent). Bundled JSON is interpolated raw, for example `xcard` `src="${e.poster}"` and `data-slug="${e.slug}"` (`main.js:150-152`) and plan names `train.js:74,89`. This is safe today, but nothing stops a future user-editable field (custom exercises, plan names) from slipping through.
**Fix:** write the rule at the top of ui.js: "esc() every value that is not a number or a bundled constant". Add a lint-style grep in all.sh that flags `${…name}`/`${…note}` inside template strings with no `esc(` on the same expression (allowlist file).

### FE-25: Update flow has no reload action (P2, S)
**Evidence:** `main.js:396` shows `toast("Update ready — reopen the app", 4000)`. Because of skipWaiting, the new SW already controls the page by then (see FE-3), and there is no `controllerchange` handling.
**Fix:** part of FE-3(a): `toast("New version ready", 8000, { label: "Reload", fn: () => reg.waiting?.postMessage({type:"SKIP_WAITING"}) })` plus a `controllerchange` → `location.reload()` guarded by a `reloading` flag. Do not reload while `S.active` is mid-set without asking.

### FE-26: Store fallback edge cases (P2, S)
**Evidence:** `store.js:38`: in the localStorage fallback, `Object.assign(S, parsed)` replaces `settings` wholesale, so new default settings are missing. `store.js:67` writes the whole `S`, **including `S.sync.token`**, to localStorage. `importData` (`store.js:85`) does not check `j.schema > SCHEMA` (a backup from a newer app version).
**Fix:** reuse the `settings` defaults merge on the fallback path. Strip `sync.token` from the localStorage copy (keep the token in a separate key if it must persist). Reject or warn when `j.schema > SCHEMA`.

### FE-27: Maintainability tooling (P2, S)
**Evidence:** `VERSION = "v36"` is bumped by hand (`sw.js:3`), and a forgotten bump means users keep old code until SWR catches up. `.github/workflows/pages.yml` deploys on push with no test gate. Docs are reasonable: README 35 lines, PLAN 280, SYNC.md 54. There is no CONTRIBUTING or conventions section.
**Fix:**
- `tools/bump-sw.sh`: compute `sha1sum` of all SHELL_FILES plus lazy modules, write the first 8 chars into `VERSION`, and have all.sh fail if `git diff --name-only HEAD -- app/` is non-empty but `VERSION` is unchanged.
- Add a `test` job to pages.yml and make `deploy: needs: test`: `actions/setup-node@v4` (node 22), `sudo apt-get install -y chromium` (shot.mjs spawns `chromium`), then `bash tools/test/all.sh /tmp/gym-all`.
- Add a short "Conventions" section to README: module roles, the esc rule, the redirect vs go rule, the view cleanup hook, and the VERSION bump.

## What is already good (no action)
- Small focused modules, lazy loading for heavy features (`view3d`, `guide`, `warmup`, `csv`, `share`).
- Debounced dirty-key IDB persistence with flush on `pagehide`/`visibilitychange`.
- The media SW path with Range support and a stable media cache name that survives updates.
- The token leak guard before upload (`sync.js:284`).
- Theme pre-paint script in index.html.
- `RM` reduced-motion handling.
- view3d disposes its ResizeObserver, IntersectionObserver, rAF loop and listeners (`view3d.js:307`).
- A real route smoke test.
