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
- ⬜ `tierStart` seconds from Jeff transcripts → "Jeff's take" opens the video at that moment

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
- 🟡 Jeff tier card (one-line expandable + YouTube link; timestamp pending), your stats (best e1RM, last week vs this week, sparkline), notes, alternatives

## 5. Body map
- ✅ Replace hand-drawn SVG with a **realistic muscular open-source anatomy SVG** (license must allow public use; credit it)
- ✅ Tap muscle → smooth **scale-up + zoom** → **Info tab first** (name, what it does, weekly sets vs target) → **Exercises tab** (tier-sorted)
- ✅ Weekly heat-map mode kept; + Recovery mode
- ✅ **Sub-muscles / heads** (owner request): tapping a muscle (e.g. Chest) zooms in and shows its heads inside (Upper chest / Mid-lower chest, biceps long/short/brachialis, triceps long/lateral/medial, quads RF/VL/VM, glute max/med, calves gastro/soleus, traps upper/mid/lower…) highlighted on the zoomed SVG, each with name + short about; Exercises tab groups exercises under each head (tier-sorted). Data: `app/data/guide/heads.json` (regex classification), SVG `data-h` shapes

## 6. Training & tracking
- 🟡 `app/js/train.js` (workouts, level plans, live logger, warm-up sets, PR confetti, rest timer, plate & 1RM calc, intervals, swap, summary) — **needs end-to-end test**
- ✅ **Better tracking**: per exercise show *last week vs this week* (sets × reps × kg), per-set details, weekly totals (kg lifted, reps, sets per muscle), progress charts, PR list, calendar heatmap, bodyweight log
- ✅ **Plans explained** (Jeff-based): for every plan show *what it is, who it's for, why it works, weekly schedule, sets per muscle, how to progress*, categorized (Beginner / Intermediate / Advanced; Full Body / Upper-Lower / PPL / Specialization)
- ✅ **Timer page** `#/timer`: stopwatch (start/pause/lap/reset), countdown (set mm:ss, presets, start/pause/stop, ring), intervals (editable work/rest/rounds, Tabata/EMOM); keeps running across pages with a floating pill
- ✅ Strength standards by bodyweight ("you weigh X → aim for at least Y" per main lift and level)
- 🟡 Warm-up section + warm-up player (block 20); ✅ onboarding quiz (level, days, equipment, goal, sex, bodyweight → plan)
- ✅ Nutrition: calorie & protein calculator + diet guidance from Jeff Nippard's nutrition videos (paraphrased, linked)

## 6b. WARM-UPS — major section (user: very important)
- ⬜ Own entry point (Home card + tab inside Train + auto-offer before every workout)
- ⬜ **General warm-up** (5–8 min): light cardio → dynamic mobility for the day's joints; no long static stretching before lifting
- ⬜ **Ramp-up sets** calculator per first exercise of each muscle (Jeff style: e.g. 50%×8, 75%×4; heavy compounds bar×10 → 40/60/75/85%)
- ⬜ **Muscle-specific primers** (shoulders/chest, back, knees/quads, hips/hamstrings/glutes, elbows/arms, ankles/calves, core) 2–3 drills each
- ⬜ **Warm-up player**: step-by-step with per-drill timer, mannequin animation (open-exercise-figures has many mobility/stretch moves), Next button
- ⬜ Auto-built warm-up for the selected workout ("Push day → 6-min warm-up")
- ⬜ Cool-down / stretching after workout (optional)
- ⬜ Content based on Jeff Nippard first, then credible experts (Stronger by Science/Nuckols, RP/Israetel, Eric Helms, physios like Squat University for joint prep) — paraphrased with links
- ⬜ Visuals per drill, in this priority: (1) mannequin animation from open-exercise-figures (CC0, offline); (2) opengym3d/openlift 3D; (3) **YouTube embed of Jeff's (or the expert's) video with start/end timestamps** so only that segment plays.
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

- ⬜ **Exercise page declutter + equipment chips + Joint care sheet + 3 tabs** (owner, block 17) — spec in NEXT_SESSION.md
- ✅ **Human-looking body (18 ✅ session 5) + rotatable 3D muscle body for every exercise (19 ✅ session 6)** (owner: "looks like a stick man", "all angles")

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
