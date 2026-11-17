# Backend / data review

Reviewer: backend/data engineer · Date: 2026-11-17 · Scope: `app/js/store.js`, `app/js/sync.js` + `SYNC.md`, backup export/import, `app/js/csv.js`, `app/data/*.json`, storage quota/persistence, multi-tab, crash, schema change, active-session integrity. Read-only; measured with headless Chromium (CDP) and Node scripts kept in the session scratchpad (`idbtest2.js`/`idbrun.mjs`, `merge.mjs`, `size.mjs`).

## Summary
1. The FE-5 fix works for request errors, but **a transaction that aborts at commit (QuotaExceeded) never settles**. `flush()` hangs, the dirty keys are already cleared, there is no retry and no toast, so data is lost silently (BE-1).
2. **Two tabs or windows overwrite each other's whole keys**: each tab holds its own copy of `S` and nothing syncs them (BE-2).
3. The cloud merge **drops pain flags and plateau-adjust history** on restore and on conflicts, because empty `{}` defaults win (BE-3).
4. If IndexedDB fails at load, the app **starts empty with no warning** and writes to a localStorage copy that is thrown away on the next good load (BE-4).
5. A Strong CSV with no unit column is imported **without unit conversion** (2.2x wrong weights), and timed or distance sets are silently dropped (BE-5).

| ID | Title | Sev | Effort |
|---|---|---|---|
| BE-1 | `tx()` has no `onabort`: a quota or commit abort hangs `flush()`, keys are lost silently | P1 | S |
| BE-2 | Multi-tab: a stale in-memory `S` overwrites another tab's writes (whole-key last-writer-wins) | P1 | S |
| BE-3 | `merge()` drops cloud `pain` and `adjust` (empty local `{}` wins) | P1 | S |
| BE-4 | IndexedDB open failure at load: silent empty app and a discarded localStorage branch | P1 | S |
| BE-5 | CSV import: no unit column means no conversion; timed/distance sets dropped uncounted | P1 | S |
| BE-6 | Schema versioning: no migration ladder; sync accepts newer-schema data; no `onversionchange` | P2 | S |
| BE-7 | `loadStore` reads keys and values in two transactions (index misalignment) | P2 | S |
| BE-8 | Notes merge concatenates on every conflict; a cleared note comes back | P2 | S |
| BE-9 | Cloud payload pretty-printed: +112 % size, needs a second API call after about 1.5 years | P2 | S |
| BE-10 | `restore()` snapshots local data outside the sync lock | P2 | S |

---

### BE-1: Commit-time aborts hang the save path (P1, S)
**Evidence:** `store.js:23-26`: `tx()` listens only to `oncomplete` and `onerror`. When IndexedDB aborts at commit (QuotaExceededError, a disk I/O error), no request fails, so only `abort` fires. Measured in Chromium (`idbtest2.js`, run by `idbrun.mjs`):
- Case A, `abort()` while requests are pending: rejected. This is the path FE-5 handles.
- Case B, DataCloneError partway through the put loop: rejected, **but the puts already queued still commit** (`x1=1`). The result is a partial multi-key write.
- **Case C, abort after all requests succeeded (what a quota abort looks like): `STILL PENDING after 1.5s`.** The promise never settles.

`flush()` clears `dirty` before it awaits (`store.js:68`), so on a hang those keys are gone: no retry (`:75-77`), no toast (`:79-83`). Quota pressure is realistic here. `downloadMedia` (`me.js:290-298`) fills the same origin quota with up to 603 MB of clips, never checks `navigator.storage.estimate()`, and reports a QuotaExceededError from `cache.put` as "N files failed — try again".

**Impact:** a full phone (or a full offline-media cache) means finished workouts are silently not saved and vanish on the next launch.

**Fix:** in `tx()` add `t.onabort = () => rej(t.error || new DOMException("aborted", "AbortError"))`. In `fail()`, show the "storage full" text only when `e.name === "QuotaExceededError"`, and a generic "Couldn't save" otherwise (the case B DataCloneError will repeat every time). In `downloadMedia`, check `estimate()` first and keep at least 50 MB free. Stop the download on the first QuotaExceededError and toast "Phone storage full".

### BE-2: Two tabs or windows clobber each other (P1, S)
**Evidence:** each tab loads its own `S` once (`store.js:13,28-41`). `flush()` writes whole values per key (`:74`). `grep -rn "BroadcastChannel|onversionchange|addEventListener(\"storage\"" app/js` finds 0 hits. Scenario: the installed PWA window logs a workout (`train.js:491` writes `sessions`). A browser tab opened earlier then deletes an old session (`me.js:135`, `S.sessions = S.sessions.filter(...)` on its stale array). **The new workout disappears.** The same happens to `workouts`, `settings`, and `active` when both tabs show a session.

**Impact:** silent loss of logged workouts. On desktop and Android, a PWA window and a browser tab easily coexist.

**Fix (smallest):** allow one writer tab with `navigator.locks.request("gymy", { ifAvailable: true }, cb)`. If the lock is not granted, render "Gym is open in another window" with a "Use here" button that reloads after the other tab releases the lock (send "release" over a BroadcastChannel). Fallback when `navigator.locks` is missing: a BroadcastChannel ping on load.

### BE-3: Merge drops pain flags and adjust history (P1, S)
**Evidence:** `sync.js:109` takes the local value whenever it is not null. The defaults `pain: {}` and `adjust: {}` (`store.js:6`) are non-null, and `merge()` has no special case for them (`:111-126`). Run with `node merge.mjs`:
- `1 restore to fresh phone: pain= {} adjust= {}` (the cloud had 1 pain flag and 1 adjust entry).
- `2 two phones, different pain flags: pain= {"bench":…}` (the remote flags are lost).

**Impact:** after a phone change, injury flags (used by `data.js:141-147` to warn about and avoid exercises) and plateau history (`train.js:173` 3-week guard) are gone, even though SYNC.md promises "nothing is deleted".

**Fix:** `pain`: union per slug, `out.pain[slug] = [...new Set([...(l[slug]||[]), ...(r[slug]||[])])]`. `adjust`: per slug, the entry with the larger `at` wins. Generic loop: treat `{}` and `[]` as absent (`isEmpty(local[k]) ? remote[k] : local[k]`). Add both cases to `tools/test`.

### BE-4: IndexedDB failure at load is silent and forks the data (P1, S)
**Evidence:** `store.js:36-40`: any error (Safari "Connection to Indexed Database server lost", a transient `UnknownError`) switches the session to localStorage `gymy2`, which is normally empty. `S` stays at DEFAULTS with `onboarded:false`, so onboarding runs again and every write goes to `gymy2` (`:70-71`). On the next launch IndexedDB works and `gymy2` is never read again: that session's work is gone. There is no retry and no message. FE-26 covers the settings and token issues on this path, not this fork.

**Impact:** the user sees "all my data is gone", may re-onboard, and loses whatever they log in that session.

**Fix:** retry `idb()` once after 300 ms (also on `InvalidStateError`). If it still fails, set `S.degraded = true` and show a persistent banner ("Storage unavailable: changes may not be kept. Close and reopen the app"), and skip onboarding while degraded. On a later good load, if `gymy2` exists, merge it with `merge()` from sync.js and then remove it.

### BE-5: CSV import unit and set-type gaps (P1, S)
**Evidence:** `csv.js:106` sets `u = null` when the file has no `unit` or `weight unit` column, and `conv` (`:98`) then keeps the number as-is. Strong's current export has only `Weight` (no unit column), so a lb file imported into a kg profile stores 225 "kg". That corrupts e1RM, PRs and `suggest()` progression. Separately, `:107` (`if (!reps && !w) continue`) drops plank and cardio rows (Strong `Seconds`/`Distance`, Hevy `duration_seconds`/`distance_km`) **without counting them** in `skipped`. The UI reports success.

**Fix:** when no unit column exists (and not Hevy), have `readImport` return `unitUnknown: true` and ask "Weights in this file are in kg / lb?" before `applyImport`. Count dropped rows (`R.dropped`) and show "N timed/distance sets not imported". Optionally import seconds into a `t` field [ASK OWNER].

### BE-6: Schema versioning is a constant, not a process (P2, S)
**Evidence:** `SCHEMA = 2` (`store.js:3`) is checked only as "key missing" (`:35`). There is no `while (S.schema < SCHEMA) MIG[++S.schema](S)`. `exportData` stamps `schema: SCHEMA` (`:97`) even if the stored data is older. Sync: `parseBackup` (`sync.js:192-197`) accepts any schema, and `merge` raises `out.schema` to the max (`:126`). `merge.mjs` case 5: data from a newer app (schema 3) is merged into the old app, which then stamps it 3 and pushes it back, mixing shapes. There is no `db.onversionchange = () => db.close()`, so a future `DB_VER` bump would be blocked by an open old tab. FE-3 version skew makes this more likely.

**Fix:** add a `MIG` table run in `loadStore` and `importData`. Refuse to pull or merge when `remote.schema > SCHEMA` ("Update the app first"). Add `onversionchange` close plus a reload prompt.

### BE-7: Two-transaction load (P2, S)
**Evidence:** `store.js:31-32` calls `getAllKeys()` and `getAll()` in separate transactions. If another tab adds a key in between (first `sync`/`profile`/`pain` write), `vals[i]` shifts: `settings` can receive an array, and so on.

**Fix:** read both in one transaction (`tx("readonly", st => { const k = st.getAllKeys(), v = st.getAll(); return { get result() { return [k.result, v.result]; } }; })`) or use a cursor.

### BE-8: Notes merge (P2, S)
**Evidence:** `sync.js:78-87`. `merge.mjs` case 3: an edited note becomes `"elbows tucked 45deg\n— elbows in"`, and it grows on every 409 merge (`:290`). Case 4: a note cleared on one device comes back (another form of FE-7).

**Fix:** store `S.notesAt[slug] = Date.now()` on edit and let the newer one win. Concatenate only when neither side has a timestamp.

### BE-9: Cloud payload size (P2, S)
**Evidence:** `exportData` is indented (`store.js:98`) and `push` re-stringifies with indent 1 (`sync.js:284`). `node size.mjs` (4 sessions/week, 6 exercises x 4 sets):

| History | Compact | Indented | Base64 PUT body |
|---|---|---|---|
| 1 year | 291 KB | 616 KB (+112 %) | 822 KB |
| 3 years | 871 KB | 1.85 MB | 2.46 MB |

Past 1 MB the contents API omits the body, so every pull needs a second blob request (`sync.js:185-188`). Indented JSON reaches that point at about 1.6 years; compact JSON at about 3.4 years.

**Fix:** use `JSON.stringify(buildBackup())` with no indent for the cloud. Keep the indented form only for the user's downloaded file.

### BE-10: `restore()` race (P2, S)
**Evidence:** `sync.js:320` builds `local` after `pull()` returns but outside `exclusive()`. If an auto-push is queued, `:322-323` later writes a merge based on that older snapshot, overwriting edits made in between (for example a workout renamed while the restore spinner shows).

**Fix:** move the `buildBackup().data` and `fresh` computation inside the `exclusive` callback.

---

## Known items: new evidence
- **FE-5:** verified fixed for request-level errors (cases A and B reject, keys are re-dirtied, retry, toast). It is **not** fixed for commit aborts (BE-1).
- **FE-7:** also affects notes (BE-8, case 4) and the favourites union (`sync.js:117`).
- **FE-18:** field scan of `exercises.json` (406 KB, 842 entries, 23 fields): 22 of 23 are read by `app/js`. Only `each_side` is unread (0.8 KB). The biggest fields are `tierNote` 41.6 KB, `ar` 24.5 KB and `tr` 20.3 KB (search aliases only, `data.js:102`). No other dead data worth trimming.

## What is already good
- Finishing a workout pushes the session and clears `active` in **one** IndexedDB transaction (`train.js:491` → `store("sessions","active")`), so a crash cannot duplicate or lose it. The 150 ms debounce plus `pagehide`/`visibilitychange` flush (`store.js:62,86-87`) keeps the crash window small.
- The rest/interval timer is wall-clock based (`timer.js:6`, `end` timestamps persisted in localStorage), so it survives reloads and backgrounding.
- Sync uses GitHub `sha` optimistic concurrency, with merge-and-retry once on 409/422 (`sync.js:290`), serialised network work (`exclusive`), a token-leak guard before upload (`:285`), a blob fallback for files over 1 MB, chunked UTF-8 base64, a refusal to use public repos, and `dirty` persisted so a pending push resumes after restart (`initSync`).
- CSV import has deterministic ids (`imp-<start36>`) plus per-minute de-duplication, so re-imports and two-device imports merge cleanly. Strong "Rest Timer" rows, `;` delimiters, decimal commas and the BOM are handled.
- The v1 to v2 migration keeps the old blob (`gymy_v1_backup`). `persist()` is requested at the right moments (first finished workout, install, media download, Settings shows status and usage).
