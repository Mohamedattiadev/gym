# User-tester review: Gym PWA

Date: 2026-11-17 · Build: main @ 41b8f43 (sw v38) · Method: headless Chromium via `tools/test/shot.mjs`, fresh profile per run, 7 scripted runs.
Screenshots: `/home/ati/tmp/claude-1000/-home-ati-Attia-Pro-Projects-gym-y/2267b158-3310-45db-8424-ba89939a2ba2/scratchpad/testers/r2/` (written as `r2/<file>` below).

## Summary

Five personas went through the main flows. The core loop of choosing a plan, starting it, ticking sets, resting and finishing works, and it is fast. The biggest risks are in the workout itself:
- You can tick a set that has no weight, and nothing warns you.
- One tap on the red Finish button ends the workout and silently throws away every set you did not tick.
- The "Notify you when rest ends?" toast sits on top of the next set you need to log.

Search has a ranking problem: results are sorted by tier, not by how well the name matches. Desktop users searching "bench" only see preacher curls. Turkish search works better than expected; only gaps and ranking problems are left. The known issues listed in the brief were skipped.

| ID | Persona | Finding | Sev | Effort |
|---|---|---|---|---|
| UT-1 | Beginner | Finish ends the workout at once and silently drops every unticked set (only asks if 0 sets are ticked) | P1 | S |
| UT-2 | Beginner | A set can be ticked with an empty kg box; the summary then shows "0 kg volume" with no hint | P1 | S |
| UT-3 | Intermediate / all | The "Notify you when rest ends? Allow" toast covers the next set row and does not go away | P1 | S |
| UT-4 | Desktop | Search ranks by tier, not by name match: "bench" shows 8 preacher curls and no bench press | P1 | M |
| UT-5 | Desktop / all | There is no plain flat "Barbell Bench Press" in the library | P2 | S |
| UT-6 | Beginner | Pressing "Use plan" twice adds the workouts twice (4 workouts, two named "Full Body A") | P2 | S |
| UT-7 | Intermediate | The minimised rest pill covers the Warm-up / Swap buttons and the next exercise name | P2 | S |
| UT-8 | Intermediate | When you scroll the workout, cards show through the gap between the sticky header and the stats strip | P2 | S |
| UT-9 | 55+ | Me > This week shows a big "0" with a red "↓ 6,275" underneath; it reads like a loss or an error | P2 | S |
| UT-10 | 55+ | Settings icons don't match their rows: Sound has a lightning bolt, Units has a "?" badge | P2 | S |
| UT-11 | 55+ | In segmented controls (Theme, Equipment, Units, Bar weight) the selected option is only a slightly whiter pill | P2 | S |
| UT-12 | Turkish | "barfix" (a common spelling) finds 0; "karın" (abs) shows Abductions / Lat Row first; "ön kol" (forearm) shows curls and shrugs | P2 | M |
| UT-13 | Beginner | The Finish sheet opens with a red focus ring on "Share", which looks like an error | P2 | S |

## Findings

**UT-1 Finish discards unticked sets without asking (P1, S)**
- Steps: start Full Body A (15 sets), tick 2 sets, tap the red Finish button at the top right.
- What happened: the workout is saved right away as 2 sets. The other 13 are gone, with no confirmation and no undo. Finish sits next to Back, so a mis-tap ends the workout.
- Expected: something like "13 sets not done. Finish anyway?", or an Undo toast.
- Screenshots: `r2/phone-p1-06-two-sets.png`, `r2/phone-p1-07-finish.png`
- Fix: in `finishSession()` (train.js:486), ask whenever some sets are unticked, not only when none are ticked.

**UT-2 A set with no weight can be logged (P1, S)**
- Steps: in a first-ever session the kg box only shows the placeholder "kg". Tick the set without typing a weight.
- What happened: the set turns green. The workout ends with "2 Sets · 0 kg volume · 0 PRs", and the beginner never learns that the weight was never recorded.
- Expected: tapping ✓ on an empty kg box (for a weighted exercise) focuses the kg box, or asks "No weight. Bodyweight?"
- Screenshots: `r2/phone-p1-04-session.png`, `r2/phone-p1-07-finish.png`
- Fix: a guard in the done handler. [ASK OWNER] whether to block the tick or just nudge.

**UT-3 The notification-permission toast covers logging (P1, S)**
- Steps: tick the first set and minimise the rest overlay.
- What happened: the dark "Notify you when rest ends? Allow" toast sits in the middle of the screen, over set 3's kg and reps boxes. It is still there 7 s later after scrolling, and it has no close button. On desktop it covers the next exercise's kg box.
- Expected: a short-lived or dismissible prompt that does not cover inputs.
- Screenshots: `r2/small-p2-02-minimised.png`, `r2/small-p2-04-scrolled.png`, `r2/laptop-p5-08-help.png`
- Fix: add an × and auto-hide it, or move it into the rest overlay or the finish sheet. [ASK OWNER] where it should live.

**UT-4 Search ranking ignores the name (P1, M)**
- Steps: press Ctrl+K (or open Exercises) and type "bench".
- What happened: the top 8 results are all preacher curls ("Poor Mans Preacher", "EZ Bar Preacher Curl"...). Incline and close-grip bench press do not show up in the palette at all.
- Expected: results whose name contains the search word come first, then other matches.
- Screenshot: `r2/laptop-p5-03-palette-bench.png`
- Fix: in `searchEx` (data.js:73), sort name matches before tier, then keep tier order within each group. The same root cause explains part of UT-12.

**UT-5 No flat barbell bench press (P2, S)**
- What happened: the library has Incline, Close-Grip, Flat Dumbbell and Smith Reverse-Grip bench presses, but no standard flat barbell version. Many users will look for it first.
- Fix: [ASK OWNER] add it, or map the name "bench press" to the closest exercise.

**UT-6 "Use plan" twice duplicates the workouts (P2, S)**
- Steps: on Train, tap Use plan, scroll back down, tap Use plan again.
- What happened: you get 4 workouts, with two identical "Full Body A" and "Full Body B".
- Expected: "Already added" (or a replace prompt), or the button changes to "In use".
- Screenshot: `r2/phone-p6-01-twice.png`

**UT-7 The rest pill covers controls (P2, S)**
- What happened: on a 360 px phone the minimised rest pill (1:59 ⏸ +30 ×) covers the Warm-up and Swap buttons and half of the next exercise name. Nothing scrolls far enough to clear it.
- Screenshots: `r2/small-p2-02-minimised.png`, `r2/small-p2-03-gym.png`
- Fix: add bottom padding to the session view equal to the pill height while the pill is shown.

**UT-8 Sticky header gap shows content behind it (P2, S)**
- Steps: scroll a workout down by about 2 exercises.
- What happened: parts of the previous card ("kg 12", a ✓ box) show through above the TIME/sets/kg strip and behind the title bar, so it looks like overlapping layers.
- Screenshot: `r2/small-p2-04-scrolled.png` (top 300 px)
- Fix: give the sticky stats strip a solid background and join it to the top bar with no gap.

**UT-9 The "This week" delta reads as a loss (P2, S)**
- Steps: have workouts last week but none yet this week (it is Tuesday), then open Me.
- What happened: the tiles show "0 Volume kg" with a red "↓ 6,275" under it. A 55+ tester read this as "I lost 6,275 kg" or "something broke".
- Expected: wording like "6,275 last week", or hide the deltas until there is a workout this week.
- Screenshot: `r2/phone-p3-02-me-dark.png`
- Fix: [ASK OWNER] the wording. Also, "Hard sets" was unclear to the tester.

**UT-10 Settings icons don't match their rows (P2, S)**
- What happened: Sound uses a lightning bolt (the same icon as Intervals), and Units uses a "?" badge. Users who read by icon can't find Sound.
- Screenshot: `r2/phone-p3-05-settings-light.png`
- Fix: use a speaker icon for Sound and a scale/ruler icon for Units.

**UT-11 The selected segment is hard to see (P2, S)**
- What happened: in Theme (Light/Dark/Auto), Full gym/Dumbbells/Home, kg/lb and 20/15/10, the chosen option is only a white pill with a hairline border on a light grey track. A low-vision tester could not tell which option was active, in light or dark mode.
- Screenshots: `r2/phone-p3-05-settings-light.png`, `r2/phone-p3-05-settings-dark.png`
- Fix: [ASK OWNER] use a stronger selected state (bold text, accent border or accent fill).

**UT-12 Turkish search gaps (P2, M)**
- What worked: "göğüs presi" gives machine chest presses, "barfiks" gives pull-ups, "şınav" gives push-ups, "bacak" gives squats, and "kalça" gives glutes.
- What failed:
  - "barfix" (a very common spelling) finds 0.
  - "karın" (abs) puts Abductions and Seated Lat Row ahead of Cable Crunches.
  - "ön kol" (forearm) gives a curl, shrugs and a row.
  - "sırt" (back) starts with Y Raise, which is a shoulder exercise.
  - "göğüs" lists "2 Part High Elbow Row" in the top 4.
- Screenshots: `r2/phone-p4-01-gogus.png`, `r2/phone-p4-02-barfiks.png`, `r2/phone-p4-03-dambil.png`
- Fix: add the synonyms barfix, karın→abs and ön kol→forearms, and rank by muscle group or name before tier (see UT-4).

**UT-13 The Finish sheet looks like it shows an error (P2, S)**
- What happened: the "Workout complete" sheet opens with a thick red focus ring around Share. On a phone it looks like an error highlight or a pre-selected choice.
- Screenshot: `r2/phone-p1-07-finish.png`
- Fix: put initial focus on Done or on the sheet itself, and show the ring only for keyboard users (`:focus-visible`).

## What felt good
- Going from first open to logging a set takes 3 taps: Use plan, ▶, ✓. The "Added 2 workouts" toast and the "Up next: Full Body B" card after finishing made the plan feel real (`r2/phone-p1-03-plan.png`, `r2/phone-p1-08-after.png`).
- The rest overlay is clear and large. It shows the next exercise, set and weight, and has big −15 / +30 / Skip buttons (`r2/phone-p1-05-after-set1.png`).
- Keyboard logging on a laptop works smoothly: in the kg box, Enter moves to reps; in reps, Enter ticks the set and jumps to the next kg box; ↑ adds one weight step; Esc minimises rest. The side panel ("Now: Set 2 of 3 · 62.5 kg × 10") is very useful (`r2/laptop-p5-08-help.png`).
- Ctrl+K opens instantly, shows shortcut hints, and the sidebar shows the 1–5 / "," keys.
- Gym mode ("Exercise 1 of 6" with large arrows) is easy to use with one hand. The ✓ buttons sit on the right, in easy thumb reach.
- Dark mode is consistent, with no unreadable text found. Body text and labels are large.
- No console errors in any run apart from the harmless vibrate warning.
