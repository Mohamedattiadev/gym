# Gym — Master Plan

Personal offline gym guide (PWA). **App name: "Gym"** (not Gym-Y). Public GitHub Pages: **https://mohamedattiadev.github.io/gym** (repo `gym`).
Owner: Mohamed Attia (GitHub `Mohamedattiadev`). Exercise tiers & coaching philosophy: Jeff Nippard.
Core principle: **very clean and simple, anyone can use it** (one obvious action per screen, minimal scrolling, no jargon without explanation).

Legend: ✅ done · 🟡 partly done / needs test · ⬜ todo

---

## 0. Data & media
- 🟡 720p video re-encode — `tools/download_media.sh` (resumable, skips finished files). **162 / 853 at handoff.** Next session must restart it automatically in the background first thing and let it finish.
- ✅ `tools/build_data.py` + `tools/enrich.py` (groups, equipment, pattern/type/level/rest/repRange/region/canonical) + `tools/jeff_tiers.py` (tiers, D/F removed)
- ✅ Content for all 842 exercises in `app/data/content/*.json` (movement families: primary/secondary muscles, about, steps, cues, mistakes in en/tr/ar; `map` slug→family; `variantNotes`)
- ✅ Merge content into `exercises.json` at build time (family, primary, secondary, i18n, note)
- ✅ Fix wrong groups reported by content agents (rear-delt "abduction" moves in Glutes; "Machine Single Arm Sides" → Shoulders; "Seated Single Arm Dumbbell Press (Hammer)" → Shoulders; Roman chair knees-to-chest / Cable Rotations / Knee Tucks → Abs). Slugs ≠ names (`-copy`) is fine: trust `name`.
- ✅ Machine detection → `machine` field + filter chip (Hammer Strength, Smith, Pec Deck, Leg Press, Hack Squat, Pendulum, Belt Squat, Cable Station, Lat Pulldown, Seated Row, Leg Curl/Extension, Abductor/Adductor, Chest Press machine, Assisted Pull-up, Reverse Hyper, Roman Chair, Preacher bench, T-Bar, Landmine, TRX)
- ✅ (session 7, app/data/jeff.json) `tierStart` seconds from Jeff transcripts → "Jeff's take" opens the video at that moment

## 1. Muscle animations (research done — item 4)
Goal: besides the real video, show a **neutral mannequin/skeleton-style body with the worked muscle colored**, ideally from more than one angle.
- ✅ Research result — best fits:
  1. **open-exercise-figures** — https://github.com/AbanoubAmir/open-exercise-figures — **CC0** (free, even commercial, no credit required), MIT code. **1,405 exercises**, looping animated WebP 480×480 (60–200 KB), gray mannequin, **target muscle red, secondary tinted**, includes equipment; `exercises.json` with target/secondary muscles + instructions in **English & Arabic**. Single camera angle per exercise (front or side).
  2. **opengym3d** — https://github.com/AssiamahS/opengym3d — **MIT**, 42 exercises as animated `.glb` (~50 KB each) + Three.js viewer → real **3D, rotatable from any angle**, muscle metadata. Good for the main compound lifts.
  3. openlift (MIT, static GLB poses with muscle highlight shells) — fallback for still 3D poses.
  - Rejected: movement-lab (no license), ExerciseDB / "Gym visual" GIF datasets (media not openly licensed), mannequin.js (GPL-3.0).
- ⬜ Download open-exercise-figures animations, convert to optimized WebP if needed, match to our movement families (name + equipment + pattern fuzzy match, manual overrides) → `figure` field
- ✅ Exercise page: segmented toggle **Video | Muscles** (mannequin animation). **3D** tab for every exercise (✅ session 6: drag to rotate, Front/Side/Back, lazy three.js; motion only for exact matches)
- ⬜ Credit both projects in About (even though CC0 needs none)

## 2. Design & UX
- 🟡 Calmer design system in `app/css/app.css` (glow/neon/gradients removed) — verify visually
- ⬜ **Simple for everyone**: plain-language labels, short explanations, big tap targets, one primary action per screen
- ✅ **No emoji anywhere** → SVG icons (`ui.js ic()`); still emoji in `main.js` / `train.js`
- ✅ **No browser `prompt()` / `confirm()` / `alert()`** (user screenshot showed "127.0.0.1 says…") → custom in-app sheets/dialogs for naming, confirming, deleting
- ✅ **Less empty space, minimal scrolling**: remove big "large-title" gaps above headings, tighter header, content above the fold, collapse secondary sections
- ✅ **Settings placement**: not floating alone top-right on Me — put Settings as a clear row/section inside Me (and in the desktop sidebar); gear icon
- ✅ **Settings icon** is ambiguous (looks like a sun / light-mode toggle) → proper gear icon; add real **Dark / Light / System** theme setting
- ⬜ **Reuse the owner's Fluent365 motion system** (`../Fluent365/apps/pocket/src/styles.css`, MIT, pure CSS — no need to write from scratch):
  tokens `--ease: cubic-bezier(.2,0,0,1)`, `--dur: 200ms`; keyframes pageIn / stepIn / fadeIn / riseIn / popIn / cardIn / flipIn / pillIn;
  bottom-nav pill indicator (`.nav .ind` + pillIn), button state layer (`.btn::before`), sliding tab indicator (`.ptabs-ind`), swipe cards (`.swipe` + cardIn),
  ring progress fill transition, mini-player riseIn, list stagger; reduced-motion guard
- ⬜ Smoother animations everywhere (spring sheets, shared-element card→detail, list stagger, tab transitions); respect `prefers-reduced-motion`
- ⬜ **Responsive, separate layouts** (not a stretched phone):
  - Phone (Android/iPhone): bottom tab bar, safe areas
  - iPad/tablet (≥768px): left rail nav + 2-pane (list | detail)
  - Desktop (≥1100px): sidebar nav + multi-column, hover states, keyboard shortcuts
- ⬜ i18n **EN / TR / AR** for the whole UI (`app/i18n/*.json`, `t()`, picker, `dir="rtl"` + logical CSS for Arabic)
- ⬜ **Performance**: precache shell, stale-while-revalidate for data JSON, lazy images with fixed aspect boxes, `content-visibility`, code-split rarely used views, prefetch next likely view, compress JSON, Lighthouse ≥ 95 on mobile
- ✅ Rename app everywhere to **Gym** (title, manifest name/short_name, header, README, SW cache names)

- ✅ Desktop/iPad sidebar scrolled away with the page (owner screenshot) → nav is now `position: fixed` with `--nav-w`
- ⬜ **"The colors look dead"** (owner): premium feel lost after the calm redesign → design subagent reworks color tokens (dark + light), accent, tier colors, card depth, app icon — premium & alive but still no glow/neon
- ✅ **Owner's design reference (2026-11-17)**: soft / neumorphic "Workout Tracker" look — warm off-white bg, raised white cards with soft double shadows, coral-red accent, red ring progress + thin bar charts, rounded icon tiles, flat **vector illustrations of people exercising** (CC0 sets: Open Peeps / Humaaans / Open Doodles; recolored to accent) for onboarding, empty states, rest, timer. Dark theme = matching warm charcoal + same coral. Subagent does tokens + icon + illustrations; then apply raised-shadow component rules.
## 3. Home
- ✅ **Timer on the Home page** (user request): quick rest-timer presets + "Open timer" right on Home, not hidden in Train
- ✅ Today's workout card, this week summary (sets, reps, kg vs last week), streak

## 4. Exercise detail page (user: needs more info)
- ✅ **Compact top area so "How to" is visible without scrolling**: shorter video (≈40% of screen on phone, side-by-side with info on iPad/desktop);
  merge tier + reps/rest/type into ONE slim row (tier badge · "10–15 reps · 90s rest · Isolation") — compact but CLEARLY readable
  (large enough text, good contrast, icons per value; owner insists these stay well visible), Jeff note as a one-line expandable;
  "Add to workout" as a small sticky bottom button (not a huge block); then tabs: **How to | Muscles | Stats | Notes**
- ✅ Numbered how-to: **1. … 2. … 3. …** + cues + common mistakes + variant note (from content files, user's language)
- ✅ Muscles worked: mini body/mannequin with primary (strong color) + secondary (light) + list
- ✅ Jeff tier card (Ranking tab, in-app embed at the timestamp), your stats (best e1RM, last week vs this week, sparkline), notes, alternatives

## 5. Body map
- ✅ Replace hand-drawn SVG with a **realistic muscular open-source anatomy SVG** (license must allow public use; credit it)
- ✅ Tap muscle → smooth **scale-up + zoom** → **Info tab first** (name, what it does, weekly sets vs target) → **Exercises tab** (tier-sorted)
- ✅ Weekly heat-map mode kept; + Recovery mode
- ✅ 18-fix: detail never covers the body (side panel on desktop/iPad, non-modal half sheet on phone) — session 13
- ✅ **Sub-muscles / heads** (owner request): tapping a muscle (e.g. Chest) zooms in and shows its heads inside (Upper chest / Mid-lower chest, biceps long/short/brachialis, triceps long/lateral/medial, quads RF/VL/VM, glute max/med, calves gastro/soleus, traps upper/mid/lower…) highlighted on the zoomed SVG, each with name + short about; Exercises tab groups exercises under each head (tier-sorted). Data: `app/data/guide/heads.json` (regex classification), SVG `data-h` shapes

## 6. Training & tracking
- 🟡 `app/js/train.js` (workouts, level plans, live logger, warm-up sets, PR confetti, rest timer, plate & 1RM calc, intervals, swap, summary) — **needs end-to-end test**
- ✅ **Better tracking**: per exercise show *last week vs this week* (sets × reps × kg), per-set details, weekly totals (kg lifted, reps, sets per muscle), progress charts, PR list, calendar heatmap, bodyweight log
- ✅ **Plans explained** (Jeff-based): for every plan show *what it is, who it's for, why it works, weekly schedule, sets per muscle, how to progress*, categorized (Beginner / Intermediate / Advanced; Full Body / Upper-Lower / PPL / Specialization)
- ✅ **Timer page** `#/timer`: stopwatch (start/pause/lap/reset), countdown (set mm:ss, presets, start/pause/stop, ring), intervals (editable work/rest/rounds, Tabata/EMOM); keeps running across pages with a floating pill
- ✅ Strength standards by bodyweight ("you weigh X → aim for at least Y" per main lift and level)
- ✅ Warm-up section + warm-up player (block 20); ✅ onboarding quiz (level, days, equipment, goal, sex, bodyweight → plan)
- ✅ Nutrition: calorie & protein calculator + diet guidance from Jeff Nippard's nutrition videos (paraphrased, linked)

## 6b. WARM-UPS — major section (user: very important)
- ✅ Own entry point (Home card + tab inside Train + auto-offer before every workout)
- ✅ **General warm-up** (5–8 min): light cardio → dynamic mobility for the day's joints; no long static stretching before lifting
- ✅ **Ramp-up sets** calculator per first exercise of each muscle (Jeff style: e.g. 50%×8, 75%×4; heavy compounds bar×10 → 40/60/75/85%)
- ✅ **Muscle-specific primers** (shoulders/chest, back, knees/quads, hips/hamstrings/glutes, elbows/arms, ankles/calves, core) 2–3 drills each
- ✅ **Warm-up player**: step-by-step with per-drill timer, mannequin animation (open-exercise-figures has many mobility/stretch moves), Next button
- ✅ Auto-built warm-up for the selected workout ("Push day → 6-min warm-up")
- ✅ Cool-down / stretching after workout (optional)
- ✅ Content based on Jeff Nippard first, then credible experts (Stronger by Science/Nuckols, RP/Israetel, Eric Helms, physios like Squat University for joint prep) — paraphrased with links
- ✅ Visuals per drill, in this priority: (1) mannequin animation from open-exercise-figures (CC0, offline); (2) opengym3d/openlift 3D; (3) **YouTube embed of Jeff's (or the expert's) video with start/end timestamps** so only that segment plays.
  Owner's decision: **download the relevant segment of Jeff's/the expert's video, cut it (ffmpeg, yt-dlp `--download-sections`), and host it in the app** so it also works offline; credit + link to the original on every clip.
  ⚠️ Risk noted to owner: re-hosting creators' video publicly can get the clip/repo taken down — keep clips short, credited, and fall back to the timestamp embed if a takedown happens.

## 7. Me / About
- ⬜ Improve Me page: profile (bodyweight, level, goal), weekly report, PRs, history, achievements
- ⬜ **Credits & rights**: "© Mohamed Attia — all rights reserved" for the app; exercise rankings & philosophy © **Jeff Nippard** (channel link); demo videos © their creators / coaches shown in them (Get SWOLE); muscle animations: open-exercise-figures (CC0) / opengym3d (MIT); anatomy SVG license
- ✅ Data stays on device (IndexedDB `store.js`, export/import, persist)

## 8. Deploy
- ⬜ When download is finished: `mv media app/media` (replace symlink) and point `download_media.sh` to `app/media`
- ✅ `git init`, `.gitignore` (raw/, *.xapk, tokens), GitHub Actions Pages workflow publishing `app/`
- ⬜ Ask owner, then `gh repo create gym --public`, push, enable Pages, verify on phone (install + offline)

## 9. Extra ideas (approved by owner — implement)
- ✅ **Gym mode**: one exercise per screen, huge buttons, swipe to next exercise, screen stays on
- ✅ **Auto-fill** last week's weights + "beat last week" target per set
- ✅ **Weekly muscle balance**: warns if a muscle got < 10 sets
- ✅ **Share card**: workout summary as an image
- ✅ **Search in any language** (Turkish/Arabic aliases for exercise names)
- **Quick swap** when a machine is busy (exists — make it more visible)
- **Sound/vibration** cues on rest end, with settings (exists — verify on iOS)

- ⬜ **Common mistakes shown, not just told** (owner, block 22): WRONG vs RIGHT clip / 3D per mistake, credited, exact movement only — spec in NEXT_SESSION.md

- ✅ **Exercise page declutter + equipment chips + Joint care sheet + 3 tabs** (owner, block 17, session 7)
- ✅ **Human-looking body (18 ✅ session 5) + rotatable 3D muscle body for every exercise (19 ✅ session 6)** (owner: "looks like a stick man", "all angles")

- ✅ **19a** readable hero controls · ✅ **19e** UX benchmark Blok A · ✅ **19c** fullscreen video (session 8) · ✅ **19a-fix** hero fits video + compact controls · ✅ **19a-chips** canonical alt pick (session 9)
- ✅ **19d** pro lock-screen rest timer (session 10) · 🟡 **19b** 3D upgrade — viewer done (session 10), motion engine + 16 authored families (session 11), +10 families (session 12), +8 (session 14), +8 (session 15), coverage 57/179 families; more families open — owner · ✅ **19f** dark theme strips (session 14) · ✅ **19g** reinstall after uninstall (session 14)
- ✅ **22** common mistakes "Show" (session 12): wrong vs right sheet, fix line for all 370 mistakes en/tr/ar, 2 verified clips (more clips need Jeff technique videos) — owner
- ⬜ **22b** quality polish + UX benchmark fixes (docs/ux_benchmark.md) — owner
- ⬜ **25** printable PDF guide per level (en/tr/ar), generated from our data — owner

- ⬜ **26 Plans 2.0**: ~10 splits + filters + visual week scenario on the body (owner) — spec in NEXT_SESSION.md

## 9b. Voice guidance (later phase — yes, possible)
- ⬜ **Narrate the movement explanations** too: about, numbered how-to steps, cues, common mistakes, warm-up drills, plan explanations (a play button on every explanation + hands-free mode during a session)
- ⬜ Read steps & cues aloud, announce "set 2 of 3", rep count, rest countdown "10 seconds… 3, 2, 1, go"
- Option A (free, instant): browser **Web Speech API** (`speechSynthesis`) — works offline on most phones, voices for en/tr/ar depend on device
- Option B (best quality, offline): pre-generate audio with open-source **Piper TTS** (has English, Turkish, Arabic voices) → small .mp3/.opus per phrase, cached by the SW
- Setting: Voice on/off, language follows app language

## 10. More ideas — owner's decision: keep the app UNCLUTTERED
Approved (implement):
- ✅ **Pain / joint flag** (joints.json en/tr/ar; prehab drills shown as text, animations pending): mark an exercise "hurts my shoulder/knee/elbow/back" → hidden from suggestions, shows joint-friendly alternatives (same muscle, tier-sorted), plus warm-up / prehab drills for that joint (animation or timestamped expert video). Short disclaimer: "if pain persists, see a physio".
- ✅ **Equipment profile** (full gym / dumbbells only / home): library, plans and swaps only show what you have (one setting, chosen in onboarding)
Low-clutter additions (no new screens):
- ✅ **Superset** (owner: yes, menu only) — only inside the exercise "⋯" menu in a session; rest timer starts after the pair
- ✅ **Plateau auto-adjust** (approved): if no e1RM/rep progress for 3 weeks, the app **automatically** changes the rep range (e.g. 6–8 → 10–12) or swaps to the next-best same-muscle exercise for the next session, shows a small notice with Undo; deload hint after long stalls
- **Recovery on the Body map** (approved): after each finished workout, worked muscles are colored by remaining recovery time — **red** (fresh damage, <24h), **yellow** (recovering), **green** (ready). Recovery window 48–72h by muscle size & sets done. Tapping a muscle's Info shows "needs ~X more hours before training again". Also a small recovery body on Home
Dropped (too much): RIR per set, Sunday check-in, exercise of the week on Home

## Notes (2026-11-17 session)
- Steps 1-8 of the cheap-first order done (also: equipment profile, balance warning, timer.js + floating pill, rest timer uses it) (rename, git+Pages workflow, theme+settings, emoji/dialogs, machine filter + TR/AR search). No commit yet.
- New CSS design system in app.css (tokens, Fluent365 motion, rail/sidebar). Legacy markup still uses compat classes at the end of app.css — remove when views are rewritten.
- View Transitions API removed (blocked first render); page animation via `.page` class.
- Boot takes ~5 s on the local server under load → check in Performance step.
- Test: `node tools/test/shot.mjs <outDir> <steps.json>` (supports waitFor).
- Paused subagents (5h limit): figures/3D (figures_map + oef_catalog done, 203 figures copied, 3D not started), anatomy SVG, warm-ups/joints+clips, plans/nutrition/standards — resume them.

## Notes (2026-11-17, session 2)
- Views rewritten on the new design system, legacy compat CSS deleted. Modules: main.js (shell/router/body map/videos), home.js, exercise.js (library + 2-pane ≥1000px + exercise page + pain flags), train.js, me.js (progress/history/settings).
- Home: hero (resume / up next / onboarding), rest-timer presets, week vs same day last week, week dots, balance warning, recovery mini body (data.js `recovery()`).
- Exercise page: Video | Muscles (app/data/figures.json, built from tools/figures_map.json, conf high/med only), facts row, Jeff one-liner, How to | Muscles | Stats | Notes, sticky Add pill.
- Session: placeholders = last session, "Beat" target, plateau auto-adjust (`stalledWeeks()`, S.adjust, Undo toast), deload hint ≥5 stalled weeks.
- Me → Progress: week vs week, 8-week volume bars, sets per muscle, strength chart, per-exercise table, PRs, 16-week heat map, bodyweight log.
- Pain flags: S.pain, joints.json (avoid wins over prefer). autoPush after notes/favorites/bodyweight/settings/pain/workouts.
- Perf: modulepreload all modules + data preload, SW stale-while-revalidate (v8), inline splash.
- Open: Superset (ask owner), i18n, anatomy SVG, 3D, warm-ups, media into app/media when the download finishes (842/853 videos at end of session), voice later.

## Notes (2026-11-17, session 3)
- Feedback round done: tab "Notes & alternatives" (alternatives first, then my notes); tier badge shows "S tier" everywhere + facts row "Jeff: S tier · Top pick (i)" and a "Tiers" link in the library → explainer sheet (`tierInfo()` in main.js); cards show level bars + Beginner/Intermediate/Advanced and up to 3 tags (group, equipment, machine).
- Figures re-audited (exact movement only: family + equipment + body position): 765 → 470 exercises with a figure; `tools/figures_map.json` has `why` per entry and `dropped_families`; scripts in tools/figure_audit/ (decide.py, apply.py --write).
- Hero "Muscles" now always shows front + back body map (primary accent, secondary light); the exact figure sits beside it when available. 3D tab still open (block 19).
- Superset: session entry "⋯" → "Superset with next exercise"; `en.ss` flag; no rest after the first of the pair, rest after the second with "Next: <first> · set k". Move up/down clears links.
- Session handoff: tools/handoff.sh opens a new kitty window with a fresh session reading NEXT_SESSION.md. sw VERSION now v10.

## Notes (2026-11-17, session 4)
- New lazy module `app/js/guide.js` (routes #/guide hub, #/start quiz, #/standards, #/nutrition, #/plans, #/plan/<id>); content in app/data/guide/{plans,nutrition,standards,onboarding,equipment}.json (en/tr/ar, written by a content subagent; nutrition sources = Jeff channel + 3 papers). Entry points: Me → Guides, Home "Find my plan", Train "Find my plan" + "How it works" per plan.
- Quiz → `pickPlan()` (≤3 days beg-fb, 6 days adv-ppl unless beginner, else int-ul); saves S.profile {level, days, goal, sex, nutri}, S.settings.equip, bodyweight log.
- Strength goals: e1RM from logged sets whose names match `standards.json` regex; library has no plain flat barbell bench, so bench uses close-grip/slight-incline barbell.
- Gym mode: session head "Gym mode" toggle (S.settings.gym), one exercise at a time, prev/next + swipe, bigger steppers, "Next exercise" button when done, follows supersets. Wake lock already existed.
- Share: finish sheet "Share" → `share.js` renders a 1080×1350 PNG (Web Share files, else download). sw VERSION v11.

## Notes (2026-11-17, session 5)
- Body map (block 18): `app/js/anatomy.js` (VIEWBOX 216×424, `path.m[data-m][data-h]`, `.base`) from react-native-body-highlighter v3.2.0 (MIT, HichamELBSI), polygonised, grown, heads split by us (chest 3 bands, biceps long/short, delts, lats, traps mid/lower, rhomboids synthesized). Generator + source in tools/anatomy/ (build.py src.json out.js 4.5 2). body.js now only MUSCLES + helpers; mirror shapes gone.
- Body map modes Muscles | This week | Recovery; sheet tabs Info (fn, week sets, recovery text, Parts list → tap highlights head `hsel`) | Exercises (grouped by head via `headOf()` in main.js, equipment chips). On <1000px the sheet is `half` (54dvh) and the zoom keeps the muscle in the top part. Credit link under the map.
- Content fix: 2-part-high-elbow-row → family chest-supported-high-elbow-row, equipment Dumbbell (also in build_data.py). sw v12.

## Notes (2026-11-17, session 6)
- Block 19: hero toggle is now Video | Muscles | 3D. `app/js/view3d.js` (lazy, imported only on the 3D tab) renders the OpenGym3D MakeHuman body (MIT) with vendored three.js r170 (`app/vendor/three/`, GLTFLoader + meshopt decoder, imports rewritten to relative paths). Drag = yaw (+ small tilt), Front/Side/Back seg, pause button when animated, reduced-motion = paused. Hero is taller in 3D mode (`.dhero.is3d`).
- Assets in `app/3d/` built by `tools/og3d/build.mjs` from raw/og3d_pack (deps: `npm i @gltf-transform/core@4.1.1 @gltf-transform/functions@4.1.1 @gltf-transform/extensions@4.1.1 meshoptimizer@0.22.0` somewhere, symlink its node_modules to tools/og3d/node_modules): body.glb 272 KB (mesh + skin, carries `_MUSCLE` vertex attribute = our 19 MUSCLES ids, painted from dominant skin bone + front/back + height bands, ported from og3d paint_muscles), anim/<id>.glb ~100 KB x24 (skeleton + clip, face bones dropped). Labels MUST stay a vertex attribute (meshopt reorders vertices).
- Exact-movement map `MOVE3D` (family -> anim) + `NOT_SAME` name filter in exercise.js; everything else = still A-pose with muscles painted ("still pose" in caption). Credits: caption link + Me/About. sw v13 (view3d.js in shell; 3D assets cached on first view).
- Polish ideas: chest band still touches the collarbone; delt split front/side is approximate; squats have no motion (og3d squat is bodyweight with arms forward, not a back squat).

## Notes (warm-ups session, block 20 — branch `warmups`)
- New lazy module `app/js/warmup.js` (via `G(fn, mod)` in main.js): `#/warmup` hub (auto card for the live/next workout, area chips, ramp-up calculator using `warmupSets`, General, Cool-down, Sources), `#/warmup/play` player (figure/demo, cue, ring timer, Prev/Start/Next, auto-advance with beep), `#/warmup/w/<id>`, `#/warmup/s` (live session; finish screen shows ramp-up for the first exercise from last weight + "Add these to the workout"), `#/warmup/cool`.
- Auto warm-up: 2 min cardio + 4 mobility drills for the day type (push/pull/legs/full from muscles) + 1 primer for the 2 most used areas (~6 min).
- Entry points: Home "Up next" → Warm up button; Train → Tools "Warm-up"; session banner "Warm up first" until the first set is done (S.active.warmed / noWarm); finish sheet → "Cool-down stretches (optional)".
- Content `app/data/guide/warmups.json` (35 drills en/tr/ar, 7 areas, muscleArea map, sources Jeff/SBS/RP/3DMJ/Squat University). 19 drills have an exact oef figure (copied to media/figures); 13 have `clip` {q,start,end,by}.
- Clips: yt-dlp download was blocked (YouTube 403 and the auto-mode permission check), so clips use the fallback: tap "Watch demo" → youtube-nocookie embed of only start–end + credit link. To host offline later: put `media/clips/<file>.mp4` and set `clip.file` — the player already prefers it.

## Notes (2026-11-17, session 7)
- Merged `warmups` (block 20) into main, worktree removed. sw v15.
- Block 17 exercise page: hero → equipment chips (`variants()`: same family, else same group+pattern+primary[0] marked "similar"; hides pain-flagged / not-owned; tap = history.replaceState + rerender) → title → plain line (tier badge = opens Ranking tab, level, warm pain chip) → grey line reps · rest · type → tabs How to | Stats | Ranking & alternatives. Muscles tab removed: hero Muscles shows Main/Helpers list (one body view when a figure exists); "Targets: <head>" expandable at top of How to.
- Pain chip → Joint care sheet: joint-friendly hcards, "Do these first" (warmups.json area drills, JOINT_AREA map) + Start → `playDrills()` export in warmup.js (timer player), tips, physio note, remove flag.
- Ranking tab: tier + Jeff note + "#k of N <group>", youtube-nocookie embed (click thumbnail → iframe with start=), offline = "Needs internet" + link; alternatives as `.hcards`; My notes.
- `app/data/jeff.json` (subagent; rebuild with `python3 -I tools/jeff/build.py .`): fam[family][videoId]=sec → 509/705 ranked exercises at their own tier video (+55 via another Jeff video of the same family, used as fallback); ex[slug] backup for 72/137 unranked (Jeff 63, RP 5, Jeremy Ethier 3, Squat University 1). Rest skipped on purpose (no exact match). YouTube 429 blocked 3 leads (SquatU reverse hyper / back extension, RP shrug mistakes) — retry later.

## Notes (2026-11-17, session 8)
- 19a: hero pills are solid dark (#141414c4 + 1px light border + shadow), 36px seg, 38px speed button with `speed` icon + bold rate (46px hit area), top/bottom scrims only in video mode (`.dhero.isvid`). Letterbox-aware placement skipped: the scrims make it unnecessary.
- 19e: topbar 95% opaque + hairline when scrolled; default theme `system` (Auto) in store/main/me/index.html — existing installs that stored "light" keep it; `--ctl` token (light #958B84 3.3:1, dark #7A706A 3.5:1) on inputs, search, steppers, check (outline until done); light `--warn` #8F5F0F (4.8:1); figure in Muscles hero: multiply + radial mask (light), invert+hue-rotate+screen (dark); all hero modes `min(40dvh,360px)`; sticky CTA labels in `.lbl` collapse to icon while scrolling down (`body.scroll-down`); manifest: no orientation, 3 shortcuts, screenshots app/icons/shot-{narrow,wide}.png; Train empty state = compact row; splash min 1.2 s first open of the day, else hides on first render; Install card at the bottom of Home, only after the first finished workout, hidden on desktop; Me > Strength: `topExercises()` now uses the same done-set rule as `history()`, <2 points = one-line hint.
- 19c: fullscreen button next to speed (`#fsb`, icons fs/fsx); requestFullscreen on the hero box (keeps our speed + exit controls, seg hidden), landscape lock when the video is wide (Android), webkit prefix, iPhone Safari falls back to `video.webkitEnterFullscreen()` (native player); double-click / double-tap toggles. Not testable headless — owner checks on phone.
- A13 checked: `hack-squat-toes-low-quad-copy` really is a Smith squat video (source CMS copy slugs; 60+ `-copy` slugs, names come from the real titles). Slugs are IDs in saved sessions — not renamed.

## Notes (2026-11-17, session 9)
- 19a-fix: `fitHero()` in exercise.js sets `--ar` (h/w) on `#hero` from the poster's natural size, then the video's `loadedmetadata`; cached per slug (ASPECT map) so Muscles/3D keep the video height. CSS `.dhero.fit` = full width + `aspect-ratio: 1/var(--ar)`, max `min(55dvh,560px)`, min 200px; desktop split heights unchanged. Switcher 32px visual (26px buttons, 13px, auto-width columns, 44% of 390), speed 30px pill + fullscreen 30px square bottom-right, ::after 44px hit areas, scrims 52px. All 832 library videos are 720×720 (portrait/landscape verified by forcing `--ar`). sw v19.
- 19a-chips (b): `variants()` (now exported) sorts by canonical > oddity (NOVEL words = +10, modifier words/brackets +1 each) > byTier; non-family "alt" picks skip novelty and names that mention another equipment kind. (Superseded by the equipment fix below: Smith Squat → Barbell alt = High Bar Squats.) 22 S/A spot-checks look sane. sw v20.
- Equipment fix (owner: "do it right, no errors"): the back squats existed ("High Bar Squats", "Low Bar Squat"…) but 164 exercises had `equipment: []` (no chips, hidden from Dumbbells/Home profiles). Filled one by one from the posters → `tools/equip_fix.json`, applied by `python3 -I tools/fix_equipment.py .` (idempotent; RE-RUN after any rebuild of exercises.json; heavy barbell compounds get rest 180 / 5–8). Unsure guesses: Standing DC Style Calf Raise = Bodyweight, skull crusher variants with a straight bar = Barbell. Smith Squat → Barbell alt = High Bar Squats. sw v22.

## Notes (2026-11-17, session 10)
- 19d: `app/js/media.js` — during a workout the first rest (user tap) starts a silent 10 s WAV loop + Media Session: title `Rest 1:23` (`(paused)`), artist `Next: <name> · set n of N · w kg × r`, artwork = next exercise poster, setPositionState = rest progress; between rests title `Go: <name> set n`, artist `<workout> · elapsed`. Handlers play/pause = resume/pause rest, nexttrack = skip, seekforward +30 s, seekbackward −15 s, stop = disengage. Stops when the workout ends or Settings → "Lock-screen rest timer" is off (`S.settings.lockTimer`, default on; "How it works" sheet documents Android music-pause risk, iOS limits, Capacitor Live Activity as later option). Rest end: timer.js fires `gym:timerend` → SW notification (tag gym-rest, vibrate) only when hidden + permission; permission asked once via in-app toast "Allow" (`notifAsked`); sw.js `notificationclick` focuses the app. train.js `nextInfo()` gives {text, slug, name, set, of, w, r} (typed → last time → target top). timer.js full-screen rest overlay `#rov` (ring, tap time = pause, Next card with poster, −15/+30/Skip, chevron/Esc minimises to the pill; pill + is now +30); toasts move to the top while it is open. Not testable headless: lock screen, notification, background beep — owner tests on Android + iPhone. sw v21.
- 19b viewer: tighter framing (box +.04, reach/9, band 44/72), neutral skin (#cdc7c2 light / #8d8781 dark), main = accent mixed toward red, helpers 42%, per-vertex `glow` attribute → emissive in onBeforeCompile; zoom 1–3.5× (pinch, wheel, +/− buttons at right, double-click/tap resets; when zoomed, vertical drag pans along the body and `.v3d.zoomed` gets touch-action:none); speed button 1×/0.5× next to play. Seen: barbell row lats look pale in back view (paint smoothing / labels) — check when authoring poses.

## Notes (2026-11-17, session 11)
- 19b motions: `app/js/view3d.js` buildClip() turns `app/3d/poses/<family>.json` into a looping AnimationClip. Pose format: `{ecc:"out"|"back", plant:"feet"|"hands"|false, yaw, props:[bar|db] (picked by exercise equipment via exercise.js prop3d), fixed:[pullbar|dipbars|bench], base:{...}, keys:[start,(mid),end]}`; each key = segment directions in body space (x = left/outward, mirrored for R; y up; z forward): torso, neck, clav, uarm, farm, hand, thigh, shin, foot (+L/R overrides), `tw` twists, `frame:-90` = lying (author as if standing). Directions are slerped per sample (18/phase, smoothstep), feet re-aimed flat + planted every sample; eccentric 1.6 s, concentric 1.0 s, holds .35/.25 s. Props are simple meshes that follow the hands (makeProp). `mount3d(..., {at})` freezes at a fraction (for screenshots).
- Families with authored motion (12): high-bar-squat, shrug, barbell-curl, reverse-curl, upright-row, rear-delt-raise, dips-chest, hanging-knee-raise, hanging-leg-raise, close-grip-press, sissy-squat, split-squat, + skull-crushers, dumbbell-skull-crushers, lat-pulldown, close-grip-pulldown (props `seat` added). Each has its own NOT regex in `POSE3D` (exercise.js) so variants that differ (smith, heel elevated, seated, single arm…) keep the still pose. Coverage: 31/179 families have motion (15 opengym3d + 16 ours). Verified at 3 frames front + side (scratchpad screenshots) and in-app phone light/dark + desktop. sw v23.
- Authoring tip: render a pose sheet with `mount3d(div, {move:"p:<family>", at, view, prop})` for at = 0 / .36 / .65 (start / mid-eccentric / bottom when ecc:"out").
- Lying moves use `yaw:90`, so "Front" shows the profile and "Side" the feet end (intended: profile is the readable view).
- Known: sissy-squat hip line could be straighter; shrug front view shows forearms as Main (traps paint is on the back) — check muscle data.

## Notes (2026-11-17, session 12)
- 19b batch 2 (+10 families): flat-dumbbell-press, dumbbell-fly, incline-dumbbell-press, incline-dumbbell-fly, barbell-incline-press, incline-dumbbell-curl (lying/incline, `frame:-90` / `frame:-55`), seated-cable-row (seat + cbar), bar-pushdown (cbar), cable-fly (no prop), dumbbell-row-bent-over (db). Coverage 41/179 (15 opengym3d + 26 ours). sw v24.
- view3d.js: `bench` now pitches with the torso (spine05->neck) and shows a seat block under the hips when inclined (t.y > .3); flat bench shifted toward the hips (-.28) so the glutes are on the pad. New prop `cbar` = short cable handle (0.5 m, no plates) — use as `fixed` for cable moves (equipment "Barbell" on cable pushdowns must not show a full bar).
- Lying poses now share better legs (feet flat on the floor, toes away from the head): `"thigh":[0.24,-0.72,-0.66],"shin":[0.04,-0.05,-1],"foot":[0,-1,0.05]` — also applied to close-grip-press and both skull-crushers. Incline seated legs (frame -55): `"thigh":[0.16,-0.82,0.57],"shin":[0.04,-0.57,-0.82],"foot":[0,-0.82,0.57]` (world directions rotated by +55° about x).
- Strict NOT regexes keep variants still (slight/high incline, single arm, pronated wide-grip rows, high-to-low / seated cable fly, partials). Lying bars still look like a big disc in the profile view (plate faces the camera) — acceptable.

- 22 (0eab694, d693703): each "Common mistakes" item has a small "Show" button -> half sheet: WRONG | RIGHT cards side by side (content files: mistakes = [{text, fix}] per en/tr/ar, families.<lang>.json regenerated by only copying the mistakes key — do NOT re-run tools/merge_content.py for that). Visual: `app/data/mistakes.json` {"v":1,"fam":{family:[{clip:{yt,start,end,credit,say}}|null]}} -> youtube-nocookie embed start–end (muted autoplay) + "Original at m:ss" link; else the body map (front+back) with the target muscles. pose3d wrong-vs-right not built (opengym3d has no "wrong" poses).
- Clips found by transcript search (yt-dlp subtitles work; video download is blocked): only shrug[1] and front-squat[0] passed the strict rule — tier-list videos rarely name mistakes. More clips need Jeff's single-exercise technique videos added to jeff.json (and a retry of the biceps tier list subtitles, HTTP 429). Scratch tools: transcript windows per family were in the session scratchpad (clips/win.txt).

## Notes (2026-11-17, session 13)
- 18-fix: muscle detail no longer a modal. `bodyMap()` in main.js keeps a controller `BM` (show/hide/sync/close); detail renders into `#mdet` via `muscleDetail()`. >= 820px: `.bm-split` 2 columns, the right column swaps list <-> detail panel (back arrow, sticky, own scroll), body zooms centred, hover on Parts rows / exercise group headers lights that head. < 820px: fixed non-modal sheet above the tab bar (45% height, tap/drag the handle -> full, drag down -> close), the body svg shrinks to the space above it (`fitSvg`) and zooms to fill that box; body stays tappable (tap another muscle = switch, tap empty = close). Open muscle lives in `history.state.bm` (pushState on open, replaceState on switch): Android back / Esc closes, back from an exercise reopens it, Front/Back flip keeps it. sw v25.

- 19b-QA: high-bar-squat bar now rests on the upper traps behind the neck: prop `backbar` (`lowbar` = rear-delt position, ready for a low-bar family) from `backBar()` in view3d.js (neck01/spine05/clavicles frame), plates r .10 so the head stays visible in Side view; pose option `"ik":"backbar"` = two-bone IK puts the hands on the bar just outside the shoulders (`gripW`, default .29), elbows down/back; `"bar":"back"` = use the back bar when the exercise is a barbell one (split-squat). Closed grip: fingers curl (local z, L +/R -) whenever a bar/db/cbar/pullbar/dipbars is held, or `"grip":true` (cable-fly). Fixes found by the check + sheets: skull crushers end behind the head (elbows drift back), lat-pulldown bar travels in front of the face (torso -0.25), shrug bar in front of the thighs, close-grip-pulldown gets a `cbar` handle, Safety Bar / Century squats keep the still pose.
- Automated check: `node tools/test/check3d.mjs` (app served on :8765) runs `qa3d()` (view3d.js) on every pose x prop, 24 frames: prop-to-hand distance, back bar on the neck, prop vs head / torso clearance, hands inside torso, grip width; exits 1 on any failure (33/33 pass). RUN IT before shipping any pose change. All 26 authored families re-checked front + side at 3 frames (sheets in the session scratchpad). sw v26.

## Notes (2026-11-17, session 14)
- 19f (9db95a8): in-browser audit found no strip (phone 390x844 + laptop 1366x768, light/dark, system light + app dark, safe-area 47/34 emulated, Body map sheet, short pages): html/body bg, `color-scheme`, runtime theme-color were already right. Real-phone cause = platform window colour: manifest `background_color`/`theme_color` were light -> now `#161413` (dark; light theme still sets theme-color at runtime); added `<meta name="color-scheme" content="dark light">`; `overscroll-behavior-y:none` on html too. Installed WebAPK keeps the old manifest colours until Chrome updates it (or reinstall). shot.mjs: steps `{"safe":[top,bottom]}` (Emulation.setSafeAreaInsetsOverride), `{"display":"standalone"}` (CDP ignores it — matchMedia stays false), viewport `laptop` 1366x768. sw v27.
- 19b batch 3 (1f139e0): +8 families: pull-up (pullbar, lean back at top so the bar stays in front of the face), triceps-dips (upright torso, elbows back), cable-curl (cbar), rope-pushdown (no prop, `grip`, hands split at the bottom), face-pull (`grip`, elbows high + hands by the ears), cable-overhead-extension (`grip`, leaned forward, ecc out), seated-leg-curl + leg-extension (seat, hands on thighs). check3d 41/41. Coverage 49/179 (15 opengym3d + 34 ours). sw v28. Sheet maker: scratchpad mk.py = per family one eval that mounts 6 `mount3d` divs (front/side x at 0/.36/.65) + shot.
- 19g (4a6c70f): no stale installed flag (never existed); `installNow()` in main.js = prompt if available (a rejected/used prompt falls back), else iOS sheet or the Android/desktop menu-steps sheet with "Just uninstalled? Reload this page once"; `appinstalled` resets `installDismissed`; Settings "Install app" row only outside standalone. sw v29.
- Still without motion (by usage): hip-thrust, leg-press, one-arm-dumbbell-row, preacher-curl (needs a pad prop), front-squat (needs a front-rack bar), lying-leg-curl, seated-calf-raise, cable-lateral-raise, machine presses/rows (machine props), back-extension, t-bar-row, sumo-deadlift.

## Notes (2026-11-17, session 15)
- 19b batch 4 (d1d2090): +8 families: hip-thrust (yaw 60 = 3/4 view so the glutes show; bar on the hips; new prop `thrustbench` = box across the upper back, follows neck01/spine05), one-arm-dumbbell-row (new pose option `"one":"R"` = only the right dumbbell when the equipment is a dumbbell (`dbR`/`dbL` prop kinds); left hand on new prop `handbench`), lying-leg-curl (`frame:90` = prone, yaw 90, bench), seated-calf-raise (seat, plant:false, thigh lifts ~17° so the ankle rises while the foot plantarflexes), cable-lateral-raise (grip, no prop), back-extension (`frame:45`, new prop `hyper` = thigh pad parallel to the thighs + ankle roller + post; note upperleg01R - upperleg01L gives the body's +x in prop space), t-bar-row (cbar, close hands), sumo-deadlift (bar, wide stance, feet out). NOT regexes in POSE3D keep smith / single / pronated / chest-supported / machine / dumbbell-sumo variants still. check3d 49/49. Coverage 57/179 (15 opengym3d + 42 ours). In-app phone check light + dark: hip thrust, lying leg curl, T-bar row. sw v30. Sheet maker: scratchpad mk.py now takes `family:prop`.
- Known: lying-leg-curl arms rest forward past the pad (no handles prop); seated calf raise has no foot platform; T-bar row uses the short cable handle (no landmine bar).
- Still without motion (by usage): leg-press (sled prop), preacher-curl (pad prop), front-squat (front-rack bar), machine presses/rows (machine props), hack squat, pec deck, reverse fly machine.

## Real-phone lessons (from the owner's Fluent365 Pocket test on Android) — apply to Gym
- ✅ **System bars match the theme**: Android nav bar/status bar stayed white under a dark app. Set `<meta name="theme-color">` at runtime from the theme (done in `applyTheme`), add `media`-specific theme-color metas for light/dark, and pick manifest `theme_color`/`background_color` that don't flash; note installed WebAPK may need reinstall to update.
- ✅ **Animated opening screen (owner-approved, 2026-11-17)**: the dumbbell assembles (bar, then plates snap on from four sides), does one strong rep, then a smaller rep loops while loading; full ~2.7 s on the first open of the day, ~0.9 s later; still logo with reduced motion (`#splash` in index.html, CSS at the end of app.css, `hideSplash()` in main.js).
- ✅ **Opening screen**: no blank/white frame and no plain text — inline splash in index.html with the logo, themed from the first frame (theme read inline before JS), removed when the first view renders (boot currently ~5 s → splash is essential).
- ✅ **Action bars**: stacked buttons need a gap; side-by-side when they fit; nothing may overlap the floating timer pill, sticky "Add to workout"/"Start" buttons or the bottom tab bar (reserve space / offset the pill above sticky CTAs).
- ⬜ **Compact on 390 px**: small margins, compact chips/cards, minimal scrolling — but tap targets ≥ 44 px.
- ⬜ **Sheets/popovers compact**: actions on one line where possible; secondary info collapsed by default.
- ⬜ **Voice (later)**: speak exactly the target text (e.g. only the cue, not the whole card).
- ⬜ **Test on Android AND iPhone** (Safari + home-screen app): Add-to-Home-Screen steps, safe areas (notch / home indicator), status bar colour, opening screen, rest-timer beeps/vibration with the screen locked (iOS has no vibrate; consider Notification/Wake Lock), keyboard covering inputs in the session logger.
- Rules kept: data on device (+ optional private-repo backup), relative paths only, green/red only for right/wrong & recovery.

## Security
- Owner pasted their Get SWOLE password in chat → change it. `raw/.token` must never be committed.
