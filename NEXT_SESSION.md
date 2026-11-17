Continue the "Gym" project in /home/ati/Attia-Pro/Projects/gym-y (app **Gym**, repo `gym`, https://mohamedattiadev.github.io/gym). Reply in Turkish.
Read PLAN.md first (statuses, "Notes (2026-11-17, session 3)", "Real-phone lessons"). Golden rule: very clean, simple, minimal scrolling, no emoji, no browser dialogs (ui.js ask/askText/toast). Design = soft coral reference (off-white, raised cards `--raise`, coral `#D93A31`, illustrations in app/illustrations inlined via `data-ill`).
Server: check `curl -sI localhost:8765 | head -1`; if down, run `cd app && python3 -m http.server 8765` in background.
Test: `node tools/test/shot.mjs <outDir> <steps.json>` (phone/ipad/desktop, waitFor first, zero console errors — the "navigator.vibrate blocked" LOG is a harmless test artifact; look at the PNGs). `{"seed":true}` is NOT implemented — to get a session use: go #/train → click [data-use] → click [data-start]. Use the session scratchpad for outputs. Bump sw.js VERSION on every release (now v10).

TOKEN RULE (owner): be economical. Do 2–3 blocks per session; then update PLAN.md statuses, rewrite this file (done / remaining / exact next step), commit, run `tools/handoff.sh` (opens a fresh session in a new kitty window) and stop. Accounts rotate automatically on rate limit via ~/.local/bin/ccx. Use few, focused subagents; avoid re-reading big files.

CAUTION: at the end of session 3, app/index.html had uncommitted splash-screen changes that session 3 did NOT make (another session or the owner). Don't revert them; ask the owner before committing them.

DONE (session 3): feedback 1–5 (Notes & alternatives tab, "S tier" + explainer, level bars + tags on cards, exact-movement figure audit 765→470, front+back muscle hero), Superset (session ⋯ menu).

NEXT, in order (cheap → expensive), report in Turkish after each block with what's left:
- 14 Strength standards ("you weigh X → aim for at least Y") + nutrition calculator + Jeff-based diet guidance + onboarding quiz (level, days, equipment → plan). 15 Plans explained (what/who/why/schedule/sets per muscle/progression; by level & split). First spawn ONE content subagent to write app/data/guide/{plans,nutrition,standards,onboarding,equipment}.json in en/tr/ar (spec PLAN §6).
- 16 Gym mode (one exercise per screen, big buttons, swipe, screen awake) + share workout summary as an image.
- 18 Realistic open-licensed anatomy SVG body map (front/back, ids from MUSCLES, `data-h` heads from app/data/guide/heads.json), tap → zoom with heads highlighted, Info tab first, Exercises tab grouped by head; modes Muscles | This week | Recovery (red <24h / yellow / green, 48–72h, "needs ~X more hours"). Subagent for the SVG (verify license, credit it).
- 19 3D tab on the exercise page hero (opengym3d MIT glbs + vendored three.js, offline, lazy-loaded only on that tab, only for exact-movement matches).
- 20 Warm-ups (PLAN §6b): general warm-up, ramp-up calculator, muscle primers, player (timer + Next), auto warm-up for the chosen workout, cool-down; visuals: exact-movement mannequin → 3D → short credited clip (yt-dlp --download-sections) linking the original. Content subagent writes app/data/guide/warmups.json.
- 21 i18n EN/TR/AR for the whole UI + picker + RTL (logical CSS); subagent translates. Voice guidance (§9b) later.
- 23 Performance: Lighthouse ≥ 95 mobile.
- 24 Media publishing: decide with owner how videos/posters/figures get published (re-hosting risk PLAN §6b); media lives in ./media (app/media is a symlink, not tracked); commit; ASK before `gh repo create gym --public` + push; enable Pages; verify install + offline on Android and iPhone.
Known content bug spotted: "2 Part High Elbow Row" how-to text describes a cable row, but the video is a chest-supported dumbbell row — fix that exercise's about/steps in the content data.
