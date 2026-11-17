# Gym

A free, offline gym guide (PWA) that I built for myself and for anyone who wants a clear, simple way to train.

Live: https://mohamedattiadev.github.io/gym

## Why this exists

I trained with the **Get SWOLE** app and learned a lot from **Jeff Nippard**. Get SWOLE has a huge exercise
library with great demo videos, but for me it was confusing to find the right exercise and to know which one is
actually worth doing. Jeff Nippard's tier lists answer exactly that question: which exercises are the best for each
muscle, and why.

So this project is my personal guide: a **combination** of the two, built around how I like to train.

- the exercise demos come from Get SWOLE,
- the rankings (S / A / B / C tiers) and the training ideas come from Jeff Nippard,
- and I added the parts I was missing: a body map, plans for each level, a simple workout logger, rest timer,
  warm-ups, common mistakes, a 3D body view and progress tracking, all in one clean app that also works offline.

It is a non-commercial, personal project. It is **not affiliated with, endorsed by, or sponsored by** Get SWOLE,
Jeff Nippard, or any other person or company named below. If you like this, please support the original creators:
use their apps, watch their videos, buy their programs.

## Use it

Open the site on your phone, then use the browser menu and choose **Add to Home Screen** / **Install app**.
Then open **Me > Settings > Offline videos** once on Wi-Fi so it also works without signal.
Your data stays on your device (IndexedDB). Use **Settings > Backup** to export it.

## Credits and rights

Everything below belongs to its owners. All rights reserved by them. Thank you.

| What | Owner | Link |
| --- | --- | --- |
| Exercise demo videos, posters and exercise names | **Get SWOLE** and the coaches shown in the videos | [getswole.app](https://getswole.app) · [Google Play](https://play.google.com/store/apps/details?id=app.getswole.train.own) |
| Exercise tier rankings (S / A / B / C), training principles, split and volume guidance | **Jeff Nippard** | [YouTube](https://www.youtube.com/@JeffNippard) · [jeffnippard.com](https://www.jeffnippard.com) |
| Training volume / recovery ideas (weekly sets, landmarks) | **Renaissance Periodization (Dr. Mike Israetel)** | [YouTube](https://www.youtube.com/@RenaissancePeriodization) |
| Embedded technique videos (played from YouTube) | their channels, mainly Jeff Nippard | YouTube |
| 3D body and motion clips | **OpenGym3D**, Sylvester Assiamah (MIT, MakeHuman mesh) | [github.com/AssiamahS/opengym3d](https://github.com/AssiamahS/opengym3d) |
| Body map shapes (front / back muscles) | **react-native-body-highlighter**, ELABBASSI Hicham (MIT, modified) | [github.com/HichamELBSI/react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter) |
| Muscle animation figures | **open-exercise-figures** (CC0) | [github.com/AbanoubAmir/open-exercise-figures](https://github.com/AbanoubAmir/open-exercise-figures) |
| 3D rendering | **three.js** (MIT) and meshoptimizer decoder (MIT) | [threejs.org](https://threejs.org) |
| Font | **Inter**, Rasmus Andersson (SIL Open Font License 1.1) | [rsms.me/inter](https://rsms.me/inter/) |
| Illustrations | original artwork made for this project | `app/vendor/licenses/illustrations.txt` |

Their license files are kept next to their code: `app/3d/LICENSE`, `app/vendor/three/LICENSE`,
`app/vendor/licenses/`, and the credit block in `app/js/anatomy.js`.

**Are you one of the owners and want something changed or removed?** Open an issue on this repository and I will
change or remove it right away, no questions asked.

## License

The **code I wrote** for this app (HTML, CSS, JavaScript, tools, and the written guide texts I made) is released under
the [MIT License](LICENSE), so anyone can learn from it, use it, and build their own version.

The MIT License does **not** cover third-party content. The demo videos, posters, exercise names, Jeff Nippard's
rankings and ideas, and the other works listed in *Credits and rights* stay the property of their owners under their
own terms. If you fork this project, you need your own rights for that content.

## Layout
```
app/                     the website (GitHub Pages publishes this folder)
  index.html css/ js/ sw.js manifest.webmanifest icons/ fonts/
  data/exercises.json    exercise list (built)
  data/families.<lang>.json  how-to texts per language (built)
  data/guide/            warm-ups, plans, sub-muscles, nutrition ...
  3d/                    3D body (OpenGym3D) + our motion poses
media/                   videos, posters, mistake clips, figures (copied into app/media on deploy)
tools/
  build_data.py          builds app/data/*.json (python3 -I tools/build_data.py)
  merge_content.py       group fixes, content merge, machine detection
  download_media.sh      video download/re-encode (resumable)
  test/all.sh            every automated check (unit tests, routes, 3D poses)
  test/shot.mjs          headless Chromium screenshots + console errors
```

## Run locally
```
ln -s ../media app/media                  # once
cd app && python3 -m http.server 8765     # http://localhost:8765
```
