# Security & privacy review: Gym PWA

**Reviewer:** security/privacy reviewer (25 yrs) · **Date:** 2026-11-17 · **Scope:** `app/` at `b44b621` (XSS sinks, CSP, embeds, sync token, service worker, secrets, licenses, media rights). Read-only; commands are quoted so each claim can be re-run.

## Summary
1. **Media rights are the biggest risk.** The 832 videos and posters in `app/media` come from the Get SWOLE private API, fetched with the owner's own login. PLAN §8 says to publish them on public Pages. Do not deploy `app/media` until the owner decides (SEC-1).
2. **Shared origin.** `mohamedattiadev.github.io` already hosts 9 other Pages sites. Every one of them can read the GitHub PAT in IndexedDB and overwrite Gym's service-worker caches (SEC-2). Fix this before the first deploy (no git remote exists yet; `/gym/` returns 404).
3. **Escaping is correct for typed input.** It is not correct for imported data. `esc()` is complete (`ui.js:6` escapes `& < > " '`), and names and notes are escaped. But a backup JSON or a synced repo file can inject HTML through `settings.unit`, workout and session ids, and raw set values (SEC-3).
4. **There is no CSP.** A meta CSP is easy here: one inline script (hash below), 2 inline `onerror` handlers, WASM for meshopt, YouTube frames (SEC-4).
5. **The rest is hygiene.** No secrets are in the repo or its history. `raw/.token` is ignored. The token is never put in the backup. YouTube uses `youtube-nocookie` and loads only on click. Gaps: iframe attributes, a privacy line, the Inter OFL text, credits (SEC-5..8).

| ID | Title | Sev | Effort |
|---|---|---|---|
| SEC-1 | Exercise videos/posters scraped from Get SWOLE would be re-published publicly [ASK OWNER] | P0 | M |
| SEC-2 | Shared `*.github.io` origin: 9 other sites can read the PAT and poison SW caches [ASK OWNER] | P1 | M |
| SEC-3 | Imported/synced data reaches `innerHTML` unescaped (unit, ids, set values); no import schema check | P1 | M |
| SEC-4 | No Content-Security-Policy | P1 | S |
| SEC-5 | Sync token: plaintext at rest, localStorage copy, no "token age" hint | P2 | S |
| SEC-6 | YouTube iframes: no `referrerpolicy`/`sandbox`, no privacy note | P2 | S |
| SEC-7 | Licenses/credits incomplete (Inter OFL text, body-highlighter, meshoptimizer, Get SWOLE) | P2 | S |
| SEC-8 | Re-hosted creator clips (PLAN §6b) need a takedown plan [ASK OWNER] | P2 | S |

---

### SEC-1: Get SWOLE media would be re-published (P0, M) [ASK OWNER]
**Evidence:** `tools/fetch_exercises.sh:2-7` logs into `train.getswole.app/api/v4` with the owner's account. It uses a spoofed Android client (`okhttp/4.12.0`, `CLIENT-VERSION: 5.31.0`) and saves `raw/.token`. `tools/download_media.sh:2` "Downloads each exercise video from Mux" and re-encodes it into `media/video/*.mp4` and `poster/*.jpg` (`ls app/media/video | wc -l` → 832). PLAN.md:99 credits "demo videos © … (Get SWOLE)". PLAN.md §8 (line 103) says to `mv media app/media` for deploy. Today, `.gitignore:11` (`app/media`) keeps the files out of the Actions artifact (`.github/workflows`, `path: app` after `checkout`), so nothing has leaked yet.
**Impact:** Public redistribution of a commercial app's paid content. This is copyright infringement and almost certainly breaks Get SWOLE's ToS (API scraping with a spoofed client). A DMCA notice to GitHub can take down the repo, and repeated notices put the whole account at risk. The text in `data/exercises.json` (fields `note`, `v`) may come from the same source; verify this.
**Fix:** Keep `app/media` out of any public deploy: leave it in `.gitignore`, and add a check in `tools/test/all.sh` that fails if `git ls-files app/media` is non-empty. Options for the owner: (a) private use only (local or self-hosted behind auth); (b) replace with open media (open-exercise-figures CC0 and the 3D body, which are already in the app) and keep the Video tab only where a licence exists; (c) get written permission from Get SWOLE. Remove "Get SWOLE" from public credits unless (c) happens.

### SEC-2: Shared origin with the owner's other Pages sites (P1, M) [ASK OWNER]
**Evidence:** `gh api '/users/mohamedattiadev/repos?per_page=100' --jq '.[]|select(.has_pages)|.name'` lists ATI-OS, AtiDocs, aybu-seng-guide, dev-101, excalidraw-vault, fluent365, igrek, mohamedattiadev.github.io, onclack-styles. All of them are served from `https://mohamedattiadev.github.io`, which is one origin. IndexedDB `gymy` (`store.js:1,62`, key `sync` holds `token`), localStorage and Cache Storage are scoped per origin, not per path. `sw.js:84` serves `cache.match(key)` from `gym-shell-v38` with no integrity check.
**Impact:** Any script on any of those 9 sites can do two things. First, it can read `S.sync.token` from IndexedDB `gymy` (read/write on the private backup repo; health data). Second, it can run `caches.open("gym-shell-v38").then(c => c.put(".../gym/js/main.js", evil))`, which gives persistent code execution inside Gym, offline, on every launch, until the next VERSION bump. Such a script could be an XSS, a compromised npm or CDN dependency, or a mistaken commit. The SW scope (`/gym/`) does not protect against this.
**Fix (pick one before the first deploy):** (a) give Gym its own origin with a custom domain (`app/CNAME` → `gym.<owner-domain>`, Pages "Enforce HTTPS"); (b) host it on a separate account or org (`<name>.github.io`) or another static host with its own subdomain. There is no in-app fix that defends the caches. Until then, keep cloud sync off on the shared origin, or show a warning in the Cloud backup card.

### SEC-3: Imported/synced data rendered without `esc()` (P1, M)
FE-24 covers the general convention; this finding is the concrete exploit path and the boundary fix.
**Evidence:** `importData` (`store.js:85-91`) does `Object.assign(S, …, d, …)` with every key and value from the file. Sync `merge()` copies every remote key (`sync.js:110`), and `applyData` writes them into `S` (`sync.js:213-219`). CSV import is safe: slugs are checked against `BY` (`csv.js:122,128`) and weights and reps go through `num()`. Values from backups and sync reach these sinks raw:
- `S.settings.unit` (25 unescaped uses; `grep -n "settings.unit\|const u = " app/js/*.js`), for example `home.js:44`, `exercise.js:384-386`, `guide.js:46`, `timer.js:115`.
- Workout and session ids in attributes and hrefs: `train.js:60,62` (`href="#/workout/${w.id}"`, `data-start="${w.id}"`), `home.js:30`, `me.js:128` (`data-del="${s.id}"`).
- Set values: `nextInfo` passes `s.w`/`s.r` as raw strings (`train.js:438-441`) into `timer.js:115` → `innerHTML` (`load`). Imported nutrition fields (`guide.js:130-131`, `value="${n.age}"`).

Payload: a backup with `"settings":{"unit":"<img src=x onerror=alert(1)>"}` runs script on Home. The attack is realistic: "here is my program, import it", or anyone with write access to the sync repo. Through SEC-2, the script can then steal the PAT.
**Fix:** (1) Validate at the boundary with one `sanitize(d)` in `store.js`, used by `importData` and `applyData`. It should allowlist the top-level keys (`Object.keys(DEFAULTS)` plus `schema`, which also stops `__proto__`). It should check that `unit ∈ {kg, lb}`, that ids match `/^[\w-]{1,40}$/` (otherwise call `uid()`), that `slug ∈ BY` (otherwise drop the entry), that `w`/`r` match `/^\d{0,4}([.,]\d{1,2})?$/`, and that settings numbers are `Number.isFinite`. It should also reject `schema > SCHEMA` (FE-26). (2) Also wrap the sinks above in `esc()`, as defence in depth. (3) Add an all.sh unit test that imports a hostile fixture and asserts that `sanitize` output contains no `<`.

### SEC-4: No CSP (P1, S)
**Evidence:** `grep -n "Content-Security" app/index.html` returns nothing. `curl -sI` cannot show headers yet (404), and GitHub Pages cannot set headers, so a `<meta>` tag is the only option. Inventory: 1 inline script (`index.html:9`, `sha256-6wmdB1FspUaoYNJelae5BtBEIbLaQuDJTwUJIiGi054=`); 2 inline `onerror=` attributes (`home.js:29`, `train.js:61`); 213 `style="` attributes; meshopt calls `WebAssembly` (`vendor/three/meshopt_decoder.module.js`, 4 hits; `useWorkers` is never called); frames from `www.youtube-nocookie.com`; fetch to `api.github.com`; `blob:` for the share PNG download.
**Fix:** Move the 2 `onerror` handlers to one delegated `error` listener (capture phase) in `main.js`. Then add this as the first child of `<head>`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-6wmdB1FspUaoYNJelae5BtBEIbLaQuDJTwUJIiGi054='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self' https://api.github.com; frame-src https://www.youtube-nocookie.com; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
```
This blocks inline-handler payloads (SEC-3) and limits exfiltration to `api.github.com`. Add a check to all.sh that recomputes the splash hash, and run the route smoke test (19 pages, zero console errors) to catch any CSP violation. `frame-ancestors` is ignored in a meta CSP, so clickjacking stays possible. That is low risk here because the app has no state-changing one-click actions.

### SEC-5: Sync token handling (P2, S)
**Evidence:** The token is stored in plaintext in IndexedDB key `sync` (`sync.js:2,250`). The localStorage fallback writes the whole `S`, token included (`store.js:67`, already FE-26). The good parts: `exportData` drops `sync` (`store.js:80`), `buildBackup` deletes it again (`sync.js:43`), `pushOnce` refuses to upload if the token string is found in the payload (`sync.js:291`), `merge` never imports `sync` (`sync.js:129`), the input is `type=password autocomplete=off` (`me.js:264`), the app checks the repo is private before connecting (`sync.js:238`), and `SYNC.md:15-26` asks for a fine-grained token limited to one repo with Contents RW only.
**Fix:** Fix FE-26 (keep the token out of `gymy2`). In SYNC.md step 5, recommend 90 days instead of "1 year". Store `connectedAt` and show "token is N days old" in the card. Encryption at rest adds nothing without a user secret, so skip it. The real fix is SEC-2 plus SEC-3/4.

### SEC-6: YouTube embeds (P2, S)
**Evidence:** Embeds use `youtube-nocookie` (`main.js:381`, `exercise.js:302,364`, `warmup.js:129`) and load only after a tap (facade). None of them has `referrerpolicy` or `sandbox`. The Me page does not say that playing a video contacts Google.
**Fix:** Add `referrerpolicy="strict-origin-when-cross-origin"` (do not use `no-referrer`, which makes YouTube refuse to play) and `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"` to all 4 templates, ideally through one `ytFrame(id, opts)` helper in ui.js. Add one sentence to the credits: "Videos play from YouTube (privacy-enhanced mode) only when you tap them."

### SEC-7: Licenses and credits (P2, S)
**Evidence:** The licence texts that are present are `app/3d/LICENSE` (OpenGym3D MIT), `app/vendor/three/LICENSE`, the meshopt MIT header, the react-native-body-highlighter MIT header (`anatomy.js:1-5`), and `vendor/licenses/illustrations.txt` (original artwork). Missing: the Inter font licence (SIL OFL 1.1 requires it to travel with the font) and credits in `me.js:175-176` for body-highlighter, meshoptimizer and Inter. "Demo videos © their creators" is vague (see SEC-1).
**Fix:** Add `vendor/licenses/Inter-OFL.txt`. Extend the credits line: "Body map: react-native-body-highlighter (MIT) · Font: Inter (OFL 1.1) · meshoptimizer (MIT)". Add a "Licenses" link to `vendor/licenses/`.

### SEC-8: Re-hosted clips from creators (P2, S) [ASK OWNER]
**Evidence:** In PLAN.md:94-95 the owner decided to cut and host segments of Jeff's and other experts' videos; the risk is already noted there. Today, downloading is blocked and the app uses timestamped embeds (PLAN.md:211, `warmup.js:129`), which is the safe option.
**Fix:** Stay with embeds on the public build. If clips are hosted, keep them short, add credit and a link on each one (already done in `warmup.js:130`), and keep a one-line switch (`clip.local=false`) so all clips can fall back to embeds within minutes of a takedown.

---

## What is already good
- `esc()` covers all five characters. User-typed names, notes, CSV names (`me.js:247`), GitHub error messages (`me.js:267`) and the error page (`main.js:56`) are escaped, and `toast` uses `textContent` (`ui.js:139`).
- Hash routing only looks up `BY[slug]` and `S.workouts.find(id)`. Route params are never written into HTML (`exercise.js:106-107`, `train.js:101`).
- Share image is drawn on a canvas (`share.js`), so it has no HTML sink.
- No secrets in the repo: `git ls-files | grep -iE 'token|secret|\.env|key'` matches only docs and placeholders, and `git log --all -p | grep -cE 'ghp_…|github_pat_…'` returns 0. `.gitignore` covers `raw/`, `.token`, `*.token`, `.env*`, and `git check-ignore raw/.token` passes.
- All `target="_blank"` links have `rel="noopener"` (0 without). There is no `eval`/`new Function`. Sync talks only to `api.github.com` with `cache: "no-store"` and the API version header.
- The service worker ignores cross-origin and non-GET requests (`sw.js:60-62`), uses versioned shell caches, and requests the precache with `cache:"reload"`.
- Sync design: the app refuses public repos, merges without losing data, and has a leak guard. The token never leaves the device in backups.
