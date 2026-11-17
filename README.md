# Gym

Offline gym guide (PWA) by Mohamed Attia: exercise library with looping demo videos, Jeff Nippard tier rankings,
body map, workouts, timers and progress tracking. Plain HTML/CSS/JS, no build step.

Live: https://mohamedattiadev.github.io/gym

## Use it
Open the site on your phone, then use the browser menu and choose **Add to Home Screen** / **Install app**.
Then go to **Me, Settings, Offline videos** once on Wi-Fi so it also works without signal.
Your data stays on your device (IndexedDB). Use Settings, Backup to export it.

## Layout
```
app/                     the website (GitHub Pages publishes this folder)
  index.html css/ js/ sw.js manifest.webmanifest icons/ fonts/
  data/exercises.json    exercise list (built)
  data/families.<lang>.json  how-to texts per language (built)
  data/guide/            warm-ups, plans, sub-muscles, nutrition ...
  media/                 videos, posters, figures
tools/
  build_data.py          builds app/data/*.json (python3 -I tools/build_data.py)
  merge_content.py       group fixes, content merge, machine detection
  download_media.sh      video download/re-encode (resumable)
  test/shot.mjs          headless Chromium screenshots + console errors
```

## Run locally
```
cd app && python3 -m http.server 8765   # http://localhost:8765
```

## Credits
App (c) Mohamed Attia, all rights reserved. Exercise rankings and coaching philosophy: Jeff Nippard.
Demo videos (c) their creators and the coaches shown in them.
