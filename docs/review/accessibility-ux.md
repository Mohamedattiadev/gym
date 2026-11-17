# Gym: accessibility and UX review (WCAG 2.2 AA plus real gym use)

Reviewed 2026-11-17 against `main` at 348af78. I measured everything below in headless Chromium using `tools/test/shot.mjs` at phone width (390x844, touch on), in light and dark. Scripts and screenshots are in `/home/ati/tmp/claude-1000/-home-ati-Attia-Pro-Projects-gym-y/dc8f548e-5a93-4efa-83c3-914e65e7aff4/scratchpad/a11y/`: `contrast.js`, `audit.js`, `focus.js`, and `phone-*.png`. Contrast numbers come from colors the browser resolved, so `color-mix()` and alpha are composited onto the real surface.

## Summary

1. **The basics are solid.** Core text tokens pass in both themes: `--t1` 14.9 to 17.1, `--t2` 6.2 to 8.2, `--t3` 4.6 to 5.5 on bg/s1/s2. There is a global `:focus-visible` ring and a global reduced-motion rule. Sheets use native `<dialog>.showModal()`, so focus is trapped and Esc works. `lang="en"` is set. No image lacks `alt`. The CSS is already about 95% logical properties, so it is close to RTL-ready.
2. **Screen readers get no on/off state anywhere.** Switches, segmented controls, tabs, filter chips and the "Set done" check expose no `aria-checked`, `aria-pressed` or `aria-selected`. Only `#gymT` has one. A blind user cannot tell whether a set is logged or a setting is on.
3. **The rest overlay is not a real dialog.** Focus does not move into it and is not trapped. The big timer button is named "Pause or resume", which hides the countdown from screen readers. Nothing announces when rest ends.
4. **Light theme fails contrast on small colored text.** The failures are the tier badges, green "up" deltas and the `.tag.ok` tag, the session placeholders (the suggested reps), and the faded white text on coral. Exercise videos autoplay and loop forever with no pause control and ignore reduced motion.
5. **One-handed gym use mostly works:** 44 px steppers and check, `inputmode` set on inputs. The weak spots are many 24 to 36 px secondary targets, layout breaking at 200% zoom (session scrolls sideways), text that ignores the user's font-size setting, and placeholder "10"/"—" that looks like data already entered.

### Failing contrast pairs (needed: 4.5:1 for text, 3:1 for icons and borders)

| Theme | Foreground | Background | Ratio | Where it is used |
|---|---|---|---|---|
| light | `--tier-S` #94690B | tier badge bg (16% mix on s1) | **3.96** | `.tier.S`, css:195-197 |
| light | `--tier-B` #1F6FC0 | tier badge bg | **4.13** | `.tier.B` |
| light | `--tier-C` #6E6761 | tier badge bg | **4.42** | `.tier.C` |
| light | `--tier-A` #6D4FD8 | tier badge bg | **4.47** | `.tier.A` |
| light | `--ok` #23925F | bg / s1 / s2 | **3.43 / 3.93 / 3.61** | `.d.up` css:282, `.tag.ok` css:202, `.sitem.done .num` css:883, `.mw.ok .mwh` css:851 |
| light | placeholder `--t3` at 80% opacity | s2 / s1 / bg | **3.30 / 3.50 / 3.17** | `.stepper input::placeholder` css:518 (the suggested reps "10") |
| dark | the same placeholder | s2 / s1 | **3.49 / 3.75** | same |
| both | `.chip.on .n` (white at 75%) | `--accent` | **3.17** | css:177 (counts on the active muscle chip) |
| both | `.hero-card.live .muted` (white at 82%) | `--accent` | **3.51** | css:272 (the "live workout" card on Home) |
| light | `--accent-text` | accent-soft on bg | **4.05** | `.tag.acc` when placed on `--bg` |
| light | `--t3` | `--s3` | **4.35** (dark 4.13) | any `--t3` text on `--s3` chips or wells |
| both | `--accent` used as text | bg / s1 / s2 | 3.0 to 4.2 | today it is only used for icons (`.iconbtn.on`, `.menu .ck`), which pass the 3:1 icon rule. Never use it for text; `--accent-text` exists for that. |
| light | disabled `.btn.primary` (opacity .45) | bg | 1.44 | css:166. WCAG exempts disabled controls, but a disabled button this faint looks missing (see A11Y-24). |

These pass: white on coral `.btn.primary` 4.57, which is just above the line; `--accent-text` 4.8 to 7.2; `--warn` and `--danger` at 4.8 or more; the `--ctl` control border at 3.06 or more on s1/s2.

---

## Findings

### P0

**A11Y-1: On/off and selected state is invisible to assistive tech** (WCAG 4.1.2)
Evidence: grepping `js/*.js` finds `aria-pressed` once (`train.js:234`, `#gymT`), `aria-selected` once (Cmd+K palette), and `aria-checked` and `role="tab"` never. The affected controls:
- `.switch` buttons (`me.js:156-157`): Auto rest timer, Lock-screen timer
- `segH()` segmented controls (`me.js:142`): Theme, Unit, Equipment, bar weight
- `.ptabs` (`me.js:17`, exercise How to/Stats/Ranking)
- library filter `.chip`s
- body Front/Back and Muscles/Week/Recovery
- exercise Video/Muscles/3D
- `button.check[data-a=done]` (`train.js:325`)

A VoiceOver user hears "Set done, button" before and after logging a set.
Severity P0. Effort S.
Fix:
- `.switch`: add `role="switch" aria-checked="${on}"` and update it on toggle.
- `segH` and every `.seg`/chip-filter group: `aria-pressed="${on}"` on each button. Alternatively use `role="radiogroup"` with `role="radio" aria-checked` on the buttons.
- `.ptabs`: `role="tablist"`, with `role="tab" aria-selected` on each button and `aria-controls` pointing at the panel.
- `.check`: `aria-pressed="${done}"`, and change the label to `Set ${n} done`.

The cheapest route is one helper in `ui.js` `indicate()` (ui.js:49), which already visits every `.seg, .ptabs`: have it set `aria-pressed`/`aria-selected` from the `.on` class each time it runs.

**A11Y-2: The rest overlay `#rov` is not modal and hides the time** (WCAG 2.4.3, 4.1.2, 4.1.3)
Evidence: `timer.js:114` creates `div role="dialog" aria-label="Rest"` with no `aria-modal`, no focus move and no trap. The rest of the page stays tabbable behind it; the screenshot `phone-rest.png` shows it full-screen. The countdown is `button.big` with `aria-label="Pause or resume"` (`timer.js:118`). That label replaces the "2:00" text, so a screen reader never reads the remaining time. Rest ending is signalled only by beep and vibration, with no text announcement. The pill uses `role="timer"`, which is `aria-live=off` by design.
Severity P0. Effort S.
Fix:
- Render the overlay inside a `<dialog>` opened with `showModal()`, which gives a native trap and Esc. Otherwise add `aria-modal="true"`, move focus to `[data-r=skip]` on open, and set `inert` on `.app` while it is open.
- Remove `aria-label` from `.big`. Put a visually hidden "Pause"/"Resume" prefix inside it, or use `aria-label="${v.text} remaining, tap to ${v.running?'pause':'resume'}"`, updated only every 15 s.
- Add an `aria-live="assertive"` sr-only node that receives "Rest over. Next: Belt Squat, set 2" when the timer reaches 0.

**A11Y-3: Tier badges and green "progress" text fail contrast in light theme** (WCAG 1.4.3)
Evidence: see the table. S tier is 3.96, which matters because S tier is the app's core signal. `--ok` text is 3.43 on bg.
Severity P0. Effort S.
Fix: only the light tokens change (`app.css:33-37`); dark already passes. The hues stay the same, just darker.
- `--tier-S: #7F5A08` (4.96 on badge)
- `--tier-A: #5F43C9` (5.25)
- `--tier-B: #1A63AD` (4.83)
- `--tier-C: #625C57` (5.24)
- `--ok: #17704A` (5.31 on bg, 4.81 on its badge tint)

**A11Y-4: Session placeholder values are too faint and look like logged data** (WCAG 1.4.3, plus UX)
Evidence: `.stepper input::placeholder { color: var(--t3); opacity: .8 }` (css:518) measures 3.30 on s2 in light and 3.49 in dark. These placeholders carry the suggested reps ("10", "12") and "—" for weight; see `phone-session.png`. Mid-set in a bright gym the suggestion is hard to read. A beginner also cannot tell whether "10" is a target or a value already entered: both sit in identical boxes and differ only by a slight fade.
Severity P0 for contrast, P1 for the UX. Effort S.
Fix: `.stepper input::placeholder { color: var(--t3); opacity: 1; }` gives 4.87 light and 4.66 dark. [ASK OWNER] To tell target from entered, try one of these:
- show the placeholder italic or with a small "target" eyebrow in the header ("REPS · target");
- or prefill the suggested value as real `value` that the check accepts as-is, as Strong/Hevy do.

For weight, use the placeholder `kg` (or the suggested load) instead of "—"; "—" reads as "no data" or "disabled".

**A11Y-5: Exercise videos autoplay and loop forever with no pause, and ignore reduced motion** (WCAG 2.2.2, Level A)
Evidence: `exercise.js:265` renders `<video autoplay muted loop>` with only speed and fullscreen controls; measured on `#/ex/smith-reverse-grip-bench-press` as `{autoplay:true, loop:true, paused:false, controls:false}`. `warmup.js:120` and the session side video (`train.js:268`) do the same. Grepping for `.pause()` finds nothing in exercise.js, train.js or warmup.js. `view3d.js:241` does respect `prefers-reduced-motion` (good), but the videos do not.
Severity P0 (vestibular and attention users, Level A). Effort S.
Fix:
- Add a pause/play button to `.ctl` (next to `#spd`, using the same `.sq` style) and toggle on tapping the video.
- Under `RM.matches`, render the video without `autoplay` (poster plus play button).

Adding a button changes the hero slightly, but it is the minimum WCAG requires.

### P1

**A11Y-6: Many targets are under 44 px, and a few are under 24 px** (WCAG 2.5.8 AA at 24 px; 44 px is the practical gym bar)
Evidence (`audit.js`, phone width):

Under 24 px tall (2.5.8 fail unless the spacing exception applies):
- Home: `a.link.small` "Open timer" 72x20, `#seeS` "See all" 45x20
- Train: "Find my plan" 86x20, "How it works" 85x20 (x3)
- Settings: `#lockHelp` 77x15, `#persist` 179x15, form `label`s 330x19. The credit links at 17 px tall are inline in a sentence, so they are exempt.

24 to 36 px, in heavy-use places:
- session: `button.n` set type 30x30 (x15); `.restb` "rest 2 min" 51-61x24 (x6); `iconbtn.sm` Options and Skip warm-up 34x34 (x7); `.stepper button` 32 px wide; `.btn.sm` Set/Warm-up/Swap/Finish/Gym mode 36 tall
- exercise: Video/Muscles/3D segment 26 tall; `#fsb` 30x30; `#spd` 57x30; `#tierInfo` 24 tall; "Show the fix" 59x30
- Settings: every `.seg.sm` button is 30 tall (kg/lb is 35x30); `.switch` 46x28
- Library: every filter chip is 34 tall (25 targets)
- topbar `.iconbtn` 40x40

Severity P1. Effort S to M.
Fix, as invisible hit-area growth with no visual change:
- Add `.restb, .tierbtn, .linkbtn, a.link { position: relative } .restb::after, .tierbtn::after, a.link::after { content: ""; position: absolute; inset: -10px -4px; }`. This gives at least 44 px of hit area without changing the look.
- `.stepper button { width: 44px }`; there is room at 79 px or more.
- `.iconbtn { width: 44px; height: 44px }`; `.iconbtn.sm { width: 40px; height: 40px }`.
- `.seg.sm button { min-height: 36px }`. For `.switch`, add `::after { inset: -8px }`.
- `button.n` stays visually 30 px but gets `::after { inset: -7px }`.

[ASK OWNER] Making chips 40 tall and `.btn.sm` 40 tall is a visible change, but it is the right one for sweaty thumbs.

**A11Y-7: Layout breaks at 200% zoom: the session scrolls sideways and text is crushed** (WCAG 1.4.10, 1.4.4)
Evidence: with `body.style.zoom=2` on 390 px (equivalent to 195 CSS px), `#/session` measured `scrollWidth 595 > 390`, and 30 elements in `.setrow` overflow. In `phone-zoom200-session.png`, "Warm up first" wraps one word per line, "Gym mode" is clipped, and the title shrinks to "Full…". Home stays within width (390).
Severity P1. Effort M.
Fix:
- `.setrow` grid (css:477): let the "previous" column collapse with `@media (max-width: 340px) { .set-hdr, .setrow { grid-template-columns: 30px 1fr 1fr 46px } .setrow .prev { display: none } }`. Because this is a width query it also fires under zoom.
- Warm-up card: put the Start/close buttons on their own row with `flex-wrap: wrap` and `.warm .btn { margin-inline-start: auto }`.
- `.sess-stats` row: `flex-wrap: wrap`.

**A11Y-8: Text ignores the user's font-size setting** (WCAG 1.4.4, practical)
Evidence: 144 `font-size: …px` declarations and 1 `rem`. Setting the root font to 32 px left `body` at 15.5 px and `h1` at 20 px (measured). Users who raise browser or OS text size (common among older lifters, and the reason Android Chrome's "text scaling" exists) get nothing. Page zoom still works, which is why this is P1 rather than P0.
Severity P1. Effort M (mechanical).
Fix: `body { font: 450 0.96875rem/1.45 var(--font) }`, then convert `font-size: Npx` to `N/16 rem` throughout app.css (a sed pass). Leave icon and box sizes in px. Check A11Y-7 again afterwards.

**A11Y-9: Focus is not managed on route change** (WCAG 2.4.3)
Evidence: after each `location.hash` change, `document.activeElement` is `BODY` on all 8 pages, and on `#/lib` the focus stays wherever it was. `document.title` does update ("Exercises · Gym"), which is good. A keyboard or screen-reader user who activates a nav link stays in the nav, and nothing announces that the page changed.
Severity P1. Effort S.
Fix: in the router (`main.js` near line 51, where `scrollTo(0,0)` runs), after render do `const h = $("#view h1, #tTitle"); h.tabIndex = -1; h.focus({ preventScroll: true })`. Skip this when the change was caused by a pointer click on the tab bar, if the ring looks odd; `:focus-visible` already hides it for pointer users.

**A11Y-10: Session thumbnail links have no name** (WCAG 2.4.4, 4.1.2)
Evidence: 6 unlabeled `<a>` on `#/session` (audit). `train.js:105` and `train.js:312` render `<a href="#/ex/…"><img alt=""></a>`, so screen readers say "link" with no destination.
Severity P1. Effort S.
Fix: `<a href="#/ex/${slug}" aria-label="How to do ${esc(e.name)}">`, the same pattern as `train.js:268`.

**A11Y-11: The sheet dialog has no accessible name; return focus is not guaranteed**
Evidence: `#sheet` (`index.html:67`) measured `role=null, aria-labelledby=null, aria-label=null` while open as "New workout". It is modal and focuses the input (`dlgI`), which is good. After closing, focus went to `BODY` in my run. The trigger had been activated with a synthetic click, so this is not conclusive, but nothing in `openSheet` stores or restores the opener explicitly.
Severity P1. Effort S.
Fix:
- In `openSheet` (`ui.js:~85`): `const opener = document.activeElement;`. Once the body is in place, `d.setAttribute("aria-labelledby", $("#sheetBody h3") ? (h3.id ||= "sheetT") : "")`.
- On `close`: `opener?.isConnected && opener.focus()`.

**A11Y-12: Toasts (including Undo) are unreliable for screen readers and time out** (WCAG 4.1.3, 2.2.1)
Evidence: `toast()` (`ui.js:136-142`) creates a new `div role="status"` that already contains its text and appends it. Many screen-reader and browser combinations do not announce a live region that arrives already filled. An Undo toast lasts 5 s and then the action is gone.
Severity P1. Effort S.
Fix:
- Keep one persistent `<div id="live" role="status" class="sr-only">` in `index.html` and set its `textContent` (clear it, then set it on the next frame).
- For toasts with an action, pause the timeout on `pointerenter`/`focusin`, and use `ms = Math.max(ms, 8000)`.

**A11Y-13: The mid-workout thumb zone puts key session actions at the top**
Evidence (`phone-session.png`, `phone-rest.png`): "Finish" (36 px tall, coral, the most prominent element) sits top-right, which is the hardest spot for a right thumb on a 6.1-inch phone. It is also visually louder than the per-set check that people actually use 20 or more times per session. On the rest overlay, Minimise is a 40 px chevron at the very top, though Skip/−15/+30 are well placed at the bottom.
Severity P1 (UX). Effort S.
Fix, [ASK OWNER]:
- Make `#finTop` a neutral `.btn.sm`, not `primary`, so coral stays reserved for the current set. Keep the confirm dialog.
- In `.rov`, let tapping the empty top area or swiping down minimise (as sheets already do), or add a "Hide" text button beside Skip.

### P2

**A11Y-14: Headings: duplicate H1, skipped levels.** `#/ex/*` has two H1s ("Smith Reverse Grip Bench" in the topbar and in the page). Home goes H1, then H3 "Build your first workout", then H2. Fix: render the topbar title as `<div class="h1" id="tTitle">` on detail pages, or `aria-hidden="true"` when the page has its own H1. Change the Home empty-state `h3` to `h2`. Effort S.

**A11Y-15: Search has no label.** `#q` (Library) has only a placeholder ("Search 842 exercises"), which disappears once the user types. Fix: `aria-label="Search exercises"`. Effort S.

**A11Y-16: Chip names run together.** The variant chips on the exercise page read as "Machinealt" and "Dumbbellalt", and muscle buttons as "Chest105" (audit). Fix: put a space before the inner `<small>`/`.n`, or add `aria-label="Machine (alternative)"` and `aria-label="Chest, 105 exercises"`. Effort S.

**A11Y-17: Repeated control names in the session.** There are 15 "Weight", 15 "Reps" and 15 "Set done" controls with identical names. Fix: `aria-label="Set ${n} weight, ${exName}"`, and so on, or wrap each exercise in a `<section aria-labelledby>` whose heading is the exercise name. Effort S.

**A11Y-18: No skip link.** There are 6 nav links before the content on every page, and 7 to 8 on desktop. Fix: `<a class="skip" href="#view">Skip to content</a>` as the first child of body, plus `.skip { position: absolute; inset-inline-start: 8px; top: -60px } .skip:focus { top: 8px }`, and `tabindex="-1"` on `#view`. It is invisible until focused, so the look does not change. Effort S.

**A11Y-19: Muted text on coral surfaces.** `.chip.on .n` measures 3.17 and `.hero-card.live .muted/.eyebrow` 3.51. Fix: `color: var(--accent-ink)` at 100% opacity on both lines (css:177, css:272), and show hierarchy with weight (500 vs 700) instead of alpha. Effort S.

**A11Y-20: White on coral is only just above 4.5.** `.btn.primary` and other filled coral surfaces measure 4.57, which a slightly off display gamma or direct sunlight erases. Optional hardening: give `--accent` a darker pressed/fill variant `#C8342B` (5.27 with white). [ASK OWNER] This visibly deepens the coral. Effort S.

**A11Y-21: The body map SVG is not keyboard reachable.** None of the 66 `path.m` are focusable or have a role. The muscle button list `button[data-m]` below the map is an equivalent that works, so this passes. Fix: hide the SVG from assistive tech (`aria-hidden="true"` on `.body-svg`) so screen-reader users are not sent into 66 unnamed paths, and keep the list as the accessible route. Effort S.

**A11Y-22: RTL: back and forward chevrons do not mirror.** In `phone-rtl-session.png` the layout mirrors correctly: logical properties, grid order, steppers. However the Back chevron still points left. Only `.gnav` has a mirror rule (css:741). Physical leftovers: `margin-left` at css:442 and css:487, and `left:` at css:184, 192, 442, 602. 184/192 are indicator positions set from JS offsets; 442/602 are centering, which is fine. Fix: `[dir="rtl"] #tBack svg, [dir="rtl"] .lrow > svg.i:last-child, [dir="rtl"] svg.i.chev { transform: scaleX(-1) }`; `.pr-t b i { margin-inline-start: 2px }`. Before shipping Arabic, also check that the JS indicator math in `ui.js:49` uses `offsetLeft` relative to the RTL origin. Effort S.

**A11Y-23: The sticky CTA covers body text.** On `#/ex/*`, the "Add to workout" pill sits over the description and step 1 (`phone-exercise.png`), and the tab bar overlaps step 2. The content does not reserve space for it. Fix: `.has-cta main#view { padding-bottom: calc(var(--tab-h) + var(--safe-b) + 84px) }`. Effort S.

**A11Y-24: Disabled buttons nearly disappear.** `.btn:disabled { opacity: .45 }` on primary measures 1.44 in light, and users cannot tell why the button is off. Fix: `.btn.primary:disabled { opacity: 1; background: var(--s3); color: var(--t3); box-shadow: none }`, plus a hint line explaining what is missing. Effort S.

**A11Y-25: Weak focus ring on some dark surfaces.** The `--accent` outline is 3.02 on `--s3` in dark, a bare pass, and 3.4 to 3.7 on s1/s2. Fix: `:focus-visible { outline-color: var(--accent-text) }` gives at least 6.1 in dark and 4.5 in light. Effort S.

**A11Y-26: Beginner wording.**
- The session header "PREVIOUS" with "—" means nothing on a first workout. Use "Last time".
- "S + A" and "S tier" assume users know the ranking. The `#tierInfo` "Jeff's ranking" explainer is a 24 px link.
- Fix: on first run, explain tiers with one line under the Library chips. Effort S.

---

## Things that are already good (keep them)
- Session inputs are `type=text` with `inputmode=decimal` for weight and `numeric` for reps, so the numeric keypad appears without spinners. Steppers and the check are 44 px or more, and Enter moves to the next field.
- The global `@media (prefers-reduced-motion)` kills transitions and animations; confetti, scroll and the 3D view all check `RM`.
- There are no browser `alert`/`confirm`/`prompt` calls; `ask()`/`askText()` use a native modal `<dialog>`.
- `--ctl` control borders were tuned to at least 3:1 (WCAG 1.4.11) on s1/s2.
- Every icon is `aria-hidden`, and icon-only buttons all carry an `aria-label`: 0 unlabeled buttons on 8 pages.
