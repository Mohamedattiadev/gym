# Click-through audit (Q0b, 2026-11-18)

Owner question: "does every button work?"

## How it was tested

`node tools/test/clickthrough.mjs <outDir>` (headless Chromium over CDP, no extra packages). all.sh runs the quick variant (`--quick`, phone light only, about 8 min; `SKIP_CLICK=1` skips it).

- 19 routes: `#/`, `#/lib`, `#/ex/barbell-bench-press`, `#/body`, `#/train`, `#/plan/ulf3`, `#/plans`, `#/me`, `#/guide`, `#/start`, `#/profile`, `#/standards`, `#/nutrition`, `#/warmup`, `#/videos`, `#/settings`, `#/timer`, `#/pick`, `#/session` (live workout), plus the top bar and the tab bar.
- Click runs on **phone 390 light** and **desktop 1440 dark**. Layout-only runs on **small 360 dark** and **laptop 1366 light**.
- On every page it clicks each button, link, chip, tab, switch and `<summary>`. Repeated cards are capped at 3 of each kind, and an option that is already selected is skipped. For every sheet a click opens, it also clicks the buttons inside that sheet (one level deep, up to 14). Confirm dialogs are answered with **Cancel**. External links are only checked for "new tab + rel=noopener" and are not opened.
- Each click records: console errors and exceptions, browser `alert/confirm/prompt` (the app must never use them), whether something changed (route, DOM, sheet, video state, file picker, download), and whether another element covers the button at its centre. It also records sideways overflow on each page and in each sheet, plus tap targets under 24 px (WCAG 2.5.8). Inline text links inside sentences, and elements with an invisible hit area, are exempt.
- Fake history: 6 finished sessions, so Me, Stats and Previous have data.

Totals: phone light 157 clicks on pages + 28 inside 20 different sheets; desktop dark 167 + 33 inside 22 sheets. 10–11 confirm dialogs were cancelled correctly.

## Result

| Check | phone light | desktop dark | small dark | laptop light |
|---|---|---|---|---|
| Console errors / exceptions | 0 | 0 | 0 | 0 |
| Browser dialogs (alert/confirm/prompt) | 0 | 0 | – | – |
| Buttons covered by another element | 0 | 0 | – | – |
| Page scrolls sideways / content sticks out | 0 | 0 | 0 | 0 |
| Sheet overflow | 0 | 0 | – | – |
| Dead buttons (real) | 1 | 1 | – | – |
| Tap targets < 24 px | 5 places | 5 places | 5 places | 5 places |
| External links without new tab / noopener | 0 | 0 | – | – |

"Dead?" hits that are **not** bugs: the Home tab while you are already on Home, and the one-time "Got it" tip on desktop (it does not come back after it is dismissed, which is correct).

### Real findings

1. **Finishing a workout with no sets ticked still saves an empty workout** (beginner persona). Finish -> "No sets are checked. Finish anyway?" -> Finish saves a session with 0 sets and 0 kg. That session then counts in history, the calendar and streaks. Fix: when nothing is ticked, show "Nothing was logged. Discard this workout?" with **Discard** and **Keep going**, and never save a session that has 0 done sets. -> **Q0c**
2. **Zoom out does nothing at full-body zoom** (`#/ex/*` Muscles hero, `button[data-z=0.7]`, phone and desktop). Fix: disable it (`disabled` + dim) while the view is already at the minimum zoom, the same way "Move up" is disabled on the first item. -> **Q0d**
3. **Tap targets under 24 px** (same on all 4 viewports). -> **Q0d**
   - Me > Progress: exercise name links, 136×17 px
   - Me > Profile: "Strength goals" 95×20 and "Nutrition" 57×20 links
   - Me > Settings: "How it works" (lock screen) 77×15, "not protected — tap to protect" 179×15
   - Warm-up: "Sources" `<summary>` ×20 px tall, and the source links inside it, 16 px tall

   Fix: `min-height: 44px` (or padding plus an invisible hit area, as in A11Y-6) on these links and the summary.

### Persona runs

**Beginner, first open to first workout (phone light).** Steps: onboarding -> Beginner (moves on automatically) -> Next -> Skip "About you" -> result "Full Body, Recommended" -> Use this plan -> Home -> Start workout -> tick set 1 without a weight -> Finish. Everything worked, with no errors.

- Ticking a set with no weight shows the toast "Type the weight first (0 = bodyweight)" and highlights the kg box. This is clear.
- Finish with nothing ticked asks first, but then saves an empty workout (finding 1).
- Question for the owner (content, not a bug):
  - For a beginner, "Also good for you" lists an **Intermediate** plan (Upper / Lower / Full) first.
  - The beginner Full Body A starts with **Belt Squat**, a machine many gyms do not have. A barbell or goblet squat may be a better first exercise.

**Lifter logging one-handed (phone dark, with history).** One tap on Previous ("60 × 8") fills set 1, ticks it and opens the rest screen. The rest screen shows "Next: Belt Squat, Set 2 of 3 · 60 kg × 9 reps", with large −15 s / +30 s / Skip rest buttons in the lower half. Under the active set there is a 48×44 stepper, and the check button is 46×44. The only control at the very top is **Finish** in the top bar, which is hard to reach with the thumb. The same action is also at the bottom of the workout ("Finish workout"), so it is fine.

## Limits of the script

- The app state is not reset between clicks. After an earlier click changes the page (filters, a set ticked, onboarding step), some buttons are no longer there; those are listed as "gone after earlier clicks", not as failures. Each page still gets every kind of button pressed at least once.
- Long-press (plate calculator), drag (sheets, 3D) and typing are not covered. The unit tests, check3d and the persona runs cover those.
- Sound, vibration and clipboard cannot be seen in headless Chromium.
